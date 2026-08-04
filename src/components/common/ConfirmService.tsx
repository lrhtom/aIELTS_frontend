import { useState, useEffect, useCallback, useRef } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/confirm.css';

export interface ConfirmOptions {
    /** The main message (required, and should come from i18n) */
    message: string;
    /** Optional title; without it no title bar is rendered */
    title?: string;
    /** Confirm button text, defaulting to t('common.confirm') */
    confirmText?: string;
    /** Cancel button text, defaulting to t('common.cancel') */
    cancelText?: string;
    /** A destructive action (delete, close account, and so on): the confirm button turns red */
    danger?: boolean;
}

type Resolver = (ok: boolean) => void;

let openFn: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Global imperative confirm dialog replacing window.confirm(). Returns Promise<boolean>.
 *
 *   if (!(await showConfirm(t('xxx.deleteConfirm')))) return;
 *   if (await showConfirm({ message: t('xxx.deleteConfirm'), danger: true })) { ... }
 *
 * Uses self-contained class names (at-confirm-*) plus its own confirm.css, so it depends on no page-level styling.
 * Falls back to the native confirm when the container is not mounted, so the behaviour is never lost.
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

/** Confirm dialog container - place it in the App root (alongside ToastContainer) */
export default function ConfirmServiceContainer() {
    const { t } = useLang();
    const [active, setActive] = useState<ActiveConfirm | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);
    const prevFocusRef = useRef<HTMLElement | null>(null);

    const open = useCallback((opts: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => {
            setActive(prev => {
                // When a dialog is already pending, treat the old one as cancelled so its Promise does not hang
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

    // On open: remember the focus, lock scrolling, focus the confirm button
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

    // Keyboard: Esc cancels, Enter confirms, Tab is trapped
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
                        {active.cancelText ?? t('common.cancel')}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`at-confirm-btn ${active.danger ? 'at-confirm-btn--danger' : 'at-confirm-btn--primary'}`}
                        onClick={() => finish(true)}
                    >
                        {active.confirmText ?? t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}
