import Layout from '../../components/layout/Layout';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import VocabInput from '../../components/VocabInput';
import { showToast } from '../../components/common/Toast';
import '../../styles/practice_page.css';

type VocabMode = 'mcq' | 'dictation' | 'complete';

const MODE_OPTIONS: Array<{ id: VocabMode; icon: string; title: string; desc: string }> = [
    {
        id: 'mcq',
        icon: '🧩',
        title: '4选1模式',
        desc: '根据释义/读音在四个选项中选择正确单词',
    },
    {
        id: 'dictation',
        icon: '🎧',
        title: '完全听写模式',
        desc: '听到发音后完整拼写单词并实时纠错',
    },
    {
        id: 'complete',
        icon: '✏️',
        title: '补全单词模式',
        desc: '根据提示补齐缺失字母并巩固拼写',
    },
];

export default function VocabularyTrainingPage() {
    const navigate = useNavigate();
    const [vocabInput, setVocabInput] = useState('');
    const [mode, setMode] = useState<VocabMode>('mcq');
    const [shuffleWordOrder, setShuffleWordOrder] = useState(true);

    const handleVocabChange = (val: string) => {
        setVocabInput(val);
    };

    const handleStart = () => {
        if (!vocabInput.trim()) {
            showToast('请先输入词汇（英文-中文）', 'error');
            return;
        }

        sessionStorage.removeItem(`vocab_doing_session_${mode}`);
        navigate(`/vocabulary/practice/${mode}/doing`, {
            state: {
                vocabInput,
                shuffleWordOrder,
            },
        });
    };

    return (
        <Layout>
            <div className="config-page-wrap reading-config">
                <div className="practice-header">
                    <Link to="/vocabulary" className="back-link">返回词汇学习</Link>
                    <h1>词汇练习</h1>
                    <p>先输入目标词汇，再从 3 个模式中选择 1 个开始练习</p>
                </div>

                <div className="config-card">
                    <h3>目标词汇（英-中）</h3>
                    <VocabInput
                        value={vocabInput}
                        onChange={handleVocabChange}
                    />
                </div>

                <div className="config-card">
                    <h3>练习模式（3选1）</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                        {MODE_OPTIONS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setMode(m.id)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '14px 16px',
                                    borderRadius: '12px',
                                    border: mode === m.id ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
                                    background: mode === m.id ? 'rgba(13, 148, 136, 0.08)' : 'var(--color-surface)',
                                    color: 'var(--color-text)',
                                    cursor: 'pointer',
                                    boxShadow: mode === m.id ? '0 4px 16px rgba(13, 148, 136, 0.12)' : 'none',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                                    <span style={{ fontSize: '18px' }}>{m.icon}</span>
                                    <strong>{m.title}</strong>
                                </div>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{m.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="config-card">
                    <div className="toggle-row">
                        <div>
                            <div className="label-text">是否打乱单词顺序</div>
                            <div className="label-desc">开启后所有模式都会随机打乱出题顺序，关闭则按输入顺序出题</div>
                        </div>
                        <label className="toggle-switch">
                            <input
                                type="checkbox"
                                checked={shuffleWordOrder}
                                onChange={(e) => setShuffleWordOrder(e.target.checked)}
                            />
                            <span className="toggle-slider" />
                        </label>
                    </div>
                </div>

                <div className="config-card">
                    <button className="skill-btn reading" style={{ width: '100%' }} onClick={handleStart}>
                        <span className="btn-icon">🚀</span> 开始练习
                    </button>
                </div>
            </div>
        </Layout>
    );
}
