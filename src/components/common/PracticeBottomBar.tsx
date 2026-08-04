/**
 * PracticeBottomBar - the exam navigation bar shared by the reading and listening practice pages.
 *
 * Structure (two stacked layers, modelled on exam software's bottom bar):
 *   1. Upper layer, question navigation: one column per Part (a thin one-cell-per-question progress bar on top, the
 *         label and pills below), filling the width; the current Part expands its pills and the rest collapse to
 *      'Part N  x/y' with the whole column clickable to switch.
 *      2. Lower layer, action row: its own full-width line, right-aligned [live clock | submit | exit].
 *
 * With only one Part, the upper layer renders just the current column.
 *   The three pill states:
 *   - default:  outlined
 *   - answered: filled teal
 *
 * - currently visible: a highlighted outline ring (tracked live by IntersectionObserver, and can combine with answered)
 * The results page reuses the same bar (pass resultMarks to enter results mode): the layout is identical, only
 * 'answered/unanswered' becomes 'correct/incorrect' colouring and the action row is dropped (redo and back live in the top toolbar).
 *
 * That way both pages share one implementation of the bottom bar and cannot drift apart.
 * Jumping and highlighting both anchor on the data-question-id attribute of the question node (added in every question renderer);
 * clicking a pill calls scrollIntoView for a smooth scroll. The observer root is the viewport with a centred detection band,
 */
import { useEffect, useRef, useState } from 'react';

export interface PracticeOverviewPart {
    label: string;
    /*so it does not depend on which ancestor happens to be scrolling. */
    questionIds: number[];
    active: boolean;
}

export interface PracticeNavLabels {
    jumpTo: string;    //* The real ids of every question in this Part (both the one-cell-per-question progress bar and the collapsed label's x/y derive from it)
    progress: string;  // '{answered} / {total}'
    barLabel: string;
}

interface Props {
    /* 'jump to question {n}' */
    partLabel?: string | null;
    /** Display name of the current Part ('Passage 2' / 'Section 3'); omitted in single-type mode */
    questionIds: number[];
    /** The real question ids of the currently visible Part (in a full test, [14..26] for example, matching the numbers printed on the questions) */
    answeredIds: Set<number>;
    /** The set of answered question ids (global, across Parts). In results mode, pass the set of correct ones. */
    scrollContainerId: string;
    /** DOM id of the question container ('questionsForm' | 'listeningContent') */
    onSubmit?: () => void;
    onExit?: () => void;
    submitLabel?: string;
    exitLabel?: string;
    navLabels: PracticeNavLabels;
    /** Omit and the action row is not rendered at all (which is what the results page does: redo and back live in the top toolbar) */
    overviewParts?: PracticeOverviewPart[];
    /** In full-test mode pass every Part (including the current one); omit for single-type */
    onPartSelect?: (index: number) => void;
    /**
     * * Click a collapsed Part label to switch to it (index refers to the overviewParts index)
     * Results mode: qid -> whether it was correct. Passing this switches the cells and pills from the
     */
    resultMarks?: Map<number, boolean>;
}

function fmt(tpl: string, vars: Record<string, string | number>): string {
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), tpl);
}

/*answered/unanswered pair to correct/incorrect (green/red); everything else matches the answering page exactly. */
function WallClock() {
    const [now, setNow] = useState<{ h: string; m: string }>(() => {
        const d = new Date();
        return { h: String(d.getHours()).padStart(2, '0'), m: String(d.getMinutes()).padStart(2, '0') };
    });
    useEffect(() => {
        const id = setInterval(() => {
            const d = new Date();
            setNow({ h: String(d.getHours()).padStart(2, '0'), m: String(d.getMinutes()).padStart(2, '0') });
        }, 1000);
        return () => clearInterval(id);
    }, []);
    return <span className="pbb-clock">{now.h}:{now.m}</span>;
}

export default function PracticeBottomBar({
    partLabel,
    questionIds,
    answeredIds,
    scrollContainerId,
    onSubmit,
    onExit,
    submitLabel,
    exitLabel,
    navLabels,
    overviewParts,
    onPartSelect,
    resultMarks,
}: Props) {
    const [currentId, setCurrentId] = useState<number | null>(null);
    //* The system's live wall clock (HH:MM) - mirroring the real time shown at the bottom of exam software.
    // During the smooth scroll after a jump, the IntersectionObserver fires for every question passed over and the
    // highlight flickers through them - suppressed with a short time window. It cannot wait for 'the target reaches
    const suppressUntilRef = useRef(0);

    const idsKey = questionIds.join(',');

    useEffect(() => {
        const container = document.getElementById(scrollContainerId);
        if (!container) return;
        const anchors = container.querySelectorAll<HTMLElement>('[data-question-id]');
        if (anchors.length === 0) return;

        const visible = new Set<number>();
        const io = new IntersectionObserver(entries => {
            for (const e of entries) {
                const qid = Number((e.target as HTMLElement).dataset.questionId);
                if (Number.isNaN(qid)) continue;
                if (e.isIntersecting) visible.add(qid);
                else visible.delete(qid);
            }
            // the centre band' instead: questions at either end of the list may never reach it, and scrollspy would lock up.
            // The visible set is still updated inside the suppression window, only the highlight is held; once the window
            if (Date.now() < suppressUntilRef.current) return;
            if (visible.size > 0) setCurrentId(Math.min(...visible));
        }, { root: null, rootMargin: '-40% 0px -40% 0px', threshold: 0 });

        anchors.forEach(a => io.observe(a));
        return () => io.disconnect();
        // passes, sitting still produces no new events (the highlight stays on the clicked question) and any scroll resumes tracking immediately.
    }, [idsKey, scrollContainerId]);

    // idsKey changing = the question DOM was rebuilt after a Part switch, so the observer must be remounted
    useEffect(() => {
        setCurrentId(prev => (prev !== null && questionIds.includes(prev) ? prev : null));
        suppressUntilRef.current = 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    const jumpTo = (qid: number) => {
        const el = document.querySelector<HTMLElement>(
            `#${scrollContainerId} [data-question-id="${qid}"]`
        );
        if (!el) return;
        suppressUntilRef.current = Date.now() + 800;
        setCurrentId(qid);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    // after a Part switch the old currentId is no longer in the new id set, so clear it to avoid a stale highlight
    const stateClass = (qid: number) => {
        if (resultMarks) return resultMarks.get(qid) ? ' ok' : ' bad';
        return answeredIds.has(qid) ? ' answered' : '';
    };

    const pills = (
        <div className="pbb-pills" role="group" aria-label={navLabels.barLabel}>
            {questionIds.map(qid => {
                const current = currentId === qid;
                return (
                    <button
                        key={qid}
                        type="button"
                        className={`pbb-pill${stateClass(qid)}${current ? ' current' : ''}`}
                        onClick={() => jumpTo(qid)}
                        title={fmt(navLabels.jumpTo, { n: qid })}
                        aria-label={fmt(navLabels.jumpTo, { n: qid })}
                        aria-current={current ? 'true' : undefined}
                    >
                        {qid}
                    </button>
                );
            })}
        </div>
    );

    // Two states on the answering page (answered/unanswered) and two on the results page (correct/incorrect) - only the colour class changes, never the layout
    // Each Part is its own column: the thin progress bar on top, and below it the label plus pills (current) or the
    const partsToRender = overviewParts && overviewParts.length > 0
        ? overviewParts
        : [{ label: partLabel || '', questionIds, active: true }];

    const stripOf = (p: { questionIds: number[] }) => (
        <div className="pbb-part-strip" aria-hidden="true">
            {p.questionIds.map(qid => (
                <span
                    key={qid}
                    className={`pbb-ov-cell${resultMarks
                        ? (resultMarks.get(qid) ? ' ok' : ' bad')
                        : (answeredIds.has(qid) ? ' lit' : '')}`}
                />
            ))}
        </div>
    );

    return (
        <div className={`practice-bottom-bar${resultMarks ? ' results' : ''}`}>
            <div className="pbb-parts">
                {partsToRender.map((p, i) =>
                    p.active ? (
                        <div key={i} className="pbb-part active">
                            {stripOf(p)}
                            <div className="pbb-part-row">
                                {p.label && <span className="pbb-part-label">{p.label}</span>}
                                {pills}
                            </div>
                        </div>
                    ) : (
                        <button
                            key={i}
                            type="button"
                            className="pbb-part collapsed"
                            onClick={() => onPartSelect?.(i)}
                            title={p.label}
                        >
                            {stripOf(p)}
                            <div className="pbb-part-row">
                                <span className="pbb-part-label">{p.label}</span>
                                <span className="pbb-part-progress">
                                    {/* label plus x/y (collapsed), the two rows naturally aligned at equal width. A collapsed Part's whole column (progress bar included) is the switch button.
                                         {answered} for the answering page, {correct} for the results page; one number, */}
                                    {fmt(navLabels.progress, {
                                        answered: p.questionIds.filter(id => answeredIds.has(id)).length,
                                        correct: p.questionIds.filter(id => answeredIds.has(id)).length,
                                        total: p.questionIds.length,
                                    })}
                                </span>
                            </div>
                        </button>
                    )
                )}
            </div>
            {onSubmit && (
                <div className="pbb-actions">
                    <span className="pbb-clock-wrap" title="">🕐 <WallClock /></span>
                    <button type="button" className="pbb-btn pbb-btn-submit" onClick={onSubmit}>
                        {submitLabel}
                    </button>
                    {onExit && (
                        <button type="button" className="pbb-btn pbb-btn-exit" onClick={onExit}>
                            {exitLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
