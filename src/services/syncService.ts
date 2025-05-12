import * as vscode from 'vscode';
import { NotionService } from './notionService';
import { ListProvider, ScrapItem } from '../listProvider';
import { AIService } from './aiService';

export enum SyncStatus {
  Idle = 'Idle',
  Syncing = 'Syncing',
  Success = 'Success',
  Error = 'Error',
  Conflict = 'Conflict'
}

export class SyncService {
  private notionService: NotionService;
  private listProvider: ListProvider;
  private aiService: AIService;
  private statusBar: vscode.StatusBarItem;
  private syncStatus: SyncStatus = SyncStatus.Idle;
  private syncInterval: NodeJS.Timeout | null = null;
  private tombstones: Set<string>;

  constructor(listProvider: ListProvider) {
    this.notionService = NotionService.getInstance();
    this.listProvider = listProvider;
    this.aiService = AIService.getInstance();
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.text = 'Scraps: Idle';
    this.statusBar.show();
    this.tombstones = new Set<string>(listProvider['globalState'].get('notionDeletedTombstones', []));
  }

  public startAutoSync(intervalMs: number = 60000) {
    this.stopAutoSync();
    this.syncInterval = setInterval(() => this.sync(), intervalMs);
  }

  public stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  public async sync() {
    this.setStatus(SyncStatus.Syncing);
    vscode.window.showInformationMessage('[Scraps] Sync started.');
    try {
      // 1. Pull from Notion
      const notionPages = await this.notionService.getAllPages();
      // 2. Get local notes
      const localNotes = this.listProvider.getAllItems();

      // Remove local notes whose Notion page was deleted/archived
      const remoteIds = new Set(notionPages.map((n: any) => n.id));
      for (const localNote of localNotes) {
        if (isNotionUUID(localNote.id) && !remoteIds.has(localNote.id)) {
          this.tombstones.add(localNote.id);
          this.listProvider.deleteItem(localNote);
        }
      }
      this.listProvider['globalState'].update('notionDeletedTombstones', Array.from(this.tombstones));

      // 3. Merge and resolve conflicts (last modified wins)
      const merged = this.mergeNotes(localNotes, notionPages, this.tombstones);

      // 4. Push local changes to Notion (only if lastModified is newer)
      for (const note of merged.toPush) {
        // Defensive: ensure label and content are valid strings
        const safeLabel = (note.label !== undefined && note.label !== null && String(note.label).trim() !== '') ? String(note.label) : 'Untitled';
        const safeContent = (note.content !== undefined && note.content !== null) ? extractPlainText(note.content) : '';
        let summary = safeContent;
        let aiSummary = '';
        try {
          // Summarize with AI before syncing
          aiSummary = await this.aiService.summarizeText(safeContent) || '';
          vscode.window.showInformationMessage('[Scraps] AI summary:', aiSummary);
          if (aiSummary && typeof aiSummary === 'string' && aiSummary.trim() !== '') {
            summary = aiSummary.trim();
          }
        } catch (e) {
          const errMsg = (e instanceof Error) ? e.message : String(e);
          vscode.window.showErrorMessage('[Scraps] AI summarization failed: ' + errMsg);
        }
        vscode.window.showInformationMessage('[Scraps] Syncing to Notion:', `Label: ${safeLabel}`, `Original: ${safeContent}`, `Summary: ${summary}`);
        try {
          if (note.id && isNotionUUID(note.id) && remoteIds.has(note.id)) {
            await this.notionService.updatePage(
              note.id,
              safeLabel,
              summary,
              note.lastModified
            );
            // Update local note with summary
            note.content = summary;
            this.listProvider.updateOrAddItem(note);
          } else {
            const created = await this.notionService.createPage(
              safeLabel,
              summary,
              note.id,
              note.lastModified
            );
            if (created && created.id) {
              note.id = created.id;
              // Update local note with summary
              note.content = summary;
              this.listProvider.updateOrAddItem(note);
            }
          }
        } catch (err) {
          const errMsg = (err instanceof Error) ? err.message : String(err);
          vscode.window.showErrorMessage('[Scraps] Failed to sync note to Notion: ' + errMsg);
          // On error, do not remove or hide the note from the UI
          this.listProvider.updateOrAddItem(note);
        }
      }

      // 5. Update local notes with Notion changes
      for (const note of merged.toPull) {
        const label = (note && 'title' in note && note.title)
          ? String(note.title)
          : ((note && 'label' in note && note.label !== undefined) ? String(note.label) : 'Untitled');
        this.listProvider.updateOrAddItem(
          new ScrapItem(
            label,
            note.content,
            vscode.TreeItemCollapsibleState.None,
            note.id,
            note.lastModified
          )
        );
      }

      this.setStatus(SyncStatus.Success);
      vscode.window.showInformationMessage('[Scraps] Sync completed.');
    } catch (err) {
      this.setStatus(SyncStatus.Error);
      vscode.window.showErrorMessage('Scraps sync failed: ' + (err as Error).message);
    }
  }

  private setStatus(status: SyncStatus) {
    this.syncStatus = status;
    this.statusBar.text = `Scraps: ${status}`;
    if (status === SyncStatus.Error) {
      this.statusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else {
      this.statusBar.backgroundColor = undefined;
    }
  }

  private mergeNotes(local: ScrapItem[], remote: any[], tombstones?: Set<string>): { toPush: ScrapItem[]; toPull: ScrapItem[] } {
    // Simple last-modified-wins merge
    const toPush: ScrapItem[] = [];
    const toPull: ScrapItem[] = [];
    const remoteMap = new Map(remote.map((n: any) => [n.id, n]));

    for (const l of local) {
      if (tombstones && tombstones.has(l.id)) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (id: ${l.id}) is in tombstones. Will not push to Notion.`);
        continue;
      }
      const r = remoteMap.get(l.id);
      if (!r) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (id: ${l.id}) not found in remote. Will push.`);
        toPush.push(l);
      } else if (l.lastModified > r.lastModified) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (id: ${l.id}) local lastModified (${l.lastModified}) > remote (${r.lastModified}). Will push.`);
        toPush.push(l);
      } else if (l.lastModified < r.lastModified) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (id: ${l.id}) local lastModified (${l.lastModified}) < remote (${r.lastModified}). Will pull.`);
        toPull.push(r);
      } else {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (id: ${l.id}) local lastModified (${l.lastModified}) == remote (${r.lastModified}). No sync needed.`);
      }
      remoteMap.delete(l.id);
    }
    // Any remaining remote notes are new
    for (const r of remoteMap.values()) {
      vscode.window.showInformationMessage(`[Scraps] Remote note '${r.title || r.label}' (id: ${r.id}) is new. Will pull.`);
      toPull.push(r);
    }
    return { toPush, toPull };
  }

  public dispose() {
    this.statusBar.dispose();
    this.stopAutoSync();
  }
}

function isNotionUUID(id: string): boolean {
  // Notion UUIDs are 32 hex chars, sometimes with dashes
  return /^[0-9a-fA-F]{32}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(id);
}

function extractPlainText(content: string): string {
  try {
    const doc = JSON.parse(content);
    let result = '';
    function walk(node: any) {
      if (node.type === 'text' && node.text) {
        result += node.text + ' ';
      }
      if (node.content) {
        node.content.forEach(walk);
      }
    }
    walk(doc);
    return result.trim();
  } catch {
    return content;
  }
}