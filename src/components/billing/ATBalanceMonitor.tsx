import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../common/Toast';

/**
 * ATBalanceMonitor组件监听AT币余额相关事件
 * 应该在App.tsx中放置这个组件，全局监听余额变化
 */
export default function ATBalanceMonitor() {
    const { user, updateUser } = useAuth();
    const { t } = useLang();

    useEffect(() => {
        // 监听AT币消耗事件
        const handleATConsumed = (event: Event) => {
            const customEvent = event as CustomEvent<{ consumed: number; description?: string }>;
            const detail = customEvent.detail;
            if (user && detail.consumed) {
                const updatedUser = {
                    ...user,
                    atBalance: (user.atBalance || 0) - detail.consumed
                };
                updateUser(updatedUser);

                // 显示消耗提示
                if (detail.consumed > 0) {
                    showToast(t('billing.consumedToast').replace('{n}', detail.consumed.toString()), 'success');
                }
            }
        };

        // 监听AT币退款事件（AI操作失败，费用退还）
        const handleATRefunded = (event: Event) => {
            const customEvent = event as CustomEvent<{ refunded: number }>;
            const { refunded } = customEvent.detail;
            if (user && refunded > 0) {
                updateUser({ ...user, atBalance: (user.atBalance || 0) + refunded });
                showToast(t('billing.refundToast').replace('{n}', refunded.toString()), 'error');
            }
        };

        // 监听AT币不足事件
        const handleATBalanceInsufficient = (event: Event) => {
            const customEvent = event as CustomEvent<{ message?: string; currentBalance?: number; requiredBalance?: number }>;
            const detail = customEvent.detail;
            const message = detail.message || t('billing.insufficientBalance');
            const currentBalance = detail.currentBalance || user?.atBalance || 0;
            const requiredBalance = detail.requiredBalance || 0;

            const fullMessage = t('billing.needMoreBalance')
                .replace('{message}', message)
                .replace('{required}', requiredBalance.toString())
                .replace('{current}', currentBalance.toString());

            showToast(fullMessage, 'error', '402');

            // 可以在这里触发充值页面或提示
            if (window.location.pathname !== '/profile') {
                window.dispatchEvent(new CustomEvent('open-recharge-modal'));
            }
        };

        window.addEventListener('at-refunded', handleATRefunded);
        window.addEventListener('at-consumed', handleATConsumed);
        window.addEventListener('at-balance-insufficient', handleATBalanceInsufficient);

        return () => {
            window.removeEventListener('at-refunded', handleATRefunded);
            window.removeEventListener('at-consumed', handleATConsumed);
            window.removeEventListener('at-balance-insufficient', handleATBalanceInsufficient);
        };
    }, [user, updateUser, t]);

    // 这个组件不需要渲染任何内容
    return null;
}
