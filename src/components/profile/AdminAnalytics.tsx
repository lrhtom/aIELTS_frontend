import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';
import {
    ResponsiveContainer,
    BarChart, Bar,
    LineChart, Line,
    PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from 'recharts';

// ── API response shapes (mirror api/auth/admin_analytics_views.py) ──
interface SkillAccuracy {
    attempts: number; users: number; questions: number; correct: number; accuracy: number; avgBand: number | null;
}
interface BandSkill { sessions?: number; exams?: number; users: number; avgBand: number | null; }
interface WritingOv { corrections: number; users: number; avgBand: number | null; }
interface Overview {
    users: { total: number; active: number };
    reading: SkillAccuracy;
    listening: SkillAccuracy;
    speaking: BandSkill;
    writing: WritingOv;
    mock: BandSkill;
    overall: { avgBand: number | null };
}

interface UserRow {
    id: number; username: string; email: string; attempts: number; date_joined: string | null; last_login: string | null;
}
interface PaginatedUsers { count: number; results: UserRow[]; }

interface SkillDetail {
    attempts: number; questions: number; correct: number; accuracy: number; band: number | null;
    recent: { id: number; title: string; date: string | null; correct: number; total: number; band: number | null }[];
}
interface SpeakingDetail {
    sessions: number; avgBand: number | null; skills_avg: Record<string, number>;
    by_mode: Record<string, number>; trend: { id: number; date: string; mode: string; overall: number; dims: Record<string, number> }[];
}
interface WritingDetail {
    corrections: number; avgBand: number | null; trend: { id: number; date: string; task: string; overall: number }[];
}
interface MockDetail {
    exams: number; avgOverall: number | null;
    reports: { id: number; title: string; date: string | null; overall: number; bands: Record<string, number> }[];
}
interface UserDetail {
    user: { id: number; username: string; email: string; date_joined: string | null; last_login: string | null };
    reading: SkillDetail; listening: SkillDetail;
    speaking: SpeakingDetail; writing: WritingDetail; mock: MockDetail;
    summary: { readingBand: number | null; listeningBand: number | null; speakingBand: number | null; writingBand: number | null; overallBand: number | null };
}

type DetailView = 'summary' | 'reading' | 'listening' | 'speaking' | 'writing' | 'mock';
const DETAIL_VIEWS: DetailView[] = ['summary', 'reading', 'listening', 'speaking', 'writing', 'mock'];

const SKILL_COLORS: Record<string, string> = {
    reading: '#10b981', listening: '#8b5cf6', speaking: '#f97316', writing: '#3b82f6', mock: '#0d9488', overall: '#0d9488',
};
const PIE_COLORS = ['#0d9488', '#8b5cf6', '#f97316', '#3b82f6', '#10b981', '#e11d48', '#f59e0b', '#64748b'];

const AXIS_STROKE = 'var(--color-text-secondary)';
const GRID_STROKE = 'var(--color-border)';
const TOOLTIP_STYLE = { background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' };

/** ISO ('...T...') → MM-DD; 'MM-DD HH:MM' → 'MM-DD'. */
function shortLabel(s: string | null): string {
    if (!s) return '';
    if (s.includes('T')) {
        const d = new Date(s);
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    return s.slice(0, 5);
}

export default function AdminAnalytics() {
    const { t } = useLang();
    const [mode, setMode] = useState<'overview' | 'user'>('overview');

    const [overview, setOverview] = useState<Overview | null>(null);
    const [ovLoading, setOvLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<UserRow[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [detail, setDetail] = useState<UserDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailView, setDetailView] = useState<DetailView>('summary');

    const fmtBand = (b: number | null | undefined) => (b == null ? t('profile.admin.analytics.noBand') : b.toFixed(1));
    const fmtPct = (a: number) => `${(a * 100).toFixed(1)}%`;
    const skillLabel = (k: string) => t(`profile.admin.analytics.skills.${k}`);
    const noChart = () => <div className="an-nochart">{t('profile.admin.analytics.noChartData')}</div>;

    useEffect(() => {
        (async () => {
            setOvLoading(true);
            try {
                const res = await apiClient.get<Overview>('/admin/analytics/overview');
                setOverview(res.data);
            } catch (e) {
                console.error('Failed to load overview:', e);
                toast.error(t('common.error'));
            } finally {
                setOvLoading(false);
            }
        })();
    }, [t]);

    const fetchUsers = useCallback(async (q: string) => {
        setUsersLoading(true);
        try {
            const res = await apiClient.get<PaginatedUsers>(`/admin/analytics/users?search=${encodeURIComponent(q)}&page_size=20`);
            setUsers(res.data.results);
        } catch (e) {
            console.error('Failed to load users:', e);
            toast.error(t('common.error'));
        } finally {
            setUsersLoading(false);
        }
    }, [t]);

    useEffect(() => {
        if (mode === 'user' && !detail) fetchUsers('');
    }, [mode, detail, fetchUsers]);

    const openUser = async (id: number) => {
        setDetailLoading(true);
        setDetailView('summary');
        try {
            const res = await apiClient.get<UserDetail>(`/admin/analytics/user/${id}`);
            setDetail(res.data);
        } catch (e) {
            console.error('Failed to load user detail:', e);
            toast.error(t('common.error'));
        } finally {
            setDetailLoading(false);
        }
    };

    // Reusable band bar chart: data = [{ key, name, band }]
    const bandBar = (data: { key: string; name: string; band: number }[]) => {
        if (data.length === 0) return noChart();
        return (
            <ResponsiveContainer width="99%" height={240} minWidth={0}>
                <BarChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="name" fontSize={11} stroke={AXIS_STROKE} />
                    <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} fontSize={11} stroke={AXIS_STROKE} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(13,148,136,0.06)' }} />
                    <Bar dataKey="band" name={t('profile.admin.analytics.band')} radius={[6, 6, 0, 0]}>
                        {data.map(d => <Cell key={d.key} fill={SKILL_COLORS[d.key] || '#0d9488'} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        );
    };

    // Reusable trend line chart: data = [{ x, band }]
    const trendLine = (data: { x: string; band: number }[], color: string) => {
        if (data.length < 2) return noChart();
        return (
            <ResponsiveContainer width="99%" height={220} minWidth={0}>
                <LineChart data={data} margin={{ top: 12, right: 12, bottom: 4, left: -8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="x" fontSize={11} stroke={AXIS_STROKE} />
                    <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} fontSize={11} stroke={AXIS_STROKE} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="band" name={t('profile.admin.analytics.band')} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    // Reusable pie chart: data = [{ name, value }]
    const piePlot = (data: { name: string; value: number }[]) => {
        if (data.every(d => d.value === 0)) return noChart();
        return (
            <ResponsiveContainer width="99%" height={240} minWidth={0}>
                <PieChart>
                    <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {data.map((d, i) => <Cell key={d.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        );
    };

    // ── Overview ──
    const renderOverview = () => {
        if (ovLoading) return <div className="an-loading">{t('common.loading')}</div>;
        if (!overview) return <div className="an-empty">{t('profile.admin.analytics.noData')}</div>;

        const skillCards: { key: string; band: number | null; sub: { label: string; value: string }[] }[] = [
            { key: 'reading', band: overview.reading.avgBand, sub: [
                { label: t('profile.admin.analytics.attempts'), value: String(overview.reading.attempts) },
                { label: t('profile.admin.analytics.participants'), value: String(overview.reading.users) },
                { label: t('profile.admin.analytics.accuracy'), value: fmtPct(overview.reading.accuracy) },
            ] },
            { key: 'listening', band: overview.listening.avgBand, sub: [
                { label: t('profile.admin.analytics.attempts'), value: String(overview.listening.attempts) },
                { label: t('profile.admin.analytics.participants'), value: String(overview.listening.users) },
                { label: t('profile.admin.analytics.accuracy'), value: fmtPct(overview.listening.accuracy) },
            ] },
            { key: 'speaking', band: overview.speaking.avgBand, sub: [
                { label: t('profile.admin.analytics.sessions'), value: String(overview.speaking.sessions ?? 0) },
                { label: t('profile.admin.analytics.participants'), value: String(overview.speaking.users) },
            ] },
            { key: 'writing', band: overview.writing.avgBand, sub: [
                { label: t('profile.admin.analytics.corrections'), value: String(overview.writing.corrections) },
                { label: t('profile.admin.analytics.participants'), value: String(overview.writing.users) },
            ] },
            { key: 'mock', band: overview.mock.avgBand, sub: [
                { label: t('profile.admin.analytics.exams'), value: String(overview.mock.exams ?? 0) },
                { label: t('profile.admin.analytics.participants'), value: String(overview.mock.users) },
            ] },
        ];

        const bandBarData = skillCards
            .filter(c => c.band != null)
            .map(c => ({ key: c.key, name: skillLabel(c.key), band: c.band as number }));

        const activePie = [
            { name: t('profile.admin.analytics.activeLabel'), value: overview.users.active },
            { name: t('profile.admin.analytics.inactiveLabel'), value: Math.max(0, overview.users.total - overview.users.active) },
        ];

        return (
            <>
                <div className="an-top-row">
                    <div className="an-top-card">
                        <div className="an-top-value">{overview.users.total}</div>
                        <div className="an-top-label">{t('profile.admin.analytics.usersTotal')}</div>
                    </div>
                    <div className="an-top-card">
                        <div className="an-top-value">{overview.users.active}</div>
                        <div className="an-top-label">{t('profile.admin.analytics.usersActive')}</div>
                    </div>
                    <div className="an-top-card highlight">
                        <div className="an-top-value">{fmtBand(overview.overall.avgBand)}</div>
                        <div className="an-top-label">{t('profile.admin.analytics.overallBand')}</div>
                    </div>
                </div>

                <div className="an-charts-2col">
                    <div className="an-chart-box wide">
                        <div className="an-chart-title">{t('profile.admin.analytics.chartBandBySkill')}</div>
                        {bandBar(bandBarData)}
                    </div>
                    <div className="an-chart-box">
                        <div className="an-chart-title">{t('profile.admin.analytics.chartUserActivity')}</div>
                        {piePlot(activePie)}
                    </div>
                </div>

                <div className="an-skill-grid">
                    {skillCards.map(card => (
                        <div className="an-skill-card" key={card.key}>
                            <div className="an-skill-name">{skillLabel(card.key)}</div>
                            <div className="an-skill-band">
                                <span className="an-band-value" style={{ color: SKILL_COLORS[card.key] }}>{fmtBand(card.band)}</span>
                                <span className="an-band-cap">{t('profile.admin.analytics.avgBand')}</span>
                            </div>
                            <div className="an-skill-subs">
                                {card.sub.map(s => (
                                    <div className="an-sub" key={s.label}>
                                        <span className="an-sub-label">{s.label}</span>
                                        <span className="an-sub-value">{s.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );
    };

    // ── By-user: list ──
    const renderUserList = () => (
        <>
            <div className="an-search">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchUsers(search.trim()); }}
                    placeholder={t('profile.admin.analytics.searchPlaceholder')}
                />
                <button onClick={() => fetchUsers(search.trim())}>🔍</button>
            </div>
            {usersLoading ? (
                <div className="an-loading">{t('common.loading')}</div>
            ) : users.length === 0 ? (
                <div className="an-empty">{t('profile.admin.analytics.noData')}</div>
            ) : (
                <div className="an-user-list">
                    {users.map(u => (
                        <button className="an-user-row" key={u.id} onClick={() => openUser(u.id)}>
                            <span className="an-user-name">@{u.username}</span>
                            <span className="an-user-email">{u.email || '—'}</span>
                            <span className="an-user-attempts">
                                {t('profile.admin.analytics.userAttempts').replace('{n}', String(u.attempts))}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </>
    );

    // ── By-user: detail ──
    const renderUserDetail = () => {
        if (detailLoading || !detail) return <div className="an-loading">{t('profile.admin.analytics.loadingUser')}</div>;
        const s = detail.summary;

        const summaryBar = ([
            { key: 'reading', band: s.readingBand },
            { key: 'listening', band: s.listeningBand },
            { key: 'speaking', band: s.speakingBand },
            { key: 'writing', band: s.writingBand },
            { key: 'overall', band: s.overallBand },
        ] as const)
            .filter(d => d.band != null)
            .map(d => ({ key: d.key, name: d.key === 'overall' ? t('profile.admin.analytics.overallBand') : skillLabel(d.key), band: d.band as number }));

        // reading/listening recent are newest-first → reverse to chronological
        const skillTrend = (d: SkillDetail) =>
            [...d.recent].reverse()
                .filter(r => r.band != null)
                .map(r => ({ x: shortLabel(r.date), band: r.band as number }));

        const speakingTrend = detail.speaking.trend.map(r => ({ x: shortLabel(r.date), band: r.overall }));
        const writingTrend = detail.writing.trend.map(r => ({ x: shortLabel(r.date), band: r.overall }));
        const mockTrend = [...detail.mock.reports].reverse().map(r => ({ x: shortLabel(r.date), band: r.overall }));

        const dimsBar = Object.entries(detail.speaking.skills_avg).map(([k, v]) => ({ key: k, name: k, band: v }));
        const modePie = Object.entries(detail.speaking.by_mode).map(([k, v]) => ({ name: k, value: v }));

        const viewLabel = (v: DetailView) => (v === 'summary' ? t('profile.admin.analytics.viewSummary') : skillLabel(v));

        const skillSection = (sk: 'reading' | 'listening') => {
            const d = detail[sk];
            return (
                <div className="an-section">
                    <div className="an-section-head">
                        <h4>{skillLabel(sk)}</h4>
                        <span className="an-section-meta">
                            {t('profile.admin.analytics.attempts')} {d.attempts} · {t('profile.admin.analytics.accuracy')} {fmtPct(d.accuracy)} · {t('profile.admin.analytics.band')} {fmtBand(d.band)}
                        </span>
                    </div>
                    {trendLine(skillTrend(d), SKILL_COLORS[sk])}
                </div>
            );
        };

        return (
            <div className="an-detail">
                <button className="an-back" onClick={() => setDetail(null)}>{t('profile.admin.analytics.backToList')}</button>

                <div className="an-detail-head">
                    <span className="an-detail-user">@{detail.user.username}</span>
                    <span className="an-detail-email">{detail.user.email || '—'}</span>
                </div>

                {/* 单选按钮：一次只看一个视图，避免一页塞满所有图 */}
                <div className="an-radio-group" role="radiogroup">
                    {DETAIL_VIEWS.map(v => (
                        <label key={v} className={`an-radio ${detailView === v ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="an-detail-view"
                                checked={detailView === v}
                                onChange={() => setDetailView(v)}
                            />
                            <span>{viewLabel(v)}</span>
                        </label>
                    ))}
                </div>

                {detailView === 'summary' && (
                    <div className="an-section">
                        <div className="an-chart-title">{t('profile.admin.analytics.summaryTitle')}</div>
                        {bandBar(summaryBar)}
                    </div>
                )}

                {detailView === 'reading' && skillSection('reading')}
                {detailView === 'listening' && skillSection('listening')}

                {detailView === 'speaking' && (
                    <div className="an-section">
                        <div className="an-section-head">
                            <h4>{skillLabel('speaking')}</h4>
                            <span className="an-section-meta">
                                {t('profile.admin.analytics.sessions')} {detail.speaking.sessions} · {t('profile.admin.analytics.band')} {fmtBand(detail.speaking.avgBand)}
                            </span>
                        </div>
                        <div className="an-chart-sub">{t('profile.admin.analytics.chartTrend')}</div>
                        {trendLine(speakingTrend, SKILL_COLORS.speaking)}
                        {dimsBar.length > 0 && (
                            <>
                                <div className="an-chart-sub">{t('profile.admin.analytics.chartDims')}</div>
                                {bandBar(dimsBar)}
                            </>
                        )}
                        {modePie.length > 0 && (
                            <>
                                <div className="an-chart-sub">{t('profile.admin.analytics.chartByMode')}</div>
                                {piePlot(modePie)}
                            </>
                        )}
                    </div>
                )}

                {detailView === 'writing' && (
                    <div className="an-section">
                        <div className="an-section-head">
                            <h4>{skillLabel('writing')}</h4>
                            <span className="an-section-meta">
                                {t('profile.admin.analytics.corrections')} {detail.writing.corrections} · {t('profile.admin.analytics.band')} {fmtBand(detail.writing.avgBand)}
                            </span>
                        </div>
                        {trendLine(writingTrend, SKILL_COLORS.writing)}
                    </div>
                )}

                {detailView === 'mock' && (
                    <div className="an-section">
                        <div className="an-section-head">
                            <h4>{skillLabel('mock')}</h4>
                            <span className="an-section-meta">
                                {t('profile.admin.analytics.exams')} {detail.mock.exams} · {t('profile.admin.analytics.overallRow')} {fmtBand(detail.mock.avgOverall)}
                            </span>
                        </div>
                        {trendLine(mockTrend, SKILL_COLORS.mock)}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="admin-analytics">
            <div className="an-header">
                <h2>{t('profile.admin.analytics.heading')}</h2>
                <div className="an-tabs">
                    <button className={mode === 'overview' ? 'active' : ''} onClick={() => setMode('overview')}>
                        {t('profile.admin.analytics.tabOverview')}
                    </button>
                    <button className={mode === 'user' ? 'active' : ''} onClick={() => setMode('user')}>
                        {t('profile.admin.analytics.tabByUser')}
                    </button>
                </div>
            </div>

            {mode === 'overview'
                ? renderOverview()
                : (detail || detailLoading) ? renderUserDetail() : renderUserList()}

            <style>{`
                .admin-analytics { padding: 20px; max-width: 980px; }
                .an-header {
                    display: flex; justify-content: space-between; align-items: center;
                    flex-wrap: wrap; gap: 12px; margin-bottom: 22px;
                }
                .an-header h2 { margin: 0; font-size: 1.25rem; color: var(--color-text); }
                .an-tabs { display: inline-flex; gap: 4px; background: var(--color-bg); border: 1px solid var(--color-border); border-radius: 10px; padding: 4px; }
                .an-tabs button {
                    padding: 7px 16px; border: none; background: transparent; color: var(--color-text-secondary);
                    border-radius: 7px; cursor: pointer; font-weight: 600; font-size: 0.85rem; transition: all 0.15s;
                }
                .an-tabs button.active { background: var(--color-primary); color: #fff; }
                .an-loading, .an-empty {
                    text-align: center; padding: 60px; color: var(--color-text-secondary);
                    background: var(--color-surface); border-radius: 12px; border: 1px dashed var(--color-border);
                }
                .an-nochart { text-align: center; padding: 40px 10px; color: var(--color-text-secondary); font-size: 0.85rem; }
                .an-top-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 16px; }
                .an-top-card {
                    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;
                    padding: 20px; text-align: center;
                }
                .an-top-card.highlight { border-color: var(--color-primary); background: rgba(13, 148, 136, 0.06); }
                .an-top-value { font-size: 2rem; font-weight: 800; color: var(--color-text); }
                .an-top-card.highlight .an-top-value { color: var(--color-primary); }
                .an-top-label { font-size: 0.82rem; color: var(--color-text-secondary); margin-top: 4px; }
                .an-charts-2col { display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px; margin-bottom: 16px; }
                .an-chart-box {
                    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 16px;
                }
                .an-chart-title { font-size: 0.92rem; font-weight: 700; color: var(--color-text); margin-bottom: 10px; }
                .an-chart-sub { font-size: 0.82rem; font-weight: 600; color: var(--color-text-secondary); margin: 14px 0 4px; }
                .an-skill-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; }
                .an-skill-card {
                    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 18px 20px;
                }
                .an-skill-name { font-size: 0.95rem; font-weight: 700; color: var(--color-text); margin-bottom: 10px; }
                .an-skill-band { display: flex; align-items: baseline; gap: 6px; margin-bottom: 14px; }
                .an-band-value { font-size: 1.9rem; font-weight: 800; }
                .an-band-cap { font-size: 0.72rem; color: var(--color-text-secondary); }
                .an-skill-subs { display: flex; flex-direction: column; gap: 6px; }
                .an-sub { display: flex; justify-content: space-between; font-size: 0.82rem; }
                .an-sub-label { color: var(--color-text-secondary); }
                .an-sub-value { color: var(--color-text); font-weight: 600; }
                .an-search { display: flex; gap: 8px; margin-bottom: 16px; }
                .an-search input {
                    flex: 1; padding: 10px 14px; border-radius: 10px; border: 2px solid var(--color-border);
                    background: var(--color-bg); color: var(--color-text); font-size: 0.9rem; font-family: inherit;
                }
                .an-search input:focus { outline: none; border-color: var(--color-primary); }
                .an-search button {
                    padding: 0 16px; border: 1px solid var(--color-border); background: var(--color-surface);
                    border-radius: 10px; cursor: pointer;
                }
                .an-user-list { display: flex; flex-direction: column; gap: 8px; }
                .an-user-row {
                    display: flex; align-items: center; gap: 12px; text-align: left;
                    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 10px;
                    padding: 12px 16px; cursor: pointer; transition: all 0.15s; font-family: inherit;
                }
                .an-user-row:hover { border-color: var(--color-primary); }
                .an-user-name { font-weight: 700; color: var(--color-text); }
                .an-user-email { color: var(--color-text-secondary); font-size: 0.85rem; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .an-user-attempts { color: var(--color-primary); font-size: 0.82rem; font-weight: 600; white-space: nowrap; }
                .an-back {
                    background: transparent; border: none; color: var(--color-primary); cursor: pointer;
                    font-weight: 600; font-size: 0.88rem; padding: 0; margin-bottom: 16px;
                }
                .an-detail-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
                .an-detail-user { font-size: 1.15rem; font-weight: 800; color: var(--color-text); }
                .an-detail-email { color: var(--color-text-secondary); font-size: 0.85rem; }
                .an-radio-group { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
                .an-radio {
                    display: inline-flex; align-items: center; gap: 6px;
                    padding: 7px 14px; border: 1.5px solid var(--color-border); border-radius: 999px;
                    background: var(--color-surface); color: var(--color-text); cursor: pointer;
                    font-size: 0.85rem; font-weight: 600; transition: all 0.15s; user-select: none;
                }
                .an-radio:hover { border-color: var(--color-primary); }
                .an-radio.active { background: var(--color-primary); border-color: var(--color-primary); color: #fff; }
                .an-radio input { accent-color: #fff; margin: 0; cursor: pointer; }
                .an-radio:not(.active) input { accent-color: var(--color-primary); }
                .an-section {
                    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;
                    padding: 16px 20px; margin-bottom: 12px;
                }
                .an-section-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
                .an-section-head h4 { margin: 0; font-size: 1rem; color: var(--color-text); }
                .an-section-meta { font-size: 0.82rem; color: var(--color-text-secondary); }
                @media (max-width: 720px) {
                    .an-charts-2col { grid-template-columns: 1fr; }
                }
                @media (max-width: 600px) {
                    .an-top-row { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}
