import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { startCustomDeck } from '../../api/custom_memory';
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

const RATING_TEXT: Record<number, string> = {
    1: '忘记了',
    2: '困难',
    3: '一般',
    4: '容易',
};

export default function CustomMemoryResultPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const state = location.state as ResultLocationState | null;

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
        setDeckTitle(state.deckTitle || '自定义记忆卡');
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
                    showToast(`今日学习额度已完成（目标 ${deck.daily_count} 张）`, 'success');
                } else {
                    showToast(dueOnly ? '当前没有到期卡片' : '当前没有可学习卡片', 'success');
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
            const msg = (e as any)?.response?.data?.error || '重新开始失败，请稍后重试'; // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(msg, 'error');
        } finally {
            setRestarting(false);
        }
    };

    if (!ready) {
        return (
            <Layout>
                <div className="config-page-wrap cm-result-wrap">
                    <div className="lp-empty">加载中...</div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="config-page-wrap cm-result-wrap">
                <div className="cm-result-header">
                    <h1>{deckTitle}</h1>
                    <p>本轮学习完成</p>
                </div>

                <div className="cm-result-stats">
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{results.length}</div>
                        <div className="cm-stat-label">已学习卡片</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{total}</div>
                        <div className="cm-stat-label">卡组总数</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{averageRating}</div>
                        <div className="cm-stat-label">平均评分</div>
                    </div>
                    <div className="cm-stat-card">
                        <div className="cm-stat-num">{dailyCount}</div>
                        <div className="cm-stat-label">每日目标</div>
                    </div>
                </div>

                <div className="cm-result-list">
                    {results.map((item) => (
                        <div className="cm-result-item" key={item.cardId}>
                            <div className="cm-result-front">{item.frontText}</div>
                            {item.backText && <div className="cm-result-back">{item.backText}</div>}
                            <div className="cm-result-meta">
                                <span>评分：{RATING_TEXT[item.rating] || item.rating}</span>
                                <span>间隔：{Math.max(0, item.scheduledDays)} 天</span>
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
                        再学一轮（全部卡）
                    </button>
                    <button
                        type="button"
                        className="lp-plan-btn primary"
                        disabled={restarting}
                        onClick={() => handleRestart(true)}
                    >
                        仅学到期卡
                    </button>
                    <Link to="/vocabulary/plans" className="lp-plan-btn secondary">返回词汇学习</Link>
                </div>
            </div>
        </Layout>
    );
}
