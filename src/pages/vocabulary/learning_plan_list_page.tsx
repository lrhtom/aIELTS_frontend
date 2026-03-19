import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { useAuth } from '../../contexts/AuthContext';
import {
    listPlans, createPlan, deletePlan, startPlan,
    type LearningPlan,
} from '../../api/learning_plan';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_learning_plan.css';

const MAX_PLANS = 3;

interface CreateModal {
    name:        string;
    daily_count: number;
}

export default function LearningPlanListPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [plans,    setPlans]    = useState<LearningPlan[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [modal,    setModal]    = useState<CreateModal | null>(null);
    const [saving,   setSaving]   = useState(false);
    const [starting, setStarting] = useState<number | null>(null);

    useEffect(() => {
        listPlans()
            .then(r => setPlans(r.plans))
            .catch(() => showToast('加载失败，请刷新', 'error'))
            .finally(() => setLoading(false));
    }, []);

    /* ── create ── */
    const handleCreate = async () => {
        if (!modal) return;
        const name = modal.name.trim();
        if (!name) { showToast('请输入计划名称', 'error'); return; }
        if (modal.daily_count < 1 || modal.daily_count > 200) {
            showToast('每日词数需在 1-200 之间', 'error'); return;
        }
        setSaving(true);
        try {
            const { plan } = await createPlan(name, modal.daily_count);
            setPlans(prev => [...prev, plan]);
            setModal(null);
            showToast('计划创建成功', 'success');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '创建失败';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    /* ── delete ── */
    const handleDelete = async (e: React.MouseEvent, plan: LearningPlan) => {
        e.stopPropagation();
        if (!confirm(`删除计划「${plan.name}」？此操作无法撤销。`)) return;
        try {
            await deletePlan(plan.id);
            setPlans(prev => prev.filter(p => p.id !== plan.id));
            showToast('计划已删除', 'success');
        } catch {
            showToast('删除失败', 'error');
        }
    };

    /* ── start ── */
    const handleStart = async (e: React.MouseEvent, plan: LearningPlan) => {
        e.stopPropagation();
        if (starting) return;
        if (plan.word_count === 0) { showToast('计划中没有单词，请先在编辑计划中添加', 'error'); return; }
        setStarting(plan.id);
        try {
            const { cards, stats } = await startPlan(plan.id);
            if (cards.length === 0) {
                const msg = stats.remaining_today === 0
                    ? `今日已学习 ${stats.studied_today} 词，完成每日目标！`
                    : '今日没有需要复习的单词';
                showToast(msg, 'success');
                return;
            }
            const mode = (localStorage.getItem(`lp_study_mode_${plan.id}`) ?? 'flashcard') as 'flashcard' | 'choice' | 'write';
            const rawTarget = localStorage.getItem(`lp_mastery_target_${plan.id}`) ?? '2';
            const masteryTarget = rawTarget === 'auto'
                ? 'auto'
                : (() => {
                    const n = Number(rawTarget);
                    return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 2;
                })();
            navigate('/vocabulary/flashcard/doing', {
                state: { cards, stats, planId: plan.id, planName: plan.name, mode, masteryTarget },
            });
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || '开始学习失败';
            showToast(msg, 'error');
        } finally {
            setStarting(null);
        }
    };

    const canCreate = user?.is_staff || plans.length < MAX_PLANS;

    return (
        <Layout>
            <div className="config-page-wrap" style={{ maxWidth: 760 }}>
                {/* ── Header ── */}
                <div className="practice-header" style={{ marginBottom: 0 }}>
                    <Link to="/vocabulary" className="back-link">返回词汇学习</Link>
                </div>
                <div className="lp-list-header">
                    <div className="lp-list-header-text">
                        <h2>学习计划</h2>
                        <p>FSRS 智能间隔复习 · 先复习到期词，再学新词</p>
                    </div>
                    <button
                        className={`lp-new-btn${canCreate ? '' : ' disabled'}`}
                        onClick={() => canCreate && setModal({ name: '', daily_count: 20 })}
                        disabled={!canCreate}
                        title={!canCreate ? `最多 ${MAX_PLANS} 个计划` : '新建学习计划'}
                    >
                        + 新建计划
                    </button>
                </div>

                {/* ── Plan list ── */}
                {loading ? (
                    <div className="lp-empty">加载中…</div>
                ) : plans.length === 0 ? (
                    <div className="lp-empty-state">
                        <div className="lp-empty-icon">🃏</div>
                        <p className="lp-empty-title">还没有学习计划</p>
                        <p className="lp-empty-sub">点击「新建计划」，添加单词后每天开始学习</p>
                    </div>
                ) : (
                    <div className="lp-plan-list">
                        {plans.map((plan, idx) => (
                            <div key={plan.id} className="lp-plan-card" data-idx={idx}>
                                {/* Color accent bar */}
                                <div className="lp-plan-accent" />

                                {/* Content */}
                                <div className="lp-plan-body">
                                    <div className="lp-plan-top">
                                        <span className="lp-plan-name">{plan.name}</span>
                                        <button
                                            className="lp-plan-del"
                                            onClick={(e) => handleDelete(e, plan)}
                                            title="删除计划"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    <div className="lp-plan-meta">
                                        <span className="lp-meta-item">
                                            <span className="lp-meta-dot" />
                                            每日 <strong>{plan.daily_count}</strong> 词
                                        </span>
                                        <span className="lp-meta-sep">·</span>
                                        <span className="lp-meta-item">
                                            共 <strong>{plan.word_count}</strong> 词
                                        </span>
                                    </div>
                                    <div className="lp-plan-actions">
                                        <button
                                            className="lp-plan-btn secondary"
                                            onClick={() => navigate(`/vocabulary/plans/${plan.id}`)}
                                        >
                                            编辑计划
                                        </button>
                                        <button
                                            className="lp-plan-btn primary"
                                            onClick={(e) => handleStart(e, plan)}
                                            disabled={starting === plan.id}
                                        >
                                            {starting === plan.id ? '准备中…' : '▶ 开始学习'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Placeholder slots */}
                        {plans.length < MAX_PLANS && (
                            <button className="lp-plan-add-slot" onClick={() => setModal({ name: '', daily_count: 20 })}>
                                <span className="lp-slot-plus">+</span>
                                <span>新建计划</span>
                                <span className="lp-slot-hint">{plans.length} / {MAX_PLANS}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ── Create modal ── */}
            {modal && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <h3>新建学习计划</h3>
                        <div>
                            <label>计划名称</label>
                            <input
                                type="text"
                                placeholder="例如：IELTS 核心词汇"
                                maxLength={50}
                                value={modal.name}
                                onChange={e => setModal({ ...modal, name: e.target.value })}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                autoFocus
                            />
                        </div>
                        <div>
                            <label>每日学习词数（1-200）</label>
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={modal.daily_count}
                                onChange={e => setModal({ ...modal, daily_count: Number(e.target.value) })}
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setModal(null)}>取消</button>
                            <button className="btn-primary" onClick={handleCreate} disabled={saving}>
                                {saving ? '创建中…' : '创建'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
