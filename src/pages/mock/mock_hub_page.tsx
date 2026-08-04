//so this pins to the bottom of the viewport no matter how long the explanations scroll.
// Four rows top to bottom (listening -> reading -> writing -> speaking, order enforced) plus a fifth row for the score report.
// State and timing come from the server (getMockDetail returns deadline / now); poll every 6s while generating.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showConfirm } from '../../components/common/ConfirmService';
import { showToast } from '../../components/common/Toast';
import {
    getMockDetail, startMockPart, finalizeMock, regenerateMockSlot,
    type MockChildView, type MockDetail, type MockExamPart, type MockGenSlot, type MockReport,
} from '../../api/mock';
import { getWritingAnalytics } from '../../api/analytics';
import { ATInterceptor } from '../../api/atInterceptor';
import { speakingStore } from '../../store/speaking_page_store';
import { roundIeltsOverall } from '../../utils/ielts_band';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/mock.css';

const PART_ICONS: Record<MockExamPart, string> = {
    listening: '🎧', reading: '📖', writing: '✍️', speaking: '🗣️',
};

function fmtRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export default function MockHubPage() {
    const { id } = useParams();
    const mockId = Number(id);
    const navigate = useNavigate();
    const { t } = useLang();

    const [detail, setDetail] = useState<MockDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    // Server clock offset: serverNow - clientNow. Remaining time is always computed on the server clock
    const clockOffsetRef = useRef(0);
    const [, forceTick] = useState(0);

    const reload = useCallback(async () => {
        try {
            const d = await getMockDetail(mockId);
            clockOffsetRef.current = new Date(d.now).getTime() - Date.now();
            setDetail(d);
        } catch (err) {
            showToast(`${t('mock.hub.loadFail')}: ${(err as Error).message ?? ''}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [mockId, t]);

    useEffect(() => { reload(); }, [reload]);

    // poll while generating, and refresh the remaining-time display every second while in_progress
    const anyGenerating = detail
        ? Object.values(detail.parts).some(p => p.genStatus === 'generating')
        : false;
    const anyInProgress = detail
        ? Object.values(detail.parts).some(p => p.status === 'in_progress')
        : false;

    useEffect(() => {
        if (!anyGenerating) return;
        const timer = setInterval(reload, 6000);
        return () => clearInterval(timer);
    }, [anyGenerating, reload]);

    useEffect(() => {
        if (!anyInProgress) return;
        const timer = setInterval(() => forceTick(v => v + 1), 1000);
        return () => clearInterval(timer);
    }, [anyInProgress]);

    const serverNow = () => Date.now() + clockOffsetRef.current;

    const remainingMs = (deadline: string | null): number | null => {
        if (!deadline) return null;
        return new Date(deadline).getTime() - serverNow();
    };

    // -- Entry route for each section --
    const answerRoute = (part: MockExamPart, d: MockDetail): string | null => {
        const pv = d.parts[part];
        if (part === 'listening') return pv.child ? `/listening?bankId=${pv.child.id}&mockId=${d.id}` : null;
        if (part === 'reading') return pv.child ? `/reading?bankId=${pv.child.id}&mockId=${d.id}` : null;
        if (part === 'writing') {
            // Writing opens the first unsubmitted task; both share one 60-minute server timer and can be swapped via the hub
            const t1 = pv.task1;
            const t2 = pv.task2;
            if (t1 && !t1.isAnswered) {
                const chartSubtype = t1.subtype.startsWith('chart:') ? t1.subtype.slice('chart:'.length) : 'line';
                return `/writing/chart/doing?bankId=${t1.id}&type=${encodeURIComponent(chartSubtype)}&mockId=${d.id}`;
            }
            if (t2 && !t2.isAnswered) {
                const t2Type = t2.subtype.startsWith('task2:') ? t2.subtype.slice('task2:'.length) : 'opinion';
                return `/writing/task2/doing?bankId=${t2.id}&type=${encodeURIComponent(t2Type)}&mockId=${d.id}`;
            }
            return null;
        }
        return null; // speaking goes through its own start flow
    };

    const startSpeaking = async (d: MockDetail) => {
        const existing = d.parts.speaking.child;
        if (existing) {
            navigate(`/speaking/chat?bankId=${existing.id}&mockId=${d.id}`);
            return;
        }
        const res = await ATInterceptor.bankGeneratePart1();
        speakingStore.isChatAllowed = true; // the chat page's route guard needs to be let through explicitly
        navigate('/speaking/chat', {
            state: {
                mode: 'fullTest',
                questions: res.data.questions,
                showSubtitles: true,
                part: 'part1',
                bankSource: res.data.source,
                customTitle: '',
                customDesc: '',
                mockId: d.id,
            },
        });
    };

    const handleStart = async (part: MockExamPart) => {
        if (!detail || busy) return;
        const pv = detail.parts[part];
        const durationSec = detail.durations[part];
        if (pv.status === 'ready') {
            const body = durationSec
                ? t('mock.hub.startConfirmBody').replace('{duration}', t('mock.hub.minutes').replace('{n}', String(Math.round(durationSec / 60))))
                : t('mock.hub.startConfirmBodyNoTimer');
            const ok = await showConfirm({
                title: t('mock.hub.startConfirmTitle').replace('{part}', t(`mock.hub.parts.${part}`)),
                message: body,
                confirmText: t('mock.hub.startConfirmOk'),
                cancelText: t('mock.hub.startConfirmCancel'),
                danger: true,
            });
            if (!ok) return;
        }
        setBusy(true);
        try {
            await startMockPart(detail.id, part);
            if (part === 'speaking') {
                await startSpeaking(detail);
            } else {
                const route = answerRoute(part, detail);
                if (route) navigate(route);
            }
        } catch (err) {
            showToast(t('mock.hub.startFail').replace('{msg}', (err as Error).message ?? ''), 'error');
            reload();
        } finally {
            setBusy(false);
        }
    };

    const viewResult = (part: MockExamPart, sub?: 'task1' | 'task2') => {
        if (!detail) return;
        const pv = detail.parts[part];
        if (part === 'listening' && pv.child) navigate(`/listening?bankId=${pv.child.id}&mockId=${detail.id}&review=1`);
        if (part === 'reading' && pv.child) navigate(`/reading?bankId=${pv.child.id}&mockId=${detail.id}&review=1`);
        if (part === 'writing') {
            const target = sub === 'task2' ? pv.task2 : pv.task1;
            if (target?.isAnswered) navigate(`/writing/correction?bankId=${target.id}&mockId=${detail.id}`);
        }
        if (part === 'speaking' && pv.child?.hasFeedback) navigate(`/speaking/summary?bankId=${pv.child.id}&mockId=${detail.id}`);
    };

    const handleRegenerate = async (slot: MockGenSlot) => {
        if (!detail || busy) return;
        setBusy(true);
        try {
            await regenerateMockSlot(detail.id, slot);
            showToast(t('mock.hub.regenStarted'), 'success');
            reload();
        } catch (err) {
            showToast(t('mock.hub.regenFail').replace('{msg}', (err as Error).message ?? ''), 'error');
        } finally {
            setBusy(false);
        }
    };

    // -- Score report --
    const allTerminal = detail
        ? detail.order.every(p => ['submitted', 'forfeited', 'expired'].includes(detail.parts[p].status))
        : false;

    const computeReport = (d: MockDetail, writingBands: { t1: number; t2: number }): MockReport => {
        const bandOf = (part: MockExamPart): number => {
            const pv = d.parts[part];
            if (pv.status !== 'submitted') return 0;
            if (part === 'writing') {
                // IELTS writing: Task 2 carries double weight
                return Math.round(((writingBands.t1 + 2 * writingBands.t2) / 3) * 10) / 10;
            }
            return pv.child?.band ?? 0;
        };
        const bands = {
            listening: bandOf('listening'),
            reading: bandOf('reading'),
            writing: bandOf('writing'),
            speaking: bandOf('speaking'),
        };
        const overall = roundIeltsOverall((bands.listening + bands.reading + bands.writing + bands.speaking) / 4);
        return { bands, overall };
    };

    // The score report generates itself (no click needed once all four sections are done). Writing alone no longer triggers
    // AI marking: if the child row already has a correction (the user marked it themselves) use that score, otherwise fall
    // back to the user's historical writing average, and count it as 0 when there is no history.
    const writingBandFor = (child: MockChildView | null | undefined, avg: number | null): number => {
        if (!child || !child.isAnswered) return 0;
        if (child.band != null) return child.band;
        return avg ?? 0;
    };

    const autoFinalizeFiredRef = useRef(false);
    const autoFinalize = async (d: MockDetail) => {
        try {
            const wv = d.parts.writing;
            let t1 = 0;
            let t2 = 0;
            if (wv.status === 'submitted') {
                let avg: number | null = null;
                const needAvg = [wv.task1, wv.task2].some(c => c?.isAnswered && c.band == null);
                if (needAvg) {
                    try {
                        const wa = await getWritingAnalytics();
                        const all = [...wa.task1_trend, ...wa.task2_trend].filter(r => r.overall > 0);
                        if (all.length > 0) {
                            avg = Math.round((all.reduce((s, r) => s + r.overall, 0) / all.length) * 10) / 10;
                        }
                    } catch { /* treat a failed history fetch as no data */ }
                    if (avg === null) showToast(t('mock.hub.report.noAvgData'), 'error');
                }
                t1 = writingBandFor(wv.task1, avg);
                t2 = writingBandFor(wv.task2, avg);
            }
            const report = computeReport(d, { t1, t2 });
            await finalizeMock(d.id, report);
            await reload();
        } catch (err) {
            showToast(t('mock.hub.report.finalizeFail').replace('{msg}', (err as Error).message ?? ''), 'error');
        }
    };

    // all four sections final and no report yet -> generate one
    useEffect(() => {
        if (!detail || detail.report || autoFinalizeFiredRef.current) return;
        const done = detail.order.every(p => ['submitted', 'forfeited', 'expired'].includes(detail.parts[p].status));
        if (!done) return;
        autoFinalizeFiredRef.current = true;
        void autoFinalize(detail);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [detail]);

    // -- Render --
    const readyCount = useMemo(() => {
        if (!detail) return 0;
        return detail.order.filter(p => detail.parts[p].genStatus === 'ready').length;
    }, [detail]);

    if (loading) {
        return (
            <Layout pageTitle={t('mock.hub.pageTitle')} backUrl="/practice/ai/bank" backText={t('mock.hub.backToBank')}>
                <div className="mock-hub"><p className="mock-hub-loading">{t('mock.hub.loading')}</p></div>
            </Layout>
        );
    }
    if (!detail) {
        return (
            <Layout pageTitle={t('mock.hub.pageTitle')} backUrl="/practice/ai/bank" backText={t('mock.hub.backToBank')}>
                <div className="mock-hub"><p className="mock-hub-loading">{t('mock.hub.loadFail')}</p></div>
            </Layout>
        );
    }

    const renderPartRow = (part: MockExamPart) => {
        const pv = detail.parts[part];
        const status = pv.status;
        const rem = status === 'in_progress' ? remainingMs(pv.deadline) : null;

        let action: React.ReactNode = null;
        if (status === 'generating') {
            action = <span className="mock-badge mock-badge-generating">{t('mock.hub.status.generating')}</span>;
        } else if (status === 'gen_failed') {
            const failedSlots: MockGenSlot[] = part === 'writing'
                ? ([['writingTask1', pv.task1], ['writingTask2', pv.task2]] as const)
                    .filter(([, c]) => !c || c.status === 'failed').map(([s]) => s)
                : [part as MockGenSlot];
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-failed">{t('mock.hub.status.gen_failed')}</span>
                    {failedSlots.map(slot => (
                        <button key={slot} className="mock-btn mock-btn-ghost" disabled={busy} onClick={() => handleRegenerate(slot)}>
                            {t('mock.hub.regenBtn')}
                        </button>
                    ))}
                </div>
            );
        } else if (status === 'locked') {
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-locked">{t('mock.hub.status.locked')}</span>
                    <span className="mock-row-hint">{t('mock.hub.status.lockedHint')}</span>
                </div>
            );
        } else if (status === 'ready') {
            action = (
                <button className="mock-btn mock-btn-primary" disabled={busy} onClick={() => handleStart(part)}>
                    ▶ {t('mock.hub.status.ready')}
                </button>
            );
        } else if (status === 'in_progress') {
            action = (
                <div className="mock-row-actions">
                    {rem !== null && (
                        <span className="mock-badge mock-badge-timer">
                            {t('mock.hub.status.in_progressHint').replace('{time}', fmtRemaining(rem))}
                        </span>
                    )}
                    <button className="mock-btn mock-btn-primary" disabled={busy} onClick={() => handleStart(part)}>
                        ⏸ {t('mock.hub.status.in_progress')}
                    </button>
                </div>
            );
        } else if (status === 'submitted') {
            // Real exam rule: no individual section result is viewable until all four sections have finished
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-done">{t('mock.hub.status.submitted')}</span>
                    {!allTerminal ? (
                        <span className="mock-row-hint">{t('mock.hub.status.resultLockedHint')}</span>
                    ) : part === 'writing' ? (
                        <>
                            {pv.task1?.isAnswered && (
                                <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part, 'task1')}>Task 1 · {t('mock.hub.status.viewResult')}</button>
                            )}
                            {pv.task2?.isAnswered && (
                                <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part, 'task2')}>Task 2 · {t('mock.hub.status.viewResult')}</button>
                            )}
                        </>
                    ) : (
                        <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part)}>{t('mock.hub.status.viewResult')}</button>
                    )}
                </div>
            );
        } else {
            // forfeited / expired
            action = (
                <span className={`mock-badge ${status === 'forfeited' ? 'mock-badge-forfeited' : 'mock-badge-expired'}`}>
                    {status === 'forfeited' ? t('mock.hub.status.forfeited') : t('mock.hub.status.expired')}
                </span>
            );
        }

        return (
            <div key={part} className={`mock-part-row is-${status}`}>
                <div className="mock-part-icon">{PART_ICONS[part]}</div>
                <div className="mock-part-info">
                    <div className="mock-part-name">{t(`mock.hub.parts.${part}`)}</div>
                    <div className="mock-part-meta">{t(`mock.hub.partMeta.${part}`)}</div>
                </div>
                <div className="mock-part-action">{action}</div>
            </div>
        );
    };

    const report = detail.report;

    return (
        <Layout pageTitle={detail.title || t('mock.hub.pageTitle')} backUrl="/practice/ai/bank" backText={t('mock.hub.backToBank')}>
            <div className="mock-hub">
                {anyGenerating && (
                    <div className="mock-gen-progress">
                        {t('mock.hub.genProgress').replace('{done}', String(readyCount)).replace('{total}', String(detail.order.length))}
                    </div>
                )}

                <div className="mock-part-list">
                    {detail.order.map(renderPartRow)}

                    {/* -- Row 5: score report -- */}
                    <div className={`mock-part-row mock-report-row ${allTerminal ? 'is-ready' : 'is-locked'}`}>
                        <div className="mock-part-icon">📋</div>
                        <div className="mock-part-info">
                            <div className="mock-part-name">{t('mock.hub.report.rowTitle')}</div>
                            <div className="mock-part-meta">
                                {report
                                    ? t('mock.hub.report.rowDescDone').replace('{overall}', report.overall.toFixed(1))
                                    : allTerminal ? t('mock.hub.report.rowDescReady') : t('mock.hub.report.rowDescLocked')}
                            </div>
                        </div>
                        <div className="mock-part-action">
                            {report ? (
                                <span className="mock-badge mock-badge-done">{t('mock.hub.report.overall')} {report.overall.toFixed(1)}</span>
                            ) : allTerminal ? (
                                /* generated automatically once all four sections finish, no click needed */
                                <span className="mock-badge mock-badge-timer">{t('mock.hub.report.autoGenerating')}</span>
                            ) : (
                                <span className="mock-badge mock-badge-locked">🔒</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* -- Score report detail -- */}
                {report && (
                    <div className="mock-report-card">
                        <h3>{t('mock.hub.report.title')}</h3>
                        <div className="mock-report-grid">
                            {detail.order.map(p => (
                                <div key={p} className="mock-report-cell">
                                    <div className="mock-report-cell-label">{PART_ICONS[p]} {t(`mock.hub.parts.${p}`)}</div>
                                    <div className="mock-report-cell-band">{(report.bands[p] ?? 0).toFixed(1)}</div>
                                </div>
                            ))}
                            <div className="mock-report-cell mock-report-cell-overall">
                                <div className="mock-report-cell-label">{t('mock.hub.report.overall')}</div>
                                <div className="mock-report-cell-band">{report.overall.toFixed(1)}</div>
                            </div>
                        </div>
                        <p className="mock-report-note">{t('mock.hub.report.forfeitNote')}</p>
                    </div>
                )}
            </div>
        </Layout>
    );
}
