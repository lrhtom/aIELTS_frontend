import { useEffect, useState, useCallback } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/toast.css';

export type ToastType = 'error' | 'success' | 'info';

interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
    code?: string | number;
}

let toastId = 0;
let addToastFn: ((message: string, type: ToastType, code?: string | number) => void) | null = null;

/**
 * 全局调用方法，替代 alert()
 */
// eslint-disable-next-line react-refresh/only-export-components
export function showToast(message: string, type: ToastType = 'error', code?: string | number) {
    if (addToastFn) {
        addToastFn(message, type, code);
    } else {
        console.warn('[Toast fallback]', message);
    }
}

/**
 * Toast 容器组件 —— 放在 App 根组件中即可
 */
export default function ToastContainer() {
    const { t } = useLang();
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const addToast = useCallback((message: string, type: ToastType, code?: string | number) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type, code }]);

        // 3 秒后自动消失
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    // 注册全局函数
    useEffect(() => {
        addToastFn = addToast;
        return () => { addToastFn = null; };
    }, [addToast]);

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="toast-container">
            {toasts.map(tItem => (
                <div
                    key={tItem.id}
                    className={`toast-card toast-${tItem.type}`}
                    onClick={() => removeToast(tItem.id)}
                >
                    <span className="toast-icon">
                        {tItem.type === 'error' ? '✕' : tItem.type === 'info' ? 'ℹ' : '✓'}
                    </span>
                    <span className="toast-message">
                        {tItem.type === 'error'
                            ? <><span className="toast-code">{tItem.code ?? t('common.error')}</span>：{tItem.message}</>
                            : tItem.message
                        }
                    </span>
                </div>
            ))}
        </div>
    );
}
