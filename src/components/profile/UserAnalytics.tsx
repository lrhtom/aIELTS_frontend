import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { getVocabAnalytics, getScheduledWords, type ScheduledBucket, type StateBucket, type PlanBrief } from '../../api/analytics';
import '../../styles/analytics_page.css';

/* ── Shared chart tooltip (same style as calendar .lc-tooltip) ── */
function ChartTooltip({ x, y, lines }: { x: number; y: number; lines: React.ReactNode[] }) {
    return createPortal(
        <div
            className="analytics-chart-tooltip"
            style={{ left: x, top: y }}
        >
            {lines.map((line, i) => (
                <span 
                    key={i} 
                    className={i === 0 ? 'analytics-tooltip-main' : 'analytics-tooltip-sub'}
                    style={i === 2 ? { color: 'var(--color-primary)', marginTop: '4px', fontWeight: 500, fontSize: '0.9em' } : undefined}
                >
                    {line}
                </span>
            ))}
        </div>,
        document.body
    );
}

/** Format day offset: negative=overdue, 0=today, positive=future */
function formatDayLabel(days: number, t: Record<string, any>): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (days === 0) return t.today;
    if (days < 0) return `${Math.abs(days)}${t.days} ${t.overdue}`;
    return `${days}${t.daysLater}`;
}

/** Get a formatted date string (YYYY-MM-DD) offset by N days from today */
function formatDateFromOffset(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function ScheduledWordsModal({ days, planId, onClose, t }: { days: number; planId?: number; onClose: () => void; t: any }) {
    const [words, setWords] = useState<{ word: string, zh: string }[] | null>(null);
    useEffect(() => {
        getScheduledWords(days, planId).then(setWords).catch(console.error);
    }, [days, planId]);

    return (
        <div 
            className="analytics-modal-overlay" 
            onClick={onClose}
        >
            <style>{`
                .analytics-modal-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    background-color: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                    animation: modal-fade-in 0.2s ease-out;
                }
                .analytics-modal-container {
                    background-color: var(--color-surface);
                    width: 100%;
                    max-width: 480px;
                    max-height: 85vh;
                    border-radius: 20px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0,0,0,0.05);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: modal-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    border: 1px solid var(--color-border);
                }
                .analytics-modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--color-border);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: var(--color-surface);
                    position: sticky;
                    top: 0;
                    z-index: 10;
                }
                .analytics-modal-title {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: var(--color-text);
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .analytics-modal-badge {
                    font-size: 0.75rem;
                    font-weight: 600;
                    background-color: var(--color-primary);
                    color: #fff;
                    padding: 2px 8px;
                    border-radius: 12px;
                }
                .analytics-modal-close {
                    background: transparent;
                    border: none;
                    color: var(--color-text-dim);
                    cursor: pointer;
                    padding: 6px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }
                .analytics-modal-close:hover {
                    background-color: var(--color-border);
                    color: var(--color-text);
                }
                .analytics-modal-body {
                    padding: 12px;
                    overflow-y: auto;
                    flex: 1;
                }
                .analytics-word-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 14px 16px;
                    border-radius: 12px;
                    transition: all 0.2s ease;
                    margin-bottom: 4px;
                }
                .analytics-word-item:hover {
                    background-color: rgba(var(--color-primary-rgb), 0.05);
                    transform: translateX(4px);
                }
                .analytics-word-text {
                    font-weight: 600;
                    font-size: 1.05rem;
                    color: var(--color-text);
                }
                .analytics-word-zh {
                    font-size: 0.9rem;
                    color: var(--color-text-dim);
                    max-width: 60%;
                    text-align: right;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .analytics-modal-empty {
                    padding: 40px 20px;
                    text-align: center;
                    color: var(--color-text-dim);
                    font-size: 0.95rem;
                }
                @keyframes modal-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes modal-slide-up {
                    from { opacity: 0; transform: translateY(20px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                /* Scrollbar styling for the modal body */
                .analytics-modal-body::-webkit-scrollbar {
                    width: 6px;
                }
                .analytics-modal-body::-webkit-scrollbar-track {
                    background: transparent;
                }
                .analytics-modal-body::-webkit-scrollbar-thumb {
                    background-color: var(--color-border);
                    border-radius: 10px;
                }
            `}</style>
            
            <div className="analytics-modal-container" onClick={e => e.stopPropagation()}>
                <div className="analytics-modal-header">
                    <h3 className="analytics-modal-title">
                        {days === 0 ? t.today || '今天' : `${days} ` + (t.daysLater || '天后')}
                        {words && words.length > 0 && (
                            <span className="analytics-modal-badge">{words.length} 词</span>
                        )}
                    </h3>
                    <button onClick={onClose} className="analytics-modal-close">
                        <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                <div className="analytics-modal-body">
                    {words === null ? (
                        <div className="analytics-modal-empty">
                            <div style={{ animation: 'cursor-blink 1s infinite' }}>Loading...</div>
                        </div>
                    ) : words.length === 0 ? (
                        <div className="analytics-modal-empty">
                            当日无复习计划
                        </div>
                    ) : (
                        <div>
                            {words.map((w, i) => (
                                <div key={i} className="analytics-word-item">
                                    <span className="analytics-word-text">{w.word}</span>
                                    <span className="analytics-word-zh" title={w.zh}>{w.zh}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function UserAnalytics() {
    const { translations: t } = useLang();
    const { user } = useAuth();

    const [activeSkill, setActiveSkill] = useState<'vocab' | 'writing'>('vocab');

    const [plans, setPlans] = useState<PlanBrief[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
    const [modalDays, setModalDays] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [scheduledDist, setScheduledDist] = useState<ScheduledBucket[]>([]);
    const [stateDist, setStateDist] = useState<StateBucket[]>([]);
    const [totalWords, setTotalWords] = useState(0);
    const [totalStudied, setTotalStudied] = useState(0);
    const [chartMode, setChartMode] = useState<'line' | 'bar'>('line');

    useEffect(() => {
        getVocabAnalytics()
            .then(res => {
                if ('plans' in res) setPlans(res.plans);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (selectedPlanId === null) {
            if (plans.length === 0) return;
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedPlanId(plans[0].id);
            return;
        }
        setLoading(true);
        getVocabAnalytics(selectedPlanId)
            .then(res => {
                if ('scheduled_distribution' in res) {
                    const rawDist = res.scheduled_distribution;
                    const mergedMap = new Map<number, number>();
                    
                    rawDist.forEach(d => {
                        const days = d.days < 0 ? 0 : d.days;
                        mergedMap.set(days, (mergedMap.get(days) || 0) + d.count);
                    });
                    
                    const mergedDist: ScheduledBucket[] = Array.from(mergedMap.entries())
                        .map(([days, count]) => ({ days, count }))
                        .sort((a, b) => a.days - b.days);

                    setScheduledDist(mergedDist);
                    setStateDist(res.state_distribution);
                    setTotalWords(res.plan.word_count);
                    setTotalStudied(res.total_studied);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [selectedPlanId, plans]);

    const studyRate = totalWords > 0 ? Math.round((totalStudied / totalWords) * 100) : 0;
    const maxSchedCount = useMemo(() => {
        let mx = 0;
        for (const d of scheduledDist) if (d.count > mx) mx = d.count;
        return Math.max(mx, 1);
    }, [scheduledDist]);
    const maxStateCount = useMemo(() => {
        let mx = 0;
        for (const s of stateDist) if (s.count > mx) mx = s.count;
        return Math.max(mx, 1);
    }, [stateDist]);

    /* ── Forgetting Curve data ── */
    const forgettingData = useMemo(() => {
        if (scheduledDist.length === 0) return [];
        const today = scheduledDist
            .filter(d => d.days >= 0)
            .reduce((sum, d) => sum + d.count, 0);
        if (today === 0) return [];

        const expiryMap = new Map<number, number>();
        for (const d of scheduledDist) {
            if (d.days >= 0) expiryMap.set(d.days, (expiryMap.get(d.days) || 0) + d.count);
        }

        const maxDay = Math.max(...scheduledDist.filter(d => d.days >= 0).map(d => d.days));

        const points: { day: number; words: number }[] = [];
        let remaining = today;
        let lastPushedWords = -1;
        for (let d = 0; d <= maxDay; d++) {
            remaining -= (expiryMap.get(d) || 0);
            if (remaining !== lastPushedWords) {
                points.push({ day: d, words: remaining });
                lastPushedWords = remaining;
            }
            if (remaining <= 0) {
                break;
            }
        }
        if (remaining > 0 && remaining !== lastPushedWords) {
            points.push({ day: maxDay + 1, words: 0 });
        }

        return points;
    }, [scheduledDist]);

    return (
        <div className="analytics-page">
            <div className="analytics-header">
                <div>
                    <h1>{t.analytics.title}</h1>
                    <p>{t.analytics.subtitle}</p>
                </div>
            </div>

            <div className="analytics-tabs">
                {(['vocab', 'listening', 'speaking', 'reading', 'writing'] as const).map(sk => (
                    <button
                        key={sk}
                        className={`analytics-tab ${activeSkill === sk ? 'analytics-tab--active' : ''}`}
                        disabled={sk !== 'vocab' && sk !== 'writing'}
                        title={sk !== 'vocab' && sk !== 'writing' ? t.analytics.comingSoon : undefined}
                        onClick={() => {
                            if (sk === 'vocab' || sk === 'writing') {
                                setActiveSkill(sk as 'vocab' | 'writing');
                            }
                        }}
                    >
                        {String(t.analytics[`${sk}Tab` as keyof typeof t.analytics])}
                        {sk !== 'vocab' && sk !== 'writing' && <span className="analytics-tab-badge">{t.analytics.comingSoon}</span>}
                    </button>
                ))}
            </div>

            {activeSkill === 'vocab' && (
                <>

            {/* -- Plan selector -- */}
            <div className="analytics-bar">
                <label className="analytics-select-label">{t.analytics.selectBook}</label>
                <select
                    className="analytics-select"
                    value={selectedPlanId ?? ''}
                    onChange={e => setSelectedPlanId(Number(e.target.value))}
                >
                    {plans.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.name} ({p.word_count} {t.analytics.wordsUnit})
                        </option>
                    ))}
                </select>
            </div>

            {/* ── Stats cards ── */}
            <div className="analytics-stats">
                <div className="analytics-stat-card">
                    <span className="analytics-stat-num">{totalWords}</span>
                    <span className="analytics-stat-label">{t.analytics.totalWords}</span>
                </div>
                <div className="analytics-stat-card">
                    <span className="analytics-stat-num">{totalStudied}</span>
                    <span className="analytics-stat-label">{t.analytics.studiedWords}</span>
                </div>
                <div className="analytics-stat-card">
                    <span className="analytics-stat-num">{studyRate}%</span>
                    <span className="analytics-stat-label">{t.analytics.studyRate}</span>
                </div>
            </div>

            {loading ? (
                <div className="analytics-loading">
                    <div className="analytics-skeleton-chart" />
                    <div className="analytics-skeleton-chart" />
                </div>
            ) : scheduledDist.length === 0 && stateDist.length === 0 ? (
                <div className="analytics-empty">{t.analytics.noData}</div>
            ) : (
                <div className="analytics-charts">
                    {forgettingData.length > 1 && (
                        <div className="analytics-chart-card">
                            <h3 className="analytics-chart-title">{t.analytics.forgettingCurve}</h3>
                            <ForgettingCurveChart data={forgettingData} t={t.analytics} />
                        </div>
                    )}
                    <div className="analytics-chart-card">
                        <div className="analytics-chart-header">
                            <h3 className="analytics-chart-title">{t.analytics.scheduledDist}</h3>
                            <div className="analytics-chart-toggle">
                                <button
                                    className={`analytics-toggle-btn ${chartMode === 'line' ? 'active' : ''}`}
                                    onClick={() => setChartMode('line')}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                                </button>
                                <button
                                    className={`analytics-toggle-btn ${chartMode === 'bar' ? 'active' : ''}`}
                                    onClick={() => setChartMode('bar')}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                                </button>
                            </div>
                        </div>
                        {chartMode === 'line' ? (
                            <ScheduledDistLine data={scheduledDist} maxCount={maxSchedCount} t={t.analytics} onDayClick={setModalDays} />
                        ) : (
                            <ScheduledDistBar data={scheduledDist} maxCount={maxSchedCount} t={t.analytics} onDayClick={setModalDays} />
                        )}
                    </div>
                    <div className="analytics-chart-card">
                        <h3 className="analytics-chart-title">{t.analytics.masteryDist}</h3>
                        <MasteryBarChart data={stateDist} maxCount={maxStateCount} t={t.analytics.states} />
                    </div>
                </div>
            )}

            {modalDays !== null && (
                <ScheduledWordsModal days={modalDays} planId={selectedPlanId ?? undefined} onClose={() => setModalDays(null)} t={t.analytics} />
            )}
            </>
            )}

            {activeSkill === 'writing' && (
                <WritingAnalyticsPanel t={t.analytics} />
            )}
        </div>
    );
}

/* ── Scheduled Days Distribution — Line Chart ── */
function ScheduledDistLine({ data, maxCount, t, onDayClick }: { data: ScheduledBucket[]; maxCount: number; t: Record<string, any>; onDayClick: (days: number) => void }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);

    const W = 760;
    const H = 200;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 32;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;

    const points = data.map((d, i) => {
        const x = padL + (data.length > 1 ? (i / (data.length - 1)) * graphW : graphW / 2);
        const y = padT + graphH - (d.count / maxCount) * graphH;
        return `${x},${y}`;
    });

    const areaD = points.length > 0
        ? `M ${points[0]} L ${points.join(' L ')} L ${padL + graphW},${padT + graphH} L ${padL},${padT + graphH} Z`
        : '';

    const yTicks = 4;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxCount / yTicks) * i));

    const xLabelCount = Math.min(8, data.length);
    const xLabels: { idx: number; label: string }[] = [];
    if (data.length > 0) {
        for (let i = 0; i < xLabelCount; i++) {
            const idx = Math.round((i / (xLabelCount - 1 || 1)) * (data.length - 1));
            xLabels.push({ idx, label: String(data[idx].days) });
        }
    }

    const showTip = useCallback((ev: React.MouseEvent, d: ScheduledBucket) => {
        const dateStr = formatDateFromOffset(d.days);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [
            `${formatDayLabel(d.days, t)} · ${dateStr}`, 
            `${d.count} ${t.wordsUnit}`,
            t.clickToViewDetails || '点击查看详情'
        ] });
    }, [t]);

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet">
                {yTickValues.map(v => {
                    const y = padT + graphH - (v / maxCount) * graphH;
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">{v}</text>
                        </g>
                    );
                })}
                {areaD && <path d={areaD} fill="url(#areaGrad)" />}
                {points.length > 1 && (
                    <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {data.map((d, i) => {
                    const x = padL + (data.length > 1 ? (i / (data.length - 1)) * graphW : graphW / 2);
                    const y = padT + graphH - (d.count / maxCount) * graphH;
                    return (
                        <circle
                            key={i} cx={x} cy={y} r="6"
                            fill="transparent" stroke="none"
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={ev => showTip(ev, d)}
                            onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                            onMouseLeave={hide}
                            onClick={() => onDayClick(d.days)}
                        />
                    );
                })}
                {data.map((d, i) => {
                    const x = padL + (data.length > 1 ? (i / (data.length - 1)) * graphW : graphW / 2);
                    const y = padT + graphH - (d.count / maxCount) * graphH;
                    return (
                        <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="var(--color-surface)" stroke="var(--color-primary)" strokeWidth="1.5" style={{ pointerEvents: 'none' }} />
                    );
                })}
                {xLabels.map(xl => {
                    const x = padL + (data.length > 1 ? (xl.idx / (data.length - 1)) * graphW : graphW / 2);
                    return (
                        <text key={xl.idx} x={x} y={H - 4} textAnchor="middle" className="analytics-axis-label">
                            {formatDayLabel(Number(xl.label), t)}
                        </text>
                    );
                })}
                <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.01" />
                    </linearGradient>
                </defs>
            </svg>
            {tip && <ChartTooltip x={tip.x} y={tip.y} lines={tip.lines} />}
        </>
    );
}

/* ── Scheduled Days Distribution — Bar Chart ── */
function ScheduledDistBar({ data, maxCount, t, onDayClick }: { data: ScheduledBucket[]; maxCount: number; t: Record<string, any>; onDayClick: (days: number) => void }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);
    const showTip = useCallback((ev: React.MouseEvent, d: ScheduledBucket) => {
        const dateStr = formatDateFromOffset(d.days);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [
            `${formatDayLabel(d.days, t)} · ${dateStr}`, 
            `${d.count} ${t.wordsUnit}`,
            t.clickToViewDetails || '点击查看详情'
        ] });
    }, [t]);

    const W = 760;
    const H = 200;
    const padL = 40;
    const padR = 16;
    const padT = 12;
    const padB = 32;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;
    const barGap = 2;
    const barW = Math.max(3, (graphW - barGap * (data.length - 1)) / data.length);

    const yTicks = 4;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxCount / yTicks) * i));

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet">
                {yTickValues.map(v => {
                    const y = padT + graphH - (v / maxCount) * graphH;
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">{v}</text>
                        </g>
                    );
                })}
                {data.map((d, i) => {
                    const barH = (d.count / maxCount) * graphH;
                    const x = padL + i * (barW + barGap);
                    const y = padT + graphH - barH;
                    return (
                        <g key={i}>
                            <rect
                                x={x} y={y} width={Math.max(barW, 1)} height={Math.max(barH, 1)}
                                fill="var(--color-primary)" opacity="0.7" rx="1"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={ev => showTip(ev, d)}
                                onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                                onMouseLeave={hide}
                                onClick={() => onDayClick(d.days)}
                            />
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip x={tip.x} y={tip.y} lines={tip.lines} />}
        </>
    );
}

/* ── Inline SVG chart: Mastery Bar Chart ── */
function MasteryBarChart({ data, maxCount, t: labels }: { data: StateBucket[]; maxCount: number; t: Record<string, string> }) {
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);

    const W = 520;
    const H = 210;
    const padL = 44;
    const padR = 16;
    const padT = 16;
    const padB = 40;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;
    const barGap = 10;
    const barW = Math.max(16, (graphW - barGap * (data.length + 1)) / data.length);

    // 渐进色谱：未学习(灰) → 初识(红) → 熟悉(橙) → 巩固(蓝) → 掌握(绿) → 精通(金)
    const colors = ['#94a3b8', '#f87171', '#fb923c', '#60a5fa', '#34d399', '#fbbf24'];

    const yTicks = 4;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxCount / yTicks) * i));

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet">
                {yTickValues.map(v => {
                    const y = padT + graphH - (v / maxCount) * graphH;
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">{v}</text>
                        </g>
                    );
                })}
                {data.map((s, i) => {
                    const barH = (s.count / maxCount) * graphH;
                    const x = padL + barGap + i * (barW + barGap);
                    const y = padT + graphH - barH;
                    const color = colors[s.state] ?? '#94a3b8';
                    return (
                        <g key={s.state}>
                            <rect
                                x={x} y={Math.min(y, padT + graphH - 1)} width={barW}
                                height={Math.max(barH, 1)} rx="3"
                                fill={color} opacity="0.88"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={ev => setTip({
                                    x: ev.clientX, y: ev.clientY,
                                    lines: [labels[s.label] ?? s.label, `${s.count}`]
                                })}
                                onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                                onMouseLeave={hide}
                            />
                            {s.count > 0 && (
                                <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="analytics-bar-label">
                                    {s.count}
                                </text>
                            )}
                            <text x={x + barW / 2} y={H - 4} textAnchor="middle" className="analytics-axis-label">
                                {labels[s.label] ?? s.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
            {tip && <ChartTooltip x={tip.x} y={tip.y} lines={tip.lines} />}
        </>
    );
}

/* ── Forgetting Curve — Line Chart ── */
function ForgettingCurveChart({ data, t }: { data: { day: number; words: number }[]; t: Record<string, any> }) { // eslint-disable-line @typescript-eslint/no-explicit-any
    const [tip, setTip] = useState<{ x: number; y: number; lines: string[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);

    const maxWords = useMemo(() => Math.max(...data.map(d => d.words), 1), [data]);

    const W = 760;
    const H = 220;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 36;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;

    const maxDay = data.length > 0 ? data[data.length - 1].day : 1;
    const getX = (day: number) => padL + (maxDay > 0 ? (day / maxDay) * graphW : graphW / 2);
    const getY = (words: number) => padT + graphH - (words / maxWords) * graphH;

    const points = data.map(d => `${getX(d.day)},${getY(d.words)}`);

    const areaD = points.length > 0
        ? `M ${points[0]} L ${points.join(' L ')} L ${getX(data[data.length - 1].day)},${padT + graphH} L ${padL},${padT + graphH} Z`
        : '';

    const yTicks = 4;
    const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => Math.round((maxWords / yTicks) * i));

    const xLabelCount = Math.min(8, data.length);
    const xLabels: { idx: number; label: string; x: number }[] = [];
    if (data.length > 0) {
        for (let i = 0; i < xLabelCount; i++) {
            const idx = Math.round((i / (xLabelCount - 1 || 1)) * (data.length - 1));
            const dayLabel = (t.forgettingCurveDay as string).replace('{n}', String(data[idx].day));
            xLabels.push({ idx, label: dayLabel, x: getX(data[idx].day) });
        }
    }

    const showTip = useCallback((ev: React.MouseEvent, d: { day: number; words: number }) => {
        const dayLabel = (t.forgettingCurveDay as string).replace('{n}', String(d.day));
        const dateStr = formatDateFromOffset(d.day + 1);
        setTip({ x: ev.clientX, y: ev.clientY, lines: [`${dayLabel} · ${dateStr}`, `${d.words} ${t.wordsUnit}`] });
    }, [t]);

    const curveColor = '#f97316';

    return (
        <>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <linearGradient id="forgettingAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={curveColor} stopOpacity="0.22" />
                        <stop offset="100%" stopColor={curveColor} stopOpacity="0.02" />
                    </linearGradient>
                </defs>
                {yTickValues.map(v => {
                    const y = getY(v);
                    return (
                        <g key={v}>
                            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
                            <text x={padL - 6} y={y + 4} textAnchor="end" className="analytics-axis-label">{v}</text>
                        </g>
                    );
                })}
                {areaD && <path d={areaD} fill="url(#forgettingAreaGrad)" />}
                {points.length > 1 && (
                    <polyline
                        points={points.join(' ')}
                        fill="none"
                        stroke={curveColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}
                {data.map((d, i) => (
                    <circle
                        key={`hit-${i}`} cx={getX(d.day)} cy={getY(d.words)} r="8"
                        fill="transparent" stroke="none"
                        style={{ cursor: 'pointer' }}
                        onMouseEnter={ev => showTip(ev, d)}
                        onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                        onMouseLeave={hide}
                    />
                ))}
                {data.map((d, i) => (
                    <circle
                        key={`dot-${i}`} cx={getX(d.day)} cy={getY(d.words)} r="3.5"
                        fill="var(--color-surface)" stroke={curveColor} strokeWidth="2"
                        style={{ pointerEvents: 'none' }}
                    />
                ))}
                {/* X-axis labels */}
                {xLabels.map(xl => (
                    <text key={xl.idx} x={xl.x} y={H - 4} textAnchor="middle" className="analytics-axis-label">
                        {xl.label}
                    </text>
                ))}
            </svg>
            {tip && <ChartTooltip x={tip.x} y={tip.y} lines={tip.lines} />}
        </>
    );
}


/* ── Writing Analytics Components ── */
import { getWritingAnalytics, type WritingAnalytics } from '../../api/analytics';

function WritingAnalyticsPanel({ t }: { t: any }) {
    const { lang } = useLang();
    const { user } = useAuth();
    const [data, setData] = useState<WritingAnalytics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getWritingAnalytics()
            .then(res => setData(res))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="analytics-loading">
                <div className="analytics-skeleton-chart" />
                <div className="analytics-skeleton-chart" />
            </div>
        );
    }

    if (!data || (data.task1_trend.length === 0 && data.task2_trend.length === 0)) {
        return <div className="analytics-empty">{t.noData || '暂无写作数据'}</div>;
    }

    const latestT2 = data.task2_trend[data.task2_trend.length - 1]?.overall;
    const latestT1 = data.task1_trend[data.task1_trend.length - 1]?.overall;
    const latestScore = latestT2 ?? latestT1 ?? 0;

    return (
        <div className="analytics-charts">
            <div className="analytics-stats" style={{ marginBottom: '24px', display: 'flex', gap: '16px' }}>
                <div className="analytics-stat-card" style={{ flex: 1 }}>
                    <span className="analytics-stat-num">{data.total_corrections}</span>
                    <span className="analytics-stat-label">{t.totalCorrections || '累计批改次数'}</span>
                </div>
                <div className="analytics-stat-card" style={{ flex: 1 }}>
                    <span className="analytics-stat-num">{latestScore.toFixed(1)}</span>
                    <span className="analytics-stat-label">{t.latestScore || '近期得分'}</span>
                </div>
            </div>

            {data.task2_trend.length > 0 && (
                <div className="analytics-chart-card">
                    <h3 className="analytics-chart-title">{t.task2Trend || '大作文趋势 (Task 2)'}</h3>
                    <WritingScoreLineChart data={data.task2_trend} taskLabel={t.task2 || "大作文 (Task 2)"} color="#f59e0b" t={t} targetScore={user?.target_writing || null} />
                </div>
            )}

            {data.task1_trend.length > 0 && (
                <div className="analytics-chart-card">
                    <h3 className="analytics-chart-title">{t.task1Trend || '小作文趋势 (Task 1)'}</h3>
                    <WritingScoreLineChart data={data.task1_trend} taskLabel={t.task1 || "小作文 (Task 1)"} color="#3b82f6" t={t} targetScore={user?.target_writing || null} />
                </div>
            )}

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                {data.task2_trend.length > 0 && (
                    <div className="analytics-chart-card" style={{ flex: '1 1 300px' }}>
                        <h3 className="analytics-chart-title">{t.skillsAvg.task2}</h3>
                        <WritingSkillsRadarChart skills={data.task2_skills_avg} t={t} targetScore={user?.target_writing || null} />
                    </div>
                )}
                
                {data.task1_trend.length > 0 && (
                    <div className="analytics-chart-card" style={{ flex: '1 1 300px' }}>
                        <h3 className="analytics-chart-title">{t.skillsAvg.task1}</h3>
                        <WritingSkillsRadarChart skills={data.task1_skills_avg} t={t} targetScore={user?.target_writing || null} />
                    </div>
                )}
            </div>
        </div>
    );
}

import type { WritingRecord } from '../../api/analytics';

function ChartLegendToggle({ label, color, checked, onChange }: { label: string, color: string, checked: boolean, onChange: () => void }) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: color, cursor: 'pointer' }} />
            <div style={{ width: '10px', height: '3px', backgroundColor: color, borderRadius: '2px', marginLeft: '2px' }}></div>
            <span style={{ color: checked ? 'var(--color-text)' : 'var(--color-text-dim)', fontWeight: 500, transition: 'color 0.2s' }}>{label}</span>
        </label>
    );
}

function WritingScoreLineChart({ data, taskLabel, color, t, targetScore }: { data: WritingRecord[]; taskLabel: string; color: string; t: any; targetScore?: number | null }) {
    const [tip, setTip] = useState<{ x: number; y: number; lines: React.ReactNode[] } | null>(null);
    const hide = useCallback(() => setTip(null), []);

    const [showTr, setShowTr] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [showLr, setShowLr] = useState(false);
    const [showGra, setShowGra] = useState(false);

    const W = 760;
    const H = 280;
    const padL = 40;
    const padR = 24;
    const padT = 24;
    const padB = 40;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;

    const maxScore = 9;
    const minScore = 4;

    const getX = (idx: number) => padL + (data.length > 1 ? (idx / (data.length - 1)) * graphW : graphW / 2);
    const getY = (score: number) => padT + graphH - ((score - minScore) / (maxScore - minScore)) * graphH;

    const overallPoints = data.map((d, i) => `${getX(i)},${getY(d.overall)}`);
    const trPoints = showTr ? data.map((d, i) => d.tr !== null ? `${getX(i)},${getY(d.tr)}` : null).filter(Boolean) as string[] : [];
    const ccPoints = showCc ? data.map((d, i) => d.cc !== null ? `${getX(i)},${getY(d.cc)}` : null).filter(Boolean) as string[] : [];
    const lrPoints = showLr ? data.map((d, i) => d.lr !== null ? `${getX(i)},${getY(d.lr)}` : null).filter(Boolean) as string[] : [];
    const graPoints = showGra ? data.map((d, i) => d.gra !== null ? `${getX(i)},${getY(d.gra)}` : null).filter(Boolean) as string[] : [];

    const yTicks = [4, 5, 6, 7, 8, 9];

    const xLabelCount = Math.min(8, data.length);
    const xLabels: { idx: number; label: string; x: number }[] = [];
    if (data.length > 0) {
        for (let i = 0; i < xLabelCount; i++) {
            const idx = Math.round((i / (xLabelCount - 1 || 1)) * (data.length - 1));
            // Show only MM-DD to save space or full if few
            const labelStr = data[idx].date.split(' ')[0]; // just MM-DD
            xLabels.push({ idx, label: labelStr, x: getX(idx) });
        }
    }

    const cTr = '#10b981';
    const cCc = '#8b5cf6';
    const cLr = '#ec4899';
    const cGra = '#06b6d4';

    const handleMouseEnter = (ev: React.MouseEvent, d: WritingRecord) => {
        const lines: React.ReactNode[] = [
            <div key="date" style={{fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '4px'}}>{d.date}</div>,
            <div key="overall" style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}>
                <span>Overall:</span> <strong style={{color: color}}>{d.overall.toFixed(1)}</strong>
            </div>
        ];
        if (showTr && d.tr !== null) lines.push(<div key="tr" style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}><span>TR/TA:</span> <strong style={{color: cTr}}>{d.tr.toFixed(1)}</strong></div>);
        if (showCc && d.cc !== null) lines.push(<div key="cc" style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}><span>CC:</span> <strong style={{color: cCc}}>{d.cc.toFixed(1)}</strong></div>);
        if (showLr && d.lr !== null) lines.push(<div key="lr" style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}><span>LR:</span> <strong style={{color: cLr}}>{d.lr.toFixed(1)}</strong></div>);
        if (showGra && d.gra !== null) lines.push(<div key="gra" style={{display: 'flex', justifyContent: 'space-between', gap: '16px'}}><span>GRA:</span> <strong style={{color: cGra}}>{d.gra.toFixed(1)}</strong></div>);
        
        setTip({ x: ev.clientX, y: ev.clientY, lines });
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '0.85rem', position: 'relative', zIndex: 1, padding: '0 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '3px', backgroundColor: color, borderRadius: '2px' }}></div>
                    <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>Overall Score</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <ChartLegendToggle label="TR/TA" color={cTr} checked={showTr} onChange={() => setShowTr(!showTr)} />
                    <ChartLegendToggle label="CC" color={cCc} checked={showCc} onChange={() => setShowCc(!showCc)} />
                    <ChartLegendToggle label="LR" color={cLr} checked={showLr} onChange={() => setShowLr(!showLr)} />
                    <ChartLegendToggle label="GRA" color={cGra} checked={showGra} onChange={() => setShowGra(!showGra)} />
                </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet">
                <defs>
                    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
                    </filter>
                </defs>


                {/* Target Score Line */}
                {targetScore !== undefined && targetScore !== null && Number(targetScore) >= minScore && Number(targetScore) <= maxScore && (
                    <g>
                        <line x1={padL} y1={getY(Number(targetScore))} x2={W - padR} y2={getY(Number(targetScore))} stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="5 5" />
                        <text x={W - padR - 5} y={getY(Number(targetScore)) - 6} textAnchor="end" fontSize="12" fill="var(--color-primary)" fontWeight="bold">{t.skillsAvg.target} {Number(targetScore).toFixed(1)}</text>
                    </g>
                )}

                {yTicks.map(v => (
                    <g key={v}>
                        <line x1={padL} y1={getY(v)} x2={W - padR} y2={getY(v)} stroke="var(--color-border)" strokeWidth="0.5" strokeDasharray="3 3" />
                        <text x={padL - 10} y={getY(v) + 4} textAnchor="end" className="analytics-axis-label" fill="var(--color-text-dim)">{v}</text>
                    </g>
                ))}

                {/* Sub-scores (dashed lines) */}
                {trPoints.length > 1 && <polyline points={trPoints.join(' ')} fill="none" stroke={cTr} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />}
                {ccPoints.length > 1 && <polyline points={ccPoints.join(' ')} fill="none" stroke={cCc} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />}
                {lrPoints.length > 1 && <polyline points={lrPoints.join(' ')} fill="none" stroke={cLr} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />}
                {graPoints.length > 1 && <polyline points={graPoints.join(' ')} fill="none" stroke={cGra} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />}

                {/* Overall (thick solid line with shadow) */}
                {overallPoints.length > 1 && (
                    <polyline points={overallPoints.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#shadow)" />
                )}

                {/* Data points for Overall (hoverable) */}
                {data.map((d, i) => (
                    <g key={d.id}>
                        <circle cx={getX(i)} cy={getY(d.overall)} r="12" fill="transparent" style={{ cursor: 'pointer' }}
                            onMouseEnter={(ev) => handleMouseEnter(ev, d)}
                            onMouseMove={ev => setTip(prev => prev ? { ...prev, x: ev.clientX, y: ev.clientY } : null)}
                            onMouseLeave={hide} />
                        <circle cx={getX(i)} cy={getY(d.overall)} r="4" fill="var(--color-surface)" stroke={color} strokeWidth="2.5" style={{ pointerEvents: 'none' }} />
                        
                        {/* Render small dots for sub-scores if shown */}
                        {showTr && d.tr !== null && <circle cx={getX(i)} cy={getY(d.tr)} r="2.5" fill={cTr} style={{ pointerEvents: 'none' }} />}
                        {showCc && d.cc !== null && <circle cx={getX(i)} cy={getY(d.cc)} r="2.5" fill={cCc} style={{ pointerEvents: 'none' }} />}
                        {showLr && d.lr !== null && <circle cx={getX(i)} cy={getY(d.lr)} r="2.5" fill={cLr} style={{ pointerEvents: 'none' }} />}
                        {showGra && d.gra !== null && <circle cx={getX(i)} cy={getY(d.gra)} r="2.5" fill={cGra} style={{ pointerEvents: 'none' }} />}
                    </g>
                ))}

                {xLabels.map((xl, i) => (
                    <text key={i} x={xl.x} y={H - 12} textAnchor="middle" className="analytics-axis-label" fill="var(--color-text-dim)">
                        {xl.label}
                    </text>
                ))}
            </svg>
            {tip && <ChartTooltip x={tip.x} y={tip.y} lines={tip.lines as any} />}
        </>
    );
}

function WritingSkillsRadarChart({ skills, t, targetScore }: { skills: WritingAnalytics['skills_avg']; t: any; targetScore?: number | null }) {
    const W = 420;
    const H = 360;
    const cx = W / 2;
    const cy = H / 2;
    const radius = 120;
    const maxScore = 9;

    const data = [
        { label: 'TR / TA', score: skills.tr },
        { label: 'CC', score: skills.cc },
        { label: 'LR', score: skills.lr },
        { label: 'GRA', score: skills.gra },
    ];

    const angles = [ -Math.PI/2, 0, Math.PI/2, Math.PI ];

    const getPoint = (score: number, index: number) => {
        const r = (score / maxScore) * radius;
        return {
            x: cx + r * Math.cos(angles[index]),
            y: cy + r * Math.sin(angles[index])
        };
    };

    const polygonPoints = data.map((d, i) => {
        const p = getPoint(d.score, i);
        return `${p.x},${p.y}`;
    }).join(' ');


    const targetPoints = targetScore !== undefined && targetScore !== null
        ? angles.map((_, i) => {
            const p = getPoint(Number(targetScore), i);
            return `${p.x},${p.y}`;
        }).join(' ')
        : null;

    const ticks = [2, 4, 6, 8]; // cleaner grid

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="analytics-svg" preserveAspectRatio="xMidYMid meet" style={{ margin: '0 auto', display: 'block', maxWidth: '420px', overflow: 'visible' }}>
            <defs>
                <linearGradient id="radarAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
                </linearGradient>
            </defs>

            {/* Circular Grid Background */}
            {ticks.map(tick => {
                const r = (tick / maxScore) * radius;
                return (
                    <g key={tick}>
                        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-border)" strokeWidth="1" strokeDasharray="4 4" />
                        {tick > 2 ? <text x={cx + 4} y={cy - r + 12} fontSize="11" fill="var(--color-text-dim)" opacity="0.7">{tick}</text> : null}
                    </g>
                );
            })}

            {/* Axes */}
            {angles.map((a, i) => (
                <line key={i} x1={cx} y1={cy} x2={cx + radius * Math.cos(a)} y2={cy + radius * Math.sin(a)} stroke="var(--color-border)" strokeWidth="1" />
            ))}


            {/* Target Score Polygon */}
            {targetPoints && (
                <polygon points={targetPoints} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeDasharray="5 5" strokeLinejoin="round" />
            )}

            {/* Radar Polygon */}
            <polygon points={polygonPoints} fill="url(#radarAreaGrad)" stroke="var(--color-primary)" strokeWidth="3" strokeLinejoin="round" />

            {/* Data Points */}
            {data.map((d, i) => {
                const p = getPoint(d.score, i);
                return <circle key={i} cx={p.x} cy={p.y} r="5" fill="var(--color-primary)" stroke="var(--color-surface)" strokeWidth="2" />;
            })}

            {/* Labels */}
            {data.map((d, i) => {
                const textOffset = 28;
                const x = cx + (radius + textOffset) * Math.cos(angles[i]);
                const y = cy + (radius + textOffset) * Math.sin(angles[i]);
                
                return (
                    <text key={i} x={x} y={y} textAnchor="middle" alignmentBaseline="middle" fontSize="14" fontWeight="600" fill="var(--color-text)">
                        {d.label} <tspan fill="var(--color-primary)">({d.score.toFixed(1)})</tspan>
                    </text>
                );
            })}
        </svg>
    );
}
