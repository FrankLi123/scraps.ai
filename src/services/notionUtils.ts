// Utility: Convert plain text (with simple conventions) to Notion blocks
export function plainTextToNotionBlocks(text: string): any[] {
  const lines = text.split('\n');
  const blocks: any[] = [];
  let currentBullets: string[] = [];
  for (const line of lines) {
    if (/^\s*- /.test(line)) {
      currentBullets.push(line.replace(/^\s*- /, ''));
    } else {
      if (currentBullets.length) {
        blocks.push({
          object: 'block',
          type: 'bulleted_list',
          bulleted_list: {
            children: currentBullets.map(bullet => ({
              object: 'block',
              type: 'bulleted_list_item',
              bulleted_list_item: {
                rich_text: [{ type: 'text', text: { content: bullet } }]
              }
            }))
          }
        });
        currentBullets = [];
      }
      const match = line.match(/^#+/);
      const level = match ? match[0].length : 1;
      if (level > 3) {
        blocks.push({
          object: 'block',
          type: 'heading_' + Math.min(level, 3),
          ['heading_' + Math.min(level, 3)]: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^#+ /, '') } }]
          }
        });
      } else if (/^```/.test(line)) {
        // Code block start/end (very basic)
        // Notion API expects code block as a single block, so this is a placeholder
      } else if (line.trim()) {
        blocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }]
          }
        });
      }
    }
  }
  if (currentBullets.length) {
    blocks.push({
      object: 'block',
      type: 'bulleted_list',
      bulleted_list: {
        children: currentBullets.map(bullet => ({
          object: 'block',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: bullet } }]
          }
        }))
      }
    });
  }
  return blocks;
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
    } else if (block.type === 'bulleted_list' && block.bulleted_list && block.bulleted_list.children) {
      for (const item of block.bulleted_list.children) {
        if (item.bulleted_list_item && item.bulleted_list_item.rich_text) {
          result += '- ' + item.bulleted_list_item.rich_text.map((t: any) => t.text.content).join('') + '\n';
        }
      }
    }
  }
  return result.trim();
} 