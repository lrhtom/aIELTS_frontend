import { useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

const PREP_OPTIONS = ['lt1m', '1to3m', '3to6m', '6mplus'] as const;
const BAND_OPTIONS = ['5.5-6.0', '6.5', '7.0', '7.5+'] as const;

// 后端 snake_case 字段 ↔ i18n 短键（profile.survey.b.<key>）。
// 顺序即问卷第 3–10 题顺序，UserSurvey 与 AdminSurvey 共用同一映射约定。
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
    const [submitted, setSubmitted] = useState(false);

    const setRating = (field: string, value: number) =>
        setRatings(prev => ({ ...prev, [field]: value }));

    const resetForm = () => {
        setPrepDuration('');
        setTargetBand('');
        setRatings({});
        setMostUseful('');
        setImprovements('');
        setOtherComments('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Part B（第 3–10 题）全部必填、范围 1–5。Part A / Part C 可选。
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
            await apiClient.post('/survey/submit', payload);
            setSubmitted(true);
            resetForm();
        } catch (error) {
            console.error('Survey submission failed:', error);
            toast.error(t('profile.survey.errorSubmit'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="user-survey">
                <div className="survey-success-card">
                    <div className="survey-success-icon">🎉</div>
                    <h3>{t('profile.survey.successTitle')}</h3>
                    <p>{t('profile.survey.successDesc')}</p>
                    <button
                        className="survey-secondary-btn"
                        onClick={() => setSubmitted(false)}
                        style={{ marginTop: 20 }}
                    >
                        {t('profile.survey.fillAgain')}
                    </button>
                </div>
                <style>{surveyStyles}</style>
            </div>
        );
    }

    return (
        <div className="user-survey">
            <div className="survey-intro-head">
                <h2>{t('profile.survey.heading')}</h2>
                <p>{t('profile.survey.intro')}</p>
            </div>

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
        margin-bottom: 20px;
    }
    .survey-intro-head h2 {
        margin: 0 0 6px;
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--color-text);
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
