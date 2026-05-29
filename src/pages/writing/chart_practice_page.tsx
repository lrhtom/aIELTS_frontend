import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { type WritingStep } from '../../types/writing_page';
import MermaidChart from '../../components/MermaidChart';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';

interface ChartData {
    imageUrl: string | null;
    mermaidCode?: string | null;
    htmlContent?: string | null;
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
    const isMapType = type === 'map';
    const cacheKey = `writing_task1_chart_session_${type}`;

    const [step, setStep] = useState<WritingStep>('loading');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'image' | 'html'>('image');
    const [isEvaluating, setIsEvaluating] = useState(false);
    // Guard against React StrictMode double-invocation and rapid re-mount
    const hasFetchedRef = useRef<string | null>(null);

    // Refresh recovery: if local session exists, restore and skip loading state.
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached) as {
                step: WritingStep;
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
                const parsed = JSON.parse(cached) as { step: WritingStep; chartData: ChartData | null };
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
    }, [type, navigate, cacheKey, t.practiceSandbox.toastFailGenChart]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const wordBadge = lang === 'zh' ? `${wordCount} / 150+ 词` : `${wordCount} / 150+ words`;

    const resolvedImageSrc = useMemo(() => {
        if (!chartData?.imageUrl) return null;
        return chartData.imageUrl.startsWith('data:')
            ? chartData.imageUrl
            : `${import.meta.env.VITE_API_BASE}${chartData.imageUrl}`;
    }, [chartData?.imageUrl]);

    const sanitizedHtmlContent = useMemo(() => {
        if (!chartData?.htmlContent) return null;
        return DOMPurify.sanitize(chartData.htmlContent, {
            USE_PROFILES: { html: true, svg: true },
        });
    }, [chartData?.htmlContent]);

    const openImagePreview = (src: string) => {
        setPreviewMode('image');
        setPreviewImageSrc(src);
    };

    const openMapPreview = () => {
        if (!sanitizedHtmlContent) return;
        setPreviewMode('html');
        setPreviewHtml(sanitizedHtmlContent);
    };

    const closePreview = () => {
        setPreviewImageSrc(null);
        setPreviewHtml(null);
        setPreviewMode('image');
    };

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
        <div className="wp-state-wrap">
            <div className="spinner wp-loading-spinner"></div>
            <h2>{t.practiceSandbox.loadingTitleTask1}</h2>
            <p>{t.practiceSandbox.loadingDescTask1}</p>
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

    const renderMapScene = () => {
        if (!isMapType || !sanitizedHtmlContent) return null;

        return (
            <div 
                className="wp-map-scene" 
                style={{ 
                    width: '100%', 
                    overflowX: 'auto', 
                    background: 'white', 
                    padding: '16px', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    cursor: 'zoom-in'
                }}
                dangerouslySetInnerHTML={{ __html: sanitizedHtmlContent }}
                onClick={openMapPreview}
            />
        );
    };

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
                    {isMapType && sanitizedHtmlContent ? (
                        renderMapScene()
                    ) : chartData?.mermaidCode ? (
                        <MermaidChart chart={chartData.mermaidCode} />
                    ) : resolvedImageSrc ? (
                        <div style={{ display: 'flex', justifyContent: 'center', background: 'white', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                            <img
                                src={resolvedImageSrc}
                                alt="Generated Chart"
                                onClick={() => openImagePreview(resolvedImageSrc)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openImagePreview(resolvedImageSrc);
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
                    <h3>✍️ {t.practiceSandbox.yourAnswer}</h3>
                    <span className={`wp-word-badge${wordCount >= 150 ? ' ok' : ''}`}>
                        {wordBadge}
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
                        onClick={() => navigate('/writing')}
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
                    <h3>📄 {t.practiceSandbox.reviewAndAnswer}</h3>
                </div>
                <div className="wp-panel-body">
                    <div className="wp-prompt-block wp-prompt-block--compact">
                        {chartData?.prompt}
                    </div>
                    {isMapType && sanitizedHtmlContent ? (
                        <div style={{ marginBottom: '12px' }}>{renderMapScene()}</div>
                    ) : chartData?.mermaidCode ? (
                        <MermaidChart chart={chartData.mermaidCode} />
                    ) : resolvedImageSrc ? (
                        <div style={{ display: 'flex', justifyContent: 'center', background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid var(--color-border)', marginBottom: '12px' }}>
                            <img
                                src={resolvedImageSrc}
                                alt="Generated Chart"
                                onClick={() => openImagePreview(resolvedImageSrc)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        openImagePreview(resolvedImageSrc);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Open chart image preview"
                                style={{ maxWidth: '100%', height: 'auto', maxHeight: '260px', objectFit: 'contain', cursor: 'zoom-in' }}
                            />
                        </div>
                    ) : null}
                    <div className="wp-essay-replay">{userAnswer}</div>
                </div>
                <div className="wp-panel-footer">
                    <button className="back-link wp-result-back-btn" onClick={() => navigate('/writing/chart')}>
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
                        <div className="wc-band-subtitle">{t.practiceSandbox.overallBandSubtitle}</div>
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
        <Layout
            onBack={(step === 'loading' || step === 'answering') ? () => navigate(-1) : undefined}
            backText={(step === 'loading' || step === 'answering') ? t.practiceSandbox.abortBtn : undefined}
            pageTitle={(step === 'loading' || step === 'answering') ? `📉 ${t.practiceSandbox.titleTask1}` : undefined}
        >
            <div className="practice-container writing-practice-page">

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
                    onClick={closePreview}
                    role="button"
                    tabIndex={0}
                    aria-label="Close chart image preview"
                    onKeyDown={(e) => {
                        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            closePreview();
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
                    {previewMode === 'html' && isMapType && previewHtml ? (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: 'min(94vw, 1400px)',
                                maxHeight: '88vh',
                                overflow: 'auto',
                                background: 'white',
                                padding: '24px',
                                borderRadius: '12px',
                                cursor: 'default',
                            }}
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    ) : (
                        <img
                            src={previewImageSrc}
                            alt="Full preview chart"
                            onClick={closePreview}
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
                    )}
                </div>
            )}

        </Layout>
    );
}
