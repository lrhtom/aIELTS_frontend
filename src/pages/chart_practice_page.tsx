import Layout from '../components/Layout';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { showToast } from '../components/Toast';
import { api } from '../api/client';
import '../styles/practice_page.css';
import '../styles/writing_correction.css';

type Step = 'loading' | 'answering' | 'settlement' | 'evaluating' | 'result';

interface ChartData {
    imageUrl: string;
    prompt: string;
    pythonCode: string;
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

export default function ChartPracticePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const type = searchParams.get('type') || 'line';

    const [step, setStep] = useState<Step>('loading');
    const [chartData, setChartData] = useState<ChartData | null>(null);
    const [userAnswer, setUserAnswer] = useState('');
    const [result, setResult] = useState<EvaluationResult | null>(null);

    // Initial load - generate chart
    useEffect(() => {
        let isMounted = true;

        async function fetchChart() {
            setStep('loading');
            try {
                const res = await api<ChartData>('/writing/chart/generate', {
                    method: 'POST',
                    body: { type },
                });
                if (isMounted) {
                    setChartData(res);
                    setStep('answering');
                }
            } catch (err: unknown) {
                console.error('Generate chart error:', err);
                const error = err as { message?: string };
                showToast(error.message || '图表生成失败', 'error');
                if (isMounted) navigate('/writing/chart');
            }
        }
        fetchChart();

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
            showToast('请先输入您的作文', 'error');
            return;
        }
        if (wordCount < 50) {
            showToast('字数太少了，再写一点吧 (建议至少 150 词)', 'error');
        }
        setStep('settlement');
    };

    const handleStartEvaluation = async () => {
        if (!chartData) return;
        setStep('evaluating');
        try {
            const res = await api<EvaluationResult>('/writing/chart/evaluate', {
                method: 'POST',
                body: {
                    prompt: chartData.prompt,
                    pythonCode: chartData.pythonCode,
                    userAnswer: userAnswer
                },
            });
            setResult(res);
            setStep('result');
            showToast('批改完成！', 'success');
        } catch (err: unknown) {
            console.error('Evaluate chart error:', err);
            const error = err as { message?: string };
            showToast(error.message || '批改失败', 'error');
            setStep('settlement'); // fall back to allow retry
        }
    };

    // ─── Render functions ──────────────────────────────────────────────────

    const renderLoading = () => (
        <div className="practice-hub-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="loading-spinner" style={{ width: '50px', height: '50px', border: '4px solid var(--border-color)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h2 style={{ marginTop: '2rem' }}>正在使用 AI 引擎随机生成独一无二的图表数据...</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>请耐心等待几秒钟</p>
        </div>
    );

    const renderEvaluating = () => (
        <div className="practice-hub-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <div className="loading-spinner" style={{ width: '50px', height: '50px', border: '4px solid var(--border-color)', borderTopColor: '#f97316', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <h2 style={{ marginTop: '2rem' }}>雅思 AI 考官正在认真批阅您的 Task 1 作文...</h2>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>包括任务完成度、连贯性、词汇与语法等四大维度</p>
        </div>
    );

    const renderAnswering = () => (
        <div className="wc-main-layout" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Left: Chart and Prompt */}
            <div className="wc-editor-card" style={{ flex: '1.2' }}>
                <div className="wc-editor-header">
                    <h3>📊 Task 1 Question</h3>
                </div>
                <div style={{ padding: '16px', background: 'var(--bg-section)', borderRadius: '8px', marginBottom: '16px' }}>
                    <p style={{ fontSize: '16px', lineHeight: '1.6', fontWeight: '500' }}>
                        {chartData?.prompt}
                    </p>
                </div>
                {chartData?.imageUrl && (
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'center', background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <img
                            src={chartData.imageUrl.startsWith('data:') ? chartData.imageUrl : `${import.meta.env.VITE_API_BASE}${chartData.imageUrl}`}
                            alt="Generated Chart"
                            style={{ maxWidth: '100%', height: 'auto', maxHeight: '400px', objectFit: 'contain' }}
                        />
                    </div>
                )}
            </div>

            {/* Right: Answer Input */}
            <div className="wc-editor-card" style={{ flex: '1' }}>
                <div className="wc-editor-header">
                    <h3>您的作答区</h3>
                    <span className="wc-word-count">字数: <strong>{wordCount}</strong> / 150+</span>
                </div>
                <textarea
                    className="wc-textarea"
                    style={{ flexGrow: 1, minHeight: '300px' }}
                    placeholder="在此输入您的小作文描述 (建议 150 词以上)..."
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                ></textarea>
                <div className="wc-editor-footer">
                    <button
                        className="skill-btn reading wc-eval-btn"
                        onClick={handleSubmitAnser}
                    >
                        🚀 提交作答 (Submit)
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
                <h2 style={{ marginBottom: '12px' }}>恭喜完成本次图表题训练！</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
                    您刚刚完成了一篇独家随机生成的 Task 1 小作文。是否希望 AI 考官现在为您打分？
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        className="primary-button"
                        style={{ padding: '12px', fontSize: '16px' }}
                        onClick={handleStartEvaluation}
                    >
                        进行 AI 批改评分 (AI Evaluation)
                    </button>
                    <button
                        className="secondary-button"
                        style={{
                            padding: '12px', fontSize: '16px', background: 'transparent',
                            border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                            borderRadius: '8px', cursor: 'pointer'
                        }}
                        onClick={() => navigate('/writing')}
                    >
                        暂不批改，返回大厅
                    </button>
                </div>
            </div>
        </div>
    );

    const renderResult = () => (
        <div className="wc-main-layout" style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Left/Top side: Keep user essay and prompt briefly */}
            <div className="wc-editor-card" style={{ flex: '1' }}>
                <div className="wc-editor-header">
                    <h3>回放: 题目与您的作答</h3>
                </div>
                <div style={{ padding: '12px', background: 'var(--bg-section)', borderRadius: '8px', marginBottom: '16px', fontSize: '14px', fontStyle: 'italic' }}>
                    {chartData?.prompt}
                </div>
                <div style={{ flexGrow: 1, whiteSpace: 'pre-wrap', padding: '16px', border: '1px solid var(--border-color)', borderRadius: '8px', overflowY: 'auto' }}>
                    {userAnswer}
                </div>
                <div className="wc-editor-footer" style={{ marginTop: '16px' }}>
                    <button
                        className="secondary-button"
                        style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border-color)', cursor: 'pointer' }}
                        onClick={() => navigate('/writing/chart')}
                    >
                        再去练一篇
                    </button>
                </div>
            </div>

            {/* Right side: Evaluation Result utilizing wc-result-card layout */}
            {result && (
                <div className="wc-result-card" style={{ flex: '1.2' }}>
                    <h2 className="wc-overall-band">
                        综合得分 (Overall Band)
                        <span>{result.overall.toFixed(1)}</span>
                    </h2>

                    <div className="wc-scores-grid">
                        <div className="wc-score-item">
                            <div className="wc-score-label">🎯 任务回应 (Task Achievement)</div>
                            <div className="wc-score-val">{result.scores.ta.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">🔗 连贯衔接 (Coherence & Cohesion)</div>
                            <div className="wc-score-val">{result.scores.cc.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">📚 词汇资源 (Lexical Resource)</div>
                            <div className="wc-score-val">{result.scores.lr.toFixed(1)}</div>
                        </div>
                        <div className="wc-score-item">
                            <div className="wc-score-label">📝 语法多样性 (Grammatical Range)</div>
                            <div className="wc-score-val">{result.scores.gra.toFixed(1)}</div>
                        </div>
                    </div>

                    <div className="wc-feedback-box">
                        <h3>💡 Detailed Feedback by AI Examiner</h3>
                        <div className="wc-feedback-content">
                            {result.feedback.split('\n').map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <Layout>
            <div className="practice-container" style={{ maxWidth: '100%', padding: '24px 40px' }}>
                <div className="practice-header" style={{ marginBottom: '24px' }}>
                    <button className="back-link" onClick={() => navigate('/writing/chart')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                        ← 返回图表选型
                    </button>
                    <h1>📊 图表特训 (Task 1)</h1>
                </div>

                {step === 'loading' && renderLoading()}

                {step === 'answering' && renderAnswering()}

                {step === 'settlement' && (
                    <>
                        {renderAnswering()} {/* Keep the background visible */}
                        {renderSettlement()}
                    </>
                )}

                {step === 'evaluating' && renderEvaluating()}

                {step === 'result' && renderResult()}
            </div>
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </Layout>
    );
}
