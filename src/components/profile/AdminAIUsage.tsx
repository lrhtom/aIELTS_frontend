import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    Legend,
    CartesianGrid,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────────────
type Mode = 'all' | 'user';
type ChartType = 'bar' | 'line';

interface UsageSeriesPoint {
    date: string;
    at_consumed: number;
    call_count: number;
}

interface UsageResponse {
    mode: Mode;
    days: number;
    user: { id: number; username: string; nickname: string; at_balance: number } | null;
    series: UsageSeriesPoint[];
    totals: { at_consumed: number; call_count: number };
}

interface UserPickResult {
    id: number;
    username: string;
    nickname: string;
    is_staff: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminAIUsage() {
    const { translations } = useLang();
    const t = translations.profile.admin.aiUsage;
    const [mode, setMode] = useState<Mode>('all');
    const [days, setDays] = useState<number>(30);
    const [chartType, setChartType] = useState<ChartType>('bar');
    const [data, setData] = useState<UsageResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');

    // Single-user picker state
    const [pickedUser, setPickedUser] = useState<UserPickResult | null>(null);
    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<UserPickResult[]>([]);
    const [searchOpen, setSearchOpen] = useState(false);

    useEffect(() => {
        const run = async () => {
            if (mode === 'user' && !pickedUser) {
                setData(null);
                return;
            }
            setLoading(true);
            setError('');
            try {
                const params: Record<string, string> = { mode, days: String(days) };
                if (mode === 'user' && pickedUser) params.user_id = String(pickedUser.id);
                const res = await apiClient.get<UsageResponse>('/admin/ai-usage', { params });
                setData(res.data);
            } catch (e: unknown) {
                const err = e as { response?: { data?: { error?: string } }; message?: string };
                setError(err.response?.data?.error || err.message || 'Load failed');
            } finally {
                setLoading(false);
            }
        };
        run();
    }, [mode, days, pickedUser]);

    // Debounced user search
    useEffect(() => {
        if (mode !== 'user') return;
        const timer = setTimeout(async () => {
            try {
                const res = await apiClient.get<{ results: UserPickResult[] }>('/admin/users/search', {
                    params: { q: searchQ, limit: 15 },
                });
                setSearchResults(res.data.results);
            } catch {
                setSearchResults([]);
            }
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQ, mode]);

    const chartData = useMemo(() => data?.series || [], [data]);

    const renderChart = () => {
        if (!chartData.length) return null;
        const commonAxes = (
            <>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" fontSize={11} stroke="var(--color-text-secondary)" />
                <YAxis yAxisId="left" fontSize={11} stroke="#0d9488" />
                <YAxis yAxisId="right" orientation="right" fontSize={11} stroke="#8b5cf6" />
                <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
            </>
        );
        return chartType === 'bar' ? (
            <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    {commonAxes}
                    <Bar yAxisId="left" dataKey="at_consumed" name={t.metricAt} fill="#0d9488" />
                    <Bar yAxisId="right" dataKey="call_count" name={t.metricCalls} fill="#8b5cf6" />
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <ResponsiveContainer width="100%" height={360}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    {commonAxes}
                    <Line yAxisId="left" type="monotone" dataKey="at_consumed" name={t.metricAt} stroke="#0d9488" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="call_count" name={t.metricCalls} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: 'var(--color-text)' }}>{t.heading}</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                    {t.description}
                </p>
            </div>

            {/* Controls row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', padding: 4, borderRadius: 8 }}>
                    <button
                        onClick={() => setMode('all')}
                        style={pillStyle(mode === 'all')}
                    >{t.modeAll}</button>
                    <button
                        onClick={() => setMode('user')}
                        style={pillStyle(mode === 'user')}
                    >{t.modeUser}</button>
                </div>

                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    style={selectStyle}
                >
                    <option value={7}>{t.daysLastN.replace('{n}', '7')}</option>
                    <option value={30}>{t.daysLastN.replace('{n}', '30')}</option>
                    <option value={90}>{t.daysLastN.replace('{n}', '90')}</option>
                    <option value={180}>{t.daysLastN.replace('{n}', '180')}</option>
                    <option value={365}>{t.daysLastN.replace('{n}', '365')}</option>
                </select>

                <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', padding: 4, borderRadius: 8 }}>
                    <button onClick={() => setChartType('bar')} style={pillStyle(chartType === 'bar')}>{t.chartBar}</button>
                    <button onClick={() => setChartType('line')} style={pillStyle(chartType === 'line')}>{t.chartLine}</button>
                </div>
            </div>

            {/* User picker — only visible in single-user mode */}
            {mode === 'user' && (
                <div style={{ position: 'relative', marginBottom: 16, maxWidth: 420 }}>
                    <input
                        type="text"
                        placeholder={pickedUser ? t.userPickedPlaceholder.replace('{name}', pickedUser.username).replace('{id}', String(pickedUser.id)) : t.userSearchPlaceholder}
                        value={searchQ}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(e) => { setSearchQ(e.target.value); setSearchOpen(true); }}
                        style={{
                            width: '100%', padding: '8px 12px', fontSize: 13,
                            borderRadius: 8, border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)', color: 'var(--color-text)',
                        }}
                    />
                    {searchOpen && searchResults.length > 0 && (
                        <div style={{
                            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 8, maxHeight: 260, overflowY: 'auto', zIndex: 20,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                        }}>
                            {searchResults.map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => {
                                        setPickedUser(u);
                                        setSearchOpen(false);
                                        setSearchQ('');
                                    }}
                                    style={{
                                        display: 'block', width: '100%', textAlign: 'left',
                                        padding: '8px 12px', fontSize: 13, background: 'transparent',
                                        border: 'none', cursor: 'pointer', color: 'var(--color-text)',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <strong>{u.username}</strong>
                                    {u.nickname && <span style={{ color: 'var(--color-text-secondary)' }}> — {u.nickname}</span>}
                                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}> · id {u.id}{u.is_staff ? ' · admin' : ''}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Loading / error / data */}
            {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t.loading}</div>}
            {error && !loading && <div style={{ padding: 20, background: '#fef2f2', color: '#dc2626', borderRadius: 8 }}>{error}</div>}
            {!loading && !error && mode === 'user' && !pickedUser && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {t.pickUserFirst}
                </div>
            )}

            {!loading && !error && data && (mode === 'all' || pickedUser) && (
                <>
                    {/* Totals cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t.totalAt}</div>
                            <div style={{ ...cardValueStyle, color: '#0d9488' }}>{data.totals.at_consumed.toLocaleString()}</div>
                        </div>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t.totalCalls}</div>
                            <div style={{ ...cardValueStyle, color: '#8b5cf6' }}>{data.totals.call_count.toLocaleString()}</div>
                        </div>
                        {data.user && (
                            <div style={cardStyle}>
                                <div style={cardLabelStyle}>{t.userBalance}</div>
                                <div style={cardValueStyle}>{data.user.at_balance.toLocaleString()} AT</div>
                            </div>
                        )}
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t.timeRange}</div>
                            <div style={cardValueStyle}>{t.rangeLastNDays.replace('{n}', String(data.days))}</div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
                        {renderChart()}
                    </div>
                </>
            )}
        </div>
    );
}

// ── Reusable inline styles ─────────────────────────────────────────────────
const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    fontSize: 13,
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'white' : 'var(--color-text-secondary)',
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: active ? 600 : 500,
    transition: 'all 0.15s',
});

const selectStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 13,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 12,
    padding: '14px 16px',
};

const cardLabelStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--color-text-secondary)',
    marginBottom: 6,
};

const cardValueStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--color-text)',
};
