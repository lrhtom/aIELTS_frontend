import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLang } from '../../i18n/LanguageContext';
import { authApi } from '../../api/auth';
import '../../styles/profile_page.css';

export default function UserGoals() {
    const { user, updateUser } = useAuth();
    const { translations: t } = useLang();

    // 个人目标设置状态
    const [targetListening, setTargetListening] = useState(user?.target_listening ?? '');
    const [targetReading, setTargetReading] = useState(user?.target_reading ?? '');
    const [targetWriting, setTargetWriting] = useState(user?.target_writing ?? '');
    const [targetSpeaking, setTargetSpeaking] = useState(user?.target_speaking ?? '');
    const [examDate, setExamDate] = useState(user?.exam_date ?? '');
    
    const [isUpdatingGoals, setIsUpdatingGoals] = useState(false);
    const [updateGoalsMessage, setUpdateGoalsMessage] = useState('');
    const [updateGoalsError, setUpdateGoalsError] = useState('');

    const calculateOverall = () => {
        const scores = [targetListening, targetReading, targetWriting, targetSpeaking]
            .map(s => parseFloat(s as string))
            .filter(n => !isNaN(n));
            
        if (scores.length === 4) {
            const sum = scores.reduce((a, b) => a + b, 0);
            const avg = sum / 4;
            const frac = avg - Math.floor(avg);
            if (frac < 0.25) return Math.floor(avg).toFixed(1);
            if (frac < 0.75) return (Math.floor(avg) + 0.5).toFixed(1);
            return Math.ceil(avg).toFixed(1);
        }
        return '--';
    };
    
    const getDaysLeft = () => {
        if (!examDate) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(examDate);
        target.setHours(0, 0, 0, 0);
        const diffTime = target.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const handleUpdateGoals = async () => {
        setIsUpdatingGoals(true);
        setUpdateGoalsMessage('');
        setUpdateGoalsError('');
        
        try {
            const updatedUser = await authApi.updateSettings({
                target_listening: targetListening !== '' ? parseFloat(targetListening as string) : null,
                target_reading: targetReading !== '' ? parseFloat(targetReading as string) : null,
                target_writing: targetWriting !== '' ? parseFloat(targetWriting as string) : null,
                target_speaking: targetSpeaking !== '' ? parseFloat(targetSpeaking as string) : null,
                exam_date: examDate || null
            });
            updateUser(updatedUser);
            setUpdateGoalsMessage(t.profile.goals.saveSuccess);
            setTimeout(() => setUpdateGoalsMessage(''), 3000);
        } catch (error) {
            console.error('Failed to update goals:', error);
            setUpdateGoalsError(t.profile.goals.saveFail);
        } finally {
            setIsUpdatingGoals(false);
        }
    };

    return (
        <div className="user-settings">
            <div className="user-settings-header">
                <h2>{t.profile.goals.management}</h2>
                <p>{t.profile.goals.desc}</p>
            </div>

            {/* 个人目标设置 */}
            <div className="user-settings-section">
                <div className="user-settings-section-header">
                    <div className="user-settings-section-icon">🎯</div>
                    <div className="user-settings-section-title">{t.profile.goals.sectionTitle}</div>
                </div>
                <div className="user-settings-section-description">
                    {t.profile.goals.sectionDesc}
                </div>
                
                <div className="goals-settings" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
                    <div className="scores-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t.profile.goals.listening}</label>
                            <input 
                                type="number" 
                                min="0" max="9" step="0.5" 
                                value={targetListening} 
                                onChange={(e) => setTargetListening(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t.profile.goals.reading}</label>
                            <input 
                                type="number" 
                                min="0" max="9" step="0.5" 
                                value={targetReading} 
                                onChange={(e) => setTargetReading(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t.profile.goals.writing}</label>
                            <input 
                                type="number" 
                                min="0" max="9" step="0.5" 
                                value={targetWriting} 
                                onChange={(e) => setTargetWriting(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t.profile.goals.speaking}</label>
                            <input 
                                type="number" 
                                min="0" max="9" step="0.5" 
                                value={targetSpeaking} 
                                onChange={(e) => setTargetSpeaking(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                            />
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-bg-alt)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                        <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{t.profile.goals.calculatedOverall} <span style={{ color: 'var(--color-primary)' }}>{calculateOverall()}</span></div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{t.profile.goals.examDate}</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <input 
                                type="date" 
                                value={examDate} 
                                onChange={(e) => setExamDate(e.target.value)}
                                style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-alt)', color: 'var(--color-text)' }}
                            />
                            {examDate && getDaysLeft() !== null && (
                                <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                                    {getDaysLeft() === 0
                                        ? t.profile.goals.examToday
                                        : getDaysLeft()! < 0
                                        ? t.profile.goals.examPassed
                                        : t.profile.goals.daysLeft.replace('{days}', getDaysLeft()!.toString())}
                                </span>
                            )}
                        </div>
                    </div>

                    <div>
                        <button
                            style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.2s', opacity: isUpdatingGoals ? 0.7 : 1 }}
                            onClick={handleUpdateGoals}
                            disabled={isUpdatingGoals}
                        >
                            {isUpdatingGoals ? t.profile.goals.saving : t.profile.goals.saveBtn}
                        </button>
                        {updateGoalsMessage && (
                            <span style={{ color: 'var(--color-success)', marginLeft: '1rem', fontSize: '0.9rem' }}>{updateGoalsMessage}</span>
                        )}
                        {updateGoalsError && (
                            <span style={{ color: 'var(--color-danger)', marginLeft: '1rem', fontSize: '0.9rem' }}>{updateGoalsError}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
