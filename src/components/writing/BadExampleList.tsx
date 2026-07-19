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

interface BadExampleListProps {
    badExamples: BadExample[];
}

export default function BadExampleList({ badExamples }: BadExampleListProps) {
    const { t } = useLang();
    const [expandedBad, setExpandedBad] = useState<Record<number, boolean>>({});

    const toggleBad = (idx: number) => {
        setExpandedBad(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const getErrorLabel = (type: string) => {
        return (t('badExampleTypes', { returnObjects: true }) as Record<string, string>)[type] || type;
    };

    if (!badExamples || badExamples.length === 0) return null;

    return (
        <div className="wpt-bad-examples-list">
            {badExamples.map((bad, idx) => (
                <div className="wpt-bad-box" key={bad.type || idx}>
                    <div className="wpt-box-header">
                        <span className="wpt-badge wpt-badge-bad">{t('writingPerspective.badBadge')}</span>
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
                        {expandedBad[idx] ? t('writingPerspective.collapseBtn') : t('writingPerspective.expandBtn')}
                        <span className={`wpt-expand-arrow${expandedBad[idx] ? ' open' : ''}`}>▸</span>
                    </button>
                    {expandedBad[idx] && (
                        <div className="wpt-expanded-content">
                            <div className="wpt-reason-box">
                                <span className="wpt-reason-label">{t('writingPerspective.reasonLabel')}</span>
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
