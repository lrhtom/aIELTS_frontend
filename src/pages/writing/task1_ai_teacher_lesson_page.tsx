import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../../components/common/Toast';
import { apiClient } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import '../../styles/writing_ai_teacher.css';

const SESSION_KEY = 'task1AiTeacherLesson';

// === Interfaces matching Task 1 AI Teacher backend JSON output ===
interface Task1LessonData {
    part1: {
        question_analysis: {
            dynamism_zh?: string;
            chart_category_zh?: string;
            chart_type_en: string; chart_type_zh: string;
            dynamic_or_static_en: string; dynamic_or_static_zh: string;
            time_period_en: string; time_period_zh: string;
            main_trends_en: string[]; main_trends_zh: string[];
            key_focus_points_en?: string[]; key_focus_points_zh?: string[];
            data_grouping?: Array<{
                group_name_en: string; group_name_zh: string;
                details_en: string; details_zh: string;
            }>;
            map_changes?: {
                retained_en: string[]; retained_zh: string[];
                removed_en: string[]; removed_zh: string[];
                added_en: string[]; added_zh: string[];
                relocated_en: string[]; relocated_zh: string[];
            };
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
            synonyms?: string[];
        }>;
        template_analysis?: any;
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

function SingleLangGoodBox({ en, zh, label }: { en: string; zh: string; label: string }) {
    const { lang } = useLang();
    return (
        <div className="at-good-box">
            <div className="at-good-label">{label}</div>
            <div className="at-lang-block" style={{ marginTop: '0.5rem' }}>
                <p>{lang === 'zh' ? zh : en}</p>
            </div>
        </div>
    );
}

export default function Task1AiTeacherLessonPage() {
    const { lang, t } = useLang();
    const location = useLocation();
    const navigate = useNavigate();

    const [topic, setTopic] = useState<string>(() => {
        const s = sessionStorage.getItem(SESSION_KEY);
        if (s) return JSON.parse(s).topic;
        return (location.state as { topic?: string } | null)?.topic || '';
    });
    const [imageBase64] = useState<string | null>(() => {
        return (location.state as { image?: string } | null)?.image || null;
    });
    const recordId = (location.state as { record_id?: number } | null)?.record_id;

    const [data, setData] = useState<Task1LessonData | null>(() => {
        if (recordId) return null;
        const s = sessionStorage.getItem(SESSION_KEY);
        return s ? JSON.parse(s).data : null;
    });

    const [state, setState] = useState<'loading' | 'ready' | 'error'>(() => {
        if (recordId) return 'loading';
        return data ? 'ready' : 'loading';
    });
    const [errorMsg, setErrorMsg] = useState('');
    const [currentSection, setCurrentSection] = useState(0);
    const [loadingStep, setLoadingStep] = useState(0);
        const [showTopic, setShowTopic] = useState(false);
    const [, setIsSaved] = useState(!!recordId);
    const [activeTemplateContent, setActiveTemplateContent] = useState<any>(null);

    const contentRef = useRef<HTMLDivElement>(null);
        const fetchingRef = useRef(false);

    const handleBack = () => {
        navigate('/writing/ai-teachers', { replace: true });
    };

    const sectionNames = t('writingAiTeacher.task1.sectionNames', { returnObjects: true }) as string[];
    const totalSections = sectionNames.length;

    const fetchLesson = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        setState('loading');
        setErrorMsg('');

        if (recordId) {
            try {
                const res = await apiClient.get<{status: string, data: any}>(`/writing/records/${recordId}`);
                if (res.data.status === 'success') {
                    setData(res.data.data.content);
                    setTopic(res.data.data.content.original_topic || res.data.data.title || '');
                    setState('ready');
                    setIsSaved(true);
                } else {
                    throw new Error('Load failed');
                }
            } catch (e: any) {
                setErrorMsg(t('writingAiTeacher.lesson.loadRecordFail'));
                setState('error');
            } finally {
                fetchingRef.current = false;
            }
            return;
        }

        try {
            const formData = new FormData();
            formData.append('topic', topic);
            if (imageBase64) {
                const file = dataURLtoFile(imageBase64, 'chart.png');
                if (file) formData.append('image', file);
            }

            // Use native fetch for NDJSON streaming (FormData — browser sets Content-Type automatically)
            const API_BASE = import.meta.env.VITE_API_BASE;
            const csrf = document.cookie.split('; ').find(c => c.startsWith('aielts_csrf='))?.split('=')[1];
            const res = await fetch(`${API_BASE}/api/writing/task1-ai-teacher/generate`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    ...(csrf ? { 'X-CSRF-Token': decodeURIComponent(csrf) } : {}),
                    'ngrok-skip-browser-warning': '69420',
                },
                body: formData,
            });

            if (!res.ok) {
                let errorData: any = null;
                try { errorData = await res.json(); } catch { /* ignore */ }
                if (errorData?.error === 'INVALID_TOPIC') {
                    showToast(t('writingAiTeacher.lesson.invalidTopic') + '\n' + (errorData.reason || ''), 'error');
                    navigate('/writing/ai-teachers', { replace: true });
                    return;
                }
                throw new Error(errorData?.error || 'Generation failed');
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
                        const parsed = JSON.parse(line);

                        if (parsed.error) {
                            if (parsed.error === 'INVALID_TOPIC') {
                                showToast(t('writingAiTeacher.lesson.invalidTopic') + '\n' + (parsed.reason || ''), 'error');
                                navigate('/writing/ai-teachers', { replace: true });
                                return;
                            }
                            throw new Error(parsed.detail || parsed.error);
                        }

                        if (parsed.step !== undefined) {
                            setLoadingStep(parsed.step);
                        }

                        if (parsed.result) {
                            const lessonData = parsed.result as Task1LessonData;
                            setData(lessonData);
                            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ topic, data: lessonData }));
                            setState('ready');

                            // Auto-save logic
                            apiClient.post<{status: string, id: number}>('/writing/records', {
                                service_type: 'task1_teacher',
                                title: topic ? (topic.length > 50 ? topic.slice(0, 50) + '...' : topic) : t('writingAiTeacher.lesson.fallbackTitleTask1'),
                                content: { ...lessonData, original_topic: topic },
                            }).catch(err => console.error("Auto-save failed", err));
                        }
                    } catch (parseErr: any) {
                        if (parseErr.message && !parseErr.message.includes('JSON')) {
                            throw parseErr; // Re-throw non-parse errors
                        }
                    }
                }
            }
        } catch (e: any) {
            const msg = e?.message || 'Generation failed';
            setErrorMsg(msg);
            setState('error');
        } finally {
            fetchingRef.current = false;
        }
    }, [topic, imageBase64, t, navigate]);

    useEffect(() => {
        if (!data) {
            if (!topic && !recordId) {
                navigate('/writing/ai-teachers', { replace: true });
                return;
            }
            fetchLesson();
        }
    }, [data, topic, navigate, fetchLesson]);

    const goPrev = () => setCurrentSection(s => Math.max(0, s - 1));
    const goNext = () => setCurrentSection(s => Math.min(totalSections - 1, s + 1));

    
    // === Render Sections ===

const DYNAMISM_CATEGORIES = ["动态图", "静态图"];
const CHART_CATEGORIES = ["📈 折线图", "🥧 饼状图", "📊 柱状图", "🛶 横向图", "🧮 表格", "🔀 混合图", "🗺️ 地图题", "🔄 流程图"];

    const renderSection0 = (d: Task1LessonData) => {
        if (!d || !d.part1 || !d.part1.question_analysis) {
            return (
                <div style={{ color: 'red', padding: '20px', background: '#ffebee' }}>
                    <h3>Data Format Error</h3>
                    <p>Expected part1.question_analysis to exist, but got:</p>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {JSON.stringify(d, null, 2)}
                    </pre>
                </div>
            );
        }
        const qa = d.part1.question_analysis;
        
        const renderCategoryBadges = (title: string, items: string[], activeItem: string = '') => (
            <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', marginBottom: '0.5rem' }}>{title}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {items.map(item => {
                        // For emoji categories, we need to match the text part
                        const itemText = item.replace(/^[\s\S]+?\s/, ''); // remove emoji and space
                        const isActive = activeItem ? (item === activeItem || itemText === activeItem || (itemText.includes(activeItem.replace(/题$/, '')) && activeItem.length > 2)) : false;
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
                <div className="at-split-main" style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.75rem' }}>
                    <div className="at-section-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                        <h3>{t('writingAiTeacher.lesson.chartCoreElementsHeading')}</h3>

                        <div style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                            {renderCategoryBadges(t('writingAiTeacher.lesson.dynamism'), DYNAMISM_CATEGORIES, qa.dynamic_or_static_zh)}
                            {renderCategoryBadges(t('writingAiTeacher.lesson.chartType'), CHART_CATEGORIES, qa.chart_type_zh)}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Chart Type</div>
                                <strong><SingleLangBlock en={qa.chart_type_en} zh={qa.chart_type_zh} /></strong>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Data Type</div>
                                <strong><SingleLangBlock en={qa.dynamic_or_static_en || 'Dynamic/Static'} zh={qa.dynamic_or_static_zh || '动态/静态'} /></strong>
                            </div>
                            <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px' }}>
                                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>Time & Tense</div>
                                <strong><SingleLangBlock en={qa.time_period_en} zh={qa.time_period_zh} /></strong>
                            </div>
                        </div>
                        <div style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px', marginBottom: '1rem' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>Main Trends (Overview Focus)</div>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-primary-dark)' }}>
                                {qa.main_trends_en.map((_, i) => (
                                    <li key={i}><SingleLangBlock en={qa.main_trends_en[i]} zh={qa.main_trends_zh[i]} /></li>
                                ))}
                            </ul>
                        </div>
                        
                        {qa.key_focus_points_en && qa.key_focus_points_en.length > 0 && (
                            <div style={{ padding: '1rem', background: 'var(--color-warning-bg, #fffbeb)', borderRadius: '8px', borderLeft: '4px solid var(--color-warning, #f59e0b)' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--color-warning-dark, #b45309)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🎯</span> {t('writingAiTeacher.lesson.keyFocusPoints')}
                                </div>
                                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--color-warning-text, #92400e)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                    {qa.key_focus_points_en.map((_, i) => (
                                        <li key={i} style={{ marginBottom: '6px' }}>
                                            <SingleLangBlock en={qa.key_focus_points_en![i]} zh={qa.key_focus_points_zh![i]} />
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        
                        {qa.data_grouping && qa.data_grouping.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--color-primary-dark)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>📊</span> {t('writingAiTeacher.lesson.dataGroupingReco')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: qa.data_grouping.length > 1 ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                    {qa.data_grouping.map((g, i) => (
                                        <div key={i} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '4px solid var(--color-primary)' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--color-text)', marginBottom: '6px' }}>
                                                <SingleLangBlock en={g.group_name_en} zh={g.group_name_zh} />
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                                                <SingleLangBlock en={g.details_en} zh={g.details_zh} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        
                        {qa.map_changes && (qa.map_changes.retained_en?.length > 0 || qa.map_changes.removed_en?.length > 0 || qa.map_changes.added_en?.length > 0 || qa.map_changes.relocated_en?.length > 0) && (
                            <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#6d28d9', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span>🗺️</span> {t('writingAiTeacher.lesson.mapChanges')}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {qa.map_changes.retained_en && qa.map_changes.retained_en.length > 0 && (
                                        <div style={{ padding: '0.8rem', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{color: '#64748b'}}>⚓</span> {t('writingAiTeacher.lesson.mapRemain')}
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                                {qa.map_changes.retained_en.map((_, i) => (
                                                    <li key={i}><SingleLangBlock en={qa.map_changes!.retained_en[i]} zh={qa.map_changes!.retained_zh[i]} /></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {qa.map_changes.removed_en && qa.map_changes.removed_en.length > 0 && (
                                        <div style={{ padding: '0.8rem', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-danger)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{color: '#ef4444'}}>🗑️</span> {t('writingAiTeacher.lesson.mapRemove')}
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                                {qa.map_changes.removed_en.map((_, i) => (
                                                    <li key={i}><SingleLangBlock en={qa.map_changes!.removed_en[i]} zh={qa.map_changes!.removed_zh[i]} /></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {qa.map_changes.added_en && qa.map_changes.added_en.length > 0 && (
                                        <div style={{ padding: '0.8rem', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--color-success)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{color: '#10b981'}}>🏗️</span> {t('writingAiTeacher.lesson.mapBuild')}
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                                {qa.map_changes.added_en.map((_, i) => (
                                                    <li key={i}><SingleLangBlock en={qa.map_changes!.added_en[i]} zh={qa.map_changes!.added_zh[i]} /></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {qa.map_changes.relocated_en && qa.map_changes.relocated_en.length > 0 && (
                                        <div style={{ padding: '0.8rem', background: 'var(--color-surface)', borderRadius: '6px', border: '1px solid var(--color-border)' }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f59e0b', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <span style={{color: '#f59e0b'}}>🚚</span> {t('writingAiTeacher.lesson.mapChange')}
                                            </div>
                                            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                                                {qa.map_changes.relocated_en.map((_, i) => (
                                                    <li key={i}><SingleLangBlock en={qa.map_changes!.relocated_en[i]} zh={qa.map_changes!.relocated_zh[i]} /></li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: 'var(--color-success, #10b981)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>💡</span> {t('writingAiTeacher.lesson.correctApproach')}
                    </h5>
                    <SingleLangGoodBox en={qa.correct_approach_en} zh={qa.correct_approach_zh} label={t('writingAiTeacher.lesson.recommendedLabel')} />

                    <h5 className="at-split-side-title" style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '1.5rem 0 1rem 0' }}>
                        <span>⚠️</span> {t('writingAiTeacher.lesson.offTopicAlert')}
                    </h5>
                    <SingleLangBadBox en={qa.off_topic_en} zh={qa.off_topic_zh} label={t('writingAiTeacher.lesson.badExampleLabel')} />
                </div>
            </div>
        );
    };

    const renderSection1 = (d: Task1LessonData) => {
        if (!d?.part1?.structure?.paragraphs) return <div className="at-section-card"><p>Loading structure data...</p></div>;
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
                    <h5 className="at-split-side-title" style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {t('writingAiTeacher.lesson.commonStructureMistakes')}
                    </h5>
                    <SingleLangBadBox en={struct.wrong_structure_en} zh={struct.wrong_structure_zh} label={t('writingAiTeacher.lesson.badExampleLabel')} />
                </div>
            </div>
        );
    };

    const renderSection2 = (d: Task1LessonData) => {
        if (!d?.part2?.intro_overview?.intro || !d?.part2?.intro_overview?.overview) return <div className="at-section-card"><p>Loading intro & overview data...</p></div>;
        const io = d.part2.intro_overview;
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{t('writingAiTeacher.task1.introHeading')}</h3>
                        <BilingualBlock en={io.intro.text_en} zh={io.intro.text_zh} label="Paraphrase" />
                    </div>
                    <div className="at-section-card">
                        <h3>{t('writingAiTeacher.task1.overviewHeading')}</h3>
                        <BilingualBlock en={io.overview.text_en} zh={io.overview.text_zh} label="Main Features" />
                    </div>
                </div>
                <div className="at-split-side">
                    <h5 className="at-split-side-title" style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                        <span>⚠️</span> {t('writingAiTeacher.lesson.commonMistakes')}
                    </h5>
                    <div className="wpt-bad-box" style={{ marginBottom: '1rem' }}>
                        <div className="wpt-box-header">
                            <span className="wpt-badge-bad">Intro Error</span>
                        </div>
                        <SingleLangBlock en={io.intro.bad_intro_en} zh={io.intro.bad_intro_zh} />
                    </div>
                    <div className="wpt-bad-box">
                        <div className="wpt-box-header">
                            <span className="wpt-badge-bad">Overview Error</span>
                        </div>
                        <SingleLangBlock en={io.overview.bad_overview_en} zh={io.overview.bad_overview_zh} />
                    </div>
                </div>
            </div>
        );
    };

    const renderSection3 = (d: Task1LessonData) => {
        if (!d?.part2?.body_paragraphs) return <div className="at-section-card"><p>Loading body paragraph data...</p></div>;
        const body1 = d.part2.body_paragraphs.body1;
        const body2 = d.part2.body_paragraphs.body2;

        const renderArg = (body: any, titleEn: string, titleZh: string) => {
            if (!body || !body.sentences) return null;
            return (
                <div className="at-argument-card at-split-layout">
                    <div className="at-split-main">
                        <h4>{titleEn} <span className="at-structure-name-zh">{titleZh}</span></h4>
                        <div className="wpt-sentence-flow">
                            {body.sentences.map((s: any, idx: number) => (
                                <div key={idx} className="wpt-sentence-block">
                                    <BilingualBlock en={s.text_en} zh={s.text_zh} />
                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', marginTop: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid var(--color-primary-light, #93c5fd)' }}>
                                        💡 <SingleLangBlock en={s.grammar_point_en} zh={s.grammar_point_zh} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="at-split-side">
                        <h5 className="at-split-side-title" style={{ color: 'var(--color-danger, #ef4444)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '1rem', margin: '0 0 1rem 0' }}>
                            <span>⚠️</span> {t('writingAiTeacher.lesson.commonDataMistakes')}
                        </h5>
                        <div className="wpt-bad-examples-list">
                            {body.bad_examples && body.bad_examples.map((bad: any, idx: number) => (
                                <div key={idx} className="wpt-bad-box" style={{ marginBottom: '0.75rem' }}>
                                    <div className="wpt-box-header">
                                        <span className="wpt-badge-bad">{bad.type}</span>
                                    </div>
                                    <div className="wpt-bilingual-en">{bad.en}</div>
                                    <div className="wpt-bilingual-zh">{bad.zh}</div>
                                    <div style={{ color: 'var(--color-danger, #dc2626)', marginTop: '6px', fontSize: '0.85rem', padding: '0.5rem', background: 'var(--color-danger-bg, rgba(239, 68, 68, 0.06))', borderRadius: '4px' }}>
                                        {bad.reason}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        };

        return (
            <div className="at-section-card">
                <h3>{sectionNames[3]}</h3>
                {renderArg(body1, 'Body Paragraph 1', lang === 'zh' ? body1.focus_zh : body1.focus_en)}
                {renderArg(body2, 'Body Paragraph 2', lang === 'zh' ? body2.focus_zh : body2.focus_en)}
            </div>
        );
    };

    const renderSection4 = (d: Task1LessonData) => {
        const p3 = d.part3;
        const templateData = p3?.template_analysis;
        const isArrayFormat = Array.isArray(templateData);

        if (!templateData) {
            return (
                <div className="at-split-layout">
                    <div className="at-section-card">
                        <h3>{sectionNames[4]}</h3>
                        <p>{t('writingAiTeacher.lesson.templateEmpty')}</p>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="at-split-layout">
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{sectionNames[4]}</h3>
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
                                    {t('writingAiTeacher.lesson.aiSegmentTitle')}
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
                                <div>{t('writingAiTeacher.lesson.templateClickHint')}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderSection5 = (d: Task1LessonData) => {
        if (!d?.part3?.vocabulary || !d?.part3?.full_essay) return <div className="at-section-card"><p>Loading vocabulary & essay data...</p></div>;
        const p3 = d.part3;
        return (
            <div className="at-split-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
                <div className="at-split-main">
                    <div className="at-section-card">
                        <h3>{t('writingAiTeacher.lesson.vocabHeading')}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {p3.vocabulary.map((v, i) => (
                                <div key={i} style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                        <strong style={{ fontSize: '1.1rem', color: 'var(--color-text)' }}>{v.word}</strong>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>{v.translation}</span>
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>
                                        <SingleLangBlock en={v.usage_en} zh={v.usage_zh} />
                                    </div>
                                    {v.synonyms && v.synonyms.length > 0 && (
                                        <div style={{ fontSize: '0.85rem', color: 'var(--color-primary-dark)', marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, marginRight: '4px' }}>Synonyms:</span>
                                            {v.synonyms.map((syn, idx) => (
                                                <span key={idx} style={{ background: 'var(--color-primary-bg, #dbeafe)', color: 'var(--color-primary-dark)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.82rem' }}>{syn}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{ width: '100%' }}>
                    <div className="at-section-card" style={{ background: 'var(--color-bg)', height: '100%' }}>
                        <h3>{t('writingAiTeacher.lesson.fullEssayHeading')}</h3>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '1.05rem', color: 'var(--color-text)' }}>
                            {p3.full_essay.essay_en}
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: '0.95rem', color: 'var(--color-text-secondary)', marginTop: '2rem', borderTop: '1px solid var(--color-border, #e2e8f0)', paddingTop: '1rem' }}>
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
            case 5: return renderSection5(data);
            default: return null;
        }
    };

    if (state === 'loading') {
        const steps = t('writingAiTeacher.task1.loadingSteps', { returnObjects: true }) as string[];

        return (
            <Layout
                pageTitle={t('writingAiTeacher.task1.pageTitle')}
                backUrl="/writing/ai-teachers"
                backText={t('writingAiTeacher.lesson.backText')}
                onBack={handleBack}
            >
                <div className="at-loading-wrap" style={{ padding: '3rem', maxWidth: '600px', margin: '0 auto', background: 'var(--color-bg)', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', marginTop: '2rem' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--color-primary-dark)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        <span>✨</span>
                        {recordId ? t('writingAiTeacher.lesson.loadingRecord') : t('writingAiTeacher.lesson.loadingTitle')}
                    </h2>
                    
                    {!recordId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingLeft: '1rem' }}>
                            {steps.map((stepText, idx) => {
                                const isDone = idx < loadingStep;
                                const isActive = idx === loadingStep;
                                const isPending = idx > loadingStep;
                                
                                return (
                                    <div key={idx} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '1.2rem',
                                        opacity: isPending ? 0.4 : 1,
                                        transition: 'all 0.3s ease',
                                        transform: isActive ? 'scale(1.02)' : 'scale(1)'
                                    }}>
                                        <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: isDone ? '#10b981' : (isActive ? 'transparent' : '#f1f5f9'),
                                            border: isActive ? '3px solid var(--color-primary)' : (isDone ? 'none' : '2px solid #cbd5e1'),
                                            color: '#fff', fontSize: '1rem', flexShrink: 0,
                                            boxShadow: isDone ? '0 0 10px rgba(16,185,129,0.3)' : 'none'
                                        }}>
                                            {isDone && '✓'}
                                            {isActive && <div className="at-loading-spinner" style={{ margin: 0, width: '16px', height: '16px', borderWidth: '2px', borderTopColor: 'var(--color-primary)', borderRightColor: 'var(--color-primary)' }} />}
                                            {isPending && <span style={{ color: '#94a3b8', fontWeight: 'bold' }}>{idx + 1}</span>}
                                        </div>
                                        <div style={{ 
                                            fontSize: '1.15rem', 
                                            fontWeight: isActive ? 600 : (isDone ? 500 : 400),
                                            color: isDone ? '#059669' : (isActive ? 'var(--color-primary-dark)' : 'var(--color-text-secondary)')
                                        }}>
                                            {stepText}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {recordId && (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                            <div className="at-loading-spinner" style={{ width: '40px', height: '40px' }} />
                        </div>
                    )}
                </div>
            </Layout>
        );
    }

    if (state === 'error') {
        return (
            <Layout
                pageTitle={t('writingAiTeacher.task1.pageTitle')}
                backUrl="/writing/ai-teachers"
                backText={t('writingAiTeacher.lesson.backText')}
                onBack={handleBack}
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
            pageTitle={t('writingAiTeacher.task1.pageTitle')}
            backUrl={recordId ? "/writing/ai-teachers/records" : "/writing/ai-teachers"}
            backText={t('writingAiTeacher.lesson.backText')}
            onBack={handleBack}
            headerRight={
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {data && (
                        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-surface, #fff)', borderRadius: '20px', padding: '0.15rem', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', border: '1px solid var(--color-border, #e2e8f0)' }}>
                            <button onClick={goPrev} disabled={currentSection === 0} style={{ border: 'none', background: currentSection === 0 ? 'transparent' : 'var(--color-bg, #f8fafc)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: currentSection === 0 ? '#cbd5e1' : 'var(--color-text)', cursor: currentSection === 0 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', flexShrink: 0 }}>
                                &#8249;
                            </button>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '40px', textAlign: 'center', padding: '0 0.2rem', userSelect: 'none', whiteSpace: 'nowrap' }}>
                                {currentSection + 1} / {totalSections}
                            </div>
                            <button onClick={goNext} disabled={currentSection === totalSections - 1} style={{ border: 'none', background: currentSection === totalSections - 1 ? 'transparent' : 'var(--color-bg, #f8fafc)', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', color: currentSection === totalSections - 1 ? '#cbd5e1' : 'var(--color-text)', cursor: currentSection === totalSections - 1 ? 'not-allowed' : 'pointer', fontSize: '0.9rem', transition: 'all 0.2s', flexShrink: 0 }}>
                                &#8250;
                            </button>
                        </div>
                    )}
                    
                    {data && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button onClick={() => setShowTopic(true)} style={{ padding: '0.25rem 0.8rem', fontSize: '0.8rem', fontWeight: 600, borderRadius: '20px', background: 'rgba(59, 130, 246, 0.08)', color: 'var(--color-primary)', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem', whiteSpace: 'nowrap' }}>
                                📄 {t('writingAiTeacher.lesson.topicToggleBtn')}
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
                            position: 'absolute', left: '-9999px', top: 0, width: '1200px',
                            background: '#fafaf9', padding: '3rem', display: 'flex',
                            flexDirection: 'column', gap: '2rem', zIndex: -1
                        }}
                        
                    >
                        <div style={{ textAlign: 'center', marginBottom: '1rem', borderBottom: '2px solid var(--color-border, #e2e8f0)', paddingBottom: '2rem' }}>
                            <h1 style={{ fontSize: '2.5rem', color: 'var(--color-text)', margin: '0 0 1rem 0' }}>{t('writingAiTeacher.task1.pageTitle')}</h1>
                            <div style={{ color: 'var(--color-text-secondary)', fontSize: '1.2rem', padding: '1rem', background: 'var(--color-bg)', borderRadius: '12px', display: 'inline-block', maxWidth: '800px', lineHeight: '1.6' }}>
                                <strong style={{color: 'var(--color-primary)'}}>Topic:</strong> {topic}
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
                        {renderSection5(data)}
                        
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
                            <h3>{t('writingAiTeacher.lesson.chartTopicHeading')}</h3>
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
