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
            setError('无效的计划');
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
            setError(msg || '加载文章失败，请稍后重试');
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
                    showToast(msg || '提交失败，请稍后重试', 'error');
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
            { label: '正在连接', desc: '准备生成文章' },
            { label: 'AI 正在生成文章', desc: '可能需要 10-60 秒' },
            { label: '分析词汇位置', desc: '标记目标单词' },
        ];

        return (
            <Layout>
                <div className="ac-loading">
                    <div className="ac-loading-spinner" />
                    <h2 className="ac-loading-title">正在准备文章...</h2>
                    <p className="ac-loading-hint">AI 正在根据今日学习计划生成一篇包含目标词汇的短文</p>

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
                        取消
                    </button>

                    {loadingStep >= 1 && (
                        <p className="ac-loading-slow">文章越长，生成越慢，请耐心等待...</p>
                    )}
                </div>
            </Layout>
        );
    }

    if (error || !article) {
        return (
            <Layout>
                <div className="ac-error">
                    <p>{error || '文章数据不可用'}</p>
                    <button onClick={() => navigate(-1)}>返回</button>
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
                        ← 返回计划
                    </button>
                    <span className="ac-plan-name">{planNameRef.current || '文章抄写'}</span>
                    {cached && <span className="ac-cached-badge">缓存</span>}
                    <button
                        className="ac-regenerate-btn"
                        onClick={handleRegenerate}
                        disabled={regenerating}
                    >
                        {regenerating ? '生成中...' : '重新生成'}
                    </button>
                    <span className="ac-timer">{formatTimer(elapsedSeconds)}</span>
                </div>

                {/* progress */}
                <div className="ac-progress">
                    <div className="ac-progress-item">
                        <span className="ac-progress-label">整体进度</span>
                        <span className="ac-progress-value">{progress.pct}%</span>
                        <div className="ac-progress-bar">
                            <div className="ac-progress-fill" style={{ width: `${progress.pct}%` }} />
                        </div>
                    </div>
                    <div className="ac-progress-item">
                        <span className="ac-progress-label">正确率</span>
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
                            目标词 {progress.wordsDone}/{progress.wordsTotal}
                        </span>
                        <span className="ac-progress-value">
                            {progress.typed}/{progress.total} 字符
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
                            ← 上一页
                        </button>
                        <div className="ac-page-nav-info">
                            <span className="ac-page-nav-index">
                                第 {currentPage + 1}/{totalPages} 页
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
                            下一页 →
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
                            title={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
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
                                            目标词 ({progress.wordsDone}/{progress.wordsTotal})
                                        </button>
                                        <button
                                            className={`ac-sidebar-tab${sidebarTab === 'translation' ? ' active' : ''}`}
                                            onClick={() => setSidebarTab('translation')}
                                        >
                                            译文
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
                                                                第 {currentPage + 1} 页译文
                                                            </p>
                                                        )}
                                                        <p className="ac-translation-text">
                                                            {currentTranslation}
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="ac-translation-empty">暂无译文</p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}

                        {!sidebarOpen && (
                            <span className="ac-sidebar-collapsed-text">侧边栏</span>
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
                            ? '使用缓存（未扣除 AT）'
                            : `消耗了 ${article.atConsumed.toLocaleString()} AT`}
                    </div>
                )}
            </div>

            {/* completion overlay */}
            {completeResult && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <h3>抄写完成！</h3>

                        <div className="ac-complete-stats">
                            <div className="ac-complete-row">
                                <span>用时</span>
                                <span>{formatTimer(elapsedSeconds)}</span>
                            </div>
                            <div className="ac-complete-row">
                                <span>正确率</span>
                                <span>{progress.accuracy}%</span>
                            </div>
                            <div className="ac-complete-row">
                                <span>已标记单词</span>
                                <span>{completeResult.marked_count} 个</span>
                            </div>
                        </div>

                        <p className="ac-complete-done">
                            所有单词已标记完成，复习间隔已更新
                        </p>

                        <button
                            className="ac-back-btn ac-back-btn-large"
                            onClick={() => navigate(`/vocabulary/plans/${planId}`)}
                        >
                            返回计划详情
                        </button>
                    </div>
                </div>
            )}

            {/* completing overlay */}
            {completing && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <div className="ac-loading-spinner" style={{ marginBottom: 16 }} />
                        <p className="ac-completing-msg">正在提交...</p>
                    </div>
                </div>
            )}
        </Layout>
    );
}
