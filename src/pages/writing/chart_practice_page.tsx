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
    mapSvg?: string | null;
    mapViewport?: {
        width: number;
        height: number;
    } | null;
    mapIconPlacements?: MapIconPlacement[] | null;
    mapIconAssets?: Record<string, string> | null;
    mapIconDataUrls?: Record<string, string> | null;
    prompt: string;
    pythonCode: string;
}

interface MapIconPlacement {
    iconKey: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotation?: number;
    label?: string;
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

    const [step, setStep] = useState<Step>('loading');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);
    const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'image' | 'map'>('image');
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

    const wordBadge = lang === 'zh' ? `${wordCount} / 150+ 词` : `${wordCount} / 150+ words`;

    const resolvedImageSrc = useMemo(() => {
        if (!chartData?.imageUrl) return null;
        return chartData.imageUrl.startsWith('data:')
            ? chartData.imageUrl
            : `${import.meta.env.VITE_API_BASE}${chartData.imageUrl}`;
    }, [chartData?.imageUrl]);

    const mapSvgDataUrl = useMemo(() => {
        if (!chartData?.mapSvg) return null;
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chartData.mapSvg)}`;
    }, [chartData?.mapSvg]);

    const mapViewport = useMemo(() => {
        if (chartData?.mapViewport?.width && chartData?.mapViewport?.height) {
            return chartData.mapViewport;
        }
        if (!chartData?.mapSvg) return null;
        const matched = chartData.mapSvg.match(/viewBox\s*=\s*["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
        if (!matched) return { width: 1000, height: 620 };
        const width = Number(matched[1]) || 1000;
        const height = Number(matched[2]) || 620;
        return { width, height };
    }, [chartData?.mapViewport, chartData?.mapSvg]);

    const resolvedMapIconAssets = useMemo(() => {
        const rawAssets = chartData?.mapIconAssets || {};
        const inlineDataUrls = chartData?.mapIconDataUrls || {};
        const assetEntries = Object.entries(rawAssets);
        const inlineEntries = Object.entries(inlineDataUrls);
        if (!assetEntries.length && !inlineEntries.length) return {} as Record<string, string>;

        const resolved: Record<string, string> = {};
        for (const [key, value] of assetEntries) {
            if (!value) continue;
            resolved[key] = value.startsWith('data:') || value.startsWith('http')
                ? value
                : `${import.meta.env.VITE_API_BASE}${value}`;
        }

        for (const [key, value] of inlineEntries) {
            if (!value) continue;
            resolved[key] = value.startsWith('data:') || value.startsWith('http')
                ? value
                : `${import.meta.env.VITE_API_BASE}${value}`;
        }

        return resolved;
    }, [chartData?.mapIconAssets, chartData?.mapIconDataUrls]);

    const normalizedMapPlacements = useMemo(() => {
        if (!mapViewport) return [] as MapIconPlacement[];
        const viewW = mapViewport.width || 1000;
        const viewH = mapViewport.height || 620;
        const placements = chartData?.mapIconPlacements || [];
        if (!Array.isArray(placements)) return [] as MapIconPlacement[];

        return placements
            .filter((item): item is MapIconPlacement => !!item && typeof item.iconKey === 'string')
            .map((item) => {
                const w = Math.max(12, Math.min(Number(item.w) || 60, viewW));
                const h = Math.max(12, Math.min(Number(item.h) || 60, viewH));
                const x = Math.max(0, Math.min(Number(item.x) || 0, viewW - w));
                const y = Math.max(0, Math.min(Number(item.y) || 0, viewH - h));
                const rotation = Number(item.rotation) || 0;
                return {
                    ...item,
                    x,
                    y,
                    w,
                    h,
                    rotation,
                    label: (item.label || '').trim(),
                };
            });
    }, [chartData?.mapIconPlacements, mapViewport]);

    const openImagePreview = (src: string) => {
        setPreviewMode('image');
        setPreviewImageSrc(src);
    };

    const openMapPreview = () => {
        if (!mapSvgDataUrl) return;
        setPreviewMode('map');
        setPreviewImageSrc(mapSvgDataUrl);
    };

    const closePreview = () => {
        setPreviewImageSrc(null);
        setPreviewMode('image');
    };

    const renderMapOverlay = (viewW: number, viewH: number) => (
        <div className="wp-map-overlay-layer">
            {normalizedMapPlacements.map((item, idx) => {
                const iconSrc = resolvedMapIconAssets[item.iconKey];
                if (!iconSrc) return null;

                return (
                    <div
                        key={`${item.iconKey}-${idx}`}
                        className="wp-map-icon-node"
                        style={{
                            left: `${(item.x / viewW) * 100}%`,
                            top: `${(item.y / viewH) * 100}%`,
                            width: `${(item.w / viewW) * 100}%`,
                            height: `${(item.h / viewH) * 100}%`,
                            transform: `rotate(${item.rotation || 0}deg)`,
                        }}
                    >
                        <img src={iconSrc} alt={item.label || item.iconKey} loading="lazy" />
                        {item.label ? <span className="wp-map-icon-label">{item.label}</span> : null}
                    </div>
                );
            })}
        </div>
    );

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
        if (!isMapType || !mapSvgDataUrl || !mapViewport) return null;
        const viewW = mapViewport.width || 1000;
        const viewH = mapViewport.height || 620;

        return (
            <div className="wp-map-scene" style={{ aspectRatio: `${viewW} / ${viewH}` }}>
                <img
                    src={mapSvgDataUrl}
                    alt="Generated map"
                    className="wp-map-base-svg"
                    onClick={openMapPreview}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openMapPreview();
                        }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label="Open map preview"
                />
                {renderMapOverlay(viewW, viewH)}
            </div>
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
                    {isMapType && mapSvgDataUrl ? (
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
                    {isMapType && mapSvgDataUrl ? (
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
        <Layout>
            <div className="practice-container writing-practice-page">
                {(step === 'loading' || step === 'answering') && (
                    <div className="practice-header writing-practice-header">
                        <button className="back-link writing-back-btn" onClick={() => navigate(-1)}>
                            {t.practiceSandbox.abortBtn}
                        </button>
                        <h1 className="writing-practice-title">
                            <span>📉</span> {t.practiceSandbox.titleTask1}
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
                    {previewMode === 'map' && isMapType && mapSvgDataUrl && mapViewport ? (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: 'min(94vw, 1400px)',
                                maxHeight: '88vh',
                                cursor: 'default',
                            }}
                        >
                            <div className="wp-map-scene wp-map-scene--modal" style={{ aspectRatio: `${mapViewport.width || 1000} / ${mapViewport.height || 620}` }}>
                                <img
                                    src={mapSvgDataUrl}
                                    alt="Full preview map"
                                    className="wp-map-base-svg"
                                />
                                {renderMapOverlay(mapViewport.width || 1000, mapViewport.height || 620)}
                            </div>
                        </div>
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
