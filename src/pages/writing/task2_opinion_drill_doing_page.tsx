import Layout from '../../components/layout/Layout';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AiModelSelector from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import {
    evaluateOpinionDrillAnswer,
    type OpinionDrillEvaluation,
    type OpinionDrillQuestion,
} from '../../api/task2_opinion_drill';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import '../../styles/task2_opinion_drill.css';

type Step = 'answering' | 'evaluating' | 'reviewing' | 'summary';

interface DrillResult extends OpinionDrillEvaluation {
    question: OpinionDrillQuestion;
    answer: string;
}

interface PendingEvaluation {
    question: OpinionDrillQuestion;
    answer: string;
}

interface DrillSessionState {
    questions: OpinionDrillQuestion[];
    currentIndex: number;
    currentAnswer: string;
    results: DrillResult[];
    reviewResult: DrillResult | null;
    step: Step;
    pendingEvaluation: PendingEvaluation | null;
}

interface DrillDoingRouteState {
    questions: OpinionDrillQuestion[];
}

const SESSION_STORAGE_KEY = 'task2OpinionDrillSessionV1';

function isStep(value: unknown): value is Step {
    return value === 'answering' || value === 'evaluating' || value === 'reviewing' || value === 'summary';
}

function clampIndex(index: number, total: number): number {
    if (total <= 0) return 0;
    if (index < 0) return 0;
    if (index >= total) return total - 1;
    return index;
}

function readSessionState(): DrillSessionState | null {
    try {
        const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as DrillSessionState;
        if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;
        if (!isStep(parsed.step)) return null;

        return parsed;
    } catch {
        return null;
    }
}

function writeSessionState(state: DrillSessionState) {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state));
}

function clearSessionState() {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export default function Task2OpinionDrillDoingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { lang } = useLang();
    const t = translations[lang];

    const bootstrappedRef = useRef(false);

    const [bootReady, setBootReady] = useState(false);
    const [step, setStep] = useState<Step>('answering');
    const [questions, setQuestions] = useState<OpinionDrillQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentAnswer, setCurrentAnswer] = useState('');
    const [results, setResults] = useState<DrillResult[]>([]);
    const [reviewResult, setReviewResult] = useState<DrillResult | null>(null);
    const [pendingEvaluation, setPendingEvaluation] = useState<PendingEvaluation | null>(null);

    const currentQuestion = questions[currentIndex] || null;

    const wordCount = useMemo(() => {
        const text = currentAnswer.trim();
        if (!text) return 0;
        return text.split(/\s+/).length;
    }, [currentAnswer]);

    const progressText = t.task2OpinionDrill.progress
        .replace('{current}', String(Math.min(currentIndex + 1, Math.max(questions.length, 1))))
        .replace('{total}', String(Math.max(questions.length, 1)));

    const progressPercent = questions.length > 0
        ? Math.round(((currentIndex + 1) / questions.length) * 100)
        : 0;

    const summary = useMemo(() => {
        if (results.length === 0) {
            return { grammar: 0, relevance: 0, vocabulary: 0, overall: 0 };
        }
        const totals = results.reduce(
            (acc, item) => ({
                grammar: acc.grammar + item.scores.grammar,
                relevance: acc.relevance + item.scores.relevance,
                vocabulary: acc.vocabulary + item.scores.vocabulary,
                overall: acc.overall + item.overall,
            }),
            { grammar: 0, relevance: 0, vocabulary: 0, overall: 0 },
        );
        return {
            grammar: Number((totals.grammar / results.length).toFixed(1)),
            relevance: Number((totals.relevance / results.length).toFixed(1)),
            vocabulary: Number((totals.vocabulary / results.length).toFixed(1)),
            overall: Number((totals.overall / results.length).toFixed(1)),
        };
    }, [results]);

    const parseErrorMessage = (err: unknown, fallback: string) => {
        const e = err as { message?: string };
        return e?.message || fallback;
    };

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        const routeState = location.state as DrillDoingRouteState | null;
        const routeQuestions = Array.isArray(routeState?.questions)
            ? routeState.questions.filter((item): item is OpinionDrillQuestion =>
                Boolean(item)
                && typeof item.id === 'number'
                && typeof item.prompt === 'string'
                && typeof item.styleId === 'number'
                && typeof item.category === 'string'
            )
            : [];

        if (routeQuestions.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setQuestions(routeQuestions);
            setCurrentIndex(0);
            setCurrentAnswer('');
            setResults([]);
            setReviewResult(null);
            setPendingEvaluation(null);
            setStep('answering');
            setBootReady(true);
            return;
        }

        const saved = readSessionState();
        if (saved && saved.questions.length > 0) {
            const safeIndex = clampIndex(saved.currentIndex, saved.questions.length);
            const safeStep = saved.step === 'evaluating' && !saved.pendingEvaluation
                ? 'answering'
                : saved.step;


            setQuestions(saved.questions);
            setCurrentIndex(safeIndex);
            setCurrentAnswer(saved.currentAnswer || '');
            setResults(Array.isArray(saved.results) ? saved.results : []);
            setReviewResult(saved.reviewResult ?? null);
            setPendingEvaluation(saved.pendingEvaluation ?? null);
            setStep(safeStep);
            setBootReady(true);
            return;
        }

        clearSessionState();
        showToast(t.task2OpinionDrill.missingConfig, 'error');
        navigate('/writing/task2/opinion-drill', { replace: true });
    }, [location.state, navigate, t.task2OpinionDrill.missingConfig]);

    useEffect(() => {
        if (!bootReady || questions.length === 0) {
            return;
        }

        writeSessionState({
            questions,
            currentIndex,
            currentAnswer,
            results,
            reviewResult,
            step,
            pendingEvaluation,
        });
    }, [
        bootReady,
        questions,
        currentIndex,
        currentAnswer,
        results,
        reviewResult,
        step,
        pendingEvaluation,
    ]);

    useEffect(() => {
        if (!bootReady || step !== 'evaluating' || !pendingEvaluation) {
            return;
        }

        let cancelled = false;

        const runEvaluation = async () => {
            try {
                const evaluation = await evaluateOpinionDrillAnswer({
                    prompt: pendingEvaluation.question.prompt,
                    userAnswer: pendingEvaluation.answer,
                    lang,
                });

                if (cancelled) return;

                const nextResult: DrillResult = {
                    ...evaluation,
                    question: pendingEvaluation.question,
                    answer: pendingEvaluation.answer,
                };

                setResults(prev => {
                    const existed = prev.findIndex(item => item.question.id === nextResult.question.id);
                    if (existed >= 0) {
                        const cloned = [...prev];
                        cloned[existed] = nextResult;
                        return cloned;
                    }
                    return [...prev, nextResult];
                });

                setReviewResult(nextResult);
                setCurrentAnswer(nextResult.answer);
                setPendingEvaluation(null);
                setStep('reviewing');
            } catch (err: unknown) {
                if (cancelled) return;
                showToast(parseErrorMessage(err, t.task2OpinionDrill.evalFail), 'error');
                setPendingEvaluation(null);
                setStep('answering');
            }
        };

        runEvaluation();

        return () => {
            cancelled = true;
        };
    }, [bootReady, step, pendingEvaluation, lang, t.task2OpinionDrill.evalFail]);

    const handleSubmitAnswer = () => {
        if (!currentQuestion) return;

        const answer = currentAnswer.trim();
        if (!answer) {
            showToast(t.task2OpinionDrill.emptyAnswer, 'error');
            return;
        }

        setPendingEvaluation({
            question: currentQuestion,
            answer,
        });
        setStep('evaluating');
    };

    const handleNextQuestion = () => {
        const isLast = currentIndex >= questions.length - 1;
        if (isLast) {
            setStep('summary');
            return;
        }

        setCurrentIndex(prev => prev + 1);
        setCurrentAnswer('');
        setReviewResult(null);
        setPendingEvaluation(null);
        setStep('answering');
    };

    const handleExit = (path: string) => {
        clearSessionState();
        navigate(path);
    };

    return (
        <Layout
            backUrl="/writing/task2/opinion-drill"
            backText={t.task2OpinionDrill.backToSetup}
            pageTitle={t.task2OpinionDrill.heading}
            pageSubtitle={t.task2OpinionDrill.subheading}
            headerRight={<AiModelSelector />}
        >
            <div className="practice-container writing-selection-page">

                {!bootReady && (
                    <div className="wp-state-wrap">
                        <div className="spinner wp-loading-spinner"></div>
                        <h2>{t.task2OpinionDrill.generatingTitle}</h2>
                        <p>{t.task2OpinionDrill.generatingDesc}</p>
                    </div>
                )}

                {bootReady && (step === 'answering' || step === 'evaluating' || step === 'reviewing') && currentQuestion && (
                    <>
                        <div className="opinion-drill-progress-wrap">
                            <div className="opinion-drill-progress-head">
                                <span>{progressText}</span>
                                <span>{progressPercent}%</span>
                            </div>
                            <div className="opinion-drill-progress-bar">
                                <div className="opinion-drill-progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>

                        <div className="wp-split">
                            <div className="wp-panel">
                                <div className="wp-panel-header">
                                    <h3>📜 {t.task2OpinionDrill.questionLabel}</h3>
                                    <span className="wp-word-badge">
                                        {t.task2OpinionDrill.categories[currentQuestion.category]}
                                    </span>
                                </div>
                                <div className="wp-panel-body">
                                    <div className="wp-prompt-block">{currentQuestion.prompt}</div>
                                </div>
                            </div>

                            <div className="wp-panel">
                                <div className="wp-panel-header">
                                    <h3>✍️ {t.task2OpinionDrill.answerLabel}</h3>
                                    <span className="wp-word-badge">{t.task2OpinionDrill.wordCount.replace('{n}', String(wordCount))}</span>
                                </div>
                                <div className="wp-panel-body">
                                    <textarea
                                        className="wp-answer-textarea"
                                        placeholder={t.task2OpinionDrill.answerPlaceholder}
                                        value={currentAnswer}
                                        disabled={step !== 'answering'}
                                        onChange={(e) => setCurrentAnswer(e.target.value)}
                                    />
                                </div>
                                <div className="wp-panel-footer">
                                    {step === 'reviewing' ? (
                                        <button className="wp-submit-btn" onClick={handleNextQuestion}>
                                            {currentIndex >= questions.length - 1
                                                ? t.task2OpinionDrill.viewSummaryBtn
                                                : t.task2OpinionDrill.nextQuestionBtn}
                                        </button>
                                    ) : (
                                        <button
                                            className="wp-submit-btn"
                                            disabled={step === 'evaluating'}
                                            onClick={handleSubmitAnswer}
                                        >
                                            {step === 'evaluating'
                                                ? t.task2OpinionDrill.evaluatingTitle
                                                : t.task2OpinionDrill.submitBtn}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {step === 'reviewing' && reviewResult && (
                            <div className="opinion-drill-result-card">
                                <div className="opinion-drill-result-head">
                                    <strong>{t.task2OpinionDrill.currentResultTitle}</strong>
                                    <span>{t.task2OpinionDrill.categories[reviewResult.question.category]}</span>
                                </div>
                                <div className="opinion-drill-result-scores">
                                    <span>{t.task2OpinionDrill.grammar}: {reviewResult.scores.grammar.toFixed(1)}</span>
                                    <span>{t.task2OpinionDrill.relevance}: {reviewResult.scores.relevance.toFixed(1)}</span>
                                    <span>{t.task2OpinionDrill.vocabulary}: {reviewResult.scores.vocabulary.toFixed(1)}</span>
                                    <span>{t.task2OpinionDrill.overallAvg}: {reviewResult.overall.toFixed(1)}</span>
                                </div>
                                <div className="opinion-drill-result-feedback">
                                    <div className="opinion-drill-feedback-label">{t.task2OpinionDrill.feedback}</div>
                                    <p>{reviewResult.feedback}</p>
                                </div>
                                <div className="opinion-drill-result-feedback">
                                    <div className="opinion-drill-feedback-label">{t.task2OpinionDrill.referenceAnswer}</div>
                                    <p>{reviewResult.referenceAnswer}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {step === 'summary' && (
                    <div className="opinion-drill-summary">
                        <div className="wc-result-card">
                            <h2>{t.task2OpinionDrill.summaryTitle}</h2>
                            <p className="opinion-drill-summary-desc">{t.task2OpinionDrill.summaryDesc}</p>

                            <div className="opinion-drill-summary-grid">
                                <div className="opinion-drill-metric">
                                    <div className="opinion-drill-metric-label">{t.task2OpinionDrill.overallAvg}</div>
                                    <div className="opinion-drill-metric-value">{summary.overall.toFixed(1)}</div>
                                </div>
                                <div className="opinion-drill-metric">
                                    <div className="opinion-drill-metric-label">{t.task2OpinionDrill.grammar}</div>
                                    <div className="opinion-drill-metric-value">{summary.grammar.toFixed(1)}</div>
                                </div>
                                <div className="opinion-drill-metric">
                                    <div className="opinion-drill-metric-label">{t.task2OpinionDrill.relevance}</div>
                                    <div className="opinion-drill-metric-value">{summary.relevance.toFixed(1)}</div>
                                </div>
                                <div className="opinion-drill-metric">
                                    <div className="opinion-drill-metric-label">{t.task2OpinionDrill.vocabulary}</div>
                                    <div className="opinion-drill-metric-value">{summary.vocabulary.toFixed(1)}</div>
                                </div>
                            </div>

                            <div className="opinion-drill-result-list">
                                {results.map((item, index) => (
                                    <div key={`${item.question.id}-${index}`} className="opinion-drill-result-card">
                                        <div className="opinion-drill-result-head">
                                            <strong>{t.task2OpinionDrill.questionLabel} {index + 1}</strong>
                                            <span>{t.task2OpinionDrill.categories[item.question.category]}</span>
                                        </div>
                                        <div className="opinion-drill-result-prompt">{item.question.prompt}</div>
                                        <div className="opinion-drill-result-answer">{item.answer}</div>
                                        <div className="opinion-drill-result-scores">
                                            <span>{t.task2OpinionDrill.grammar}: {item.scores.grammar.toFixed(1)}</span>
                                            <span>{t.task2OpinionDrill.relevance}: {item.scores.relevance.toFixed(1)}</span>
                                            <span>{t.task2OpinionDrill.vocabulary}: {item.scores.vocabulary.toFixed(1)}</span>
                                            <span>{t.task2OpinionDrill.overallAvg}: {item.overall.toFixed(1)}</span>
                                        </div>
                                        <div className="opinion-drill-result-feedback">
                                            <div className="opinion-drill-feedback-label">{t.task2OpinionDrill.feedback}</div>
                                            <p>{item.feedback}</p>
                                        </div>
                                        <div className="opinion-drill-result-feedback">
                                            <div className="opinion-drill-feedback-label">{t.task2OpinionDrill.referenceAnswer}</div>
                                            <p>{item.referenceAnswer}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="opinion-drill-summary-actions">
                                <button className="primary-button" onClick={() => handleExit('/writing/task2/opinion-drill')}>
                                    {t.task2OpinionDrill.restartBtn}
                                </button>
                                <button className="secondary-button" onClick={() => handleExit('/writing/task2')}>
                                    {t.task2OpinionDrill.backBtn}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
