// 仅在开发环境输出的调试日志。生产构建（import.meta.env.DEV === false）下静默，
// 避免把内部业务跟踪（[词汇学习] / [计划缓存] 等）泄露到用户控制台。
// 用法与 console.log 完全一致：devLog('[计划缓存] ...', { planId })

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
