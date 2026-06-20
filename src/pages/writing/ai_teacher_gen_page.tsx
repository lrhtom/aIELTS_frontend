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
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [viewpoint, setViewpoint] = useState('');
    const [customInstructions, setCustomInstructions] = useState('');

    const handleSubmit = () => {
        const trimmed = topic.trim();
        if (!trimmed) {
            showToast(t.writingAiTeacher.errorTopic, 'error');
            return;
        }
        setSubmitting(true);
        sessionStorage.removeItem('aiTeacherLesson');
        navigate('/writing/ai-teacher/lesson', {
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
            pageTitle={t.writingAiTeacher.genTitle}
            pageSubtitle={t.writingAiTeacher.genSubtitle}
            backUrl="/writing/ai-teachers"
            backText={t.writingHub.backToPractice}
            headerRight={<AiModelSelector variant="minimal" label="" description="" />}
        >
            <div className="at-gen-wrap">
                <div className="at-gen-card">
                    <h2>{t.writingAiTeacher.genTitle}</h2>
                    <p>{t.writingAiTeacher.genSubtitle}</p>

                    <textarea
                        className="at-gen-textarea"
                        placeholder={t.writingAiTeacher.genPlaceholder}
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        maxLength={2000}
                    />

                    <div style={{ marginTop: 16, marginBottom: 16, textAlign: 'left' }}>
                        <div 
                            onClick={() => setAdvancedOpen(!advancedOpen)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-primary)', fontWeight: 600, userSelect: 'none' }}
                        >
                            <span>{advancedOpen ? '▼' : '▶'}</span>
                            高级设置 / 自定义要求 (可选)
                        </div>
                        
                        {advancedOpen && (
                            <div style={{ marginTop: 12, padding: 16, background: 'var(--color-surface-hover)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>文章立场偏好：</div>
                                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: 'var(--color-text)' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <input type="radio" name="vp" checked={viewpoint === ''} onChange={() => setViewpoint('')} /> 
                                            不指定 (AI决定)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <input type="radio" name="vp" checked={viewpoint === 'positive'} onChange={() => setViewpoint('positive')} /> 
                                            正面 (支持/利大于弊)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <input type="radio" name="vp" checked={viewpoint === 'negative'} onChange={() => setViewpoint('negative')} /> 
                                            反面 (反对/弊大于利)
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                                            <input type="radio" name="vp" checked={viewpoint === 'both'} onChange={() => setViewpoint('both')} /> 
                                            探讨双方 (中立/分情况)
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>额外写作指令：</div>
                                    <textarea 
                                        style={{ width: '100%', height: 80, padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 13, resize: 'none' }}
                                        placeholder="例如：多用被动语态、尽量使用 C1 级别词汇、举一个关于人工智能的具体例子..."
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
                        {t.writingAiTeacher.genBtn}
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
