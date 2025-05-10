import * as vscode from "vscode";

export class ListProvider implements vscode.TreeDataProvider<ScrapItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ScrapItem | undefined> =
    new vscode.EventEmitter<ScrapItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<ScrapItem | undefined> =
    this._onDidChangeTreeData.event;

  private items: ScrapItem[] = [];

  constructor(private readonly globalState: vscode.Memento) {
    this.loadItems();
  }

  getTreeItem(element: ScrapItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ScrapItem): Thenable<ScrapItem[]> {
    if (element === undefined) {
      return Promise.resolve(this.items);
    }
    return Promise.resolve([]);
  }

  addItem(label: string) {
    const newItem = new ScrapItem(
      label || "Untitled",
      "{}",
      vscode.TreeItemCollapsibleState.None
    );
    this.items.push(newItem);
    this.saveItems();
    this._onDidChangeTreeData.fire(undefined);
  }

  renameItem(item: ScrapItem, label: string) {
    item.label = label || "Untitled";
    this.saveItems();
    this._onDidChangeTreeData.fire(undefined);
  }

  editItem(item: ScrapItem, content: string) {
    item.content = content;
    item.lastModified = Date.now();
    this.saveItems();
    this._onDidChangeTreeData.fire(undefined);
  }

  deleteItem(item: ScrapItem) {
    const index = this.items.indexOf(item);
    if (index !== -1) {
      this.items.splice(index, 1);
      this.saveItems();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  private saveItems() {
    const data = this.items.map((item) => ({
      id: item.id,
      label: item.label,
      content: item.content,
      lastModified: item.lastModified,
    }));
    this.globalState.update("items", data);
  }

  private loadItems() {
    const items =
      this.globalState.get<{ label: string; content: string; id: string; lastModified: number }[]>("items") || [];
    this.items = Array.from(items, ({ id, label, content, lastModified }) => {
      return new ScrapItem(
        label,
        content,
        vscode.TreeItemCollapsibleState.None,
        id,
        lastModified
      );
    });
  }

  getAllItems(): ScrapItem[] {
    return this.items;
  }

  updateOrAddItem(item: ScrapItem) {
    const existing = this.items.find(i => i.id === item.id);
    if (existing) {
      existing.label = item.label;
      existing.content = item.content;
    } else {
      this.items.push(item);
    }
    this.saveItems();
    this._onDidChangeTreeData.fire(undefined);
  }
}

export class ScrapItem extends vscode.TreeItem {
  public id: string;
  public content: string = "";
  public lastModified: number;

  constructor(
    label: string,
    content: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    id?: string,
    lastModified?: number
  ) {
    super(label || "Untitled", collapsibleState);
    this.id = id || this.generateId();
    this.content = content;
    this.lastModified = lastModified || Date.now();
    this.iconPath = new vscode.ThemeIcon("note");
    this.command = {
      command: "scraps.editItem",
      title: "Edit",
      arguments: [this],
    };
  }

  private generateId(): string {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10)
    );
  }
}
