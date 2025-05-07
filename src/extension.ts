import * as vscode from "vscode";
import { EditorProvider } from "./editorProvider";
import { ListProvider, ScrapItem } from "./listProvider";
import { OldEditorProvider } from "./oldEditorProvider";
import { ConfigService } from "./configService";

export function activate(context: vscode.ExtensionContext) {
  // Initialize configuration service
  const configService = ConfigService.getInstance();
  
  // Validate configuration
  configService.validateConfig().then(({ valid, message }) => {
    if (!valid) {
      vscode.window.showWarningMessage(`Scraps configuration issue: ${message}`);
    }
  });

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
    
    const notionApiKey = await vscode.window.showInputBox({
      prompt: "Enter Notion API Key",
      value: config.notion.apiKey,
      password: true
    });
    
    if (notionApiKey !== undefined) {
      const notionDatabaseId = await vscode.window.showInputBox({
        prompt: "Enter Notion Database ID",
        value: config.notion.databaseId
      });
      
      if (notionDatabaseId !== undefined) {
        const enableSync = await vscode.window.showQuickPick(['Yes', 'No'], {
          placeHolder: 'Enable automatic syncing with Notion?'
        });
        
        if (enableSync !== undefined) {
          const aiProvider = await vscode.window.showQuickPick(['openai', 'anthropic', 'custom'], {
            placeHolder: 'Select AI Provider'
          });
          
          if (aiProvider !== undefined) {
            const aiApiKey = await vscode.window.showInputBox({
              prompt: "Enter AI API Key",
              value: config.ai.apiKey,
              password: true
            });
            
            if (aiApiKey !== undefined) {
              const aiModel = await vscode.window.showInputBox({
                prompt: "Enter AI Model",
                value: config.ai.model
              });
              
              if (aiModel !== undefined) {
                let customEndpoint;
                
                if (aiProvider === 'custom') {
                  customEndpoint = await vscode.window.showInputBox({
                    prompt: "Enter Custom Endpoint URL",
                    value: config.ai.customEndpoint
                  });
                }
                
                await configService.updateConfig({
                  notion: {
                    apiKey: notionApiKey,
                    databaseId: notionDatabaseId,
                    syncEnabled: enableSync === 'Yes'
                  },
                  ai: {
                    provider: aiProvider as 'openai' | 'anthropic' | 'custom',
                    apiKey: aiApiKey,
                    model: aiModel,
                    customEndpoint
                  }
                });
                
                vscode.window.showInformationMessage('Scraps configuration updated successfully');
              }
            }
          }
        }
      }
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
