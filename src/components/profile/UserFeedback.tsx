import { useState } from 'react';
import { useLang } from '../../i18n/LanguageContext';
import { apiClient } from '../../api/client';
import { toast } from 'react-hot-toast';

export default function UserFeedback() {
    const { translations: t } = useLang();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error(t.profile.feedback.placeholderTitle);
            return;
        }

        setIsSubmitting(true);
        try {
            await apiClient.post('/feedback/submit', {
                title: title.trim(),
                content: description.trim(),
            });
            setSubmitted(true);
            setTitle('');
            setDescription('');
        } catch (error) {
            console.error('Feedback submission failed:', error);
            const errMsg = t.common.error;
            toast.error(errMsg);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="user-feedback">
                <div className="success-card">
                    <div className="success-icon">🎉</div>
                    <h3>{t.profile.feedback.success}</h3>
                    <p>{t.profile.welcomeDesc}</p>
                    <button
                        className="secondary-button"
                        onClick={() => setSubmitted(false)}
                        style={{ marginTop: '20px' }}
                    >
                        {t.profile.feedback.backToSubmit}
                    </button>
                </div>
                <style>{`
                    .success-card {
                        background: var(--color-surface);
                        padding: 60px 40px;
                        border-radius: 20px;
                        text-align: center;
                        border: 1px solid var(--color-border);
                        animation: slideUp 0.5s ease-out;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                    }
                    .success-icon {
                        font-size: 5rem;
                        margin-bottom: 20px;
                    }
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateY(20px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="user-feedback">
            <div className="feedback-header">
                <h2>🐛 {t.profile.feedback.title}</h2>
                <p className="feedback-subtitle">{t.profile.feedback.desc}</p>
            </div>

            <form className="feedback-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="title">{t.profile.feedback.message} <span className="required">*</span></label>
                    <input
                        type="text"
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder={t.profile.feedback.placeholderTitle}
                        maxLength={255}
                        disabled={isSubmitting}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="description">{t.profile.feedback.desc}</label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t.profile.feedback.placeholderDesc}
                        rows={6}
                        disabled={isSubmitting}
                    />
                </div>

                <button
                    type="submit"
                    className="submit-button"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? '...' : t.profile.feedback.submit}
                </button>
            </form>

            <style>{`
                .user-feedback {
                    padding: 20px;
                    max-width: 800px;
                }
                .feedback-header {
                    margin-bottom: 30px;
                }
                .feedback-subtitle {
                    color: var(--color-text-secondary);
                    font-size: 0.9rem;
                    margin-top: 5px;
                }
                .feedback-form {
                    background: var(--color-surface);
                    padding: 30px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                }
                .form-group {
                    margin-bottom: 20px;
                }
                .form-group label {
                    display: block;
                    margin-bottom: 8px;
                    font-weight: 600;
                    color: var(--color-text);
                    font-size: 0.9rem;
                }
                .required {
                    color: #ff4d4f;
                }
                .form-group input,
                .form-group textarea {
                    width: 100%;
                    padding: 14px 16px;
                    border-radius: 10px;
                    border: 2px solid var(--color-border);
                    background: var(--color-bg);
                    color: var(--color-text);
                    font-size: 0.95rem;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
                    font-family: inherit;
                }
                .form-group input::placeholder,
                .form-group textarea::placeholder {
                    color: #94a3b8;
                }
                .form-group input:focus,
                .form-group textarea:focus {
                    outline: none;
                    border-color: var(--color-primary);
                    box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.12), inset 0 1px 3px rgba(0,0,0,0.06);
                }
                .submit-button {
                    background: var(--color-primary);
                    color: white;
                    border: none;
                    padding: 14px 24px;
                    border-radius: 10px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: background 0.2s;
                    width: 100%;
                    margin-top: 10px;
                }
                .submit-button:hover {
                    background: var(--color-primary-hover);
                }
                .submit-button:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                .secondary-button {
                    background: transparent;
                    color: var(--color-primary);
                    border: 1px solid var(--color-primary);
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .secondary-button:hover {
                    background: rgba(13, 148, 136, 0.08);
                }
            `}</style>
        </div>
    );
}
