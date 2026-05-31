import { useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';

export interface BadExample {
    type: string;
    en: string;
    zh: string;
    expanded_en: string;
    expanded_zh: string;
    reason: string;
}

export const ERROR_TYPE_LABELS_ZH: Record<string, string> = {
    wordy: '废话连篇',
    absolute: '过于绝对',
    superficial: '表面现象',
    illogical: '缺乏说服力',
    colloquial: '口语化表达',
    example_dump: '堆砌例子',
    memorized_template: '背诵模板',
    copy_prompt: '照抄原题',
    unclear_position: '立场不清',
    too_broad: '背景太泛',
};

export const ERROR_TYPE_LABELS_EN: Record<string, string> = {
    wordy: 'Wordy / Empty',
    absolute: 'Overly Absolute',
    superficial: 'Superficial',
    illogical: 'Lacks Persuasion',
    colloquial: 'Overly Colloquial',
    example_dump: 'Example Dumping',
    memorized_template: 'Memorized Template',
    copy_prompt: 'Copying Prompt',
    unclear_position: 'Unclear Position',
    too_broad: 'Too Broad',
};

interface BadExampleListProps {
    badExamples: BadExample[];
}

export default function BadExampleList({ badExamples }: BadExampleListProps) {
    const { translations: t, lang } = useLang();
    const [expandedBad, setExpandedBad] = useState<Record<number, boolean>>({});

    const toggleBad = (idx: number) => {
        setExpandedBad(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const getErrorLabel = (type: string) => {
        if (lang === 'zh') return ERROR_TYPE_LABELS_ZH[type] || type;
        return ERROR_TYPE_LABELS_EN[type] || type;
    };

    if (!badExamples || badExamples.length === 0) return null;

    return (
        <div className="wpt-bad-examples-list">
            {badExamples.map((bad, idx) => (
                <div className="wpt-bad-box" key={bad.type || idx}>
                    <div className="wpt-box-header">
                        <span className="wpt-badge wpt-badge-bad">{t.writingPerspective?.badBadge || 'BAD EXAMPLE'}</span>
                        <span className="wpt-error-type-label">{getErrorLabel(bad.type)}</span>
                    </div>
                    <div className="wpt-opinion-bilingual">
                        <p className="wpt-bilingual-en">{bad.en}</p>
                        <p className="wpt-bilingual-zh">{bad.zh}</p>
                    </div>
                    <button
                        className="wpt-expand-btn"
                        onClick={() => toggleBad(idx)}
                    >
                        {expandedBad[idx] ? (t.writingPerspective?.collapseBtn || 'Collapse') : (t.writingPerspective?.expandBtn || 'Expand')}
                        <span className={`wpt-expand-arrow${expandedBad[idx] ? ' open' : ''}`}>▸</span>
                    </button>
                    {expandedBad[idx] && (
                        <div className="wpt-expanded-content">
                            <div className="wpt-reason-box">
                                <span className="wpt-reason-label">{t.writingPerspective?.reasonLabel || 'Reason'}</span>
                                <p>{bad.reason}</p>
                            </div>
                            <p className="wpt-expanded-en">{bad.expanded_en}</p>
                            <p className="wpt-expanded-zh">{bad.expanded_zh}</p>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
