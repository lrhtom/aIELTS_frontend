import { useState, useMemo } from 'react';
import { frontendRouteTree } from '../../data/routeTreeData';
import { apiRouteTree } from '../../data/apiRouteTreeData';
import {
    Globe, Server, Search, ChevronDown, ChevronRight,
    Shield, Zap, Lock, ExternalLink, Hash, Layers,
    Activity, Filter, X,
} from 'lucide-react';
import '../../styles/route_visualization.css';

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
}

interface ModuleGroup<T> {
    name: string;
    label: string;
    items: T[];
    expanded: boolean;
}

/* ─────────────────────── Data flatteners ─────────────────────── */

function flattenFrontend(): FlatRoute[] {
    const result: FlatRoute[] = [];
    const tree = frontendRouteTree;
    for (const node of tree.children ?? []) {
        const mod = node.attributes?.module;
        if (mod) {
            for (const child of node.children ?? []) {
                result.push({
                    path: child.name,
                    component: child.attributes?.component,
                    guard: child.attributes?.guard,
                    lazy: child.attributes?.lazy === 'true',
                    module: mod,
                });
            }
        } else {
            result.push({
                path: node.name,
                component: node.attributes?.component,
                guard: node.attributes?.guard,
                lazy: node.attributes?.lazy === 'true',
                module: '顶层路由',
            });
        }
    }
    return result;
}

function flattenBackend(): FlatEndpoint[] {
    const result: FlatEndpoint[] = [];
    for (const mod of apiRouteTree.children ?? []) {
        const label = mod.attributes?.module ?? mod.name;
        for (const child of mod.children ?? []) {
            const parts = child.name.split(' ');
            result.push({
                method: parts[0],
                path: parts.slice(1).join(' '),
                handler: child.attributes?.handler,
                module: label,
            });
        }
    }
    return result;
}

/* ─────────────────────── Method colors ─────────────────────── */

const METHOD_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    GET:    { bg: 'rgba(16,185,129,0.1)',  text: '#059669', border: 'rgba(16,185,129,0.3)' },
    POST:   { bg: 'rgba(14,165,233,0.1)',  text: '#0284c7', border: 'rgba(14,165,233,0.3)' },
    PUT:    { bg: 'rgba(245,158,11,0.1)',  text: '#d97706', border: 'rgba(245,158,11,0.3)' },
    PATCH:  { bg: 'rgba(245,158,11,0.1)',  text: '#d97706', border: 'rgba(245,158,11,0.3)' },
    DELETE: { bg: 'rgba(239,68,68,0.1)',   text: '#dc2626', border: 'rgba(239,68,68,0.3)' },
};

function resolveMethodColor(raw: string) {
    const primary = raw.split('|')[0];
    if (raw.includes('|')) {
        return { bg: 'rgba(99,102,241,0.1)', text: '#4f46e5', border: 'rgba(99,102,241,0.3)' };
    }
    return METHOD_COLORS[primary] ?? { bg: 'rgba(120,113,108,0.08)', text: '#78716c', border: 'rgba(120,113,108,0.2)' };
}

function MethodBadge({ method }: { method: string }) {
    const c = resolveMethodColor(method);
    return (
        <span className="rv2-method-badge" style={{ background: c.bg, color: c.text, borderColor: c.border }}>
            {method}
        </span>
    );
}

/* ─────────────────────── Guard badge ─────────────────────── */

function GuardBadge({ guard }: { guard: string }) {
    if (guard === '—' || !guard) return null;
    const isPublic = guard === '公开';
    return (
        <span className={`rv2-guard-badge ${isPublic ? 'public' : 'protected'}`}>
            {isPublic ? <Globe size={10} /> : <Lock size={10} />}
            {guard}
        </span>
    );
}

/* ─────────────────────── Stats bar ─────────────────────── */

function StatsBar({ tab, routes, endpoints }: {
    tab: TreeTab;
    routes: FlatRoute[];
    endpoints: FlatEndpoint[];
}) {
    if (tab === 'frontend') {
        const protected_ = routes.filter(r => r.guard === 'Protected').length;
        const public_ = routes.filter(r => r.guard === '公开').length;
        const lazy = routes.filter(r => r.lazy).length;
        const mods = new Set(routes.map(r => r.module)).size;
        return (
            <div className="rv2-stats">
                <div className="rv2-stat"><span className="rv2-stat-num">{routes.length}</span><span className="rv2-stat-label">总路由</span></div>
                <div className="rv2-stat-divider" />
                <div className="rv2-stat"><span className="rv2-stat-num protected">{protected_}</span><span className="rv2-stat-label">需认证</span></div>
                <div className="rv2-stat"><span className="rv2-stat-num public">{public_}</span><span className="rv2-stat-label">公开</span></div>
                <div className="rv2-stat-divider" />
                <div className="rv2-stat"><span className="rv2-stat-num lazy">{lazy}</span><span className="rv2-stat-label">懒加载</span></div>
                <div className="rv2-stat"><span className="rv2-stat-num mods">{mods}</span><span className="rv2-stat-label">模块</span></div>
            </div>
        );
    }
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    const counts = methods.map(m => ({
        m, n: endpoints.filter(e => e.method.includes(m)).length,
    }));
    const mods = new Set(endpoints.map(e => e.module)).size;
    return (
        <div className="rv2-stats">
            <div className="rv2-stat"><span className="rv2-stat-num">{endpoints.length}</span><span className="rv2-stat-label">总端点</span></div>
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
            <div className="rv2-stat"><span className="rv2-stat-num mods">{mods}</span><span className="rv2-stat-label">模块</span></div>
        </div>
    );
}

/* ─────────────────────── Frontend explorer ─────────────────────── */

function FrontendExplorer({ routes, query }: { routes: FlatRoute[]; query: string }) {
    const grouped = useMemo(() => {
        const map = new Map<string, FlatRoute[]>();
        for (const r of routes) {
            const mod = r.module ?? '顶层路由';
            if (!map.has(mod)) map.set(mod, []);
            map.get(mod)!.push(r);
        }
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [routes]);

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

    const toggle = (name: string) =>
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });

    if (routes.length === 0) {
        return <div className="rv2-empty"><Search size={32} /><span>没有匹配的路由</span></div>;
    }

    return (
        <div className="rv2-groups">
            {grouped.map(({ name, items }) => {
                const isCollapsed = collapsed.has(name);
                return (
                    <div key={name} className="rv2-group">
                        <button className="rv2-group-header" onClick={() => toggle(name)}>
                            <div className="rv2-group-header-left">
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                <Layers size={14} className="rv2-group-icon" />
                                <span className="rv2-group-name">{name}</span>
                            </div>
                            <span className="rv2-group-count">{items.length}</span>
                        </button>
                        {!isCollapsed && (
                            <div className="rv2-group-body">
                                {items.map((r, i) => (
                                    <div key={i} className="rv2-fe-row">
                                        <div className="rv2-fe-path">
                                            <Hash size={11} className="rv2-fe-hash" />
                                            <code className="rv2-path-code">{r.path}</code>
                                            {r.lazy && (
                                                <span className="rv2-lazy-badge"><Zap size={10} />lazy</span>
                                            )}
                                        </div>
                                        <div className="rv2-fe-meta">
                                            {r.component && (
                                                <span className="rv2-component">{r.component}</span>
                                            )}
                                            {r.guard && <GuardBadge guard={r.guard} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* ─────────────────────── Backend explorer ─────────────────────── */

function BackendExplorer({ endpoints, query, methodFilter }: {
    endpoints: FlatEndpoint[];
    query: string;
    methodFilter: string;
}) {
    const grouped = useMemo(() => {
        const map = new Map<string, FlatEndpoint[]>();
        for (const e of endpoints) {
            const mod = e.module ?? '其他';
            if (!map.has(mod)) map.set(mod, []);
            map.get(mod)!.push(e);
        }
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [endpoints]);

    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const toggle = (name: string) =>
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(name) ? next.delete(name) : next.add(name);
            return next;
        });

    if (endpoints.length === 0) {
        return <div className="rv2-empty"><Search size={32} /><span>没有匹配的端点</span></div>;
    }

    return (
        <div className="rv2-groups">
            {grouped.map(({ name, items }) => {
                const isCollapsed = collapsed.has(name);
                return (
                    <div key={name} className="rv2-group">
                        <button className="rv2-group-header" onClick={() => toggle(name)}>
                            <div className="rv2-group-header-left">
                                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                <Server size={13} className="rv2-group-icon api" />
                                <span className="rv2-group-name">{name}</span>
                            </div>
                            <span className="rv2-group-count">{items.length}</span>
                        </button>
                        {!isCollapsed && (
                            <div className="rv2-group-body">
                                {items.map((e, i) => (
                                    <div key={i} className="rv2-api-row">
                                        <MethodBadge method={e.method} />
                                        <code className="rv2-path-code api">/api/{e.path.replace(/^\//, '')}</code>
                                        {e.handler && (
                                            <span className="rv2-handler">{e.handler}</span>
                                        )}
                                    </div>
                                ))}
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

export default function RouteVisualization() {
    const [tab, setTab] = useState<TreeTab>('frontend');
    const [query, setQuery] = useState('');
    const [methodFilter, setMethodFilter] = useState<string>('');

    const allRoutes = useMemo(() => flattenFrontend(), []);
    const allEndpoints = useMemo(() => flattenBackend(), []);

    const filteredRoutes = useMemo(() => {
        const q = query.toLowerCase();
        return allRoutes.filter(r =>
            r.path.toLowerCase().includes(q) ||
            r.component?.toLowerCase().includes(q) ||
            r.module?.toLowerCase().includes(q)
        );
    }, [allRoutes, query]);

    const filteredEndpoints = useMemo(() => {
        const q = query.toLowerCase();
        return allEndpoints.filter(e => {
            const matchesQuery =
                e.path.toLowerCase().includes(q) ||
                e.handler?.toLowerCase().includes(q) ||
                e.module?.toLowerCase().includes(q) ||
                e.method.toLowerCase().includes(q);
            const matchesMethod = !methodFilter || e.method.includes(methodFilter);
            return matchesQuery && matchesMethod;
        });
    }, [allEndpoints, query, methodFilter]);

    return (
        <div className="rv2-container">
            {/* ── Header ── */}
            <div className="rv2-header">
                <div className="rv2-header-title">
                    <Activity size={20} className="rv2-title-icon" />
                    <h2>路由可视化</h2>
                </div>
                <div className="rv2-tab-switcher">
                    <button
                        className={`rv2-tab ${tab === 'frontend' ? 'active' : ''}`}
                        onClick={() => { setTab('frontend'); setQuery(''); setMethodFilter(''); }}
                    >
                        <Globe size={14} />
                        前端路由
                        <span className="rv2-tab-count">{allRoutes.length}</span>
                    </button>
                    <button
                        className={`rv2-tab ${tab === 'backend' ? 'active' : ''}`}
                        onClick={() => { setTab('backend'); setQuery(''); setMethodFilter(''); }}
                    >
                        <Server size={14} />
                        后端 API
                        <span className="rv2-tab-count">{allEndpoints.length}</span>
                    </button>
                </div>
            </div>

            {/* ── Stats dashboard ── */}
            <StatsBar tab={tab} routes={allRoutes} endpoints={allEndpoints} />

            {/* ── Toolbar: search + method filter ── */}
            <div className="rv2-toolbar">
                <div className="rv2-search-wrap">
                    <Search size={14} className="rv2-search-icon" />
                    <input
                        className="rv2-search"
                        placeholder={tab === 'frontend' ? '搜索路由、组件名…' : '搜索路径、Handler…'}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    {query && (
                        <button className="rv2-search-clear" onClick={() => setQuery('')}>
                            <X size={12} />
                        </button>
                    )}
                </div>

                {tab === 'backend' && (
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
                )}

                <div className="rv2-result-count">
                    {tab === 'frontend'
                        ? `${filteredRoutes.length} / ${allRoutes.length} 条`
                        : `${filteredEndpoints.length} / ${allEndpoints.length} 条`}
                </div>
            </div>

            {/* ── Explorer body ── */}
            <div className="rv2-body">
                {tab === 'frontend' ? (
                    <FrontendExplorer routes={filteredRoutes} query={query} />
                ) : (
                    <BackendExplorer endpoints={filteredEndpoints} query={query} methodFilter={methodFilter} />
                )}
            </div>

            {/* ── Footer legend ── */}
            <div className="rv2-footer">
                {tab === 'frontend' ? (
                    <>
                        <span className="rv2-legend-item">
                            <Lock size={11} className="protected" /> Protected — 需要登录
                        </span>
                        <span className="rv2-legend-item">
                            <Globe size={11} className="public" /> 公开 — 无需认证
                        </span>
                        <span className="rv2-legend-item">
                            <Zap size={11} className="lazy" /> lazy — 按需加载
                        </span>
                    </>
                ) : (
                    <>
                        {HTTP_METHODS.map(m => {
                            const c = resolveMethodColor(m);
                            return (
                                <span key={m} className="rv2-legend-item">
                                    <span className="rv2-legend-dot" style={{ background: c.text }} />
                                    {m}
                                </span>
                            );
                        })}
                        <span className="rv2-legend-item">
                            <span className="rv2-legend-dot" style={{ background: '#4f46e5' }} />
                            多方法
                        </span>
                    </>
                )}
                <span className="rv2-footer-hint">
                    <ExternalLink size={11} /> 所有 API 均需 JWT Bearer Token
                </span>
            </div>
        </div>
    );
}
