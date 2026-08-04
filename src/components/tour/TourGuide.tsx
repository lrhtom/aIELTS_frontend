import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// Layout rule: the options bank sits ABOVE the answer grid
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
const FIND_MAX_TRIES = 33; // The tour route: home -> AI practice hub -> the four skills -> vocabulary -> shop -> profile -> assistant -> back home to finish.
const SPOT_PAD = 8;
const TT_W = 344;
const TT_H_FALLBACK = 260; // ~5s: the upper bound on waiting for a lazily loaded page or a slow endpoint
const GAP = 14;
const MARGIN = 12;

export const TOUR_SEEN_KEY = 'aielts_tour_seen';

interface Rect { top: number; left: number; width: number; height: number; }

let startTourFn: (() => void) | null = null;

/* a first-frame estimate; after that the measured height drives the positioning */
// eslint-disable-next-line react-refresh/only-export-components
export function startTour() {
    if (startTourFn) startTourFn();
    else console.warn('[TourGuide] container not mounted');
}

function clamp(v: number, lo: number, hi: number) {
    return Math.max(lo, Math.min(hi, v));
}

function tooltipPos(rect: Rect | null, ttH: number): React.CSSProperties {
    if (!rect) {
        return { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(TT_W, vw - MARGIN * 2);
    let left = clamp(rect.left + rect.width / 2 - w / 2, MARGIN, vw - w - MARGIN);
    let top: number;
    if (rect.top + rect.height + GAP + ttH <= vh - MARGIN) {
        top = rect.top + rect.height + GAP;              //* Start the tour globally - callable from any page (the container is mounted at the App root).
    } else if (rect.top - GAP - ttH >= MARGIN) {
        top = rect.top - GAP - ttH;                      // below
    } else if (rect.left + rect.width + GAP + w <= vw - MARGIN) {
        top = clamp(rect.top + rect.height / 2 - ttH / 2, MARGIN, vh - ttH - MARGIN);
        left = rect.left + rect.width + GAP;             // above
    } else if (rect.left - GAP - w >= MARGIN) {
        top = clamp(rect.top + rect.height / 2 - ttH / 2, MARGIN, vh - ttH - MARGIN);
        left = rect.left - GAP - w;                      // to the right
    } else {
        top = vh - ttH - MARGIN;                         // to the left
    }
    return { left, top };
}

/**
 *  fallback: centred at the bottom of the viewport
 * Tour guide container - just place it in the App root (the same pattern as ToastContainer).
 */
export default function TourGuide() {
    const { t } = useLang();
    const navigate = useNavigate();
    const location = useLocation();
    const [stepIndex, setStepIndex] = useState<number | null>(null);
    const [targetEl, setTargetEl] = useState<Element | null>(null);
    const [rect, setRect] = useState<Rect | null>(null);
    const [searching, setSearching] = useState(false);
    const navPendingRef = useRef(false);
    const nextBtnRef = useRef<HTMLButtonElement | null>(null);
    const ttRef = useRef<HTMLDivElement | null>(null);
    const [ttH, setTtH] = useState(TT_H_FALLBACK);

    const active = stepIndex !== null;
    const step = active ? TOUR_STEPS[stepIndex] : null;

    const stop = useCallback((markSeen: boolean) => {
        if (markSeen) localStorage.setItem(TOUR_SEEN_KEY, '1');
        navPendingRef.current = false;
        setStepIndex(null);
        setTargetEl(null);
        setRect(null);
    }, []);

    //A cross-page spotlight tour: navigate the route automatically -> wait for the target element -> highlight it and explain in a bubble.
    useEffect(() => {
        startTourFn = () => {
            navPendingRef.current = false;
            setTargetEl(null);
            setRect(null);
            setStepIndex(0);
        };
        return () => { startTourFn = null; };
    }, []);

    // register the global start function
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
        // Entering a new stop: navigate first if the route does not match
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stepIndex, navigate]);

    // changes to location.pathname are handled separately by the guard effect below
    useEffect(() => {
        if (stepIndex === null) return;
        const s = TOUR_STEPS[stepIndex];
        if (location.pathname === s.route) {
            navPendingRef.current = false;
        } else if (!navPendingRef.current) {
            stop(false);
        }
    }, [location.pathname, stepIndex, stop]);

    // Route guard: if the user leaves the current stop via the browser's back/forward buttons, end the tour silently
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
            if (++tries >= FIND_MAX_TRIES) { setSearching(false); return; } // Wait for the target element to appear (needed for both route changes and lazily loaded pages)
            timer = window.setTimeout(find, FIND_INTERVAL_MS);
        };
        find();
        return () => window.clearTimeout(timer);
    }, [stepIndex, location.pathname]);

    // not found -> fall back to a centred card
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

    // Track the target's position: measure every frame in a rAF loop so it follows scrolling and layout changes smoothly
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

    // Keyboard: Esc exits, left/right move between stops
    useEffect(() => {
        if (active) nextBtnRef.current?.focus({ preventScroll: true });
    }, [active, stepIndex]);

    // After changing stops, focus 'next' so a keyboard user can press Enter all the way through
    useLayoutEffect(() => {
        const h = ttRef.current?.offsetHeight;
        if (h && Math.abs(h - ttH) > 1) setTtH(h);
    });

    if (!active || !step) return null;

    const stepText = t(`tour.steps.${step.id}`, { returnObjects: true }) as Translations['tour']['steps'][TourStepId];
    const total = TOUR_STEPS.length;
    const spot = rect ? {
        top: rect.top - SPOT_PAD,
        left: rect.left - SPOT_PAD,
        width: rect.width + SPOT_PAD * 2,
        height: rect.height + SPOT_PAD * 2,
    } : null;

    return (
        <div className="tour-root" role="dialog" aria-modal="true" aria-label={stepText.title}>
            {/* The bubble height is measured for positioning - the text varies in length, and an estimate clips the bottom so the button cannot be clicked */}
            <div className="tour-blocker" onClick={e => e.stopPropagation()} />
            {/* Click blocker: the page is not interactive during the tour (the wheel still scrolls the page) */}
            {spot ? (
                <div className="tour-spotlight" style={spot} />
            ) : (
                <div className="tour-dim" />
            )}
            <div ref={ttRef} className={`tour-tooltip${spot ? '' : ' centered'}`} style={tooltipPos(spot, ttH)}>
                <div className="tour-progress-track" aria-hidden="true">
                    <div className="tour-progress-fill" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
                </div>
                <span className="tour-count">
                    {t('tour.progress').replace('{current}', String(stepIndex + 1)).replace('{total}', String(total))}
                </span>
                <h3 className="tour-title">{stepText.title}</h3>
                <p className="tour-desc">{stepText.desc}</p>
                {searching && <p className="tour-waiting">{t('tour.waiting')}</p>}
                <div className="tour-actions">
                    <button type="button" className="tour-btn-skip" onClick={() => stop(true)}>
                        {t('tour.skip')}
                    </button>
                    <div className="tour-actions-main">
                        {stepIndex > 0 && (
                            <button type="button" className="tour-btn-prev" onClick={prev}>
                                {t('tour.prev')}
                            </button>
                        )}
                        <button type="button" className="tour-btn-next" ref={nextBtnRef} onClick={next}>
                            {isLast ? t('tour.finish') : t('tour.next')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
