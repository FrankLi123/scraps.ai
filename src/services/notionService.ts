import { Client, APIResponseError } from '@notionhq/client';
import { PageObjectResponse, PartialPageObjectResponse, DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { ConfigService } from '../configService';
import * as vscode from 'vscode';

interface NotePage {
  id: string;
  title: string;
  content: string;
  url?: string;
}

export class NotionService {
  private static instance: NotionService;
  private client: Client | null = null;
  private configService: ConfigService;
  private databaseId: string = '';

  private constructor() {
    this.configService = ConfigService.getInstance();
    this.initializeClient();
  }

  public static getInstance(): NotionService {
    if (!NotionService.instance) {
      NotionService.instance = new NotionService();
    }
    return NotionService.instance;
  }

  private initializeClient(): void {
    const config = this.configService.getConfig();
    if (config.notion.apiKey) {
      this.client = new Client({
        auth: config.notion.apiKey
      });
      this.databaseId = config.notion.databaseId;
    }
  }

  public async testConnection(): Promise<boolean> {
    try {
      if (!this.client || !this.databaseId) {
        return false;
      }
      
      // Try to query the database to verify access
      await this.client.databases.retrieve({
        database_id: this.databaseId
      });
      
      return true;
    } catch (error) {
      console.error('Notion connection test failed:', error);
      return false;
    }
  }

  public async createPage(title: string, content: string): Promise<NotePage | null> {
    try {
      if (!this.client || !this.databaseId) {
        throw new Error('Notion client not initialized');
      }

      const response = await this.client.pages.create({
        parent: {
          database_id: this.databaseId
        },
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          }
        },
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content
                  }
                }
              ]
            }
          }
        ]
      });

      return {
        id: response.id,
        title,
        content
      };
    } catch (error) {
      console.error('Failed to create Notion page:', error);
      vscode.window.showErrorMessage('Failed to create note in Notion');
      return null;
    }
  }

  public async updatePage(pageId: string, title: string, content: string): Promise<NotePage | null> {
    try {
      if (!this.client) {
        throw new Error('Notion client not initialized');
      }

      // Update page properties (title)
      await this.client.pages.update({
        page_id: pageId,
        properties: {
          Name: {
            title: [
              {
                text: {
                  content: title
                }
              }
            ]
          }
        }
      });

      // Get existing blocks
      const existingBlocks = await this.client.blocks.children.list({
        block_id: pageId
      });

      // Delete existing blocks
      for (const block of existingBlocks.results) {
        await this.client.blocks.delete({
          block_id: block.id
        });
      }

      // Add new content
      await this.client.blocks.children.append({
        block_id: pageId,
        children: [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: {
                    content
                  }
                }
              ]
            }
          }
        ]
      });

      const page = await this.client.pages.retrieve({ page_id: pageId });

      return {
        id: pageId,
        title,
        content
      };
    } catch (error) {
      console.error('Failed to update Notion page:', error);
      vscode.window.showErrorMessage('Failed to update note in Notion');
      return null;
    }
  }

  public async deletePage(pageId: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Notion client not initialized');
      }

      await this.client.pages.update({
        page_id: pageId,
        archived: true
      });

      return true;
    } catch (error) {
      console.error('Failed to delete Notion page:', error);
      vscode.window.showErrorMessage('Failed to delete note in Notion');
      return false;
    }
  }

  public async getAllPages(): Promise<NotePage[]> {
    try {
      if (!this.client || !this.databaseId) {
        throw new Error('Notion client not initialized');
      }

      const response = await this.client.databases.query({
        database_id: this.databaseId,
        filter: {
          property: 'Name',
          title: {
            is_not_empty: true
          }
        }
      });

      const pages: NotePage[] = [];
      for (const page of response.results) {
        if (!('properties' in page)) continue;

        // Get page content
        const blocks = await this.client.blocks.children.list({
          block_id: page.id
        });

        // Extract content from blocks
        let content = '';
        for (const block of blocks.results) {
          if ('paragraph' in block && block.paragraph.rich_text.length > 0) {
            content += block.paragraph.rich_text.map((text: { plain_text: string }) => text.plain_text).join('') + '\n';
          }
        }

        // Get title from properties
        const titleProperty = page.properties['Name'];
        const title = titleProperty.type === 'title' 
          ? titleProperty.title.map((t: { plain_text: string }) => t.plain_text).join('')
          : 'Untitled';

        pages.push({
          id: page.id,
          title,
          content: content.trim()
        });
      }

      return pages;
    } catch (error) {
      console.error('Failed to get Notion pages:', error);
      vscode.window.showErrorMessage('Failed to fetch notes from Notion');
      return [];
    }
  }

  public async getPage(pageId: string): Promise<NotePage | null> {
    try {
      if (!this.client) {
        throw new Error('Notion client not initialized');
      }

      const page = await this.client.pages.retrieve({
        page_id: pageId
      });

      if (!('properties' in page)) {
        throw new Error('Invalid page response');
      }

      const blocks = await this.client.blocks.children.list({
        block_id: pageId
      });

      let content = '';
      for (const block of blocks.results) {
        if ('paragraph' in block && block.paragraph.rich_text.length > 0) {
          content += block.paragraph.rich_text.map((text: { plain_text: string }) => text.plain_text).join('') + '\n';
        }
      }

      const titleProperty = page.properties['Name'];
      const title = titleProperty.type === 'title'
        ? titleProperty.title.map((t: { plain_text: string }) => t.plain_text).join('')
        : 'Untitled';

      return {
        id: page.id,
        title,
        content: content.trim()
      };
    } catch (error) {
      console.error('Failed to get Notion page:', error);
      vscode.window.showErrorMessage('Failed to fetch note from Notion');
      return null;
    }
  }

  public reloadClient(): void {
    this.initializeClient();
  }
} 