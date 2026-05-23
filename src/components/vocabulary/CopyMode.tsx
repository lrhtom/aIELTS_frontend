import { useState, useEffect, useRef, useCallback } from 'react';
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

    // ── 闪烁模式状态 ──
    const [blinkEnabled, setBlinkEnabled] = useState(() => {
        try {
            return localStorage.getItem('vocab_copy_blink_enabled') === 'true';
        } catch { return false; }
    });
    const [blinkHideSeconds, setBlinkHideSeconds] = useState(() => {
        try {
            const v = Number(localStorage.getItem('vocab_copy_blink_hide_secs'));
            return v > 0 ? v : 3;
        } catch { return 3; }
    });
    const [blinkShowSeconds, setBlinkShowSeconds] = useState(() => {
        try {
            const v = Number(localStorage.getItem('vocab_copy_blink_show_secs'));
            return v > 0 ? v : 1;
        } catch { return 1; }
    });
    const [blinkFlashing, setBlinkFlashing] = useState(false); // 当前是否处于闪烁显示阶段
    const [showBlinkConfig, setShowBlinkConfig] = useState(false);

    // 持久化闪烁设置
    useEffect(() => {
        try {
            localStorage.setItem('vocab_copy_blink_enabled', String(blinkEnabled));
            localStorage.setItem('vocab_copy_blink_hide_secs', String(blinkHideSeconds));
            localStorage.setItem('vocab_copy_blink_show_secs', String(blinkShowSeconds));
        } catch { /* ignore */ }
    }, [blinkEnabled, blinkHideSeconds, blinkShowSeconds]);

    // 计算当前输入的有效抄写次数
    const requiredCount = Math.max(0, copyRemaining[currentCardIdx] ?? copyRepetitions);
    const typedWordsList = copyInput.split(/[\s,，\n]+/).map(w => w.trim().toLowerCase()).filter(w => w !== '');
    const validCount = typedWordsList.filter(w => w === currentCard.word.trim().toLowerCase()).length;
    const isCountMet = validCount >= requiredCount;
    const inputMatchesWord = isCountMet;

    const [selectionStart, setSelectionStart] = useState(copyInput.length);
    useEffect(() => {
        if (copyInput.length === 0) {
            setSelectionStart(0);
        }
    }, [copyInput]);

    const inputRef = useRef<HTMLTextAreaElement>(null);

    // ── 闪烁定时器 ──
    const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearBlinkTimer = useCallback(() => {
        if (blinkTimerRef.current !== null) {
            clearTimeout(blinkTimerRef.current);
            blinkTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        // 不启用闪烁 → 清理
        if (!blinkEnabled) {
            clearBlinkTimer();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setBlinkFlashing(false);
            return;
        }

        // 循环：隐藏 blinkHideSeconds → 显示 blinkShowSeconds → 重复
        let cancelled = false;

        const scheduleHide = () => {
            if (cancelled) return;
            setBlinkFlashing(false);
            blinkTimerRef.current = setTimeout(() => {
                if (cancelled) return;
                scheduleShow();
            }, blinkHideSeconds * 1000);
        };

        const scheduleShow = () => {
            if (cancelled) return;
            setBlinkFlashing(true);
            blinkTimerRef.current = setTimeout(() => {
                if (cancelled) return;
                scheduleHide();
            }, blinkShowSeconds * 1000);
        };

        // 开始：从隐藏阶段开始
        scheduleHide();

        return () => {
            cancelled = true;
            clearBlinkTimer();
        };
    }, [blinkEnabled, blinkHideSeconds, blinkShowSeconds, currentCardIdx, clearBlinkTimer]);

    // ── 综合判断单词是否应显示 ──
    // 优先级：提交后 > 用户主动显示模式 > 偷看 > 输入正确 > 闪烁显示
    const shouldShowWord = (() => {
        // 1. 已提交 → 始终显示
        if (copySubmitted) return true;
        // 2. 用户主动选择了"显示模式"（未隐藏） → 始终显示
        if (copyWordVisible) return true;
        // 3. 偷看中 → 显示
        if (isPeeking) return true;
        // 4. 用户输入已完全匹配 → 显示
        if (inputMatchesWord && copyInput.trim().length > 0) return true;
        // 5. 闪烁模式开启且处于闪烁显示阶段 → 显示
        if (blinkEnabled && blinkFlashing) return true;
        // 6. 其余情况 → 隐藏
        return false;
    })();

    return (
        <>
            <style>{`
                @keyframes cursor-blink {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .copy-fake-cursor {
                    display: inline-block;
                    width: 2px;
                    height: 1.2em;
                    background-color: var(--color-text);
                    animation: cursor-blink 1s step-end infinite;
                    vertical-align: text-bottom;
                    margin-left: -1px;
                    margin-right: -1px;
                }
            `}</style>
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
                        { shouldShowWord && <div className="fc-word" style={blinkEnabled && blinkFlashing && !copyWordVisible && !isPeeking && !copySubmitted && !(inputMatchesWord && copyInput.trim().length > 0) ? { animation: 'blink-flash 0.3s ease-in-out' } : undefined}>{currentCard.word}</div> }
                        { !shouldShowWord && <div className="fc-word" style={{ color: '#999', letterSpacing: '8px' }}>{'_'.repeat(currentCard.word.trim().length)}</div> }
                        {currentCard.phonetic && shouldShowWord && (
                            <div className="fc-phonetic" style={{ marginTop: 6 }}>
                                {currentCard.phonetic}
                            </div>
                        )}
                        <div className="fc-copy-meaning">{currentCard.zh}</div>
                        <div className="fc-copy-remaining">
                            本词需抄写次数：{requiredCount}
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
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
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
                            onMouseEnter={onPeekStart}
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
                    <button
                        onClick={() => {
                            const next = !blinkEnabled;
                            setBlinkEnabled(next);
                            if (!next) setShowBlinkConfig(false);
                        }}
                        title={blinkEnabled ? '关闭闪烁模式' : '开启闪烁模式：单词默认隐藏，定时短暂显示'}
                        style={{
                            padding: '6px 14px',
                            fontSize: '14px',
                            backgroundColor: blinkEnabled ? '#fef3c7' : '#fff',
                            border: `1px solid ${blinkEnabled ? '#f59e0b' : '#ddd'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: blinkEnabled ? '#92400e' : undefined,
                            fontWeight: blinkEnabled ? 500 : undefined,
                        }}
                    >
                        {blinkEnabled ? '⚡ 闪烁开' : '⚡ 闪烁'}
                    </button>
                    {blinkEnabled && (
                        <button
                            onClick={() => setShowBlinkConfig(c => !c)}
                            title="闪烁参数设置"
                            style={{
                                padding: '6px 10px',
                                fontSize: '14px',
                                backgroundColor: showBlinkConfig ? '#e0f2fe' : '#fff',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            ⚙️
                        </button>
                    )}
                </div>
                {/* 闪烁参数面板 */}
                {blinkEnabled && showBlinkConfig && (
                    <div style={{
                        marginTop: '10px',
                        padding: '12px 16px',
                        backgroundColor: '#fffbeb',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        fontSize: '13px',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ minWidth: '90px', fontWeight: 500, color: '#92400e' }}>隐藏间隔：</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={blinkHideSeconds}
                                onChange={(e) => {
                                    const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                                    setBlinkHideSeconds(v);
                                }}
                                style={{
                                    width: '60px',
                                    padding: '4px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                }}
                            />
                            <span style={{ color: '#78716c' }}>秒</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ minWidth: '90px', fontWeight: 500, color: '#92400e' }}>显示时长：</label>
                            <input
                                type="number"
                                min="0.5"
                                max="30"
                                step="0.5"
                                value={blinkShowSeconds}
                                onChange={(e) => {
                                    const v = Math.max(0.5, Math.min(30, parseFloat(e.target.value) || 0.5));
                                    setBlinkShowSeconds(v);
                                }}
                                style={{
                                    width: '60px',
                                    padding: '4px 8px',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    textAlign: 'center',
                                    fontSize: '13px',
                                }}
                            />
                            <span style={{ color: '#78716c' }}>秒</span>
                        </div>
                        <div style={{ color: '#a8a29e', fontSize: '12px', marginTop: '2px' }}>
                            💡 单词默认隐藏，每隔 {blinkHideSeconds} 秒显示 {blinkShowSeconds} 秒。输入正确、开启显示或偷看时优先显示。
                        </div>
                    </div>
                )}
                {/* 闪烁模式指示器 */}
                {blinkEnabled && !showBlinkConfig && (
                    <div style={{
                        marginTop: '6px',
                        textAlign: 'center',
                        fontSize: '12px',
                        color: blinkFlashing ? '#f59e0b' : '#a8a29e',
                        transition: 'color 0.3s',
                    }}>
                        {blinkFlashing ? '⚡ 闪烁显示中…' : `⏳ ${blinkHideSeconds}s 后闪烁`}
                    </div>
                )}
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
                <div className="fc-write-input-row" style={{ alignItems: 'flex-start' }}>
                    <div
                        onClick={() => inputRef.current?.focus()}
                        className={`fc-write-input${copySubmitted ? ' write-correct' : ''}`}
                        style={{
                            position: 'relative',
                            flex: 1,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '12px 16px',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '120px',
                            cursor: 'text',
                            fontFamily: 'inherit',
                            padding: '16px',
                        }}
                    >

                        {(() => {
                            const targetWords: string[] = Array(requiredCount).fill(currentCard.word);
                            const typedWords = copyInput.split(' ');
                            const maxWords = Math.max(targetWords.length, typedWords.length);

                            const prefix = copyInput.slice(0, selectionStart);
                            const prefixWords = prefix.split(' ');
                            const cursorWordIndex = prefixWords.length - 1;
                            const cursorCharIndex = prefixWords[prefixWords.length - 1].length;

                            const wordsNodes: React.ReactNode[] = [];

                            for (let i = 0; i < maxWords; i++) {
                                const targetWord = targetWords[i];
                                const typedWord = typedWords[i];
                                const isCursorHere = !copySubmitted && i === cursorWordIndex;

                                const charNodes: React.ReactNode[] = [];

                                const iterateLen = Math.max(
                                    targetWord?.length || 0,
                                    typedWord?.length || 0,
                                    isCursorHere ? cursorCharIndex : 0,
                                );

                                for (let j = 0; j <= iterateLen; j++) {
                                    if (isCursorHere && j === cursorCharIndex) {
                                        charNodes.push(<span key={`cursor-${j}`} className="copy-fake-cursor" />);
                                    }

                                    if (j === iterateLen) break;

                                    const charTarget = targetWord?.[j];
                                    const charTyped = typedWord?.[j];

                                    if (charTyped === undefined) {
                                        charNodes.push(<span key={`c-${j}`} style={{ color: '#cbd5e1' }}>{charTarget}</span>);
                                    } else if (charTarget === undefined) {
                                        charNodes.push(<span key={`c-${j}`} style={{ color: '#ef4444', backgroundColor: '#fee2e2', borderRadius: 2 }}>{charTyped}</span>);
                                    } else if (charTyped.toLowerCase() === charTarget.toLowerCase()) {
                                        charNodes.push(<span key={`c-${j}`} style={{ color: '#10b981' }}>{charTyped}</span>);
                                    } else {
                                        charNodes.push(<span key={`c-${j}`} style={{ color: '#ef4444', backgroundColor: '#fee2e2', borderRadius: 2 }}>{charTyped}</span>);
                                    }
                                }

                                wordsNodes.push(
                                    <div key={`word-${i}`} style={{ display: 'flex', alignItems: 'center', whiteSpace: 'pre' }}>
                                        {charNodes}
                                    </div>
                                );
                            }
                            return wordsNodes;
                        })()}

                        <textarea
                            ref={inputRef}
                            value={copyInput}
                            onChange={(e) => {
                                let val = e.target.value;
                                // 阻止用户手动输入空格 — 空格由自动补全逻辑管理
                                if (val.length > copyInput.length) {
                                    const added = val.slice(copyInput.length);
                                    if (added === ' ') return; // 忽略手动空格
                                }
                                // 自动补空格：当最后一个词完整匹配目标词时
                                if (val.length > copyInput.length) {
                                    const currentWords = val.split(' ').filter(w => w !== '');
                                    const lastWord = currentWords[currentWords.length - 1];
                                    if (
                                        lastWord &&
                                        lastWord.trim().toLowerCase() === currentCard.word.trim().toLowerCase() &&
                                        currentWords.length <= requiredCount
                                    ) {
                                        val += ' ';
                                    }
                                }
                                onCopyInput(val);
                                // 延迟更新光标位置
                                requestAnimationFrame(() => {
                                    setSelectionStart(inputRef.current?.selectionStart ?? val.length);
                                });
                            }}
                            onSelect={(e) => {
                                setSelectionStart((e.target as HTMLTextAreaElement).selectionStart || 0);
                            }}
                            onKeyDown={(e) => {
                                // 阻止空格键
                                if (e.key === ' ') {
                                    e.preventDefault();
                                    return;
                                }
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (!copySubmitted) {
                                        if (isCountMet && !submitting) onCopySubmit();
                                    } else {
                                        onCopyNext();
                                    }
                                }
                            }}
                            autoFocus
                            style={{
                                position: 'absolute',
                                opacity: 0,
                                width: 1,
                                height: 1,
                                pointerEvents: 'none',
                                overflow: 'hidden',
                            }}
                        />
                    </div>
                    <button
                        className="fc-write-submit"
                        onClick={onCopySubmit}
                        disabled={
                            copySubmitted
                            || submitting
                            || !copyInput.trim()
                            || !isCountMet
                        }
                    >
                        提交
                    </button>
                </div>

                {!copySubmitted && (
                    <div className="fc-copy-hint" style={{ marginTop: 8 }}>
                        <div style={{ fontWeight: 500, color: isCountMet ? '#059669' : '#d97706', marginBottom: 4 }}>实时进度：{validCount} / {requiredCount}</div>
                        输入必须与单词完全一致，打完一个会自动加空格。达到目标次数后按回车提交。
                    </div>
                )}

                {copySubmitted && (
                    <div className="fc-write-result correct">
                        <span>
                            {copyPendingAction?.completed
                                ? `✓ 本词已完成：下次学习日期 ${formatDueDate(copyPendingAction?.dueAt ?? '')}（在原间隔基础上 +${copyReviewDaysTemp[currentCardIdx] ?? copyReviewDays} 天）`
                                : `✓ 抄写成功`}
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

