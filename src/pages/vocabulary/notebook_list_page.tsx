import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import {
    listNotebooks, createNotebook, updateNotebook, deleteNotebook,
    type Notebook,
} from '../../api/notebook';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';

const COLORS = [
    { key: 'teal',    hex: '#0d9488' },
    { key: 'indigo',  hex: '#6366f1' },
    { key: 'violet',  hex: '#8b5cf6' },
    { key: 'rose',    hex: '#f43f5e' },
    { key: 'amber',   hex: '#f59e0b' },
    { key: 'emerald', hex: '#10b981' },
    { key: 'sky',     hex: '#0ea5e9' },
    { key: 'orange',  hex: '#f97316' },
];

interface ModalState {
    mode:        'create' | 'edit';
    id?:         number;
    title:       string;
    description: string;
    cover_color: string;
    is_public:   boolean;
}

const DEFAULT_MODAL: ModalState = {
    mode:        'create',
    title:       '',
    description: '',
    cover_color: 'teal',
    is_public:   false,
};

export default function NotebookListPage() {
    const { translations: t } = useLang();
    const navigate = useNavigate();

    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [modal,     setModal]     = useState<ModalState | null>(null);
    const [saving,    setSaving]    = useState(false);

    useEffect(() => {
        listNotebooks()
            .then(r => setNotebooks(r.notebooks))
            .catch(() => showToast(t.vocab.notebooks.msgFail, 'error'))
            .finally(() => setLoading(false));
    }, [t]);

    /* ── 打开新建弹窗 ── */
    const openCreate = () => setModal({ ...DEFAULT_MODAL });

    /* ── 打开编辑弹窗 ── */
    const openEdit = (e: React.MouseEvent, nb: Notebook) => {
        e.stopPropagation();
        setModal({
            mode:        'edit',
            id:          nb.id,
            title:       nb.title,
            description: nb.description,
            cover_color: nb.cover_color,
            is_public:   nb.is_public,
        });
    };

    /* ── 删除笔记本 ── */
    const handleDelete = async (e: React.MouseEvent, nb: Notebook) => {
        e.stopPropagation();
        if (!confirm(t.vocab.notebooks.msgDeleteConfirm.replace('{title}', nb.title))) return;
        try {
            await deleteNotebook(nb.id);
            setNotebooks(prev => prev.filter(n => n.id !== nb.id));
            showToast(t.vocab.notebooks.msgDeleteSuccess, 'success');
        } catch {
            showToast(t.vocab.notebooks.msgFail, 'error');
        }
    };

    /* ── 提交弹窗 ── */
    const handleSubmit = async () => {
        if (!modal) return;
        if (!modal.title.trim()) { showToast(t.vocab.notebooks.msgTitleRequired, 'error'); return; }
        setSaving(true);
        try {
            if (modal.mode === 'create') {
                const { notebook } = await createNotebook({
                    title:       modal.title.trim(),
                    description: modal.description.trim(),
                    cover_color: modal.cover_color,
                    is_public:   modal.is_public,
                });
                setNotebooks(prev => [notebook, ...prev]);
                showToast(t.vocab.notebooks.msgCreateSuccess, 'success');
            } else {
                const { notebook } = await updateNotebook(modal.id!, {
                    title:       modal.title.trim(),
                    description: modal.description.trim(),
                    cover_color: modal.cover_color,
                    is_public:   modal.is_public,
                });
                setNotebooks(prev => prev.map(n => n.id === notebook.id ? notebook : n));
                showToast(t.vocab.notebooks.msgSaveSuccess, 'success');
            }
            setModal(null);
        } catch (err: unknown) {
            const e = err as { response?: { data?: { error?: string } } };
            const msg = e.response?.data?.error || t.vocab.notebooks.msgFail;
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout
    pageTitle={t.vocab.notebooks.title}
    pageSubtitle={t.vocab.notebooks.desc}
    backUrl='/vocabulary'
    backText={`${t.common.back} ${t.vocab.hub.title}`}
>
            <div className="config-page-wrap">
                {/* 新建按钮 */}
                <div className="config-card" style={{ paddingBottom: '16px' }}>
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        onClick={openCreate}
                    >
                        <span className="btn-icon">📓</span> {t.vocab.notebooks.btnCreate}
                    </button>
                    {notebooks.length >= 10 && (
                        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            {t.vocab.notebooks.maxLimitHint}
                        </p>
                    )}
                </div>

                {/* 笔记本网格 */}
                <div className="config-card">
                    {loading ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>{t.common.loading}</p>
                    ) : notebooks.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📭</span>
                            {t.vocab.notebooks.emptyTitle}
                        </div>
                    ) : (
                        <div className="nb-grid">
                            {notebooks.map(nb => (
                                <div
                                    key={nb.id}
                                    className="nb-card"
                                    data-color={nb.cover_color}
                                    onClick={() => navigate(`/vocabulary/notebook/${nb.id}`)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={e => e.key === 'Enter' && navigate(`/vocabulary/notebook/${nb.id}`)}
                                >
                                    <div className="nb-card-title">{nb.title}</div>
                                    {nb.description && (
                                        <div className="nb-card-desc">{nb.description}</div>
                                    )}
                                    <div className="nb-card-meta">
                                        <span className="nb-card-word-count">{t.vocab.notebooks.cardWordCount.replace('{n}', String(nb.word_count))}</span>
                                        {nb.is_public && <span>{t.vocab.notebooks.cardPublic}</span>}
                                    </div>

                                    <div className="nb-card-actions">
                                        <button
                                            className="nb-action-btn"
                                            title={t.vocab.common.edit}
                                            onClick={e => openEdit(e, nb)}
                                        >✏️</button>
                                        <button
                                            className="nb-action-btn danger"
                                            title={t.vocab.common.delete}
                                            onClick={e => handleDelete(e, nb)}
                                        >🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 新建/编辑弹窗 ── */}
            {modal && (
                <div className="modal-overlay" onClick={() => !saving && setModal(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-title">
                            {modal.mode === 'create' ? t.vocab.notebooks.modalCreateTitle : t.vocab.notebooks.modalEditTitle}
                        </div>

                        <div>
                            <div className="modal-label">{t.vocab.notebooks.modalTitleLabel}</div>
                            <input
                                className="modal-input"
                                placeholder={t.vocab.notebooks.modalTitlePlaceholder}
                                value={modal.title}
                                maxLength={100}
                                autoFocus
                                onChange={e => setModal(m => m && ({ ...m, title: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            />
                        </div>

                        <div>
                            <div className="modal-label">{t.vocab.notebooks.modalDescLabel}</div>
                            <input
                                className="modal-input"
                                placeholder={t.vocab.notebooks.modalDescPlaceholder}
                                value={modal.description}
                                maxLength={200}
                                onChange={e => setModal(m => m && ({ ...m, description: e.target.value }))}
                            />
                        </div>

                        <div>
                            <div className="modal-label">{t.vocab.notebooks.modalColorLabel}</div>
                            <div className="nb-color-picker">
                                {COLORS.map(c => (
                                    <div
                                        key={c.key}
                                        className={`nb-color-dot${modal.cover_color === c.key ? ' selected' : ''}`}
                                        style={{ background: c.hex }}
                                        title={c.key}
                                        onClick={() => setModal(m => m && ({ ...m, cover_color: c.key }))}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="modal-btn" onClick={() => setModal(null)} disabled={saving}>{t.vocab.notebooks.btnCancel}</button>
                            <button className="modal-btn primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? t.common.saving : modal.mode === 'create' ? t.vocab.notebooks.btnCreate : t.vocab.notebooks.btnSave}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
