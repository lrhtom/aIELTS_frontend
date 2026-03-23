import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { retryWithBackoff } from '../../utils/retry';
import { listNotebooks, type Notebook } from '../../api/notebook';
import {
    listPlanWords, addWord, updatePlanWord, removePlanWord,
    updatePlan, startPlan,
    listVocabBooks, listBookWords,
    type LearningPlan, type PlanEntry, type VocabBook, type BookWord,
} from '../../api/learning_plan';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_learning_plan.css';

const FSRS_STATE_LABEL: Record<number, string> = {
    0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning',
};
const FSRS_STATE_CLASS: Record<number, string> = {
    0: 'state-new', 1: 'state-learning', 2: 'state-review', 3: 'state-relearning',
};

type AddTab = 'manual' | 'notebook' | 'book';
type BookSubMode = 'all' | 'range' | 'select';
type StudyMode = 'flashcard' | 'choice' | 'write';
type MasterySetting = 'auto' | number;

const STUDY_MODES: [StudyMode, string][] = [
    ['flashcard', '记忆卡'],
    ['choice',    '4选1'],
    ['write',     '看中文写英文'],
];

/**
 * 清理与计划相关的所有浏览器缓存
 * 当用户修改学习计划时调用，防止缓存数据与数据库不同步导致的模式失败
 */
function clearPlanCaches(planId: number): void {
    console.log('[计划缓存] 开始清理缓存...', { planId });
    
    // 1. 清理 sessionStorage（会话级别）
    const sessionKeys = [
        'vocab_flashcard_session',           // 词汇学习主会话
        'reading_session_cache',              // 阅读会话缓存
        'listening_session_cache',            // 听力会话缓存
        'vocab_doing_session_mcq',            // 词汇训练 - 4选1
        'vocab_doing_session_dictation',      // 词汇训练 - 听写
        'vocab_doing_session_complete',       // 词汇训练 - 补全
    ];
    
    sessionKeys.forEach(key => {
        if (sessionStorage.getItem(key)) {
            sessionStorage.removeItem(key);
            console.log('[计划缓存] 已清理 sessionStorage:', key);
        }
    });
    
    // 2. 清理与此计划相关的 localStorage 数据
    // ⚠️ 注意：这里保留 mode 和 masteryTarget，因为这是用户的偏好设置
    // 如果要强制重置，可以取消注释下面的代码
    // localStorage.removeItem(`lp_study_mode_${planId}`);
    // localStorage.removeItem(`lp_mastery_target_${planId}`);
    
    console.log('[计划缓存] 缓存清理完成', { planId, timestamp: new Date().toISOString() });
}

export default function LearningPlanDetailPage() {
    const { id } = useParams<{ id: string }>();
    const planId  = Number(id);
    const navigate = useNavigate();

    // Plan meta
    const [plan,        setPlan]        = useState<LearningPlan | null>(null);
    const [planName,    setPlanName]    = useState('');
    const [dailyCount,  setDailyCount]  = useState(20);

    // Word list
    const [entries,     setEntries]     = useState<PlanEntry[]>([]);
    const [search,      setSearch]      = useState('');
    const [loading,     setLoading]     = useState(true);
    const [page,        setPage]        = useState(1);
    const [sortBy,      setSortBy]      = useState<'default' | 'alphabetical' | 'proficiency'>('default');
    const [sortAsc,     setSortAsc]     = useState(true);

    // Starting session
    const [starting,    setStarting]    = useState(false);
    const [studyMode,   setStudyMode]   = useState<StudyMode>(
        () => (localStorage.getItem(`lp_study_mode_${planId}`) as StudyMode) || 'flashcard'
    );
    const [masteryTarget, setMasteryTarget] = useState<MasterySetting>(() => {
        const raw = localStorage.getItem(`lp_mastery_target_${planId}`) ?? '2';
        if (raw === 'auto') return 'auto';
        const v = Number(raw);
        return Number.isFinite(v) ? Math.min(5, Math.max(1, v)) : 2;
    });

    // Add section
    const [addTab,      setAddTab]      = useState<AddTab>('manual');
    const [addWord_,    setAddWord_]    = useState('');
    const [addZh,       setAddZh]       = useState('');
    const [addPhonetic, setAddPhonetic] = useState('');
    const [addGrammar,  setAddGrammar]  = useState('');
    const [addBusy,     setAddBusy]     = useState(false);

    // Notebook tab
    const [notebooks,   setNotebooks]   = useState<Notebook[]>([]);
    const [nbId,        setNbId]        = useState<number | ''>('');

    // Book tab
    const [books,       setBooks]       = useState<VocabBook[]>([]);
    const [bookId,      setBookId]      = useState<number | ''>('');
    const [bookSubMode, setBookSubMode] = useState<BookSubMode>('all');
    const [rangeStart,  setRangeStart]  = useState(1);
    const [rangeEnd,    setRangeEnd]    = useState(50);
    const [allBookWords,  setAllBookWords]  = useState<BookWord[]>([]);
    const [bookPage,      setBookPage]      = useState(1);
    const [bookQ,         setBookQ]         = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // ── Load plan + words ──────────────────────────────────────────────────
    useEffect(() => {
        Promise.all([
            listPlanWords(planId),
        ])
            .then(([r]) => {
                setEntries(r.entries);
            })
            .catch(() => showToast('加载计划失败', 'error'))
            .finally(() => setLoading(false));
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
            }).catch(() => {});
        });
    }, [planId]);

    // Load notebooks + books on first render
    useEffect(() => {
        listNotebooks().then(r => setNotebooks(r.notebooks)).catch(() => {});
        listVocabBooks().then(r => setBooks(r.books)).catch(() => {});
    }, []);

    // Load all book words (client-side search/pagination)
    useEffect(() => {
        if (bookSubMode !== 'select' || !bookId) return;
        setAllBookWords([]);
        setBookPage(1);
        listBookWords(bookId as number, 1, 5000).then(r => {
            setAllBookWords(r.words);
        }).catch(() => {});
    }, [bookId, bookSubMode]);

    useEffect(() => {
        localStorage.setItem(`lp_mastery_target_${planId}`, String(masteryTarget));
    }, [planId, masteryTarget]);

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
            showToast('计划名称已保存', 'success');
        } catch {
            showToast('保存失败', 'error');
            setPlanName(plan.name);
        }
    }, [planName, plan, planId]);

    const saveDaily = useCallback(async () => {
        if (!plan || dailyCount === plan.daily_count) return;
        if (dailyCount < 1 || dailyCount > 200) { showToast('每日词数需在 1-200 之间', 'error'); return; }
        try {
            const { plan: p } = await updatePlan(planId, { daily_count: dailyCount });
            setPlan(p);
            // 修改daily_count成功后，使用完整的缓存清理函数
            // 这样下次进入学习页面时，会使用新的daily_count重新构建队列
            clearPlanCaches(planId);
            showToast('每日词数已使用新配置保存', 'success');
        } catch {
            showToast('保存失败', 'error');
            setDailyCount(plan.daily_count);
        }
    }, [dailyCount, plan, planId]);

    // ── Start session ──────────────────────────────────────────────────────
    const isQuotaDone = plan ? plan.studied_today >= plan.daily_count : false;

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
                            console.log(`[学习计划] 开始学习 - 重试 ${attempt}/${maxRetries}`);
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
                    ? '今日还没有学习记录，无法复习'
                    : stats.remaining_today === 0
                        ? `今日已学习 ${stats.studied_today} 词，完成每日目标！`
                        : '今日没有需要复习的单词';
                showToast(msg, 'success');
                return;
            }

            console.log(`[学习计划] 成功加载 ${cards.length} 个卡片，进入${isQuotaDone ? '复习' : '学习'}`);
            navigate('/vocabulary/flashcard/doing', {
                state: {
                    cards,
                    stats,
                    planId: planId,
                    planName: plan?.name,
                    planDailyCount: plan?.daily_count,
                    mode: studyMode,
                    masteryTarget,
                    reviewOnly: isQuotaDone,
                    forceNewSession: true,
                },
            });
        } catch (e: unknown) {
            const error = e as any;
            const status = error?.response?.status;
            const errorMsg = error?.response?.data?.error;
            
            console.error(`[学习计划] 开始学习失败 (尝试 ${retryAttempt}/${maxRetries}):`, {
                status,
                errorMsg,
                error,
            });

            let msg = '开始失败';
            
            // 根据错误类型提供具体的用户消息
            if (status === 402) {
                msg = 'AT币余额不足，请充值后重试';
            } else if (status === 400 && errorMsg?.includes('没有单词')) {
                msg = '计划中没有单词，请先添加';
            } else if (status === 400 && errorMsg?.includes('词汇')) {
                msg = errorMsg;
            } else if (status === 404) {
                msg = '计划不存在，请刷新后重试';
            } else if (status === 409 || status === 422) {
                msg = '计划配置冲突，请刷新后重试';
            } else if (
                [408, 429, 500, 502, 503, 504].includes(status) ||
                String(errorMsg).includes('timeout') ||
                String(errorMsg).includes('network')
            ) {
                msg = `网络错误，已尝试 ${retryAttempt} 次 - ${errorMsg || '请检查网络后重试'}`;
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
        if (!word) { showToast('单词不能为空', 'error'); return; }
        if (existingWords.has(word)) { showToast('该单词已在计划中', 'error'); return; }
        setAddBusy(true);
        try {
            const r = await addWord(planId, {
                mode: 'manual',
                word,
                zh: addZh.trim(),
                ...(addPhonetic.trim() && { phonetic: addPhonetic.trim() }),
                ...(addGrammar.trim()  && { grammar:  addGrammar.trim()  }),
            });
            if (r.entry) setEntries(prev => [r.entry!, ...prev]);
            setAddWord_(''); setAddZh(''); setAddPhonetic(''); setAddGrammar('');
            // 添加词汇后，清理缓存（队列已改变）
            clearPlanCaches(planId);
            showToast('已添加', 'success');
        } catch (e: unknown) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            showToast(status === 409 ? '该单词已在计划中' : '添加失败', 'error');
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
                ? `已导入 ${entries_added} 个，跳过 ${skipped} 个重复单词`
                : `已导入 ${entries_added} 个单词`;
            showToast(msg, 'success');
            // 导入词汇后，清理缓存（队列已改变）
            clearPlanCaches(planId);
            // Reload word list
            const r = await listPlanWords(planId);
            setEntries(r.entries);
        } catch {
            showToast('导入失败', 'error');
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
            showToast('保存失败', 'error');
        }
    };

    const handleDueDays = async (entry: PlanEntry, days: number) => {
        if (isNaN(days) || days < 0) { showToast('天数需为非负整数', 'error'); return; }
        try {
            const { entry: updated } = await updatePlanWord(planId, entry.id, { next_review_days: days });
            setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
            showToast('复习日期已更新', 'success');
        } catch {
            showToast('更新失败', 'error');
        }
    };

    const handleRemove = async (entry: PlanEntry) => {
        if (!confirm(`从计划中删除"${entry.word}"？`)) return;
        try {
            await removePlanWord(planId, entry.id);
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            // 删除词汇后，清理缓存（队列已改变）
            clearPlanCaches(planId);
            showToast('已删除', 'success');
        } catch {
            showToast('删除失败', 'error');
        }
    };

    // ── Filtered + sorted + paginated word list ──────────────────────────────
    const PAGE_SIZE = 50;
    const normalizedSearch = search.trim().toLowerCase();
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
                // Sort by FSRS state (lower number = less proficient), then by scheduled days
                if (a.fsrs_state !== b.fsrs_state) {
                    return a.fsrs_state - b.fsrs_state;
                }
                return a.fsrs_scheduled_days - b.fsrs_scheduled_days;
            });
        }
        return sortAsc ? list : list.reverse();
    }, [filtered, sortBy, sortAsc]);
    
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const paged      = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // Dedup: set of all words already in plan
    const existingWords   = useMemo(() => new Set(entries.map(e => e.word)), [entries]);
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
        const PAGE_SIZE = 20;
        return {
            bookWords_: list.slice((bookPage - 1) * PAGE_SIZE, bookPage * PAGE_SIZE),
            bookTotal:  total,
        };
    }, [allBookWords, bookQ, bookPage]);

    // ── Book word selection helpers ────────────────────────────────────────
    const toggleSelectWord = (wordId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(wordId) ? next.delete(wordId) : next.add(wordId);
            return next;
        });
    };

    // ──────────────────────────────────────────────────────────────────────
    return (
        <Layout>
            <div className="config-page-wrap">
                {/* ── Header ── */}
                <div className="lp-detail-header">
                    <button className="btn" style={{ marginRight: 4 }} onClick={() => navigate('/vocabulary/plans')}>
                        ← 返回
                    </button>
                    <input
                        className="lp-name-input"
                        value={planName}
                        maxLength={50}
                        onChange={e => setPlanName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    />
                    <div className="lp-daily-wrap">
                        每日
                        <input
                            type="number"
                            min={1} max={200}
                            value={dailyCount}
                            onChange={e => setDailyCount(Number(e.target.value))}
                            onBlur={saveDaily}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        />
                        词
                    </div>
                    <button
                        className="lp-start-btn"
                        onClick={handleStart}
                        disabled={starting || entries.length === 0}
                    >
                        {starting ? '准备中…' : isQuotaDone ? '📖 开始复习' : '开始学习'}
                    </button>
                </div>

                {/* ── Study mode selector ── */}
                <div className="lp-mode-selector">
                    <span className="lp-mode-selector-label">学习模式：</span>
                    <div className="lp-mode-tabs">
                        {STUDY_MODES.map(([m, label]) => (
                            <button
                                key={m}
                                className={`lp-mode-tab${studyMode === m ? ' active' : ''}`}
                                onClick={() => {
                                    setStudyMode(m);
                                    localStorage.setItem(`lp_study_mode_${planId}`, m);
                                    updatePlan(planId, { default_mode: m }).catch(() => {});
                                }}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="lp-mode-selector-label">连续正确：</span>
                        <select
                            value={masteryTarget}
                            onChange={(e) => {
                                const value = e.target.value;
                                let targetToSave: number | undefined;
                                if (value === 'auto') {
                                    setMasteryTarget('auto');
                                    // Handle backend save logic? If 'auto', maybe save 2 as fallback or another special value
                                    // Alternatively backend's mastery_target might be 0 for auto?
                                    // For now, if auto, maybe we save 2? The user spec didn't mention 'auto' backend rep.
                                    // Let's not save 'auto' directly if it's integer field.
                                    // Wait, backend explicitly parses mastery_target > 0, so we can't save 'auto'.
                                } else {
                                    const val = Math.min(5, Math.max(1, Number(value) || 2));
                                    setMasteryTarget(val);
                                    targetToSave = val;
                                }
                                localStorage.setItem(`lp_mastery_target_${planId}`, value);
                                if (targetToSave) {
                                    updatePlan(planId, { mastery_target: targetToSave }).catch(() => {});
                                }
                            }}
                        >
                            <option value="auto">自动</option>
                            {[1, 2, 3, 4, 5].map(n => (
                                <option key={n} value={n}>{n}次</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Today's studied words ── */}
                {plan && (
                    <TodayStudiedSection plan={plan} />
                )}

                {/* ── Add section ── */}
                <div className="lp-add-section">
                    <h4>添加单词</h4>

                    <div className="lp-add-tabs">
                        {(['manual', 'notebook', 'book'] as AddTab[]).map(t => (
                            <button
                                key={t}
                                className={`lp-add-tab${addTab === t ? ' active' : ''}`}
                                onClick={() => setAddTab(t)}
                            >
                                {t === 'manual' ? '手动输入' : t === 'notebook' ? '从笔记本' : '从词书'}
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
                                        placeholder="英文单词"
                                        value={addWord_}
                                        onChange={e => setAddWord_(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); }}
                                        className={isDuplicateWord ? 'lp-input-duplicate' : ''}
                                        style={{ width: '100%' }}
                                    />
                                    {isDuplicateWord && (
                                        <span className="lp-duplicate-hint">已在计划中</span>
                                    )}
                                </div>
                                <input
                                    type="text"
                                    placeholder="中文释义（可选）"
                                    value={addZh}
                                    onChange={e => setAddZh(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleAddManual(); }}
                                />
                                <button className="lp-add-btn" onClick={handleAddManual} disabled={addBusy || isDuplicateWord}>
                                    添加
                                </button>
                            </div>
                            <div className="lp-add-row">
                                <input
                                    type="text"
                                    placeholder="音标（可选）e.g. /əˈbændən/"
                                    value={addPhonetic}
                                    onChange={e => setAddPhonetic(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="词性（可选）e.g. v. / n. adj."
                                    value={addGrammar}
                                    onChange={e => setAddGrammar(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Notebook */}
                    {addTab === 'notebook' && (
                        <div className="lp-add-form">
                            <div className="lp-add-row">
                                <select value={nbId} onChange={e => setNbId(Number(e.target.value))}>
                                    <option value="">— 选择笔记本 —</option>
                                    {notebooks.map(nb => (
                                        <option key={nb.id} value={nb.id}>{nb.title}（{nb.word_count} 词）</option>
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
                                    {addBusy ? '导入中…' : '全部导入'}
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
                                    <option value="">— 选择词书 —</option>
                                    {books.map(b => (
                                        <option key={b.id} value={b.id}>{b.name}（{b.word_count} 词）</option>
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
                                                {m === 'all' ? '整本导入' : m === 'range' ? '范围导入' : '勾选导入'}
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
                                                {addBusy ? '导入中…' : '整本导入'}
                                            </button>
                                        </div>
                                    )}

                                    {bookSubMode === 'range' && (
                                        <div className="lp-add-row">
                                            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                                序号
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
                                                {addBusy ? '导入中…' : '范围导入'}
                                            </button>
                                        </div>
                                    )}

                                    {bookSubMode === 'select' && (
                                        <>
                                            <div className="lp-add-row">
                                                <input
                                                    type="text"
                                                    placeholder="搜索单词…"
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
                                                    {addBusy ? '导入中…' : `导入已选（${selectedIds.size}）`}
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
                                                <button disabled={bookPage <= 1} onClick={() => setBookPage(p => p - 1)}>上一页</button>
                                                <span>{bookPage} / {Math.max(1, Math.ceil(bookTotal / 20))}</span>
                                                <button
                                                    disabled={bookPage >= Math.ceil(bookTotal / 20)}
                                                    onClick={() => setBookPage(p => p + 1)}
                                                >
                                                    下一页
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Word list ── */}
                <div className="lp-word-section">
                    <div className="lp-word-section-header">
                        <h4>词表（{entries.length}）</h4>
                        <div className="lp-sort-controls">
                            <select
                                className="lp-sort-select"
                                value={sortBy}
                                onChange={e => {
                                    setSortBy(e.target.value as 'default' | 'alphabetical' | 'proficiency');
                                    setPage(1);
                                }}
                            >
                                <option value="default">默认</option>
                                <option value="alphabetical">英文字典序</option>
                                <option value="proficiency">熟练度</option>
                            </select>
                            {sortBy !== 'default' && (
                                <button
                                    className="lp-sort-direction"
                                    onClick={() => setSortAsc(!sortAsc)}
                                    title={sortAsc ? '倒序' : '正序'}
                                >
                                    {sortAsc ? '↑' : '↓'}
                                </button>
                            )}
                        </div>
                        <input
                            className="lp-search"
                            type="text"
                            placeholder="搜索单词或释义…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="lp-empty">加载中…</div>
                    ) : filtered.length === 0 ? (
                        <div className="lp-empty">
                            {search ? '没有匹配的单词' : '还没有单词，请先添加'}
                        </div>
                    ) : (
                        <>
                            <div className="lp-word-list">
                                {paged.map(entry => (
                                    <WordRow
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
                                        ← 上一页
                                    </button>
                                    <span className="lp-page-info">
                                        第 {safePage} / {totalPages} 页
                                        &nbsp;·&nbsp;共 {filtered.length} 词
                                    </span>
                                    <button
                                        className="lp-page-btn"
                                        disabled={safePage >= totalPages}
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    >
                                        下一页 →
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}

/* ── Word row sub-component ──────────────────────────────────────────────── */
interface WordRowProps {
    entry:      PlanEntry;
    onZhChange: (entry: PlanEntry, zh: string) => void;
    onDueDays:  (entry: PlanEntry, days: number) => void;
    onRemove:   (entry: PlanEntry) => void;
}

function WordRow({ entry, onZhChange, onDueDays, onRemove }: WordRowProps) {
    const [zh,              setZh]              = useState(entry.zh);
    const [days,            setDays]            = useState(entry.fsrs_scheduled_days);
    const [showExamples,    setShowExamples]    = useState(false);

    // Sync when entry updates externally (e.g. after PATCH response)
    useEffect(() => { setZh(entry.zh); },                  [entry.zh]);
    useEffect(() => { setDays(entry.fsrs_scheduled_days); }, [entry.fsrs_scheduled_days]);

    const hasEnrichment = entry.grammar || entry.definitions.length > 0 || entry.examples.length > 0;

    return (
        <div className="lp-word-item">
            <div className="lp-word-text">
                {entry.word}
                {entry.phonetic && (
                    <span className="lp-word-phonetic">{entry.phonetic}</span>
                )}
            </div>

            <input
                className="lp-zh-input"
                value={zh}
                onChange={e => setZh(e.target.value)}
                onBlur={() => onZhChange(entry, zh)}
                onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                placeholder="中文释义"
            />

            <span className={`lp-fsrs-badge ${FSRS_STATE_CLASS[entry.fsrs_state] ?? 'state-new'}`}>
                {FSRS_STATE_LABEL[entry.fsrs_state] ?? 'New'}
            </span>

            <div className="lp-due-wrap">
                <input
                    className="lp-due-input"
                    type="number"
                    min={0}
                    value={days}
                    onChange={e => setDays(Number(e.target.value))}
                    onBlur={() => onDueDays(entry, days)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    title="设置几天后复习"
                />
                天后
            </div>

            <button className="lp-del-btn" onClick={() => onRemove(entry)} title="从计划删除">
                ✕
            </button>

            {hasEnrichment && (
                <div className="lp-word-extra">
                    {entry.grammar && (
                        <span className="lp-grammar-badge">{entry.grammar}</span>
                    )}
                    {entry.definitions.length > 0 && (
                        <div className="lp-def-list">
                            {entry.definitions.map((d, i) => (
                                <div key={i} className="lp-def-item">
                                    {d.pos && <span className="lp-def-pos">{d.pos}</span>}
                                    <span>{d.meaning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {entry.examples.length > 0 && (
                        <button
                            className="lp-example-toggle"
                            onClick={() => setShowExamples(v => !v)}
                        >
                            {showExamples ? '收起例句' : `查看例句 (${entry.examples.length})`}
                        </button>
                    )}
                </div>
            )}
            {showExamples && entry.examples.length > 0 && (
                <div className="lp-example-list">
                    {entry.examples.map((ex, i) => (
                        <div key={i}>
                            <div className="lp-example-en">{ex.en}</div>
                            {ex.zh && <div className="lp-example-zh">{ex.zh}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ── Today studied section sub-component ─────────────────────────────────── */
function TodayStudiedSection({ plan }: { plan: LearningPlan }) {
    const [expanded, setExpanded] = useState(false);
    const pct = Math.min(100, Math.round((plan.studied_today / plan.daily_count) * 100));

    return (
        <div className="lp-today-section">
            <div className="lp-today-header" onClick={() => setExpanded(v => !v)}>
                <div className="lp-today-title">
                    <span className="lp-today-icon">📋</span>
                    今日学习计划（已掌握 <strong>{plan.studied_today}</strong> / {plan.daily_count}）
                    <span className="lp-today-pct">{pct}%</span>
                </div>
                <span className={`lp-today-toggle ${expanded ? 'open' : ''}`}>▾</span>
            </div>
            <div className="lp-today-progress">
                <div className="lp-today-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            {expanded && (
                <div className="lp-today-list">
                    {plan.today_words.map((tw, i) => (
                        <div key={i} className="lp-today-word-row">
                            <span className="lp-today-word">{tw.word}</span>
                            {tw.phonetic && (
                                <span className="lp-today-phonetic">{tw.phonetic}</span>
                            )}
                            <span className="lp-today-zh">{tw.zh}</span>
                            <span className={`lp-fsrs-badge ${FSRS_STATE_CLASS[tw.state] ?? 'state-new'}`}>
                                {FSRS_STATE_LABEL[tw.state] ?? 'New'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
