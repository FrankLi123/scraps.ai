import * as vscode from 'vscode';
import { NotionService } from './notionService';
import { ListProvider, ScrapItem } from '../listProvider';
import { AIService } from './aiService';
import DiffMatchPatch from 'diff-match-patch';

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
        if (localNote.notionId && !remoteIds.has(localNote.notionId)) {
          this.tombstones.add(localNote.notionId);
          this.listProvider.deleteItem(localNote);
        }
      }
      this.listProvider['globalState'].update('notionDeletedTombstones', Array.from(this.tombstones));

      // 3. Merge and resolve conflicts (last modified wins)
      const merged = this.mergeNotes(localNotes, notionPages, this.tombstones);

      // 4. Push local changes to Notion (only if lastModified is newer)
      for (const note of merged.toPush) {
        const safeLabel = (note.label !== undefined && note.label !== null && String(note.label).trim() !== '') ? String(note.label) : 'Untitled';
        const safeContent = (note.content !== undefined && note.content !== null) ? extractPlainText(note.content) : '';
        let aiOutput = '';
        try {
          // Fetch previous content from Notion (if available)
          let previousContent = '';
          if (note.notionId) {
            const remoteNote = notionPages.find((n) => n.id === note.notionId);
            previousContent = remoteNote ? remoteNote.content : '';
          }
          // If no previous content, treat as new note
          if (!previousContent) previousContent = '';
          // Mark edited lines
          const markedContent = previousContent
            ? markEditedLines(previousContent, safeContent)
            : `[EDITED]\n${safeContent}\n[/EDITED]`;
          aiOutput = await this.aiService.summarizeText(markedContent) || '';
          vscode.window.showInformationMessage('[Scraps] AI summary:', aiOutput);
        } catch (e) {
          const errMsg = (e instanceof Error) ? e.message : String(e);
          vscode.window.showErrorMessage('[Scraps] AI summarization failed: ' + errMsg);
        }
        // Validate AI output
        if (!aiOutput || aiOutput.trim().length === 0) {
          vscode.window.showErrorMessage('[Scraps] AI output is empty. Skipping sync for this note.');
          continue;
        }
        // Convert to Notion blocks
        let blocks;
        try {
          blocks = require('./notionUtils').plainTextToNotionBlocks(aiOutput);
          vscode.window.showInformationMessage('[Scraps] Notion blocks:', JSON.stringify(blocks));
        } catch (e) {
          vscode.window.showErrorMessage('[Scraps] Failed to generate Notion blocks for logging. Skipping sync for this note.' + (e as Error).message);
          continue;
        }
        if (!blocks || blocks.length === 0) {
          // Fallback: treat as a single paragraph block
          blocks = [{
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: aiOutput } }]
            }
          }];
        }
        // Defensive: only update local note after successful Notion sync
        try {
          let notionSuccess = false;
          if (note.notionId) {
            const updated = await this.notionService.updatePage(
              note.notionId,
              safeLabel,
              aiOutput,
              note.lastModified
            );
            if (updated) {
              note.content = aiOutput;
              this.listProvider.updateOrAddItem(note);
              notionSuccess = true;
            }
          } else {
            const created = await this.notionService.createPage(
              safeLabel,
              aiOutput,
              note.id,
              note.lastModified
            );
            if (created && created.id) {
              note.notionId = created.id;
              note.content = aiOutput;
              this.listProvider.updateOrAddItem(note);
              notionSuccess = true;
            }
          }
          if (!notionSuccess) {
            vscode.window.showErrorMessage('[Scraps] Notion sync failed, local note not updated.');
          }
        } catch (err) {
          const errMsg = (err instanceof Error) ? err.message : String(err);
          vscode.window.showErrorMessage('[Scraps] Failed to sync note to Notion: ' + errMsg);
        }
      }

      // 5. Update local notes with Notion changes
      for (const note of merged.toPull) {
        const label = (note && 'title' in note && note.title)
          ? String(note.title)
          : ((note && 'label' in note && note.label !== undefined) ? String(note.label) : 'Untitled');
        let localItem = this.listProvider.getAllItems().find(i => i.notionId === note.id);
        if (localItem) {
          localItem.label = label;
          localItem.content = note.content;
          localItem.lastModified = note.lastModified;
          this.listProvider.updateOrAddItem(localItem);
        } else {
          this.listProvider.updateOrAddItem(
            new ScrapItem(
              label,
              note.content,
              vscode.TreeItemCollapsibleState.None,
              undefined,
              note.id,
              note.lastModified
            )
          );
        }
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
      if (tombstones && l.notionId && tombstones.has(l.notionId)) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (notionId: ${l.notionId}) is in tombstones. Will not push to Notion.`);
        continue;
      }
      const r = l.notionId ? remoteMap.get(l.notionId) : undefined;
      if (!r) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (notionId: ${l.notionId}) not found in remote. Will push.`);
        toPush.push(l);
      } else if (l.lastModified > r.lastModified) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (notionId: ${l.notionId}) local lastModified (${l.lastModified}) > remote (${r.lastModified}). Will push.`);
        toPush.push(l);
      } else if (l.lastModified < r.lastModified) {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (notionId: ${l.notionId}) local lastModified (${l.lastModified}) < remote (${r.lastModified}). Will pull.`);
        toPull.push(r);
      } else {
        vscode.window.showInformationMessage(`[Scraps] Note '${l.label}' (notionId: ${l.notionId}) local lastModified (${l.lastModified}) == remote (${r.lastModified}). No sync needed.`);
      }
      if (l.notionId) remoteMap.delete(l.notionId);
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

// Helper to mark edited sections using diff-match-patch
function markEditedLines(original: string, edited: string): string {
  const dmp = new DiffMatchPatch();
  const diffs = dmp.diff_main(original, edited);
  dmp.diff_cleanupSemantic(diffs);

  let result: string[] = [];
  let inEditBlock = false;

  for (const [op, data] of diffs) {
    if (op === DiffMatchPatch.DIFF_EQUAL) {
      if (inEditBlock) {
        result.push('[/EDITED]');
        inEditBlock = false;
      }
      result.push(data);
    } else if (op === DiffMatchPatch.DIFF_INSERT || op === DiffMatchPatch.DIFF_DELETE) {
      if (!inEditBlock) {
        result.push('[EDITED]');
        inEditBlock = true;
      }
      result.push(data);
    }
  }
  if (inEditBlock) result.push('[/EDITED]');
  return result.join('');
}