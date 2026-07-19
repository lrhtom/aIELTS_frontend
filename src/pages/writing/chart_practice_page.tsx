import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { showConfirm } from '../../components/common/ConfirmService';
import { api } from '../../api/client';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { MockTimerBar } from '../../components/mock/MockExamShell';
import { MockWritingTaskBar } from '../../components/mock/MockWritingTaskBar';
import { mockWritingTaskRoute } from '../../components/mock/mock_writing_routes';
import { getMockDetail } from '../../api/mock';
import { useMockExamGuard } from '../../components/mock/useMockExamGuard';
import { useLang } from '../../i18n/LanguageContext';
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

export default function ChartPracticePage() {
    const navigate = useNavigate();
    const { t } = useLang();

    const [searchParams] = useSearchParams();
    const { state } = useLocation();
    const type = searchParams.get('type') || 'line';
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    // 全套模拟：写作部分 T1+T2 共用 60 分钟服务端计时；提交=直接落库（批改延迟到成绩单）
    const mockIdParam = searchParams.get('mockId');
    const mockId = mockIdParam ? Number(mockIdParam) : null;
    const customName: string = typeof (state as { customName?: string })?.customName === 'string' ? (state as { customName: string }).customName.trim() : '';
    const customDescription: string = typeof (state as { customDescription?: string })?.customDescription === 'string' ? (state as { customDescription: string }).customDescription.trim() : '';
    const customPrompt: string = typeof (state as { customPrompt?: string })?.customPrompt === 'string' ? (state as { customPrompt: string }).customPrompt.trim() : '';
    const cacheKey = bankId
        ? `writing_task1_chart_bank_${bankId}`
        : `writing_task1_chart_session_${type}`;

    const [step, setStep] = useState<WritingStep>('loading');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    // Derive map-mode from URL type *or* from loaded htmlContent (only maps set it).
    // This keeps bank-restored sessions working even if URL lacks `?type=map`.
    const isMapType = type === 'map' || !!chartData?.htmlContent;
    const [userAnswer, setUserAnswer] = useState('');
    const [previewImageSrc, setPreviewImageSrc] = useState<string | null>(null);
    const [previewHtml, setPreviewHtml] = useState<string | null>(null);
    const [previewMode, setPreviewMode] = useState<'image' | 'html'>('image');
    // Guard against React StrictMode double-invocation and rapid re-mount
    const hasFetchedRef = useRef<string | null>(null);
    // Map renders as fixed-pixel HTML; we scale it to fit the panel like an image.
    const mapWrapRef = useRef<HTMLDivElement | null>(null);
    const mapInnerRef = useRef<HTMLDivElement | null>(null);
    const [mapBoxHeight, setMapBoxHeight] = useState<number | null>(null);
    const [mapScale, setMapScale] = useState(1);

    // Refresh recovery: if local session exists, restore and skip loading state.
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached) as {
                step: WritingStep;
                chartData: ChartData | null;
                userAnswer: string;
            };

            if (parsed.chartData && parsed.step !== 'loading') {
                setChartData(parsed.chartData);
                setUserAnswer(parsed.userAnswer || '');
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
        }));
    }, [cacheKey, step, chartData, userAnswer]);

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

        // Prevent double-fire from React StrictMode or rapid re-mount.
        // NOTE: never reset hasFetchedRef in a cleanup — StrictMode's synthetic
        // cleanup would otherwise let the second mount re-fire and trigger a
        // duplicate AI generate + duplicate AIQuestion row in the bank.
        if (hasFetchedRef.current === cacheKey) return;
        hasFetchedRef.current = cacheKey;

        async function loadFromBank(id: number) {
            setStep('loading');
            try {
                const detail = await getAIQuestion(id);
                const content = (detail.content || {}) as Partial<ChartData>;
                if (!content.prompt) {
                    showToast(t('aiBank.toastMissingContent'), 'error');
                    navigate('/practice/ai/bank');
                    return;
                }
                setChartData({
                    imageUrl: content.imageUrl ?? null,
                    mermaidCode: content.mermaidCode ?? null,
                    htmlContent: content.htmlContent ?? null,
                    prompt: content.prompt,
                    pythonCode: content.pythonCode ?? '',
                });
                const savedAnswer = typeof detail.userAnswer === 'string' ? detail.userAnswer : '';
                if (savedAnswer) setUserAnswer(savedAnswer);
                setStep('answering');
            } catch (err: unknown) {
                console.error('Bank load error:', err);
                showToast(t('aiBank.loadFail'), 'error');
                navigate('/practice/ai/bank');
            }
        }

        async function fetchChart() {
            setStep('loading');
            try {
                const body: Record<string, unknown> = { type };
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                if (customPrompt) body.customPrompt = customPrompt;
                const res = await api<ChartData & { aiQuestionId?: number | null }>('/writing/chart/generate', {
                    method: 'POST',
                    body,
                });
                sessionStorage.removeItem(cacheKey);
                showToast(t('aiBank.toastGeneratedSaved'), 'success');
                const justId = res.aiQuestionId ?? null;
                navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            } catch (err: unknown) {
                console.error('Generate chart error:', err);
                const error = err as { message?: string };
                showToast(error.message || t('practiceSandbox.toastFailGenChart'), 'error');
                navigate('/writing/task1');
            }
        }

        if (bankId) {
            loadFromBank(bankId);
        } else {
            fetchChart();
        }
    }, [type, navigate, cacheKey, bankId, t]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const wordBadge = t('practiceSandbox.wordCountBadgeTask1').replace('{n}', String(wordCount));

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

    const mockSubmittingRef = useRef(false);

    // ── 全套模拟考试模式（soft 守卫：写作部分内可经大厅切换 T1/T2，不判 0）──
    const { confirmExit: mockConfirmExit } = useMockExamGuard({
        mockId: mockId ?? 0,
        part: 'writing',
        active: mockId !== null && step === 'answering',
        mode: 'soft',
    });

    // mock：提交作文（正常/超时强制共用）。落库后回大厅，批改延迟到成绩单生成。
    const mockSubmitEssay = async (forced = false) => {
        if (!mockId || !bankId || mockSubmittingRef.current) return;
        const text = userAnswer.trim();
        if (!text) {
            if (forced) navigate(`/mock/${mockId}`, { replace: true });
            else showToast(t('practiceSandbox.toastEmpty'), 'error');
            return;
        }
        if (!forced && !(await showConfirm({
            title: t('mock.examMode.essaySubmitConfirmTitle'),
            message: t('mock.examMode.essaySubmitConfirmBody'),
            confirmText: t('mock.examMode.essaySubmitOk'),
            cancelText: t('mock.examMode.exitConfirmCancel'),
        }))) return;
        mockSubmittingRef.current = true;
        try {
            await submitAIQuestion(bankId, userAnswer);
            sessionStorage.removeItem(cacheKey);
            // 另一篇（Task 2）还没写 → 直接进另一篇；两篇都完成才回大厅
            let nextRoute: string | null = null;
            if (!forced) {
                try {
                    const d = await getMockDetail(mockId);
                    const sibling = d.parts.writing.task2;
                    if (sibling && !sibling.isAnswered) nextRoute = mockWritingTaskRoute(mockId, 'task2', sibling);
                } catch { /* 拿不到详情就回大厅 */ }
            }
            if (nextRoute) {
                showToast(t('mock.examMode.essaySubmittedNext'), 'success');
                navigate(nextRoute, { replace: true });
            } else {
                showToast(t('mock.examMode.submittedToHub'), 'success');
                navigate(`/mock/${mockId}`, { replace: true });
            }
        } catch (err) {
            showToast((err as Error).message ?? t('common.error'), 'error');
            mockSubmittingRef.current = false;
            if (forced) navigate(`/mock/${mockId}`, { replace: true });
        }
    };

    const handleSubmitAnser = () => {
        if (!userAnswer.trim()) {
            showToast(t('practiceSandbox.toastEmpty'), 'error');
            return;
        }
        if (wordCount < 50) {
            showToast(t('practiceSandbox.toastTooShortTask1'), 'error');
        }
        // mock：跳过结算浮层，直接落库回大厅（批改延迟到成绩单生成）
        if (mockId) {
            mockSubmitEssay();
            return;
        }
        setStep('settlement');
    };

    const fetchImageAsDataUrl = async (src: string): Promise<string | null> => {
        if (src.startsWith('data:')) return src;
        try {
            const resp = await fetch(src, { credentials: 'omit' });
            if (!resp.ok) return null;
            const blob = await resp.blob();
            if (!/^image\/(png|jpe?g|webp)$/i.test(blob.type)) return null;
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('reader-failed'));
                reader.onerror = () => reject(new Error('reader-failed'));
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn('fetchImageAsDataUrl failed:', err);
            return null;
        }
    };

    const handleStartEvaluation = async () => {
        if (!chartData) return;
        let task1ImageDataUrl: string | null = null;
        if (resolvedImageSrc) {
            task1ImageDataUrl = await fetchImageAsDataUrl(resolvedImageSrc);
        }
        sessionStorage.removeItem(cacheKey);
        navigate('/writing/correction', {
            state: {
                text: userAnswer,
                prompt: chartData.prompt,
                taskType: 'task1',
                autoEvaluate: true,
                bankId: bankId || undefined,
                subtype: bankId ? `chart:${type}` : undefined,
                task1ImageDataUrl: task1ImageDataUrl || undefined,
            },
            replace: true,
        });
    };

    // ─── Render functions ──────────────────────────────────────────────────

    const renderLoading = () => (
        <div className="wp-state-wrap">
            <div className="spinner wp-loading-spinner"></div>
            <h2>{t('practiceSandbox.loadingTitleTask1')}</h2>
            <p>{t('practiceSandbox.loadingDescTask1')}</p>
        </div>
    );

    // Treat the map block as an image: scale-to-fit the panel width,
    // cap visual height, click to open the fullscreen preview.
    // Tall enough to show stacked before/after at a legible scale.
    const MAP_MAX_HEIGHT = 620;

    useEffect(() => {
        if (!isMapType || !sanitizedHtmlContent) return;
        const wrap = mapWrapRef.current;
        const inner = mapInnerRef.current;
        if (!wrap || !inner) return;

        const recompute = () => {
            const wrapW = wrap.clientWidth;
            const naturalW = inner.scrollWidth;
            const naturalH = inner.scrollHeight;
            if (!wrapW || !naturalW || !naturalH) return;
            const fitW = wrapW / naturalW;
            const fitH = MAP_MAX_HEIGHT / naturalH;
            const scale = Math.min(1, fitW, fitH);
            setMapScale(scale);
            setMapBoxHeight(Math.ceil(naturalH * scale));
        };

        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(wrap);
        ro.observe(inner);
        return () => ro.disconnect();
    }, [isMapType, sanitizedHtmlContent]);

    const renderMapScene = () => {
        if (!isMapType || !sanitizedHtmlContent) return null;

        return (
            <div
                ref={mapWrapRef}
                className="wp-map-scene"
                style={{
                    position: 'relative',
                    width: '100%',
                    height: mapBoxHeight != null ? `${mapBoxHeight}px` : 'auto',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    cursor: 'zoom-in',
                    overflow: 'hidden',
                }}
                onClick={openMapPreview}
                role="button"
                tabIndex={0}
                aria-label="Map preview — click to enlarge"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openMapPreview();
                    }
                }}
            >
                <div
                    ref={mapInnerRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transform: `scale(${mapScale})`,
                        transformOrigin: 'top left',
                        width: 'max-content',
                        pointerEvents: 'none',
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizedHtmlContent }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 10,
                        fontSize: 11,
                        color: '#1e293b',
                        background: 'rgba(255,255,255,0.9)',
                        border: '1px solid #cbd5e1',
                        padding: '2px 8px',
                        borderRadius: 999,
                        pointerEvents: 'none',
                        fontFamily: 'system-ui',
                    }}
                >
                    🔍 {t('practiceSandbox.clickToZoom')}
                </div>
            </div>
        );
    };

    const renderAnswering = () => (
        <div className="wp-split">
            {/* Left: Chart & Prompt */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>📊 {t('practiceSandbox.promptTitle')}</h3>
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
                    <h3>✍️ {t('practiceSandbox.yourAnswer')}</h3>
                    <span className={`wp-word-badge${wordCount >= 150 ? ' ok' : ''}`}>
                        {wordBadge}
                    </span>
                </div>
                <div className="wp-panel-body">
                    <textarea
                        className="wp-answer-textarea"
                        placeholder={t('practiceSandbox.placeholderTask1')}
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                    />
                </div>
                <div className="wp-panel-footer">
                    <button className="wp-submit-btn" onClick={handleSubmitAnser}>
                        {t('practiceSandbox.finishBtn')}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSettlement = () => (
        <div className="wp-settlement-overlay">
            <div className="wp-settlement-content">
                <div className="wp-settlement-icon">🎉</div>
                <h2>{t('practiceSandbox.settlementTitle')}</h2>
                <p className="wp-settlement-desc">
                    {t('practiceSandbox.settlementDesc')}
                </p>

                <div className="wp-settlement-actions">
                    <button
                        className="primary-button"
                        onClick={handleStartEvaluation}
                    >
                        <span>🎯</span> {t('practiceSandbox.callAiBtn')}
                    </button>
                    <button
                        className="wp-ghost-btn"
                        onClick={() => navigate(bankId ? '/practice/ai/bank' : '/writing')}
                    >
                        {t('practiceSandbox.backBtn')}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <Layout
            onBack={(step === 'loading' || step === 'answering')
                ? (mockId ? () => { mockConfirmExit(); } : () => navigate(-1))
                : undefined}
            backText={(step === 'loading' || step === 'answering')
                ? (mockId ? t('mock.examMode.backToHub') : t('practiceSandbox.abortBtn'))
                : undefined}
            pageTitle={(step === 'loading' || step === 'answering') ? `📉 ${t('practiceSandbox.titleTask1')}` : undefined}
        >
            {mockId !== null && (
                <>
                    <MockTimerBar
                        mockId={mockId}
                        part="writing"
                        onExpire={() => mockSubmitEssay(true)}
                        onRejected={(msg) => {
                            showToast(t('mock.examMode.startRejected').replace('{msg}', msg), 'error');
                            navigate(`/mock/${mockId}`, { replace: true });
                        }}
                    />
                    <MockWritingTaskBar mockId={mockId} current="task1" />
                </>
            )}
            <div className="practice-container writing-practice-page">

                {step === 'loading' && renderLoading()}
                {step === 'answering' && renderAnswering()}
                {step === 'settlement' && (
                    <>
                        {renderAnswering()} {/* Keep the background visible */}
                        {renderSettlement()}
                    </>
                )}
            </div>

            {(previewImageSrc || previewHtml) && (
                <div
                    onClick={closePreview}
                    role="button"
                    tabIndex={0}
                    aria-label="Close chart preview"
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
                    {previewMode === 'html' && previewHtml ? (
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                width: 'min(94vw, 1600px)',
                                maxHeight: '92vh',
                                overflow: 'auto',
                                background: 'white',
                                padding: '24px',
                                borderRadius: '12px',
                                cursor: 'default',
                                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
                            }}
                            dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                    ) : previewImageSrc ? (
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
                    ) : null}
                </div>
            )}

        </Layout>
    );
}
