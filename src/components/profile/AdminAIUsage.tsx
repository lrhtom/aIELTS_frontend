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
    // 生成结果分布（数据源 AIGenerationLog，非 AT 交易表）
    ok_first: number;
    ok_repaired: number;
    failed: number;
    gen_total: number;
    /** true = 这天有日志覆盖不到的扣款，ok_first 里含推算补齐的部分 */
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
    /** ok_first 里由历史扣款推算补齐的部分 */
    derived_ok_first?: number;
    /** 只含真实日志的口径 —— 下面三个比率都基于它 */
    measured_gen_total?: number;
    measured_ok_first?: number;
    measured_ok_repaired?: number;
    measured_failed?: number;
    success_rate: number;      // 正常率 %
    first_pass_rate: number;   // 首次合规率 %
    failure_rate: number;      // 异常率 %
}

interface ScopeRow {
    scope: string;
    ok_first: number;
    ok_repaired: number;
    failed: number;
    total: number;
    failure_rate: number;
}

/** 按业务模块分类（口语/听力/…），数据源 AIGenerationLog.scope */
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

/** 按模型分类，数据源 AT 出账描述 —— 唯一覆盖全部历史的维度 */
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
    /** 平台最早有数据的日期，早于它的起点会被后端夹到这天 */
    data_start?: string;
    /** 结果日志上线日；早于这天的 ok_first 是推算补齐的，null = 还没有任何日志 */
    log_start?: string | null;
    user: { id: number; username: string; nickname: string; at_balance: number } | null;
    series: UsageSeriesPoint[];
    /** 当前所选日期区间的小计 */
    totals: UsageTotals;
    /** 不限时间的累计（不随日期区间变化） */
    all_time: UsageTotals;
    top_errors: { error_type: string; n: number }[];
    by_scope: ScopeRow[];
    /** 当前选中的业务模块，'all' = 不筛选 */
    module?: string;
    /** 可选模块列表（后端 MODULE_ORDER） */
    modules?: string[];
    /** 'transaction' = 覆盖全部历史；'log' = 只有生成日志上线之后 */
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

/** 后端 DATA_START 的镜像；仅在响应尚未返回时兜底，真值以 data.data_start 为准。 */
const DATA_START_FALLBACK = '2026-06-04';

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminAIUsage() {
    const { t } = useLang();
    const [mode, setMode] = useState<Mode>('all');
    const [days, setDays] = useState<number>(30);
    // 自定义日期区间：两个都填了就覆盖 days 预设（只影响图表与区间小计）
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const useCustom = Boolean(customStart && customEnd);
    const [chartType, setChartType] = useState<ChartType>('bar');
    // 业务模块筛选：'all' 走 AT 交易表（全部历史），选具体模块改读生成日志
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

    // 后端可能是旧版本（未部署/未重启）→ 这些字段会缺失。做兜底，
    // 否则 .length / .toLocaleString() 会抛错把整个面板炸掉。
    const rel = useMemo(() => ({
        gen_total: data?.totals?.gen_total ?? 0,
        ok_first: data?.totals?.ok_first ?? 0,
        ok_repaired: data?.totals?.ok_repaired ?? 0,
        failed: data?.totals?.failed ?? 0,
        derived_ok_first: data?.totals?.derived_ok_first ?? 0,
        // 只含真实日志的口径，备查用（展示的比率用含补齐的 gen_total）
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
    // 后端给的模块列表；首屏还没数据时用一份兜底，页签不至于空着
    const moduleList = data?.modules ?? ['reading', 'listening', 'speaking', 'writing', 'vocab', 'extra', 'image', 'stream', 'other'];
    // 页签上的角标：'all' 用面板总调用数，其余用该模块的日志条数
    const moduleCount = useMemo(() => {
        const m: Record<string, number> = {};
        if (data) m.all = data.totals.call_count;
        byModule.forEach(r => { m[r.module] = r.total; });
        return m;
    }, [data, byModule]);
    // 平台最早有数据的日期；后端会把更早的起点夹到这天，这里同步给日期选择器做 min。
    const dataStart = data?.data_start ?? DATA_START_FALLBACK;
    // 没有任何生成日志时，百分比显示 "—" 而不是 0% ——
    // 0% 会被读成"全部失败"，但真实含义是"这段时间没有数据"。
    // 分母用含补齐的 gen_total：没有失败记录即视为全部成功（当前 = 100% / 0%）。
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
                    {/* 生成结果：成功/修复/异常 叠成一根柱，与调用量共用右轴 */}
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

            {/* 业务模块分类页签：切换后整个面板（图表 + 卡片）都只统计该类请求 */}
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

                {/* 自定义日期区间 —— 只作用于图表和区间小计 */}
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

                    {/* 生成可靠性卡片（RQ3 指标） */}
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

                    {/* 补齐说明：绿柱与 Call Count 对平，但那部分不参与正常率计算 */}
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

                    {/* 分类一：按业务模块（口语/听力/阅读…），数据源=生成日志 */}
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

                    {/* 分类二：按模型 —— 解析 AT 出账描述，覆盖全部历史 */}
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

                    {/* 按细粒度 scope 拆分的异常率（论文 Table 7.6 口径） */}
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

/** 分类页签：选中态实心，未选中走描边，和 pillStyle 区分开 */
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
