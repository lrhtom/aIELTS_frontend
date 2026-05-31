import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/Toast';
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

    const handleSubmit = () => {
        const trimmed = topic.trim();
        if (!trimmed) {
            showToast(t.writingAiTeacher.errorTopic, 'error');
            return;
        }
        setSubmitting(true);
        sessionStorage.removeItem('aiTeacherLesson');
        navigate('/writing/ai-teacher/lesson', { state: { topic: trimmed } });
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
            backUrl="/writing"
            backText={t.writingHub.backToPractice}
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
