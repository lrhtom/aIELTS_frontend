import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { RefreshCw, FileCode2, AlignLeft, Code2, HardDrive } from 'lucide-react';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    Cell,
    PieChart,
    Pie,
    Legend,
} from 'recharts';
import '../../styles/admin_code_stats.css';

// ── Types ──────────────────────────────────────────────────────────────────
interface LangRow { language: string; files: number; lines: number; }
interface LayerRow { layer: string; files: number; lines: number; }
interface DirRow { dir: string; files: number; lines: number; }
interface FileRow { path: string; lines: number; }
interface CodeStats {
    generated_at: string;
    scan_seconds: number;
    cached: boolean;
    totals: { files: number; lines: number; blank: number; code: number; size_bytes: number };
    by_language: LangRow[];
    by_layer: LayerRow[];
    by_directory: DirRow[];
    largest_files: FileRow[];
}

type Metric = 'lines' | 'files';

// ── Colors ─────────────────────────────────────────────────────────────────
const LANG_COLORS: Record<string, string> = {
    'TypeScript React': '#3178c6',
    'TypeScript': '#4a90d9',
    'JavaScript': '#e2b93b',
    'JavaScript React': '#f7b93e',
    'Python': '#3572A5',
    'CSS': '#8250df',
    'SCSS': '#c76494',
    'HTML': '#e34c26',
    'JSON': '#6cae3e',
    'Markdown': '#6b7280',
    'SQL': '#b07219',
    'Shell': '#3f9142',
    'YAML': '#cb452c',
    'TOML': '#9c4221',
};
const LAYER_COLORS: Record<string, string> = { frontend: '#0d9488', backend: '#6366f1' };
const FALLBACK = ['#0d9488', '#f59e0b', '#6366f1', '#ef4444', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6'];

function langColor(name: string, i: number) {
    return LANG_COLORS[name] ?? FALLBACK[i % FALLBACK.length];
}

function fmt(n: number) {
    return n.toLocaleString();
}

function fmtBytes(n: number) {
    if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
    if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${n} B`;
}

// ── Component ──────────────────────────────────────────────────────────────
export default function AdminCodeStats() {
    const { translations } = useLang();
    const t = translations.profile.admin.codeStats;

    const [data, setData] = useState<CodeStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [metric, setMetric] = useState<Metric>('lines');

    const load = useCallback(async (force: boolean) => {
        setLoading(true);
        setError('');
        try {
            const resp = await apiClient.get<CodeStats>('/admin/code-stats', {
                params: force ? { refresh: 1 } : {},
            });
            setData(resp.data);
        } catch {
            setError(t.loadFail);
        } finally {
            setLoading(false);
        }
    }, [t.loadFail]);

    useEffect(() => { void load(false); }, [load]);

    const metricLabel = metric === 'lines' ? t.metricLines : t.metricFiles;
    const langData = (data?.by_language ?? []).map(r => ({ name: r.language, value: r[metric], files: r.files, lines: r.lines }));
    const dirData = (data?.by_directory ?? []).map(r => ({ name: r.dir, value: r[metric], files: r.files, lines: r.lines }));
    const layerData = (data?.by_layer ?? []).map(r => ({ name: r.layer, value: r.lines, files: r.files, lines: r.lines }));

    return (
        <div className="acs-root">
            {/* Header */}
            <div className="acs-header">
                <div>
                    <h2 className="acs-heading">{t.heading}</h2>
                    <p className="acs-desc">{t.description}</p>
                </div>
                <button className="acs-refresh-btn" onClick={() => void load(true)} disabled={loading}>
                    <RefreshCw size={15} className={loading ? 'acs-spin' : ''} />
                    {loading ? t.scanning : t.refresh}
                </button>
            </div>

            {data && (
                <div className="acs-meta">
                    <span>{t.updatedAt.replace('{time}', new Date(data.generated_at).toLocaleString())}</span>
                    <span>·</span>
                    <span>{t.scanTook.replace('{n}', String(data.scan_seconds))}</span>
                    {data.cached && <span className="acs-cached">{t.cached}</span>}
                </div>
            )}

            {error && <div className="acs-error">{error}</div>}

            {!data && loading && <div className="acs-empty">{t.loading}</div>}

            {data && data.totals.files === 0 && (
                <div className="acs-empty">{t.empty}</div>
            )}

            {data && data.totals.files > 0 && (
                <>
                    {/* KPI cards */}
                    <div className="acs-kpis">
                        <div className="acs-kpi">
                            <FileCode2 size={18} className="acs-kpi-icon" style={{ color: '#0d9488' }} />
                            <div className="acs-kpi-value">{fmt(data.totals.files)}</div>
                            <div className="acs-kpi-label">{t.kpiFiles}</div>
                        </div>
                        <div className="acs-kpi">
                            <AlignLeft size={18} className="acs-kpi-icon" style={{ color: '#6366f1' }} />
                            <div className="acs-kpi-value">{fmt(data.totals.lines)}</div>
                            <div className="acs-kpi-label">{t.kpiLines}</div>
                        </div>
                        <div className="acs-kpi">
                            <Code2 size={18} className="acs-kpi-icon" style={{ color: '#f59e0b' }} />
                            <div className="acs-kpi-value">{fmt(data.totals.code)}</div>
                            <div className="acs-kpi-label">{t.kpiCode}</div>
                        </div>
                        <div className="acs-kpi">
                            <HardDrive size={18} className="acs-kpi-icon" style={{ color: '#ec4899' }} />
                            <div className="acs-kpi-value">{fmtBytes(data.totals.size_bytes)}</div>
                            <div className="acs-kpi-label">{t.kpiSize}</div>
                        </div>
                    </div>

                    {/* Metric toggle */}
                    <div className="acs-metric-toggle">
                        <button
                            className={metric === 'lines' ? 'is-active' : ''}
                            onClick={() => setMetric('lines')}
                        >
                            {t.metricLines}
                        </button>
                        <button
                            className={metric === 'files' ? 'is-active' : ''}
                            onClick={() => setMetric('files')}
                        >
                            {t.metricFiles}
                        </button>
                    </div>

                    {/* Charts */}
                    <div className="acs-charts">
                        {/* By language */}
                        <div className="acs-chart-card">
                            <h3 className="acs-chart-title">{t.byLanguage.replace('{metric}', metricLabel)}</h3>
                            <ResponsiveContainer width="100%" height={Math.max(180, langData.length * 34)}>
                                <BarChart data={langData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" width={116} tick={{ fontSize: 11 }} />
                                    <Tooltip
                                        formatter={(v) => [fmt(Number(v)), metricLabel]}
                                        labelStyle={{ color: '#0f172a' }}
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {langData.map((d, i) => <Cell key={d.name} fill={langColor(d.name, i)} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* By layer (pie) */}
                        <div className="acs-chart-card">
                            <h3 className="acs-chart-title">{t.byLayer}</h3>
                            <ResponsiveContainer width="100%" height={240}>
                                <PieChart>
                                    <Pie
                                        data={layerData}
                                        dataKey="value"
                                        nameKey="name"
                                        innerRadius={54}
                                        outerRadius={84}
                                        paddingAngle={2}
                                    >
                                        {layerData.map((d, i) => (
                                            <Cell key={d.name} fill={LAYER_COLORS[d.name] ?? FALLBACK[i % FALLBACK.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v, _n, p) => {
                                            const pl = (p as { payload?: { files?: number; name?: string } })?.payload;
                                            return [
                                                `${fmt(Number(v))} ${t.unitLines} · ${fmt(pl?.files ?? 0)} ${t.unitFiles}`,
                                                pl?.name ?? '',
                                            ];
                                        }}
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    />
                                    <Legend
                                        formatter={(value) => `${value} (${fmt(layerData.find(l => l.name === value)?.lines ?? 0)})`}
                                        wrapperStyle={{ fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* By directory */}
                        <div className="acs-chart-card acs-chart-wide">
                            <h3 className="acs-chart-title">{t.byDirectory.replace('{metric}', metricLabel)}</h3>
                            <ResponsiveContainer width="100%" height={Math.max(200, dirData.length * 30)}>
                                <BarChart data={dirData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                                    <XAxis type="number" tick={{ fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" width={210} tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        formatter={(v) => [fmt(Number(v)), metricLabel]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                                    />
                                    <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Largest files */}
                        <div className="acs-chart-card acs-chart-wide">
                            <h3 className="acs-chart-title">{t.largestFiles}</h3>
                            <ul className="acs-file-list">
                                {data.largest_files.map(f => (
                                    <li key={f.path} className="acs-file-row">
                                        <span className="acs-file-path" title={f.path}>{f.path}</span>
                                        <span className="acs-file-bar-wrap">
                                            <span
                                                className="acs-file-bar"
                                                style={{ width: `${Math.max(4, (f.lines / (data.largest_files[0]?.lines || 1)) * 100)}%` }}
                                            />
                                        </span>
                                        <span className="acs-file-lines">{fmt(f.lines)}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
