import * as vscode from "vscode";
import { EditorProvider } from "./editorProvider";
import { ListProvider, ScrapItem } from "./listProvider";
import { OldEditorProvider } from "./oldEditorProvider";
import { ConfigService } from "./configService";
import { SettingsProvider } from "./settingsProvider";
import { SyncService } from "./services/syncService";
import { NotionService } from "./services/notionService";

export function activate(context: vscode.ExtensionContext) {
  // Initialize configuration service with context
  const configService = ConfigService.initialize(context);
  
  // Only validate if we have some configuration set
  const config = configService.getConfig();
  if (config.ai.provider || config.ai.model || config.ai.customEndpoint) {
    configService.validateConfig().then(({ valid, message }) => {
      if (!valid) {
        vscode.window.showWarningMessage(`Scraps configuration issue: ${message}`);
      }
    });
  }

  const listProvider = new ListProvider(context.globalState);
  const editorProvider = new EditorProvider(context.extensionUri, listProvider);
  const oldEditorProvider = new OldEditorProvider(context.extensionUri);

  // Commands
  vscode.commands.registerCommand("scraps.addItem", (item: ScrapItem) => {
    listProvider.addItem("Untitled");
  });
  vscode.commands.registerCommand(
    "scraps.renameItem",
    async (item: ScrapItem) => {
      const newName = await vscode.window.showInputBox({
        prompt: "Enter new name",
        value: item.label?.toString(),
      });
      if (newName) {
        listProvider.renameItem(item, newName);
      }
    }
  );
  vscode.commands.registerCommand("scraps.deleteItem", async (item: ScrapItem) => {
    if (item.notionId) {
      await NotionService.getInstance().deletePage(item.notionId);
    }
    listProvider.deleteItem(item);
  });
  vscode.commands.registerCommand("scraps.editItem", (item: ScrapItem) => {
    editorProvider.edit(item);
    editorProvider.refresh();
  });

  // Views
  const listView = vscode.window.createTreeView("scraps.list", {
    treeDataProvider: listProvider,
  });
  context.subscriptions.push(listView);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("scraps.editor", editorProvider)
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "scraps.oldEditor",
      oldEditorProvider
    )
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("scraps.settings", new SettingsProvider())
  );
  
  const syncService = new SyncService(listProvider);
  context.subscriptions.push(
    vscode.commands.registerCommand('scraps.syncNow', () => syncService.sync())
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
