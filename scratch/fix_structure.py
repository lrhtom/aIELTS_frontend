filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Locate the parts
body_start = content.find('                <div className="wc-body">')
editor_start = content.find('                    {/* Left: Editor */}')
result_start = content.find('                    {/* Right: Result or Pending Placeholder */}')
end_of_layout = content.find('            </Layout>')

if body_start == -1 or editor_start == -1 or result_start == -1 or end_of_layout == -1:
    print("Could not find markers")
    exit(1)

# Extract pieces
pre_body = content[:body_start]
editor_block = content[editor_start:result_start]

result_condition_start = content.find('{result ? (', result_start)
result_condition_end = content.find('                    )}\n                </div>', result_condition_start) + len('                    )}')

result_view_block = content[result_condition_start:result_condition_end]

true_branch_start = result_view_block.find('<div className="wc-result-view">')
false_branch_start = result_view_block.find(') : (\n                        <div className="wc-result-placeholder">')

true_branch = result_view_block[true_branch_start:false_branch_start].strip()
placeholder = result_view_block[false_branch_start + len(') : ('):-1].strip()

new_content = pre_body + f'''                {{result ? (
                    {true_branch}
                ) : (
                    <div className="wc-body">
{editor_block}                        {placeholder}
                    </div>
                )}}
            </Layout>
        </div>
    );
}}
'''

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(new_content)
