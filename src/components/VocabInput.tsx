import { useRef } from 'react';
import { showToast } from './common/Toast';
import { useLang } from '../i18n/LanguageContext';

interface VocabInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

// Validation: a line must contain both English letters and Chinese characters
const hasEnglish = (s: string) => /[a-zA-Z]/.test(s);
const hasChinese = (s: string) => /[\u4e00-\u9fa5]/.test(s);

function validateLine(line: string): 'valid' | 'no-chinese' | 'no-english' | 'empty' {
    const t = line.trim();
    if (!t) return 'empty';
    if (!hasEnglish(t)) return 'no-english';
    if (!hasChinese(t)) return 'no-chinese';
    return 'valid';
}

export default function VocabInput({ value, onChange, placeholder, className }: VocabInputProps & { className?: string }) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const { t } = useLang();

    const lines = value.split('\n');
    const validCount = lines.filter(l => validateLine(l) === 'valid').length;
    const invalidLines = lines.filter(l => {
        const r = validateLine(l);
        return r === 'no-chinese' || r === 'no-english';
    });

    // on blur: strip the extra whitespace from each line
    const handleBlur = () => {
        const trimmed = value
            .split('\n')
            .map(l => l.replace(/\s+/g, ' ').trim())
            .join('\n');
        if (trimmed !== value) onChange(trimmed);

        // flag the incorrectly formatted lines
        if (invalidLines.length > 0) {
            const examples = invalidLines.slice(0, 2).map(l => `"${l.trim()}"`).join('、');
            showToast(
                `${t('components.vocabInput.toastHint')}：${examples}`,
                'error'
            );
        }
    };

    return (
        <div className={`space-y-3 ${className || ''}`}>
            {/* word count row */}
            <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] text-stone-500">{t('components.vocabInput.label')}：</span>
                <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-full px-3 py-0.5 text-[13px] font-bold min-w-[32px] text-center shadow-sm">
                    {validCount}
                </span>
                {invalidLines.length > 0 && (
                    <span className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-full px-3 py-0.5 text-[12px] font-semibold shadow-sm animate-pulse">
                        ⚠ {invalidLines.length} {t('components.vocabInput.invalidLines')}
                    </span>
                )}
            </div>

            <textarea
                ref={textareaRef}
                className="vocab-textarea w-full p-4 rounded-xl border border-stone-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all duration-200 text-stone-700 min-h-[200px] bg-stone-50 shadow-inner"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder ?? t('components.vocabInput.placeholder')}
            />

            {/* format explanation */}
            <p className="text-[12px] text-stone-400 mt-1.5 mb-0">
                {t('components.vocabInput.formatDesc')}
            </p>
        </div>
    );
}
