import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLang } from '../../i18n/LanguageContext';
import { getVocabAnalytics, getScheduledWords, type ScheduledBucket, type StateBucket, type PlanBrief } from '../../api/analytics';
import '../../styles/analytics_page.css';

/* ── Shared chart tooltip (same style as calendar .lc-tooltip) ── */
function ChartTooltip({ x, y, lines }: { x: number; y: number; lines: string[] }) {
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

            {/* ── Skill tabs (placeholder for future) ── */}
            <div className="analytics-tabs">
                {(['vocab', 'listening', 'speaking', 'reading', 'writing'] as const).map(sk => (
                    <button
                        key={sk}
                        className="analytics-tab analytics-tab--active"
                        disabled={sk !== 'vocab'}
                        title={sk !== 'vocab' ? t.analytics.comingSoon : undefined}
                    >
                        {String(t.analytics[`${sk}Tab` as keyof typeof t.analytics])}
                        {sk !== 'vocab' && <span className="analytics-tab-badge">{t.analytics.comingSoon}</span>}
                    </button>
                ))}
            </div>

            {/* ── Plan selector ── */}
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
