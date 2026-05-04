import { useState, useEffect, useCallback } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

interface FeedbackItem {
    id: number;
    username: string;
    title: string;
    content: string;
    is_resolved: boolean;
    created_at: string;
}

interface PaginatedResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: FeedbackItem[];
}

export default function AdminFeedback() {
    const { translations: t } = useLang();
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [jumpPageInput, setJumpPageInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchFeedbacks = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get<PaginatedResponse>(`/admin/feedback?page=${page}&page_size=10`);
            setFeedbacks(response.data.results);
            setTotalCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch feedbacks:', error);
            toast.error(t.common.error);
        } finally {
            setIsLoading(false);
        }
    }, [t.common.error]);

    useEffect(() => {
        fetchFeedbacks(currentPage);
    }, [currentPage, fetchFeedbacks]);

    const handleToggleResolve = async (id: number, currentStatus: boolean) => {
        try {
            await apiClient.patch(`/admin/feedback/${id}`, { is_resolved: !currentStatus });
            setFeedbacks(prev => prev.map(item =>
                item.id === id ? { ...item, is_resolved: !currentStatus } : item
            ));
            toast.success(t.common.saved);
        } catch (error) {
            console.error('Failed to update status:', error);
            toast.error(t.common.error);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t.profile.account.confirmDelete)) return;

        try {
            await apiClient.delete(`/admin/feedback/${id}/delete`);
            toast.success(t.common.saved);
            // If it's the last item on the page and not the first page, go back
            if (feedbacks.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            } else {
                fetchFeedbacks(currentPage);
            }
        } catch (error) {
            console.error('Failed to delete feedback:', error);
            toast.error(t.common.error);
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / 10));

    const handleJumpToPage = () => {
        const rawValue = jumpPageInput.trim();
        if (!rawValue) {
            toast.error(t.profile.admin.users.toastEnterPage);
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            toast.error(t.profile.admin.users.toastInvalidPage.replace('{n}', String(totalPages)));
            return;
        }
        setCurrentPage(Math.min(totalPages, Math.max(1, parsed)));
        setJumpPageInput('');
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        for (let i = start; i <= end; i++) {
            pages.push(
                <button
                    key={i}
                    className={`page-btn ${currentPage === i ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="pagination">
                <button
                    className="page-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                >
                    &laquo;
                </button>
                {start > 1 && <span className="dots">...</span>}
                {pages}
                {end < totalPages && <span className="dots">...</span>}
                <button
                    className="page-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                >
                    &raquo;
                </button>
                <div className="page-jump">
                    <span>{t.profile.admin.pagination.jumpTo}</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={jumpPageInput}
                        onChange={e => {
                            const next = e.target.value;
                            if (next === '' || /^\d+$/.test(next)) {
                                setJumpPageInput(next);
                            }
                        }}
                        onKeyDown={e => { if (e.key === 'Enter') handleJumpToPage(); }}
                        placeholder={t.profile.admin.pagination.pagePlaceholder}
                        aria-label={t.profile.admin.pagination.jumpTo}
                    />
                    <button
                        className="page-btn page-jump-btn"
                        type="button"
                        onClick={handleJumpToPage}
                        disabled={!jumpPageInput.trim()}
                    >
                        {t.profile.admin.pagination.goBtn}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-feedback">
            <div className="admin-header">
                <h2>⚙️ {t.profile.admin.feedback.title}</h2>
                <div className="admin-stats">
                    {t.profile.admin.feedback.total.replace('{count}', totalCount.toString())}
                </div>
            </div>

            {isLoading ? (
                <div className="loading-state">{t.common.loading}</div>
            ) : feedbacks.length === 0 ? (
                <div className="empty-state">{t.profile.admin.feedback.noData}</div>
            ) : (
                <div className="feedback-list">
                    {feedbacks.map(item => (
                        <div key={item.id} className={`feedback-card ${item.is_resolved ? 'resolved' : ''}`}>
                            <div className="card-main">
                                <div className="card-header">
                                    <span className={`status-badge ${item.is_resolved ? 'done' : 'pending'}`}>
                                        {item.is_resolved ? t.profile.admin.feedback.resolved : t.profile.admin.feedback.unresolved}
                                    </span>
                                    <h3 className="card-title">{item.title}</h3>
                                    <span className="card-user">@{item.username}</span>
                                </div>
                                <p className="card-content">{item.content}</p>
                                <div className="card-date">
                                    {new Date(item.created_at).toLocaleString()}
                                </div>
                            </div>
                            <div className="card-actions">
                                <label className="resolve-toggle">
                                    <input
                                        type="checkbox"
                                        checked={item.is_resolved}
                                        onChange={() => handleToggleResolve(item.id, item.is_resolved)}
                                    />
                                    <span>{t.profile.admin.feedback.resolve}</span>
                                </label>
                                <button className="delete-btn" onClick={() => handleDelete(item.id)}>
                                    {t.profile.admin.feedback.delete}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {renderPagination()}

            <style>{`
                .admin-feedback {
                    padding: 20px;
                    max-width: 900px;
                }
                .admin-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                }
                .admin-stats {
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    background: var(--bg-secondary);
                    padding: 4px 12px;
                    border-radius: 20px;
                    border: 1px solid var(--border-color);
                }
                .feedback-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .feedback-card {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    gap: 20px;
                    transition: all 0.2s;
                    animation: fadeIn 0.3s ease-out;
                }
                .feedback-card:hover {
                    border-color: var(--primary-color);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .feedback-card.resolved {
                    opacity: 0.8;
                }
                .card-main {
                    flex: 1;
                    min-width: 0;
                }
                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 8px;
                    flex-wrap: wrap;
                }
                .status-badge {
                    font-size: 0.75rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-weight: 600;
                }
                .status-badge.pending {
                    background: rgba(255, 152, 0, 0.1);
                    color: #ff9800;
                    border: 1px solid rgba(255, 152, 0, 0.2);
                }
                .status-badge.done {
                    background: rgba(76, 175, 80, 0.1);
                    color: #4caf50;
                    border: 1px solid rgba(76, 175, 80, 0.2);
                }
                .card-title {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 600;
                    color: var(--text-primary);
                    flex: 1;
                    min-width: 200px;
                }
                .card-user {
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }
                .card-content {
                    color: var(--text-primary);
                    font-size: 0.95rem;
                    line-height: 1.5;
                    margin: 10px 0;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                .card-date {
                    font-size: 0.8rem;
                    color: var(--text-secondary);
                }
                .card-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    justify-content: center;
                    border-left: 1px solid var(--border-color);
                    padding-left: 20px;
                    min-width: 100px;
                }
                .resolve-toggle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-primary);
                }
                .resolve-toggle input {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                }
                .delete-btn {
                    padding: 6px 12px;
                    font-size: 0.85rem;
                    background: rgba(244, 67, 54, 0.1);
                    color: #f44336;
                    border: 1px solid rgba(244, 67, 54, 0.2);
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .delete-btn:hover {
                    background: #f44336;
                    color: white;
                }
                .pagination {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                    margin-top: 30px;
                }
                .page-jump {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--text-secondary);
                    font-size: 0.85rem;
                }
                .page-jump input {
                    width: 70px;
                    height: 34px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    padding: 0 8px;
                    text-align: center;
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    outline: none;
                }
                .page-jump input:focus {
                    border-color: var(--primary-color);
                }
                .page-jump-btn {
                    min-width: 46px;
                    padding: 8px 10px;
                }
                .page-btn {
                    padding: 8px 14px;
                    border: 1px solid var(--border-color);
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                    border-radius: 6px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .page-btn:hover:not(:disabled) {
                    border-color: var(--primary-color);
                    color: var(--primary-color);
                }
                .page-btn.active {
                    background: #0d9488;
                    color: #ffffff !important;
                    -webkit-text-fill-color: #ffffff;
                    border-color: #0d9488;
                    box-shadow: 0 2px 8px rgba(13, 148, 136, 0.28);
                }
                .page-btn.active:hover:not(:disabled) {
                    background: #0b8077;
                    color: #ffffff !important;
                }
                .page-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .dots {
                    color: var(--text-secondary);
                }
                .loading-state, .empty-state {
                    text-align: center;
                    padding: 60px;
                    color: var(--text-secondary);
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    border: 1px dotted var(--border-color);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 600px) {
                    .feedback-card {
                        flex-direction: column;
                    }
                    .card-actions {
                        flex-direction: row;
                        justify-content: flex-start;
                        border-left: none;
                        border-top: 1px solid var(--border-color);
                        padding-left: 0;
                        padding-top: 15px;
                    }
                    .page-jump {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    );
}
