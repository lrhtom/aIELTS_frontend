/**
 * ListeningQuestionRenderer — 渲染 5 种 v2 新题型 (form / table / flowchart / matching / short_answer).
 * 现有 4 种 (article / sentence / multiple_choice / map) 沿用 listening_page.tsx 内部现有渲染, 未走此组件.
 *
 * 数据模型: 每题的答案在外部 answersRef 中, 通过 getAnswer/onAnswer 读写.
 */
import type { ReactElement } from 'react';
import type {
    FormListeningData,
    TableListeningData,
    FlowchartListeningData,
    ShortAnswerListeningData,
    MatchingListeningData,
} from '../../store/listen_page_store';

/**
 * Coerce an AI bank field to a normalized Record<string, string> — same shape
 * defence as ReadingQuestionRenderer. AI sometimes emits [{key,text}] arrays
 * or {key: {text}} nested objects; rendering those directly crashes React.
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
 *  blanks replaced by inline <input> elements.
 * ---------------------------------------------------------------------*/
function renderStructuredWithBlanks(
    content: string,
    startingBlankId: number,
    getAnswer: (qid: number) => string,
    onAnswer: (qid: number, v: string) => void,
    disabled: boolean,
): ReactElement {
    // Split by "(N)" placeholders; render inputs in between
    const parts = content.split(/(\(\d+\)\s*_+)/g);
    return (
        <pre className="listening-structured">
            {parts.map((part, i) => {
                const m = /^\((\d+)\)\s*_+$/.exec(part);
                if (m) {
                    const qid = Number(m[1]) + (startingBlankId - 1);
                    return (
                        <span key={i} className="structured-blank-wrap">
                            <span className="structured-blank-num">({m[1]})</span>
                            <input
                                type="text"
                                className="structured-blank-input"
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
}

function verdictText(userAns: string, correctList: string[]): { ok: boolean; msg: string } {
    const userLc = userAns.trim().toLowerCase();
    const ok = Boolean(correctList.length && correctList.some(a => String(a).trim().toLowerCase() === userLc));
    return { ok, msg: ok ? '✅' : `❌ (${correctList.join(' / ')})` };
}

/* -----------------------------------------------------------------------
 *  Form completion
 * ---------------------------------------------------------------------*/
export function FormRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: FormListeningData | { form_intro?: string; form_content: string; questions: { id: number; answers?: string[]; explanation?: string }[] }; sectionOffset?: number } & CommonProps) {
    return (
        <div className="listening-form-block">
            {data.form_intro && <p className="section-instructions">{data.form_intro}</p>}
            {renderStructuredWithBlanks(data.form_content || '', sectionOffset + 1, getAnswer, onAnswer, reviewMode)}
            {reviewMode && (
                <div className="review-answer-list">
                    {data.questions.map(q => {
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
    return (
        <div className="listening-table-block">
            {data.table_intro && <p className="section-instructions">{data.table_intro}</p>}
            {renderStructuredWithBlanks(data.table_content || '', sectionOffset + 1, getAnswer, onAnswer, reviewMode)}
            {reviewMode && (
                <div className="review-answer-list">
                    {data.questions.map(q => {
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
    return (
        <div className="listening-flowchart-block">
            {data.flowchart_intro && <p className="section-instructions">{data.flowchart_intro}</p>}
            {renderStructuredWithBlanks(data.flowchart_content || '', sectionOffset + 1, getAnswer, onAnswer, reviewMode)}
            {reviewMode && (
                <div className="review-answer-list">
                    {data.questions.map(q => {
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
    return (
        <div className="listening-short-block">
            {data.short_intro && <p className="section-instructions">{data.short_intro}</p>}
            {data.questions.map(q => {
                const userAns = getAnswer(q.id);
                return (
                    <div key={q.id} className="question-block">
                        <div className="question-text">{q.id}. {q.question || ''}</div>
                        <input
                            type="text"
                            className="text-answer-input"
                            defaultValue={userAns}
                            onChange={e => onAnswer(q.id, e.target.value)}
                            disabled={reviewMode}
                            placeholder="Type your answer…"
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
    const bank = normalizeBank(data.options_bank);
    const bankKeys = Object.keys(bank);
    return (
        <div className="listening-matching-block">
            {data.matching_intro && <p className="section-instructions">{data.matching_intro}</p>}
            <div className="matching-features-bank">
                <strong>Options:</strong>
                <ul>
                    {Object.entries(bank).map(([letter, text]) => (
                        <li key={letter}><span className="hb-roman">{letter}.</span> {text}</li>
                    ))}
                </ul>
            </div>
            {data.questions.map(q => {
                const userAns = getAnswer(q.id);
                return (
                    <div key={q.id} className="question-block">
                        <div className="question-text">{q.id}. {q.question || ''}</div>
                        <select
                            className="match-select"
                            defaultValue={userAns}
                            onChange={e => onAnswer(q.id, e.target.value)}
                            disabled={reviewMode}
                        >
                            <option value="">--</option>
                            {bankKeys.map(k => (
                                <option key={k} value={k}>{k}</option>
                            ))}
                        </select>
                        {reviewMode && (
                            <div className={`review-verdict ${userAns.trim().toUpperCase() === q.answer ? 'ok' : 'ng'}`}>
                                {userAns.trim().toUpperCase() === q.answer ? '✅' : `❌ (${q.answer})`}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/* -----------------------------------------------------------------------
 *  Note completion (Section 4 style; same as form but different intro)
 * ---------------------------------------------------------------------*/
export function NoteRenderer({ data, getAnswer, onAnswer, reviewMode = false, sectionOffset = 0 }: { data: { note_intro?: string; note_content?: string; questions: { id: number; answers?: string[] }[] }; sectionOffset?: number } & CommonProps) {
    return (
        <div className="listening-note-block">
            {data.note_intro && <p className="section-instructions">{data.note_intro}</p>}
            {renderStructuredWithBlanks(data.note_content || '', sectionOffset + 1, getAnswer, onAnswer, reviewMode)}
            {reviewMode && (
                <div className="review-answer-list">
                    {data.questions.map(q => {
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
    let correct = 0;
    const total = questions.length;
    for (const q of questions) {
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
