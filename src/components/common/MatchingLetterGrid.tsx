/**
 * MatchingLetterGrid — classic IELTS-paper-style radio grid.
 *
 * Left column = question rows (e.g. "15. coffee room" or "Location 21").
 * Top row     = available letters (A-J typically).
 * Each cell   = radio button (one per row).
 *
 * Used for:
 *   - Listening Matching (share-a-bank across all questions)
 *   - Listening Map (Section 2 mixed + standalone map mode)
 *   - Reading matching_info / matching_features / matching_sentence
 *
 * NOT used for matching_headings (that's a drag-and-drop panel).
 */
import type { ReactNode } from 'react';
import '../../styles/matching_letter_grid.css';

export interface MatchingRow {
    id: number | string;
    label: ReactNode;
}

interface Props {
    rows: MatchingRow[];
    letters: string[];
    letterTitles?: Record<string, string>;
    // Whether to render an inline legend row under the header explaining what
    // each letter means. Off by default — most callers now display an external
    // "options bank" panel on the right side instead (per user layout rule:
    // matching-block on right, answer boxes on left). Only the standalone
    // listening map mode still uses the inline legend.
    showLegend?: boolean;
    getAnswer: (id: number | string) => string;
    onAnswer: (id: number | string, letter: string) => void;
    reviewMode?: boolean;
    correctById?: Record<string | number, string>;
}

export default function MatchingLetterGrid({
    rows,
    letters,
    letterTitles,
    showLegend = false,
    getAnswer,
    onAnswer,
    reviewMode = false,
    correctById,
}: Props) {
    const safeRows = Array.isArray(rows) ? rows : [];
    const safeLetters = Array.isArray(letters) ? letters.filter(Boolean) : [];
    if (safeRows.length === 0 || safeLetters.length === 0) return null;

    return (
        <div className="matching-grid-wrap">
            <table className="matching-grid" role="table">
                <thead>
                    <tr>
                        <th className="mg-corner" />
                        {safeLetters.map(letter => (
                            <th key={letter} className="mg-letter-head" scope="col" title={letterTitles?.[letter]}>
                                {letter}
                            </th>
                        ))}
                    </tr>
                    {showLegend && letterTitles && Object.keys(letterTitles).length > 0 && (
                        <tr className="mg-legend-row">
                            <td className="mg-corner" />
                            <td className="mg-legend-cell" colSpan={safeLetters.length}>
                                <div className="mg-legend-list">
                                    {safeLetters.map(letter => {
                                        const desc = letterTitles[letter];
                                        if (!desc) return null;
                                        return (
                                            <span key={letter} className="mg-legend-item">
                                                <strong>{letter}.</strong> {desc}
                                            </span>
                                        );
                                    })}
                                </div>
                            </td>
                        </tr>
                    )}
                </thead>
                <tbody>
                    {safeRows.map(row => {
                        const userAns = (getAnswer(row.id) || '').trim().toUpperCase();
                        const correct = reviewMode && correctById
                            ? String(correctById[row.id] ?? '').trim().toUpperCase()
                            : '';
                        const isCorrect = reviewMode && correct && userAns === correct;
                        const isWrong = reviewMode && userAns && correct && userAns !== correct;
                        return (
                            <tr key={row.id} className={`mg-row ${isWrong ? 'is-wrong' : ''} ${isCorrect ? 'is-correct' : ''}`} data-question-id={row.id}>
                                <th className="mg-row-label" scope="row">
                                    {row.label}
                                </th>
                                {safeLetters.map(letter => {
                                    const checked = userAns === letter.toUpperCase();
                                    const isCorrectCell = reviewMode && correct === letter.toUpperCase();
                                    const cls = [
                                        'mg-cell',
                                        checked ? 'is-checked' : '',
                                        reviewMode && checked && isCorrect ? 'is-cell-correct' : '',
                                        reviewMode && checked && isWrong ? 'is-cell-wrong' : '',
                                        reviewMode && !checked && isCorrectCell ? 'is-cell-answer' : '',
                                    ].filter(Boolean).join(' ');
                                    return (
                                        <td key={letter} className={cls}>
                                            <label className="mg-cell-label">
                                                <input
                                                    type="radio"
                                                    name={`mg-row-${row.id}`}
                                                    value={letter}
                                                    checked={checked}
                                                    onChange={() => onAnswer(row.id, letter)}
                                                    disabled={reviewMode}
                                                    aria-label={`${typeof row.label === 'string' ? row.label : `Row ${row.id}`}: ${letter}`}
                                                />
                                                <span className="mg-dot" aria-hidden="true" />
                                            </label>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
