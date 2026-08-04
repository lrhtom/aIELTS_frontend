// Full mock - shared components for exam mode
// MockTimerBar: a sticky countdown bar. On mount it calls startMockPart (idempotent) to get the server's deadline,
// and the remaining time is computed on the server clock (so a refresh or reconnect does not reset it); onExpire fires at zero (the page auto-submits).
// The exit guard lives in ./useMockExamGuard.ts (react-refresh requires a component file to export only components).
import { useEffect, useRef, useState } from 'react';
import { startMockPart, type MockExamPart } from '../../api/mock';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/mock.css';

function fmt(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

interface MockTimerBarProps {
    mockId: number;
    part: MockExamPart;
    /** Called once when the countdown hits zero (the page should immediately auto-submit the current draft) */
    onExpire?: () => void;
    /** start was refused (the part has already finished, is not unlocked, and so on) -> the page should return to the hub */
    onRejected?: (message: string) => void;
}

export function MockTimerBar({ mockId, part, onExpire, onRejected }: MockTimerBarProps) {
    const { t } = useLang();
    const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
    const offsetRef = useRef(0); // serverNow - clientNow
    const expiredFiredRef = useRef(false);
    const [, tick] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const r = await startMockPart(mockId, part);
                if (cancelled) return;
                offsetRef.current = new Date(r.now).getTime() - Date.now();
                if (r.exam.deadline) setDeadlineMs(new Date(r.exam.deadline).getTime());
            } catch (err) {
                if (!cancelled) onRejected?.((err as Error).message ?? '');
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mockId, part]);

    useEffect(() => {
        if (deadlineMs === null) return;
        const timer = setInterval(() => tick(v => v + 1), 500);
        return () => clearInterval(timer);
    }, [deadlineMs]);

    if (deadlineMs === null) {
        return (
            <div className="mock-timer-bar">
                <span className="mock-timer-label">{t('mock.examMode.examBadge')}</span>
            </div>
        );
    }

    const remaining = deadlineMs - (Date.now() + offsetRef.current);
    if (remaining <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        // Do not fire side effects during setState: call back in a microtask
        queueMicrotask(() => onExpire?.());
    }
    const cls = remaining <= 60_000 ? 'is-danger' : remaining <= 5 * 60_000 ? 'is-warning' : '';

    return (
        <div className={`mock-timer-bar ${cls}`}>
            <span className="mock-timer-label">{t('mock.examMode.examBadge')}</span>
            <span>⏱ {fmt(remaining)}</span>
        </div>
    );
}

