import re

filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

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

old_render = '''<div className="wc-essay-content">
                                    {text.split(/\\n\\n+/).map((para, idx) => (
                                        <p key={idx} className="wc-essay-paragraph">{para}</p>
                                    ))}
                                </div>'''
new_render = '''<div className="wc-essay-content">
                                    {renderAnnotatedText()}
                                </div>'''

content = content.replace(old_render, new_render)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
