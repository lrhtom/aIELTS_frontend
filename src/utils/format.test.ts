import { describe, it, expect } from 'vitest';
import { formatATBalance, formatTime } from './format';

describe('formatATBalance', () => {
  it('returns 0 for undefined', () => {
    expect(formatATBalance(undefined)).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(formatATBalance(null)).toBe(0);
  });

  it('returns the number as-is for values under 1000', () => {
    expect(formatATBalance(0)).toBe(0);
    expect(formatATBalance(500)).toBe(500);
    expect(formatATBalance(999)).toBe(999);
  });

  it('formats values >= 1000 with k suffix', () => {
    expect(formatATBalance(1000)).toBe('1k');
    expect(formatATBalance(2500)).toBe('2k');
    expect(formatATBalance(9999)).toBe('9k');
    expect(formatATBalance(12000)).toBe('12k');
  });

  it('formats negative values', () => {
    expect(formatATBalance(-500)).toBe(-500);
    expect(formatATBalance(-1500)).toBe('-1k');
  });
});

describe('formatTime', () => {
  it('returns the input as-is for invalid date strings', () => {
    expect(formatTime('not-a-date')).toBe('not-a-date');
  });

  it('returns a formatted string for valid ISO dates', () => {
    const result = formatTime('2024-01-15T10:30:00Z');
    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
  });
});
