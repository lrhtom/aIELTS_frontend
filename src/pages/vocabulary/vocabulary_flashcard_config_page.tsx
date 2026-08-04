import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { showToast } from '../../components/common/Toast';
import { syncVocab, type VocabCard, type VocabStats } from '../../api/vocab';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_flashcard_config.css';

/* -- 'Add words' panel (unfolded by the top-bar '+ Add words' button) -- */
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

/* -- Parse the input ------------------------------------------------------- */
function sortCards(cards: VocabCard[]): VocabCard[] {
    return [...cards].sort((a, b) => {
        const aNew = a.state === 0;
        const bNew = b.state === 0;
        if (aNew !== bNew) return aNew ? 1 : -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
    });
}

/* -- Card ordering: due cards first, new cards after ----------------------- */
export default function VocabularyFlashcardConfigPage() {
    const { t } = useLang();
    const navigate = useNavigate();

    const [vocabInput, setVocabInput] = useState('');
    const [dueOnly, setDueOnly] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [allCards, setAllCards] = useState<VocabCard[] | null>(null);
    const [stats, setStats] = useState<VocabStats | null>(null);




    const handleVocabChange = (val: string) => {
        setVocabInput(val);
        // -- Component -------------------------------------------------------------
        setAllCards(null);
        setStats(null);
    };

    /* clear the last sync result once the input changes */
    const handleSync = async () => {
        const entries = parseVocabInput(vocabInput);
        if (entries.length === 0) {
            showToast(t('vocab.flashcardConfig.toastEmptyInput'), 'error');
            return;
        }
        setSyncing(true);
        try {
            const result = await syncVocab(entries.map(e => ({ word: e.en, zh: e.zh })));
            setAllCards(result.cards);
            setStats(result.stats);
        } catch {
            showToast(t('vocab.flashcardConfig.toastSyncFail'), 'error');
        } finally {
            setSyncing(false);
        }
    };

    /* sync the vocabulary to the backend and get the FSRS state back */
    const handleStart = () => {
        if (!allCards) {
            showToast(t('vocab.flashcardConfig.toastNoSync'), 'error');
            return;
        }
        const now = new Date();
        const filtered = dueOnly
            ? allCards.filter(c => c.state === 0 || new Date(c.due) <= now)
            : allCards;

        if (filtered.length === 0) {
            showToast(t('vocab.flashcardConfig.toastAllDone'), 'success');
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
    pageTitle={t('vocab.flashcardConfig.pageTitle')}
    pageSubtitle={t('vocab.flashcardConfig.pageSubtitle')}
    backUrl='/vocabulary'
    backText={t('vocab.flashcardConfig.backText')}
>
            <div className="config-page-wrap reading-config">
                <div className="config-card">
                    <h3>{t('vocab.flashcardConfig.targetWordsHeading')}</h3>
                    <VocabInput value={vocabInput} onChange={handleVocabChange} />
                    <div style={{ marginTop: '16px' }}>
                        <button
                            className="skill-btn reading"
                            style={{ width: '100%' }}
                            onClick={handleSync}
                            disabled={syncing}
                        >
                            {syncing ? t('vocab.flashcardConfig.syncingBtn') : t('vocab.flashcardConfig.syncBtn')}
                        </button>
                    </div>

                    {stats && (
                        <div className="fc-stats-row">
                            <span className="fc-stat-badge badge-due">
                                {t('vocab.flashcardConfig.todayDueBadge').replace('{n}', String(reviewCount))}
                            </span>
                            <span className="fc-stat-badge badge-new">
                                {t('vocab.flashcardConfig.newBadge').replace('{n}', String(stats.new))}
                            </span>
                            <span className="fc-stat-badge badge-total">
                                {t('vocab.flashcardConfig.totalBadge').replace('{n}', String(stats.total))}
                            </span>
                        </div>
                    )}
                </div>

                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t('vocab.flashcardConfig.showTodayOnlyLabel')}</div>
                            <div className="label-desc">
                                {t('vocab.flashcardConfig.showTodayOnlyDesc')}
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

                <div className="config-card">
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        onClick={handleStart}
                        disabled={!allCards}
                    >
                        {t('vocab.flashcardConfig.startBtn')}
                    </button>
                    {!allCards && (
                        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            {t('vocab.flashcardConfig.syncFirstHint')}
                        </p>
                    )}
                </div>
            </div>
        </Layout>
    );
}
