import * as vscode from 'vscode';
import { ExtensionConfig, DEFAULT_CONFIG } from './config';

export class ConfigService {
  private static instance: ConfigService;
  private config: ExtensionConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('scraps');
    
    return {
      notion: {
        apiKey: config.get('notion.apiKey') || DEFAULT_CONFIG.notion.apiKey,
        databaseId: config.get('notion.databaseId') || DEFAULT_CONFIG.notion.databaseId,
        syncEnabled: config.get('notion.syncEnabled') || DEFAULT_CONFIG.notion.syncEnabled
      },
      ai: {
        provider: config.get('ai.provider') || DEFAULT_CONFIG.ai.provider,
        apiKey: config.get('ai.apiKey') || DEFAULT_CONFIG.ai.apiKey,
        model: config.get('ai.model') || DEFAULT_CONFIG.ai.model,
        customEndpoint: config.get('ai.customEndpoint') || DEFAULT_CONFIG.ai.customEndpoint
      }
    };
  }

  public getConfig(): ExtensionConfig {
    return this.config;
  }

  public async updateConfig(newConfig: Partial<ExtensionConfig>): Promise<void> {
    const config = vscode.workspace.getConfiguration('scraps');
    
    if (newConfig.notion) {
      await config.update('notion.apiKey', newConfig.notion.apiKey, true);
      await config.update('notion.databaseId', newConfig.notion.databaseId, true);
      await config.update('notion.syncEnabled', newConfig.notion.syncEnabled, true);
    }
    
    if (newConfig.ai) {
      await config.update('ai.provider', newConfig.ai.provider, true);
      await config.update('ai.apiKey', newConfig.ai.apiKey, true);
      await config.update('ai.model', newConfig.ai.model, true);
      if (newConfig.ai.customEndpoint !== undefined) {
        await config.update('ai.customEndpoint', newConfig.ai.customEndpoint, true);
      }
    }
    
    this.config = this.loadConfig();
  }

  public async validateConfig(): Promise<{ valid: boolean; message?: string }> {
    const { notion, ai } = this.config;
    
    if (notion.syncEnabled) {
      if (!notion.apiKey) {
        return { valid: false, message: 'Notion API key is required when sync is enabled' };
      }
      if (!notion.databaseId) {
        return { valid: false, message: 'Notion database ID is required when sync is enabled' };
      }
    }
    
    if (!ai.apiKey) {
      return { valid: false, message: 'AI API key is required' };
    }
    
    return { valid: true };
  }
} 