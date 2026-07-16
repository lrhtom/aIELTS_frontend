import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import type { Translations } from '../../i18n/translations';
import '../../styles/tour.css';

type TourStepId = keyof Translations['tour']['steps'];

interface TourStep {
    id: TourStepId;
    route: string;
    /** Spotlight target; omitted → centered card over a full-page dim. */
    selector?: string;
}

// 环游路线：主页 → AI 练习中心 → 四技能 → 词汇 → 商店 → 个人中心 → 助手 → 回主页收尾。
const TOUR_STEPS: TourStep[] = [
    { id: 'welcome', route: '/', selector: '.hp-headline' },
    { id: 'checkin', route: '/', selector: '.hp-checkin-wrap' },
    { id: 'sidebar', route: '/', selector: '.sidebar-open-btn' },
    { id: 'hub', route: '/practice/ai', selector: '.bento-grid' },
    { id: 'reading', route: '/practice/ai', selector: '.bento-reading' },
    { id: 'listening', route: '/practice/ai', selector: '.bento-listening' },
    { id: 'writing', route: '/writing', selector: '.practice-container' },
    { id: 'speaking', route: '/speaking', selector: '.uc-console' },
    { id: 'vocab', route: '/vocabulary', selector: '.skill-grid' },
    { id: 'store', route: '/store', selector: '.store-balance-badge' },
    { id: 'profile', route: '/profile', selector: '.profile-sidebar' },
    { id: 'assistant', route: '/profile', selector: '.assistant-ball' },
    { id: 'end', route: '/' },
];

const FIND_INTERVAL_MS = 150;
const FIND_MAX_TRIES = 33; // ~5s：页面懒加载/接口慢时的等待上限
const SPOT_PAD = 8;
const TT_W = 344;
const TT_H = 230; // 估算高度，用于摆位与视口夹紧
const GAP = 14;
const MARGIN = 12;

export const TOUR_SEEN_KEY = 'aielts_tour_seen';

interface Rect { top: number; left: number; width: number; height: number; }

let startTourFn: (() => void) | null = null;

/** 全局启动向导模式 —— 任何页面调用即可（容器挂在 App 根部）。 */
// eslint-disable-next-line react-refresh/only-export-components
export function startTour() {
    if (startTourFn) startTourFn();
    else console.warn('[TourGuide] container not mounted');
}

function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
}

function tooltipPos(rect: Rect | null): React.CSSProperties {
    if (!rect) {
        return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(TT_W, vw - MARGIN * 2);
    let left = clamp(rect.left + rect.width / 2 - w / 2, MARGIN, vw - w - MARGIN);
    let top: number;
    if (rect.top + rect.height + GAP + TT_H <= vh - MARGIN) {
        top = rect.top + rect.height + GAP;              // 下方
    } else if (rect.top - GAP - TT_H >= MARGIN) {
        top = rect.top - GAP - TT_H;                     // 上方
    } else if (rect.left + rect.width + GAP + w <= vw - MARGIN) {
        top = clamp(rect.top + rect.height / 2 - TT_H / 2, MARGIN, vh - TT_H - MARGIN);
        left = rect.left + rect.width + GAP;             // 右侧
    } else if (rect.left - GAP - w >= MARGIN) {
        top = clamp(rect.top + rect.height / 2 - TT_H / 2, MARGIN, vh - TT_H - MARGIN);
        left = rect.left - GAP - w;                      // 左侧
    } else {
        top = vh - TT_H - MARGIN;                        // 兜底：视口底部居中
    }
    return { left, top };
}

/**
 * 向导模式容器 —— 放在 App 根组件中即可（模式同 ToastContainer）。
 * 跨页面 spotlight 导览：自动跳转路由 → 等目标元素出现 → 高亮 + 气泡讲解。
 */
export default function TourGuide() {
    const { translations: t } = useLang();
    const navigate = useNavigate();
    const location = useLocation();
    const [stepIndex, setStepIndex] = useState<number | null>(null);
    const [targetEl, setTargetEl] = useState<Element | null>(null);
    const [rect, setRect] = useState<Rect | null>(null);
    const [searching, setSearching] = useState(false);
    const navPendingRef = useRef(false);
    const nextBtnRef = useRef<HTMLButtonElement | null>(null);

    const active = stepIndex !== null;
    const step = active ? TOUR_STEPS[stepIndex] : null;

    const stop = useCallback((markSeen: boolean) => {
        if (markSeen) localStorage.setItem(TOUR_SEEN_KEY, '1');
        navPendingRef.current = false;
        setStepIndex(null);
        setTargetEl(null);
        setRect(null);
    }, []);

    // 注册全局启动函数
    useEffect(() => {
        startTourFn = () => {
            navPendingRef.current = false;
            setTargetEl(null);
            setRect(null);
            setStepIndex(0);
        };
        return () => { startTourFn = null; };
    }, []);

    // 进入新一站：路由不符则先跳转
    useEffect(() => {
        if (stepIndex === null) return;
        const s = TOUR_STEPS[stepIndex];
        setTargetEl(null);
        setRect(null);
        setSearching(!!s.selector);
        if (location.pathname !== s.route) {
            navPendingRef.current = true;
            navigate(s.route);
        }
        // location.pathname 变化由下方守卫 effect 单独处理
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepIndex, navigate]);

    // 路由守卫：用户通过浏览器前进/后退离开当前站 → 静默结束导览
    useEffect(() => {
        if (stepIndex === null) return;
        const s = TOUR_STEPS[stepIndex];
        if (location.pathname === s.route) {
            navPendingRef.current = false;
        } else if (!navPendingRef.current) {
            stop(false);
        }
    }, [location.pathname, stepIndex, stop]);

    // 等目标元素出现（路由切换 + 懒加载页面都要等）
    useEffect(() => {
        if (stepIndex === null) return;
        const s = TOUR_STEPS[stepIndex];
        if (location.pathname !== s.route) return;
        if (!s.selector) { setSearching(false); return; }
        let tries = 0;
        let timer = 0;
        const find = () => {
            const el = document.querySelector(s.selector!);
            if (el) {
                setTargetEl(el);
                setSearching(false);
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
                return;
            }
            if (++tries >= FIND_MAX_TRIES) { setSearching(false); return; } // 找不到 → 居中卡片兜底
            timer = window.setTimeout(find, FIND_INTERVAL_MS);
        };
        find();
        return () => window.clearTimeout(timer);
    }, [stepIndex, location.pathname]);

    // 追踪目标位置：rAF 循环逐帧量测，平滑跟随滚动 / 布局变化
    useEffect(() => {
        if (!targetEl) return;
        let raf = 0;
        const track = () => {
            const r = targetEl.getBoundingClientRect();
            setRect(prev => {
                if (prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5
                    && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5) {
                    return prev;
                }
                return { top: r.top, left: r.left, width: r.width, height: r.height };
            });
            raf = requestAnimationFrame(track);
        };
        raf = requestAnimationFrame(track);
        return () => cancelAnimationFrame(raf);
    }, [targetEl]);

    const isLast = active && stepIndex === TOUR_STEPS.length - 1;

    const next = useCallback(() => {
        if (stepIndex === null) return;
        if (stepIndex >= TOUR_STEPS.length - 1) stop(true);
        else setStepIndex(stepIndex + 1);
    }, [stepIndex, stop]);

    const prev = useCallback(() => {
        if (stepIndex === null) return;
        if (stepIndex > 0) setStepIndex(stepIndex - 1);
    }, [stepIndex]);

    // 键盘：Esc 退出，←/→ 翻站
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') stop(true);
            else if (e.key === 'ArrowRight') next();
            else if (e.key === 'ArrowLeft') prev();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, next, prev, stop]);

    // 换站后把焦点放到「下一步」，键盘用户可以一路 Enter
    useEffect(() => {
        if (active) nextBtnRef.current?.focus({ preventScroll: true });
    }, [active, stepIndex]);

    if (!active || !step) return null;

    const stepText = t.tour.steps[step.id];
    const total = TOUR_STEPS.length;
    const spot = rect ? {
        top: rect.top - SPOT_PAD,
        left: rect.left - SPOT_PAD,
        width: rect.width + SPOT_PAD * 2,
        height: rect.height + SPOT_PAD * 2,
    } : null;

    return (
        <div className="tour-root" role="dialog" aria-modal="true" aria-label={stepText.title}>
            {/* 点击拦截层：导览期间页面不可交互（滚轮仍可滚动页面） */}
            <div className="tour-blocker" onClick={e => e.stopPropagation()} />
            {/* spotlight：透明洞 + 巨型 box-shadow 压暗四周；无目标时整屏压暗 */}
            {spot ? (
                <div className="tour-spotlight" style={spot} />
            ) : (
                <div className="tour-dim" />
            )}
            <div className={`tour-tooltip${spot ? '' : ' centered'}`} style={tooltipPos(spot)}>
                <div className="tour-progress-track" aria-hidden="true">
                    <div className="tour-progress-fill" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
                </div>
                <span className="tour-count">
                    {t.tour.progress.replace('{current}', String(stepIndex + 1)).replace('{total}', String(total))}
                </span>
                <h3 className="tour-title">{stepText.title}</h3>
                <p className="tour-desc">{stepText.desc}</p>
                {searching && <p className="tour-waiting">{t.tour.waiting}</p>}
                <div className="tour-actions">
                    <button type="button" className="tour-btn-skip" onClick={() => stop(true)}>
                        {t.tour.skip}
                    </button>
                    <div className="tour-actions-main">
                        {stepIndex > 0 && (
                            <button type="button" className="tour-btn-prev" onClick={prev}>
                                {t.tour.prev}
                            </button>
                        )}
                        <button type="button" className="tour-btn-next" ref={nextBtnRef} onClick={next}>
                            {isLast ? t.tour.finish : t.tour.next}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
