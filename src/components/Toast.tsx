import { useEffect, useState, useCallback } from 'react';
import '../styles/toast.css';

export type ToastType = 'error' | 'success';

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
 * 用法：
 *   showToast('操作成功！', 'success');                // 绿色卡片
 *   showToast('请求异常', 'error', 400);              // 红色卡片，显示 "400：请求异常"
 *   showToast('网络异常，请重试', 'error');             // 红色卡片，显示 "异常：网络异常，请重试"
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
 * <ToastContainer />
 */
export default function ToastContainer() {
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
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`toast-card toast-${t.type}`}
                    onClick={() => removeToast(t.id)}
                >
                    <span className="toast-icon">
                        {t.type === 'error' ? '✕' : '✓'}
                    </span>
                    <span className="toast-message">
                        {t.type === 'error'
                            ? <><span className="toast-code">{t.code ?? '异常'}</span>：{t.message}</>
                            : t.message
                        }
                    </span>
                </div>
            ))}
        </div>
    );
}
