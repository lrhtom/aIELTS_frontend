import Layout from '../../components/layout/Layout';
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import {
    listNotebooks, createNotebook, updateNotebook, deleteNotebook,
    type Notebook,
} from '../../api/notebook';
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
    const navigate = useNavigate();

    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [modal,     setModal]     = useState<ModalState | null>(null);
    const [saving,    setSaving]    = useState(false);

    useEffect(() => {
        listNotebooks()
            .then(r => setNotebooks(r.notebooks))
            .catch(() => showToast('加载失败，请刷新', 'error'))
            .finally(() => setLoading(false));
    }, []);

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
        if (!confirm(`确认删除「${nb.title}」？该笔记本内所有单词记录将一并删除。`)) return;
        try {
            await deleteNotebook(nb.id);
            setNotebooks(prev => prev.filter(n => n.id !== nb.id));
            showToast('已删除', 'success');
        } catch {
            showToast('删除失败', 'error');
        }
    };

    /* ── 提交弹窗 ── */
    const handleSubmit = async () => {
        if (!modal) return;
        if (!modal.title.trim()) { showToast('标题不能为空', 'error'); return; }
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
                showToast('笔记本已创建', 'success');
            } else {
                const { notebook } = await updateNotebook(modal.id!, {
                    title:       modal.title.trim(),
                    description: modal.description.trim(),
                    cover_color: modal.cover_color,
                    is_public:   modal.is_public,
                });
                setNotebooks(prev => prev.map(n => n.id === notebook.id ? notebook : n));
                showToast('已保存', 'success');
            }
            setModal(null);
        } catch (err: any) {
            const msg = err?.response?.data?.error || '操作失败，请重试';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Layout>
            <div className="config-page-wrap">
                <div className="practice-header">
                    <Link to="/vocabulary" className="back-link">返回词汇学习</Link>
                    <h1>我的笔记本</h1>
                    <p>自建单词本，整理学习内容，用标签分类管理</p>
                </div>

                {/* 新建按钮 */}
                <div className="config-card" style={{ paddingBottom: '16px' }}>
                    <button
                        className="skill-btn reading"
                        style={{ width: '100%' }}
                        onClick={openCreate}
                    >
                        <span className="btn-icon">📓</span> 新建笔记本
                    </button>
                    {notebooks.length >= 10 && (
                        <p style={{ marginTop: '10px', fontSize: '13px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                            已达上限（每人最多 10 本）
                        </p>
                    )}
                </div>

                {/* 笔记本网格 */}
                <div className="config-card">
                    {loading ? (
                        <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0' }}>加载中…</p>
                    ) : notebooks.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📭</span>
                            还没有笔记本，点击上方「新建笔记本」开始吧
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
                                        <span className="nb-card-word-count">{nb.word_count} 词</span>
                                        {nb.is_public && <span>公开</span>}
                                    </div>

                                    <div className="nb-card-actions">
                                        <button
                                            className="nb-action-btn"
                                            title="编辑"
                                            onClick={e => openEdit(e, nb)}
                                        >✏️</button>
                                        <button
                                            className="nb-action-btn danger"
                                            title="删除"
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
                            {modal.mode === 'create' ? '新建笔记本' : '编辑笔记本'}
                        </div>

                        <div>
                            <div className="modal-label">标题 *</div>
                            <input
                                className="modal-input"
                                placeholder="笔记本名称"
                                value={modal.title}
                                maxLength={100}
                                autoFocus
                                onChange={e => setModal(m => m && ({ ...m, title: e.target.value }))}
                                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                            />
                        </div>

                        <div>
                            <div className="modal-label">描述（可选）</div>
                            <input
                                className="modal-input"
                                placeholder="简短描述该笔记本的内容"
                                value={modal.description}
                                maxLength={200}
                                onChange={e => setModal(m => m && ({ ...m, description: e.target.value }))}
                            />
                        </div>

                        <div>
                            <div className="modal-label">颜色</div>
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
                            <button className="modal-btn" onClick={() => setModal(null)} disabled={saving}>取消</button>
                            <button className="modal-btn primary" onClick={handleSubmit} disabled={saving}>
                                {saving ? '保存中…' : modal.mode === 'create' ? '创建' : '保存'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}
