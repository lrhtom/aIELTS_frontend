import Layout from '../components/layout/Layout';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listAIQuestions, deleteAIQuestion, type AIQuestionSkill, type AIQuestionSummary } from '../api/ai_question';
import { showToast } from '../components/common/Toast';
import { Trash } from 'lucide-react';
import '../styles/ai_bank.css';

const SKILL_TABS: { key: AIQuestionSkill; label: string; emoji: string }[] = [
    { key: 'listening', label: '听力', emoji: '🎧' },
    { key: 'reading',   label: '阅读', emoji: '📖' },
    { key: 'writing',   label: '写作', emoji: '✍️' },
];

function resolveAnswerRoute(item: AIQuestionSummary): string {
    const id = item.id;
    if (item.skill === 'reading') return `/reading?bankId=${id}`;
    if (item.skill === 'listening') return `/listening?bankId=${id}`;
    if (item.skill === 'writing') {
        // 作文题始终进入答题界面（预填上次作答），点"批改"才跳到批改页
        if (item.subtype.startsWith('chart:')) return `/writing/chart/doing?bankId=${id}`;
        return `/writing/task2/doing?bankId=${id}`;
    }
    return '/practice/ai/bank';
}

function isRedone(item: AIQuestionSummary): boolean {
    if (!item.answeredAt || !item.lastAttemptAt) return false;
    return item.lastAttemptAt > item.answeredAt;
}

function formatDate(value: string | null): string {
    if (!value) return '';
    try {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return '';
    }
}

export default function AIBankPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const justId = searchParams.get('just');

    const [activeSkill, setActiveSkill] = useState<AIQuestionSkill>(() => {
        const stored = sessionStorage.getItem('ai_bank_active_skill');
        if (stored === 'reading' || stored === 'listening' || stored === 'writing') return stored;
        return 'listening';
    });
    const [items, setItems] = useState<AIQuestionSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        sessionStorage.setItem('ai_bank_active_skill', activeSkill);
        let cancelled = false;
        setLoading(true);
        listAIQuestions({ skill: activeSkill })
            .then(r => { if (!cancelled) setItems(r.items); })
            .catch(() => { if (!cancelled) showToast('题库加载失败', 'error'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [activeSkill]);

    const sortedItems = useMemo(() => {
        const just = justId ? Number(justId) : NaN;
        if (Number.isNaN(just)) return items;
        const head = items.filter(it => it.id === just);
        const tail = items.filter(it => it.id !== just);
        return [...head, ...tail];
    }, [items, justId]);

    const handleClick = (item: AIQuestionSummary) => {
        navigate(resolveAnswerRoute(item));
    };

    const handleDelete = async (e: React.MouseEvent, item: AIQuestionSummary) => {
        e.stopPropagation();
        if (!confirm(`删除「${item.title || '该题目'}」吗？删除后无法恢复。`)) return;
        try {
            await deleteAIQuestion(item.id);
            setItems(prev => prev.filter(it => it.id !== item.id));
            showToast('已删除', 'success');
        } catch {
            showToast('删除失败', 'error');
        }
    };

    return (
        <Layout
            backUrl="/practice/ai"
            backText="返回 AI 练习"
            pageTitle="AI 题库"
            pageSubtitle="已生成的听 / 读 / 写题目都会保存在这里，随时复做。"
        >
            <div className="ai-bank-wrap" style={{ paddingTop: '16px' }}>
                <div className="ai-bank-tabs" role="tablist">
                    {SKILL_TABS.map(tab => (
                        <label
                            key={tab.key}
                            className={`ai-bank-tab ${activeSkill === tab.key ? 'is-active' : ''}`}
                        >
                            <input
                                type="radio"
                                name="ai-bank-skill"
                                value={tab.key}
                                checked={activeSkill === tab.key}
                                onChange={() => setActiveSkill(tab.key)}
                            />
                            <span className="ai-bank-tab-emoji">{tab.emoji}</span>
                            <span>{tab.label}</span>
                        </label>
                    ))}
                </div>

                {loading ? (
                    <div className="ai-bank-empty">加载中…</div>
                ) : sortedItems.length === 0 ? (
                    <div className="ai-bank-empty">
                        <div className="ai-bank-empty-title">还没有 {SKILL_TABS.find(t => t.key === activeSkill)?.label} 题目</div>
                        <div className="ai-bank-empty-hint">先去生成一份吧。</div>
                    </div>
                ) : (
                    <div className="ai-bank-grid">
                        {sortedItems.map(item => {
                            const isJust = justId && Number(justId) === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`ai-bank-card ${isJust ? 'is-just' : ''} ${item.isAnswered ? 'is-answered' : 'is-pending'}`}
                                    onClick={() => handleClick(item)}
                                >
                                    <div className="ai-bank-card-head">
                                        <span className={`ai-bank-status ${item.isAnswered ? (isRedone(item) ? 'redone' : 'answered') : 'pending'}`}>
                                            {item.isAnswered ? (isRedone(item) ? '已重做' : '已作答') : '未作答'}
                                        </span>
                                        {item.subtype && <span className="ai-bank-subtype">{item.subtype}</span>}
                                    </div>
                                    <div className="ai-bank-card-title">{item.title || '（未命名题目）'}</div>
                                    <div className="ai-bank-card-meta">
                                        <span>生成于 {formatDate(item.createdAt)}</span>
                                        {item.lastAttemptAt && <span>· 上次作答 {formatDate(item.lastAttemptAt)}</span>}
                                    </div>
                                    <button
                                        type="button"
                                        className="ai-bank-card-delete"
                                        onClick={(e) => handleDelete(e, item)}
                                        aria-label="删除题目"
                                    >
                                        <span>删除</span>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}
