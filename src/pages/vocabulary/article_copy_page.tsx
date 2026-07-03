import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import {
    getArticleCopy,
    completeArticleCopy,
    saveArticleCopyProgress,
    type ArticleCopyData,
    type ArticleCopyCompleteResult,
} from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/article_copy.css';

/* ── helpers ───────────────────────────────────────────────────────────────── */

function normalizeText(s: string): string {
    return s
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/ /g, ' ')
        .replace(/　/g, ' ')
        .replace(/‐/g, '-')
        .replace(/‑/g, '-')
        .replace(/‒/g, '-')
        .replace(/–/g, '-')
        .replace(/—/g, '-')
        .replace(/―/g, '-')
        .replace(/‘/g, "'")
        .replace(/’/g, "'")
        .replace(/“/g, '"')
        .replace(/”/g, '"')
        .replace(/…/g, '...')
        .replace(/﻿/g, '');
}

function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ── component ─────────────────────────────────────────────────────────────── */

export default function ArticleCopyPage() {
    const { translations: t } = useLang();
    const { id } = useParams<{ id: string }>();
    const planId = Number(id);
    const navigate = useNavigate();

    /* state */
    const [article, setArticle] = useState<ArticleCopyData | null>(null);
    const [userInput, setUserInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingStep, setLoadingStep] = useState(0);
    const [error, setError] = useState('');
    const [completing, setCompleting] = useState(false);
    const [completeResult, setCompleteResult] = useState<ArticleCopyCompleteResult | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarTab, setSidebarTab] = useState<'words' | 'translation'>('words');
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [currentPage, setCurrentPage] = useState(0);
    const [regenerating, setRegenerating] = useState(false);
    const [cached, setCached] = useState(false);

    /* refs */
    const containerRef = useRef<HTMLDivElement>(null);
    const articleAreaRef = useRef<HTMLDivElement>(null);
    const hiddenInputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef<AbortController | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const loadingStepsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const planNameRef = useRef('');

    /* derived */
    const targetWordSet = useMemo(() => {
        if (!article) return new Set<string>();
        return new Set(Object.keys(article.word_positions));
    }, [article]);

    const wordEntries = useMemo(() => {
        if (!article) return [] as Array<{ word: string; zh: string }>;
        const meanings = article.word_meanings ?? {};
        return Object.keys(article.word_positions).map(w => ({
            word: w,
            zh: meanings[w] ?? '',
        }));
    }, [article]);

    const boundaries = useMemo(() => article?.article_boundaries ?? [], [article]);
    const totalPages = Math.max(1, boundaries.length);

    /* ── load article ────────────────────────────────────────────────────── */
    const loadArticle = useCallback(async (refresh = false) => {
        if (!planId || Number.isNaN(planId)) {
            setError(t.vocab.articleCopy.errInvalidPlan);
            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError('');
        setUserInput('');
        setElapsedSeconds(0);
        setCurrentPage(0);
        setCompleteResult(null);

        setLoadingStep(0);
        let step = 0;
        loadingStepsTimerRef.current = setInterval(() => {
            step += 1;
            if (step <= 2) setLoadingStep(step);
        }, 2000);

        try {
            const data = await getArticleCopy(planId, refresh, ctrl.signal);
            if (ctrl.signal.aborted) return;

            setArticle(data);
            setCached(data.cached);
            if (data.typed_text) setUserInput(data.typed_text);
        } catch (err: unknown) {
            if ((err as { name?: string }).name === 'CanceledError' || ctrl.signal.aborted) return;
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg || t.vocab.articleCopy.errLoadFail);
        } finally {
            setLoading(false);
            if (loadingStepsTimerRef.current) {
                clearInterval(loadingStepsTimerRef.current);
                loadingStepsTimerRef.current = null;
            }
        }
    }, [planId]);

    useEffect(() => {
        const state = (window.history.state?.usr ?? {}) as Record<string, unknown>;
        if (state?.planName) planNameRef.current = state.planName as string;

        void loadArticle();

        return () => {
            abortRef.current?.abort();
            if (loadingStepsTimerRef.current) clearInterval(loadingStepsTimerRef.current);
        };
    }, [loadArticle]);

    /* ── timer ───────────────────────────────────────────────────────────── */
    useEffect(() => {
        if (loading || completeResult) return;

        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [loading, completeResult]);

    /* ── save progress ───────────────────────────────────────────────────── */
    useEffect(() => {
        if (loading || !article || completeResult) return;

        saveTimerRef.current = setInterval(() => {
            if (userInput.length > 0) {
                saveArticleCopyProgress(planId, userInput).catch(() => {});
            }
        }, 5000);

        return () => {
            if (saveTimerRef.current) clearInterval(saveTimerRef.current);
        };
    }, [loading, article, completeResult, planId, userInput]);

    useEffect(() => {
        return () => {
            if (userInput.length > 0 && !completeResult && article) {
                saveArticleCopyProgress(planId, userInput).catch(() => {});
            }
        };
    }, [userInput, completeResult, article, planId]);

    /* ── auto-advance page ───────────────────────────────────────────────── */
    useEffect(() => {
        if (!boundaries.length || currentPage >= boundaries.length - 1) return;
        const boundary = boundaries[currentPage];
        if (boundary && userInput.length > boundary.end) {
            setCurrentPage(prev => prev + 1);
        }
    }, [userInput.length, boundaries, currentPage]);

    /* ── scroll to page ──────────────────────────────────────────────────── */
    const scrollToPage = useCallback((pageIndex: number) => {
        if (!articleAreaRef.current || !boundaries.length) return;

        const boundary = boundaries[pageIndex];
        if (!boundary) return;

        const chars = articleAreaRef.current.querySelectorAll('.ac-char');
        if (chars[boundary.start]) {
            chars[boundary.start].scrollIntoView({ block: 'start', behavior: 'smooth' });
        }
    }, [boundaries]);

    useEffect(() => {
        scrollToPage(currentPage);
    }, [currentPage, scrollToPage]);

    /* ── completion check ─────────────────────────────────────────────────── */
    const checkComplete = useCallback((input: string) => {
        if (!article || completing || completeResult) return;

        const normalizedArticle = normalizeText(article.article_text);
        if (input.length >= normalizedArticle.length) {
            setCompleting(true);
            (async () => {
                try {
                    const reviewDays = (window.history.state?.usr as Record<string, unknown>)?.reviewDays as number ?? 7;
                    const result = await completeArticleCopy(planId, reviewDays);
                    setCompleteResult(result);
                } catch (err: unknown) {
                    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
                    showToast(msg || t.vocab.articleCopy.submitFail, 'error');
                } finally {
                    setCompleting(false);
                }
            })();
        }
    }, [article, completing, completeResult, planId]);

    /* ── input handler ────────────────────────────────────────────────────── */
    const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!article || completeResult) return;

        const raw = e.target.value;
        const normalizedArticle = normalizeText(article.article_text);

        let filtered = '';
        let articleIdx = 0;
        for (let i = 0; i < raw.length && articleIdx < normalizedArticle.length; i++) {
            const ch = raw[i];
            if (ch === '\n') {
                filtered += ch;
                continue;
            }
            while (articleIdx < normalizedArticle.length && normalizedArticle[articleIdx] === '\n') {
                articleIdx++;
            }
            if (articleIdx >= normalizedArticle.length) break;
            filtered += ch;
            articleIdx++;
        }

        setUserInput(filtered);
        checkComplete(filtered);
    }, [article, completeResult, checkComplete]);

    /* ── regenerate ───────────────────────────────────────────────────────── */
    const handleRegenerate = useCallback(async () => {
        setRegenerating(true);
        try {
            await loadArticle(true);
        } finally {
            setRegenerating(false);
        }
    }, [loadArticle]);

    /* ── page navigation ──────────────────────────────────────────────────── */
    const goToPage = useCallback((pageIndex: number) => {
        if (pageIndex < 0 || pageIndex >= totalPages) return;
        setCurrentPage(pageIndex);
    }, [totalPages]);

    /* ── focus hidden input ───────────────────────────────────────────────── */
    const focusInput = useCallback(() => {
        hiddenInputRef.current?.focus();
    }, []);

    /* ── sidebar resize ───────────────────────────────────────────────────── */
    const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev: MouseEvent) => {
            if (!resizeRef.current) return;
            const delta = ev.clientX - resizeRef.current.startX;
            const next = Math.min(520, Math.max(220, resizeRef.current.startWidth + delta));
            setSidebarWidth(next);
        };
        const onUp = () => {
            resizeRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [sidebarWidth]);

    /* ── render: article characters ───────────────────────────────────────── */
    const articleChars = useMemo(() => {
        if (!article) return null;

        const text = article.article_text;
        const normalizedArticle = normalizeText(text);
        const normalizedInput = normalizeText(userInput);
        const positions = article.word_positions;

        const targetPositions = new Set<number>();
        for (const ranges of Object.values(positions)) {
            for (const range of ranges) {
                for (let i = range.start; i < range.end; i++) {
                    targetPositions.add(i);
                }
            }
        }

        const meaningStarts = new Map<number, string>();
        if (article.word_meanings) {
            for (const [word, ranges] of Object.entries(positions)) {
                const meaning = article.word_meanings[word];
                if (meaning && ranges.length > 0) {
                    meaningStarts.set(ranges[0].start, meaning);
                }
            }
        }

        const chars: React.ReactNode[] = [];

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            const normalizedCh = normalizeText(ch);

            let className = 'ac-char';

            if (i < normalizedInput.length) {
                const typed = normalizedInput[i] ?? '';
                if (typed === normalizedCh) {
                    className += ' ac-correct';
                } else {
                    className += ' ac-wrong';
                }
            } else {
                if (targetPositions.has(i)) {
                    className += ' ac-ghost ac-ghost-target';
                } else {
                    className += ' ac-ghost';
                }
            }

            if (i === normalizedInput.length && normalizedInput.length < normalizedArticle.length) {
                className += ' ac-cursor-inner';
            }

            const meaning = meaningStarts.get(i);

            chars.push(
                <span key={i} className={className}>
                    {meaning && <span className="ac-inline-meaning">{meaning}</span>}
                    {ch}
                </span>,
            );
        }

        if (normalizedInput.length >= normalizedArticle.length) {
            chars.push(
                <span key="cursor-end" className="ac-char ac-cursor-end">|</span>,
            );
        }

        return chars;
    }, [article, userInput]);

    /* ── progress stats ───────────────────────────────────────────────────── */
    const progress = useMemo(() => {
        if (!article) return { pct: 0, typed: 0, total: 0, accuracy: 100, wordsDone: 0, wordsTotal: 0 };

        const normalizedArticle = normalizeText(article.article_text);
        const normalizedInput = normalizeText(userInput);
        const total = normalizedArticle.length;
        const typed = Math.min(normalizedInput.length, total);

        let correct = 0;
        for (let i = 0; i < typed; i++) {
            if (normalizedInput[i] === normalizedArticle[i]) correct++;
        }

        const accuracy = typed > 0 ? Math.round((correct / typed) * 100) : 100;
        const pct = Math.round((typed / total) * 100);

        let wordsDone = 0;
        for (const ranges of Object.values(article.word_positions)) {
            const allTyped = ranges.every(r => r.end <= typed);
            if (allTyped) wordsDone++;
        }

        return { pct, typed, total, accuracy, wordsDone, wordsTotal: targetWordSet.size };
    }, [article, userInput, targetWordSet]);

    /* ── current page translation ─────────────────────────────────────────── */
    const currentTranslation = useMemo(() => {
        if (!boundaries.length) return article?.article_translation ?? '';
        const boundary = boundaries[currentPage];
        return boundary?.translation ?? '';
    }, [boundaries, currentPage, article]);

    /* ── render ───────────────────────────────────────────────────────────── */

    if (loading) {
        const steps = [
            { label: t.vocab.articleCopy.stepConnectLabel, desc: t.vocab.articleCopy.stepConnectDesc },
            { label: t.vocab.articleCopy.stepGeneratingLabel, desc: t.vocab.articleCopy.stepGeneratingDesc },
            { label: t.vocab.articleCopy.stepAnalyzingLabel, desc: t.vocab.articleCopy.stepAnalyzingDesc },
        ];

        return (
            <Layout>
                <div className="ac-loading">
                    <div className="ac-loading-spinner" />
                    <h2 className="ac-loading-title">{t.vocab.articleCopy.preparingTitle}</h2>
                    <p className="ac-loading-hint">{t.vocab.articleCopy.preparingHint}</p>

                    <div className="ac-loading-steps">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className={`ac-loading-step${i < loadingStep ? ' is-done' : i === loadingStep ? ' is-active' : ' is-pending'}`}
                            >
                                <div className="ac-step-indicator">
                                    {i < loadingStep
                                        ? <span className="ac-step-check">✓</span>
                                        : i === loadingStep
                                            ? <span className="ac-step-spinner" />
                                            : <span className="ac-step-dot" />
                                    }
                                </div>
                                <div className="ac-step-body">
                                    <span className="ac-step-label">{step.label}</span>
                                    <span className="ac-step-desc">{step.desc}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        className="ac-cancel-btn"
                        onClick={() => { abortRef.current?.abort(); navigate(-1); }}
                    >
                        {t.vocab.articleCopy.cancelBtn}
                    </button>

                    {loadingStep >= 1 && (
                        <p className="ac-loading-slow">{t.vocab.articleCopy.slowHint}</p>
                    )}
                </div>
            </Layout>
        );
    }

    if (error || !article) {
        return (
            <Layout>
                <div className="ac-error">
                    <p>{error || t.vocab.articleCopy.unavailable}</p>
                    <button onClick={() => navigate(-1)}>{t.vocab.articleCopy.backBtn}</button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="ac-container" ref={containerRef}>
                {/* header */}
                <div className="ac-header">
                    <button
                        className="ac-back-btn"
                        onClick={() => navigate(`/vocabulary/plans/${planId}`)}
                    >
                        {t.vocab.articleCopy.backToPlan}
                    </button>
                    <span className="ac-plan-name">{planNameRef.current || t.vocab.articleCopy.fallbackTitle}</span>
                    {cached && <span className="ac-cached-badge">{t.vocab.articleCopy.cachedBadge}</span>}
                    <button
                        className="ac-regenerate-btn"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                    >
                        {regenerating ? t.vocab.articleCopy.regeneratingBtn : t.vocab.articleCopy.regenerateBtn}
                    </button>
                    <span className="ac-timer">{formatTimer(elapsedSeconds)}</span>
                </div>

                {/* progress */}
                <div className="ac-progress">
                    <div className="ac-progress-item">
                        <span className="ac-progress-label">{t.vocab.articleCopy.overallProgress}</span>
                        <span className="ac-progress-value">{progress.pct}%</span>
                        <div className="ac-progress-bar">
                            <div className="ac-progress-fill" style={{ width: `${progress.pct}%` }} />
                        </div>
                    </div>
                    <div className="ac-progress-item">
                        <span className="ac-progress-label">{t.vocab.articleCopy.correctnessLabel}</span>
                        <span className="ac-progress-value">{progress.accuracy}%</span>
                        <div className="ac-progress-bar">
                            <div
                                className="ac-progress-fill ac-progress-accuracy"
                                style={{ width: `${progress.accuracy}%` }}
                            />
                        </div>
                    </div>
                    <div className="ac-progress-item">
                        <span className="ac-progress-label">
                            {t.vocab.articleCopy.targetWords.replace('{done}', String(progress.wordsDone)).replace('{total}', String(progress.wordsTotal))}
                        </span>
                        <span className="ac-progress-value">
                            {t.vocab.articleCopy.charProgress.replace('{typed}', String(progress.typed)).replace('{total}', String(progress.total))}
                        </span>
                        <div className="ac-progress-bar">
                            <div
                                className="ac-progress-fill ac-progress-words"
                                style={{
                                    width: progress.wordsTotal > 0
                                        ? `${(progress.wordsDone / progress.wordsTotal) * 100}%`
                                        : '0%',
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* meta */}
                <div className="ac-meta">
                    <h2 className="ac-article-title">
                        {boundaries.length > 0 && currentPage < boundaries.length
                            ? boundaries[currentPage].title
                            : article.article_title.split('\n')[0]}
                    </h2>
                </div>

                {/* page navigation */}
                {totalPages > 1 && (
                    <div className="ac-page-nav">
                        <button
                            className="ac-page-nav-btn"
                            disabled={currentPage === 0}
                            onClick={() => goToPage(currentPage - 1)}
                        >
                            {t.vocab.articleCopy.prevPage}
                        </button>
                        <div className="ac-page-nav-info">
                            <span className="ac-page-nav-index">
                                {t.vocab.articleCopy.pageNum.replace('{n}', String(currentPage + 1)).replace('{total}', String(totalPages))}
                            </span>
                            {boundaries[currentPage] && (
                                <span className="ac-page-title">
                                    {boundaries[currentPage].title}
                                </span>
                            )}
                        </div>
                        <button
                            className="ac-page-nav-btn"
                            disabled={currentPage >= totalPages - 1}
                            onClick={() => goToPage(currentPage + 1)}
                        >
                            {t.vocab.articleCopy.nextPage}
                        </button>
                    </div>
                )}

                {/* main: sidebar + article */}
                <div className="ac-layout">
                    {/* sidebar */}
                    <aside
                        className={`ac-sidebar${sidebarOpen ? '' : ' is-closed'}`}
                        style={{ width: sidebarOpen ? sidebarWidth : undefined }}
                    >
                        <button
                            className="ac-sidebar-toggle"
                            onClick={() => setSidebarOpen(prev => !prev)}
                            title={sidebarOpen ? t.vocab.articleCopy.sidebarClose : t.vocab.articleCopy.sidebarOpen}
                        >
                            {sidebarOpen ? '◀' : '▶'}
                        </button>

                        {sidebarOpen && (
                            <>
                                <div className="ac-sidebar-resizer" onMouseDown={handleResizeStart} />
                                <div className="ac-sidebar-content">
                                    <div className="ac-sidebar-tabs">
                                        <button
                                            className={`ac-sidebar-tab${sidebarTab === 'words' ? ' active' : ''}`}
                                            onClick={() => setSidebarTab('words')}
                                        >
                                            {t.vocab.articleCopy.targetWordsCount.replace('{done}', String(progress.wordsDone)).replace('{total}', String(progress.wordsTotal))}
                                        </button>
                                        <button
                                            className={`ac-sidebar-tab${sidebarTab === 'translation' ? ' active' : ''}`}
                                            onClick={() => setSidebarTab('translation')}
                                        >
                                            {t.vocab.articleCopy.translationTab}
                                        </button>
                                    </div>

                                    <div className="ac-sidebar-pane">
                                        {sidebarTab === 'words' ? (
                                            <div className="ac-word-chips ac-word-chips-vertical">
                                                {wordEntries.map(({ word, zh }) => {
                                                    const ranges = article.word_positions[word];
                                                    const done = ranges
                                                        ? ranges.every(r => r.end <= progress.typed)
                                                        : false;
                                                    return (
                                                        <div
                                                            key={word}
                                                            className={`ac-word-chip${done ? ' ac-word-done' : ''}`}
                                                        >
                                                            <span className="ac-chip-check">
                                                                {done ? '✓' : '○'}
                                                            </span>
                                                            <span className="ac-chip-word">{word}</span>
                                                            <span className="ac-chip-meaning">{zh}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <>
                                                {currentTranslation ? (
                                                    <>
                                                        {boundaries.length > 0 && (
                                                            <p className="ac-translation-page-hint">
                                                                {t.vocab.articleCopy.pageTranslation.replace('{n}', String(currentPage + 1))}
                                                            </p>
                                                        )}
                                                        <p className="ac-translation-text">
                                                            {currentTranslation}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="ac-translation-empty">{t.vocab.articleCopy.emptyTranslation}</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {!sidebarOpen && (
                            <span className="ac-sidebar-collapsed-text">{t.vocab.articleCopy.sidebarLabel}</span>
                        )}
                    </aside>

                    {/* article area */}
                    <div className="ac-main">
                        <div
                            className="ac-article-area"
                            ref={articleAreaRef}
                            onClick={focusInput}
                        >
                            <div className="ac-article-text">
                                {articleChars}
                            </div>
                        </div>
                    </div>
                </div>

                {/* hidden textarea */}
                <textarea
                    ref={hiddenInputRef}
                    className="ac-hidden-input"
                    value={userInput}
                    onChange={handleInput}
                    autoFocus
                    onPaste={e => {
                        e.preventDefault();
                        const text = e.clipboardData.getData('text');
                        if (text) {
                            const current = userInput;
                            setUserInput(current + text);
                        }
                    }}
                />

                {/* AT cost */}
                {article.atConsumed !== undefined && article.atConsumed > 0 && (
                    <div className="ac-cost">
                        {article.cached
                            ? t.vocab.articleCopy.cachedNoAT
                            : t.vocab.articleCopy.atConsumed.replace('{n}', article.atConsumed.toLocaleString())}
                    </div>
                )}
            </div>

            {/* completion overlay */}
            {completeResult && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <h3>{t.vocab.articleCopy.completedTitle}</h3>

                        <div className="ac-complete-stats">
                            <div className="ac-complete-row">
                                <span>{t.vocab.articleCopy.timeUsedLabel}</span>
                                <span>{formatTimer(elapsedSeconds)}</span>
                            </div>
                            <div className="ac-complete-row">
                                <span>{t.vocab.articleCopy.correctnessValueLabel}</span>
                                <span>{progress.accuracy}%</span>
                            </div>
                            <div className="ac-complete-row">
                                <span>{t.vocab.articleCopy.markedWordsLabel}</span>
                                <span>{completeResult.marked_count} {t.vocab.articleCopy.markedUnit}</span>
                            </div>
                        </div>

                        <p className="ac-complete-done">
                            {t.vocab.articleCopy.allMarkedMsg}
                        </p>

                        <button
                            className="ac-back-btn ac-back-btn-large"
                            onClick={() => navigate(`/vocabulary/plans/${planId}`)}
                        >
                            {t.vocab.storyMode.backToPlan}
                        </button>
                    </div>
                </div>
            )}

            {/* completing overlay */}
            {completing && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <div className="ac-loading-spinner" style={{ marginBottom: 16 }} />
                        <p className="ac-completing-msg">{t.vocab.articleCopy.submittingMsg}</p>
                    </div>
                </div>
            )}
        </Layout>
    );
}
