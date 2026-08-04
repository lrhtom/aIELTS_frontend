/**
 * The two rules governing the split-pane divider (shared by reading and listening).
 *
 * 1. **Full drag**: the divider can go anywhere from 0-100% and is no longer clamped between a min and a max.
 *       To collapse one side entirely and focus on the other, just drag it over.
 * 2. **Layout width freezes at 30%**: once a side is narrower than 30% of the container, its content **still lays
 *       out at 30%** and the overflow is clipped, rather than continuing to reflow.
 *
 * Rule 2 is the important one. Without the freeze, a narrow pane squeezes English into a vertical strip one or two
 * letters wide: unreadable, and it gives no sense of how far you have dragged. With it, a narrow pane is simply clipped on the right, the layout does not move, and dragging back restores it instantly.
 *
 * Two details have to be exact or the numbers do not line up (both found by measurement):
 *
 *   a. `min-width` goes on the panel's **children**, and a child is content-box by default, so
 *         `min-width: 300px` yields 300px of **content** width and the border-box width ends up larger once its
 *         own padding is added. The CSS therefore gives every child `box-sizing: border-box`,
 *         which makes 300px the actual space it occupies.
 *   b. The panel itself also has padding (24px on each side of the passage pane). What we actually want to freeze is
 *         'the whole panel lays out at 30%', so the floor must subtract the panel's own padding + border before being
 *         written to the children. Without that subtraction the trigger point moves up to about 45% - measured: with a 1000px container, clipping starts at a panel width of 448px.
 */

/** The layout-width floor, as a fraction of the container width. */
export const PANE_FREEZE_RATIO = 0.3;

/** The variable name the CSS reads (written on the **panel**, not the container - each panel has different padding). */
export const PANE_FREEZE_VAR = '--pane-freeze-min';

/**
 * Below this pixel width the panel's horizontal padding is collapsed too.
 * Without that, padding wedges the panel at about 48px and 'drag the full 100%' is an empty promise.
 * The panel is already overflow:hidden, so removing the padding cannot let content escape.
 */
const COLLAPSE_PADDING_BELOW = 64;

const COLLAPSED_CLASS = 'is-pane-collapsed';

function horizontalFrame(el: HTMLElement): number {
    const cs = getComputedStyle(el);
    return (
        parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0') +
        parseFloat(cs.borderLeftWidth || '0') + parseFloat(cs.borderRightWidth || '0')
    );
}

/**
 * Write each panel's floor as 'container width x 30% - that panel's own padding/border'.
 * The container width does not change during a drag, so this only needs refreshing on mount and on window resize.
 */
export function syncPaneFreezeMin(
    layout: HTMLElement | null | undefined,
    panes: Array<HTMLElement | null | undefined>,
): void {
    if (!layout) return;
    const width = layout.getBoundingClientRect().width;
    if (width <= 0) return;                        // not laid out yet, try again next time
    const target = width * PANE_FREEZE_RATIO;
    for (const pane of panes) {
        if (!pane) continue;
        // a collapsed pane measures 0 padding, which would overstate the floor; skip it and measure once it expands
        if (pane.classList.contains(COLLAPSED_CLASS)) continue;
        const inner = Math.max(0, Math.round(target - horizontalFrame(pane)));
        pane.style.setProperty(PANE_FREEZE_VAR, `${inner}px`);
    }
}

/** Clamp the dragged width into [0, container width]. That is the only clamp: the layout freeze is what prevents 'too narrow to read'. */
export function clampPaneWidth(next: number, layout: HTMLElement | null | undefined): number {
    const max = layout ? layout.getBoundingClientRect().width : Number.POSITIVE_INFINITY;
    return Math.max(0, Math.min(next, max));
}

/** Set the panel width and sync the 'collapse padding when very narrow' state. Call this while dragging rather than writing style.width directly. */
export function applyPaneWidth(
    pane: HTMLElement | null | undefined,
    next: number,
    layout: HTMLElement | null | undefined,
): void {
    if (!pane) return;
    const width = clampPaneWidth(next, layout);
    pane.style.width = `${width}px`;
    pane.classList.toggle(COLLAPSED_CLASS, width < COLLAPSE_PADDING_BELOW);
}

/**
 * Attach a window resize listener so the floor follows the container; returns the unsubscribe function.
 * Without it, narrowing the window leaves the floor at 30% of the old container, which could exceed the whole pane.
 */
export function watchPaneFreezeMin(
    layout: HTMLElement | null | undefined,
    panes: Array<HTMLElement | null | undefined>,
): () => void {
    syncPaneFreezeMin(layout, panes);
    const onResize = () => syncPaneFreezeMin(layout, panes);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
}
