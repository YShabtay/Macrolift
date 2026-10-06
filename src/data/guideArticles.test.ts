import { describe, expect, it } from 'vitest';
import { EVIDENCE_LABELS, GUIDE_ARTICLES } from './guideArticles';

describe('guide articles', () => {
  it('have unique ids, text and search keywords', () => {
    const ids = GUIDE_ARTICLES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of GUIDE_ARTICLES) {
      expect(a.title.trim().length, a.id).toBeGreaterThan(0);
      expect(a.paragraphs.length, a.id).toBeGreaterThanOrEqual(3);
      expect(a.keywords.length, a.id).toBeGreaterThan(0);
    }
  });

  it('say how firm their evidence is, and name it: only common knowledge may go without a source', () => {
    for (const a of GUIDE_ARTICLES) {
      expect(EVIDENCE_LABELS[a.evidence], a.id).toBeTruthy();
      if (a.evidence !== 'common') expect(a.sources.length, `${a.id} claims ${a.evidence} evidence but names no source`).toBeGreaterThan(0);
    }
  });

  it('link only to https pages, each source once per guide', () => {
    for (const a of GUIDE_ARTICLES) {
      const labels = a.sources.map((s) => s.label);
      expect(new Set(labels).size, a.id).toBe(labels.length);
      for (const s of a.sources) if (s.url) expect(s.url.startsWith('https://'), `${a.id}: ${s.url}`).toBe(true);
    }
  });

  it('do not present contested claims as settled (the old per-meal protein ceiling, a guaranteed deload payoff, an unsourced sex-specific bulking rate)', () => {
    const text = GUIDE_ARTICLES.flatMap((a) => a.paragraphs).join(' ');
    expect(text).not.toContain('יש תקרה לכמות החלבון');
    expect(text).not.toContain('פיצוי יתר" (Supercompensation)');
    expect(text).not.toContain('ולנשים בערך מחצית מזה');
  });
});
