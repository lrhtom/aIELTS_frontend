/**
 * ReadingQuestionRenderer — 单一入口渲染 11 种 IELTS Reading 题型.
 *
 * 输入答案模式:
 *   MCQ / TFNG / YNNG                                → radio (options 中的 key)
 *   matching_headings                                → 每段 dropdown 选 roman heading
 *   matching_info / features / sentence / summary    → 每题 dropdown 选 letter
 *   sentence_completion / short_answer / note        → text input
 *
 * 用户答案存到外部 answersRef, 通过 onAnswerChange 回调回传.
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

/** Bank 里是否存在至少一条非空文本。键存在但值全空（AI drift）渲染出来是 "A. B. C." 废列表。 */
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
    // Bank 记录经 AI 生成后偶尔会出现 questions 字段缺失/非数组的情况
    // (老的失败记录、部分被 admin 编辑掉、AI 出错等)。所有分支都靠 questions.map
    // 渲染,所以顶部先兜底再往下走,避免 "Cannot read properties of undefined
    // (reading 'map')" 崩掉整页。
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
        // Bank 缺失/为空（AI drift）时拖拽面板毫无可选项 — 降级为文本输入，至少可作答
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
        // Bank 缺失/空键/值全空时字母网格没有可用选项 — 降级为文本输入
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
                    // ABOVE the answer grid (真题排版：选项框在做题表格上面)。
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
        // Word bank 值全空时下拉框只剩 "--" 无法作答 — 降级为文本填空（同 note_completion）
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

    // ── Sentence Completion — inline `_____` → inline <input> (与听力 sentence 一致) ──
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

/** Score a set of questions given the user's answers. Case-insensitive; text types accept any variant in `answers`. */
export function scoreSection(section: SectionLike, getAnswer: (qid: number) => string): { correct: number; total: number } {
    let correct = 0;
    const total = section.questions.length;
    for (const q of section.questions) {
        const userLc = (getAnswer(q.id) || '').trim().toLowerCase();
        if (!userLc) continue;
        if (Array.isArray(q.answers) && q.answers.length > 0) {
            if (q.answers.some(a => String(a).trim().toLowerCase() === userLc)) correct++;
        } else if (q.answer !== undefined && q.answer !== null) {
            if (String(q.answer).trim().toLowerCase() === userLc) correct++;
        }
    }
    return { correct, total };
}

/** Used only to placate linters — hook usage keeps the file eligible for React fast refresh */
export const _useReadingRendererHook = () => useMemo(() => 1, []);


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

    const bankKeys = Object.keys(bank);
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
                <div className="mh-pool-title">Headings pool — drag onto paragraphs</div>
                <div className="mh-chip-row">
                    {poolHeadings.length === 0 && (
                        <span className="mh-pool-empty">(all headings placed)</span>
                    )}
                    {poolHeadings.map(roman => (
                        <div
                            key={roman}
                            className="mh-chip"
                            draggable={!reviewMode}
                            onDragStart={e => onDragStart(e, roman, null)}
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
                                className={`mh-slot-zone ${placed ? 'filled' : 'empty'} ${reviewMode ? (isCorrect ? 'review-ok' : 'review-ng') : ''}`}
                                onDragOver={allowDrop}
                                onDrop={e => dropOnSlot(e, q.id)}
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
                                                onClick={() => clearSlot(q.id)}
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
