import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector, { type AIProvider } from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_perspective.css';

interface GoodExample {
    type: string;
    idea_en: string;
    idea_zh: string;
    explain_en: string;
    explain_zh: string;
    example_en: string;
    example_zh: string;
}

interface BadExample {
    type: string;
    en: string;
    zh: string;
    expanded_en: string;
    expanded_zh: string;
    reason: string;
}

interface PerspectiveResult {
    good_examples: GoodExample[];
    bad_examples: BadExample[];
}

const GOOD_TYPE_LABELS_ZH: Record<string, string> = {
    advantages_outweigh: '优势大于劣势',
    disadvantages_outweigh: '劣势大于优势',
    agree: '同意',
    disagree: '不同意',
    both_sides: '双方观点',
    report_causes: '原因分析',
    report_solutions: '解决方案',
};

const GOOD_TYPE_LABELS_EN: Record<string, string> = {
    advantages_outweigh: 'Advantages > Disadvantages',
    disadvantages_outweigh: 'Disadvantages > Advantages',
    agree: 'Agree',
    disagree: 'Disagree',
    both_sides: 'Both Sides',
    report_causes: 'Causes',
    report_solutions: 'Solutions',
};

const ERROR_TYPE_LABELS_ZH: Record<string, string> = {
    wordy: '废话连篇',
    absolute: '过于绝对',
    superficial: '表面现象',
    illogical: '缺乏说服力',
    colloquial: '口语化表达',
    example_dump: '堆砌例子',
};

const ERROR_TYPE_LABELS_EN: Record<string, string> = {
    wordy: 'Wordy / Empty',
    absolute: 'Overly Absolute',
    superficial: 'Superficial',
    illogical: 'Lacks Persuasion',
    colloquial: 'Overly Colloquial',
    example_dump: 'Example Dumping',
};

export default function WritingPerspectiveTrainingPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [topic, setTopic] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<PerspectiveResult | null>(null);
    const [, setProvider] = useState<AIProvider>(() => {
        const local = localStorage.getItem('ai_provider') as AIProvider | null;
        return local || 'deepseek';
    });
    const [expandedGood, setExpandedGood] = useState<Record<number, boolean>>({});
    const [expandedBad, setExpandedBad] = useState<Record<number, boolean>>({});

    const toggleGood = (idx: number) => {
        setExpandedGood(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const toggleBad = (idx: number) => {
        setExpandedBad(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const handleAnalyze = async () => {
        if (!topic.trim()) {
            showToast(t.writingPerspective?.toastEmptyTopic || 'Please enter an IELTS writing topic first', 'error');
            return;
        }
        setIsLoading(true);
        setResult(null);
        setExpandedGood({});
        setExpandedBad({});
        try {
            const res = await api<PerspectiveResult & { atConsumed?: number }>(
                '/writing/perspective/train',
                {
                    method: 'POST',
                    body: { topic: topic.trim(), lang },
                },
            );
            setResult(res);
            showToast(t.writingPerspective?.toastSuccess || 'Analysis complete!', 'success');
        } catch (err: unknown) {
            const error = err as { message?: string };
            showToast(error.message || t.writingPerspective?.toastError || 'Analysis failed, please retry', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const getGoodLabel = (type: string) => {
        if (lang === 'zh') return GOOD_TYPE_LABELS_ZH[type] || type;
        return GOOD_TYPE_LABELS_EN[type] || type;
    };

    const getErrorLabel = (type: string) => {
        if (lang === 'zh') return ERROR_TYPE_LABELS_ZH[type] || type;
        return ERROR_TYPE_LABELS_EN[type] || type;
    };

    return (
        <Layout
            pageTitle={t.writingPerspective?.heading}
            pageSubtitle={t.writingPerspective?.subheading}
        >
            <div className="wpt-page">
                {/* Header */}
                <div className="wpt-header">
                    <button className="back-link" onClick={() => navigate('/writing')}>
                        {t.writingPerspective?.backToHall || '← Writing Hall'}
                    </button>
                    <div className="wpt-model-box">
                        <AiModelSelector onModelChange={(p) => setProvider(p)} />
                    </div>
                </div>

                <div className="wpt-body">
                    {/* Left: Input */}
                    <div className="wpt-input-card">
                        <div className="wpt-input-header">
                            <h2>{t.writingPerspective?.inputTitle}</h2>
                            <p>{t.writingPerspective?.inputDesc}</p>
                        </div>
                        <textarea
                            className="wpt-textarea"
                            placeholder={t.writingPerspective?.placeholder}
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            disabled={isLoading}
                            rows={6}
                        />
                        <div className="wpt-examples">
                            <span className="wpt-examples-label">{t.writingPerspective?.examplesTitle}</span>
                            <div className="wpt-example-chips">
                                <button
                                    className="wpt-example-chip"
                                    onClick={() => setTopic('Some people think that remote work greatly improves individual productivity. To what extent do you agree or disagree?')}
                                    disabled={isLoading}
                                >
                                    {t.writingPerspective?.example1}
                                </button>
                                <button
                                    className="wpt-example-chip"
                                    onClick={() => setTopic('Some people believe that governments should take strong measures to protect the environment, while others think individuals should take responsibility. Discuss both views and give your opinion.')}
                                    disabled={isLoading}
                                >
                                    {t.writingPerspective?.example2}
                                </button>
                                <button
                                    className="wpt-example-chip"
                                    onClick={() => setTopic('Some people argue that free university education is an effective means of promoting social mobility. To what extent do you agree or disagree?')}
                                    disabled={isLoading}
                                >
                                    {t.writingPerspective?.example3}
                                </button>
                            </div>
                        </div>
                        <button
                            className={`wpt-analyze-btn${isLoading ? ' loading' : ''}`}
                            onClick={handleAnalyze}
                            disabled={isLoading}
                        >
                            {isLoading ? t.writingPerspective?.analyzingBtn : t.writingPerspective?.analyzeBtn}
                        </button>
                    </div>

                    {/* Right: Results or Empty */}
                    {result ? (
                        <div className="wpt-result-area">
                            {/* Good examples */}
                            {result.good_examples.map((good, idx) => (
                                <div className="wpt-good-box" key={good.type}>
                                    <div className="wpt-box-header">
                                        <span className="wpt-badge wpt-badge-good">{t.writingPerspective?.goodBadge}</span>
                                        <span className="wpt-good-type-label">{getGoodLabel(good.type)}</span>
                                    </div>
                                    {/* Idea — always visible */}
                                    <div className="wpt-section">
                                        <span className="wpt-section-label wpt-section-idea">{t.writingPerspective?.ideaLabel}</span>
                                        <p className="wpt-section-en">{good.idea_en}</p>
                                        <p className="wpt-section-zh">{good.idea_zh}</p>
                                    </div>
                                    {/* Expand/collapse for Explain + Example */}
                                    <button
                                        className="wpt-expand-btn"
                                        onClick={() => toggleGood(idx)}
                                    >
                                        {expandedGood[idx] ? t.writingPerspective?.collapseBtn : t.writingPerspective?.expandBtn}
                                        <span className={`wpt-expand-arrow${expandedGood[idx] ? ' open' : ''}`}>▸</span>
                                    </button>
                                    {expandedGood[idx] && (
                                        <div className="wpt-expanded-content">
                                            <div className="wpt-section">
                                                <span className="wpt-section-label wpt-section-explain">{t.writingPerspective?.explainLabel}</span>
                                                <p className="wpt-section-en">{good.explain_en}</p>
                                                <p className="wpt-section-zh">{good.explain_zh}</p>
                                            </div>
                                            <div className="wpt-section">
                                                <span className="wpt-section-label wpt-section-example">{t.writingPerspective?.exampleLabel}</span>
                                                <p className="wpt-section-en">{good.example_en}</p>
                                                <p className="wpt-section-zh">{good.example_zh}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {/* Bad examples */}
                            {result.bad_examples.map((bad, idx) => (
                                <div className="wpt-bad-box" key={bad.type}>
                                    <div className="wpt-box-header">
                                        <span className="wpt-badge wpt-badge-bad">{t.writingPerspective?.badBadge}</span>
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
                                        {expandedBad[idx] ? t.writingPerspective?.collapseBtn : t.writingPerspective?.expandBtn}
                                        <span className={`wpt-expand-arrow${expandedBad[idx] ? ' open' : ''}`}>▸</span>
                                    </button>
                                    {expandedBad[idx] && (
                                        <div className="wpt-expanded-content">
                                            <div className="wpt-reason-box">
                                                <span className="wpt-reason-label">{t.writingPerspective?.reasonLabel}</span>
                                                <p>{bad.reason}</p>
                                            </div>
                                            <p className="wpt-expanded-en">{bad.expanded_en}</p>
                                            <p className="wpt-expanded-zh">{bad.expanded_zh}</p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : isLoading ? (
                        <div className="wpt-pending-card">
                            <div className="wpt-pending-inner">
                                <div className="wpt-spinner" />
                                <div className="wpt-pending-title">{t.writingPerspective?.loadingTitle}</div>
                                <div className="wpt-pending-desc">{t.writingPerspective?.loadingDesc}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="wpt-pending-card">
                            <div className="wpt-pending-inner">
                                <div className="wpt-pending-icon">💡</div>
                                <div className="wpt-pending-title">{t.writingPerspective?.emptyTitle}</div>
                                <div className="wpt-pending-desc">{t.writingPerspective?.emptyDesc}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
