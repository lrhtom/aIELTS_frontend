import { useRef } from 'react';
import { showToast } from './Toast';

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

export default function VocabInput({ value, onChange, placeholder }: VocabInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

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
                `${invalidLines.length} 行格式有误，需同时包含英文单词和中文释义：${examples}`,
                'error'
            );
        }
    };

    return (
        <div>
            {/* 词汇计数行 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', color: '#78716c' }}>已添加词汇：</span>
                <span style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    borderRadius: '999px',
                    padding: '2px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    minWidth: '32px',
                    textAlign: 'center',
                }}>
                    {validCount}
                </span>
                {invalidLines.length > 0 && (
                    <span style={{
                        background: 'linear-gradient(135deg, #ff4d4f, #cf1322)',
                        color: '#fff',
                        borderRadius: '999px',
                        padding: '2px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                    }}>
                        ⚠ {invalidLines.length} 行格式有误
                    </span>
                )}
            </div>

            <textarea
                ref={textareaRef}
                className="vocab-textarea"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={handleBlur}
                placeholder={placeholder ?? 'ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的\n\n每行一个词，格式：单词 - 释义'}
            />

            {/* 格式说明 */}
            <p style={{ fontSize: '12px', color: '#a8a29e', marginTop: '6px', marginBottom: 0 }}>
                每行一个词，格式：<code>单词 - 中文释义</code>，每行必须同时包含英文和中文
            </p>
        </div>
    );
}
