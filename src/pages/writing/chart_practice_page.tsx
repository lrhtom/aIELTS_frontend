import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import MermaidChart from '../../components/MermaidChart';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';

type Step = 'loading' | 'answering' | 'settlement' | 'evaluating' | 'result';

interface ChartData {
    imageUrl: string | null;
    mermaidCode?: string | null;
    prompt: string;
    pythonCode: string;
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

export default function ChartPracticePage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') || 'line';
    const cacheKey = `writing_task1_chart_session_${type}`;

    const [step, setStep] = useState<Step>('loading');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
    const [isEvaluating, setIsEvaluating] = useState(false);
    // Guard against React StrictMode double-invocation and rapid re-mount
    const hasFetchedRef = useRef<string | null>(null);

    // Refresh recovery: if local session exists, restore and skip loading state.
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached) as {
                step: Step;
                chartData: ChartData | null;
                userAnswer: string;
                result: EvaluationResult | null;
            };

            if (parsed.chartData && parsed.step !== 'loading') {
                setChartData(parsed.chartData);
                setUserAnswer(parsed.userAnswer || '');
                setResult(parsed.result || null);
                setStep(parsed.step);
            }
        } catch {
            sessionStorage.removeItem(cacheKey);
        }
    }, [cacheKey]);

    // Persist answering state for page refresh recovery.
    useEffect(() => {
        if (!chartData || step === 'loading') return;
        sessionStorage.setItem(cacheKey, JSON.stringify({
            step,
            chartData,
            userAnswer,
            result,
        }));
    }, [cacheKey, step, chartData, userAnswer, result]);

    // Initial load - generate chart
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                const parsed = JSON.parse(cached) as { step: Step; chartData: ChartData | null };
                if (parsed.chartData && parsed.step !== 'loading') {
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

        async function fetchChart() {
            setStep('loading');
            try {
                const res = await api<ChartData>('/writing/chart/generate', {
                    method: 'POST',
                    body: { type },
                });
                if (isMounted) {
                    setChartData(res);
                    setStep('answering');
                }
            } catch (err: unknown) {
                console.error('Generate chart error:', err);
                const error = err as { message?: string };
                showToast(error.message || t.practiceSandbox.toastFailGenChart, 'error');
                if (isMounted) {
                    hasFetchedRef.current = null; // allow retry on next mount
                    navigate('/writing/chart');
                }
            }
        }
        fetchChart();

        return () => { isMounted = false; hasFetchedRef.current = null; };
    }, [type, navigate, cacheKey]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const resolvedImageSrc = useMemo(() => {
        if (!chartData?.imageUrl) return null;
        return chartData.imageUrl.startsWith('data:')
            ? chartData.imageUrl
            : `${import.meta.env.VITE_API_BASE}${chartData.imageUrl}`;
    }, [chartData?.imageUrl]);

    const handleSubmitAnser = () => {
        if (!userAnswer.trim()) {
            showToast(t.practiceSandbox.toastEmpty, 'error');
            return;
        }
        if (wordCount < 50) {
            showToast(t.practiceSandbox.toastTooShortTask1, 'error');
        }
        setStep('settlement');
    };

    const handleStartEvaluation = async () => {
        if (!chartData || isEvaluating) return;
        setIsEvaluating(true);
        setStep('evaluating');
        try {
            const res = await api<EvaluationResult>('/writing/chart/evaluate', {
                method: 'POST',
                body: {
                    prompt: chartData.prompt,
                    pythonCode: chartData.pythonCode,
                    userAnswer: userAnswer,
                    lang,
                },
            });
            setResult(res);
            setStep('result');
            showToast(t.practiceSandbox.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Evaluate chart error:', err);
            const error = err as { message?: string };
            showToast(error.message || t.practiceSandbox.toastFailEval, 'error');
            setStep('settlement'); // fall back to allow retry
        } finally {
            setIsEvaluating(false);
        }
    };

    // ─── Render functions ──────────────────────────────────────────────────

    const renderLoading = () => (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
            <h2>{t.practiceSandbox.loadingTitleTask1}</h2>
            <p style={{ color: 'var(--color-text-secondary)' }}>{t.practiceSandbox.loadingDescTask1}</p>
        </div>
    );

    const renderEvaluating = () => (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 24px', width: '50px', height: '50px', borderWidth: '4px' }}></div>
            <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>{t.practiceSandbox.evaluatingTitle}</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '18px', lineHeight: 1.6 }}>
                {t.practiceSandbox.evaluatingDesc}<br />
                {t.practiceSandbox.evaluatingDescLine2}
            </p>
        </div>
    );

    const renderAnswering = () => (
        <div className="wp-split">
            {/* Left: Chart & Prompt */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>📊 {t.practiceSandbox.promptTitle}</h3>
                </div>
                <div className="wp-panel-body">
                    <div className="wp-prompt-block">
                        {chartData?.prompt}
                    </div>
                    {chartData?.mermaidCode ? (
                        <MermaidChart chart={chartData.mermaidCode} />
                    ) : resolvedImageSrc ? (
                        <div style={{ display: 'flex', justifyContent: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <img
                                src={resolvedImageSrc}
                                alt="Generated Chart"
                                onClick={() => setPreviewImageSrc(resolvedImageSrc)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setPreviewImageSrc(resolvedImageSrc);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Open chart image preview"
                                style={{ maxWidth: '100%', height: 'auto', maxHeight: '380px', objectFit: 'contain', cursor: 'zoom-in' }}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Right: Editor */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>✍️ 您的作答区</h3>
                    <span className={`wp-word-badge${wordCount >= 150 ? ' ok' : ''}`}>
                        {wordCount} / 150+ words
                    </span>
                </div>
                <div className="wp-panel-body">
                    <textarea
                        className="wp-answer-textarea"
                        placeholder={t.practiceSandbox.placeholderTask1}
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
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'var(--color-surface, #fff)', padding: '32px', borderRadius: '16px',
                maxWidth: '400px', width: '100%', textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ marginBottom: '12px' }}>{t.practiceSandbox.settlementTitle}</h2>
                <p style={{ color: 'var(--color-text-secondary)', marginBottom: '32px' }}>
                    {t.practiceSandbox.settlementDesc}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className="primary-button"
                        style={{ padding: '16px', fontSize: '18px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                        onClick={handleStartEvaluation}
                        disabled={isEvaluating}
                    >
                        <span>🎯</span> {t.practiceSandbox.callAiBtn}
                    </button>
                    <button
                        className="secondary-button"
                        style={{
                            padding: '12px', fontSize: '16px', background: 'transparent',
                            border: '1px solid var(--color-border)', color: 'var(--text-primary)',
                            borderRadius: '8px', cursor: 'pointer'
                        }}
                        onClick={() => navigate('/writing')}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--color-text-secondary)'}
                    >
                        {t.practiceSandbox.backBtn}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="wp-split wp-split--result">
            {/* Left: Replay */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>📄 回放: 题目与您的作答</h3>
                </div>
                <div className="wp-panel-body">
                    <div className="wp-prompt-block" style={{ fontSize: '0.9rem' }}>
                        {chartData?.prompt}
                    </div>
                    <div className="wp-essay-replay">{userAnswer}</div>
                </div>
                <div className="wp-panel-footer">
                    <button className="back-link" onClick={() => navigate('/writing/chart')}
                        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        {t.practiceSandbox.backToPracticeBtn}
                    </button>
                </div>
            </div>

            {/* Right: Scores */}
            {result && (
                <div className="wc-result-card">
                    <div className="wc-band-display">
                        <div className="wc-band-label">{t.practiceSandbox.overallBand}</div>
                        <div className="wc-band-value">{result.overall.toFixed(1)}</div>
                        <div className="wc-band-subtitle">IELTS Overall Band Score</div>
                    </div>

                    <div className="wc-scores-grid">
                        {[
                            { label: `🎯 ${t.practiceSandbox.taTask1}`, val: result.scores.ta },
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
            )}
        </div>
    );

    return (
        <Layout>
            <div className="practice-container" style={{ maxWidth: '100%', padding: '24px 40px', display: 'flex', flexDirection: 'column' }}>
                {(step === 'loading' || step === 'answering') && (
                    <div className="practice-header" style={{ marginBottom: '24px' }}>
                        <button className="back-link" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.practiceSandbox.abortBtn}
                        </button>
                        <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '28px' }}>📉</span> {t.practiceSandbox.titleTask1}
                        </h1>
                    </div>
                )}

                {step === 'loading' && renderLoading()}
                {step === 'answering' && renderAnswering()}
                {step === 'settlement' && (
                    <>
                        {renderAnswering()} {/* Keep the background visible */}
                        {renderSettlement()}
                    </>
                )}

                {step === 'evaluating' && renderEvaluating()}

                {step === 'result' && renderResult()}
            </div>

            {previewImageSrc && (
                <div
                    onClick={() => setPreviewImageSrc(null)}
                    role="button"
                    tabIndex={0}
                    aria-label="Close chart image preview"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewImageSrc(null);
                        }
                    }}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(10, 14, 26, 0.45)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1200,
                        padding: '24px',
                        cursor: 'zoom-out',
                    }}
                >
                    <img
                        src={previewImageSrc}
                        alt="Full preview chart"
                        onClick={() => setPreviewImageSrc(null)}
                        style={{
                            maxWidth: 'min(92vw, 1200px)',
                            maxHeight: '88vh',
                            width: 'auto',
                            height: 'auto',
                            objectFit: 'contain',
                            borderRadius: '12px',
                            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
                        }}
                    />
                </div>
            )}

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </Layout>
    );
}
