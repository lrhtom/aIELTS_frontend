import re
import os

files = ['src/i18n/translations.zh.ts', 'src/i18n/translations.en.ts']
for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    # Let's just remove any ← characters or <- from the file completely.
    content = content.replace('← ', '').replace('<- ', '').replace('←', '').replace('<-', '')
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
print("Done")
