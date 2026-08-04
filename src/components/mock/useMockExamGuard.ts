// Full mock - the exit guard (its own file: MockExamShell.tsx exports only components, satisfying the react-refresh rule)
// Intercepts the browser back button and beforeunload; confirming exit -> forfeit (score 0) -> back to the hub.
// The page's own exit button should call the returned confirmExit.
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { showConfirm } from '../common/ConfirmService';
import { forfeitMockPart, type MockExamPart } from '../../api/mock';
import { useLang } from '../../i18n/LanguageContext';

interface MockGuardOptions {
    mockId: number;
    part: MockExamPart;
    /** Whether the guard is active (turn it off once the part is submitted or finished, so the user can leave freely) */
    active: boolean;
    /** soft: only attaches the beforeunload prompt; the back button and exiting do not score 0 (the writing part
     *  needs T1 and T2 to swap through the hub, so leaving the page is not abandoning the exam, and the 60-minute wall clock backstops it). Defaults to strict. */
    mode?: 'strict' | 'soft';
}

/** The exit guard. Returns confirmExit - the page's own back/exit button should call it. */
export function useMockExamGuard({ mockId, part, active, mode = 'strict' }: MockGuardOptions) {
    const navigate = useNavigate();
    const { t } = useLang();
    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);
    // a forfeit is in flight or already sent: do not ask for confirmation a second time when popstate re-enters
    const leavingRef = useRef(false);

    const doForfeit = useCallback(async () => {
        leavingRef.current = true;
        try {
            await forfeitMockPart(mockId, part);
        } catch {
            // already finished or settled: just ignore it, we are leaving anyway
        }
        navigate(`/mock/${mockId}`, { replace: true });
    }, [mockId, part, navigate]);

    /** Entry point for the page's own exit button: confirm, score 0, and return to the hub. Returns whether we actually left.
     *  soft mode: go straight back to the hub without scoring 0 (free movement within the writing part). */
    const confirmExit = useCallback(async (): Promise<boolean> => {
        if (!activeRef.current || mode === 'soft') {
            navigate(`/mock/${mockId}`);
            return true;
        }
        const ok = await showConfirm({
            title: t('mock.examMode.exitConfirmTitle'),
            message: t('mock.examMode.exitConfirmBody'),
            confirmText: t('mock.examMode.exitConfirmOk'),
            cancelText: t('mock.examMode.exitConfirmCancel'),
            danger: true,
        });
        if (ok) await doForfeit();
        return ok;
    }, [doForfeit, mockId, navigate, t, mode]);

    // Browser back button: push a sentinel history entry and confirm on popstate (soft mode does not intercept)
    useEffect(() => {
        if (!active || mode === 'soft') return;
        window.history.pushState({ mockSentinel: true }, '');
        const onPop = () => {
            if (!activeRef.current || leavingRef.current) return;
            // push it back first to stay put; only really leave once the user confirms
            window.history.pushState({ mockSentinel: true }, '');
            confirmExit();
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [active, mode, confirmExit]);

    // Closing the tab or refreshing: the native prompt (refreshing is allowed - coming back resumes and the deadline does not move)
    useEffect(() => {
        if (!active) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [active]);

    return { confirmExit };
}
