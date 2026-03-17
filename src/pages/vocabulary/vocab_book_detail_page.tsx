import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { listVocabBooks, listBookWords, type VocabBook, type BookWord } from '../../api/learning_plan';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';
import '../../styles/vocabulary_learning_plan.css';

const PAGE_SIZE = 20;

export default function VocabBookDetailPage() {
    const { id } = useParams<{ id: string }>();
    const bookId = Number(id);

    const [book, setBook] = useState<VocabBook | null>(null);
    const [words, setWords] = useState<BookWord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [searchQ, setSearchQ] = useState('');
    const [loading, setLoading] = useState(true);

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
            const r = await listBookWords(bookId, page, PAGE_SIZE, searchQ || undefined);
            setWords(r.words);
            setTotal(r.total);
        } catch {
            showToast('加载单词失败', 'error');
        } finally {
            setLoading(false);
        }
    }, [bookId, page, searchQ]);

    useEffect(() => { loadWords(); }, [loadWords]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <Layout>
            <div className="config-page-wrap">
                <div className="practice-header">
                    <Link to="/vocabulary/books" className="back-link">返回词书列表</Link>
                    <h1>{book?.name || '词书详情'}</h1>
                    {book?.description && <p>{book.description}</p>}
                    {book && <p>共 {book.word_count} 个单词</p>}
                </div>

                {/* Search */}
                <div className="config-card" style={{ paddingBottom: '16px' }}>
                    <div className="nb-search-bar">
                        <input
                            className="nb-search-input"
                            placeholder="搜索单词..."
                            value={searchQ}
                            onChange={e => { setSearchQ(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                {/* Word list */}
                <div className="config-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '30px' }}>加载中...</p>
                    ) : words.length === 0 ? (
                        <div className="nb-empty">
                            <span className="nb-empty-icon">📖</span>
                            {searchQ ? '没有匹配的单词' : '词书中暂无单词'}
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
                        <button className="lp-page-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            上一页
                        </button>
                        <span className="lp-page-info">第 {page} / {totalPages} 页 · 共 {total} 词</span>
                        <button className="lp-page-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            下一页
                        </button>
                    </div>
                )}
            </div>
        </Layout>
    );
}
