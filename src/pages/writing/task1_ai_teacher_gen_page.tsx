import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/Toast';
import AiModelSelector from '../../components/common/AiModelSelector';
import '../../styles/writing_ai_teacher.css';

const EXAMPLE_TOPICS = [
    'The chart below shows the number of men and women in further education in Britain in three periods and whether they were studying full-time or part-time.',
    'The line graph below shows the changes in the amount and type of fast food consumed by Australian teenagers from 1975 to 2000.',
    'The maps below show the changes that took place in an Australian town called Burlot in 1990 and 2010.',
];

export default function Task1AiTeacherGenPage() {
    const { t } = useLang();
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast(t('writingAiTeacher.task1.imageOnlyError'), 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast(t('writingAiTeacher.task1.imageTooLargeError'), 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            setImageBase64(result);
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        handleFileChange(file);
    };

    const handleSubmit = () => {
        const trimmed = topic.trim();
        if (!trimmed) {
            showToast(t('writingAiTeacher.errorTopic'), 'error');
            return;
        }
        setSubmitting(true);
        sessionStorage.removeItem('task1AiTeacherLesson');
        // clicking twice generates two sets and burns double the AT for nothing
        navigate(`/writing/task1-ai-teacher/lesson?topic=${encodeURIComponent(trimmed)}`, {
            state: { topic: trimmed, image: imageBase64 },
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSubmit();
        }
    };

    return (
        <Layout
            pageTitle={t('writingAiTeacher.task1.pageTitle')}
            pageSubtitle={t('writingAiTeacher.task1.genSubtitle')}
            backUrl="/writing/ai-teachers"
            backText={t('writingHub.backToPractice')}
            headerRight={<AiModelSelector variant="minimal" label="" description="" />}
        >
            <div className="at-gen-wrap">
                <div className="at-gen-card">
                    <h2>{t('writingAiTeacher.task1.genHeading')}</h2>
                    <p>{t('writingAiTeacher.task1.genDesc')}</p>

                    <div 
                        className="at-image-upload-area"
                        style={{
                            border: '2px dashed var(--color-border)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            textAlign: 'center',
                            marginBottom: '1rem',
                            cursor: 'pointer',
                            background: imageBase64 ? 'var(--color-surface)' : 'transparent',
                            position: 'relative'
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                    >
                        <input 
                            type="file" 
                            accept="image/*" 
                            hidden 
                            ref={fileInputRef} 
                            onChange={(e) => handleFileChange(e.target.files?.[0] || null)} 
                        />
                        {imageBase64 ? (
                            <div style={{ position: 'relative' }}>
                                <img src={imageBase64} alt="Uploaded chart" style={{ maxHeight: '200px', maxWidth: '100%', borderRadius: '8px' }} />
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setImageBase64(null); }}
                                    style={{
                                        position: 'absolute', top: '-10px', right: '-10px',
                                        background: 'red', color: 'white', border: 'none', borderRadius: '50%',
                                        width: '24px', height: '24px', cursor: 'pointer'
                                    }}
                                >&times;</button>
                            </div>
                        ) : (
                            <div style={{ color: 'var(--color-text-secondary)' }}>
                                {t('writingAiTeacher.task1.imageUploadHint')}
                            </div>
                        )}
                    </div>

                    <textarea
                        className="at-gen-textarea"
                        placeholder={t('writingAiTeacher.genPlaceholder')}
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
                        {t('writingAiTeacher.genBtn')}
                    </button>

                    <div className="at-gen-examples">
                        <div className="at-gen-examples-label">{t('writingAiTeacher.lesson.quickExamples')}</div>
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
