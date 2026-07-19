import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { retryWithBackoff } from '../../utils/retry';
import { type StudyMode, type MasterySetting } from '../../utils/vocab_flashcard_utils';
import { useLang } from '../../i18n/LanguageContext';
import type { Translations } from '../../i18n/translations';
import { sanitize } from '../../utils/safe_html';
import { listNotebooks, type Notebook } from '../../api/notebook';
import {
    listPlanWords, addWord, updatePlanWord, removePlanWord,
    updatePlan, startPlan, getArticleCopy, aiParsePlanWords,
    listVocabBooks, listBookWords,
    type LearningPlan, type PlanEntry, type VocabBook, type BookWord, type AiParsedWord,
} from '../../api/learning_plan';
import PlanWordRow from '../../components/vocabulary/PlanWordRow';
import TodayStudiedSection from '../../components/vocabulary/TodayStudiedSection';
import AiModelSelector from '../../components/common/AiModelSelector';
import { devLog } from '../../utils/devLog';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_learning_plan.css';

type AddTab = 'manual' | 'notebook' | 'book' | 'ai';
type BookSubMode = 'all' | 'range' | 'select';

const STUDY_MODES: [StudyMode, keyof Translations['vocab']['modes']][] = [
    ['flashcard', 'flashcard'],
    ['read-aloud', 'readAloud'],
    ['choice', 'choice'],
    ['write', 'write'],
    ['copy', 'copy'],
    ['article_copy', 'articleCopy'],
    ['story_mode', 'storyModeDrama'],
];

function clampCopyRepetitions(value: number): number {
    return Math.min(20, Math.max(1, Number.isFinite(value) ? Math.floor(value) : 3));
}

function clampCopyReviewDays(value: number): number {
    return Math.min(365, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 2));
}

function clampArticleReviewDays(value: number): number {
    return Math.min(365, Math.max(0, Number.isFinite(value) ? Math.floor(value) : 7));
}

/**
 * 根据 fsrs_due 计算距今的真实剩余天数。
 *
 * 注意：fsrs_scheduled_days 是 FSRS 复习间隔（上次复习 → 下次到期），
 * 不等于距今的剩余天数！随着时间推移两者会越来越不一致。
 * 本函数从到期日期反算距今天数，确保和日期显示完全匹配。
 */
function computeRemainingDays(fsrsDue?: string | null): number {
    if (!fsrsDue) return 0;
    const due = new Date(fsrsDue);
    if (Number.isNaN(due.getTime())) return 0;
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    return Math.max(0, Math.round((dueUtc - todayUtc) / (24 * 60 * 60 * 1000)));
}

function parseSearchDays(query: string): number | null {
    const compact = query.trim().toLowerCase().replace(/\s+/g, '');
    if (!compact) return null;

    const match = compact.match(/^(\d+)(?:天|天后|d|day|days)?$/);
    if (!match) return null;

    const days = Number(match[1]);
    return Number.isFinite(days) && days >= 0 ? days : null;
}

function getPlanTodayTarget(plan: LearningPlan): number {
    return Math.max(plan.studied_today, plan.today_target ?? plan.daily_count);
}

function shouldStartReview(plan: LearningPlan): boolean {
    const todayTarget = getPlanTodayTarget(plan);
    return !!plan.has_activity_today && todayTarget > 0 && plan.studied_today >= todayTarget;
}

/**
 * 清理与计划相关的所有浏览器缓存
 * 当用户修改学习计划时调用，防止缓存数据与数据库不同步导致的模式失败
 */
function clearPlanCaches(planId: number): void {
    devLog('[计划缓存] 开始清理缓存...', { planId });

    const planSessionPrefix = `vocab_flashcard_session_plan_${planId}`;
    const dynamicPlanSessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(planSessionPrefix)) {
            dynamicPlanSessionKeys.push(key);
        }
    }

    // 1. 清理 sessionStorage（会话级别）
    const sessionKeys = [
        'vocab_flashcard_session',           // 词汇学习主会话
        `vocab_flashcard_session_plan_${planId}`,
        ...dynamicPlanSessionKeys,
        'reading_session_cache',              // 阅读会话缓存
        'listening_session_cache',            // 听力会话缓存
        'vocab_doing_session_mcq',            // 词汇训练 - 4选1
        'vocab_doing_session_dictation',      // 词汇训练 - 听写
        'vocab_doing_session_complete',       // 词汇训练 - 补全
    ];

    Array.from(new Set(sessionKeys)).forEach(key => {
        if (sessionStorage.getItem(key)) {
            sessionStorage.removeItem(key);
            devLog('[计划缓存] 已清理 sessionStorage:', key);
        }
    });

    // 2. 清理与此计划相关的 localStorage 数据
    // ⚠️ 注意：这里保留 mode 和 masteryTarget，因为这是用户的偏好设置
    // 如果要强制重置，可以取消注释下面的代码
    // localStorage.removeItem(`lp_study_mode_${planId}`);
    // localStorage.removeItem(`lp_mastery_target_${planId}`);

    devLog('[计划缓存] 缓存清理完成', { planId, timestamp: new Date().toISOString() });
}

export default function LearningPlanDetailPage() {
    const { t } = useLang();
    const { id } = useParams<{ id: string }>();
    const planId = Number(id);
    const navigate = useNavigate();

    // Plan meta
    const [plan, setPlan] = useState<LearningPlan | null>(null);
    const [planName, setPlanName] = useState('');
    const [dailyCount, setDailyCount] = useState(20);

    // Word list
    const [entries, setEntries] = useState<PlanEntry[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageJumpInput, setPageJumpInput] = useState('');
    const [sortBy, setSortBy] = useState<'default' | 'alphabetical' | 'proficiency'>('default');
    const [sortAsc, setSortAsc] = useState(true);

    // Starting session
    const [starting, setStarting] = useState(false);
    
    // Disable body scroll strictly for this fullscreen-like layout
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);
    const [studyMode, setStudyMode] = useState<StudyMode>(
        () => (localStorage.getItem(`lp_study_mode_${planId}`) as StudyMode) || 'flashcard'
    );
    const [masteryTarget, setMasteryTarget] = useState<MasterySetting>(() => {
        const raw = localStorage.getItem(`lp_mastery_target_${planId}`) ?? '2';
        if (raw === 'auto') return 'auto';
        const v = Number(raw);
        return Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 2;
    });
    const [copyRepetitions, setCopyRepetitions] = useState<number>(() => {
        const raw = Number(localStorage.getItem(`lp_copy_repetitions_${planId}`) ?? '3');
        return clampCopyRepetitions(raw);
    });
    const [copyReviewDays, setCopyReviewDays] = useState<number>(() => {
        const raw = Number(localStorage.getItem(`lp_copy_review_days_${planId}`) ?? '2');
        return clampCopyReviewDays(raw);
    });
    const [articleRegenerating, setArticleRegenerating] = useState(false);
    const [articleReviewDays, setArticleReviewDays] = useState<number>(() => {
        const raw = Number(localStorage.getItem(`lp_article_review_days_${planId}`) ?? '7');
        return clampArticleReviewDays(raw);
    });

    // Add section
    const [addTab, setAddTab] = useState<AddTab>('manual');
    const [addWord_, setAddWord_] = useState('');
    const [addZh, setAddZh] = useState('');
    const [addPhonetic, setAddPhonetic] = useState('');
    const [addGrammar, setAddGrammar] = useState('');
    const [addBusy, setAddBusy] = useState(false);

    // AI import tab
    const [aiText, setAiText] = useState('');
    const [aiParsing, setAiParsing] = useState(false);
    const [aiParsed, setAiParsed] = useState<AiParsedWord[] | null>(null);

    // Notebook tab
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [nbId, setNbId] = useState<number | ''>('');

    // Book tab
    const [books, setBooks] = useState<VocabBook[]>([]);
    const [bookId, setBookId] = useState<number | ''>('');
    const [bookSubMode, setBookSubMode] = useState<BookSubMode>('all');
    const [rangeStart, setRangeStart] = useState(1);
    const [rangeEnd, setRangeEnd] = useState(50);
    const [allBookWords, setAllBookWords] = useState<BookWord[]>([]);
    const [bookPage, setBookPage] = useState(1);
    const [bookPageJumpInput, setBookPageJumpInput] = useState('');
    const [bookQ, setBookQ] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [deletingEntry, setDeletingEntry] = useState<PlanEntry | null>(null);

    // Resizer State
    const [leftWidth, setLeftWidth] = useState(800);
    const isDraggingRef = useRef(false);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return;
            setLeftWidth(Math.max(400, Math.min(e.clientX, window.innerWidth - 300)));
        };
        const handleMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // ── Load plan + words ──────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([
            listPlanWords(planId),
        ])
            .then(([r]) => {
                // 以后端返回的 fsrs_scheduled_days 为准，避免前端时区重算导致天数偏差。
                setEntries(r.entries);
            })
            .catch(() => showToast(t('vocab.details.msgLoadFail'), 'error'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planId]);

    // Load plan name/daily_count from entries summary (we don't have a separate GET yet, use startPlan response? no)
    // Actually let's call the list endpoint and find ourselves — or we can store from navigate state.
    // Use a dedicated GET via updatePlan — wait, we have PlanDetailView.
    // Let me call GET /plans/:id/ directly via apiClient.
    useEffect(() => {
        import('../../api/client').then(({ apiClient }) => {
            apiClient.get(`/plans/${planId}/`).then(r => {
                const p: LearningPlan = r.data.plan;
                setPlan(p);
                setPlanName(p.name);
                setDailyCount(p.daily_count);
                if (p.default_mode) setStudyMode(p.default_mode as StudyMode);
                if (p.mastery_target) setMasteryTarget(p.mastery_target as MasterySetting);
                if (typeof p.copy_repetitions === 'number') {
                    setCopyRepetitions(clampCopyRepetitions(p.copy_repetitions));
                }
                if (typeof p.copy_review_days === 'number') {
                    setCopyReviewDays(clampCopyReviewDays(p.copy_review_days));
                }
                if (typeof p.article_review_days === 'number') {
                    setArticleReviewDays(clampArticleReviewDays(p.article_review_days));
                }
            }).catch(() => { });
        });
    }, [planId]);

    // Load notebooks + books on first render
    useEffect(() => {
        listNotebooks().then(r => setNotebooks(r.notebooks)).catch(() => { });
        listVocabBooks().then(r => setBooks(r.books)).catch(() => { });
    }, []);

    // Load all book words (client-side search/pagination)
    useEffect(() => {
        if (bookSubMode !== 'select' || !bookId) return;
        setAllBookWords([]);
        setBookPage(1);
        listBookWords(bookId as number, 1, 5000).then(r => {
            setAllBookWords(r.words);
        }).catch(() => { });
    }, [bookId, bookSubMode]);

    useEffect(() => {
        localStorage.setItem(`lp_mastery_target_${planId}`, String(masteryTarget));
    }, [planId, masteryTarget]);

    useEffect(() => {
        localStorage.setItem(`lp_copy_repetitions_${planId}`, String(copyRepetitions));
    }, [planId, copyRepetitions]);

    useEffect(() => {
        localStorage.setItem(`lp_copy_review_days_${planId}`, String(copyReviewDays));
    }, [planId, copyReviewDays]);

    useEffect(() => {
        localStorage.setItem(`lp_article_review_days_${planId}`, String(articleReviewDays));
    }, [planId, articleReviewDays]);

    // Reset pagination when search or entries change
    useEffect(() => { setPage(1); }, [search]);
    useEffect(() => { setPage(1); }, [entries.length]);

    // ── Plan meta save ─────────────────────────────────────────────────────
    const saveName = useCallback(async () => {
        const name = planName.trim();
        if (!name || !plan || name === plan.name) return;
        try {
            const { plan: p } = await updatePlan(planId, { name });
            setPlan(p);
            // 修改计划名称后，清除相关缓存以防止不一致
            clearPlanCaches(planId);
            showToast(t('vocab.details.msgSaveSuccess'), 'success');
        } catch {
            showToast(t('vocab.details.msgSaveFail'), 'error');
            setPlanName(plan.name);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [planName, plan, planId]);

    const saveDaily = useCallback(async () => {
        if (!plan || dailyCount === plan.daily_count) return;
        if (plan.has_activity_today) {
            showToast(t('vocab.details.toastDailyLocked'), 'error');
            setDailyCount(plan.daily_count);
            return;
        }
        if (dailyCount < 1 || dailyCount > 200) { showToast(t('vocab.details.msgDailyRange'), 'error'); return; }
        try {
            const { plan: p } = await updatePlan(planId, { daily_count: dailyCount });
            setPlan(p);
            // 修改daily_count成功后，使用完整的缓存清理函数
            // 这样下次进入学习页面时，会使用新的daily_count重新构建队列
            clearPlanCaches(planId);
            showToast(t('vocab.details.msgDailySaveSuccess'), 'success');
        } catch {
            showToast(t('vocab.details.msgSaveFail'), 'error');
            setDailyCount(plan.daily_count);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dailyCount, plan, planId]);

    const saveCopyConfig = useCallback(async () => {
        if (!plan) return;

        const nextRepeats = clampCopyRepetitions(copyRepetitions);
        const nextReviewDays = clampCopyReviewDays(copyReviewDays);
        if (nextRepeats !== copyRepetitions) setCopyRepetitions(nextRepeats);
        if (nextReviewDays !== copyReviewDays) setCopyReviewDays(nextReviewDays);

        const originalRepeats = plan.copy_repetitions ?? 3;
        const originalReviewDays = plan.copy_review_days ?? 2;
        const hasChanged = nextRepeats !== originalRepeats || nextReviewDays !== originalReviewDays;
        if (!hasChanged) {
            return;
        }

        try {
            const { plan: updated } = await updatePlan(planId, {
                copy_repetitions: nextRepeats,
                copy_review_days: nextReviewDays,
            });
            setPlan(updated);
            setCopyRepetitions(clampCopyRepetitions(updated.copy_repetitions ?? nextRepeats));
            setCopyReviewDays(clampCopyReviewDays(updated.copy_review_days ?? nextReviewDays));
            showToast(t('vocab.details.toastCopyCfgSaved'), 'success');
        } catch (e: unknown) {
            const errorMsg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            showToast(errorMsg || t('vocab.details.toastCopyCfgFail'), 'error');
            setCopyRepetitions(clampCopyRepetitions(plan.copy_repetitions ?? 3));
            setCopyReviewDays(clampCopyReviewDays(plan.copy_review_days ?? 2));
        }
    }, [copyRepetitions, copyReviewDays, plan, planId]);

    const saveArticleConfig = useCallback(async () => {
        if (!plan) return;

        const nextDays = clampArticleReviewDays(articleReviewDays);
        if (nextDays !== articleReviewDays) setArticleReviewDays(nextDays);

        const originalDays = plan.article_review_days ?? 7;
        if (nextDays === originalDays) return;

        try {
            const { plan: updated } = await updatePlan(planId, {
                article_review_days: nextDays,
            });
            setPlan(updated);
            setArticleReviewDays(clampArticleReviewDays(updated.article_review_days ?? nextDays));
            showToast(t('vocab.details.toastArticleCfgSaved'), 'success');
        } catch (e: unknown) {
            const errorMsg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error;
            showToast(errorMsg || t('vocab.details.toastArticleCfgFail'), 'error');
            setArticleReviewDays(clampArticleReviewDays(plan.article_review_days ?? 7));
        }
    }, [articleReviewDays, plan, planId]);

    const articleRegeneratingRef = useRef(false);
    const handleRegenerateArticle = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (articleRegeneratingRef.current || starting) return;
        articleRegeneratingRef.current = true;
        setArticleRegenerating(true);
        setStarting(true);
        try {
            await getArticleCopy(planId, true);
            const result = await startPlan(planId);
            if (result.cards.length === 0) {
                showToast(t('vocab.details.toastNoWordsToday'), 'success');
                return;
            }
            navigate(`/vocabulary/plans/${planId}/article-copy`, {
                state: {
                    planId,
                    planName: plan?.name,
                    planDailyCount: plan?.daily_count,
                    reviewDays: clampArticleReviewDays(plan?.article_review_days ?? articleReviewDays),
                    cards: result.cards,
                },
            });
        } catch (err: unknown) {
            const errorMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            showToast(errorMsg || t('vocab.details.toastRegenFail'), 'error');
        } finally {
            articleRegeneratingRef.current = false;
            setArticleRegenerating(false);
            setStarting(false);
        }
    }, [planId, starting, plan, articleReviewDays, navigate]);

    // ── Start session ──────────────────────────────────────────────────────
    const isQuotaDone = plan ? shouldStartReview(plan) : false;
    const isTodayConfigLocked = !!plan?.has_activity_today;

    const handleStart = async () => {
        if (starting || entries.length === 0) return;
        setStarting(true);
        let retryAttempt = 0;
        const maxRetries = 5;

        try {
            const result = await retryWithBackoff(
                () => startPlan(planId, isQuotaDone ? 'review' : 'study'),
                {
                    maxAttempts: maxRetries,
                    initialDelay: 1000,
                    onProgress: (attempt) => {
                        retryAttempt = attempt;
                        if (attempt > 1) {
                            devLog(`[学习计划] 开始学习 - 重试 ${attempt}/${maxRetries}`);
                        }
                    },
                    onRetry: (attempt, delay) => {
                        console.warn(`[学习计划] 开始学习失败，${delay}ms 后进行第 ${attempt + 1} 次尝试`);
                    },
                }
            );
            const { cards, stats } = result;

            if (cards.length === 0) {
                const msg = isQuotaDone
                    ? t('vocab.plans.msgNoReviewRecord')
                    : stats.remaining_today === 0
                        ? t('vocab.plans.msgDailyGoalReached').replace('{n}', String(stats.studied_today))
                        : t('vocab.plans.msgNoDueReview');
                showToast(msg, 'success');
                return;
            }

            devLog(`[学习计划] 成功加载 ${cards.length} 个卡片，进入${isQuotaDone ? '复习' : '学习'}`);

            if (studyMode === 'article_copy') {
                navigate(`/vocabulary/plans/${planId}/article-copy`, {
                    state: {
                        planId,
                        planName: plan?.name,
                        planDailyCount: plan?.daily_count,
                        reviewDays: clampArticleReviewDays(plan?.article_review_days ?? articleReviewDays),
                        cards,
                    },
                });
            } else if (studyMode === 'story_mode') {
                navigate(`/vocabulary/plans/${planId}/story`);
            } else {
                navigate('/vocabulary/flashcard/doing', {
                state: {
                    cards,
                    stats,
                    planId: planId,
                    planName: plan?.name,
                    planDailyCount: plan?.daily_count,
                    mode: studyMode,
                    masteryTarget,
                    copyRepetitions: clampCopyRepetitions(plan?.copy_repetitions ?? copyRepetitions),
                    copyReviewDays: clampCopyReviewDays(plan?.copy_review_days ?? copyReviewDays),
                    reviewOnly: isQuotaDone,
                    forceNewSession: studyMode !== 'copy',
                },
            });
            }
        } catch (e: unknown) {
            const error = e as { response?: { status?: number, data?: { error?: string } } };
            const status = error?.response?.status;
            const errorMsg = error?.response?.data?.error;

            console.error(`[学习计划] 开始学习失败 (尝试 ${retryAttempt}/${maxRetries}):`, {
                status,
                errorMsg,
                error,
            });

            let msg = t('vocab.plans.msgStartFail');

            // 根据错误类型提供具体的用户消息
            if (status === 402) {
                msg = t('vocab.details.msgInsufficientAT');
            } else if (status === 400 && errorMsg?.includes('没有单词')) {
                msg = t('vocab.plans.msgEmptyWord');
            } else if (status === 400 && errorMsg?.includes('词汇')) {
                msg = errorMsg;
            } else if (status === 404) {
                msg = t('vocab.details.msgPlanNotFound');
            } else if (status === 409 || status === 422) {
                msg = t('vocab.details.msgPlanConflict');
            } else if (
                [408, 429, 500, 502, 503, 504].includes(status as number) ||
                String(errorMsg).includes('timeout') ||
                String(errorMsg).includes('network')
            ) {
                msg = t('vocab.details.msgNetworkErr').replace('{n}', String(retryAttempt)).replace('{msg}', errorMsg || t('common.error'));
            } else if (errorMsg) {
                msg = errorMsg;
            }

            showToast(msg, 'error');
        } finally {
            setStarting(false);
        }
    };

    // ── Add words ──────────────────────────────────────────────────────────
    const handleAddManual = async () => {
        const word = addWord_.trim().toLowerCase();
        if (!word) { showToast(t('vocab.details.msgWordEmpty'), 'error'); return; }
        if (existingWords.has(word)) { showToast(t('vocab.details.msgDuplicate'), 'error'); return; }
        setAddBusy(true);
        try {
            const r = await addWord(planId, {
                mode: 'manual',
                word,
                zh: addZh.trim(),
                ...(addPhonetic.trim() && { phonetic: addPhonetic.trim() }),
                ...(addGrammar.trim() && { grammar: addGrammar.trim() }),
            });
            if (r.entry) setEntries(prev => [r.entry!, ...prev]);
            setAddWord_(''); setAddZh(''); setAddPhonetic(''); setAddGrammar('');
            // 添加词汇后，清理缓存（队列已改变）
            clearPlanCaches(planId);
            showToast(t('vocab.details.msgAddSuccess'), 'success');
        } catch (e: unknown) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            showToast(status === 409 ? t('vocab.details.msgDuplicate') : t('vocab.details.msgAddFail'), 'error');
        } finally {
            setAddBusy(false);
        }
    };

    const handleBulkImport = async (payload: Parameters<typeof addWord>[1], expectedTotal?: number) => {
        setAddBusy(true);
        try {
            const { entries_added } = await addWord(planId, payload);
            const skipped = expectedTotal !== undefined ? Math.max(0, expectedTotal - entries_added) : 0;
            const msg = skipped > 0
                ? t('vocab.details.msgImportSuccessSkip').replace('{n}', String(entries_added)).replace('{skipped}', String(skipped))
                : t('vocab.details.msgImportSuccess').replace('{n}', String(entries_added));
            showToast(msg, 'success');
            // 导入词汇后，清理缓存（队列已改变）
            clearPlanCaches(planId);
            // Reload word list
            const r = await listPlanWords(planId);
            setEntries(r.entries);
        } catch {
            showToast(t('vocab.details.msgImportFail'), 'error');
        } finally {
            setAddBusy(false);
        }
    };

    // ── AI import: parse pasted text → preview chips → confirm import ────────
    const handleAiParse = async () => {
        const text = aiText.trim();
        if (!text) { showToast(t('vocab.details.aiEmptyInput'), 'error'); return; }
        setAiParsing(true);
        try {
            const { words } = await aiParsePlanWords(planId, text);
            setAiParsed(words ?? []);
            if (!words || words.length === 0) {
                showToast(t('vocab.details.aiNoWords'), 'error');
            }
        } catch {
            showToast(t('vocab.details.aiParseFail'), 'error');
        } finally {
            setAiParsing(false);
        }
    };

    const removeParsedWord = (word: string) => {
        setAiParsed(prev => (prev ? prev.filter(w => w.word !== word) : prev));
    };

    const handleAiImport = async () => {
        if (!aiParsed || aiParsed.length === 0) return;
        setAddBusy(true);
        try {
            const { entries_added } = await addWord(planId, {
                mode: 'ai_list',
                words: aiParsed.map(w => ({ word: w.word, zh: w.zh })),
            });
            showToast(t('vocab.details.msgImportSuccess').replace('{n}', String(entries_added)), 'success');
            clearPlanCaches(planId);
            const r = await listPlanWords(planId);
            setEntries(r.entries);
            setAiText('');
            setAiParsed(null);
        } catch {
            showToast(t('vocab.details.msgImportFail'), 'error');
        } finally {
            setAddBusy(false);
        }
    };

    // ── Word list actions ──────────────────────────────────────────────────
    const handleZhBlur = async (entry: PlanEntry, newZh: string) => {
        if (newZh === entry.zh) return;
        try {
            const { entry: updated } = await updatePlanWord(planId, entry.id, { zh: newZh });
            setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
        } catch {
            showToast(t('vocab.details.msgSaveFail'), 'error');
        }
    };

    const handleDueDays = async (entry: PlanEntry, days: number) => {
        if (isNaN(days) || days < 0) { showToast(t('vocab.details.msgDaysInvalid'), 'error'); return; }
        try {
            const { entry: updated } = await updatePlanWord(planId, entry.id, { next_review_days: days });
            setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
            showToast(t('vocab.details.msgUpdateSuccess'), 'success');
        } catch {
            showToast(t('vocab.details.msgUpdateFail'), 'error');
        }
    };

    const handleRemove = (entry: PlanEntry) => {
        setDeletingEntry(entry);
    };

    const handleDeleteConfirmed = async () => {
        if (!deletingEntry) return;
        try {
            await removePlanWord(planId, deletingEntry.id);
            setEntries(prev => prev.filter(e => e.id !== deletingEntry.id));
            clearPlanCaches(planId);
            showToast(t('vocab.details.msgDeleteSuccess'), 'success');
        } catch {
            showToast(t('vocab.details.msgDeleteFail'), 'error');
        } finally {
            setDeletingEntry(null);
        }
    };

    // ── Filtered + sorted + paginated word list ──────────────────────────────
    const PAGE_SIZE = 50;
    const BOOK_PAGE_SIZE = 20;
    const normalizedSearch = search.trim().toLowerCase();
    const hasSearchText = search.trim().length > 0;
    const searchedDays = parseSearchDays(search);
    const filtered = normalizedSearch
        ? entries.filter(e =>
            e.word.toLowerCase().includes(normalizedSearch) ||
            e.zh.toLowerCase().includes(normalizedSearch) ||
            e.phonetic.toLowerCase().includes(normalizedSearch) ||
            e.grammar.toLowerCase().includes(normalizedSearch) ||
            e.definitions.some(d =>
                d.pos.toLowerCase().includes(normalizedSearch) ||
                d.meaning.toLowerCase().includes(normalizedSearch)
            ) ||
            e.examples.some(ex =>
                ex.en.toLowerCase().includes(normalizedSearch) ||
                ex.zh.toLowerCase().includes(normalizedSearch)
            ) || (
                searchedDays !== null && computeRemainingDays(e.fsrs_due) === searchedDays
            )
        )
        : entries;

    // Apply sorting
    const sorted = useMemo(() => {
        const list = [...filtered];
        if (sortBy === 'alphabetical') {
            list.sort((a, b) => a.word.toLowerCase().localeCompare(b.word.toLowerCase()));
        } else if (sortBy === 'proficiency') {
            list.sort((a, b) => {
                // Sort by FSRS state (lower number = less proficient), then by remaining days
                if (a.fsrs_state !== b.fsrs_state) {
                    return a.fsrs_state - b.fsrs_state;
                }
                return computeRemainingDays(a.fsrs_due) - computeRemainingDays(b.fsrs_due);
            });
        }
        return sortAsc ? list : list.reverse();
    }, [filtered, sortBy, sortAsc]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // Dedup: set of all words already in plan
    const existingWords = useMemo(() => new Set(entries.map(e => e.word)), [entries]);
    const isDuplicateWord = addWord_.trim() !== '' && existingWords.has(addWord_.trim().toLowerCase());

    // 书库单词：前端过滤 + 分页
    const { bookWords_, bookTotal } = useMemo(() => {
        let list = allBookWords;
        if (bookQ.trim()) {
            const q = bookQ.trim().toLowerCase();
            list = list.filter(w =>
                w.word.toLowerCase().includes(q) ||
                w.zh_brief.toLowerCase().includes(q)
            );
        }
        const total = list.length;
        return {
            bookWords_: list.slice((bookPage - 1) * BOOK_PAGE_SIZE, bookPage * BOOK_PAGE_SIZE),
            bookTotal: total,
        };
    }, [allBookWords, bookQ, bookPage, BOOK_PAGE_SIZE]);

    const bookTotalPages = Math.max(1, Math.ceil(bookTotal / BOOK_PAGE_SIZE));

    const handlePageJump = () => {
        const rawValue = pageJumpInput.trim();
        if (!rawValue) {
            showToast(t('vocab.details.toastPageEmpty'), 'error');
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            showToast(t('vocab.details.toastPageRange').replace('{n}', String(totalPages)), 'error');
            return;
        }
        setPage(Math.min(totalPages, Math.max(1, parsed)));
        setPageJumpInput('');
    };

    const handleBookPageJump = () => {
        const rawValue = bookPageJumpInput.trim();
        if (!rawValue) {
            showToast(t('vocab.details.toastPageEmpty'), 'error');
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            showToast(t('vocab.details.toastPageRange').replace('{n}', String(bookTotalPages)), 'error');
            return;
        }
        setBookPage(Math.min(bookTotalPages, Math.max(1, parsed)));
        setBookPageJumpInput('');
    };

    // ── Book word selection helpers ────────────────────────────────────────
    const toggleSelectWord = (wordId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(wordId)) {
                next.delete(wordId);
            } else {
                next.add(wordId);
            }
            return next;
        });
    };

    // ──────────────────────────────────────────────────────────────────────
    return (
        <Layout backUrl="/vocabulary/plans" backText={t('vocab.details.backToVocab')} noPadding={true}>
            <div className="uc-console" style={{ margin: 0, height: 'calc(100vh - 60px)' }}>
                {/* ── Left Pane: Study Modes ── */}
                <div className="uc-sidebar lp-side" style={{ width: leftWidth, flex: 'none', borderRight: 'none', minHeight: 0 }}>
                    {/* ── Plan header (hero) ── */}
                    <div className="lp-card lp-hero">
                        <input
                            className="lp-hero-title"
                            value={planName}
                            maxLength={50}
                            onChange={e => setPlanName(e.target.value)}
                            onBlur={saveName}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                        <div className="lp-hero-daily">
                            <span>{t('vocab.details.dailyPrefix')}</span>
                            <input
                                type="number"
                                min={1} max={200}
                                value={dailyCount}
                                disabled={isTodayConfigLocked}
                                title={isTodayConfigLocked ? t('vocab.details.dailyLockedTip') : ''}
                                onChange={e => setDailyCount(Number(e.target.value))}
                                onBlur={saveDaily}
                                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            />
                            <span>{t('vocab.details.dailySuffix')}</span>
                            {isTodayConfigLocked && (
                                <span className="lp-hero-locked">{t('vocab.details.todayLockedBadge')}</span>
                            )}
                        </div>
                        <button
                            className="uc-console-start-btn lp-hero-start"
                            onClick={handleStart}
                            disabled={starting || entries.length === 0}
                        >
                            {starting ? t('vocab.plans.preparing') : isQuotaDone ? t('vocab.plans.startReview') : t('vocab.plans.startStudy')}
                        </button>
                    </div>

                    {/* ── Study modes + config ── */}
                    <div className="lp-card lp-mode-card">
                        <div className="lp-card-title">{t('vocab.details.studyModeTitle')}</div>
                        <nav className="uc-sidebar-nav lp-mode-nav" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                        {STUDY_MODES.map(([m, labelKey]) => (
                            <button
                                key={m}
                                type="button"
                                className={`uc-nav-item ${studyMode === m ? 'active' : ''}`}
                                onClick={() => {
                                    setStudyMode(m);
                                    localStorage.setItem(`lp_study_mode_${planId}`, m);
                                    updatePlan(planId, { default_mode: m }).catch(() => { });
                                }}
                            >
                                <span className="nav-icon">
                                    {m === 'flashcard' ? '🃏' : m === 'read-aloud' ? '🎙️' : m === 'choice' ? '🎯' : m === 'write' ? '✍️' : m === 'copy' ? '📝' : m === 'article_copy' ? '📄' : '🍿'}
                                </span>
                                <span className="nav-text">{t(`vocab.modes.${labelKey}`)}</span>
                            </button>
                        ))}
                    </nav>

                    <div style={{ padding: '16px' }}>
                        {studyMode === 'copy' && (
                            <div className="uc-settings-list" style={{ padding: 0 }}>
                                <div className="uc-card-group">
                                    <div className="uc-list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div className="uc-row-label" style={{ width: '100%', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#0ea5e9', background: '#e0f2fe' }}>📝</span>
                                                <span className="row-title">{t('vocab.details.copyTimesTitle')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>{t('vocab.details.copyTimesDesc')}</span>
                                        </div>
                                        <div className="uc-row-control" style={{ width: '100%' }}>
                                            <input
                                                type="number"
                                                min={1} max={20}
                                                value={copyRepetitions}
                                                onChange={(e) => setCopyRepetitions(Number(e.target.value))}
                                                onBlur={saveCopyConfig}
                                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                className="console-select"
                                                style={{ width: '100%', paddingLeft: 12 }}
                                            />
                                        </div>
                                    </div>
                                    <div className="uc-list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div className="uc-row-label" style={{ width: '100%', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>📅</span>
                                                <span className="row-title">{t('vocab.details.reviewDaysTitle')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>
                                                {t('vocab.details.copyReviewDesc').replace('{n}', String(copyReviewDays))}
                                                {isTodayConfigLocked && <span style={{ color: 'var(--color-warning)' }}>{t('vocab.details.lockedHint')}</span>}
                                            </span>
                                        </div>
                                        <div className="uc-row-control" style={{ width: '100%' }}>
                                            <input
                                                type="number"
                                                min={0} max={365}
                                                value={copyReviewDays}
                                                disabled={isTodayConfigLocked}
                                                onChange={(e) => setCopyReviewDays(Number(e.target.value))}
                                                onBlur={saveCopyConfig}
                                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                className="console-select"
                                                style={{ width: '100%', paddingLeft: 12 }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {studyMode === 'article_copy' && (
                            <div className="uc-settings-list" style={{ padding: 0 }}>
                                <div className="uc-card-group">
                                    <div className="uc-list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div className="uc-row-label" style={{ width: '100%', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#f59e0b', background: '#fef3c7' }}>📅</span>
                                                <span className="row-title">{t('vocab.details.reviewDaysTitle')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>
                                                {t('vocab.details.articleReviewDesc')}
                                                {isTodayConfigLocked && <span style={{ color: 'var(--color-warning)' }}>{t('vocab.details.lockedHint')}</span>}
                                            </span>
                                        </div>
                                        <div className="uc-row-control" style={{ width: '100%' }}>
                                            <input
                                                type="number"
                                                min={0} max={365}
                                                value={articleReviewDays}
                                                disabled={isTodayConfigLocked}
                                                onChange={(e) => setArticleReviewDays(Number(e.target.value))}
                                                onBlur={saveArticleConfig}
                                                onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                                                className="console-select"
                                                style={{ width: '100%', paddingLeft: 12 }}
                                            />
                                        </div>
                                    </div>
                                    <div className="uc-list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div className="uc-row-label" style={{ width: '100%', marginBottom: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span className="uc-row-icon" style={{ color: '#8b5cf6', background: '#ede9fe' }}>✨</span>
                                                <span className="row-title">{t('vocab.details.regenTitle')}</span>
                                            </div>
                                            <span className="row-desc" style={{ marginLeft: '40px' }}>{t('vocab.details.regenDesc')}</span>
                                        </div>
                                        <div className="uc-row-control" style={{ width: '100%' }}>
                                            <button
                                                type="button"
                                                className="uc-console-start-btn"
                                                style={{ width: '100%', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', border: '1px solid var(--color-border)', padding: '8px 12px', fontSize: 13 }}
                                                disabled={articleRegenerating}
                                                onClick={handleRegenerateArticle}
                                            >
                                                {articleRegenerating ? t('vocab.details.regenning') : t('vocab.details.regenTitle')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
</div>
                    {/* ── Progress + word management ── */}

                {/* ── Today's studied words ── */}
                {plan && (
                    <TodayStudiedSection plan={plan} />
                )}

                {/* ── Add section ── */}
                <div className="lp-add-section">
                    <h4>{t('vocab.details.addWords')}</h4>

                    <div className="lp-add-tabs">
                        {(['manual', 'notebook', 'book', 'ai'] as AddTab[]).map(tab => (
                            <button
                                key={tab}
                                className={`lp-add-tab${addTab === tab ? ' active' : ''}`}
                                onClick={() => setAddTab(tab)}
                            >
                                {tab === 'manual' ? t('vocab.details.tabManual')
                                    : tab === 'notebook' ? t('vocab.details.tabNotebook')
                                    : tab === 'book' ? t('vocab.details.tabBook')
                                    : t('vocab.details.tabAi')}
                            </button>
                        ))}
                    </div>

                    {/* Manual */}
                    {addTab === 'manual' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="lp-add-row">
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type="text"
                                        placeholder={t('vocab.details.manualWord')}
                                        value={addWord_}
                                        onChange={e => setAddWord_(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); }}
                                        className={isDuplicateWord ? 'lp-input-duplicate' : ''}
                                        style={{ width: '100%' }}
                                    />
                                    {isDuplicateWord && (
                                        <span className="lp-duplicate-hint">{t('vocab.details.manualDuplicate')}</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder={t('vocab.details.manualZh')}
                                    value={addZh}
                                    onChange={e => setAddZh(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); }}
                                />
                                <button className="lp-add-btn" onClick={handleAddManual} disabled={addBusy || isDuplicateWord}>
                                    {t('vocab.details.manualAddBtn')}
                                </button>
                            </div>
                            <div className="lp-add-row">
                                <input
                                    type="text"
                                    placeholder={t('vocab.details.manualPhonetic')}
                                    value={addPhonetic}
                                    onChange={e => setAddPhonetic(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder={t('vocab.details.manualGrammar')}
                                    value={addGrammar}
                                    onChange={e => setAddGrammar(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* AI import */}
                    {addTab === 'ai' && (
                        <div className="lp-add-form lp-ai-import">
                            <textarea
                                className="lp-ai-textarea"
                                placeholder={t('vocab.details.aiPlaceholder')}
                                value={aiText}
                                onChange={e => setAiText(e.target.value)}
                                rows={6}
                            />
                            <div className="lp-add-row lp-ai-controls">
                                <span className="lp-ai-model-label">{t('components.aiModel.label')}</span>
                                <AiModelSelector variant="minimal" />
                                <button
                                    className="lp-add-btn"
                                    onClick={handleAiParse}
                                    disabled={aiParsing || !aiText.trim()}
                                >
                                    {aiParsing ? t('vocab.details.aiParsing') : t('vocab.details.aiParseBtn')}
                                </button>
                            </div>

                            {aiParsed && aiParsed.length > 0 && (
                                <div className="lp-ai-result">
                                    <div className="lp-ai-result-head">
                                        <span>{t('vocab.details.aiParsedTitle').replace('{n}', String(aiParsed.length))}</span>
                                        <button className="lp-ai-clear" onClick={() => setAiParsed(null)}>
                                            {t('vocab.details.aiClear')}
                                        </button>
                                    </div>
                                    <div className="lp-ai-chips">
                                        {aiParsed.map(w => (
                                            <span key={w.word} className={`lp-ai-chip${w.exists ? ' lp-ai-chip-exists' : ''}`}>
                                                <span className="lp-ai-chip-word">{w.word}</span>
                                                {w.zh && <span className="lp-ai-chip-zh">{w.zh}</span>}
                                                {w.exists && <span className="lp-ai-chip-tag">{t('vocab.details.aiExistsTag')}</span>}
                                                <button
                                                    className="lp-ai-chip-x"
                                                    onClick={() => removeParsedWord(w.word)}
                                                    aria-label="remove"
                                                >×</button>
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        className="lp-add-btn lp-ai-import-btn"
                                        onClick={handleAiImport}
                                        disabled={addBusy}
                                    >
                                        {t('vocab.details.aiImportBtn').replace('{n}', String(aiParsed.filter(w => !w.exists).length))}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Notebook */}
                    {addTab === 'notebook' && (
                        <div className="lp-add-form">
                            <div className="lp-add-row">
                                <select value={nbId} onChange={e => setNbId(Number(e.target.value))}>
                                    <option value="">{t('vocab.details.nbSelect')}</option>
                                    {notebooks.map(nb => (
                                        <option key={nb.id} value={nb.id}>{nb.title} ({t('vocab.notebooks.cardWordCount').replace('{n}', String(nb.word_count))})</option>
                                    ))}
                                </select>
                                <button
                                    className="lp-add-btn"
                                    disabled={!nbId || addBusy}
                                    onClick={() => handleBulkImport(
                                        { mode: 'notebook', notebook_id: nbId as number },
                                        notebooks.find(nb => nb.id === nbId)?.word_count,
                                    )}
                                >
                                    {addBusy ? t('vocab.details.nbImporting') : t('vocab.details.nbImportAll')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Book */}
                    {addTab === 'book' && (
                        <div className="lp-add-form">
                            <div className="lp-add-row">
                                <select
                                    value={bookId}
                                    onChange={e => {
                                        setBookId(Number(e.target.value));
                                        setBookSubMode('all');
                                        setSelectedIds(new Set());
                                        setBookPage(1);
                                    }}
                                >
                                    <option value="">{t('vocab.details.bookSelect')}</option>
                                    {books.map(b => (
                                        <option key={b.id} value={b.id}>{b.name} ({t('vocab.notebooks.cardWordCount').replace('{n}', String(b.word_count))})</option>
                                    ))}
                                </select>
                            </div>

                            {bookId !== '' && (
                                <>
                                    <div className="lp-add-tabs" style={{ marginTop: 4 }}>
                                        {(['all', 'range', 'select'] as BookSubMode[]).map(m => (
                                            <button
                                                key={m}
                                                className={`lp-add-tab${bookSubMode === m ? ' active' : ''}`}
                                                style={{ fontSize: 12 }}
                                                onClick={() => { setBookSubMode(m); setSelectedIds(new Set()); setBookPage(1); }}
                                            >
                                                {m === 'all' ? t('vocab.details.bookModeAll') : m === 'range' ? t('vocab.details.bookModeRange') : t('vocab.details.bookModeSelect')}
                                            </button>
                                        ))}
                                    </div>

                                    {bookSubMode === 'all' && (
                                        <div className="lp-add-row">
                                            <button
                                                className="lp-add-btn"
                                                disabled={addBusy}
                                                onClick={() => handleBulkImport(
                                                    { mode: 'book_all', book_id: bookId as number },
                                                    books.find(b => b.id === bookId)?.word_count,
                                                )}
                                            >
                                                {addBusy ? t('vocab.details.nbImporting') : t('vocab.details.bookModeAll')}
                                            </button>
                                        </div>
                                    )}

                                    {bookSubMode === 'range' && (
                                        <div className="lp-add-row">
                                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                {t('vocab.details.bookRangeIdx')}
                                            </span>
                                            <input
                                                type="number" min={1} value={rangeStart}
                                                onChange={e => setRangeStart(Number(e.target.value))}
                                                style={{ maxWidth: 80 }}
                                            />
                                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>~</span>
                                            <input
                                                type="number" min={1} value={rangeEnd}
                                                onChange={e => setRangeEnd(Number(e.target.value))}
                                                style={{ maxWidth: 80 }}
                                            />
                                            <button
                                                className="lp-add-btn"
                                                disabled={addBusy}
                                                onClick={() => handleBulkImport({
                                                    mode: 'book_range',
                                                    book_id: bookId as number,
                                                    start: rangeStart,
                                                    end: rangeEnd,
                                                }, Math.max(0, rangeEnd - rangeStart + 1))}
                                            >
                                                {addBusy ? t('vocab.details.nbImporting') : t('vocab.details.bookModeRange')}
                                            </button>
                                        </div>
                                    )}

                                    {bookSubMode === 'select' && (
                                        <>
                                            <div className="lp-add-row">
                                                <input
                                                    type="text"
                                                    placeholder={t('vocab.notebookDetail.searchPlaceholder')}
                                                    value={bookQ}
                                                    onChange={e => { setBookQ(e.target.value); setBookPage(1); }}
                                                />
                                                <button
                                                    className="lp-add-btn"
                                                    disabled={addBusy || selectedIds.size === 0}
                                                    onClick={() => {
                                                        handleBulkImport({
                                                            mode: 'book_select',
                                                            book_id: bookId as number,
                                                            word_ids: Array.from(selectedIds),
                                                        }, selectedIds.size);
                                                        setSelectedIds(new Set());
                                                    }}
                                                >
                                                    {addBusy ? t('vocab.details.nbImporting') : t('vocab.details.bookImportSelected').replace('{n}', String(selectedIds.size))}
                                                </button>
                                            </div>
                                            <div className="lp-book-browser">
                                                {bookWords_.map(w => (
                                                    <div
                                                        key={w.id}
                                                        className="lp-book-word-row"
                                                        onClick={() => toggleSelectWord(w.id)}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(w.id)}
                                                            onChange={() => toggleSelectWord(w.id)}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <span className="bw-word">{w.word}</span>
                                                        {w.phonetic && (
                                                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                                                {w.phonetic}
                                                            </span>
                                                        )}
                                                        <span className="bw-zh">{w.zh_brief}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="lp-book-pager">
                                                <button disabled={bookPage <= 1} onClick={() => setBookPage(p => p - 1)}>{t('vocab.details.bookPrevPage')}</button>
                                                <span>{bookPage} / {bookTotalPages}</span>
                                                <button
                                                    disabled={bookPage >= bookTotalPages}
                                                    onClick={() => setBookPage(p => p + 1)}
                                                >
                                                    {t('vocab.details.bookNextPage')}
                                                </button>
                                                <div className="lp-page-jump">
                                                    <span>{t('vocab.details.jumpTo')}</span>
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={bookPageJumpInput}
                                                        onChange={e => {
                                                            const next = e.target.value;
                                                            if (next === '' || /^\d+$/.test(next)) {
                                                                setBookPageJumpInput(next);
                                                            }
                                                        }}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleBookPageJump(); }}
                                                        placeholder={t('vocab.details.pagePlaceholder')}
                                                        aria-label={t('vocab.details.jumpAria')}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleBookPageJump}
                                                        disabled={!bookPageJumpInput.trim()}
                                                    >
                                                        GO
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
                </div>
                {/* ── Resizer ── */}
                <div 
                    onMouseDown={handleMouseDown}
                    style={{ 
                        width: 4, 
                        cursor: 'col-resize', 
                        backgroundColor: 'transparent', 
                        zIndex: 10,
                        borderLeft: '1px solid var(--color-border)',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                />

                {/* ── Right Pane: Main List ── */}
                <div className="uc-main-content lp-main" style={{ flex: 1, minWidth: 400, borderLeft: 'none', overflowY: 'hidden', minHeight: 0 }}>
                                    {/* ── Word list ── */}
                <div className="lp-word-section">
                    <div className="lp-word-section-header">
                        
                    <h4 dangerouslySetInnerHTML={{ __html: sanitize(t('vocab.details.listTitle')
                        .replace('{learned}', String(entries.filter(e => e.fsrs_state !== 0).length))
                        .replace('{total}', String(entries.length)))
                    }} />

                        <div className="lp-sort-controls">
                            <select
                                className="lp-sort-select"
                                value={sortBy}
                                onChange={e => {
                                    setSortBy(e.target.value as 'default' | 'alphabetical' | 'proficiency');
                                    setPage(1);
                                }}
                            >
                                <option value="default">{t('vocab.details.sortDefault')}</option>
                                <option value="alphabetical">{t('vocab.details.sortAlpha')}</option>
                                <option value="proficiency">{t('vocab.details.sortProf')}</option>
                            </select>
                            {sortBy !== 'default' && (
                                <button
                                    className="lp-sort-direction"
                                    onClick={() => setSortAsc(!sortAsc)}
                                    title={sortAsc ? t('vocab.details.sortDesc') : t('vocab.details.sortAsc')}
                                >
                                    {sortAsc ? '↑' : '↓'}
                                </button>
                            )}
                        </div>
                        <input
                            className="lp-search"
                            type="text"
                            placeholder={`${t('vocab.details.listSearch')}${t('vocab.details.searchEg')}`}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                        {hasSearchText && (
                            <div className="lp-search-result-count">
                                {t('vocab.details.searchResult').replace('{n}', String(filtered.length))}
                            </div>
                        )}
                    </div>

                    {loading ? (
                        <div className="lp-empty">{t('common.loading')}</div>
                    ) : filtered.length === 0 ? (
                        <div className="lp-empty">
                            {search ? t('vocab.details.listNoMatch') : t('vocab.details.listEmpty')}
                        </div>
                    ) : (
                        <>
                            <div className="lp-word-list">
                                {paged.map(entry => (
                                    <PlanWordRow
                                        key={entry.id}
                                        entry={entry}
                                        onZhChange={handleZhBlur}
                                        onDueDays={handleDueDays}
                                        onRemove={handleRemove}
                                    />
                                ))}
                            </div>
                            {totalPages > 1 && (
                                <div className="lp-pager">
                                    <button
                                        className="lp-page-btn"
                                        disabled={safePage <= 1}
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                    >
                                        {t('vocab.details.prevPage')}
                                    </button>
                                    <span className="lp-page-info">
                                        {t('vocab.details.pageInfo').replace('{page}', String(safePage)).replace('{total}', String(totalPages)).replace('{n}', String(filtered.length))}
                                    </span>
                                    <button
                                        className="lp-page-btn"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        {t('vocab.details.nextPage')}
                                    </button>
                                    <div className="lp-page-jump">
                                        <span>{t('vocab.details.jumpTo')}</span>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={pageJumpInput}
                                            onChange={e => {
                                                const next = e.target.value;
                                                if (next === '' || /^\d+$/.test(next)) {
                                                    setPageJumpInput(next);
                                                }
                                            }}
                                            onKeyDown={e => { if (e.key === 'Enter') handlePageJump(); }}
                                            placeholder={t('vocab.details.pagePlaceholder')}
                                            aria-label={t('vocab.details.jumpAria')}
                                        />
                                        <button
                                            type="button"
                                            onClick={handlePageJump}
                                            disabled={!pageJumpInput.trim()}
                                        >
                                            GO
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                </div>

            </div>

            <ConfirmDialog
                open={deletingEntry !== null}
                title={t('vocab.details.confirmDeleteTitle')}
                message={t('vocab.details.msgDeleteConfirm').replace('{word}', deletingEntry?.word ?? '')}
                variant="danger"
                onConfirm={handleDeleteConfirmed}
                onCancel={() => setDeletingEntry(null)}
            />
        </Layout>
    );
}
