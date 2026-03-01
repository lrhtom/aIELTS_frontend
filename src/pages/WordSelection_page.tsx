import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReactive } from '../utils/reactive';
import { wordSelectionStore } from '../store/word_selection_store';
import '../styles/reading_page.css';

type Skill = 'listening' | 'speaking' | 'reading' | 'writing';

export default function WordSelection_page() {
    const navigate = useNavigate();
    const store = useReactive(wordSelectionStore);

    // 挂载时同步 localStorage → store（多 Tab 情况下确保最新值）
    useEffect(() => {
        const saved = localStorage.getItem('ielts_target_vocab');
        if (saved) store.vocabInput = saved;
    }, []);

    const handleVocabChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        store.vocabInput = e.target.value;
        localStorage.setItem('ielts_target_vocab', e.target.value);
    };

    const handleSkillSelect = (skill: Skill) => {
        if (!store.vocabInput.trim()) {
            alert('Please enter some vocabulary.');
            return;
        }
        navigate(`/${skill}`, { state: { vocabInput: store.vocabInput } });
    };

    return (
        <div className="container">
            <div className="page">
                <h1>IELTS Practice Generator</h1>
                <p>Enter your target English words and Chinese meanings (e.g., "ubiquitous - 普遍存在的"). Format: One word per line.</p>
                <div className="input-group">
                    <textarea
                        value={store.vocabInput}
                        onChange={handleVocabChange}
                        placeholder={"ubiquitous - 普遍存在的\nmitigate - 减轻\nephemeral - 短暂的"}
                    />

                    <div className="skill-options" style={{ display: 'flex', gap: '15px', marginTop: '20px' }}>
                        <button className="skill-btn" style={{ flex: 1, backgroundColor: '#8b5cf6' }} onClick={() => handleSkillSelect('listening')}>
                            🎧 听 (Listening)
                        </button>
                        <button className="skill-btn" style={{ flex: 1, backgroundColor: '#10b981' }} onClick={() => handleSkillSelect('speaking')}>
                            🗣️ 说 (Speaking)
                        </button>
                        <button className="skill-btn" style={{ flex: 1, backgroundColor: '#3b82f6' }} onClick={() => handleSkillSelect('reading')}>
                            📖 读 (Reading)
                        </button>
                        <button className="skill-btn" style={{ flex: 1, backgroundColor: '#f59e0b' }} onClick={() => handleSkillSelect('writing')}>
                            ✍️ 写 (Writing)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}