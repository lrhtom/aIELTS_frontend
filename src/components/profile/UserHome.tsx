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
    const [loading, setLoading] = useState(true);

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
        if (d > 0) parts.push(`${d}${t.profile.timeFormat.day} `);
        if (h > 0) parts.push(`${h}${t.profile.timeFormat.hour} `);
        if (m > 0) parts.push(`${m}${t.profile.timeFormat.minute} `);
        if (s > 0 || parts.length === 0) parts.push(`${s}${t.profile.timeFormat.second}`);
        return parts.join('').trim();
    };

    // Format seconds as readable for tooltip (e.g. 1小时23分)
    const formatSecondsMid = (secs: number): string => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}${t.profile.timeFormat.hour}${m > 0 ? ' ' + m + t.profile.timeFormat.minute : ''}`;
        if (m > 0) return `${m}${t.profile.timeFormat.minute}${s > 0 ? ' ' + s + t.profile.timeFormat.second : ''}`;
        return `${s}${t.profile.timeFormat.second}`;
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

        void loadData().finally(() => { if (!cancelled) setLoading(false); });
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

        // ── build month-grouped grid ──
        const MONTHS = t.profile.home.calendar.months;
        type CalCell = { date?: string; level?: number; entry?: CalendarEntry | null; inRange: boolean };
        const monthsData: { label: string; weeks: CalCell[][] }[] = [];
        
        let currentMonth = -1;
        let currentWeeks: CalCell[][] = [];
        let currentWeek: CalCell[] = [];

        const pushWeek = () => {
            if (currentWeek.length > 0) {
                while (currentWeek.length < 7) {
                    currentWeek.push({ inRange: false });
                }
                currentWeeks.push(currentWeek);
                currentWeek = [];
            }
        };

        const c = new Date(oneYearAgo);
        while (c <= today) {
            const m = c.getMonth();
            if (m !== currentMonth) {
                if (currentMonth !== -1) {
                    pushWeek();
                    monthsData.push({ label: MONTHS[currentMonth], weeks: currentWeeks });
                }
                currentMonth = m;
                currentWeeks = [];
                currentWeek = [];
                
                const dayOfWeek = c.getDay();
                for (let i = 0; i < dayOfWeek; i++) {
                    currentWeek.push({ inRange: false });
                }
            }

            const key = fmt(c);
            let level = 0;
            const entryObj = lookup[key] ?? null;
            if (entryObj) {
                const secs = entryObj.learning_seconds ?? 0;
                if (secs >= 30 * 60)      level = 4;
                else if (secs >= 10 * 60) level = 3;
                else if (secs >= 5 * 60)  level = 2;
                else if (secs > 0)        level = 1;
                else if (entryObj.activity) level = 1;
            }
            
            currentWeek.push({ date: key, level, entry: entryObj, inRange: true });
            
            if (currentWeek.length === 7) {
                pushWeek();
            }
            
            c.setDate(c.getDate() + 1);
        }
        
        if (currentMonth !== -1) {
            pushWeek();
            monthsData.push({ label: MONTHS[currentMonth], weeks: currentWeeks });
        }

        return { monthsData, cumulativeDays, consecutive };
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
            <div className="lc-calendar-card">
                {loading || !calData ? (
                    /* ── Skeleton loader ── */
                    <>
                        <div className="lc-cal-topbar">
                            <span className="lc-skeleton lc-skeleton-text" style={{ width: '220px' }} />
                            <div className="lc-cal-topbar-right">
                                <span className="lc-skeleton lc-skeleton-chip" />
                                <span className="lc-cal-topbar-divider" />
                                <span className="lc-skeleton lc-skeleton-chip" />
                                <span className="lc-cal-topbar-divider" />
                                <span className="lc-skeleton lc-skeleton-chip" style={{ width: '90px' }} />
                            </div>
                        </div>
                        <div className="lc-cal-body">
                            <div className="lc-cal-graph" style={{ width: '100%' }}>
                                <div className="lc-cal-grid" style={{ display: 'flex', width: '100%', height: '110px' }}>
                                    <div className="lc-skeleton" style={{ width: '100%', height: '100%', borderRadius: '4px' }} />
                                </div>
                                <div className="lc-cal-legend" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <div className="lc-skeleton" style={{ width: '120px', height: '14px', borderRadius: '2px' }} />
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ── Real calendar ── */
                    <>
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
                        <div className="lc-cal-body">
                            <div className="lc-cal-graph">
                                <div className="lc-cal-grid" style={{ display: 'flex', gap: '8px' }}
                                    onMouseMove={(ev) => {
                                        if (!tooltip) return;
                                        const bodyRect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
                                        const cx = ev.clientX;
                                        const cy = ev.clientY;
                                        const clampedX = Math.min(Math.max(cx, bodyRect.left), bodyRect.right);
                                        const clampedY = Math.min(Math.max(cy, bodyRect.top), bodyRect.bottom);
                                        setTooltip(prev => prev ? { ...prev, x: clampedX, y: clampedY } : null);
                                    }}
                                    onMouseLeave={() => setTooltip(null)}
                                >
                                    {calData.monthsData.map((mBlock, mIdx) => (
                                        <div key={mIdx} className="lc-cal-month-col" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                            <div
                                                className="lc-cal-cells"
                                                style={{ gridTemplateColumns: `repeat(${mBlock.weeks.length}, 10.5px)` }}
                                            >
                                                {[0, 1, 2, 3, 4, 5, 6].map(row =>
                                                    mBlock.weeks.map((week, col) => {
                                                        const cell = week[row];
                                                        if (!cell || !cell.inRange) {
                                                            return <div key={`${col}-${row}`} className="lc-dot lc-empty" />;
                                                        }
                                                        const e = cell.entry;
                                                        const buildTooltip = () => {
                                                            const secs = e?.learning_seconds ?? 0;
                                                            const tt = t.profile.home.calendar.tooltip;
                                                            if (secs === 0) {
                                                                const parts = [cell.date, tt.noActivity];
                                                                if (e?.checked) parts.push(tt.checkedIn);
                                                                return parts.join('\n');
                                                            }
                                                            const parts: string[] = [cell.date, tt.studied.replace('{time}', formatSecondsMid(secs))];
                                                            if (e?.checked)   parts.push(tt.checkedIn);
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
                                                                className={`lc-dot lc-lvl-${cell.level}${e?.checked ? ' lc-checked' : ''}`}
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
                                            <div className="lc-cal-xlabel" style={{ position: 'static', transform: 'none', textAlign: 'left' }}>
                                                {mBlock.label}
                                            </div>
                                        </div>
                                    ))}
                                </div>
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
                    </>
                )}
            </div>

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
                    {loading ? (
                        <div className="plans-skeleton">
                            {[0, 1, 2].map(i => (
                                <div key={i} className="plan-item-skeleton">
                                    <div className="plan-item-top">
                                        <span className="lc-skeleton lc-skeleton-text" style={{ width: '120px' }} />
                                        <span className="lc-skeleton lc-skeleton-text" style={{ width: '60px' }} />
                                    </div>
                                    <div className="plan-progress-bar lc-skeleton-bar" />
                                    <div className="plan-item-bottom">
                                        <span className="lc-skeleton lc-skeleton-text" style={{ width: '90px' }} />
                                        <div className="plan-progress-bar plan-progress-bar-total lc-skeleton-bar" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : plans.length === 0 ? (
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
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => navigate(`/vocabulary/plans/${plan.id}`)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/vocabulary/plans/${plan.id}`); } }}
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
