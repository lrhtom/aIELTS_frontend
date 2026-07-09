import { useEffect, useState, useRef, useCallback } from 'react';
import { showConfirm } from '../components/common/ConfirmService';
import Layout from '../components/layout/Layout';
import { showToast } from '../components/common/Toast';
import { useLang } from '../i18n/LanguageContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TagInput from '../components/vocabulary/TagInput';
import {
    listMarkdownNotes,
    createMarkdownNote,
    updateMarkdownNote,
    deleteMarkdownNote,
    getMarkdownNote,
    type MarkdownNote,
} from '../api/markdown_notes';
import '../styles/practice_page.css';
import '../styles/markdown_notes.css';

type PreviewMode = 'edit' | 'split' | 'preview';

const DRAFT_PREFIX = 'md-draft-';

/* ── Helpers ─────────────────────────────────────────── */

const CJK_RE = /[一-鿿㐀-䶿豈-﫿぀-ヿ가-힯]/g;

function getWordCount(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return { chars: 0, words: 0 };
    // Whitespace splitting alone counts a whole CJK paragraph as one word,
    // so CJK characters each count as a word and are excluded from the
    // whitespace-based count of the remaining (latin) text.
    const cjkCount = trimmed.match(CJK_RE)?.length ?? 0;
    const latinWords = trimmed.replace(CJK_RE, ' ').split(/\s+/).filter(Boolean).length;
    return { chars: trimmed.replace(/\s/g, '').length, words: cjkCount + latinWords };
}

/**
 * Uppercase lowercase sentence-initial letters: at line starts (after any
 * markdown prefixes like `#`/`-`/`>`/`1.`) and after `.` `!` `?`. Fenced code
 * blocks, inline code spans, and table rows are left untouched. Case changes
 * never alter length, so caller-held selection offsets stay valid.
 */
function capitalizeSentenceStarts(text: string): { result: string; count: number } {
    let count = 0;
    let inFence = false;
    const upper = (prefix: string, ch: string) => {
        count++;
        return prefix + ch.toUpperCase();
    };
    const lines = text.split('\n').map(line => {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
        }
        if (inFence || line.trimStart().startsWith('|')) return line;
        const parts = line.split('`');
        for (let i = 0; i < parts.length; i += 2) {
            parts[i] = parts[i].replace(/([.!?]["')\]]*\s+)([a-z])/g, (_, p, ch) => upper(p, ch));
        }
        parts[0] = parts[0].replace(
            /^(\s*(?:(?:#{1,6}|>+|[-*+]|\d+[.)])\s+)*)([a-z])/,
            (_, p, ch) => upper(p, ch),
        );
        return parts.join('`');
    });
    return { result: lines.join('\n'), count };
}

function getPreviewText(content: string, maxLen = 80) {
    // eslint-disable-next-line no-useless-escape
    const plain = content.replace(/[#*`>\[\]()!~|\\-_]/g, '').replace(/\s+/g, ' ').trim();
    return plain.length > maxLen ? plain.slice(0, maxLen) + '...' : plain;
}

type DateGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older';

function getDateGroup(dateStr: string): DateGroupKey {
    // Normalize both sides to local midnight — comparing a full timestamp
    // against today's midnight put this-morning's notes a day off.
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return 'thisWeek';
    return 'older';
}

function loadDraft(id: number) {
    try {
        const raw = sessionStorage.getItem(DRAFT_PREFIX + id);
        if (raw) return JSON.parse(raw) as { title: string; tags: string[]; content: string };
    } catch { /* ignore */ }
    return null;
}

function saveDraft(id: number, draft: { title: string; tags: string[]; content: string }) {
    sessionStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(draft));
}

function removeDraft(id: number) {
    sessionStorage.removeItem(DRAFT_PREFIX + id);
}

/* ── Create Modal ────────────────────────────────────── */

interface CreateModalProps {
    onConfirm: (title: string, content: string) => void;
    onCancel: () => void;
    creating: boolean;
}

function CreateModal({ onConfirm, onCancel, creating }: CreateModalProps) {
    const { translations: t, lang } = useLang();
    const [inputTitle, setInputTitle] = useState('');
    const [selectedTemplate, setSelectedTemplate] = useState('blank');
    const inputRef = useRef<HTMLInputElement>(null);

    const TEMPLATES: { id: string; label: string; icon: string; content: string }[] = [
        { id: 'blank', label: t.markdownNotes.templates.blank, icon: '📄', content: '' },
        { id: 'daily', label: t.markdownNotes.templates.daily, icon: '📅', content: `# ${new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}${t.markdownNotes.templates.dailyContent}` },
        { id: 'study', label: t.markdownNotes.templates.study, icon: '📚', content: t.markdownNotes.templates.studyContent },
        { id: 'vocab', label: t.markdownNotes.templates.vocab, icon: '🔤', content: t.markdownNotes.templates.vocabContent },
        { id: 'essay', label: t.markdownNotes.templates.essay, icon: '✍️', content: t.markdownNotes.templates.essayContent },
    ];

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const tpl = TEMPLATES.find(x => x.id === selectedTemplate)!;
        onConfirm(inputTitle.trim() || t.markdownNotes.untitled, tpl.content);
    };

    return (
        <div className="md-modal-overlay" onClick={onCancel}>
            <div className="md-modal" onClick={e => e.stopPropagation()}>
                <div className="md-modal-header">
                    <span className="md-modal-icon">✏️</span>
                    <h3>{t.markdownNotes.newNoteHeading}</h3>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="md-modal-field">
                        <label className="md-modal-label">{t.markdownNotes.titleLabel}</label>
                        <input
                            ref={inputRef}
                            className="md-modal-input"
                            type="text"
                            placeholder={t.markdownNotes.titleInputPlaceholder}
                            value={inputTitle}
                            onChange={e => setInputTitle(e.target.value)}
                            maxLength={100}
                        />
                    </div>

                    <div className="md-modal-field">
                        <label className="md-modal-label">{t.markdownNotes.templateLabel}</label>
                        <div className="md-modal-templates">
                            {TEMPLATES.map(tpl => (
                                <button
                                    key={tpl.id}
                                    type="button"
                                    className={`md-tpl-btn ${selectedTemplate === tpl.id ? 'active' : ''}`}
                                    onClick={() => setSelectedTemplate(tpl.id)}
                                >
                                    <span className="md-tpl-icon">{tpl.icon}</span>
                                    <span className="md-tpl-label">{tpl.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="md-modal-actions">
                        <button type="button" className="md-modal-cancel" onClick={onCancel}>
                            {t.common.cancel}
                        </button>
                        <button type="submit" className="md-modal-confirm" disabled={creating}>
                            {creating ? t.markdownNotes.creatingBtn : t.markdownNotes.createBtn}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ── Main Page ───────────────────────────────────────── */

export default function MarkdownNotesPage() {
    const { translations: t } = useLang();

    const [notes, setNotes] = useState<MarkdownNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [title, setTitle] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [content, setContent] = useState('');
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [previewMode, setPreviewMode] = useState<PreviewMode>('split');
    const [searchQuery, setSearchQuery] = useState('');
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    // Create modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const editorRef = useRef<HTMLTextAreaElement | null>(null);

    // Read the toast text through a ref so the fetch runs exactly once —
    // depending on the translated string re-fetched the whole list on every
    // language switch (and could clobber edits inside the draft debounce).
    const loadFailMsgRef = useRef(t.markdownNotes.loadFail);
    loadFailMsgRef.current = t.markdownNotes.loadFail;
    useEffect(() => {
        listMarkdownNotes()
            .then(res => setNotes(res.notes))
            .catch(() => showToast(loadFailMsgRef.current, 'error'))
            .finally(() => setLoading(false));
    }, []);

    const selectedNote = notes.find(n => n.id === selectedId) ?? null;

    const syncSelection = useCallback((note: MarkdownNote) => {
        const draft = loadDraft(note.id);
        if (draft) {
            setTitle(draft.title); setTags(draft.tags); setContent(draft.content); setDirty(true);
        } else {
            setTitle(note.title); setTags(note.tags); setContent(note.content); setDirty(false);
        }
    }, []);

    useEffect(() => {
        if (selectedNote) syncSelection(selectedNote);
    }, [selectedId, selectedNote, syncSelection]);

    // Auto-save draft to sessionStorage
    useEffect(() => {
        if (!selectedNote || loading) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        // This effect also fires when syncSelection programmatically loads a
        // note's stored values — without this guard, merely opening a note
        // created a phantom draft and flagged it as having unsaved changes.
        // When local state matches the stored note, drop any stale draft
        // (also self-heals phantom drafts, and reverting edits = clean).
        const clean = title === selectedNote.title
            && content === selectedNote.content
            && tags.length === selectedNote.tags.length
            && tags.every((tag, i) => tag === selectedNote.tags[i]);
        if (clean) {
            removeDraft(selectedNote.id);
            setDirty(false);
            return;
        }
        saveTimerRef.current = setTimeout(() => {
            saveDraft(selectedNote.id, { title, tags, content });
            setDirty(true);
        }, 500);
        return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    }, [title, tags, content, selectedNote, loading]);

    /* ── Handlers ─────────────────────────────────────── */

    const handleSaveToCloud = useCallback(async () => {
        if (!selectedNote || !dirty) return;
        setSaving(true);
        try {
            const { note } = await updateMarkdownNote(selectedNote.id, { title, tags, content });
            setNotes(prev => prev.map(n => n.id === note.id ? note : n));
            removeDraft(selectedNote.id);
            setDirty(false);
            showToast(t.markdownNotes.savedToCloud, 'success');
        } catch {
            showToast(t.markdownNotes.saveFail, 'error');
        } finally {
            setSaving(false);
        }
    }, [selectedNote, dirty, title, tags, content, t]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                handleSaveToCloud();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSaveToCloud]);

    const handleSyncFromCloud = async () => {
        if (!selectedNote) return;
        if (dirty && !(await showConfirm(t.markdownNotes.overwriteConfirm))) {
            return;
        }
        setSyncing(true);
        try {
            const { note } = await getMarkdownNote(selectedNote.id);
            setNotes(prev => prev.map(n => n.id === note.id ? note : n));
            setTitle(note.title);
            setTags(note.tags);
            setContent(note.content);
            removeDraft(note.id);
            setDirty(false);
            showToast(t.markdownNotes.syncedFromCloud, 'success');
        } catch {
            showToast(t.markdownNotes.syncFail, 'error');
        } finally {
            setSyncing(false);
        }
    };

    // Open modal instead of creating directly
    const openCreateModal = () => setShowCreateModal(true);

    const handleConfirmCreate = async (noteTitle: string, noteContent: string) => {
        setCreating(true);
        try {
            const { note } = await createMarkdownNote({ title: noteTitle, content: noteContent });
            setNotes(prev => [note, ...prev]);
            setSelectedId(note.id);
            setPreviewMode('split');
            setShowCreateModal(false);
            setTimeout(() => editorRef.current?.focus(), 100);
        } catch {
            showToast(t.markdownNotes.createFail, 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedNote) return;
        const msg = t.markdownNotes.deleteConfirm.replace('{title}', selectedNote.title || 'Untitled');
        if (!(await showConfirm({ message: msg, danger: true }))) return;
        try {
            await deleteMarkdownNote(selectedNote.id);
            removeDraft(selectedNote.id);
            setNotes(prev => prev.filter(n => n.id !== selectedNote.id));
            setSelectedId(null);
            setDirty(false);
            showToast(t.markdownNotes.deleteSuccess, 'success');
        } catch {
            showToast(t.markdownNotes.deleteFail, 'error');
        }
    };

    const handleSelectNote = (id: number) => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        setSelectedId(id);
    };

    const handleInsertMarkdown = (syntax: string) => {
        const textarea = editorRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = content.slice(0, start);
        const selected = content.slice(start, end);
        const after = content.slice(end);

        // Each case declares the inserted snippet plus the selection range
        // (relative to `start`) so the caret reliably lands on the
        // placeholder / kept selection — indexOf-based positioning broke
        // whenever the document already contained the placeholder word.
        let inserted: string;
        let selFrom: number;
        let selTo: number;
        const body = (fallback: string) => selected || fallback;

        switch (syntax) {
            case 'bold': {
                const b = body('bold');
                inserted = `**${b}**`; selFrom = 2; selTo = 2 + b.length; break;
            }
            case 'italic': {
                const b = body('italic');
                inserted = `_${b}_`; selFrom = 1; selTo = 1 + b.length; break;
            }
            case 'code': {
                const b = body('code');
                inserted = `\`${b}\``; selFrom = 1; selTo = 1 + b.length; break;
            }
            case 'link': {
                const b = body('text');
                inserted = `[${b}](url)`; selFrom = b.length + 3; selTo = b.length + 6; break;
            }
            case 'h2': {
                const b = body('Heading');
                inserted = `## ${b}`; selFrom = 3; selTo = 3 + b.length; break;
            }
            case 'h3': {
                const b = body('Heading');
                inserted = `### ${b}`; selFrom = 4; selTo = 4 + b.length; break;
            }
            case 'list': {
                const b = body('item');
                inserted = `- ${b}`; selFrom = 2; selTo = 2 + b.length; break;
            }
            case 'quote': {
                const b = body('quote');
                inserted = `> ${b}`; selFrom = 2; selTo = 2 + b.length; break;
            }
            case 'table': {
                inserted = '| Col 1 | Col 2 |\n| --- | --- |\n|  |  |';
                selFrom = inserted.length - 5; selTo = selFrom; break;
            }
            default: return;
        }

        setContent(before + inserted + after);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + selFrom, start + selTo);
        }, 0);
    };

    const handleCapitalize = () => {
        const textarea = editorRef.current;
        const selStart = textarea?.selectionStart ?? 0;
        const selEnd = textarea?.selectionEnd ?? 0;
        const hasSelection = !!textarea && selEnd > selStart;

        const target = hasSelection ? content.slice(selStart, selEnd) : content;
        const { result, count } = capitalizeSentenceStarts(target);
        if (count === 0) {
            showToast(t.markdownNotes.capitalizeNone, 'info');
            return;
        }
        setContent(hasSelection
            ? content.slice(0, selStart) + result + content.slice(selEnd)
            : result);
        showToast(t.markdownNotes.capitalizeDone.replace('{n}', String(count)), 'success');
        if (textarea) {
            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(selStart, selEnd);
            }, 0);
        }
    };

    const filteredNotes = searchQuery.trim()
        ? notes.filter(n => n.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : notes;

    const wc = getWordCount(content);

    /* ── Render ───────────────────────────────────────── */

    return (
        <Layout>
            {showCreateModal && (
                <CreateModal
                    onConfirm={handleConfirmCreate}
                    onCancel={() => setShowCreateModal(false)}
                    creating={creating}
                />
            )}

            <div className="md-notes-wrap">
                <div className="md-notes-body">
                    {/* ── Sidebar ── */}
                    <div className={`md-notes-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                        <div className="md-notes-sidebar-header">
                            <h2 className="md-sidebar-title">{t.markdownNotes.title}</h2>
                            <button
                                className="md-sidebar-toggle"
                                title={sidebarCollapsed ? t.markdownNotes.expandSidebar : t.markdownNotes.collapseSidebar}
                                onClick={() => setSidebarCollapsed(v => !v)}
                            >
                                {sidebarCollapsed ? '▶' : '◀'}
                            </button>
                        </div>

                        <button className="md-btn-new-note" onClick={openCreateModal}>
                            <span className="md-btn-new-note-icon">+</span>
                            <span className="md-btn-new-note-label">{t.markdownNotes.newNote.replace('+ ', '')}</span>
                        </button>

                        <div className="md-notes-search">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                placeholder={t.markdownNotes.searchPlaceholder}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="md-notes-search-clear" onClick={() => setSearchQuery('')}>×</button>
                            )}
                        </div>

                        <div className="md-notes-list">
                            {loading ? (
                                <div className="md-notes-sidebar-empty">{t.common.loading}</div>
                            ) : filteredNotes.length === 0 ? (
                                <div className="md-notes-sidebar-empty">
                                    <span className="md-empty-icon">📄</span>
                                    <span>{searchQuery ? t.markdownNotes.emptyList : t.markdownNotes.noNotesYet}</span>
                                    {!searchQuery && (
                                        <button className="md-btn primary" style={{ marginTop: 8, fontSize: 12, padding: '6px 14px' }} onClick={openCreateModal}>
                                            {t.markdownNotes.firstNoteBtn}
                                        </button>
                                    )}
                                </div>
                            ) : (
                                (() => {
                                    const groupOrder: DateGroupKey[] = ['today', 'yesterday', 'thisWeek', 'older'];
                                    const map = new Map<DateGroupKey, MarkdownNote[]>();
                                    for (const n of filteredNotes) {
                                        const key = getDateGroup(n.updated_at);
                                        if (!map.has(key)) map.set(key, []);
                                        map.get(key)!.push(n);
                                    }
                                    const groups = groupOrder
                                        .filter(k => map.has(k))
                                        .map(k => ({ label: k, notes: map.get(k)! }));
                                    return groups.map(group => (
                                        <div key={group.label}>
                                            <div className="md-note-group-label">{t.markdownNotes.groups[group.label]}</div>
                                            {group.notes.map(note => {
                                                const hasDraft = !!loadDraft(note.id);
                                                return (
                                                    <div
                                                        key={note.id}
                                                        className={`md-note-item ${note.id === selectedId ? 'active' : ''}`}
                                                        onClick={() => handleSelectNote(note.id)}
                                                    >
                                                        <div className="md-note-item-head">
                                                            <h4>{note.title || 'Untitled'}</h4>
                                                            <span className="md-note-date">
                                                                {hasDraft && <span className="md-note-draft-dot" title={t.markdownNotes.unsaved} />}
                                                                {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>
                                                        {note.content && <p className="md-note-preview">{getPreviewText(note.content)}</p>}
                                                        {note.tags.length > 0 && (
                                                            <div className="md-note-tags">
                                                                {note.tags.slice(0, 4).map(tag => <span key={tag} className="md-note-tag-chip">{tag}</span>)}
                                                                {note.tags.length > 4 && <span className="md-note-tag-chip">+{note.tags.length - 4}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()
                            )}
                        </div>

                        <div className="md-notes-sidebar-footer">
                            <span>{notes.length} {t.markdownNotes.sidebarCount}</span>
                        </div>
                    </div>

                    {/* ── Editor ── */}
                    <div className="md-notes-editor">
                        {selectedNote ? (
                            <>
                                <div className="md-editor-toolbar">
                                    {/* Row 1: Title + actions */}
                                    <div className="md-editor-toolbar-top">
                                        <input
                                            className="md-editor-title-input"
                                            type="text"
                                            placeholder={t.markdownNotes.titlePlaceholder}
                                            value={title}
                                            onChange={e => setTitle(e.target.value)}
                                        />
                                        <div className="md-editor-toolbar-actions">
                                            {/* Preview mode toggle — 3 buttons WITH text labels */}
                                            <div className="md-preview-toggle">
                                                <button
                                                    className={previewMode === 'edit' ? 'active' : ''}
                                                    onClick={() => setPreviewMode('edit')}
                                                    title={t.markdownNotes.editOnlyTitle}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    {t.markdownNotes.editOnlyLabel}
                                                </button>
                                                <button
                                                    className={previewMode === 'split' ? 'active' : ''}
                                                    onClick={() => setPreviewMode('split')}
                                                    title={t.markdownNotes.splitTitle}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/></svg>
                                                    {t.markdownNotes.splitLabel}
                                                </button>
                                                <button
                                                    className={previewMode === 'preview' ? 'active' : ''}
                                                    onClick={() => setPreviewMode('preview')}
                                                    title={t.markdownNotes.previewOnlyTitle}
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                    {t.markdownNotes.previewOnlyLabel}
                                                </button>
                                            </div>

                                            <button
                                                className="md-btn sync-cloud"
                                                onClick={handleSyncFromCloud}
                                                disabled={syncing}
                                                title={t.markdownNotes.pullCloudTitle}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                                </svg>
                                                {syncing ? t.markdownNotes.pullingBtn : t.markdownNotes.pullBtn}
                                            </button>

                                            <button
                                                className={`md-btn save-cloud ${dirty ? 'highlight' : ''}`}
                                                onClick={handleSaveToCloud}
                                                disabled={saving || !dirty}
                                                title={t.markdownNotes.saveToCloud}
                                            >
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                                                </svg>
                                                {saving ? t.markdownNotes.saving : t.markdownNotes.saveToCloud}
                                            </button>

                                            <button className="md-btn-icon" onClick={handleDelete} title={t.markdownNotes.deleteNote}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Row 2: Tags + word count */}
                                    <div className="md-editor-toolbar-row">
                                        <TagInput tags={tags} tagInput={tagInput} onChange={setTagInput} onTagsChange={setTags} />
                                        <div className="md-editor-meta-info">
                                            {dirty && <span className="md-saving-dot" title={t.markdownNotes.unsaved} />}
                                            <span className="md-word-count">
                                                {t.markdownNotes.wordCount
                                                    .replace('{words}', wc.words.toLocaleString())
                                                    .replace('{chars}', wc.chars.toLocaleString())}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Row 3: Format buttons */}
                                    <div className="md-editor-markdown-btns">
                                        <button onClick={() => handleInsertMarkdown('bold')} title={t.markdownNotes.format.bold}><strong>B</strong></button>
                                        <button onClick={() => handleInsertMarkdown('italic')} title={t.markdownNotes.format.italic}><em>I</em></button>
                                        <button onClick={() => handleInsertMarkdown('h2')} title={t.markdownNotes.format.h2}>H2</button>
                                        <button onClick={() => handleInsertMarkdown('h3')} title={t.markdownNotes.format.h3}>H3</button>
                                        <span className="md-mb-sep" />
                                        <button onClick={() => handleInsertMarkdown('list')} title={t.markdownNotes.format.list} style={{ fontFamily: 'monospace' }}>—</button>
                                        <button onClick={() => handleInsertMarkdown('quote')} title={t.markdownNotes.format.quote} style={{ fontFamily: 'monospace' }}>&gt;</button>
                                        <button onClick={() => handleInsertMarkdown('code')} title={t.markdownNotes.format.code} style={{ fontFamily: 'monospace' }}>&lt;/&gt;</button>
                                        <button onClick={() => handleInsertMarkdown('link')} title={t.markdownNotes.format.link}>🔗</button>
                                        <button onClick={() => handleInsertMarkdown('table')} title={t.markdownNotes.format.table}>⊞</button>
                                        <span className="md-mb-sep" />
                                        <button onClick={handleCapitalize} title={t.markdownNotes.capitalizeTitle}>Aa</button>
                                    </div>
                                </div>

                                <div className="md-editor-panels">
                                    {(previewMode === 'edit' || previewMode === 'split') && (
                                        <div className={`md-editor-textarea-wrap ${previewMode === 'split' ? 'split' : ''}`}>
                                            <textarea
                                                ref={editorRef}
                                                className="md-editor-textarea"
                                                value={content}
                                                onChange={e => setContent(e.target.value)}
                                                placeholder="# Start writing..."
                                                onKeyDown={e => {
                                                    if (e.key === 'Tab') {
                                                        e.preventDefault();
                                                        const ta = e.currentTarget;
                                                        const s = ta.selectionStart, end = ta.selectionEnd;
                                                        setContent(content.slice(0, s) + '  ' + content.slice(end));
                                                        setTimeout(() => { ta.focus(); ta.setSelectionRange(s + 2, s + 2); }, 0);
                                                    }
                                                }}
                                            />
                                        </div>
                                    )}
                                    {(previewMode === 'split' || previewMode === 'preview') && (
                                        <div className="md-editor-preview">
                                            {content.trim() ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                                            ) : (
                                                <div className="md-editor-preview-empty">
                                                    <span style={{ fontSize: 32, opacity: 0.3 }}>📝</span>
                                                    <span>{t.markdownNotes.emptyPreview}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="md-editor-empty">
                                <div className="md-editor-empty-inner">
                                    <span className="md-empty-icon-large">📓</span>
                                    <h3>{t.markdownNotes.title}</h3>
                                    <p>{t.markdownNotes.selectNote}</p>
                                    <button className="md-btn primary" onClick={openCreateModal}>
                                        {t.markdownNotes.newNote}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
