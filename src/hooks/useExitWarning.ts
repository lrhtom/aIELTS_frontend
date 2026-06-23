import { useEffect } from 'react';

interface UseExitWarningArgs {
    /** Wait for upstream initialization before hooking listeners. */
    enabled: boolean;
    /** Show the browser confirm dialog only while there's still work in the queue. */
    hasPendingWork: boolean;
    /** Localized exit-confirmation prompt; returned to satisfy legacy browsers. */
    exitConfirmMessage: string;
    /** Best-effort sync on pagehide (refresh/close); must be safe to fire from unload. */
    onPageHide: () => void;
}

/**
 * Wires up the page-leave guard for the flashcard study page:
 *  - `beforeunload`: prompts when there's an in-flight queue.
 *  - `pagehide`: fires the keepalive sync regardless of queue state.
 */
export function useExitWarning({
    enabled,
    hasPendingWork,
    exitConfirmMessage,
    onPageHide,
}: UseExitWarningArgs): void {
    useEffect(() => {
        if (!enabled) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasPendingWork) {
                e.preventDefault();
                e.returnValue = exitConfirmMessage;
                return exitConfirmMessage;
            }
        };

        const handlePageHide = () => {
            onPageHide();
            if (hasPendingWork) {
                console.log('[词汇学习] 页面隐藏时不再保存本地单词进度，未提交部分将丢失（按安全策略）');
            } else {
                console.log('[词汇学习] 页面隐藏，仅同步学习时长');
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        window.addEventListener('pagehide', handlePageHide as EventListener);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            window.removeEventListener('pagehide', handlePageHide as EventListener);
        };
    }, [enabled, hasPendingWork, exitConfirmMessage, onPageHide]);
}
