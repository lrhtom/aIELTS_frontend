import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/Toast';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/writing_ai_teacher.css';

const EXAMPLE_TOPICS = [
    'Some people think that governments should spend more money on public services rather than on the arts. To what extent do you agree or disagree?',
    'Some people believe that remote work greatly improves individual productivity. Do the advantages outweigh the disadvantages?',
    'Some people think that university education should be free for everyone. Discuss both views and give your opinion.',
];

export default function AiTeacherGenPage() {
    const { t } = useLang();
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [viewpoint, setViewpoint] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');

    const handleSubmit = () => {
        const trimmed = topic.trim();
        if (!trimmed) {
            showToast(t('writingAiTeacher.errorTopic'), 'error');
            return;
        }
        setSubmitting(true);
        sessionStorage.removeItem('aiTeacherLesson');
        // 题目同时写进 query：location.state 刷新即丢，带上它讲解页才刷得动
        navigate(`/writing/ai-teacher/lesson?topic=${encodeURIComponent(trimmed)}`, {
            state: {
                topic: trimmed,
                viewpointEnabled: advancedOpen,
                viewpoint,
                customInstructions: customInstructions.trim()
            }
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSubmit();
        }
    };

    return (
        <Layout
            pageTitle={t('writingAiTeacher.genTitle')}
            pageSubtitle={t('writingAiTeacher.genSubtitle')}
            backUrl="/writing/ai-teachers"
            backText={t('writingHub.backToPractice')}
            headerRight={<AiModelSelector variant="minimal" label="" description="" />}
        >
            <div className="at-gen-wrap">
                <div className="at-gen-card">
                    <h2>{t('writingAiTeacher.genTitle')}</h2>
                    <p>{t('writingAiTeacher.genSubtitle')}</p>

                    <textarea
                        className="at-gen-textarea"
                        placeholder={t('writingAiTeacher.genPlaceholder')}
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        maxLength={2000}
                    />

                    <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
                        <div 
                            className="at-gen-advanced-toggle"
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                        >
                            <span>{advancedOpen ? '▼' : '▶'}</span>
                            {t('writingAiTeacher.advancedSettings.title')}
                        </div>

                        {advancedOpen && (
                            <div className="at-gen-advanced-panel">
                                <div>
                                    <div className="at-gen-advanced-label">{t('writingAiTeacher.advancedSettings.viewpointLabel')}</div>
                                    <div className="at-gen-radio-group">
                                        <label className={`at-gen-radio-label ${viewpoint === '' ? 'is-active' : ''}`}>
                                            <input type="radio" name="vp" checked={viewpoint === ''} onChange={() => setViewpoint('')} />
                                            {t('writingAiTeacher.advancedSettings.viewpointOptions.none')}
                                        </label>
                                        <label className={`at-gen-radio-label ${viewpoint === 'positive' ? 'is-active' : ''}`}>
                                            <input type="radio" name="vp" checked={viewpoint === 'positive'} onChange={() => setViewpoint('positive')} />
                                            {t('writingAiTeacher.advancedSettings.viewpointOptions.positive')}
                                        </label>
                                        <label className={`at-gen-radio-label ${viewpoint === 'negative' ? 'is-active' : ''}`}>
                                            <input type="radio" name="vp" checked={viewpoint === 'negative'} onChange={() => setViewpoint('negative')} />
                                            {t('writingAiTeacher.advancedSettings.viewpointOptions.negative')}
                                        </label>
                                        <label className={`at-gen-radio-label ${viewpoint === 'both' ? 'is-active' : ''}`}>
                                            <input type="radio" name="vp" checked={viewpoint === 'both'} onChange={() => setViewpoint('both')} />
                                            {t('writingAiTeacher.advancedSettings.viewpointOptions.both')}
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <div className="at-gen-advanced-label">{t('writingAiTeacher.advancedSettings.instructionsLabel')}</div>
                                    <textarea
                                        className="at-gen-textarea"
                                        style={{ minHeight: '80px', height: '80px' }}
                                        placeholder={t('writingAiTeacher.advancedSettings.instructionsPlaceholder')}
                                        value={customInstructions}
                                        onChange={e => setCustomInstructions(e.target.value)}
                                        maxLength={500}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        className="at-gen-btn"
                        onClick={handleSubmit}
                        disabled={submitting || !topic.trim()}
                    >
                        {t('writingAiTeacher.genBtn')}
                    </button>

                    <div className="at-gen-examples">
                        <div className="at-gen-examples-label">Quick examples:</div>
                        {EXAMPLE_TOPICS.map((example, i) => (
                            <button
                                key={i}
                                className="at-gen-example-chip"
                                onClick={() => setTopic(example)}
                            >
                                {example}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
