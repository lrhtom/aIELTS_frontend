import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { apiClient } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import BadExampleList, { type BadExample } from '../../components/writing/BadExampleList';
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

    const topic = (location.state as { topic?: string } | null)?.topic || '';

    const [state, setState] = useState<PageState>(() => {
        const cached = sessionStorage.getItem(SESSION_KEY);
        return cached ? 'ready' : 'loading';
    });

    const [data, setData] = useState<LessonData | null>(() => {
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

    const contentRef = useRef<HTMLDivElement>(null);
    const allSectionsRef = useRef<HTMLDivElement>(null);
    const fetchingRef = useRef(false);

    const fetchLesson = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setState('loading');
        setErrorMsg('');

        try {
            const res = await apiClient.post('/writing/ai-teacher/generate', { topic });
            const lessonData = normalize(res.data);
            setData(lessonData);
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic, data: lessonData }));
            setState('ready');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error?: string, reason?: string } } })?.response?.data?.error || t.writingAiTeacher.errorGen;
            
            if (msg === 'INVALID_TOPIC') {
                const reason = (e as { response?: { data?: { reason?: string } } })?.response?.data?.reason || '';
                showToast(lang === 'zh' ? '输入内容不合法或不是雅思作文题目！\n' + reason : 'Invalid topic or not an IELTS writing prompt!\n' + reason, 'error');
                navigate('/writing/ai-teacher', { replace: true });
                return;
            }

            setErrorMsg(msg);
            setState('error');
        } finally {
            fetchingRef.current = false;
        }
    }, [topic, t.writingAiTeacher.errorGen]);

    useEffect(() => {
        if (!data) {
            if (!topic) {
                navigate('/writing/ai-teacher', { replace: true });
                return;
            }
            fetchLesson();
        }
    }, [data, topic, navigate, fetchLesson]);

    useEffect(() => {
        if (state !== 'loading') return;
        const steps = t.writingAiTeacher.loadingSteps;
        const interval = setInterval(() => {
            setLoadingStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
        }, 2000);
        return () => clearInterval(interval);
    }, [state, t.writingAiTeacher.loadingSteps]);

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
                <BilingualBlock en={arg.explanation_en} zh={arg.explanation_zh} label={lang === 'zh' ? '解释展开' : 'Explanation'} />
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
        return (
            <div className="at-split-layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="at-section-card" style={{ height: '100%' }}>
                    <h3>{sectionNames[5]}</h3>
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
                    <div className="at-loading-title">{t.writingAiTeacher.loading}</div>
                    <div className="at-loading-steps">
                        {steps.map((step, i) => (
                            <div
                                key={i}
                                className={`at-loading-step${i === loadingStep ? ' is-active' : ''}${i < loadingStep ? ' is-done' : ''}`}
                            >
                                <span className="at-step-indicator">
                                    {i < loadingStep ? '✓' : i === loadingStep ? '' : ''}
                                </span>
                                {step}
                            </div>
                        ))}
                    </div>
                </div>
            </Layout>
        );
    }

    if (state === 'error') {
        return (
            <Layout
                pageTitle={t.writingAiTeacher.lessonTitle}
                backUrl="/writing/ai-teacher"
                backText={t.writingAiTeacher.genTitle}
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
            backUrl="/writing/ai-teacher"
            backText={t.writingAiTeacher.genTitle}
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
