import { describe, expect, it } from 'vitest';
import { parseBackupFile } from './backupValidation';

describe('parseBackupFile', () => {
  it('rejects text that is not JSON, with a readable message', () => {
    const result = parseBackupFile('{ this is not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/JSON/);
  });

  it('rejects JSON with nothing recognizable in it', () => {
    expect(parseBackupFile('{}').ok).toBe(false);
    expect(parseBackupFile('{"hello":"world"}').ok).toBe(false);
    expect(parseBackupFile('42').ok).toBe(false);
    expect(parseBackupFile('null').ok).toBe(false);
  });

  it('reads a bare list of weigh-ins as a weights-only restore', () => {
    const result = parseBackupFile('[{"date":"2026-10-01","weightKg":70.5},{"date":"2026-10-02","weightKg":70.1}]');
    expect(result).toMatchObject({ ok: true, kind: 'weights', skippedEntries: 0 });
    if (result.ok && result.kind === 'weights') expect(result.entries).toHaveLength(2);
  });

  it('skips and counts bad entries instead of failing the whole file', () => {
    const result = parseBackupFile('[{"date":"2026-10-01","weightKg":70.5},{"date":"garbage","weightKg":70},{"date":"2026-10-03","weightKg":-1}]');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.skippedEntries).toBe(2);
  });

  it('restores a full backup, normalizing what it contains', () => {
    const file = JSON.stringify({
      appState: {
        profile: { name: 'בדיקה' },
        weightLogs: [{ id: 'a', date: '2026-10-01', weightKg: 70 }, { date: 'bad', weightKg: 70 }],
        foodLog: [{ id: 'f', date: '2026-10-01', meal: 'lunch', name: 'אורז', quantity: '100 גרם', calories: 130, proteinG: 3, fatG: 0, carbsG: 28 }],
      },
    });
    const result = parseBackupFile(file);
    expect(result.ok).toBe(true);
    if (result.ok && result.kind === 'full') {
      expect(result.state.weightLogs).toHaveLength(1);
      expect(result.state.foodLog).toHaveLength(1);
      expect(result.skippedEntries).toBeGreaterThanOrEqual(1);
    } else {
      throw new Error('expected a full restore');
    }
  });

  it('accepts a backup whose data is not wrapped in an appState object', () => {
    const result = parseBackupFile(JSON.stringify({ profile: { name: 'x' }, weightLogs: [{ id: 'a', date: '2026-10-01', weightKg: 70 }] }));
    expect(result).toMatchObject({ ok: true, kind: 'full' });
  });
});
