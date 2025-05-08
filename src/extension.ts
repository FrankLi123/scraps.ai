import * as vscode from "vscode";
import { EditorProvider } from "./editorProvider";
import { ListProvider, ScrapItem } from "./listProvider";
import { OldEditorProvider } from "./oldEditorProvider";
import { ConfigService } from "./configService";
import { SettingsProvider } from "./settingsProvider";

export function activate(context: vscode.ExtensionContext) {
  // Initialize configuration service with context
  const configService = ConfigService.initialize(context);
  
  // Only validate if we have some configuration set
  const config = configService.getConfig();
  if (config.notion.syncEnabled || config.ai.provider || config.ai.model || config.ai.customEndpoint) {
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
  vscode.commands.registerCommand("scraps.deleteItem", (item: ScrapItem) => {
    listProvider.deleteItem(item);
  });
  vscode.commands.registerCommand("scraps.editItem", (item: ScrapItem) => {
    editorProvider.edit(item);
    editorProvider.refresh();
  });

  // Add configuration command
  vscode.commands.registerCommand("scraps.configure", async () => {
    const config = configService.getConfig();
    let currentStep = 0;
    const steps = [
      {
        title: "Notion API Key",
        value: config.notion.apiKey,
        isPassword: true
      },
      {
        title: "Notion Database ID",
        value: config.notion.databaseId
      },
      // ... other settings
    ];

    while (currentStep < steps.length) {
      const result = await vscode.window.showQuickPick([
        { label: steps[currentStep].title, value: steps[currentStep].value },
        { label: "Back", value: "back" },
        { label: "Cancel", value: "cancel" }
      ]);

      if (!result || result.value === "cancel") {
        break;
      }

      if (result.value === "back") {
        currentStep = Math.max(0, currentStep - 1);
        continue;
      }

      // Process current step
      currentStep++;
    }
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
