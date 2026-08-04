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
    // Generation outcome distribution (sourced from AIGenerationLog, not the AT transaction table)
    ok_first: number;
    ok_repaired: number;
    failed: number;
    gen_total: number;
    /** true = this day has charges the logs cannot account for, so ok_first includes an inferred top-up */
    derived?: boolean;
    derived_ok_first?: number;
    measured_gen_total?: number;
    measured_ok_first?: number;
    measured_failed?: number;
}

interface UsageTotals {
    at_consumed: number;
    call_count: number;
    gen_total: number;
    ok_first: number;
    ok_repaired: number;
    failed: number;
    /** The part of ok_first inferred from historical charges */
    derived_ok_first?: number;
    /** The real-logs-only figure - the three ratios below are all based on it */
    measured_gen_total?: number;
    measured_ok_first?: number;
    measured_ok_repaired?: number;
    measured_failed?: number;
    success_rate: number;      // success rate %
    first_pass_rate: number;   // first-attempt compliance rate %
    failure_rate: number;      // failure rate %
}

interface ScopeRow {
    scope: string;
    ok_first: number;
    ok_repaired: number;
    failed: number;
    total: number;
    failure_rate: number;
}

/** Grouped by business module (speaking/listening/...), sourced from AIGenerationLog.scope */
interface ModuleRow {
    module: string;
    ok_first: number;
    ok_repaired: number;
    failed: number;
    total: number;
    call_count: number;
    at_consumed: number;
    success_rate: number;
    failure_rate: number;
}

/** Grouped by model, sourced from the AT charge descriptions - the only dimension covering the entire history */
interface ModelRow {
    kind: 'text' | 'stream' | 'image';
    model: string;
    call_count: number;
    at_consumed: number;
}

interface UsageResponse {
    mode: Mode;
    days: number;
    start: string;
    end: string;
    /** The earliest date the platform has data for; the backend clamps any earlier start to this day */
    data_start?: string;
    /** The day outcome logging went live; ok_first before it is inferred, and null means there are no logs at all yet */
    log_start?: string | null;
    user: { id: number; username: string; nickname: string; at_balance: number } | null;
    series: UsageSeriesPoint[];
    /** Subtotal for the currently selected date range */
    totals: UsageTotals;
    /** The all-time total (does not change with the date range) */
    all_time: UsageTotals;
    top_errors: { error_type: string; n: number }[];
    by_scope: ScopeRow[];
    /** The currently selected business module, 'all' = no filter */
    module?: string;
    /** The list of available modules (the backend's MODULE_ORDER) */
    modules?: string[];
    /** 'transaction' = covers the whole history; 'log' = only since generation logging went live */
    source?: 'transaction' | 'log';
    by_module?: ModuleRow[];
    by_model?: ModelRow[];
}

interface UserPickResult {
    id: number;
    username: string;
    nickname: string;
    is_staff: boolean;
}

/** A mirror of the backend's DATA_START; only a fallback until the response arrives, with data.data_start as the source of truth. */
const DATA_START_FALLBACK = '2026-06-04';

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminAIUsage() {
    const { t } = useLang();
    const [mode, setMode] = useState<Mode>('all');
    const [days, setDays] = useState<number>(30);
    // Custom date range: filling in both overrides the days preset (affecting only the chart and the range subtotal)
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const useCustom = Boolean(customStart && customEnd);
    const [chartType, setChartType] = useState<ChartType>('bar');
    // Business module filter: 'all' reads the AT transaction table (the whole history), a specific module reads the generation log instead
    const [module, setModule] = useState('all');
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
                const params: Record<string, string> = { mode };
                if (customStart && customEnd) {
                    params.start = customStart;
                    params.end = customEnd;
                } else {
                    params.days = String(days);
                }
                if (mode === 'user' && pickedUser) params.user_id = String(pickedUser.id);
                if (module !== 'all') params.module = module;
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
    }, [mode, days, pickedUser, customStart, customEnd, module]);

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

    // The backend may be an older version (not deployed or not restarted) and these fields will be missing. Guard them,
    // otherwise .length / .toLocaleString() throws and takes the whole panel down.
    const rel = useMemo(() => ({
        gen_total: data?.totals?.gen_total ?? 0,
        ok_first: data?.totals?.ok_first ?? 0,
        ok_repaired: data?.totals?.ok_repaired ?? 0,
        failed: data?.totals?.failed ?? 0,
        derived_ok_first: data?.totals?.derived_ok_first ?? 0,
        // The real-logs-only figure, kept for reference (the displayed ratios use gen_total, which includes the inferred part)
        measured_gen_total: data?.totals?.measured_gen_total ?? 0,
        measured_ok_first: data?.totals?.measured_ok_first ?? 0,
        measured_failed: data?.totals?.measured_failed ?? 0,
        success_rate: data?.totals?.success_rate ?? 0,
        first_pass_rate: data?.totals?.first_pass_rate ?? 0,
        failure_rate: data?.totals?.failure_rate ?? 0,
    }), [data]);
    const allTime = useMemo(() => ({
        at_consumed: data?.all_time?.at_consumed ?? 0,
        call_count: data?.all_time?.call_count ?? 0,
        gen_total: data?.all_time?.gen_total ?? 0,
        measured_gen_total: data?.all_time?.measured_gen_total ?? 0,
        success_rate: data?.all_time?.success_rate ?? 0,
    }), [data]);
    const topErrors = data?.top_errors ?? [];
    const byScope = data?.by_scope ?? [];
    const byModule = data?.by_module ?? [];
    const byModel = data?.by_model ?? [];
    // The module list from the backend; a fallback is used before the first response so the tabs are not empty
    const moduleList = data?.modules ?? ['reading', 'listening', 'speaking', 'writing', 'vocab', 'extra', 'image', 'stream', 'other'];
    // Tab badge: 'all' shows the panel's total call count, the others show that module's log count
    const moduleCount = useMemo(() => {
        const m: Record<string, number> = {};
        if (data) m.all = data.totals.call_count;
        byModule.forEach(r => { m[r.module] = r.total; });
        return m;
    }, [data, byModule]);
    // The earliest date the platform has data for; the backend clamps earlier starts to it, and this passes it to the date picker as min.
    const dataStart = data?.data_start ?? DATA_START_FALLBACK;
    // With no generation logs at all, show the percentages as an em dash rather than 0% -
    // 0% reads as 'everything failed', when it really means 'there is no data for this period'.
    // The denominator is gen_total, which includes the inferred part: with no failure records, treat everything as successful (currently 100% / 0%).
    const pct = (v: number) => (rel.gen_total > 0 ? `${v}%` : '—');

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
            <ResponsiveContainer width="99%" height={360} minWidth={0}>
                <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    {commonAxes}
                    <Bar yAxisId="left" dataKey="at_consumed" name={t('profile.admin.aiUsage.metricAt')} fill="#0d9488" />
                    <Bar yAxisId="right" dataKey="call_count" name={t('profile.admin.aiUsage.metricCalls')} fill="#8b5cf6" />
                    {/* Generation outcome: success/repaired/failed stacked into one bar, sharing the right axis with call volume */}
                    <Bar yAxisId="right" stackId="gen" dataKey="ok_first" name={t('profile.admin.aiUsage.metricOkFirst')} fill="#22c55e" />
                    <Bar yAxisId="right" stackId="gen" dataKey="ok_repaired" name={t('profile.admin.aiUsage.metricRepaired')} fill="#f59e0b" />
                    <Bar yAxisId="right" stackId="gen" dataKey="failed" name={t('profile.admin.aiUsage.metricFailed')} fill="#ef4444" />
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <ResponsiveContainer width="99%" height={360} minWidth={0}>
                <LineChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 8 }}>
                    {commonAxes}
                    <Line yAxisId="left" type="monotone" dataKey="at_consumed" name={t('profile.admin.aiUsage.metricAt')} stroke="#0d9488" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="call_count" name={t('profile.admin.aiUsage.metricCalls')} stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    <Line yAxisId="right" type="monotone" dataKey="failed" name={t('profile.admin.aiUsage.metricFailed')} stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        );
    };

    return (
        <div style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 22, color: 'var(--color-text)' }}>{t('profile.admin.aiUsage.heading')}</h2>
                <p style={{ margin: '6px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                    {t('profile.admin.aiUsage.description')}
                </p>
            </div>

            {/* Business module tabs: switching restricts the whole panel (charts and cards) to that class of request */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['all', ...moduleList].map(m => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setModule(m)}
                        style={tabStyle(module === m)}
                        title={m === 'all'
                            ? t('profile.admin.aiUsage.moduleAllHint')
                            : t('profile.admin.aiUsage.moduleLogOnlyHint')}
                    >
                        {m === 'all' ? t('profile.admin.aiUsage.moduleAll') : t(`profile.admin.aiUsage.module.${m}`)}
                        {moduleCount[m] !== undefined && (
                            <span style={{ marginLeft: 6, opacity: 0.7, fontSize: 11 }}>{moduleCount[m]}</span>
                        )}
                    </button>
                ))}
            </div>

            {module !== 'all' && (
                <div style={{
                    padding: '8px 12px', marginBottom: 12, borderRadius: 8, fontSize: 12.5,
                    background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.28)',
                    color: 'var(--color-text-secondary)',
                }}>
                    {t('profile.admin.aiUsage.moduleSourceNote')
                        .replace('{m}', t(`profile.admin.aiUsage.module.${module}`))
                        .replace('{d}', data?.log_start || t('profile.admin.aiUsage.notYet'))}
                </div>
            )}

            {/* Controls row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', padding: 4, borderRadius: 8 }}>
                    <button
                        onClick={() => setMode('all')}
                        style={pillStyle(mode === 'all')}
                    >{t('profile.admin.aiUsage.modeAll')}</button>
                    <button
                        onClick={() => setMode('user')}
                        style={pillStyle(mode === 'user')}
                    >{t('profile.admin.aiUsage.modeUser')}</button>
                </div>

                <select
                    value={days}
                    onChange={(e) => { setDays(Number(e.target.value)); setCustomStart(''); setCustomEnd(''); }}
                    style={{ ...selectStyle, opacity: useCustom ? 0.5 : 1 }}
                    title={useCustom ? t('profile.admin.aiUsage.presetDisabled') : ''}
                >
                    <option value={7}>{t('profile.admin.aiUsage.daysLastN').replace('{n}', '7')}</option>
                    <option value={30}>{t('profile.admin.aiUsage.daysLastN').replace('{n}', '30')}</option>
                    <option value={90}>{t('profile.admin.aiUsage.daysLastN').replace('{n}', '90')}</option>
                    <option value={180}>{t('profile.admin.aiUsage.daysLastN').replace('{n}', '180')}</option>
                    <option value={365}>{t('profile.admin.aiUsage.daysLastN').replace('{n}', '365')}</option>
                </select>

                {/* Custom date range - affects only the chart and the range subtotal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                        type="date"
                        value={customStart}
                        min={dataStart}
                        max={customEnd || undefined}
                        onChange={(e) => setCustomStart(e.target.value)}
                        style={dateInputStyle}
                        aria-label={t('profile.admin.aiUsage.dateFrom')}
                        title={t('profile.admin.aiUsage.dataStartHint').replace('{d}', dataStart)}
                    />
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>→</span>
                    <input
                        type="date"
                        value={customEnd}
                        min={customStart || dataStart}
                        onChange={(e) => setCustomEnd(e.target.value)}
                        style={dateInputStyle}
                        aria-label={t('profile.admin.aiUsage.dateTo')}
                    />
                    {useCustom && (
                        <button
                            type="button"
                            onClick={() => { setCustomStart(''); setCustomEnd(''); }}
                            style={{ ...selectStyle, padding: '6px 10px' }}
                        >
                            {t('profile.admin.aiUsage.clearDates')}
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 4, background: 'var(--color-bg)', padding: 4, borderRadius: 8 }}>
                    <button onClick={() => setChartType('bar')} style={pillStyle(chartType === 'bar')}>{t('profile.admin.aiUsage.chartBar')}</button>
                    <button onClick={() => setChartType('line')} style={pillStyle(chartType === 'line')}>{t('profile.admin.aiUsage.chartLine')}</button>
                </div>
            </div>

            {/* User picker — only visible in single-user mode */}
            {mode === 'user' && (
                <div style={{ position: 'relative', marginBottom: 16, maxWidth: 420 }}>
                    <input
                        type="text"
                        placeholder={pickedUser ? t('profile.admin.aiUsage.userPickedPlaceholder').replace('{name}', pickedUser.username).replace('{id}', String(pickedUser.id)) : t('profile.admin.aiUsage.userSearchPlaceholder')}
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
            {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t('profile.admin.aiUsage.loading')}</div>}
            {error && !loading && <div style={{ padding: 20, background: '#fef2f2', color: '#dc2626', borderRadius: 8 }}>{error}</div>}
            {!loading && !error && mode === 'user' && !pickedUser && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                    {t('profile.admin.aiUsage.pickUserFirst')}
                </div>
            )}

            {!loading && !error && data && (mode === 'all' || pickedUser) && (
                <>
                    {/* Totals cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.totalAt')}</div>
                            <div style={{ ...cardValueStyle, color: '#0d9488' }}>{data.totals.at_consumed.toLocaleString()}</div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.allTimeValue').replace('{v}', (allTime.at_consumed).toLocaleString())}
                            </div>
                        </div>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.totalCalls')}</div>
                            <div style={{ ...cardValueStyle, color: '#8b5cf6' }}>{data.totals.call_count.toLocaleString()}</div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.allTimeValue').replace('{v}', (allTime.call_count).toLocaleString())}
                            </div>
                        </div>
                        {data.user && (
                            <div style={cardStyle}>
                                <div style={cardLabelStyle}>{t('profile.admin.aiUsage.userBalance')}</div>
                                <div style={cardValueStyle}>{data.user.at_balance.toLocaleString()} AT</div>
                            </div>
                        )}
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.timeRange')}</div>
                            <div style={{ ...cardValueStyle, fontSize: 16 }}>
                                {data.start} → {data.end}
                            </div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.rangeChartOnly').replace('{n}', String(data.days))}
                                {data.start === dataStart && (
                                    <> · {t('profile.admin.aiUsage.clampedToDataStart').replace('{d}', dataStart)}</>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Generation reliability cards (the RQ3 metrics) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.successRate')}</div>
                            <div style={{ ...cardValueStyle, color: rel.gen_total ? '#22c55e' : 'var(--color-text-secondary)' }}>{pct(rel.success_rate)}</div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.okOfTotal')
                                    .replace('{ok}', String(rel.ok_first + rel.ok_repaired))
                                    .replace('{total}', String(rel.gen_total))}
                                {allTime.gen_total > 0 && ` · ${t('profile.admin.aiUsage.allTimeValue').replace('{v}', `${allTime.success_rate}%`)}`}
                            </div>
                        </div>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.firstPassRate')}</div>
                            <div style={{ ...cardValueStyle, color: rel.gen_total ? '#0d9488' : 'var(--color-text-secondary)' }}>{pct(rel.first_pass_rate)}</div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.repairedCount').replace('{n}', String(rel.ok_repaired))}
                            </div>
                        </div>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.failureRate')}</div>
                            <div style={{ ...cardValueStyle, color: rel.failed > 0 ? '#ef4444' : (rel.gen_total ? 'var(--color-text)' : 'var(--color-text-secondary)') }}>
                                {pct(rel.failure_rate)}
                            </div>
                            <div style={cardHintStyle}>
                                {t('profile.admin.aiUsage.failedCount').replace('{n}', String(rel.failed))}
                            </div>
                        </div>
                        <div style={cardStyle}>
                            <div style={cardLabelStyle}>{t('profile.admin.aiUsage.topError')}</div>
                            <div style={{ ...cardValueStyle, fontSize: 16 }}>
                                {topErrors.length > 0 ? topErrors[0].error_type : '—'}
                            </div>
                            <div style={cardHintStyle}>
                                {topErrors.length > 0
                                    ? t('profile.admin.aiUsage.errorTimes').replace('{n}', String(topErrors[0].n))
                                    : t('profile.admin.aiUsage.noErrors')}
                            </div>
                        </div>
                    </div>

                    {rel.gen_total === 0 && (
                        <div style={{
                            padding: '10px 14px', marginBottom: 16, borderRadius: 8, fontSize: 12.5,
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
                            color: 'var(--color-text-secondary)',
                        }}>
                            {t('profile.admin.aiUsage.noGenLogHint')}
                        </div>
                    )}

                    {/* A note about the inferred data: the green bars reconcile with Call Count, but that part is excluded from the success rate */}
                    {rel.derived_ok_first > 0 && (
                        <div style={{
                            padding: '10px 14px', marginBottom: 16, borderRadius: 8, fontSize: 12.5,
                            background: 'rgba(13,148,136,0.07)', border: '1px solid rgba(13,148,136,0.28)',
                            color: 'var(--color-text-secondary)',
                        }}>
                            {t('profile.admin.aiUsage.derivedHint')
                                .replace('{n}', rel.derived_ok_first.toLocaleString())
                                .replace('{d}', data.log_start || t('profile.admin.aiUsage.notYet'))}
                        </div>
                    )}

                    {/* Chart */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16 }}>
                        {renderChart()}
                    </div>

                    {/* Grouping one: by business module (speaking/listening/reading...), sourced from the generation log */}
                    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                            {t('profile.admin.aiUsage.byCategoryTitle')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                            {t('profile.admin.aiUsage.byCategoryHint')}
                        </div>
                        {byModule.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--color-text-secondary)', padding: '10px 0' }}>
                                {t('profile.admin.aiUsage.byCategoryEmpty')}
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colCategory')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colTotal')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricOkFirst')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricRepaired')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricFailed')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.successRate')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.totalAt')}</th>
                                            <th style={thStyle} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byModule.map(row => (
                                            <tr key={row.module} style={{ borderTop: '1px solid var(--color-border)' }}>
                                                <td style={tdStyle}>{t(`profile.admin.aiUsage.module.${row.module}`)}</td>
                                                <td style={tdStyle}>{row.total}</td>
                                                <td style={{ ...tdStyle, color: '#22c55e' }}>{row.ok_first}</td>
                                                <td style={{ ...tdStyle, color: '#f59e0b' }}>{row.ok_repaired}</td>
                                                <td style={{ ...tdStyle, color: row.failed ? '#ef4444' : 'inherit' }}>{row.failed}</td>
                                                <td style={{ ...tdStyle, fontWeight: 700 }}>{row.success_rate}%</td>
                                                <td style={tdStyle}>{row.at_consumed.toLocaleString()}</td>
                                                <td style={tdStyle}>
                                                    <button type="button" style={linkBtnStyle} onClick={() => setModule(row.module)}>
                                                        {t('profile.admin.aiUsage.viewOnly')}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Grouping two: by model - parsed from the AT charge descriptions, covering the whole history */}
                    {byModel.length > 0 && (
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                                {t('profile.admin.aiUsage.byModelTitle')}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                                {t('profile.admin.aiUsage.byModelHint')}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colKind')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colModel')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.totalCalls')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.totalAt')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colShare')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byModel.map(row => {
                                            const share = rel.gen_total > 0 || data.totals.call_count > 0
                                                ? (row.call_count / Math.max(1, data.totals.call_count)) * 100
                                                : 0;
                                            return (
                                                <tr key={`${row.kind}:${row.model}`} style={{ borderTop: '1px solid var(--color-border)' }}>
                                                    <td style={tdStyle}>{t(`profile.admin.aiUsage.kind.${row.kind}`)}</td>
                                                    <td style={tdStyle}><code style={{ fontSize: 12 }}>{row.model}</code></td>
                                                    <td style={tdStyle}>{row.call_count.toLocaleString()}</td>
                                                    <td style={tdStyle}>{row.at_consumed.toLocaleString()}</td>
                                                    <td style={tdStyle}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <div style={{ flex: 1, minWidth: 60, height: 6, borderRadius: 999, background: 'var(--color-bg)', overflow: 'hidden' }}>
                                                                <div style={{ width: `${share}%`, height: '100%', background: '#8b5cf6' }} />
                                                            </div>
                                                            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{share.toFixed(1)}%</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Failure rate split by fine-grained scope (the definition used in Table 7.6 of the dissertation) */}
                    {byScope.length > 0 && (
                        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 16, marginTop: 16 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
                                {t('profile.admin.aiUsage.byModuleTitle')}
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ color: 'var(--color-text-secondary)', textAlign: 'left' }}>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colModule')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.colTotal')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricOkFirst')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricRepaired')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.metricFailed')}</th>
                                            <th style={thStyle}>{t('profile.admin.aiUsage.failureRate')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {byScope.map(row => (
                                            <tr key={row.scope} style={{ borderTop: '1px solid var(--color-border)' }}>
                                                <td style={tdStyle}><code style={{ fontSize: 12 }}>{row.scope}</code></td>
                                                <td style={tdStyle}>{row.total}</td>
                                                <td style={{ ...tdStyle, color: '#22c55e' }}>{row.ok_first}</td>
                                                <td style={{ ...tdStyle, color: '#f59e0b' }}>{row.ok_repaired}</td>
                                                <td style={{ ...tdStyle, color: row.failed ? '#ef4444' : 'inherit' }}>{row.failed}</td>
                                                <td style={{ ...tdStyle, fontWeight: 700 }}>{row.failure_rate}%</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
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

/** Category tabs: the selected one is solid and the rest are outlined, distinguishing them from pillStyle */
const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 12px',
    fontSize: 12.5,
    background: active ? 'var(--color-primary)' : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-secondary)',
    border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
    borderRadius: 999,
    cursor: 'pointer',
    fontWeight: active ? 700 : 500,
    transition: 'all 0.15s',
    fontFamily: 'inherit',
});

const linkBtnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'var(--color-primary)',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'underline',
};

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

const dateInputStyle: React.CSSProperties = {
    padding: '5px 10px',
    fontSize: 13,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    cursor: 'pointer',
    colorScheme: 'light dark',
};

const cardHintStyle: React.CSSProperties = {
    fontSize: 11.5,
    color: 'var(--color-text-secondary)',
    marginTop: 4,
};

const thStyle: React.CSSProperties = {
    padding: '6px 10px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
    padding: '7px 10px',
    color: 'var(--color-text)',
    whiteSpace: 'nowrap',
};
