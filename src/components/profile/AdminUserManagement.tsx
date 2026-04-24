import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

type UserRow = {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
    is_superuser: boolean;
    is_active: boolean;
    is_banned: boolean;
    is_email_verified: boolean;
    date_joined: string;
    last_login: string | null;
    atBalance: number;
};

type PaginatedResponse = {
    count: number;
    next: string | null;
    previous: string | null;
    results: UserRow[];
};

export default function AdminUserManagement() {
    const [users, setUsers] = useState<UserRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [jumpPageInput, setJumpPageInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'normal' | 'admin' | 'banned'>('all');

    const fetchUsers = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get<PaginatedResponse>(`/admin/users?page=${page}&page_size=20`);
            setUsers(response.data.results);
            setTotalCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('加载用户失败');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUsers(currentPage);
    }, [currentPage, fetchUsers]);

    const handleToggleBan = async (user: UserRow) => {
        if (user.is_staff || user.is_superuser) {
            toast.error('管理员账号不可封禁/解封');
            return;
        }

        try {
            await apiClient.patch(`/admin/users/${user.id}/ban`, { is_banned: !user.is_banned });
            setUsers((prev) => prev.map((item) =>
                item.id === user.id ? { ...item, is_banned: !item.is_banned } : item
            ));
            toast.success(user.is_banned ? '已解封用户' : '已封禁用户');
        } catch (error: unknown) {
            console.error('Failed to toggle ban:', error);
            toast.error('操作失败');
        }
    };

    const handleDelete = async (user: UserRow) => {
        if (user.is_staff || user.is_superuser) {
            toast.error('管理员账号不可删除');
            return;
        }

        if (!window.confirm(`确认删除用户 ${user.username} 吗？此操作不可恢复。`)) return;

        try {
            await apiClient.delete(`/admin/users/${user.id}/delete`);
            toast.success('用户已删除');
            if (users.length === 1 && currentPage > 1) {
                setCurrentPage((p) => p - 1);
            } else {
                fetchUsers(currentPage);
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
            toast.error('删除失败');
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / 20));
    const pageAdminCount = users.filter((user) => user.is_staff || user.is_superuser).length;
    const pageBannedCount = users.filter((user) => user.is_banned).length;

    const handleJumpToPage = () => {
        const rawValue = jumpPageInput.trim();
        if (!rawValue) {
            toast.error('请输入页码');
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            toast.error(`请输入 1 到 ${totalPages} 的整数页码`);
            return;
        }
        setCurrentPage(Math.min(totalPages, Math.max(1, parsed)));
        setJumpPageInput('');
    };

    const filteredUsers = useMemo(() => {
        const normalizedKeyword = keyword.trim().toLowerCase();

        return users.filter((user) => {
            const isAdmin = user.is_staff || user.is_superuser;

            if (roleFilter === 'admin' && !isAdmin) return false;
            if (roleFilter === 'normal' && isAdmin) return false;
            if (roleFilter === 'banned' && !user.is_banned) return false;

            if (!normalizedKeyword) return true;

            return (
                user.username.toLowerCase().includes(normalizedKeyword) ||
                user.email.toLowerCase().includes(normalizedKeyword) ||
                String(user.id).includes(normalizedKeyword)
            );
        });
    }, [users, keyword, roleFilter]);

    const formatDateTime = (dateStr: string | null) => {
        if (!dateStr) return '从未登录';
        return new Date(dateStr).toLocaleString();
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
                    className={`admin-users-page-btn ${currentPage === i ? 'active' : ''}`}
                    onClick={() => setCurrentPage(i)}
                >
                    {i}
                </button>
            );
        }

        return (
            <div className="admin-users-pagination">
                <button className="admin-users-page-btn" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
                    &laquo;
                </button>
                {start > 1 && <span className="admin-users-dots">...</span>}
                {pages}
                {end < totalPages && <span className="admin-users-dots">...</span>}
                <button className="admin-users-page-btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                    &raquo;
                </button>
                <div className="admin-users-page-jump">
                    <span>跳到</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={jumpPageInput}
                        onChange={(e) => {
                            const next = e.target.value;
                            if (next === '' || /^\d+$/.test(next)) {
                                setJumpPageInput(next);
                            }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleJumpToPage(); }}
                        placeholder="页码"
                        aria-label="跳转到指定页"
                    />
                    <button
                        className="admin-users-page-btn admin-users-page-jump-btn"
                        type="button"
                        onClick={handleJumpToPage}
                        disabled={!jumpPageInput.trim()}
                    >
                        GO
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="admin-users">
            <div className="admin-users-header">
                <div className="admin-users-title-block">
                    <h2>👥 用户管理</h2>
                    <p>快速筛选、查看用户状态并执行封禁或删除操作</p>
                </div>
                <div className="admin-users-stats">
                    <span className="admin-users-stat-pill">总用户 {totalCount}</span>
                    <span className="admin-users-stat-pill">本页 {users.length}</span>
                    <span className="admin-users-stat-pill">筛选后 {filteredUsers.length}</span>
                    <span className="admin-users-stat-pill">本页管理员 {pageAdminCount}</span>
                    <span className="admin-users-stat-pill">本页封禁 {pageBannedCount}</span>
                </div>
            </div>

            <div className="admin-users-toolbar">
                <div className="admin-users-search-wrap">
                    <span className="admin-users-search-icon">🔍</span>
                    <input
                        type="text"
                        className="admin-users-search"
                        placeholder="按用户名 / 邮箱 / ID 搜索当前页"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                    />
                </div>
                <div className="admin-users-controls">
                    <select
                        className="admin-users-filter"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value as 'all' | 'normal' | 'admin' | 'banned')}
                    >
                        <option value="all">全部用户</option>
                        <option value="normal">普通用户</option>
                        <option value="admin">管理员</option>
                        <option value="banned">仅封禁用户</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="admin-users-state">加载中...</div>
            ) : users.length === 0 ? (
                <div className="admin-users-state">暂无用户</div>
            ) : filteredUsers.length === 0 ? (
                <div className="admin-users-state">当前筛选条件下无结果</div>
            ) : (
                <div className="admin-users-list">
                    {filteredUsers.map((user) => {
                        const isAdmin = user.is_staff || user.is_superuser;
                        return (
                            <div key={user.id} className="admin-users-card">
                                <div className="admin-users-main">
                                    <div className="admin-users-card-header">
                                        <h3 className="admin-users-name">{user.username}</h3>
                                        <span className="admin-users-id">#{user.id}</span>
                                    </div>

                                    <div className="admin-users-badges">
                                        <span className={`admin-users-badge ${user.is_banned ? 'is-banned' : 'is-normal'}`}>
                                            {user.is_banned ? '已封禁' : '正常'}
                                        </span>
                                        {isAdmin && <span className="admin-users-badge is-admin">管理员</span>}
                                        {user.is_email_verified && <span className="admin-users-badge is-verified">邮箱已验证</span>}
                                    </div>

                                    <div className="admin-users-grid">
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">邮箱</span>
                                            <span className="admin-users-value">{user.email || '未填写'}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">AT 余额</span>
                                            <span className="admin-users-value">{user.atBalance}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">注册时间</span>
                                            <span className="admin-users-value">{formatDateTime(user.date_joined)}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">最近登录</span>
                                            <span className="admin-users-value">{formatDateTime(user.last_login)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-users-actions">
                                    <button
                                        className="admin-users-btn ban-btn"
                                        onClick={() => handleToggleBan(user)}
                                        disabled={isAdmin}
                                    >
                                        {user.is_banned ? '解封' : '封禁'}
                                    </button>
                                    <button
                                        className="admin-users-btn delete-btn"
                                        onClick={() => handleDelete(user)}
                                        disabled={isAdmin}
                                    >
                                        删除
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {renderPagination()}

            <style>{`
                .admin-users {
                    max-width: 1120px;
                    margin: 0 auto;
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .admin-users-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 18px;
                    padding: 18px 20px;
                    border-radius: 14px;
                    background: linear-gradient(130deg, rgba(13, 148, 136, 0.1), rgba(15, 23, 42, 0.04));
                    border: 1px solid rgba(13, 148, 136, 0.16);
                }

                .admin-users-title-block {
                    min-width: 240px;
                }

                .admin-users-header h2 {
                    margin: 0;
                    font-size: 1.35rem;
                    color: #0f172a;
                }

                .admin-users-header p {
                    margin: 6px 0 0;
                    color: #475569;
                    font-size: 0.92rem;
                }

                .admin-users-stats {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    justify-content: flex-end;
                }

                .admin-users-stat-pill {
                    padding: 5px 10px;
                    border-radius: 999px;
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #0d9488;
                    border: 1px solid rgba(13, 148, 136, 0.22);
                    background: rgba(13, 148, 136, 0.08);
                }

                .admin-users-toolbar {
                    display: flex;
                    gap: 12px;
                    align-items: stretch;
                    flex-wrap: wrap;
                    padding: 12px;
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(4px);
                }

                .admin-users-search-wrap {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                    min-width: 260px;
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    padding: 0 10px;
                    background: rgba(255, 255, 255, 0.86);
                }

                .admin-users-search-icon {
                    color: #64748b;
                    font-size: 0.88rem;
                    line-height: 1;
                }

                .admin-users-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }

                .admin-users-search,
                .admin-users-filter {
                    border: 1px solid var(--color-border);
                    border-radius: 10px;
                    padding: 10px 12px;
                    background: rgba(255, 255, 255, 0.8);
                    color: #0f172a;
                    font-size: 0.9rem;
                }

                .admin-users-search {
                    flex: 1;
                    min-width: 0;
                    border: none;
                    background: transparent;
                    padding-left: 0;
                }

                .admin-users-filter {
                    min-width: 170px;
                    background: rgba(255, 255, 255, 0.86);
                }

                .admin-users-search-wrap:focus-within,
                .admin-users-filter:focus {
                    outline: none;
                    border-color: #0d9488;
                    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12);
                }

                .admin-users-search:focus {
                    outline: none;
                    box-shadow: none;
                }

                .admin-users-list {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 14px;
                }

                .admin-users-card {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) 148px;
                    gap: 18px;
                    padding: 18px;
                    border-radius: 14px;
                    border: 1px solid var(--color-border);
                    background: rgba(255, 255, 255, 0.76);
                    backdrop-filter: blur(6px);
                    transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
                }

                .admin-users-card:hover {
                    border-color: rgba(13, 148, 136, 0.36);
                    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
                    transform: translateY(-1px);
                }

                .admin-users-main {
                    min-width: 0;
                }

                .admin-users-card-header {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .admin-users-name {
                    margin: 0;
                    font-size: 1.05rem;
                    color: #0f172a;
                    font-weight: 700;
                }

                .admin-users-id {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: #64748b;
                    padding: 2px 8px;
                    border-radius: 999px;
                    background: #f1f5f9;
                }

                .admin-users-badges {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 10px;
                }

                .admin-users-badge {
                    font-size: 0.74rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 999px;
                    border: 1px solid transparent;
                }

                .admin-users-badge.is-normal {
                    color: #0d9488;
                    border-color: rgba(13, 148, 136, 0.24);
                    background: rgba(13, 148, 136, 0.08);
                }

                .admin-users-badge.is-banned {
                    color: #b45309;
                    border-color: rgba(245, 158, 11, 0.3);
                    background: rgba(245, 158, 11, 0.12);
                }

                .admin-users-badge.is-admin {
                    color: #1d4ed8;
                    border-color: rgba(59, 130, 246, 0.3);
                    background: rgba(59, 130, 246, 0.1);
                }

                .admin-users-badge.is-verified {
                    color: #166534;
                    border-color: rgba(34, 197, 94, 0.28);
                    background: rgba(34, 197, 94, 0.1);
                }

                .admin-users-grid {
                    margin-top: 14px;
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 10px;
                }

                .admin-users-item {
                    background: rgba(248, 250, 252, 0.9);
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 10px 12px;
                    min-width: 0;
                }

                .admin-users-label {
                    display: block;
                    font-size: 0.74rem;
                    color: #64748b;
                    margin-bottom: 4px;
                }

                .admin-users-value {
                    display: block;
                    font-size: 0.86rem;
                    color: #0f172a;
                    font-weight: 600;
                    overflow-wrap: anywhere;
                }

                .admin-users-actions {
                    display: flex;
                    flex-direction: column;
                    justify-content: flex-start;
                    gap: 10px;
                    border-left: 1px dashed #d7dee7;
                    padding-left: 14px;
                    padding-top: 6px;
                }

                .admin-users-btn {
                    width: 100%;
                    border-radius: 9px;
                    border: 1px solid transparent;
                    padding: 10px 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .admin-users-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }

                .admin-users-btn.ban-btn {
                    color: #0f766e;
                    background: rgba(13, 148, 136, 0.12);
                    border-color: rgba(13, 148, 136, 0.24);
                }

                .admin-users-btn.ban-btn:hover:not(:disabled) {
                    background: rgba(13, 148, 136, 0.2);
                }

                .admin-users-btn.delete-btn {
                    color: #b91c1c;
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.26);
                }

                .admin-users-btn.delete-btn:hover:not(:disabled) {
                    background: rgba(239, 68, 68, 0.18);
                }

                .admin-users-state {
                    text-align: center;
                    padding: 44px 20px;
                    border: 1px dashed #cbd5e1;
                    border-radius: 12px;
                    color: #64748b;
                    background: rgba(248, 250, 252, 0.66);
                }

                .admin-users-pagination {
                    margin-top: 8px;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                    flex-wrap: wrap;
                }

                .admin-users-page-jump {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.82rem;
                    color: #64748b;
                }

                .admin-users-page-jump input {
                    width: 72px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    color: #334155;
                    text-align: center;
                    padding: 0 8px;
                    outline: none;
                }

                .admin-users-page-jump input:focus {
                    border-color: #0d9488;
                }

                .admin-users-page-jump-btn {
                    min-width: 46px;
                    padding: 0 10px;
                }

                .admin-users-page-btn {
                    min-width: 36px;
                    height: 34px;
                    border-radius: 8px;
                    border: 1px solid #cbd5e1;
                    background: #fff;
                    color: #334155;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .admin-users-page-btn:hover:not(:disabled) {
                    border-color: #0d9488;
                    color: #0d9488;
                }

                .admin-users-page-btn.active {
                    background: #0d9488;
                    border-color: #0d9488;
                    color: #fff;
                }

                .admin-users-page-btn:disabled {
                    opacity: 0.45;
                    cursor: not-allowed;
                }

                .admin-users-dots {
                    color: #94a3b8;
                    font-weight: 700;
                }

                @media (max-width: 900px) {
                    .admin-users-card {
                        grid-template-columns: 1fr;
                    }

                    .admin-users-actions {
                        border-left: none;
                        border-top: 1px dashed #d7dee7;
                        padding-left: 0;
                        padding-top: 12px;
                        flex-direction: row;
                        justify-content: flex-start;
                    }

                    .admin-users-btn {
                        max-width: 160px;
                    }
                }

                @media (max-width: 640px) {
                    .admin-users-header {
                        flex-direction: column;
                    }

                    .admin-users-stats {
                        justify-content: flex-start;
                    }

                    .admin-users-grid {
                        grid-template-columns: 1fr;
                    }

                    .admin-users-toolbar {
                        padding: 10px;
                    }

                    .admin-users-search-wrap,
                    .admin-users-controls,
                    .admin-users-filter {
                        width: 100%;
                        min-width: 100%;
                    }

                    .admin-users-actions {
                        flex-direction: column;
                    }

                    .admin-users-btn {
                        max-width: 100%;
                    }

                    .admin-users-page-jump {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </div>
    );
}
