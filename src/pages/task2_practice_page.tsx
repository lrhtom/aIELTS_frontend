import Layout from '../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../components/Toast';
import { api } from '../api/client';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_page.css';
import '../styles/writing_correction.css';

type Step = 'loading' | 'answering' | 'settlement' | 'evaluating' | 'result';

interface Task2Data {
    prompt: string;
}

interface EvaluationResult {
    scores: {
        ta: number;
        cc: number;
        lr: number;
        gra: number;
    };
    overall: number;
    feedback: string;
}

export default function Task2PracticePage() {
    const navigate = useNavigate();
    const { lang } = useLang();
    const t = translations[lang];

    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') || 'opinion';

    const [step, setStep] = useState<Step>('loading');
    const [taskData, setTaskData] = useState<Task2Data | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);

    // Initial load - generate prompt
    useEffect(() => {
        let isMounted = true;

        async function fetchPrompt() {
            setStep('loading');
            try {
                const res = await api<Task2Data>('/writing/task2/generate', {
                    method: 'POST',
                    body: { type },
                });
                if (isMounted) {
                    setTaskData(res);
                    setStep('answering');
                }
            } catch (err: unknown) {
                console.error('Generate task2 error:', err);
                const error = err as { message?: string };
                showToast(error.message || t.practiceSandbox.toastFailGenTask2, 'error');
                if (isMounted) navigate(-1);
            }
        }
        fetchPrompt();

        return () => { isMounted = false; };
    }, [type, navigate]);

    // Word count calculation
    const wordCount = useMemo(() => {
        const trimmed = userAnswer.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [userAnswer]);

    const handleSubmitAnser = () => {
        if (!userAnswer.trim()) {
            showToast(t.practiceSandbox.toastEmpty, 'error');
            return;
        }
        if (wordCount < 100) {
            showToast(t.practiceSandbox.toastTooShortTask2, 'error');
        }
        setStep('settlement');
    };

    const handleStartEvaluation = async () => {
        if (!taskData) return;
        setStep('evaluating');
        try {
            const res = await api<EvaluationResult>('/writing/task2/evaluate', {
                method: 'POST',
                body: {
                    prompt: taskData.prompt,
                    userAnswer: userAnswer
                },
            });
            setResult(res);
            setStep('result');
            showToast(t.practiceSandbox.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Evaluate task2 error:', err);
            const error = err as { message?: string };
            showToast(error.message || t.practiceSandbox.toastFailEval, 'error');
            setStep('settlement');
        }
    };

    const typeNameMap: Record<string, string> = {
        'opinion': t.task2Selection.types.opinion.title,
        'opinion_agree': t.task2OpinionSelection.types.agree.title,
        'opinion_discuss': t.task2OpinionSelection.types.discuss.title,
        'opinion_advantages': t.task2OpinionSelection.types.advantages.title,
        'report': t.task2Selection.types.report.title,
        'mixed': t.task2Selection.types.mixed.title,
        'random': t.task2Selection.types.random.title,
        'innovation': t.task2Selection.types.innovation.title,
    };
    const titleName = typeNameMap[type] || '大作文测试';

    const renderLoading = () => (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }}></div>
            <h2>{t.practiceSandbox.loadingTitleTask2}</h2>
            <p style={{ color: 'var(--text-secondary)' }}>{t.practiceSandbox.loadingDescTask2.replace('{type}', titleName)}</p>
        </div>
    );

    const renderAnswering = () => (
        <div className="practice-split-view" style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 1fr) 1.5fr', gap: '24px', flex: 1, height: 'calc(100vh - 180px)', minHeight: '600px' }}>
            {/* Left Box: Prompt */}
            <div className="chart-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📜</span> {t.practiceSandbox.promptTitle}
                    </h3>
                </div>
                <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                    <div style={{
                        padding: '24px',
                        backgroundColor: 'var(--bg-card-hover)',
                        borderRadius: '12px',
                        fontFamily: '"Georgia", "Times New Roman", serif',
                        fontSize: '18px',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        borderLeft: '4px solid var(--accent-color)'
                    }}>
                        {taskData?.prompt}
                    </div>
                </div>
            </div>

            {/* Right Box: Editor */}
            <div className="editor-panel" style={{ backgroundColor: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>✍️</span> {t.practiceSandbox.yourAnswer}
                    </h3>
                    <div className="word-count" style={{
                        padding: '6px 16px',
                        borderRadius: '20px',
                        backgroundColor: wordCount >= 250 ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-background)',
                        color: wordCount >= 250 ? 'var(--success-color)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        fontSize: '14px'
                    }}>
                        {wordCount} / 250+ words
                    </div>
                </div>

                <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <textarea
                        style={{
                            flex: 1,
                            width: '100%',
                            padding: '20px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-background)',
                            color: 'var(--text-primary)',
                            fontSize: '16px',
                            lineHeight: 1.8,
                            resize: 'none',
                            fontFamily: 'monospace',
                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                        }}
                        placeholder={t.practiceSandbox.placeholderTask2}
                        value={userAnswer}
                        onChange={(e) => setUserAnswer(e.target.value)}
                    />
                </div>

                <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        className="primary-button"
                        onClick={handleSubmitAnser}
                        style={{ padding: '12px 32px', fontSize: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <span>✅</span> {t.practiceSandbox.finishBtn}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderSettlement = () => (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div className="modal-content" style={{
                background: 'var(--color-surface, #fff)', padding: '32px', borderRadius: '16px',
                maxWidth: '400px', width: '100%', textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ marginBottom: '12px' }}>{t.practiceSandbox.settlementTitle}</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    {t.practiceSandbox.settlementDesc}
                </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px', margin: '0 auto' }}>
                <button
                    className="primary-button"
                    onClick={handleStartEvaluation}
                    style={{ padding: '16px', fontSize: '18px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                    <span>🎯</span> {t.practiceSandbox.callAiBtn}
                </button>
                <button
                    onClick={() => navigate('/writing/task2')}
                    style={{
                        padding: '16px',
                        fontSize: '16px',
                        borderRadius: '12px',
                        backgroundColor: 'transparent',
                        color: 'var(--text-secondary)',
                        border: '2px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                >
                    {t.practiceSandbox.backBtn}
                </button>
            </div>
            </div>
        </div>
    );

    const renderEvaluating = () => (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div className="spinner" style={{ margin: '0 auto 24px', width: '50px', height: '50px', borderWidth: '4px' }}></div>
            <h2 style={{ fontSize: '28px', marginBottom: '16px' }}>{t.practiceSandbox.evaluatingTitle}</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', lineHeight: 1.6 }}>
                {t.practiceSandbox.evaluatingDesc}<br />
                {t.practiceSandbox.evaluatingDescLine2}
            </p>
        </div>
    );

    const renderResult = () => {
        if (!result) return null;
        return (
            <div className="wc-result-card" style={{ maxWidth: '1000px', margin: '0 auto', marginTop: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h2 className="wc-overall-band" style={{ margin: 0 }}>
                        {t.practiceSandbox.overallBand}
                        <span style={{ fontSize: '42px', marginLeft: '16px', color: 'var(--accent-color)', fontWeight: 800 }}>
                            {result.overall.toFixed(1)}
                        </span>
                    </h2>
                    <button
                        onClick={() => navigate('/writing/task2')}
                        style={{
                            padding: '12px 24px',
                            borderRadius: '12px',
                            backgroundColor: 'var(--bg-card-hover)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                    >
                        {t.practiceSandbox.backToPracticeBtn}
                    </button>
                </div>

                <div className="wc-scores-grid">
                    <div className="wc-score-item">
                        <div className="wc-score-label">🎯 {t.practiceSandbox.taTask2}</div>
                        <div className="wc-score-val">{result.scores.ta.toFixed(1)}</div>
                    </div>
                    <div className="wc-score-item">
                        <div className="wc-score-label">🔗 {t.practiceSandbox.cc}</div>
                        <div className="wc-score-val">{result.scores.cc.toFixed(1)}</div>
                    </div>
                    <div className="wc-score-item">
                        <div className="wc-score-label">📚 {t.practiceSandbox.lr}</div>
                        <div className="wc-score-val">{result.scores.lr.toFixed(1)}</div>
                    </div>
                    <div className="wc-score-item">
                        <div className="wc-score-label">📝 {t.practiceSandbox.gra}</div>
                        <div className="wc-score-val">{result.scores.gra.toFixed(1)}</div>
                    </div>
                </div>

                <div className="wc-feedback-box" style={{ marginTop: '32px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '20px' }}>
                        <span>💡</span> {t.practiceSandbox.examinerReport}
                    </h3>
                    <div className="wc-feedback-content" style={{ fontSize: '16px', lineHeight: 1.8 }}>
                        {result.feedback.split('\n').map((line, idx) => (
                            <p key={idx} style={{ marginBottom: line.trim() === '' ? '0' : '16px' }}>{line}</p>
                        ))}
                    </div>
                </div>

                <div style={{ marginTop: '32px', padding: '24px', backgroundColor: 'var(--bg-background)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>📝 {t.practiceSandbox.reviewOriginal}</h4>
                    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', margin: 0, fontFamily: 'monospace', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                        {userAnswer}
                    </pre>
                </div>
            </div>
        );
    };

    return (
        <Layout>
            <div className="practice-container" style={{ maxWidth: '100%', padding: '24px 40px', display: 'flex', flexDirection: 'column' }}>
                <div className="practice-header" style={{ marginBottom: '24px' }}>
                    {(step === 'loading' || step === 'answering') && (
                        <button className="back-link" onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.practiceSandbox.abortBtn}
                        </button>
                    )}
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '28px' }}>🖋️</span> {t.practiceSandbox.titleTask2.replace('{type}', titleName)}
                    </h1>
                </div>

                {step === 'loading' && renderLoading()}
                {step === 'answering' && renderAnswering()}
                {step === 'settlement' && (
                    <>
                        {renderAnswering()}
                        {renderSettlement()}
                    </>
                )}
                {step === 'evaluating' && renderEvaluating()}
                {step === 'result' && renderResult()}
            </div>
        </Layout>
    );
}
