import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import VocabInput from '../../components/VocabInput';
import AiModelSelector from '../../components/common/AiModelSelector';
import { listPlans, getPlanDetail, type LearningPlan } from '../../api/learning_plan';
import '../../styles/practice_page.css';
import '../../styles/listening_page.css';

const DIFFICULTIES = ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'];

export default function ListeningConfig() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState('');
    const [useCustomVocab, setUseCustomVocab] = useState(true);
    const [difficulty, setDifficulty] = useState('7.0');
    const [wordCountMin, setWordCountMin] = useState(1);
    const [wordCountMax, setWordCountMax] = useState(2);
    const [practiceType, setPracticeType] = useState<'article' | 'sentence' | 'multiple_choice' | 'map'>('article');
    const [absurdMode, setAbsurdMode] = useState(false);
    const [plans, setPlans] = useState<LearningPlan[]>([]);
    const [importPlanId, setImportPlanId] = useState(0);
    const [importingPlan, setImportingPlan] = useState(false);

    const { lang } = useLang();
    const t = translations[lang].listeningConfig;
    useEffect(() => {
        listPlans().then(({ plans: ps }) => {
            setPlans(ps);
            if (ps.length > 0) setImportPlanId(ps[0].id);
        }).catch(() => {});
    }, []);

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const handleImportPlan = async () => {
        if (!importPlanId) return;
        setImportingPlan(true);
        try {
            // 调用计划详情接口，获取后端 FSRS 精确计算的今日词汇队列
            const { plan: detail } = await getPlanDetail(importPlanId);
            const todayWords = detail.today_words || [];
            if (todayWords.length === 0) {
                showToast('该计划今日暂无待学单词', 'error');
                return;
            }
            // 过滤掉中文释义为空的单词（VocabInput 要求每行必须包含中文）
            const validWords = todayWords.filter(w => w.zh && w.zh.trim());
            const skipped = todayWords.length - validWords.length;
            const lines = validWords.map(w => `${w.word} - ${w.zh}`).join('\n');
            handleVocabChange(lines);
            if (skipped > 0) {
                showToast(`已导入 ${validWords.length} 个单词，${skipped} 个因缺少中文释义被跳过`, 'error');
            } else {
                showToast(`已导入 ${validWords.length} 个单词`, 'success');
            }
        } catch {
            showToast('导入失败', 'error');
        } finally {
            setImportingPlan(false);
        }
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
        <Layout
    pageTitle={t.heading}
    pageSubtitle={t.subheading}
    backUrl='/practice/ai'
    backText={t.backToAI}
>
            <div className="config-page-wrap listening-config bento-page-wrap">
                <div className="reading-config-bento">
                    {/* ── 左侧列：核心词汇区 ── */}
                    <div className="bento-col-left">
                        <div className="config-card bento-card-glass vocab-card">
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
                                <div className="vocab-content-wrap">
                                    {plans.length > 0 && (
                                        <div className="plan-import-row">
                                            <select
                                                className="plan-import-select"
                                                value={importPlanId}
                                                onChange={e => setImportPlanId(Number(e.target.value))}
                                            >
                                                {plans.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                            <button
                                                className="plan-import-btn"
                                                onClick={handleImportPlan}
                                                disabled={importingPlan}
                                            >
                                                {importingPlan ? '导入中…' : '⬇ 导入今日单词'}
                                            </button>
                                        </div>
                                    )}
                                    <div className="vocab-textarea-container">
                                        <VocabInput
                                            value={vocabInput}
                                            onChange={handleVocabChange}
                                            className="h-full"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── 右侧列：设置控制区 ── */}
                    <div className="bento-col-right">
                        {/* AI Model Selector */}
                        <div className="config-card bento-card-glass">
                            <h3>AI 模型 🧠</h3>
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>选择后台出题和批改所使用的引擎</div>
                            <AiModelSelector label="" description="" />
                        </div>

                        {/* Practice Type */}
                        <div className="config-card bento-card-glass">
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
                                <button
                                    className={`practice-type-card ${practiceType === 'map' ? 'selected' : ''}`}
                                    onClick={() => setPracticeType('map')}
                                >
                                    <span className="pt-icon">🗺️</span>
                                    <div className="pt-text">
                                        <div className="pt-title">{t.practiceType.mapLabelling.title}</div>
                                        <div className="pt-desc">{t.practiceType.mapLabelling.desc}</div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className="config-card bento-card-glass">
                            <h3>{t.targetScore}</h3>
                            <div className="difficulty-options">
                                {DIFFICULTIES.map(d => (
                                    <button
                                        key={d}
                                        className={`difficulty-btn ${difficulty === d ? 'selected' : ''}`}
                                        onClick={() => setDifficulty(d)}
                                    >
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Word Count Range */}
                        {practiceType !== 'multiple_choice' && practiceType !== 'map' && (
                            <div className="config-card bento-card-glass">
                                <h3>{t.wordCount.label}</h3>
                                <div className="wc-dual-sliders">
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

                        {/* Absurd Mode Toggle */}
                        <div className="config-card bento-card-glass">
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
                    </div>

                    {/* ── 底部栏：全宽按钮 ── */}
                    <div className="bento-bottom">
                        <button className="premium-start-btn" style={{ background: 'linear-gradient(135deg, #f97316, #f59e0b)', boxShadow: '0 8px 24px rgba(249, 115, 22, 0.3), inset 0 1px 0 rgba(255,255,255,0.2)' }} onClick={handleStart}>
                            <span className="btn-icon">🎧</span> {t.startBtn}
                        </button>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
