import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import '../styles/practice_hub.css';

export default function AIPractice() {
    const { t } = useLang();

    return (
        <Layout
            pageTitle={t('aiPractice.heading')}
            pageSubtitle={t('aiPractice.subheading')}
            backUrl="/practice"
            backText={t('aiPractice.backToPractice')}
        >
            <div className="practice-hub">
                <div className="practice-hub-container" style={{paddingTop: '20px'}}>

                    <div className="bento-grid">
                        {/* AI Question Bank - listening / reading / writing entry point */}
                        <Link to="/practice/ai/bank" className="bento-card bento-bank">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t('aiPractice.bank.title')}</div>
                                <div className="bento-desc">{t('aiPractice.bank.desc')}</div>
                            </div>
                            <span className="bento-icon">📚</span>
                        </Link>

                        {/* Reading - Spans 2 cols */}
                        <Link to="/practice/ai/reading" className="bento-card bento-reading">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">📖</span>
                                <div className="bento-title">{t('aiPractice.reading.title')}</div>
                                <div className="bento-desc">{t('aiPractice.reading.desc')}</div>
                            </div>
                        </Link>

                        {/* Speaking - Tall card, spans 2 rows */}
                        <Link to="/speaking" className="bento-card bento-speaking">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t('aiPractice.speaking.title')}</div>
                                <div className="bento-desc">{t('aiPractice.speaking.desc')}</div>
                            </div>
                            <span className="bento-icon">🗣️</span>
                        </Link>

                        {/* Listening - Square card */}
                        <Link to="/practice/ai/listening" className="bento-card bento-listening">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">🎧</span>
                                <div className="bento-title">{t('aiPractice.listening.title')}</div>
                                <div className="bento-desc">{t('aiPractice.listening.desc')}</div>
                            </div>
                        </Link>

                        {/* Writing - Square card */}
                        <Link to="/writing" className="bento-card bento-writing">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">✍️</span>
                                <div className="bento-title">{t('aiPractice.writing.title')}</div>
                                <div className="bento-desc">{t('aiPractice.writing.desc')}</div>
                            </div>
                        </Link>


                        {/* Full mock - generates all four skills at once, timed like the real exam */}
                        <Link to="/practice/ai/mock" className="bento-card bento-mock">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t('mock.menuCard.title')}</div>
                                <div className="bento-desc">{t('mock.menuCard.desc')}</div>
                            </div>
                            <span className="bento-icon">🎯</span>
                        </Link>

                        <Link to="/practice/ai/others" className="bento-card bento-others">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t('aiPractice.others.title')}</div>
                                <div className="bento-desc">{t('aiPractice.others.desc')}</div>
                            </div>
                            <span className="bento-icon">🧩</span>
                        </Link>

                    </div>
                </div>
            </div>
        </Layout>
    );
}
