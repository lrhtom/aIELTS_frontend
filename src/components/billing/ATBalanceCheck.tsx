import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { calculateCost } from '../../config/ai_cost';
import { formatATBalance } from '../../utils/format';
import { sanitize } from '../../utils/safe_html';
import '../../styles/atBalanceCheck.css';

interface ATBalanceCheckProps {
    service: string;
    params?: Record<string, number>;
    onReady?: () => void;
    children?: React.ReactNode;
}

export default function ATBalanceCheck({
    service,
    params,
    onReady,
    children
}: ATBalanceCheckProps) {
    const { user } = useAuth();
    const { t } = useLang();
    
    // Use memoization instead of effect for cost
    const estimatedCost = useMemo(() => {
        try {
            return calculateCost(service, params);
        } catch {
            return 0;
        }
    }, [service, params]);
    const [isChecking, setIsChecking] = useState<boolean>(true);
    const [balanceOk, setBalanceOk] = useState<boolean>(false);

    const checkBalance = useCallback(() => {
        // 计算预估AT币消耗
        let cost = 0;
        try {
            cost = calculateCost(service, params);
        } catch { /* ignore */ }

        if (user) {
            const ok = (user.atBalance || 0) >= cost;
            setBalanceOk(ok);

            if (!ok) {
                // AT币不足，显示警告
                window.dispatchEvent(new CustomEvent('at-balance-insufficient', {
                    detail: {
                        message: t('billing.needMoreBalance')
                            .replace('{message}', t('billing.insufficientBalance'))
                            .replace('{required}', cost.toString())
                            .replace('{current}', (user.atBalance || 0).toString()),
                        estimatedCost: cost,
                        currentBalance: user.atBalance
                    }
                }));
            }
        }

        setIsChecking(false);
    }, [service, params, user, setBalanceOk, setIsChecking, t]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        checkBalance();
    }, [service, params, user?.atBalance, checkBalance]); // Added checkBalance to useEffect dependencies

    if (isChecking) {
        return <div>{t('billing.checkingBalance')}</div>;
    }

    if (!balanceOk) {
        return (
            <div className="at-balance-warning">
                <div className="warning-header">
                    <span className="warning-icon">⚠️</span>
                    <span className="warning-title">{t('billing.insufficientBalance')}</span>
                </div>
                <div className="warning-content">
                    <p dangerouslySetInnerHTML={{
                        __html: sanitize(t('billing.estimateCost')
                            .replace('{service}', service)
                            .replace('{estimatedCost}', estimatedCost.toString())),
                    }} />
                    <p dangerouslySetInnerHTML={{
                        __html: sanitize(t('billing.currentBalance')
                            .replace('{balance}', formatATBalance(user?.atBalance).toString())),
                    }} />
                    <div className="warning-actions">
                        <button
                            className="primary-button"
                            onClick={() => window.location.href = '/profile'}
                        >
                            {t('billing.goToRecharge')}
                        </button>
                        <button
                            className="secondary-button"
                            onClick={onReady}
                        >
                            {t('billing.tryAnyway')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 余额充足，显示children
    return children || null;
}
