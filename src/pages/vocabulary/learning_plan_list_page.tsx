import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
    listPlans, createPlan, deletePlan, startPlan,
    type LearningPlan,
} from '../../api/learning_plan';
import {
    createCustomDeck,
    listCustomDecks,
    startCustomDeck,
    type CustomMemoryDeck,
} from '../../api/custom_memory';
import { useLang } from '../../i18n/LanguageContext';
import { sanitize } from '../../utils/safe_html';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_learning_plan_list.css';

const MAX_PLANS = 3;

function getPlanTodayTarget(plan: LearningPlan): number {
    return Math.max(plan.studied_today, plan.today_target ?? plan.daily_count);
}

function shouldStartReview(plan: LearningPlan): boolean {
    const todayTarget = getPlanTodayTarget(plan);
    return !!plan.has_activity_today && todayTarget > 0 && plan.studied_today >= todayTarget;
}

function getCustomTodayTarget(deck: CustomMemoryDeck): number {
    return Math.max(deck.studied_today, deck.today_target ?? Math.min(deck.daily_count, deck.card_count));
}

function shouldStartCustomReview(deck: CustomMemoryDeck): boolean {
    const todayTarget = getCustomTodayTarget(deck);
    return !!deck.has_activity_today && todayTarget > 0 && deck.studied_today >= todayTarget;
}

interface CreateModal {
    name:        string;
    daily_count: number;
    entry_mode:  'word' | 'custom';
}

function buildDefaultPlanName() {
    const now = new Date();
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return `学习计划 ${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

export default function LearningPlanListPage() {
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [plans,    setPlans]    = useState<LearningPlan[]>([]);
    const [customDecks, setCustomDecks] = useState<CustomMemoryDeck[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [modal,    setModal]    = useState<CreateModal | null>(null);
    const [saving,   setSaving]   = useState(false);
    const [starting, setStarting] = useState<number | null>(null);
    const [startingCustom, setStartingCustom] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'plans' | 'custom'>('plans');

    useEffect(() => {
        const loadAll = async () => {
            const [planRes, customRes] = await Promise.allSettled([listPlans(), listCustomDecks()]);

            if (planRes.status === 'fulfilled') {
                setPlans(planRes.value.plans);
            } else {
                showToast(t.vocab.plans.msgLoadFail, 'error');
            }

            if (customRes.status === 'fulfilled') {
                setCustomDecks(customRes.value.decks);
            }

            setLoading(false);
        };

        loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── create ── */
    const handleCreate = async () => {
        if (!modal) return;

        if (modal.daily_count < 1 || modal.daily_count > 200) {
            showToast(t.vocab.plans.msgDailyRange, 'error'); return;
        }

        if (modal.entry_mode === 'custom') {
            const customName = modal.name.trim();
            if (!customName) { showToast(t.vocab.plans.msgNameRequired, 'error'); return; }

            setSaving(true);
            try {
                const { deck } = await createCustomDeck(customName, '', modal.daily_count);
                setCustomDecks(prev => [deck, ...prev]);
                setModal(null);
                showToast('已同步到后端', 'success');
            } catch (e: unknown) {
                const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '同步失败，请稍后再试';
                showToast(msg, 'error');
            } finally {
                setSaving(false);
            }

            return;
        }

        if (!user?.is_staff && plans.length >= MAX_PLANS) {
            showToast(t.vocab.plans.maxPlansHint.replace('{n}', String(MAX_PLANS)), 'error');
            return;
        }

        const planName = modal.name.trim() || buildDefaultPlanName();

        setSaving(true);
        try {
            const { plan } = await createPlan(planName, modal.daily_count);
            setPlans(prev => [...prev, plan]);
            setModal(null);
            showToast(t.vocab.plans.msgCreateSuccess, 'success');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || t.vocab.plans.msgCreateFail;
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleStartCustom = async (deck: CustomMemoryDeck, forceReview = false) => {
        if (startingCustom) return;
        if (deck.card_count === 0) {
            showToast('请先添加卡片', 'error');
            return;
        }

        const isReview = forceReview || shouldStartCustomReview(deck);
        setStartingCustom(deck.id);
        try {
            const { deck: serverDeck, cards, stats } = await startCustomDeck(deck.id, isReview, true);
            if (!cards.length) {
                const msg = isReview
                    ? '暂无到期复习卡'
                    : stats.remaining_today === 0
                        ? `今日学习额度已完成（目标 ${serverDeck.daily_count} 张）`
                        : '当前没有可学习卡片';
                showToast(msg, 'success');
                return;
            }

            navigate('/vocabulary/custom-cards/study', {
                state: {
                    deckId: serverDeck.id,
                    deckTitle: serverDeck.title,
                    dailyCount: serverDeck.daily_count,
                    cards,
                },
            });
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '开始学习失败';
            showToast(msg, 'error');
        } finally {
            setStartingCustom(null);
        }
    };

    /* ── delete ── */
    const handleDelete = async (e: React.MouseEvent, plan: LearningPlan) => {
        e.stopPropagation();
        if (!confirm(t.vocab.plans.msgDeleteConfirm.replace('{name}', plan.name))) return;
        try {
            await deletePlan(plan.id);
            setPlans(prev => prev.filter(p => p.id !== plan.id));
            showToast(t.vocab.plans.msgDeleteSuccess, 'success');
        } catch {
            showToast(t.vocab.plans.msgDeleteFail, 'error');
        }
    };

    /* ── start ── */
    const handleStart = async (e: React.MouseEvent, plan: LearningPlan, forceReview = false) => {
        e.stopPropagation();
        if (starting) return;
        if (plan.word_count === 0) { showToast(t.vocab.plans.msgEmptyWord, 'error'); return; }

        const isReview = forceReview || shouldStartReview(plan);
        setStarting(plan.id);
        try {
            const result = await startPlan(plan.id, isReview ? 'review' : 'study');
            const { cards, stats } = result;
            if (cards.length === 0) {
                const msg = isReview
                    ? t.vocab.plans.msgNoReviewRecord
                    : stats.remaining_today === 0
                        ? t.vocab.plans.msgDailyGoalReached.replace('{n}', String(stats.studied_today))
                        : t.vocab.plans.msgNoDueReview;
                showToast(msg, 'success');
                return;
            }
            const mode = (plan.default_mode || localStorage.getItem(`lp_study_mode_${plan.id}`) || 'flashcard') as 'flashcard' | 'choice' | 'write' | 'copy';
            const rawTarget = plan.mastery_target !== undefined 
                ? String(plan.mastery_target) 
                : (localStorage.getItem(`lp_mastery_target_${plan.id}`) ?? '2');
            const masteryTarget = rawTarget === 'auto'
                ? 'auto'
                : (() => {
                    const n = Number(rawTarget);
                    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 2;
                })();
            const copyRepetitions = (() => {
                const raw = plan.copy_repetitions !== undefined
                    ? Number(plan.copy_repetitions)
                    : Number(localStorage.getItem(`lp_copy_repetitions_${plan.id}`) ?? '3');
                return Number.isFinite(raw) ? Math.min(20, Math.max(1, Math.floor(raw))) : 3;
            })();
            const copyReviewDays = (() => {
                const raw = plan.copy_review_days !== undefined
                    ? Number(plan.copy_review_days)
                    : Number(localStorage.getItem(`lp_copy_review_days_${plan.id}`) ?? '2');
                return Number.isFinite(raw) ? Math.min(365, Math.max(0, Math.floor(raw))) : 2;
            })();
            navigate('/vocabulary/flashcard/doing', {
                state: {
                    cards,
                    stats,
                    planId: plan.id,
                    planName: plan.name,
                    planDailyCount: plan.daily_count,
                    mode,
                    masteryTarget,
                    copyRepetitions,
                    copyReviewDays,
                    reviewOnly: isReview,
                    forceNewSession: mode !== 'copy',
                },
            });
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || t.vocab.plans.msgStartFail;
            showToast(msg, 'error');
        } finally {
            setStarting(null);
        }
    };

    const canCreate = user?.is_staff || plans.length < MAX_PLANS;

    return (
        <Layout
            pageTitle={t.vocab.plans.title}
            backUrl='/vocabulary'
            backText={`${t.common.back} ${t.vocab.hub.title}`}
            titleAction={
                <>
                    {activeTab === 'plans' && (
                        <button
                            className={`uc-console-start-btn ${canCreate ? '' : 'disabled'}`}
                            style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', marginLeft: 16 }}
                            onClick={() => canCreate && setModal({ name: '', daily_count: 20, entry_mode: 'word' })}
                            disabled={!canCreate}
                            title={!canCreate ? t.vocab.plans.maxPlansHint.replace('{n}', String(MAX_PLANS)) : t.vocab.plans.newPlan}
                        >
                            + {t.vocab.plans.newPlan}
                        </button>
                    )}
                    {activeTab === 'custom' && (
                        <button
                            className="uc-console-start-btn"
                            style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', marginLeft: 16 }}
                            onClick={() => setModal({ name: '', daily_count: 20, entry_mode: 'custom' })}
                        >
                            + 新建卡组
                        </button>
                    )}
                </>
            }
        >
            <div className="uc-console">
                {/* ── 1. 左侧：分类导航 (Sidebar) ── */}
                <div className="uc-sidebar">
                    <div className="uc-sidebar-title">词汇库</div>
                    <nav className="uc-sidebar-nav">
                        <button
                            type="button"
                            className={`uc-nav-item ${activeTab === 'plans' ? 'active' : ''}`}
                            onClick={() => setActiveTab('plans')}
                        >
                            <span className="nav-icon">📚</span>
                            <span className="nav-text">常规背单词</span>
                        </button>
                        <button
                            type="button"
                            className={`uc-nav-item ${activeTab === 'custom' ? 'active' : ''}`}
                            onClick={() => setActiveTab('custom')}
                        >
                            <span className="nav-icon">🃏</span>
                            <span className="nav-text">自定义记忆卡</span>
                        </button>
                    </nav>
                </div>

                {/* ── 2. 右侧：列表明细区 (Main Content) ── */}
                <div className="uc-main-content">
                    <div style={{ padding: '24px 32px' }}>
                        {activeTab === 'plans' && (
                            <>
                                {loading ? (
                                    <div className="lp-empty">{t.common.loading}</div>
                                ) : plans.length === 0 ? (
                                    <div className="lp-empty-state">
                                        <div className="lp-empty-icon">📚</div>
                                        <p className="lp-empty-title">{t.vocab.plans.emptyTitle}</p>
                                        <p className="lp-empty-sub">{t.vocab.plans.emptySub}</p>
                                    </div>
                                ) : (
                                    <div className="lp-plan-list">
                                        {plans.map((plan, idx) => (
                                            <div key={plan.id} className="lp-plan-card" data-idx={idx}>
                                                <div className="lp-plan-accent" />
                                                <div className="lp-plan-body">
                                                    <div className="lp-plan-top">
                                                        <span className="lp-plan-name">{plan.name}</span>
                                                        <button
                                                            className="lp-plan-del"
                                                            onClick={(e) => handleDelete(e, plan)}
                                                            title="删除"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    <div className="lp-plan-meta">
                                                        <span className="lp-meta-item">
                                                            <span className="lp-meta-dot" />
                                                            <span dangerouslySetInnerHTML={{ __html: sanitize(t.vocab.plans.cardDaily.replace('{n}', String(plan.daily_count))) }} />
                                                        </span>
                                                        <span className="lp-meta-sep">·</span>
                                                        <span className="lp-meta-item" dangerouslySetInnerHTML={{ __html: sanitize(t.vocab.plans.cardTotal.replace('{n}', String(plan.word_count))) }} />
                                                        <span className="lp-meta-sep">·</span>
                                                        <span className={`lp-meta-item ${plan.studied_today > 0 ? 'lp-today-badge' : ''}`} dangerouslySetInnerHTML={{ __html: sanitize(t.vocab.plans.cardStudied.replace('{n}', String(plan.studied_today))) }} />
                                                    </div>
                                                    <div className="lp-plan-actions">
                                                        <button
                                                            className="lp-plan-btn secondary"
                                                            onClick={() => navigate(`/vocabulary/plans/${plan.id}`)}
                                                        >
                                                            {t.vocab.plans.editPlan}
                                                        </button>
                                                        <button
                                                            className="lp-plan-btn primary"
                                                            onClick={(e) => handleStart(e, plan)}
                                                            disabled={starting === plan.id}
                                                        >
                                                            {starting === plan.id
                                                                ? t.vocab.plans.preparing
                                                                : shouldStartReview(plan)
                                                                    ? t.vocab.plans.startReview
                                                                    : t.vocab.plans.startStudy}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'custom' && (
                            <>
                                {customDecks.length === 0 ? (
                                    <div className="lp-empty-state">
                                        <div className="lp-empty-icon">🃏</div>
                                        <p className="lp-empty-title">暂无自定义记忆卡</p>
                                        <p className="lp-empty-sub">点击右上角新建卡组，创建属于你自己的闪卡</p>
                                    </div>
                                ) : (
                                    <div className="lp-plan-list">
                                        {customDecks.map((deck, idx) => (
                                            <div key={deck.id} className="lp-plan-card" data-idx={idx}>
                                                <div className="lp-plan-accent" />
                                                <div className="lp-plan-body">
                                                    <div className="lp-plan-top">
                                                        <span className="lp-plan-name">{deck.title}</span>
                                                    </div>
                                                    <div className="lp-plan-meta">
                                                        <span className="lp-meta-item">
                                                            <span className="lp-meta-dot" />
                                                            <span>每日学习 <strong>{deck.daily_count}</strong> 张</span>
                                                        </span>
                                                        <span className="lp-meta-sep">·</span>
                                                        <span className="lp-meta-item">卡片总数 <strong>{deck.card_count}</strong></span>
                                                        <span className="lp-meta-sep">·</span>
                                                        <span className={`lp-meta-item ${deck.studied_today > 0 ? 'lp-today-badge' : ''}`}>
                                                            今日学习计划 <strong>{deck.studied_today}</strong> / <strong>{getCustomTodayTarget(deck)}</strong>
                                                        </span>
                                                    </div>
                                                    <div className="lp-plan-actions">
                                                        <button
                                                            className="lp-plan-btn secondary"
                                                            onClick={() => navigate('/vocabulary/custom-cards', {
                                                                state: {
                                                                    prefillDeckId: deck.id,
                                                                    prefillTitle: deck.title,
                                                                    prefillDailyCount: deck.daily_count,
                                                                },
                                                            })}
                                                        >
                                                            添加卡片
                                                        </button>
                                                        <button
                                                            className="lp-plan-btn primary"
                                                            onClick={() => handleStartCustom(deck)}
                                                            disabled={startingCustom === deck.id}
                                                        >
                                                            {startingCustom === deck.id
                                                                ? t.vocab.plans.preparing
                                                                : shouldStartCustomReview(deck)
                                                                    ? t.vocab.plans.startReview
                                                                    : t.vocab.plans.startStudy}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Create modal ── */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>{t.vocab.plans.modalTitle}</h3>

                        <div>
                            <label>创建入口</label>
                            <div className="lp-entry-mode-group">
                                <label className="lp-entry-mode-option">
                                    <input
                                        type="radio"
                                        name="entry_mode"
                                        checked={modal.entry_mode === 'word'}
                                        onChange={() => setModal({ ...modal, entry_mode: 'word' })}
                                    />
                                    <div className="lp-entry-mode-content">
                                        <div className="lp-entry-mode-title">背单词模式</div>
                                        <div className="lp-entry-mode-sub">创建学习计划后，使用原有背单词流程</div>
                                    </div>
                                </label>

                                <label className="lp-entry-mode-option">
                                    <input
                                        type="radio"
                                        name="entry_mode"
                                        checked={modal.entry_mode === 'custom'}
                                        onChange={() => setModal({ ...modal, entry_mode: 'custom' })}
                                    />
                                    <div className="lp-entry-mode-content">
                                        <div className="lp-entry-mode-title">自定义记忆卡模式</div>
                                        <div className="lp-entry-mode-sub">创建后停留本页，并同步到后端</div>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label>{t.vocab.plans.planNameLabel}</label>
                            <input
                                type="text"
                                placeholder={t.vocab.plans.planNamePlaceholder}
                                maxLength={50}
                                value={modal.name}
                                onChange={e => setModal({ ...modal, name: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label>{t.vocab.plans.dailyCountLabel}</label>
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={modal.daily_count}
                                onChange={e => setModal({ ...modal, daily_count: Number(e.target.value) })}
                            />
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => setModal(null)}>{t.common.cancel}</button>
                            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                                {modal.entry_mode === 'custom'
                                    ? (saving ? t.vocab.plans.creatingBtn : t.vocab.plans.createBtn)
                                    : saving
                                        ? t.vocab.plans.creatingBtn
                                        : t.vocab.plans.createBtn}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}

// Trigger HMR update
