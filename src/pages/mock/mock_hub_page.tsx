// 模拟考大厅 — 全套模拟的考试控制台。
// 从上到下 4 行（听 → 读 → 写 → 说，顺序强制）+ 第 5 行成绩单。
// 状态与计时以服务端为准（getMockDetail 返回 deadline / now），生成中每 6s 轮询。
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showConfirm } from '../../components/common/ConfirmService';
import { showToast } from '../../components/common/Toast';
import {
    getMockDetail, startMockPart, finalizeMock, regenerateMockSlot,
    type MockChildView, type MockDetail, type MockExamPart, type MockGenSlot, type MockReport,
} from '../../api/mock';
import { api } from '../../api/client';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { ATInterceptor } from '../../api/atInterceptor';
import { speakingStore } from '../../store/speaking_page_store';
import { roundIeltsOverall } from '../../utils/ielts_band';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
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
    const { lang } = useLang();
    const t = translations[lang].mock.hub;

    const [detail, setDetail] = useState<MockDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    // 服务端时钟偏移：serverNow - clientNow，剩余时间一律用服务端时钟计算
    const clockOffsetRef = useRef(0);
    const [, forceTick] = useState(0);

    const reload = useCallback(async () => {
        try {
            const d = await getMockDetail(mockId);
            clockOffsetRef.current = new Date(d.now).getTime() - Date.now();
            setDetail(d);
        } catch (err) {
            showToast(`${t.loadFail}: ${(err as Error).message ?? ''}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [mockId, t.loadFail]);

    useEffect(() => { reload(); }, [reload]);

    // 生成中轮询 + in_progress 时每秒刷新剩余时间显示
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

    // ── 各部分入口路由 ──
    const answerRoute = (part: MockExamPart, d: MockDetail): string | null => {
        const pv = d.parts[part];
        if (part === 'listening') return pv.child ? `/listening?bankId=${pv.child.id}&mockId=${d.id}` : null;
        if (part === 'reading') return pv.child ? `/reading?bankId=${pv.child.id}&mockId=${d.id}` : null;
        if (part === 'writing') {
            // 写作进第一篇未提交的任务；两篇共用服务端 60 分钟计时，可经大厅互切
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
        return null; // speaking 走专用启动流程
    };

    const startSpeaking = async (d: MockDetail) => {
        const existing = d.parts.speaking.child;
        if (existing) {
            navigate(`/speaking/chat?bankId=${existing.id}&mockId=${d.id}`);
            return;
        }
        const res = await ATInterceptor.bankGeneratePart1();
        speakingStore.isChatAllowed = true; // 聊天页路由守卫要求显式放行
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
                ? t.startConfirmBody.replace('{duration}', t.minutes.replace('{n}', String(Math.round(durationSec / 60))))
                : t.startConfirmBodyNoTimer;
            const ok = await showConfirm({
                title: t.startConfirmTitle.replace('{part}', t.parts[part]),
                message: body,
                confirmText: t.startConfirmOk,
                cancelText: t.startConfirmCancel,
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
            showToast(t.startFail.replace('{msg}', (err as Error).message ?? ''), 'error');
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
            showToast(t.regenStarted, 'success');
            reload();
        } catch (err) {
            showToast(t.regenFail.replace('{msg}', (err as Error).message ?? ''), 'error');
        } finally {
            setBusy(false);
        }
    };

    // ── 成绩单 ──
    const allTerminal = detail
        ? detail.order.every(p => ['submitted', 'forfeited', 'expired'].includes(detail.parts[p].status))
        : false;

    const computeReport = (d: MockDetail, writingBands: { t1: number; t2: number }): MockReport => {
        const bandOf = (part: MockExamPart): number => {
            const pv = d.parts[part];
            if (pv.status !== 'submitted') return 0;
            if (part === 'writing') {
                // 雅思写作：Task 2 双倍权重
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

    // 作文延迟批改：考试中提交只落库正文，成绩单生成时统一跑 AI 批改并把反馈挂回子行
    const gradeEssayIfNeeded = async (child: MockChildView | null | undefined, taskType: 'task1' | 'task2'): Promise<number> => {
        if (!child || !child.isAnswered) return 0;
        if (child.band != null) return child.band;
        const childDetail = await getAIQuestion(child.id);
        const essay = typeof childDetail.userAnswer === 'string' ? childDetail.userAnswer : '';
        const prompt = String((childDetail.content as Record<string, unknown>)?.prompt ?? '');
        if (!essay.trim()) return 0;
        const res = await api<{ Overall_Band?: number }>('/writing/generate', {
            method: 'POST',
            body: { text: essay, prompt, task_type: taskType, lang },
        });
        await submitAIQuestion(child.id, essay, res);
        return typeof res.Overall_Band === 'number' ? res.Overall_Band : 0;
    };

    const [grading, setGrading] = useState(false);

    const handleFinalize = async () => {
        if (!detail || busy) return;
        setBusy(true);
        try {
            const wv = detail.parts.writing;
            const needGrading = [wv.task1, wv.task2].some(c => c?.isAnswered && c.band == null);
            if (needGrading) setGrading(true);
            const t1 = wv.status === 'submitted' ? await gradeEssayIfNeeded(wv.task1, 'task1') : 0;
            const t2 = wv.status === 'submitted' ? await gradeEssayIfNeeded(wv.task2, 'task2') : 0;
            setGrading(false);
            const report = computeReport(detail, { t1, t2 });
            await finalizeMock(detail.id, report);
            await reload();
        } catch (err) {
            showToast(t.report.finalizeFail.replace('{msg}', (err as Error).message ?? ''), 'error');
        } finally {
            setGrading(false);
            setBusy(false);
        }
    };

    // ── 渲染 ──
    const readyCount = useMemo(() => {
        if (!detail) return 0;
        return detail.order.filter(p => detail.parts[p].genStatus === 'ready').length;
    }, [detail]);

    if (loading) {
        return (
            <Layout pageTitle={t.pageTitle} backUrl="/practice/ai/bank" backText={t.backToBank}>
                <div className="mock-hub"><p className="mock-hub-loading">{t.loading}</p></div>
            </Layout>
        );
    }
    if (!detail) {
        return (
            <Layout pageTitle={t.pageTitle} backUrl="/practice/ai/bank" backText={t.backToBank}>
                <div className="mock-hub"><p className="mock-hub-loading">{t.loadFail}</p></div>
            </Layout>
        );
    }

    const renderPartRow = (part: MockExamPart) => {
        const pv = detail.parts[part];
        const status = pv.status;
        const rem = status === 'in_progress' ? remainingMs(pv.deadline) : null;

        let action: React.ReactNode = null;
        if (status === 'generating') {
            action = <span className="mock-badge mock-badge-generating">{t.status.generating}</span>;
        } else if (status === 'gen_failed') {
            const failedSlots: MockGenSlot[] = part === 'writing'
                ? ([['writingTask1', pv.task1], ['writingTask2', pv.task2]] as const)
                    .filter(([, c]) => !c || c.status === 'failed').map(([s]) => s)
                : [part as MockGenSlot];
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-failed">{t.status.gen_failed}</span>
                    {failedSlots.map(slot => (
                        <button key={slot} className="mock-btn mock-btn-ghost" disabled={busy} onClick={() => handleRegenerate(slot)}>
                            {t.regenBtn}
                        </button>
                    ))}
                </div>
            );
        } else if (status === 'locked') {
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-locked">{t.status.locked}</span>
                    <span className="mock-row-hint">{t.status.lockedHint}</span>
                </div>
            );
        } else if (status === 'ready') {
            action = (
                <button className="mock-btn mock-btn-primary" disabled={busy} onClick={() => handleStart(part)}>
                    ▶ {t.status.ready}
                </button>
            );
        } else if (status === 'in_progress') {
            action = (
                <div className="mock-row-actions">
                    {rem !== null && (
                        <span className="mock-badge mock-badge-timer">
                            {t.status.in_progressHint.replace('{time}', fmtRemaining(rem))}
                        </span>
                    )}
                    <button className="mock-btn mock-btn-primary" disabled={busy} onClick={() => handleStart(part)}>
                        ⏸ {t.status.in_progress}
                    </button>
                </div>
            );
        } else if (status === 'submitted') {
            action = (
                <div className="mock-row-actions">
                    <span className="mock-badge mock-badge-done">{t.status.submitted}</span>
                    {part === 'writing' ? (
                        <>
                            {pv.task1?.isAnswered && (
                                <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part, 'task1')}>Task 1 · {t.status.viewResult}</button>
                            )}
                            {pv.task2?.isAnswered && (
                                <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part, 'task2')}>Task 2 · {t.status.viewResult}</button>
                            )}
                        </>
                    ) : (
                        <button className="mock-btn mock-btn-ghost" onClick={() => viewResult(part)}>{t.status.viewResult}</button>
                    )}
                </div>
            );
        } else {
            // forfeited / expired
            action = (
                <span className={`mock-badge ${status === 'forfeited' ? 'mock-badge-forfeited' : 'mock-badge-expired'}`}>
                    {status === 'forfeited' ? t.status.forfeited : t.status.expired}
                </span>
            );
        }

        return (
            <div key={part} className={`mock-part-row is-${status}`}>
                <div className="mock-part-icon">{PART_ICONS[part]}</div>
                <div className="mock-part-info">
                    <div className="mock-part-name">{t.parts[part]}</div>
                    <div className="mock-part-meta">{t.partMeta[part]}</div>
                </div>
                <div className="mock-part-action">{action}</div>
            </div>
        );
    };

    const report = detail.report;

    return (
        <Layout pageTitle={detail.title || t.pageTitle} backUrl="/practice/ai/bank" backText={t.backToBank}>
            <div className="mock-hub">
                {anyGenerating && (
                    <div className="mock-gen-progress">
                        {t.genProgress.replace('{done}', String(readyCount)).replace('{total}', String(detail.order.length))}
                    </div>
                )}

                <div className="mock-part-list">
                    {detail.order.map(renderPartRow)}

                    {/* ── 第 5 行：成绩单 ── */}
                    <div className={`mock-part-row mock-report-row ${allTerminal ? 'is-ready' : 'is-locked'}`}>
                        <div className="mock-part-icon">📋</div>
                        <div className="mock-part-info">
                            <div className="mock-part-name">{t.report.rowTitle}</div>
                            <div className="mock-part-meta">
                                {report
                                    ? t.report.rowDescDone.replace('{overall}', report.overall.toFixed(1))
                                    : allTerminal ? t.report.rowDescReady : t.report.rowDescLocked}
                            </div>
                        </div>
                        <div className="mock-part-action">
                            {report ? (
                                <span className="mock-badge mock-badge-done">{t.report.overall} {report.overall.toFixed(1)}</span>
                            ) : allTerminal ? (
                                <button className="mock-btn mock-btn-primary" disabled={busy} onClick={handleFinalize}>
                                    {grading ? t.report.grading : t.report.generateBtn}
                                </button>
                            ) : (
                                <span className="mock-badge mock-badge-locked">🔒</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── 成绩单详情 ── */}
                {report && (
                    <div className="mock-report-card">
                        <h3>{t.report.title}</h3>
                        <div className="mock-report-grid">
                            {detail.order.map(p => (
                                <div key={p} className="mock-report-cell">
                                    <div className="mock-report-cell-label">{PART_ICONS[p]} {t.parts[p]}</div>
                                    <div className="mock-report-cell-band">{(report.bands[p] ?? 0).toFixed(1)}</div>
                                </div>
                            ))}
                            <div className="mock-report-cell mock-report-cell-overall">
                                <div className="mock-report-cell-label">{t.report.overall}</div>
                                <div className="mock-report-cell-band">{report.overall.toFixed(1)}</div>
                            </div>
                        </div>
                        <p className="mock-report-note">{t.report.forfeitNote}</p>
                    </div>
                )}
            </div>
        </Layout>
    );
}
