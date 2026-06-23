import { useCallback, useEffect, useRef, useState } from 'react';
import { getTodayLearningTime, syncTodayLearningTime } from '../api/learning_plan';
import {
    readPendingLearningSeconds,
    writePendingLearningSeconds,
    clearPendingLearningSeconds,
} from '../utils/vocab_flashcard_utils';

export interface LearningTimerHandle {
    todayLearningBaseSeconds: number;
    sessionLearningSeconds: number;
    getLiveSessionLearningSeconds: () => number;
    /**
     * Flush the session timer to the server.
     * - `useKeepalive=true` is for unload-style exits where a network request
     *   is unreliable; we drop the delta into localStorage and let the next
     *   page-load flush it.
     * - `useKeepalive=false` makes the network call and updates base seconds.
     */
    syncLearningTimerOnExit: (useKeepalive: boolean) => Promise<void>;
}

export function formatLearningDuration(totalSeconds: number): string {
    const safe = Math.max(0, totalSeconds);
    const h = Math.floor(safe / 3600).toString().padStart(2, '0');
    const m = Math.floor((safe % 3600) / 60).toString().padStart(2, '0');
    const s = (safe % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

export function useLearningTimer(): LearningTimerHandle {
    const [todayLearningBaseSeconds, setTodayLearningBaseSeconds] = useState(0);
    const [sessionLearningSeconds, setSessionLearningSeconds] = useState(0);

    const learningTimerStartRef = useRef<number>(Date.now());
    const sessionLearningSecondsRef = useRef(0);
    const learningTimerSyncedRef = useRef(false);
    const learningTimerSyncedSecondsRef = useRef(0);

    const getLiveSessionLearningSeconds = useCallback((): number => {
        const wallClockSeconds = Math.max(0, Math.floor((Date.now() - learningTimerStartRef.current) / 1000));
        return Math.max(sessionLearningSecondsRef.current, wallClockSeconds);
    }, []);

    const syncLearningTimerOnExit = useCallback(async (useKeepalive: boolean) => {
        if (learningTimerSyncedRef.current) return;

        const pendingCurrentSessionSeconds = Math.max(
            0,
            getLiveSessionLearningSeconds() - learningTimerSyncedSecondsRef.current,
        );
        if (pendingCurrentSessionSeconds <= 0) {
            learningTimerSyncedRef.current = true;
            return;
        }

        if (useKeepalive) {
            writePendingLearningSeconds(pendingCurrentSessionSeconds);
            learningTimerSyncedRef.current = true;
            learningTimerSyncedSecondsRef.current += pendingCurrentSessionSeconds;
            return;
        }

        const bufferedPendingSeconds = readPendingLearningSeconds();
        const totalToSync = pendingCurrentSessionSeconds + bufferedPendingSeconds;
        const data = await syncTodayLearningTime(totalToSync);
        clearPendingLearningSeconds();
        learningTimerSyncedRef.current = true;
        learningTimerSyncedSecondsRef.current += pendingCurrentSessionSeconds;
        setTodayLearningBaseSeconds(Math.max(0, Number(data.total_seconds) || 0));
    }, [getLiveSessionLearningSeconds]);

    useEffect(() => {
        let cancelled = false;
        learningTimerStartRef.current = Date.now();
        sessionLearningSecondsRef.current = 0;
        learningTimerSyncedRef.current = false;
        learningTimerSyncedSecondsRef.current = 0;
        setSessionLearningSeconds(0);

        const loadTodayTotal = async () => {
            const pendingBufferedSeconds = readPendingLearningSeconds();
            if (pendingBufferedSeconds > 0) {
                try {
                    const flushed = await syncTodayLearningTime(pendingBufferedSeconds);
                    if (!cancelled) {
                        clearPendingLearningSeconds();
                        setTodayLearningBaseSeconds(Math.max(0, Number(flushed.total_seconds) || 0));
                    }
                    return;
                } catch (error) {
                    console.warn('[词汇学习] 补偿同步离页学习时长失败，稍后重试', error);
                }
            }

            try {
                const data = await getTodayLearningTime();
                if (!cancelled) {
                    setTodayLearningBaseSeconds(Math.max(0, Number(data.total_seconds) || 0));
                }
            } catch (error) {
                if (!cancelled) {
                    console.warn('[词汇学习] 获取今日学习时长失败，按 0 秒处理', error);
                    setTodayLearningBaseSeconds(0);
                }
            }
        };
        void loadTodayTotal();

        const tickId = window.setInterval(() => {
            const elapsedSeconds = Math.max(
                0,
                Math.floor((Date.now() - learningTimerStartRef.current) / 1000),
            );
            sessionLearningSecondsRef.current = elapsedSeconds;
            setSessionLearningSeconds(elapsedSeconds);
        }, 1000);

        return () => {
            cancelled = true;
            window.clearInterval(tickId);
        };
    }, []);

    useEffect(() => {
        return () => {
            void syncLearningTimerOnExit(true);
        };
        // syncLearningTimerOnExit intentionally reads refs for latest values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        todayLearningBaseSeconds,
        sessionLearningSeconds,
        getLiveSessionLearningSeconds,
        syncLearningTimerOnExit,
    };
}
