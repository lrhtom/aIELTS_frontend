import Layout from '../../components/layout/Layout';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';

interface CorrectionResponse {
    Task_Response: number;
    Coherence_Cohesion: number;
    Lexical_Resource: number;
    Grammatical_Range: number;
    Overall_Band: number;
    Feedback?: string;
    feedback?: string;
    Model_Essay?: string;
}

export default function WritingCorrectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [text, setText] = useState('');
    const [promptText, setPromptText] = useState('');
    const [taskType, setTaskType] = useState<'task1' | 'task2'>('task2');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<CorrectionResponse | null>(null);
    const [copied, setCopied] = useState(false);

    const minWords = taskType === 'task1' ? 150 : 250;

    const wordCount = useMemo(() => {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [text]);

    const handleEvaluate = async () => {
        if (!text.trim()) {
            showToast(t.writingCorrection.toastEmpty, 'error');
            return;
        }
        setIsEvaluating(true);
        setResult(null);
        try {
            const res = await api<CorrectionResponse>('/writing/generate', {
                method: 'POST',
                body: { text, prompt: promptText, task_type: taskType, lang },
            });
            setResult(res);
            showToast(t.writingCorrection.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Submit writing correction error:', err);
            const error = err as { message?: string; title?: string };
            showToast(error.message || t.writingCorrection.toastFail, 'error', error.title || t.writingCorrection.toastErrorTitle);
        } finally {
            setIsEvaluating(false);
        }
    };

    const scores = result ? [
        { label: taskType === 'task1' ? 'Task Achievement' : t.writingCorrection.ta, val: result.Task_Response },
        { label: t.writingCorrection.cc, val: result.Coherence_Cohesion },
        { label: t.writingCorrection.lr, val: result.Lexical_Resource },
        { label: t.writingCorrection.gra, val: result.Grammatical_Range },
    ] : [];

    return (
        <Layout>
            <div className="wc-page">

                {/* Header */}
                <div className="wc-header">
                    <div className="wc-header-title">
                        <button className="back-link" onClick={() => navigate('/writing')}>
                            {t.writingCorrection.backToHall}
                        </button>
                        <h1>{t.writingCorrection.title}</h1>
                        <p>{t.writingCorrection.subtitle}</p>
                    </div>
                    <div className="wc-model-box">
                        <AiModelSelector />
                    </div>
                </div>

                {/* Main body */}
                <div className="wc-body">

                    {/* Left: Editor */}
                    <div className="wc-editor-card">

                        {/* Scrollable content: type switcher + sections */}
                        <div className="wc-editor-scroll">

                        {/* Task type switcher */}
                        <div className="wc-type-switcher">
                            <button
                                className={`wc-type-btn${taskType === 'task1' ? ' active' : ''}`}
                                onClick={() => { setTaskType('task1'); setResult(null); }}
                                disabled={isEvaluating}
                            >
                                Task 1 · 小作文
                            </button>
                            <button
                                className={`wc-type-btn${taskType === 'task2' ? ' active' : ''}`}
                                onClick={() => { setTaskType('task2'); setResult(null); }}
                                disabled={isEvaluating}
                            >
                                Task 2 · 大作文
                            </button>
                        </div>

                        {/* Prompt (optional) */}
                        <div className="wc-section">
                            <label className="wc-section-label">
                                {t.writingCorrection.promptLabel}
                                <span className="wc-optional-tag">可选</span>
                            </label>
                            <textarea
                                className="wc-textarea wc-textarea--prompt"
                                placeholder={t.writingCorrection.promptPlaceholder}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                disabled={isEvaluating}
                            />
                        </div>

                        {/* Essay */}
                        <div className="wc-section">
                            <div className="wc-section-head">
                                <label className="wc-section-label">{t.writingCorrection.yourEssay}</label>
                                <span className="wc-word-count">
                                    {t.writingCorrection.wordCount}<strong>{wordCount}</strong> / {minWords}+
                                </span>
                            </div>
                            <textarea
                                className="wc-textarea wc-textarea--essay"
                                placeholder={t.writingCorrection.placeholder}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                disabled={isEvaluating}
                            />
                            <div className="wc-word-bar">
                                <div
                                    className="wc-word-bar-fill"
                                    style={{ width: `${Math.min((wordCount / minWords) * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        </div>{/* end wc-editor-scroll */}

                        {/* Submit footer — pinned at bottom */}
                        <div className="wc-footer">
                            <button
                                className={`wc-eval-btn${isEvaluating ? ' loading' : ''}`}
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                            >
                                {isEvaluating ? t.writingCorrection.evaluatingBtn : t.writingCorrection.evaluateBtn}
                            </button>
                        </div>
                    </div>

                    {/* Right: Result or Pending Placeholder */}
                    {result ? (
                        <div className="wc-result-card">

                            {/* Overall band */}
                            <div className="wc-band-display">
                                <div className="wc-band-label">{t.writingCorrection.overallBand}</div>
                                <div className="wc-band-value">{result.Overall_Band.toFixed(1)}</div>
                                <div className="wc-band-subtitle">IELTS Overall Band Score</div>
                            </div>

                            {/* Sub-scores */}
                            <div className="wc-scores-grid">
                                {scores.map(({ label, val }) => (
                                    <div key={label} className="wc-score-item">
                                        <div className="wc-score-label">{label}</div>
                                        <div className="wc-score-val">{val.toFixed(1)}</div>
                                        <div className="wc-score-bar">
                                            <div className="wc-score-bar-fill" style={{ width: `${(val / 9) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Feedback */}
                            <div className="wc-feedback-box">
                                <h3>{t.writingCorrection.examinerFeedback}</h3>
                                <div className="wc-feedback-content">
                                    {(result.Feedback || result.feedback || '').split('\n').map((line, idx) => (
                                        <p key={idx}>{line}</p>
                                    ))}
                                </div>
                            </div>

                            {/* Model essay */}
                            {result.Model_Essay && (
                                <div className="wc-model-essay-box">
                                    <div className="wc-model-essay-header">
                                        <div>
                                            <span className="wc-model-essay-badge">Band 8+</span>
                                            <h3>AI 修改高分范文</h3>
                                        </div>
                                        <button
                                            className={`wc-copy-btn${copied ? ' copied' : ''}`}
                                            onClick={() => {
                                                navigator.clipboard.writeText(result.Model_Essay!);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                        >
                                            {copied ? '✓ 已复制' : '复制'}
                                        </button>
                                    </div>
                                    <div className="wc-model-essay-content">
                                        {result.Model_Essay.split(/\n\n+/).map((para, idx) => (
                                            <p key={idx}>{para.trim()}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : isEvaluating ? (
                        <div className="wc-pending-card">
                            <div className="wc-pending-inner">
                                <div className="wc-loading-spinner" />
                                <div className="wc-pending-title">
                                    {lang === 'zh' ? '批改中...' : 'Evaluating...'}
                                </div>
                                <div className="wc-pending-desc">
                                    {lang === 'zh'
                                        ? 'AI 正在批改你的作文，请稍候'
                                        : 'AI is evaluating your essay, please wait…'}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="wc-pending-card">
                            <div className="wc-pending-inner">
                                <div className="wc-pending-icon">📋</div>
                                <div className="wc-pending-title">
                                    {lang === 'zh' ? '待批改' : 'Awaiting Submission'}
                                </div>
                                <div className="wc-pending-desc">
                                    {lang === 'zh'
                                        ? '粘贴你的作文并点击「开始批改」，AI 评分与详细反馈将在此处显示'
                                        : 'Paste your essay and click "Evaluate" — AI scores and detailed feedback will appear here.'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
