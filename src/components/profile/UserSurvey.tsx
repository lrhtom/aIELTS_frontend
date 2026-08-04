import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

interface SurveyAnswers {
    prepDuration: string;
    targetBand: string;
    ratings: Record<string, number>;
    mostUseful: string;
    improvements: string;
    otherComments: string;
}

/** One stored response as returned by the backend's /survey/mine (the fields of SurveySerializer) */
interface SurveyRecord {
    id: number;
    prep_duration: string;
    target_band: string;
    most_useful: string;
    improvements: string;
    other_comments: string;
    created_at: string;
    [k: string]: unknown;   // the q_* rating fields
}

const PREP_OPTIONS = ['lt1m', '1to3m', '3to6m', '6mplus'] as const;
const BAND_OPTIONS = ['5.5-6.0', '6.5', '7.0', '7.5+'] as const;

// Backend snake_case field <-> i18n short key (profile.survey.b.<key>).
// The order is that of questions 3-10 in the survey; UserSurvey and AdminSurvey share this mapping convention.
const RATING_FIELDS = [
    { field: 'q_all_skills', key: 'allSkills' },
    { field: 'q_reading_relevant', key: 'readingRelevant' },
    { field: 'q_listening_clear', key: 'listeningClear' },
    { field: 'q_speaking_anxiety', key: 'speakingAnxiety' },
    { field: 'q_writing_feedback', key: 'writingFeedback' },
    { field: 'q_vocab_memory', key: 'vocabMemory' },
    { field: 'q_easy_navigate', key: 'easyNavigate' },
    { field: 'q_recommend', key: 'recommend' },
] as const;

export default function UserSurvey() {
    const { t } = useLang();
    const [prepDuration, setPrepDuration] = useState('');
    const [targetBand, setTargetBand] = useState('');
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [mostUseful, setMostUseful] = useState('');
    const [improvements, setImprovements] = useState('');
    const [otherComments, setOtherComments] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // An existing response from the server; null = never filled in. When present, go straight to the results page.
    const [record, setRecord] = useState<SurveyRecord | null>(null);
    const [submitCount, setSubmitCount] = useState(0);
    const [loadingMine, setLoadingMine] = useState(true);
    // Whether to force the form to show (the user clicked 'fill in again')
    const [editing, setEditing] = useState(false);
    // Just submitted (the results page shows a celebration rather than 'you have already filled this in')
    const [justSubmitted, setJustSubmitted] = useState(false);

    // PNG export (reusing speaking_summary's html2canvas approach: screenshot -> download + copy to clipboard)
    const questionsRef = useRef<HTMLDivElement>(null);
    const answersRef = useRef<HTMLDivElement>(null);
    const [exporting, setExporting] = useState<'q' | 'a' | null>(null);
    const today = new Date().toISOString().slice(0, 10);

    const exportPng = useCallback(async (node: HTMLElement | null, filename: string, kind: 'q' | 'a') => {
        if (!node || exporting) return;
        setExporting(kind);
        try {
            const canvas = await html2canvas(node, {
                backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#ffffff',
                scale: 2,
                useCORS: true,
            });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            } catch { /* some browsers cannot write images to the clipboard, ignore silently */ }
            toast.success(t('common.saved'));
        } catch (err) {
            console.error('Export PNG failed', err);
            toast.error(t('common.error'));
        } finally {
            setExporting(null);
        }
    }, [exporting, t]);

    const setRating = (field: string, value: number) =>
        setRatings(prev => ({ ...prev, [field]: value }));

    // server record -> frontend response structure (snake_case -> the shape the component uses)
    const recordToAnswers = useCallback((r: SurveyRecord): SurveyAnswers => {
        const ratingMap: Record<string, number> = {};
        RATING_FIELDS.forEach(({ field }) => {
            const v = Number(r[field]);
            if (v >= 1 && v <= 5) ratingMap[field] = v;
        });
        return {
            prepDuration: r.prep_duration || '',
            targetBand: r.target_band || '',
            ratings: ratingMap,
            mostUseful: r.most_useful || '',
            improvements: r.improvements || '',
            otherComments: r.other_comments || '',
        };
    }, []);

    // On entering the page, check whether the user has already responded and go straight to the results page if so
    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const res = await apiClient.get('/survey/mine');
                if (!alive) return;
                setRecord(res.data?.latest ?? null);
                setSubmitCount(res.data?.count ?? 0);
            } catch (err) {
                // a failed lookup must not block filling it in; degrade to a blank form
                console.error('Load my survey failed:', err);
            } finally {
                if (alive) setLoadingMine(false);
            }
        })();
        return () => { alive = false; };
    }, []);

    // 'Fill in again': prefill the form from the last response, and submitting adds a new record (keeping the history)
    const startEditing = () => {
        if (record) {
            const a = recordToAnswers(record);
            setPrepDuration(a.prepDuration);
            setTargetBand(a.targetBand);
            setRatings(a.ratings);
            setMostUseful(a.mostUseful);
            setImprovements(a.improvements);
            setOtherComments(a.otherComments);
        }
        setJustSubmitted(false);
        setEditing(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Part B (questions 3-10) is entirely required, range 1-5. Parts A and C are optional.
        const allRated = RATING_FIELDS.every(({ field }) => {
            const v = ratings[field];
            return v >= 1 && v <= 5;
        });
        if (!allRated) {
            toast.error(t('profile.survey.errorRatingRequired'));
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: Record<string, unknown> = {
                prep_duration: prepDuration,
                target_band: targetBand,
                most_useful: mostUseful.trim(),
                improvements: improvements.trim(),
                other_comments: otherComments.trim(),
            };
            RATING_FIELDS.forEach(({ field }) => { payload[field] = ratings[field]; });
            const res = await apiClient.post('/survey/submit', payload);
            // Use the record the backend echoed back as the results-page data source (it carries id and created_at)
            setRecord(res.data as SurveyRecord);
            setSubmitCount(c => c + 1);
            setJustSubmitted(true);
            setEditing(false);
        } catch (error) {
            console.error('Survey submission failed:', error);
            toast.error(t('profile.survey.errorSubmit'));
        } finally {
            setIsSubmitting(false);
        }
    };

    // The results page and export use the stored record; while filling in, use the form's current values
    const answersView: SurveyAnswers = record && !editing
        ? recordToAnswers(record)
        : { prepDuration, targetBand, ratings, mostUseful, improvements, otherComments };
    const submittedAt = record?.created_at ? record.created_at.slice(0, 10) : today;

    // Offscreen printable nodes: the questions (a blank survey) and my responses, both html2canvas sources
    const printNodes = (
        <div className="survey-print-offscreen" aria-hidden="true">
            <div ref={questionsRef} className="survey-print">
                <h1 className="sp-title">{t('profile.survey.heading')}</h1>
                <p className="sp-intro">{t('profile.survey.intro')}</p>

                <h2 className="sp-section">{t('profile.survey.partADemographics')}</h2>
                <div className="sp-q">{t('profile.survey.q1Label')}</div>
                <div className="sp-opts">
                    {PREP_OPTIONS.map(opt => <span className="sp-opt" key={opt}>☐ {t(`profile.survey.prepDuration.${opt}`)}</span>)}
                </div>
                <div className="sp-q">{t('profile.survey.q2Label')}</div>
                <div className="sp-opts">
                    {BAND_OPTIONS.map(opt => <span className="sp-opt" key={opt}>☐ {t(`profile.survey.targetBand.${opt}`)}</span>)}
                </div>

                <h2 className="sp-section">{t('profile.survey.partBEvaluation')}</h2>
                <p className="sp-hint">{t('profile.survey.ratingHint')}</p>
                {RATING_FIELDS.map(({ field, key }) => (
                    <div className="sp-rating" key={field}>
                        <span className="sp-rating-q">{t(`profile.survey.b.${key}`)}</span>
                        <span className="sp-scale">1&nbsp;&nbsp;2&nbsp;&nbsp;3&nbsp;&nbsp;4&nbsp;&nbsp;5</span>
                    </div>
                ))}

                <h2 className="sp-section">{t('profile.survey.partCOpen')}</h2>
                <div className="sp-q">{t('profile.survey.c.mostUseful')}</div>
                <div className="sp-line" />
                <div className="sp-q">{t('profile.survey.c.improvements')}</div>
                <div className="sp-line" />
                <div className="sp-q">{t('profile.survey.c.otherComments')}</div>
                <div className="sp-line" />
            </div>

            <div ref={answersRef} className="survey-print">
                <h1 className="sp-title">{t('profile.survey.myAnswersTitle')}</h1>
                <p className="sp-intro">{submittedAt}</p>

                <h2 className="sp-section">{t('profile.survey.partADemographics')}</h2>
                <div className="sp-a-row">
                    <span className="sp-a-q">{t('profile.survey.q1Label')}</span>
                    <span className="sp-a-v">{answersView.prepDuration ? t(`profile.survey.prepDuration.${answersView.prepDuration}`) : t('profile.survey.notAnswered')}</span>
                </div>
                <div className="sp-a-row">
                    <span className="sp-a-q">{t('profile.survey.q2Label')}</span>
                    <span className="sp-a-v">{answersView.targetBand ? t(`profile.survey.targetBand.${answersView.targetBand}`) : t('profile.survey.notAnswered')}</span>
                </div>

                <h2 className="sp-section">{t('profile.survey.partBEvaluation')}</h2>
                <p className="sp-hint">{t('profile.survey.ratingHint')}</p>
                {RATING_FIELDS.map(({ field, key }) => (
                    <div className="sp-rating" key={field}>
                        <span className="sp-rating-q">{t(`profile.survey.b.${key}`)}</span>
                        <span className="sp-answer-val">{answersView.ratings[field] ?? '—'}</span>
                    </div>
                ))}

                <h2 className="sp-section">{t('profile.survey.partCOpen')}</h2>
                <div className="sp-q">{t('profile.survey.c.mostUseful')}</div>
                <div className="sp-a-text">{answersView.mostUseful || t('profile.survey.notAnswered')}</div>
                <div className="sp-q">{t('profile.survey.c.improvements')}</div>
                <div className="sp-a-text">{answersView.improvements || t('profile.survey.notAnswered')}</div>
                <div className="sp-q">{t('profile.survey.c.otherComments')}</div>
                <div className="sp-a-text">{answersView.otherComments || t('profile.survey.notAnswered')}</div>
            </div>
        </div>
    );

    const exportQuestionsBtn = (
        <button
            type="button"
            className="survey-export-btn"
            disabled={exporting !== null}
            onClick={() => exportPng(questionsRef.current, `survey-questions-${today}.png`, 'q')}
        >
            {exporting === 'q' ? t('profile.survey.exporting') : t('profile.survey.exportQuestions')}
        </button>
    );

    if (loadingMine) {
        return (
            <div className="user-survey">
                <div className="survey-loading">{t('common.loading')}</div>
                <style>{surveyStyles}</style>
            </div>
        );
    }

    // Already responded and not re-filling -> show the previous response directly
    if (record && !editing) {
        return (
            <div className="user-survey">
                <div className="survey-result-card">
                    <div className="survey-result-head">
                        <div className="survey-result-icon">{justSubmitted ? '🎉' : '✅'}</div>
                        <div className="survey-result-headtext">
                            <h3>{justSubmitted ? t('profile.survey.successTitle') : t('profile.survey.alreadyDoneTitle')}</h3>
                            <p>
                                {justSubmitted
                                    ? t('profile.survey.successDesc')
                                    : t('profile.survey.alreadyDoneDesc').replace('{d}', submittedAt)}
                                {submitCount > 1 && ` · ${t('profile.survey.submitTimes').replace('{n}', String(submitCount))}`}
                            </p>
                        </div>
                    </div>

                    {/* Part A */}
                    <div className="survey-result-section">
                        <h4>{t('profile.survey.partADemographics')}</h4>
                        <div className="survey-result-row">
                            <span className="srr-q">{t('profile.survey.q1Label')}</span>
                            <span className="srr-v">
                                {answersView.prepDuration
                                    ? t(`profile.survey.prepDuration.${answersView.prepDuration}`)
                                    : t('profile.survey.notAnswered')}
                            </span>
                        </div>
                        <div className="survey-result-row">
                            <span className="srr-q">{t('profile.survey.q2Label')}</span>
                            <span className="srr-v">
                                {answersView.targetBand
                                    ? t(`profile.survey.targetBand.${answersView.targetBand}`)
                                    : t('profile.survey.notAnswered')}
                            </span>
                        </div>
                    </div>

                    {/* Part B - ratings shown read-only as lit 1-5 dots */}
                    <div className="survey-result-section">
                        <h4>{t('profile.survey.partBEvaluation')}</h4>
                        {RATING_FIELDS.map(({ field, key }) => (
                            <div className="survey-result-rating" key={field}>
                                <span className="srr-q">{t(`profile.survey.b.${key}`)}</span>
                                <span className="srr-dots" aria-label={String(answersView.ratings[field] ?? 0)}>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <i key={n} className={n <= (answersView.ratings[field] ?? 0) ? 'on' : ''} />
                                    ))}
                                    <b>{answersView.ratings[field] ?? '—'}</b>
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Part C */}
                    <div className="survey-result-section">
                        <h4>{t('profile.survey.partCOpen')}</h4>
                        {([
                            ['mostUseful', answersView.mostUseful],
                            ['improvements', answersView.improvements],
                            ['otherComments', answersView.otherComments],
                        ] as const).map(([key, val]) => (
                            <div className="survey-result-open" key={key}>
                                <div className="srr-q">{t(`profile.survey.c.${key}`)}</div>
                                <div className={`srr-text ${val ? '' : 'empty'}`}>
                                    {val || t('profile.survey.notAnswered')}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="survey-success-actions">
                        <button
                            type="button"
                            className="survey-export-btn"
                            disabled={exporting !== null}
                            onClick={() => exportPng(answersRef.current, `survey-my-answers-${submittedAt}.png`, 'a')}
                        >
                            {exporting === 'a' ? t('profile.survey.exporting') : t('profile.survey.exportMyAnswers')}
                        </button>
                        {exportQuestionsBtn}
                        <button type="button" className="survey-secondary-btn" onClick={startEditing}>
                            {t('profile.survey.fillAgain')}
                        </button>
                    </div>
                </div>
                {printNodes}
                <style>{surveyStyles}</style>
            </div>
        );
    }

    return (
        <div className="user-survey">
            <div className="survey-intro-head">
                <div className="survey-intro-text">
                    <h2>{t('profile.survey.heading')}</h2>
                    <p>{t('profile.survey.intro')}</p>
                </div>
                {exportQuestionsBtn}
            </div>

            {editing && record && (
                <div className="survey-editing-bar">
                    <span>{t('profile.survey.editingHint').replace('{d}', submittedAt)}</span>
                    <button type="button" className="survey-linkbtn" onClick={() => setEditing(false)}>
                        {t('common.cancel')}
                    </button>
                </div>
            )}

            <form className="survey-form" onSubmit={handleSubmit}>
                {/* ── Part A — Demographics ── */}
                <section className="survey-section">
                    <h3 className="survey-section-title">{t('profile.survey.partADemographics')}</h3>

                    <div className="survey-q">
                        <div className="survey-q-label">{t('profile.survey.q1Label')}</div>
                        <div className="survey-pills">
                            {PREP_OPTIONS.map(opt => (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`survey-pill ${prepDuration === opt ? 'selected' : ''}`}
                                    onClick={() => setPrepDuration(prev => (prev === opt ? '' : opt))}
                                    disabled={isSubmitting}
                                >
                                    {t(`profile.survey.prepDuration.${opt}`)}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="survey-q">
                        <div className="survey-q-label">{t('profile.survey.q2Label')}</div>
                        <div className="survey-pills">
                            {BAND_OPTIONS.map(opt => (
                                <button
                                    type="button"
                                    key={opt}
                                    className={`survey-pill ${targetBand === opt ? 'selected' : ''}`}
                                    onClick={() => setTargetBand(prev => (prev === opt ? '' : opt))}
                                    disabled={isSubmitting}
                                >
                                    {t(`profile.survey.targetBand.${opt}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Part B — Platform Evaluation (1-5) ── */}
                <section className="survey-section">
                    <div className="survey-section-head">
                        <h3 className="survey-section-title">{t('profile.survey.partBEvaluation')}</h3>
                        <span className="survey-required">{t('profile.survey.required')}</span>
                    </div>
                    <p className="survey-rating-hint">{t('profile.survey.ratingHint')}</p>

                    {RATING_FIELDS.map(({ field, key }) => (
                        <div className="survey-rating-row" key={field}>
                            <div className="survey-q-label">{t(`profile.survey.b.${key}`)}</div>
                            <div className="survey-scale" role="radiogroup">
                                {[1, 2, 3, 4, 5].map(n => (
                                    <button
                                        type="button"
                                        key={n}
                                        role="radio"
                                        aria-checked={ratings[field] === n}
                                        className={`survey-scale-btn ${ratings[field] === n ? 'active' : ''}`}
                                        onClick={() => setRating(field, n)}
                                        disabled={isSubmitting}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </section>

                {/* ── Part C — Open-Ended ── */}
                <section className="survey-section">
                    <h3 className="survey-section-title">{t('profile.survey.partCOpen')}</h3>

                    <div className="survey-q">
                        <div className="survey-q-label">{t('profile.survey.c.mostUseful')}</div>
                        <textarea
                            value={mostUseful}
                            onChange={e => setMostUseful(e.target.value)}
                            placeholder={t('profile.survey.openPlaceholder')}
                            rows={3}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="survey-q">
                        <div className="survey-q-label">{t('profile.survey.c.improvements')}</div>
                        <textarea
                            value={improvements}
                            onChange={e => setImprovements(e.target.value)}
                            placeholder={t('profile.survey.openPlaceholder')}
                            rows={3}
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="survey-q">
                        <div className="survey-q-label">{t('profile.survey.c.otherComments')}</div>
                        <textarea
                            value={otherComments}
                            onChange={e => setOtherComments(e.target.value)}
                            placeholder={t('profile.survey.openPlaceholder')}
                            rows={3}
                            disabled={isSubmitting}
                        />
                    </div>
                </section>

                <button type="submit" className="survey-submit-btn" disabled={isSubmitting}>
                    {isSubmitting ? t('profile.survey.submitting') : t('profile.survey.submit')}
                </button>
            </form>

            {printNodes}
            <style>{surveyStyles}</style>
        </div>
    );
}

const surveyStyles = `
    .user-survey {
        padding: 20px;
        max-width: 800px;
    }
    .survey-intro-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 20px;
    }
    .survey-intro-text { min-width: 0; }
    .survey-intro-head h2 {
        margin: 0 0 6px;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--color-text);
    }
    .survey-export-btn {
        flex-shrink: 0;
        padding: 8px 16px;
        font-size: 0.85rem;
        font-weight: 600;
        background: var(--color-primary);
        color: #fff;
        border: 1px solid var(--color-primary);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.18s ease;
        white-space: nowrap;
        font-family: inherit;
    }
    .survey-export-btn:hover:not(:disabled) {
        background: var(--color-primary-hover);
        border-color: var(--color-primary-hover);
    }
    .survey-export-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }
    .survey-success-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        margin-top: 24px;
    }
    .survey-loading {
        padding: 60px 20px;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: 0.92rem;
    }
    /* ── 已填过：只读结果页 ── */
    .survey-result-card {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.06);
        animation: surveySlideUp 0.4s ease-out;
    }
    .survey-result-head {
        display: flex;
        align-items: center;
        gap: 16px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--color-border);
    }
    .survey-result-icon { font-size: 2.6rem; line-height: 1; flex-shrink: 0; }
    .survey-result-headtext { min-width: 0; }
    .survey-result-headtext h3 {
        margin: 0 0 4px;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-text);
    }
    .survey-result-headtext p {
        margin: 0;
        font-size: 0.85rem;
        color: var(--color-text-secondary);
        line-height: 1.5;
    }
    .survey-result-section { margin-top: 22px; }
    .survey-result-section h4 {
        margin: 0 0 10px;
        font-size: 0.92rem;
        font-weight: 700;
        color: var(--color-primary);
    }
    .survey-result-row,
    .survey-result-rating {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 9px 0;
        border-bottom: 1px solid var(--color-border);
        flex-wrap: wrap;
    }
    .srr-q {
        font-size: 0.88rem;
        color: var(--color-text);
        line-height: 1.45;
        flex: 1;
        min-width: 180px;
    }
    .srr-v {
        flex-shrink: 0;
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--color-primary);
    }
    .srr-dots {
        display: flex;
        align-items: center;
        gap: 5px;
        flex-shrink: 0;
    }
    .srr-dots i {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--color-border);
        display: block;
    }
    .srr-dots i.on { background: var(--color-primary); }
    .srr-dots b {
        margin-left: 6px;
        min-width: 18px;
        text-align: right;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--color-primary);
    }
    .survey-result-open { margin-bottom: 12px; }
    .survey-result-open .srr-q {
        margin-bottom: 6px;
        font-weight: 600;
        display: block;
    }
    .srr-text {
        padding: 10px 13px;
        border-radius: 8px;
        background: var(--color-bg);
        border: 1px solid var(--color-border);
        font-size: 0.88rem;
        color: var(--color-text);
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
    }
    .srr-text.empty { color: var(--color-text-secondary); font-style: italic; }
    /* ── 重新填写提示条 ── */
    .survey-editing-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
        padding: 10px 14px;
        border-radius: 10px;
        background: rgba(13, 148, 136, 0.07);
        border: 1px solid rgba(13, 148, 136, 0.28);
        font-size: 0.85rem;
        color: var(--color-text-secondary);
    }
    .survey-linkbtn {
        flex-shrink: 0;
        background: none;
        border: none;
        padding: 0;
        color: var(--color-primary);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        text-decoration: underline;
    }
    /* 离屏可打印节点：定位到视口外，仅作 html2canvas 截图源 */
    .survey-print-offscreen {
        position: fixed;
        left: -10000px;
        top: 0;
        pointer-events: none;
    }
    .survey-print {
        width: 720px;
        box-sizing: border-box;
        padding: 40px 44px;
        background: #ffffff;
        color: #1a1a1a;
        font-size: 15px;
        line-height: 1.6;
        font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    }
    .survey-print .sp-title { margin: 0 0 6px; font-size: 22px; font-weight: 800; color: #0d9488; }
    .survey-print .sp-intro { margin: 0 0 20px; color: #555; font-size: 13.5px; }
    .survey-print .sp-section {
        margin: 22px 0 12px;
        padding-bottom: 6px;
        border-bottom: 2px solid #0d9488;
        font-size: 16px;
        font-weight: 700;
        color: #0d9488;
    }
    .survey-print .sp-hint { margin: 0 0 14px; font-size: 12.5px; color: #777; font-style: italic; }
    .survey-print .sp-q { margin: 12px 0 6px; font-weight: 600; color: #1a1a1a; }
    .survey-print .sp-opts { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-bottom: 6px; }
    .survey-print .sp-opt { font-size: 14px; color: #333; }
    .survey-print .sp-rating {
        display: flex;
        /* 不能用 baseline：带 padding 的色块会被抬高，html2canvas 再按基线
           画数字，两头一凑数字就跑到框外。改成 center + 固定行高。 */
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 7px 0;
        border-bottom: 1px dashed #e0e0e0;
    }
    .survey-print .sp-rating-q { color: #1a1a1a; }
    .survey-print .sp-scale {
        flex-shrink: 0;
        font-variant-numeric: tabular-nums;
        letter-spacing: 1px;
        color: #0d9488;
        font-weight: 700;
    }
    .survey-print .sp-answer-val {
        flex-shrink: 0;
        width: 30px;
        height: 26px;
        /* line-height 比 height 小 4px 是实测校准值：html2canvas 画文字
           比浏览器低约 2px，26/26 会把数字压到框底。26/22 实测居中。 */
        line-height: 22px;
        padding: 0;
        text-align: center;
        font-weight: 800;
        font-size: 15px;
        color: #fff;
        background: #0d9488;
        border-radius: 6px;
    }
    .survey-print .sp-line { height: 0; border-bottom: 1px solid #cfcfcf; margin: 4px 0 10px; }
    .survey-print .sp-a-row {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 7px 0;
        border-bottom: 1px dashed #e0e0e0;
    }
    .survey-print .sp-a-q { color: #1a1a1a; }
    .survey-print .sp-a-v { flex-shrink: 0; font-weight: 700; color: #0d9488; }
    .survey-print .sp-a-text {
        margin: 0 0 8px;
        padding: 8px 12px;
        background: #f5f5f5;
        border-radius: 6px;
        font-size: 14px;
        color: #333;
        white-space: pre-wrap;
        word-break: break-word;
        min-height: 18px;
    }
    .survey-intro-head p {
        margin: 0;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
        line-height: 1.5;
    }
    .survey-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
    }
    .survey-section {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 24px;
    }
    .survey-section-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
    }
    .survey-section-title {
        margin: 0 0 14px;
        font-size: 1rem;
        font-weight: 700;
        color: var(--color-primary);
    }
    .survey-section-head .survey-section-title {
        margin-bottom: 0;
    }
    .survey-required {
        font-size: 0.7rem;
        font-weight: 700;
        color: #ef4444;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.25);
        border-radius: 999px;
        padding: 1px 9px;
    }
    .survey-rating-hint {
        margin: 0 0 16px;
        font-size: 0.82rem;
        color: var(--color-text-secondary);
    }
    .survey-q {
        margin-bottom: 18px;
    }
    .survey-q:last-child {
        margin-bottom: 0;
    }
    .survey-q-label {
        font-size: 0.92rem;
        font-weight: 600;
        color: var(--color-text);
        margin-bottom: 10px;
        line-height: 1.45;
    }
    .survey-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }
    .survey-pill {
        padding: 8px 16px;
        border-radius: 999px;
        border: 1.5px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.88rem;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
    }
    .survey-pill:hover:not(:disabled) {
        border-color: var(--color-primary);
    }
    .survey-pill.selected {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
        font-weight: 600;
    }
    .survey-rating-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
        border-top: 1px solid var(--color-border);
        flex-wrap: wrap;
    }
    .survey-rating-row .survey-q-label {
        margin-bottom: 0;
        flex: 1;
        min-width: 200px;
    }
    .survey-scale {
        display: flex;
        gap: 8px;
    }
    .survey-scale-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1.5px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
        font-family: inherit;
    }
    .survey-scale-btn:hover:not(:disabled) {
        border-color: var(--color-primary);
        color: var(--color-primary);
    }
    .survey-scale-btn.active {
        background: var(--color-primary);
        border-color: var(--color-primary);
        color: #fff;
        box-shadow: 0 2px 8px rgba(13, 148, 136, 0.28);
    }
    .survey-q textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        border: 2px solid var(--color-border);
        background: var(--color-bg);
        color: var(--color-text);
        font-size: 0.92rem;
        font-family: inherit;
        resize: vertical;
        transition: border-color 0.2s, box-shadow 0.2s;
    }
    .survey-q textarea::placeholder {
        color: #94a3b8;
    }
    .survey-q textarea:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
    }
    .survey-submit-btn {
        background: var(--color-primary);
        color: #fff;
        border: none;
        padding: 14px 24px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.2s;
    }
    .survey-submit-btn:hover:not(:disabled) {
        background: var(--color-primary-hover);
    }
    .survey-submit-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
    .survey-success-card {
        background: var(--color-surface);
        padding: 60px 40px;
        border-radius: 20px;
        text-align: center;
        border: 1px solid var(--color-border);
        box-shadow: 0 10px 30px rgba(0,0,0,0.08);
        animation: surveySlideUp 0.5s ease-out;
    }
    .survey-success-card h3 {
        margin: 0 0 8px;
        color: var(--color-text);
    }
    .survey-success-card p {
        margin: 0;
        color: var(--color-text-secondary);
    }
    .survey-success-icon {
        font-size: 5rem;
        margin-bottom: 20px;
    }
    .survey-secondary-btn {
        background: transparent;
        color: var(--color-primary);
        border: 1px solid var(--color-primary);
        padding: 10px 20px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }
    .survey-secondary-btn:hover {
        background: rgba(13, 148, 136, 0.08);
    }
    @keyframes surveySlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 600px) {
        .survey-rating-row {
            flex-direction: column;
            align-items: flex-start;
        }
    }
`;
