import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getInitialVocabInput } from '../../store/word_selection_store';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/practice_page.css';
import '../../styles/listening_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

export default function ListeningConfig() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState(() => getInitialVocabInput());
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [wordCountMin, setWordCountMin] = useState(1);
    const [wordCountMax, setWordCountMax] = useState(2);
    const [practiceType, setPracticeType] = useState<'article' | 'sentence' | 'multiple_choice'>('article');
    const [absurdMode, setAbsurdMode] = useState(false);

    const { lang } = useLang();
    const t = translations[lang].listeningConfig;

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
        localStorage.setItem('ielts_target_vocab', val);
    };

    const handleMinChange = (val: number) => {
        setWordCountMin(val);
        if (val > wordCountMax) setWordCountMax(val);
    };

    const handleMaxChange = (val: number) => {
        setWordCountMax(val);
        if (val < wordCountMin) setWordCountMin(val);
    };

    const handleStart = () => {
        if (useCustomVocab && !vocabInput.trim()) {
            showToast(t.toast.noVocab, 'error');
            return;
        }
        sessionStorage.removeItem('listening_session_cache');
        navigate('/listening', {
            state: {
                vocabInput: useCustomVocab ? vocabInput : '',
                difficulty,
                useCustomVocab,
                wordCountMin,
                wordCountMax,
                practiceType,
                absurdMode,
            },
        });
    };

    return (
        <Layout>
            <div className="config-page-wrap listening-config">
                <div className="practice-header">
                    <Link to="/practice/ai" className="back-link">{t.backToAI}</Link>
                    <h1>{t.heading}</h1>
                    <p>{t.subheading}</p>
                </div>

                {/* AI Model Selector */}
                <div className="config-card">
                    <AiModelSelector />
                </div>

                {/* Practice Type */}
                <div className="config-card">
                    <h3>{t.practiceType.label}</h3>
                    <div className="practice-type-cards">
                        <button
                            className={`practice-type-card ${practiceType === 'article' ? 'selected' : ''}`}
                            onClick={() => setPracticeType('article')}
                        >
                            <span className="pt-icon">📄</span>
                            <div className="pt-text">
                                <div className="pt-title">{t.practiceType.article.title}</div>
                                <div className="pt-desc">{t.practiceType.article.desc}</div>
                            </div>
                        </button>
                        <button
                            className={`practice-type-card ${practiceType === 'sentence' ? 'selected' : ''}`}
                            onClick={() => setPracticeType('sentence')}
                        >
                            <span className="pt-icon">✏️</span>
                            <div className="pt-text">
                                <div className="pt-title">{t.practiceType.sentence.title}</div>
                                <div className="pt-desc">{t.practiceType.sentence.desc}</div>
                            </div>
                        </button>
                        <button
                            className={`practice-type-card ${practiceType === 'multiple_choice' ? 'selected' : ''}`}
                            onClick={() => setPracticeType('multiple_choice')}
                        >
                            <span className="pt-icon">🎯</span>
                            <div className="pt-text">
                                <div className="pt-title">{t.practiceType.multipleChoice.title}</div>
                                <div className="pt-desc">{t.practiceType.multipleChoice.desc}</div>
                            </div>
                        </button>
                    </div>
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

                {/* Word Count Range (仅在非选择题模式下显示) */}
                {practiceType !== 'multiple_choice' && (
                    <div className="config-card">
                        <h3>{t.wordCount.label}</h3>
                        <div className="wc-dual-sliders">
                            {/* Min slider */}
                            <div className="wc-slider-row">
                                <span className="wc-slider-label">{t.wordCount.min}</span>
                                <div className="wc-slider-track-wrap">
                                    <input
                                        type="range"
                                        className="wc-single-range"
                                        min={1} max={3} step={1}
                                        value={wordCountMin}
                                        style={{ '--pct': `${((wordCountMin - 1) / 2) * 100}%` } as React.CSSProperties}
                                        onChange={e => handleMinChange(Number(e.target.value))}
                                    />
                                    <div className="wc-ticks">
                                        {[1, 2, 3].map(n => (
                                            <span key={n} className={`wc-tick${n <= wordCountMin ? ' active' : ''}`}>{n}</span>
                                        ))}
                                    </div>
                                </div>
                                <span className="wc-val-badge">{wordCountMin}</span>
                            </div>
                            {/* Max slider */}
                            <div className="wc-slider-row">
                                <span className="wc-slider-label">{t.wordCount.max}</span>
                                <div className="wc-slider-track-wrap">
                                    <input
                                        type="range"
                                        className="wc-single-range"
                                        min={1} max={3} step={1}
                                        value={wordCountMax}
                                        style={{ '--pct': `${((wordCountMax - 1) / 2) * 100}%` } as React.CSSProperties}
                                        onChange={e => handleMaxChange(Number(e.target.value))}
                                    />
                                    <div className="wc-ticks">
                                        {[1, 2, 3].map(n => (
                                            <span key={n} className={`wc-tick${n <= wordCountMax ? ' active' : ''}`}>{n}</span>
                                        ))}
                                    </div>
                                </div>
                                <span className="wc-val-badge">{wordCountMax}</span>
                            </div>
                        </div>
                        <p className="wc-hint">
                            {wordCountMin === wordCountMax
                                ? t.wordCount.hintExact.replace('{n}', String(wordCountMin))
                                : t.wordCount.hintRange.replace('{min}', String(wordCountMin)).replace('{max}', String(wordCountMax))}
                        </p>
                    </div>
                )}

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

                {/* Absurd Mode Toggle */}
                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">{t.absurdMode.label}</div>
                            <div className="label-desc">{t.absurdMode.desc}</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={absurdMode}
                                onChange={(e) => setAbsurdMode(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                        </label>
                    </div>
                </div>

                {/* Start Button */}
                <div className="config-card">
                    <button className="skill-btn listening" style={{ width: '100%' }} onClick={handleStart}>
                        <span className="btn-icon">🎧</span> {t.startBtn}
                    </button>
                </div>
            </div>
        </Layout>
    );
}
