import * as vscode from 'vscode';
import { ConfigService } from './configService';

export class SettingsProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private configService: ConfigService;

  constructor() {
    this.configService = ConfigService.getInstance();
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(vscode.Uri.file(__dirname), '..')]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'updateSettings':
          await this.configService.updateConfig(message.settings);
          vscode.window.showInformationMessage('Settings saved successfully');
          break;
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const config = this.configService.getConfig();
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Scraps Settings</title>
        <style>
          body {
            padding: 20px;
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
          }
          input, select {
            width: 100%;
            padding: 5px;
            margin-bottom: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
          }
          button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            cursor: pointer;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
        </style>
      </head>
      <body>
        <form id="settingsForm">
          <div class="form-group">
            <h3>Notion Settings</h3>
            <label for="notionApiKey">API Key</label>
            <input type="password" id="notionApiKey" value="${config.notion.apiKey}">
            
            <label for="notionDatabaseId">Database ID</label>
            <input type="text" id="notionDatabaseId" value="${config.notion.databaseId}">
            
            <label>
              <input type="checkbox" id="notionSyncEnabled" ${config.notion.syncEnabled ? 'checked' : ''}>
              Enable Sync
            </label>
          </div>

          <div class="form-group">
            <h3>AI Settings</h3>
            <label for="aiProvider">Provider</label>
            <select id="aiProvider">
              <option value="openai" ${config.ai.provider === 'openai' ? 'selected' : ''}>OpenAI</option>
              <option value="anthropic" ${config.ai.provider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
              <option value="custom" ${config.ai.provider === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
            
            <label for="aiApiKey">API Key</label>
            <input type="password" id="aiApiKey" value="${config.ai.apiKey}">
            
            <label for="aiModel">Model</label>
            <input type="text" id="aiModel" value="${config.ai.model}">
            
            <div id="customEndpointGroup" style="display: ${config.ai.provider === 'custom' ? 'block' : 'none'}">
              <label for="customEndpoint">Custom Endpoint</label>
              <input type="text" id="customEndpoint" value="${config.ai.customEndpoint || ''}">
            </div>
          </div>

          <button type="submit">Save Settings</button>
        </form>

        <script>
          const vscode = acquireVsCodeApi();
          const form = document.getElementById('settingsForm');
          const aiProvider = document.getElementById('aiProvider');
          const customEndpointGroup = document.getElementById('customEndpointGroup');

          aiProvider.addEventListener('change', (e) => {
            customEndpointGroup.style.display = e.target.value === 'custom' ? 'block' : 'none';
          });

          form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const settings = {
              notion: {
                apiKey: document.getElementById('notionApiKey').value,
                databaseId: document.getElementById('notionDatabaseId').value,
                syncEnabled: document.getElementById('notionSyncEnabled').checked
              },
              ai: {
                provider: document.getElementById('aiProvider').value,
                apiKey: document.getElementById('aiApiKey').value,
                model: document.getElementById('aiModel').value,
                customEndpoint: document.getElementById('customEndpoint').value
              }
            };

            vscode.postMessage({
              type: 'updateSettings',
              settings
            });
          });
        </script>
      </body>
      </html>
    `;
  }
} 