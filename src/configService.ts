import * as vscode from 'vscode';
import { ExtensionConfig, DEFAULT_CONFIG } from './config';

export class ConfigService {
  private static instance: ConfigService;
  private config!: ExtensionConfig;
  private secrets: vscode.SecretStorage;

  private constructor(context: vscode.ExtensionContext) {
    this.secrets = context.secrets;
    this.initializeConfig();
  }

  private async initializeConfig(): Promise<void> {
    const config = vscode.workspace.getConfiguration('scraps');
    
    // Load API keys from SecretStorage
    const notionApiKey = await this.secrets.get('notion.apiKey') || '';
    const aiApiKey = await this.secrets.get('ai.apiKey') || '';
    
    this.config = {
      notion: {
        apiKey: notionApiKey,
        databaseId: config.get('notion.databaseId') || DEFAULT_CONFIG.notion.databaseId,
        syncEnabled: config.get('notion.syncEnabled') || DEFAULT_CONFIG.notion.syncEnabled
      },
      ai: {
        provider: config.get('ai.provider') || DEFAULT_CONFIG.ai.provider,
        apiKey: aiApiKey,
        model: config.get('ai.model') || DEFAULT_CONFIG.ai.model,
        customEndpoint: config.get('ai.customEndpoint') || DEFAULT_CONFIG.ai.customEndpoint
      }
    };
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      throw new Error('ConfigService must be initialized with context first');
    }
    return ConfigService.instance;
  }

  public static initialize(context: vscode.ExtensionContext): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService(context);
    }
    return ConfigService.instance;
  }

  public getConfig(): ExtensionConfig {
    return this.config;
  }

  public async updateConfig(newConfig: Partial<ExtensionConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('scraps');
    
    if (newConfig.notion) {
      // Store API key in SecretStorage
      if (newConfig.notion.apiKey !== undefined) {
        await this.secrets.store('notion.apiKey', newConfig.notion.apiKey);
      }
      
      // Store other settings in regular configuration
      await config.update('notion.databaseId', newConfig.notion.databaseId, true);
      await config.update('notion.syncEnabled', newConfig.notion.syncEnabled, true);
    }
    
    if (newConfig.ai) {
      // Store API key in SecretStorage
      if (newConfig.ai.apiKey !== undefined) {
        await this.secrets.store('ai.apiKey', newConfig.ai.apiKey);
      }
      
      // Store other settings in regular configuration
      await config.update('ai.provider', newConfig.ai.provider, true);
      await config.update('ai.model', newConfig.ai.model, true);
      if (newConfig.ai.customEndpoint !== undefined) {
        await config.update('ai.customEndpoint', newConfig.ai.customEndpoint, true);
      }
    }
    
    await this.initializeConfig();
    
    // Validate after update
    const validation = await this.validateConfig();
    if (!validation.valid) {
      vscode.window.showWarningMessage(`Scraps configuration issue: ${validation.message}`);
    }
  }

  public async validateConfig(): Promise<{ valid: boolean; message?: string }> {
    // Only validate Notion settings if sync is enabled
    if (this.config.notion.syncEnabled) {
      if (!this.config.notion.apiKey) {
        return { valid: false, message: 'Notion API key is required when sync is enabled' };
      }
      if (!this.config.notion.databaseId) {
        return { valid: false, message: 'Notion database ID is required when sync is enabled' };
      }
    }
    
    // Only validate AI settings if we have partial configuration
    if (this.config.ai.provider || this.config.ai.model || this.config.ai.customEndpoint) {
      if (!this.config.ai.apiKey) {
        return { valid: false, message: 'AI API key is required when AI features are configured' };
      }
    }
    
    return { valid: true };
  }
} 