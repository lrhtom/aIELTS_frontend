import Layout from '../../components/layout/Layout';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
import { speakWord as playWord, cancelSpeak } from '../../utils/speak';
import {
    type VocabMode, type VocabEntry, type PracticeQuestion,
    parseVocabInput, buildMcqQuestions, buildDictationQuestions,
    createMaskedWord, buildCompleteQuestions,
} from '../../utils/vocab_training_utils';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';

/* ─── Types ──────────────────────────────────────────────────────────────── */

type DoingStep = 'loading' | 'doing' | 'result';

interface SessionCache {
    vocabInput: string;
    mode: VocabMode;
    shuffleWordOrder: boolean;
    step: DoingStep;
    questions: PracticeQuestion[];
    currentIndex: number;
    score: number;
    mistakes: VocabEntry[];
    selectedOption: number | null;
    isCorrect: boolean | null;
    dictationInput: string;
    dictationChecked: boolean;
    completeLetters: string[];
    completeChecked: boolean;
    showCompleteAnswer: boolean;
}

const VALID_MODES: VocabMode[] = ['mcq', 'dictation', 'complete'];

function isVocabMode(value: string | undefined): value is VocabMode {
    return VALID_MODES.includes(value as VocabMode);
}

function getSessionKey(mode: VocabMode): string {
    return `vocab_doing_session_${mode}`;
}

function isReloadNavigation(): boolean {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return navEntries[0]?.type === 'reload';
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function VocabularyTrainingDoingPage() {
    const { t } = useLang();
    const navigate = useNavigate();
    const { state } = useLocation();
    const { mode: routeMode } = useParams<{ mode: string }>();

    const modeFromRoute: VocabMode | null = isVocabMode(routeMode) ? routeMode : null;

    // ── State ──────────────────────────────────────────────────────────────
    const [initialized, setInitialized] = useState(false);
    const [step, setStep] = useState<DoingStep>('loading');
    const [vocabInput, setVocabInput] = useState('');
    const [mode, setMode] = useState<VocabMode>(modeFromRoute ?? 'mcq');
    const [shuffleWordOrder, setShuffleWordOrder] = useState(true);
    const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [mistakes, setMistakes] = useState<VocabEntry[]>([]);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
    const [dictationInput, setDictationInput] = useState('');
    const [dictationChecked, setDictationChecked] = useState(false);
    const [completeLetters, setCompleteLetters] = useState<string[]>([]);
    const [completeChecked, setCompleteChecked] = useState(false);
    const [showCompleteAnswer, setShowCompleteAnswer] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const speakTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAutoSpokenIndexRef = useRef<number>(-1);
    const completeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

    const sessionKey = modeFromRoute ? getSessionKey(modeFromRoute) : '';

    const speakWord = useCallback((word: string) => {
        if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
        cancelSpeak();
        setIsSpeaking(true);
        speakTimerRef.current = setTimeout(() => setIsSpeaking(false), 4000);
        playWord(word, {
            onEnd: () => {
                if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
                setIsSpeaking(false);
            },
            onError: () => {
                if (speakTimerRef.current) clearTimeout(speakTimerRef.current);
                setIsSpeaking(false);
            },
        });
    }, []);

    useEffect(() => {
        return () => { cancelSpeak(); };
    }, []);

    // ── Restore or init from route state ──────────────────────────────────
    useEffect(() => {
        if (!modeFromRoute) {
            navigate('/vocabulary/practice', { replace: true });
            return;
        }

        // start studying
        if (isReloadNavigation()) {
            const cached = sessionStorage.getItem(sessionKey);
            if (cached) {
                try {
                    const p: SessionCache = JSON.parse(cached);
                    setVocabInput(p.vocabInput);
                    setMode(p.mode);
                    setShuffleWordOrder(p.shuffleWordOrder ?? true);
                    setStep(p.step);
                    setQuestions(p.questions);
                    setCurrentIndex(p.currentIndex);
                    setScore(p.score);
                    setMistakes(p.mistakes);
                    setSelectedOption(p.selectedOption);
                    setIsCorrect(p.isCorrect);
                    setDictationInput(p.dictationInput ?? '');
                    setDictationChecked(p.dictationChecked ?? false);
                    setCompleteLetters(Array.isArray(p.completeLetters) ? p.completeLetters : []);
                    setCompleteChecked(p.completeChecked ?? false);
                    setShowCompleteAnswer(p.showCompleteAnswer ?? false);
                    setInitialized(true);
                    return;
                } catch {
                    sessionStorage.removeItem(sessionKey);
                }
            }
        } else {
            sessionStorage.removeItem(sessionKey);
        }

        const stateVocab: string = state?.vocabInput ?? '';
        const stateShuffleWordOrder: boolean = state?.shuffleWordOrder ?? true;
        if (!stateVocab.trim()) {
            navigate('/vocabulary/practice', { replace: true });
            return;
        }
        setVocabInput(stateVocab);
        setShuffleWordOrder(stateShuffleWordOrder);
        setMode(modeFromRoute);
        setStep('loading');
        setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [modeFromRoute, sessionKey]);

    // ── Build questions on first enter (loading state, no questions yet) ──
    useEffect(() => {
        if (!initialized || step !== 'loading' || questions.length > 0) return;
        const timer = setTimeout(() => {
            const entries = parseVocabInput(vocabInput);
            if (mode === 'mcq' && entries.length < 4) {
                showToast(t('vocab.trainingDoing.toastNeed4'), 'error');
                navigate('/vocabulary/practice', { replace: true });
                return;
            }
            if (entries.length < 1) {
                showToast(t('vocab.trainingDoing.toastNoWords'), 'error');
                navigate('/vocabulary/practice', { replace: true });
                return;
            }
            if (mode === 'dictation') {
                setQuestions(buildDictationQuestions(entries, shuffleWordOrder));
            } else if (mode === 'complete') {
                setQuestions(buildCompleteQuestions(entries, shuffleWordOrder));
            } else {
                setQuestions(buildMcqQuestions(entries, shuffleWordOrder));
            }
            setStep('doing');
        }, 700);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialized, step, questions.length, vocabInput, mode, shuffleWordOrder]);

    // ── Persist to sessionStorage on every relevant state change ──────────
    useEffect(() => {
        if (!initialized || !vocabInput) return;
        const cache: SessionCache = {
            vocabInput, mode, shuffleWordOrder, step, questions,
            currentIndex, score, mistakes,
            selectedOption, isCorrect,
            dictationInput, dictationChecked,
            completeLetters, completeChecked, showCompleteAnswer,
        };
        sessionStorage.setItem(getSessionKey(mode), JSON.stringify(cache));
    }, [initialized, vocabInput, mode, shuffleWordOrder, step, questions, currentIndex, score, mistakes, selectedOption, isCorrect, dictationInput, dictationChecked, completeLetters, completeChecked, showCompleteAnswer]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const handleSelect = useCallback((optIdx: number) => {
        if (selectedOption !== null) return;
        const q = questions[currentIndex];
        if (typeof q.correctIndex !== 'number') return;
        const correct = optIdx === q.correctIndex;
        setSelectedOption(optIdx);
        setIsCorrect(correct);
        if (correct) {
            setScore((s) => s + 1);
        } else {
            setMistakes((m) => [...m, { en: q.en, zh: q.zh }]);
        }
    }, [selectedOption, questions, currentIndex]);

    const handleNext = useCallback(() => {
        if (currentIndex + 1 >= questions.length) {
            setStep('result');
        } else {
            setCurrentIndex((i) => i + 1);
            setSelectedOption(null);
            setIsCorrect(null);
            setDictationInput('');
            setDictationChecked(false);
            setCompleteLetters([]);
            setCompleteChecked(false);
            setShowCompleteAnswer(false);
        }
    }, [currentIndex, questions.length]);

    const handleDictationSubmit = useCallback(() => {
        const q = questions[currentIndex];
        const normalizedInput = dictationInput.trim().toLowerCase();
        const normalizedAnswer = q.en.trim().toLowerCase();
        if (!normalizedInput) {
            showToast(t('vocab.trainingDoing.toastEnterHeard'), 'error');
            return;
        }

        const correct = normalizedInput === normalizedAnswer;
        setIsCorrect(correct);
        setDictationChecked(true);

        if (correct) {
            setScore((s) => s + 1);
        } else {
            setMistakes((m) => [...m, { en: q.en, zh: q.zh }]);
        }
    }, [questions, currentIndex, dictationInput]);

    const handleCompleteSubmit = useCallback(() => {
        const q = questions[currentIndex];
        const masked = q.maskedWord ?? createMaskedWord(q.en);
        const normalizedInput = q.en
            .split('')
            .map((ch, idx) => {
                if (!/[a-zA-Z]/.test(ch)) return ch;
                const maskCh = masked[idx] ?? '_';
                if (maskCh !== '_') return maskCh;
                return completeLetters[idx] ?? '';
            })
            .join('')
            .trim()
            .toLowerCase();

        const hasAnyInput = q.en
            .split('')
            .some((ch, idx) => {
                if (!/[a-zA-Z]/.test(ch)) return false;
                const maskCh = masked[idx] ?? '_';
                return maskCh === '_' && (completeLetters[idx] ?? '').trim();
            });
        if (!hasAnyInput) {
            showToast(t('vocab.trainingDoing.toastCompleteWord'), 'error');
            return;
        }

        const normalizedAnswer = q.en.trim().toLowerCase();

        const correct = normalizedInput === normalizedAnswer;
        setIsCorrect(correct);
        setCompleteChecked(true);

        if (correct) {
            setScore((s) => s + 1);
        } else {
            setMistakes((m) => [...m, { en: q.en, zh: q.zh }]);
        }
    }, [questions, currentIndex, completeLetters]);

    const handleCompleteLetterChange = useCallback((word: string, maskedWord: string, index: number, value: string) => {
        const char = value.replace(/[^a-zA-Z]/g, '').slice(-1);
        setCompleteLetters((prev) => {
            const next = word
                .split('')
                .map((ch, i) => {
                    if (!/[a-zA-Z]/.test(ch)) return ch;
                    return maskedWord[i] !== '_' ? maskedWord[i] : (prev[i] ?? '');
                });
            next[index] = char;
            return next;
        });

        if (char) {
            const nextIndex = word
                .split('')
                .findIndex((ch, i) => i > index && /[a-zA-Z]/.test(ch) && maskedWord[i] === '_');
            if (nextIndex !== -1) completeInputRefs.current[nextIndex]?.focus();
        }
    }, []);

    const handleCompleteLetterKeyDown = useCallback((word: string, maskedWord: string, index: number, key: string) => {
        if (key !== 'Backspace') return;
        const current = completeLetters[index] ?? '';
        if (current) return;
        const prevIndex = [...word]
            .map((ch, i) => ({ ch, i }))
            .filter((item) => item.i < index && /[a-zA-Z]/.test(item.ch) && maskedWord[item.i] === '_')
            .map((item) => item.i)
            .pop();
        if (typeof prevIndex === 'number') {
            completeInputRefs.current[prevIndex]?.focus();
        }
    }, [completeLetters]);

    useEffect(() => {
        if (mode !== 'complete' || step !== 'doing') return;
        const current = questions[currentIndex];
        if (!current) return;

        const masked = current.maskedWord ?? createMaskedWord(current.en);
        setCompleteLetters((prev) => {
            if (prev.length === current.en.length) return prev;
            return current.en
                .split('')
                .map((ch, idx) => {
                    if (!/[a-zA-Z]/.test(ch)) return ch;
                    return masked[idx] === '_' ? '' : masked[idx];
                });
        });
    }, [mode, step, questions, currentIndex]);

    // Restore progress only on a browser refresh of the answering page; ordinary route changes do not restore
    useEffect(() => {
        if (mode !== 'dictation' || step !== 'doing') return;
        if (questions.length === 0 || !questions[currentIndex]) return;
        if (dictationChecked) return;
        if (lastAutoSpokenIndexRef.current === currentIndex) return;

        lastAutoSpokenIndexRef.current = currentIndex;
        speakWord(questions[currentIndex].en);
    }, [mode, step, questions, currentIndex, dictationChecked, speakWord]);

    const handleRestart = () => {
        sessionStorage.removeItem(getSessionKey(mode));
        const entries = parseVocabInput(vocabInput);
        if (mode === 'dictation') {
            setQuestions(buildDictationQuestions(entries, shuffleWordOrder));
        } else if (mode === 'complete') {
            setQuestions(buildCompleteQuestions(entries, shuffleWordOrder));
        } else {
            setQuestions(buildMcqQuestions(entries, shuffleWordOrder));
        }
        lastAutoSpokenIndexRef.current = -1;
        setCurrentIndex(0);
        setScore(0);
        setMistakes([]);
        setSelectedOption(null);
        setIsCorrect(null);
        setDictationInput('');
        setDictationChecked(false);
        setCompleteLetters([]);
        setCompleteChecked(false);
        setShowCompleteAnswer(false);
        setStep('doing');
    };

    const handleBackToConfig = () => {
        sessionStorage.removeItem(getSessionKey(mode));
        navigate('/vocabulary/practice');
    };

    if (!initialized) return null;

    /* ── Loading screen ──────────────────────────────────────────────────── */
    if (step === 'loading') {
        const loadingText =
            mode === 'dictation'
                ? t('vocab.trainingDoing.preparingDictation')
                : mode === 'complete'
                    ? t('vocab.trainingDoing.preparingComplete')
                    : t('vocab.trainingDoing.preparingChoice');
        return (
            <Layout>
                <div className="practice-container" style={{ textAlign: 'center', paddingTop: '80px' }}>
                    <div style={{ fontSize: '52px', marginBottom: '24px' }}>🧩</div>
                    <h2 style={{ fontWeight: 700, marginBottom: '10px' }}>{t('vocab.trainingDoing.preparingTitle')}</h2>
                    <p style={{ color: 'var(--color-text-secondary)' }}>{loadingText}</p>
                </div>
            </Layout>
        );
    }

    /* ── Result screen ───────────────────────────────────────────────────── */
    if (step === 'result') {
        const total = questions.length;
        const pct = Math.round((score / total) * 100);
        const modeLabel = mode === 'dictation' ? t('vocab.trainingDoing.modeDictation') : mode === 'complete' ? t('vocab.trainingDoing.modeComplete') : t('vocab.trainingDoing.modeChoice');
        return (
            <Layout
                pageTitle={t('vocab.trainingDoing.completedTitle')}
                pageSubtitle={t('vocab.trainingDoing.completedSubtitle').replace('{mode}', modeLabel).replace('{n}', String(total))}
            >
                <div className="practice-container">

                    {/* Score */}
                    <div className="config-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
                        <div style={{ fontSize: '52px', marginBottom: '12px' }}>
                            {pct >= 80 ? '🏆' : pct >= 60 ? '👍' : '📚'}
                        </div>
                        <div style={{ fontSize: '48px', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: '-1px' }}>
                            {score} <span style={{ fontSize: '22px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>/ {total}</span>
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', marginTop: '8px', fontSize: '14px' }}>
                            {t('vocab.trainingDoing.accuracyLabel').replace('{n}', String(pct))}
                        </div>
                    </div>

                    {/* Mistake review */}
                    {mistakes.length > 0 && (
                        <div className="config-card">
                            <h3>{t('vocab.trainingDoing.mistakesTitle').replace('{n}', String(mistakes.length))}</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {mistakes.map((m, i) => (
                                    <div key={i} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 14px', borderRadius: '10px',
                                        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                                    }}>
                                        <span style={{ fontWeight: 600 }}>{m.en}</span>
                                        <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>{m.zh}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button className="skill-btn reading" style={{ flex: 1 }} onClick={handleRestart}>
                            {t('vocab.trainingDoing.retryBtn')}
                        </button>
                        <button
                            onClick={handleBackToConfig}
                            style={{
                                flex: 1, padding: '18px 24px', fontSize: '16px', fontWeight: 700,
                                borderRadius: '14px', border: '1.5px solid var(--color-border)',
                                background: 'var(--color-surface)', color: 'var(--color-text)',
                                cursor: 'pointer', transition: 'all 0.2s',
                            }}
                        >
                            {t('vocab.trainingDoing.backConfigBtn')}
                        </button>
                    </div>
                </div>
            </Layout>
        );
    }

    /* ── Doing screen ────────────────────────────────────────────────────── */
    const q = questions[currentIndex];
    const total = questions.length;
    const progressPercent = total > 0
        ? Math.min(100, Math.max(0, ((currentIndex + 1) / total) * 100))
        : 0;

    if (mode === 'dictation') {
        return (
            <Layout>
                <div className="practice-container">
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            <span>{t('vocab.trainingDoing.questionNum').replace('{n}', String(currentIndex + 1)).replace('{total}', String(total))}</span>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>{t('vocab.trainingDoing.scoreCorrect').replace('{n}', String(score))}</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '999px',
                                background: 'linear-gradient(90deg, #0d9488, #0891b2)',
                                width: `${progressPercent}%`,
                                transition: 'width 0.35s ease',
                            }} />
                        </div>
                    </div>

                    <div className="config-card" style={{ textAlign: 'center', padding: '34px 24px 24px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                            {t('vocab.trainingDoing.dictationTitle')}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '18px' }}>
                            {t('vocab.trainingDoing.dictationHint')}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 50px', gap: '10px', alignItems: 'center' }}>
                            <input
                                type="text"
                                value={dictationInput}
                                onChange={(e) => setDictationInput(e.target.value)}
                                placeholder={t('vocab.trainingDoing.dictationPlaceholder')}
                                disabled={dictationChecked}
                                style={{
                                    width: '100%',
                                    height: '50px',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: '1.5px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    fontSize: '16px',
                                    fontWeight: 500,
                                }}
                            />
                            <button
                                onClick={() => speakWord(q.en)}
                                title={t('vocab.common.speakWord')}
                                disabled={false}
                                style={{
                                    width: '50px', height: '50px',
                                    padding: 0,
                                    lineHeight: 1,
                                    borderRadius: '50%',
                                    border: isSpeaking ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: isSpeaking ? 'rgba(13,148,136,0.12)' : 'var(--color-surface)',
                                    color: isSpeaking ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontSize: '20px', cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                {isSpeaking ? '🔊' : '🔈'}
                            </button>
                        </div>
                    </div>

                    <div className="config-card" style={{ marginBottom: '16px' }}>
                        <button
                            className="skill-btn reading"
                            style={{ width: '100%', margin: 0 }}
                            onClick={dictationChecked ? handleNext : handleDictationSubmit}
                        >
                            {dictationChecked ? (currentIndex + 1 >= total ? t('vocab.trainingDoing.viewResults') : t('vocab.trainingDoing.nextBtn')) : t('vocab.trainingDoing.submitBtn')}
                        </button>
                    </div>

                    {dictationChecked && (
                        <div className="config-card" style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '15px', color: isCorrect ? '#16a34a' : '#dc2626' }}>
                                {isCorrect ? t('vocab.trainingDoing.spellCorrect') : t('vocab.trainingDoing.spellWrongLabel').replace('{answer}', q.en)}
                            </div>
                        </div>
                    )}
                </div>
            </Layout>
        );
    }

    if (mode === 'complete') {
        return (
            <Layout>
                <div className="practice-container">
                    <div style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            <span>{t('vocab.trainingDoing.questionNum').replace('{n}', String(currentIndex + 1)).replace('{total}', String(total))}</span>
                            <span style={{ color: '#16a34a', fontWeight: 600 }}>{t('vocab.trainingDoing.scoreCorrect').replace('{n}', String(score))}</span>
                        </div>
                        <div style={{ height: '6px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: '999px',
                                background: 'linear-gradient(90deg, #0d9488, #0891b2)',
                                width: `${progressPercent}%`,
                                transition: 'width 0.35s ease',
                            }} />
                        </div>
                    </div>

                    <div className="config-card" style={{ textAlign: 'center', padding: '34px 24px 24px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                            {t('vocab.trainingDoing.completeTitle')}
                        </div>
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '10px' }}>
                            {t('vocab.trainingDoing.meaningLabel').replace('{zh}', q.zh)}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
                            <button
                                onClick={() => speakWord(q.en)}
                                title={t('vocab.common.speakWord')}
                                disabled={false}
                                style={{
                                    width: '44px', height: '44px',
                                    padding: 0,
                                    borderRadius: '50%',
                                    border: isSpeaking ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: isSpeaking ? 'rgba(13,148,136,0.12)' : 'var(--color-surface)',
                                    color: isSpeaking ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontSize: '18px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {isSpeaking ? '🔊' : '🔈'}
                            </button>
                            <button
                                onClick={() => setShowCompleteAnswer((v) => !v)}
                                title={showCompleteAnswer ? t('vocab.trainingDoing.hideOriginal') : t('vocab.trainingDoing.showOriginal')}
                                style={{
                                    width: '44px', height: '44px',
                                    padding: 0,
                                    borderRadius: '50%',
                                    border: showCompleteAnswer ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: showCompleteAnswer ? 'rgba(13,148,136,0.12)' : 'var(--color-surface)',
                                    color: showCompleteAnswer ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                    fontSize: '18px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                            >
                                {showCompleteAnswer ? '🙈' : '👁️'}
                            </button>
                        </div>

                        {showCompleteAnswer && (
                            <div style={{
                                marginBottom: '12px',
                                fontSize: '15px',
                                color: 'var(--color-primary)',
                                fontWeight: 700,
                            }}>
                                {t('vocab.trainingDoing.originalWord').replace('{en}', q.en)}
                            </div>
                        )}

                        <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0,
                            justifyContent: 'center',
                            alignItems: 'center',
                        }}>
                            {(q.maskedWord ?? createMaskedWord(q.en)).split('').map((maskCh, idx) => {
                                const originalCh = q.en[idx] ?? maskCh;
                                if (!/[a-zA-Z]/.test(originalCh)) {
                                    return (
                                        <span
                                            key={`sep-${idx}`}
                                            style={{
                                                minWidth: '10px',
                                                fontSize: '24px',
                                                fontWeight: 700,
                                                color: 'var(--color-text-secondary)',
                                            }}
                                        >
                                            {originalCh}
                                        </span>
                                    );
                                }

                                if (maskCh !== '_') {
                                    return (
                                        <div
                                            key={`fixed-${idx}`}
                                            style={{
                                                width: '34px',
                                                height: '42px',
                                                borderBottom: '2px solid rgba(13,148,136,0.35)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '24px',
                                                fontWeight: 700,
                                                color: 'var(--color-primary)',
                                                textTransform: 'none',
                                            }}
                                        >
                                            {maskCh}
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={`letter-${idx}`}
                                        style={{
                                            width: '34px',
                                            height: '42px',
                                            borderBottom: '2px solid var(--color-border)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <input
                                            ref={(el) => { completeInputRefs.current[idx] = el; }}
                                            type="text"
                                            inputMode="text"
                                            autoComplete="off"
                                            maxLength={1}
                                            value={completeLetters[idx] ?? ''}
                                            disabled={completeChecked}
                                            onInput={(e) => {
                                                const input = e.currentTarget;
                                                if (input.value.length > 1) {
                                                    input.value = input.value.slice(-1);
                                                }
                                            }}
                                            onChange={(e) => handleCompleteLetterChange(q.en, q.maskedWord ?? createMaskedWord(q.en), idx, e.target.value)}
                                            onKeyDown={(e) => handleCompleteLetterKeyDown(q.en, q.maskedWord ?? createMaskedWord(q.en), idx, e.key)}
                                            style={{
                                                width: '100%',
                                                height: '100%',
                                                padding: 0,
                                                border: 'none',
                                                background: 'transparent',
                                                textAlign: 'center',
                                                fontSize: '24px',
                                                fontWeight: 700,
                                                color: 'var(--color-text)',
                                                textTransform: 'none',
                                                letterSpacing: 0,
                                                outline: 'none',
                                            }}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="config-card" style={{ marginBottom: '16px' }}>
                        <button
                            className="skill-btn reading"
                            style={{ width: '100%', margin: 0 }}
                            onClick={completeChecked ? handleNext : handleCompleteSubmit}
                        >
                            {completeChecked ? (currentIndex + 1 >= total ? t('vocab.trainingDoing.viewResults') : t('vocab.trainingDoing.nextBtn')) : t('vocab.trainingDoing.submitBtn')}
                        </button>
                    </div>

                    {completeChecked && (
                        <div className="config-card" style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 600, fontSize: '15px', color: isCorrect ? '#16a34a' : '#dc2626' }}>
                                {isCorrect ? t('vocab.trainingDoing.spellCorrect') : t('vocab.trainingDoing.spellWrongLabel').replace('{answer}', q.en)}
                            </div>
                        </div>
                    )}
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="practice-container">
                {/* Progress */}
                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        <span>{t('vocab.trainingDoing.questionProgress').replace('{i}', String(currentIndex + 1)).replace('{n}', String(total))}</span>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ {t('vocab.trainingDoing.correctCount').replace('{n}', String(score))}</span>
                    </div>
                    <div style={{ height: '6px', borderRadius: '999px', background: 'var(--color-border)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '999px',
                            background: 'linear-gradient(90deg, #0d9488, #0891b2)',
                            width: `${progressPercent}%`,
                            transition: 'width 0.35s ease',
                        }} />
                    </div>
                </div>

                {/* Question card */}
                <div className="config-card" style={{ textAlign: 'center', padding: '40px 24px 32px', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-secondary)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '12px' }}>
                        {t('vocab.trainingDoing.choicePrompt')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>
                        <div style={{ fontSize: '38px', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--color-text)', lineHeight: 1.2 }}>
                            {q.en}
                        </div>
                        <button
                            onClick={() => speakWord(q.en)}
                            title={t('vocab.common.speakWord')}
                            style={{
                                flexShrink: 0,
                                width: '42px', height: '42px',
                                borderRadius: '50%',
                                border: isSpeaking ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                background: isSpeaking ? 'rgba(13,148,136,0.12)' : 'var(--color-surface)',
                                color: isSpeaking ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                fontSize: '18px', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s ease',
                                boxShadow: isSpeaking ? '0 0 0 4px rgba(13,148,136,0.15)' : 'none',
                            }}
                        >
                            {isSpeaking ? '🔊' : '🔈'}
                        </button>
                    </div>
                </div>

                {/* Options — 2×2 grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    {(q.options ?? []).map((opt, idx) => {
                        let bg = 'var(--color-surface)';
                        let border = '1.5px solid var(--color-border)';
                        let color = 'var(--color-text)';
                        let shadow = 'none';
                        if (selectedOption !== null) {
                            if (idx === q.correctIndex) {
                                bg = 'rgba(34,197,94,0.12)'; border = '2px solid #22c55e'; color = '#16a34a'; shadow = '0 0 0 4px rgba(34,197,94,0.1)';
                            } else if (idx === selectedOption) {
                                bg = 'rgba(239,68,68,0.1)'; border = '2px solid #ef4444'; color = '#dc2626'; shadow = '0 0 0 4px rgba(239,68,68,0.08)';
                            }
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleSelect(idx)}
                                disabled={selectedOption !== null}
                                style={{
                                    padding: '18px 12px', borderRadius: '14px',
                                    border, background: bg, color, boxShadow: shadow,
                                    fontSize: '15px', fontWeight: 500,
                                    cursor: selectedOption !== null ? 'default' : 'pointer',
                                    transition: 'all 0.2s ease', textAlign: 'center', lineHeight: 1.45,
                                    minHeight: '70px',
                                }}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>

                {/* Feedback + next button */}
                {selectedOption !== null && (
                    <div className="config-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ fontWeight: 600, fontSize: '15px', color: isCorrect ? '#16a34a' : '#dc2626', flex: 1 }}>
                            {isCorrect ? t('vocab.trainingDoing.answerCorrect') : t('vocab.trainingDoing.answerWrongLabel').replace('{answer}', q.zh)}
                        </div>
                        <button
                            className="skill-btn reading"
                            style={{ margin: 0, padding: '12px 28px', fontSize: '15px', minWidth: '110px', borderRadius: '12px' }}
                            onClick={handleNext}
                            autoFocus
                        >
                            {currentIndex + 1 >= total ? t('vocab.trainingDoing.viewResults') : t('vocab.trainingDoing.nextBtn')}
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
}
