import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { reviewCustomCard, type CustomMemoryCard } from '../../api/custom_memory';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/custom_memory_cards.css';

interface StudyLocationState {
    deckId: number;
    deckTitle: string;
    dailyCount?: number;
    cards: CustomMemoryCard[];
}

interface CustomStudyResult {
    cardId: number;
    frontText: string;
    backText: string;
    rating: number;
    newDue: string;
    scheduledDays: number;
}

export default function CustomMemoryStudyPage() {
    const { t } = useLang();
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as StudyLocationState | null;

    const RATING_OPTIONS: Array<{ id: number; label: string; cls: string }> = [
        { id: 1, label: t('vocab.customMemory.ratings.again'), cls: 'btn-again' },
        { id: 2, label: t('vocab.customMemory.ratings.hard'), cls: 'btn-hard' },
        { id: 3, label: t('vocab.customMemory.ratings.good'), cls: 'btn-good' },
        { id: 4, label: t('vocab.customMemory.ratings.easy'), cls: 'btn-easy' },
    ];

    const formatDue = (iso: string): string => {
        const diff = new Date(iso).getTime() - Date.now();
        const mins = Math.round(diff / 60000);
        if (mins <= 0) return t('vocab.intervals.today');
        if (mins < 60) return t('vocab.intervals.minsAfter').replace('{n}', String(mins));
        const days = Math.round(diff / 86400000);
        if (days <= 1) return t('vocab.intervals.tomorrow');
        return t('vocab.intervals.daysAfter').replace('{n}', String(days));
    };

    const [deckId, setDeckId] = useState<number | null>(null);
    const [deckTitle, setDeckTitle] = useState('');
    const [dailyCount, setDailyCount] = useState(20);
    const [cards, setCards] = useState<CustomMemoryCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState<CustomStudyResult[]>([]);
    const [ready, setReady] = useState(false);

    // 冷启动/刷新进来没有卡片：渲染落地页而不是静默跳走（静默跳转 = 用户眼里的"闪退"）
    const [noSession, setNoSession] = useState(false);

    useEffect(() => {
        if (!state?.deckId || !Array.isArray(state.cards) || state.cards.length === 0) {
            setNoSession(true);
            return;
        }
        setDeckId(state.deckId);
        setDeckTitle(state.deckTitle || t('vocab.customMemory.defaultTitle'));
        setDailyCount(state.dailyCount && state.dailyCount > 0 ? state.dailyCount : 20);
        setCards(state.cards);
        setCurrentIndex(0);
        setResults([]);
        setIsFlipped(false);
        setReady(true);
    }, [navigate, state]);

    const currentCard = useMemo(() => cards[currentIndex], [cards, currentIndex]);

    const handleRate = async (rating: number) => {
        if (!currentCard || submitting || deckId === null) return;

        setSubmitting(true);
        try {
            const { card } = await reviewCustomCard(currentCard.id, rating, currentCard.last_review);
            const updatedCards = [...cards];
            updatedCards[currentIndex] = card;
            setCards(updatedCards);

            const nextResults = [
                ...results,
                {
                    cardId: currentCard.id,
                    frontText: currentCard.front_text,
                    backText: currentCard.back_text,
                    rating,
                    newDue: card.due,
                    scheduledDays: card.scheduled_days,
                },
            ];
            setResults(nextResults);

            if (currentIndex >= updatedCards.length - 1) {
                navigate('/vocabulary/custom-cards/result', {
                    replace: true,
                    state: {
                        deckId,
                        deckTitle,
                        dailyCount,
                        total: updatedCards.length,
                        results: nextResults,
                    },
                });
                return;
            }

            setCurrentIndex((prev) => prev + 1);
            setIsFlipped(false);
        } catch (e: unknown) {
            const msg = (e as any)?.response?.data?.error || t('vocab.customMemory.reviewFail'); // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (noSession) {
        return (
            <Layout>
                <div className="config-page-wrap cm-study-wrap">
                    <div className="rp-noconfig">
                        <div className="rp-noconfig-icon" aria-hidden="true">🗂️</div>
                        <h2 className="rp-noconfig-title">{t('vocab.customMemory.noSessionTitle')}</h2>
                        <p className="rp-noconfig-desc">{t('vocab.customMemory.noSessionDesc')}</p>
                        <div className="rp-noconfig-actions">
                            <button className="rp-noconfig-primary" onClick={() => navigate('/vocabulary/custom-cards')}>
                                {t('vocab.customMemory.noSessionGoDecks')}
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    if (!ready || !currentCard) {
        return (
            <Layout>
                <div className="config-page-wrap cm-study-wrap">
                    <div className="lp-empty">{t('vocab.common.loading')}</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="config-page-wrap cm-study-wrap">
                <div className="cm-study-header">
                    <h1>{deckTitle}</h1>
                    <p>{t('vocab.customMemory.studyProgress').replace('{i}', String(currentIndex + 1)).replace('{n}', String(cards.length)).replace('{d}', String(dailyCount))}</p>
                </div>

                <div className="cm-progress-track">
                    <div
                        className="cm-progress-fill"
                        style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                    />
                </div>

                <div className={`cm-card ${isFlipped ? 'flipped' : ''}`}>
                    <div className="cm-card-face cm-card-front">
                        <div className="cm-face-label">{t('vocab.customMemory.faceFront')}</div>
                        <div className="cm-face-text">{currentCard.front_text}</div>
                    </div>
                    <div className="cm-card-face cm-card-back">
                        <div className="cm-face-label">{t('vocab.customMemory.faceBack')}</div>
                        <div className="cm-face-text">
                            {currentCard.back_text || t('vocab.customMemory.noBackContent')}
                        </div>
                    </div>
                </div>

                <div className="cm-actions">
                    <button
                        type="button"
                        className="lp-plan-btn secondary"
                        onClick={() => setIsFlipped((v) => !v)}
                        disabled={submitting}
                    >
                        {isFlipped ? t('vocab.customMemory.viewFront') : t('vocab.customMemory.flipToBack')}
                    </button>
                </div>

                <div className="cm-rating-grid">
                    {RATING_OPTIONS.map((opt) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`fc-rate-btn ${opt.cls}`}
                            onClick={() => handleRate(opt.id)}
                            disabled={!isFlipped || submitting}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <p className="cm-next-hint">
                    {t('vocab.customMemory.nextReviewLabel')}{formatDue(currentCard.due)}
                </p>
            </div>
        </Layout>
    );
}
