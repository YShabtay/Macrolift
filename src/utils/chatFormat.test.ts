import { describe, expect, it } from 'vitest';
import { parseChatText, splitInline } from './chatFormat';

describe('splitInline', () => {
  it('marks **bold** runs and keeps the surrounding text', () => {
    expect(splitInline('אכלו **חלבון** לפני')).toEqual([
      { text: 'אכלו ', bold: false },
      { text: 'חלבון', bold: true },
      { text: ' לפני', bold: false },
    ]);
  });

  it('never leaves stray asterisks on screen, even for a half-written marker', () => {
    const text = (line: string) => splitInline(line).map((s) => s.text).join('');
    expect(text('חלבון **חשוב')).toBe('חלבון חשוב');
    expect(text('כוכבית * בודדת')).toBe('כוכבית  בודדת');
    expect(text('****')).toBe('');
  });
});

describe('parseChatText', () => {
  it('turns lines into paragraphs and skips blank lines', () => {
    const blocks = parseChatText('שורה ראשונה\n\n\nשורה שנייה');
    expect(blocks).toHaveLength(2);
    expect(blocks.every((b) => b.type === 'p')).toBe(true);
  });

  it('groups consecutive bullets into one list, for -, * and • markers', () => {
    const blocks = parseChatText('- ביצים\n* טונה\n• יוגורט');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ type: 'ul' });
    expect(blocks[0].type === 'ul' && blocks[0].items).toHaveLength(3);
  });

  it('keeps numbered and bulleted lists apart', () => {
    const blocks = parseChatText('1. ראשון\n2) שני\n- נקודה');
    expect(blocks.map((b) => b.type)).toEqual(['ol', 'ul']);
  });

  it('strips Markdown heading marks', () => {
    const [block] = parseChatText('## כותרת');
    expect(block).toEqual({ type: 'p', segments: [{ text: 'כותרת', bold: false }] });
  });

  it('handles Windows line endings and empty input', () => {
    expect(parseChatText('א\r\nב')).toHaveLength(2);
    expect(parseChatText('')).toEqual([]);
  });
});
