import { Link } from 'react-router-dom';
import '../styles/home_page.css';

const announcements = [
    { date: '2026-03-01', tag: 'new', content: 'aIELTS v1.0 正式上线！AI 驱动的雅思练习平台现已可用。' },
    { date: '2026-03-01', tag: 'new', content: '📖 阅读模块已上线 — AI 生成 Band 7.0-7.5 阅读文章 + 题目 + 解析。' },
    { date: '2026-03-01', tag: 'update', content: '🎧 听力、🗣️ 口语、✍️ 写作模块正在开发中，敬请期待！' },
];

export default function HomePage() {
    return (
        <div className="home-page">
            {/* Navbar */}
            <nav className="navbar">
                <Link to="/" className="navbar-logo">
                    <span>aIELTS</span>
                </Link>
                <div className="navbar-links">
                    <Link to="/" className="active">Home</Link>
                    <Link to="/practice">Practice</Link>
                </div>
            </nav>

            {/* Hero */}
            <section className="hero">
                <h1>
                    Master IELTS with <span className="gradient-text">AI</span>
                </h1>
                <p>AI 驱动的雅思练习平台，听说读写一站式智能提升</p>
            </section>

            {/* 技能卡片 */}
            <div className="skill-cards">
                <Link to="/practice" className="skill-card listening">
                    <span className="icon">🎧</span>
                    <div className="title">Listening</div>
                    <div className="desc">AI 生成听力练习</div>
                </Link>
                <Link to="/practice" className="skill-card speaking">
                    <span className="icon">🗣️</span>
                    <div className="title">Speaking</div>
                    <div className="desc">AI 口语对话练习</div>
                </Link>
                <Link to="/practice" className="skill-card reading">
                    <span className="icon">📖</span>
                    <div className="title">Reading</div>
                    <div className="desc">AI 阅读理解练习</div>
                </Link>
                <Link to="/practice" className="skill-card writing">
                    <span className="icon">✍️</span>
                    <div className="title">Writing</div>
                    <div className="desc">AI 写作批改练习</div>
                </Link>
                <Link to="/practice" className="skill-card vocab">
                    <span className="icon">🧠</span>
                    <div className="title">Vocabulary</div>
                    <div className="desc">AI 智能背单词</div>
                </Link>
            </div>

            {/* 公告 */}
            <section className="announcements">
                <h2>📢 Announcements</h2>
                <div className="announcement-list">
                    {announcements.map((item, i) => (
                        <div key={i} className="announcement-item">
                            <span className="announcement-date">{item.date}</span>
                            <div className="announcement-content">
                                <span className={`announcement-tag ${item.tag}`}>{item.tag}</span>
                                {item.content}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                © 2026 aIELTS · Powered by AI
            </footer>
        </div>
    );
}
