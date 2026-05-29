import os

files = [
    "src/pages/vocabulary/learning_plan_list_page.tsx",
    "src/pages/vocabulary/notebook_list_page.tsx",
    "src/pages/vocabulary/vocab_book_detail_page.tsx",
    "src/pages/vocabulary/vocab_book_list_page.tsx"
]

for f in files:
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
        
    content = content.replace('backText={t.common.back}{t.vocab.hub.title}', 'backText={`${t.common.back} ${t.vocab.hub.title}`}')
    content = content.replace("pageTitle='null'", "pageTitle={t.vocab.plans.title}")
    content = content.replace("pageSubtitle='null'", "pageSubtitle={t.vocab.plans.subtitle}")
    content = content.replace("pageTitle={t.vocab.bookDetail.titleDefault}", "pageTitle={book?.name || t.vocab.bookDetail.titleDefault}")
    content = content.replace("pageSubtitle={t.vocab.bookDetail.wordCount.replace('{n}', String(book.word_count))}", "pageSubtitle={book ? `${book.description || ''} ${t.vocab.bookDetail.wordCount.replace('{n}', String(book.word_count))}` : undefined}")
    
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)
