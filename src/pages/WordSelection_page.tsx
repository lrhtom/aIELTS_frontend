import Layout from '../components/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { showToast } from '../components/Toast';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import VocabInput from '../components/VocabInput';
import AiModelSelector from '../components/AiModelSelector';
import '../styles/practice_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

export default function WordSelection_page() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState(() => localStorage.getItem('ielts_target_vocab') || '');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');

    const { lang } = useLang();
    const t = translations[lang].readingConfig;

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
        localStorage.setItem('ielts_target_vocab', val);
    };

    const handleStart = () => {
        if (useCustomVocab && !vocabInput.trim()) {
            showToast(t.toast.noVocab, 'error');
            return;
        }
        sessionStorage.removeItem('reading_session_cache');
        navigate('/reading', {
            state: {
                vocabInput: useCustomVocab ? vocabInput : '',
                difficulty,
                useCustomVocab,
            },
        });
    };

    return (
        <Layout>
            <div className=".*">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">{t.backToAI}</Link>
                    <h1>{t.heading}</h1>
                    <p>{t.subheading}</p>
                </div>

                {/* AI Model Selector */}
                <div className="config-card">
                    <AiModelSelector />
                </div>

                {/* Difficulty */}
                <div className="config-card">
                    <h3>{t.targetScore}</h3>
                    <div className="difficulty-options">
                        {DIFFICULTIES.map(d => (
                            <button
                                key={d}
                                className={`difficulty-btn ${difficulty === d ? 'selected' : ''}`}
                                onClick={() => setDifficulty(d)}
                            >
                                Band {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Custom Vocab Toggle */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t.customVocab.label}</div>
                            <div className="label-desc">{t.customVocab.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={useCustomVocab}
                                onChange={(e) => setUseCustomVocab(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>

                    {useCustomVocab && (
                        <VocabInput
                            value={vocabInput}
                            onChange={handleVocabChange}
                        />
                    )}
                </div>

                {/* Start Button */}
                <div className="config-card">
                    <button className="skill-btn reading" style={{ width: '100%' }} onClick={handleStart}>
                        <span className="btn-icon">📖</span> {t.startBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}