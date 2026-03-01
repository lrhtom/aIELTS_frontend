/**
 * useReactive — Vue 风格的 React 响应式工具
 *
 * 核心 API:
 *   ref(initialValue)      → 类似 Vue ref，用 .value 读写
 *   reactive(initialObj)   → 类似 Vue reactive，直接读写属性
 *   useRefVal / useReactive → 在组件内订阅，自动触发重渲染
 */

import { useState, useEffect, useCallback } from 'react';

// ─── 发布-订阅核心 ────────────────────────────────────────────────────────────

type Listener = () => void;

interface Store {
    subscribe: (listener: Listener) => () => void;
    notify: () => void;
}

function createStore<T extends object>(data: T): { proxy: T; store: Store } {
    const listeners = new Set<Listener>();

    const store: Store = {
        notify: () => listeners.forEach(fn => fn()),
        subscribe: (listener: Listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };

    const proxy = new Proxy(data, {
        set(target, key, value) {
            if ((target as Record<string | symbol, unknown>)[key] === value) return true;
            (target as Record<string | symbol, unknown>)[key] = value;
            store.notify();
            return true;
        },
    });

    return { proxy, store };
}

// ─── ref ─────────────────────────────────────────────────────────────────────

export interface Ref<T> {
    value: T;
}

const storeMap = new WeakMap<object, Store>();

/**
 * 在【组件外部】创建 ref（类似 Vue ref）
 * @example
 * const count = ref(0);
 * count.value++;
 */
export function ref<T>(initialValue: T): Ref<T> {
    const { proxy, store } = createStore({ value: initialValue });
    storeMap.set(proxy, store);
    return proxy as unknown as Ref<T>;
}

// ─── reactive ────────────────────────────────────────────────────────────────

/**
 * 在【组件外部】创建响应式对象（类似 Vue reactive）
 * @example
 * const user = reactive({ name: 'Alice', age: 18 });
 * user.name = 'Bob';
 */
export function reactive<T extends object>(initialObj: T): T {
    const { proxy, store } = createStore(initialObj);
    storeMap.set(proxy, store);
    return proxy;
}

// ─── 组件内订阅 hooks ─────────────────────────────────────────────────────────

/**
 * 通用订阅 hook — 用 useState 强制 re-render
 */
function useStore(obj: object) {
    const store = storeMap.get(obj);
    if (!store) throw new Error('useStore: object is not created by ref() or reactive()');

    const [, forceUpdate] = useState(0);
    const rerender = useCallback(() => forceUpdate(v => v + 1), []);

    useEffect(() => {
        return store.subscribe(rerender);
    }, [store, rerender]);
}

/**
 * 订阅 ref，组件内使用
 * @example
 * const c = useRefVal(count);
 * return <span>{c.value}</span>;
 */
export function useRefVal<T>(refObj: Ref<T>): Ref<T> {
    useStore(refObj as unknown as object);
    return refObj;
}

/**
 * 订阅 reactive 对象，组件内使用
 * @example
 * const u = useReactive(user);
 * return <span>{u.name}</span>;
 */
export function useReactive<T extends object>(reactiveObj: T): T {
    useStore(reactiveObj);
    return reactiveObj;
}
