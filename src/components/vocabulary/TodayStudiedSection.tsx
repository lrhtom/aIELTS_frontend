import { useState } from 'react';
import { ClipboardList, ChevronDown } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import HighlightText from '../common/HighlightText';
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
    const { t } = useLang();
    const [expanded, setExpanded] = useState(false);
    const todayTotal = getPlanTodayTarget(plan);
    const pct = todayTotal > 0
        ? Math.min(100, Math.round((plan.studied_today / todayTotal) * 100))
        : 0;

    return (
        <div className="lp-today-section">
            <button
                type="button"
                className="lp-today-header"
                onClick={() => setExpanded(v => !v)}
                aria-expanded={expanded}
            >
                <div className="lp-today-title">
                    <span className="lp-today-icon"><ClipboardList size={16} /></span>
                    <HighlightText text={t('vocab.details.todayTitle')} studied={plan.studied_today} total={todayTotal} />
                    <span className="lp-today-pct">{pct}%</span>
                </div>
                <span className={`lp-today-toggle ${expanded ? 'open' : ''}`}>
                    <ChevronDown size={14} />
                </span>
            </button>
            <div
                className="lp-today-progress"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={t('vocab.common.todayStudiedProgressAria')}
            >
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
