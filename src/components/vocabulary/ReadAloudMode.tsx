import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, Mic, MicOff, Check, Loader2 } from 'lucide-react';
import { type VocabCard } from '../../api/vocab';
import { speakWord } from '../../utils/speak';
import { useLang } from '../../i18n/LanguageContext';
import {
    isSpeechRecognitionSupported,
    startRecognition,
    matchesEnWord,
    matchesZhMeaning,
    type RecognitionHandle,
} from '../../utils/speech_recognition';

interface Props {
    currentCard: VocabCard;
    statusCls: string;
    submitting: boolean;
    onRating: (rating: number) => void;
    estimateInterval: (card: VocabCard, rating: number) => string;
    previewNextDueLabel?: (card: VocabCard, rating: number) => string;
}

type Stage = 'en' | 'zh' | 'done';
type StatusKey = 'new' | 'learning' | 'review' | 'relearn';

const STATE_LABELS_KEY: Record<number, StatusKey> = {
    0: 'new', 1: 'learning', 2: 'review', 3: 'relearn',
};

export default function ReadAloudMode({
    currentCard,
    statusCls,
    submitting,
    onRating,
    estimateInterval,
    previewNextDueLabel,
}: Props) {
    const { t } = useLang();

    const supported = isSpeechRecognitionSupported();
    const [stage, setStage] = useState<Stage>('en');
    const [enPassed, setEnPassed] = useState(false);
    const [zhPassed, setZhPassed] = useState(false);
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [manualOverride, setManualOverride] = useState(false);
    const [micError, setMicError] = useState<string | null>(null);

    const handleRef = useRef<RecognitionHandle | null>(null);
    const stageRef = useRef<Stage>('en');
    stageRef.current = stage;

    const stopRecognition = useCallback(() => {
        if (handleRef.current) {
            handleRef.current.abort();
            handleRef.current = null;
        }
        setListening(false);
    }, []);

    const startForStage = useCallback((forStage: Stage, word: string, zh: string) => {
        stopRecognition();
        if (!supported || forStage === 'done') return;

        setTranscript('');
        setMicError(null);

        const lang = forStage === 'en' ? 'en-US' : 'zh-CN';
        const handle = startRecognition({
            lang,
            onInterim: (text) => setTranscript(text),
            onFinal: (text) => {
                setTranscript(text);
                if (stageRef.current === 'en' && matchesEnWord(text, word)) {
                    setEnPassed(true);
                    stageRef.current = 'zh';
                    setStage('zh');
                    setTranscript('');
                    // max_completion_tokens, so entering one just works with no extra setup - see _is_reasoning_model in api/core/ai_client.py
                    setTimeout(() => startForStage('zh', word, zh), 150);
                } else if (stageRef.current === 'zh' && matchesZhMeaning(text, zh)) {
                    setZhPassed(true);
                    stageRef.current = 'done';
                    setStage('done');
                    stopRecognition();
                }
            },
            onError: (err) => {
                if (err === 'not-allowed' || err === 'service-not-allowed') {
                    setMicError(t('vocab.readAloud.micDenied'));
                    setListening(false);
                } else if (err === 'not-supported') {
                    setMicError(t('vocab.readAloud.micUnsupported'));
                    setListening(false);
                } else if (err !== 'no-speech' && err !== 'aborted') {
                    setMicError(t('vocab.readAloud.micError').replace('{msg}', String(err)));
                }
            },
        });

        if (handle) {
            handleRef.current = handle;
            setListening(true);
        }
    }, [supported, stopRecognition]);

    /* switching to Chinese: restart recognition with zh-CN */
    useEffect(() => {
        setEnPassed(false);
        setZhPassed(false);
        setManualOverride(false);
        setTranscript('');
        setMicError(null);
        setStage('en');
        stageRef.current = 'en';

        const word = currentCard.word;
        const zh = currentCard.zh;
        // each new card: reset the state, auto-play the English once, and start English recognition
        speakWord(word);
        const timer = setTimeout(() => {
            if (supported) startForStage('en', word, zh);
        }, 900);

        return () => {
            clearTimeout(timer);
            stopRecognition();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentCard.word]);

    const handleRetry = useCallback(() => {
        setEnPassed(false);
        setZhPassed(false);
        setStage('en');
        stageRef.current = 'en';
        setTranscript('');
        setMicError(null);
        startForStage('en', currentCard.word, currentCard.zh);
    }, [currentCard.word, currentCard.zh, startForStage]);

    const handleSkip = useCallback(() => {
        setManualOverride(true);
        stopRecognition();
    }, [stopRecognition]);

    const unlocked = (enPassed && zhPassed) || manualOverride;

    const RATING_INFO = [
        { id: 1, label: t('vocab.ratings.again'), cls: 'btn-again', key: '1' },
        { id: 2, label: t('vocab.ratings.hard'),  cls: 'btn-hard',  key: '2' },
        { id: 3, label: t('vocab.ratings.good'),  cls: 'btn-good',  key: '3' },
        { id: 4, label: t('vocab.ratings.easy'),  cls: 'btn-easy',  key: '4' },
    ];

    const stateLabelKey = STATE_LABELS_KEY[currentCard.state] ?? 'new';
    const stateLabel = t(`vocab.status.${stateLabelKey}`);

    return (
        <>
            <div className="fc-scene fc-read-scene">
                <div className={`fc-card fc-read-card ${statusCls}`}>
                    <div className="fc-face fc-read-face">
                        <button
                            type="button"
                            className="fc-speak-btn"
                            onClick={(e) => { e.stopPropagation(); speakWord(currentCard.word); }}
                            aria-label={t('vocab.common.speakPronunciation')}
                        ><Volume2 size={18} /></button>

                        <div className="fc-word">{currentCard.word}</div>
                        {currentCard.phonetic && (
                            <div className="fc-phonetic fc-phonetic-front">{currentCard.phonetic}</div>
                        )}

                        <div className="fc-read-meaning">
                            {currentCard.definitions && currentCard.definitions.length > 0 ? (
                                <div className="fc-read-defs">
                                    {currentCard.definitions.map((d, i) => (
                                        <div key={i} className="fc-read-def-row">
                                            {d.pos && <span className="fc-pos-badge" data-pos={d.pos.replace('.', '').toLowerCase()}>{d.pos}</span>}
                                            <span className="fc-read-def-text">{d.meaning}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="fc-read-def-row">
                                    {currentCard.grammar && (
                                        <span className="fc-pos-badge" data-pos={currentCard.grammar.replace('.', '').toLowerCase()}>
                                            {currentCard.grammar}
                                        </span>
                                    )}
                                    <span className="fc-read-def-text">{currentCard.zh}</span>
                                </div>
                            )}
                        </div>

                        <div className="fc-read-stage-row">
                            <div className={`fc-read-stage ${enPassed ? 'is-passed' : stage === 'en' ? 'is-active' : ''}`}>
                                <span className="fc-read-stage-icon">
                                    {enPassed ? <Check size={16} /> : stage === 'en' && listening ? <Loader2 size={16} className="fc-read-spin" /> : '①'}
                                </span>
                                <span className="fc-read-stage-label">{t('vocab.readAloud.stageEn')}</span>
                            </div>
                            <div className={`fc-read-stage ${zhPassed ? 'is-passed' : stage === 'zh' ? 'is-active' : ''}`}>
                                <span className="fc-read-stage-icon">
                                    {zhPassed ? <Check size={16} /> : stage === 'zh' && listening ? <Loader2 size={16} className="fc-read-spin" /> : '②'}
                                </span>
                                <span className="fc-read-stage-label">{t('vocab.readAloud.stageZh')}</span>
                            </div>
                        </div>

                        {supported && !unlocked && (
                            <div className="fc-read-transcript">
                                <span className="fc-read-mic">
                                    {listening ? <Mic size={14} /> : <MicOff size={14} />}
                                </span>
                                <span className="fc-read-transcript-text">
                                    {transcript || (
                                        stage === 'en'
                                            ? t('vocab.readAloud.promptSpeakEn').replace('{word}', currentCard.word)
                                            : t('vocab.readAloud.promptSpeakZh')
                                    )}
                                </span>
                            </div>
                        )}

                        {micError && (
                            <div className="fc-read-error">{micError}</div>
                        )}

                        {!supported && (
                            <div className="fc-read-error">
                                {t('vocab.readAloud.micUnsupportedHint')}
                            </div>
                        )}

                        {!unlocked && (
                            <div className="fc-read-actions">
                                <button
                                    type="button"
                                    className="fc-read-action-btn"
                                    onClick={handleRetry}
                                    disabled={!supported}
                                >
                                    {t('vocab.readAloud.retryBtn')}
                                </button>
                                <button
                                    type="button"
                                    className="fc-read-action-btn fc-read-action-skip"
                                    onClick={handleSkip}
                                >
                                    {t('vocab.readAloud.skipBtn')}
                                </button>
                            </div>
                        )}

                        {unlocked && (
                            <div className="fc-read-unlocked-hint">
                                <Check size={14} /> {manualOverride ? t('vocab.readAloud.skippedLabel') : t('vocab.readAloud.passedLabel')}
                            </div>
                        )}

                        <div className="fc-back-footer" style={{ marginTop: 12 }}>
                            <div className="fc-state-pill">
                                <span className="fc-state-dot" data-state={currentCard.state}></span>
                                <span>{stateLabel}</span>
                                {currentCard.stability > 0 && <span className="fc-stability">· {t('vocab.stability')} {currentCard.stability.toFixed(1)}</span>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`fc-rating-row${!unlocked ? ' locked' : ''}`}>
                {RATING_INFO.map((info) => (
                    <button
                        key={info.id}
                        type="button"
                        className={`fc-btn ${info.cls}`}
                        onClick={() => onRating(info.id)}
                        disabled={!unlocked || submitting}
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
                {unlocked ? t('vocab.ratingHint') : t('vocab.readAloud.ratingLocked')}
            </div>
        </>
    );
}
