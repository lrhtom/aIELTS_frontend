/**
 *  Full mock: arriving from the hub's 'view result' -> back returns to the hub and redo is disabled
 *
 * Hub for the full writing set: the Task 1 and Task 2 children of one parent card.
 * Unlike the full mock hub there is **no** exam state machine here - untimed, unordered, redoable at will,
 * and each question jumps into the existing answering page (chart/doing, task2/doing).
 */
import Layout from '../../components/layout/Layout';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getWritingFull, type WritingFullSnapshot, type WritingFullTask } from '../../api/ai_question';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

type Slot = 'task1' | 'task2';

/*It stays reachable during generation; the cards show 'generating' and flip over on their own via polling. */
function routeForTask(task: WritingFullTask): string | null {
    //* Which answering page a child goes to: chart questions carry the type parameter, otherwise chart_practice_page renders as a line chart.
    // Children that are still generating or have failed get no entry point: a placeholder row's content_json is empty,
    if (!task.id || task.status !== 'ready') return null;
    if (task.isAnswered && task.hasFeedback) return `/writing/correction?bankId=${task.id}`;
    if (task.subtype.startsWith('chart:')) {
        const type = task.subtype.slice('chart:'.length);
        return `/writing/chart/doing?bankId=${task.id}&type=${encodeURIComponent(type)}`;
    }
    return `/writing/task2/doing?bankId=${task.id}`;
}

export default function WritingFullHubPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { t } = useLang();

    const [data, setData] = useState<(WritingFullSnapshot & { title: string }) | null>(null);
    const [loading, setLoading] = useState(true);
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchOnce = useCallback(async () => {
        if (!id) return;
        try {
            const r = await getWritingFull(Number(id));
            setData(r);
            // so clicking through only shows a blank question (the generating card's button really was clickable before this).
            if (r.derivedStatus === 'generating') {
                pollRef.current = setTimeout(() => { void fetchOnce(); }, 3000);
            }
        } catch {
            showToast(t('writingFull.loadFail'), 'error');
        } finally {
            setLoading(false);
        }
    }, [id, t]);

    useEffect(() => {
        void fetchOnce();
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, [fetchOnce]);

    const renderTask = (slot: Slot, task: WritingFullTask) => {
        const route = routeForTask(task);
        const statusKey = task.status === 'generating'
            ? 'generating'
            : task.status === 'failed'
                ? 'failed'
                : task.hasFeedback ? 'graded' : task.isAnswered ? 'answered' : 'ready';
        return (
            <div key={slot} className={`wf-task-card is-${statusKey}`}>
                <div className="wf-task-head">
                    <span className="wf-task-slot">{t(`writingFull.slots.${slot}`)}</span>
                    <span className={`wf-task-status is-${statusKey}`}>{t(`writingFull.status.${statusKey}`)}</span>
                </div>
                <div className="wf-task-title">{task.title || t('writingFull.untitled')}</div>
                {task.status === 'failed' && task.errorMessage && (
                    <div className="wf-task-error">{task.errorMessage}</div>
                )}
                <button
                    type="button"
                    className="wf-task-btn"
                    disabled={!route}
                    onClick={() => route && navigate(route)}
                >
                    {task.status === 'generating'
                        ? t('writingFull.status.generating')
                        : task.status === 'failed'
                            ? t('writingFull.status.failed')
                            : task.hasFeedback
                                ? t('writingFull.viewCorrection')
                                : task.isAnswered ? t('writingFull.continueBtn') : t('writingFull.startTaskBtn')}
                </button>
            </div>
        );
    };

    return (
        <Layout
            pageTitle={data?.title || t('writingFull.hubTitle')}
            pageSubtitle={t('writingFull.hubSubtitle')}
            backUrl="/practice/ai/bank?skill=writing"
            backText={t('writingFull.backToBank')}
        >
            <div className="practice-container">
                {loading ? (
                    <div className="config-card">{t('writingFull.loading')}</div>
                ) : !data ? (
                    <div className="config-card">{t('writingFull.notFound')}</div>
                ) : (
                    <>
                        <div className="wf-progress">
                            {t('writingFull.progress')
                                .replace('{answered}', String(data.answeredCount))
                                .replace('{graded}', String(data.gradedCount))}
                        </div>
                        <div className="wf-task-grid">
                            {(['task1', 'task2'] as Slot[]).map(slot => renderTask(slot, data.tasks[slot]))}
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}
