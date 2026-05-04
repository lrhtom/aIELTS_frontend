import Layout from '../../components/layout/Layout';
import { useState, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector, { type AIProvider } from '../../components/common/AiModelSelector';
import { showToast } from '../../components/common/Toast';
import { api } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
import '../../styles/practice_page.css';
import '../../styles/writing_correction.css';
import { type WritingTaskType, type CorrectionResponse } from '../../types/writing_page';

const TASK1_IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const TASK1_IMAGE_ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

export default function WritingCorrectionPage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [text, setText] = useState('');
    const [promptText, setPromptText] = useState('');
    const [taskType, setTaskType] = useState<WritingTaskType>('task2');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<CorrectionResponse | null>(null);
    const [copied, setCopied] = useState(false);
    const [provider, setProvider] = useState<AIProvider>(() => {
        const localProvider = localStorage.getItem('ai_provider') as AIProvider | null;
        return localProvider || 'deepseek';
    });
    const [task1ImageDataUrl, setTask1ImageDataUrl] = useState('');
    const [task1ImageName, setTask1ImageName] = useState('');
    const [isTask1ImageDragOver, setIsTask1ImageDragOver] = useState(false);
    const task1ImageInputRef = useRef<HTMLInputElement | null>(null);

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
            showToast(t.writingCorrection.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Submit writing correction error:', err);
            const error = err as { message?: string; title?: string };
            showToast(error.message || t.writingCorrection.toastFail, 'error', error.title || t.writingCorrection.toastErrorTitle);
        } finally {
            setIsEvaluating(false);
        }
    };

    const scores = result ? [
        { label: taskType === 'task1' ? t.writingCorrection.taTask1 : t.writingCorrection.ta, val: result.Task_Response },
        { label: t.writingCorrection.cc, val: result.Coherence_Cohesion },
        { label: t.writingCorrection.lr, val: result.Lexical_Resource },
        { label: t.writingCorrection.gra, val: result.Grammatical_Range },
    ] : [];

    return (
        <Layout>
            <div className="wc-page">

                {/* Header */}
                <div className="wc-header">
                    <div className="wc-header-title">
                        <button className="back-link" onClick={() => navigate('/writing')}>
                            {t.writingCorrection.backToHall}
                        </button>
                        <h1>{t.writingCorrection.title}</h1>
                        <p>{t.writingCorrection.subtitle}</p>
                    </div>
                    <div className="wc-model-box">
                        <AiModelSelector onModelChange={(nextProvider) => setProvider(nextProvider)} />
                    </div>
                </div>

                {/* Main body */}
                <div className="wc-body">

                    {/* Left: Editor */}
                    <div className="wc-editor-card">

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

                        {/* Essay */}
                        <div className="wc-section">
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
                            />
                            <div className="wc-word-bar">
                                <div
                                    className="wc-word-bar-fill"
                                    style={{ width: `${Math.min((wordCount / minWords) * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        </div>{/* end wc-editor-scroll */}

                        {/* Submit footer — pinned at bottom */}
                        <div className="wc-footer">
                            <button
                                className={`wc-eval-btn${isEvaluating ? ' loading' : ''}`}
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                            >
                                {isEvaluating ? t.writingCorrection.evaluatingBtn : t.writingCorrection.evaluateBtn}
                            </button>
                        </div>
                    </div>

                    {/* Right: Result or Pending Placeholder */}
                    {result ? (
                        <div className="wc-result-card">

                            {/* Task1-only model image capability status */}
                            {taskType === 'task1' && (
                                <div className={`wc-task1-image-support-status${supportsTask1ImageRecognition ? ' supported' : ' unsupported'}`}>
                                    {supportsTask1ImageRecognition
                                        ? t.writingCorrection.task1ImageModelSupportYes
                                        : t.writingCorrection.task1ImageModelSupportNo}
                                </div>
                            )}

                            {/* Overall band */}
                            <div className="wc-band-display">
                                <div className="wc-band-label">{t.writingCorrection.overallBand}</div>
                                <div className="wc-band-value">{result.Overall_Band.toFixed(1)}</div>
                                <div className="wc-band-subtitle">{t.writingCorrection.overallBandSubtitle}</div>
                            </div>

                            {/* Sub-scores */}
                            <div className="wc-scores-grid">
                                {scores.map(({ label, val }) => (
                                    <div key={label} className="wc-score-item">
                                        <div className="wc-score-label">{label}</div>
                                        <div className="wc-score-val">{val.toFixed(1)}</div>
                                        <div className="wc-score-bar">
                                            <div className="wc-score-bar-fill" style={{ width: `${(val / 9) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Feedback */}
                            <div className="wc-feedback-box">
                                <h3>{t.writingCorrection.examinerFeedback}</h3>
                                <div className="wc-feedback-content">
                                    {(result.Feedback || result.feedback || '').split('\n').map((line, idx) => (
                                        <p key={idx}>{line}</p>
                                    ))}
                                </div>
                            </div>

                            {/* Model essay */}
                            {result.Model_Essay && (
                                <div className="wc-model-essay-box">
                                    <div className="wc-model-essay-header">
                                        <div>
                                            <span className="wc-model-essay-badge">{t.writingCorrection.modelEssayBadge}</span>
                                            <h3>{t.writingCorrection.modelEssayTitle}</h3>
                                        </div>
                                        <button
                                            className={`wc-copy-btn${copied ? ' copied' : ''}`}
                                            onClick={() => {
                                                navigator.clipboard.writeText(result.Model_Essay!);
                                                setCopied(true);
                                                setTimeout(() => setCopied(false), 2000);
                                            }}
                                        >
                                            {copied ? t.writingCorrection.copiedBtn : t.writingCorrection.copyBtn}
                                        </button>
                                    </div>
                                    <div className="wc-model-essay-content">
                                        {result.Model_Essay.split(/\n\n+/).map((para, idx) => (
                                            <p key={idx}>{para.trim()}</p>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    ) : isEvaluating ? (
                        <div className="wc-pending-card">
                            <div className="wc-pending-inner">
                                <div className="wc-loading-spinner" />
                                <div className="wc-pending-title">
                                    {t.writingCorrection.evaluatingTitle}
                                </div>
                                <div className="wc-pending-desc">
                                    {t.writingCorrection.evaluatingDesc}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="wc-pending-card">
                            <div className="wc-pending-inner">
                                <div className="wc-pending-icon">📋</div>
                                <div className="wc-pending-title">
                                    {t.writingCorrection.pendingTitle}
                                </div>
                                <div className="wc-pending-desc">
                                    {t.writingCorrection.pendingDesc}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
