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

        return () => { isMounted = false; };
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
                    userAnswer: userAnswer
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
            <p style={{ color: 'var(--text-secondary)' }}>{t.practiceSandbox.loadingDescTask1}</p>
        </div>
    );

    const renderEvaluating = () => (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 24px', width: '50px', height: '50px', borderWidth: '4px' }}></div>
            <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>{t.practiceSandbox.evaluatingTitle}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', lineHeight: 1.6 }}>
                {t.practiceSandbox.evaluatingDesc}<br />
                {t.practiceSandbox.evaluatingDescLine2}
            </p>
        </div>
    );

    const renderAnswering = () => (
        <div className="wc-main-layout" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Left Box: Chart & Prompt */}
            <div className="chart-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📜</span> {t.practiceSandbox.promptTitle}
                    </h3>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-section)', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '16px', lineHeight: '1.6', fontWeight: '500' }}>
                        {chartData?.prompt}
                    </p>
                </div>
                {chartData?.mermaidCode ? (
                    <MermaidChart chart={chartData.mermaidCode} />
                ) : resolvedImageSrc ? (
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
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
                            style={{ maxWidth: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain', cursor: 'zoom-in' }}
                        />
                    </div>
                ) : null}
            </div>

            {/* Right: Answer Input */}
            <div className="wc-editor-card" style={{ flex: '1' }}>
                <div className="wc-editor-header">
                    <h3>您的作答区</h3>
                    <span className="wc-word-count">字数: <strong>{wordCount}</strong> / 150+</span>
                </div>
                <textarea
                    className="wc-textarea"
                    style={{
                        flexGrow: 1, minHeight: '300px',
                        resize: 'none',
                        fontFamily: 'monospace',
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                    }}
                    placeholder={t.practiceSandbox.placeholderTask1}
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                />
                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        className="primary-button"
                        onClick={handleSubmitAnser}
                        style={{ padding: '12px 32px', fontSize: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <span>✅</span> {t.practiceSandbox.finishBtn}
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
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
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
                            border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                            borderRadius: '8px', cursor: 'pointer'
                        }}
                        onClick={() => navigate('/writing')}
                        onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                    >
                        {t.practiceSandbox.backBtn}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="wc-main-layout" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Left/Top side: Keep user essay and prompt briefly */}
            <div className="wc-editor-card" style={{ flex: '1' }}>
                <div className="wc-editor-header">
                    <h3>回放: 题目与您的作答</h3>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-section)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontStyle: 'italic' }}>
                    {chartData?.prompt}
                </div>
                <div style={{ flexGrow: 1, whiteSpace: 'pre-wrap', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', overflowY: 'auto' }}>
                    {userAnswer}
                </div>
                <div className="wc-editor-footer" style={{ marginTop: '16px' }}>
                    <button
                        className="secondary-button"
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer',
                            fontWeight: 600
                        }}
                        onClick={() => navigate('/writing/chart')}
                    >
                        {t.practiceSandbox.backToPracticeBtn}
                    </button>
                </div>
            </div>

            {/* Right side: Evaluation Result utilizing wc-result-card layout */}
            {result && (
                <div className="wc-result-card" style={{ flex: '1.2', marginTop: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h2 className="wc-overall-band" style={{ margin: 0 }}>
                            {t.practiceSandbox.overallBand}
                            <span style={{ fontSize: '42px', marginLeft: '16px', color: 'var(--accent-color)', fontWeight: 800 }}>
                                {result.overall.toFixed(1)}
                            </span>
                        </h2>
                    </div>

                    <div className="wc-scores-grid">
                        <div className="wc-score-item">
                            <div className="wc-score-label">🎯 {t.practiceSandbox.taTask1}</div>
                            <div className="wc-score-val">{result.scores.ta.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">🔗 {t.practiceSandbox.cc}</div>
                            <div className="wc-score-val">{result.scores.cc.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">📚 {t.practiceSandbox.lr}</div>
                            <div className="wc-score-val">{result.scores.lr.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">📝 {t.practiceSandbox.gra}</div>
                            <div className="wc-score-val">{result.scores.gra.toFixed(1)}</div>
                        </div>
                    </div>

                    <div className="wc-feedback-box" style={{ marginTop: '32px' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                            <span>💡</span> {t.practiceSandbox.examinerReport}
                        </h3>
                        <div className="wc-feedback-content" style={{ fontSize: '16px', lineHeight: 1.8 }}>
                            {result.feedback.split('\n').map((line, idx) => (
                                <p key={idx} style={{ marginBottom: line.trim() === '' ? '0' : '16px' }}>{line}</p>
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
