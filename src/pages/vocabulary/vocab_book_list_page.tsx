import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import { showToast } from '../../components/common/Toast';
import { listVocabBooks, type VocabBook } from '../../api/learning_plan';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_page.css';
import '../../styles/vocabulary_notebook.css';

export default function VocabBookListPage() {
    const { t } = useLang();
    const [books, setBooks] = useState<VocabBook[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        listVocabBooks()
            .then(r => setBooks(r.books))
            .catch(() => showToast(t('vocab.common.loadBooksFail'), 'error'))
            .finally(() => setLoading(false));
    }, []);

    return (
        <Layout
    pageTitle={t('vocab.books.title')}
    pageSubtitle={t('vocab.books.desc')}
    backUrl='/vocabulary'
    backText={`${t('common.back')} ${t('vocab.hub.title')}`}
>
            <div className="config-page-wrap">
                {loading ? (
                    <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '40px' }}>{t('common.loading')}</p>
                ) : books.length === 0 ? (
                    <div className="nb-empty">
                        <span className="nb-empty-icon">📚</span>
                        {t('vocab.books.emptyTitle')}
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
                                    <span className="nb-card-word-count">{t('vocab.notebooks.cardWordCount').replace('{n}', book.word_count.toString())}</span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </Layout>
    );
}
