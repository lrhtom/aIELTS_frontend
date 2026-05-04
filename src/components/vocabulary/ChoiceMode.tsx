import { type VocabCard } from '../../api/vocab';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';
import { type CompletionDueHint } from '../../utils/vocab_flashcard_utils';

interface Props {
    currentCard: VocabCard;
    statusCls: string;
    submitting: boolean;
    choices: Array<{ zh: string; correct: boolean }>;
    choiceSelected: number | null;
    choiceCorrect: boolean | null;
    choiceRevealed: boolean;
    completionDueHint: CompletionDueHint | null;
    onChoiceKnow: () => void;
    onChoiceUnknown: () => void;
    onChoice: (opt: { zh: string; correct: boolean }, idx: number) => void;
    onChoiceHideQuestion: () => void;
    onChoiceNext: () => void;
    formatDueDate: (isoStr: string) => string;
}

function speak(word: string) {
    speakWord(word);
}

export default function ChoiceMode({
    currentCard,
    statusCls,
    submitting,
    choices,
    choiceSelected,
    choiceCorrect,
    choiceRevealed,
    completionDueHint,
    onChoiceKnow,
    onChoiceUnknown,
    onChoice,
    onChoiceHideQuestion,
    onChoiceNext,
    formatDueDate,
}: Props) {
    const { translations: t } = useLang();

    return (
        <>
            <div className={`choice-quiz-card ${statusCls}`}>
                {/* Word hero area */}
                <div className="choice-word-hero">
                    <div className="choice-word-row">
                        <span className="choice-word-text">{currentCard.word}</span>
                        <button
                            className="choice-speak-btn"
                            onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                            title="朗读"
                            aria-label="朗读单词"
                        >
                            🎤
                        </button>
                    </div>
                    {currentCard.phonetic && (
                        <div className="choice-word-phonetic">{currentCard.phonetic}</div>
                    )}
                    <div className="choice-word-divider" />
                    {choiceSelected !== null && (
                        <div className="choice-word-meaning">
                            {currentCard.zh}
                        </div>
                    )}
                    {completionDueHint && (
                        <div className="fc-completion-hint fc-completion-hint--in-card" role="status" aria-live="polite">
                            <span className="fc-completion-hint__label">下次学习</span>
                            <span className="fc-completion-hint__word">{completionDueHint.word}</span>
                            <span className="fc-completion-hint__date">{formatDueDate(completionDueHint.dueAt)}</span>
                        </div>
                    )}
                </div>
            </div>

            {!choiceRevealed && (
                <div className="choice-reveal-actions">
                    <button
                        className="choice-btn-know"
                        onClick={onChoiceKnow}
                        disabled={submitting}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {t.vocab.know}
                    </button>
                    <button
                        className="choice-btn-unknown-big"
                        onClick={onChoiceUnknown}
                        disabled={submitting}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        {t.vocab.dontKnow}
                    </button>
                </div>
            )}

            {choiceRevealed && (
                <>
                    <div className="choice-options-grid">
                        {choices.map((opt, idx) => {
                            let cls = 'choice-option-card';
                            if (choiceSelected !== null) {
                                if (opt.correct)                 cls += ' is-correct';
                                else if (choiceSelected === idx)  cls += ' is-wrong';
                                else                             cls += ' is-dimmed';
                            }
                            return (
                                <button
                                    key={idx}
                                    className={cls}
                                    style={{ animationDelay: `${60 + idx * 60}ms` }}
                                    onClick={() => onChoice(opt, idx)}
                                    disabled={choiceSelected !== null || submitting}
                                >
                                    <span className="choice-option-label">{['A','B','C','D'][idx]}</span>
                                    <span className="choice-option-text">{opt.zh}</span>
                                    {choiceSelected !== null && opt.correct && (
                                        <span className="choice-option-icon-correct">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </span>
                                    )}
                                    {choiceSelected === idx && !opt.correct && (
                                        <span className="choice-option-icon-wrong">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <div className={`choice-feedback-bar${choiceSelected !== null ? ' is-visible' : ''}`}>
                        {choiceSelected === null && (
                            <div className="choice-feedback-actions">
                                <button
                                    className="choice-btn-hide"
                                    onClick={onChoiceHideQuestion}
                                    disabled={submitting}
                                >
                                    {t.vocab.hide}
                                </button>
                                <button
                                    className="choice-btn-unknown-sm"
                                    onClick={onChoiceUnknown}
                                    disabled={submitting}
                                >
                                    {t.vocab.dontKnow}
                                </button>
                            </div>
                        )}
                        {choiceSelected !== null && (
                            <div className="choice-feedback-result">
                                <span className={`choice-feedback-tag ${choiceCorrect ? 'is-correct' : 'is-wrong'}`}>
                                    {choiceCorrect ? '✅ 回答正确' : '❌ 回答错误'}
                                </span>
                                <button
                                    className="choice-btn-next"
                                    onClick={onChoiceNext}
                                    disabled={submitting}
                                >
                                    {t.vocab.next} →
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
