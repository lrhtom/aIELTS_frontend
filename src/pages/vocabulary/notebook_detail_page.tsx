import Layout from '../../components/layout/Layout';
import { useState, useEffect, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import {
    getNotebook, listWords, addWord, updateWord, removeWord,
    bulkImportWords,
    type NotebookEntry,
} from '../../api/notebook';
import {
    listVocabBooks, listBookWords,
    type VocabBook, type BookWord,
} from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import TagInput from '../../components/vocabulary/TagInput';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';
import '../../styles/vocabulary_learning_plan.css';

/* ── 类型 ─────────────────────────────────────────────────────────────────── */

interface WordForm {
    word:          string;
    custom_zh:     string;
    notes:         string;
    tags:          string[];
    mastery_level: number;
    tagInput:      string;
    phonetic:      string;
    grammar:       string;
}

const EMPTY_FORM: WordForm = {
    word:          '',
    custom_zh:     '',
    notes:         '',
    tags:          [],
    mastery_level: 0,
    tagInput:      '',
    phonetic:      '',
    grammar:       '',
};

/* ── 单词表单（新增/编辑） ────────────────────────────────────────────────── */

function WordFormPanel({
    initial, submitLabel, onSubmit, onCancel, submitting, existingWords,
}: {
    initial:        Partial<WordForm>;
    submitLabel:    string;
    onSubmit:       (f: WordForm) => void;
    onCancel:       () => void;
    submitting:     boolean;
    existingWords?: Set<string>;
}) {
    const { translations: t } = useLang();
    const [form, setForm] = useState<WordForm>({ ...EMPTY_FORM, ...initial });
    const set = (k: keyof WordForm) => (v: any) => setForm(f => ({ ...f, [k]: v }));

    const isDuplicate = submitLabel === '添加' && !!existingWords && form.word.trim() !== ''
        && existingWords.has(form.word.trim().toLowerCase());

    return (
        <div className="word-form">
            <div className="word-form-title">{submitLabel === t.vocab.notebookDetail.btnAdd ? t.vocab.notebookDetail.modalAddTitle : t.vocab.notebookDetail.modalEditTitle}</div>

            <div className="wf-row">
                <div className="wf-field">
                    <div className="wf-label">{t.vocab.notebookDetail.wordLabel}</div>
                    <div style={{ position: 'relative' }}>
                        <input
                            className={`wf-input${isDuplicate ? ' wf-input-duplicate' : ''}`}
                            placeholder={t.vocab.notebookDetail.wordPlaceholder}
                            value={form.word}
                            disabled={submitLabel !== t.vocab.notebookDetail.btnAdd}
                            onChange={e => set('word')(e.target.value.trim())}
                        />
                        {isDuplicate && (
                            <span className="wf-duplicate-hint">{t.vocab.notebookDetail.msgDuplicate}</span>
                        )}
                    </div>
                </div>
                <div className="wf-field">
                    <div className="wf-label">{t.vocab.notebookDetail.zhLabel}</div>
                    <input
                        className="wf-input"
                        placeholder={t.vocab.notebookDetail.zhPlaceholder}
                        value={form.custom_zh}
                        onChange={e => set('custom_zh')(e.target.value)}
                    />
                </div>
            </div>

            {submitLabel === t.vocab.notebookDetail.btnAdd && (
                <div className="wf-row">
                    <div className="wf-field">
                        <div className="wf-label">{t.vocab.notebookDetail.phoneticLabel}</div>
                        <input
                            className="wf-input"
                            placeholder={t.vocab.notebookDetail.phoneticPlaceholder}
                            value={form.phonetic}
                            onChange={e => set('phonetic')(e.target.value)}
                        />
                    </div>
                    <div className="wf-field">
                        <div className="wf-label">{t.vocab.notebookDetail.grammarLabel}</div>
                        <input
                            className="wf-input"
                            placeholder={t.vocab.notebookDetail.grammarPlaceholder}
                            value={form.grammar}
                            onChange={e => set('grammar')(e.target.value)}
                        />
                    </div>
                </div>
            )}

            <div className="wf-field">
                <div className="wf-label">{t.vocab.notebookDetail.tagLabel}</div>
                <TagInput
                    tags={form.tags}
                    tagInput={form.tagInput}
                    onChange={set('tagInput')}
                    onTagsChange={set('tags')}
                />
                <div className="wf-hint">{t.vocab.notebookDetail.tagHint}</div>
            </div>

            <div className="wf-field">
                <div className="wf-label">{t.vocab.notebookDetail.masteryLabel}</div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {[0, 1, 2, 3, 4, 5].map(n => (
                        <span
                            key={n}
                            style={{
                                fontSize: '20px',
                                cursor: 'pointer',
                                color: n <= form.mastery_level ? '#f59e0b' : 'var(--color-border)',
                                transition: 'color 0.1s',
                            }}
                            onClick={() => set('mastery_level')(n)}
                        >
                            {n === 0 ? '○' : '★'}
                        </span>
                    ))}
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '4px' }}>
                        {form.mastery_level === 0 ? t.vocab.notebookDetail.masteryUnrated : t.vocab.notebookDetail.masteryRating.replace('{n}', String(form.mastery_level))}
                    </span>
                </div>
            </div>

            <div className="wf-field">
                <div className="wf-label">{t.vocab.notebookDetail.notesLabel}</div>
                <textarea
                    className="wf-input"
                    placeholder={t.vocab.notebookDetail.notesPlaceholder}
                    value={form.notes}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: '60px' }}
                    onChange={e => set('notes')(e.target.value)}
                />
            </div>

            <div className="wf-actions">
                <button className="wf-btn" onClick={onCancel} disabled={submitting}>{t.vocab.notebookDetail.btnCancel}</button>
                <button
                    className="wf-btn primary"
                    onClick={() => onSubmit(form)}
                    disabled={submitting || !form.word.trim() || isDuplicate}
                >
                    {submitting ? t.common.saving : submitLabel}
                </button>
            </div>
        </div>
    );
}

/* ── 主页面 ───────────────────────────────────────────────────────────────── */

export default function NotebookDetailPage() {
    const { translations: t } = useLang();
    const { id }   = useParams<{ id: string }>();
    const nbId     = Number(id);
    const navigate = useNavigate();

    const [allEntries,    setAllEntries]    = useState<NotebookEntry[]>([]);
    const [loading,       setLoading]       = useState(true);
    const [selectedTag,   setSelectedTag]   = useState('');
    const [searchQ,       setSearchQ]       = useState('');
    const [showAddForm,   setShowAddForm]   = useState(false);
    const [editId,        setEditId]        = useState<number | null>(null);
    const [submitting,    setSubmitting]    = useState(false);
    const [nbTitle,       setNbTitle]       = useState(t.vocab.notebookDetail.titleDefault);
    const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());

    /* ── 词书导入相关 state ─────────────────────────────────────────────── */
    type AddTab = 'manual' | 'book';
    type BookSubMode = 'all' | 'range' | 'select';

    const [addTab,        setAddTab]        = useState<AddTab>('manual');
    const [books,         setBooks]         = useState<VocabBook[]>([]);
    const [bookId,        setBookId]        = useState<number | ''>('');
    const [bookSubMode,   setBookSubMode]   = useState<BookSubMode>('all');
    const [rangeStart,    setRangeStart]    = useState(1);
    const [rangeEnd,      setRangeEnd]      = useState(50);
    const [allBookWords,  setAllBookWords]  = useState<BookWord[]>([]);
    const [bookPage,      setBookPage]      = useState(1);
    const [bookPageJumpInput, setBookPageJumpInput] = useState('');
    const [bookQ,         setBookQ]         = useState('');
    const [selectedIds,   setSelectedIds]   = useState<Set<number>>(new Set());
    const [importBusy,    setImportBusy]    = useState(false);

    /* 前端过滤 */
    const entries = useMemo(() => {
        let list = allEntries;
        if (selectedTag) list = list.filter(e => e.tags.includes(selectedTag));
        const normalizedQ = searchQ.trim().toLowerCase();
        if (normalizedQ) {
            list = list.filter(e =>
                e.word.toLowerCase().includes(normalizedQ) ||
                e.custom_zh.toLowerCase().includes(normalizedQ) ||
                e.notes.toLowerCase().includes(normalizedQ) ||
                e.phonetic.toLowerCase().includes(normalizedQ) ||
                e.grammar.toLowerCase().includes(normalizedQ) ||
                e.tags.some(t => t.toLowerCase().includes(normalizedQ)) ||
                e.definitions.some(d =>
                    d.pos.toLowerCase().includes(normalizedQ) ||
                    d.meaning.toLowerCase().includes(normalizedQ)
                ) ||
                e.examples.some(ex =>
                    ex.en.toLowerCase().includes(normalizedQ) ||
                    ex.zh.toLowerCase().includes(normalizedQ)
                )
            );
        }
        return list;
    }, [allEntries, selectedTag, searchQ]);

    const allTags  = useMemo(() => {
        const s = new Set<string>();
        allEntries.forEach(e => e.tags.forEach(t => s.add(t)));
        return [...s].sort();
    }, [allEntries]);

    const allWords = useMemo(() => new Set(allEntries.map(e => e.word)), [allEntries]);

    /* 初始加载：一次性取全部条目 + 笔记本标题 */
    useEffect(() => {
        if (!nbId || isNaN(nbId)) { navigate('/vocabulary/notebook', { replace: true }); return; }
        Promise.all([
            getNotebook(nbId).then(r => setNbTitle(r.notebook.title)),
            listWords(nbId).then(r => setAllEntries(r.entries)),
        ])
            .catch(() => { showToast(t.common.error, 'error'); })
            .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nbId, navigate, t.common.error]);

    /* 切换 tag 过滤 */
    const handleTagFilter = (tag: string) => {
        setSelectedTag(prev => prev === tag ? '' : tag);
    };

    /* 搜索 */
    const handleSearch = (q: string) => {
        setSearchQ(q);
    };

    /* ── 词书导入 effects & handlers ──────────────────────────────────── */
    useEffect(() => {
        listVocabBooks().then(r => setBooks(r.books)).catch(() => {});
    }, []);

    useEffect(() => {
        if (bookSubMode !== 'select' || !bookId) return;
        setAllBookWords([]);
        setBookPage(1);
        listBookWords(bookId as number, 1, 5000).then(r => {
            setAllBookWords(r.words);
        }).catch(() => {});
    }, [bookId, bookSubMode]);

    const BOOK_PAGE_SIZE = 20;
    const { bookWords_, bookTotal } = useMemo(() => {
        let list = allBookWords;
        if (bookQ.trim()) {
            const q = bookQ.trim().toLowerCase();
            list = list.filter(w =>
                w.word.toLowerCase().includes(q) ||
                w.zh_brief.toLowerCase().includes(q)
            );
        }
        return {
            bookWords_: list.slice((bookPage - 1) * BOOK_PAGE_SIZE, bookPage * BOOK_PAGE_SIZE),
            bookTotal: list.length,
        };
    }, [allBookWords, bookQ, bookPage]);

    const bookTotalPages = Math.max(1, Math.ceil(bookTotal / BOOK_PAGE_SIZE));

    const handleBookPageJump = () => {
        const rawValue = bookPageJumpInput.trim();
        if (!rawValue) {
            showToast('请输入页码', 'error');
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            showToast(`请输入 1 到 ${bookTotalPages} 的整数页码`, 'error');
            return;
        }
        setBookPage(Math.min(bookTotalPages, Math.max(1, parsed)));
        setBookPageJumpInput('');
    };

    const toggleSelectWord = (wordId: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(wordId) ? next.delete(wordId) : next.add(wordId);
            return next;
        });
    };

    const handleBulkImport = async (
        payload: Parameters<typeof bulkImportWords>[1],
        expectedTotal?: number,
    ) => {
        setImportBusy(true);
        try {
            const { entries_added } = await bulkImportWords(nbId, payload);
            const skipped = expectedTotal !== undefined ? Math.max(0, expectedTotal - entries_added) : 0;
            const msg = skipped > 0
                ? `已导入 ${entries_added} 个，跳过 ${skipped} 个重复单词`
                : `已导入 ${entries_added} 个单词`;
            showToast(msg, 'success');
            const r = await listWords(nbId);
            setAllEntries(r.entries);
        } catch {
            showToast('导入失败', 'error');
        } finally {
            setImportBusy(false);
        }
    };

    /* 添加单词 */
    const handleAdd = async (form: WordForm) => {
        if (!form.word.trim()) return;
        const word = form.word.trim().toLowerCase();
        if (allWords.has(word)) { showToast('该单词已在笔记本中', 'error'); return; }
        setSubmitting(true);
        try {
            const { entry } = await addWord(nbId, {
                word:      form.word.trim().toLowerCase(),
                custom_zh: form.custom_zh.trim(),
                notes:     form.notes.trim(),
                tags:      form.tags,
                ...(form.phonetic.trim() && { phonetic: form.phonetic.trim() }),
                ...(form.grammar.trim()  && { grammar:  form.grammar.trim()  }),
            });
            setAllEntries(prev => [entry, ...prev]);
            setShowAddForm(false);
            showToast(`「${entry.word}」已添加`, 'success');
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string }; status?: number } };
            const msg = e.response?.data?.error || '添加失败';
            if (e.response?.status === 409) {
                showToast('该单词已在笔记本中', 'error');
            } else {
                showToast(msg, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    /* 编辑单词 */
    const handleEdit = async (entry: NotebookEntry, form: WordForm) => {
        setSubmitting(true);
        try {
            const { entry: updated } = await updateWord(nbId, entry.id, {
                custom_zh:     form.custom_zh.trim(),
                notes:         form.notes.trim(),
                mastery_level: form.mastery_level,
                tags:          form.tags,
            });
            setAllEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
            setEditId(null);
            showToast('已保存', 'success');
        } catch {
            showToast('保存失败', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    /* 删除单词 */
    const handleRemove = async (entry: NotebookEntry) => {
        if (!confirm(t.vocab.notebooks.msgDeleteConfirm.replace('{title}', entry.word))) return;
        try {
            await removeWord(nbId, entry.id);
            setAllEntries(prev => prev.filter(e => e.id !== entry.id));
            showToast(t.vocab.notebooks.msgDeleteSuccess, 'success');
        } catch {
            showToast(t.vocab.notebooks.msgFail, 'error');
        }
    };

    /* 掌握度星星（显示用） */
    const renderStars = (level: number) => (
        <span className="mastery-stars" title={`掌握度 ${level}/5`}>
            {[1, 2, 3, 4, 5].map(n => (
                <span key={n} style={{ color: n <= level ? '#f59e0b' : 'var(--color-border)' }}>
                    {n <= level ? '★' : '☆'}
                </span>
            ))}
        </span>
    );

    return (
        <Layout>
            <div className="config-page-wrap">
                <div className="practice-header">
                    <Link to="/vocabulary/notebook" className="back-link">返回我的笔记本</Link>
                    <h1>{nbTitle}</h1>
                    <p>管理笔记本中的单词，添加标签和个人释义</p>
                </div>

                {/* 搜索栏 */}
                <div className="config-card" style={{ paddingBottom: '16px' }}>
                    <div className="nb-search-bar">
                        <input
                            className="nb-search-input"
                            placeholder="搜索单词…"
                            value={searchQ}
                            onChange={e => handleSearch(e.target.value)}
                        />
                        <button
                            className="wf-btn primary"
                            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                            onClick={() => { setShowAddForm(a => !a); setEditId(null); }}
                        >
                            {showAddForm ? '收起' : '+ 添加单词'}
                        </button>
                    </div>

                    {/* 标签过滤 */}
                    {allTags.length > 0 && (
                        <div className="nb-tag-filter-row">
                            {allTags.map(tag => (
                                <span
                                    key={tag}
                                    className={`tag-chip filter${selectedTag === tag ? ' selected' : ''}`}
                                    onClick={() => handleTagFilter(tag)}
                                >
                                    #{tag}
                                </span>
                            ))}
                            {selectedTag && (
                                <span
                                    className="tag-chip"
                                    style={{ cursor: 'pointer', opacity: 0.7 }}
                                    onClick={() => setSelectedTag('')}
                                >
                                    ✕ 清除过滤
                                </span>
                            )}
                        </div>
                    )}

                    {/* 添加单词区（tab 式） */}
                    {showAddForm && (
                        <>
                            <div className="lp-add-tabs" style={{ marginTop: 8 }}>
                                <button
                                    className={`lp-add-tab${addTab === 'manual' ? ' active' : ''}`}
                                    onClick={() => setAddTab('manual')}
                                >
                                    {t.vocab.notebookDetail.tabManual}
                                </button>
                                <button
                                    className={`lp-add-tab${addTab === 'book' ? ' active' : ''}`}
                                    onClick={() => setAddTab('book')}
                                >
                                    {t.vocab.notebookDetail.tabBook}
                                </button>
                            </div>

                            {addTab === 'manual' && (
                                <WordFormPanel
                                    initial={{ ...EMPTY_FORM }}
                                    submitLabel="添加"
                                    onSubmit={handleAdd}
                                    onCancel={() => setShowAddForm(false)}
                                    submitting={submitting}
                                    existingWords={allWords}
                                />
                            )}

                            {addTab === 'book' && (
                                <div className="lp-add-form">
                                    <div className="lp-add-row">
                                        <select
                                            className="lp-add-select"
                                            value={bookId}
                                            onChange={e => {
                                                setBookId(Number(e.target.value) || '');
                                                setBookSubMode('all');
                                                setSelectedIds(new Set());
                                                setBookPage(1);
                                            }}
                                        >
                                            <option value="">{t.vocab.notebookDetail.bookSelect}</option>
                                            {books.map(b => (
                                                <option key={b.id} value={b.id}>
                                                    {b.name}（{b.word_count} 词）
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {bookId !== '' && (
                                        <>
                                            <div className="lp-add-tabs" style={{ marginTop: 4 }}>
                                                {(['all', 'range', 'select'] as const).map(m => (
                                                    <button
                                                        key={m}
                                                        className={`lp-add-tab${bookSubMode === m ? ' active' : ''}`}
                                                        style={{ fontSize: 12 }}
                                                        onClick={() => { setBookSubMode(m); setSelectedIds(new Set()); setBookPage(1); }}
                                                    >
                                                        {m === 'all' ? t.vocab.notebookDetail.bookModeAll : m === 'range' ? t.vocab.notebookDetail.bookModeRange : t.vocab.notebookDetail.bookModeSelect}
                                                    </button>
                                                ))}
                                            </div>

                                            {bookSubMode === 'all' && (
                                                <div className="lp-add-row">
                                                    <button
                                                        className="lp-add-btn"
                                                        disabled={importBusy}
                                                        onClick={() => handleBulkImport(
                                                            { mode: 'book_all', book_id: bookId as number },
                                                            books.find(b => b.id === bookId)?.word_count,
                                                        )}
                                                    >
                                                        {importBusy ? t.common.saving : t.vocab.notebookDetail.bookModeAll}
                                                    </button>
                                                </div>
                                            )}

                                            {bookSubMode === 'range' && (
                                                <div className="lp-add-row">
                                                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>{t.vocab.notebookDetail.bookRangeIdx}</span>
                                                    <input type="number" min={1} value={rangeStart} onChange={e => setRangeStart(Number(e.target.value))} style={{ maxWidth: 80 }} />
                                                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>~</span>
                                                    <input type="number" min={1} value={rangeEnd} onChange={e => setRangeEnd(Number(e.target.value))} style={{ maxWidth: 80 }} />
                                                    <button
                                                        className="lp-add-btn"
                                                        disabled={importBusy}
                                                        onClick={() => handleBulkImport(
                                                            { mode: 'book_range', book_id: bookId as number, start: rangeStart, end: rangeEnd },
                                                            Math.max(0, rangeEnd - rangeStart + 1),
                                                        )}
                                                    >
                                                        {importBusy ? t.common.saving : t.vocab.notebookDetail.bookModeRange}
                                                    </button>
                                                </div>
                                            )}

                                            {bookSubMode === 'select' && (
                                                <>
                                                    <div className="lp-add-row">
                                                        <input
                                                            type="text"
                                                            placeholder={t.vocab.notebookDetail.searchPlaceholder}
                                                            value={bookQ}
                                                            onChange={e => { setBookQ(e.target.value); setBookPage(1); }}
                                                        />
                                                        <button
                                                            className="lp-add-btn"
                                                            disabled={importBusy || selectedIds.size === 0}
                                                            onClick={() => {
                                                                handleBulkImport(
                                                                    { mode: 'book_select', book_id: bookId as number, word_ids: Array.from(selectedIds) },
                                                                    selectedIds.size,
                                                                );
                                                                setSelectedIds(new Set());
                                                            }}
                                                        >
                                                            {importBusy ? t.common.saving : t.vocab.notebookDetail.bookImportSelected.replace('{n}', String(selectedIds.size))}
                                                        </button>
                                                    </div>
                                                    <div className="lp-book-browser">
                                                        {bookWords_.map(w => (
                                                            <div key={w.id} className="lp-book-word-row" onClick={() => toggleSelectWord(w.id)}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(w.id)}
                                                                    onChange={() => toggleSelectWord(w.id)}
                                                                    onClick={e => e.stopPropagation()}
                                                                />
                                                                <span className="bw-word">{w.word}</span>
                                                                {w.phonetic && (
                                                                    <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>{w.phonetic}</span>
                                                                )}
                                                                <span className="bw-zh">{w.zh_brief}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {bookTotal > BOOK_PAGE_SIZE && (
                                                        <div className="lp-book-pager">
                                                            <button disabled={bookPage <= 1} onClick={() => setBookPage(p => Math.max(1, p - 1))}>{t.vocab.notebookDetail.bookPrevPage}</button>
                                                            <span>{bookPage} / {bookTotalPages}</span>
                                                            <button disabled={bookPage >= bookTotalPages} onClick={() => setBookPage(p => Math.min(bookTotalPages, p + 1))}>{t.vocab.notebookDetail.bookNextPage}</button>
                                                            <div className="lp-page-jump">
                                                                <span>跳到</span>
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={bookPageJumpInput}
                                                                    onChange={e => {
                                                                        const next = e.target.value;
                                                                        if (next === '' || /^\d+$/.test(next)) {
                                                                            setBookPageJumpInput(next);
                                                                        }
                                                                    }}
                                                                    onKeyDown={e => { if (e.key === 'Enter') handleBookPageJump(); }}
                                                                    placeholder="页码"
                                                                    aria-label="跳转到指定页"
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleBookPageJump}
                                                                    disabled={!bookPageJumpInput.trim()}
                                                                >
                                                                    GO
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* 单词列表 */}
                <div className="config-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '30px' }}>{t.common.loading}</p>
                    ) : entries.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📝</span>
                            {selectedTag || searchQ ? t.vocab.notebookDetail.emptySearch : t.vocab.notebookDetail.emptyList}
                        </div>
                    ) : (
                        <div className="word-list">
                            {entries.map(entry => (
                                editId === entry.id ? (
                                    <div key={entry.id} className="word-item-edit">
                                        <WordFormPanel
                                            initial={{
                                                word:          entry.word,
                                                custom_zh:     entry.custom_zh,
                                                notes:         entry.notes,
                                                tags:          entry.tags,
                                                mastery_level: entry.mastery_level,
                                                tagInput:      '',
                                            }}
                                            submitLabel={t.vocab.notebookDetail.btnSave}
                                            onSubmit={form => handleEdit(entry, form)}
                                            onCancel={() => setEditId(null)}
                                            submitting={submitting}
                                        />
                                    </div>
                                ) : (
                                    <div key={entry.id} className="word-item">
                                        <div className="wi-word">
                                            {entry.word}
                                            {entry.phonetic && (
                                                <span className="wi-phonetic">{entry.phonetic}</span>
                                            )}
                                        </div>
                                        <div className="wi-zh">{entry.custom_zh || <span style={{ opacity: 0.4 }}>—</span>}</div>
                                        <div className="wi-tags">
                                            {entry.tags.map(t => (
                                                <span
                                                    key={t}
                                                    className="tag-chip"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => handleTagFilter(t)}
                                                >
                                                    #{t}
                                                </span>
                                            ))}
                                            {entry.mastery_level > 0 && renderStars(entry.mastery_level)}
                                        </div>
                                        <div className="wi-actions">
                                            <button
                                                className="nb-action-btn"
                                                title="编辑"
                                                onClick={() => { setEditId(entry.id); setShowAddForm(false); }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="nb-action-btn danger"
                                                title="移除"
                                                onClick={() => handleRemove(entry)}
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        {(entry.grammar || entry.definitions.length > 0 || entry.examples.length > 0) && (
                                            <div className="wi-extra">
                                                {entry.grammar && (
                                                    <span className="wi-grammar-badge">{entry.grammar}</span>
                                                )}
                                                {entry.definitions.length > 0 && (
                                                    <div className="wi-def-list">
                                                        {entry.definitions.map((d, i) => (
                                                            <div key={i} className="wi-def-item">
                                                                {d.pos && <span className="wi-def-pos">{d.pos}</span>}
                                                                <span>{d.meaning}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {entry.examples.length > 0 && (
                                                    <button
                                                        className="wi-example-toggle"
                                                        onClick={e => {
                                                            e.stopPropagation();
                                                            setExpandedExamples(prev => {
                                                                const s = new Set(prev);
                                                                s.has(entry.id) ? s.delete(entry.id) : s.add(entry.id);
                                                                return s;
                                                            });
                                                        }}
                                                    >
                                                        {expandedExamples.has(entry.id) ? '收起例句' : `查看例句 (${entry.examples.length})`}
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                        {expandedExamples.has(entry.id) && entry.examples.length > 0 && (
                                            <div className="wi-example-list">
                                                {entry.examples.map((ex, i) => (
                                                    <div key={i} className="wi-example-item">
                                                        <div className="wi-ex-en">{ex.en}</div>
                                                        {ex.zh && <div className="wi-ex-zh">{ex.zh}</div>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </div>

                {/* 底部统计 */}
                {!loading && (
                    <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '12px' }}>
                    {t.vocab.notebookDetail.wordCount.replace('{n}', String(allEntries.length))}
                        {entries.length !== allEntries.length && t.vocab.notebookDetail.filteredCount.replace('{n}', String(entries.length))}
                    </p>
                )}
            </div>
        </Layout>
    );
}
