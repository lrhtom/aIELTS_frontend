import Layout from '../components/layout/Layout';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import { useLang } from '../i18n/LanguageContext';
import { showToast } from '../components/common/Toast';
import '../styles/prompt_page.css';

interface PromptItem {
    id: number;
    username: string;
    title: string;
    prompt_content: string;
    created_at: string;
    like_count: number;
    favorite_count: number;
    is_liked: boolean;
    is_favorited: boolean;
}

interface PromptResponse {
    data: PromptItem[];
    current_page: number;
    total_pages: number;
    total_count: number;
}

type Tab = 'community' | 'create';
type SortMode = 'latest' | 'popular';

export default function PromptPage() {
    const { translations: t } = useLang();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('community');

    // Community state
    const [prompts, setPrompts] = useState<PromptItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [jumpPage, setJumpPage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sortMode, setSortMode] = useState<SortMode>('latest');
    const [copiedId, setCopiedId] = useState<number | null>(null);

    // Create form state
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPrompts(1, sortMode);
    }, [sortMode]);

    useEffect(() => {
        fetchPrompts(currentPage, sortMode);
    }, [currentPage, sortMode]);

    const fetchPrompts = async (page: number, sort: SortMode) => {
        setIsLoading(true);
        try {
            const res = await api<PromptResponse>(`/prompts/?page=${page}&sort=${sort}`);
            setPrompts(res.data);
            setCurrentPage(res.current_page);
            setTotalPages(res.total_pages);
            setTotalCount(res.total_count);
        } catch (error: unknown) {
            showToast((error as { message?: string }).message || t.prompts.toast.fetchFailed, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSortChange = (mode: SortMode) => {
        if (mode === sortMode) return;
        setSortMode(mode);
        setCurrentPage(1);
    };

    const handleLike = async (id: number) => {
        try {
            const res = await api<{ liked: boolean; like_count: number }>(`/prompts/${id}/like/`, { method: 'POST' });
            setPrompts(prev => prev.map(p =>
                p.id === id ? { ...p, is_liked: res.liked, like_count: res.like_count } : p
            ));
        } catch {
            showToast(t.prompts.toast.actionFailed, 'error');
        }
    };

    const handleFavorite = async (id: number) => {
        try {
            const res = await api<{ favorited: boolean; favorite_count: number }>(`/prompts/${id}/favorite/`, { method: 'POST' });
            setPrompts(prev => prev.map(p =>
                p.id === id ? { ...p, is_favorited: res.favorited, favorite_count: res.favorite_count } : p
            ));
        } catch {
            showToast(t.prompts.toast.actionFailed, 'error');
        }
    };

    const handleCopy = (id: number, content: string) => {
        navigator.clipboard.writeText(content).then(() => {
            setCopiedId(id);
            showToast(t.prompts.toast.copied, 'success');
            setTimeout(() => setCopiedId(null), 2000);
        });
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) { showToast(t.prompts.toast.emptyTitle, 'error'); return; }
        if (!newContent.trim()) { showToast(t.prompts.toast.emptyContent, 'error'); return; }

        setIsSubmitting(true);
        try {
            await api('/prompts/', {
                method: 'POST',
                body: { title: newTitle.trim(), prompt_content: newContent.trim() }
            });
            showToast(t.prompts.toast.publishSuccess, 'success');
            setNewTitle('');
            setNewContent('');
            setActiveTab('community');
            setCurrentPage(1);
            fetchPrompts(1, sortMode);
        } catch (err: unknown) {
            showToast((err as Error).message || t.prompts.toast.publishFailed, 'error', t.common.error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJump = () => {
        const pageNum = parseInt(jumpPage, 10);
        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            setCurrentPage(pageNum);
            setJumpPage('');
        } else {
            showToast(t.prompts.toast.invalidPage.replace('{max}', String(totalPages)), 'error');
        }
    };

    const paginationRange = useMemo(() => {
        const range: number[] = [];
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);
        if (end - start < 4) {
            if (start === 1) end = Math.min(totalPages, 5);
            else if (end === totalPages) start = Math.max(1, totalPages - 4);
        }
        for (let i = start; i <= end; i++) range.push(i);
        return range;
    }, [currentPage, totalPages]);

    return (
        <Layout>
            <div className="prompt-hub-wrap">
                {/* Header */}
                <div className="prompt-hub-header">
                    <div className="prompt-header-content">
                        <Link to="/practice" className="prompt-back-link">{t.prompts.backToPractice}</Link>
                        <div className="prompt-hub-title-row">
                            <h1>{t.prompts.pageTitle}</h1>
                            <p>{t.prompts.pageSubtitle}</p>
                        </div>
                        <div className="prompt-header-badges">
                            <span className="header-badge header-badge-green">
                                <span className="header-badge-dot"></span>{t.prompts.badges.community}
                            </span>
                            <span className="header-badge header-badge-purple">
                                <span className="header-badge-dot"></span>{t.prompts.badges.likeAndFav}
                            </span>
                            <span className="header-badge header-badge-blue">
                                <span className="header-badge-dot"></span>{t.prompts.badges.copy}
                            </span>
                        </div>
                    </div>
                    {/* Tabs */}
                    <div className="prompt-tabs">
                        <button
                            className={`prompt-tab ${activeTab === 'community' ? 'active' : ''}`}
                            onClick={() => setActiveTab('community')}
                        >
                            <span className="tab-icon">—</span>{t.prompts.tabs.community}
                        </button>
                        <button
                            className={`prompt-tab ${activeTab === 'create' ? 'active' : ''}`}
                            onClick={() => setActiveTab('create')}
                        >
                            <span className="tab-icon">—</span>{t.prompts.tabs.create}
                        </button>
                    </div>
                </div>

                {/* Community Tab */}
                {activeTab === 'community' && (
                    <div className="prompt-community-panel">
                        {/* Toolbar */}
                        <div className="prompt-toolbar">
                            <span className="prompt-count-label">{t.prompts.community.totalCount.replace('{count}', String(totalCount))}</span>
                            <div className="prompt-sort-btns">
                                <button
                                    className={`sort-btn ${sortMode === 'latest' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('latest')}
                                >{t.prompts.community.sortLatest}</button>
                                <button
                                    className={`sort-btn ${sortMode === 'popular' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('popular')}
                                >{t.prompts.community.sortPopular}</button>
                            </div>
                        </div>

                        {isLoading ? (
                            <div className="prompt-loader">
                                <div className="loader-spinner"></div>
                                <span>{t.common.loading}</span>
                            </div>
                        ) : prompts.length === 0 ? (
                            <div className="prompt-empty">
                                <div className="empty-icon"></div>
                                <p>{t.prompts.community.emptyTitle}</p>
                            </div>
                        ) : (
                            <div className="prompt-grid">
                                {prompts.map(p => (
                                    <div key={p.id} className="prompt-card">
                                        <div className="prompt-card-inner">
                                            <div className="prompt-card-header">
                                                <h3 className="prompt-title">{p.title || t.prompts.community.untitled}</h3>
                                                <button
                                                    className={`copy-btn ${copiedId === p.id ? 'copied' : ''}`}
                                                    onClick={() => handleCopy(p.id, p.prompt_content)}
                                                    title={t.prompts.community.copyBtn}
                                                >
                                                    {copiedId === p.id ? (
                                                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> {t.prompts.community.copiedBtn}</>
                                                    ) : (
                                                        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> {t.prompts.community.copyBtn}</>
                                                    )}
                                                </button>
                                            </div>
                                            <div className="prompt-content-body">
                                                {p.prompt_content}
                                            </div>
                                        </div>
                                        <div className="prompt-card-footer">
                                            <div className="prompt-author-info">
                                                <div className="author-avatar-icon">👤</div>
                                                <span className="author-name">{p.username}</span>
                                                <span className="prompt-date">{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                                            </div>
                                            <div className="prompt-actions">
                                                <button
                                                    className={`action-btn like-btn ${p.is_liked ? 'active' : ''}`}
                                                    onClick={() => handleLike(p.id)}
                                                    title={t.prompts.likeTitle}
                                                >
                                                    <span className="action-icon">{p.is_liked ? '❤️' : '🤍'}</span>
                                                    <span className="action-count">{p.like_count}</span>
                                                </button>
                                                <button
                                                    className={`action-btn fav-btn ${p.is_favorited ? 'active' : ''}`}
                                                    onClick={() => handleFavorite(p.id)}
                                                    title={t.prompts.favTitle}
                                                >
                                                    <span className="action-icon">{p.is_favorited ? '⭐' : '☆'}</span>
                                                    <span className="action-count">{p.favorite_count}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="super-pagination">
                                <button className="page-btn page-edge" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>{t.prompts.pagination.first}</button>
                                <button className="page-btn page-nav" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>{t.prompts.pagination.prev}</button>
                                <div className="page-numbers">
                                    {paginationRange[0] > 1 && <span className="page-ellipsis">...</span>}
                                    {paginationRange.map(num => (
                                        <button
                                            key={num}
                                            className={`page-btn page-num ${num === currentPage ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(num)}
                                        >{num}</button>
                                    ))}
                                    {paginationRange[paginationRange.length - 1] < totalPages && <span className="page-ellipsis">...</span>}
                                </div>
                                <button className="page-btn page-nav" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>{t.prompts.pagination.next}</button>
                                <button className="page-btn page-edge" disabled={currentPage === totalPages} onClick={() => setCurrentPage(totalPages)}>{t.prompts.pagination.last}</button>
                                <div className="page-jumper">
                                    <span>{t.prompts.pagination.goto}</span>
                                    <input
                                        type="number" min={1} max={totalPages}
                                        value={jumpPage}
                                        onChange={e => setJumpPage(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
                                    />
                                    <span>{t.prompts.pagination.page}</span>
                                    <button className="page-btn page-go" onClick={handleJump}>{t.prompts.pagination.goBtn}</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Create Tab */}
                {activeTab === 'create' && (
                    <div className="prompt-create-panel">
                        <div className="create-card">
                            <div className="create-card-header">
                                <h2>{t.prompts.create.title}</h2>
                                <p>{t.prompts.create.subtitle}</p>
                            </div>
                            <form onSubmit={handlePublish} className="create-form">
                                <div className="form-field">
                                    <label htmlFor="prompt-title">{t.prompts.create.promptTitle} <span className="required">*</span></label>
                                    <input
                                        id="prompt-title"
                                        type="text"
                                        placeholder={t.prompts.create.promptTitlePlaceholder}
                                        value={newTitle}
                                        onChange={e => setNewTitle(e.target.value)}
                                        maxLength={200}
                                    />
                                    <span className="char-count">{newTitle.length}/200</span>
                                </div>
                                <div className="form-field">
                                    <label htmlFor="prompt-content">{t.prompts.create.promptContent} <span className="required">*</span></label>
                                    <textarea
                                        id="prompt-content"
                                        placeholder={t.prompts.create.promptContentPlaceholder}
                                        value={newContent}
                                        onChange={e => setNewContent(e.target.value)}
                                    />
                                </div>
                                <div className="form-actions">
                                    <div className="publisher-info">
                                        <div className="author-avatar-icon">👤</div>
                                        <span>{t.prompts.create.publishAs.replace('{name}', user?.username || t.prompts.create.anonymousAs)}</span>
                                    </div>
                                    <button type="submit" className="publish-btn" disabled={isSubmitting}>
                                        {isSubmitting ? (
                                            <><span className="btn-spinner"></span>{t.prompts.create.publishingBtn}</>
                                        ) : t.prompts.create.publishBtn}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
