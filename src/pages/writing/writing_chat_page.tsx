import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ATInterceptor } from '../../api/atInterceptor';
import { useLang } from '../../i18n/LanguageContext';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import '../../styles/writing_chat.css';

// ── Types ──────────────────────────────────────────────────────────────────
type Role = 'user' | 'assistant' | 'system';

interface ChatAttachment {
    name: string;
    type: 'image' | 'file';
    dataUrl: string;
}

interface ChatMessage {
    role: Role;
    content: string;
    attachments?: ChatAttachment[];
    correctedText?: string;
    scores?: {
        grammar?: number;
        vocab?: number;
        relevance?: number;
    };
}

interface Word {
    en: string;
    zh?: string;
    count: number;
}

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'writing_chat_history';

// ── Helpers ────────────────────────────────────────────────────────────────
function parseWords(raw: string): Word[] {
    if (!raw.trim()) return [];
    return raw.split('\n')
        .map(l => l.trim())
        .filter(l => l)
        .map(l => {
            const m = l.match(/^([a-zA-Z\s-]+)(.*)$/);
            if (!m) return null;
            return { en: m[1].trim(), zh: m[2].trim(), count: 0 };
        })
        .filter(Boolean) as Word[];
}

function countMatches(text: string, word: string): number {
    const rx = new RegExp(`\\b${word}\\b`, 'gi');
    return (text.match(rx) || []).length;
}

function loadHistory(): ChatMessage[] {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    } catch { return []; }
}

function saveHistory(history: ChatMessage[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* ignore */ }
}

function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function MarkdownBubble({ content, className = 'sc-markdown' }: { content: string; className?: string }) {
    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ children, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer">
                            {children}
                        </a>
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

export default function WritingChatPageWrapper() {
    return (
        <ErrorBoundary>
            <WritingChatPage />
        </ErrorBoundary>
    );
}

function WritingChatPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { t } = useLang();

    const state = location.state as { vocabInput?: string };
    const vocabRaw: string = state?.vocabInput ?? '';

    // ── State ──
    const [words, setWords] = useState<Word[]>(() => parseWords(vocabRaw));
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => loadHistory());
    const [textInput, setTextInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryText, setSummaryText] = useState<string | null>(null);
    const [wordSearch, setWordSearch] = useState('');
    const [expandedMsgs, setExpandedMsgs] = useState<Set<number>>(new Set());
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

    // ── Refs ──
    const wordsRef = useRef<Word[]>(parseWords(vocabRaw));
    const contextRef = useRef<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pendingRef = useRef(false);
    const restoredRef = useRef(chatHistory.length > 0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const setWordsSync = (fn: (p: Word[]) => Word[]) => {
        setWords(prev => { const n = fn(prev); wordsRef.current = n; return n; });
    };

    // ── Object URLs for preview ──
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    useEffect(() => {
        const urls = attachedFiles.map(f => URL.createObjectURL(f));
        setPreviewUrls(urls);
        return () => urls.forEach(u => URL.revokeObjectURL(u));
    }, [attachedFiles]);

    // ── Persist history to localStorage ──
    useEffect(() => {
        if (chatHistory.length > 0) saveHistory(chatHistory);
    }, [chatHistory]);

    // ── Init: system prompt + greeting ──────────────────────────────────────
    // The question also goes into the query (the image is too large, so it stays in state), so a refresh at least still knows the question
    // The backend writing_chat endpoint already injects the full system prompt via skill_writing_chat_system(),
    useEffect(() => {
        contextRef.current = [];

        if (restoredRef.current) return;

        const initChat = async () => {
            setIsGenerating(true);
            try {
                const res = await ATInterceptor.writingChat(contextRef.current as unknown as Record<string, unknown>[]);
                const reply = res.data.reply;
                const newMsg: ChatMessage = {
                    role: 'assistant',
                    content: reply,
                    correctedText: (res.data as { corrected_text?: string }).corrected_text || undefined,
                };
                contextRef.current.push({ role: 'assistant', content: reply });
                setChatHistory([{ ...newMsg }]);
            } catch (err: unknown) {
                const msg: ChatMessage = { role: 'assistant', content: `[System Error] ${(err as { message?: string }).message}` };
                contextRef.current.push({ role: 'assistant', content: msg.content });
                setChatHistory([{ ...msg }]);
            } finally {
                setIsGenerating(false);
            }
        };

        initChat();
    }, []);

    // ── Scroll to bottom ──
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatHistory, isGenerating, summaryText]);

    // ── Attachment handlers ──
    const handleAttach = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFilesSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setAttachedFiles(prev => [...prev, ...Array.from(files)]);
        // Reset input so the same file can be re-selected
        e.target.value = '';
    }, []);

    const handleRemoveAttachment = useCallback((idx: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== idx));
    }, []);

    // ── Actions ──
    const handleSend = async () => {
        const text = textInput.trim();
        const hasFiles = attachedFiles.length > 0;
        if (!text && !hasFiles) return;
        if (pendingRef.current || isGenerating || isSummarizing) return;

        pendingRef.current = true;
        setIsGenerating(true);

        // Convert files to storable attachments
        const attachments: ChatAttachment[] = [];
        for (const f of attachedFiles) {
            const dataUrl = await fileToDataUrl(f);
            attachments.push({
                name: f.name,
                type: f.type.startsWith('image/') ? 'image' : 'file',
                dataUrl,
            });
        }

        const newMsg: ChatMessage = {
            role: 'user',
            content: text || '',
            attachments: attachments.length > 0 ? attachments : undefined,
        };
        contextRef.current.push({ role: 'user', content: text || '' });
        setChatHistory(prev => [...prev, newMsg]);
        setTextInput('');
        setAttachedFiles([]);

        if (wordsRef.current.length > 0 && text) {
            setWordsSync(prev => prev.map(w => ({
                ...w,
                count: w.count + countMatches(text, w.en),
            })));
        }

        try {
            const messages = contextRef.current as unknown as Record<string, unknown>[];
            const res = hasFiles
                ? await ATInterceptor.writingChatWithFiles(messages, attachedFiles)
                : await ATInterceptor.writingChat(messages);
            const data = res.data;
            const replyMsg: ChatMessage = {
                role: 'assistant',
                content: data.reply,
                correctedText: (data as { corrected_text?: string }).corrected_text || undefined,
                scores: {
                    grammar: data.grammar_score,
                    vocab: data.vocab_score,
                    relevance: data.relevance_score,
                },
            };
            contextRef.current.push({ role: 'assistant', content: data.reply });
            setChatHistory(prev => [...prev, replyMsg]);
        } catch (err: unknown) {
            const replyMsg: ChatMessage = {
                role: 'assistant',
                content: `[API Error] ${(err as { message?: string }).message}`,
            };
            contextRef.current.push({ role: 'assistant', content: replyMsg.content });
            setChatHistory(prev => [...prev, replyMsg]);
        } finally {
            pendingRef.current = false;
            setIsGenerating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const toggleMsg = (idx: number) => {
        setExpandedMsgs(prev => {
            const n = new Set(prev);
            if (n.has(idx)) n.delete(idx);
            else n.add(idx);
            return n;
        });
    };

    const handleClearChat = () => {
        setChatHistory([]);
        setSummaryText(null);
        setExpandedMsgs(new Set());
        setAttachedFiles([]);
        contextRef.current = contextRef.current.filter(m => m.role === 'system');
        localStorage.removeItem(STORAGE_KEY);
    };

    const handleEndAndSummary = async () => {
        if (chatHistory.length === 0 || isSummarizing) return;
        setIsSummarizing(true);
        try {
            const summaryMsg = { role: 'user' as const, content: 'Please now provide a final summary of our writing practice session. Include an overall assessment of my writing, my strengths, areas to improve, and specific advice for future practice. Format your response as JSON with keys: summary, overall_score, strengths, weaknesses, advice.' };
            const messages = [...contextRef.current, summaryMsg];
            const res = await ATInterceptor.writingChat(messages as unknown as Record<string, unknown>[]);
            setSummaryText(res.data.reply);
        } catch {
            setSummaryText('Failed to generate summary. Please try again.');
        } finally {
            setIsSummarizing(false);
        }
    };

    return (
        <div className="sc-container">
            <div className="sc-header">
                <button className="sc-back-btn" onClick={() => navigate('/writing/chat-config')}>
                    {t('writingChat.backToConfig')}
                </button>
                <div className="sc-action-bar">
                    <button
                        className="sc-clear-chat-btn"
                        onClick={handleClearChat}
                        disabled={isGenerating || isSummarizing}
                    >
                        {t('writingChat.clearChat')}
                    </button>
                    <button
                        className="sc-summary-btn"
                        onClick={handleEndAndSummary}
                        disabled={isGenerating || isSummarizing || chatHistory.length === 0}
                    >
                        {isSummarizing ? t('writingChat.summarizing') : t('writingChat.endSummary')}
                    </button>
                </div>
            </div>

            <div className="sc-layout">
                <div className="sc-main">
                    <div className="sc-chat-area">
                        {chatHistory.map((msg, i) => {
                            const isUser = msg.role === 'user';
                            const isExpanded = expandedMsgs.has(i);
                            const hasScores = msg.scores && (msg.scores.grammar !== undefined);
                            const hasCorrected = !!msg.correctedText;
                            const hasAttachments = msg.attachments && msg.attachments.length > 0;

                            return (
                                <div key={i} className={`sc-msg-wrapper ${isUser ? 'user' : 'assistant'}`}>
                                    <div className="sc-msg-bubble">
                                        {isUser && hasAttachments && (
                                            <div className="sc-attachment-grid">
                                                {msg.attachments!.map((att, j) =>
                                                    att.type === 'image' ? (
                                                        <img
                                                            key={j}
                                                            src={att.dataUrl}
                                                            alt={att.name}
                                                            className="sc-attachment-img"
                                                        />
                                                    ) : (
                                                        <div key={j} className="sc-attachment-file">
                                                            <span className="sc-attachment-file-icon">📄</span>
                                                            <span className="sc-attachment-file-name">{att.name}</span>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        )}
                                        {isUser && msg.content ? (
                                            <div className="sc-msg-text">{msg.content}</div>
                                        ) : !isUser ? (
                                            <>
                                                <MarkdownBubble content={msg.content} />
                                                {hasCorrected && (
                                                    <div className="sc-corrected-block">
                                                        <span className="sc-corrected-label">{t('writingChat.correctedVersion')}</span>
                                                        <MarkdownBubble content={msg.correctedText!} className="sc-corrected-text" />
                                                    </div>
                                                )}
                                            </>
                                        ) : null}
                                        {hasScores && (
                                            <div className="sc-msg-actions">
                                                <button onClick={() => toggleMsg(i)} className="sc-score-toggle">
                                                    {isExpanded ? t('writingChat.hideScores') : t('writingChat.viewScores')}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {isExpanded && hasScores && (
                                        <div className="sc-scores-panel">
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">{t('writingChat.grammarScore')}</span>
                                                <span className="sc-score-val">{msg.scores!.grammar}</span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">{t('writingChat.vocabScore')}</span>
                                                <span className="sc-score-val">{msg.scores!.vocab}</span>
                                            </div>
                                            <div className="sc-score-item">
                                                <span className="sc-score-label">{t('writingChat.relevanceScore')}</span>
                                                <span className="sc-score-val">{msg.scores!.relevance}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {isGenerating && (
                            <div className="sc-msg-wrapper assistant">
                                <div className="sc-msg-bubble loading-bubble">
                                    <span className="sc-dot"></span>
                                    <span className="sc-dot"></span>
                                    <span className="sc-dot"></span>
                                    <span className="sc-loading-text">{t('writingChat.generating')}</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} style={{ height: 1 }} />
                    </div>

                    {/* ── Summary overlay ── */}
                    {summaryText && (
                        <div className="sc-summary-overlay">
                            <div className="sc-summary-content">
                                <h3>{t('writingChat.summaryTitle')}</h3>
                                <MarkdownBubble content={summaryText} className="sc-summary-text" />
                            </div>
                        </div>
                    )}

                    {/* ── Attachment previews ── */}
                    {previewUrls.length > 0 && (
                        <div className="sc-attachment-previews">
                            {previewUrls.map((url, i) => (
                                <div key={i} className="sc-attachment-preview">
                                    <img src={url} alt="" className="sc-attachment-thumb" />
                                    <button
                                        className="sc-attachment-remove"
                                        onClick={() => handleRemoveAttachment(i)}
                                        disabled={isGenerating || isSummarizing}
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="sc-text-input-panel">
                        <div className="sc-input-row">
                            <button
                                className="sc-attach-btn"
                                onClick={handleAttach}
                                disabled={isGenerating || isSummarizing}
                                title={t('writingChat.attachFiles')}
                            >
                                📎
                            </button>
                            <textarea
                                className="sc-text-input"
                                value={textInput}
                                onChange={(e) => setTextInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('writingChat.typePlaceholder')}
                                rows={3}
                                disabled={isGenerating || isSummarizing}
                            />
                            <button
                                className="sc-text-send-btn"
                                onClick={handleSend}
                                disabled={isGenerating || isSummarizing || (!textInput.trim() && attachedFiles.length === 0)}
                            >
                                {t('writingChat.sendBtn')}
                            </button>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFilesSelected}
                    />
                </div>

                {words.length > 0 && (
                    <div className="sc-sidebar">
                        <h3 className="sc-sidebar-title">{t('writingChat.targetVocab')}</h3>
                        <div className="sc-sidebar-search">
                            <input
                                className="sc-word-search"
                                type="text"
                                value={wordSearch}
                                onChange={(e) => setWordSearch(e.target.value)}
                                placeholder={t('writingChat.searchVocab')}
                            />
                        </div>
                        <div className="sc-word-list">
                            {words.filter(w =>
                                !wordSearch ||
                                w.en.toLowerCase().includes(wordSearch.toLowerCase()) ||
                                (w.zh && w.zh.includes(wordSearch))
                            ).map((w, i) => (
                                <div key={i} className={`sc-word-item ${w.count > 0 ? 'hit' : ''}`}>
                                    <div className="sc-word-en">{w.en}</div>
                                    {w.zh && <div className="sc-word-zh">{w.zh}</div>}
                                    <div className="sc-word-count">{w.count}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
