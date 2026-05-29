import re
filepath = 'src/styles/writing_correction_result.css'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Restore Pill Tabs
tabs_css = '''/* Refined Pill Tabs */
.wc-tabs {
    display: flex;
    padding: 12px 16px;
    gap: 8px;
    background: #ffffff;
    border-bottom: 1px solid rgba(0,0,0,0.04);
}

.wc-tab-btn {
    padding: 8px 16px;
    border: none;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}

.wc-tab-btn:hover {
    background: #e2e8f0;
    color: #334155;
}

.wc-tab-btn.active {
    background: #0f766e;
    color: #ffffff;
    box-shadow: 0 2px 6px rgba(15, 118, 110, 0.25);
}'''
content = re.sub(r'/\* Refined Minimalist Tabs \*/.*?\.wc-corrections-content \{', tabs_css + '\n\n.wc-corrections-content {', content, flags=re.DOTALL)

# Restore panel borders
panels_css = '''/* Common Panel Style */
.wc-panel-base {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.04);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}

/* ─── Left Panel: Essay with Inline Annotations ────────────────────────── */
.wc-essay-panel {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.04);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}'''
content = re.sub(r'/\* Common Panel Style \*/.*?\.wc-panel-header \{', panels_css + '\n\n.wc-panel-header {', content, flags=re.DOTALL)

# Re-insert the missing panels that I deleted
middle_panel = '''
/* ─── Middle Panel: Corrections & Feedback ───────────────────────────── */
.wc-corrections-panel {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.04);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
}
'''
if '.wc-corrections-panel {' not in content:
    content = content.replace('/* Refined Pill Tabs */', middle_panel + '\n/* Refined Pill Tabs */')

right_panel = '''
/* ─── Right Panel: Scores & Overall ──────────────────────────────────── */
.wc-score-panel {
    background: #ffffff;
    border: 1px solid rgba(0, 0, 0, 0.04);
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
}
'''
content = re.sub(r'/\* ─── Right Panel: Scores & Overall ──────────────────────────────────── \*/\s*\.wc-score-panel\s*\{\s*overflow-y:\s*auto;\s*overflow-x:\s*hidden;\s*\}', right_panel, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
