import Layout from '../components/Layout';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../components/AiModelSelector';
import { showToast } from '../components/Toast';
import { api } from '../api/client';
import '../styles/practice_page.css';
import '../styles/writing_correction.css';

interface CorrectionResponse {
    Task_Response: number;
    Coherence_Cohesion: number;
    Lexical_Resource: number;
    Grammatical_Range: number;
    Overall_Band: number;
    Feedback: string;
}

export default function WritingCorrectionPage() {
    const navigate = useNavigate();

    const [text, setText] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [result, setResult] = useState<CorrectionResponse | null>(null);

    // 实时计算字数 (使用正则 \s+ 分割并去除空白符)
    const wordCount = useMemo(() => {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }, [text]);

    const handleEvaluate = async () => {
        if (!text.trim()) {
            showToast('The text box is empty! Please write something first.', 'error');
            return;
        }

        setIsEvaluating(true);
        setResult(null);

        try {
            const res = await api<CorrectionResponse>('/writing/generate', {
                method: 'POST',
                body: { text },
            });
            setResult(res);
            showToast('Evaluation complete!', 'success');
        } catch (err: unknown) {
            console.error('Submit writing correction error:', err);
            const error = err as { message?: string, title?: string };
            showToast(error.message || '提交失败', 'error', error.title || '错误');
        } finally {
            setIsEvaluating(false);
        }
    };

    return (
        <Layout>
            <div className=".*">
                <div className="wc-header-row">
                    <div className="practice-header" style={{ marginBottom: 0 }}>
                        <button className="back-link" onClick={() => navigate('/writing')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            ← 写作大厅
                        </button>
                        <h1>📝 AI写作板块 (AI Writing)</h1>
                        <p>将你的作文输入下方，获知各项评分雅思标准分级图表</p>
                    </div>

                    <div className="wc-model-box">
                        <AiModelSelector />
                    </div>
                </div>

                <div className="wc-main-layout">
                    {/* 左边：输入与统计区域 */}
                    <div className="wc-editor-card">
                        <div className="wc-editor-header">
                            <h3>你的作文内容</h3>
                            <span className="wc-word-count">字数: <strong>{wordCount}</strong> / 250+</span>
                        </div>
                        <textarea
                            className="wc-textarea"
                            placeholder="Type or paste your IELTS Task 1 or Task 2 essay here..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={isEvaluating}
                        ></textarea>
                        <div className="wc-editor-footer">
                            <button
                                className={`skill - btn reading wc - eval - btn ${isEvaluating ? 'loading' : ''} `}
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                            >
                                {isEvaluating ? '⏳ AI 正在深度批改中...' : '🏁 开始批改 (Evaluate)'}
                            </button>
                        </div>
                    </div>

                    {/* 右面：评判结果 */}
                    {result && (
                        <div className="wc-result-card">
                            <h2 className="wc-overall-band">
                                综合得分 (Overall Band)
                                <span>{result.Overall_Band.toFixed(1)}</span>
                            </h2>

                            <div className="wc-scores-grid">
                                <div className="wc-score-item">
                                    <div className="wc-score-label">🎯 任务回应 (Task Response)</div>
                                    <div className="wc-score-val">{result.Task_Response.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">🔗 连贯与衔接 (Coherence & Cohesion)</div>
                                    <div className="wc-score-val">{result.Coherence_Cohesion.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">📚 词汇资源 (Lexical Resource)</div>
                                    <div className="wc-score-val">{result.Lexical_Resource.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">📝 语法多样性 (Grammatical Range)</div>
                                    <div className="wc-score-val">{result.Grammatical_Range.toFixed(1)}</div>
                                </div>
                            </div>

                            <div className="wc-feedback-box">
                                <h3>💡 Detailed Feedback by AI Examiner</h3>
                                <div className="wc-feedback-content">
                                    {/* 简单解析下 markdown 换行 */}
                                    {result.Feedback.split('\n').map((line, idx) => (
                                        <p key={idx}>{line}</p>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
