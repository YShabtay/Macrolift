export interface InlineSegment {
  text: string;
  bold: boolean;
}

export type ChatBlock = { type: 'p'; segments: InlineSegment[] } | { type: 'ul' | 'ol'; items: InlineSegment[][] };

/** Splits `**bold**` runs out of a line; any leftover lone asterisks (a half-written marker) are dropped. */
export function splitInline(line: string): InlineSegment[] {
  const parts = line.split(/(\*\*[^*\n]+\*\*)/g).filter((p) => p.length > 0);
  return parts.map((part) => {
    const isBold = part.startsWith('**') && part.endsWith('**') && part.length > 4;
    return { text: (isBold ? part.slice(2, -2) : part).replace(/\*/g, ''), bold: isBold };
  });
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/**
 * Turns the model's text into simple blocks: paragraphs, bullet lists and numbered lists with **bold** inline. Models like to answer in Markdown;
 * this shows the useful parts of it (bold, lists) and never leaves stray asterisks or heading marks on screen.
 */
export function parseChatText(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.replace(/^\s*#{1,6}\s+/, '');
    if (line.trim() === '') continue;

    const numbered = NUMBERED.exec(line);
    const bullet = numbered ? null : BULLET.exec(line);
    const listType = numbered ? 'ol' : bullet ? 'ul' : null;
    if (listType) {
      const item = splitInline((numbered ?? bullet)![1]);
      const last = blocks[blocks.length - 1];
      if (last && last.type === listType) last.items.push(item);
      else blocks.push({ type: listType, items: [item] });
    } else {
      blocks.push({ type: 'p', segments: splitInline(line.trim()) });
    }
  }
  return blocks;
}
