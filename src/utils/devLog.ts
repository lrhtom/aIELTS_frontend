// Debug logging that only prints in development. Silent in a production build (import.meta.env.DEV === false),
// so internal business tracing (vocabulary study, plan cache, and so on) never leaks into the user's console.
// Used exactly like console.log: devLog('[plan cache] ...', { planId })

export function devLog(...args: unknown[]): void {
    if (import.meta.env.DEV) {
        console.log(...args);
    }
}

export function devWarn(...args: unknown[]): void {
    if (import.meta.env.DEV) {
        console.warn(...args);
    }
}
