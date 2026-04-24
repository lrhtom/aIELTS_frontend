import Layout from '../../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/practice_hub.css';

export default function VocabularyPracticePage() {
    const { translations: t } = useLang();

    return (
        <Layout>
            <div className="practice-hub-container">
                <div className="practice-hub-header">
                    <Link to="/" className="back-link">{t.common.back + t.common.home}</Link>
                    <h1>{t.vocab.hub.title}</h1>
                    <p>{t.vocab.hub.desc}</p>
                </div>

                <div className="skill-grid">
                    <Link to="/vocabulary/practice" className="skill-entry reading" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">📝</span>
                        <div className="skill-name">{t.vocab.hub.practiceTitle}</div>
                        <div className="skill-sub">{t.vocab.hub.practiceDesc}</div>
                    </Link>

                    <Link to="/vocabulary/plans" className="skill-entry listening" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">🃏</span>
                        <div className="skill-name">{t.vocab.hub.plansTitle}</div>
                        <div className="skill-sub">{t.vocab.hub.plansDesc}</div>
                    </Link>

                    <Link to="/vocabulary/notebook" className="skill-entry writing" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">📓</span>
                        <div className="skill-name">{t.vocab.hub.notebookTitle}</div>
                        <div className="skill-sub">{t.vocab.hub.notebookDesc}</div>
                    </Link>

                    <Link to="/vocabulary/books" className="skill-entry speaking" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">📚</span>
                        <div className="skill-name">{t.vocab.hub.booksTitle}</div>
                        <div className="skill-sub">{t.vocab.hub.booksDesc}</div>
                    </Link>
                </div>
            </div>
        </Layout>
    );
}
