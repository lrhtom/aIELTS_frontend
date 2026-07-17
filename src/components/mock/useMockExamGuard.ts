// 全套模拟 · 防退出守卫（独立文件：MockExamShell.tsx 只导出组件，满足 react-refresh 规则）
// 浏览器返回键 / beforeunload 拦截；确认退出 → forfeit 判 0 → 回大厅。
// 页面内的退出按钮请调用返回的 confirmExit。
import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { showConfirm } from '../common/ConfirmService';
import { forfeitMockPart, type MockExamPart } from '../../api/mock';
import { useLang } from '../../i18n/LanguageContext';
import { translations } from '../../i18n/translations';

interface MockGuardOptions {
    mockId: number;
    part: MockExamPart;
    /** 守卫是否生效（部分已交卷/已结束后应关掉，让用户自由离开） */
    active: boolean;
    /** soft：只挂 beforeunload 提示，返回键/退出不判 0（写作部分 T1↔T2 需经大厅
     *  切换，离开页面 ≠ 弃考，60 分钟墙钟兜底）。默认 strict。 */
    mode?: 'strict' | 'soft';
}

/** 防退出守卫。返回 confirmExit —— 页面自己的返回/退出按钮应调用它。 */
export function useMockExamGuard({ mockId, part, active, mode = 'strict' }: MockGuardOptions) {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang].mock.examMode;
    const activeRef = useRef(active);
    useEffect(() => { activeRef.current = active; }, [active]);
    // forfeit 进行中/已发出：popstate 重入时不再弹第二次确认
    const leavingRef = useRef(false);

    const doForfeit = useCallback(async () => {
        leavingRef.current = true;
        try {
            await forfeitMockPart(mockId, part);
        } catch {
            // 已结束/已清算等情况直接忽略——反正要离开
        }
        navigate(`/mock/${mockId}`, { replace: true });
    }, [mockId, part, navigate]);

    /** 页面内退出按钮入口：确认后判 0 并回大厅。返回是否真的离开了。
     *  soft 模式：直接回大厅，不判 0（写作部分内自由移动）。 */
    const confirmExit = useCallback(async (): Promise<boolean> => {
        if (!activeRef.current || mode === 'soft') {
            navigate(`/mock/${mockId}`);
            return true;
        }
        const ok = await showConfirm({
            title: t.exitConfirmTitle,
            message: t.exitConfirmBody,
            confirmText: t.exitConfirmOk,
            cancelText: t.exitConfirmCancel,
            danger: true,
        });
        if (ok) await doForfeit();
        return ok;
    }, [doForfeit, mockId, navigate, t, mode]);

    // 浏览器返回键：压一层哨兵历史，popstate 时弹确认（soft 模式不拦）
    useEffect(() => {
        if (!active || mode === 'soft') return;
        window.history.pushState({ mockSentinel: true }, '');
        const onPop = () => {
            if (!activeRef.current || leavingRef.current) return;
            // 先推回，保持停留；用户确认后再真正离开
            window.history.pushState({ mockSentinel: true }, '');
            confirmExit();
        };
        window.addEventListener('popstate', onPop);
        return () => window.removeEventListener('popstate', onPop);
    }, [active, mode, confirmExit]);

    // 关标签页/刷新：原生提示（刷新是允许的——回来还能续答，deadline 不动）
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
