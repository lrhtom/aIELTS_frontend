import { describe, it, expect } from 'vitest';
import { translations, type Lang } from './translations';

const REFERENCE: Lang = 'zh'; // zh is the source of truth for shape
const zh = translations[REFERENCE];
const otherLangs = (Object.keys(translations) as Lang[]).filter(l => l !== REFERENCE);

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

describe('i18n parity — every language vs zh (source of truth)', () => {
  const zhKeys = leafKeys(zh);
  const zhSet = new Set(zhKeys);

  for (const lang of otherLangs) {
    it(`${lang} has the same shape as zh (same key paths)`, () => {
      const langKeys = leafKeys(translations[lang]);
      const langSet = new Set(langKeys);
      const onlyInZh = zhKeys.filter(k => !langSet.has(k));
      const onlyInLang = langKeys.filter(k => !zhSet.has(k));
      if (onlyInZh.length > 0 || onlyInLang.length > 0) {
        // Surface the actual diff so the failure message is actionable.
        const msg =
          (onlyInZh.length ? `Keys only in zh:\n  ${onlyInZh.join('\n  ')}\n` : '') +
          (onlyInLang.length ? `Keys only in ${lang}:\n  ${onlyInLang.join('\n  ')}\n` : '');
        throw new Error(msg);
      }
      expect(onlyInZh).toEqual([]);
      expect(onlyInLang).toEqual([]);
    });
  }

  it('no string value is unintentionally empty (all languages)', () => {
    // Paths that legitimately hold "" strings — e.g. calendar dayLabels uses alternating
    // empties to render only Mon/Wed/Fri labels on a 7-day strip; markedUnit is the
    // zh measure-word slot ("5 个") which English renders as bare "5".
    const ALLOWED_EMPTY =
      /^(profile\.home\.calendar\.dayLabels\[[0246]\]|vocab\.(storyMode|articleCopy)\.markedUnit)$/;
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
    const problems: string[] = [];
    for (const lang of Object.keys(translations) as Lang[]) {
      const empties = findEmpties(translations[lang]);
      if (empties.length > 0) problems.push(`Empty ${lang} values at:\n  ${empties.join('\n  ')}`);
    }
    if (problems.length > 0) throw new Error(problems.join('\n'));
  });
});
