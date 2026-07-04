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
import { useMemo } from 'react';
import { sanitize } from '../../utils/safe_html';
import type { Question, QuizData, FullPassageSection, ReadingQuestionType } from '../../store/reading_page_store';

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
function bankVal(v: unknown): string {
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

export default function ReadingQuestionRenderer({ section, getAnswer, onAnswer, reviewMode = false }: Props) {
    const qt = section.questionType;

    // Common "verdict" pill for review mode
    const verdict = (qid: number, correct: string | undefined, userAns: string): { correct: boolean; msg: string } => {
        const ok = correct !== undefined && userAns.trim().toLowerCase() === String(correct).trim().toLowerCase();
        return { correct: ok, msg: ok ? '✅' : `❌ (${correct ?? '?'})` };
        void qid;
    };

    const verdictArr = (qid: number, correctList: string[] | undefined, userAns: string): { correct: boolean; msg: string } => {
        const userLc = userAns.trim().toLowerCase();
        const ok = Boolean(correctList && correctList.some(a => String(a).trim().toLowerCase() === userLc));
        return { correct: ok, msg: ok ? '✅' : `❌ (${(correctList || []).join(' / ')})` };
        void qid;
    };

    const instructions = section.instructions;

    // ── MCQ / TF / YN — radio-based ──
    if (qt === 'multiple_choice' || qt === 'true_false' || qt === 'yes_no') {
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {section.questions.map(q => {
                    const options = q.options || {};
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block">
                            <div className="question-text" dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />
                            {Object.entries(options).map(([key, value]) => (
                                <label key={key} className="option-label">
                                    <input
                                        type="radio"
                                        name={`q${q.id}`}
                                        value={key}
                                        checked={userAns === key}
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

    // ── Matching Headings — one dropdown per paragraph ──
    if (qt === 'matching_headings') {
        const bank = normalizeBank(section.headings_bank);
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                <div className="matching-headings-bank">
                    <strong>Headings:</strong>
                    <ul>
                        {Object.entries(bank).map(([roman, text]) => (
                            <li key={roman}><span className="hb-roman">{roman}.</span> {text}</li>
                        ))}
                    </ul>
                </div>
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block">
                            <div className="question-text">{q.id}. Paragraph <strong>{q.paragraph || '?'}</strong></div>
                            <select
                                className="match-select"
                                value={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                            >
                                <option value="">--</option>
                                {Object.keys(bank).map(r => (
                                    <option key={r} value={r}>{r}</option>
                                ))}
                            </select>
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

    // ── Matching Info / Features / Sentence — dropdown per item ──
    if (qt === 'matching_info' || qt === 'matching_features' || qt === 'matching_sentence') {
        const bank: Record<string, string> = qt === 'matching_info'
            ? Object.fromEntries((section.paragraph_labels || ['A','B','C','D','E','F']).map(l => [String(l), `Paragraph ${l}`]))
            : normalizeBank(qt === 'matching_features' ? section.features_bank : section.endings_bank);
        const bankKeys = Object.keys(bank);
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {(qt !== 'matching_info') && (
                    <div className="matching-features-bank">
                        <strong>{qt === 'matching_features' ? 'Categories:' : 'Endings:'}</strong>
                        <ul>
                            {Object.entries(bank).map(([letter, text]) => (
                                <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                            ))}
                        </ul>
                    </div>
                )}
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block">
                            <div className="question-text" dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />
                            <select
                                className="match-select"
                                value={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                            >
                                <option value="">--</option>
                                {bankKeys.map(k => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
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

    // ── Summary Completion — summary_text with (n) blanks, answered by letter picks from word_bank ──
    if (qt === 'summary_completion') {
        const bank = normalizeBank(section.word_bank);
        const bankKeys = Object.keys(bank);
        return (
            <>
                {section.summary_intro && <p className="section-instructions">{section.summary_intro}</p>}
                <div className="summary-word-bank">
                    <strong>Word bank:</strong>
                    <ul>
                        {Object.entries(bank).map(([letter, text]) => (
                            <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                        ))}
                    </ul>
                </div>
                <div className="summary-text" dangerouslySetInnerHTML={{ __html: safeHTML(section.summary_text || '') }} />
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block question-block-compact">
                            <span className="question-inline-id">({q.id})</span>
                            <select
                                className="match-select"
                                value={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                            >
                                <option value="">--</option>
                                {bankKeys.map(k => (
                                    <option key={k} value={k}>{k}. {bank[k]}</option>
                                ))}
                            </select>
                            {reviewMode && (
                                <span className={`review-verdict-inline ${verdict(q.id, q.answer, userAns).correct ? 'ok' : 'ng'}`}>
                                    {verdict(q.id, q.answer, userAns).msg}
                                </span>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    // ── Note Completion — structured note_content with (n) blanks, answered by text ──
    if (qt === 'note_completion') {
        return (
            <>
                {section.note_intro && <p className="section-instructions">{section.note_intro}</p>}
                {section.wordLimit && <p className="word-limit-hint">📏 {section.wordLimit}</p>}
                <pre className="note-content">{section.note_content}</pre>
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block question-block-compact">
                            <span className="question-inline-id">({q.id})</span>
                            <input
                                type="text"
                                className="text-answer-input"
                                value={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                                placeholder="…"
                            />
                            {reviewMode && (
                                <span className={`review-verdict-inline ${verdictArr(q.id, q.answers, userAns).correct ? 'ok' : 'ng'}`}>
                                    {verdictArr(q.id, q.answers, userAns).msg}
                                </span>
                            )}
                        </div>
                    );
                })}
            </>
        );
    }

    // ── Sentence Completion / Short Answer — text input per question ──
    if (qt === 'sentence_completion' || qt === 'short_answer') {
        return (
            <>
                {instructions && <p className="section-instructions">{instructions}</p>}
                {section.wordLimit && <p className="word-limit-hint">📏 {section.wordLimit}</p>}
                {section.questions.map(q => {
                    const userAns = getAnswer(q.id);
                    return (
                        <div key={q.id} className="question-block">
                            <div className="question-text" dangerouslySetInnerHTML={{ __html: safeHTML(`${q.id}. ${q.question || ''}`) }} />
                            <input
                                type="text"
                                className="text-answer-input"
                                value={userAns}
                                onChange={e => onAnswer(q.id, e.target.value)}
                                disabled={reviewMode}
                                placeholder="Type your answer…"
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

    return <div>Unsupported question type: {qt}</div>;
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
