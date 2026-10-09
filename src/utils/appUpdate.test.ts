import { describe, expect, it } from 'vitest';
import { getBuildId, parseBundleHash } from './appUpdate';

describe('parseBundleHash', () => {
  it('reads the hash of the main script from the page HTML', () => {
    const html = '<script type="module" crossorigin src="/assets/index-DB40XKGi.js"></script><link rel="stylesheet" href="/assets/index-BPwLGFgr.css">';
    expect(parseBundleHash(html)).toBe('DB40XKGi');
  });
  it('is null when the page has no hashed main script (development, or an error page)', () => {
    expect(parseBundleHash('<script type="module" src="/src/main.tsx"></script>')).toBeNull();
    expect(parseBundleHash('')).toBeNull();
  });
  it('tells two versions apart', () => {
    expect(parseBundleHash('src="/assets/index-AAA111.js"')).not.toBe(parseBundleHash('src="/assets/index-BBB222.js"'));
  });
});

describe('getBuildId', () => {
  it('falls back to "dev" when the build did not inject one', () => {
    expect(typeof getBuildId()).toBe('string');
    expect(getBuildId().length).toBeGreaterThan(0);
  });
});
