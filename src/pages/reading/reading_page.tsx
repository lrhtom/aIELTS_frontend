import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { showConfirm } from '../../components/common/ConfirmService';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createReadingState } from '../../store/reading_page_store';
import type { VocabItem, QuizData, FullQuizData, FullPassage, FullPassageSection, Question } from '../../store/reading_page_store';
import type { ReadingQuestionType, ReadingJudgementMode } from '../../store/reading_page_store';
import { api } from '../../api/client';
import { showToast } from '../../components/common/Toast';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import ReadingQuestionRenderer, { scoreSection, isQuestionCorrect } from '../../components/reading/ReadingQuestionRenderer';
import ReadingPassageBlock from '../../components/reading/ReadingPassageBlock';
import { rawToBand, formatBand } from '../../utils/ielts_band';
import { resolveAnswerSentences } from '../../utils/answer_sentences';
import { applyPaneWidth, watchPaneFreezeMin } from '../../utils/pane_resize';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PracticeBottomBar, { type PracticeNavLabels } from '../../components/common/PracticeBottomBar';
import { MockTimerBar } from '../../components/mock/MockExamShell';
import { useMockExamGuard } from '../../components/mock/useMockExamGuard';
import '../../styles/reading_page.css';

// Custom prompt instructions (advanced, optional)
export default function ReadingPageWrapper() {
    return (
        <ErrorBoundary>
            <Reading_page />
        </ErrorBoundary>
    );
}

function Reading_page() {
    const { state } = useLocation();
    const [searchParams] = useSearchParams();
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    // Question data comes from AI generation or legacy bank records, so field drift cannot be fully prevented - on error degrade to a local notice rather than a blank page
    const mockIdParam = searchParams.get('mockId');
    const mockId = mockIdParam ? Number(mockIdParam) : null;
    const vocabInput: string = state?.vocabInput ?? '';
    const difficulty: string = state?.difficulty ?? '7.0';
    const navigate = useNavigate();
    const onReturnHome = () => navigate(mockId ? `/mock/${mockId}` : (bankId ? '/practice/ai/bank' : '/'));
    const { t } = useLang();
    const absurdMode: boolean = Boolean(state?.absurdMode);
    const mode: 'single' | 'full' = state?.mode === 'full' ? 'full' : 'single';
    const questionType: ReadingQuestionType = state?.questionType || 'multiple_choice';
    const judgementMode: ReadingJudgementMode = state?.judgementMode === 'easy' ? 'easy' : 'normal';
    const topic: string = state?.topic || 'random';
    const wordCountMin: number = state?.wordCountMin ?? 1;
    const wordCountMax: number = state?.wordCountMax ?? 3;
    const fullScope: 'all' | 'single' = state?.fullScope === 'single' ? 'single' : 'all';
    const passageNum: number | undefined = state?.passageNum;
    const mixTypes: string[] | undefined = Array.isArray(state?.mixTypes) ? state.mixTypes : undefined;
    const customName: string = typeof state?.customName === 'string' ? state.customName.trim() : '';
    const customDescription: string = typeof state?.customDescription === 'string' ? state.customDescription.trim() : '';
    const customPrompt: string = typeof state?.customPrompt === 'string' ? state.customPrompt.trim() : '';

    // Full mock: mockId present -> exam mode (timed + exit guard + submit returns to the hub)
    // On a cold start (typed URL / refresh / bookmark / automation tool) location.state is empty.
    // This used to fall straight through to generateReading(), firing a **paid** AI generation with default
    const [noConfig, setNoConfig] = useState(false);

    // parameters, so one refresh silently burned thousands of AT. It now renders a landing page back to the config page.
    const [st, setSt] = useState(createReadingState);
    const set = <K extends keyof typeof st>(k: K, v: typeof st[K]) =>
        setSt(s => ({ ...s, [k]: v }));

    // DOM refs
    const userAnswersRef = useRef<Record<number, string>>({});
    const hasRequested = useRef(false);
    const leftSidebarRef = useRef<HTMLDivElement | null>(null);
    const rightSidebarRef = useRef<HTMLDivElement | null>(null);
    const layoutRef = useRef<HTMLDivElement | null>(null);
    const floatBtnRef = useRef<HTMLDivElement | null>(null);
    const activeEditorRef = useRef<HTMLElement | null>(null);

    const CACHE_KEY = 'reading_session_cache';

    // a single useState replaces the reactive store
    // -- Full mock exam mode --
    const isMockActive = mockId !== null && st.step === 2 && !st.isLoading;
    const { confirmExit: mockConfirmExit } = useMockExamGuard({
        mockId: mockId ?? 0,
        part: 'reading',
        active: isMockActive,
    });
    const MOCK_DRAFT_KEY = mockId ? `mock:${mockId}:reading:answers` : '';
    // The exit guard is armed while answering (step 2) and lifted after submit / view results (step 3).
    useEffect(() => {
        if (!isMockActive || !MOCK_DRAFT_KEY) return;
        const timer = setInterval(() => {
            try {
                localStorage.setItem(MOCK_DRAFT_KEY, JSON.stringify(userAnswersRef.current));
            } catch { /* Auto-save the draft so progress survives a refresh (the deadline lives on the server, so timing is unaffected) */ }
        }, 4000);
        return () => clearInterval(timer);
    }, [isMockActive, MOCK_DRAFT_KEY]);

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        // a full quota or other storage error must not block answering
        if (bankId) {
            sessionStorage.removeItem(CACHE_KEY);
            setSt(createReadingState());
            loadFromBank(bankId);
            return;
        }

        // Bank mode: fetch by bankId from the backend, never call AI generation
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { quizData: cachedQuiz, vocabList: cachedVocab } = JSON.parse(cached);
                setSt(s => ({ ...s, quizData: cachedQuiz, vocabList: cachedVocab, isLoading: false }));
                return; // Refresh recovery: prefer the cached data in sessionStorage
            } catch {
                sessionStorage.removeItem(CACHE_KEY);
            }
        }

        // skip AI generation
        if (!state) {
            setNoConfig(true);
            return;
        }

        setSt(createReadingState());
        generateReading();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // No config means no generation: empty state proves we did not come from the config page
    const restoreMockDraft = (): Record<number, string> => {
        if (!MOCK_DRAFT_KEY) return {};
        try {
            const raw = localStorage.getItem(MOCK_DRAFT_KEY);
            if (raw) return JSON.parse(raw) as Record<number, string>;
        } catch { /* mock refresh recovery: with no server-side answers, resume from the local draft */ }
        return {};
    };

    const loadFromBank = async (id: number) => {
        set('isLoading', true);
        try {
            const detail = await getAIQuestion(id);
            const content = (detail.content || {}) as Partial<QuizData> & Partial<FullQuizData>;
            const isFull = content.questionType === 'full' || Array.isArray((content as FullQuizData).passages);
            if (isFull) {
                const fullContent = content as FullQuizData;
                if (!Array.isArray(fullContent.passages) || fullContent.passages.length === 0) {
                    showToast(t('aiBank.toastMissingContent'), 'error');
                    navigate('/practice/ai/bank');
                    return;
                }
                setSt(s => ({
                    ...s,
                    quizData: null,
                    fullData: {
                        title: fullContent.title || 'Reading Full Test',
                        topic: fullContent.topic,
                        questionType: 'full',
                        singlePassage: Boolean(fullContent.singlePassage),
                        passages: fullContent.passages,
                    },
                    activePassage: fullContent.passages[0]?.passageNum ?? 1,
                    vocabList: [],
                    isLoading: false,
                    searchQuery: '',
                    isLeftOpen: false,
                    isRightOpen: true,
                    startTime: Date.now(),
                    elapsedSeconds: 0,
                    step: 2,
                }));
                const saved = (detail.userAnswer || null) as Record<number, string> | null;
                if (saved && typeof saved === 'object') {
                    userAnswersRef.current = { ...saved };
                    setSt(s => ({ ...s, step: 3 }));
                } else {
                    userAnswersRef.current = mockId ? restoreMockDraft() : {};
                }
                return;
            }
            if (!content.passage || !Array.isArray(content.questions)) {
                showToast(t('aiBank.toastMissingContent'), 'error');
                navigate('/practice/ai/bank');
                return;
            }
            const normalizedQuizData: QuizData = {
                title: content.title || 'Reading Passage',
                passage: content.passage,
                questions: content.questions,
                questionType: content.questionType || 'multiple_choice',
                judgementMode: content.judgementMode ?? null,
                topic: content.topic,
                headings_bank: content.headings_bank,
                paragraph_labels: content.paragraph_labels,
                features_bank: content.features_bank,
                endings_bank: content.endings_bank,
                summary_intro: content.summary_intro,
                summary_text: content.summary_text,
                word_bank: content.word_bank,
                note_intro: content.note_intro,
                note_content: content.note_content,
                layout: content.layout,
                wordLimit: content.wordLimit,
            } as QuizData;
            setSt(s => ({
                ...s,
                quizData: normalizedQuizData,
                fullData: null,
                vocabList: [],
                isLoading: false,
                searchQuery: '',
                isLeftOpen: false,
                isRightOpen: true,
                startTime: Date.now(),
                elapsedSeconds: 0,
                step: 2,
            }));

            const saved = (detail.userAnswer || null) as Record<number, string> | null;
            if (saved && typeof saved === 'object') {
                userAnswersRef.current = { ...saved };
                setSt(s => ({ ...s, step: 3 }));
            } else {
                userAnswersRef.current = mockId ? restoreMockDraft() : {};
            }
        } catch (err: unknown) {
            console.error('Bank load error:', err);
            showToast(t('aiBank.loadFail'), 'error');
            navigate('/practice/ai/bank');
        } finally {
            set('isLoading', false);
        }
    };

    const generateReading = async () => {
        set('isLoading', true);
        // treat a corrupted draft as empty
        const parsedList: VocabItem[] = vocabInput.trim().split('\n').map(line => {
            const parts = line.split(/[-:]/);
            return {
                word: parts[0] ? parts[0].trim() : '',
                meaning: parts[1] ? parts[1].trim() : ''
            };
        }).filter(item => item.word).sort((a, b) => a.word.localeCompare(b.word));

        set('vocabList', parsedList);
        const words = parsedList.map(v => v.word);

        try {
            // Backend returns 202 { aiQuestionId, status: 'generating' } instantly and runs
            // the AI call on a background daemon thread. We navigate straight to the bank —
            // the row shows as a "generating" card until the worker flips status → 'ready'.
            let parsedData: { aiQuestionId?: number | null; status?: string };
            if (mode === 'full') {
                const body: Record<string, unknown> = {
                    difficulty,
                    absurdMode,
                    topic,
                };
                if (fullScope === 'single' && passageNum) {
                    body.passageNum = passageNum;
                    if (mixTypes && mixTypes.length > 0) body.mixTypes = mixTypes;
                }
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                if (customPrompt) body.customPrompt = customPrompt;
                parsedData = await api('/reading/full', { method: 'POST', body });
            } else {
                const body: Record<string, unknown> = {
                    words,
                    difficulty,
                    absurdMode,
                    questionType,
                    judgementMode,
                    topic,
                    wordCountMin,
                    wordCountMax,
                };
                if (customName) body.customName = customName;
                if (customDescription) body.customDescription = customDescription;
                if (customPrompt) body.customPrompt = customPrompt;
                parsedData = await api('/reading/generate', {
                    method: 'POST',
                    body,
                });
            }

            sessionStorage.removeItem(CACHE_KEY);
            const justId = parsedData.aiQuestionId ?? null;
            showToast(t('aiBank.toastGeneratedSaved'), 'success');
            navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            return;
        } catch (err: unknown) { // Changed 'any' to 'unknown'
            console.error("API Error:", err);
            const error = err as { message?: string, status?: number }; // Cast to a type that might have message and status
            const code = error.status ?? (err instanceof TypeError ? 'NET' : undefined);
            showToast(error.message || t('readingDetails.toastReqFail'), 'error', code);
            onReturnHome();
        } finally {
            set('isLoading', false);
        }
    };

    const toggleHighlightsPureDOM = () => {
        const pageEl = document.getElementById('reading-page-container');
        const btnEl = document.getElementById('highlight-toggle-btn');
        if (pageEl && btnEl) {
            const isHidden = pageEl.classList.contains('hide-highlights');
            if (isHidden) {
                pageEl.classList.remove('hide-highlights');
                btnEl.innerText = t('readingDetails.hideTargets');
                btnEl.classList.remove('active');
            } else {
                pageEl.classList.add('hide-highlights');
                btnEl.innerText = t('readingDetails.showTargets');
                btnEl.classList.add('active');
            }
        }
    };

    const submitQuiz = async (forced = false) => {
        // Total question count spans full-test passages OR single quiz.
        let totalQuestions = 0;
        if (st.fullData) {
            for (const p of (st.fullData.passages || [])) {
                for (const sec of (p.sections || [])) {
                    totalQuestions += (sec.questions || []).length;
                }
            }
        } else if (st.quizData) {
            totalQuestions = (st.quizData.questions || []).length;
        } else {
            return;
        }
        const answeredQuestions = Object.values(userAnswersRef.current).filter(v => String(v).trim().length > 0).length;
        if (!forced && answeredQuestions < totalQuestions) {
            if (!(await showConfirm(t('readingDetails.submitConfirm')))) return;
        }

        // parse the vocabulary
        if (bankId && mockId) {
            const sectionsToScore: (FullPassageSection | QuizData)[] = st.fullData
                ? (st.fullData.passages || []).flatMap(p => p.sections || [])
                : (st.quizData ? [st.quizData] : []);
            let correct = 0, total = 0;
            for (const sec of sectionsToScore) {
                const r = scoreSection(sec, getAnswer);
                correct += r.correct;
                total += r.total;
            }
            const band = rawToBand('reading', correct, total) ?? 0;
            try {
                await submitAIQuestion(bankId, { ...userAnswersRef.current }, { correct, total, band });
            } catch (err) {
                console.error('mock submit failed:', err);
                showToast(t('readingDetails.toastSaveFail'), 'error');
                if (!forced) return; // mock mode: on submit, write the score (raw + band) into aiFeedback synchronously for the hub and report to read
            }
            if (MOCK_DRAFT_KEY) localStorage.removeItem(MOCK_DRAFT_KEY);
            showToast(t('mock.examMode.submittedToHub'), 'success');
            navigate(`/mock/${mockId}`, { replace: true });
            return;
        }

        if (bankId) {
            submitAIQuestion(bankId, { ...userAnswersRef.current }).catch(err => {
                console.error('submit to bank failed:', err);
                showToast(t('readingDetails.toastSaveFail'), 'error');
            });
        }
        set('step', 3);
    };

    const restartFromBank = () => {
        userAnswersRef.current = {};
        setSt(s => ({
            ...s,
            step: 2,
            startTime: Date.now(),
            elapsedSeconds: 0,
        }));
    };

    // Timer helper
    const formatTime = useCallback((totalSeconds: number) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return {
            h: String(h).padStart(2, '0'),
            m: String(m).padStart(2, '0'),
            s: String(s).padStart(2, '0'),
        };
    }, []);

    // Timer tick effect
    useEffect(() => {
        if (st.step !== 2 || st.isLoading || !st.startTime) return;
        const interval = setInterval(() => {
            set('elapsedSeconds', Math.floor((Date.now() - st.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [st.step, st.isLoading, st.startTime]);

    // Resizer Logic
    useEffect(() => {
        if (st.step !== 2 || st.isLoading) return;
        const resizerL = document.getElementById('resizerLeft');
        const resizerR = document.getElementById('resizerRight');
        let isResizingLeft = false, isResizingRight = false, startX = 0, startWidth = 0;

        const handleMouseDownLeft = (e: MouseEvent) => {
            isResizingLeft = true; startX = e.clientX;
            if (leftSidebarRef.current) startWidth = leftSidebarRef.current.getBoundingClientRect().width;
            if (layoutRef.current) layoutRef.current.classList.add('is-resizing');
            if (resizerL) resizerL.classList.add('resizing');
        };

        const handleMouseDownRight = (e: MouseEvent) => {
            isResizingRight = true; startX = e.clientX;
            if (rightSidebarRef.current) startWidth = rightSidebarRef.current.getBoundingClientRect().width;
            if (layoutRef.current) layoutRef.current.classList.add('is-resizing');
            if (resizerR) resizerR.classList.add('resizing');
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizingLeft && !isResizingRight) return;
            // a failed manual submit stays on the page to retry; a timeout force-submit leaves anyway
            // Both dividers can be dragged the full 0-100%; below 30% the pane's text lays out at 30% and is clipped,
            const layout = layoutRef.current;
            if (isResizingLeft) {
                applyPaneWidth(leftSidebarRef.current, startWidth + (e.clientX - startX), layout);
            } else if (isResizingRight) {
                applyPaneWidth(rightSidebarRef.current, startWidth - (e.clientX - startX), layout);
            }
        };

        const handleMouseUp = () => {
            if (isResizingLeft || isResizingRight) {
                // @ts-expect-error window globals
                window.__didDragSidebar = true;
                // so there is no need to clamp the dividers as well (see utils/pane_resize.ts).
                if (isResizingLeft && leftSidebarRef.current) leftSidebarRef.current.classList.add('no-transition');
                if (isResizingRight && rightSidebarRef.current) rightSidebarRef.current.classList.add('no-transition');
                isResizingLeft = false; isResizingRight = false;
                if (layoutRef.current) layoutRef.current.classList.remove('is-resizing');
                if (resizerL) resizerL.classList.remove('resizing');
                if (resizerR) resizerR.classList.remove('resizing');
                // @ts-expect-error window globals
                setTimeout(() => { window.__didDragSidebar = false; }, 200);
            }
        };

        const stopWatchFreeze = watchPaneFreezeMin(layoutRef.current, [
            leftSidebarRef.current,
            layoutRef.current?.querySelector<HTMLElement>('.main-content'),
            rightSidebarRef.current,
        ]);
        resizerL?.addEventListener('mousedown', handleMouseDownLeft);
        resizerR?.addEventListener('mousedown', handleMouseDownRight);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            stopWatchFreeze();
            resizerL?.removeEventListener('mousedown', handleMouseDownLeft);
            resizerR?.removeEventListener('mousedown', handleMouseDownRight);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [st.step, st.isLoading]);

    // Floating Underline Logic
    useEffect(() => {
        if (st.step !== 2 || st.isLoading) return;
        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (layoutRef.current?.classList.contains('is-resizing')) return;
            const target = e.target as HTMLElement;
            const isArticle = target.closest('#articleContent');
            const isQuestions = target.closest('#questionsForm');

            if (!isArticle && !isQuestions) {
                if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
                return;
            }

            const selection = window.getSelection();
            const selectedText = selection?.toString().trim() || '';

            if (selectedText.length > 0) {
                activeEditorRef.current = isArticle ? document.getElementById('articleContent') : document.getElementById('questionsForm');
                if (floatBtnRef.current) {
                    floatBtnRef.current.classList.add('visible');
                    floatBtnRef.current.style.left = (e.pageX + 15) + 'px';
                    floatBtnRef.current.style.top = (e.pageY - 40) + 'px';
                }
            } else {
                if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
            }
        };

        const handleGlobalMouseDown = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target !== floatBtnRef.current && !target.classList.contains('resizer')) {
                if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
            }
        };

        document.body.addEventListener('mouseup', handleGlobalMouseUp);
        document.addEventListener('mousedown', handleGlobalMouseDown);
        return () => {
            document.body.removeEventListener('mouseup', handleGlobalMouseUp);
            document.removeEventListener('mousedown', handleGlobalMouseDown);
        };
    }, [st.step, st.isLoading]);

    const executeUnderline = () => {
        if (!activeEditorRef.current) return;
        activeEditorRef.current.contentEditable = 'true';
        document.execCommand('underline', false, '');
        activeEditorRef.current.contentEditable = 'false';
        if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
        window.getSelection()?.removeAllRanges();
    };

    // Resizer for results passage sidebar
    useEffect(() => {
        const sidebar = document.getElementById('passageSidebar');
        if (!st.isPassageOpen) {
            if (sidebar) sidebar.style.width = '';
            return;
        }
        if (st.step !== 3) return;
        const resizer = document.getElementById('resizerPassage');
        const layout = document.getElementById('resultsLayout');
        if (!resizer || !sidebar || !layout) return;

        let isResizing = false, startX = 0, startWidth = 0;
        // disable the transition once dragging ends to stop it jumping
        const content = layout.querySelector<HTMLElement>('.results-content');
        const stopWatchFreeze = watchPaneFreezeMin(layout, [sidebar, content]);

        const onMouseDown = (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            layout.classList.add('is-resizing');
            resizer.classList.add('resizing');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            // Allow dragging across the full 0-100%; what prevents 'dragged too narrow to read' is the layout freeze, not clamping the divider
            // The passage pane is on the **right** (2026-07-27 redesign: answers left, passage right), so dragging right
            applyPaneWidth(sidebar, startWidth - (e.clientX - startX), layout);
        };
        const onMouseUp = () => {
            if (isResizing) {
                isResizing = false;
                layout.classList.remove('is-resizing');
                resizer.classList.remove('resizing');
            }
        };

        resizer.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        return () => {
            stopWatchFreeze();
            resizer.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [st.step, st.isPassageOpen]);

    // Answer helpers used by the renderer
    const [answerVersion, setAnswerVersion] = useState(0);
    // narrows it and dragging left widens it - the delta must be negated. With a plus sign it feels inverted.
    // answerVersion must be in the deps. Answers live in a ref, and the React Compiler (enabled in
    // vite.config.ts) cannot see in-place ref mutation; as long as getAnswer's identity is stable the compiler
    // decides the downstream <ReadingQuestionRenderer> / <MatchingLetterGrid> inputs are unchanged and replays
    // cached JSX. The symptom: clicking a matching question really does store the answer and the bottom bar lights
    const getAnswer = useCallback((qid: number) => userAnswersRef.current[qid] || '', [answerVersion]);
    const setAnswer = useCallback((qid: number, value: string) => {
        userAnswersRef.current[qid] = value;
        setAnswerVersion(v => v + 1);
    }, []);

    // Active passage for full-test view
    const activePassageData: FullPassage | null = st.fullData
        ? ((st.fullData.passages || []).find(p => p.passageNum === st.activePassage) || (st.fullData.passages || [])[0] || null)
        : null;

    // up as answered, but the cell never shows as selected (reproduced 2026-07-27). Tie the identity to the version so the downstream cache invalidates.
    // -- Bottom bar data --
    const navQuestionIds = useMemo<number[]>(() => {
        if (st.fullData && activePassageData) {
            return (activePassageData.sections || []).flatMap(sec => (sec.questions || []).map(q => q.id));
        }
        return (st.quizData?.questions || []).map(q => q.id);
    }, [st.quizData, st.fullData, activePassageData]);

    // Pills show the real q.id (under full-test Passage 2 = 14..26, matching the numbers printed on the questions)
    const navAnsweredIds = useMemo<Set<number>>(() => {
        void answerVersion; // answerVersion is the re-render beat for the uncontrolled answersRef, so the answered set recomputes after each answer
        const s = new Set<number>();
        for (const [k, v] of Object.entries(userAnswersRef.current)) {
            if (String(v ?? '').trim()) s.add(Number(k));
        }
        return s;
    }, [answerVersion]);

    const navOverviewParts = useMemo(() => {
        if (!st.fullData) return undefined;
        return (st.fullData.passages || []).map(p => ({
            label: `Passage ${p.passageNum}`,
            questionIds: (p.sections || []).flatMap(sec => (sec.questions || []).map(q => q.id)),
            active: p.passageNum === st.activePassage,
        }));
    }, [st.fullData, st.activePassage]);

    // answers live in a ref, so this tick triggers the recompute
    // Memoized blocks - Part switching moved to the bottom bar (click a collapsed Passage label),
    const articleMemoBlock = useMemo(() => {
        return st.fullData && activePassageData
            ? <ReadingPassageBlock title={activePassageData.title} passage={activePassageData.passage} />
            : (st.quizData ? <ReadingPassageBlock title={st.quizData.title} passage={st.quizData.passage} /> : null);
    }, [st.quizData, st.fullData, activePassageData]);

    const questionsMemoBlock = useMemo(() => {
        // Full-test: render each section for the active passage
        if (st.fullData && activePassageData) {
            return (
                <div id="questionsForm" style={{ outline: 'none' }} onContextMenu={e => e.preventDefault()}>
                    {(activePassageData.sections || []).map((sec, idx) => (
                        <div key={idx} className="full-section-block">
                            <h4 className="full-section-heading">
                                Questions {sec.startId}-{sec.endId}
                                <span style={{ marginLeft: 8, opacity: 0.7, fontWeight: 400 }}>{(sec.questionType || '').replace(/_/g, ' ')}</span>
                            </h4>
                            <ReadingQuestionRenderer section={sec} getAnswer={getAnswer} onAnswer={setAnswer} />
                        </div>
                    ))}
                </div>
            );
        }
        if (!st.quizData) return null;
        return (
            <div id="questionsForm" style={{ outline: 'none' }} onContextMenu={e => e.preventDefault()}>
                <ReadingQuestionRenderer section={st.quizData} getAnswer={getAnswer} onAnswer={setAnswer} />
            </div>
        );
        // answerVersion in deps to force re-render on answer change
    }, [st.quizData, st.fullData, activePassageData, getAnswer, setAnswer, answerVersion]);

    // so the passage column no longer renders tabs at the top.
    if (noConfig) {
        return (
            <div className="reading-container">
                <div className="page rp-noconfig">
                    <div className="rp-noconfig-icon" aria-hidden="true">📖</div>
                    <h2 className="rp-noconfig-title">{t('readingDetails.noConfigTitle')}</h2>
                    <p className="rp-noconfig-desc">{t('readingDetails.noConfigDesc')}</p>
                    <div className="rp-noconfig-actions">
                        <button className="rp-noconfig-primary" onClick={() => navigate('/practice/ai/reading')}>
                            {t('readingDetails.noConfigGoConfig')}
                        </button>
                        <button className="rp-noconfig-secondary" onClick={() => navigate('/practice/ai/bank?skill=reading')}>
                            {t('readingDetails.noConfigGoBank')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Loading State
    if (st.isLoading) {
        return (
            <div className="reading-container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">{t('readingDetails.writingPassage')}</div>
                </div>
            </div>
        );
    }

    // Page 2: Reading Interface
    if (st.step === 2 && (st.quizData || st.fullData)) {
        const filteredVocab = st.vocabList.filter(v =>
            v.word.toLowerCase().includes(st.searchQuery.toLowerCase()) ||
            v.meaning.toLowerCase().includes(st.searchQuery.toLowerCase())
        );
        // No-config landing page: a cold start renders this instead of silently charging the user
        const questionPanelTitle = st.fullData
            ? null
            : (st.quizData!.questionType === 'true_false'
                ? (st.quizData!.judgementMode === 'easy' ? t('readingDetails.questionsTrueFalseEasy') : t('readingDetails.questionsTrueFalseNormal'))
                : t('readingDetails.questionsMcq'));

        return (
            <div className="reading-container">
                {mockId !== null && (
                    <MockTimerBar
                        mockId={mockId}
                        part="reading"
                        onExpire={() => submitQuiz(true)}
                        onRejected={(msg) => {
                            showToast(t('mock.examMode.startRejected').replace('{msg}', msg), 'error');
                            navigate(`/mock/${mockId}`, { replace: true });
                        }}
                    />
                )}
                <div id="floatUnderlineBtn" ref={floatBtnRef} onMouseDown={(e) => e.preventDefault()} onClick={executeUnderline}>
                    <u>U</u> {t('readingDetails.underline')}
                </div>

                <div id="reading-page-container" className="page">
                    <div className="toolbar-area">
                        <div className="toolbar-left-group">
                            <button className={`toolbar-btn ${st.isLeftOpen ? 'active' : ''}`} onClick={() => { if ((window as any).__didDragSidebar) return; if (leftSidebarRef.current) { leftSidebarRef.current.classList.remove('no-transition'); leftSidebarRef.current.style.width = ''; } set('isLeftOpen', !st.isLeftOpen); }}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                                <span className="btn-icon">📚</span> {t('readingDetails.dictionary')}
                            </button>
                            <button className={`toolbar-btn ${st.isRightOpen ? 'active' : ''}`} onClick={() => { if ((window as any).__didDragSidebar) return; if (rightSidebarRef.current) { rightSidebarRef.current.classList.remove('no-transition'); rightSidebarRef.current.style.width = ''; } set('isRightOpen', !st.isRightOpen); }}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                                <span className="btn-icon">📝</span> {t('readingDetails.questions')}
                            </button>
                        </div>
                        <div className="reading-timer">
                            <span className="timer-icon">⏱️</span>
                            {formatTime(st.elapsedSeconds).h !== '00' && (
                                <span className="timer-digit">
                                    {formatTime(st.elapsedSeconds).h}<span className="timer-unit">h</span>
                                </span>
                            )}
                            <span className="timer-digit">
                                {formatTime(st.elapsedSeconds).m}<span className="timer-unit">m</span>
                            </span>
                            <span className="timer-digit">
                                {formatTime(st.elapsedSeconds).s}<span className="timer-unit">s</span>
                            </span>
                        </div>
                        <div className="toolbar-right-group">
                            <button
                                id="highlight-toggle-btn"
                                className="toolbar-btn toolbar-btn-outline"
                                onClick={toggleHighlightsPureDOM}
                            >
                                <span className="btn-icon">💡</span> {t('readingDetails.hideTargets')}
                            </button>
                        </div>
                    </div>

                    <div className="reading-layout" ref={layoutRef}>
                        {/* Left Sidebar */}
                        <div id="leftSidebar" ref={leftSidebarRef} className={`reading-sidebar ${st.isLeftOpen ? 'open' : ''}`}>
                            <h2 style={{ marginTop: 0 }}>{t('readingDetails.dictionary')}</h2>
                            <input
                                type="text" id="vocabSearch" placeholder={t('readingDetails.searchPlaceholder')}
                                value={st.searchQuery} onChange={(e) => set('searchQuery', e.target.value)}
                            />
                            <div>
                                {filteredVocab.map((v, idx) => (
                                    <p key={idx}>
                                        <strong>{v.word}</strong><br />
                                        <span style={{ fontSize: '14px', color: '#555' }}>{v.meaning}</span>
                                    </p>
                                ))}
                            </div>
                        </div>

                        <div className={`resizer ${st.isLeftOpen ? 'active' : ''}`} id="resizerLeft"></div>
                        {articleMemoBlock}
                        <div className={`resizer ${st.isRightOpen ? 'active' : ''}`} id="resizerRight"></div>

                        {/* Right Sidebar */}
                        <div id="rightSidebar" ref={rightSidebarRef} className={`reading-sidebar ${st.isRightOpen ? 'open' : ''}`}>
                            {questionPanelTitle && <h2 style={{ marginTop: 0, textAlign: 'center', fontWeight: 700 }}>{questionPanelTitle}</h2>}
                            {questionsMemoBlock}
                        </div>
                    </div>

                    <PracticeBottomBar
                        questionIds={navQuestionIds}
                        answeredIds={navAnsweredIds}
                        scrollContainerId="questionsForm"
                        onSubmit={() => submitQuiz()}
                        onExit={async () => {
                            // A full test no longer shows the 'Full Test' panel title - the bottom bar carries the Part information
                            if (mockId) {
                                await mockConfirmExit();
                                return;
                            }
                            if (await showConfirm(t('readingDetails.exitConfirm'))) {
                                onReturnHome();
                            }
                        }}
                        submitLabel={t('readingDetails.submitBtn')}
                        exitLabel={t('readingDetails.exitBtn')}
                        navLabels={(t('readingDetails.questionNav', { returnObjects: true }) as { jumpTo: string; progress: string; barLabel: string })}
                        overviewParts={navOverviewParts}
                        onPartSelect={i => {
                            const p = st.fullData?.passages?.[i];
                            if (p) set('activePassage', p.passageNum);
                        }}
                    />
                </div>
            </div>
        );
    }

    // Page 3: Results
    if (st.step === 3 && (st.quizData || st.fullData)) {
        // Collect all sections to score
        const sectionsToScore: (FullPassageSection | QuizData)[] = st.fullData
            ? (st.fullData.passages || []).flatMap(p => p.sections || [])
            : [st.quizData!];
        let score = 0, total = 0;
        for (const sec of sectionsToScore) {
            const r = scoreSection(sec, getAnswer);
            score += r.correct;
            total += r.total;
        }
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        // mock mode: exiting scores 0, so go through the guard's confirm + forfeit flow
        const band = st.fullData && !st.fullData.singlePassage ? rawToBand('reading', score, total) : null;

        // Which passages to show for the "show passage" sidebar
        // A full paper (3 passages, 40 questions) also gets the 9-band conversion; a single passage does not qualify
        // Single-passage mode wraps quizData into a one-section passage: leaving sections empty means the
        const passageBlocks = st.fullData
            ? (st.fullData.passages || [])
            : [{
                passageNum: 1,
                title: st.quizData!.title,
                passage: st.quizData!.passage,
                topic: st.quizData!.topic,
                sections: [st.quizData as unknown as FullPassageSection],
            }];

        // per-passage answer lookup below finds nothing and the answer sentences never get highlighted in the text.
        // With all 3 passages, switch by passage: the explanations and text show only the current one, so 40 questions
        const isMultiPassage = Boolean(st.fullData) && passageBlocks.length > 1;
        const activeResultPassage = isMultiPassage
            ? (passageBlocks.some(pb => pb.passageNum === st.activePassage)
                ? st.activePassage
                : passageBlocks[0].passageNum)
            : null;
        const shownPassages = activeResultPassage == null
            ? passageBlocks
            : passageBlocks.filter(pb => pb.passageNum === activeResultPassage);
        const shownSections: (FullPassageSection | QuizData)[] = activeResultPassage == null
            ? sectionsToScore
            : shownPassages.flatMap(pb => pb.sections || []);

        // laid out flat do not make it impossible to find a question or tell which passage it belongs to. Single or partial papers have no switcher and behave as before.
        const resultMarks = new Map<number, boolean>();
        const correctIds = new Set<number>();
        const resultParts = passageBlocks.map(pb => {
            const ids: number[] = [];
            for (const sec of (pb.sections || [])) {
                for (const q of (sec.questions || [])) {
                    ids.push(q.id);
                    const ok = isQuestionCorrect(q, getAnswer(q.id));
                    resultMarks.set(q.id, ok);
                    if (ok) correctIds.add(q.id);
                }
            }
            return {
                label: t('results.passageTab').replace('{n}', String(pb.passageNum)),
                questionIds: ids,
                active: activeResultPassage == null || pb.passageNum === activeResultPassage,
            };
        });
        const shownQuestionIds = resultParts.filter(p => p.active).flatMap(p => p.questionIds);

        // Flatten the shown sections into a review list
        const allQuestions: Array<{ q: Question; sec: FullPassageSection | QuizData }> = [];
        for (const sec of shownSections) {
            for (const q of (sec.questions || [])) allQuestions.push({ q, sec });
        }

        return (
            <div className="results-container">
                {/* Results Header */}
                <div className="results-header">
                    <div className="results-header-left">
                        <h1>{t('results.analysis')}</h1>
                        <p className="elapsed-time">
                            🕐 {formatTime(st.elapsedSeconds).h}h {formatTime(st.elapsedSeconds).m}m {formatTime(st.elapsedSeconds).s}s
                        </p>
                    </div>
                    <div className="results-header-right">
                        <div className="score-card">
                            <div className="score-number">{score}<span className="score-total">/{total}</span></div>
                            <div className="score-pct">{pct}%</div>
                        </div>
                        {band !== null && (
                            <div className="score-card score-band-card" title={t('results.estimatedBand')}>
                                <div className="score-band-label">{t('results.estimatedBand')}</div>
                                <div className="score-number">{formatBand(band)}<span className="score-total">/9</span></div>
                            </div>
                        )}
                        <div className="results-actions">
                            <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className={`toolbar-btn ${st.isPassageOpen ? 'active' : 'toolbar-btn-outline'}`}>
                            <span className="btn-icon">{st.isPassageOpen ? '📕' : '📖'}</span> {st.isPassageOpen ? t('results.hidePassage') : t('results.showPassage')}
                        </button>
                        {bankId && !mockId && (
                            // Bottom bar data: per-question correctness plus the question ids of every passage (including the collapsed columns)
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> {t('aiBank.redoBtn')}</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{mockId ? '🎯' : bankId ? '📚' : '🏠'}</span> {mockId ? t('mock.examMode.backToHub') : bankId ? t('aiBank.backToBank') : t('common.home')}</button>
                        </div>
                    </div>
                </div>

                {/* a mock child is locked in once submitted, no redo */}
                <div className="results-layout" id="resultsLayout">
                    {/* Analysis Content */}
                    <div className="results-content" id="readingResultsContent">
                        {allQuestions.map(({ q, sec }) => {
                            const userAns = getAnswer(q.id) || 'None';
                            const correctList: string[] = Array.isArray(q.answers)
                                ? (q.answers as unknown[]).map(a => (a == null ? '' : String(a)))
                                : (q.answer !== undefined ? [String(q.answer)] : []);
                            const isCorrect = resultMarks.get(q.id) ?? false;
                            const correctDisplay = correctList.join(' / ') || '—';
                            const questionText = q.question || (q.paragraph ? `Paragraph ${q.paragraph}` : '');

                            return (
                                // Results body - answers on the left, passage on the right
                                <div key={q.id} className="result-block" data-question-id={q.id}>
                                    <div className="question-text">
                                        {q.id}. {questionText.replace(/\*\*/g, '')}
                                        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>[{(sec.questionType || '').replace(/_/g, ' ')}]</span>
                                    </div>
                                    <p>{t('results.yourAnswer')}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t('results.correctAnswer')}: <strong>{correctDisplay}</strong></p>
                                    <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                        {isCorrect ? `✅ ${t('results.statusCorrect')}` : `❌ ${t('results.statusIncorrect')}`}
                                    </p>
                                    <div className="explanation">
                                        <strong>{t('results.explanation')}:</strong> {q.explanation}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Resizer */}
                    <div className={`resizer ${st.isPassageOpen ? 'active' : ''}`} id="resizerPassage"></div>

                    {/* data-question-id: the bottom bar uses it for jumps and scrollspy highlighting */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="passageSidebar">
                        <h3>{t('results.originalPassage')}</h3>
                        {shownPassages.map(pb => (
                            <ReadingPassageBlock
                                key={pb.passageNum}
                                title={pb.title}
                                passage={pb.passage}
                                idPrefix={`passage-${pb.passageNum}`}
                                // Passage sidebar (right)
                                answerMarks={resolveAnswerSentences(
                                    pb.passage,
                                    (pb.sections || []).flatMap(sec => sec.questions || []),
                                )}
                            />
                        ))}
                    </div>
                </div>

                {/* Locate against the whole passage but only with this passage's questions: across passages, another one's words get mis-highlighted here
                     Bottom bar - the same component as the answering page, only the cells and pills switch to correct/incorrect colours.
                    Placed **after** results-layout: .results-container is a 100vh flex column and the layout takes flex:1, */}
                <PracticeBottomBar
                    questionIds={shownQuestionIds}
                    answeredIds={correctIds}
                    resultMarks={resultMarks}
                    scrollContainerId="readingResultsContent"
                    navLabels={{
                        ...(t('readingDetails.questionNav', { returnObjects: true }) as PracticeNavLabels),
                        progress: t('results.partScore'),
                    }}
                    overviewParts={isMultiPassage ? resultParts : undefined}
                    onPartSelect={i => {
                        const pb = passageBlocks[i];
                        if (pb) set('activePassage', pb.passageNum);
                    }}
                />
            </div>
        );
    }

    return null;
}
