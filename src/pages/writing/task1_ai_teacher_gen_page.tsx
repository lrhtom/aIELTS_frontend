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
    const { lang, translations: t } = useLang();
    const navigate = useNavigate();
    const [topic, setTopic] = useState('');
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast(lang === 'zh' ? '只能上传图片文件！' : 'Only image files are allowed!', 'error');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast(lang === 'zh' ? '图片大小不能超过5MB！' : 'Image size cannot exceed 5MB!', 'error');
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
            showToast(t.writingAiTeacher.errorTopic, 'error');
            return;
        }
        setSubmitting(true);
        sessionStorage.removeItem('task1AiTeacherLesson');
        navigate('/writing/task1-ai-teacher/lesson', { state: { topic: trimmed, image: imageBase64 } });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSubmit();
        }
    };

    return (
        <Layout
            pageTitle={lang === 'zh' ? '小作文 AI 老师' : 'Task 1 AI Teacher'}
            pageSubtitle={lang === 'zh' ? '极速图表分析与段落结构指导' : 'Fast chart analysis and structure guide'}
            backUrl="/writing"
            backText={t.writingHub.backToPractice}
            headerRight={<AiModelSelector variant="minimal" label="" description="" />}
        >
            <div className="at-gen-wrap">
                <div className="at-gen-card">
                    <h2>{lang === 'zh' ? '输入小作文题目' : 'Enter Task 1 Topic'}</h2>
                    <p>{lang === 'zh' ? '您可以附上图表截图，AI 老师会自动识别图表数据。' : 'You can attach a screenshot of the chart, and the AI Teacher will recognize the data.'}</p>

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
                                {lang === 'zh' ? '点击或拖拽上传图表截图 (选填)' : 'Click or drag to upload chart image (Optional)'}
                            </div>
                        )}
                    </div>

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
