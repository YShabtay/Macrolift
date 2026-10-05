import { describe, expect, it } from 'vitest';
import { getScannedDefault, unitsToGrams } from './servingUnits';

describe('getScannedDefault', () => {
  it('starts a scanned product at one serving when the package states it', () => {
    expect(getScannedDefault([{ name: 'מנה', grams: 30 }, { name: 'אריזה', grams: 200 }])).toEqual({ unitName: 'מנה', amountText: '1', label: 'מנה אחת (30 גרם)' });
  });

  it('otherwise at one whole pack - a pot of dessert is eaten as a pot, not as grams', () => {
    expect(getScannedDefault([{ name: 'אריזה', grams: 200 }])).toEqual({ unitName: 'אריזה', amountText: '1', label: 'אריזה אחת (200 גרם)' });
  });

  it('falls back to 100 g only when the database knows no unit at all', () => {
    expect(getScannedDefault(undefined)).toEqual({ unitName: '', amountText: '100', label: '100 גרם' });
    expect(getScannedDefault([])).toEqual({ unitName: '', amountText: '100', label: '100 גרם' });
  });

  it('turns the default into grams correctly', () => {
    const { unitName } = getScannedDefault([{ name: 'אריזה', grams: 200 }]);
    expect(unitName).toBe('אריזה');
    expect(unitsToGrams(1, { name: 'אריזה', grams: 200 })).toBe(200);
  });
});
