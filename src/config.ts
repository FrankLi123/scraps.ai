export interface NotionConfig {
  apiKey: string;
  databaseId: string;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  customEndpoint?: string;
}

export interface ExtensionConfig {
  notion: NotionConfig;
  ai: AIConfig;
}

export const DEFAULT_CONFIG: ExtensionConfig = {
  notion: {
    apiKey: '',
    databaseId: ''
  },
  ai: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    customEndpoint: ''
  }
}; 