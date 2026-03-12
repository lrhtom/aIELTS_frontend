import Layout from '../../components/layout/Layout';
import { Link } from 'react-router-dom';
import { showToast } from '../../components/common/Toast';
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

                    <button
                        type="button"
                        className="skill-entry listening"
                        style={{ textAlign: 'left' }}
                        onClick={() => showToast('背单词模块即将上线', 'success')}
                    >
                        <span className="skill-icon">📚</span>
                        <div className="skill-name">背单词</div>
                        <div className="skill-sub">记忆模式与复习节奏训练</div>
                    </button>
                </div>
            </div>
        </Layout>
    );
}
