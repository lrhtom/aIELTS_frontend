import { describe, it, expect } from 'vitest';
import { rawToBand, formatBand, roundIeltsOverall } from './ielts_band';

describe('rawToBand — 阅读 (Academic)', () => {
    it('40/40 → 9.0', () => expect(rawToBand('reading', 40, 40)).toBe(9.0));
    it('39/40 → 9.0', () => expect(rawToBand('reading', 39, 40)).toBe(9.0));
    it('37/40 → 8.5', () => expect(rawToBand('reading', 37, 40)).toBe(8.5));
    it('33/40 → 7.5', () => expect(rawToBand('reading', 33, 40)).toBe(7.5));
    it('30/40 → 7.0', () => expect(rawToBand('reading', 30, 40)).toBe(7.0));
    it('29/40 → 6.5', () => expect(rawToBand('reading', 29, 40)).toBe(6.5));
    it('23/40 → 6.0', () => expect(rawToBand('reading', 23, 40)).toBe(6.0));
    it('0/40 → 0', () => expect(rawToBand('reading', 0, 40)).toBe(0));
});

describe('rawToBand — 听力', () => {
    it('32/40 → 7.5（听力档位比阅读低一档起跳）', () => expect(rawToBand('listening', 32, 40)).toBe(7.5));
    it('30/40 → 7.0', () => expect(rawToBand('listening', 30, 40)).toBe(7.0));
    it('26/40 → 6.5', () => expect(rawToBand('listening', 26, 40)).toBe(6.5));
    it('18/40 → 5.5', () => expect(rawToBand('listening', 18, 40)).toBe(5.5));
});

describe('rawToBand — 非全套不换算', () => {
    it('单篇 13 题 → null', () => expect(rawToBand('reading', 10, 13)).toBeNull());
    it('单 section 10 题 → null', () => expect(rawToBand('listening', 8, 10)).toBeNull());
    it('改版前 39 题旧卷 → 仍换算', () => expect(rawToBand('reading', 30, 39)).toBe(7.0));
});

describe('formatBand', () => {
    it('整数分保留一位小数', () => expect(formatBand(7)).toBe('7.0'));
    it('半分原样', () => expect(formatBand(6.5)).toBe('6.5'));
});

describe('roundIeltsOverall — 雅思总分官方舍入', () => {
    it('6.125 → 6.0（<.25 舍）', () => expect(roundIeltsOverall(6.125)).toBe(6.0));
    it('6.25 → 6.5（.25 入半分）', () => expect(roundIeltsOverall(6.25)).toBe(6.5));
    it('6.625 → 6.5（<.75 归半分）', () => expect(roundIeltsOverall(6.625)).toBe(6.5));
    it('6.75 → 7.0（.75 进整）', () => expect(roundIeltsOverall(6.75)).toBe(7.0));
    it('7.0 → 7.0（整数不动）', () => expect(roundIeltsOverall(7)).toBe(7.0));
    it('弃权全 0 → 0', () => expect(roundIeltsOverall(0)).toBe(0));
    it('上限钳制 9.0', () => expect(roundIeltsOverall(9.4)).toBe(9.0));
});
