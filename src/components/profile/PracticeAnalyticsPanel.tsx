/**
 * PracticeAnalyticsPanel - reading / listening full-paper results (9-band scale).
 *
 * Since 2026-07-17 the scope is: complete 40-question papers only (including the children of a full mock).
 * The backend returns correct/total and the frontend converts to a band with the official table (utils/ielts_band.ts).
 * Also exports MockAnalyticsPanel: the trend of full mock score reports (overall + the four skill bands).
 * Data source: GET /analytics/practice.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPracticeAnalytics, type PracticeAnalytics, type PracticeAttempt, type MockReportItem } from '../../api/analytics';
import { rawToBand, formatBand } from '../../utils/ielts_band';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

type Skill = 'reading' | 'listening';

function fmtPct(x: number): string {
    return `${Math.round(x * 100)}%`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    } catch {
        return iso;
    }
}

function bandClass(b: number): string {
    if (b >= 7) return 'pa-acc-high';
    if (b >= 5.5) return 'pa-acc-mid';
    return 'pa-acc-low';
}

/* -- Band trend line chart (9-band y axis) --------------------- */
interface TrendPoint {
    idx: number;              // 0-based sequence
    band: number;             // 0..9
    date: string | null;
    tipExtra?: string[];      // extra tooltip line
}

function BandTrendChart({ points, color, targetBand }: { points: TrendPoint[]; color: string; targetBand?: number | null }) {
    const { t } = useLang();
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);

    const W = 760;
    const H = 220;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 36;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;

    // Adaptive floor: the common 5-9 range is not squashed, and low scores (or a low target) stay on the chart (the same policy as the writing trend chart)
    const maxBand = 9;
    const minBand = useMemo(() => {
        let lo = 4;
        for (const p of points) {
            if (p.band < lo) lo = Math.floor(p.band);
        }
        if (typeof targetBand === 'number' && targetBand > 0 && targetBand < lo) lo = Math.floor(targetBand);
        return Math.max(0, Math.min(lo, maxBand - 1));
    }, [points, targetBand]);

    // With a single point, center it horizontally so it doesn't hug the left edge.
    const singlePoint = points.length === 1;
    const maxIdx = points.length > 1 ? points[points.length - 1].idx : 1;
    const getX = (idx: number) => singlePoint
        ? padL + graphW / 2
        : padL + (maxIdx > 0 ? (idx / maxIdx) * graphW : graphW / 2);
    const getY = (band: number) => padT + graphH - ((band - minBand) / (maxBand - minBand)) * graphH;

    const linePoints = points.map(p => `${getX(p.idx)},${getY(p.band)}`);

    const areaD = linePoints.length > 0
        ? `M ${linePoints[0]} L ${linePoints.join(' L ')} L ${getX(points[points.length - 1].idx)},${padT + graphH} L ${padL},${padT + graphH} Z`
        : '';

    const yTickValues = useMemo(() => {
        const out: number[] = [];
        for (let v = minBand; v <= maxBand; v += 1) out.push(v);
        return out;
    }, [minBand]);

    // X labels: show up to 8 dates
    const xLabelCount = Math.min(8, points.length);
    const xLabels: { key: string; label: string; x: number }[] = [];
    if (points.length > 0) {
        for (let i = 0; i < xLabelCount; i++) {
            const idx = Math.round((i / (xLabelCount - 1 || 1)) * (points.length - 1));
            const p = points[idx];
            const label = p.date ? new Date(p.date).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' }) : `#${p.idx + 1}`;
            xLabels.push({ key: `${idx}-${p.date || p.idx}`, label, x: getX(p.idx) });
        }
    }

    const showTip = useCallback((ev: React.MouseEvent, p: TrendPoint) => {
        const dateStr = p.date ? new Date(p.date).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        setTip({
            x: ev.clientX,
            y: ev.clientY,
            lines: [dateStr, `Band ${formatBand(p.band)}`, ...(p.tipExtra ?? [])],
        });
    }, []);

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg pa-trend-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id={`paTrendGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {/* Y-axis gridlines + labels (band scale) */}
                {yTickValues.map(v => {
                    const y = getY(v);
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">
                                {v.toFixed(0)}
                            </text>
                        </g>
                    );
                })}
                {/* target score dashed line (matching the writing and speaking trend charts) */}
                {typeof targetBand === 'number' && targetBand >= minBand && targetBand <= maxBand && (
                    <g>
                        <line x1={padL} y1={getY(targetBand)} x2={W - padR} y2={getY(targetBand)} stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="5 5" />
                        <text x={W - padR - 5} y={getY(targetBand) - 6} textAnchor="end" fontSize="12" fill="var(--color-primary)" fontWeight="bold">
                            {t('analytics.skillsAvg.target')} {targetBand.toFixed(1)}
                        </text>
                    </g>
                )}
                {areaD && <path d={areaD} fill={`url(#paTrendGrad-${color.replace('#', '')})`} />}
                {linePoints.length > 1 && (
                    <polyline
                        points={linePoints.join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {/* Wider transparent circles for hover-hit */}
                {points.map((p, i) => (
                    <circle
                        key={`hit-${i}`}
                        cx={getX(p.idx)}
                        cy={getY(p.band)}
                        r="10"
                        fill="transparent"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={ev => showTip(ev, p)}
                        onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                        onMouseLeave={hide}
                    />
                ))}
                {/* Visible dots. Single-point mode gets a larger halo so it's obviously present. */}
                {points.map((p, i) => (
                    <g key={`dot-${i}`} style={{ pointerEvents: 'none' }}>
                        {singlePoint && (
                            <circle
                                cx={getX(p.idx)}
                                cy={getY(p.band)}
                                r="12"
                                fill={color}
                                opacity="0.15"
                            />
                        )}
                        <circle
                            cx={getX(p.idx)}
                            cy={getY(p.band)}
                            r={singlePoint ? 6 : 3.5}
                            fill={singlePoint ? color : 'var(--color-surface)'}
                            stroke={color}
                            strokeWidth={singlePoint ? 3 : 2}
                        />
                    </g>
                ))}
                {/* X-axis labels */}
                {xLabels.map(xl => (
                    <text key={xl.key} x={xl.x} y={H - 4} textAnchor="middle" className="analytics-axis-label">
                        {xl.label}
                    </text>
                ))}
            </svg>
            {tip && createPortal(
                <div className="analytics-chart-tooltip" style={{ left: tip.x, top: tip.y }}>
                    {tip.lines.map((l, i) => (
                        <span key={i} className={i === 0 ? 'analytics-tooltip-main' : 'analytics-tooltip-sub'}>{l}</span>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}

/* -- Single-skill (listening/reading) full-paper results card -- */
interface BandAttempt {
    attempt: PracticeAttempt;
    band: number;
}

function SkillCard({ skill, data, label }: { skill: Skill; data: PracticeAnalytics; label: string }) {
    const { t } = useLang();
    const { user } = useAuth();
    const stats = data[skill];
    const icon = skill === 'reading' ? '📖' : '🎧';
    const targetRaw = skill === 'reading' ? user?.target_reading : user?.target_listening;
    const targetBand = targetRaw != null && Number(targetRaw) > 0 ? Number(targetRaw) : null;

    // Only papers with total >= 38 have an official band (the backend already filters on subtype='full'; this is a second guard)
    const bandAttempts: BandAttempt[] = useMemo(() => {
        const out: BandAttempt[] = [];
        for (const a of stats.recent) {
            const band = rawToBand(skill, a.correct, a.total);
            if (band !== null) out.push({ attempt: a, band });
        }
        return out;
    }, [stats.recent, skill]);

    // Recent attempts come back newest-first; the trend chart wants oldest-left → reverse.
    const trendPoints: TrendPoint[] = useMemo(() => {
        const reversed = [...bandAttempts].reverse();
        return reversed.map((x, idx) => ({
            idx,
            band: x.band,
            date: x.attempt.date,
            tipExtra: [`${x.attempt.correct}/${x.attempt.total}${x.attempt.title ? ' · ' + x.attempt.title : ''}`],
        }));
    }, [bandAttempts]);

    const avgBand = useMemo(() => {
        if (bandAttempts.length === 0) return null;
        const sum = bandAttempts.reduce((s, x) => s + x.band, 0);
        return Math.round((sum / bandAttempts.length) * 10) / 10;
    }, [bandAttempts]);

    const trendColor = skill === 'reading' ? '#0d9488' : '#7c3aed';
    return (
        <div className="pa-skill-card">
            <div className="pa-skill-header">
                <span className="pa-skill-icon">{icon}</span>
                <span className="pa-skill-title">{label}</span>
                <span className="pa-skill-scope-badge">{t('analytics.practice.fullOnlyBadge')}</span>
            </div>
            {stats.attempts === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty-icon">📊</div>
                    <div className="pa-empty-title">{t('analytics.practice.emptyTitle').replace('{label}', label)}</div>
                    <div className="pa-empty-hint">
                        {t('analytics.practice.emptyHint').replace('{skill}', skill === 'reading' ? t('analytics.practice.skillReading') : t('analytics.practice.skillListening'))}
                    </div>
                </div>
            ) : (
                <>
                    <div className="pa-kpi-row">
                        <div className={`pa-kpi-main ${avgBand !== null ? bandClass(avgBand) : ''}`}>
                            <div className="pa-kpi-value">{avgBand !== null ? formatBand(avgBand) : '—'}</div>
                            <div className="pa-kpi-label">{t('analytics.practice.kpiBand')}</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{bandAttempts.length > 0 ? formatBand(bandAttempts[0].band) : '—'}</span></div>
                            <div className="pa-kpi-sublabel">{t('analytics.practice.kpiLatestBand')}</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{fmtPct(stats.accuracy)}</span></div>
                            <div className="pa-kpi-sublabel">{t('analytics.practice.kpiAccuracy')}</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{stats.correct_questions}</span> / {stats.total_questions}</div>
                            <div className="pa-kpi-sublabel">{t('analytics.practice.kpiQuestions')}</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{stats.attempts}</span></div>
                            <div className="pa-kpi-sublabel">{t('analytics.practice.kpiSets')}</div>
                        </div>
                    </div>

                    {trendPoints.length >= 1 && (
                        <div className="pa-section">
                            <div className="pa-section-title">
                                {t('analytics.practice.trendTitle').replace('{n}', String(trendPoints.length))}
                                {trendPoints.length === 1 && <span className="pa-section-hint">{t('analytics.practice.trendHint')}</span>}
                            </div>
                            <div className="pa-trend-chart">
                                <BandTrendChart points={trendPoints} color={trendColor} targetBand={targetBand} />
                            </div>
                        </div>
                    )}

                    {stats.recent.length > 0 && (
                        <div className="pa-section">
                            <div className="pa-section-title">{t('analytics.practice.recent')}</div>
                            <div className="pa-attempts-list">
                                {stats.recent.map(a => {
                                    const band = rawToBand(skill, a.correct, a.total);
                                    return (
                                        <div key={a.id} className="pa-attempt-row">
                                            <span className="pa-attempt-date">{fmtDate(a.date)}</span>
                                            <span className="pa-attempt-title" title={a.title}>{a.title || t('analytics.practice.untitled')}</span>
                                            <span className={`pa-attempt-acc ${band !== null ? bandClass(band) : ''}`}>
                                                {band !== null ? `Band ${formatBand(band)}` : fmtPct(a.accuracy)}
                                                <span className="pa-attempt-tally"> · {a.correct}/{a.total}</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

interface Props {
    skill: Skill;
}

export default function PracticeAnalyticsPanel({ skill }: Props) {
    const { t } = useLang();
    const [data, setData] = useState<PracticeAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        // loading starts as true, so the effect only has to fetch
        getPracticeAnalytics()
            .then(setData)
            .catch(e => setErr(e?.message || 'failed'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="analytics-page"><div className="pa-loading">{t('analytics.practice.loading')}</div></div>;
    }
    if (err || !data) {
        return <div className="analytics-page"><div className="pa-loading">{t('analytics.practice.loadFail')} {err}</div></div>;
    }

    const label = skill === 'reading' ? t('analytics.practice.readingLabel') : t('analytics.practice.listeningLabel');
    return (
        <div className="pa-panel">
            <SkillCard skill={skill} data={data} label={label} />
        </div>
    );
}

/* -- Full mock overall panel (score report overall + four skill band trends) -- */
const MOCK_PART_ORDER = ['listening', 'reading', 'writing', 'speaking'] as const;
const MOCK_PART_ICONS: Record<string, string> = { listening: '🎧', reading: '📖', writing: '✍️', speaking: '🗣️' };

export function MockAnalyticsPanel() {
    const { t } = useLang();
    const { user } = useAuth();
    const [data, setData] = useState<PracticeAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    // the overall target = the user's configured overall target score
    const targetOverall = user?.target_score != null && Number(user.target_score) > 0 ? Number(user.target_score) : null;

    useEffect(() => {
        // loading starts as true, so the effect only has to fetch
        getPracticeAnalytics()
            .then(setData)
            .catch(e => setErr(e?.message || 'failed'))
            .finally(() => setLoading(false));
    }, []);

    const reports: MockReportItem[] = useMemo(() => data?.mock?.reports ?? [], [data]);

    // reverse newest-first into a timeline
    const trendPoints: TrendPoint[] = useMemo(() => {
        const reversed = [...reports].reverse();
        return reversed.map((r, idx) => ({
            idx,
            band: r.overall,
            date: r.date,
            tipExtra: [
                MOCK_PART_ORDER
                    .filter(p => typeof r.bands[p] === 'number')
                    .map(p => `${MOCK_PART_ICONS[p]} ${formatBand(r.bands[p])}`)
                    .join('  '),
                ...(r.title ? [r.title] : []),
            ],
        }));
    }, [reports]);

    if (loading) {
        return <div className="analytics-page"><div className="pa-loading">{t('analytics.practice.loading')}</div></div>;
    }
    if (err || !data) {
        return <div className="analytics-page"><div className="pa-loading">{t('analytics.practice.loadFail')} {err}</div></div>;
    }

    if (reports.length === 0) {
        return (
            <div className="pa-panel">
                <div className="pa-skill-card">
                    <div className="pa-empty">
                        <div className="pa-empty-icon">🎯</div>
                        <div className="pa-empty-title">{t('analytics.mockPanel.emptyTitle')}</div>
                        <div className="pa-empty-hint">{t('analytics.mockPanel.emptyHint')}</div>
                    </div>
                </div>
            </div>
        );
    }

    const latest = reports[0];
    const best = reports.reduce((b, r) => (r.overall > b.overall ? r : b), reports[0]);
    const avgOverall = Math.round((reports.reduce((s, r) => s + r.overall, 0) / reports.length) * 10) / 10;

    return (
        <div className="pa-panel">
            <div className="pa-skill-card">
                <div className="pa-skill-header">
                    <span className="pa-skill-icon">🎯</span>
                    <span className="pa-skill-title">{t('analytics.mockPanel.title')}</span>
                </div>
                <div className="pa-kpi-row">
                    <div className={`pa-kpi-main ${bandClass(latest.overall)}`}>
                        <div className="pa-kpi-value">{formatBand(latest.overall)}</div>
                        <div className="pa-kpi-label">{t('analytics.mockPanel.kpiLatest')}</div>
                    </div>
                    <div className="pa-kpi-sub">
                        <div><span className="pa-kpi-num">{formatBand(best.overall)}</span></div>
                        <div className="pa-kpi-sublabel">{t('analytics.mockPanel.kpiBest')}</div>
                    </div>
                    <div className="pa-kpi-sub">
                        <div><span className="pa-kpi-num">{formatBand(avgOverall)}</span></div>
                        <div className="pa-kpi-sublabel">{t('analytics.mockPanel.kpiAvg')}</div>
                    </div>
                    <div className="pa-kpi-sub">
                        <div><span className="pa-kpi-num">{data.mock.total}</span></div>
                        <div className="pa-kpi-sublabel">{t('analytics.mockPanel.kpiCount')}</div>
                    </div>
                </div>

                {trendPoints.length >= 1 && (
                    <div className="pa-section">
                        <div className="pa-section-title">
                            {t('analytics.mockPanel.trendTitle').replace('{n}', String(trendPoints.length))}
                            {trendPoints.length === 1 && <span className="pa-section-hint">{t('analytics.practice.trendHint')}</span>}
                        </div>
                        <div className="pa-trend-chart">
                            <BandTrendChart points={trendPoints} color="#0d9488" targetBand={targetOverall} />
                        </div>
                    </div>
                )}

                <div className="pa-section">
                    <div className="pa-section-title">{t('analytics.mockPanel.listTitle')}</div>
                    <div className="pa-attempts-list">
                        {reports.map(r => (
                            <div key={r.id} className="pa-attempt-row">
                                <span className="pa-attempt-date">{fmtDate(r.date)}</span>
                                <span className="pa-attempt-title" title={r.title}>{r.title || t('analytics.practice.untitled')}</span>
                                <span className="pa-attempt-subtype">
                                    {MOCK_PART_ORDER
                                        .filter(p => typeof r.bands[p] === 'number')
                                        .map(p => `${MOCK_PART_ICONS[p]}${formatBand(r.bands[p])}`)
                                        .join(' ')}
                                </span>
                                <span className={`pa-attempt-acc ${bandClass(r.overall)}`}>
                                    Band {formatBand(r.overall)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
