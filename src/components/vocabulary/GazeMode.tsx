import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    /** Returns the formatted absolute date (e.g. "06-25" / "今天") the card will next surface at after this rating. */
    previewNextDueLabel?: (card: VocabCard, rating: number) => string;
    simpleMode?: boolean;
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
    previewNextDueLabel,
    simpleMode,
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
    const pointerPosRef = useRef<{ x: number, y: number } | null>(null);
    const autoFlippedRef = useRef(false);
    
    const webgazerRef = useRef<WebGazerInstance | null>(null);
    const rafRef = useRef<number>(0);
    const scannedRef = useRef<Set<number>>(new Set());
    const unmountedRef = useRef<boolean>(false);

    useEffect(() => {
        unmountedRef.current = false;
        return () => {
            unmountedRef.current = true;
        };
    }, []);

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
        autoFlippedRef.current = false;
    }, [currentCard.word]);

    // Auto-flip when all letters scanned
    useEffect(() => {
        if (allScanned && !isFlipped && !submitting && gazeReady && !simpleMode && !autoFlippedRef.current) {
            autoFlippedRef.current = true;
            const timer = setTimeout(() => onFlip(), 400);
            return () => clearTimeout(timer);
        }
    }, [allScanned, isFlipped, submitting, gazeReady, onFlip, simpleMode]);

    const markLetterScanned = useCallback((index: number) => {
        if (scannedRef.current.has(index)) return;
        const next = new Set(scannedRef.current);
        next.add(index);
        scannedRef.current = next;
        setScannedLetters(next);
    }, []);

    // ── Eye tracking (WebGazer) Init ──
    const initEyeTracking = useCallback(async () => {
        if ((window as any)._webgazerInitializing) return;
        (window as any)._webgazerInitializing = true;

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
                .showFaceOverlay(false)
                .showFaceFeedbackBox(false)
                .showPredictionPoints(false) // Red dot retired, teal cursor takes over!
                .applyKalmanFilter(true) // Re-enable official Kalman filter for maximum accuracy
                .setGazeListener((data: any, _elapsedTime: number) => {
                    if (data) {
                        (window as any)._gazePos = { x: data.x, y: data.y };
                    } else {
                        (window as any)._gazePos = null;
                    }
                });

            webgazerRef.current = wg;

            // Start camera FIRST so WebGazer can track eyes
            await wg.begin();

            if (unmountedRef.current) {
                try {
                    wg.end();
                    const video = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
                    if (video && video.srcObject) {
                        const stream = video.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                    }
                    document.getElementById('webgazerVideoContainer')?.remove();
                    document.getElementById('webgazerGazeDot')?.remove();
                } catch (e) {
                    console.warn('Cleanup during init failed', e);
                }
                return;
            }

            const saved = sessionStorage.getItem(GAZE_STORAGE_KEY);
            if (!saved) {
                // Clear polluted historical data from IndexedDB to ensure fresh calibration
                try {
                    wg.clearData();
                } catch (e) {
                    console.warn('Failed to clear webgazer data', e);
                }

                // Calibration UI
                await new Promise<void>((resolve) => {
                    const overlay = document.createElement('div');
                    overlay.className = 'fc-gaze-calibration-overlay';
                    overlay.innerHTML = `
                        <div class="fc-gaze-calibration-card" style="max-width: 600px;">
                            <div class="fc-gaze-calibration-title">Precision Calibration</div>
                            <div class="fc-gaze-calibration-sub">Click each dot <b>3 times</b> while looking directly at it.</div>
                            <div class="fc-gaze-calibration-grid" id="gaze-calib-grid"></div>
                            <button class="fc-gaze-calibration-done" id="gaze-calib-done" disabled style="width: 100%; margin-top: 10px;">Start Tracking</button>
                        </div>
                    `;
                    document.body.appendChild(overlay);

                    const grid = overlay.querySelector('#gaze-calib-grid')!;
                    const positions = [
                        { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 },
                        { x: 10, y: 50 }, { x: 50, y: 50 }, { x: 90, y: 50 },
                        { x: 10, y: 90 }, { x: 50, y: 90 }, { x: 90, y: 90 },
                    ];

                    let completedDots = 0;
                    for (const pos of positions) {
                        const dot = document.createElement('div');
                        dot.className = 'fc-gaze-calibration-dot';
                        dot.style.left = `${pos.x}%`;
                        dot.style.top = `${pos.y}%`;
                        dot.style.transition = 'all 0.2s ease';
                        
                        let clickCount = 0;
                        dot.addEventListener('click', (e) => {
                            if (clickCount >= 3) return;
                            
                            // Feed coordinate to WebGazer
                            if (webgazerRef.current) {
                                try {
                                    webgazerRef.current.recordScreenPosition(e.clientX, e.clientY, 'click');
                                } catch (err) {
                                    console.warn('Failed to record click for webgazer', err);
                                }
                            }
                            
                            clickCount++;
                            
                            // Visual feedback
                            if (clickCount === 1) {
                                dot.style.transform = 'translate(-50%, -50%) scale(0.8)';
                                dot.style.background = '#FFC107'; // Yellow
                            } else if (clickCount === 2) {
                                dot.style.transform = 'translate(-50%, -50%) scale(0.6)';
                                dot.style.background = '#FF9800'; // Orange
                            } else if (clickCount === 3) {
                                dot.style.transform = 'translate(-50%, -50%) scale(0.5)';
                                dot.style.background = '#00D2A0'; // Teal (Done)
                                dot.style.opacity = '0.5';
                                dot.style.pointerEvents = 'none';
                                
                                completedDots++;
                                if (completedDots >= positions.length) {
                                    const doneBtn = overlay.querySelector('#gaze-calib-done') as HTMLButtonElement;
                                    if (doneBtn) doneBtn.disabled = false;
                                }
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
            }

            setGazeReady(true);
            setCalibrating(false);
            (window as any)._webgazerInitializing = false;
        } catch (err) {
            console.warn('WebGazer init failed, falling back to mouse', err);
            (window as any)._webgazerInitializing = false;
            setCalibrating(false);
            setActiveTracking('mouse');
            setGazeReady(true);
            setError(t.vocab.gaze.cameraDenied);
        }
    }, [t]);

    // Handle trackingMode prop changes from parent
    useEffect(() => {
        if (!initRef.current) return;
        setActiveTracking(trackingMode);
        
        if (trackingMode === 'eye') {
            // Always re-initialize and recalibrate when switching back
            initEyeTracking();
        } else {
            // Switch to mouse: shut down tracking AND the physical camera light
            try { 
                if (webgazerRef.current) {
                    webgazerRef.current.end();
                    // Manually kill the camera stream just to be absolutely sure
                    const video = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
                    if (video && video.srcObject) {
                        const stream = video.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                    }
                }
            } catch { }

            // Forget previous calibration so it forces the 9-dot UI next time
            sessionStorage.removeItem(GAZE_STORAGE_KEY);
            
            setGazeReady(true);
            setCalibrating(false);
            setError(null);
        }
    }, [trackingMode, initEyeTracking]);

    // Global Mouse Listener for mouse tracking mode
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            pointerPosRef.current = { x: e.clientX, y: e.clientY };
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    // Initialize tracking on mount
    const initRef = useRef(false);
    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;

        if (trackingMode === 'eye') {
            initEyeTracking();
        } else {
            setGazeReady(true);
        }

        return () => {
            initRef.current = false;
            (window as any)._smoothPos = null;
            document.querySelectorAll('.fc-gaze-calibration-overlay').forEach(el => el.remove());

            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = 0;
            }
            if (webgazerRef.current) {
                try { 
                    webgazerRef.current.end(); 
                    const video = document.getElementById('webgazerVideoFeed') as HTMLVideoElement;
                    if (video && video.srcObject) {
                        const stream = video.srcObject as MediaStream;
                        stream.getTracks().forEach(track => track.stop());
                        video.srcObject = null;
                    }
                } catch { }
                webgazerRef.current = null;
            }
            
            // Fix: Clean up dirty DOM elements injected by WebGazer so normal mode isn't affected
            document.getElementById('webgazerVideoContainer')?.remove();
            document.getElementById('webgazerGazeDot')?.remove();
            document.getElementById('webgazerFaceOverlay')?.remove();
            document.getElementById('webgazerFaceFeedbackBox')?.remove();
            
            // Per user request: require recalibration every time tracking is toggled back on
            sessionStorage.removeItem(GAZE_STORAGE_KEY);
        };
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

            if (px !== null && py !== null && (px !== 0 || py !== 0)) {
                if (!(window as any)._smoothPos) {
                    (window as any)._smoothPos = { x: px, y: py };
                }
                const lerpFactor = activeTracking === 'eye' ? 0.08 : 0.8;
                (window as any)._smoothPos.x += (px - (window as any)._smoothPos.x) * lerpFactor;
                (window as any)._smoothPos.y += (py - (window as any)._smoothPos.y) * lerpFactor;

                const renderX = (window as any)._smoothPos.x;
                const renderY = (window as any)._smoothPos.y;

                if (cursorRef.current) {
                    cursorRef.current.style.display = 'block';
                    cursorRef.current.style.transform = `translate(${renderX - 10}px, ${renderY - 10}px)`;
                }

                if (!isFlippedRef.current) {
                    for (let i = 0; i < targetCountRef.current; i++) {
                        if (scannedRef.current.has(i)) continue;
                        const el = letterRefs.current[i];
                        if (!el) continue;
                        const rect = el.getBoundingClientRect();
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
                                for (let j=0; j<RATING_INFO.length; j++) {
                                    if (ratingRefs.current[j]) ratingRefs.current[j]!.style.setProperty('--gaze-progress', `0%`);
                                }
                                ratingDwellRef.current = {};
                                pointerPosRef.current = null;
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
            <style>{`
                #webgazerVideoContainer {
                    opacity: 0 !important;
                    pointer-events: none !important;
                    z-index: -9999 !important;
                }
            `}</style>

            {gazeReady && createPortal(
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
                />,
                document.body
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
                    className={`fc-card ${isFlipped && !simpleMode ? 'is-flipped' : ''} ${isFlipping ? 'is-flipping' : ''} ${statusCls}`}
                    onClick={!simpleMode ? onFlip : undefined}
                >
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
                                {simpleMode && (
                                    <div className="fc-flashcard-meaning" style={{ marginTop: '20px', fontSize: '1.2rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                                        {currentCard.zh}
                                    </div>
                                )}
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

            <div className={`fc-rating-row${!isFlipped && !simpleMode ? ' locked' : ''}`}>
                {RATING_INFO.map((info, i) => (
                    <button
                        key={info.id}
                        type="button"
                        ref={el => { ratingRefs.current[i] = el; }}
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
