import Layout from '../../components/layout/Layout';
import { useState, useMemo, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import translate from 'translate';
translate.engine = 'google';
import AiModelSelector, { type AIProvider } from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { ChevronDown, ChevronUp } from 'lucide-react';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import '../../styles/writing_correction_result.css';
import { type WritingTaskType, type CorrectionResponse } from '../../types/writing_page';

const TASK1_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const TASK1_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export default function WritingCorrectionPage() {
    const { lang } = useLang();
    const t = translations[lang];

    const [text, setText] = useState('');
    const [promptText, setPromptText] = useState('');
    const [taskType, setTaskType] = useState<WritingTaskType>('task2');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [activeTab, setActiveTab] = useState<'sentence' | 'vocab' | 'improved' | 'model'>('sentence');
    const [transMode, setTransMode] = useState<'en' | 'zh'>('en');
    const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});
    const [isTranslating, setIsTranslating] = useState(false);
    const [expandedCriteria, setExpandedCriteria] = useState<Record<string, boolean>>({});
    const [result, setResult] = useState<CorrectionResponse | null>(null);
    const [provider, setProvider] = useState<AIProvider>(() => {
        const localProvider = localStorage.getItem('ai_provider') as AIProvider | null;
        return localProvider || 'deepseek';
    });
    const [task1ImageDataUrl, setTask1ImageDataUrl] = useState('');
    const [task1ImageName, setTask1ImageName] = useState('');
    const [isTask1ImageDragOver, setIsTask1ImageDragOver] = useState(false);
    const task1ImageInputRef = useRef<HTMLInputElement | null>(null);

    const location = useLocation();
    const navigate = useNavigate();
    const [recordId, setRecordId] = useState<number | undefined>((location.state as { record_id?: number } | null)?.record_id);
    const [isSaved, setIsSaved] = useState(!!recordId);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (recordId) {
            api<{status: string, data: any}>(`/writing/records/${recordId}`)
                .then(res => {
                    if (res.status === 'success') {
                        const content = res.data.content;
                        setResult(content.result);
                        setText(content.text || '');
                        setPromptText(content.prompt || '');
                        setTaskType(content.task_type || 'task2');
                        if (content.synonymsMap) {
                            setSynonymsMap(content.synonymsMap);
                        }
                        setIsSaved(true);
                    }
                })
                .catch(err => {
                    showToast(lang === 'zh' ? '加载记录失败' : 'Failed to load record', 'error');
                });
        }
    }, []); // Only run once on mount since recordId is now state

    const minWords = taskType === 'task1' ? 150 : 250;
    const supportsTask1ImageRecognition = provider.startsWith('gpt5');
    const showTask1ImageUpload = taskType === 'task1' && supportsTask1ImageRecognition;

    const wordCount = useMemo(() => {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [text]);

    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
                return;
            }
            reject(new Error('file-read-failed'));
        };
        reader.onerror = () => reject(new Error('file-read-failed'));
        reader.readAsDataURL(file);
    });

    const handleTask1ImageFile = async (file: File) => {
        if (!TASK1_IMAGE_ALLOWED_TYPES.has((file.type || '').toLowerCase())) {
            showToast(t.writingCorrection.task1ImageInvalidType, 'error');
            return;
        }
        if (file.size > TASK1_IMAGE_MAX_SIZE) {
            showToast(t.writingCorrection.task1ImageTooLarge, 'error');
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setTask1ImageDataUrl(dataUrl);
            setTask1ImageName(file.name || 'task1-image');
        } catch {
            showToast(t.writingCorrection.task1ImageReadFail, 'error');
        }
    };

    const handleTask1ImageInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await handleTask1ImageFile(file);
        }
        event.target.value = '';
    };

    const handleTask1ImageDrop = async (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (isEvaluating) return;
        setIsTask1ImageDragOver(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
            await handleTask1ImageFile(file);
        }
    };

    const handleEvaluate = async () => {
        if (!text.trim()) {
            showToast(t.writingCorrection.toastEmpty, 'error');
            return;
        }
        setIsEvaluating(true);
        setResult(null);
        try {
            const payload: Record<string, unknown> = {
                text,
                prompt: promptText,
                task_type: taskType,
                lang,
            };

            // Task 2 never sends image payload even if Task 1 image exists in local state.
            if (taskType === 'task1' && showTask1ImageUpload && task1ImageDataUrl) {
                payload.task1_image_data_url = task1ImageDataUrl;
            }

            const res = await api<CorrectionResponse>('/writing/generate', {
                method: 'POST',
                body: payload,
            });
            setResult(res);
            setIsSaved(true);
            showToast(t.writingCorrection.toastSuccess, 'success');

            // Auto-save logic
            try {
                const saveRes = await api<{status: string, id: number}>('/writing/records', {
                    method: 'POST',
                    body: {
                        service_type: 'correction',
                        title: promptText ? (promptText.slice(0, 30) + '...') : (lang === 'zh' ? '无题作文批改' : 'Untitled Correction'),
                        content: {
                            result: res,
                            text,
                            prompt: promptText,
                            task_type: taskType,
                            synonymsMap
                        },
                    }
                });
                if (saveRes.status === 'success') {
                    setRecordId(saveRes.id);
                }
            } catch (saveErr) {
                console.error('Auto-save failed:', saveErr);
            }
        } catch (err: unknown) {
            console.error('Submit writing correction error:', err);
            const error = err as { message?: string; title?: string };
            showToast(error.message || t.writingCorrection.toastFail, 'error', error.title || t.writingCorrection.toastErrorTitle);
        } finally {
            setIsEvaluating(false);
        }
    };

    const handleBack = () => {
        navigate('/writing/ai-teachers');
    };

    const scores = result ? [
        { label: lang === 'zh' ? (taskType === 'task1' ? '任务完成' : '任务回应') : (taskType === 'task1' ? 'TA' : 'TR'), val: result.Task_Response },
        { label: lang === 'zh' ? '连贯衔接' : 'CC', val: result.Coherence_Cohesion },
        { label: lang === 'zh' ? '词汇资源' : 'LR', val: result.Lexical_Resource },
        { label: lang === 'zh' ? '语法多样' : 'GRA', val: result.Grammatical_Range },
    ] : [];


    const escapeHtml = (str: string) => {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const renderAnnotatedText = () => {
        if (!result) return text.split(/\n\n+/).map((para, idx) => <p key={idx} className="wc-essay-paragraph">{para}</p>);

        let annotatedHtml = escapeHtml(text);
        const replacements: Record<string, string> = {};

        const sentences = [...(result.Sentence_Corrections || [])].sort((a, b) => b.original.length - a.original.length);
        const vocabs = [...(result.Vocabulary_Upgrades || [])].sort((a, b) => b.original.length - a.original.length);

        sentences.forEach((corr, idx) => {
            const token = `__SENT_${idx}__`;
            const severityClass = corr.severity === 'suggestion' ? 'severity-suggestion' : 'severity-warning';
            const escapedOriginal = escapeHtml(corr.original);
            const regexEscaped = escapedOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            replacements[token] = `<span class="wc-inline-error ${severityClass}" title="${escapeHtml(corr.explanation)}">${escapedOriginal}</span>`;
            annotatedHtml = annotatedHtml.replace(new RegExp(regexEscaped, 'g'), token);
        });

        vocabs.forEach((vocab, idx) => {
            const token = `__VOCAB_${idx}__`;
            const escapedOriginal = escapeHtml(vocab.original);
            const regexEscaped = escapedOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            replacements[token] = `<span class="wc-inline-error type-vocabulary" title="Upgrades: ${escapeHtml(vocab.upgrades.join(', '))}">${escapedOriginal}</span>`;
            annotatedHtml = annotatedHtml.replace(new RegExp(regexEscaped, 'g'), token);
        });

        // Resolve tokens
        Object.keys(replacements).forEach(token => {
            annotatedHtml = annotatedHtml.replace(new RegExp(token, 'g'), replacements[token]);
        });

        return annotatedHtml.split(/\n\n+/).map((para, idx) => (
            <p key={idx} className="wc-essay-paragraph" dangerouslySetInnerHTML={{ __html: para }} />
        ));
    };

    const handleEssayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('wc-inline-error')) {
            const textContent = target.textContent;
            if (!textContent) return;
            
            // Check if it's a sentence correction
            const isSentence = result?.Sentence_Corrections?.find(s => s.original === textContent);
            if (isSentence) {
                setActiveTab('sentence');
                setTimeout(() => {
                    const el = document.getElementById(`corr-${textContent}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
                return;
            }
            
            // Check if it's a vocab upgrade
            const isVocab = result?.Vocabulary_Upgrades?.find(v => v.original === textContent);
            if (isVocab) {
                setActiveTab('vocab');
                setTimeout(() => {
                    const el = document.getElementById(`vocab-${textContent}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        }
    };
    // --- Stats calculations ---
    const grammarMistakesCount = useMemo(() => {
        if (!result || !result.Sentence_Corrections) return 0;
        return result.Sentence_Corrections.length;
    }, [result]);

    const repeatedWords = useMemo(() => {
        if (!result || !text) return [];
        const words = text.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2);
        const stopWords = new Set(['the', 'and', 'that', 'with', 'for', 'this', 'but', 'not', 'are', 'was', 'have', 'from', 'they', 'you', 'can', 'will', 'has', 'would', 'what', 'there', 'when', 'which', 'about', 'more', 'some', 'these', 'them', 'because', 'who', 'how', 'than', 'any', 'could', 'should', 'only', 'also', 'such', 'very', 'even', 'then', 'into', 'most', 'its', 'been', 'out', 'may', 'after', 'well', 'where', 'through', 'many', 'those', 'much', 'before', 'between', 'both', 'since', 'under', 'without', 'same', 'another', 'does', 'did', 'being', 'just', 'too', 'over', 'now', 'down', 'why', 'way', 'each', 'need', 'must', 'should', 'all', 'one', 'good', 'take', 'make', 'see', 'get']);
        const counts: Record<string, number> = {};
        for (const w of words) {
            if (!stopWords.has(w)) counts[w] = (counts[w] || 0) + 1;
        }
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .filter(item => item[1] > 3)
            .slice(0, 8);
    }, [result, text]);

    const [synonymsMap, setSynonymsMap] = useState<Record<string, string[]>>({});
    // Track whether this page was opened from a historical record (skip AI API calls)
    const isHistoricalView = useRef(!!(location.state as { record_id?: number } | null)?.record_id);
    useEffect(() => {
        // Skip synonyms API call entirely when viewing a saved historical record
        if (isHistoricalView.current) return;
        if (repeatedWords.length > 0) {
            const wordsToFetch = repeatedWords.map(rw => rw[0]).filter(w => !synonymsMap[w]);
            if (wordsToFetch.length > 0) {
                api<{synonyms: Record<string, string[]>}>('/writing/synonyms', {
                    method: 'POST',
                    body: { words: wordsToFetch, context: text }
                }).then(res => {
                    if (res.synonyms) {
                        setSynonymsMap(prev => {
                            const newMap = { ...prev, ...res.synonyms };
                            if (isSaved && recordId) {
                                api(`/writing/records/${recordId}`, {
                                    method: 'PATCH',
                                    body: { content: { synonymsMap: newMap } }
                                }).catch(e => console.error('Failed to patch synonyms to db', e));
                            }
                            return newMap;
                        });
                    }
                }).catch(err => console.error('Failed to fetch synonyms', err));
            }
        }
    }, [repeatedWords]);
    // --- End Stats ---

    return (
        <Layout
            pageTitle={t.writingCorrection.title}
            backUrl={recordId ? "/writing/ai-teachers/records" : "/writing"}
            backText={recordId ? (lang === 'zh' ? '返回记录' : 'Back to Records') : t.writingCorrection.backToHall}
            onBack={handleBack}
            headerRight={
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {!recordId && <AiModelSelector variant="minimal" onModelChange={(nextProvider) => setProvider(nextProvider)} />}
                </div>
            }
        >
            <div className={`wc-page ${result ? 'is-result-mode' : ''}`}>

                {/* Main body */}
                {result ? (
                    <div className="wc-result-view">
                            {/* 1. Left: Essay with Annotations */}
                            <div className="wc-essay-panel">
                                <div className="wc-panel-header">
                                    <div className="wc-panel-title">✍️ {lang === 'zh' ? '您的作文 (带批注)' : 'Your Essay (Annotated)'}</div>
                                </div>
                                
                                {/* Essay Prompt Placeholder */}
                                <div style={{ padding: '24px 32px 0 32px', color: '#475569', fontSize: '0.95rem', fontStyle: 'italic', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '8px', color: '#334155' }}>📝 {lang === 'zh' ? '作文题目 (Prompt)' : 'Essay Prompt'}</div>
                                    {promptText || (lang === 'zh' ? '（您未输入原题目，系统直接基于文章内容进行无题批改）' : '(No prompt was provided, the system evaluated based on the essay content alone)')}
                                </div>

                                <div className="wc-essay-content" onClick={handleEssayClick}>
                                    {renderAnnotatedText()}
                                </div>
                            </div>

                            {/* 2. Middle: Corrections & Feedback Tabs */}
                            <div className="wc-corrections-panel">
                                <div className="wc-tabs">
                                    {result.Sentence_Corrections && result.Sentence_Corrections.length > 0 && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'sentence' ? ' active' : ''}`} onClick={() => setActiveTab('sentence')}>{lang === 'zh' ? '逐句精批' : 'Sentences'}</button>
                                    )}
                                    {result.Vocabulary_Upgrades && result.Vocabulary_Upgrades.length > 0 && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'vocab' ? ' active' : ''}`} onClick={() => setActiveTab('vocab')}>{lang === 'zh' ? '词汇升级' : 'Vocab'}</button>
                                    )}
                                    {result.Revised_Essay && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'improved' ? ' active' : ''}`} onClick={() => setActiveTab('improved')}>{lang === 'zh' ? '改后作文' : 'Improved'}</button>
                                    )}
                                    {result.Model_Essay && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'model' ? ' active' : ''}`} onClick={() => setActiveTab('model')}>{lang === 'zh' ? '高分范文' : 'Model'}</button>
                                    )}
                                    <button type="button" className={`wc-tab-btn${activeTab === 'stats' ? ' active' : ''}`} onClick={() => setActiveTab('stats')}>{lang === 'zh' ? '数据统计' : 'Statistics'}</button>
                                </div>

                                <div className="wc-corrections-content">
                                    {activeTab === 'stats' && (
                                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            <div style={{ backgroundColor: '#ffd6dc', color: '#000', padding: '16px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                Grammar Mistakes: {grammarMistakesCount}
                                            </div>
                                            
                                            {repeatedWords.length > 0 && (
                                                <div style={{ backgroundColor: '#dbe0ff', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', marginBottom: '8px', color: '#334155' }}>
                                                        Vocabulary Repetition:
                                                    </div>
                                                    {repeatedWords.map(([word, count], i) => (
                                                        <div key={i} style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                                            <div>{word}: <span style={{fontWeight: 'normal'}}>{count}</span></div>
                                                            {synonymsMap[word] && synonymsMap[word].length > 0 && (
                                                                <div style={{ color: '#16a34a', fontSize: '1.05rem', marginTop: '6px', fontWeight: 500 }}>
                                                                    {synonymsMap[word].slice(0, 3).join(', ')}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                    <div style={{ textAlign: 'center', fontWeight: '600', fontSize: '1rem', marginTop: '12px', color: '#475569' }}>
                                                        Try using synonyms for the above words
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'sentence' && result.Sentence_Corrections && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {result.Sentence_Corrections.map((corr, idx) => (
                                                <div key={idx} id={`corr-${corr.original}`} className={`wc-correction-card ${corr.severity === 'suggestion' ? 'severity-suggestion' : 'severity-warning'}`}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 600, marginRight: '8px' }}>
                                                            {lang === 'zh' ? '原句' : 'Original'}
                                                        </span>
                                                        <span style={{ textDecoration: 'line-through', color: 'var(--color-text-dim)' }}>{corr.original}</span>
                                                    </div>
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#10b981', fontWeight: 600, marginRight: '8px' }}>
                                                            {lang === 'zh' ? '修改' : 'Improved'}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{corr.improved}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', borderTop: '1px dashed var(--color-border)', paddingTop: '12px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-primary)', marginRight: '6px' }}>[{corr.error_type}]</span>
                                                        {corr.explanation}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'vocab' && result.Vocabulary_Upgrades && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {result.Vocabulary_Upgrades.map((vocab, idx) => (
                                                <div key={idx} id={`vocab-${vocab.original}`} className="wc-correction-card type-vocab">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                        <span style={{ color: '#ef4444', textDecoration: 'line-through', fontWeight: 500 }}>{vocab.original}</span>
                                                        <span>➡️</span>
                                                        <span style={{ color: '#10b981', fontWeight: 600 }}>{vocab.upgrades.join(' / ')}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                                                        "{vocab.context}"
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {activeTab === 'improved' && result.Revised_Essay && (
                                        <div className="wc-correction-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                                                    <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{lang === 'zh' ? '英文' : 'English'}</button>
                                                    <button type="button" className={`wc-trans-btn${transMode === 'zh' ? ' active' : ''}`} onClick={async () => {
                                                        setTransMode('zh');
                                                        if (!translatedTexts['improved']) {
                                                            setIsTranslating(true);
                                                            try {
                                                                const t = await translate(result.Revised_Essay!, "zh");
                                                                setTranslatedTexts(prev => ({ ...prev, improved: t }));
                                                            } catch (e) {
                                                                console.error(e);
                                                            } finally {
                                                                setIsTranslating(false);
                                                            }
                                                        }
                                                    }}>
                                                        {lang === 'zh' ? '中文翻译' : 'Translation'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{lang === 'zh' ? '翻译中...' : 'Loading...'}</div>
                                                ) : (
                                                    (transMode === 'en' ? result.Revised_Essay : (translatedTexts['improved'] || '')).split(/\n\n+/).map((para, idx) => (
                                                        <p key={idx} style={{ marginBottom: '16px' }}>{para.trim()}</p>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'model' && result.Model_Essay && (
                                        <div className="wc-correction-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                                <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                                                    <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{lang === 'zh' ? '英文' : 'English'}</button>
                                                    <button type="button" className={`wc-trans-btn${transMode === 'zh' ? ' active' : ''}`} onClick={async () => {
                                                        setTransMode('zh');
                                                        if (!translatedTexts['model']) {
                                                            setIsTranslating(true);
                                                            try {
                                                                const t = await translate(result.Model_Essay!, "zh");
                                                                setTranslatedTexts(prev => ({ ...prev, model: t }));
                                                            } catch (e) {
                                                                console.error(e);
                                                            } finally {
                                                                setIsTranslating(false);
                                                            }
                                                        }
                                                    }}>
                                                        {lang === 'zh' ? '中文翻译' : 'Translation'}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{lang === 'zh' ? '翻译中...' : 'Loading...'}</div>
                                                ) : (
                                                    (transMode === 'en' ? result.Model_Essay : (translatedTexts['model'] || '')).split(/\n\n+/).map((para, idx) => (
                                                        <p key={idx} style={{ marginBottom: '16px' }}>{para.trim()}</p>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Right: Scores Panel */}
                            <div className="wc-score-panel">
                                <div className="wc-score-header-box">
                                    <div className="wc-score-overall-flex">
                                        <div>
                                            <div className="wc-score-overall-text">{t.writingCorrection.overallBand}</div>
                                            <div className="wc-score-overall-sub">{t.writingCorrection.overallBandSubtitle}</div>
                                        </div>
                                        <div className="wc-score-overall-val">{result.Overall_Band.toFixed(1)}</div>
                                    </div>
                                    <div className="wc-subscores-box" style={{ background: '#ffffff', borderRadius: '12px', padding: '16px' }}>
                                        <div className="wc-subscores">
                                            {scores.map(({ label, val }) => (
                                                <div key={label} className="wc-subscore-col">
                                                    <div className="wc-subscore-label">{label}</div>
                                                    <div className="wc-subscore-val">{val.toFixed(1)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Comprehensive Evaluation Card */}
                                <div style={{ padding: '20px', borderTop: '1px solid #f1f5f9' }}>
                                    <div className="wc-overall-feedback">
                                        <h3 style={{ marginBottom: '16px', fontSize: '1.05rem', color: '#1e293b', fontWeight: 700 }}>
                                            {lang === 'zh' ? '综合评价 (Comprehensive Evaluation)' : 'Comprehensive Evaluation'}
                                        </h3>
                                        
                                        {/* Strengths */}
                                        {result.Feedback_Strengths && result.Feedback_Strengths.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                                                    {lang === 'zh' ? '优点 (Strengths)' : 'Strengths'}
                                                </div>
                                                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                                    {result.Feedback_Strengths.map((item, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Improvements */}
                                        {result.Feedback_Improvements && result.Feedback_Improvements.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                                                    {lang === 'zh' ? '待改进 (Areas for Improvement)' : 'Areas for Improvement'}
                                                </div>
                                                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                                    {result.Feedback_Improvements.map((item, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Actionable Advice */}
                                        {result.Actionable_Advice && result.Actionable_Advice.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#1d4ed8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6' }}></div>
                                                    {lang === 'zh' ? '提升策略 (Actionable Strategies)' : 'Actionable Strategies'}
                                                </div>
                                                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                                    {result.Actionable_Advice.map((item, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Tasks */}
                                        {result.Feedback_Tasks && result.Feedback_Tasks.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#6d28d9', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></div>
                                                    {lang === 'zh' ? '具体任务 (Specific Tasks)' : 'Specific Tasks'}
                                                </div>
                                                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                                    {result.Feedback_Tasks.map((item, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Path */}
                                        {result.Feedback_Path && result.Feedback_Path.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#0f766e', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#14b8a6' }}></div>
                                                    {lang === 'zh' ? '提分路径 (Path to Improvement)' : 'Path to Improvement'}
                                                </div>
                                                <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px', color: '#475569', fontSize: '0.95rem' }}>
                                                    {result.Feedback_Path.map((item, idx) => <li key={idx} style={{ lineHeight: 1.5 }}>{item}</li>)}
                                                </ul>
                                            </div>
                                        )}

                                        {/* Legacy Feedback Fallback */}
                                        {(result.Feedback || result.feedback) && !(result.Feedback_Strengths) && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#94a3b8' }}></div>
                                                    {lang === 'zh' ? '考官点评 (Examiner Feedback)' : 'Examiner Feedback'}
                                                </div>
                                                <div style={{ paddingLeft: '14px', borderLeft: '2px solid #f1f5f9', marginLeft: '3px' }}>
                                                    {(result.Feedback || result.feedback || '').split('\n').map((line, idx) => (
                                                        <p key={idx} style={{ marginBottom: '8px', lineHeight: 1.6, color: '#475569', fontSize: '0.95rem' }}>{line}</p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Accordions for Detailed Criteria */}
                                        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {[
                                                { key: 'TR', label: lang === 'zh' ? (taskType === 'task1' ? '任务完成情况 (Task Achievement)' : '任务回应情况 (Task Response)') : 'Task Response', content: result.Feedback_TR },
                                                { key: 'CC', label: lang === 'zh' ? '连贯与衔接 (Coherence & Cohesion)' : 'Coherence & Cohesion', content: result.Feedback_CC },
                                                { key: 'LR', label: lang === 'zh' ? '词汇资源 (Lexical Resource)' : 'Lexical Resource', content: result.Feedback_LR },
                                                { key: 'GRA', label: lang === 'zh' ? '语法多样性及准确性 (Grammatical Range)' : 'Grammatical Range', content: result.Feedback_GRA }
                                            ].map(crit => crit.content ? (
                                                <div key={crit.key} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                                    <button 
                                                        onClick={() => setExpandedCriteria(p => ({...p, [crit.key]: !p[crit.key]}))}
                                                        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: expandedCriteria[crit.key] ? '#f8fafc' : '#ffffff', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.2s' }}
                                                    >
                                                        <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{crit.label}</span>
                                                        {expandedCriteria[crit.key] ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                                                    </button>
                                                    {expandedCriteria[crit.key] && (
                                                        <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', background: '#ffffff', color: '#475569', fontSize: '0.95rem', lineHeight: 1.6 }}>
                                                            {crit.content.split('\n').map((line, idx) => <p key={idx} style={{ marginBottom: '8px' }}>{line}</p>)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : null)}
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>
                ) : (
                    <div className="wc-body">
                    {/* Left: Editor */}
                    <div className="wc-editor-card wc-card-left">

                        {/* Scrollable content: type switcher + sections */}
                        <div className="wc-editor-scroll">

                        {/* Task type switcher */}
                        <div className="wc-type-switcher">
                            <button
                                className={`wc-type-btn${taskType === 'task1' ? ' active' : ''}`}
                                onClick={() => { setTaskType('task1'); setResult(null); }}
                                disabled={isEvaluating}
                            >
                                {t.writingCorrection.task1Btn}
                            </button>
                            <button
                                className={`wc-type-btn${taskType === 'task2' ? ' active' : ''}`}
                                onClick={() => { setTaskType('task2'); setResult(null); }}
                                disabled={isEvaluating}
                            >
                                {t.writingCorrection.task2Btn}
                            </button>
                        </div>

                        {/* Prompt (optional) */}
                        <div className="wc-section">
                            <label className="wc-section-label">
                                {t.writingCorrection.promptLabel}
                                <span className="wc-optional-tag">{t.writingCorrection.optionalTag}</span>
                            </label>
                            <textarea
                                className="wc-textarea wc-textarea--prompt"
                                placeholder={t.writingCorrection.promptPlaceholder}
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                disabled={isEvaluating}
                            />
                        </div>

                        {/* Task1 image helper (only for vision-capable model) */}
                        {taskType === 'task1' && (
                            <div className="wc-section">
                                <div className="wc-section-head">
                                    <label className="wc-section-label">{t.writingCorrection.task1ImageLabel}</label>
                                    <span className="wc-optional-tag">{t.writingCorrection.optionalTag}</span>
                                </div>

                                {showTask1ImageUpload ? (
                                    <>
                                        <input
                                            ref={task1ImageInputRef}
                                            type="file"
                                            accept="image/png,image/jpeg,image/jpg,image/webp"
                                            className="wc-task1-image-input"
                                            onChange={handleTask1ImageInputChange}
                                            disabled={isEvaluating}
                                        />

                                        <div
                                            className={`wc-task1-image-dropzone${isTask1ImageDragOver ? ' drag-over' : ''}${isEvaluating ? ' disabled' : ''}`}
                                            onDragOver={(event) => {
                                                event.preventDefault();
                                                if (!isEvaluating) {
                                                    setIsTask1ImageDragOver(true);
                                                }
                                            }}
                                            onDragLeave={(event) => {
                                                event.preventDefault();
                                                const related = event.relatedTarget as Node | null;
                                                if (!related || !event.currentTarget.contains(related)) {
                                                    setIsTask1ImageDragOver(false);
                                                }
                                            }}
                                            onDrop={handleTask1ImageDrop}
                                        >
                                            <div className="wc-task1-image-drop-title">{t.writingCorrection.task1ImageDropHint}</div>
                                            <div className="wc-task1-image-drop-subtitle">{t.writingCorrection.task1ImageHint}</div>
                                            <div className="wc-task1-image-actions">
                                                <button
                                                    type="button"
                                                    className="wc-task1-image-btn"
                                                    onClick={() => task1ImageInputRef.current?.click()}
                                                    disabled={isEvaluating}
                                                >
                                                    {task1ImageDataUrl ? t.writingCorrection.task1ImageReplaceBtn : t.writingCorrection.task1ImageSelectBtn}
                                                </button>
                                                {task1ImageDataUrl && (
                                                    <button
                                                        type="button"
                                                        className="wc-task1-image-btn ghost"
                                                        onClick={() => {
                                                            setTask1ImageDataUrl('');
                                                            setTask1ImageName('');
                                                        }}
                                                        disabled={isEvaluating}
                                                    >
                                                        {t.writingCorrection.task1ImageRemoveBtn}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {task1ImageDataUrl && (
                                            <div className="wc-task1-image-preview-wrap">
                                                <img
                                                    src={task1ImageDataUrl}
                                                    alt={t.writingCorrection.task1ImagePreviewAlt}
                                                    className="wc-task1-image-preview"
                                                />
                                                <div className="wc-task1-image-name">{task1ImageName}</div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="wc-task1-image-vision-hint">
                                        {t.writingCorrection.task1ImageVisionOnlyHint}
                                    </div>
                                )}
                            </div>
                        )}

                        </div>{/* end wc-editor-scroll */}
                    </div>

                    {/* Right: Essay Content */}
                    <div className="wc-editor-card wc-card-right" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div className="wc-editor-scroll">
                            {/* Essay */}
                            <div className="wc-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                                <div className="wc-section-head">
                                    <label className="wc-section-label">{t.writingCorrection.yourEssay}</label>
                                    <span className="wc-word-count">
                                        {t.writingCorrection.wordCount}<strong>{wordCount}</strong> / {minWords}+
                                    </span>
                                </div>
                                <textarea
                                    className="wc-textarea wc-textarea--essay"
                                    placeholder={t.writingCorrection.placeholder}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    disabled={isEvaluating}
                                    style={{ flex: 1, minHeight: '400px' }}
                                />
                                <div className="wc-word-bar" style={{ marginTop: 'auto' }}>
                                    <div
                                        className="wc-word-bar-fill"
                                        style={{ width: `${Math.min((wordCount / minWords) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Submit footer — pinned at bottom */}
                        <div className="wc-footer">
                            <button
                                className={`wc-eval-btn premium-btn${isEvaluating ? ' loading' : ''}`}
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                            >
                                {isEvaluating ? t.writingCorrection.evaluatingBtn : t.writingCorrection.evaluateBtn}
                            </button>
                        </div>

                        {/* Overlay Animation during evaluation */}
                        {isEvaluating && (
                            <div className="wc-result-placeholder" style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderRadius: 0, height: '100%', minHeight: '100%' }}>
                                <div className="wc-ai-pulsing-core">AI</div>
                                <h3>{lang === 'zh' ? '正在深度批改中' : 'Evaluating your essay'}</h3>
                                <p style={{ color: '#475569', fontWeight: 500 }}>{lang === 'zh' ? 'AI 正在逐字句分析您的作文并提供高级词汇替换，请稍候...' : 'AI is analyzing your essay sentence by sentence and preparing advanced vocabulary upgrades, please wait...'}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </Layout>
);
}
