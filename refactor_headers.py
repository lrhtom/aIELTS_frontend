import os
import re

files = [
    "src/pages/listening/listening_config.tsx",
    "src/pages/speaking/speaking.tsx",
    "src/pages/vocabulary/notebook_list_page.tsx",
    "src/pages/vocabulary/learning_plan_list_page.tsx",
    "src/pages/vocabulary/vocab_book_list_page.tsx",
    "src/pages/vocabulary/custom_memory_create_page.tsx",
    "src/pages/vocabulary/notebook_detail_page.tsx",
    "src/pages/vocabulary/vocab_book_detail_page.tsx",
    "src/pages/vocabulary/vocabulary_flashcard_config_page.tsx",
    "src/pages/vocabulary/vocabulary_training_page.tsx",
    "src/pages/writing/chart_selection_page.tsx",
    "src/pages/writing/writing_chat_config_page.tsx",
    "src/pages/writing/writing_page.tsx",
    "src/pages/reading/WordSelection_page.tsx"
]

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return

    # Find Layout tag
    layout_match = re.search(r'<Layout(?!\w)[^>]*>', content)
    if not layout_match:
        print(f"No Layout tag found in {filepath}")
        return

    # Find practice-header block
    header_match = re.search(r'<div className="practice-header"[^>]*>([\s\S]*?)</div>\s*(?:<!--.*?-->)?', content)
    if not header_match:
        print(f"No practice-header found in {filepath}")
        return

    header_inner = header_match.group(1)
    
    # Extract back link URL
    back_url_match = re.search(r'<Link\s+to="([^"]+)"[^>]*>([^<]+)</Link>', header_inner)
    if not back_url_match:
        back_url_match = re.search(r'<Link\s+to=\{([^}]+)\}[^>]*>([^<]+)</Link>', header_inner)
    
    back_url = back_url_match.group(1) if back_url_match else 'null'
    back_text = back_url_match.group(2) if back_url_match else 'null'

    # Extrat Title
    title_match = re.search(r'<h1[^>]*>([^<]+)</h1>', header_inner)
    title_str = title_match.group(1) if title_match else 'null'
    
    if title_str == 'null':
        title_match = re.search(r'<h1[^>]*>(\{.*?\})</h1>', header_inner)
        title_str = title_match.group(1) if title_match else 'null'

    # Extract Subtitle
    subtitle_match = re.search(r'<p[^>]*>([^<]+)</p>', header_inner)
    subtitle_str = subtitle_match.group(1) if subtitle_match else 'null'
    
    if subtitle_str == 'null':
        subtitle_match = re.search(r'<p[^>]*>(\{.*?\})</p>', header_inner)
        subtitle_str = subtitle_match.group(1) if subtitle_match else 'null'

    # Do the replace
    new_layout = f'<Layout\n    pageTitle={repr(title_str) if not title_str.startswith("{") else title_str}\n    pageSubtitle={repr(subtitle_str) if not subtitle_str.startswith("{") else subtitle_str}\n    backUrl={repr(back_url) if not back_url.startswith("{") else back_url}\n    backText={repr(back_text) if not back_text.startswith("{") else back_text}\n>'
    
    new_content = content.replace(layout_match.group(0), new_layout)
    new_content = new_content.replace(header_match.group(0), '')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print(f"Refactored {filepath}")

for f in files:
    process_file(f)
