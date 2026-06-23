import Layout from '../components/layout/Layout';
import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext';
import { translations } from '../i18n/translations';
import '../styles/practice_hub.css';

export default function AIPractice() {
    const { lang } = useLang();
    const t = translations[lang].aiPractice;

    return (
        <Layout>
            <div className="practice-hub">
                <div className="practice-hub-container">
                    <div className="practice-hub-header">
                        <Link to="/practice" className="back-link">{t.backToPractice}</Link>
                        <h1>{t.heading}</h1>
                        <p>{t.subheading}</p>
                    </div>

                    <div className="bento-grid">
                        {/* AI 题库 — 听/读/写 题库入口 */}
                        <Link to="/practice/ai/bank" className="bento-card bento-bank">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t.bank.title}</div>
                                <div className="bento-desc">{t.bank.desc}</div>
                            </div>
                            <span className="bento-icon">📚</span>
                        </Link>
                        
                        {/* Reading - Spans 2 cols */}
                        <Link to="/practice/ai/reading" className="bento-card bento-reading">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">📖</span>
                                <div className="bento-title">{t.reading.title}</div>
                                <div className="bento-desc">{t.reading.desc}</div>
                            </div>
                        </Link>

                        {/* Speaking - Tall card, spans 2 rows */}
                        <Link to="/speaking" className="bento-card bento-speaking">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t.speaking.title}</div>
                                <div className="bento-desc">{t.speaking.desc}</div>
                            </div>
                            <span className="bento-icon">🗣️</span>
                        </Link>

                        {/* Listening - Square card */}
                        <Link to="/practice/ai/listening" className="bento-card bento-listening">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">🎧</span>
                                <div className="bento-title">{t.listening.title}</div>
                                <div className="bento-desc">{t.listening.desc}</div>
                            </div>
                        </Link>

                        {/* Writing - Square card */}
                        <Link to="/writing" className="bento-card bento-writing">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <span className="bento-icon">✍️</span>
                                <div className="bento-title">{t.writing.title}</div>
                                <div className="bento-desc">{t.writing.desc}</div>
                            </div>
                        </Link>


                        <Link to="/practice/ai/others" className="bento-card bento-others">
                            <div className="bento-glow"></div>
                            <div className="bento-content">
                                <div className="bento-title">{t.others.title}</div>
                                <div className="bento-desc">{t.others.desc}</div>
                            </div>
                            <span className="bento-icon">🧩</span>
                        </Link>

                    </div>
                </div>
            </div>
        </Layout>
    );
}
