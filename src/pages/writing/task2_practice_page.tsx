import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';

interface Task2Data {
    prompt: string;
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
    const { t } = useLang();

    const [searchParams] = useSearchParams();
    const { state } = useLocation();
    const type = searchParams.get('type') || 'opinion';
    const topicCategory = (searchParams.get('topic') || 'all').trim().toLowerCase() || 'all';
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    // Cold start with no question: give a real landing page and a clear way out, never a silent redirect
    const mockIdParam = searchParams.get('mockId');
    const mockId = mockIdParam ? Number(mockIdParam) : null;
    const customName: string = typeof (state as { customName?: string })?.customName === 'string' ? (state as { customName: string }).customName.trim() : '';
    const customDescription: string = typeof (state as { customDescription?: string })?.customDescription === 'string' ? (state as { customDescription: string }).customDescription.trim() : '';
    const customPrompt: string = typeof (state as { customPrompt?: string })?.customPrompt === 'string' ? (state as { customPrompt: string }).customPrompt.trim() : '';
    const cacheKey = bankId ? `writing_task2_bank_${bankId}` : `writing_task2_session_${type}_${topicCategory}`;

    const [step, setStep] = useState<WritingStep>('loading');
    const [taskData, setTaskData] = useState<Task2Data | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const hasFetchedRef = useRef<string | null>(null);
    const mockSubmittingRef = useRef(false);

    // Full mock: the writing section shares one 60-minute server-side timer for T1+T2; submit persists immediately (marking is deferred to the score report)
    const { confirmExit: mockConfirmExit } = useMockExamGuard({
        mockId: mockId ?? 0,
        part: 'writing',
        active: mockId !== null && step === 'answering',
        mode: 'soft',
    });

    // -- Full mock exam mode (soft guard: switching T1/T2 via the hub inside the writing section does not score 0) --
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
            // mock: submit the essay (shared by the normal and force-on-timeout paths). Persist, then return to the hub; marking is deferred to the score report.
            let nextRoute: string | null = null;
            if (!forced) {
                try {
                    const d = await getMockDetail(mockId);
                    const sibling = d.parts.writing.task1;
                    if (sibling && !sibling.isAnswered) nextRoute = mockWritingTaskRoute(mockId, 'task1', sibling);
                } catch { /* the other piece (Task 1) is unwritten -> go straight to it; only return to the hub once both are done */ }
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

    // Refresh recovery: restore in-progress session first.
    useEffect(() => {
        const cached = sessionStorage.getItem(cacheKey);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached) as {
                step: WritingStep;
                taskData: Task2Data | null;
                userAnswer: string;
            };

            if (parsed.taskData && parsed.step !== 'loading') {
                setTaskData(parsed.taskData);
                setUserAnswer(parsed.userAnswer || '');
                setStep(parsed.step);
            }
        } catch {
            sessionStorage.removeItem(cacheKey);
        }
    }, [cacheKey]);

    // Persist answering state for refresh recovery.
    useEffect(() => {
        if (!taskData || step === 'loading') return;
        sessionStorage.setItem(cacheKey, JSON.stringify({
            step,
            taskData,
            userAnswer,
        }));
    }, [cacheKey, step, taskData, userAnswer]);

    // Initial load - generate prompt or load from bank
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
                const content = (detail.content || {}) as { prompt?: string };
                if (!content.prompt) {
                    showToast(t('aiBank.toastMissingContent'), 'error');
                    navigate('/practice/ai/bank');
                    return;
                }
                setTaskData({ prompt: content.prompt });
                const savedAnswer = typeof detail.userAnswer === 'string' ? detail.userAnswer : '';
                if (savedAnswer) setUserAnswer(savedAnswer);
                setStep('answering');
            } catch (err: unknown) {
                console.error('Bank load error:', err);
                showToast(t('aiBank.loadFail'), 'error');
                navigate('/practice/ai/bank');
            }
        }

        async function fetchPrompt() {
            setStep('loading');
            try {
                const body: Record<string, unknown> = {
                    type,
                    topic_category: topicCategory,
                };
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                if (customPrompt) body.customPrompt = customPrompt;
                const res = await api<Task2Data & { aiQuestionId?: number | null }>('/writing/task2/generate', {
                    method: 'POST',
                    body,
                });
                // fall back to the hub if the detail fetch fails
                sessionStorage.removeItem(cacheKey);
                showToast(t('aiBank.toastGeneratedSaved'), 'success');
                const justId = res.aiQuestionId ?? null;
                navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            } catch (err: unknown) {
                console.error('Generate task2 error:', err);
                const error = err as { message?: string };
                showToast(error.message || t('practiceSandbox.toastFailGenTask2'), 'error');
                navigate(-1);
            }
        }

        if (bankId) {
            loadFromBank(bankId);
        } else {
            fetchPrompt();
        }
    }, [type, topicCategory, navigate, cacheKey, bankId, t]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const wordBadge = t('practiceSandbox.wordCountBadgeTask2').replace('{n}', String(wordCount));

    const handleSubmitAnser = () => {
        if (!userAnswer.trim()) {
            showToast(t('practiceSandbox.toastEmpty'), 'error');
            return;
        }
        if (wordCount < 100) {
            showToast(t('practiceSandbox.toastTooShortTask2'), 'error');
        }
        // go straight to the AI bank once generated
        if (mockId) {
            mockSubmitEssay();
            return;
        }
        setStep('settlement');
    };

    const handleStartEvaluation = () => {
        if (!taskData) return;
        sessionStorage.removeItem(cacheKey);
        navigate('/writing/correction', {
            state: {
                text: userAnswer,
                prompt: taskData.prompt,
                taskType: 'task2',
                autoEvaluate: true,
                bankId: bankId || undefined,
                subtype: bankId ? `task2:${type}` : undefined,
            },
            replace: true,
        });
    };

    const typeNameMap: Record<string, string> = {
        'opinion': t('task2Selection.types.opinion.title'),
        'opinion_agree': t('task2OpinionSelection.types.agree.title'),
        'opinion_discuss': t('task2OpinionSelection.types.discuss.title'),
        'opinion_advantages': t('task2OpinionSelection.types.advantages.title'),
        'report': t('task2Selection.types.report.title'),
        'mixed': t('task2Selection.types.mixed.title'),
        'random': t('task2Selection.types.random.title'),
        'innovation': t('task2Selection.types.innovation.title'),
    };
    const titleName = typeNameMap[type] || t('practiceSandbox.typeFallback');

    const renderLoading = () => (
        <div className="wp-state-wrap">
            <div className="spinner wp-loading-spinner"></div>
            <h2>{t('practiceSandbox.loadingTitleTask2')}</h2>
            <p>{t('practiceSandbox.loadingDescTask2').replace('{type}', titleName)}</p>
        </div>
    );

    const renderAnswering = () => (
        <div className="wp-split">
            {/* Left: Prompt */}
            <div className="wp-panel">
                <div className="wp-panel-header">
                    <h3>📜 {t('practiceSandbox.promptTitle')}</h3>
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
                    <h3>✍️ {t('practiceSandbox.yourAnswer')}</h3>
                    <span className={`wp-word-badge${wordCount >= 250 ? ' ok' : ''}`}>
                        {wordBadge}
                    </span>
                </div>
                <div className="wp-panel-body">
                    <textarea
                        className="wp-answer-textarea"
                        placeholder={t('practiceSandbox.placeholderTask2')}
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
                    onClick={() => navigate(bankId ? '/practice/ai/bank' : '/writing/task2')}
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
            pageTitle={`🖋️ ${t('practiceSandbox.titleTask2').replace('{type}', titleName)}`}
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
                    <MockWritingTaskBar mockId={mockId} current="task2" />
                </>
            )}
            <div className="practice-container writing-practice-page">

                {step === 'loading' && renderLoading()}
                {step === 'answering' && renderAnswering()}
                {step === 'settlement' && (
                    <>
                        {renderAnswering()}
                        {renderSettlement()}
                    </>
                )}
            </div>
        </Layout>
    );
}
