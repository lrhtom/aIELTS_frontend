export function clearTask2Session(taskType: string): void {
    const prefix = `writing_task2_session_${taskType}`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
}

export function restoreWritingSession<T>(cacheKey: string): T | null {
    const cached = sessionStorage.getItem(cacheKey);
    if (!cached) return null;
    try {
        const parsed = JSON.parse(cached) as T & { step: string };
        if (parsed.step === 'loading') return null;
        return parsed;
    } catch {
        sessionStorage.removeItem(cacheKey);
        return null;
    }
}

export function persistWritingSession(cacheKey: string, state: Record<string, unknown>): void {
    if (state.step === 'loading') return;
    sessionStorage.setItem(cacheKey, JSON.stringify(state));
}
