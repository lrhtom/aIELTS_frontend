import Layout from '../../components/layout/Layout';
import { Link } from 'react-router-dom';
import '../../styles/practice_hub.css';

export default function VocabularyPracticePage() {
    return (
        <Layout>
            <div className="practice-hub-container">
                <div className="practice-hub-header">
                    <Link to="/" className="back-link">返回首页</Link>
                    <h1>词汇学习</h1>
                    <p>从这里进入词汇专项训练模块</p>
                </div>

                <div className="skill-grid">
                    <Link to="/vocabulary/practice" className="skill-entry reading" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">📝</span>
                        <div className="skill-name">词汇练习</div>
                        <div className="skill-sub">听写、拼写纠错与词汇巩固训练</div>
                    </Link>

                    <Link to="/vocabulary/plans" className="skill-entry listening" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">🃏</span>
                        <div className="skill-name">背单词</div>
                        <div className="skill-sub">制定学习计划，FSRS 智能间隔重复</div>
                    </Link>

                    <Link to="/vocabulary/notebook" className="skill-entry writing" style={{ textAlign: 'left' }}>
                        <span className="skill-icon">📓</span>
                        <div className="skill-name">我的笔记本</div>
                        <div className="skill-sub">自建单词本，自定义标签与中文释义</div>
                    </Link>
                </div>
            </div>
        </Layout>
    );
}
