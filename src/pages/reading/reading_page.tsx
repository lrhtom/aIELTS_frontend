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
import ReadingQuestionRenderer, { scoreSection } from '../../components/reading/ReadingQuestionRenderer';
import ReadingPassageBlock from '../../components/reading/ReadingPassageBlock';
import { rawToBand, formatBand } from '../../utils/ielts_band';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import PracticeBottomBar from '../../components/common/PracticeBottomBar';
import { MockTimerBar } from '../../components/mock/MockExamShell';
import { useMockExamGuard } from '../../components/mock/useMockExamGuard';
import '../../styles/reading_page.css';

// 题目数据来自 AI 生成/题库旧记录，字段漂移不可完全预防——出错时降级为局部提示而不是整页白屏
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
    // 全套模拟：mockId 存在 → 考试模式（计时 + 防退出 + 交卷回大厅）
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

    // 用单一 useState 替代 reactive store
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

    // ── 全套模拟考试模式 ──
    // 作答中（step 2）开启防退出守卫；交卷/查看结果（step 3）后解除。
    const isMockActive = mockId !== null && st.step === 2 && !st.isLoading;
    const { confirmExit: mockConfirmExit } = useMockExamGuard({
        mockId: mockId ?? 0,
        part: 'reading',
        active: isMockActive,
    });
    const MOCK_DRAFT_KEY = mockId ? `mock:${mockId}:reading:answers` : '';
    // 草稿自动保存：刷新后能恢复进度（deadline 在服务端，计时不受影响）
    useEffect(() => {
        if (!isMockActive || !MOCK_DRAFT_KEY) return;
        const timer = setInterval(() => {
            try {
                localStorage.setItem(MOCK_DRAFT_KEY, JSON.stringify(userAnswersRef.current));
            } catch { /* 存储满等异常不阻塞作答 */ }
        }, 4000);
        return () => clearInterval(timer);
    }, [isMockActive, MOCK_DRAFT_KEY]);

    useEffect(() => {
        if (hasRequested.current) return;
        hasRequested.current = true;

        // 题库模式：从后端按 bankId 拉取，不再调用 AI 生成
        if (bankId) {
            sessionStorage.removeItem(CACHE_KEY);
            setSt(createReadingState());
            loadFromBank(bankId);
            return;
        }

        // 刷新恢复：优先从 sessionStorage 读取缓存数据
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { quizData: cachedQuiz, vocabList: cachedVocab } = JSON.parse(cached);
                setSt(s => ({ ...s, quizData: cachedQuiz, vocabList: cachedVocab, isLoading: false }));
                return; // 跳过 AI 生成
            } catch {
                sessionStorage.removeItem(CACHE_KEY);
            }
        }

        setSt(createReadingState());
        generateReading();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // mock 模式刷新恢复：无服务端答案时从本地草稿续答
    const restoreMockDraft = (): Record<number, string> => {
        if (!MOCK_DRAFT_KEY) return {};
        try {
            const raw = localStorage.getItem(MOCK_DRAFT_KEY);
            if (raw) return JSON.parse(raw) as Record<number, string>;
        } catch { /* 草稿损坏按空处理 */ }
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
        // 解析词汇
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

        // mock 模式：交卷时同步评分（raw + band）进 aiFeedback，供大厅/成绩单读取
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
                if (!forced) return; // 手动交卷失败时留在页面重试；超时强制交卷则继续离场
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
            if (isResizingLeft && leftSidebarRef.current) {
                const newWidth = startWidth + (e.clientX - startX);
                if (newWidth > 150 && newWidth < window.innerWidth * 0.4) leftSidebarRef.current.style.width = newWidth + 'px';
            } else if (isResizingRight && rightSidebarRef.current) {
                const newWidth = startWidth - (e.clientX - startX);
                // 做题面板允许拉到屏幕 70%，方便宽表格题型（matching 等）完整展示
                if (newWidth > 150 && newWidth < window.innerWidth * 0.7) rightSidebarRef.current.style.width = newWidth + 'px';
            }
        };

        const handleMouseUp = () => {
            if (isResizingLeft || isResizingRight) {
                // @ts-expect-error window globals
                window.__didDragSidebar = true;
                // 拖动结束后禁用 transition 防止跳动
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

        resizerL?.addEventListener('mousedown', handleMouseDownLeft);
        resizerR?.addEventListener('mousedown', handleMouseDownRight);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
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

        const onMouseDown = (e: MouseEvent) => {
            isResizing = true;
            startX = e.clientX;
            startWidth = sidebar.getBoundingClientRect().width;
            layout.classList.add('is-resizing');
            resizer.classList.add('resizing');
        };
        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing) return;
            const newWidth = startWidth + (e.clientX - startX);
            if (newWidth > 200 && newWidth < window.innerWidth * 0.55) {
                sidebar.style.width = newWidth + 'px';
            }
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
            resizer.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [st.step, st.isPassageOpen]);

    // Answer helpers used by the renderer
    const [answerVersion, setAnswerVersion] = useState(0);
    const getAnswer = useCallback((qid: number) => userAnswersRef.current[qid] || '', []);
    const setAnswer = useCallback((qid: number, value: string) => {
        userAnswersRef.current[qid] = value;
        setAnswerVersion(v => v + 1);
    }, []);

    // Active passage for full-test view
    const activePassageData: FullPassage | null = st.fullData
        ? ((st.fullData.passages || []).find(p => p.passageNum === st.activePassage) || (st.fullData.passages || [])[0] || null)
        : null;

    // ── 底部导航条数据 ──
    // 胶囊显示真实 q.id（full-test 下 Passage 2 = 14..26，与题面印的编号一致）
    const navQuestionIds = useMemo<number[]>(() => {
        if (st.fullData && activePassageData) {
            return (activePassageData.sections || []).flatMap(sec => (sec.questions || []).map(q => q.id));
        }
        return (st.quizData?.questions || []).map(q => q.id);
    }, [st.quizData, st.fullData, activePassageData]);

    // answerVersion 是 uncontrolled answersRef 的重渲染节拍，作答后已答集合随之重算
    const navAnsweredIds = useMemo<Set<number>>(() => {
        void answerVersion; // 答案存 ref，靠该 tick 触发重算
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

    // Memoized Blocks — Part 切换已移到底部导航条（点击收起的 Passage 标签），
    // 文章列内不再渲染顶部 tabs。
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
        // full test 不再显示 "Full Test" 面板标题——Part 信息已由底部导航条承担
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
                            // mock 模式：退出 = 判 0，走守卫的确认 + forfeit 流程
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
        // 全套（3 篇 40 题）额外给 9 分制换算；单篇 full 不适用
        const band = st.fullData && !st.fullData.singlePassage ? rawToBand('reading', score, total) : null;

        // Which passages to show for the "show passage" sidebar
        const passageBlocks = st.fullData ? (st.fullData.passages || []) : [{ passageNum: 1, title: st.quizData!.title, passage: st.quizData!.passage, topic: st.quizData!.topic, sections: [] as FullPassageSection[] }];

        // Flatten sections into a single review list
        const allQuestions: Array<{ q: Question; sec: FullPassageSection | QuizData }> = [];
        for (const sec of sectionsToScore) {
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
                        <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className={`toolbar-btn ${st.isPassageOpen ? 'active' : 'toolbar-btn-outline'}`}>
                            <span className="btn-icon">{st.isPassageOpen ? '📕' : '📖'}</span> {st.isPassageOpen ? t('results.hidePassage') : t('results.showPassage')}
                        </button>
                        {bankId && !mockId && (
                            // mock 子题一次定档，不允许重做
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> {t('aiBank.redoBtn')}</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{mockId ? '🎯' : bankId ? '📚' : '🏠'}</span> {mockId ? t('mock.examMode.backToHub') : bankId ? t('aiBank.backToBank') : t('common.home')}</button>
                    </div>
                </div>

                {/* Results Body */}
                <div className="results-layout" id="resultsLayout">
                    {/* Passage Sidebar */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="passageSidebar">
                        <h3>{t('results.originalPassage')}</h3>
                        {passageBlocks.map(pb => (
                            <ReadingPassageBlock key={pb.passageNum} title={pb.title} passage={pb.passage} idPrefix={`passage-${pb.passageNum}`} />
                        ))}
                    </div>

                    {/* Resizer */}
                    <div className={`resizer ${st.isPassageOpen ? 'active' : ''}`} id="resizerPassage"></div>

                    {/* Analysis Content */}
                    <div className="results-content">
                        {allQuestions.map(({ q, sec }) => {
                            const userAns = getAnswer(q.id) || 'None';
                            const correctList: string[] = Array.isArray(q.answers)
                                ? (q.answers as unknown[]).map(a => (a == null ? '' : String(a)))
                                : (q.answer !== undefined ? [String(q.answer)] : []);
                            const isCorrect = correctList.some(a => a.trim().toLowerCase() === userAns.trim().toLowerCase());
                            const correctDisplay = correctList.join(' / ') || '—';
                            const questionText = q.question || (q.paragraph ? `Paragraph ${q.paragraph}` : '');

                            return (
                                <div key={q.id} className="result-block">
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
                </div>
            </div>
        );
    }

    return null;
}
