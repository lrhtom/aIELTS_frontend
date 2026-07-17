// 全套模拟 · 考试模式共享组件
// MockTimerBar：sticky 倒计时条。挂载时调 startMockPart（幂等）取服务端 deadline，
// 剩余时间按服务端时钟计算（刷新/断线不重置）；归零回调 onExpire（由页面自动交卷）。
// 防退出守卫见 ./useMockExamGuard.ts（react-refresh 要求组件文件只导出组件）。
import { useEffect, useRef, useState } from 'react';
import { startMockPart, type MockExamPart } from '../../api/mock';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';
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
    /** 倒计时归零时回调一次（页面应立即自动交卷当前草稿） */
    onExpire?: () => void;
    /** start 被拒（该部分已结束/未解锁等）→ 页面应退回大厅 */
    onRejected?: (message: string) => void;
}

export function MockTimerBar({ mockId, part, onExpire, onRejected }: MockTimerBarProps) {
    const { lang } = useLang();
    const t = translations[lang].mock.examMode;
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
                <span className="mock-timer-label">{t.examBadge}</span>
            </div>
        );
    }

    const remaining = deadlineMs - (Date.now() + offsetRef.current);
    if (remaining <= 0 && !expiredFiredRef.current) {
        expiredFiredRef.current = true;
        // setState 期间不触发副作用：微任务里回调
        queueMicrotask(() => onExpire?.());
    }
    const cls = remaining <= 60_000 ? 'is-danger' : remaining <= 5 * 60_000 ? 'is-warning' : '';

    return (
        <div className={`mock-timer-bar ${cls}`}>
            <span className="mock-timer-label">{t.examBadge}</span>
            <span>⏱ {fmt(remaining)}</span>
        </div>
    );
}

