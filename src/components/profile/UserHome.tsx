import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { getTodayLearningTime, listPlans, type LearningPlan } from '../../api/learning_plan';
import { getCards } from '../../api/vocab';
import { checkinApi, type CalendarEntry } from '../../api/checkin';
import { formatATBalance } from '../../utils/format';
import { Clock, Coins, BookMarked, Library, ChevronRight } from 'lucide-react';

export default function UserHome() {
    const { user } = useAuth();
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const [todayLearningSeconds, setTodayLearningSeconds] = useState<number | null>(null);
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [vocabTotal, setVocabTotal] = useState<number | null>(null);
    const [calendarData, setCalendarData] = useState<CalendarEntry[]>([]);
    const [registeredDate, setRegisteredDate] = useState<string>('');
    const [totalYearSeconds, setTotalYearSeconds] = useState<number>(0);

    // Tooltip state (viewport-fixed coordinates)
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

    const formatDuration = (seconds: number | null) => {
        if (seconds === null) return '--:--:--';
        const safe = Math.max(0, seconds);
        const h = Math.floor(safe / 3600).toString().padStart(2, '0');
        const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
        const s = (safe % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // Format seconds as X天X小时X分X秒 for the year summary
    const formatSecondsLong = (total: number): string => {
        const d = Math.floor(total / 86400);
        const h = Math.floor((total % 86400) / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const parts: string[] = [];
        if (d > 0) parts.push(`${d}天`);
        if (h > 0) parts.push(`${h}小时`);
        if (m > 0) parts.push(`${m}分`);
        if (s > 0 || parts.length === 0) parts.push(`${s}秒`);
        return parts.join('');
    };

    // Format seconds as readable for tooltip (e.g. 1小时23分)
    const formatSecondsMid = (secs: number): string => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}小时${m > 0 ? m + '分' : ''}`;
        if (m > 0) return `${m}分${s > 0 ? s + '秒' : ''}`;
        return `${s}秒`;
    };

    useEffect(() => {
        let cancelled = false;

        const loadData = async () => {
            try {
                const timeData = await getTodayLearningTime();
                if (!cancelled) setTodayLearningSeconds(Math.max(0, Number(timeData.total_seconds) || 0));
            } catch { if (!cancelled) setTodayLearningSeconds(0); }

            try {
                const planData = await listPlans();
                if (!cancelled) setPlans(planData.plans || []);
            } catch { /* ignore */ }

            try {
                const cardData = await getCards();
                if (!cancelled) setVocabTotal(cardData.stats?.total ?? 0);
            } catch { /* ignore */ }

            try {
                const status = await checkinApi.getStatus();
                if (!cancelled) {
                    setCalendarData(status.calendar || []);
                    setRegisteredDate(status.registered_date || '');
                    setTotalYearSeconds(status.total_year_seconds || 0);
                }
            } catch { /* ignore */ }
        };

        void loadData();
        return () => { cancelled = true; };
    }, []);

    // ── Calendar: past 365 days, 53×7 grid ──
    const calData = useMemo(() => {
        if (!registeredDate) return null;

        const fmt = (d: Date) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        const today = new Date();
        const todayStr = fmt(today);

        const lookup: Record<string, CalendarEntry> = {};
        for (const e of calendarData) lookup[e.date] = e;

        // ── compute stats in past year ──
        let cumulativeDays = 0;
        let consecutive = 0;

        const oneYearAgo = new Date(today);
        oneYearAgo.setDate(oneYearAgo.getDate() - 364);
        const oneYearAgoStr = fmt(oneYearAgo);

        // Count cumulative from all calendar entries
        for (const e of calendarData) {
            if (e.activity) cumulativeDays++;
        }

        // Consecutive streak: walk back from today
        const cur = new Date(today);
        while (true) {
            const key = fmt(cur);
            const e = lookup[key];
            if (e && e.activity) { consecutive++; cur.setDate(cur.getDate() - 1); }
            else break;
        }

        // ── build 53-column grid (Sunday-start weeks) ──

        // Grid must cover: oneYearAgo (aligned to Sunday) → this Saturday
        const gridStart = new Date(oneYearAgo);
        gridStart.setDate(gridStart.getDate() - gridStart.getDay()); // back to Sunday

        const gridEnd = new Date(today);
        const ed = gridEnd.getDay();
        if (ed !== 6) gridEnd.setDate(gridEnd.getDate() + (6 - ed)); // fwd to Saturday


        const weeks: { date: string; level: number; entry: CalendarEntry | null; inRange: boolean }[][] = [];
        let buf: { date: string; level: number; entry: CalendarEntry | null; inRange: boolean }[] = [];
        const c = new Date(gridStart);
        while (c <= gridEnd) {
            const key = fmt(c);
            let level = 0;
            const inRange = key >= oneYearAgoStr && key <= todayStr;
            const entryObj = lookup[key] ?? null;
            if (inRange && entryObj) {
                const secs = entryObj.learning_seconds ?? 0;
                if (secs >= 30 * 60)      level = 4;   // ≥ 30min
                else if (secs >= 10 * 60) level = 3;  // 10–30min
                else if (secs >= 5 * 60)  level = 2;  // 5–10min
                else if (secs > 0)        level = 1;  // > 0s < 5min
                else if (entryObj.activity) level = 1; // fallback: has activity but no time record
            }
            buf.push({ date: key, level, entry: entryObj, inRange });
            if (c.getDay() === 6) { weeks.push(buf); buf = []; }
            c.setDate(c.getDate() + 1);
        }
        if (buf.length > 0) weeks.push(buf);

        // Exactly 53 columns
        while (weeks.length < 53) {
            // Pad with empty weeks at the start if needed (shouldn't happen for 1 year)
            weeks.unshift([]);
        }
        const displayWeeks = weeks.slice(-53);

        // ── month labels: percentage offset across 53 columns ──
        const MONTHS = t.profile.home.calendar.months;
        type MonthMark = { label: string; pct: number };
        const monthMarks: MonthMark[] = [];
        let lastM = -1;
        for (let wi = 0; wi < displayWeeks.length; wi++) {
            const w = displayWeeks[wi];
            if (w.length === 0) continue;
            const d = new Date(w[0].date + 'T00:00:00');
            const m = d.getMonth();
            if (m !== lastM) {
                monthMarks.push({ label: MONTHS[m], pct: (wi / displayWeeks.length) * 100 });
                lastM = m;
            }
        }

        return { weeks: displayWeeks, monthMarks, cumulativeDays, consecutive };
    }, [calendarData, registeredDate, t]);

    return (
        <div className="user-home">
            {/* Welcome row */}
            <div className="profile-home-header">
                <div>
                    <h2>{t.profile.welcome}, {user?.username}</h2>
                    <p>{t.profile.welcomeDesc}</p>
                </div>
            </div>

            {/* Stats row */}
            <div className="profile-stats-grid">
                <div className="profile-stat-card">
                    <div className="stat-icon-wrap"><Clock size={20} /></div>
                    <div className="stat-info">
                        <div className="stat-value">{formatDuration(todayLearningSeconds)}</div>
                        <div className="stat-label">{t.profile.info.todayLearningTime}</div>
                    </div>
                </div>
                <div className="profile-stat-card">
                    <div className="stat-icon-wrap"><Coins size={20} /></div>
                    <div className="stat-info">
                        <div className="stat-value">{formatATBalance(user?.atBalance)} <span className="stat-unit">AT</span></div>
                        <div className="stat-label">{t.profile.balance.title}</div>
                    </div>
                </div>
                <div className="profile-stat-card">
                    <div className="stat-icon-wrap"><BookMarked size={20} /></div>
                    <div className="stat-info">
                        <div className="stat-value">{plans.length}</div>
                        <div className="stat-label">{t.profile.quickAccess.targets}</div>
                    </div>
                </div>
                <div className="profile-stat-card">
                    <div className="stat-icon-wrap"><Library size={20} /></div>
                    <div className="stat-info">
                        <div className="stat-value">{vocabTotal ?? '--'}</div>
                        <div className="stat-label">{t.profile.home.vocabTotal}</div>
                    </div>
                </div>
            </div>

            {/* Learning Calendar */}
            {calData && (
                <div className="lc-calendar-card">
                    {/* ── Top info bar ── */}
                    <div className="lc-cal-topbar">
                        <span className="lc-cal-topbar-title">{t.profile.home.calendar.yearSummary.replace('{time}', formatSecondsLong(totalYearSeconds))}</span>
                        <div className="lc-cal-topbar-right">
                            <span className="lc-cal-topbar-stat">{t.profile.home.calendar.cumulativeDays.replace('{n}', String(calData.cumulativeDays))}</span>
                            <span className="lc-cal-topbar-divider" />
                            <span className="lc-cal-topbar-stat">{t.profile.home.calendar.consecutive.replace('{n}', String(calData.consecutive))}</span>
                            <span className="lc-cal-topbar-divider" />
                            <span className="lc-cal-topbar-select">
                                {t.profile.home.calendar.pastYear} <span className="lc-cal-topbar-arrow">▼</span>
                            </span>
                        </div>
                    </div>

                    {/* ── 53×7 heatmap grid ── */}
                    <div className="lc-cal-body">
                        <div className="lc-cal-graph">
                            {/* ── Top X-axis month labels (absolute-positioned) ── */}
                            <div className="lc-cal-xaxis">
                                {calData.monthMarks.map((m, i) => (
                                    <span
                                        key={i}
                                        className="lc-cal-xlabel"
                                        style={{ left: `${m.pct}%` }}
                                    >
                                        {m.label}
                                    </span>
                                ))}
                            </div>

                            {/* Grid: row labels + cells */}
                            <div className="lc-cal-grid">
                                <div className="lc-cal-rows">
                                    {t.profile.home.calendar.dayLabels.map((l, i) => (
                                        <span key={i}>{l}</span>
                                    ))}
                                </div>
                                <div
                                    className="lc-cal-cells"
                                    style={{ gridTemplateColumns: `repeat(${calData.weeks.length}, 1fr)` }}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6].map(row =>
                                        calData.weeks.map((week, col) => {
                                            const cell = week[row];
                                            if (!cell || !cell.inRange) {
                                                return <div key={`${col}-${row}`} className="lc-dot lc-empty" />;
                                            }
                                            const e = cell.entry;
                                            const buildTooltip = () => {
                                                const secs = e?.learning_seconds ?? 0;
                                                const tt = t.profile.home.calendar.tooltip;
                                                if (secs === 0) return `${cell.date}\n${tt.noActivity}`;
                                                const parts: string[] = [cell.date, tt.studied.replace('{time}', formatSecondsMid(secs))];
                                                if (e?.vocab)     parts.push(tt.vocab.replace('{n}', String(e.vocab)));
                                                if (e?.reading)   parts.push(tt.reading.replace('{n}', String(e.reading)));
                                                if (e?.listening) parts.push(tt.listening.replace('{n}', String(e.listening)));
                                                if (e?.speaking)  parts.push(tt.speaking.replace('{n}', String(e.speaking)));
                                                if (e?.writing)   parts.push(tt.writing.replace('{n}', String(e.writing)));
                                                return parts.join('\n');
                                            };
                                            return (
                                                <div
                                                    key={`${col}-${row}`}
                                                    className={`lc-dot lc-lvl-${cell.level}`}
                                                    onMouseEnter={(ev) => {
                                                        const rect = (ev.target as HTMLElement).getBoundingClientRect();
                                                        setTooltip({
                                                            x: rect.left + rect.width / 2,
                                                            y: rect.top - 8,
                                                            content: buildTooltip(),
                                                        });
                                                    }}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* ── Legend ── */}
                            <div className="lc-cal-legend">
                                <span>{t.profile.home.calendar.legend.labels[0]}</span>
                                <div className="lc-dot lc-lvl-0" />
                                <span>{t.profile.home.calendar.legend.labels[1]}</span>
                                <div className="lc-dot lc-lvl-1" />
                                <span>{t.profile.home.calendar.legend.labels[2]}</span>
                                <div className="lc-dot lc-lvl-2" />
                                <span>{t.profile.home.calendar.legend.labels[3]}</span>
                                <div className="lc-dot lc-lvl-3" />
                                <div className="lc-dot lc-lvl-4" />
                                <span>{t.profile.home.calendar.legend.labels[4]}</span>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Hover Tooltip — rendered via portal so it's never clipped */}
            {tooltip && createPortal(
                <div
                    className="lc-tooltip"
                    style={{ left: tooltip.x, top: tooltip.y }}
                >
                    {tooltip.content.split('\n').map((line, i) => (
                        <span key={i} className={i === 0 ? 'lc-tooltip-date' : 'lc-tooltip-line'}>{line}</span>
                    ))}
                </div>,
                document.body
            )}

            {/* Two-column content */}
            <div className="profile-home-grid">
                {/* Plans quick view */}
                <div className="profile-plans-card">
                    <div className="card-header">
                        <h3>{t.profile.quickAccess.targets}</h3>
                        <button className="card-action-link" onClick={() => navigate('/vocabulary/plans')}>
                            {t.profile.home.plans.viewAll} <ChevronRight size={16} />
                        </button>
                    </div>
                    {plans.length === 0 ? (
                        <div className="plans-empty">
                            <BookMarked size={32} opacity={0.3} />
                            <p>{t.profile.home.plans.empty}</p>
                            <button onClick={() => navigate('/vocabulary/plans')}>{t.profile.home.plans.createFirst}</button>
                        </div>
                    ) : (
                        <div className="plans-list">
                            {plans.map(plan => {
                                const todayPct = plan.today_target > 0
                                    ? Math.min(100, Math.round((plan.studied_today / plan.today_target) * 100))
                                    : 0;
                                const totalPct = plan.word_count > 0
                                    ? Math.min(100, Math.round(((plan.studied_total || 0) / plan.word_count) * 100))
                                    : 0;
                                return (
                                    <div
                                        key={plan.id}
                                        className="plan-item"
                                        onClick={() => navigate(`/vocabulary/plans/${plan.id}`)}
                                    >
                                        <div className="plan-item-top">
                                            <span className="plan-item-name">{plan.name}</span>
                                            <span className="plan-item-progress-text">
                                                {t.profile.home.plans.today} {plan.studied_today}/{plan.today_target}
                                            </span>
                                        </div>
                                        <div className="plan-progress-bar">
                                            <div className="plan-progress-fill" style={{ width: `${todayPct}%` }} />
                                        </div>
                                        <div className="plan-item-bottom">
                                            <span className="plan-item-total-label">
                                                {t.profile.home.plans.studied} {plan.studied_total || 0}/{plan.word_count} {t.profile.home.plans.words}
                                            </span>
                                            <div className="plan-progress-bar plan-progress-bar-total">
                                                <div className="plan-progress-fill-total" style={{ width: `${totalPct}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Account info card */}
                <div className="user-info-card">
                    <div className="card-header">
                        <h3>{t.profile.info.title}</h3>
                    </div>
                    <div className="user-info-grid">
                        <div className="user-info-item">
                            <div className="user-info-label">{t.profile.info.username}</div>
                            <div className="user-info-value">{user?.username}</div>
                        </div>
                        <div className="user-info-item">
                            <div className="user-info-label">{t.profile.info.email}</div>
                            <div className="user-info-value">{user?.email}</div>
                        </div>
                        <div className="user-info-item">
                            <div className="user-info-label">{t.profile.info.created}</div>
                            <div className="user-info-value">{new Date(user?.createdAt || '').toLocaleDateString()}</div>
                        </div>
                        <div className="user-info-item">
                            <div className="user-info-label">{t.profile.info.lastLogin}</div>
                            <div className="user-info-value">{user?.last_login ? new Date(user.last_login).toLocaleString() : '-'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
