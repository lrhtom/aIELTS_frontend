import { Volume2 } from 'lucide-react';
import { type VocabCard } from '../../api/vocab';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';

interface Props {
    currentCard: VocabCard;
    isFlipped: boolean;
    isFlipping: boolean;
    statusCls: string;
    submitting: boolean;
    onFlip: () => void;
    onRating: (rating: number) => void;
    estimateInterval: (card: VocabCard, rating: number) => string;
    /** Returns the formatted absolute date (e.g. "06-25" / "今天") the card will next surface at after this rating. */
    previewNextDueLabel?: (card: VocabCard, rating: number) => string;
    simpleMode?: boolean;
}

function speak(word: string) {
    speakWord(word);
}

export default function FlashcardMode({
    currentCard,
    isFlipped,
    isFlipping,
    statusCls,
    submitting,
    onFlip,
    onRating,
    estimateInterval,
    previewNextDueLabel,
    simpleMode,
}: Props) {
    const { translations: t } = useLang();

    const RATING_INFO = [
        { id: 1, label: t.vocab.ratings.again, cls: 'btn-again', key: '1' },
        { id: 2, label: t.vocab.ratings.hard,  cls: 'btn-hard',  key: '2' },
        { id: 3, label: t.vocab.ratings.good,  cls: 'btn-good',  key: '3' },
        { id: 4, label: t.vocab.ratings.easy,  cls: 'btn-easy',  key: '4' },
    ];

    const STATE_LABELS: Record<number, string> = {
        0: t.vocab.status.new,
        1: t.vocab.status.learning,
        2: t.vocab.status.review,
        3: t.vocab.status.relearn,
    };

    return (
        <>
            <div
                className="fc-scene"
                onClick={!simpleMode ? onFlip : undefined}
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                    if (e.code === 'Space') { e.preventDefault(); onFlip(); }
                }}
                aria-label={isFlipped ? '点击翻回正面' : '点击翻转查看释义'}
            >
                <div
                    className={`fc-card ${isFlipped && !simpleMode ? 'is-flipped' : ''} ${isFlipping ? 'is-flipping' : ''} ${statusCls}`}
                >
                    <div className="fc-face">
                        <button
                            type="button"
                            className="fc-speak-btn"
                            onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                            aria-label="朗读发音"
                        ><Volume2 size={18} /></button>
                        <div className="fc-word">{currentCard.word}</div>
                        {currentCard.phonetic && (
                            <div className="fc-phonetic fc-phonetic-front">
                                {currentCard.phonetic}
                            </div>
                        )}
                        {currentCard.reps > 0 && (
                            <div className="fc-reps-badge">
                                {t.vocab.repsDone.replace('{n}', currentCard.reps.toString())}
                                {currentCard.lapses > 0 && ` · ${t.vocab.lapsesCount.replace('{n}', currentCard.lapses.toString())}`}
                            </div>
                        )}
                        {simpleMode && (
                            <div className="fc-flashcard-meaning" style={{ marginTop: '30px', fontSize: '1.2rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                                {currentCard.zh}
                            </div>
                        )}
                        <div className="fc-tap-hint">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M12 5v14M5 12l7 7 7-7" />
                            </svg>
                            {t.vocab.tapToFlip}
                        </div>
                    </div>

                    <div className="fc-face fc-face--back">
                        <div className="fc-back-word">
                            {currentCard.word}
                            <button
                                type="button"
                                className="fc-speak-btn fc-speak-btn--inline"
                                onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                                aria-label="朗读发音"
                            ><Volume2 size={18} /></button>
                        </div>
                        {currentCard.phonetic && (
                            <div className="fc-phonetic">{currentCard.phonetic}</div>
                        )}
                        <div className="fc-meaning">{currentCard.zh}</div>
                        {currentCard.grammar && (
                            <div className="fc-grammar">{currentCard.grammar}</div>
                        )}
                        {currentCard.definitions && currentCard.definitions.length > 0 && (
                            <div className="fc-definitions">
                                {currentCard.definitions.map((d, i) => (
                                    <div key={i} className="fc-def-item">
                                        {d.pos && <span className="fc-def-pos">{d.pos}</span>}
                                        <span className="fc-def-meaning">{d.meaning}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {currentCard.examples && currentCard.examples.length > 0 && (
                            <div className="fc-examples">
                                {currentCard.examples.map((ex, i) => (
                                    <div key={i} className="fc-example-item">
                                        <div className="fc-example-en">{ex.en}</div>
                                        {ex.zh && <div className="fc-example-zh">{ex.zh}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="fc-state-label">
                            {STATE_LABELS[currentCard.state]}
                            {currentCard.stability > 0 && ` · ${t.vocab.stability} ${currentCard.stability.toFixed(1)}`}
                        </div>
                    </div>
                </div>
            </div>

            <div className={`fc-rating-row${!isFlipped && !simpleMode ? ' locked' : ''}`}>
                {RATING_INFO.map(info => (
                    <button
                        key={info.id}
                        type="button"
                        className={`fc-btn ${info.cls}`}
                        onClick={() => onRating(info.id)}
                        disabled={(!isFlipped && !simpleMode) || submitting}
                    >
                        <span className="btn-label">{info.label}</span>
                        <span className="btn-key">[{info.key}]</span>
                        <span className="btn-interval">{estimateInterval(currentCard, info.id)}</span>
                        {previewNextDueLabel && (
                            <span className="btn-due-date">{previewNextDueLabel(currentCard, info.id)}</span>
                        )}
                    </button>
                ))}
            </div>
            <div className="fc-kb-hint">
                {t.vocab.ratingHint}
            </div>
        </>
    );
}
