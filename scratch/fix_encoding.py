filepath = 'src/pages/writing/writing_correction_page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(len(lines)):
    if 'Please input your essay on the left and click "Evaluate"' in lines[i]:
        lines[i] = '                            <p>{lang === \'zh\' ? \'请在左侧输入您的作文并点击“开始批改”\' : \'Please input your essay on the left and click "Evaluate"\'}</p>\n'

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)
