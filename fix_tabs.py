import re

filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add states
if "const [activeTab" not in content:
    content = content.replace(
        "const [isEvaluating, setIsEvaluating] = useState(false);",
        "const [isEvaluating, setIsEvaluating] = useState(false);\n    const [activeTab, setActiveTab] = useState<'feedback' | 'sentence' | 'vocab' | 'improved' | 'model'>('feedback');\n    const [transMode, setTransMode] = useState<'en' | 'zh'>('en');\n    const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});\n    const [isTranslating, setIsTranslating] = useState(false);"
    )

# Add import
if "import translate" not in content:
    content = content.replace(
        "import { useState, useRef, useEffect } from 'react';",
        "import { useState, useRef, useEffect } from 'react';\nimport translate from 'translate';\ntranslate.engine = 'google';"
    )

# Replace wc-result-card content
start_marker = '<div className="wc-result-card">'
end_marker = '</div>\n\n                </div>\n            </div>'
# We will use regex to capture everything from wc-result-card to the end of wc-body
match = re.search(r'(<div className="wc-result-card">.*?)(\s*</Layout>)', content, re.DOTALL)
if match:
    old_result_card = match.group(1)
    
    new_result_card = '''<div className="wc-result-card">
                            {/* Task1-only model image capability status */}
                            {taskType === 'task1' && (
                                <div className={`wc-task1-image-support-status${supportsTask1ImageRecognition ? ' supported' : ' unsupported'}`}>
                                    {supportsTask1ImageRecognition
                                        ? t.writingCorrection.task1ImageModelSupportYes
                                        : t.writingCorrection.task1ImageModelSupportNo}
                                </div>
                            )}

                            {/* Overall band */}
                            <div className="wc-band-display">
                                <div className="wc-band-label">{t.writingCorrection.overallBand}</div>
                                <div className="wc-band-value">{result.Overall_Band.toFixed(1)}</div>
                                <div className="wc-band-subtitle">{t.writingCorrection.overallBandSubtitle}</div>
                            </div>

                            {/* Sub-scores */}
                            <div className="wc-scores-grid">
                                {scores.map(({ label, val }) => (
                                    <div key={label} className="wc-score-item">
                                        <div className="wc-score-label">{label}</div>
                                        <div className="wc-score-val">{val.toFixed(1)}</div>
                                        <div className="wc-score-bar">
                                            <div className="wc-score-bar-fill" style={{ width: `${(val / 9) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="wc-tabs">
                                <button type="button" className={`wc-tab-btn${activeTab === 'feedback' ? ' active' : ''}`} onClick={() => setActiveTab('feedback')}>{lang === 'zh' ? '综合评价' : 'Feedback'}</button>
                                {result.Sentence_Corrections && result.Sentence_Corrections.length > 0 && (
                                    <button type="button" className={`wc-tab-btn${activeTab === 'sentence' ? ' active' : ''}`} onClick={() => setActiveTab('sentence')}>{lang === 'zh' ? '逐句精批' : 'Sentences'}</button>
                                )}
                                {result.Vocabulary_Upgrades && result.Vocabulary_Upgrades.length > 0 && (
                                    <button type="button" className={`wc-tab-btn${activeTab === 'vocab' ? ' active' : ''}`} onClick={() => setActiveTab('vocab')}>{lang === 'zh' ? '词汇升级' : 'Vocab'}</button>
                                )}
                                {result.Revised_Essay && (
                                    <button type="button" className={`wc-tab-btn${activeTab === 'improved' ? ' active' : ''}`} onClick={() => setActiveTab('improved')}>{lang === 'zh' ? '改后作文' : 'Improved'}</button>
                                )}
                                {result.Model_Essay && (
                                    <button type="button" className={`wc-tab-btn${activeTab === 'model' ? ' active' : ''}`} onClick={() => setActiveTab('model')}>{lang === 'zh' ? '高分范文' : 'Model'}</button>
                                )}
                            </div>

                            <div className="wc-tab-content">
                                {activeTab === 'feedback' && (
                                    <>
                                        <div className="wc-feedback-box">
                                            <h3>{t.writingCorrection.examinerFeedback}</h3>
                                            <div className="wc-feedback-content">
                                                {(result.Feedback || result.feedback || '').split('\\n').map((line, idx) => (
                                                    <p key={idx}>{line}</p>
                                                ))}
                                            </div>
                                        </div>
                                        {result.Actionable_Advice && result.Actionable_Advice.length > 0 && (
                                            <div className="wc-feedback-box" style={{ marginTop: '24px', backgroundColor: 'rgba(var(--color-primary-rgb), 0.05)', borderColor: 'rgba(var(--color-primary-rgb), 0.2)' }}>
                                                <h3>🚀 {lang === 'zh' ? '下一步提升建议' : 'Actionable Advice'}</h3>
                                                <div className="wc-feedback-content">
                                                    <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {result.Actionable_Advice.map((advice, idx) => (
                                                            <li key={idx} style={{ lineHeight: 1.6 }}>{advice}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                {activeTab === 'sentence' && result.Sentence_Corrections && (
                                    <div className="wc-feedback-box">
                                        <h3>✍️ {lang === 'zh' ? '逐句精批' : 'Sentence Corrections'}</h3>
                                        <div className="wc-feedback-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {result.Sentence_Corrections.map((corr, idx) => (
                                                <div key={idx} style={{ padding: '16px', borderRadius: '12px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
                                                    <div style={{ marginBottom: '8px' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 600, marginRight: '8px' }}>
                                                            {lang === 'zh' ? '原句' : 'Original'}
                                                        </span>
                                                        <span style={{ textDecoration: 'line-through', color: 'var(--color-text-dim)' }}>{corr.original}</span>
                                                    </div>
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#d1fae5', color: '#10b981', fontWeight: 600, marginRight: '8px' }}>
                                                            {lang === 'zh' ? '修改' : 'Improved'}
                                                        </span>
                                                        <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{corr.improved}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-dim)', borderTop: '1px dashed var(--color-border)', paddingTop: '12px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--color-primary)', marginRight: '6px' }}>[{corr.error_type}]</span>
                                                        {corr.explanation}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'vocab' && result.Vocabulary_Upgrades && (
                                    <div className="wc-feedback-box">
                                        <h3>✨ {lang === 'zh' ? '词汇升级' : 'Vocabulary Upgrades'}</h3>
                                        <div className="wc-feedback-content" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                            {result.Vocabulary_Upgrades.map((vocab, idx) => (
                                                <div key={idx} style={{ flex: '1 1 300px', padding: '12px 16px', borderRadius: '12px', backgroundColor: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                                        <span style={{ color: '#ef4444', textDecoration: 'line-through', fontWeight: 500 }}>{vocab.original}</span>
                                                        <span>➡️</span>
                                                        <span style={{ color: '#10b981', fontWeight: 600 }}>{vocab.upgrades.join(' / ')}</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>
                                                        "{vocab.context}"
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'improved' && result.Revised_Essay && (
                                    <div className="wc-model-essay-box">
                                        <div className="wc-model-essay-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                                                <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{lang === 'zh' ? '英文' : 'English'}</button>
                                                <button type="button" className={`wc-trans-btn${transMode === 'zh' ? ' active' : ''}`} onClick={async () => {
                                                    setTransMode('zh');
                                                    if (!translatedTexts['improved']) {
                                                        setIsTranslating(true);
                                                        try {
                                                            const t = await translate(result.Revised_Essay!, "zh");
                                                            setTranslatedTexts(prev => ({ ...prev, improved: t }));
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setIsTranslating(false);
                                                        }
                                                    }
                                                }}>
                                                    {lang === 'zh' ? '中文翻译' : 'Translation'}
                                                </button>
                                            </div>
                                            <button
                                                className={`wc-copy-btn${copied ? ' copied' : ''}`}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(transMode === 'en' ? result.Revised_Essay! : (translatedTexts['improved'] || ''));
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                            >
                                                {copied ? t.writingCorrection.copiedBtn : t.writingCorrection.copyBtn}
                                            </button>
                                        </div>
                                        <div className="wc-model-essay-content">
                                            {isTranslating && transMode === 'zh' ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t.common.loading}...</div>
                                            ) : (
                                                (transMode === 'en' ? result.Revised_Essay : (translatedTexts['improved'] || '')).split(/\\n\\n+/).map((para, idx) => (
                                                    <p key={idx}>{para.trim()}</p>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'model' && result.Model_Essay && (
                                    <div className="wc-model-essay-box">
                                        <div className="wc-model-essay-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', gap: '8px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
                                                <button type="button" className={`wc-trans-btn${transMode === 'en' ? ' active' : ''}`} onClick={() => setTransMode('en')}>{lang === 'zh' ? '英文' : 'English'}</button>
                                                <button type="button" className={`wc-trans-btn${transMode === 'zh' ? ' active' : ''}`} onClick={async () => {
                                                    setTransMode('zh');
                                                    if (!translatedTexts['model']) {
                                                        setIsTranslating(true);
                                                        try {
                                                            const t = await translate(result.Model_Essay!, "zh");
                                                            setTranslatedTexts(prev => ({ ...prev, model: t }));
                                                        } catch (e) {
                                                            console.error(e);
                                                        } finally {
                                                            setIsTranslating(false);
                                                        }
                                                    }
                                                }}>
                                                    {lang === 'zh' ? '中文翻译' : 'Translation'}
                                                </button>
                                            </div>
                                            <button
                                                className={`wc-copy-btn${copied ? ' copied' : ''}`}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(transMode === 'en' ? result.Model_Essay! : (translatedTexts['model'] || ''));
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                            >
                                                {copied ? t.writingCorrection.copiedBtn : t.writingCorrection.copyBtn}
                                            </button>
                                        </div>
                                        <div className="wc-model-essay-content">
                                            {isTranslating && transMode === 'zh' ? (
                                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{t.common.loading}...</div>
                                            ) : (
                                                (transMode === 'en' ? result.Model_Essay : (translatedTexts['model'] || '')).split(/\\n\\n+/).map((para, idx) => (
                                                    <p key={idx}>{para.trim()}</p>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="wc-result-placeholder">
                            <div className="wc-placeholder-icon">🤖</div>
                            <h3>{t.writingCorrection.placeholderTitle}</h3>
                            <p>{t.writingCorrection.placeholderDesc}</p>
                        </div>
                    )}
                </div>
            </div>'''
            
    content = content.replace(old_result_card, new_result_card)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
