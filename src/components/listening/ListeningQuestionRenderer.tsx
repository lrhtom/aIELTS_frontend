/**
 *  Clicking a filled slot with no heading selected takes it back to the pool, making it easy to change an answer
 * ListeningQuestionRenderer - renders the 5 new v2 question types (form / table / flowchart / matching / short_answer).
 *
 * The existing 4 (article / sentence / multiple_choice / map) keep the rendering inside listening_page.tsx and do not go through this component.
 */
import type { ReactElement } from 'react';
import type {
    FormListeningData,
    TableListeningData,
    FlowchartListeningData,
    ShortAnswerListeningData,
    MatchingListeningData,
} from '../../store/listen_page_store';
import MatchingLetterGrid from '../common/MatchingLetterGrid';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Coerce an AI bank field to a normalized Record<string, string> — same shape
 * defence as ReadingQuestionRenderer. AI sometimes emits [{key,text}] arrays
 * or {key: {text}} nested objects; rendering those directly crashes React.
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

interface CommonProps {
    getAnswer: (qid: number) => string;
    onAnswer: (qid: number, value: string) => void;
    reviewMode?: boolean;
}

/* -----------------------------------------------------------------------
 *  Helper: render structured text (form/table/flowchart) with (1)-(N)
 *  blanks replaced by inline <input> elements. Returns the rendered element
 *  plus the set of global qids that received an inline input, so callers can
 *  render fallback inputs for any question whose blank was dropped by AI drift.
 * ---------------------------------------------------------------------*/
function renderStructuredWithBlanks(
    content: string,
    startingBlankId: number,
    getAnswer: (qid: number) => string,
    onAnswer: (qid: number, v: string) => void,
    disabled: boolean,
): { element: ReactElement; renderedIds: Set<number> } {
    //Data model: each question's answer lives in the external answersRef, read and written through getAnswer/onAnswer.
    const parts = content.split(/(\(\d+\)\s*_+)/g);
    const renderedIds = new Set<number>();
    const element = (
        <pre className="rd-inline-blank-block">
            {parts.map((part, i) => {
                const m = /^\((\d+)\)\s*_+$/.exec(part);
                if (m) {
                    const qid = Number(m[1]) + (startingBlankId - 1);
                    renderedIds.add(qid);
                    return (
                        <span key={i} className="rd-blank-wrap" data-question-id={qid}>
                            <span className="rd-blank-num">({m[1]})</span>
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
 * Render fallback text inputs for any question whose blank was dropped from
 * the structured content (empty note_content, missing `(N) _____` marker,
 * off-by-N numbering). Without this, blanks that never make it into the pre
 * block silently disappear — the user sees notes but has no way to answer
 * those questions.
 */
function FallbackInputs({ questions, renderedIds, getAnswer, onAnswer, disabled, hasStructuredContent }: {
    questions: { id: number }[];
    renderedIds: Set<number>;
    getAnswer: (qid: number) => string;
    onAnswer: (qid: number, v: string) => void;
    disabled: boolean;
    hasStructuredContent: boolean;
}): ReactElement | null {
    const { t } = useLang();
    const missing = questions.filter(q => !renderedIds.has(q.id));
    if (missing.length === 0) return null;
    return (
        <div className="listening-fallback-inputs" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hasStructuredContent && (
                <p className="section-instructions" style={{ fontStyle: 'italic', opacity: 0.85 }}>
                    {t('components.questionRenderer.answerRemaining')}
                </p>
            )}
            {missing.map(q => (
                <div key={q.id} className="rd-blank-wrap" data-question-id={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="rd-blank-num">{q.id}.</span>
                    <input
                        type="text"
                        className="rd-blank-input"
                        defaultValue={getAnswer(q.id)}
                        onChange={e => onAnswer(q.id, e.target.value)}
                        disabled={disabled}
                        placeholder={t('components.questionRenderer.typeAnswer')}
                        style={{ flex: 1, maxWidth: 320 }}
                    />
                </div>
            ))}
        </div>
    );
}

function verdictText(userAns: string, correctList: unknown): { ok: boolean; msg: string } {
    const safeList: string[] = Array.isArray(correctList)
        ? correctList.map(a => (a == null ? '' : String(a)))
        : (correctList == null ? [] : [String(correctList)]);
    const userLc = userAns.trim().toLowerCase();
    const ok = safeList.some(a => a.trim().toLowerCase() === userLc);
    return { ok, msg: ok ? '✅' : `❌ (${safeList.join(' / ')})` };
}

/* -----------------------------------------------------------------------
 *  Form completion
 * ---------------------------------------------------------------------*/
export function FormRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: FormListeningData | { form_intro?: string; form_content: string; questions: { id: number; answers?: string[]; explanation?: string }[] }; sectionOffset?: number } & CommonProps) {
    if (!data) return null;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const formContent = data.form_content || '';
    const startId = questions[0]?.id ?? sectionOffset + 1;
    const { element, renderedIds } = renderStructuredWithBlanks(formContent, startId, getAnswer, onAnswer, reviewMode);
    return (
        <div className="listening-form-block">
            {data.form_intro && <p className="section-instructions">{data.form_intro}</p>}
            {formContent && element}
            <FallbackInputs questions={questions} renderedIds={renderedIds} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} hasStructuredContent={Boolean(formContent)} />
            {reviewMode && (
                <div className="review-answer-list">
                    {questions.map(q => {
                        const v = verdictText(getAnswer(q.id), q.answers || []);
                        return <div key={q.id} className={`review-verdict-row ${v.ok ? 'ok' : 'ng'}`}>{q.id}. {v.msg}</div>;
                    })}
                </div>
            )}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Table completion — same blank-substitution but content is a markdown table.
 *  For simplicity render it as-is inside <pre> with the same blank substitution.
 * ---------------------------------------------------------------------*/
export function TableRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: TableListeningData; sectionOffset?: number } & CommonProps) {
    if (!data) return null;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const tableContent = data.table_content || '';
    const startId = questions[0]?.id ?? sectionOffset + 1;
    const { element, renderedIds } = renderStructuredWithBlanks(tableContent, startId, getAnswer, onAnswer, reviewMode);
    return (
        <div className="listening-table-block">
            {data.table_intro && <p className="section-instructions">{data.table_intro}</p>}
            {tableContent && element}
            <FallbackInputs questions={questions} renderedIds={renderedIds} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} hasStructuredContent={Boolean(tableContent)} />
            {reviewMode && (
                <div className="review-answer-list">
                    {questions.map(q => {
                        const v = verdictText(getAnswer(q.id), q.answers || []);
                        return <div key={q.id} className={`review-verdict-row ${v.ok ? 'ok' : 'ng'}`}>{q.id}. {v.msg}</div>;
                    })}
                </div>
            )}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Flowchart completion
 * ---------------------------------------------------------------------*/
export function FlowchartRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: FlowchartListeningData; sectionOffset?: number } & CommonProps) {
    if (!data) return null;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const flowContent = data.flowchart_content || '';
    const startId = questions[0]?.id ?? sectionOffset + 1;
    const { element, renderedIds } = renderStructuredWithBlanks(flowContent, startId, getAnswer, onAnswer, reviewMode);
    return (
        <div className="listening-flowchart-block">
            {data.flowchart_intro && <p className="section-instructions">{data.flowchart_intro}</p>}
            {flowContent && element}
            <FallbackInputs questions={questions} renderedIds={renderedIds} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} hasStructuredContent={Boolean(flowContent)} />
            {reviewMode && (
                <div className="review-answer-list">
                    {questions.map(q => {
                        const v = verdictText(getAnswer(q.id), q.answers || []);
                        return <div key={q.id} className={`review-verdict-row ${v.ok ? 'ok' : 'ng'}`}>{q.id}. {v.msg}</div>;
                    })}
                </div>
            )}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Short-answer questions
 * ---------------------------------------------------------------------*/
export function ShortAnswerRenderer({ data, getAnswer, onAnswer, reviewMode = false }: { data: ShortAnswerListeningData } & CommonProps) {
    const { t } = useLang();
    if (!data) return null;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    return (
        <div className="listening-short-block">
            {data.short_intro && <p className="section-instructions">{data.short_intro}</p>}
            {questions.map(q => {
                const userAns = getAnswer(q.id);
                return (
                    <div key={q.id} className="question-block" data-question-id={q.id}>
                        <div className="question-text">{q.id}. {q.question || ''}</div>
                        <input
                            type="text"
                            className="text-answer-input"
                            defaultValue={userAns}
                            onChange={e => onAnswer(q.id, e.target.value)}
                            disabled={reviewMode}
                            placeholder={t('components.questionRenderer.typeAnswer')}
                        />
                        {reviewMode && (
                            <div className={`review-verdict ${verdictText(userAns, q.answers || []).ok ? 'ok' : 'ng'}`}>
                                {verdictText(userAns, q.answers || []).msg}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Matching — items → letter from a bank
 * ---------------------------------------------------------------------*/
export function MatchingRenderer({ data, getAnswer, onAnswer, reviewMode = false }: { data: MatchingListeningData } & CommonProps) {
    if (!data) return null;
    const bank = normalizeBank(data.options_bank);
    const bankKeys = Object.keys(bank);
    const questions = Array.isArray(data.questions) ? data.questions : [];
    // Shares the .rd-inline-blank-block / .rd-blank-* styling with reading's note_completion / summary_completion
    if (!bankKeys.some(k => bank[k] && bank[k].trim().length > 0)) {
        return (
            <div className="listening-matching-block">
                {data.matching_intro && <p className="section-instructions">{data.matching_intro}</p>}
                <FallbackInputs questions={questions} renderedIds={new Set()} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} hasStructuredContent={false} />
            </div>
        );
    }
    const rows = questions.map(q => ({
        id: q.id,
        label: <span>{q.id}. {q.question || ''}</span>,
    }));
    const correctById: Record<number, string> = {};
    for (const q of questions) correctById[q.id] = q.answer;
    return (
        <div className="listening-matching-block">
            {data.matching_intro && <p className="section-instructions">{data.matching_intro}</p>}
            {/* When the bank is missing, its keys are empty, or every value is empty (AI drift), the letter grid has no usable options - degrade to a text input so the question stays answerable */}
            <div className="matching-features-bank">
                <strong>Options:</strong>
                <ul>
                    {Object.entries(bank).map(([letter, text]) => (
                        <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                    ))}
                </ul>
            </div>
            <MatchingLetterGrid
                rows={rows}
                letters={bankKeys}
                letterTitles={bank}
                getAnswer={id => getAnswer(Number(id))}
                onAnswer={(id, letter) => onAnswer(Number(id), letter)}
                reviewMode={reviewMode}
                correctById={correctById}
            />
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Note completion (Section 4 style; same as form but different intro)
 * ---------------------------------------------------------------------*/
export function NoteRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: { note_intro?: string; note_content?: string; questions: { id: number; answers?: string[] }[] }; sectionOffset?: number } & CommonProps) {
    if (!data) return null;
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const noteContent = data.note_content || '';
    const startId = questions[0]?.id ?? sectionOffset + 1;
    const { element, renderedIds } = renderStructuredWithBlanks(noteContent, startId, getAnswer, onAnswer, reviewMode);
    return (
        <div className="listening-note-block">
            {data.note_intro && <p className="section-instructions">{data.note_intro}</p>}
            {noteContent && element}
            <FallbackInputs questions={questions} renderedIds={renderedIds} getAnswer={getAnswer} onAnswer={onAnswer} disabled={reviewMode} hasStructuredContent={Boolean(noteContent)} />
            {reviewMode && (
                <div className="review-answer-list">
                    {questions.map(q => {
                        const v = verdictText(getAnswer(q.id), q.answers || []);
                        return <div key={q.id} className={`review-verdict-row ${v.ok ? 'ok' : 'ng'}`}>{q.id}. {v.msg}</div>;
                    })}
                </div>
            )}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Scoring helper: works for all 5 v2 types
 * ---------------------------------------------------------------------*/
export function scoreListeningQuestions(
    questions: { id: number; answers?: string[]; answer?: string }[],
    getAnswer: (qid: number) => string,
): { correct: number; total: number } {
    const safeQs = Array.isArray(questions) ? questions : [];
    let correct = 0;
    const total = safeQs.length;
    for (const q of safeQs) {
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
