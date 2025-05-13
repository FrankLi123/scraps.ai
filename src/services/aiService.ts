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
          content: `You are a helpful assistant for technical note-taking. For each command, add a concise, one-line description above it and ALWAYS put the command itself in a Markdown code block (triple backticks). Do not change, remove, or summarize the commands.\n\nFor any non-command notes, 
          group them at the end under a heading like 'Notes' or 'To-Do', and present them as a bulleted list or paragraph for clarity.\n\nExample:\n# Before:\ndocker-compose up\npip3 install\nI want to make 
          the backend first, then I will add the authentication, and then the frontend, and then fix the UI.\n\n# After:\ndocker-compose command to start up services defined in a docker-compose file:\n\n\`\`\`\ndocker-compose up\n\`\`\`\n\nCommand to install a 
          package using pip for Python 3:\n\n\`\`\`\npip3 install\n\`\`\`\n\n## Notes\n- I want to make the backend first, then I will add the authentication, and then the frontend, and then fix the UI.\n\nRepeat this pattern for all commands and notes.`
        },
        {
          role: 'user',
          content: `Please minimally structure the following note for clarity. For each command, add a concise, one-line description above it and ALWAYS put the command itself in a Markdown code block (triple backticks). For any non-command notes, group them at the end under a heading like 'Notes' or 'To-Do', and present them as a bulleted list or paragraph for clarity. Do not change, remove, or summarize the commands.\n\n${text}`
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

export class FireworksAIProvider implements AIProvider {
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
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for technical note-taking. For each command, add a concise, one-line description above it and ALWAYS put the command itself in a Markdown code block (triple backticks). Do not change, remove, or summarize the commands.\n\nFor any non-command notes, group them at the end under a heading like 'Notes' or 'To-Do', and present them as a bulleted list or paragraph for clarity.\n\nExample:\n# Before:\ndocker-compose up\npip3 install\nI want to make the backend first, then I will add the authentication, and then the frontend, and then fix the UI.\n\n# After:\ndocker-compose command to start up services defined in a docker-compose file:\n\n\`\`\`\ndocker-compose up\n\`\`\`\n\nCommand to install a package using pip for Python 3:\n\n\`\`\`\npip3 install\n\`\`\`\n\n## Notes\n- I want to make the backend first, then I will add the authentication, and then the frontend, and then fix the UI.\n\nRepeat this pattern for all commands and notes.`
          },
          {
            role: 'user',
            content: `Please minimally structure the following note for clarity. For each command, add a concise, one-line description above it and ALWAYS put the command itself in a Markdown code block (triple backticks). For any non-command notes, group them at the end under a heading like 'Notes' or 'To-Do', and present them as a bulleted list or paragraph for clarity. Do not change, remove, or summarize the commands.\n\n${text}`
          }
        ],
        temperature: 0.7,
        max_tokens: 150
      };
      const response = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Fireworks API error: ${response.status} ${response.statusText}`);
      }
      const data: any = await response.json();
      return data.choices?.[0]?.message?.content || 'No summary generated';
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

  // Model mapping for API compatibility
  private MODEL_MAP: Record<string, string> = {
    'gpt4o': 'gpt-4o',
    'gpt4o-mini': 'gpt-4o-mini',
    'gemini-2.0-flash': 'models/gemini-2.0-flash',
    'fireworks-ai': 'accounts/fireworks/models/llama-v3-70b-instruct'
  };

  private initializeProvider(): void {
    const config = this.configService.getConfig();
    const model = config.ai.model;
    const apiKey = config.ai.apiKey;
    if (!model || !apiKey) {
      vscode.window.showErrorMessage('AI Error: Missing model or API key in settings.');
      return;
    }
    const apiModel = this.MODEL_MAP[model] || model;

    if (model === 'gpt4o' || model === 'gpt4o-mini') {
      this.provider = new OpenAIProvider(apiKey, apiModel);
    } else if (model === 'gemini-2.0-flash') {
      this.provider = new GeminiProvider(apiKey, apiModel);
    } else if (model === 'fireworks-ai') {
      this.provider = new FireworksAIProvider(apiKey, apiModel);
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