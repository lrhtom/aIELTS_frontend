import re

filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# First, ensure states and imports are there (from fix_tabs)
if "const [activeTab" not in content:
    content = content.replace(
        "const [isEvaluating, setIsEvaluating] = useState(false);",
        "const [isEvaluating, setIsEvaluating] = useState(false);\n    const [activeTab, setActiveTab] = useState<'feedback' | 'sentence' | 'vocab' | 'improved' | 'model'>('feedback');\n    const [transMode, setTransMode] = useState<'en' | 'zh'>('en');\n    const [translatedTexts, setTranslatedTexts] = useState<Record<string, string>>({});\n    const [isTranslating, setIsTranslating] = useState(false);\n    const [copied, setCopied] = useState(false);"
    )

if "import translate" not in content:
    content = content.replace(
        "import { useState, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';",
        "import { useState, useMemo, useRef, type ChangeEvent, type DragEvent } from 'react';\nimport translate from 'translate';\ntranslate.engine = 'google';"
    )

highlight_logic = '''
    const renderAnnotatedText = () => {
        if (!result) return text.split(/\\n\\n+/).map((para, idx) => <p key={idx} className="wc-essay-paragraph">{para}</p>);

        let annotatedHtml = text;

        const sentences = [...(result.Sentence_Corrections || [])].sort((a, b) => b.original.length - a.original.length);
        const vocabs = [...(result.Vocabulary_Upgrades || [])].sort((a, b) => b.original.length - a.original.length);

        sentences.forEach(corr => {
            const severityClass = corr.severity === 'suggestion' ? 'severity-suggestion' : 'severity-warning';
            const escaped = corr.original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            annotatedHtml = annotatedHtml.replace(new RegExp(escaped, 'g'), `<span class="wc-inline-error ${severityClass}" title="${corr.explanation.replace(/"/g, '&quot;')}">${corr.original}</span>`);
        });

        vocabs.forEach(vocab => {
            const escaped = vocab.original.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
            annotatedHtml = annotatedHtml.replace(new RegExp(escaped, 'g'), `<span class="wc-inline-error type-vocabulary" title="Upgrades: ${vocab.upgrades.join(', ')}">${vocab.original}</span>`);
        });

        return annotatedHtml.split(/\\n\\n+/).map((para, idx) => (
            <p key={idx} className="wc-essay-paragraph" dangerouslySetInnerHTML={{ __html: para }} />
        ));
    };
'''

if "const renderAnnotatedText" not in content:
    content = content.replace('    return (\n        <Layout', highlight_logic + '\n    return (\n        <Layout')


# We will use regex to capture everything from wc-result-card to the end of wc-body
match = re.search(r'(<div className="wc-result-card">.*?)(\s*</Layout>)', content, re.DOTALL)
if match:
    old_result_card = match.group(1)
    
    new_result_card = '''<div className="wc-result-view">
                            {/* 1. Left: Your Essay */}
                            <div className="wc-essay-panel">
                                <div className="wc-panel-header">
                                    <div className="wc-panel-title">✍️ {lang === 'zh' ? '您的作文 (带批注)' : 'Your Essay (Annotated)'}</div>
                                </div>
                                <div className="wc-essay-content">
                                    {renderAnnotatedText()}
                                </div>
                            </div>

                            {/* 2. Middle: Corrections & Feedback Tabs */}
                            <div className="wc-corrections-panel">
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

                                <div className="wc-corrections-content">
                                    {activeTab === 'feedback' && (
                                        <div className="wc-correction-card">
                                            <h3>{t.writingCorrection.examinerFeedback}</h3>
                                            <div style={{ marginTop: '12px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
                                                {(result.Feedback || result.feedback || '').split('\\n').map((line, idx) => (
                                                    <p key={idx} style={{ marginBottom: '8px' }}>{line}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'sentence' && result.Sentence_Corrections && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {result.Sentence_Corrections.map((corr, idx) => (
                                                <div key={idx} className="wc-correction-card">
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
                                    )}

                                    {activeTab === 'vocab' && result.Vocabulary_Upgrades && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                            {result.Vocabulary_Upgrades.map((vocab, idx) => (
                                                <div key={idx} className="wc-correction-card">
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
                                    )}

                                    {activeTab === 'improved' && result.Revised_Essay && (
                                        <div className="wc-correction-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{lang === 'zh' ? '翻译中...' : 'Loading...'}</div>
                                                ) : (
                                                    (transMode === 'en' ? result.Revised_Essay : (translatedTexts['improved'] || '')).split(/\\n\\n+/).map((para, idx) => (
                                                        <p key={idx} style={{ marginBottom: '16px' }}>{para.trim()}</p>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'model' && result.Model_Essay && (
                                        <div className="wc-correction-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
                                            </div>
                                            <div style={{ lineHeight: 1.8, fontSize: '1.05rem', color: '#334155' }}>
                                                {isTranslating && transMode === 'zh' ? (
                                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>{lang === 'zh' ? '翻译中...' : 'Loading...'}</div>
                                                ) : (
                                                    (transMode === 'en' ? result.Model_Essay : (translatedTexts['model'] || '')).split(/\\n\\n+/).map((para, idx) => (
                                                        <p key={idx} style={{ marginBottom: '16px' }}>{para.trim()}</p>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Right: Scores Panel */}
                            <div className="wc-score-panel">
                                <div className="wc-score-header-box">
                                    <div className="wc-score-overall-flex">
                                        <div>
                                            <div className="wc-score-overall-text">{t.writingCorrection.overallBand}</div>
                                            <div className="wc-score-overall-sub">{t.writingCorrection.overallBandSubtitle}</div>
                                        </div>
                                        <div className="wc-score-overall-val">{result.Overall_Band.toFixed(1)}</div>
                                    </div>
                                    <div className="wc-subscores-box" style={{ background: '#ffffff', borderRadius: '12px', padding: '16px' }}>
                                        <div className="wc-subscores">
                                            {scores.map(({ label, val }) => (
                                                <div key={label} className="wc-subscore-row">
                                                    <div className="wc-subscore-label">{label}</div>
                                                    <div className="wc-subscore-val">{val.toFixed(1)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {result.Actionable_Advice && result.Actionable_Advice.length > 0 && (
                                    <div style={{ padding: '20px' }}>
                                        <div className="wc-overall-feedback">
                                            <h3 style={{ marginBottom: '12px', fontSize: '1rem', color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>🚀</span> {lang === 'zh' ? '下一步提升建议' : 'Actionable Advice'}
                                            </h3>
                                            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                {result.Actionable_Advice.map((advice, idx) => (
                                                    <li key={idx} style={{ lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>{advice}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="wc-result-placeholder">
                            <div className="wc-placeholder-icon">🤖</div>
                            <h3>{lang === 'zh' ? '等待批改' : 'Waiting for evaluation'}</h3>
                            <p>{lang === 'zh' ? '请在左侧输入您的作文并点击“开始批改”' : 'Please input your essay on the left and click "Evaluate"'}</p>
                        </div>
                    )}
                </div>
            </div>'''
            
    content = content.replace(old_result_card, new_result_card)

# Now, we extract the editor logic and rearrange `wc-body`
# The editor is currently at the top of wc-body:
# <div className="wc-body">
#     <div className="wc-editor-card"> ... </div>
#     {result ? ...

editor_match = re.search(r'(<div className="wc-editor-card">.*?</div>\s*)\{result \?', content, re.DOTALL)
if editor_match:
    editor_block = editor_match.group(1)
    # Remove it
    content = content.replace(editor_block, '{result ?')
    
    # Now replace the whole {result ? (...) : (...)} block with a layout that only shows the editor on the false branch
    body_match = re.search(r'\{result \? \(\s*<div className="wc-result-view">([\s\S]*?)</div>\s*\) : \(\s*<div className="wc-result-placeholder">([\s\S]*?)</div>\s*\)\}', content)
    if body_match:
        result_view = body_match.group(1)
        placeholder = body_match.group(2)
        
        new_layout = f'''{{result ? (
                        <div className="wc-result-view">
                            {result_view}
                        </div>
                    ) : (
                        <div className="wc-body">
                            {editor_block}
                            <div className="wc-result-placeholder">
                                {placeholder}
                            </div>
                        </div>
                    )}}'''
        
        # Replace the wc-body wrapper! Wait, if we replace {result...} we still have an outer <div className="wc-body">.
        # We need to remove the outer <div className="wc-body"> entirely.
        outer_match = re.search(r'<div className="wc-body">\s*\{result \? \([\s\S]*?\)\s*</div>\s*</div>', content)
        if outer_match:
            # We must be careful not to strip the closing Layout tag
            # The structure is:
            # <div className="wc-body">
            #   {result ? ... }
            # </div>
            # </Layout>
            # So let's just do a string replace of the `<div className="wc-body">\s*{result ?`
            content = re.sub(r'<div className="wc-body">\s*\{result \?', '{result ?', content)
            # And then find the closing `</div>\s*</div>` before `</Layout>` and remove one `</div>`
            content = re.sub(r'</div>\s*</div>\s*</Layout>', '</div>\n            </Layout>', content)
            
            # Now replace the {result ? ...} part
            content = content.replace(body_match.group(0), new_layout)


with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
