filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Find `<div className="wc-body">`
body_start = content.find('                <div className="wc-body">')
editor_end = content.find('                    {/* Right: Result or Pending Placeholder */}')
# Editor block includes from `<div className="wc-body">` up to editor_end
editor_block = content[body_start + len('                <div className="wc-body">\n\n'):editor_end]

# Extract the ternary
result_ternary_start = content.find('{result ? (', editor_end)
placeholder_start = content.find(') : (\n                        <div className="wc-result-placeholder">')
ternary_end = content.find('                    )}\n                </div>\n            </div>\n        </Layout>', placeholder_start) + len('                    )}')

# The result view block
result_view_block = content[result_ternary_start + len('{result ? ('):placeholder_start].strip()

# The placeholder block
placeholder_block = content[placeholder_start + len(') : ('):ternary_end].strip()

new_content = content[:body_start] + f'''                {{result ? (
                    {result_view_block}
                ) : (
                    <div className="wc-body">
{editor_block}
                        {placeholder_block}
                    </div>
                )}}
            </div>
        </Layout>
    );
}}
'''

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)
