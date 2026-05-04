import { useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { type LearningPlan } from '../../api/learning_plan';

const FSRS_STATE_LABEL: Record<number, string> = {
    0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning',
};
const FSRS_STATE_CLASS: Record<number, string> = {
    0: 'state-new', 1: 'state-learning', 2: 'state-review', 3: 'state-relearning',
};

function getPlanTodayTarget(plan: LearningPlan): number {
    return plan.daily_count || 20;
}

interface Props {
    plan: LearningPlan;
}

export default function TodayStudiedSection({ plan }: Props) {
    const { translations: t } = useLang();
    const [expanded, setExpanded] = useState(false);
    const todayTotal = getPlanTodayTarget(plan);
    const pct = todayTotal > 0
        ? Math.min(100, Math.round((plan.studied_today / todayTotal) * 100))
        : 0;

    return (
        <div className="lp-today-section">
            <div className="lp-today-header" onClick={() => setExpanded(v => !v)}>
                <div className="lp-today-title">
                    <span className="lp-today-icon">📋</span>
                    <span dangerouslySetInnerHTML={{ __html: t.vocab.details.todayTitle.replace('{studied}', String(plan.studied_today)).replace('{total}', String(todayTotal)) }} />
                    <span className="lp-today-pct">{pct}%</span>
                </div>
                <span className={`lp-today-toggle ${expanded ? 'open' : ''}`}>▾</span>
            </div>
            <div className="lp-today-progress">
                <div className="lp-today-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            {expanded && (
                <div className="lp-today-list">
                    {plan.today_words.map((tw, i) => (
                        <div key={i} className="lp-today-word-row">
                            <span className="lp-today-word">{tw.word}</span>
                            {tw.phonetic && (
                                <span className="lp-today-phonetic">{tw.phonetic}</span>
                            )}
                            <span className="lp-today-zh">{tw.zh}</span>
                            <span className={`lp-fsrs-badge ${FSRS_STATE_CLASS[tw.state] ?? 'state-new'}`}>
                                {FSRS_STATE_LABEL[tw.state] ?? 'New'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
