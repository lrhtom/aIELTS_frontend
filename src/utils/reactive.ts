/**
 * useReactive - Vue-style reactivity helpers for React
 *
 * Core API:
 *   ref(initialValue)      -> like Vue's ref, read and write through .value
 *   reactive(initialObj)   -> like Vue's reactive, read and write properties directly
 *   useRefVal / useReactive -> subscribe inside a component and re-render automatically
 */

import { useState, useEffect, useCallback } from 'react';

// --- Publish/subscribe core -------------------------------------------------

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
 * Create a ref **outside** a component (like Vue's ref)
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
 * Create a reactive object **outside** a component (like Vue's reactive)
 * @example
 * const user = reactive({ name: 'Alice', age: 18 });
 * user.name = 'Bob';
 */
export function reactive<T extends object>(initialObj: T): T {
    const { proxy, store } = createStore(initialObj);
    storeMap.set(proxy, store);
    return proxy;
}

// --- In-component subscription hooks ----------------------------------------

/**
 * Generic subscription hook - forces a re-render via useState
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
 * Subscribe to a ref from inside a component
 * @example
 * const c = useRefVal(count);
 * return <span>{c.value}</span>;
 */
export function useRefVal<T>(refObj: Ref<T>): Ref<T> {
    useStore(refObj as unknown as object);
    return refObj;
}

/**
 * Subscribe to a reactive object from inside a component
 * @example
 * const u = useReactive(user);
 * return <span>{u.name}</span>;
 */
export function useReactive<T extends object>(reactiveObj: T): T {
    useStore(reactiveObj);
    return reactiveObj;
}
