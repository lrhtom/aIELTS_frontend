import Layout from '../../components/layout/Layout';
import { useState, useMemo, useRef, useEffect, type ChangeEvent, type DragEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import translate from 'translate';
translate.engine = 'google';
import AiModelSelector, { type AIProvider } from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import { sanitize } from '../../utils/safe_html';
import { ChevronDown, ChevronUp } from 'lucide-react';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import '../../styles/writing_correction_result.css';
import { type WritingTaskType, type CorrectionResponse } from '../../types/writing_page';

interface BankAutoEvaluateState {
    bankId?: number;
    autoEvaluate?: boolean;
    text?: string;
    prompt?: string;
    taskType?: WritingTaskType;
    subtype?: string;
    task1ImageDataUrl?: string;
}

const TASK1_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const TASK1_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export default function WritingCorrectionPage() {
    const { lang } = useLang();
    const t = translations[lang];

    const [text, setText] = useState('');
    const [promptText, setPromptText] = useState('');
    const [taskType, setTaskType] = useState<WritingTaskType>('task2');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [activeTab, setActiveTab] = useState<'sentence' | 'vocab' | 'improved' | 'model' | 'stats'>('sentence');
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
    const [searchParams] = useSearchParams();
    const bankIdParam = searchParams.get('bankId');
    const bankIdFromUrl = bankIdParam ? Number(bankIdParam) : null;
    // 全套模拟：从大厅「查看结果」进来 → 返回改回大厅、禁用重做
    const mockIdParam = searchParams.get('mockId');
    const mockId = mockIdParam ? Number(mockIdParam) : null;
    const navState = (location.state || null) as (BankAutoEvaluateState & { record_id?: number }) | null;
    const [recordId, setRecordId] = useState<number | undefined>(navState?.record_id);
    const [bankId, setBankId] = useState<number | null>(bankIdFromUrl ?? navState?.bankId ?? null);
    const [bankSubtype, setBankSubtype] = useState<string>(navState?.subtype || '');
    const [isSaved, setIsSaved] = useState(!!recordId);
    // Trigger refs prevent the StrictMode double-mount from re-firing AI calls / bank load.
    const hasLoadedBankRef = useRef<number | null>(null);
    const hasAutoEvaluatedRef = useRef(false);

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
                .catch(() => {
                    showToast(t.writingCorrection.loadRecordFail, 'error');
                });
        }
    }, []); // Only run once on mount since recordId is now state

    // Bank mode: load saved correction by bankId query param
    useEffect(() => {
        if (!bankIdFromUrl) return;
        if (hasLoadedBankRef.current === bankIdFromUrl) return;
        hasLoadedBankRef.current = bankIdFromUrl;

        getAIQuestion(bankIdFromUrl).then(detail => {
            const content = (detail.content || {}) as { prompt?: string };
            const inferredTaskType: WritingTaskType = (detail.subtype || '').startsWith('chart:') ? 'task1' : 'task2';
            setPromptText(content.prompt || '');
            setTaskType(inferredTaskType);
            setBankId(bankIdFromUrl);
            setBankSubtype(detail.subtype || '');
            if (typeof detail.userAnswer === 'string') setText(detail.userAnswer);
            const feedback = (detail.aiFeedback || null) as CorrectionResponse | null;
            if (feedback && feedback.Overall_Band !== undefined) {
                setResult(feedback);
            }
        }).catch(err => {
            console.error('Bank correction load failed:', err);
            showToast(t.writingCorrection.loadBankFail, 'error');
            navigate('/practice/ai/bank');
        });
    }, [bankIdFromUrl, lang, navigate]);

    // Auto-evaluate flow: practice page → correction page with prefilled essay
    useEffect(() => {
        if (!navState?.autoEvaluate) return;
        if (hasAutoEvaluatedRef.current) return;
        hasAutoEvaluatedRef.current = true;

        const inferredTaskType: WritingTaskType = navState.taskType
            || ((navState.subtype || '').startsWith('chart:') ? 'task1' : 'task2');
        setText(navState.text || '');
        setPromptText(navState.prompt || '');
        setTaskType(inferredTaskType);
        if (navState.task1ImageDataUrl) {
            setTask1ImageDataUrl(navState.task1ImageDataUrl);
            setTask1ImageName('chart.png');
        }
        if (navState.bankId) {
            setBankId(navState.bankId);
            setBankSubtype(navState.subtype || '');
        }
        const txt = (navState.text || '').trim();
        if (!txt) return;
        setTimeout(() => {
            triggerEvaluate(
                navState.text || '',
                navState.prompt || '',
                inferredTaskType,
                navState.bankId || null,
                navState.task1ImageDataUrl || null,
            );
        }, 0);
    }, [navState]);

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

    const triggerEvaluate = async (
        essayText: string,
        promptStr: string,
        currentTaskType: WritingTaskType,
        currentBankId: number | null,
        overrideTask1ImageDataUrl: string | null = null,
    ) => {
        if (!essayText.trim()) {
            showToast(t.writingCorrection.toastEmpty, 'error');
            return;
        }
        setIsEvaluating(true);
        setResult(null);
        try {
            const payload: Record<string, unknown> = {
                text: essayText,
                prompt: promptStr,
                task_type: currentTaskType,
                lang,
            };

            const imageForTask1 = overrideTask1ImageDataUrl ?? (showTask1ImageUpload ? task1ImageDataUrl : '');
            if (currentTaskType === 'task1' && imageForTask1) {
                payload.task1_image_data_url = imageForTask1;
            }

            const res = await api<CorrectionResponse>('/writing/generate', {
                method: 'POST',
                body: payload,
            });
            setResult(res);
            setIsSaved(true);
            showToast(t.writingCorrection.toastSuccess, 'success');

            if (currentBankId) {
                submitAIQuestion(currentBankId, essayText, res).catch(err => {
                    console.error('Bank submit failed:', err);
                    showToast(t.writingCorrection.saveBankFail, 'error');
                });
                return;
            }

            // Non-bank path: auto-save to writing records
            try {
                const saveRes = await api<{status: string, id: number}>('/writing/records', {
                    method: 'POST',
                    body: {
                        service_type: 'correction',
                        title: promptStr ? (promptStr.slice(0, 30) + '...') : t.writingCorrection.untitledFallback,
                        content: {
                            result: res,
                            text: essayText,
                            prompt: promptStr,
                            task_type: currentTaskType,
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

    const handleEvaluate = () => {
        triggerEvaluate(text, promptText, taskType, bankId);
    };

    const handleRedoFromBank = () => {
        if (!bankId) return;
        const isChart = bankSubtype.startsWith('chart:');
        navigate(isChart ? `/writing/chart/doing?bankId=${bankId}` : `/writing/task2/doing?bankId=${bankId}`);
    };

    const handleBack = () => {
        navigate('/writing/ai-teachers');
    };

    const scores = result ? [
        { label: taskType === 'task1' ? t.writingCorrection.taTask1 : t.writingCorrection.taTr, val: result.Task_Response },
        { label: t.writingCorrection.ccLabelZh, val: result.Coherence_Cohesion },
        { label: t.writingCorrection.lrLabelZh, val: result.Lexical_Resource },
        { label: t.writingCorrection.graLabelZh, val: result.Grammatical_Range },
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
            <p key={idx} className="wc-essay-paragraph" dangerouslySetInnerHTML={{ __html: sanitize(para) }} />
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
            backUrl={mockId ? `/mock/${mockId}` : (bankId ? '/practice/ai/bank' : (recordId ? "/writing/ai-teachers/records" : "/writing"))}
            backText={mockId ? t.mock.examMode.backToHub : (bankId ? t.writingCorrection.backAiBank : (recordId ? t.writingCorrection.backRecords : t.writingCorrection.backToHall))}
            onBack={mockId ? () => navigate(`/mock/${mockId}`) : (bankId ? () => navigate('/practice/ai/bank') : handleBack)}
            headerRight={
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {bankId && result && !mockId && (
                        <button
                            type="button"
                            className="wp-ghost-btn"
                            onClick={handleRedoFromBank}
                            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                        >
                            🔁 {t.writingCorrection.redoBtn}
                        </button>
                    )}
                    {!recordId && !bankId && <AiModelSelector variant="minimal" onModelChange={(nextProvider) => setProvider(nextProvider)} />}
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
                                    <div className="wc-panel-title">✍️ {t.writingCorrection.annotatedEssayTitle}</div>
                                </div>
                                
                                {/* Essay Prompt Placeholder */}
                                <div style={{ padding: '24px 32px 0 32px', color: '#475569', fontSize: '0.95rem', fontStyle: 'italic', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '8px', color: '#334155' }}>📝 {t.writingCorrection.promptSectionTitle}</div>
                                    {promptText || t.writingCorrection.noPromptMessage}
                                </div>

                                <div className="wc-essay-content" onClick={handleEssayClick}>
                                    {renderAnnotatedText()}
                                </div>
                            </div>

                            {/* 2. Middle: Corrections & Feedback Tabs */}
                            <div className="wc-corrections-panel">
                                <div className="wc-tabs">
                                    {result.Sentence_Corrections && result.Sentence_Corrections.length > 0 && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'sentence' ? ' active' : ''}`} onClick={() => setActiveTab('sentence')}>{t.writingCorrection.tabSentence}</button>
                                    )}
                                    {result.Vocabulary_Upgrades && result.Vocabulary_Upgrades.length > 0 && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'vocab' ? ' active' : ''}`} onClick={() => setActiveTab('vocab')}>{t.writingCorrection.tabVocab}</button>
                                    )}
                                    {result.Revised_Essay && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'improved' ? ' active' : ''}`} onClick={() => setActiveTab('improved')}>{t.writingCorrection.tabImproved}</button>
                                    )}
                                    {result.Model_Essay && (
                                        <button type="button" className={`wc-tab-btn${activeTab === 'model' ? ' active' : ''}`} onClick={() => setActiveTab('model')}>{t.writingCorrection.tabModel}</button>
                                    )}
                                    <button type="button" className={`wc-tab-btn${activeTab === 'stats' ? ' active' : ''}`} onClick={() => setActiveTab('stats')}>{t.writingCorrection.tabStats}</button>
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
                                                            {t.writingCorrection.origLabel}
                                                        </span>
                                                        <span style={{ textDecoration: 'line-through', color: 'var(--color-text-dim)' }}>{corr.original}</span>
                                                    </div>
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#10b981', fontWeight: 600, marginRight: '8px' }}>
                                                            {t.writingCorrection.improvedLabel}
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
                                                    <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{t.writingCorrection.transEnBtn}</button>
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
                                                        {t.writingCorrection.transZhBtn}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t.writingCorrection.transLoading}</div>
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
                                                    <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{t.writingCorrection.transEnBtn}</button>
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
                                                        {t.writingCorrection.transZhBtn}
                                                    </button>
                                                </div>
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t.writingCorrection.transLoading}</div>
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
                                            {t.writingCorrection.comprehensiveEval}
                                        </h3>
                                        
                                        {/* Strengths */}
                                        {result.Feedback_Strengths && result.Feedback_Strengths.length > 0 && (
                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontWeight: 600, color: '#15803d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></div>
                                                    {t.writingCorrection.strengths}
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
                                                    {t.writingCorrection.areasForImprovement}
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
                                                    {t.writingCorrection.actionableStrategies}
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
                                                    {t.writingCorrection.specificTasks}
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
                                                    {t.writingCorrection.pathToImprovement}
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
                                                    {t.writingCorrection.examinerFeedbackTab}
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
                                                { key: 'TR', label: taskType === 'task1' ? t.writingCorrection.trFeedbackLabelTask1 : t.writingCorrection.trFeedbackLabelTask2, content: result.Feedback_TR },
                                                { key: 'CC', label: t.writingCorrection.ccFeedbackLabel, content: result.Feedback_CC },
                                                { key: 'LR', label: t.writingCorrection.lrFeedbackLabel, content: result.Feedback_LR },
                                                { key: 'GRA', label: t.writingCorrection.graFeedbackLabel, content: result.Feedback_GRA }
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
                                <h3>{t.writingCorrection.evaluatingHeading}</h3>
                                <p style={{ color: '#475569', fontWeight: 500 }}>{t.writingCorrection.evaluatingSubMsg}</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    </Layout>
);
}
