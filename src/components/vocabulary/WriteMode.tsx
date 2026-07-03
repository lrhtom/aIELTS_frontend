import { type VocabCard } from '../../api/vocab';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';
import { type CompletionDueHint } from '../../utils/vocab_flashcard_utils';

function speak(word: string) {
    speakWord(word);
}

interface Props {
    currentCard: VocabCard;
    currentCardIdx: number;
    statusCls: string;
    submitting: boolean;
    writeInput: string;
    writeSubmitted: boolean;
    writeCorrect: boolean | null;
    unknownMode: boolean;
    sessionMastery: number[];
    completionDueHint: CompletionDueHint | null;
    onWriteInput: (val: string) => void;
    onWriteSubmit: () => void;
    onWriteNext: () => void;
    onQuickAssess: (correct: boolean) => void;
    onWriteUndo: () => void;
    formatDueDate: (isoStr: string) => string;
}

export default function WriteMode({
    currentCard,
    currentCardIdx,
    statusCls,
    submitting,
    writeInput,
    writeSubmitted,
    writeCorrect,
    unknownMode,
    sessionMastery,
    completionDueHint,
    onWriteInput,
    onWriteSubmit,
    onWriteNext,
    onQuickAssess,
    onWriteUndo,
    formatDueDate,
}: Props) {
    const { translations: t } = useLang();

    return (
        <>
            <div className="fc-scene" style={{ cursor: 'default' }}>
                <div className={`fc-card ${statusCls}`} style={{ minHeight: 160 }}>
                    <div className="fc-face">
                        <div className="fc-meaning" style={{ textAlign: 'center' }}>
                            {currentCard.zh}
                        </div>
                        {currentCard.grammar && (
                            <div className="fc-grammar" style={{ marginTop: 12 }}>
                                {currentCard.grammar}
                            </div>
                        )}
                        {!unknownMode && (sessionMastery[currentCardIdx] ?? 0) === 0 && (
                            <div className="fc-write-hint">
                                <span className="fc-write-copy-chars">
                                    {currentCard.word}
                                </span>
                                <span className="fc-write-hint-len" style={{ marginLeft: 8 }}>
                                    {t.vocab.charsCount.replace('{n}', currentCard.word.length.toString())}
                                </span>
                            </div>
                        )}
                        {!unknownMode && (sessionMastery[currentCardIdx] ?? 0) > 0 && (
                            <div className="fc-write-hint">
                                <span className="fc-write-hint-chars">
                                    {currentCard.word[0]}
                                    {'_'.repeat(currentCard.word.length - 1)}
                                </span>
                                <span className="fc-write-hint-len" style={{ marginLeft: 8 }}>
                                    {t.vocab.charsCount.replace('{n}', currentCard.word.length.toString())}
                                </span>
                            </div>
                        )}
                        {unknownMode && !writeSubmitted && (
                            <div className="fc-unknown-reveal">
                                <span className="fc-unknown-word">{currentCard.word}</span>
                                {currentCard.phonetic && (
                                    <span className="fc-phonetic" style={{ marginLeft: 10 }}>
                                        {currentCard.phonetic}
                                    </span>
                                )}
                                <button
                                    className="fc-speak-btn fc-speak-btn--inline"
                                    onClick={() => speak(currentCard.word)}
                                    title={t.vocab.common.speak}
                                >🔊</button>
                            </div>
                        )}
                        {completionDueHint && (
                            <div className="fc-completion-hint fc-completion-hint--in-card" role="status" aria-live="polite">
                                <span className="fc-completion-hint__label">{t.vocab.common.nextStudy}</span>
                                <span className="fc-completion-hint__word">{completionDueHint.word}</span>
                                <span className="fc-completion-hint__date">{formatDueDate(completionDueHint.dueAt)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="fc-write-area">
                <div className="fc-write-input-row">
                    <input
                        type="text"
                        className={`fc-write-input${
                            writeSubmitted
                                ? writeCorrect ? ' write-correct' : ' write-wrong'
                                : ''
                        }`}
                        placeholder={unknownMode ? t.vocab.copyPlaceholder : t.vocab.writePlaceholder}
                        value={writeInput}
                        onChange={e => onWriteInput(e.target.value)}
                        onKeyDown={e => {
                            if (!writeSubmitted && !unknownMode && !writeInput.trim() &&
                                (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                                e.preventDefault();
                                return;
                            }
                            if (e.key === 'Enter') {
                                if (!writeSubmitted) onWriteSubmit();
                                else onWriteNext();
                            }
                        }}
                        autoComplete="new-password"
                        readOnly={writeSubmitted}
                        autoFocus
                    />
                    <button
                        className="fc-write-submit"
                        onClick={onWriteSubmit}
                        disabled={writeSubmitted || !writeInput.trim() || submitting}
                    >
                        {t.vocab.submit} <span className="fc-qa-key">[{t.vocab.common.keyboard}↵]</span>
                    </button>
                    <button
                        className="fc-speak-btn fc-speak-btn--standalone"
                        onClick={() => speak(currentCard.word)}
                        title={t.vocab.common.speakWord}
                    >🔊</button>
                </div>
                {!writeSubmitted && !unknownMode && !writeInput.trim() && (
                    <div className="fc-quick-assess">
                        <button
                            className="fc-qa-btn fc-qa-unknown"
                            onClick={() => onQuickAssess(false)}
                            disabled={submitting}
                        >{t.vocab.dontKnow} <span className="fc-qa-key">[{t.vocab.common.keyboard}↓]</span></button>
                        <button
                            className="fc-qa-btn fc-qa-proficient"
                            onClick={() => onQuickAssess(true)}
                            disabled={submitting}
                        >{t.vocab.common.proficient} <span className="fc-qa-key">[{t.vocab.common.keyboard}↑]</span></button>
                    </div>
                )}
                {unknownMode && !writeSubmitted && (
                    <button className="fc-write-undo" onClick={onWriteUndo}>
                        ↩ {t.vocab.undo}
                    </button>
                )}
                {writeSubmitted && (
                    <div className={`fc-write-result ${writeCorrect ? 'correct' : 'wrong'}`}>
                        <span>
                            {unknownMode
                                ? `✓ ${t.vocab.copiedLabel}：${currentCard.word}`
                                : writeCorrect
                                    ? `✓ ${t.vocab.correctLabel}：${currentCard.word}`
                                    : `✗ ${t.vocab.wrongLabel}：${currentCard.word}`}
                        </span>
                        <button
                            className="fc-write-next"
                            onClick={onWriteNext}
                            disabled={submitting}
                        >
                            {t.vocab.next} → <span className="fc-qa-key">[键盘↵]</span>
                        </button>
                        <button
                            className="fc-write-undo"
                            onClick={onWriteUndo}
                            disabled={submitting}
                        >
                            ↩ {t.vocab.undo}
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
