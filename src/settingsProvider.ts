import * as vscode from 'vscode';
import { ConfigService } from './configService';
import { NotionService } from './services/notionService';
import { AIService } from './services/aiService';

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

    this.configService.initializeConfig();
    const config = this.configService.getConfig();

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message.type) {
        case 'updateSettings':
          await this.configService.updateConfig(message.settings);
          await this.configService.initializeConfig();
          AIService.getInstance().reloadProvider();
          NotionService.getInstance().reloadClient();
          vscode.window.showInformationMessage('Settings saved successfully');
          webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
          break;
        case 'testConnection':
          try {
            const isConnected = await NotionService.getInstance().testConnection();
            vscode.window.showInformationMessage(isConnected ? 'Successfully connected to Notion!' : 'Failed to connect to Notion');
          } catch {
            vscode.window.showErrorMessage('Failed to test Notion connection');
          }
          break;
        case 'testAI':
          try {
            const summary = await AIService.getInstance().summarizeText('This is a test of the AI summarization feature.');
            vscode.window.showInformationMessage(summary && !summary.startsWith('Failed') ? 'AI test succeeded' : 'AI test failed');
          } catch {
            vscode.window.showErrorMessage('AI test failed');
          }
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
            margin-right: 8px;
          }
          button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .api-key-input {
            position: relative;
          }
          .api-key-input input {
            padding-right: 30px;
          }
          .api-key-input .clear-button {
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: var(--vscode-input-foreground);
            cursor: pointer;
            padding: 2px 5px;
            font-size: 12px;
          }
          .api-key-input .clear-button:hover {
            color: var(--vscode-errorForeground);
          }
        </style>
      </head>
      <body>
        <form id="settingsForm">
          <div class="form-group">
            <h3>Notion Settings</h3>
            <label for="notionApiKey">API Key</label>
            <div class="api-key-input">
              <input type="password" id="notionApiKey" value="${config.notion.apiKey ? '••••••••' : ''}" placeholder="Enter Notion API key">
              ${config.notion.apiKey ? '<button type="button" class="clear-button" data-target="notionApiKey">Clear</button>' : ''}
            </div>
            
            <label for="notionDatabaseId">Database ID</label>
            <input type="text" id="notionDatabaseId" value="${config.notion.databaseId}" placeholder="Enter Notion Database ID">
            
            <label>
              <input type="checkbox" id="notionSyncEnabled" ${config.notion.syncEnabled ? 'checked' : ''}>
              Enable Sync
            </label>
          </div>

          <div class="form-group">
            <h3>AI Settings</h3>
            <label for="aiApiKey">API Key</label>
            <div class="api-key-input">
              <input type="password" id="aiApiKey" value="${config.ai.apiKey ? '••••••••' : ''}" placeholder="Enter API key for the selected model">
              ${config.ai.apiKey ? '<button type="button" class="clear-button" data-target="aiApiKey">Clear</button>' : ''}
            </div>
            <label for="aiModel">Model</label>
            <select id="aiModel">
              <option value="gpt-3.5-turbo" ${config.ai.model === 'gpt-3.5-turbo' ? 'selected' : ''}>gpt-3.5-turbo (OpenAI)</option>
              <option value="gpt-4" ${config.ai.model === 'gpt-4' ? 'selected' : ''}>gpt-4 (OpenAI)</option>
              <option value="gemini-pro" ${config.ai.model === 'gemini-pro' ? 'selected' : ''}>gemini-pro (Gemini)</option>
              <option value="gemini-pro-vision" ${config.ai.model === 'gemini-pro-vision' ? 'selected' : ''}>gemini-pro-vision (Gemini)</option>
              <option value="claude-3-opus-20240229" ${config.ai.model === 'claude-3-opus-20240229' ? 'selected' : ''}>claude-3-opus-20240229 (Anthropic)</option>
              <option value="claude-3-sonnet-20240229" ${config.ai.model === 'claude-3-sonnet-20240229' ? 'selected' : ''}>claude-3-sonnet-20240229 (Anthropic)</option>
              <option value="claude-3-haiku-20240307" ${config.ai.model === 'claude-3-haiku-20240307' ? 'selected' : ''}>claude-3-haiku-20240307 (Anthropic)</option>
              <option value="gpt-4o" ${config.ai.model === 'gpt-4o' ? 'selected' : ''}>gpt-4o (OpenAI)</option>
              <option value="o3-mini" ${config.ai.model === 'o3-mini' ? 'selected' : ''}>o3-mini (OpenRouter)</option>
            </select>
            <div class="text-xs text-gray-500 mt-1">
              Select the AI model for summarization. (gpt-* = OpenAI, gemini-* = Gemini, claude-* = Anthropic)
            </div>
          </div>

          <button type="submit">Save Settings</button>
          <button type="button" id="testConnection">Test Connection</button>
          <button type="button" id="testAI">Test AI</button>
          <button type="button" id="manualSyncBtn">Sync Now</button>
        </form>

        <script>
          const vscode = acquireVsCodeApi();
          const form = document.getElementById('settingsForm');

          // Handle clear buttons for API keys
          document.querySelectorAll('.clear-button').forEach(button => {
            button.addEventListener('click', (e) => {
              e.preventDefault();
              const targetId = button.dataset.target;
              document.getElementById(targetId).value = '';
            });
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
                apiKey: document.getElementById('aiApiKey').value,
                model: document.getElementById('aiModel').value
              }
            };
            vscode.postMessage({
              type: 'updateSettings',
              settings
            });
          });

          document.getElementById('testConnection').addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({
              type: 'testConnection'
            });
          });

          document.getElementById('testAI').addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({
              type: 'testAI'
            });
          });

          document.getElementById('manualSyncBtn').addEventListener('click', (e) => {
            e.preventDefault();
            vscode.postMessage({
              type: 'manualSync'
            });
          });
        </script>
      </body>
      </html>
    `;
  }
} 