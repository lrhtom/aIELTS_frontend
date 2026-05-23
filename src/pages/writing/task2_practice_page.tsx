import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { type WritingStep } from '../../types/writing_page';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';

interface Task2Data {
    prompt: string;
}

interface EvaluationResult {
    scores: {
        ta: number;
        cc: number;
        lr: number;
        gra: number;
    };
    overall: number;
    feedback: string;
}

function PromptMarkdown({ prompt }: { prompt?: string }) {
    if (!prompt) return null;

    return (
        <div className="wp-prompt-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {prompt}
            </ReactMarkdown>
        </div>
    );
}

export default function Task2PracticePage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') || 'opinion';
    const topicCategory = (searchParams.get('topic') || 'all').trim().toLowerCase() || 'all';
    const cacheKey = `writing_task2_session_${type}_${topicCategory}`;

    const [step, setStep] = useState<WritingStep>('loading');
    const [taskData, setTaskData] = useState<Task2Data | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    const hasFetchedRef = useRef<string | null>(null);

    // Refresh recovery: restore in-progress session first.
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached) as {
                step: WritingStep;
                taskData: Task2Data | null;
                userAnswer: string;
                result: EvaluationResult | null;
            };

            if (parsed.taskData && parsed.step !== 'loading') {
                setTaskData(parsed.taskData);
                setUserAnswer(parsed.userAnswer || '');
                setResult(parsed.result || null);
                setStep(parsed.step);
            }
        } catch {
            sessionStorage.removeItem(cacheKey);
        }
    }, [cacheKey]);

    // Persist answering/evaluation state for refresh recovery.
    useEffect(() => {
        if (!taskData || step === 'loading') return;
        sessionStorage.setItem(cacheKey, JSON.stringify({
            step,
            taskData,
            userAnswer,
            result,
        }));
    }, [cacheKey, step, taskData, userAnswer, result]);

    // Initial load - generate prompt
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as { step: WritingStep; taskData: Task2Data | null };
                if (parsed.taskData && parsed.step !== 'loading') {
                    return;
                }
            } catch {
                sessionStorage.removeItem(cacheKey);
            }
        }

        // Prevent double-fire from React StrictMode or rapid re-mount
        if (hasFetchedRef.current === cacheKey) return;
        hasFetchedRef.current = cacheKey;

        let isMounted = true;

        async function fetchPrompt() {
            setStep('loading');
            try {
                const res = await api<Task2Data>('/writing/task2/generate', {
                    method: 'POST',
                    body: {
                        type,
                        topic_category: topicCategory,
                    },
                });
                if (isMounted) {
                    setTaskData(res);
                    setStep('answering');
                }
            } catch (err: unknown) {
                console.error('Generate task2 error:', err);
                const error = err as { message?: string };
                showToast(error.message || t.practiceSandbox.toastFailGenTask2, 'error');
                if (isMounted) {
                    hasFetchedRef.current = null; // allow retry on next mount
                    navigate(-1);
                }
            }
        }
        fetchPrompt();

        return () => { isMounted = false; hasFetchedRef.current = null; };
    }, [type, topicCategory, navigate, cacheKey, t.practiceSandbox.toastFailGenTask2]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const wordBadge = lang === 'zh' ? `${wordCount} / 250+ 词` : `${wordCount} / 250+ words`;

    const handleSubmitAnser = () => {
        if (!userAnswer.trim()) {
            showToast(t.practiceSandbox.toastEmpty, 'error');
            return;
        }
        if (wordCount < 100) {
            showToast(t.practiceSandbox.toastTooShortTask2, 'error');
        }
        setStep('settlement');
    };

    const handleStartEvaluation = async () => {
        if (!taskData || isEvaluating) return;
        setIsEvaluating(true);
        setStep('evaluating');
        try {
            const res = await api<EvaluationResult>('/writing/task2/evaluate', {
                method: 'POST',
                body: {
                    prompt: taskData.prompt,
                    userAnswer: userAnswer,
                    lang,
                },
            });
            setResult(res);
            setStep('result');
            showToast(t.practiceSandbox.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Evaluate task2 error:', err);
            const error = err as { message?: string };
            showToast(error.message || t.practiceSandbox.toastFailEval, 'error');
            setStep('settlement');
        } finally {
            setIsEvaluating(false);
        }
    };

    const typeNameMap: Record<string, string> = {
        'opinion': t.task2Selection.types.opinion.title,
        'opinion_agree': t.task2OpinionSelection.types.agree.title,
        'opinion_discuss': t.task2OpinionSelection.types.discuss.title,
        'opinion_advantages': t.task2OpinionSelection.types.advantages.title,
        'report': t.task2Selection.types.report.title,
        'mixed': t.task2Selection.types.mixed.title,
        'random': t.task2Selection.types.random.title,
        'innovation': t.task2Selection.types.innovation.title,
    };
    const titleName = typeNameMap[type] || (lang === 'zh' ? '大作文测试' : 'Task 2 Practice');

    const renderLoading = () => (
        <div className="wp-state-wrap">
            <div className="spinner wp-loading-spinner"></div>
            <h2>{t.practiceSandbox.loadingTitleTask2}</h2>
            <p>{t.practiceSandbox.loadingDescTask2.replace('{type}', titleName)}</p>
        </div>
    );

    const renderAnswering = () => (
        <div className="wp-split">
            {/* Left: Prompt */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>📜 {t.practiceSandbox.promptTitle}</h3>
                </div>
                <div className="wp-panel-body">
                    <div className="wp-prompt-block">
                        <PromptMarkdown prompt={taskData?.prompt} />
                    </div>
                </div>
            </div>

            {/* Right: Editor */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>✍️ {t.practiceSandbox.yourAnswer}</h3>
                    <span className={`wp-word-badge${wordCount >= 250 ? ' ok' : ''}`}>
                        {wordBadge}
                    </span>
                </div>
                <div className="wp-panel-body">
                    <textarea
                        className="wp-answer-textarea"
                        placeholder={t.practiceSandbox.placeholderTask2}
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                    />
                </div>
                <div className="wp-panel-footer">
                    <button className="wp-submit-btn" onClick={handleSubmitAnser}>
                        {t.practiceSandbox.finishBtn}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSettlement = () => (
        <div className="wp-settlement-overlay">
            <div className="wp-settlement-content">
                <div className="wp-settlement-icon">🎉</div>
                <h2>{t.practiceSandbox.settlementTitle}</h2>
                <p className="wp-settlement-desc">
                    {t.practiceSandbox.settlementDesc}
                </p>

            <div className="wp-settlement-actions">
                <button
                    className="primary-button"
                    onClick={handleStartEvaluation}
                    disabled={isEvaluating}
                >
                    <span>🎯</span> {t.practiceSandbox.callAiBtn}
                </button>
                <button
                    className="wp-ghost-btn"
                    onClick={() => navigate('/writing/task2')}
                >
                    {t.practiceSandbox.backBtn}
                </button>
            </div>
            </div>
        </div>
    );

    const renderEvaluating = () => (
        <div className="wp-state-wrap wp-state-wrap--evaluating">
            <div className="spinner wp-loading-spinner wp-loading-spinner--lg"></div>
            <h2>{t.practiceSandbox.evaluatingTitle}</h2>
            <p>
                {t.practiceSandbox.evaluatingDesc}<br />
                {t.practiceSandbox.evaluatingDescLine2}
            </p>
        </div>
    );

    const renderResult = () => {
        if (!result) return null;
        return (
            <div className="wp-split wp-split--result">
                {/* Left: Essay replay */}
                <div className="wp-panel">
                    <div className="wp-panel-header">
                        <h3>📄 {t.practiceSandbox.reviewOriginal}</h3>
                        <button className="back-link wp-result-back-btn" onClick={() => navigate('/writing/task2')}>
                            {t.practiceSandbox.backToPracticeBtn}
                        </button>
                    </div>
                    <div className="wp-panel-body">
                        <div className="wp-prompt-block wp-prompt-block--compact">
                            <PromptMarkdown prompt={taskData?.prompt} />
                        </div>
                        <div className="wp-essay-replay">{userAnswer}</div>
                    </div>
                </div>

                {/* Right: Scores */}
                <div className="wc-result-card">
                    <div className="wc-band-display">
                        <div className="wc-band-label">{t.practiceSandbox.overallBand}</div>
                        <div className="wc-band-value">{result.overall.toFixed(1)}</div>
                        <div className="wc-band-subtitle">{t.practiceSandbox.overallBandSubtitle}</div>
                    </div>

                    <div className="wc-scores-grid">
                        {[
                            { label: `🎯 ${t.practiceSandbox.taTask2}`, val: result.scores.ta },
                            { label: `🔗 ${t.practiceSandbox.cc}`, val: result.scores.cc },
                            { label: `📚 ${t.practiceSandbox.lr}`, val: result.scores.lr },
                            { label: `📝 ${t.practiceSandbox.gra}`, val: result.scores.gra },
                        ].map(({ label, val }) => (
                            <div key={label} className="wc-score-item">
                                <div className="wc-score-label">{label}</div>
                                <div className="wc-score-val">{val.toFixed(1)}</div>
                                <div className="wc-score-bar">
                                    <div className="wc-score-bar-fill" style={{ width: `${(val / 9) * 100}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="wc-feedback-box">
                        <h3>💡 {t.practiceSandbox.examinerReport}</h3>
                        <div className="wc-feedback-content">
                            {result.feedback.split('\n').map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <div className="practice-container writing-practice-page">
                <div className="practice-header writing-practice-header">
                    {(step === 'loading' || step === 'answering') && (
                        <button className="back-link writing-back-btn" onClick={() => navigate(-1)}>
                            {t.practiceSandbox.abortBtn}
                        </button>
                    )}
                    <h1 className="writing-practice-title">
                        <span>🖋️</span> {t.practiceSandbox.titleTask2.replace('{type}', titleName)}
                    </h1>
                </div>

                {step === 'loading' && renderLoading()}
                {step === 'answering' && renderAnswering()}
                {step === 'settlement' && (
                    <>
                        {renderAnswering()}
                        {renderSettlement()}
                    </>
                )}
                {step === 'evaluating' && renderEvaluating()}
                {step === 'result' && renderResult()}
            </div>
        </Layout>
    );
}
