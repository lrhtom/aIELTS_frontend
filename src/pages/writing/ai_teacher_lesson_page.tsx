import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { apiClient, fetchStream } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import BadExampleList, { type BadExample } from '../../components/writing/BadExampleList';
import ReactMarkdown from 'react-markdown';
import Tree from 'react-d3-tree';
import '../../styles/writing_ai_teacher.css';

const LOGICAL_FRAMEWORKS = [
    { name_zh: '辩证让步链', name_en: 'Standard Argument', steps: ['背景', '顺推', '反推'] },
    { name_zh: '递进深挖链', name_en: 'Cause-Effect-Impact', steps: ['起因', '直接结果', '深层影响'] },
    { name_zh: '假设推演链', name_en: 'Hypothesis-Reaction-Consequence', steps: ['假设', '连锁反应', '灾难后果'] },
    { name_zh: '机制拆解链', name_en: 'Phenomenon-Mechanism-Value', steps: ['现象', '机制', '核心价值'] },
    { name_zh: '方案评估链', name_en: 'Measure-Execution-Limitation', steps: ['提出方案', '落地执行', '预期成效', '局限'] }
];

const detectFrameworkIndex = (stepsList: any[]) => {
    const stepNames = stepsList.map(s => s.step_name);
    for (let i = 0; i < LOGICAL_FRAMEWORKS.length; i++) {
        if (stepNames.some(n => LOGICAL_FRAMEWORKS[i].steps.includes(n))) return i;
    }
    return 0; // Default
};

/* ── Bilingual interfaces ── */



interface LessonData {
    part1: Part1Data;
    part2: Part2Data;
    part3: Part3Data;
}

interface Part1Data {
    question_analysis: {
        subject_category_zh?: string;
        question_type_zh?: string;
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
        bad_examples: BadExample[];
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
        clauses?: Array<{
            label: string;
            en: string;
            zh: string;
            grammar?: {
                pattern: string;
                subject: string;
                verb: string;
                object: string;
                explanation_zh: string;
            };
        }>;
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
function str(v: any, fallback = ''): string {
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    return fallback;
}
function arr(v: any): string[] { return Array.isArray(v) ? v : []; }

function normQA(raw: any) {
    return {
        subject_category_zh: str(raw.subject_category_zh, ''),
        question_type_zh: str(raw.question_type_zh, ''),
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
        explanation_steps: Array.isArray(raw.explanation_steps) ? raw.explanation_steps : undefined,
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
                bad_examples: Array.isArray(raw.part2?.closing?.bad_examples) ? raw.part2?.closing?.bad_examples : [],
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
                                    color: '#5b21b6',
                                    background: '#ede9fe',
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '4px',
                                    marginBottom: '1rem',
                                }}>
                                    {step.step_name}
                                </div>
                                <div style={{ 
                                    fontSize: '1rem', 
                                    color: '#1e293b', 
                                    fontWeight: 400, 
                                    lineHeight: 1.6, 
                                }}>
                                    {step.en}
                                </div>
                                {step.clauses && step.clauses.length > 0 && (
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px dashed #cbd5e1', paddingTop: '1rem', marginBottom: '1rem' }}>
                                        {step.clauses.map((clause: any, ci: number) => (
                                            <div key={ci} style={{ display: 'flex', alignItems: 'stretch', background: '#fff', borderRadius: '4px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                                <div style={{ 
                                                    width: '36px', 
                                                    background: '#0d9488', 
                                                    color: '#fff', 
                                                    fontWeight: 600, 
                                                    display: 'flex', 
                                                    flexDirection: 'column', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    padding: '0.5rem 0',
                                                    fontSize: '0.85rem',
                                                    gap: '2px',
                                                    flexShrink: 0
                                                }}>
                                                    {clause.label.split('').map((char: string, idx: number) => <span key={idx}>{char}</span>)}
                                                </div>
                                                <div style={{ padding: '0.6rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.3rem', flex: 1 }}>
                                                    <div style={{ color: '#334155', fontSize: '0.9rem', fontWeight: 400 }}>{clause.en}</div>
                                                    <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{clause.zh}</div>
                                                    {clause.grammar && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                                                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
                                                                <span style={{ background: '#e0e7ff', color: '#4f46e5', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>{clause.grammar.pattern}</span>
                                                                <span style={{ background: '#fce7f3', color: '#db2777', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>主: {clause.grammar.subject}</span>
                                                                <span style={{ background: '#dcfce7', color: '#16a34a', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>谓: {clause.grammar.verb}</span>
                                                                <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>宾/表: {clause.grammar.object}</span>
                                                            </div>
                                                            <div style={{ color: '#64748b', marginTop: '0.3rem' }}>💡 {clause.grammar.explanation_zh}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.5, marginTop: (!step.clauses || step.clauses.length === 0) ? '1rem' : '0' }}>
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
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return 'loading';
            const cached = JSON.parse(raw);
            return cached.topic === topic ? 'ready' : 'loading';
        } catch { return 'loading'; }
    });

    const [data, setData] = useState<LessonData | null>(() => {
        if (recordId) return null;
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const cached = JSON.parse(raw);
            if (cached.topic !== topic) return null;
            return normalize(cached.data);
        } catch { return null; }
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
    const treeRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const handleBack = () => {
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

        const abortController = new AbortController();
        const streamTimeout = setTimeout(() => abortController.abort(), 600_000); // 10-minute timeout

        try {
            const res = await fetchStream('/writing/ai-teacher/generate', {
                method: 'POST',
                body: {
                    topic,
                    viewpointEnabled,
                    viewpoint,
                    customInstructions
                },
                signal: abortController.signal,
            });

            if (!res.ok) {
                let errorData = null;
                try { errorData = await res.json(); } catch(e) {}
                if (errorData?.error === 'INVALID_TOPIC') {
                    showToast(lang === 'zh' ? '输入内容不合法或不是雅思作文题目！\n' + (errorData.reason || '') : 'Invalid topic or not an IELTS writing prompt!\n' + (errorData.reason || ''), 'error');
                    navigate('/writing/ai-teacher', { replace: true });
                    return;
                }
                throw new Error(errorData?.error || errorData?.detail || 'Generation failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No stream body');
            const decoder = new TextDecoder();
            let buffer = '';
            let receivedResult = false;

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
                            // Re-throw as real error — caught by outer catch
                            throw new Error(data.detail || data.error);
                        }

                        if (data.step !== undefined) {
                            setLoadingStep(data.step);
                        }

                        if (data.result) {
                            const lessonData = normalize(data.result);
                            setData(lessonData);
                            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic, data: lessonData }));
                            setState('ready');
                            receivedResult = true;

                            // Auto-save logic
                            apiClient.post<{status: string, id: number}>('/writing/records', {
                                service_type: 'task2_teacher',
                                title: topic ? (topic.length > 50 ? topic.slice(0, 50) + '...' : topic) : '大作文讲解',
                                content: { ...lessonData, original_topic: topic },
                            }).catch(err => console.error("Auto-save failed", err));
                        }
                    } catch (e: any) {
                        // Only swallow JSON parse errors; re-throw everything else
                        if (!(e instanceof SyntaxError)) throw e;
                    }
                }
            }

            if (!receivedResult) {
                throw new Error('Stream ended without result');
            }
        } catch (e: any) {
            if ((e as Error).name === 'AbortError') {
                setErrorMsg(lang === 'zh' ? '生成超时，请重试' : 'Generation timed out, please retry');
            } else {
                const msg = (e as { response?: { data?: { error?: string, detail?: string } } })?.response?.data?.error
                    || (e as Error).message
                    || t.writingAiTeacher.errorGen;
                setErrorMsg(msg);
            }
            setState('error');
        } finally {
            clearTimeout(streamTimeout);
            fetchingRef.current = false;
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
        if (!treeRef.current || isDownloading) return;
        setIsDownloading(true);
        try {
            // Find real dimensions using SVG getBBox
            const svgEl = treeRef.current.querySelector('svg');
            let treeWidth = 3500;
            let treeHeight = 2000;
            let startY = 1000;
            
            if (svgEl) {
                const gEl = svgEl.querySelector('g');
                if (gEl && typeof gEl.getBBox === 'function') {
                    const bbox = gEl.getBBox();
                    treeWidth = Math.max(1200, bbox.width + 400); // 400px padding right/left
                    treeHeight = Math.max(800, bbox.height + 400); // 400px padding top/bottom
                    startY = treeHeight / 2; // Center vertically
                }
            }

            // 1. Clone the tree container
            const clone = treeRef.current.cloneNode(true) as HTMLDivElement;
            
            // 2. Set dynamic dimensions to prevent clipping and minimize blank space
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '-9999px';
            clone.style.width = `${treeWidth}px`;
            clone.style.height = `${treeHeight}px`;
            clone.style.flex = 'none';
            clone.style.visibility = 'visible'; // Must be visible for html2canvas
            clone.style.overflow = 'visible';
            
            // 3. Reset the SVG transform so it fits within the dynamic canvas perfectly
            const gElement = clone.querySelector('g');
            if (gElement) {
                // translate(150, startY) centers it vertically
                gElement.setAttribute('transform', `translate(150, ${startY}) scale(1)`);
            }
            
            // 4. Append to same parent to preserve CSS specificity
            if (treeRef.current.parentElement) {
                treeRef.current.parentElement.appendChild(clone);
            } else {
                document.body.appendChild(clone);
            }
            
            // 5. Capture
            const { default: html2canvas } = await import('html2canvas');
            const canvas = await html2canvas(clone, {
                backgroundColor: '#fafaf9',
                scale: 1.5,
                logging: false,
                width: treeWidth,
                height: treeHeight,
            });
            
            // 6. Cleanup clone
            if (clone.parentElement) {
                clone.parentElement.removeChild(clone);
            }
            
            const link = document.createElement('a');
            link.download = `AI-IELTS-Logic-Tree-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch {
            showToast('Download failed', 'error');
        } finally {
            setIsDownloading(false);
        }
    };

    /* ── Section renderers ── */

    /* ── Logic Tree Helpers ── */
    const renderCustomNodeElement = ({ nodeDatum, toggleNode }: any) => {
        // Calculate dynamic height based on text length
        const enLen = nodeDatum.attributes?.en ? nodeDatum.attributes.en.length : 0;
        const zhLen = nodeDatum.attributes?.zh ? nodeDatum.attributes.zh.length : 0;
        const hasGrammar = !!nodeDatum.attributes?.grammar_pattern;
        const grammarLines = hasGrammar ? 3 : 0; // extra height for grammar
        const estLines = Math.max(1, Math.ceil(enLen / 35)) + Math.max(1, Math.ceil(zhLen / 15)) + grammarLines;
        const finalHeight = Math.max(hasGrammar ? 140 : 100, 40 + estLines * 22);

        return (
            <g onClick={toggleNode}>
                <foreignObject width="320" height={finalHeight} x="-160" y="-30">
                    <div className="at-tree-node-card" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <div className="at-tree-node-badge" style={{ whiteSpace: 'nowrap' }}>
                            {nodeDatum.name}
                        </div>
                        <div className="at-tree-node-content" style={{ flex: 1 }}>
                            {nodeDatum.attributes?.en && <div className="at-tree-node-en">{nodeDatum.attributes.en}</div>}
                            {nodeDatum.attributes?.zh && <div className="at-tree-node-zh">{nodeDatum.attributes.zh}</div>}
                            {nodeDatum.attributes?.grammar_pattern && (
                                <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.75rem' }}>
                                    <span style={{ color: '#4f46e5', fontWeight: 600 }}>🏷️ {nodeDatum.attributes.grammar_pattern}</span>
                                    <span style={{ color: '#64748b', wordBreak: 'break-all', whiteSpace: 'normal' }}>{nodeDatum.attributes.grammar_svo}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </foreignObject>
            </g>
        );
    };

    const buildLogicTree = (d: LessonData) => {
        const root = {
            name: lang === 'zh' ? '文章核心主旨' : 'Core Thesis',
            attributes: { 
                en: d.part1.structure.paragraphs.find(p => p.name_en.includes('Introduction'))?.content_guide_en || 'Topic',
                zh: d.part1.structure.paragraphs.find(p => p.name_en.includes('Introduction'))?.content_guide_zh || '题目'
            },
            children: [] as any[]
        };

        const introNode = {
            name: lang === 'zh' ? '引言段' : 'Introduction',
            attributes: { en: 'Opening sentences', zh: '开头句' },
            children: d.part2.opening.sentences.map(s => ({
                name: lang === 'zh' ? '开篇句' : 'Sentence',
                attributes: { en: s.text_en, zh: s.text_zh }
            }))
        };
        root.children.push(introNode);

        const bodyNode = {
            name: lang === 'zh' ? '主体论述' : 'Body Paragraphs',
            attributes: { en: 'Arguments', zh: '论点' },
            children: [d.part2.arguments.body1, d.part2.arguments.body2].filter(Boolean).map((arg: any, i) => {
                const steps = arg.explanation_steps?.length ? arg.explanation_steps : (() => {
                    const enSentences = (arg.explanation_en || '').split(/(?<=\.|\?|\!)\s+/).filter((s: string) => s.trim());
                    const zhSentences = (arg.explanation_zh || '').split(/(?<=[。？！])\s*/).filter((s: string) => s.trim());
                    const labels = ['背景', '顺推', '反推'];
                    const fallbackSteps = [];
                    const maxLen = Math.max(enSentences.length, zhSentences.length, 1);
                    for (let k = 0; k < maxLen; k++) {
                        fallbackSteps.push({
                            step_name: labels[k] || `步骤 ${k + 1}`,
                            en: enSentences[k] || '',
                            zh: zhSentences[k] || ''
                        });
                    }
                    return fallbackSteps;
                })();

                const argChildren = steps.map((step: any, j: number) => ({
                    name: step.step_name || (lang === 'zh' ? `逻辑细分 ${j + 1}` : `Logic Step ${j + 1}`),
                    attributes: { en: step.en, zh: step.zh },
                    children: (step.clauses || []).map((clause: any) => ({
                        name: clause.label,
                        attributes: { 
                            en: clause.en, 
                            zh: clause.zh,
                            ...(clause.grammar ? { 
                                grammar_pattern: clause.grammar.pattern,
                                grammar_svo: `主: ${clause.grammar.subject} | 谓: ${clause.grammar.verb} | 宾/表: ${clause.grammar.object}`
                            } : {})
                        }
                    }))
                }));

                if (arg.example_en || arg.example_zh) {
                    argChildren.push({
                        name: lang === 'zh' ? '举例论证' : 'Example',
                        attributes: { en: arg.example_en, zh: arg.example_zh }
                    });
                }

                return {
                    name: lang === 'zh' ? `分论点 ${i + 1}` : `Argument ${i + 1}`,
                    attributes: { en: arg.main_idea_en, zh: arg.main_idea_zh },
                    children: argChildren
                };
            })
        };
        root.children.push(bodyNode);

        const closingNode = {
            name: lang === 'zh' ? '结尾段' : 'Conclusion',
            attributes: { en: 'Closing sentences', zh: '结尾句' },
            children: d.part2.closing.sentences.map(s => ({
                name: lang === 'zh' ? '总结句' : 'Sentence',
                attributes: { en: s.text_en, zh: s.text_zh }
            }))
        };
        root.children.push(closingNode);

        return root;
    };


const SUBJECT_CATEGORIES = ["教育", "科技", "社会", "政府", "媒体", "国际", "犯罪", "文化", "旅游", "环境", "健康", "工作", "其他"];
const QUESTION_TYPES = ["同意与否类 (Agree / Disagree)", "双边讨论类 (Discuss both views)", "优缺点类 (Advantages & Disadvantages)", "利弊权衡类 (Do advantages outweigh disadvantages)", "积极消极类 (Positive or negative development)", "报告类 (Cause / Effect / Solution)", "混合提问类 (Mixed questions)", "其他 (Other)"];

    const renderSection0 = (d: LessonData) => {
        const qa = d.part1.question_analysis;
        
        const renderCategoryBadges = (title: string, items: string[], activeItem: string = '') => (
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>{title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {items.map(item => {
                        const isActive = activeItem ? (item === activeItem || (item.includes(activeItem.replace(/类$/, '')) && activeItem.length > 2)) : false;
                        return (
                            <span key={item} style={{
                                padding: '0.2rem 0.6rem',
                                borderRadius: '20px',
                                fontSize: '0.75rem',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? '#fff' : '#64748b',
                                background: isActive ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : '#f1f5f9',
                                border: `1px solid ${isActive ? 'transparent' : '#e2e8f0'}`,
                                boxShadow: isActive ? '0 2px 4px rgba(79, 70, 229, 0.3)' : 'none',
                                transition: 'all 0.2s',
                            }}>
                                {item}
                            </span>
                        );
                    })}
                </div>
            </div>
        );

        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                    <span className="at-topic-type">{qa.topic_type_en}</span>
                    <h3>{sectionNames[0]}</h3>
                    
                    <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        {renderCategoryBadges(lang === 'zh' ? '考察领域' : 'Subject Area', SUBJECT_CATEGORIES, qa.subject_category_zh)}
                        {renderCategoryBadges(lang === 'zh' ? '提问类型' : 'Question Type', QUESTION_TYPES, qa.question_type_zh)}
                    </div>

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
        
        // Detect which logical frameworks are used by the AI in body paragraphs
        const body1Steps = d.part2?.arguments?.body1?.explanation_steps || [];
        const body2Steps = d.part2?.arguments?.body2?.explanation_steps || [];
        const activeIdx1 = detectFrameworkIndex(body1Steps);
        const activeIdx2 = detectFrameworkIndex(body2Steps);
        const activeIndices = new Set([activeIdx1, activeIdx2]);

        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{sectionNames[1]}</h3>
                        <div className="at-structure-grid">
                            {st.paragraphs.map((p, i) => (
                                <div key={i} className="at-structure-item">
                                    <h4>{p.name_en}<span className="at-structure-name-zh">{p.name_zh}</span></h4>
                                      <div style={{ marginBottom: '0.5rem' }}>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--practice-accent)', textTransform: 'uppercase', marginBottom: '0.2rem', display: 'inline-block' }}>{lang === 'zh' ? '段落目的' : 'Purpose'}</span>
                                          <SingleLangBlock en={p.purpose_en} zh={p.purpose_zh} />
                                      </div>
                                      <div>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-primary)', textTransform: 'uppercase', marginBottom: '0.2rem', display: 'inline-block' }}>{lang === 'zh' ? '内容指南' : 'Content Guide'}</span>
                                          <SingleLangBlock en={p.content_guide_en} zh={p.content_guide_zh} />
                                      </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="at-section-card" style={{ marginTop: '1.5rem' }}>
                        <h4 style={{ fontSize: '1.1rem', color: '#1e293b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>🧠</span> {lang === 'zh' ? 'AI 智能推演逻辑链' : 'AI Reasoning Logic Chains'}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                            <div style={{ width: '100%', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                {lang === 'zh' ? '以下是所有可选的逻辑链，高亮显示的为本篇作文主体段实际使用的推演方式：' : 'Available logical chains. Highlighted ones are used in the body paragraphs:'}
                            </div>
                            {LOGICAL_FRAMEWORKS.map((fw, idx) => {
                                const isActive = activeIndices.has(idx);
                                return (
                                    <div key={idx} style={{
                                        padding: '0.5rem 0.8rem',
                                        borderRadius: '6px',
                                        fontSize: '0.85rem',
                                        fontWeight: isActive ? 700 : 500,
                                        background: isActive ? 'var(--color-primary)' : '#e2e8f0',
                                        color: isActive ? '#fff' : '#64748b',
                                        transition: 'all 0.3s',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '0.3rem'
                                    }}>
                                        <div>{lang === 'zh' ? fw.name_zh : fw.name_en}</div>
                                        <div style={{ fontSize: '0.75rem', opacity: isActive ? 0.95 : 0.75, marginTop: '0.2rem' }}>
                                            {fw.steps.join(' ➔ ')}
                                        </div>
                                    </div>
                                );
                            })}
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
                    <BadExampleList badExamples={cl.bad_examples || []} />
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
        const treeData = buildLogicTree(d);
        return (
            <div className="at-section-card" style={{ height: 'calc(100vh - 150px)', minHeight: '600px', width: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
                    <h3 style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {sectionNames[6]}
                        <button onClick={handleDownload} disabled={isDownloading} style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '6px', background: 'var(--color-surface, #fff)', color: 'var(--color-text)', border: '1px solid var(--color-border, #e2e8f0)', cursor: isDownloading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                            📸 {isDownloading ? '...' : (lang === 'zh' ? '导出导图' : 'Export')}
                        </button>
                    </h3>
                    <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                        {lang === 'zh' ? '💡 提示：按住拖动可移动画布，鼠标滚轮可缩放，点击节点可折叠/展开' : '💡 Tip: Drag to move, scroll to zoom, click nodes to collapse/expand'}
                    </div>
                </div>
                <div ref={treeRef} style={{ width: '100%', flex: 1, background: '#f8fafc', borderRadius: '12px', overflow: 'hidden', padding: '1rem' }}>
                    <Tree 
                        data={treeData} 
                        orientation="horizontal" 
                        pathFunc="step" 
                        translate={{ x: 150, y: 350 }}
                        nodeSize={{ x: 420, y: 280 }}
                        renderCustomNodeElement={renderCustomNodeElement}
                        initialDepth={5}
                    />
                </div>
            </div>
        );
    };

    const renderSection7 = (d: LessonData) => {
        const p3 = d.part3;
        return (
            <div className="at-split-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="at-section-card" style={{ height: '100%' }}>
                    <h3>{lang === 'zh' ? '核心词汇与短语' : 'Core Vocabulary'}</h3>
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
                    <h3>{sectionNames[7]}</h3>
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
            case 7: return renderSection7(data);
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
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {state === 'ready' && data && (
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface, #fff)', borderRadius: '20px', padding: '0.15rem', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                            <button onClick={goPrev} disabled={currentSection === 0} style={{ border: 'none', background: currentSection === 0 ? 'transparent' : 'var(--color-bg, #f8fafc)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: currentSection === 0 ? '#cbd5e1' : 'var(--color-text)', cursor: currentSection === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', flexShrink: 0 }}>
                                &#8249;
                            </button>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '80px', textAlign: 'center', padding: '0 0.4rem', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                {sectionNames[currentSection]} {currentSection + 1}/{totalSections}
                            </div>
                            <button onClick={goNext} disabled={currentSection === totalSections - 1} style={{ border: 'none', background: currentSection === totalSections - 1 ? 'transparent' : 'var(--color-bg, #f8fafc)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: currentSection === totalSections - 1 ? '#cbd5e1' : 'var(--color-text)', cursor: currentSection === totalSections - 1 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', flexShrink: 0 }}>
                                &#8250;
                            </button>
                        </div>
                    )}
                    {state === 'ready' && data && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button onClick={() => setShowTopic(true)} style={{ padding: '0.25rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '20px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                📑 {lang === 'zh' ? '查看题目' : 'Topic'}
                            </button>
                            
                        </div>
                    )}
                </div>
            }
        >
            <div className="at-lesson-wrap">

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
                        {renderSection7(data)}
                        
                        <div style={{ textAlign: 'center', marginTop: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                            Generated by AI IELTS Teacher
                        </div>
                    </div>
                )}
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
