// ReadingPractice.tsx
import { useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useReactive } from '../utils/reactive';
import { readingStore, resetReadingStore } from '../store/reading_page_store';
import type { VocabItem, QuizData } from '../store/reading_page_store';
import { api } from '../api/client';
import '../styles/reading_page.css';

export default function Reading_page() {
    const { state } = useLocation();
    const vocabInput: string = state?.vocabInput ?? '';
    const navigate = useNavigate();
    const onReturnHome = () => navigate('/');

    // 订阅响应式 store
    const store = useReactive(readingStore);

    // DOM refs
    const userAnswersRef = useRef<Record<number, string>>({});
    const leftSidebarRef = useRef<HTMLDivElement | null>(null);
    const rightSidebarRef = useRef<HTMLDivElement | null>(null);
    const layoutRef = useRef<HTMLDivElement | null>(null);
    const floatBtnRef = useRef<HTMLDivElement | null>(null);
    const activeEditorRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        resetReadingStore();
        generateReading();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const formatHighlight = (text: string): string => {
        if (!text) return '';
        return text.replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
    };

    const generateReading = async () => {
        // 解析词汇
        const parsedList: VocabItem[] = vocabInput.trim().split('\n').map(line => {
            const parts = line.split(/[-:]/);
            return {
                word: parts[0] ? parts[0].trim() : '',
                meaning: parts[1] ? parts[1].trim() : ''
            };
        }).filter(item => item.word).sort((a, b) => a.word.localeCompare(b.word));

        store.vocabList = parsedList;
        const words = parsedList.map(v => v.word);

        try {
            // 调用后端 API，不再直接调 AI
            const parsedData = await api<QuizData>('/reading/generate', {
                method: 'POST',
                body: { words },
            });

            store.quizData = parsedData;
            userAnswersRef.current = {};
            store.searchQuery = '';
            store.isLeftOpen = true;
            store.isRightOpen = true;

            const pageEl = document.getElementById('reading-page-container');
            const btnEl = document.getElementById('highlight-toggle-btn');
            if (pageEl) pageEl.classList.remove('hide-highlights');
            if (btnEl) {
                btnEl.innerText = '💡 Hide Target Words';
                btnEl.classList.remove('active');
            }

        } catch (error) {
            console.error("API Error:", error);
            alert('Failed to generate reading material. Please check network.');
            onReturnHome();
        } finally {
            store.isLoading = false;
        }
    };

    const toggleHighlightsPureDOM = () => {
        const pageEl = document.getElementById('reading-page-container');
        const btnEl = document.getElementById('highlight-toggle-btn');
        if (pageEl && btnEl) {
            const isHidden = pageEl.classList.contains('hide-highlights');
            if (isHidden) {
                pageEl.classList.remove('hide-highlights');
                btnEl.innerText = '💡 Hide Target Words';
                btnEl.classList.remove('active');
            } else {
                pageEl.classList.add('hide-highlights');
                btnEl.innerText = '💡 Show Target Words';
                btnEl.classList.add('active');
            }
        }
    };

    const submitQuiz = () => {
        if (!store.quizData) return;
        const totalQuestions = store.quizData.questions.length;
        const answeredQuestions = Object.keys(userAnswersRef.current).length;
        if (answeredQuestions < totalQuestions) {
            if (!window.confirm('You have unanswered questions. Submit anyway?')) return;
        }
        store.step = 3;
    };

    // Resizer Logic
    useEffect(() => {
        if (store.step !== 2 || store.isLoading) return;
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
                isResizingLeft = false; isResizingRight = false;
                if (layoutRef.current) layoutRef.current.classList.remove('is-resizing');
                if (resizerL) resizerL.classList.remove('resizing');
                if (resizerR) resizerR.classList.remove('resizing');
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
    }, [store.step, store.isLoading]);

    // Floating Underline Logic
    useEffect(() => {
        if (store.step !== 2 || store.isLoading) return;
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
    }, [store.step, store.isLoading]);

    const executeUnderline = () => {
        if (!activeEditorRef.current) return;
        activeEditorRef.current.contentEditable = 'true';
        document.execCommand('underline', false, '');
        activeEditorRef.current.contentEditable = 'false';
        if (floatBtnRef.current) floatBtnRef.current.classList.remove('visible');
        window.getSelection()?.removeAllRanges();
    };

    // Memoized Blocks
    const articleMemoBlock = useMemo(() => {
        if (!store.quizData) return null;
        const passageParagraphs = store.quizData.passage.split('\n\n');
        return (
            <div className="main-content">
                <h2 style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: formatHighlight(store.quizData.title) }}></h2>
                <div
                    id="articleContent"
                    style={{ outline: 'none', WebkitTouchCallout: 'none' }}
                    onContextMenu={(e) => e.preventDefault()}
                >
                    {passageParagraphs.map((p, idx) => (
                        <p key={idx} dangerouslySetInnerHTML={{ __html: formatHighlight(p) }}></p>
                    ))}
                </div>
            </div>
        );
    }, [store.quizData]);

    const questionsMemoBlock = useMemo(() => {
        if (!store.quizData) return null;
        return (
            <div id="questionsForm" style={{ outline: 'none', WebkitTouchCallout: 'none' }} onContextMenu={(e) => e.preventDefault()}>
                {store.quizData.questions.map((q) => (
                    <div key={q.id} className="question-block">
                        <div className="question-text" dangerouslySetInnerHTML={{ __html: `${q.id}. ${formatHighlight(q.question)}` }}></div>
                        {Object.entries(q.options).map(([key, value]) => (
                            <label key={key} className="option-label">
                                <input
                                    type="radio" name={`q${q.id}`} value={key}
                                    defaultChecked={userAnswersRef.current[q.id] === key}
                                    onChange={() => { userAnswersRef.current[q.id] = key; }}
                                />
                                <strong>{key}.</strong> <span dangerouslySetInnerHTML={{ __html: formatHighlight(value) }}></span>
                            </label>
                        ))}
                    </div>
                ))}
            </div>
        );
    }, [store.quizData]);

    // Loading State
    if (store.isLoading) {
        return (
            <div className="container">
                <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
                    <div className="loader">AI is writing your IELTS 7.5 level passage... Please wait.</div>
                </div>
            </div>
        );
    }

    // Page 2: Reading Interface
    if (store.step === 2 && store.quizData) {
        const filteredVocab = store.vocabList.filter(v =>
            v.word.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
            v.meaning.toLowerCase().includes(store.searchQuery.toLowerCase())
        );

        return (
            <div className="container">
                <div id="floatUnderlineBtn" ref={floatBtnRef} onMouseDown={(e) => e.preventDefault()} onClick={executeUnderline}>
                    <u>U</u> Underline
                </div>

                <div id="reading-page-container" className="page">
                    <div className="toolbar-area">
                        <div>
                            <button onClick={() => { store.isLeftOpen = !store.isLeftOpen; if (leftSidebarRef.current) leftSidebarRef.current.style.width = ''; }}>☰ Dictionary</button>
                            <span style={{ margin: '0 5px' }}></span>
                            <button onClick={() => { store.isRightOpen = !store.isRightOpen; if (rightSidebarRef.current) rightSidebarRef.current.style.width = ''; }}>✎ Questions</button>
                        </div>
                        <div>
                            <button
                                id="highlight-toggle-btn"
                                className="tool-btn"
                                onClick={toggleHighlightsPureDOM}
                            >
                                💡 Hide Target Words
                            </button>
                        </div>
                    </div>

                    <div className="reading-layout" ref={layoutRef}>
                        {/* Left Sidebar */}
                        <div id="leftSidebar" ref={leftSidebarRef} className={`sidebar ${store.isLeftOpen ? 'open' : ''}`}>
                            <h2 style={{ marginTop: 0 }}>Vocabulary</h2>
                            <input
                                type="text" id="vocabSearch" placeholder="🔍 Search word or meaning..."
                                value={store.searchQuery} onChange={(e) => store.searchQuery = e.target.value}
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

                        <div className={`resizer ${store.isLeftOpen ? 'active' : ''}`} id="resizerLeft"></div>
                        {articleMemoBlock}
                        <div className={`resizer ${store.isRightOpen ? 'active' : ''}`} id="resizerRight"></div>

                        {/* Right Sidebar */}
                        <div id="rightSidebar" ref={rightSidebarRef} className={`sidebar ${store.isRightOpen ? 'open' : ''}`}>
                            <h2 style={{ marginTop: 0 }}>Questions</h2>
                            {questionsMemoBlock}
                            <div className="submit-quiz-container">
                                <button onClick={submitQuiz}>Submit Answers</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Page 3: Results
    if (store.step === 3 && store.quizData) {
        let score = 0;
        store.quizData.questions.forEach(q => {
            if (userAnswersRef.current[q.id] === q.answer) score++;
        });

        return (
            <div className="container">
                <div className="page page3-scroll">
                    <h1>Analysis & Explanations</h1>
                    <h2>Your Score: {score} / 5</h2>

                    {store.quizData.questions.map(q => {
                        const userAns = userAnswersRef.current[q.id] || 'None';
                        const isCorrect = userAns === q.answer;

                        return (
                            <div key={q.id} className="result-block">
                                <div className="question-text">{q.id}. {q.question.replace(/\*\*/g, '')}</div>
                                <p>Your Answer: <strong>{userAns}</strong> | Correct Answer: <strong>{q.answer}</strong></p>
                                <p className={isCorrect ? 'status-correct' : 'status-incorrect'}>
                                    {isCorrect ? 'Correct' : 'Incorrect'}
                                </p>
                                <div className="explanation">
                                    <strong>解析:</strong> {q.explanation}
                                </div>
                            </div>
                        );
                    })}
                    <button onClick={onReturnHome} style={{ marginTop: '20px', width: '200px' }}>Return to Home</button>
                </div>
            </div>
        );
    }

    return null;
}