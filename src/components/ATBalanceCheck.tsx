import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { calculateCost } from '../config/ai_cost';

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
                        message: `${service}服务需要${cost} AT币`,
                        estimatedCost: cost,
                        currentBalance: user.atBalance
                    }
                }));
            }
        }

        setIsChecking(false);
    }, [service, params, user, setBalanceOk, setIsChecking]);

    useEffect(() => {
        checkBalance();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [service, params, user?.atBalance, checkBalance]); // Added checkBalance to useEffect dependencies

    if (isChecking) {
        return <div>检查AT币余额...</div>;
    }

    if (!balanceOk) {
        return (
            <div className="at-balance-warning">
                <div className="warning-header">
                    <span className="warning-icon">⚠️</span>
                    <span className="warning-title">AT币余额不足</span>
                </div>
                <div className="warning-content">
                    <p>本次{service}练习需要消耗约 <strong>{estimatedCost} AT币</strong>。</p>
                    <p>您的当前余额为 <strong>{user?.atBalance || 0} AT币</strong>。</p>
                    <div className="warning-actions">
                        <button
                            className="primary-button"
                            onClick={() => window.location.href = '/profile'}
                        >
                            前往充值
                        </button>
                        <button
                            className="secondary-button"
                            onClick={onReady}
                        >
                            尝试使用
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 余额充足，显示children
    return children || null;
}