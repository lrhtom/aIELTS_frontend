import Layout from '../../components/layout/Layout';
import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import {
    listWords, addWord, updateWord, removeWord,
    type NotebookEntry,
} from '../../api/notebook';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';

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

/* ── 标签输入组件（行内） ─────────────────────────────────────────────────── */

function TagInputField({
    tags, tagInput, onChange, onTagsChange,
}: {
    tags:         string[];
    tagInput:     string;
    onChange:     (v: string) => void;
    onTagsChange: (tags: string[]) => void;
}) {
    const commitTag = (val: string) => {
        const trimmed = val.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed)) {
            onTagsChange([...tags, trimmed]);
        }
        onChange('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitTag(tagInput);
        } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
            onTagsChange(tags.slice(0, -1));
        }
    };

    const removeTag = (t: string) => onTagsChange(tags.filter(x => x !== t));

    return (
        <div className="wf-tag-input-wrap" onClick={() => (document.querySelector('.wf-tag-raw-input') as HTMLElement)?.focus()}>
            {tags.map(t => (
                <span key={t} className="tag-chip active">
                    #{t}
                    <span className="tag-chip-remove" onClick={() => removeTag(t)}>×</span>
                </span>
            ))}
            <input
                className="wf-tag-raw-input"
                value={tagInput}
                placeholder={tags.length === 0 ? '输入标签，回车确认…' : ''}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (tagInput.trim()) commitTag(tagInput); }}
            />
        </div>
    );
}

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
    const [form, setForm] = useState<WordForm>({ ...EMPTY_FORM, ...initial });
    const set = (k: keyof WordForm) => (v: any) => setForm(f => ({ ...f, [k]: v }));

    const isDuplicate = submitLabel === '添加' && !!existingWords && form.word.trim() !== ''
        && existingWords.has(form.word.trim().toLowerCase());

    return (
        <div className="word-form">
            <div className="word-form-title">{submitLabel === '添加' ? '添加单词' : '编辑单词'}</div>

            <div className="wf-row">
                <div className="wf-field">
                    <div className="wf-label">英文单词 *</div>
                    <div style={{ position: 'relative' }}>
                        <input
                            className={`wf-input${isDuplicate ? ' wf-input-duplicate' : ''}`}
                            placeholder="e.g. abandon"
                            value={form.word}
                            disabled={submitLabel !== '添加'}
                            onChange={e => set('word')(e.target.value.trim())}
                        />
                        {isDuplicate && (
                            <span className="wf-duplicate-hint">已在笔记本中</span>
                        )}
                    </div>
                </div>
                <div className="wf-field">
                    <div className="wf-label">中文释义</div>
                    <input
                        className="wf-input"
                        placeholder="e.g. 放弃；抛弃"
                        value={form.custom_zh}
                        onChange={e => set('custom_zh')(e.target.value)}
                    />
                </div>
            </div>

            {submitLabel === '添加' && (
                <div className="wf-row">
                    <div className="wf-field">
                        <div className="wf-label">音标（可选）</div>
                        <input
                            className="wf-input"
                            placeholder="e.g. /əˈbændən/"
                            value={form.phonetic}
                            onChange={e => set('phonetic')(e.target.value)}
                        />
                    </div>
                    <div className="wf-field">
                        <div className="wf-label">词性（可选）</div>
                        <input
                            className="wf-input"
                            placeholder="e.g. v. / n. adj."
                            value={form.grammar}
                            onChange={e => set('grammar')(e.target.value)}
                        />
                    </div>
                </div>
            )}

            <div className="wf-field">
                <div className="wf-label">标签</div>
                <TagInputField
                    tags={form.tags}
                    tagInput={form.tagInput}
                    onChange={set('tagInput')}
                    onTagsChange={set('tags')}
                />
                <div className="wf-hint">按回车或逗号添加标签；Backspace 删除最后一个</div>
            </div>

            <div className="wf-field">
                <div className="wf-label">掌握度（0–5 星）</div>
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
                        {form.mastery_level === 0 ? '未评级' : `${form.mastery_level} 星`}
                    </span>
                </div>
            </div>

            <div className="wf-field">
                <div className="wf-label">个人笔记（可选）</div>
                <textarea
                    className="wf-input"
                    placeholder="记录记忆技巧、例句摘录等…"
                    value={form.notes}
                    rows={2}
                    style={{ resize: 'vertical', minHeight: '60px' }}
                    onChange={e => set('notes')(e.target.value)}
                />
            </div>

            <div className="wf-actions">
                <button className="wf-btn" onClick={onCancel} disabled={submitting}>取消</button>
                <button
                    className="wf-btn primary"
                    onClick={() => onSubmit(form)}
                    disabled={submitting || !form.word.trim() || isDuplicate}
                >
                    {submitting ? '保存中…' : submitLabel}
                </button>
            </div>
        </div>
    );
}

/* ── 主页面 ───────────────────────────────────────────────────────────────── */

export default function NotebookDetailPage() {
    const { id }   = useParams<{ id: string }>();
    const nbId     = Number(id);
    const navigate = useNavigate();

    const [entries,       setEntries]       = useState<NotebookEntry[]>([]);
    const [loading,       setLoading]       = useState(true);
    const [selectedTag,   setSelectedTag]   = useState('');
    const [searchQ,       setSearchQ]       = useState('');
    const [showAddForm,   setShowAddForm]   = useState(false);
    const [editId,        setEditId]        = useState<number | null>(null);
    const [submitting,    setSubmitting]    = useState(false);
    const [nbTitle,       setNbTitle]       = useState('笔记本');
    const [expandedExamples, setExpandedExamples] = useState<Set<number>>(new Set());
    const [allWords,      setAllWords]      = useState<Set<string>>(new Set());

    /* 加载单词列表 */
    const fetchEntries = useCallback(async (tag = '', q = '') => {
        try {
            const params: Record<string, string> = {};
            if (tag) params.tag = tag;
            if (q)   params.q   = q;
            const { entries: list } = await listWords(nbId, params);
            setEntries(list);
        } catch {
            showToast('加载失败', 'error');
        }
    }, [nbId]);

    useEffect(() => {
        if (!nbId || isNaN(nbId)) { navigate('/vocabulary/notebook', { replace: true }); return; }
        // 获取 notebook 标题可从 listNotebooks 取，这里通过 entries 网络调用若失败则跳转
        fetchEntries()
            .finally(() => setLoading(false));
        // 尝试从 localStorage 缓存的 notebook 列表中取标题
        try {
            const title = (window as any).__nbTitles?.[nbId];
            if (title) setNbTitle(title);
        } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 所有已用标签（从当前条目中提取，不受 tag 过滤影响） */
    const [allTags, setAllTags] = useState<string[]>([]);

    useEffect(() => {
        listWords(nbId).then(r => {
            const tags = new Set<string>();
            r.entries.forEach(e => e.tags.forEach(t => tags.add(t)));
            setAllTags([...tags].sort());
            setAllWords(new Set(r.entries.map(e => e.word)));
            if (r.entries.length > 0) setNbTitle('笔记本');
        }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* 切换 tag 过滤 */
    const handleTagFilter = (tag: string) => {
        const next = selectedTag === tag ? '' : tag;
        setSelectedTag(next);
        fetchEntries(next, searchQ);
    };

    /* 搜索 */
    const handleSearch = (q: string) => {
        setSearchQ(q);
        fetchEntries(selectedTag, q);
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
            setEntries(prev => [entry, ...prev]);
            setAllTags(prev => {
                const s = new Set([...prev, ...entry.tags]);
                return [...s].sort();
            });
            setAllWords(prev => new Set([...prev, entry.word]));
            setShowAddForm(false);
            showToast(`「${entry.word}」已添加`, 'success');
        } catch (err: any) {
            const msg = err?.response?.data?.error || '添加失败';
            if (err?.response?.status === 409) {
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
            setEntries(prev => prev.map(e => e.id === updated.id ? updated : e));
            setAllTags(prev => {
                const s = new Set([...prev, ...updated.tags]);
                return [...s].sort();
            });
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
        if (!confirm(`从笔记本移除「${entry.word}」？`)) return;
        try {
            await removeWord(nbId, entry.id);
            setEntries(prev => prev.filter(e => e.id !== entry.id));
            setAllWords(prev => { const s = new Set(prev); s.delete(entry.word); return s; });
            showToast('已移除', 'success');
        } catch {
            showToast('移除失败', 'error');
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
                                    onClick={() => { setSelectedTag(''); fetchEntries('', searchQ); }}
                                >
                                    ✕ 清除过滤
                                </span>
                            )}
                        </div>
                    )}

                    {/* 添加单词表单 */}
                    {showAddForm && (
                        <WordFormPanel
                            initial={{ ...EMPTY_FORM }}
                            submitLabel="添加"
                            onSubmit={handleAdd}
                            onCancel={() => setShowAddForm(false)}
                            submitting={submitting}
                            existingWords={allWords}
                        />
                    )}
                </div>

                {/* 单词列表 */}
                <div className="config-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '30px' }}>加载中…</p>
                    ) : entries.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📝</span>
                            {selectedTag || searchQ ? '没有匹配的单词' : '还没有单词，点击「添加单词」开始记录'}
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
                                            submitLabel="保存"
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
                        共 {entries.length} 个单词
                        {selectedTag && `，当前过滤：#${selectedTag}`}
                    </p>
                )}
            </div>
        </Layout>
    );
}
