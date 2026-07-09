import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/confirm.css';

export interface ConfirmOptions {
    /** 主体提示文案（必填，应来自 i18n） */
    message: string;
    /** 可选标题；不传则不渲染标题栏 */
    title?: string;
    /** 确认按钮文案，默认 t.common.confirm */
    confirmText?: string;
    /** 取消按钮文案，默认 t.common.cancel */
    cancelText?: string;
    /** 危险操作（删除/注销等）：确认按钮变红色 */
    danger?: boolean;
}

type Resolver = (ok: boolean) => void;

let openFn: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * 全局命令式确认弹窗，替代 window.confirm()。返回 Promise<boolean>。
 *
 *   if (!(await showConfirm(t.xxx.deleteConfirm))) return;
 *   if (await showConfirm({ message: t.xxx.deleteConfirm, danger: true })) { ... }
 *
 * 使用独立作用域类名（at-confirm-*）+ 独立 confirm.css，全局自包含，不依赖页面级样式。
 * 容器未挂载时回退到原生 confirm，保证行为不丢失。
 */
// eslint-disable-next-line react-refresh/only-export-components
export function showConfirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts = typeof options === 'string' ? { message: options } : options;
    if (openFn) return openFn(opts);
    return Promise.resolve(window.confirm(opts.message));
}

interface ActiveConfirm extends ConfirmOptions {
    resolve: Resolver;
}

/** 确认弹窗容器 —— 放在 App 根组件中（和 ToastContainer 并列） */
export default function ConfirmServiceContainer() {
    const { translations: t } = useLang();
    const [active, setActive] = useState<ActiveConfirm | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);
    const prevFocusRef = useRef<HTMLElement | null>(null);

    const open = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setActive(prev => {
                // 已有未决弹窗时，旧的按取消处理，避免 Promise 悬挂
                if (prev) prev.resolve(false);
                return { ...opts, resolve };
            });
        });
    }, []);

    useEffect(() => {
        openFn = open;
        return () => { openFn = null; };
    }, [open]);

    const finish = useCallback((ok: boolean) => {
        setActive(prev => {
            prev?.resolve(ok);
            return null;
        });
        setTimeout(() => prevFocusRef.current?.focus(), 0);
    }, []);

    // 打开时：记录焦点、锁定滚动、聚焦确认按钮
    useEffect(() => {
        if (!active) return;
        prevFocusRef.current = document.activeElement as HTMLElement;
        const focusTimer = setTimeout(() => confirmBtnRef.current?.focus(), 30);
        document.body.style.overflow = 'hidden';
        return () => {
            clearTimeout(focusTimer);
            document.body.style.overflow = '';
        };
    }, [active]);

    // 键盘：Esc 取消、Enter 确认、Tab 焦点陷阱
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { e.preventDefault(); finish(false); return; }
            if (e.key === 'Enter') { e.preventDefault(); finish(true); return; }
            if (e.key === 'Tab' && overlayRef.current) {
                const focusable = overlayRef.current.querySelectorAll<HTMLElement>('button');
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault(); last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault(); first.focus();
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, finish]);

    if (!active) return null;

    return (
        <div
            className="at-confirm-overlay"
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) finish(false); }}
            role="alertdialog"
            aria-modal="true"
            aria-label={active.title ?? active.message}
        >
            <div className="at-confirm-card">
                {active.title && <h3 className="at-confirm-title">{active.title}</h3>}
                <p className="at-confirm-message">{active.message}</p>
                <div className="at-confirm-actions">
                    <button
                        type="button"
                        className="at-confirm-btn at-confirm-btn--cancel"
                        onClick={() => finish(false)}
                    >
                        {active.cancelText ?? t.common.cancel}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`at-confirm-btn ${active.danger ? 'at-confirm-btn--danger' : 'at-confirm-btn--primary'}`}
                        onClick={() => finish(true)}
                    >
                        {active.confirmText ?? t.common.confirm}
                    </button>
                </div>
            </div>
        </div>
    );
}
