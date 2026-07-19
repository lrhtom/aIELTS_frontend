import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { showToast } from '../../components/common/Toast';
import { type VocabMode } from '../../utils/vocab_training_utils';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

export default function VocabularyTrainingPage() {
    const { t } = useLang();
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState('');
    const [mode, setMode] = useState<VocabMode>('mcq');
    const [shuffleWordOrder, setShuffleWordOrder] = useState(true);

    const MODE_OPTIONS: Array<{ id: VocabMode; icon: string; title: string; desc: string }> = [
        { id: 'mcq', icon: '🧩', title: t('vocab.trainingConfig.modeChoice.title'), desc: t('vocab.trainingConfig.modeChoice.desc') },
        { id: 'dictation', icon: '🎧', title: t('vocab.trainingConfig.modeDictation.title'), desc: t('vocab.trainingConfig.modeDictation.desc') },
        { id: 'complete', icon: '✏️', title: t('vocab.trainingConfig.modeComplete.title'), desc: t('vocab.trainingConfig.modeComplete.desc') },
    ];

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const handleStart = () => {
        const validVocabInput = vocabInput.trim();
        if (!validVocabInput) {
            showToast(t('vocab.trainingConfig.toastEmpty'), 'error');
            return;
        }

        sessionStorage.removeItem(`vocab_doing_session_${mode}`);
        navigate(`/vocabulary/practice/${mode}/doing`, {
            state: {
                vocabInput: validVocabInput,
                mode,
                shuffleWordOrder,
            },
        });
    };

    return (
        <Layout
    pageTitle={t('vocab.trainingConfig.pageTitle')}
    pageSubtitle={t('vocab.trainingConfig.pageSubtitle')}
    backUrl='/vocabulary'
    backText={t('vocab.trainingConfig.backText')}
>
            <div className="config-page-wrap reading-config">
                <div className="config-card">
                    <h3>{t('vocab.trainingConfig.targetWordsHeading')}</h3>
                    <VocabInput
                        value={vocabInput}
                        onChange={handleVocabChange}
                    />
                </div>

                <div className="config-card">
                    <h3>{t('vocab.trainingConfig.modeChoiceHeading')}</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        {MODE_OPTIONS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMode(m.id)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: mode === m.id ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: mode === m.id ? 'rgba(13, 148, 136, 0.08)' : 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    cursor: 'pointer',
                                    boxShadow: mode === m.id ? '0 4px 16px rgba(13, 148, 136, 0.12)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '18px' }}>{m.icon}</span>
                                    <strong>{m.title}</strong>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{m.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t('vocab.trainingConfig.shuffleLabel')}</div>
                            <div className="label-desc">{t('vocab.trainingConfig.shuffleDesc')}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={shuffleWordOrder}
                                onChange={(e) => setShuffleWordOrder(e.target.checked)}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>

                <div className="config-card">
                    <button className="skill-btn reading" style={{ width: '100%' }} onClick={handleStart}>
                        {t('vocab.trainingConfig.startBtn')}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
