import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/Toast';
import { apiClient } from '../../api/client';
import '../../styles/writing_ai_teacher.css';

const SESSION_KEY = 'task1AiTeacherLesson';

// === Interfaces matching Task 1 AI Teacher backend JSON output ===
interface Task1LessonData {
    part1: {
        question_analysis: {
            chart_type_en: string; chart_type_zh: string;
            time_period_en: string; time_period_zh: string;
            main_trends_en: string[]; main_trends_zh: string[];
            correct_approach_en: string; correct_approach_zh: string;
            off_topic_en: string; off_topic_zh: string;
        };
        structure: {
            paragraphs: Array<{
                name_en: string; name_zh: string;
                purpose_en: string; purpose_zh: string;
                content_guide_en: string; content_guide_zh: string;
            }>;
            wrong_structure_en: string; wrong_structure_zh: string;
        };
    };
    part2: {
        intro_overview: {
            intro: { text_en: string; text_zh: string; bad_intro_en: string; bad_intro_zh: string };
            overview: { text_en: string; text_zh: string; bad_overview_en: string; bad_overview_zh: string };
        };
        body_paragraphs: {
            body1: any;
            body2: any;
        };
    };
    part3: {
        vocabulary: Array<{
            word: string; translation: string;
            usage_en: string; usage_zh: string;
        }>;
        full_essay: { essay_en: string; essay_zh: string; };
    };
}

function dataURLtoFile(dataurl: string, filename: string) {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
}

function BilingualBlock({ en, zh, label }: { en: string; zh: string; label?: string }) {
    return (
        <div className="at-bilingual-block">
            {label && <div className="at-bilingual-label">{label}</div>}
            <div className="at-text-en">{en}</div>
            <div className="at-text-zh">{zh}</div>
        </div>
    );
}

function SingleLangBlock({ en, zh }: { en: string; zh: string }) {
    const { lang } = useLang();
    return (
        <div className="at-lang-block" style={{ marginBottom: '0.5rem', lineHeight: 1.6 }}>
            {lang === 'zh' ? zh : en}
        </div>
    );
}

export default function Task1AiTeacherLessonPage() {
    const { lang, translations: t } = useLang();
    const location = useLocation();
    const navigate = useNavigate();

    const [topic] = useState<string>(() => {
        const s = sessionStorage.getItem(SESSION_KEY);
        if (s) return JSON.parse(s).topic;
        return location.state?.topic || '';
    });
    const [imageBase64] = useState<string | null>(() => {
        return location.state?.image || null;
    });

    const [data, setData] = useState<Task1LessonData | null>(() => {
        const s = sessionStorage.getItem(SESSION_KEY);
        return s ? JSON.parse(s).data : null;
    });

    const [state, setState] = useState<'loading' | 'ready' | 'error'>(data ? 'ready' : 'loading');
    const [errorMsg, setErrorMsg] = useState('');
    const [currentSection, setCurrentSection] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showTopic, setShowTopic] = useState(false);

    const contentRef = useRef<HTMLDivElement>(null);
    const allSectionsRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const sectionNames = lang === 'zh' ? [
        '1. 图表审题与核心趋势',
        '2. 行文结构指南',
        '3. 开头与概述段',
        '4. 主体段落数据对比',
        '5. 核心词汇与完整范文'
    ] : [
        '1. Question Analysis & Trends',
        '2. Structure Guide',
        '3. Intro & Overview',
        '4. Body Paragraphs (Data)',
        '5. Vocab & Full Essay'
    ];
    const totalSections = sectionNames.length;

    const fetchLesson = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setState('loading');
        setErrorMsg('');

        try {
            const formData = new FormData();
            formData.append('topic', topic);
            if (imageBase64) {
                const file = dataURLtoFile(imageBase64, 'chart.png');
                if (file) formData.append('image', file);
            }
            const res = await apiClient.post('/writing/task1-ai-teacher/generate', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const lessonData = res.data as Task1LessonData;
            setData(lessonData);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic, data: lessonData }));
            setState('ready');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string, reason?: string } } })?.response?.data?.error || 'Generation failed';
            if (msg === 'INVALID_TOPIC') {
                const reason = (e as { response?: { data?: { reason?: string } } })?.response?.data?.reason || '';
                showToast(lang === 'zh' ? '输入内容不合法！\n' + reason : 'Invalid topic!\n' + reason, 'error');
                navigate('/writing/task1-ai-teacher', { replace: true });
                return;
            }
            setErrorMsg(msg);
            setState('error');
        } finally {
            fetchingRef.current = false;
        }
    }, [topic, imageBase64, lang, navigate]);

    useEffect(() => {
        if (!data) {
            if (!topic) {
                navigate('/writing/task1-ai-teacher', { replace: true });
                return;
            }
            fetchLesson();
        }
    }, [data, topic, navigate, fetchLesson]);

    const goPrev = () => setCurrentSection(s => Math.max(0, s - 1));
    const goNext = () => setCurrentSection(s => Math.min(totalSections - 1, s + 1));

    const handleDownload = async () => {
        if (!allSectionsRef.current || isDownloading) return;
        setIsDownloading(true);
        try {
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(allSectionsRef.current, {
                backgroundColor: '#fafaf9',
                scale: 2,
                windowWidth: 1440,
                logging: false,
            });
            const link = document.createElement('a');
            link.download = `Task1-AI-Teacher-Lesson-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch {
            showToast('Download failed', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    // === Render Sections ===
    const renderSection0 = (d: Task1LessonData) => {
        const qa = d.part1.question_analysis;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                        <h3>{lang === 'zh' ? '图表核心要素' : 'Chart Core Elements'}</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Chart Type</div>
                                <strong><SingleLangBlock en={qa.chart_type_en} zh={qa.chart_type_zh} /></strong>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Time & Tense</div>
                                <strong><SingleLangBlock en={qa.time_period_en} zh={qa.time_period_zh} /></strong>
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Main Trends (Overview Focus)</div>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-primary-dark)' }}>
                                {qa.main_trends_en.map((_, i) => (
                                    <li key={i}><SingleLangBlock en={qa.main_trends_en[i]} zh={qa.main_trends_zh[i]} /></li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="at-split-side">
                    <div className="at-section-card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                        <h3>{lang === 'zh' ? '正确写作思路' : 'Correct Approach'}</h3>
                        <SingleLangBlock en={qa.correct_approach_en} zh={qa.correct_approach_zh} />
                    </div>
                    <div className="at-section-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                        <h3>{lang === 'zh' ? '常见扣分陷阱' : 'Common Pitfalls'}</h3>
                        <SingleLangBlock en={qa.off_topic_en} zh={qa.off_topic_zh} />
                    </div>
                </div>
            </div>
        );
    };

    const renderSection1 = (d: Task1LessonData) => {
        const struct = d.part1.structure;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-structure-grid">
                        {struct.paragraphs.map((p, i) => (
                            <div key={i} className="at-structure-card">
                                <div className="at-structure-header">
                                    <span className="at-structure-num">P{i + 1}</span>
                                    <span className="at-structure-title">{lang === 'zh' ? p.name_zh : p.name_en}</span>
                                </div>
                                <div className="at-structure-purpose">
                                    <strong>Goal:</strong> <SingleLangBlock en={p.purpose_en} zh={p.purpose_zh} />
                                </div>
                                <div className="at-structure-guide">
                                    <SingleLangBlock en={p.content_guide_en} zh={p.content_guide_zh} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="at-split-side">
                    <div className="at-section-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                        <h3>{lang === 'zh' ? '错误结构示例' : 'Wrong Structure Example'}</h3>
                        <SingleLangBlock en={struct.wrong_structure_en} zh={struct.wrong_structure_zh} />
                    </div>
                </div>
            </div>
        );
    };

    const renderSection2 = (d: Task1LessonData) => {
        const io = d.part2.intro_overview;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>1. Introduction (引言段)</h3>
                        <BilingualBlock en={io.intro.text_en} zh={io.intro.text_zh} label="Paraphrase" />
                    </div>
                    <div className="at-section-card">
                        <h3>2. Overview (概述段)</h3>
                        <BilingualBlock en={io.overview.text_en} zh={io.overview.text_zh} label="Main Features" />
                    </div>
                </div>
                <div className="at-split-side">
                    <div className="at-section-card" style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
                        <h3>{lang === 'zh' ? '常见错误写法' : 'Common Mistakes'}</h3>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>[Intro Mistake]</div>
                            <SingleLangBlock en={io.intro.bad_intro_en} zh={io.intro.bad_intro_zh} />
                        </div>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold' }}>[Overview Mistake]</div>
                            <SingleLangBlock en={io.overview.bad_overview_en} zh={io.overview.bad_overview_zh} />
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderBody = (body: any, title: string) => {
        if (!body || !body.sentences) return null;
        return (
            <div className="at-section-card">
                <h3>{title} <span style={{fontSize:'0.9rem', color:'var(--color-text-secondary)', fontWeight:'normal'}}>({lang === 'zh' ? body.focus_zh : body.focus_en})</span></h3>
                <div className="wpt-sentence-flow">
                    {body.sentences.map((s: any, idx: number) => (
                        <div key={idx} className="wpt-sentence-block">
                            <BilingualBlock en={s.text_en} zh={s.text_zh} />
                            <div style={{ fontSize: '0.85rem', color: '#8b5cf6', marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid #c4b5fd' }}>
                                💡 <SingleLangBlock en={s.grammar_point_en} zh={s.grammar_point_zh} />
                            </div>
                        </div>
                    ))}
                </div>
                {body.bad_examples && body.bad_examples.length > 0 && (
                    <div className="wpt-bad-examples-list" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 'bold', marginBottom: '0.5rem' }}>[Common Mistakes in Data Description]</div>
                        {body.bad_examples.map((bad: any, idx: number) => (
                            <div key={idx} className="wpt-bad-example-item" style={{ background: '#fef2f2', padding: '0.75rem', borderRadius: '6px', fontSize: '0.9rem' }}>
                                <strong style={{ color: '#dc2626' }}>{bad.type}:</strong> {lang === 'zh' ? bad.zh : bad.en}
                                <div style={{ color: '#991b1b', marginTop: '4px', fontSize: '0.85rem' }}>{bad.reason}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderSection3 = (d: Task1LessonData) => {
        return (
            <div className="at-split-layout">
                <div className="at-split-main" style={{ width: '100%' }}>
                    {renderBody(d.part2.body_paragraphs.body1, 'Body Paragraph 1')}
                    {renderBody(d.part2.body_paragraphs.body2, 'Body Paragraph 2')}
                </div>
            </div>
        );
    };

    const renderSection4 = (d: Task1LessonData) => {
        const p3 = d.part3;
        return (
            <div className="at-split-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{lang === 'zh' ? '高分词汇与搭配 (Vocabulary)' : 'High-Scoring Vocabulary'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {p3.vocabulary.map((v, i) => (
                                <div key={i} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '3px solid #3b82f6' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>{v.word}</strong>
                                        <span style={{ color: '#64748b' }}>{v.translation}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                                        <SingleLangBlock en={v.usage_en} zh={v.usage_zh} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="at-split-side" style={{ width: '100%', borderLeft: 'none', paddingLeft: 0 }}>
                    <div className="at-section-card" style={{ background: '#f8fafc', height: '100%' }}>
                        <h3>{lang === 'zh' ? '完整高分范文 (Full Essay)' : 'Full Band 8.0 Essay'}</h3>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '1.05rem', color: '#1e293b' }}>
                            {p3.full_essay.essay_en}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.95rem', color: '#64748b', marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                            {p3.full_essay.essay_zh}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderCurrentSection = () => {
        if (!data) return null;
        switch (currentSection) {
            case 0: return renderSection0(data);
            case 1: return renderSection1(data);
            case 2: return renderSection2(data);
            case 3: return renderSection3(data);
            case 4: return renderSection4(data);
            default: return null;
        }
    };

    if (state === 'loading') {
        return (
            <Layout
                pageTitle={lang === 'zh' ? '小作文 AI 老师' : 'Task 1 AI Teacher'}
                backUrl="/writing/task1-ai-teacher"
                backText="Back"
            >
                <div className="at-loading-wrap">
                    <div className="at-loading-spinner" />
                    <div className="at-loading-title">{lang === 'zh' ? 'AI 考官正在分析图表数据并撰写指导...' : 'AI Examiner is analyzing the chart...'}</div>
                </div>
            </Layout>
        );
    }

    if (state === 'error') {
        return (
            <Layout
                pageTitle={lang === 'zh' ? '小作文 AI 老师' : 'Task 1 AI Teacher'}
                backUrl="/writing/task1-ai-teacher"
                backText="Back"
            >
                <div className="at-error-wrap">
                    <div className="at-error-msg">{errorMsg}</div>
                    <button className="at-error-retry" onClick={fetchLesson}>Retry</button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout
            pageTitle={lang === 'zh' ? '小作文 AI 老师' : 'Task 1 AI Teacher'}
            backUrl="/writing/task1-ai-teacher"
            backText="Back"
        >
            <div className="at-lesson-wrap">
                <div className="at-section-nav">
                    <button className="at-nav-btn" onClick={goPrev} disabled={currentSection === 0}>
                        <span className="at-nav-arrow">&#8249;</span> {t.writingAiTeacher.prev}
                    </button>
                    <div className="at-nav-info">
                        <div className="at-nav-title">{sectionNames[currentSection]}</div>
                        <div className="at-nav-index">{currentSection + 1} / {totalSections}</div>
                    </div>
                    <button className="at-nav-btn" onClick={goNext} disabled={currentSection === totalSections - 1}>
                        {t.writingAiTeacher.next} <span className="at-nav-arrow">&#8250;</span>
                    </button>
                    <button className="at-topic-btn" onClick={() => setShowTopic(true)}>
                        {lang === 'zh' ? '查看题目' : 'View Topic'}
                    </button>
                    <button className="at-download-btn" onClick={handleDownload} disabled={isDownloading}>
                        {isDownloading ? '...' : t.writingAiTeacher.download}
                    </button>
                </div>

                <div ref={contentRef}>
                    {renderCurrentSection()}
                </div>

                {/* Hidden container for rendering the full long image */}
                {data && (
                    <div
                        style={{
                            position: 'absolute', left: '-9999px', top: 0, width: '1200px',
                            background: '#fafaf9', padding: '3rem', display: 'flex',
                            flexDirection: 'column', gap: '2rem', zIndex: -1
                        }}
                        ref={allSectionsRef}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '2rem' }}>
                            <h1 style={{ fontSize: '2.5rem', color: '#1e293b', margin: '0 0 1rem 0' }}>{lang === 'zh' ? '小作文 AI 老师' : 'Task 1 AI Teacher'}</h1>
                            <div style={{ color: '#475569', fontSize: '1.2rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'inline-block', maxWidth: '800px', lineHeight: '1.6' }}>
                                <strong style={{color: '#3b82f6'}}>Topic:</strong> {topic}
                            </div>
                            {imageBase64 && (
                                <div style={{ marginTop: '1rem' }}>
                                    <img src={imageBase64} alt="Chart" style={{ maxHeight: '300px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                </div>
                            )}
                        </div>
                        {renderSection0(data)}
                        {renderSection1(data)}
                        {renderSection2(data)}
                        {renderSection3(data)}
                        {renderSection4(data)}
                        
                        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                            Generated by AI IELTS Teacher
                        </div>
                    </div>
                )}

                <div className="at-section-nav">
                    <button className="at-nav-btn" onClick={goPrev} disabled={currentSection === 0}>
                        <span className="at-nav-arrow">&#8249;</span> {t.writingAiTeacher.prev}
                    </button>
                    <div className="at-nav-info">
                        <div className="at-nav-index">{currentSection + 1} / {totalSections}</div>
                    </div>
                    <button className="at-nav-btn" onClick={goNext} disabled={currentSection === totalSections - 1}>
                        {t.writingAiTeacher.next} <span className="at-nav-arrow">&#8250;</span>
                    </button>
                </div>
            </div>

            {/* Topic Modal */}
            {showTopic && (
                <div className="at-topic-modal-overlay" onClick={() => setShowTopic(false)}>
                    <div className="at-topic-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="at-topic-modal-header">
                            <h3>{lang === 'zh' ? '图表题目' : 'Chart Topic'}</h3>
                            <button className="at-topic-modal-close" onClick={() => setShowTopic(false)}>&times;</button>
                        </div>
                        <div className="at-topic-modal-body">
                            {topic}
                            {imageBase64 && (
                                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                                    <img src={imageBase64} alt="Chart" style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
