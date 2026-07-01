import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { createReadingState } from '../../store/reading_page_store';
import type { VocabItem, QuizData } from '../../store/reading_page_store';
import type { ReadingQuestionType, ReadingJudgementMode } from '../../store/reading_page_store';
import { api } from '../../api/client';
import { showToast } from '../../components/common/Toast';
import { getAIQuestion, submitAIQuestion } from '../../api/ai_question';
import { useLang } from '../../i18n/LanguageContext';
import { sanitize } from '../../utils/safe_html';
import '../../styles/reading_page.css';

export default function Reading_page() {
    const { state } = useLocation();
    const [searchParams] = useSearchParams();
    const bankIdParam = searchParams.get('bankId');
    const bankId = bankIdParam ? Number(bankIdParam) : null;
    const vocabInput: string = state?.vocabInput ?? '';
    const difficulty: string = state?.difficulty ?? '7.0';
    const navigate = useNavigate();
    const onReturnHome = () => navigate(bankId ? '/practice/ai/bank' : '/');
    const { translations: t } = useLang();
    const absurdMode: boolean = Boolean(state?.absurdMode);
    const questionType: ReadingQuestionType = state?.questionType === 'true_false' ? 'true_false' : 'multiple_choice';
    const judgementMode: ReadingJudgementMode = state?.judgementMode === 'easy' ? 'easy' : 'normal';

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

    const loadFromBank = async (id: number) => {
        set('isLoading', true);
        try {
            const detail = await getAIQuestion(id);
            const content = (detail.content || {}) as Partial<QuizData>;
            if (!content.passage || !Array.isArray(content.questions)) {
                showToast(t.aiBank.toastMissingContent, 'error');
                navigate('/practice/ai/bank');
                return;
            }
            const normalizedQuizData: QuizData = {
                title: content.title || 'Reading Passage',
                passage: content.passage,
                questions: content.questions,
                questionType: content.questionType || 'multiple_choice',
                judgementMode: content.judgementMode ?? null,
            } as QuizData;
            setSt(s => ({
                ...s,
                quizData: normalizedQuizData,
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
                userAnswersRef.current = {};
            }
        } catch (err: unknown) {
            console.error('Bank load error:', err);
            showToast('题库加载失败', 'error');
            navigate('/practice/ai/bank');
        } finally {
            set('isLoading', false);
        }
    };

    const formatHighlight = (text: string): string => {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
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
            // 调用后端 API，不再直接调 AI
            const parsedData = await api<QuizData & { aiQuestionId?: number | null }>('/reading/generate', {
                method: 'POST',
                body: { words, difficulty, absurdMode, questionType, judgementMode },
            });

            // 生成成功后直接跳转到 AI 题库，由用户在题库内挑题作答
            sessionStorage.removeItem(CACHE_KEY);
            const justId = parsedData.aiQuestionId ?? null;
            showToast('题目已生成并保存到 AI 题库', 'success');
            navigate(justId ? `/practice/ai/bank?just=${justId}` : '/practice/ai/bank', { replace: true });
            return;
        } catch (err: unknown) { // Changed 'any' to 'unknown'
            console.error("API Error:", err);
            const error = err as { message?: string, status?: number }; // Cast to a type that might have message and status
            const code = error.status ?? (err instanceof TypeError ? 'NET' : undefined);
            showToast(error.message || '请求失败', 'error', code);
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
                btnEl.innerText = t.readingDetails.hideTargets;
                btnEl.classList.remove('active');
            } else {
                pageEl.classList.add('hide-highlights');
                btnEl.innerText = t.readingDetails.showTargets;
                btnEl.classList.add('active');
            }
        }
    };

    const submitQuiz = () => {
        if (!st.quizData) return;
        const totalQuestions = st.quizData.questions.length;
        const answeredQuestions = Object.keys(userAnswersRef.current).length;
        if (answeredQuestions < totalQuestions) {
            if (!window.confirm(t.readingDetails.submitConfirm)) return;
        }
        if (bankId) {
            submitAIQuestion(bankId, { ...userAnswersRef.current }).catch(err => {
                console.error('submit to bank failed:', err);
                showToast('保存作答失败，但本次成绩已显示', 'error');
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
                if (newWidth > 150 && newWidth < window.innerWidth * 0.4) rightSidebarRef.current.style.width = newWidth + 'px';
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

    // Memoized Blocks
    const articleMemoBlock = useMemo(() => {
        if (!st.quizData) return null;
        const passageParagraphs = st.quizData.passage.split('\n\n');
        return (
            <div className="main-content">
                <h2 style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(st.quizData.title)) }}></h2>
                <div
                    id="articleContent"
                    style={{ outline: 'none', WebkitTouchCallout: 'none' }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {passageParagraphs.map((p, idx) => (
                        <p key={idx} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(p)) }}></p>
                    ))}
                </div>
            </div>
        );
    }, [st.quizData]);

    const questionsMemoBlock = useMemo(() => {
        if (!st.quizData) return null;
        return (
            <div id="questionsForm" style={{ outline: 'none', WebkitTouchCallout: 'none' }} onContextMenu={(e) => e.preventDefault()}>
                {st.quizData.questions.map((q) => (
                    <div key={q.id} className="question-block">
                        <div className="question-text" dangerouslySetInnerHTML={{ __html: sanitize(`${q.id}. ${formatHighlight(q.question)}`) }}></div>
                        {Object.entries(q.options).map(([key, value]) => (
                            <label key={key} className="option-label">
                                <input
                                    type="radio" name={`q${q.id}`} value={key}
                                    defaultChecked={userAnswersRef.current[q.id] === key}
                                    onChange={() => { userAnswersRef.current[q.id] = key; }}
                                />
                                <strong>{key.length === 1 ? `${key}.` : key}</strong> <span dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(value)) }}></span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
        );
    }, [st.quizData]);

    // Loading State
    if (st.isLoading) {
        return (
            <div className="reading-container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">{t.readingDetails.writingPassage}</div>
                </div>
            </div>
        );
    }

    // Page 2: Reading Interface
    if (st.step === 2 && st.quizData) {
        const filteredVocab = st.vocabList.filter(v =>
            v.word.toLowerCase().includes(st.searchQuery.toLowerCase()) ||
            v.meaning.toLowerCase().includes(st.searchQuery.toLowerCase())
        );
        const questionPanelTitle = st.quizData.questionType === 'true_false'
            ? (st.quizData.judgementMode === 'easy' ? t.readingDetails.questionsTrueFalseEasy : t.readingDetails.questionsTrueFalseNormal)
            : t.readingDetails.questionsMcq;

        return (
            <div className="reading-container">
                <div id="floatUnderlineBtn" ref={floatBtnRef} onMouseDown={(e) => e.preventDefault()} onClick={executeUnderline}>
                    <u>U</u> {t.readingDetails.underline}
                </div>

                <div id="reading-page-container" className="page">
                    <div className="toolbar-area">
                        <div className="toolbar-left-group">
                            <button className={`toolbar-btn ${st.isLeftOpen ? 'active' : ''}`} onClick={() => { if ((window as any).__didDragSidebar) return; if (leftSidebarRef.current) { leftSidebarRef.current.classList.remove('no-transition'); leftSidebarRef.current.style.width = ''; } set('isLeftOpen', !st.isLeftOpen); }}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                                <span className="btn-icon">📚</span> {t.readingDetails.dictionary}
                            </button>
                            <button className={`toolbar-btn ${st.isRightOpen ? 'active' : ''}`} onClick={() => { if ((window as any).__didDragSidebar) return; if (rightSidebarRef.current) { rightSidebarRef.current.classList.remove('no-transition'); rightSidebarRef.current.style.width = ''; } set('isRightOpen', !st.isRightOpen); }}> {/* eslint-disable-line @typescript-eslint/no-explicit-any */}
                                <span className="btn-icon">📝</span> {t.readingDetails.questions}
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
                                <span className="btn-icon">💡</span> {t.readingDetails.hideTargets}
                            </button>
                            <button className="toolbar-btn toolbar-btn-danger" onClick={() => {
                                if (window.confirm('确定要退出练习吗？未提交的进度可能会丢失')) {
                                    onReturnHome();
                                }
                            }}>
                                <span className="btn-icon">🚪</span> 退出练习</button>
                        </div>
                    </div>

                    <div className="reading-layout" ref={layoutRef}>
                        {/* Left Sidebar */}
                        <div id="leftSidebar" ref={leftSidebarRef} className={`reading-sidebar ${st.isLeftOpen ? 'open' : ''}`}>
                            <h2 style={{ marginTop: 0 }}>{t.readingDetails.dictionary}</h2>
                            <input
                                type="text" id="vocabSearch" placeholder={t.readingDetails.searchPlaceholder}
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
                            <h2 style={{ marginTop: 0 }}>{questionPanelTitle}</h2>
                            {questionsMemoBlock}
                            <div className="submit-quiz-container">
                                <button onClick={submitQuiz}>{t.readingDetails.submitBtn}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Page 3: Results
    if (st.step === 3 && st.quizData) {
        let score = 0;
        st.quizData.questions.forEach(q => {
            if (userAnswersRef.current[q.id] === q.answer) score++;
        });
        const total = st.quizData.questions.length;
        const pct = Math.round((score / total) * 100);
        const passageParagraphs = st.quizData.passage.split('\n\n');

        return (
            <div className="results-container">
                {/* Results Header */}
                <div className="results-header">
                    <div className="results-header-left">
                        <h1>{t.results.analysis}</h1>
                        <p className="elapsed-time">
                            🕐 {formatTime(st.elapsedSeconds).h}h {formatTime(st.elapsedSeconds).m}m {formatTime(st.elapsedSeconds).s}s
                        </p>
                    </div>
                    <div className="results-header-right">
                        <div className="score-card">
                            <div className="score-number">{score}<span className="score-total">/{total}</span></div>
                            <div className="score-pct">{pct}%</div>
                        </div>
                        <button onClick={() => set('isPassageOpen', !st.isPassageOpen)} className={`toolbar-btn ${st.isPassageOpen ? 'active' : 'toolbar-btn-outline'}`}>
                            <span className="btn-icon">{st.isPassageOpen ? '📕' : '📖'}</span> {st.isPassageOpen ? t.results.hidePassage : t.results.showPassage}
                        </button>
                        {bankId && (
                            <button onClick={restartFromBank} className="toolbar-btn toolbar-btn-outline"><span className="btn-icon">🔁</span> 重新作答</button>
                        )}
                        <button onClick={onReturnHome} className="toolbar-btn"><span className="btn-icon">{bankId ? '📚' : '🏠'}</span> {bankId ? '返回题库' : t.common.home}</button>
                    </div>
                </div>

                {/* Results Body */}
                <div className="results-layout" id="resultsLayout">
                    {/* Passage Sidebar */}
                    <div className={`passage-sidebar ${st.isPassageOpen ? 'open' : ''}`} id="passageSidebar">
                        <h3>{t.results.originalPassage}</h3>
                        <h4 dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(st.quizData.title)) }}></h4>
                        <div className="passage-text">
                            {passageParagraphs.map((p, idx) => (
                                <p key={idx} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(p)) }}></p>
                            ))}
                        </div>
                    </div>

                    {/* Resizer */}
                    <div className={`resizer ${st.isPassageOpen ? 'active' : ''}`} id="resizerPassage"></div>

                    {/* Analysis Content */}
                    <div className="results-content">
                        {st.quizData.questions.map(q => {
                            const userAns = userAnswersRef.current[q.id] || 'None';
                            const isCorrect = userAns === q.answer;

                            return (
                                <div key={q.id} className="result-block">
                                    <div className="question-text">{q.id}. {q.question.replace(/\*\*/g, '')}</div>
                                    <p>{t.results.yourAnswer}: <strong className={isCorrect ? 'ans-correct' : 'ans-incorrect'}>{userAns}</strong> | {t.results.correctAnswer}: <strong>{q.answer}</strong></p>
                                    <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                        {isCorrect ? `✅ ${t.results.statusCorrect}` : `❌ ${t.results.statusIncorrect}`}
                                    </p>
                                    <div className="explanation">
                                        <strong>{t.results.explanation}:</strong> {q.explanation}
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
