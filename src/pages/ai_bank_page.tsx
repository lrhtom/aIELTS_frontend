import Layout from '../components/layout/Layout';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listAIQuestions, deleteAIQuestion, type AIQuestionSkill, type AIQuestionSummary } from '../api/ai_question';
import { showToast } from '../components/common/Toast';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/ai_bank.css';

function resolveAnswerRoute(item: AIQuestionSummary): string {
    const id = item.id;
    if (item.skill === 'reading') return `/reading?bankId=${id}`;
    if (item.skill === 'listening') return `/listening?bankId=${id}`;
    if (item.skill === 'writing') {
        // 已批改且未重做 → 看批改结果；其余（pending 或 redone）→ 进答题页
        if (item.isAnswered && !isRedone(item)) return `/writing/correction?bankId=${id}`;
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
    const { lang } = useLang();
    const t = translations[lang].aiBank;
    const [searchParams] = useSearchParams();
    const justId = searchParams.get('just');

    const SKILL_TABS: { key: AIQuestionSkill; label: string; emoji: string }[] = [
        { key: 'listening', label: t.tabs.listening, emoji: '🎧' },
        { key: 'reading',   label: t.tabs.reading,   emoji: '📖' },
        { key: 'writing',   label: t.tabs.writing,   emoji: '✍️' },
    ];

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
            .catch(() => { if (!cancelled) showToast(t.loadFail, 'error'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [activeSkill, t.loadFail]);

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
        const title = item.title || t.untitled;
        if (!confirm(t.deleteConfirm.replace('{title}', title))) return;
        try {
            await deleteAIQuestion(item.id);
            setItems(prev => prev.filter(it => it.id !== item.id));
            showToast(t.deleteSuccess, 'success');
        } catch {
            showToast(t.deleteFail, 'error');
        }
    };

    return (
        <Layout
            backUrl="/practice/ai"
            backText={t.backToAI}
            pageTitle={t.pageTitle}
            pageSubtitle={t.pageSubtitle}
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
                    <div className="ai-bank-empty">{t.loading}</div>
                ) : sortedItems.length === 0 ? (
                    <div className="ai-bank-empty">
                        <div className="ai-bank-empty-title">{t.emptyTitle.replace('{label}', SKILL_TABS.find(tab => tab.key === activeSkill)?.label || '')}</div>
                        <div className="ai-bank-empty-hint">{t.emptyHint}</div>
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
                                            {item.isAnswered ? (isRedone(item) ? t.statusRedone : t.statusAnswered) : t.statusPending}
                                        </span>
                                        {item.subtype && <span className="ai-bank-subtype">{item.subtype}</span>}
                                    </div>
                                    <div className="ai-bank-card-title">{item.title || t.unnamedFallback}</div>
                                    <div className="ai-bank-card-meta">
                                        <span>{t.generatedAt.replace('{time}', formatDate(item.createdAt))}</span>
                                        {item.lastAttemptAt && <span>{t.lastAttemptAt.replace('{time}', formatDate(item.lastAttemptAt))}</span>}
                                    </div>
                                    <button
                                        type="button"
                                        className="ai-bank-card-delete"
                                        onClick={(e) => handleDelete(e, item)}
                                        aria-label={t.deleteAriaLabel}
                                    >
                                        <span>{t.deleteBtn}</span>
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
