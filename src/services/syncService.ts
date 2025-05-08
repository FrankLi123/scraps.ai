import * as vscode from 'vscode';
import { NotionService } from './notionService';
import { ListProvider, ScrapItem } from '../listProvider';

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
  private statusBar: vscode.StatusBarItem;
  private syncStatus: SyncStatus = SyncStatus.Idle;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(listProvider: ListProvider) {
    this.notionService = NotionService.getInstance();
    this.listProvider = listProvider;
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.text = 'Scraps: Idle';
    this.statusBar.show();
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
    try {
      // 1. Pull from Notion
      const notionPages = await this.notionService.getAllPages();
      // 2. Get local notes
      const localNotes = this.listProvider.getAllItems();

      // 3. Merge and resolve conflicts (last modified wins)
      const merged = this.mergeNotes(localNotes, notionPages);

      // 4. Push local changes to Notion
      for (const note of merged.toPush) {
        if (note.id && isNotionUUID(note.id)) {
          await this.notionService.updatePage(
            note.id,
            String(note.label),
            note.content,
            note.lastModified
          );
        } else {
          const created = await this.notionService.createPage(
            String(note.label),
            note.content,
            note.id,
            note.lastModified
          );
          if (created && created.id) {
            note.id = created.id;
            this.listProvider.updateOrAddItem(note);
          }
        }
      }

      // 5. Update local notes with Notion changes
      for (const note of merged.toPull) {
        this.listProvider.updateOrAddItem(
          new ScrapItem(
            String(note.label),
            note.content,
            vscode.TreeItemCollapsibleState.None,
            note.id,
            note.lastModified
          )
        );
      }

      this.setStatus(SyncStatus.Success);
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

  private mergeNotes(local: ScrapItem[], remote: any[]): { toPush: ScrapItem[]; toPull: ScrapItem[] } {
    // Simple last-modified-wins merge
    const toPush: ScrapItem[] = [];
    const toPull: ScrapItem[] = [];
    const remoteMap = new Map(remote.map((n: any) => [n.id, n]));

    for (const l of local) {
      const r = remoteMap.get(l.id);
      if (!r) {
        toPush.push(l);
      } else if (l.lastModified > r.lastModified) {
        toPush.push(l);
      } else if (l.lastModified < r.lastModified) {
        toPull.push(r);
      }
      remoteMap.delete(l.id);
    }
    // Any remaining remote notes are new
    for (const r of remoteMap.values()) {
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