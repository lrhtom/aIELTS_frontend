import { useEffect, useRef, useCallback } from 'react';
import { useLang } from '../../i18n/LanguageContext';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'default';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function ConfirmDialog({
    open,
    title,
    message,
    confirmLabel,
    cancelLabel,
    variant = 'default',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    const { t } = useLang();
    const overlayRef = useRef<HTMLDivElement>(null);
    const confirmBtnRef = useRef<HTMLButtonElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            onCancel();
            return;
        }
        if (e.key === 'Tab' && overlayRef.current) {
            const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        }
    }, [onCancel]);

    useEffect(() => {
        if (open) {
            previousFocusRef.current = document.activeElement as HTMLElement;
            setTimeout(() => confirmBtnRef.current?.focus(), 50);
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [open, handleKeyDown]);

    const handleClose = () => {
        onCancel();
        setTimeout(() => previousFocusRef.current?.focus(), 50);
    };

    if (!open) return null;

    return (
        <div
            className="modal-overlay"
            ref={overlayRef}
            onClick={(e) => { if (e.target === overlayRef.current) handleClose(); }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            <div className="modal-box confirm-dialog" onClick={(e) => e.stopPropagation()}>
                <h3 id="confirm-dialog-title">{title}</h3>
                <p className="confirm-dialog-message">{message}</p>
                <div className="confirm-dialog-actions">
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={handleClose}
                    >
                        {cancelLabel ?? t('common.cancel')}
                    </button>
                    <button
                        ref={confirmBtnRef}
                        type="button"
                        className={`primary-button ${variant === 'danger' ? 'confirm-dialog-danger' : ''}`}
                        onClick={() => { onConfirm(); }}
                    >
                        {confirmLabel ?? t('common.confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
}
