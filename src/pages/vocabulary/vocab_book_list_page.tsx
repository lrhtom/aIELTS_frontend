import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { listVocabBooks, type VocabBook } from '../../api/learning_plan';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';

export default function VocabBookListPage() {
    const [books, setBooks] = useState<VocabBook[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listVocabBooks()
            .then(r => setBooks(r.books))
            .catch(() => showToast('加载词书失败', 'error'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Layout>
            <div className="config-page-wrap">
                <div className="practice-header">
                    <Link to="/vocabulary" className="back-link">返回词汇学习</Link>
                    <h1>官方词书</h1>
                    <p>浏览官方词汇书，查看 IELTS 核心词汇</p>
                </div>

                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px' }}>加载中...</p>
                ) : books.length === 0 ? (
                    <div className="nb-empty">
                        <span className="nb-empty-icon">📚</span>
                        暂无官方词书
                    </div>
                ) : (
                    <div className="nb-grid">
                        {books.map(book => (
                            <Link
                                key={book.id}
                                to={`/vocabulary/books/${book.id}`}
                                className="nb-card"
                                data-color="teal"
                                style={{ textDecoration: 'none' }}
                            >
                                <div className="nb-card-title">{book.name}</div>
                                {book.description && (
                                    <div className="nb-card-desc">{book.description}</div>
                                )}
                                <div className="nb-card-meta">
                                    <span className="nb-card-word-count">{book.word_count} 词</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
