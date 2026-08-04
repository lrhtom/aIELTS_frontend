import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { showToast } from '../common/Toast';

/**
 * ATBalanceMonitor listens for AT balance events.
 * Place it in App.tsx to watch balance changes globally.
 */
export default function ATBalanceMonitor() {
    const { user, updateUser } = useAuth();
    const { t } = useLang();

    useEffect(() => {
        // listen for AT spend events
        const handleATConsumed = (event: Event) => {
            const customEvent = event as CustomEvent<{ consumed: number; description?: string }>;
            const detail = customEvent.detail;
            if (user && detail.consumed) {
                const updatedUser = {
                    ...user,
                    atBalance: (user.atBalance || 0) - detail.consumed
                };
                updateUser(updatedUser);

                // show the spend notice
                if (detail.consumed > 0) {
                    showToast(t('billing.consumedToast').replace('{n}', detail.consumed.toString()), 'success');
                }
            }
        };

        // listen for AT refund events (an AI operation failed and the cost was returned)
        const handleATRefunded = (event: Event) => {
            const customEvent = event as CustomEvent<{ refunded: number }>;
            const { refunded } = customEvent.detail;
            if (user && refunded > 0) {
                updateUser({ ...user, atBalance: (user.atBalance || 0) + refunded });
                showToast(t('billing.refundToast').replace('{n}', refunded.toString()), 'error');
            }
        };

        // listen for insufficient-balance events
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

            // a top-up page or prompt could be triggered here
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

    // this component renders nothing
    return null;
}
