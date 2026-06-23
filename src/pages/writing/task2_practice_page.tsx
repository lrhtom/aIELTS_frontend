import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { getAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
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
    const { lang } = useLang();
    const t = translations[lang];

    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') || 'opinion';
    const topicCategory = (searchParams.get('topic') || 'all').trim().toLowerCase() || 'all';
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    const cacheKey = bankId ? `writing_task2_bank_${bankId}` : `writing_task2_session_${type}_${topicCategory}`;

    const [step, setStep] = useState<WritingStep>('loading');
    const [taskData, setTaskData] = useState<Task2Data | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
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
                    showToast(translations[lang].aiBank.toastMissingContent, 'error');
                    navigate('/practice/ai/bank');
                    return;
                }
                setTaskData({ prompt: content.prompt });
                const savedAnswer = typeof detail.userAnswer === 'string' ? detail.userAnswer : '';
                if (savedAnswer) setUserAnswer(savedAnswer);
                setStep('answering');
            } catch (err: unknown) {
                console.error('Bank load error:', err);
                showToast(translations[lang].aiBank.loadFail, 'error');
                navigate('/practice/ai/bank');
            }
        }

        async function fetchPrompt() {
            setStep('loading');
            try {
                const res = await api<Task2Data & { aiQuestionId?: number | null }>('/writing/task2/generate', {
                    method: 'POST',
                    body: {
                        type,
                        topic_category: topicCategory,
                    },
                });
                // 生成后直接进入 AI 题库
                sessionStorage.removeItem(cacheKey);
                showToast(translations[lang].aiBank.toastGeneratedSaved, 'success');
                const justId = res.aiQuestionId ?? null;
                navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            } catch (err: unknown) {
                console.error('Generate task2 error:', err);
                const error = err as { message?: string };
                showToast(error.message || t.practiceSandbox.toastFailGenTask2, 'error');
                navigate(-1);
            }
        }

        if (bankId) {
            loadFromBank(bankId);
        } else {
            fetchPrompt();
        }
    }, [type, topicCategory, navigate, cacheKey, bankId, t.practiceSandbox.toastFailGenTask2]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const wordBadge = t.practiceSandbox.wordCountBadgeTask2.replace('{n}', String(wordCount));

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
        'opinion': t.task2Selection.types.opinion.title,
        'opinion_agree': t.task2OpinionSelection.types.agree.title,
        'opinion_discuss': t.task2OpinionSelection.types.discuss.title,
        'opinion_advantages': t.task2OpinionSelection.types.advantages.title,
        'report': t.task2Selection.types.report.title,
        'mixed': t.task2Selection.types.mixed.title,
        'random': t.task2Selection.types.random.title,
        'innovation': t.task2Selection.types.innovation.title,
    };
    const titleName = typeNameMap[type] || t.practiceSandbox.typeFallback;

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

    return (
        <Layout
            onBack={(step === 'loading' || step === 'answering') ? () => navigate(-1) : undefined}
            backText={(step === 'loading' || step === 'answering') ? t.practiceSandbox.abortBtn : undefined}
            pageTitle={`🖋️ ${t.practiceSandbox.titleTask2.replace('{type}', titleName)}`}
        >
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
