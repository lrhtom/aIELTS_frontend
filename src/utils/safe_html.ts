import DOMPurify from 'dompurify';

/**
 * Sanitize a string of HTML for use with React's `dangerouslySetInnerHTML`.
 *
 * Wraps DOMPurify with our standard allowlist: small inline formatting tags only.
 * Use this for AI-generated passages, formatted i18n strings, etc.
 *
 *   <p dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(text)) }} />
 *
 * If you need a richer tag set (e.g. for SVG), call DOMPurify.sanitize directly
 * with the appropriate config.
 */
export function sanitize(dirty: string): string {
    if (!dirty) return '';
    return DOMPurify.sanitize(dirty, {
        // Inline formatting only. `title` is allowed for the tooltip pattern used by
        // writing_correction_page's annotated errors; it cannot execute JS.
        ALLOWED_TAGS: ['span', 'b', 'i', 'em', 'strong', 'mark', 'br', 'u', 'sup', 'sub', 'small'],
        ALLOWED_ATTR: ['class', 'title'],
        FORBID_ATTR: ['style', 'onerror', 'onclick', 'onload', 'onmouseover', 'href', 'src'],
    });
}

/**
 * Sanitize an inline-SVG string. Used by MermaidChart where the rendered output
 * comes from the Mermaid library — generally trusted but worth defending in depth.
 */
export function sanitizeSvg(dirty: string): string {
    if (!dirty) return '';
    return DOMPurify.sanitize(dirty, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover'],
    });
}
