import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { showToast } from '../../components/common/Toast';
import { syncVocab, type VocabCard, type VocabStats } from '../../api/vocab';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard_config.css';

/* ── 解析输入 ─────────────────────────────────────────────────────────────── */
interface VocabEntry { en: string; zh: string }

function parseVocabInput(raw: string): VocabEntry[] {
    return raw.split('\n').map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        const dashIdx = trimmed.indexOf(' - ');
        if (dashIdx !== -1) {
            const en = trimmed.slice(0, dashIdx).trim();
            const zh = trimmed.slice(dashIdx + 3).trim();
            if (en && zh) return { en, zh };
        }
        const colonIdx = trimmed.indexOf(': ');
        if (colonIdx !== -1) {
            const en = trimmed.slice(0, colonIdx).trim();
            const zh = trimmed.slice(colonIdx + 2).trim();
            if (en && zh) return { en, zh };
        }
        const zhMatch = /[\u4e00-\u9fa5]/.exec(trimmed);
        if (zhMatch) {
            const en = trimmed.slice(0, zhMatch.index).replace(/[-\s]+$/, '').trim();
            const zh = trimmed.slice(zhMatch.index).trim();
            if (en && zh) return { en, zh };
        }
        return null;
    }).filter(Boolean) as VocabEntry[];
}

/* ── 卡片排序：到期卡优先，新卡在后 ─────────────────────────────────────── */
function sortCards(cards: VocabCard[]): VocabCard[] {
    return [...cards].sort((a, b) => {
        const aNew = a.state === 0;
        const bNew = b.state === 0;
        if (aNew !== bNew) return aNew ? 1 : -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
    });
}

/* ── 组件 ─────────────────────────────────────────────────────────────────── */
export default function VocabularyFlashcardConfigPage() {
    const navigate = useNavigate();

    const [vocabInput, setVocabInput] = useState('');
    const [dueOnly, setDueOnly] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [allCards, setAllCards] = useState<VocabCard[] | null>(null);
    const [stats, setStats] = useState<VocabStats | null>(null);




    const handleVocabChange = (val: string) => {
        setVocabInput(val);
        // 输入改变后清空上次同步结果
        setAllCards(null);
        setStats(null);
    };

    /* 同步词汇到后端，获取 FSRS 状态 */
    const handleSync = async () => {
        const entries = parseVocabInput(vocabInput);
        if (entries.length === 0) {
            showToast('请先输入有效词汇（英文 - 中文）', 'error');
            return;
        }
        setSyncing(true);
        try {
            const result = await syncVocab(entries.map(e => ({ word: e.en, zh: e.zh })));
            setAllCards(result.cards);
            setStats(result.stats);
        } catch {
            showToast('同步失败，请检查网络', 'error');
        } finally {
            setSyncing(false);
        }
    };

    /* 开始背诵 */
    const handleStart = () => {
        if (!allCards) {
            showToast('请先点击"同步词汇"', 'error');
            return;
        }
        const now = new Date();
        const filtered = dueOnly
            ? allCards.filter(c => c.state === 0 || new Date(c.due) <= now)
            : allCards;

        if (filtered.length === 0) {
            showToast('没有需要复习的单词，今天已全部完成！', 'success');
            return;
        }
        navigate('/vocabulary/flashcard/doing', { state: { cards: sortCards(filtered) } });
    };

    const now = new Date();
    const reviewCount = allCards
        ? allCards.filter(c => c.state !== 0 && new Date(c.due) <= now).length
        : 0;

    return (
        <Layout
    pageTitle='记忆卡背诵'
    pageSubtitle='翻转卡片，快速记忆单词含义。使用 FSRS 算法智能安排复习间隔。'
    backUrl='/vocabulary'
    backText='返回词汇学习'
>
            <div className="config-page-wrap reading-config">
                {/* 词汇输入 */}
                <div className="config-card">
                    <h3>目标词汇（英-中）</h3>
                    <VocabInput value={vocabInput} onChange={handleVocabChange} />
                    <div style={{ marginTop: '16px' }}>
                        <button
                            className="skill-btn reading"
                            style={{ width: '100%' }}
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? '同步中…' : '🔄 同步词汇状态'}
                        </button>
                    </div>

                    {/* 同步结果统计徽章 */}
                    {stats && (
                        <div className="fc-stats-row">
                            <span className="fc-stat-badge badge-due">
                                🔔 今日到期 {reviewCount}
                            </span>
                            <span className="fc-stat-badge badge-new">
                                ✨ 新单词 {stats.new}
                            </span>
                            <span className="fc-stat-badge badge-total">
                                📚 全部 {stats.total}
                            </span>
                        </div>
                    )}
                </div>

                {/* 显示范围 */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">只显示今日到期</div>
                            <div className="label-desc">
                                开启：仅复习今天到期的旧卡 + 所有新卡；关闭：复习全部词汇
                            </div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={dueOnly}
                                onChange={e => setDueOnly(e.target.checked)}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>

                {/* 开始按钮 */}
                <div className="config-card">
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        onClick={handleStart}
                        disabled={!allCards}
                    >
                        <span className="btn-icon">🃏</span> 开始背诵
                    </button>
                    {!allCards && (
                        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            请先点击"同步词汇状态"
                        </p>
                    )}
                </div>
            </div>
        </Layout>
    );
}
