import AppNavbar from '../components/AppNavbar';
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { showToast } from '../components/Toast';
import '../styles/prompt_page.css';
import '../styles/practice_hub.css';

interface PromptItem {
    id: number;
    username: string;
    prompt_content: string;
    created_at: string;
}

interface PromptResponse {
    data: PromptItem[];
    current_page: number;
    total_pages: number;
    total_count: number;
}

export default function PromptPage() {
    const [prompts, setPrompts] = useState<PromptItem[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [jumpPage, setJumpPage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Form states
    const [newUsername, setNewUsername] = useState('');
    const [newContent, setNewContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchPrompts(currentPage);
    }, [currentPage]);

    const fetchPrompts = async (page: number) => {
        setIsLoading(true);
        try {
            const res = await api<PromptResponse>(`/prompts/?page=${page}`);
            setPrompts(res.data);
            setCurrentPage(res.current_page);
            setTotalPages(res.total_pages);
        } catch (error: any) {
            showToast(error.message || '获取提示词失败', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newUsername.trim() || !newContent.trim()) {
            showToast('用户名和内容不能为空！', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await api('/prompts/', {
                method: 'POST',
                body: {
                    username: newUsername.trim(),
                    prompt_content: newContent.trim()
                }
            });
            showToast('发布成功！', 'success');
            setNewContent('');
            // 发布成功后强制回到第一页看最新的
            if (currentPage === 1) {
                fetchPrompts(1);
            } else {
                setCurrentPage(1);
            }
        } catch (err: unknown) {
            console.error('Save prompt error:', err);
            showToast((err as Error).message || '保存失败', 'error', '错误');
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
            showToast(`请输入 1 到 ${totalPages} 之间的有效页码`, 'error');
        }
    };

    // 分页计算核心：基于 current - 2 到 current + 2 的 5 个页面
    const paginationRange = useMemo(() => {
        const range: number[] = [];
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, currentPage + 2);

        // 补偿机制：保证始终最多显示 5 个按钮（如果总页数够）
        if (end - start < 4) {
            if (start === 1) {
                end = Math.min(totalPages, 5);
            } else if (end === totalPages) {
                start = Math.max(1, totalPages - 4);
            }
        }

        for (let i = start; i <= end; i++) {
            range.push(i);
        }
        return range;
    }, [currentPage, totalPages]);

    return (
        <div className="practice-hub">
            <AppNavbar />

            <div className="prompt-hub-container">
                <div className="practice-hub-header">
                    <Link to="/practice" className="back-link">← AI Practice</Link>
                    <h1>💡 AI Prompt Hub</h1>
                    <p>分享与查找最绝赞的 AI IELTS 高分提示词密码</p>
                </div>

                <div className="prompt-publish-card">
                    <h3>✍️ 贡献灵感</h3>
                    <form onSubmit={handlePublish} className="prompt-form">
                        <input
                            type="text"
                            placeholder="你的大名 (如: lrhtom)"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            maxLength={50}
                            required
                        />
                        <textarea
                            placeholder="在这里粘贴你的魔法提示词..."
                            value={newContent}
                            onChange={e => setNewContent(e.target.value)}
                            required
                        />
                        <button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? '发送中...' : '🚀 发布提示词'}
                        </button>
                    </form>
                </div>

                <div className="prompt-list-section">
                    <h3>🏆 社区提示词榜单</h3>
                    {isLoading ? (
                        <div className="prompt-loader">拼命翻找中...</div>
                    ) : prompts.length === 0 ? (
                        <div className="prompt-empty">暂无提示词，快来做第一个发布者吧！</div>
                    ) : (
                        <div className="prompt-grid">
                            {prompts.map(p => (
                                <div key={p.id} className="prompt-card">
                                    <div className="prompt-author">
                                        <span className="author-icon">👤</span> {p.username}
                                    </div>
                                    <div className="prompt-content">
                                        {p.prompt_content}
                                    </div>
                                    <div className="prompt-date">
                                        {new Date(p.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 复杂超级分页器 */}
                {totalPages > 0 && (
                    <div className="super-pagination">
                        <button
                            className="page-btn page-edge"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}>
                            &laquo; 首页
                        </button>
                        <button
                            className="page-btn page-nav"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>
                            &lsaquo; 上一页
                        </button>

                        <div className="page-numbers">
                            {paginationRange[0] > 1 && <span className="page-ellipsis">...</span>}

                            {paginationRange.map(pageNum => (
                                <button
                                    key={pageNum}
                                    className={`page-btn page-num ${pageNum === currentPage ? 'active' : ''}`}
                                    onClick={() => setCurrentPage(pageNum)}
                                    aria-current={pageNum === currentPage ? "page" : undefined}
                                >
                                    {pageNum}
                                </button>
                            ))}

                            {paginationRange[paginationRange.length - 1] < totalPages && <span className="page-ellipsis">...</span>}
                        </div>

                        <button
                            className="page-btn page-nav"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}>
                            下一页 &rsaquo;
                        </button>
                        <button
                            className="page-btn page-edge"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(totalPages)}>
                            末页 &raquo;
                        </button>

                        <div className="page-jumper">
                            <span>前往</span>
                            <input
                                type="number"
                                min={1}
                                max={totalPages}
                                value={jumpPage}
                                onChange={(e) => setJumpPage(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleJump() }}
                            />
                            <span>页</span>
                            <button className="page-btn page-go" onClick={handleJump}>GO</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
