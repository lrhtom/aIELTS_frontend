import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { apiClient, fetchStream } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import BadExampleList, { type BadExample } from '../../components/writing/BadExampleList';
import ReactMarkdown from 'react-markdown';
import '../../styles/writing_ai_teacher.css';

/* ── Bilingual interfaces ── */



interface LessonData {
    part1: Part1Data;
    part2: Part2Data;
    part3: Part3Data;
}

interface Part1Data {
    question_analysis: {
        topic_type_en: string;
        topic_type_zh: string;
        focus_points_en: string[];
        focus_points_zh: string[];
        correct_approach_en: string;
        correct_approach_zh: string;
        off_topic_en: string;
        off_topic_zh: string;
    };
    structure: {
        paragraphs: Array<{
            name_en: string;
            name_zh: string;
            purpose_en: string;
            purpose_zh: string;
            content_guide_en: string;
            content_guide_zh: string;
        }>;
        wrong_structure_en: string;
        wrong_structure_zh: string;
    };
}

interface Part2Data {
    opening: {
        sentences: Array<{
            purpose_en: string;
            purpose_zh: string;
            text_en: string;
            text_zh: string;
        }>;
        bad_examples: BadExample[];
    };
    arguments: {
        body1: BilingualArg;
        body2: BilingualArg;
    };
    closing: {
        sentences: Array<{
            purpose_en: string;
            purpose_zh: string;
            text_en: string;
            text_zh: string;
        }>;
        bad_closing_en: string;
        bad_closing_zh: string;
    };
}

interface BilingualArg {
    main_idea_en: string;
    main_idea_zh: string;
    explanation_en: string;
    explanation_zh: string;
    explanation_steps?: Array<{
        step_name: string;
        en: string;
        zh: string;
    }>;
    example_en: string;
    example_zh: string;
    bad_examples: BadExample[];
}

interface Part3Data {
    full_essay_en: string;
    full_essay_zh: string;
    section_summary: Array<{
        section_en: string;
        section_zh: string;
        key_points_en: string;
        key_points_zh: string;
    }>;
    template_analysis?: any;
}

/* ── Normalize response: old single-lang fields → new bilingual fields ── */
/* eslint-disable @typescript-eslint/no-explicit-any */
function str(v: any, fallback = ''): string { return typeof v === 'string' ? v : (v ? String(v) : fallback); }
function arr(v: any): string[] { return Array.isArray(v) ? v : []; }

function normQA(raw: any) {
    return {
        topic_type_en: str(raw.topic_type_en || raw.topic_type, 'Unknown'),
        topic_type_zh: str(raw.topic_type_zh, ''),
        focus_points_en: arr(raw.focus_points_en || raw.focus_points),
        focus_points_zh: arr(raw.focus_points_zh),
        correct_approach_en: str(raw.correct_approach_en || raw.correct_approach),
        correct_approach_zh: str(raw.correct_approach_zh),
        off_topic_en: str(raw.off_topic_en || raw.off_topic_example),
        off_topic_zh: str(raw.off_topic_zh),
    };
}

function normParagraphs(raw: any) {
    return (Array.isArray(raw) ? raw : []).map((p: any) => ({
        name_en: str(p.name_en || p.name),
        name_zh: str(p.name_zh),
        purpose_en: str(p.purpose_en || p.purpose),
        purpose_zh: str(p.purpose_zh),
        content_guide_en: str(p.content_guide_en || p.content_guide),
        content_guide_zh: str(p.content_guide_zh),
    }));
}

function normStructure(raw: any) {
    return {
        paragraphs: normParagraphs(raw.paragraphs),
        wrong_structure_en: str(raw.wrong_structure_en || raw.wrong_structure_example),
        wrong_structure_zh: str(raw.wrong_structure_zh),
    };
}

function normSentences(raw: any) {
    return (Array.isArray(raw) ? raw : []).map((s: any) => ({
        purpose_en: str(s.purpose_en || s.purpose),
        purpose_zh: str(s.purpose_zh),
        text_en: str(s.text_en || s.text),
        text_zh: str(s.text_zh),
    }));
}

function normArg(raw: any) {
    return {
        main_idea_en: str(raw.main_idea_en || raw.main_idea),
        main_idea_zh: str(raw.main_idea_zh),
        explanation_en: str(raw.explanation_en || raw.explanation),
        explanation_zh: str(raw.explanation_zh),
        example_en: str(raw.example_en || raw.example),
        example_zh: str(raw.example_zh),
        bad_examples: Array.isArray(raw.bad_examples) ? raw.bad_examples : [],
    };
}

function normSummary(raw: any) {
    return (Array.isArray(raw) ? raw : []).map((s: any) => ({
        section_en: str(s.section_en || s.section),
        section_zh: str(s.section_zh),
        key_points_en: str(s.key_points_en || s.key_points),
        key_points_zh: str(s.key_points_zh),
    }));
}

function normalize(raw: any): LessonData {
    return {
        part1: {
            question_analysis: normQA(raw.part1?.question_analysis || raw.part1 || {}),
            structure: normStructure(raw.part1?.structure || {}),
        },
        part2: {
            opening: {
                sentences: normSentences(raw.part2?.opening?.sentences),
                bad_examples: Array.isArray(raw.part2?.opening?.bad_examples) ? raw.part2?.opening?.bad_examples : [],
            },
            arguments: {
                body1: normArg(raw.part2?.arguments?.body1 || {}),
                body2: normArg(raw.part2?.arguments?.body2 || {}),
            },
            closing: {
                sentences: normSentences(raw.part2?.closing?.sentences),
                bad_closing_en: str(raw.part2?.closing?.bad_closing_en || raw.part2?.closing?.bad_closing_example),
                bad_closing_zh: str(raw.part2?.closing?.bad_closing_zh),
            },
        },
        part3: {
            full_essay_en: str(raw.part3?.full_essay_en || raw.part3?.full_essay),
            full_essay_zh: str(raw.part3?.full_essay_zh),
            section_summary: normSummary(raw.part3?.section_summary),
            template_analysis: raw.part3?.template_analysis || raw.part3?.template_analysis_en,
        },
    };
}

/* ── Bilingual & Single-lang display helpers ── */

function SingleLangBlock({ en, zh }: { en: string; zh: string }) {
    const { lang } = useLang();
    return (
        <div className="at-lang-block" style={{ marginBottom: '0.5rem' }}>
            <p>{lang === 'zh' ? zh : en}</p>
        </div>
    );
}

function BilingualBlock({ en, zh, label }: { en: string; zh: string; label?: string }) {
    return (
        <div className="at-bilingual-container" style={{ marginBottom: '1.5rem' }}>
            {label && <div className="at-bilingual-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--practice-accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>}
            <div className="at-bilingual">
                <div className="at-lang-block at-lang-en">
                <span className="at-lang-tag">EN</span>
                <p>{en}</p>
            </div>
            <div className="at-lang-block at-lang-zh">
                <span className="at-lang-tag">中文</span>
                <p>{zh}</p>
            </div>
        </div>
        </div>
    );
}

function ExplanationBlock({ arg }: { arg: BilingualArg }) {
    const { lang } = useLang();
    const [isSubdivided, setIsSubdivided] = useState(false);

    // Fallback logic for older cached data without explanation_steps
    const steps = arg.explanation_steps?.length ? arg.explanation_steps : (() => {
        const enSentences = arg.explanation_en.split(/(?<=\.|\?|\!)\s+/).filter(s => s.trim());
        const zhSentences = arg.explanation_zh.split(/(?<=[。？！])\s*/).filter(s => s.trim());
        const labels = ['背景', '顺推', '反推'];
        const fallbackSteps = [];
        const maxLen = Math.max(enSentences.length, zhSentences.length, 1);
        for (let i = 0; i < maxLen; i++) {
            fallbackSteps.push({
                step_name: labels[i] || `步骤 ${i + 1}`,
                en: enSentences[i] || '',
                zh: zhSentences[i] || ''
            });
        }
        return fallbackSteps;
    })();

    const hasSteps = steps.length > 0;

    return (
        <div className="at-bilingual-container" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div className="at-bilingual-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--practice-accent)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {lang === 'zh' ? '解释展开' : 'Explanation'}
                </div>
                {hasSteps && (
                    <button 
                        onClick={() => setIsSubdivided(!isSubdivided)}
                        style={{
                            background: isSubdivided ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                            color: isSubdivided ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                            border: `1px solid ${isSubdivided ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            transition: 'all 0.2s'
                        }}
                        title={lang === 'zh' ? '切换逻辑细分模式' : 'Toggle step breakdown'}
                    >
                        {isSubdivided ? '📄 完整段落' : '🔍 解析细分'}
                    </button>
                )}
            </div>

            {!isSubdivided ? (
                <div className="at-bilingual">
                    <div className="at-lang-block at-lang-en">
                        <span className="at-lang-tag">EN</span>
                        <p>{arg.explanation_en}</p>
                    </div>
                    <div className="at-lang-block at-lang-zh">
                        <span className="at-lang-tag">中文</span>
                        <p>{arg.explanation_zh}</p>
                    </div>
                </div>
            ) : (
                <div className="at-explanation-steps-timeline" style={{ position: 'relative', marginTop: '1rem', paddingLeft: '8px' }}>
                    {/* Vertical connecting line */}
                    <div style={{
                        position: 'absolute',
                        top: '1.5rem',
                        bottom: '1.5rem',
                        left: '18px', // 8px padding + 11px half node - 1px half line
                        width: '2px',
                        background: 'linear-gradient(to bottom, var(--color-primary), rgba(79, 70, 229, 0.1))',
                        zIndex: 0
                    }} />

                    {steps.map((step, i) => (
                        <div key={i} style={{ 
                            display: 'flex',
                            gap: '1.2rem',
                            paddingBottom: i < steps.length - 1 ? '1.5rem' : '0',
                            position: 'relative',
                            zIndex: 1
                        }}>
                            {/* Timeline Node */}
                            <div style={{
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: 'var(--color-bg, #fff)',
                                border: '2px solid var(--color-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '4px',
                                boxShadow: '0 0 0 4px var(--color-bg, #fff)'
                            }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                            </div>

                            {/* Card Content */}
                            <div style={{
                                flex: 1,
                                background: 'linear-gradient(145deg, rgba(79, 70, 229, 0.03) 0%, rgba(79, 70, 229, 0.01) 100%)',
                                border: '1px solid rgba(79, 70, 229, 0.1)',
                                borderRadius: '12px',
                                padding: '1.2rem',
                                transition: 'all 0.2s',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.015)'
                            }}>
                                <div style={{ 
                                    display: 'inline-block',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--color-primary)',
                                    background: 'rgba(79, 70, 229, 0.1)',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '6px',
                                    marginBottom: '0.8rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    {step.step_name}
                                </div>
                                <div style={{ 
                                    fontSize: '0.95rem', 
                                    color: 'var(--color-text)', 
                                    fontWeight: 500, 
                                    lineHeight: 1.6, 
                                    marginBottom: '0.6rem' 
                                }}>
                                    {step.en}
                                </div>
                                <div style={{ 
                                    fontSize: '0.85rem', 
                                    color: 'var(--color-text-secondary)', 
                                    lineHeight: 1.6 
                                }}>
                                    {step.zh}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SingleLangBadBox({ en, zh, label }: { en: string; zh: string; label: string }) {
    const { lang } = useLang();
    return (
        <div className="at-bad-box">
            <div className="at-bad-label">{label}</div>
            <div className="at-lang-block" style={{ marginTop: '0.5rem' }}>
                <p>{lang === 'zh' ? zh : en}</p>
            </div>
        </div>
    );
}

function BadBilingual({ en, zh, label }: { en: string; zh: string; label: string }) {
    return (
        <div className="at-bad-box">
            <div className="at-bad-label">{label}</div>
            <div className="at-bilingual">
                <div className="at-lang-block at-lang-en">
                    <span className="at-lang-tag">EN</span>
                    <p>{en}</p>
                </div>
                <div className="at-lang-block at-lang-zh">
                    <span className="at-lang-tag">中文</span>
                    <p>{zh}</p>
                </div>
            </div>
        </div>
    );
}

const SESSION_KEY = 'aiTeacherLesson';

type PageState = 'loading' | 'error' | 'ready';

export default function AiTeacherLessonPage() {
    const { translations: t, lang } = useLang();
    const location = useLocation();
    const navigate = useNavigate();

    const [topic, setTopic] = useState(() => (location.state as any)?.topic || '');
    const recordId = (location.state as any)?.record_id;
    
    // 提取高级偏好设置
    const [viewpointEnabled] = useState(() => (location.state as any)?.viewpointEnabled || false);
    const [viewpoint] = useState(() => (location.state as any)?.viewpoint || '');
    const [customInstructions] = useState(() => (location.state as any)?.customInstructions || '');

    const [state, setState] = useState<PageState>(() => {
        if (recordId) return 'loading';
        const cached = sessionStorage.getItem(SESSION_KEY);
        return cached ? 'ready' : 'loading';
    });

    const [data, setData] = useState<LessonData | null>(() => {
        if (recordId) return null;
        const cachedRaw = sessionStorage.getItem(SESSION_KEY);
        if (cachedRaw) {
            try {
                const cached = JSON.parse(cachedRaw);
                if (cached.topic === topic) return normalize(cached.data);
            } catch {}
        }
        return null;
    });

    const [errorMsg, setErrorMsg] = useState('');
    const [currentSection, setCurrentSection] = useState(0);
    const [loadingStep, setLoadingStep] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showTopic, setShowTopic] = useState(false);
    const [isSaved, setIsSaved] = useState(!!recordId);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTemplateContent, setActiveTemplateContent] = useState<any>(null);

    const contentRef = useRef<HTMLDivElement>(null);
    const allSectionsRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const handleSaveResult = async () => {
        if (!data || isSaved) return;
        setIsSaving(true);
        try {
            const res = await apiClient.post<{status: string, id: number}>('/writing/records', {
                service_type: 'task2_teacher',
                title: topic ? (topic.length > 50 ? topic.slice(0, 50) + '...' : topic) : '大作文讲解',
                content: { ...data, original_topic: topic },
            });
            if (res.data.status === 'success') {
                showToast(lang === 'zh' ? '保存成功！' : 'Saved successfully!', 'success');
                setIsSaved(true);
            } else {
                showToast(lang === 'zh' ? '保存失败' : 'Failed to save', 'error');
            }
        } catch (e: any) {
            const msg = e.response?.data?.message || e.message; showToast((lang === 'zh' ? '保存出错: ' : 'Error saving: ') + msg, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleBack = () => {
        if (state === 'ready' && !isSaved && !recordId) {
            if (!window.confirm(lang === 'zh' ? '尚未保存本次结果，退出将丢失该讲解记录，是否确认退出？' : 'Result not saved. Exit without saving?')) {
                return;
            }
        }
        navigate('/writing/ai-teachers', { replace: true });
    };

    const fetchLesson = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setState('loading');
        setErrorMsg('');
        setLoadingStep(0);

        if (recordId) {
            try {
                const res = await apiClient.get<{status: string, data: any}>(`/writing/records/${recordId}`);
                if (res.data.status === 'success') {
                    const lessonData = normalize(res.data.data.content);
                    setData(lessonData);
                    setTopic(res.data.data.content.original_topic || res.data.data.title || '');
                    setState('ready');
                    setIsSaved(true);
                } else {
                    throw new Error('Load failed');
                }
            } catch (e: any) {
                setErrorMsg(lang === 'zh' ? '记录加载失败' : 'Failed to load record');
                setState('error');
            } finally {
                fetchingRef.current = false;
            }
            return;
        }

        try {
            const res = await fetchStream('/writing/ai-teacher/generate', {
                method: 'POST',
                body: { 
                    topic,
                    viewpointEnabled,
                    viewpoint,
                    customInstructions 
                },
            });
            
            if (!res.ok) {
                let errorData = null;
                try { errorData = await res.json(); } catch(e) {}
                throw { response: { data: errorData } };
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No stream body');
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const data = JSON.parse(line);
                        
                        if (data.error) {
                            if (data.error === 'INVALID_TOPIC') {
                                showToast(lang === 'zh' ? '输入内容不合法或不是雅思作文题目！\n' + (data.reason || '') : 'Invalid topic or not an IELTS writing prompt!\n' + (data.reason || ''), 'error');
                                navigate('/writing/ai-teacher', { replace: true });
                                return;
                            }
                            throw { response: { data: data } };
                        }
                        
                        if (data.step !== undefined) {
                            setLoadingStep(data.step);
                        }
                        
                        if (data.result) {
                            const lessonData = normalize(data.result);
                            setData(lessonData);
                            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic, data: lessonData }));
                            setState('ready');
                        }
                    } catch (e: any) {
                        // ignore unparseable lines (should not happen with valid NDJSON)
                    }
                }
            }
        } catch (e: any) {
            const msg = (e as { response?: { data?: { error?: string, detail?: string } } })?.response?.data?.error || t.writingAiTeacher.errorGen;
            setErrorMsg(msg);
            setState('error');
            fetchingRef.current = false;
            return;
        }
    }, [topic, navigate, lang, t]);

    useEffect(() => {
        if (!data) {
            if (!topic && !recordId) {
                navigate('/writing/ai-teacher', { replace: true });
                return;
            }
            fetchLesson();
        }
    }, [data, topic, navigate, fetchLesson]);

    const sectionNames = t.writingAiTeacher.sectionNames;
    const totalSections = sectionNames.length;

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
            link.download = `AI-IELTS-Teacher-Lesson-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch {
            showToast('Download failed', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    /* ── Section renderers ── */

    const renderSection0 = (d: LessonData) => {
        const qa = d.part1.question_analysis;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                    <span className="at-topic-type">{qa.topic_type_en}</span>
                    <h3>{sectionNames[0]}</h3>
                    <SingleLangBlock en={qa.correct_approach_en} zh={qa.correct_approach_zh} />

                    <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>{lang === 'zh' ? '重点 (Key Focus Points)' : 'Key Focus Points'}</h4>
                    <div className="at-lang-block" style={{ marginBottom: '1rem' }}>
                        <ul className="at-focus-list">
                            {(lang === 'zh' ? qa.focus_points_zh : qa.focus_points_en).map((pt, i) => (
                                <li key={i} className="at-focus-item">{pt}</li>
                            ))}
                        </ul>
                    </div>
                </div>
                </div>

                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {lang === 'zh' ? '跑题预警' : 'Off-Topic Alert'}
                    </h5>
                    <SingleLangBadBox en={qa.off_topic_en} zh={qa.off_topic_zh} label={t.writingAiTeacher.badExample} />
                </div>
            </div>
        );
    };

    const renderSection1 = (d: LessonData) => {
        const st = d.part1.structure;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                    <h3>{sectionNames[1]}</h3>
                    <div className="at-structure-grid">
                        {st.paragraphs.map((p, i) => (
                            <div key={i} className="at-structure-item">
                                <h4>{p.name_en}<span className="at-structure-name-zh">{p.name_zh}</span></h4>
                                <SingleLangBlock en={p.purpose_en} zh={p.purpose_zh} />
                                <SingleLangBlock en={p.content_guide_en} zh={p.content_guide_zh} />
                            </div>
                        ))}
                    </div>
                </div>
                </div>

                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {lang === 'zh' ? '常见结构错误' : 'Common Structure Mistakes'}
                    </h5>
                    <SingleLangBadBox en={st.wrong_structure_en} zh={st.wrong_structure_zh} label={t.writingAiTeacher.badExample} />
                </div>
            </div>
        );
    };

    const renderSection2 = (d: LessonData) => {
        const op = d.part2.opening;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                    <h3>{sectionNames[2]}</h3>
                    <div className="at-sentence-list">
                        {op.sentences.map((s, i) => (
                            <div key={i} className="at-sentence-card">
                                <div className="at-sentence-purpose">
                                    <span>{lang === 'zh' ? s.purpose_zh : s.purpose_en}</span>
                                </div>
                                <div className="at-sentence-text at-bilingual-sentence">
                                    <div className="at-lang-block at-lang-en">
                                        <span className="at-lang-tag">EN</span>
                                        <p>{s.text_en}</p>
                                    </div>
                                    <div className="at-lang-block at-lang-zh">
                                        <span className="at-lang-tag">中文</span>
                                        <p>{s.text_zh}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                </div>

                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {lang === 'zh' ? '常见错误避坑' : 'Common Mistakes'}
                    </h5>
                    <BadExampleList badExamples={op.bad_examples} />
                </div>
            </div>
        );
    };

    const renderSection3 = (d: LessonData) => {
        const args = d.part2.arguments;
        const renderArg = (titleEn: string, titleZh: string, arg: BilingualArg) => (
            <div className="at-argument-card at-split-layout">
                <div className="at-split-main">
                    <h4>{titleEn} <span className="at-structure-name-zh">{titleZh}</span></h4>
                    <BilingualBlock en={arg.main_idea_en} zh={arg.main_idea_zh} label={lang === 'zh' ? '主旨句' : 'Main Idea'} />
                <ExplanationBlock arg={arg} />
                <BilingualBlock en={arg.example_en} zh={arg.example_zh} label={lang === 'zh' ? '举例论证' : 'Example'} />
                </div>

                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {lang === 'zh' ? '常见错误避坑' : 'Common Mistakes'}
                    </h5>
                    <BadExampleList badExamples={arg.bad_examples} />
                </div>
            </div>
        );
        return (
            <div className="at-section-card">
                <h3>{sectionNames[3]}</h3>
                {renderArg('Body 1', '主体段一', args.body1)}
                {renderArg('Body 2', '主体段二', args.body2)}
            </div>
        );
    };

    const renderSection4 = (d: LessonData) => {
        const cl = d.part2.closing;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                    <h3>{sectionNames[4]}</h3>
                    <div className="at-sentence-list">
                        {cl.sentences.map((s, i) => (
                            <div key={i} className="at-sentence-card">
                                <div className="at-sentence-purpose">
                                    <span>{lang === 'zh' ? s.purpose_zh : s.purpose_en}</span>
                                </div>
                                <div className="at-sentence-text at-bilingual-sentence">
                                    <div className="at-lang-block at-lang-en">
                                        <span className="at-lang-tag">EN</span>
                                        <p>{s.text_en}</p>
                                    </div>
                                    <div className="at-lang-block at-lang-zh">
                                        <span className="at-lang-tag">中文</span>
                                        <p>{s.text_zh}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                </div>

                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: '#ef4444', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {lang === 'zh' ? '常见结尾错误' : 'Common Conclusion Mistakes'}
                    </h5>
                    <BadBilingual en={cl.bad_closing_en} zh={cl.bad_closing_zh} label={t.writingAiTeacher.badExample} />
                </div>
            </div>
        );
    };

    const renderSection5 = (d: LessonData) => {
        const p3 = d.part3;
        const templateData = p3.template_analysis;
        const isArrayFormat = Array.isArray(templateData);

        if (!templateData) {
            return (
                <div className="at-split-layout">
                    <div className="at-section-card">
                        <h3>{sectionNames[5]}</h3>
                        <p>{lang === 'zh' ? '暂无模板分析数据' : 'No template analysis available for this record.'}</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{sectionNames[5]}</h3>
                        <div style={{ padding: '1rem' }}>
                            {isArrayFormat ? (
                                templateData.map((paragraphInfo: any, pIdx: number) => {
                                    // Handle legacy single-language format or unified format
                                    const title = lang === 'zh' ? (paragraphInfo.paragraph_zh || paragraphInfo.paragraph) : (paragraphInfo.paragraph_en || paragraphInfo.paragraph);
                                    
                                    return (
                                        <div key={pIdx} className="at-template-paragraph">
                                            {title && (
                                                <div className="at-template-paragraph-title">{title}</div>
                                            )}
                                            <div style={{ lineHeight: '2' }}>
                                                {(paragraphInfo.segments || []).map((seg: any, sIdx: number) => {
                                                    if (seg.type === 'text') {
                                                        return <span key={sIdx}>{seg.content}</span>;
                                                    } else if (seg.type === 'placeholder') {
                                                        const isActive = activeTemplateContent === seg;
                                                        const instruction = lang === 'zh' ? (seg.instruction_zh || seg.instruction) : (seg.instruction_en || seg.instruction);
                                                        return (
                                                            <span 
                                                                key={sIdx} 
                                                                className={`at-template-bracket ${isActive ? 'is-active' : ''}`}
                                                                onClick={() => setActiveTemplateContent(seg)}
                                                            >
                                                                [{instruction}]
                                                            </span>
                                                        );
                                                    }
                                                    return null;
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="markdown-body custom-markdown" style={{ fontSize: '0.95rem' }}>
                                    <ReactMarkdown>{typeof templateData === 'string' ? templateData : ''}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="at-split-side">
                    <div className="at-template-viewer">
                        {activeTemplateContent ? (
                            <div className="at-template-viewer-content">
                                <div className="at-template-viewer-title">
                                    <span style={{ marginRight: '6px' }}>📝</span>
                                    {lang === 'zh' ? 'AI 原文片段' : 'Original Text Segment'}
                                </div>
                                <div className="at-template-viewer-text">
                                    {activeTemplateContent.actual_content_en || activeTemplateContent.actual_content}
                                </div>
                                {(activeTemplateContent.actual_content_zh || activeTemplateContent.actual_content) && (
                                    <div className="at-template-viewer-text" style={{ marginTop: '0.5rem', color: 'var(--color-text-secondary)', background: 'transparent', borderLeft: 'none', padding: '0.5rem 0' }}>
                                        {activeTemplateContent.actual_content_zh || (lang === 'zh' ? activeTemplateContent.actual_content : '')}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="at-template-viewer-empty">
                                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>👈</div>
                                <div>{lang === 'zh' ? '点击左侧模板中的括号 [...] 查看对应的 AI 生成内容' : 'Click the brackets [...] on the left to view the corresponding AI-generated content'}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSection6 = (d: LessonData) => {
        const p3 = d.part3;
        return (
            <div className="at-split-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="at-section-card" style={{ height: '100%' }}>
                    <h3>{sectionNames[6]}</h3>
                    <div className="at-summary-list">
                        {p3.section_summary.map((ss, i) => (
                            <div key={i} className="at-summary-item">
                                <span className="at-summary-section">{lang === 'zh' ? ss.section_zh : ss.section_en}</span>
                                <SingleLangBlock en={ss.key_points_en} zh={ss.key_points_zh} />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="at-section-card" style={{ height: '100%' }}>
                    <h3>{t.writingAiTeacher.fullEssay}</h3>
                    <div className="at-bilingual at-essay-bilingual">
                        <div className="at-lang-block at-lang-en">
                            <span className="at-lang-tag">EN</span>
                            <div className="at-essay-full">{p3.full_essay_en}</div>
                        </div>
                        <div className="at-lang-block at-lang-zh">
                            <span className="at-lang-tag">中文</span>
                            <div className="at-essay-full">{p3.full_essay_zh}</div>
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
            case 5: return renderSection5(data);
            case 6: return renderSection6(data);
            default: return null;
        }
    };

    /* ── Keyboard navigation ── */
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (state !== 'ready') return;
            if (e.key === 'ArrowLeft') goPrev();
            if (e.key === 'ArrowRight') goNext();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [state]);

    /* ── Main render ── */

    if (state === 'loading') {
        const steps = t.writingAiTeacher.loadingSteps;
        return (
            <Layout
                pageTitle={t.writingAiTeacher.lessonTitle}
                backUrl="/writing/ai-teacher"
                backText={t.writingAiTeacher.genTitle}
            >
                <div className="at-loading-wrap">
                    <div className="at-loading-spinner" />
                    <div className="at-loading-title">{recordId ? (lang === 'zh' ? '正在提取历史服务记录...' : 'Loading service record...') : t.writingAiTeacher.loading}</div>
                    {!recordId && (
                        <div className="at-loading-steps">
                            {steps.map((step, i) => (
                                <div
                                    key={i}
                                    className={`at-loading-step${i === loadingStep ? ' is-active' : ''}${i < loadingStep ? ' is-done' : ''}`}
                                >
                                    <span className="at-step-indicator">
                                        {i < loadingStep ? '✓' : i === loadingStep ? '➤' : ''}
                                    </span>
                                    {step}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Layout>
        );
    }

    if (state === 'error') {
        return (
            <Layout
                pageTitle={t.writingAiTeacher?.lessonTitle || 'AI作文老师讲解'}
                backUrl="/writing/ai-teacher"
            >
                <div className="at-error-wrap">
                    <div className="at-error-msg">{errorMsg}</div>
                    <button className="at-error-retry" onClick={fetchLesson}>
                        Retry
                    </button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout
            pageTitle={t.writingAiTeacher.lessonTitle}
            backUrl={recordId ? "/writing/ai-teachers/records" : "/writing/ai-teacher"}
            backText={t.writingAiTeacher.genTitle}
            onBack={handleBack}
            headerRight={
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {state === 'ready' && !isSaved && !recordId && (
                        <button
                            onClick={handleSaveResult}
                            disabled={isSaving}
                            style={{
                                padding: '0.4rem 1rem',
                                borderRadius: '8px',
                                background: isSaving ? '#ccc' : 'var(--color-primary)',
                                color: '#fff',
                                border: 'none',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 500
                            }}
                        >
                            {isSaving ? (lang === 'zh' ? '保存中...' : 'Saving...') : (lang === 'zh' ? '💾 保存结果' : '💾 Save')}
                        </button>
                    )}
                </div>
            }
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
                            position: 'absolute',
                            left: '-9999px',
                            top: 0,
                            width: '1200px',
                            background: '#fafaf9',
                            padding: '3rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2rem',
                            zIndex: -1
                        }}
                        ref={allSectionsRef}
                    >
                        <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '2rem' }}>
                            <h1 style={{ fontSize: '2.5rem', color: '#1e293b', margin: '0 0 1rem 0' }}>{t.writingAiTeacher.lessonTitle}</h1>
                            <div style={{ color: '#475569', fontSize: '1.2rem', padding: '1rem', background: '#f8fafc', borderRadius: '12px', display: 'inline-block', maxWidth: '800px', lineHeight: '1.6' }}>
                                <strong style={{color: '#3b82f6'}}>Topic:</strong> {topic}
                            </div>
                        </div>
                        {renderSection0(data)}
                        {renderSection1(data)}
                        {renderSection2(data)}
                        {renderSection3(data)}
                        {renderSection4(data)}
                        {renderSection5(data)}
                        {renderSection6(data)}
                        
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
                            <h3>{lang === 'zh' ? '作文题目' : 'Essay Topic'}</h3>
                            <button className="at-topic-modal-close" onClick={() => setShowTopic(false)}>
                                &times;
                            </button>
                        </div>
                        <div className="at-topic-modal-body">
                            {topic}
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
