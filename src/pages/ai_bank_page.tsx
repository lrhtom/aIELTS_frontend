import Layout from '../components/layout/Layout';
import { showConfirm } from '../components/common/ConfirmService';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    listAIQuestions, deleteAIQuestion, toggleFavoriteAIQuestion,
    setAIQuestionTemplate, copyTemplateQuestion,
    type AIQuestionSkill, type AIQuestionSummary,
} from '../api/ai_question';
import { showToast } from '../components/common/Toast';
import { useLang } from '../i18n/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import '../styles/ai_bank.css';

/** Tabs whose items can be made site-wide templates (mirrors the backend's _TEMPLATABLE_SKILLS; the full mock is excluded) */
const TEMPLATABLE_SKILLS: AIQuestionSkill[] = ['listening', 'reading', 'writing', 'speaking'];

function resolveAnswerRoute(item: AIQuestionSummary): string {
    const id = item.id;
    if (item.skill === 'mock') return `/mock/${id}`;
    if (item.skill === 'reading') return `/reading?bankId=${id}`;
    if (item.skill === 'listening') return `/listening?bankId=${id}`;
    if (item.skill === 'speaking') {
        // Has a summary report -> straight to the report page; still in progress -> back to the chat page to continue
        return item.hasFeedback ? `/speaking/summary?bankId=${id}` : `/speaking/chat?bankId=${id}`;
    }
    if (item.skill === 'writing') {
        // A full writing set (Task 1 + Task 2) is a parent row and cannot be answered itself; open the hub and pick one
        if (item.subtype === 'full') return `/writing/full/${id}`;
        // Marked and not redone -> show the correction; everything else (pending or redone) -> the answering page
        if (item.isAnswered && !isRedone(item)) return `/writing/correction?bankId=${id}`;
        if (item.subtype.startsWith('chart:')) {
            // Carry the subtype in the URL, otherwise chart_practice_page defaults to type='line',
            // which makes isMapType false for map questions so the map area never renders.
            const chartSubtype = item.subtype.slice('chart:'.length);
            return `/writing/chart/doing?bankId=${id}&type=${encodeURIComponent(chartSubtype)}`;
        }
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
    const { t } = useLang();
    const { user } = useAuth();
    const isAdmin = Boolean(user?.is_staff || user?.is_superuser);
    const [searchParams] = useSearchParams();
    const justId = searchParams.get('just');

    const SKILL_TABS: { key: AIQuestionSkill; label: string; emoji: string }[] = [
        { key: 'listening', label: t('aiBank.tabs.listening'), emoji: '🎧' },
        { key: 'reading',   label: t('aiBank.tabs.reading'),   emoji: '📖' },
        { key: 'writing',   label: t('aiBank.tabs.writing'),   emoji: '✍️' },
        { key: 'speaking',  label: t('aiBank.tabs.speaking'),  emoji: '🗣️' },
        { key: 'mock',      label: t('mock.bank.tab'),         emoji: '🎯' },
    ];

    const isSkillKey = (v: string | null): v is AIQuestionSkill =>
        v === 'reading' || v === 'listening' || v === 'writing' || v === 'speaking' || v === 'mock';

    const [activeSkill, setActiveSkill] = useState<AIQuestionSkill>(() => {
        // ?skill= jumps straight to a given tab (used by the speaking exit button); outranks the remembered tab
        const fromQuery = searchParams.get('skill');
        if (isSkillKey(fromQuery)) return fromQuery;
        const stored = sessionStorage.getItem('ai_bank_active_skill');
        if (isSkillKey(stored)) return stored;
        return 'listening';
    });
    const [items, setItems] = useState<AIQuestionSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        sessionStorage.setItem('ai_bank_active_skill', activeSkill);
        let cancelled = false;
        let pollId: ReturnType<typeof setTimeout> | null = null;

        const fetchOnce = async () => {
            try {
                const r = await listAIQuestions({ skill: activeSkill });
                if (cancelled) return;
                setItems(r.items);
                // If any row is still generating we keep polling so the card
                // flips to "ready" without the user needing to refresh.
                const anyGenerating = r.items.some(it => it.status === 'generating');
                if (anyGenerating && !cancelled) {
                    pollId = setTimeout(fetchOnce, 3000);
                }
            } catch {
                if (!cancelled) showToast(t('aiBank.loadFail'), 'error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        setLoading(true);
        fetchOnce();
        return () => {
            cancelled = true;
            if (pollId) clearTimeout(pollId);
        };
    }, [activeSkill, t]);

    const sortedItems = useMemo(() => {
        const favTime = (it: AIQuestionSummary) => (it.favoritedAt ? Date.parse(it.favoritedAt) : 0);
        const createTime = (it: AIQuestionSummary) => (it.createdAt ? Date.parse(it.createdAt) : 0);
        // Site templates are always pinned to the top (the backend sorts the same way, so the optimistic update must match);
        // then favorites: favorited first, most recently favorited (larger favoritedAt) higher; everything else newest-first.
        const arr = [...items].sort((a, b) => {
            if (a.isTemplate !== b.isTemplate) return a.isTemplate ? -1 : 1;
            const fa = favTime(a), fb = favTime(b);
            if (fa !== fb) return fb - fa;
            return createTime(b) - createTime(a);
        });
        const just = justId ? Number(justId) : NaN;
        if (Number.isNaN(just)) return arr;
        // The just-generated item is always pinned to the top so the user sees it immediately (outranks favorite ordering).
        const head = arr.filter(it => it.id === just);
        const tail = arr.filter(it => it.id !== just);
        return [...head, ...tail];
    }, [items, justId]);

    const [usingTemplateId, setUsingTemplateId] = useState<number | null>(null);

    const handleClick = async (item: AIQuestionSummary) => {
        // Multi-part items (full mock / full writing set) open the hub in any state:
        // the hub shows each child's generation progress itself, so there is nothing to gate here
        if (item.skill === 'mock' || (item.skill === 'writing' && item.subtype === 'full')) {
            navigate(resolveAnswerRoute(item));
            return;
        }
        if (item.status === 'generating') {
            showToast(t('aiBank.toastStillGenerating'), 'info');
            return;
        }
        if (item.status === 'failed') {
            showToast(item.errorMessage || t('aiBank.toastGenerationFailed'), 'error');
            return;
        }
        // Someone else's template: have the backend copy it under our own name before answering.
        // Answering against the template id directly would 404 on submit (submit only accepts the author), and even if
        // it were allowed, every user's answers would overwrite each other on the same row.
        if (item.isTemplate && !item.isOwner) {
            if (usingTemplateId) return;             // a copy request is in flight, do not double-click
            setUsingTemplateId(item.id);
            try {
                const copy = await copyTemplateQuestion(item.id);
                // The copy is in our own bank now and must show up immediately (the backend dedupes, so no duplicate insert)
                setItems(prev => (prev.some(it => it.id === copy.id) ? prev : [...prev, copy]));
                navigate(resolveAnswerRoute(copy));
            } catch {
                showToast(t('aiBank.templateUseFail'), 'error');
            } finally {
                setUsingTemplateId(null);
            }
            return;
        }
        navigate(resolveAnswerRoute(item));
    };

    const handleToggleTemplate = async (e: React.MouseEvent, item: AIQuestionSummary) => {
        e.stopPropagation();
        const next = !item.isTemplate;
        if (next && !(await showConfirm(t('aiBank.templateSetConfirm').replace('{title}', item.title || t('aiBank.untitled'))))) return;
        try {
            const updated = await setAIQuestionTemplate(item.id, next);
            // Only one per skill: setting a new one bumps the old template of the same skill. Mirror that rule locally,
            // otherwise the stale badge sticks around until the next poll.
            setItems(prev => prev.map(it => {
                if (it.id === updated.id) return { ...it, isTemplate: updated.isTemplate };
                return next && it.isTemplate ? { ...it, isTemplate: false } : it;
            }));
            showToast(next ? t('aiBank.templateSetOk') : t('aiBank.templateUnsetOk'), 'success');
        } catch (err) {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
            showToast(msg || t('aiBank.templateSetFail'), 'error');
        }
    };

    const handleDelete = async (e: React.MouseEvent, item: AIQuestionSummary) => {
        e.stopPropagation();
        const title = item.title || t('aiBank.untitled');
        if (!(await showConfirm({ message: t('aiBank.deleteConfirm').replace('{title}', title), danger: true }))) return;
        try {
            await deleteAIQuestion(item.id);
            setItems(prev => prev.filter(it => it.id !== item.id));
            showToast(t('aiBank.deleteSuccess'), 'success');
        } catch {
            showToast(t('aiBank.deleteFail'), 'error');
        }
    };

    const handleToggleFavorite = async (e: React.MouseEvent, item: AIQuestionSummary) => {
        e.stopPropagation();
        // Optimistic update: flip the favorite state right away so the card re-sorts immediately (newest favorite on top).
        const nextFav = item.isFavorite ? null : new Date().toISOString();
        setItems(prev => prev.map(it => it.id === item.id
            ? { ...it, isFavorite: !it.isFavorite, favoritedAt: nextFav }
            : it));
        try {
            const updated = await toggleFavoriteAIQuestion(item.id);
            setItems(prev => prev.map(it => it.id === item.id
                ? { ...it, isFavorite: updated.isFavorite, favoritedAt: updated.favoritedAt }
                : it));
        } catch {
            // roll back to the pre-click state on failure
            setItems(prev => prev.map(it => it.id === item.id
                ? { ...it, isFavorite: item.isFavorite, favoritedAt: item.favoritedAt }
                : it));
            showToast(t('aiBank.favoriteFail'), 'error');
        }
    };

    return (
        <Layout
            backUrl="/practice/ai"
            backText={t('aiBank.backToAI')}
            pageTitle={t('aiBank.pageTitle')}
            pageSubtitle={t('aiBank.pageSubtitle')}
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

                {/* The bank stores questions only; corrections and AI-teacher lessons are archived on the Service Records page.
                    Only the writing tab gets this entry point - the other three skills have no matching records page. */}
                {activeSkill === 'writing' && (
                    <div className="ai-bank-toolbar">
                        <button
                            type="button"
                            className="ai-bank-records-link"
                            onClick={() => navigate('/writing/ai-teachers/records')}
                        >
                            <span className="ai-bank-records-link-label">{t('aiBank.recordsLinkBtn')}</span>
                            <span className="ai-bank-records-link-hint">{t('aiBank.recordsLinkHint')}</span>
                            <span className="ai-bank-records-link-arrow" aria-hidden="true">→</span>
                        </button>
                    </div>
                )}

                {loading ? (
                    <div className="ai-bank-empty">{t('aiBank.loading')}</div>
                ) : sortedItems.length === 0 ? (
                    <div className="ai-bank-empty">
                        <div className="ai-bank-empty-title">{t('aiBank.emptyTitle').replace('{label}', SKILL_TABS.find(tab => tab.key === activeSkill)?.label || '')}</div>
                        <div className="ai-bank-empty-hint">{t('aiBank.emptyHint')}</div>
                    </div>
                ) : (
                    <div className="ai-bank-grid">
                        {sortedItems.map(item => {
                            const canTemplate = TEMPLATABLE_SKILLS.includes(item.skill);
                            const isJust = justId && Number(justId) === item.id;
                            const isGenerating = item.status === 'generating';
                            const isFailed = item.status === 'failed';
                            // speaking: userAnswer exists from the first turn, so 'done' means a summary report exists;
                            // and lastAttemptAt syncs every turn, so the redone concept does not apply
                            // mock: the combined score report is what counts (the parent row's userAnswer is the exam state machine)
                            const isSpeaking = item.skill === 'speaking';
                            const isMock = item.skill === 'mock';
                            const answeredFlag = isMock ? Boolean(item.mock?.hasReport) : (isSpeaking ? item.hasFeedback : item.isAnswered);
                            const mockReadyCount = item.mock
                                ? Object.values(item.mock.slots).filter(s => s === 'ready').length
                                : 0;
                            const statusLabel = isGenerating
                                ? (isMock ? `⏳ ${t('mock.bank.slotStatus').replace('{ready}', String(mockReadyCount)).replace('{total}', '4')}` : t('aiBank.statusGenerating'))
                                : isFailed
                                    ? t('aiBank.statusFailed')
                                    : (answeredFlag
                                        ? (isMock && item.mock?.overall != null
                                            ? t('mock.bank.reportDone').replace('{overall}', item.mock.overall.toFixed(1))
                                            : (!isSpeaking && !isMock && isRedone(item) ? t('aiBank.statusRedone') : t('aiBank.statusAnswered')))
                                        : ((isSpeaking || isMock) ? t('aiBank.statusInProgress') : t('aiBank.statusPending')));
                            const statusClass = isGenerating
                                ? 'generating'
                                : isFailed
                                    ? 'failed'
                                    : (answeredFlag ? (!isSpeaking && isRedone(item) ? 'redone' : 'answered') : 'pending');
                            const cardStateClass = isGenerating
                                ? 'is-generating'
                                : isFailed
                                    ? 'is-failed'
                                    : (answeredFlag ? 'is-answered' : 'is-pending');
                            // Someone else's template: it can only be used, not deleted or favorited (those act on the author's row)
                            const isForeignTemplate = item.isTemplate && !item.isOwner;
                            return (
                                <div
                                    key={item.id}
                                    className={`ai-bank-card ${isJust ? 'is-just' : ''} ${cardStateClass} ${item.isFavorite ? 'is-favorite' : ''} ${item.isTemplate ? 'is-template' : ''}`}
                                    onClick={() => { void handleClick(item); }}
                                    aria-disabled={!isMock && (isGenerating || isFailed)}
                                >
                                    <div className="ai-bank-card-head">
                                        <span className={`ai-bank-status ${statusClass}`}>
                                            {statusLabel}
                                        </span>
                                        {item.isTemplate && (
                                            <span className="ai-bank-template-badge" title={t('aiBank.templateBadgeHint')}>
                                                📌 {t('aiBank.templateBadge')}
                                            </span>
                                        )}
                                        {/* The card head is only so wide (the action cluster on the right needs clearance), so three chips will not fit.
                                            When the template badge shows, subtype gives way: a two-or-three-letter stub carries no information. */}
                                        {item.subtype && !item.isTemplate && <span className="ai-bank-subtype">{item.subtype}</span>}
                                    </div>
                                    <div className="ai-bank-card-title">{item.title || t('aiBank.unnamedFallback')}</div>
                                    {item.description && (
                                        <div className="ai-bank-card-description">{item.description}</div>
                                    )}
                                    {isFailed && item.errorMessage && (
                                        <div className="ai-bank-card-error">{item.errorMessage}</div>
                                    )}
                                    <div className="ai-bank-card-meta">
                                        <span>{t('aiBank.generatedAt').replace('{time}', formatDate(item.createdAt))}</span>
                                        {item.lastAttemptAt && <span>{t('aiBank.lastAttemptAt').replace('{time}', formatDate(item.lastAttemptAt))}</span>}
                                    </div>
                                    {/* The top-right action cluster holds just favorite + delete (someone else's template has neither).
                                        The template toggle is a low-frequency admin action, so it sits on its own row at the bottom of the card. */}
                                    {!isForeignTemplate && (
                                        <div className="ai-bank-card-actions">
                                            <button
                                                type="button"
                                                className={`ai-bank-card-favorite ${item.isFavorite ? 'is-on' : ''}`}
                                                onClick={(e) => handleToggleFavorite(e, item)}
                                                aria-label={item.isFavorite ? t('aiBank.unfavoriteAriaLabel') : t('aiBank.favoriteAriaLabel')}
                                                aria-pressed={item.isFavorite}
                                                title={item.isFavorite ? t('aiBank.unfavoriteAriaLabel') : t('aiBank.favoriteAriaLabel')}
                                            >
                                                {item.isFavorite ? '★' : '☆'}
                                            </button>
                                            <button
                                                type="button"
                                                className="ai-bank-card-delete"
                                                onClick={(e) => handleDelete(e, item)}
                                                aria-label={t('aiBank.deleteAriaLabel')}
                                            >
                                                <span>{t('aiBank.deleteBtn')}</span>
                                            </button>
                                        </div>
                                    )}
                                    {(isForeignTemplate || (isAdmin && canTemplate && !isGenerating && !isFailed && !item.templateSourceId)) && (
                                        <div className="ai-bank-card-footer">
                                            {isForeignTemplate && (
                                                <span className="ai-bank-template-hint">
                                                    {usingTemplateId === item.id ? t('aiBank.templateOpening') : t('aiBank.templateOpenHint')}
                                                </span>
                                            )}
                                            {/* Admin toggle: only on the four skill tabs, only once generated, and never on a template copy */}
                                            {isAdmin && canTemplate && !isGenerating && !isFailed && !item.templateSourceId && (
                                                <button
                                                    type="button"
                                                    className={`ai-bank-card-template ${item.isTemplate ? 'is-on' : ''}`}
                                                    onClick={(e) => { void handleToggleTemplate(e, item); }}
                                                    aria-pressed={item.isTemplate}
                                                    title={item.isTemplate ? t('aiBank.templateUnsetBtn') : t('aiBank.templateSetBtn')}
                                                >
                                                    📌 {item.isTemplate ? t('aiBank.templateUnsetBtn') : t('aiBank.templateSetBtn')}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}
