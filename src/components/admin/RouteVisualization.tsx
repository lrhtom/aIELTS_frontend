import { useState, useMemo, useEffect } from 'react';
// removed unused import
import {
    Globe, Server, Search, ChevronDown, ChevronRight,
    Zap, Lock, ExternalLink, Hash, Layers,
    Activity, Filter, X, RefreshCw, AlertCircle,
} from 'lucide-react';
import '../../styles/route_visualization.css';
import { apiClient } from '../../api/client';


const rvMock = {
    title: '系统路由与端点架构',
    liveBadge: '实时监控',
    tabFrontend: '前端路由树',
    tabBackend: '后端 API',
    searchRoutes: '搜索路径、组件、模块...',
    searchEndpoints: '搜索端点、处理器...',
    resultCount: '找到 {filtered} 项，共 {total} 项',
    legendProtected: '需要鉴权',
    legendPublic: '公开访问',
    legendLazy: '懒加载 (优化)',
    multiMethod: '多方法端点',
    dataSource: 'Django DRF / App.tsx',
    jwtHint: '访问受保护端点需在请求头携带 Bearer Token。',
    totalRoutes: '总路由',
    requireAuth: '需鉴权',
    public: '公开',
    lazyLoad: '懒加载',
    modules: '大模块',
    totalEndpoints: '总端点',
    noMatch: '没有找到匹配项',
    loadFail: '加载失败',
    loadingBackend: '正在分析后端端点...',
    retry: '重试',
    moduleNames: {
        auth: '鉴权与用户', balance: 'AT币管理', store: '商店', reading: '阅读',
        listening: '听力', speaking: '口语', writing: '写作', fsrs: '词汇FSRS',
        notebooks: '笔记本', plans: '学习计划', prompts: 'Prompt广场', creative: '创意工坊',
        assistant: '全局助手', admin: '管理后台', feedback: '用户反馈',
        other: '其他核心模块', topLevel: '顶层与公共', vocabulary: '词汇与记忆',
        practice: '聚合训练', readingListening: '阅读与听力'
    },
    guards: {
        public: 'routeVis.guards.public'
    }
};


type RV = typeof rvMock;

function resolveModuleName(key: string, rv: RV): string {
    if (!key) return '';
    // i18n key from frontend data: 'routeVis.moduleNames.vocabulary'
    if (key.startsWith('routeVis.')) {
        const path = key.slice('routeVis.'.length).split('.');
        let node: any = rv; // eslint-disable-line @typescript-eslint/no-explicit-any
        for (const seg of path) { node = node?.[seg]; if (node === undefined) return key; }
        return typeof node === 'string' ? node : key;
    }
    // Chinese string from backend API — reverse-lookup
    const zhReverse: Record<string, string> = {
        '鉴权与用户': rv.moduleNames.auth, 'AT币管理': rv.moduleNames.balance,
        '商店': rv.moduleNames.store, '阅读': rv.moduleNames.reading,
        '听力': rv.moduleNames.listening, '口语': rv.moduleNames.speaking,
        '写作': rv.moduleNames.writing, '词汇FSRS': rv.moduleNames.fsrs,
        '笔记本': rv.moduleNames.notebooks, '学习计划': rv.moduleNames.plans,
        'Prompt广场': rv.moduleNames.prompts, '创意工坊': rv.moduleNames.creative,
        '全局助手': rv.moduleNames.assistant, '管理后台': rv.moduleNames.admin,
        '用户反馈': rv.moduleNames.feedback,
    };
    return zhReverse[key] ?? key;
}

/* ─────────────────────── Types ─────────────────────── */

type TreeTab = 'frontend' | 'backend';

interface FlatRoute {
    path: string;
    component?: string;
    guard?: string;
    lazy?: boolean;
    module?: string;
}

interface FlatEndpoint {
    method: string;
    path: string;
    handler?: string;
    module?: string;
    name?: string;
}

/* ─────────────────────── Frontend route source of truth ─────────────────────── */
// Parsed directly from App.tsx structure so it always matches the real router.
// When you add a new <Route> in App.tsx, add a matching entry here.

const FRONTEND_ROUTES: FlatRoute[] = [
    // ── Public ──────────────────────────────────────────────
    { path: '/',        component: 'HomePage',    guard: 'routeVis.guards.public',     module: 'routeVis.topLevel' },
    { path: '/login',   component: 'LoginPage',   guard: 'routeVis.guards.public',     module: 'routeVis.topLevel' },
    { path: '/register',component: 'RegisterPage',guard: 'routeVis.guards.public',     module: 'routeVis.topLevel' },
    // ── Vocabulary ──────────────────────────────────────────
    { path: '/vocabulary',                            component: 'VocabularyPracticePage',       guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/practice',                   component: 'VocabularyTrainingPage',       guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/practice/:mode/doing',       component: 'VocabularyTrainingDoingPage',  guard: 'Protected', module: 'routeVis.moduleNames.vocabulary', lazy: true },
    { path: '/vocabulary/custom-cards',               component: 'CustomMemoryCreatePage',       guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/custom-cards/study',         component: 'CustomMemoryStudyPage',        guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/custom-cards/result',        component: 'CustomMemoryResultPage',       guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/flashcard → /vocabulary/plans', component: 'Navigate(redirect)',        guard: '—',         module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/flashcard/doing',            component: 'VocabularyFlashcardDoingPage', guard: 'Protected', module: 'routeVis.moduleNames.vocabulary', lazy: true },
    { path: '/vocabulary/notebook',                   component: 'NotebookListPage',             guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/notebook/:id',               component: 'NotebookDetailPage',           guard: 'Protected', module: 'routeVis.moduleNames.vocabulary', lazy: true },
    { path: '/vocabulary/plans',                      component: 'LearningPlanListPage',         guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/plans/:id',                  component: 'LearningPlanDetailPage',       guard: 'Protected', module: 'routeVis.moduleNames.vocabulary', lazy: true },
    { path: '/vocabulary/books',                      component: 'VocabBookListPage',            guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    { path: '/vocabulary/books/:id',                  component: 'VocabBookDetailPage',          guard: 'Protected', module: 'routeVis.moduleNames.vocabulary' },
    // ── Practice ─────────────────────────────────────────────
    { path: '/practice',               component: 'PracticeHub',        guard: 'Protected', module: 'routeVis.moduleNames.practice' },
    { path: '/practice/ai',            component: 'AIPractice',         guard: 'Protected', module: 'routeVis.moduleNames.practice' },
    { path: '/practice/ai/reading',    component: 'WordSelection_page', guard: 'Protected', module: 'routeVis.moduleNames.practice' },
    { path: '/practice/ai/listening',  component: 'ListeningConfig',    guard: 'Protected', module: 'routeVis.moduleNames.practice' },
    // ── Reading / Listening ──────────────────────────────────
    { path: '/reading',   component: 'Reading_page',   guard: 'Protected', module: 'routeVis.moduleNames.readingListening' },
    { path: '/listening', component: 'ListeningPage',  guard: 'Protected', module: 'routeVis.moduleNames.readingListening' },
    // ── Speaking ─────────────────────────────────────────────
    { path: '/speaking',         component: 'Speaking',          guard: 'Protected', module: 'routeVis.moduleNames.speaking' },
    { path: '/speaking/chat',    component: 'SpeakingChatPage',  guard: 'Protected', module: 'routeVis.moduleNames.speaking', lazy: true },
    { path: '/speaking/summary', component: 'SpeakingSummaryPage', guard: 'Protected', module: 'routeVis.moduleNames.speaking' },
    // ── Writing ──────────────────────────────────────────────
    { path: '/writing',                              component: 'Writing_page',                    guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/correction',                   component: 'WritingCorrectionPage',           guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task1',                        component: 'Task1SelectionPage',              guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2',                        component: 'Task2SelectionPage',              guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2/opinion',                component: 'Task2OpinionSelectionPage',       guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2/opinion-drill',          component: 'Task2OpinionDrillPage',           guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2/opinion-drill/generating', component: 'Task2OpinionDrillGeneratingPage', guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2/opinion-drill/doing',    component: 'Task2OpinionDrillDoingPage',      guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/task2/doing',                  component: 'Task2PracticePage',               guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/chart',                        component: 'ChartSelectionPage',              guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    { path: '/writing/chart/doing',                  component: 'ChartPracticePage',               guard: 'Protected', module: 'routeVis.moduleNames.writing' },
    // ── Creative Workshop ────────────────────────────────────
    { path: '/creative-workshop',           component: 'CreativeWorkshopPage',          guard: 'Protected', module: 'routeVis.moduleNames.creative' },
    { path: '/creative-workshop/favorites', component: 'CreativeWorkshopFavoritesPage', guard: 'Protected', module: 'routeVis.moduleNames.creative' },
    { path: '/creative-workshop/pages/:id', component: 'CreativeWorkshopPreviewPage',   guard: 'Protected', module: 'routeVis.moduleNames.creative' },
    // ── Misc ─────────────────────────────────────────────────
    { path: '/profile',  component: 'ProfilePage',  guard: 'Protected', module: 'routeVis.moduleNames.other' },
    { path: '/settings', component: 'SettingsPage', guard: 'Protected', module: 'routeVis.moduleNames.other' },
    { path: '/prompts',  component: 'PromptPage',   guard: 'Protected', module: 'routeVis.moduleNames.other' },
    { path: '/store',    component: 'StorePage',    guard: 'Protected', module: 'routeVis.moduleNames.other' },
];

/* ─────────────────────── Method colors ─────────────────────── */

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    GET:    { bg: 'rgba(16,185,129,0.1)',  text: '#059669', border: 'rgba(16,185,129,0.3)' },
    POST:   { bg: 'rgba(14,165,233,0.1)',  text: '#0284c7', border: 'rgba(14,165,233,0.3)' },
    PUT:    { bg: 'rgba(245,158,11,0.1)',  text: '#d97706', border: 'rgba(245,158,11,0.3)' },
    PATCH:  { bg: 'rgba(245,158,11,0.1)',  text: '#d97706', border: 'rgba(245,158,11,0.3)' },
    DELETE: { bg: 'rgba(239,68,68,0.1)',   text: '#dc2626', border: 'rgba(239,68,68,0.3)' },
};

// Methods Django adds automatically to every view — visually irrelevant
const AUTO_METHODS = new Set(['OPTIONS', 'HEAD']);

function resolveMethodColor(m: string) {
    return METHOD_COLORS[m] ?? { bg: 'rgba(120,113,108,0.08)', text: '#78716c', border: 'rgba(120,113,108,0.2)' };
}

/** Split "GET|PUT|OPTIONS" into individual colored badges, hiding OPTIONS/HEAD */
function MethodBadge({ method }: { method: string }) {
    const parts = method.split('|').filter(m => !AUTO_METHODS.has(m));
    if (parts.length === 0) {
        // All were auto-methods; show them as-is in muted style
        const c = { bg: 'rgba(120,113,108,0.06)', text: '#a8a29e', border: 'rgba(120,113,108,0.15)' };
        return (
            <span className="rv2-method-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                {method}
            </span>
        );
    }
    return (
        <span className="rv2-method-badge-group">
            {parts.map(m => {
                const c = resolveMethodColor(m);
                return (
                    <span key={m} className="rv2-method-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
                        {m}
                    </span>
                );
            })}
        </span>
    );
}


function GuardBadge({ guard, rv }: { guard: string; rv: RV }) {
    if (guard === '—' || !guard) return null;
    const isPublic = guard === 'routeVis.guards.public';
    const label = guard.startsWith('routeVis.') ? resolveModuleName(guard, rv) : guard;
    return (
        <span className={`rv2-guard-badge ${isPublic ? 'public' : 'protected'}`}>
            {isPublic ? <Globe size={10} /> : <Lock size={10} />}
            {label}
        </span>
    );
}

/* ─────────────────────── Stats ─────────────────────── */

function StatsBar({ tab, routes, endpoints, rv }: { tab: TreeTab; routes: FlatRoute[]; endpoints: FlatEndpoint[]; rv: RV }) {
    if (tab === 'frontend') {
        const protected_ = routes.filter(r => r.guard === 'Protected').length;
        const public_ = routes.filter(r => r.guard === 'routeVis.guards.public').length;
        const lazy = routes.filter(r => r.lazy).length;
        const mods = new Set(routes.map(r => r.module)).size;
        return (
            <div className="rv2-stats">
                <div className="rv2-stat"><span className="rv2-stat-num">{routes.length}</span><span className="rv2-stat-label">{rv.totalRoutes}</span></div>
                <div className="rv2-stat-divider" />
                <div className="rv2-stat"><span className="rv2-stat-num protected">{protected_}</span><span className="rv2-stat-label">{rv.requireAuth}</span></div>
                <div className="rv2-stat"><span className="rv2-stat-num public">{public_}</span><span className="rv2-stat-label">{rv.public}</span></div>
                <div className="rv2-stat-divider" />
                <div className="rv2-stat"><span className="rv2-stat-num lazy">{lazy}</span><span className="rv2-stat-label">{rv.lazyLoad}</span></div>
                <div className="rv2-stat"><span className="rv2-stat-num mods">{mods}</span><span className="rv2-stat-label">{rv.modules}</span></div>
            </div>
        );
    }
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const counts = methods.map(m => ({ m, n: endpoints.filter(e => e.method.includes(m)).length }));
    const mods = new Set(endpoints.map(e => e.module)).size;
    return (
        <div className="rv2-stats">
            <div className="rv2-stat"><span className="rv2-stat-num">{endpoints.length}</span><span className="rv2-stat-label">{rv.totalEndpoints}</span></div>
            <div className="rv2-stat-divider" />
            {counts.map(({ m, n }) => {
                const c = resolveMethodColor(m);
                return (
                    <div className="rv2-stat" key={m}>
                        <span className="rv2-stat-num" style={{ color: c.text }}>{n}</span>
                        <span className="rv2-stat-label">{m}</span>
                    </div>
                );
            })}
            <div className="rv2-stat-divider" />
            <div className="rv2-stat"><span className="rv2-stat-num mods">{mods}</span><span className="rv2-stat-label">{rv.modules}</span></div>
        </div>
    );
}

/* ─────────────────────── Grouped explorer ─────────────────────── */

function GroupedList<T>({
    groups,
    renderRow,
    icon,
    rv,
    resolveName,
}: {
    groups: { name: string; items: T[] }[];
    renderRow: (item: T, i: number) => React.ReactNode;
    icon: React.ReactNode;
    rv: RV;
    resolveName: (key: string) => string;
}) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const toggle = (name: string) =>
        setCollapsed(prev => { const s = new Set(prev); if (s.has(name)) { s.delete(name); } else { s.add(name); } return s; });

    if (groups.every(g => g.items.length === 0)) {
        return <div className="rv2-empty"><Search size={32} /><span>{rv.noMatch}</span></div>;
    }

    return (
        <div className="rv2-groups">
            {groups.filter(g => g.items.length > 0).map(({ name, items }) => {
                const isCollapsed = collapsed.has(name);
                const displayName = resolveName(name);
                return (
                    <div key={name} className="rv2-group">
                        <button className="rv2-group-header" onClick={() => toggle(name)}>
                            <div className="rv2-group-header-left">
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                {icon}
                                <span className="rv2-group-name">{displayName}</span>
                            </div>
                            <span className="rv2-group-count">{items.length}</span>
                        </button>
                        {!isCollapsed && (
                            <div className="rv2-group-body">
                                {items.map((item, i) => renderRow(item, i))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────── Main component ─────────────────────── */

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

interface BackendData {
    total: number;
    groups: { module: string; count: number; endpoints: FlatEndpoint[] }[];
}

export default function RouteVisualization() {
    const rv = rvMock;
    const resolveName = (key: string) => resolveModuleName(key, rv);

    const [tab, setTab] = useState<TreeTab>('frontend');
    const [query, setQuery] = useState('');
    const [methodFilter, setMethodFilter] = useState('');

    // ── Backend: fetch live from /api/admin/routes ──
    const [backendData, setBackendData] = useState<BackendData | null>(null);
    const [backendLoading, setBackendLoading] = useState(false);
    const [backendError, setBackendError] = useState('');

    const fetchBackend = async () => {
        setBackendLoading(true);
        setBackendError('');
        try {
            const res = await apiClient.get<BackendData>('/admin/routes');
            setBackendData(res.data);
        } catch {
            setBackendError(rv.loadFail);
        } finally {
            setBackendLoading(false);
        }
    };

    useEffect(() => {
        if (tab === 'backend' && !backendData) fetchBackend();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    // ── Flatten backend data ──
    const allEndpoints = useMemo((): FlatEndpoint[] => {
        if (!backendData) return [];
        return backendData.groups.flatMap(g =>
            g.endpoints.map(e => ({ ...e, module: g.module }))
        );
    }, [backendData]);

    // ── Filter frontend ──
    const filteredRoutes = useMemo(() => {
        const q = query.toLowerCase();
        return FRONTEND_ROUTES.filter(r =>
            r.path.toLowerCase().includes(q) ||
            r.component?.toLowerCase().includes(q) ||
            r.module?.toLowerCase().includes(q)
        );
    }, [query]);

    // ── Filter backend ──
    const filteredEndpoints = useMemo(() => {
        const q = query.toLowerCase();
        return allEndpoints.filter(e => {
            const matchQ = e.path.toLowerCase().includes(q) ||
                e.handler?.toLowerCase().includes(q) ||
                e.module?.toLowerCase().includes(q) ||
                e.method.toLowerCase().includes(q) ||
                e.name?.toLowerCase().includes(q);
            const matchM = !methodFilter || e.method.includes(methodFilter);
            return matchQ && matchM;
        });
    }, [allEndpoints, query, methodFilter]);

    // ── Group frontend ──
    const frontendGroups = useMemo(() => {
        const map = new Map<string, FlatRoute[]>();
        for (const r of filteredRoutes) {
            const mod = r.module ?? 'routeVis.moduleNames.other';
            if (!map.has(mod)) map.set(mod, []);
            map.get(mod)!.push(r);
        }
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [filteredRoutes]);

    // ── Group backend ──
    const backendGroups = useMemo(() => {
        const map = new Map<string, FlatEndpoint[]>();
        for (const e of filteredEndpoints) {
            const mod = e.module ?? 'routeVis.moduleNames.other';
            if (!map.has(mod)) map.set(mod, []);
            map.get(mod)!.push(e);
        }
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [filteredEndpoints]);

    const switchTab = (t: TreeTab) => { setTab(t); setQuery(''); setMethodFilter(''); };

    return (
        <div className="rv2-container">
            {/* ── Header ── */}
            <div className="rv2-header">
                <div className="rv2-header-title">
                    <Activity size={20} className="rv2-title-icon" />
                    <h2>{rv.title}</h2>
                    <span className="rv2-live-badge">
                        <span className="rv2-live-dot" />
                        {rv.liveBadge}
                    </span>
                </div>
                <div className="rv2-tab-switcher">
                    <button className={`rv2-tab rv2-tab--frontend ${tab === 'frontend' ? 'active' : ''}`} onClick={() => switchTab('frontend')}>
                        <Globe size={14} />{rv.tabFrontend}
                        <span className="rv2-tab-count">{FRONTEND_ROUTES.length}</span>
                    </button>
                    <button className={`rv2-tab rv2-tab--backend ${tab === 'backend' ? 'active' : ''}`} onClick={() => switchTab('backend')}>
                        <Server size={14} />{rv.tabBackend}
                        <span className="rv2-tab-count">{backendData?.total ?? '…'}</span>
                    </button>
                </div>
            </div>

            {/* ── Stats ── */}
            <StatsBar tab={tab} routes={FRONTEND_ROUTES} endpoints={allEndpoints} rv={rv} />

            {/* ── Toolbar ── */}
            <div className="rv2-toolbar">
                <div className="rv2-search-wrap">
                    <Search size={14} className="rv2-search-icon" />
                    <input
                        className="rv2-search"
                        placeholder={tab === 'frontend' ? rv.searchRoutes : rv.searchEndpoints}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="rv2-search-clear" onClick={() => setQuery('')}><X size={12} /></button>
                    )}
                </div>

                {tab === 'backend' && (
                    <>
                        <div className="rv2-method-filters">
                            <Filter size={13} className="rv2-filter-icon" />
                            {HTTP_METHODS.map(m => {
                                const c = resolveMethodColor(m);
                                const active = methodFilter === m;
                                return (
                                    <button
                                        key={m}
                                        className={`rv2-method-filter ${active ? 'active' : ''}`}
                                        style={active ? { background: c.bg, color: c.text, borderColor: c.border } : {}}
                                        onClick={() => setMethodFilter(active ? '' : m)}
                                    >
                                        {m}
                                    </button>
                                );
                            })}
                        </div>
                        <button className="rv2-refresh-btn" onClick={fetchBackend} disabled={backendLoading} title={rv.retry}>
                            <RefreshCw size={13} className={backendLoading ? 'rv2-spinning' : ''} />
                        </button>
                    </>
                )}

                <div className="rv2-result-count">
                    {rv.resultCount
                        .replace('{filtered}', String(tab === 'frontend' ? filteredRoutes.length : filteredEndpoints.length))
                        .replace('{total}', String(tab === 'frontend' ? FRONTEND_ROUTES.length : allEndpoints.length))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="rv2-body">
                {tab === 'frontend' ? (
                    <GroupedList
                        groups={frontendGroups}
                        icon={<Layers size={13} className="rv2-group-icon" />}
                        rv={rv}
                        resolveName={resolveName}
                        renderRow={(r: FlatRoute, i) => (
                            <div key={i} className="rv2-fe-row">
                                <div className="rv2-fe-path">
                                    <Hash size={11} className="rv2-fe-hash" />
                                    <code className="rv2-path-code">{r.path}</code>
                                    {r.lazy && <span className="rv2-lazy-badge"><Zap size={10} />lazy</span>}
                                </div>
                                <div className="rv2-fe-meta">
                                    {r.component && <span className="rv2-component">{r.component}</span>}
                                    {r.guard && <GuardBadge guard={r.guard} rv={rv} />}
                                </div>
                            </div>
                        )}
                    />
                ) : backendLoading ? (
                    <div className="rv2-empty">
                        <RefreshCw size={28} className="rv2-spinning" style={{ color: 'var(--color-primary)' }} />
                        <span>{rv.loadingBackend}</span>
                    </div>
                ) : backendError ? (
                    <div className="rv2-empty rv2-error">
                        <AlertCircle size={32} />
                        <span>{backendError}</span>
                        <button className="rv2-retry-btn" onClick={fetchBackend}>{rv.retry}</button>
                    </div>
                ) : (
                    <GroupedList
                        groups={backendGroups}
                        icon={<Server size={13} className="rv2-group-icon api" />}
                        rv={rv}
                        resolveName={resolveName}
                        renderRow={(e: FlatEndpoint, i) => (
                            <div key={i} className="rv2-api-row">
                                <MethodBadge method={e.method} />
                                <code className="rv2-path-code api">{e.path}</code>
                                {e.handler && <span className="rv2-handler">{e.handler}</span>}
                                {e.name && <span className="rv2-url-name">#{e.name}</span>}
                            </div>
                        )}
                    />
                )}
            </div>

            {/* ── Footer ── */}
            <div className="rv2-footer">
                {tab === 'frontend' ? (
                    <>
                        <span className="rv2-legend-item"><Lock size={11} className="protected" /> {rv.legendProtected}</span>
                        <span className="rv2-legend-item"><Globe size={11} className="public" /> {rv.legendPublic}</span>
                        <span className="rv2-legend-item"><Zap size={11} className="lazy" /> {rv.legendLazy}</span>
                    </>
                ) : (
                    <>
                        {HTTP_METHODS.map(m => {
                            const c = resolveMethodColor(m);
                            return (
                                <span key={m} className="rv2-legend-item">
                                    <span className="rv2-legend-dot" style={{ background: c.text }} />{m}
                                </span>
                            );
                        })}
                        <span className="rv2-legend-item">
                            <span className="rv2-legend-dot" style={{ background: '#4f46e5' }} />{rv.multiMethod}
                        </span>
                        <span className="rv2-footer-source">
                            {rv.dataSource}
                        </span>
                    </>
                )}
                <span className="rv2-footer-hint">
                    <ExternalLink size={11} /> {rv.jwtHint}
                </span>
            </div>
        </div>
    );
}
