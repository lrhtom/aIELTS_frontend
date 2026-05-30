import { useState, useRef, useEffect, useCallback } from 'react';
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
    trackingMode: 'eye' | 'mouse';
    onFlip: () => void;
    onRating: (rating: number) => void;
    estimateInterval: (card: VocabCard, rating: number) => string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WebGazerInstance = any;

const DWELL_MS = 150;
const RATING_DWELL_MS = 600;
const GAZE_STORAGE_KEY = 'aielts.gaze_calibration_v1';

function speak(word: string) {
    speakWord(word);
}

export default function GazeMode({
    currentCard,
    isFlipped,
    isFlipping,
    statusCls,
    submitting,
    trackingMode,
    onFlip,
    onRating,
    estimateInterval,
}: Props) {
    const { translations: t } = useLang();

    const [activeTracking, setActiveTracking] = useState<'eye' | 'mouse'>(trackingMode);
    const [gazeReady, setGazeReady] = useState(false);
    const [calibrating, setCalibrating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scannedLetters, setScannedLetters] = useState<Set<number>>(new Set());

    const wordRef = useRef<HTMLDivElement | null>(null);
    const letterRefs = useRef<(HTMLSpanElement | null)[]>([]);
    const ratingRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const dwellRef = useRef<Record<number, number>>({});
    const ratingDwellRef = useRef<Record<number, number>>({});
    const pointerPosRef = useRef<{x: number, y: number} | null>(null);
    
    const webgazerRef = useRef<WebGazerInstance | null>(null);
    const rafRef = useRef<number>(0);
    const scannedRef = useRef<Set<number>>(new Set());

    const word = currentCard.word;
    const isPhrase = word.includes(' ') && word.length > 12;
    const targets = isPhrase ? word.split(' ') : word.split('');
    
    // Refs for accessing latest state inside requestAnimationFrame loop
    const isFlippedRef = useRef(isFlipped);
    isFlippedRef.current = isFlipped;
    const submittingRef = useRef(submitting);
    submittingRef.current = submitting;
    const targetCountRef = useRef(targets.length);
    targetCountRef.current = targets.length;
    const onRatingRef = useRef(onRating);
    onRatingRef.current = onRating;

    const allScanned = scannedLetters.size === targets.length;

    // Reset scanned letters when card changes
    useEffect(() => {
        setScannedLetters(new Set());
        scannedRef.current = new Set();
        dwellRef.current = {};
        ratingDwellRef.current = {};
    }, [currentCard.word]);

    // Auto-flip when all letters scanned
    useEffect(() => {
        if (allScanned && !isFlipped && !submitting && gazeReady) {
            const timer = setTimeout(() => onFlip(), 400);
            return () => clearTimeout(timer);
        }
    }, [allScanned, isFlipped, submitting, gazeReady, onFlip]);

    const markLetterScanned = useCallback((index: number) => {
        if (scannedRef.current.has(index)) return;
        const next = new Set(scannedRef.current);
        next.add(index);
        scannedRef.current = next;
        setScannedLetters(next);
    }, []);

    // Global Mouse Listener for mouse tracking mode
    useEffect(() => {
        if (activeTracking !== 'mouse' || !gazeReady) return;
        const handler = (e: MouseEvent) => {
            pointerPosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handler);
        return () => window.removeEventListener('mousemove', handler);
    }, [activeTracking, gazeReady]);

    // ── Eye tracking (WebGazer) Init ──
    const initEyeTracking = useCallback(async () => {
        setCalibrating(true);
        setError(null);

        try {

            // Load webgazer via script tag to avoid Vite CJS/ESM bundling issues
            let wg = (window as any).webgazer;
            if (!wg) {
                await new Promise<void>((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/webgazer.js';
                    script.async = true;
                    script.onload = () => resolve();
                    script.onerror = () => reject(new Error('Failed to load WebGazer script'));
                    document.body.appendChild(script);
                });
                wg = (window as any).webgazer;
            }

            if (!wg) throw new Error('WebGazer undefined after script load');

            wg.setRegression('ridge')
                .setTracker('TFFacemesh')
                .showVideoPreview(true)
                .showPredictionPoints(true)
                .applyKalmanFilter(false) // Disable heavy built-in filter to fix latency
                .setGazeListener((data: any, elapsedTime: number) => {
                    if (data) {
                        (window as any)._gazePos = { x: data.x, y: data.y };
                    } else {
                        (window as any)._gazePos = null;
                    }
                });

            const saved = sessionStorage.getItem(GAZE_STORAGE_KEY);
            if (saved) {
                try {
                    wg.setRegression('ridge');
                } catch { /* use fresh calibration */ }
            }

            webgazerRef.current = wg;

            // Start camera FIRST so WebGazer can track eyes during calibration
            await wg.begin();

            // Calibration UI (camera is now open)
            await new Promise<void>((resolve) => {
                const overlay = document.createElement('div');
                overlay.className = 'fc-gaze-calibration-overlay';
                overlay.innerHTML = `
                    <div class="fc-gaze-calibration-card">
                        <div class="fc-gaze-calibration-title">${t.vocab.gaze.calibrating}</div>
                        <div class="fc-gaze-calibration-sub">Click each dot while looking directly at it</div>
                        <div class="fc-gaze-calibration-grid" id="gaze-calib-grid"></div>
                        <button class="fc-gaze-calibration-done" id="gaze-calib-done" disabled>Done</button>
                    </div>
                `;
                document.body.appendChild(overlay);

                const grid = overlay.querySelector('#gaze-calib-grid')!;

                const positions = [
                    { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
                    { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
                    { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
                ];

                let clickedCount = 0;

                for (const pos of positions) {
                    const dot = document.createElement('div');
                    dot.className = 'fc-gaze-calibration-dot';
                    dot.style.left = `${pos.x}%`;
                    dot.style.top = `${pos.y}%`;
                    dot.addEventListener('click', (e) => {
                        if (dot.classList.contains('is-clicked')) return;
                        
                        // EXPLICITLY feed the exact pixel coordinates to WebGazer
                        if (webgazerRef.current) {
                            try {
                                webgazerRef.current.recordScreenPosition(e.clientX, e.clientY, 'click');
                            } catch (err) {
                                console.warn('Failed to record click for webgazer', err);
                            }
                        }

                        clickedCount++;
                        dot.classList.add('is-clicked');
                        if (clickedCount >= positions.length) {
                            const doneBtn = overlay.querySelector('#gaze-calib-done') as HTMLButtonElement;
                            if (doneBtn) doneBtn.disabled = false;
                        }
                    });
                    grid.appendChild(dot);
                }

                const doneBtn = overlay.querySelector('#gaze-calib-done')!;
                doneBtn.addEventListener('click', () => {
                    overlay.remove();
                    sessionStorage.setItem(GAZE_STORAGE_KEY, '1');
                    resolve();
                });
            });

            setGazeReady(true);
            setCalibrating(false);
        } catch (err) {
            console.warn('WebGazer init failed, falling back to mouse', err);
            setCalibrating(false);
            setActiveTracking('mouse');
            setGazeReady(true);
            setError(t.vocab.gaze.cameraDenied);
        }
    }, [t]);

    // Initialize tracking on mount (guard against React StrictMode double-invoke)
    const initRef = useRef(false);
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        if (trackingMode === 'eye') {
            setActiveTracking('eye');
            initEyeTracking();
        } else {
            setActiveTracking('mouse');
            setGazeReady(true);
            setCalibrating(false);
            setError(null);
        }

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
            if (webgazerRef.current) {
                try { webgazerRef.current.end(); } catch { /* ignore */ }
                webgazerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const RATING_INFO = [
        { id: 1, label: t.vocab.ratings.again, cls: 'btn-again', key: '1' },
        { id: 2, label: t.vocab.ratings.hard,  cls: 'btn-hard',  key: '2' },
        { id: 3, label: t.vocab.ratings.good,  cls: 'btn-good',  key: '3' },
        { id: 4, label: t.vocab.ratings.easy,  cls: 'btn-easy',  key: '4' },
    ];

    // Unified Tracking loop (Gaze + Mouse)
    useEffect(() => {
        if (!gazeReady) return;
        let running = true;
        let lastTime = performance.now();

        const loop = (now: number) => {
            if (!running) return;
            const dt = now - lastTime;
            lastTime = now;

            let px: number | null = null;
            let py: number | null = null;

            if (activeTracking === 'eye') {
                if ((window as any)._gazePos) {
                    px = (window as any)._gazePos.x;
                    py = (window as any)._gazePos.y;
                }
            } else if (activeTracking === 'mouse' && pointerPosRef.current) {
                px = pointerPosRef.current.x;
                py = pointerPosRef.current.y;
            }

            if (px !== null && py !== null) {
                // Initialize smooth pos if it's the first frame
                if (!(window as any)._smoothPos) {
                    (window as any)._smoothPos = { x: px, y: py };
                }
                
                // LERP (Linear Interpolation) factor (0.0 to 1.0)
                // Higher = snappier/more jittery, Lower = smoother/more delay
                const lerpFactor = activeTracking === 'eye' ? 0.35 : 0.8;
                
                (window as any)._smoothPos.x += (px - (window as any)._smoothPos.x) * lerpFactor;
                (window as any)._smoothPos.y += (py - (window as any)._smoothPos.y) * lerpFactor;

                const renderX = (window as any)._smoothPos.x;
                const renderY = (window as any)._smoothPos.y;

                // Update custom cursor
                if (cursorRef.current) {
                    cursorRef.current.style.display = 'block';
                    cursorRef.current.style.transform = `translate(${renderX - 10}px, ${renderY - 10}px)`;
                }

                if (!isFlippedRef.current) {
                    // Front Face: Scan letters
                    for (let i = 0; i < targetCountRef.current; i++) {
                        if (scannedRef.current.has(i)) continue;
                        const el = letterRefs.current[i];
                        if (!el) continue;
                        const rect = el.getBoundingClientRect();
                        // Add slight padding to make letter scanning easier
                        const PADDING = 10;
                        if (renderX >= rect.left - PADDING && renderX <= rect.right + PADDING && renderY >= rect.top - PADDING && renderY <= rect.bottom + PADDING) {
                            dwellRef.current[i] = (dwellRef.current[i] || 0) + dt;
                            if (dwellRef.current[i] >= DWELL_MS) {
                                markLetterScanned(i);
                            }
                        } else {
                            dwellRef.current[i] = 0;
                        }
                    }
                } else if (!submittingRef.current) {
                    // Back Face: Rate cards
                    for (let i = 0; i < RATING_INFO.length; i++) {
                        const el = ratingRefs.current[i];
                        if (!el) continue;
                        const rect = el.getBoundingClientRect();
                        const PADDING = 20; 
                        if (renderX >= rect.left - PADDING && renderX <= rect.right + PADDING && renderY >= rect.top - PADDING && renderY <= rect.bottom + PADDING) {
                            ratingDwellRef.current[i] = (ratingDwellRef.current[i] || 0) + dt;
                            const progress = Math.min(100, (ratingDwellRef.current[i] / RATING_DWELL_MS) * 100);
                            el.style.setProperty('--gaze-progress', `${progress}%`);
                            
                            if (ratingDwellRef.current[i] >= RATING_DWELL_MS) {
                                // Trigger Rating
                                for (let j=0; j<RATING_INFO.length; j++) {
                                    if (ratingRefs.current[j]) ratingRefs.current[j]!.style.setProperty('--gaze-progress', `0%`);
                                }
                                ratingDwellRef.current = {};
                                pointerPosRef.current = null; // Prevent multi-trigger
                                onRatingRef.current(RATING_INFO[i].id);
                                break;
                            }
                        } else {
                            ratingDwellRef.current[i] = 0;
                            el.style.setProperty('--gaze-progress', `0%`);
                        }
                    }
                }
            }

            rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
        return () => { 
            running = false; 
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [activeTracking, gazeReady, markLetterScanned]);

    const STATE_LABELS: Record<number, string> = {
        0: t.vocab.status.new,
        1: t.vocab.status.learning,
        2: t.vocab.status.review,
        3: t.vocab.status.relearn,
    };

    // Custom high-performance cursor
    const cursorRef = useRef<HTMLDivElement>(null);

    return (
        <>
            {/* Custom Gaze/Mouse Cursor Overlay */}
            {(gazeReady) && (
                <div 
                    ref={cursorRef}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(0, 180, 150, 0.7)',
                        border: '2px solid #00D2A0',
                        boxShadow: '0 0 10px rgba(0, 210, 160, 0.5)',
                        pointerEvents: 'none',
                        zIndex: 999999,
                        transform: 'translate(-10px, -10px)',
                        display: 'none',
                        transition: 'opacity 0.1s ease',
                    }}
                />
            )}

            <div
                className="fc-scene"
                role="button"
                tabIndex={0}
                onKeyDown={e => {
                    if (e.code === 'Space') { e.preventDefault(); onFlip(); }
                }}
                aria-label={isFlipped ? '点击翻回正面' : '点击翻转查看释义'}
            >
                <div
                    className={`fc-card ${isFlipped ? 'is-flipped' : ''} ${isFlipping ? 'is-flipping' : ''} ${statusCls}`}
                >
                    {/* Front face — gaze scan letters */}
                    <div className="fc-face">
                        <button
                            type="button"
                            className="fc-speak-btn"
                            onClick={e => { e.stopPropagation(); speak(currentCard.word); }}
                            aria-label="朗读发音"
                        ><Volume2 size={18} /></button>

                        {!gazeReady ? (
                            <div className="fc-gaze-loading">
                                {calibrating ? t.vocab.gaze.calibrating : error || t.vocab.gaze.notSupported}
                            </div>
                        ) : (
                            <>
                                <div className="fc-gaze-word" ref={wordRef}>
                                    {targets.map((target, i) => (
                                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
                                            <span
                                                ref={el => { letterRefs.current[i] = el; }}
                                                className={`fc-gaze-letter ${isPhrase ? 'is-word' : ''} ${scannedLetters.has(i) ? 'is-scanned' : ''}`}
                                            >
                                                {target}
                                            </span>
                                            {isPhrase && i < targets.length - 1 && <span className="fc-gaze-space">&nbsp;</span>}
                                        </span>
                                    ))}
                                </div>
                                <div className="fc-gaze-prompt">
                                    {allScanned ? t.vocab.gaze.scanComplete : t.vocab.gaze.scanPrompt}
                                </div>
                                <div className="fc-gaze-tracker-row">
                                    <span className="fc-gaze-tracker-badge">
                                        {activeTracking === 'eye' ? t.vocab.gaze.trackingEye : t.vocab.gaze.trackingMouse}
                                    </span>
                                </div>
                            </>
                        )}

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
                    </div>

                    {/* Back face — meaning (same as FlashcardMode) */}
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

            <div className={`fc-rating-row${!isFlipped ? ' locked' : ''}`}>
                {RATING_INFO.map((info, i) => (
                    <button
                        key={info.id}
                        type="button"
                        ref={el => { ratingRefs.current[i] = el; }}
                        className={`fc-btn ${info.cls}`}
                        onClick={() => onRating(info.id)}
                        disabled={!isFlipped || submitting}
                    >
                        <span className="btn-label">{info.label}</span>
                        <span className="btn-key">[{info.key}]</span>
                        <span className="btn-interval">{estimateInterval(currentCard, info.id)}</span>
                    </button>
                ))}
            </div>
            <div className="fc-kb-hint">
                {t.vocab.ratingHint}
            </div>
        </>
    );
}
