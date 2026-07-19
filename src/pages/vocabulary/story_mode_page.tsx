import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import {
    getStoryMode,
    saveStoryModeProgress,
    completeStoryMode,
    type StoryModeData,
    type StoryModeCompleteResult,
} from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/story_mode.css';

/* ── helpers ───────────────────────────────────────────────────────────────── */

interface PillToken {
    kind: 'word' | 'text';
    word?: string;
    zh?: string;
    text?: string;
}

function parseStoryText(text: string): PillToken[] {
    const tokens: PillToken[] = [];
    const re = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(text)) !== null) {
        if (match.index > lastIdx) {
            tokens.push({ kind: 'text', text: text.slice(lastIdx, match.index) });
        }
        tokens.push({ kind: 'word', word: match[1].trim(), zh: match[2].trim() });
        lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
        tokens.push({ kind: 'text', text: text.slice(lastIdx) });
    }

    return tokens;
}

/* ── component ─────────────────────────────────────────────────────────────── */

export default function StoryModePage() {
    const { t } = useLang();
    const { id } = useParams<{ id: string }>();
    const planId = Number(id);
    const navigate = useNavigate();

    /* state */
    const [story, setStory] = useState<StoryModeData | null>(null);
    const [clickedWords, setClickedWords] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [completing, setCompleting] = useState(false);
    const [completeResult, setCompleteResult] = useState<StoryModeCompleteResult | null>(null);
    const [currentPage, setCurrentPage] = useState(0);
    const [hasSaved, setHasSaved] = useState(false);

    /* refs */
    const abortRef = useRef<AbortController | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const planNameRef = useRef('');

    /* derived */
    const boundaries = useMemo(() => story?.article_boundaries ?? [], [story]);
    const totalPages = Math.max(1, boundaries.length);

    const targetWords = useMemo(() => {
        if (!story) return new Set<string>();
        return new Set(story.target_words);
    }, [story]);

    const collectedCount = useMemo(() => {
        let count = 0;
        for (const w of clickedWords) {
            if (targetWords.has(w)) count++;
        }
        return count;
    }, [clickedWords, targetWords]);

    /* ── load story ──────────────────────────────────────────────────────── */
    const loadStory = useCallback(async (refresh = false) => {
        if (!planId || Number.isNaN(planId)) {
            setError(t('vocab.storyMode.errInvalidPlan'));
            setLoading(false);
            return;
        }

        abortRef.current?.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;

        setLoading(true);
        setError('');

        try {
            const data = await getStoryMode(planId, refresh, ctrl.signal);
            if (ctrl.signal.aborted) return;

            setStory(data);
            setClickedWords(new Set(data.clicked_words ?? []));
            setCurrentPage(0);
            setCompleteResult(null);
            setHasSaved(false);
        } catch (err: unknown) {
            if ((err as { name?: string }).name === 'CanceledError' || ctrl.signal.aborted) return;
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            setError(msg || t('vocab.storyMode.errLoadFail'));
        } finally {
            setLoading(false);
        }
    }, [planId]);

    useEffect(() => {
        const state = (window.history.state?.usr ?? {}) as Record<string, unknown>;
        if (state?.planName) planNameRef.current = state.planName as string;

        void loadStory();

        return () => {
            abortRef.current?.abort();
        };
    }, [loadStory]);

    /* ── save progress ───────────────────────────────────────────────────── */
    useEffect(() => {
        if (loading || !story || completeResult) return;

        saveTimerRef.current = setInterval(() => {
            if (clickedWords.size > 0 && !hasSaved) {
                const arr = Array.from(clickedWords);
                saveStoryModeProgress(planId, arr).catch(() => {});
                setHasSaved(true);
            }
        }, 5000);

        return () => {
            if (saveTimerRef.current) clearInterval(saveTimerRef.current);
        };
    }, [loading, story, completeResult, planId, clickedWords, hasSaved]);

    useEffect(() => {
        return () => {
            if (clickedWords.size > 0 && !completeResult && story) {
                const arr = Array.from(clickedWords);
                saveStoryModeProgress(planId, arr).catch(() => {});
            }
        };
    }, [clickedWords, completeResult, story, planId]);

    /* ── handlers ────────────────────────────────────────────────────────── */
    const handleClickWord = useCallback((word: string) => {
        if (completing || completeResult) return;

        setClickedWords(prev => {
            const next = new Set(prev);
            if (next.has(word)) {
                next.delete(word);
            } else {
                next.add(word);
            }
            return next;
        });
        setHasSaved(false);
    }, [completing, completeResult]);

    const handleComplete = useCallback(async () => {
        if (!story || completing || completeResult) return;

        setCompleting(true);
        try {
            const reviewDays = (window.history.state?.usr as Record<string, unknown>)?.reviewDays as number ?? 7;
            const result = await completeStoryMode(planId, reviewDays);
            setCompleteResult(result);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            showToast(msg || t('vocab.storyMode.submitFail'), 'error');
        } finally {
            setCompleting(false);
        }
    }, [story, completing, completeResult, planId]);

    /* auto-complete when all target words clicked */
    useEffect(() => {
        if (!story || completing || completeResult) return;
        if (targetWords.size > 0 && collectedCount >= targetWords.size) {
            const timer = setTimeout(() => handleComplete(), 800);
            return () => clearTimeout(timer);
        }
    }, [collectedCount, targetWords.size, story, completing, completeResult, handleComplete]);

    /* ── page navigation ──────────────────────────────────────────────────── */
    const goToPage = useCallback((pageIndex: number) => {
        if (pageIndex < 0 || pageIndex >= totalPages) return;
        setCurrentPage(pageIndex);
    }, [totalPages]);

    /* ── parse tokens ─────────────────────────────────────────────────────── */
    const tokens = useMemo(() => {
        if (!story) return [] as PillToken[];

        /* if boundaries exist, return current page text */
        let text = story.story_text;
        if (boundaries.length > 0 && boundaries[currentPage]) {
            const b = boundaries[currentPage];
            text = story.story_text.slice(b.start, b.end);
        }

        return parseStoryText(text);
    }, [story, boundaries, currentPage]);

    /* ── render ───────────────────────────────────────────────────────────── */

    if (loading) {
        return (
            <Layout>
                <div className="sm-container">
                    <div className="sm-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            <p>{t('vocab.storyMode.generatingTitle')}</p>
                            <p style={{ fontSize: '0.85rem', opacity: 0.6 }}>{t('vocab.storyMode.generatingDesc')}</p>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    if (error || !story) {
        return (
            <Layout>
                <div className="sm-container">
                    <div className="sm-main" style={{ alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                            <p>{error || t('vocab.storyMode.unavailable')}</p>
                            <button
                                onClick={() => navigate(-1)}
                                style={{
                                    marginTop: 12, padding: '8px 20px',
                                    background: 'var(--color-primary)', color: '#fff',
                                    border: 'none', borderRadius: 6, cursor: 'pointer',
                                }}
                            >
                                {t('vocab.storyMode.backBtn')}
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    /* split titles for multi-page */
    const titles = story.story_title.split('\n');

    return (
        <Layout>
            <div className="sm-container">
                {/* header */}
                <div className="sm-header">
                    <div>
                        <span className="sm-header-title">
                            {titles[0] || t('vocab.storyMode.fallbackTitle')}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div className="sm-progress-bar">
                            <div
                                className="sm-progress-fill"
                                style={{
                                    width: targetWords.size > 0
                                        ? `${(collectedCount / targetWords.size) * 100}%`
                                        : '0%',
                                }}
                            />
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                            {collectedCount}/{targetWords.size}
                        </span>
                        <button
                            onClick={() => navigate(`/vocabulary/plans/${planId}`)}
                            style={{
                                padding: '6px 14px', background: 'var(--color-surface)',
                                border: '1px solid var(--color-border)', borderRadius: 6,
                                color: 'var(--color-text-secondary)', cursor: 'pointer',
                                fontSize: '0.85rem', whiteSpace: 'nowrap',
                            }}
                        >
                            {t('common.back')}
                        </button>
                    </div>
                </div>

                {/* page nav */}
                {totalPages > 1 && (
                    <div className="sm-pagination">
                        {boundaries.map((_b, i) => (
                            <button
                                key={i}
                                className={`sm-page-btn${currentPage === i ? ' active' : ''}`}
                                onClick={() => goToPage(i)}
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                )}

                {/* article */}
                <div className="sm-main">
                    <div className="sm-article-area">
                        {boundaries.length > 0 && (
                            <div className="sm-title">
                                {boundaries[currentPage]?.title || titles[currentPage] || ''}
                            </div>
                        )}

                        {tokens.map((token, i) => {
                            if (token.kind === 'text') {
                                return <span key={i}>{token.text}</span>;
                            }

                            const word = token.word!;
                            const isClicked = clickedWords.has(word);

                            return (
                                <span
                                    key={i}
                                    className={`sm-pill${isClicked ? ' sm-pill-clicked' : ''}`}
                                    onClick={() => handleClickWord(word)}
                                >
                                    <span className="sm-pill-eng">{word}</span>
                                    <span className="sm-pill-zh">{token.zh}</span>
                                </span>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* completion overlay */}
            {completeResult && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <h3>{t('vocab.storyMode.completedTitle')}</h3>

                        <div className="ac-complete-stats">
                            <div className="ac-complete-row">
                                <span>{t('vocab.storyMode.collectedLabel')}</span>
                                <span>{collectedCount}/{targetWords.size}</span>
                            </div>
                            <div className="ac-complete-row">
                                <span>{t('vocab.storyMode.markedLabel')}</span>
                                <span>{completeResult.marked_count} {t('vocab.storyMode.markedUnit')}</span>
                            </div>
                        </div>

                        <p className="ac-complete-done">
                            {t('vocab.storyMode.allMarkedMsg')}
                        </p>

                        <button
                            className="ac-back-btn ac-back-btn-large"
                            onClick={() => navigate(`/vocabulary/plans/${planId}`)}
                        >
                            {t('vocab.storyMode.backToPlan')}
                        </button>
                    </div>
                </div>
            )}

            {/* completing overlay */}
            {completing && (
                <div className="ac-complete-overlay">
                    <div className="ac-complete-card">
                        <div className="ac-loading-spinner" style={{ marginBottom: 16 }} />
                        <p className="ac-completing-msg">{t('vocab.storyMode.submittingMsg')}</p>
                    </div>
                </div>
            )}
        </Layout>
    );
}
