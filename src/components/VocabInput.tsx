import { useRef } from 'react';
import { showToast } from './common/Toast';
import { useLang } from '../i18n/LanguageContext';

interface VocabInputProps {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
}

// 验证：行必须同时包含英文字母 和 中文字符
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
    const { translations: t } = useLang();
    const vi = t.components.vocabInput;

    const lines = value.split('\n');
    const validCount = lines.filter(l => validateLine(l) === 'valid').length;
    const invalidLines = lines.filter(l => {
        const r = validateLine(l);
        return r === 'no-chinese' || r === 'no-english';
    });

    // 失去焦点时：去掉每行多余空格
    const handleBlur = () => {
        const trimmed = value
            .split('\n')
            .map(l => l.replace(/\s+/g, ' ').trim())
            .join('\n');
        if (trimmed !== value) onChange(trimmed);

        // 提示格式不正确的行
        if (invalidLines.length > 0) {
            const examples = invalidLines.slice(0, 2).map(l => `"${l.trim()}"`).join('、');
            showToast(
                `${vi.toastHint}：${examples}`,
                'error'
            );
        }
    };

    return (
        <div className={`space-y-3 ${className || ''}`}>
            {/* 词汇计数行 */}
            <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-[13px] text-stone-500">{vi.label}：</span>
                <span className="bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-full px-3 py-0.5 text-[13px] font-bold min-w-[32px] text-center shadow-sm">
                    {validCount}
                </span>
                {invalidLines.length > 0 && (
                    <span className="bg-gradient-to-br from-red-500 to-red-700 text-white rounded-full px-3 py-0.5 text-[12px] font-semibold shadow-sm animate-pulse">
                        ⚠ {invalidLines.length} {vi.invalidLines}
                    </span>
                )}
            </div>

            <textarea
                ref={textareaRef}
                className="vocab-textarea w-full p-4 rounded-xl border border-stone-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all duration-200 text-stone-700 min-h-[200px] bg-stone-50 shadow-inner"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder ?? vi.placeholder}
            />

            {/* 格式说明 */}
            <p className="text-[12px] text-stone-400 mt-1.5 mb-0">
                {vi.formatDesc}
            </p>
        </div>
    );
}
