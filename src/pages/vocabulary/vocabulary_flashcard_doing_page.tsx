import Layout from '../../components/layout/Layout';
import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { submitReview, type VocabCard } from '../../api/vocab';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard.css';

/* ── Types ───────────────────────────────────────────────────────────────── */

type Step = 'doing' | 'result';
type StudyMode = 'flashcard' | 'choice' | 'write';

interface ReviewResult {
    word:          string;
    zh:            string;
    rating:        number;
    newDue:        string;
    scheduledDays: number;
}

interface SessionCache {
    cards:          VocabCard[];
    queue:          number[];
    sessionMastery: number[];
    sessionForgot:  boolean[];
    graduatedCount: number;
    isFlipped:      boolean;
    step:           Step;
    results:        ReviewResult[];
    planId?:        number;
    planName?:      string;
    mode?:          StudyMode;
}

const SESSION_KEY = 'vocab_flashcard_session';

const RATING_INFO = [
    { id: 1, label: '忘了', cls: 'btn-again', key: '1' },
    { id: 2, label: '困难', cls: 'btn-hard',  key: '2' },
    { id: 3, label: '一般', cls: 'btn-good',  key: '3' },
    { id: 4, label: '容易', cls: 'btn-easy',  key: '4' },
];

const STATE_LABELS: Record<number, string> = {
    0: '新卡片', 1: '学习中', 2: '复习', 3: '重新学习',
};

const MODE_LABELS: Record<StudyMode, string> = {
    flashcard: '记忆卡',
    choice:    '4选1',
    write:     '看中文写英文',
};

const RS_CLASSES = ['rs-again', 'rs-hard', 'rs-good', 'rs-easy'];
const RS_LABELS  = ['忘了', '困难', '一般', '容易'];

/* ── 工具函数 ─────────────────────────────────────────────────────────────── */

function isReloadNavigation(): boolean {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entries.length > 0 && entries[0].type === 'reload';
}

/**
 * 熟练度进阶规则（记忆卡：只有 rating=4 算正确；选择/写单词：答对算正确）
 *   wrong      → 1（最低，重来）
 *   correct 0/1→ 2
 *   correct 2  → 3
 *   correct 3  → 4（毕业！）
 */
function nextMastery(current: number, correct: boolean): number {
    if (!correct) return 1;
    if (current <= 1) return 2;  // 第一次答对
    return 4;                     // 第二次答对 → 毕业
}

function estimateInterval(card: VocabCard, rating: number): string {
    const { state, stability: s } = card;
    if (state === 0 || state === 1 || state === 3) {
        if (rating <= 3) return '明天';
        return `约${Math.max(1, Math.round(s || 4))}天`;
    }
    if (rating === 1) return '明天';
    const factor = rating === 2 ? 0.6 : rating === 3 ? 1.0 : 1.5;
    const days = Math.max(1, Math.round((s || 1) * factor));
    return days === 1 ? '1天' : `约${days}天`;
}

function formatDue(isoStr: string): string {
    const diff = new Date(isoStr).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return '今天';
    if (mins < 60) return `${mins}分钟后`;
    const days = Math.round(diff / 86400000);
    if (days < 2) return '明天';
    return `${days}天后`;
}

function speak(word: string) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
}

/* ── 组件 ─────────────────────────────────────────────────────────────────── */

export default function VocabularyFlashcardDoingPage() {
    const location = useLocation();
    const navigate  = useNavigate();

    const [cards,          setCards]          = useState<VocabCard[]>([]);
    /** queue[0] 是当前卡片索引；毕业 = 弹出队头；重入 = 移到队尾 */
    const [queue,          setQueue]          = useState<number[]>([]);
    const [sessionMastery, setSessionMastery] = useState<number[]>([]); // 每张卡的熟练度 0-4
    /** 本次会话中是否曾经不会：若曾忘，毕业时强制提交 rating=1（复习间隔 1 天） */
    const [sessionForgot,  setSessionForgot]  = useState<boolean[]>([]);
    const [graduatedCount, setGraduatedCount] = useState(0);
    /** 每次换卡时递增，驱动各卡片级别的 useEffect 重置 */
    const [visitKey,       setVisitKey]       = useState(0);

    const [isFlipped,    setIsFlipped]    = useState(false);
    const [isFlipping,   setIsFlipping]   = useState(false);
    const [step,         setStep]         = useState<Step>('doing');
    const [results,      setResults]      = useState<ReviewResult[]>([]);
    const [submitting,   setSubmitting]   = useState(false);
    const [initialized,  setInitialized]  = useState(false);
    const [lastRating,   setLastRating]   = useState<number | null>(null);
    const [planId,       setPlanId]       = useState<number | null>(null);
    const [planName,     setPlanName]     = useState('');
    const [mode,         setMode]         = useState<StudyMode>('flashcard');

    // 4选1
    const [choices,        setChoices]        = useState<Array<{ zh: string; correct: boolean }>>([]);
    const [choiceSelected, setChoiceSelected] = useState<number | null>(null);

    // 看中文写英文
    const [writeInput,       setWriteInput]       = useState('');
    const [writeSubmitted,   setWriteSubmitted]   = useState(false);
    const [writeCorrect,     setWriteCorrect]     = useState<boolean | null>(null);
    const [unknownMode,      setUnknownMode]      = useState(false);    // 点击"不会"：展示单词让用户抄写
    const [quickProficient,  setQuickProficient]  = useState(false);   // 点击"熟练"：直接毕业

    /* 初始化 */
    useEffect(() => {
        if (isReloadNavigation()) {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) {
                try {
                    const s: SessionCache = JSON.parse(raw);
                    const n = s.cards.length;
                    setCards(s.cards);
                    setQueue(s.queue ?? Array.from({ length: n }, (_, i) => i));
                    setSessionMastery(s.sessionMastery ?? new Array(n).fill(0));
                    setSessionForgot(s.sessionForgot  ?? new Array(n).fill(false));
                    setGraduatedCount(s.graduatedCount ?? 0);
                    setIsFlipped(s.isFlipped ?? false);
                    setStep(s.step ?? 'doing');
                    setResults(s.results ?? []);
                    if (s.planId)   setPlanId(s.planId);
                    if (s.planName) setPlanName(s.planName);
                    if (s.mode)     setMode(s.mode);
                    setVisitKey(1);
                    setInitialized(true);
                    return;
                } catch { /* fallthrough */ }
            }
        }
        const state = location.state as {
            cards?: VocabCard[];
            planId?: number;
            planName?: string;
            mode?: StudyMode;
        } | null;
        if (!state?.cards?.length) {
            const fallback = state?.planId ? `/vocabulary/plans/${state.planId}` : '/vocabulary/plans';
            navigate(fallback, { replace: true });
            return;
        }
        const n = state.cards.length;
        setCards(state.cards);
        setQueue(Array.from({ length: n }, (_, i) => i));
        setSessionMastery(new Array(n).fill(0));
        setSessionForgot(new Array(n).fill(false));
        setGraduatedCount(0);
        if (state.planId)   setPlanId(state.planId);
        if (state.planName) setPlanName(state.planName);
        if (state.mode)     setMode(state.mode);
        setVisitKey(1);
        setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 持久化 */
    useEffect(() => {
        if (!initialized) return;
        const cache: SessionCache = {
            cards, queue, sessionMastery, sessionForgot,
            graduatedCount, isFlipped, step, results, mode,
        };
        if (planId)   cache.planId   = planId;
        if (planName) cache.planName = planName;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
    }, [initialized, cards, queue, sessionMastery, sessionForgot,
        graduatedCount, isFlipped, step, results, planId, planName, mode]);

    /* 每次换卡 (visitKey 变化) 重置卡片状态 */
    useEffect(() => {
        if (!initialized) return;
        setIsFlipped(false);
        setLastRating(null);
        setChoiceSelected(null);
        setWriteInput('');
        setWriteSubmitted(false);
        setWriteCorrect(null);
        setUnknownMode(false);
        setQuickProficient(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey]);

    /* 4选1 — 当前卡片变化时重新生成选项 */
    useEffect(() => {
        if (mode !== 'choice' || !cards.length || queue.length === 0) return;
        const ci      = queue[0];
        const current = cards[ci];
        if (!current) return;
        const others = cards.filter((_, i) => i !== ci && _.zh);
        const wrong3  = [...others].sort(() => Math.random() - 0.5).slice(0, 3);
        const opts    = [
            { zh: current.zh, correct: true },
            ...wrong3.map(c => ({ zh: c.zh, correct: false })),
        ].sort(() => Math.random() - 0.5);
        setChoices(opts);
    // visitKey 驱动重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visitKey, mode, cards]);

    /* 队列清空 → 结果页 */
    useEffect(() => {
        if (initialized && step === 'doing' && queue.length === 0 && graduatedCount > 0) {
            setStep('result');
        }
    }, [queue, initialized, step, graduatedCount]);

    const currentCardIdx = queue[0] ?? -1;
    const currentCard    = currentCardIdx >= 0 ? cards[currentCardIdx] : null;

    /* ── 核心：推进队列（仅毕业时提交 FSRS） ── */
    const submitAndAdvance = useCallback(async (
        ci:            number,
        card:          VocabCard,
        fsrsRating:    number,   // 毕业时实际提交给 FSRS 的评分
        newMastery:    number,   // 本次更新后的本地熟练度
        graduate:      boolean,
        forgotNow:     boolean,  // 本次操作是否属于"忘了"
        alreadyForgot: boolean,  // 本卡在会话中之前是否已忘过
    ) => {
        if (forgotNow) {
            setSessionForgot(prev => { const a = [...prev]; a[ci] = true; return a; });
        }

        try {
            if (graduate) {
                // 曾经忘过 → 强制 rating=1，复习间隔最多 1 天
                const finalRating = (alreadyForgot || forgotNow) ? 1 : fsrsRating;
                const { card: updated } = await submitReview(card.word, finalRating, card.last_review);
                setCards(prev => prev.map((c, i) => i === ci ? updated : c));
                setResults(prev => [...prev, {
                    word:          card.word,
                    zh:            card.zh,
                    rating:        finalRating,
                    newDue:        updated.due,
                    scheduledDays: updated.scheduled_days,
                }]);
                setGraduatedCount(g => g + 1);
            }
        } catch (err: unknown) {
            const errCode = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            if (errCode === 'CONFLICT') {
                showToast('数据已被其他设备更新，请返回重新开始', 'error');
            } else {
                showToast('提交失败，请重试', 'error');
            }
            setLastRating(null);
            setSubmitting(false);
            return;
        }

        setSessionMastery(prev => { const a = [...prev]; a[ci] = newMastery; return a; });
        setQueue(prev => graduate ? prev.slice(1) : [...prev.slice(1), ci]);
        setVisitKey(k => k + 1);
        setSubmitting(false);
    }, []);

    /**
     * 记忆卡手动评分
     * - 只有 rating=4（容易）才算"正确"，才能推进熟练度
     * - rating 1/2/3 均算"忘了"，熟练度重置为 1，重入队
     * - 仅毕业（熟练度达到 4）时提交 FSRS，且曾忘过的强制 rating=1
     */
    const handleFlashcardRating = useCallback(async (rating: number) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        setLastRating(rating);
        const ci            = currentCardIdx;
        const curMastery    = sessionMastery[ci] ?? 0;
        const isCorrect     = rating === 4;
        const forgotNow     = !isCorrect;
        const newMastery    = nextMastery(curMastery, isCorrect);
        const graduate      = newMastery === 4;
        const alreadyForgot = sessionForgot[ci] ?? false;
        await submitAndAdvance(ci, currentCard, rating, newMastery, graduate, forgotNow, alreadyForgot);
    }, [submitting, currentCard, currentCardIdx, sessionMastery, sessionForgot, submitAndAdvance]);

    /* 4选1 / 写单词：自动评分，熟练度提升至 4 时毕业 */
    const handleAutoRating = useCallback(async (isCorrect: boolean) => {
        if (submitting || !currentCard || currentCardIdx < 0) return;
        setSubmitting(true);
        const ci            = currentCardIdx;
        const curMastery    = sessionMastery[ci] ?? 0;
        const newMastery    = nextMastery(curMastery, isCorrect);
        const graduate      = newMastery === 4;
        const forgotNow     = !isCorrect;
        const alreadyForgot = sessionForgot[ci] ?? false;
        setLastRating(newMastery);
        await submitAndAdvance(ci, currentCard, newMastery, newMastery, graduate, forgotNow, alreadyForgot);
    }, [submitting, currentCard, currentCardIdx, sessionMastery, sessionForgot, submitAndAdvance]);

    /* 4选1 点击 */
    const handleChoice = useCallback(async (
        opt: { zh: string; correct: boolean },
        idx: number,
    ) => {
        if (choiceSelected !== null || submitting) return;
        setChoiceSelected(idx);
        await new Promise(r => setTimeout(r, 900));
        await handleAutoRating(opt.correct);
    }, [choiceSelected, submitting, handleAutoRating]);

    /* 写英文提交 */
    const handleWriteSubmit = useCallback(() => {
        if (writeSubmitted || submitting || !writeInput.trim() || !currentCard) return;
        const input  = writeInput.trim().toLowerCase();
        const target = currentCard.word.toLowerCase();
        if (unknownMode) {
            // 抄写模式：必须完全正确才能进入"下一个"；错了清空重试
            if (input !== target) {
                setWriteInput('');
                return;
            }
            // 抄对了：标记为"不会"（mastery=wrong），解锁"下一个"
            setWriteCorrect(false);
            setWriteSubmitted(true);
        } else {
            setWriteCorrect(input === target);
            setWriteSubmitted(true);
        }
    }, [writeSubmitted, submitting, writeInput, currentCard, unknownMode]);

    const handleWriteNext = useCallback(async () => {
        if (!writeSubmitted || submitting || writeCorrect === null) return;
        if (quickProficient) {
            // 熟练自评：直接毕业，不走 mastery 进阶
            const ci  = currentCardIdx;
            const card = currentCard;
            if (ci < 0 || !card) return;
            setSubmitting(true);
            const alreadyForgot = sessionForgot[ci] ?? false;
            await submitAndAdvance(ci, card, 4, 4, true, false, alreadyForgot);
        } else {
            await handleAutoRating(writeCorrect);
        }
    }, [writeSubmitted, submitting, writeCorrect, quickProficient,
        currentCardIdx, currentCard, sessionForgot, submitAndAdvance, handleAutoRating]);

    /* 快速自评 */
    const handleQuickAssess = useCallback((correct: boolean) => {
        if (writeSubmitted || submitting) return;
        if (!correct) {
            // 不会：展示单词，进入抄写流程
            setUnknownMode(true);
        } else {
            // 熟练：标记直接毕业，解锁"下一个"
            setQuickProficient(true);
            setWriteCorrect(true);
            setWriteSubmitted(true);
        }
    }, [writeSubmitted, submitting]);

    /* 撤销：回到初始写题状态（不会/熟练选择页） */
    const handleWriteUndo = useCallback(() => {
        setWriteInput('');
        setWriteSubmitted(false);
        setWriteCorrect(null);
        setUnknownMode(false);
        setQuickProficient(false);
    }, []);

    /* 键盘快捷键（仅记忆卡模式） */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || mode !== 'flashcard') return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    setIsFlipped(f => !f);
                    break;
                case 'Digit1': case 'Numpad1': if (isFlipped) handleFlashcardRating(1); break;
                case 'Digit2': case 'Numpad2': if (isFlipped) handleFlashcardRating(2); break;
                case 'Digit3': case 'Numpad3': if (isFlipped) handleFlashcardRating(3); break;
                case 'Digit4': case 'Numpad4': if (isFlipped) handleFlashcardRating(4); break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [step, isFlipped, submitting, handleFlashcardRating, mode]);

    /* 键盘快捷键（写单词模式）
     * 快速自评可用时（输入框为空、未提交）：↑ 熟练  ↓ 不会 */
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (step !== 'doing' || submitting || mode !== 'write') return;
            if (writeSubmitted || unknownMode || writeInput.trim()) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                handleQuickAssess(false);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                handleQuickAssess(true);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [step, submitting, mode, writeSubmitted, unknownMode, writeInput, handleQuickAssess]);

    /* 再来一轮 */
    const handleRetry = () => {
        const n = cards.length;
        setQueue(Array.from({ length: n }, (_, i) => i));
        setSessionMastery(new Array(n).fill(0));
        setSessionForgot(new Array(n).fill(false));
        setGraduatedCount(0);
        setStep('doing');
        setResults([]);
        setLastRating(null);
        setVisitKey(k => k + 1);
    };

    /* ── 加载中 ── */
    if (!initialized || (!currentCard && step === 'doing')) {
        return (
            <Layout>
                <div className="config-page-wrap" style={{ textAlign: 'center', paddingTop: '60px' }}>
                    <p style={{ color: 'var(--color-text-secondary)' }}>加载中…</p>
                </div>
            </Layout>
        );
    }

    const total      = cards.length;
    const progress   = total > 0 ? Math.round((graduatedCount / total) * 100) : 0;
    const statusCls  = lastRating == null ? '' :
        lastRating === 1 ? 'status-again' :
        lastRating === 2 ? 'status-hard'  :
        lastRating === 3 ? 'status-good'  : 'status-easy';

    const backPath  = planId ? `/vocabulary/plans/${planId}` : '/vocabulary/plans';
    const backLabel = '返回学习计划';

    /* ══ 结果页 ══════════════════════════════════════════════════════════════ */
    if (step === 'result') {
        const counts = [1, 2, 3, 4].map(r => results.filter(x => x.rating === r).length);
        return (
            <Layout>
                <div className="config-page-wrap">
                    <div className="practice-header">
                        <Link to={backPath} className="back-link">{backLabel}</Link>
                        <h1>本轮结果{planName ? ` · ${planName}` : ''}</h1>
                        <p>共掌握 <strong>{results.length}</strong> 个单词</p>
                    </div>
                    <div className="config-card">
                        <div className="fc-result-stats">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className={`fc-result-stat ${RS_CLASSES[i]}`}>
                                    <div className="rs-num">{counts[i]}</div>
                                    <div className="rs-label">{RS_LABELS[i]}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="config-card">
                        <h3>复习明细</h3>
                        <div className="fc-result-list">
                            {results.map((r, i) => (
                                <div key={i} className="fc-result-item">
                                    <span className="fc-ri-word">{r.word}</span>
                                    <span className="fc-ri-zh">{r.zh}</span>
                                    <span className="fc-ri-due">{formatDue(r.newDue)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="fc-result-actions">
                            <button className="fc-action-btn" onClick={handleRetry}>🔄 再来一轮</button>
                            <button className="fc-action-btn primary" onClick={() => navigate(backPath)}>
                                {backLabel}
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    /* ══ 背诵页 ══════════════════════════════════════════════════════════════ */
    if (!currentCard) return null;

    return (
        <Layout>
            <div className="config-page-wrap" style={{ maxWidth: '680px' }}>
                <div className="practice-header" style={{ marginBottom: '16px' }}>
                    <Link to={backPath} className="back-link">{backLabel}</Link>
                    <h1 style={{ marginBottom: '4px' }}>{planName || '记忆卡背诵'}</h1>
                </div>

                {/* 进度行 */}
                <div className="fc-header">
                    <span className="fc-counter">
                        ✓ {graduatedCount} / {total}
                        <span style={{ fontWeight: 400, marginLeft: 6, opacity: 0.6 }}>
                            队列 {queue.length}
                        </span>
                    </span>
                    <div className="fc-header-right">
                        <span className="fc-mode-badge">{MODE_LABELS[mode]}</span>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {STATE_LABELS[currentCard.state] ?? ''}
                            {currentCard.reps > 0 && ` · 复习 ${currentCard.reps} 次`}
                        </span>
                    </div>
                </div>
                <div className="fc-progress-bar">
                    <div className="fc-progress-fill" style={{ width: `${progress}%` }} />
                </div>

                {/* ══ 记忆卡模式 ══ */}
                {mode === 'flashcard' && (
                    <>
                        <div
                            className="fc-scene"
                            onClick={() => !submitting && setIsFlipped(f => !f)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f); }
                            }}
                            aria-label={isFlipped ? '点击翻回正面' : '点击翻转查看释义'}
                        >
                            <div
                                className={`fc-card ${isFlipped ? 'is-flipped' : ''} ${isFlipping ? 'is-flipping' : ''} ${statusCls}`}
                                onTransitionStart={(e) => { if (e.propertyName === 'transform') setIsFlipping(true); }}
                                onTransitionEnd={(e) => { if (e.propertyName === 'transform') setIsFlipping(false); }}
                            >
                                {/* 正面 */}
                                <div className="fc-face">
                                    <button
                                        className="fc-speak-btn"
                                        onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                        title="朗读"
                                    >🔊</button>
                                    <div className="fc-word">{currentCard.word}</div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                            {currentCard.phonetic}
                                        </div>
                                    )}
                                    {currentCard.reps > 0 && (
                                        <div className="fc-reps-badge">
                                            已复习 {currentCard.reps} 次
                                            {currentCard.lapses > 0 && ` · 遗忘 ${currentCard.lapses} 次`}
                                        </div>
                                    )}
                                    <div className="fc-tap-hint">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                            <path d="M12 5v14M5 12l7 7 7-7" />
                                        </svg>
                                        点击翻转查看释义
                                    </div>
                                </div>

                                {/* 背面 */}
                                <div className="fc-face fc-face--back">
                                    <div className="fc-back-word">
                                        {currentCard.word}
                                        <button
                                            className="fc-speak-btn fc-speak-btn--inline"
                                            onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                            title="朗读"
                                        >🔊</button>
                                    </div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic">{currentCard.phonetic}</div>
                                    )}
                                    <div className="fc-meaning">{currentCard.zh}</div>
                                    {currentCard.grammar && (
                                        <div className="fc-grammar">{currentCard.grammar}</div>
                                    )}
                                    {currentCard.definitions && currentCard.definitions.length > 0 && (
                                        <div className="fc-definitions">
                                            {currentCard.definitions.map((d, i) => (
                                                <div key={i} className="fc-def-item">
                                                    {d.pos && <span className="fc-def-pos">{d.pos}</span>}
                                                    <span className="fc-def-meaning">{d.meaning}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {currentCard.examples && currentCard.examples.length > 0 && (
                                        <div className="fc-examples">
                                            {currentCard.examples.map((ex, i) => (
                                                <div key={i} className="fc-example-item">
                                                    <div className="fc-example-en">{ex.en}</div>
                                                    {ex.zh && <div className="fc-example-zh">{ex.zh}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="fc-state-label">
                                        {STATE_LABELS[currentCard.state]}
                                        {currentCard.stability > 0 && ` · 稳定性 ${currentCard.stability.toFixed(1)}`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 评分按钮：只有 rating=4（容易）才推进熟练度；1/2/3 均重入队 */}
                        <div className={`fc-rating-row${!isFlipped ? ' locked' : ''}`}>
                            {RATING_INFO.map(info => (
                                <button
                                    key={info.id}
                                    className={`fc-btn ${info.cls}`}
                                    onClick={() => handleFlashcardRating(info.id)}
                                    disabled={!isFlipped || submitting}
                                >
                                    <span className="btn-label">{info.label}</span>
                                    <span className="btn-key">[{info.key}]</span>
                                    <span className="btn-interval">{estimateInterval(currentCard, info.id)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="fc-kb-hint">
                            Space = 翻转 &nbsp;|&nbsp; 翻牌后按 1 / 2 / 3 / 4 评分（4 = 掌握）
                        </div>
                    </>
                )}

                {/* ══ 4选1模式 ══ */}
                {mode === 'choice' && (
                    <>
                        <div className="fc-scene" style={{ cursor: 'default' }}>
                            <div className={`fc-card ${statusCls}`} style={{ minHeight: 180 }}>
                                <div className="fc-face">
                                    <button
                                        className="fc-speak-btn"
                                        onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                        title="朗读"
                                    >🔊</button>
                                    <div className="fc-word">{currentCard.word}</div>
                                    {currentCard.phonetic && (
                                        <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                            {currentCard.phonetic}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="fc-choices">
                            {choices.map((opt, idx) => {
                                let cls = 'fc-choice-opt';
                                if (choiceSelected !== null) {
                                    if (opt.correct)                 cls += ' correct';
                                    else if (choiceSelected === idx)  cls += ' wrong';
                                    else                             cls += ' dimmed';
                                }
                                return (
                                    <button
                                        key={idx}
                                        className={cls}
                                        onClick={() => handleChoice(opt, idx)}
                                        disabled={choiceSelected !== null || submitting}
                                    >
                                        {opt.zh}
                                    </button>
                                );
                            })}
                        </div>
                    </>
                )}

                {/* ══ 看中文写英文模式 ══ */}
                {mode === 'write' && (
                    <>
                        <div className="fc-scene" style={{ cursor: 'default' }}>
                            <div className={`fc-card ${statusCls}`} style={{ minHeight: 160 }}>
                                <div className="fc-face">
                                    <div className="fc-meaning" style={{ textAlign: 'center' }}>
                                        {currentCard.zh}
                                    </div>
                                    {currentCard.grammar && (
                                        <div className="fc-grammar" style={{ marginTop: 12 }}>
                                            {currentCard.grammar}
                                        </div>
                                    )}
                                    {/* 首字母提示 */}
                                    {!unknownMode && (
                                        <div className="fc-write-hint">
                                            <span className="fc-write-hint-chars">
                                                {currentCard.word[0]}
                                                {'_'.repeat(currentCard.word.length - 1)}
                                            </span>
                                            <span className="fc-write-hint-len">
                                                {currentCard.word.length}个字母
                                            </span>
                                        </div>
                                    )}
                                    {/* 抄写模式：卡片内展示单词供参考 */}
                                    {unknownMode && !writeSubmitted && (
                                        <div className="fc-unknown-reveal">
                                            <span className="fc-unknown-word">{currentCard.word}</span>
                                            {currentCard.phonetic && (
                                                <span className="fc-phonetic" style={{ marginLeft: 10 }}>
                                                    {currentCard.phonetic}
                                                </span>
                                            )}
                                            <button
                                                className="fc-speak-btn fc-speak-btn--inline"
                                                onClick={() => speak(currentCard.word)}
                                                title="朗读"
                                            >🔊</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="fc-write-area">
                            <div className="fc-write-input-row">
                                <input
                                    type="text"
                                    className={`fc-write-input${
                                        writeSubmitted
                                            ? writeCorrect ? ' write-correct' : ' write-wrong'
                                            : ''
                                    }`}
                                    placeholder={unknownMode ? '抄写上方单词…' : '输入英文单词…'}
                                    value={writeInput}
                                    onChange={e => setWriteInput(e.target.value)}
                                    onKeyDown={e => {
                                        // 方向键在快速自评可用时交给全局 handler，阻止浏览器 autocomplete 默认行为
                                        if (!writeSubmitted && !unknownMode && !writeInput.trim() &&
                                            (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                            e.preventDefault();
                                            return;
                                        }
                                        if (e.key === 'Enter') {
                                            if (!writeSubmitted) handleWriteSubmit();
                                            else handleWriteNext();
                                        }
                                    }}
                                    autoComplete="new-password"
                                    readOnly={writeSubmitted}
                                    // eslint-disable-next-line jsx-a11y/no-autofocus
                                    autoFocus
                                />
                                <button
                                    className="fc-write-submit"
                                    onClick={handleWriteSubmit}
                                    disabled={writeSubmitted || !writeInput.trim() || submitting}
                                >
                                    提交 <span className="fc-qa-key">[键盘↵]</span>
                                </button>
                                {/* 朗读按钮始终可点击 */}
                                <button
                                    className="fc-speak-btn fc-speak-btn--standalone"
                                    onClick={() => speak(currentCard.word)}
                                    title="朗读单词"
                                >🔊</button>
                            </div>
                            {/* 快速自评按钮（未提交、非抄写模式、且输入框为空时显示） */}
                            {!writeSubmitted && !unknownMode && !writeInput.trim() && (
                                <div className="fc-quick-assess">
                                    <button
                                        className="fc-qa-btn fc-qa-unknown"
                                        onClick={() => handleQuickAssess(false)}
                                        disabled={submitting}
                                    >不会 <span className="fc-qa-key">[键盘↓]</span></button>
                                    <button
                                        className="fc-qa-btn fc-qa-proficient"
                                        onClick={() => handleQuickAssess(true)}
                                        disabled={submitting}
                                    >熟练 <span className="fc-qa-key">[键盘↑]</span></button>
                                </div>
                            )}
                            {/* 抄写模式下的撤销入口 */}
                            {unknownMode && !writeSubmitted && (
                                <button className="fc-write-undo" onClick={handleWriteUndo}>
                                    ↩ 撤销
                                </button>
                            )}
                            {writeSubmitted && (
                                <div className={`fc-write-result ${writeCorrect ? 'correct' : 'wrong'}`}>
                                    <span>
                                        {unknownMode
                                            ? `✓ 已抄写：${currentCard.word}`
                                            : writeCorrect
                                                ? `✓ 正确：${currentCard.word}`
                                                : `✗ 正确答案：${currentCard.word}`}
                                    </span>
                                    <button
                                        className="fc-write-next"
                                        onClick={handleWriteNext}
                                        disabled={submitting}
                                    >
                                        下一个 → <span className="fc-qa-key">[键盘↵]</span>
                                    </button>
                                    <button
                                        className="fc-write-undo"
                                        onClick={handleWriteUndo}
                                        disabled={submitting}
                                    >
                                        ↩ 撤销
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}
