import { ConfigService } from '../configService';
import OpenAI from 'openai';
import axios from 'axios';
import * as vscode from 'vscode';

export interface AIProvider {
  summarizeText(text: string): Promise<string>;
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-3.5-turbo') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async summarizeText(text: string): Promise<string> {
    try {
      const messages: any[] = [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates concise summaries. Keep summaries under 3 sentences.'
        },
        {
          role: 'user',
          content: `Please summarize the following text:\n${text}`
        }
      ];
      const payload = {
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 150
      };
      const response = await this.client.chat.completions.create(payload);
      return response.choices[0]?.message?.content || 'No summary generated';
    } catch {
      return 'Failed to generate summary';
    }
  }
}

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string = 'gemini-pro') {
    this.apiKey = apiKey;
    this.model = model;
  }

  async summarizeText(text: string): Promise<string> {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
      const prompt = `Please summarize the following text in 2-3 concise sentences:\n${text}`;
      const body = {
        contents: [{ parts: [{ text: prompt }] }]
      };
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      const d = data as any;
      return (
        d.candidates?.[0]?.content?.parts?.[0]?.text || 'No summary generated'
      );
    } catch (error) {
      return 'Failed to generate summary';
    }
  }
}

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }
  async summarizeText(text: string): Promise<string> {
    try {
      const payload = {
        model: this.model,
        max_tokens: 256,
        messages: [
          { role: 'user', content: `Please summarize the following text in 2-3 concise sentences:\n${text}` }
        ]
      };
      const response = await axios.post(
        'https://api.anthropic.com/v1/messages',
        payload,
        {
          headers: {
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          }
        }
      );
      return response.data?.content?.[0]?.text || 'No summary generated';
    } catch (error) {
      return 'Failed to generate summary';
    }
  }
}

export class AIService {
  private static instance: AIService;
  private provider: AIProvider | null = null;
  private configService: ConfigService;

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.initializeProvider();
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  private initializeProvider(): void {
    const config = this.configService.getConfig();
    const model = config.ai.model;
    const apiKey = config.ai.apiKey;
    if (!model || !apiKey) {
      vscode.window.showErrorMessage('AI Error: Missing model or API key in settings.');
      return;
    }

    if (model.startsWith('gpt-')) {
      this.provider = new OpenAIProvider(apiKey, model);
    } else if (model.startsWith('gemini-')) {
      this.provider = new GeminiProvider(apiKey, model);
    } else if (model.startsWith('claude-')) {
      this.provider = new AnthropicProvider(apiKey, model);
    } else {
      this.provider = null;
    }

    vscode.window.showInformationMessage('AI provider initialized');
  }

  public async summarizeText(text: string): Promise<string | null> {
    if (!this.provider) {
      vscode.window.showErrorMessage('AI Error: No AI provider is initialized. Please check your model and API key.');
      return null;
    }
    try {
      const summary = await this.provider.summarizeText(text);
      return summary;
    } catch (error: any) {
      vscode.window.showErrorMessage('AI Error: ' + (error?.message || 'Unknown error'));
      return null;
    }
  }

  public reloadProvider(): void {
    this.initializeProvider();
  }
} 