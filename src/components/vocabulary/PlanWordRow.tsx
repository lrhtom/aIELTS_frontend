import { useState, useEffect, useMemo } from 'react';
import { Volume2, X } from 'lucide-react';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';
import { type PlanEntry } from '../../api/learning_plan';

const FSRS_STATE_LABEL: Record<number, string> = {
    0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning',
};
const FSRS_STATE_CLASS: Record<number, string> = {
    0: 'state-new', 1: 'state-learning', 2: 'state-review', 3: 'state-relearning',
};

function computeRemainingDays(fsrsDue?: string | null): number {
    if (!fsrsDue) return 0;
    const due = new Date(fsrsDue);
    if (Number.isNaN(due.getTime())) return 0;
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / 86400000));
}

function computeLocalDueDate(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDueDateFromSync(fsrsDue?: string | null): string {
    if (!fsrsDue) return '(--)';
    const d = new Date(fsrsDue);
    if (Number.isNaN(d.getTime())) return '(--)';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
    entry: PlanEntry;
    onZhChange: (entry: PlanEntry, zh: string) => void;
    onDueDays: (entry: PlanEntry, days: number) => void;
    onRemove: (entry: PlanEntry) => void;
}

export default function PlanWordRow({ entry, onZhChange, onDueDays, onRemove }: Props) {
    const { translations: t } = useLang();
    const [zh, setZh] = useState(entry.zh);
    const remainingDays = computeRemainingDays(entry.fsrs_due);
    const [days, setDays] = useState(remainingDays);
    const [showExamples, setShowExamples] = useState(false);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setZh(entry.zh); }, [entry.zh]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { setDays(computeRemainingDays(entry.fsrs_due)); }, [entry.fsrs_due]);

    const displayDueDate = useMemo(() => {
        if (days !== remainingDays) {
            return computeLocalDueDate(days);
        }
        return formatDueDateFromSync(entry.fsrs_due);
    }, [days, remainingDays, entry.fsrs_due]);

    const hasEnrichment = entry.grammar || entry.definitions.length > 0 || entry.examples.length > 0;

    return (
        <div className="lp-word-item">
            <div className="lp-word-row1">
                <div className="lp-word-text lp-word-text-inner">
                    <span>{entry.word}</span>
                    <button
                        type="button"
                        className="lp-speak-btn"
                        onClick={() => { speakWord(entry.word); }}
                        aria-label="朗读发音"
                    >
                        <Volume2 size={16} />
                    </button>
                    {entry.phonetic && (
                        <span className="lp-word-phonetic">{entry.phonetic}</span>
                    )}
                </div>
                <input
                    className="lp-zh-input"
                    value={zh}
                    onChange={e => setZh(e.target.value)}
                    onBlur={() => onZhChange(entry, zh)}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                    placeholder={t.vocab.details.manualZh}
                />
            </div>

            <div className="lp-word-row2">
                <span className={`lp-fsrs-badge ${FSRS_STATE_CLASS[entry.fsrs_state] ?? 'state-new'}`}>
                    {FSRS_STATE_LABEL[entry.fsrs_state] ?? 'New'}
                </span>

                <div className="lp-word-actions">
                    <div className="lp-due-wrap">
                        <input
                            className="lp-due-input"
                            type="number"
                            min={0}
                            value={days}
                            onChange={e => setDays(Number(e.target.value))}
                            onBlur={() => onDueDays(entry, days)}
                            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                            title="设置几天后复习"
                        />
                        {t.vocab.intervals.daysUnit}
                        <span className="lp-due-date" title="下次学习日期">
                            {displayDueDate}
                        </span>
                    </div>

                    <button
                        type="button"
                        className="lp-del-btn"
                        onClick={() => onRemove(entry)}
                        aria-label="删除单词"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {hasEnrichment && (
                <div className="lp-word-extra">
                    {entry.grammar && (
                        <span className="lp-grammar-badge">{entry.grammar}</span>
                    )}
                    {entry.definitions.length > 0 && (
                        <div className="lp-def-list">
                            {entry.definitions.map((d, i) => (
                                <div key={i} className="lp-def-item">
                                    {d.pos && <span className="lp-def-pos">{d.pos}</span>}
                                    <span>{d.meaning}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {entry.examples.length > 0 && (
                        <button
                            type="button"
                            className="lp-example-toggle"
                            onClick={() => setShowExamples(v => !v)}
                        >
                            {showExamples ? t.vocab.details.btnCollapseEx : t.vocab.details.btnExpandEx.replace('{n}', String(entry.examples.length))}
                        </button>
                    )}
                </div>
            )}
            {showExamples && entry.examples.length > 0 && (
                <div className="lp-example-list">
                    {entry.examples.map((ex, i) => (
                        <div key={i}>
                            <div className="lp-example-en">{ex.en}</div>
                            {ex.zh && <div className="lp-example-zh">{ex.zh}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
