import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { reviewCustomCard, type CustomMemoryCard } from '../../api/custom_memory';
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

const RATING_OPTIONS: Array<{ id: number; label: string; cls: string }> = [
    { id: 1, label: '忘记了', cls: 'btn-again' },
    { id: 2, label: '困难', cls: 'btn-hard' },
    { id: 3, label: '一般', cls: 'btn-good' },
    { id: 4, label: '容易', cls: 'btn-easy' },
];

function formatDue(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    const mins = Math.round(diff / 60000);
    if (mins <= 0) return '今天';
    if (mins < 60) return `${mins} 分钟后`;
    const days = Math.round(diff / 86400000);
    if (days <= 1) return '明天';
    return `${days} 天后`;
}

export default function CustomMemoryStudyPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as StudyLocationState | null;

    const [deckId, setDeckId] = useState<number | null>(null);
    const [deckTitle, setDeckTitle] = useState('');
    const [dailyCount, setDailyCount] = useState(20);
    const [cards, setCards] = useState<CustomMemoryCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [results, setResults] = useState<CustomStudyResult[]>([]);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!state?.deckId || !Array.isArray(state.cards) || state.cards.length === 0) {
            navigate('/vocabulary/custom-cards', { replace: true });
            return;
        }
        setDeckId(state.deckId);
        setDeckTitle(state.deckTitle || '自定义记忆卡');
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
        } catch (e: any) {
            const msg = e?.response?.data?.error || '评分提交失败，请稍后再试';
            showToast(msg, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready || !currentCard) {
        return (
            <Layout>
                <div className="config-page-wrap cm-study-wrap">
                    <div className="lp-empty">加载中...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="config-page-wrap cm-study-wrap">
                <div className="cm-study-header">
                    <h1>{deckTitle}</h1>
                    <p>自定义记忆卡学习（{currentIndex + 1} / {cards.length}） · 每日目标 {dailyCount} 张</p>
                </div>

                <div className="cm-progress-track">
                    <div
                        className="cm-progress-fill"
                        style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                    />
                </div>

                <div className={`cm-card ${isFlipped ? 'flipped' : ''}`}>
                    <div className="cm-card-face cm-card-front">
                        <div className="cm-face-label">正面</div>
                        <div className="cm-face-text">{currentCard.front_text}</div>
                    </div>
                    <div className="cm-card-face cm-card-back">
                        <div className="cm-face-label">背面</div>
                        <div className="cm-face-text">
                            {currentCard.back_text || '（未设置背面内容）'}
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
                        {isFlipped ? '查看正面' : '翻到背面'}
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
                    预计下次复习：{formatDue(currentCard.due)}
                </p>
            </div>
        </Layout>
    );
}
