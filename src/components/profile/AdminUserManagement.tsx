import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '../../api/client';
import { useLang } from '../../i18n/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
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
    lastIp: string | null;
    isIpBanned: boolean;
};

type BannedIP = {
    id: number;
    ip_address: string;
    reason: string;
    banned_at: string | null;
    banned_by: string | null;
};

type PaginatedResponse = {
    count: number;
    next: string | null;
    previous: string | null;
    results: UserRow[];
};

export default function AdminUserManagement() {
    const { translations: t } = useLang();
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<UserRow[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [jumpPageInput, setJumpPageInput] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [roleFilter, setRoleFilter] = useState<'all' | 'normal' | 'admin' | 'banned'>('all');
    const [bannedIPs, setBannedIPs] = useState<BannedIP[]>([]);
    const [showBannedIPs, setShowBannedIPs] = useState(false);

    const refreshBannedIPs = useCallback(async () => {
        try {
            const resp = await apiClient.get<{ items: BannedIP[] }>('/admin/banned-ips');
            setBannedIPs(resp.data.items || []);
        } catch (err) {
            console.error('Failed to load banned IPs:', err);
        }
    }, []);

    useEffect(() => { refreshBannedIPs(); }, [refreshBannedIPs]);

    const fetchUsers = useCallback(async (page: number) => {
        setIsLoading(true);
        try {
            const response = await apiClient.get<PaginatedResponse>(`/admin/users?page=${page}&page_size=20`);
            setUsers(response.data.results);
            setTotalCount(response.data.count);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error(t.profile.admin.users.toastLoadFail);
        } finally {
            setIsLoading(false);
        }
    }, [t.profile.admin.users.toastLoadFail]);

    useEffect(() => {
        fetchUsers(currentPage);
    }, [currentPage, fetchUsers]);

    const handleToggleBan = async (user: UserRow) => {
        if (user.is_staff || user.is_superuser) {
            toast.error(t.profile.admin.users.toastAdminNoBan);
            return;
        }

        try {
            await apiClient.patch(`/admin/users/${user.id}/ban`, { is_banned: !user.is_banned });
            setUsers((prev) => prev.map((item) =>
                item.id === user.id ? { ...item, is_banned: !item.is_banned } : item
            ));
            toast.success(user.is_banned ? t.profile.admin.users.toastUnbanSuccess : t.profile.admin.users.toastBanSuccess);
        } catch (error: unknown) {
            console.error('Failed to toggle ban:', error);
            toast.error(t.profile.admin.users.toastOpFail);
        }
    };

    const handleDelete = async (user: UserRow) => {
        if (user.is_staff || user.is_superuser) {
            toast.error(t.profile.admin.users.toastAdminNoDelete);
            return;
        }

        if (!window.confirm(t.profile.admin.users.toastDeleteConfirm.replace('{name}', user.username))) return;

        try {
            await apiClient.delete(`/admin/users/${user.id}/delete`);
            toast.success(t.profile.admin.users.toastDeleteSuccess);
            if (users.length === 1 && currentPage > 1) {
                setCurrentPage((p) => p - 1);
            } else {
                fetchUsers(currentPage);
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
            toast.error(t.profile.admin.users.toastDeleteFail);
        }
    };

    const handleTogglePromote = async (user: UserRow) => {
        if (user.is_superuser) {
            toast.error(t.profile.admin.users.toastSuperuserNoModify);
            return;
        }
        if (currentUser && String(currentUser.id) === String(user.id)) {
            toast.error(t.profile.admin.users.toastSelfNoModify);
            return;
        }

        const willPromote = !user.is_staff;
        const confirmMsg = (willPromote
            ? t.profile.admin.users.toastPromoteConfirm
            : t.profile.admin.users.toastDemoteConfirm
        ).replace('{name}', user.username);
        if (!window.confirm(confirmMsg)) return;

        try {
            const resp = await apiClient.patch<UserRow>(`/admin/users/${user.id}/promote`);
            setUsers((prev) => prev.map((item) =>
                item.id === user.id ? { ...item, is_staff: resp.data.is_staff } : item
            ));
            toast.success(willPromote
                ? t.profile.admin.users.toastPromoteSuccess
                : t.profile.admin.users.toastDemoteSuccess);
        } catch (error: unknown) {
            console.error('Failed to toggle admin:', error);
            const e = error as { response?: { data?: { error?: string } } };
            const errCode = e.response?.data?.error;
            if (errCode === 'CANNOT_MODIFY_SUPERUSER') {
                toast.error(t.profile.admin.users.toastSuperuserNoModify);
            } else if (errCode === 'CANNOT_MODIFY_SELF') {
                toast.error(t.profile.admin.users.toastSelfNoModify);
            } else {
                toast.error(t.profile.admin.users.toastPromoteFail);
            }
        }
    };

    const handleBanIP = async (user: UserRow) => {
        if (!user.lastIp) {
            toast.error('该用户尚无 IP 记录（可能未登录过）。');
            return;
        }
        if (user.isIpBanned) {
            toast('该 IP 已在封禁列表中。', { icon: 'ℹ️' });
            setShowBannedIPs(true);
            return;
        }
        const reason = window.prompt(`封禁 IP ${user.lastIp}?\n\n可选：填写封禁原因（会展示在管理列表中）`, `关联用户 ${user.username}`);
        if (reason === null) return;
        try {
            await apiClient.post(`/admin/users/${user.id}/ban-ip`, { reason });
            toast.success(`已封禁 IP ${user.lastIp}`);
            setUsers(prev => prev.map(item => item.id === user.id ? { ...item, isIpBanned: true } : item));
            refreshBannedIPs();
        } catch (error) {
            console.error('Ban IP failed:', error);
            toast.error('封禁 IP 失败。');
        }
    };

    const handleUnbanIP = async (row: BannedIP) => {
        if (!window.confirm(`解除 IP ${row.ip_address} 的封禁?`)) return;
        try {
            await apiClient.delete(`/admin/banned-ips/${row.id}`);
            toast.success('已解封该 IP。');
            setBannedIPs(prev => prev.filter(x => x.id !== row.id));
            setUsers(prev => prev.map(u => u.lastIp === row.ip_address ? { ...u, isIpBanned: false } : u));
        } catch (error) {
            console.error('Unban IP failed:', error);
            toast.error('解封失败。');
        }
    };

    const handleAddBannedIP = async () => {
        const ip = window.prompt('输入要封禁的 IP 地址：', '');
        if (!ip) return;
        const trimmed = ip.trim();
        if (!trimmed) return;
        const reason = window.prompt('封禁原因（可选）：', '') || '';
        try {
            await apiClient.post('/admin/banned-ips', { ip_address: trimmed, reason });
            toast.success(`已封禁 IP ${trimmed}`);
            refreshBannedIPs();
            setUsers(prev => prev.map(u => u.lastIp === trimmed ? { ...u, isIpBanned: true } : u));
        } catch (error: unknown) {
            console.error('Add banned IP failed:', error);
            const err = error as { response?: { data?: { error?: string } } };
            const code = err.response?.data?.error;
            if (code === 'INVALID_IP') toast.error('IP 地址格式不合法。');
            else toast.error('封禁 IP 失败。');
        }
    };

    const handleAdjustAT = async (user: UserRow) => {
        const input = window.prompt(
            t.profile.admin.users.adjustAtPrompt
                .replace('{name}', user.username)
                .replace('{balance}', user.atBalance.toLocaleString()),
            ''
        );
        if (input === null) return;

        const amount = parseInt(input.trim(), 10);
        if (isNaN(amount) || amount === 0) {
            toast.error(t.profile.admin.users.toastInvalidAmount);
            return;
        }

        try {
            const resp = await apiClient.patch<{ at_balance: number; delta: number }>(
                `/admin/users/${user.id}/adjust-at`,
                { amount }
            );
            setUsers((prev) => prev.map((item) =>
                item.id === user.id ? { ...item, atBalance: resp.data.at_balance } : item
            ));
            const deltaStr = (resp.data.delta > 0 ? '+' : '') + resp.data.delta.toLocaleString();
            toast.success(t.profile.admin.users.toastAdjustSuccess
                .replace('{delta}', deltaStr)
                .replace('{balance}', resp.data.at_balance.toLocaleString()));
        } catch (error: unknown) {
            console.error('Failed to adjust AT:', error);
            const e = error as { response?: { data?: { error?: string } } };
            toast.error(e.response?.data?.error || t.profile.admin.users.toastAdjustFail);
        }
    };

    const totalPages = Math.max(1, Math.ceil(totalCount / 20));
    const pageAdminCount = users.filter((user) => user.is_staff || user.is_superuser).length;
    const pageBannedCount = users.filter((user) => user.is_banned).length;

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
        if (!dateStr) return t.profile.admin.users.neverLogin;
        return new Date(dateStr).toLocaleString();
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        const end = Math.min(totalPages, start + maxVisible - 1);

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
                    <span>{t.profile.admin.pagination.jumpTo}</span>
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
                        placeholder={t.profile.admin.pagination.pagePlaceholder}
                        aria-label={t.profile.admin.pagination.jumpTo}
                    />
                    <button
                        className="admin-users-page-btn admin-users-page-jump-btn"
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
        <div className="admin-users">
            <div className="admin-users-header">
                <div className="admin-users-title-block">
                    <h2>{t.profile.admin.users.title}</h2>
                    <p>{t.profile.admin.users.subtitle}</p>
                </div>
                <div className="admin-users-stats">
                    <span className="admin-users-stat-pill">{t.profile.admin.users.totalUsers.replace('{n}', String(totalCount))}</span>
                    <span className="admin-users-stat-pill">{t.profile.admin.users.pageUsers.replace('{n}', String(users.length))}</span>
                    <span className="admin-users-stat-pill">{t.profile.admin.users.filtered.replace('{n}', String(filteredUsers.length))}</span>
                    <span className="admin-users-stat-pill">{t.profile.admin.users.pageAdmins.replace('{n}', String(pageAdminCount))}</span>
                    <span className="admin-users-stat-pill">{t.profile.admin.users.pageBanned.replace('{n}', String(pageBannedCount))}</span>
                    <button type="button" className="admin-users-stat-pill admin-users-stat-btn" onClick={() => setShowBannedIPs(v => !v)}>
                        已封禁 IP {bannedIPs.length} 个 {showBannedIPs ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {showBannedIPs && (
                <div className="admin-banned-ips-panel">
                    <div className="admin-banned-ips-header">
                        <h3>IP 封禁列表</h3>
                        <button type="button" className="admin-users-btn ip-add-btn" onClick={handleAddBannedIP}>
                            + 新增封禁 IP
                        </button>
                    </div>
                    {bannedIPs.length === 0 ? (
                        <div className="admin-banned-ips-empty">目前没有被封禁的 IP。</div>
                    ) : (
                        <div className="admin-banned-ips-list">
                            {bannedIPs.map(row => (
                                <div key={row.id} className="admin-banned-ips-row">
                                    <div className="admin-banned-ips-main">
                                        <span className="admin-banned-ips-ip">{row.ip_address}</span>
                                        {row.reason && <span className="admin-banned-ips-reason">{row.reason}</span>}
                                    </div>
                                    <div className="admin-banned-ips-meta">
                                        {row.banned_by && <span>操作人：{row.banned_by}</span>}
                                        {row.banned_at && <span>{formatDateTime(row.banned_at)}</span>}
                                    </div>
                                    <button type="button" className="admin-users-btn ip-unban-btn" onClick={() => handleUnbanIP(row)}>
                                        解封
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className="admin-users-toolbar">
                <div className="admin-users-search-wrap">
                    <span className="admin-users-search-icon">🔍</span>
                    <input
                        type="text"
                        className="admin-users-search"
                        placeholder={t.profile.admin.users.searchPlaceholder}
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
                        <option value="all">{t.profile.admin.users.filterAll}</option>
                        <option value="normal">{t.profile.admin.users.filterNormal}</option>
                        <option value="admin">{t.profile.admin.users.filterAdmin}</option>
                        <option value="banned">{t.profile.admin.users.filterBanned}</option>
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="admin-users-state">{t.profile.admin.users.loading}</div>
            ) : users.length === 0 ? (
                <div className="admin-users-state">{t.profile.admin.users.empty}</div>
            ) : filteredUsers.length === 0 ? (
                <div className="admin-users-state">{t.profile.admin.users.noMatch}</div>
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
                                            {user.is_banned ? t.profile.admin.users.badgeBanned : t.profile.admin.users.badgeNormal}
                                        </span>
                                        {isAdmin && <span className="admin-users-badge is-admin">{t.profile.admin.users.badgeAdmin}</span>}
                                        {user.is_email_verified && <span className="admin-users-badge is-verified">{t.profile.admin.users.badgeEmailVerified}</span>}
                                    </div>

                                    <div className="admin-users-grid">
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">{t.profile.admin.users.labelEmail}</span>
                                            <span className="admin-users-value">{user.email || t.profile.admin.users.labelNotProvided}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">{t.profile.admin.users.labelAtBalance}</span>
                                            <span className="admin-users-value">{user.atBalance}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">{t.profile.admin.users.labelRegistered}</span>
                                            <span className="admin-users-value">{formatDateTime(user.date_joined)}</span>
                                        </div>
                                        <div className="admin-users-item">
                                            <span className="admin-users-label">{t.profile.admin.users.labelLastLogin}</span>
                                            <span className="admin-users-value">{formatDateTime(user.last_login)}</span>
                                        </div>
                                        <div className="admin-users-item admin-users-item-ip">
                                            <span className="admin-users-label">
                                                最近 IP
                                                {user.isIpBanned && <span className="admin-users-ip-badge">已封禁</span>}
                                            </span>
                                            <span className="admin-users-value">{user.lastIp || '—'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="admin-users-actions">
                                    <button
                                        className="admin-users-btn ban-btn"
                                        onClick={() => handleToggleBan(user)}
                                        disabled={isAdmin}
                                    >
                                        {user.is_banned ? t.profile.admin.users.btnUnban : t.profile.admin.users.btnBan}
                                    </button>
                                    <button
                                        className={`admin-users-btn ${user.isIpBanned ? 'ip-banned-btn' : 'ip-ban-btn'}`}
                                        onClick={() => handleBanIP(user)}
                                        disabled={isAdmin || !user.lastIp}
                                        title={user.lastIp ? (user.isIpBanned ? '该 IP 已封禁 - 点击查看列表' : `封禁此 IP: ${user.lastIp}`) : '该用户尚无 IP 记录'}
                                    >
                                        {user.isIpBanned ? '已封禁 IP' : '封禁此 IP'}
                                    </button>
                                    <button
                                        className={`admin-users-btn ${user.is_staff ? 'demote-btn' : 'promote-btn'}`}
                                        onClick={() => handleTogglePromote(user)}
                                        disabled={user.is_superuser || (!!currentUser && String(currentUser.id) === String(user.id))}
                                    >
                                        {user.is_staff ? t.profile.admin.users.btnDemote : t.profile.admin.users.btnPromote}
                                    </button>
                                    <button
                                        className="admin-users-btn adjust-btn"
                                        onClick={() => handleAdjustAT(user)}
                                    >
                                        {t.profile.admin.users.btnAdjustAt}
                                    </button>
                                    <button
                                        className="admin-users-btn delete-btn"
                                        onClick={() => handleDelete(user)}
                                        disabled={isAdmin}
                                    >
                                        {t.profile.admin.users.btnDelete}
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

                .admin-users-btn.adjust-btn {
                    color: #0d9488;
                    background: rgba(13, 148, 136, 0.08);
                    border-color: rgba(13, 148, 136, 0.22);
                }

                .admin-users-btn.adjust-btn:hover:not(:disabled) {
                    background: rgba(13, 148, 136, 0.16);
                }

                .admin-users-btn.delete-btn {
                    color: #b91c1c;
                    background: rgba(239, 68, 68, 0.1);
                    border-color: rgba(239, 68, 68, 0.26);
                }

                .admin-users-btn.delete-btn:hover:not(:disabled) {
                    background: rgba(239, 68, 68, 0.18);
                }

                .admin-users-btn.promote-btn {
                    color: #1d4ed8;
                    background: rgba(59, 130, 246, 0.1);
                    border-color: rgba(59, 130, 246, 0.28);
                }

                .admin-users-btn.promote-btn:hover:not(:disabled) {
                    background: rgba(59, 130, 246, 0.18);
                }

                .admin-users-btn.demote-btn {
                    color: #7c3aed;
                    background: rgba(139, 92, 246, 0.1);
                    border-color: rgba(139, 92, 246, 0.28);
                }

                .admin-users-btn.demote-btn:hover:not(:disabled) {
                    background: rgba(139, 92, 246, 0.18);
                }

                .admin-users-btn.ip-ban-btn {
                    color: #c2410c;
                    background: rgba(249, 115, 22, 0.1);
                    border-color: rgba(249, 115, 22, 0.28);
                }
                .admin-users-btn.ip-ban-btn:hover:not(:disabled) {
                    background: rgba(249, 115, 22, 0.2);
                }
                .admin-users-btn.ip-banned-btn {
                    color: #7f1d1d;
                    background: rgba(239, 68, 68, 0.14);
                    border-color: rgba(239, 68, 68, 0.32);
                }
                .admin-users-btn.ip-add-btn {
                    width: auto;
                    padding: 8px 14px;
                    color: #0d9488;
                    background: rgba(13, 148, 136, 0.08);
                    border-color: rgba(13, 148, 136, 0.28);
                }
                .admin-users-btn.ip-unban-btn {
                    width: auto;
                    padding: 6px 14px;
                    color: #0f766e;
                    background: rgba(13, 148, 136, 0.1);
                    border-color: rgba(13, 148, 136, 0.28);
                    font-size: 0.8rem;
                }

                .admin-users-stat-btn {
                    cursor: pointer;
                    background: rgba(249, 115, 22, 0.08);
                    color: #c2410c;
                    border-color: rgba(249, 115, 22, 0.28);
                    font-family: inherit;
                }
                .admin-users-stat-btn:hover {
                    background: rgba(249, 115, 22, 0.18);
                }

                .admin-users-ip-badge {
                    display: inline-block;
                    margin-left: 6px;
                    padding: 1px 6px;
                    border-radius: 999px;
                    background: rgba(239, 68, 68, 0.12);
                    color: #b91c1c;
                    font-size: 0.66rem;
                    font-weight: 700;
                }

                .admin-users-item-ip .admin-users-value {
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    font-size: 0.8rem;
                }

                .admin-banned-ips-panel {
                    border: 1px solid rgba(249, 115, 22, 0.25);
                    background: rgba(255, 247, 237, 0.65);
                    border-radius: 14px;
                    padding: 16px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .admin-banned-ips-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .admin-banned-ips-header h3 {
                    margin: 0;
                    color: #9a3412;
                    font-size: 1rem;
                }
                .admin-banned-ips-empty {
                    text-align: center;
                    color: #9a3412;
                    opacity: 0.75;
                    font-size: 0.88rem;
                    padding: 12px 0;
                }
                .admin-banned-ips-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .admin-banned-ips-row {
                    display: grid;
                    grid-template-columns: 1fr auto auto;
                    gap: 12px;
                    align-items: center;
                    padding: 10px 14px;
                    background: rgba(255, 255, 255, 0.85);
                    border: 1px solid rgba(249, 115, 22, 0.2);
                    border-radius: 10px;
                }
                .admin-banned-ips-main {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    min-width: 0;
                }
                .admin-banned-ips-ip {
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    font-weight: 700;
                    color: #0f172a;
                }
                .admin-banned-ips-reason {
                    font-size: 0.82rem;
                    color: #64748b;
                }
                .admin-banned-ips-meta {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    color: #64748b;
                    font-size: 0.78rem;
                    text-align: right;
                }
                @media (max-width: 640px) {
                    .admin-banned-ips-row {
                        grid-template-columns: 1fr;
                    }
                    .admin-banned-ips-meta {
                        text-align: left;
                    }
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
