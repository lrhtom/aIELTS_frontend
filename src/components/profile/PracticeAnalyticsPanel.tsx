/**
 * PracticeAnalyticsPanel — Reading / Listening 正确率统计.
 *
 * Renders per-skill KPI cards + accuracy trend line chart + by-subtype
 * table + recent-attempts list.  Data source: GET /analytics/practice.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { getPracticeAnalytics, type PracticeAnalytics, type PracticeSkillStats, type PracticeAttempt } from '../../api/analytics';

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

function accuracyClass(a: number): string {
    if (a >= 0.85) return 'pa-acc-high';
    if (a >= 0.6) return 'pa-acc-mid';
    return 'pa-acc-low';
}

/* ── Accuracy trend line chart ──────────────────────────────────── */
interface TrendPoint {
    idx: number;              // 0-based sequence
    accuracy: number;         // 0..1
    correct: number;
    total: number;
    date: string | null;
    title: string;
}

function AccuracyTrendChart({ points, color }: { points: TrendPoint[]; color: string }) {
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

    // With a single point, center it horizontally so it doesn't hug the left edge.
    const singlePoint = points.length === 1;
    const maxIdx = points.length > 1 ? points[points.length - 1].idx : 1;
    const getX = (idx: number) => singlePoint
        ? padL + graphW / 2
        : padL + (maxIdx > 0 ? (idx / maxIdx) * graphW : graphW / 2);
    const getY = (acc: number) => padT + graphH - acc * graphH;

    const linePoints = points.map(p => `${getX(p.idx)},${getY(p.accuracy)}`);

    const areaD = linePoints.length > 0
        ? `M ${linePoints[0]} L ${linePoints.join(' L ')} L ${getX(points[points.length - 1].idx)},${padT + graphH} L ${padL},${padT + graphH} Z`
        : '';

    // Y ticks at 0/25/50/75/100 %
    const yTickValues = [0, 0.25, 0.5, 0.75, 1];

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
        const pct = `${Math.round(p.accuracy * 100)}%`;
        const dateStr = p.date ? new Date(p.date).toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        setTip({
            x: ev.clientX,
            y: ev.clientY,
            lines: [`${dateStr}`, `正确率 ${pct}`, `${p.correct}/${p.total}${p.title ? ' · ' + p.title : ''}`],
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
                {/* Y-axis gridlines + labels */}
                {yTickValues.map(v => {
                    const y = getY(v);
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">
                                {Math.round(v * 100)}%
                            </text>
                        </g>
                    );
                })}
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
                        cy={getY(p.accuracy)}
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
                                cy={getY(p.accuracy)}
                                r="12"
                                fill={color}
                                opacity="0.15"
                            />
                        )}
                        <circle
                            cx={getX(p.idx)}
                            cy={getY(p.accuracy)}
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

function SkillCard({ skill, stats, label }: { skill: Skill; stats: PracticeSkillStats; label: string }) {
    const icon = skill === 'reading' ? '📖' : '🎧';
    const accClass = accuracyClass(stats.accuracy);
    // Recent attempts come back newest-first; the trend chart wants oldest-left → reverse.
    const trendPoints: TrendPoint[] = useMemo(() => {
        const filtered = stats.recent.filter((a: PracticeAttempt) => a.total > 0);
        const reversed = [...filtered].reverse();
        return reversed.map((a, idx) => ({
            idx,
            accuracy: a.accuracy,
            correct: a.correct,
            total: a.total,
            date: a.date,
            title: a.title,
        }));
    }, [stats.recent]);
    const trendColor = skill === 'reading' ? '#0d9488' : '#7c3aed';
    return (
        <div className="pa-skill-card">
            <div className="pa-skill-header">
                <span className="pa-skill-icon">{icon}</span>
                <span className="pa-skill-title">{label}</span>
            </div>
            {stats.attempts === 0 ? (
                <div className="pa-empty">
                    <div className="pa-empty-icon">📊</div>
                    <div className="pa-empty-title">尚无{label}作答记录</div>
                    <div className="pa-empty-hint">
                        完成任意一套{skill === 'reading' ? '阅读' : '听力'}题目并提交后，此处会显示正确率统计和趋势曲线。
                    </div>
                </div>
            ) : (
                <>
                    <div className="pa-kpi-row">
                        <div className={`pa-kpi-main ${accClass}`}>
                            <div className="pa-kpi-value">{fmtPct(stats.accuracy)}</div>
                            <div className="pa-kpi-label">总正确率</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{stats.correct_questions}</span> / {stats.total_questions}</div>
                            <div className="pa-kpi-sublabel">题目 (答对 / 总数)</div>
                        </div>
                        <div className="pa-kpi-sub">
                            <div><span className="pa-kpi-num">{stats.attempts}</span></div>
                            <div className="pa-kpi-sublabel">套题次数</div>
                        </div>
                    </div>

                    {trendPoints.length >= 1 && (
                        <div className="pa-section">
                            <div className="pa-section-title">
                                正确率趋势 · 近 {trendPoints.length} 套
                                {trendPoints.length === 1 && <span className="pa-section-hint"> · 再做 1 套就能看到走势线</span>}
                            </div>
                            <div className="pa-trend-chart">
                                <AccuracyTrendChart points={trendPoints} color={trendColor} />
                            </div>
                        </div>
                    )}

                    {stats.by_type.length > 0 && (
                        <div className="pa-section">
                            <div className="pa-section-title">按题型细分</div>
                            <div className="pa-type-list">
                                {stats.by_type.map(row => (
                                    <div key={row.subtype} className="pa-type-row">
                                        <span className="pa-type-name">{row.subtype.replace(/_/g, ' ')}</span>
                                        <div className="pa-type-bar-wrap">
                                            <div
                                                className={`pa-type-bar ${accuracyClass(row.accuracy)}`}
                                                style={{ width: `${Math.max(2, Math.round(row.accuracy * 100))}%` }}
                                            />
                                        </div>
                                        <span className="pa-type-stat">
                                            <strong>{fmtPct(row.accuracy)}</strong>
                                            <span className="pa-type-tally"> ({row.correct}/{row.total}, {row.attempts}套)</span>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {stats.recent.length > 0 && (
                        <div className="pa-section">
                            <div className="pa-section-title">最近作答</div>
                            <div className="pa-attempts-list">
                                {stats.recent.map(a => (
                                    <div key={a.id} className="pa-attempt-row">
                                        <span className="pa-attempt-date">{fmtDate(a.date)}</span>
                                        <span className="pa-attempt-title" title={a.title}>{a.title || '(未命名)'}</span>
                                        <span className="pa-attempt-subtype">{a.subtype.replace(/_/g, ' ')}</span>
                                        <span className={`pa-attempt-acc ${accuracyClass(a.accuracy)}`}>
                                            {fmtPct(a.accuracy)}
                                            <span className="pa-attempt-tally"> · {a.correct}/{a.total}</span>
                                        </span>
                                    </div>
                                ))}
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
    const [data, setData] = useState<PracticeAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setErr(null);
        getPracticeAnalytics()
            .then(setData)
            .catch(e => setErr(e?.message || 'failed'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="analytics-page"><div className="pa-loading">加载中…</div></div>;
    }
    if (err || !data) {
        return <div className="analytics-page"><div className="pa-loading">加载失败 {err}</div></div>;
    }

    const stats = data[skill];
    const label = skill === 'reading' ? '阅读练习' : '听力练习';
    return (
        <div className="pa-panel">
            <SkillCard skill={skill} stats={stats} label={label} />
        </div>
    );
}
