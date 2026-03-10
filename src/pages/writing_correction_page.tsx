import Layout from '../components/Layout';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import AiModelSelector from '../components/AiModelSelector';
import { showToast } from '../components/Toast';
import { api } from '../api/client';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
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
    const { lang } = useLang();
    const t = translations[lang];

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
            showToast(t.writingCorrection.toastEmpty, 'error');
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
            showToast(t.writingCorrection.toastSuccess, 'success');
        } catch (err: unknown) {
            console.error('Submit writing correction error:', err);
            const error = err as { message?: string, title?: string };
            showToast(error.message || t.writingCorrection.toastFail, 'error', error.title || t.writingCorrection.toastErrorTitle);
        } finally {
            setIsEvaluating(false);
        }
    };

    return (
        <Layout>
            <div className="practice-container" style={{ maxWidth: '100%', padding: '24px 40px' }}>
                <div className="wc-header-row">
                    <div className="practice-header" style={{ marginBottom: 0 }}>
                        <button className="back-link" onClick={() => navigate('/writing')} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                            {t.writingCorrection.backToHall}
                        </button>
                        <h1>{t.writingCorrection.title}</h1>
                        <p>{t.writingCorrection.subtitle}</p>
                    </div>

                    <div className="wc-model-box">
                        <AiModelSelector />
                    </div>
                </div>

                <div className="wc-main-layout">
                    {/* 左边：输入与统计区域 */}
                    <div className="wc-editor-card">
                        <div className="wc-editor-header">
                            <h3>{t.writingCorrection.yourEssay}</h3>
                            <span className="wc-word-count">{t.writingCorrection.wordCount}<strong>{wordCount}</strong> / 250+</span>
                        </div>
                        <textarea
                            className="wc-textarea"
                            placeholder={t.writingCorrection.placeholder}
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            disabled={isEvaluating}
                        ></textarea>
                        <div className="wc-editor-footer">
                            <button
                                className={`skill-btn reading wc-eval-btn ${isEvaluating ? 'loading' : ''}`}
                                onClick={handleEvaluate}
                                disabled={isEvaluating}
                            >
                                {isEvaluating ? t.writingCorrection.evaluatingBtn : t.writingCorrection.evaluateBtn}
                            </button>
                        </div>
                    </div>

                    {/* 右面：评判结果 */}
                    {result && (
                        <div className="wc-result-card">
                            <h2 className="wc-overall-band">
                                {t.writingCorrection.overallBand}
                                <span>{result.Overall_Band.toFixed(1)}</span>
                            </h2>

                            <div className="wc-scores-grid">
                                <div className="wc-score-item">
                                    <div className="wc-score-label">{t.writingCorrection.ta}</div>
                                    <div className="wc-score-val">{result.Task_Response.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">{t.writingCorrection.cc}</div>
                                    <div className="wc-score-val">{result.Coherence_Cohesion.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">{t.writingCorrection.lr}</div>
                                    <div className="wc-score-val">{result.Lexical_Resource.toFixed(1)}</div>
                                </div>
                                <div className="wc-score-item">
                                    <div className="wc-score-label">{t.writingCorrection.gra}</div>
                                    <div className="wc-score-val">{result.Grammatical_Range.toFixed(1)}</div>
                                </div>
                            </div>

                            <div className="wc-feedback-box">
                                <h3>{t.writingCorrection.examinerFeedback}</h3>
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
