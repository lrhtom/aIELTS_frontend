import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { showToast } from '../common/Toast';

/**
 * ATBalanceMonitor组件监听AT币余额相关事件
 * 应该在App.tsx中放置这个组件，全局监听余额变化
 */
export default function ATBalanceMonitor() {
    const { user, updateUser } = useAuth();

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
                    showToast(`消耗 ${detail.consumed} AT币`, 'success');
                }
            }
        };

        // 监听AT币不足事件
        const handleATBalanceInsufficient = (event: Event) => {
            const customEvent = event as CustomEvent<{ message?: string; currentBalance?: number; requiredBalance?: number }>;
            const detail = customEvent.detail;
            const message = detail.message || 'AT币余额不足';
            const currentBalance = detail.currentBalance || user?.atBalance || 0;
            const requiredBalance = detail.requiredBalance || 0;

            showToast(
                `${message} (需要${requiredBalance} AT，当前${currentBalance} AT)`,
                'error',
                '402'
            );

            // 可以在这里触发充值页面或提示
            if (window.location.pathname !== '/profile') {
                window.dispatchEvent(new CustomEvent('open-recharge-modal'));
            }
        };

        window.addEventListener('at-consumed', handleATConsumed);
        window.addEventListener('at-balance-insufficient', handleATBalanceInsufficient);

        return () => {
            window.removeEventListener('at-consumed', handleATConsumed);
            window.removeEventListener('at-balance-insufficient', handleATBalanceInsufficient);
        };
    }, [user, updateUser]);

    // 这个组件不需要渲染任何内容
    return null;
}
