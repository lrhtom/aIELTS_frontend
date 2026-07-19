import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { appendCustomDeck, createCustomDeck } from '../../api/custom_memory';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/custom_memory_cards.css';

interface CreateLocationState {
    prefillDeckId?: number;
    prefillTitle?: string;
    prefillDailyCount?: number;
}

export default function CustomMemoryCreatePage() {
    const { t } = useLang();
    const location = useLocation();
    const navigate = useNavigate();
    const [targetDeckId, setTargetDeckId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [dailyCount, setDailyCount] = useState(20);
    const [frontText, setFrontText] = useState('');
    const [backText, setBackText] = useState('');
    const [batchByLine, setBatchByLine] = useState(true);
    const [creating, setCreating] = useState(false);

    const estimatedCount = useMemo(() => {
        if (!batchByLine) {
            return frontText.trim() ? 1 : 0;
        }
        return frontText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .length;
    }, [batchByLine, frontText]);

    const submitText = useMemo(() => {
        if (batchByLine) {
            const frontLines = frontText.split(/\r?\n/).map((line) => line.trim());
            const backLines = backText.split(/\r?\n/).map((line) => line.trim());
            const merged: string[] = [];

            for (let i = 0; i < frontLines.length; i += 1) {
                const front = frontLines[i];
                if (!front) continue;
                const back = backLines[i] || '';
                merged.push(back ? `${front} - ${back}` : front);
            }

            return merged.join('\n');
        }

        const frontSingle = frontText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ');
        const backSingle = backText
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .join(' ');

        if (!frontSingle) return '';
        return backSingle ? `${frontSingle} - ${backSingle}` : frontSingle;
    }, [backText, batchByLine, frontText]);

    useEffect(() => {
        const state = location.state as CreateLocationState | null;
        if (!state) return;

        if (typeof state.prefillDeckId === 'number' && Number.isFinite(state.prefillDeckId) && state.prefillDeckId > 0) {
            setTargetDeckId(Math.round(state.prefillDeckId));
        }

        if (typeof state.prefillTitle === 'string' && state.prefillTitle.trim()) {
            setTitle(state.prefillTitle.trim());
        }

        if (typeof state.prefillDailyCount === 'number' && Number.isFinite(state.prefillDailyCount)) {
            setDailyCount(Math.min(200, Math.max(1, Math.round(state.prefillDailyCount))));
        }
    }, [location.state]);

    const handleCreate = async () => {
        const normalizedTitle = title.trim();
        const text = submitText;
        if (!normalizedTitle) {
            showToast(t('vocab.customMemory.toastNameEmpty'), 'error');
            return;
        }
        if (!Number.isInteger(dailyCount) || dailyCount < 1 || dailyCount > 200) {
            showToast(t('vocab.customMemory.toastDailyRange'), 'error');
            return;
        }
        if (!text) {
            showToast(t('vocab.customMemory.toastTextEmpty'), 'error');
            return;
        }

        setCreating(true);
        try {
            if (targetDeckId !== null) {
                const { cards_added } = await appendCustomDeck(targetDeckId, text);
                showToast(t('vocab.customMemory.toastAddSuccess').replace('{n}', String(cards_added)), 'success');
                navigate('/vocabulary/plans', { replace: true });
                return;
            }

            const { deck, cards } = await createCustomDeck(normalizedTitle, text, dailyCount);
            if (!cards.length) {
                showToast(t('vocab.customMemory.toastAllDone'), 'success');
                return;
            }
            navigate('/vocabulary/custom-cards/study', {
                state: {
                    deckId: deck.id,
                    deckTitle: deck.title,
                    dailyCount: deck.daily_count,
                    cards,
                },
            });
        } catch (e: unknown) {
            const msg = (e as any)?.response?.data?.error || t('vocab.customMemory.toastCreateFail'); // eslint-disable-line @typescript-eslint/no-explicit-any
            showToast(msg, 'error');
        } finally {
            setCreating(false);
        }
    };

    return (
        <Layout
    pageTitle={targetDeckId !== null ? t('vocab.customMemory.addPageTitle') : t('vocab.customMemory.defaultTitle')}
    pageSubtitle={targetDeckId !== null ? t('vocab.customMemory.addPageSubtitle') : t('vocab.customMemory.createPageSubtitle')}
    backUrl='/vocabulary/plans'
    backText={t('vocab.customMemory.backToVocab')}
>
            <div className="config-page-wrap cm-create-wrap">
                <div className="config-card">
                    <h3>{t('vocab.customMemory.planNameHeading')}</h3>
                    <input
                        className="cm-input"
                        type="text"
                        value={title}
                        maxLength={100}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t('vocab.customMemory.planNamePlaceholder')}
                        disabled={targetDeckId !== null}
                    />
                </div>

                <div className="config-card">
                    <h3>{t('vocab.customMemory.dailyCountHeading')}</h3>
                    <input
                        className="cm-input"
                        type="number"
                        min={1}
                        max={200}
                        value={dailyCount}
                        onChange={(e) => setDailyCount(Number(e.target.value))}
                        disabled={targetDeckId !== null}
                    />
                </div>

                <div className="config-card">
                    <h3>{t('vocab.customMemory.inputTextHeading')}</h3>
                    <label className="cm-check-row">
                        <input
                            type="checkbox"
                            checked={batchByLine}
                            onChange={(e) => setBatchByLine(e.target.checked)}
                        />
                        <span>{t('vocab.customMemory.autoBatchHint')}</span>
                    </label>
                    <div className="cm-dual-grid">
                        <div>
                            <div className="cm-field-title">{t('vocab.customMemory.frontLabel')}</div>
                            <textarea
                                className="cm-textarea cm-textarea-short"
                                value={frontText}
                                onChange={(e) => setFrontText(e.target.value)}
                                placeholder={batchByLine
                                    ? [
                                        t('vocab.customMemory.frontMultiHint'),
                                        t('vocab.customMemory.frontExamples'),
                                    ].join('\n')
                                    : t('vocab.customMemory.frontSingleHint')}
                            />
                        </div>

                        <div>
                            <div className="cm-field-title">{t('vocab.customMemory.backLabel')}</div>
                            <textarea
                                className="cm-textarea cm-textarea-short"
                                value={backText}
                                onChange={(e) => setBackText(e.target.value)}
                                placeholder={batchByLine
                                    ? [
                                        t('vocab.customMemory.backMultiHint'),
                                        t('vocab.customMemory.backExamples'),
                                    ].join('\n')
                                    : t('vocab.customMemory.backSingleHint')}
                            />
                        </div>
                    </div>

                    <textarea
                        className="cm-hidden-textarea"
                        readOnly
                        value={submitText}
                        aria-hidden="true"
                        tabIndex={-1}
                    />
                    <p className="cm-hint">
                        {t('vocab.customMemory.estimatePreamble').replace('{n}', String(estimatedCount))}
                    </p>
                </div>

                <div className="config-card">
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        disabled={creating}
                        onClick={handleCreate}
                    >
                        {targetDeckId !== null
                            ? (creating ? t('vocab.customMemory.addingBtn') : t('vocab.customMemory.addToDeckBtn'))
                            : (creating ? t('vocab.customMemory.creatingBtn') : t('vocab.customMemory.startBtn'))}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
