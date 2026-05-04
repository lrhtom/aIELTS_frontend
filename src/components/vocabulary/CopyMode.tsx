import { type VocabCard } from '../../api/vocab';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';
import { type CompletionDueHint, type CopyPendingAction } from '../../utils/vocab_flashcard_utils';

function speak(word: string) {
    speakWord(word);
}

interface Props {
    currentCard: VocabCard;
    currentCardIdx: number;
    statusCls: string;
    submitting: boolean;
    copyInput: string;
    copySubmitted: boolean;
    copyRepetitions: number;
    copyRemaining: number[];
    copyReviewDays: number;
    copyReviewDaysTemp: number[];
    copyWordHidden: boolean;
    copyWordVisible: boolean;
    isPeeking: boolean;
    copyPendingAction: CopyPendingAction | null;
    completionDueHint: CompletionDueHint | null;
    onCopyInput: (val: string) => void;
    onCopySubmit: () => void;
    onCopyNext: () => void;
    onCopyReviewDaysChange: (cardIdx: number, val: number) => void;
    onToggleHidden: () => void;
    onPeekStart: () => void;
    onPeekEnd: () => void;
    formatDueDate: (isoStr: string) => string;
}

export default function CopyMode({
    currentCard,
    currentCardIdx,
    statusCls,
    submitting,
    copyInput,
    copySubmitted,
    copyRepetitions,
    copyRemaining,
    copyWordHidden,
    copyWordVisible,
    isPeeking,
    copyPendingAction,
    completionDueHint,
    copyReviewDaysTemp,
    copyReviewDays,
    onCopyInput,
    onCopySubmit,
    onCopyNext,
    onCopyReviewDaysChange,
    onToggleHidden,
    onPeekStart,
    onPeekEnd,
    formatDueDate,
}: Props) {
    const { translations: t } = useLang();

    return (
        <>
            <div className="fc-scene" style={{ cursor: 'default', position: 'relative' }}>
                <div className={`fc-card ${statusCls}`} style={{ minHeight: 190 }}>
                    <div className="fc-face">
                        <button
                            className="fc-speak-btn"
                            onClick={(e) => { e.stopPropagation(); speak(currentCard.word); }}
                            title="朗读"
                            style={{
                                padding: '6px 12px',
                                fontSize: '16px',
                                backgroundColor: '#fff',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >🔊</button>
                        { (copyWordVisible || isPeeking) && <div className="fc-word">{currentCard.word}</div> }
                        { !(copyWordVisible || isPeeking) && <div className="fc-word" style={{ color: '#999', letterSpacing: '8px' }}>{'_'.repeat(currentCard.word.trim().length)}</div> }
                        {currentCard.phonetic && copyWordVisible && (
                            <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                {currentCard.phonetic}
                            </div>
                        )}
                        <div className="fc-copy-meaning">{currentCard.zh}</div>
                        <div className="fc-copy-remaining">
                            本词剩余抄写：{Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions)} / {copyRepetitions}
                        </div>
                        {completionDueHint && (
                            <div className="fc-completion-hint fc-completion-hint--in-card" role="status" aria-live="polite">
                                <span className="fc-completion-hint__label">下次学习</span>
                                <span className="fc-completion-hint__word">{completionDueHint.word}</span>
                                <span className="fc-completion-hint__date">{formatDueDate(completionDueHint.dueAt)}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
                    <button
                        className="fc-eye-btn"
                        onClick={onToggleHidden}
                        title={copyWordHidden ? "显示单词" : "隐藏单词"}
                        style={{
                            padding: '6px 14px',
                            fontSize: '14px',
                            backgroundColor: copyWordHidden ? '#f0f0f0' : '#fff',
                            border: '1px solid #ddd',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        {copyWordHidden ? '👁️‍🗨️ 显示' : '👁️ 隐藏'}
                    </button>
                    {!copyWordVisible && (
                        <button
                            onMouseDown={onPeekStart}
                            onMouseUp={onPeekEnd}
                            onMouseLeave={onPeekEnd}
                            onTouchStart={onPeekStart}
                            onTouchEnd={onPeekEnd}
                            title="按住偷看单词"
                            style={{
                                padding: '6px 14px',
                                fontSize: '14px',
                                backgroundColor: isPeeking ? '#e0f2fe' : '#fff',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                userSelect: 'none',
                                WebkitUserSelect: 'none'
                            }}
                        >
                            🫣 偷看
                        </button>
                    )}
                </div>
                {!copySubmitted && (
                    <div className="fc-copy-days-control" style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
                        <label style={{ minWidth: '110px', fontSize: '14px', fontWeight: '500', color: '#333' }}>多少天后学习：</label>
                        <input
                            type="number"
                            min="0"
                            max="365"
                            value={copyReviewDaysTemp[currentCardIdx] ?? copyReviewDays}
                            onChange={(e) => {
                                const val = Math.max(0, Math.min(365, parseInt(e.target.value) || 0));
                                onCopyReviewDaysChange(currentCardIdx, val);
                            }}
                            style={{
                                width: '70px',
                                padding: '6px 10px',
                                border: '1px solid #ccc',
                                borderRadius: '6px',
                                fontSize: '14px',
                                textAlign: 'center',
                            }}
                        />
                        <span style={{ color: '#999', fontSize: '14px' }}>天</span>
                    </div>
                )}
            </div>

            <div className="fc-write-area">
                <div className="fc-write-input-row">
                    <input
                        type="text"
                        className={`fc-write-input${copySubmitted ? ' write-correct' : ''}`}
                        placeholder={t.vocab.copyPlaceholder}
                        value={copyInput}
                        onChange={(e) => onCopyInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (!copySubmitted) {
                                    onCopySubmit();
                                } else {
                                    onCopyNext();
                                }
                            }
                        }}
                        autoComplete="new-password"
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                    />
                    <button
                        className="fc-write-submit"
                        onClick={onCopySubmit}
                        disabled={
                            copySubmitted
                            || submitting
                            || !copyInput.trim()
                            || copyInput.trim().toLowerCase() !== currentCard.word.trim().toLowerCase()
                        }
                    >
                        提交
                    </button>
                </div>

                {!copySubmitted && (
                    <div className="fc-copy-hint">
                        输入必须与单词完全一致，提交后需要手动点击"下一题"。中途退出时，未完成的本词抄写次数不会保留。
                    </div>
                )}

                {copySubmitted && (
                    <div className="fc-write-result correct">
                        <span>
                            {copyPendingAction?.completed
                                ? `✓ 本词已完成：下次学习日期 ${formatDueDate(copyPendingAction?.dueAt ?? '')}（在原间隔基础上 +${copyReviewDaysTemp[currentCardIdx] ?? copyReviewDays} 天）`
                                : `✓ 抄写成功，剩余 ${copyPendingAction?.remainingAfterSubmit ?? 0} 遍`}
                        </span>
                        <button
                            className="fc-write-next"
                            onClick={onCopyNext}
                            disabled={submitting}
                        >
                            {t.vocab.next} →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}
