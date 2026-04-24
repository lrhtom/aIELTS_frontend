import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { listVocabBooks, listBookWords, type VocabBook, type BookWord } from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';
import '../../styles/vocabulary_learning_plan.css';

const PAGE_SIZE = 20;

export default function VocabBookDetailPage() {
    const { translations: t } = useLang();
    const { id } = useParams<{ id: string }>();
    const bookId = Number(id);

    const [book, setBook] = useState<VocabBook | null>(null);
    const [words, setWords] = useState<BookWord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageJumpInput, setPageJumpInput] = useState('');
    const [searchQ, setSearchQ] = useState('');
    const [debouncedSearchQ, setDebouncedSearchQ] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchQ(searchQ.trim());
        }, 250);
        return () => clearTimeout(timer);
    }, [searchQ]);

    useEffect(() => {
        listVocabBooks()
            .then(r => {
                const b = r.books.find(b => b.id === bookId);
                if (b) setBook(b);
            })
            .catch(() => {});
    }, [bookId]);

    const loadWords = useCallback(async () => {
        setLoading(true);
        try {
            const r = await listBookWords(bookId, page, PAGE_SIZE, debouncedSearchQ || undefined);
            setWords(r.words);
            setTotal(r.total);
        } catch {
            showToast('加载单词失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [bookId, page, debouncedSearchQ]);

    useEffect(() => { loadWords(); }, [loadWords]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handlePageJump = () => {
        const rawValue = pageJumpInput.trim();
        if (!rawValue) {
            showToast('请输入页码', 'error');
            return;
        }
        const parsed = Number(rawValue);
        if (!Number.isInteger(parsed)) {
            showToast(`请输入 1 到 ${totalPages} 的整数页码`, 'error');
            return;
        }
        setPage(Math.min(totalPages, Math.max(1, parsed)));
        setPageJumpInput('');
    };

    return (
        <Layout>
            <div className="config-page-wrap">
                <div className="practice-header">
                    <Link to="/vocabulary/books" className="back-link">{t.common.back}{t.vocab.books.title}</Link>
                    <h1>{book?.name || t.vocab.bookDetail.titleDefault}</h1>
                    {book?.description && <p>{book.description}</p>}
                    {book && <p>{t.vocab.bookDetail.wordCount.replace('{n}', String(book.word_count))}</p>}
                </div>

                {/* Search */}
                <div className="config-card" style={{ paddingBottom: '16px' }}>
                    <div className="nb-search-bar">
                        <input
                            className="nb-search-input"
                            placeholder={t.vocab.bookDetail.searchPlaceholder}
                            value={searchQ}
                            onChange={e => { setSearchQ(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                {/* Word list */}
                <div className="config-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '30px' }}>{t.common.loading}</p>
                    ) : words.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📖</span>
                            {searchQ ? t.vocab.bookDetail.emptySearch : t.vocab.bookDetail.emptyTitle}
                        </div>
                    ) : (
                        <div className="word-list">
                            {words.map(w => (
                                <div key={w.id} className="word-item" style={{ gridTemplateColumns: '48px 160px 1fr' }}>
                                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                                        {w.order}
                                    </span>
                                    <div className="wi-word">
                                        {w.word}
                                        {w.phonetic && <span className="wi-phonetic">{w.phonetic}</span>}
                                    </div>
                                    <div className="wi-zh">{w.zh_brief}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="lp-pager" style={{ marginTop: 12 }}>
                        <button className="lp-page-btn" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                            {t.vocab.bookDetail.prevPage}
                        </button>
                        <span className="lp-page-info">{t.vocab.bookDetail.pagerTemplate.replace('{page}', String(page)).replace('{total}', String(totalPages)).replace('{count}', String(total))}</span>
                        <button className="lp-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                            {t.vocab.bookDetail.nextPage}
                        </button>
                        <div className="lp-page-jump">
                            <span>跳到</span>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pageJumpInput}
                                onChange={e => {
                                    const next = e.target.value;
                                    if (next === '' || /^\d+$/.test(next)) {
                                        setPageJumpInput(next);
                                    }
                                }}
                                onKeyDown={e => { if (e.key === 'Enter') handlePageJump(); }}
                                placeholder="页码"
                                aria-label="跳转到指定页"
                            />
                            <button
                                type="button"
                                onClick={handlePageJump}
                                disabled={!pageJumpInput.trim()}
                            >
                                GO
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
