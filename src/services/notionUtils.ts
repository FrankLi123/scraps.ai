import * as vscode from 'vscode';
import { marked } from 'marked';

// Notion allowed code block languages
const NOTION_CODE_LANGUAGES = new Set([
  'abap', 'agda', 'arduino', 'ascii art', 'assembly', 'bash', 'basic', 'bnf', 'c', 'c#', 'c++', 'clojure', 'coffeescript', 'coq', 'css', 'dart', 'dhall', 'diff', 'docker', 'elixir', 'elm', 'erlang', 'f#', 'flow', 'fortran', 'gherkin', 'glsl', 'go', 'graphql', 'groovy', 'haskell', 'hcl', 'html', 'idris', 'java', 'javascript', 'json', 'julia', 'kotlin', 'latex', 'less', 'lisp', 'livescript', 'llvm ir', 'lua', 'makefile', 'markdown', 'markup', 'matlab', 'mathematica', 'mermaid', 'nix', 'notion formula', 'objective-c', 'ocaml', 'pascal', 'perl', 'php', 'plain text', 'powershell', 'prolog', 'protobuf', 'purescript', 'python', 'r', 'racket', 'reason', 'ruby', 'rust', 'sass', 'scala', 'scheme', 'scss', 'shell', 'smalltalk', 'solidity', 'sql', 'stylus', 'swift', 'toml', 'typescript', 'verilog', 'vhdl', 'visual basic', 'webassembly', 'xml', 'yaml', 'zig'
]);

// Utility: Convert plain text (with simple conventions) to Notion blocks
export function plainTextToNotionBlocks(text: string): any[] {
  const tokens = marked.lexer(text);
  const blocks: any[] = [];

  for (const token of tokens) {
    if (token.type === 'heading') {
      blocks.push({
        object: 'block',
        type: `heading_${Math.min(token.depth, 3)}`,
        [`heading_${Math.min(token.depth, 3)}`]: {
          rich_text: [{ type: 'text', text: { content: token.text } }]
        }
      });
    } else if (token.type === 'paragraph') {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: token.text } }]
        }
      });
    } else if (token.type === 'list') {
      for (const item of token.items) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: item.text } }]
          }
        });
      }
    } else if (token.type === 'code') {
      // Validate code block language
      let lang = (token.lang || '').toLowerCase();
      if (!NOTION_CODE_LANGUAGES.has(lang)) {
        lang = 'plain text';
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: token.text } }],
          language: lang
        }
      });
    } else if (token.type === 'hr') {
      blocks.push({
        object: 'block',
        type: 'divider',
        divider: {}
      });
    }
    // Add more token types as needed
  }
  // Filter out any falsy/undefined blocks
  const filteredBlocks = blocks.filter(Boolean);
  if (typeof console !== 'undefined') {
    console.log('plainTextToNotionBlocks - filtered blocks:', filteredBlocks);
  }
  return filteredBlocks;
}

// Utility: Convert Notion blocks to plain text (for extension display)
export function notionBlocksToPlainText(blocks: any[]): string {
  let result = '';
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph.rich_text.length) {
      result += block.paragraph.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type.startsWith('heading_')) {
      const level = block.type.split('_')[1];
      if (block[block.type] && block[block.type].rich_text) {
        result += '#'.repeat(Number(level)) + ' ' + block[block.type].rich_text.map((t: any) => t.text.content).join('') + '\n';
      }
    } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item.rich_text) {
      result += '- ' + block.bulleted_list_item.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type === 'numbered_list_item' && block.numbered_list_item.rich_text) {
      result += '1. ' + block.numbered_list_item.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type === 'to_do' && block.to_do.rich_text) {
      const checked = block.to_do.checked ? '[x]' : '[ ]';
      result += `- ${checked} ` + block.to_do.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type === 'quote' && block.quote.rich_text) {
      result += '> ' + block.quote.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type === 'divider') {
      result += '---\n';
    } else if (block.type === 'toggle' && block.toggle.rich_text) {
      result += '▸ ' + block.toggle.rich_text.map((t: any) => t.text.content).join('') + '\n';
    } else if (block.type === 'code' && block.code.rich_text.length) {
      result += '```\n' + block.code.rich_text.map((t: any) => t.text.content).join('') + '\n```\n';
    }
  }
  return result.trim();
} 