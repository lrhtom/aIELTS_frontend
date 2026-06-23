import { describe, it, expect } from 'vitest';
import { zh } from './translations.zh';
import { en } from './translations.en';

/**
 * Walk an object and emit dot-paths for every leaf string. Array values become
 * `<path>[N]` entries so we also catch length divergence on arrays of strings/objects.
 */
function leafKeys(obj: unknown, prefix = ''): string[] {
    if (obj === null || obj === undefined) return [];
    if (typeof obj !== 'object') return [prefix];
    if (Array.isArray(obj)) {
        const out: string[] = [];
        obj.forEach((v, i) => out.push(...leafKeys(v, `${prefix}[${i}]`)));
        return out;
    }
    const out: string[] = [];
    for (const k of Object.keys(obj as Record<string, unknown>)) {
        const next = prefix ? `${prefix}.${k}` : k;
        out.push(...leafKeys((obj as Record<string, unknown>)[k], next));
    }
    return out;
}

describe('i18n parity — zh vs en', () => {
    const zhKeys = leafKeys(zh);
    const enKeys = leafKeys(en);
    const zhSet = new Set(zhKeys);
    const enSet = new Set(enKeys);

    it('zh and en have the same shape (same key paths)', () => {
        const onlyInZh = zhKeys.filter(k => !enSet.has(k));
        const onlyInEn = enKeys.filter(k => !zhSet.has(k));
        if (onlyInZh.length > 0 || onlyInEn.length > 0) {
            // Surface the actual diff so the failure message is actionable.
            const msg =
                (onlyInZh.length ? `Keys only in zh:\n  ${onlyInZh.join('\n  ')}\n` : '') +
                (onlyInEn.length ? `Keys only in en:\n  ${onlyInEn.join('\n  ')}\n` : '');
            throw new Error(msg);
        }
        expect(onlyInZh).toEqual([]);
        expect(onlyInEn).toEqual([]);
    });

    it('no string value is unintentionally empty', () => {
        // Paths that legitimately hold "" strings — e.g. calendar dayLabels uses alternating
        // empties to render only Mon/Wed/Fri labels on a 7-day strip.
        const ALLOWED_EMPTY = /^profile\.home\.calendar\.dayLabels\[[0246]\]$/;
        const findEmpties = (obj: unknown, prefix = ''): string[] => {
            if (obj === null || obj === undefined) return [];
            if (typeof obj === 'string') {
                if (obj.length > 0) return [];
                return ALLOWED_EMPTY.test(prefix) ? [] : [prefix];
            }
            if (Array.isArray(obj)) return obj.flatMap((v, i) => findEmpties(v, `${prefix}[${i}]`));
            if (typeof obj === 'object') {
                return Object.keys(obj as Record<string, unknown>).flatMap(k =>
                    findEmpties((obj as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k),
                );
            }
            return [];
        };
        const zhEmpties = findEmpties(zh);
        const enEmpties = findEmpties(en);
        if (zhEmpties.length > 0 || enEmpties.length > 0) {
            const msg =
                (zhEmpties.length ? `Empty zh values at:\n  ${zhEmpties.join('\n  ')}\n` : '') +
                (enEmpties.length ? `Empty en values at:\n  ${enEmpties.join('\n  ')}\n` : '');
            throw new Error(msg);
        }
    });
});
