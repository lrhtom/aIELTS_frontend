import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { startCustomDeck } from '../../api/custom_memory';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/custom_memory_cards.css';

interface CustomStudyResult {
    cardId: number;
    frontText: string;
    backText: string;
    rating: number;
    newDue: string;
    scheduledDays: number;
}

interface ResultLocationState {
    deckId: number;
    deckTitle: string;
    dailyCount?: number;
    total: number;
    results: CustomStudyResult[];
}

export default function CustomMemoryResultPage() {
    const { t } = useLang();
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as ResultLocationState | null;

    const RATING_TEXT: Record<number, string> = {
        1: t('vocab.customMemory.ratings.again'),
        2: t('vocab.customMemory.ratings.hard'),
        3: t('vocab.customMemory.ratings.good'),
        4: t('vocab.customMemory.ratings.easy'),
    };

    const [deckId, setDeckId] = useState<number | null>(null);
    const [deckTitle, setDeckTitle] = useState('');
    const [dailyCount, setDailyCount] = useState(20);
    const [results, setResults] = useState<CustomStudyResult[]>([]);
    const [total, setTotal] = useState(0);
    const [ready, setReady] = useState(false);
    const [restarting, setRestarting] = useState(false);

    useEffect(() => {
        if (!state?.deckId || !Array.isArray(state.results)) {
            navigate('/vocabulary/custom-cards', { replace: true });
            return;
        }
        setDeckId(state.deckId);
        setDeckTitle(state.deckTitle || t('vocab.customMemory.defaultTitle'));
        setDailyCount(state.dailyCount && state.dailyCount > 0 ? state.dailyCount : 20);
        setResults(state.results);
        setTotal(state.total || state.results.length);
        setReady(true);
    }, [navigate, state]);

    const averageRating = useMemo(() => {
        if (!results.length) return 0;
        const score = results.reduce((sum, item) => sum + item.rating, 0) / results.length;
        return Number(score.toFixed(2));
    }, [results]);

    const handleRestart = async (dueOnly: boolean) => {
        if (deckId === null || restarting) return;
        setRestarting(true);
        try {
            const { deck, cards, stats } = await startCustomDeck(deckId, dueOnly, true);
            if (!cards.length) {
                if (stats.remaining_today === 0) {
                    showToast(t('vocab.customMemory.todayDoneMsg').replace('{n}', String(deck.daily_count)), 'success');
                } else {
                    showToast(dueOnly ? t('vocab.customMemory.noExpiredCards') : t('vocab.customMemory.noAvailableCards'), 'success');
                }
                return;
            }
            navigate('/vocabulary/custom-cards/study', {
                replace: true,
                state: {
                    deckId: deck.id,
                    deckTitle: deck.title,
                    dailyCount: deck.daily_count,
                    cards,
                },
            });
        } catch (e: unknown) {
            const msg = (e as any)?.response?.data?.error || t('vocab.customMemory.restartFail'); // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(msg, 'error');
        } finally {
            setRestarting(false);
        }
    };

    if (!ready) {
        return (
            <Layout>
                <div className="config-page-wrap cm-result-wrap">
                    <div className="lp-empty">{t('vocab.common.loading')}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="config-page-wrap cm-result-wrap">
                <div className="cm-result-header">
                    <h1>{deckTitle}</h1>
                    <p>{t('vocab.customMemory.completedTitle')}</p>
                </div>

                <div className="cm-result-stats">
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{results.length}</div>
                        <div className="cm-stat-label">{t('vocab.customMemory.studiedLabel')}</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{total}</div>
                        <div className="cm-stat-label">{t('vocab.customMemory.totalLabel')}</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{averageRating}</div>
                        <div className="cm-stat-label">{t('vocab.customMemory.avgRatingLabel')}</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{dailyCount}</div>
                        <div className="cm-stat-label">{t('vocab.customMemory.dailyGoalLabel')}</div>
                    </div>
                </div>

                <div className="cm-result-list">
                    {results.map((item) => (
                        <div className="cm-result-item" key={item.cardId}>
                            <div className="cm-result-front">{item.frontText}</div>
                            {item.backText && <div className="cm-result-back">{item.backText}</div>}
                            <div className="cm-result-meta">
                                <span>{t('vocab.customMemory.ratingItem')}{RATING_TEXT[item.rating] || item.rating}</span>
                                <span>{t('vocab.customMemory.intervalItem')}{Math.max(0, item.scheduledDays)} {t('vocab.customMemory.intervalDaysUnit')}</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="cm-result-actions">
                    <button
                        type="button"
                        className="lp-plan-btn secondary"
                        disabled={restarting}
                        onClick={() => handleRestart(false)}
                    >
                        {t('vocab.customMemory.restartAllBtn')}
                    </button>
                    <button
                        type="button"
                        className="lp-plan-btn primary"
                        disabled={restarting}
                        onClick={() => handleRestart(true)}
                    >
                        {t('vocab.customMemory.restartDueBtn')}
                    </button>
                    <Link to="/vocabulary/plans" className="lp-plan-btn secondary">{t('vocab.customMemory.backToVocab')}</Link>
                </div>
            </div>
        </Layout>
    );
}
