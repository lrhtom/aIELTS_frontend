/**
 * * Mark the answer sentences first (on plain text), then apply the ** highlighting, then sanitize once.
 *
 * ReadingQuestionRenderer - a single entry point rendering all 11 IELTS Reading question types.
 *   Answer input modes:
 *   MCQ / TFNG / YNNG                                -> radio (the key from options)
 *   matching_headings                                -> a dropdown per paragraph selecting a roman heading
 *   sentence_completion / short_answer / note        → text input
 *
 * matching_info / features / sentence / summary    -> a dropdown per question selecting a letter
 */
import { useMemo, useState, type ReactElement } from 'react';
import { sanitize } from '../../utils/safe_html';
import type { Question, QuizData, FullPassageSection, ReadingQuestionType } from '../../store/reading_page_store';
import MatchingLetterGrid from '../common/MatchingLetterGrid';
import { useLang } from '../../i18n/LanguageContext';

interface SectionLike {
    questionType: ReadingQuestionType;
    questions: Question[];
    headings_bank?: Record<string, string>;
    paragraph_labels?: string[];
    features_bank?: Record<string, string>;
    endings_bank?: Record<string, string>;
    summary_intro?: string;
    summary_text?: string;
    word_bank?: Record<string, string>;
    note_intro?: string;
    note_content?: string;
    layout?: string;
    wordLimit?: string;
    judgementMode?: 'easy' | 'normal' | null;
    instructions?: string;
}

interface Props {
    section: SectionLike | QuizData | FullPassageSection;
    /** Read current answer for a question id */
    getAnswer: (qid: number) => string;
    /** Push answer back to parent state */
    onAnswer: (qid: number, value: string) => void;
    /** In review/results mode: highlight correct + user answers */
    reviewMode?: boolean;
}

function formatHighlight(text: string): string {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
}

function safeHTML(text: string): string {
    return sanitize(formatHighlight(text || ''));
}

/**
 * Coerce an unknown "bank value" (from AI-generated JSON) to a plain string.
 * The AI sometimes returns objects like {"key": "i", "text": "..."} inside
 * bank fields; rendering those directly crashes React. Extract .text when
 * present, otherwise fall back to String() serialization.
 */
export function bankVal(v: unknown): string {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
        const obj = v as Record<string, unknown>;
        if (typeof obj.text === 'string') return obj.text;
        if (typeof obj.label === 'string') return obj.label;
        if (typeof obj.value === 'string') return obj.value;
    }
    return String(v);
}

/**
 * Coerce an AI bank field into a normalized Record<string, string>. Accepts:
 *   - Record<string, string>  (canonical)
 *   - Record<string, {text}>  (AI drift)
 *   - Array<{key, text}>       (AI drift)
 *   - Array<[key, value]>      (AI drift)
 */
function normalizeBank(raw: unknown): Record<string, string> {
    if (!raw) return {};
    if (Array.isArray(raw)) {
        const out: Record<string, string> = {};
        raw.forEach((item, idx) => {
            if (item && typeof item === 'object') {
                const o = item as Record<string, unknown>;
                const key = String(o.key ?? o.letter ?? o.roman ?? o.id ?? idx);
                out[key] = bankVal(o.text ?? o.label ?? o.value ?? '');
            } else if (Array.isArray(item) && item.length >= 2) {
                out[String(item[0])] = bankVal(item[1]);
            }
        });
        return out;
    }
    if (typeof raw === 'object') {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            out[k] = bankVal(v);
        }
        return out;
    }
    return {};
}

/*User answers are stored in the external answersRef and reported back through the onAnswerChange callback. */
function bankHasContent(bank: Record<string, string>): boolean {
    return Object.values(bank).some(v => v && v.trim().length > 0);
}

/**
 * Render structured content (summary_text / note_content) with (1)-(N) blanks
 * replaced by inline <input> elements. Used for note_completion.
 *
 * Blank IDs are numbered inside the section (1, 2, 3…) but questions in
 * full-test mode have global IDs (14, 15…). `startId` is the first question's
 * global id, so blank (1) maps to qid=startId, blank (2) → startId+1, etc.
 */
function renderNoteBlanksInput(
    content: string,
    startId: number,
    getAnswer: (qid: number) => string,
    onAnswer: (qid: number, v: string) => void,
    disabled: boolean,
): { element: ReactElement; renderedIds: Set<number> } {
    const parts = content.split(/(\(\d+\)\s*_+)/g);
    const renderedIds = new Set<number>();
    const element = (
        <pre className="rd-inline-blank-block">
            {parts.map((part, i) => {
                const m = /^\((\d+)\)\s*_+$/.exec(part);
                if (m) {
                    const localNum = Number(m[1]);
                    const qid = startId + localNum - 1;
                    renderedIds.add(qid);
                    return (
                        <span key={i} className="rd-blank-wrap" data-question-id={qid}>
                            <span className="rd-blank-num">({localNum})</span>
                            <input
                                type="text"
                                className="rd-blank-input"
                                defaultValue={getAnswer(qid)}
                                onChange={e => onAnswer(qid, e.target.value)}
                                disabled={disabled}
                                placeholder="…"
                            />
                        </span>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </pre>
    );
    return { element, renderedIds };
}

/**
 * Render summary paragraph with (1)-(N) blanks replaced by inline <select>
 * dropdowns (word bank picks). Used for summary_completion.
 */
function renderSummaryBlanksSelect(
    content: string,
    startId: number,
    bank: Record<string, string>,
    getAnswer: (qid: number) => string,
    onAnswer: (qid: number, v: string) => void,
    disabled: boolean,
): { element: ReactElement; renderedIds: Set<number> } {
    const parts = content.split(/(\(\d+\)\s*_+)/g);
    const bankKeys = Object.keys(bank);
    const renderedIds = new Set<number>();
    const element = (
        <div className="rd-inline-blank-block summary">
            {parts.map((part, i) => {
                const m = /^\((\d+)\)\s*_+$/.exec(part);
                if (m) {
                    const localNum = Number(m[1]);
                    const qid = startId + localNum - 1;
                    renderedIds.add(qid);
                    return (
                        <span key={i} className="rd-blank-wrap" data-question-id={qid}>
                            <span className="rd-blank-num">({localNum})</span>
                            <select
                                className="rd-blank-select"
                                defaultValue={getAnswer(qid)}
                                onChange={e => onAnswer(qid, e.target.value)}
                                disabled={disabled}
                            >
                                <option value="">--</option>
                                {bankKeys.map(k => (
                                    <option key={k} value={k}>{k}. {bank[k]}</option>
                                ))}
                            </select>
                        </span>
                    );
                }
                // Regular text — preserve whitespace so surrounding sentences flow naturally
                return <span key={i} dangerouslySetInnerHTML={{ __html: safeHTML(part) }} />;
            })}
        </div>
    );
    return { element, renderedIds };
}

/**
 * Fallback rows for questions whose `(N) ___` blank never made it into the
 * structured content (AI drift: dropped markers, off-by-N numbering, wrong
 * underscore count). Mirrors listening's FallbackInputs — without this those
 * questions are silently unanswerable.
 */
function ReadingFallbackRows({ questions, renderedIds, bank, getAnswer, onAnswer, disabled }: {
    questions: Question[];
    renderedIds: Set<number>;
    /** When present, render a letter <select> from the bank; otherwise a text input. */
    bank?: Record<string, string>;
    getAnswer: (qid: number) => string;
    onAnswer: (qid: number, v: string) => void;
    disabled: boolean;
}): ReactElement | null {
    const { t } = useLang();
    const missing = questions.filter(q => !renderedIds.has(q.id));
    if (missing.length === 0) return null;
    const bankKeys = bank ? Object.keys(bank) : [];
    return (
        <div className="rd-fallback-rows" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p className="section-instructions" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                {t('components.questionRenderer.answerRemaining')}
            </p>
            {missing.map(q => (
                <div key={q.id} className="rd-blank-wrap" data-question-id={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="rd-blank-num">{q.id}.</span>
                    {bank && bankKeys.length > 0 ? (
                        <select
                            className="rd-blank-select"
                            defaultValue={getAnswer(q.id)}
                            onChange={e => onAnswer(q.id, e.target.value)}
                            disabled={disabled}
                        >
                            <option value="">--</option>
                            {bankKeys.map(k => (
                                <option key={k} value={k}>{k}. {bank[k]}</option>
                            ))}
                        </select>
                    ) : (
                        <input
                            type="text"
                            className="rd-blank-input"
                            defaultValue={getAnswer(q.id)}
                            onChange={e => onAnswer(q.id, e.target.value)}
                            disabled={disabled}
                            placeholder={t('components.questionRenderer.typeAnswer')}
                            style={{ flex: 1, maxWidth: 320 }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function ReadingQuestionRenderer({ section, getAnswer, onAnswer, reviewMode = false }: Props) {
    const { t } = useLang();
    //* Whether the bank holds at least one non-empty string. Keys that exist with entirely empty values (AI drift) render as a useless 'A. B. C.' list.
    // A generated bank record occasionally comes back with questions missing or not an array
    // (an old failed record, partially edited by an admin, an AI error, and so on). Every branch renders through
    // questions.map, so guard at the top before going any further, or 'Cannot read properties of undefined
    if (!section || !Array.isArray(section.questions) || section.questions.length === 0) {
        return null;
    }
    const qt = section.questionType;

    // Common "verdict" pill for review mode
    const verdict = (qid: number, correct: string | undefined, userAns: string): { correct: boolean; msg: string } => {
        const ok = correct !== undefined && userAns.trim().toLowerCase() === String(correct).trim().toLowerCase();
        return { correct: ok, msg: ok ? '✅' : `❌ (${correct ?? '?'})` };
        void qid;
    };

    const verdictArr = (qid: number, correctList: unknown, userAns: string): { correct: boolean; msg: string } => {
        const safeList: string[] = Array.isArray(correctList)
            ? correctList.map(a => (a == null ? '' : String(a)))
            : (correctList == null ? [] : [String(correctList)]);
        const userLc = userAns.trim().toLowerCase();
        const ok = safeList.some(a => a.trim().toLowerCase() === userLc);
        return { correct: ok, msg: ok ? '✅' : `❌ (${safeList.join(' / ')})` };
        void qid;
    };

    const instructions = 'instructions' in section ? section.instructions : undefined;

    // ── MCQ / TF / YN — radio-based (uncontrolled: matches original behaviour) ──
    if (qt === 'multiple_choice' || qt === 'true_false' || qt === 'yes_no') {
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {section.questions.map(q => {
                    const options = q.options || {};
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block" data-question-id={q.id}>
                            <div className="question-text" dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />
                            {Object.entries(options).map(([key, value]) => (
                                <label key={key} className="option-label">
                                    <input
                                        type="radio"
                                        name={`q${q.id}`}
                                        value={key}
                                        defaultChecked={userAns === key}
                                        onChange={() => onAnswer(q.id, key)}
                                        disabled={reviewMode}
                                    />
                                    <strong>{key.length <= 3 ? `${key}.` : key}</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: safeHTML(bankVal(value)) }} />
                                </label>
                            ))}
                            {reviewMode && (
                                <div className={`review-verdict ${verdict(q.id, q.answer, userAns).correct ? 'ok' : 'ng'}`}>
                                    {verdict(q.id, q.answer, userAns).msg}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    // ── Matching Headings — drag-and-drop headings onto paragraphs ──
    if (qt === 'matching_headings') {
        const bank = normalizeBank(section.headings_bank);
        // (reading 'map')' takes down the whole page.
        if (!bankHasContent(bank)) {
            return (
                <>
                    {instructions && <p className="section-instructions">{instructions}</p>}
                    <ReadingFallbackRows questions={section.questions} renderedIds={new Set()} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} />
                </>
            );
        }
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                <MatchingHeadingsPanel
                    bank={bank}
                    questions={section.questions}
                    getAnswer={getAnswer}
                    onAnswer={onAnswer}
                    reviewMode={reviewMode}
                />
            </>
        );
    }

    // ── Matching Info / Features / Sentence — radio-letter grid ──
    if (qt === 'matching_info' || qt === 'matching_features' || qt === 'matching_sentence') {
        const bank: Record<string, string> = qt === 'matching_info'
            ? Object.fromEntries((section.paragraph_labels || ['A','B','C','D','E','F']).map(l => [String(l), `Paragraph ${l}`]))
            : normalizeBank(qt === 'matching_features' ? section.features_bank : section.endings_bank);
        const bankKeys = Object.keys(bank);
        // When the bank is missing or empty (AI drift) the drag panel has nothing to offer - degrade to a text input so the question stays answerable
        if (!bankHasContent(bank)) {
            return (
                <>
                    {instructions && <p className="section-instructions">{instructions}</p>}
                    <ReadingFallbackRows questions={section.questions} renderedIds={new Set()} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} />
                </>
            );
        }
        const rows = section.questions.map(q => ({
            id: q.id,
            label: <span dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />,
        }));
        const correctById: Record<number | string, string> = {};
        for (const q of section.questions) {
            if (q.answer != null) correctById[q.id] = String(q.answer);
        }
        const grid = (
            <MatchingLetterGrid
                rows={rows}
                letters={bankKeys}
                letterTitles={qt === 'matching_info' ? undefined : bank}
                getAnswer={id => getAnswer(Number(id))}
                onAnswer={(id, letter) => onAnswer(Number(id), letter)}
                reviewMode={reviewMode}
                correctById={correctById}
            />
        );
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {qt !== 'matching_info' && (
                    // matching_features / matching_sentence: options bank goes
                    // When the bank is missing, its keys are empty, or every value is empty, the letter grid has no usable options - degrade to a text input
                    <div className="matching-features-bank">
                        <strong>{qt === 'matching_features' ? 'Categories:' : 'Endings:'}</strong>
                        <ul>
                            {Object.entries(bank).map(([letter, text]) => (
                                <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {grid}
            </>
        );
    }

    // ── Summary Completion — summary_text with (n) blanks, answered by letter picks from word_bank ──
    if (qt === 'summary_completion') {
        const bank = normalizeBank(section.word_bank);
        const startId = section.questions[0]?.id ?? 1;
        // ABOVE the answer grid (real exam layout: the options box sits above the answer table).
        const bankOk = bankHasContent(bank);
        const { element: blanksEl, renderedIds } = bankOk
            ? renderSummaryBlanksSelect(section.summary_text || '', startId, bank, getAnswer, onAnswer, reviewMode)
            : renderNoteBlanksInput(section.summary_text || '', startId, getAnswer, onAnswer, reviewMode);
        return (
            <>
                {section.summary_intro && <p className="section-instructions">{section.summary_intro}</p>}
                {bankOk && (
                    <div className="summary-word-bank">
                        <strong>Word bank:</strong>
                        <ul>
                            {Object.entries(bank).map(([letter, text]) => (
                                <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {blanksEl}
                <ReadingFallbackRows questions={section.questions} renderedIds={renderedIds} bank={bankOk ? bank : undefined} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} />
                {reviewMode && (
                    <div className="rd-review-list">
                        {section.questions.map(q => {
                            const userAns = getAnswer(q.id);
                            const v = verdict(q.id, q.answer, userAns);
                            return (
                                <div key={q.id} className={`rd-review-row ${v.correct ? 'ok' : 'ng'}`}>
                                    <strong>{q.id}.</strong> {v.msg}
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        );
    }

    // ── Note Completion — structured note_content with (n) blanks, answered by text ──
    if (qt === 'note_completion') {
        const startId = section.questions[0]?.id ?? 1;
        const { element: blanksEl, renderedIds } = renderNoteBlanksInput(section.note_content || '', startId, getAnswer, onAnswer, reviewMode);
        return (
            <>
                {section.note_intro && <p className="section-instructions">{section.note_intro}</p>}
                {section.wordLimit && <p className="word-limit-hint">📏 {section.wordLimit}</p>}
                {blanksEl}
                <ReadingFallbackRows questions={section.questions} renderedIds={renderedIds} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} />
                {reviewMode && (
                    <div className="rd-review-list">
                        {section.questions.map(q => {
                            const userAns = getAnswer(q.id);
                            const v = verdictArr(q.id, q.answers, userAns);
                            return (
                                <div key={q.id} className={`rd-review-row ${v.correct ? 'ok' : 'ng'}`}>
                                    <strong>{q.id}.</strong> {v.msg}
                                </div>
                            );
                        })}
                    </div>
                )}
            </>
        );
    }

    // When every word bank value is empty the dropdown offers only '--' and the question cannot be answered - degrade to a text gap-fill (same as note_completion)
    if (qt === 'sentence_completion') {
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {section.wordLimit && <p className="word-limit-hint">📏 {section.wordLimit}</p>}
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    const raw = q.question || '';
                    const parts = raw.split(/_{2,}/);
                    return (
                        <div key={q.id} className="rd-inline-q-block" data-question-id={q.id}>
                            <span className="rd-blank-num">{q.id}.</span>{' '}
                            {parts.map((seg, i) => (
                                <span key={i}>
                                    <span dangerouslySetInnerHTML={{ __html: safeHTML(seg) }} />
                                    {i < parts.length - 1 && (
                                        <input
                                            type="text"
                                            className="rd-blank-input"
                                            defaultValue={userAns}
                                            onChange={e => onAnswer(q.id, e.target.value)}
                                            disabled={reviewMode}
                                            placeholder="…"
                                        />
                                    )}
                                </span>
                            ))}
                            {reviewMode && (
                                <div className={`review-verdict ${verdictArr(q.id, q.answers, userAns).correct ? 'ok' : 'ng'}`}>
                                    {verdictArr(q.id, q.answers, userAns).msg}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    // ── Short Answer — question text + separate text input (no inline blank) ──
    if (qt === 'short_answer') {
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {section.wordLimit && <p className="word-limit-hint">📏 {section.wordLimit}</p>}
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block" data-question-id={q.id}>
                            <div className="question-text" dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />
                            <input
                                type="text"
                                className="text-answer-input"
                                defaultValue={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                                placeholder={t('components.questionRenderer.typeAnswer')}
                            />
                            {reviewMode && (
                                <div className={`review-verdict ${verdictArr(q.id, q.answers, userAns).correct ? 'ok' : 'ng'}`}>
                                    {verdictArr(q.id, q.answers, userAns).msg}
                                </div>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    return <div className="section-instructions">{t('components.questionRenderer.unsupportedType').replace('{t}', String(qt))}</div>;
}

/**
 *  -- Sentence completion - inline `_____` becomes an inline <input> (matching listening's sentence type) --
 * Mark a single question. The tick/cross on the results page, the red/green cells in the bottom bar and the total
 * score all go through this one function, so the same question cannot show different verdicts in different places.
 */
export function isQuestionCorrect(
    q: { answer?: unknown; answers?: unknown },
    userAnswer: string,
): boolean {
    const userLc = (userAnswer || '').trim().toLowerCase();
    if (!userLc) return false;
    if (Array.isArray(q.answers) && q.answers.length > 0) {
        return q.answers.some(a => String(a).trim().toLowerCase() === userLc);
    }
    if (q.answer !== undefined && q.answer !== null) {
        return String(q.answer).trim().toLowerCase() === userLc;
    }
    return false;
}

/** Score a set of questions given the user's answers. */
export function scoreSection(section: SectionLike, getAnswer: (qid: number) => string): { correct: number; total: number } {
    let correct = 0;
    const total = section.questions.length;
    for (const q of section.questions) {
        if (isQuestionCorrect(q, getAnswer(q.id))) correct++;
    }
    return { correct, total };
}

/** Used only to placate linters — hook usage keeps the file eligible for React fast refresh */
export const _useReadingRendererHook = () => useMemo(() => 1, []);


const ROMAN_VALUE: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

/*Case-insensitive; text questions accept any variant listed in `answers`. */
function romanToInt(s: string): number | null {
    const t = s.trim().toLowerCase();
    if (!t || !/^[ivxlcdm]+$/.test(t)) return null;
    let total = 0;
    for (let i = 0; i < t.length; i++) {
        const cur = ROMAN_VALUE[t[i]];
        const next = ROMAN_VALUE[t[i + 1]];
        total += next && cur < next ? -cur : cur;   // iv = 5-1, ix = 10-1
    }
    return total;
}

/**
 * * Lowercase roman numeral -> its value; returns null when it is not a valid roman numeral (falling back to natural order).
 * Sort key for the heading pool. matching_headings uses roman numerals (i, ii, iii...), while other banks may use
 * letters (A, B, C). Roman numerals must sort by value - sorting them as strings gives the absurd order i, ii, iii,
 */
function compareHeadingKey(a: string, b: string): number {
    const ra = romanToInt(a);
    const rb = romanToInt(b);
    if (ra != null && rb != null) return ra - rb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/* -----------------------------------------------------------------------
 *  MatchingHeadingsPanel — drag headings from a pool onto paragraph slots.
 *  Behaviour:
 *    - Pool shows unused headings; each drops-once (real IELTS rule)
 *    - Dragging a placed heading to another slot moves it (frees the old slot)
 *    - Dragging a placed heading to the pool removes it
 *    - × on a placed chip clears the slot
 * ---------------------------------------------------------------------*/
interface MatchingHeadingsPanelProps {
    bank: Record<string, string>;
    questions: Question[];
    getAnswer: (qid: number) => string;
    onAnswer: (qid: number, value: string) => void;
    reviewMode: boolean;
}

function MatchingHeadingsPanel({ bank, questions, getAnswer, onAnswer, reviewMode }: MatchingHeadingsPanelProps) {
    const { t } = useLang();
    // Local state mirrors the answers so we can trigger re-render on every drop.
    // Initialised from the ref-backed getAnswer so state survives re-mounts.
    const [placements, setPlacements] = useState<Record<number, string>>(() => {
        const init: Record<number, string> = {};
        for (const q of questions) {
            const a = getAnswer(q.id);
            if (a) init[q.id] = a;
        }
        return init;
    });
    //iv, ix, v, vi... When neither side is a roman numeral, fall back to a natural-order comparison.
    const [pickedHeading, setPickedHeading] = useState<string | null>(null);

    // the heading currently selected in click-to-place mode (null = nothing selected)
    // The pool must be sorted by the roman numerals' real values rather than Object.keys' original order: that is the
    // key order of the AI-generated JSON, and orders like i, ii, vi, iii have really been observed (bankId=140), whereas
    const bankKeys = [...Object.keys(bank)].sort(compareHeadingKey);
    const usedHeadings = new Set(Object.values(placements));
    const poolHeadings = bankKeys.filter(k => !usedHeadings.has(k));

    const commit = (next: Record<number, string>, changedIds: number[]) => {
        setPlacements(next);
        for (const id of changedIds) onAnswer(id, next[id] || '');
    };

    const placeOnSlot = (targetQid: number, roman: string) => {
        if (!bank[roman]) return;
        const next = { ...placements };
        const changed: number[] = [targetQid];
        // If this heading was already placed elsewhere, free that slot.
        for (const [k, v] of Object.entries(next)) {
            const kNum = Number(k);
            if (v === roman && kNum !== targetQid) {
                delete next[kNum];
                changed.push(kNum);
            }
        }
        next[targetQid] = roman;
        commit(next, changed);
    };

    const clearSlot = (qid: number) => {
        if (!(qid in placements)) return;
        const next = { ...placements };
        delete next[qid];
        commit(next, [qid]);
    };

    // a Cambridge heading pool always runs i, ii, iii... in sequence. Taking a placed heading back must also reinsert it in the right position rather than appending it.
    // -- Click to place (the equivalent of dragging) --
    // Pure drag-and-drop is close to unusable in a narrow sidebar or on a touch screen, and 'I clicked and nothing happened' reads as a broken selection.
    const pickHeading = (roman: string) => {
        if (reviewMode) return;
        setPickedHeading(prev => (prev === roman ? null : roman));
    };

    const slotClick = (qid: number) => {
        if (reviewMode) return;
        if (pickedHeading) {
            placeOnSlot(qid, pickedHeading);
            setPickedHeading(null);
        } else if (placements[qid]) {
            // Interaction: click a heading in the pool to select it -> click a paragraph slot to place it; click the selected chip again to deselect.
            clearSlot(qid);
        }
    };

    // ── DnD wiring ──
    const onDragStart = (e: React.DragEvent, roman: string, sourceQid: number | null) => {
        if (reviewMode) return;
        e.dataTransfer.setData('text/plain', roman);
        e.dataTransfer.setData('application/x-mh-source', sourceQid == null ? 'pool' : String(sourceQid));
        e.dataTransfer.effectAllowed = 'move';
    };

    const allowDrop = (e: React.DragEvent) => {
        if (reviewMode) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const dropOnSlot = (e: React.DragEvent, targetQid: number) => {
        if (reviewMode) return;
        e.preventDefault();
        const roman = e.dataTransfer.getData('text/plain');
        if (roman) placeOnSlot(targetQid, roman);
    };

    const dropOnPool = (e: React.DragEvent) => {
        if (reviewMode) return;
        e.preventDefault();
        const src = e.dataTransfer.getData('application/x-mh-source');
        if (src && src !== 'pool') clearSlot(Number(src));
    };

    return (
        <div className="mh-panel">
            {/* Pool */}
            <div
                className="mh-pool"
                onDragOver={allowDrop}
                onDrop={dropOnPool}
            >
                <div className="mh-pool-title">
                    Headings pool — drag onto paragraphs
                    {pickedHeading && (
                        <span className="mh-pick-hint">
                            {t('components.questionRenderer.pickHeadingHint').replace('{n}', pickedHeading)}
                        </span>
                    )}
                </div>
                <div className="mh-chip-row">
                    {poolHeadings.length === 0 && (
                        <span className="mh-pool-empty">(all headings placed)</span>
                    )}
                    {poolHeadings.map(roman => (
                        <div
                            key={roman}
                            className={`mh-chip${pickedHeading === roman ? ' is-picked' : ''}`}
                            draggable={!reviewMode}
                            onDragStart={e => onDragStart(e, roman, null)}
                            onClick={() => pickHeading(roman)}
                            role="button"
                            tabIndex={reviewMode ? -1 : 0}
                            aria-pressed={pickedHeading === roman}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickHeading(roman); }
                            }}
                        >
                            <span className="mh-chip-roman">{roman}</span>
                            <span className="mh-chip-text">{bank[roman]}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Slots per paragraph */}
            <div className="mh-slots">
                {questions.map(q => {
                    const placed = placements[q.id];
                    const isCorrect = reviewMode && placed && placed === q.answer;
                    const isWrong = reviewMode && (!placed || placed !== q.answer);
                    return (
                        <div key={q.id} className="mh-slot-row" data-question-id={q.id}>
                            <div className="mh-slot-label">
                                {q.id}. Paragraph <strong>{q.paragraph || '?'}</strong>
                            </div>
                            <div
                                className={`mh-slot-zone ${placed ? 'filled' : 'empty'} ${pickedHeading && !reviewMode ? 'is-droppable' : ''} ${reviewMode ? (isCorrect ? 'review-ok' : 'review-ng') : ''}`}
                                onDragOver={allowDrop}
                                onDrop={e => dropOnSlot(e, q.id)}
                                onClick={() => slotClick(q.id)}
                                role={reviewMode ? undefined : 'button'}
                                tabIndex={reviewMode ? -1 : 0}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); slotClick(q.id); }
                                }}
                            >
                                {placed ? (
                                    <div
                                        className="mh-chip mh-chip-placed"
                                        draggable={!reviewMode}
                                        onDragStart={e => onDragStart(e, placed, q.id)}
                                    >
                                        <span className="mh-chip-roman">{placed}</span>
                                        <span className="mh-chip-text">{bank[placed] || ''}</span>
                                        {!reviewMode && (
                                            <button
                                                type="button"
                                                className="mh-chip-remove"
                                                onClick={e => { e.stopPropagation(); clearSlot(q.id); }}
                                                aria-label={t('components.questionRenderer.removeHeading')}
                                            >×</button>
                                        )}
                                    </div>
                                ) : (
                                    <span className="mh-slot-hint">{t('components.questionRenderer.dropHeading')}</span>
                                )}
                            </div>
                            {reviewMode && isWrong && (
                                <div className="review-verdict ng">{t('components.questionRenderer.correctIs').replace('{a}', q.answer ?? '')}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
