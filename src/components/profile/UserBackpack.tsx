import { useLang } from '../../i18n/LanguageContext';

interface UserBackpackProps {
    onBack: () => void;
}

export default function UserBackpack({ onBack }: UserBackpackProps) {
    const { translations: t } = useLang();

    return (
        <div className="user-backpack">
            <div className="backpack-header">
                <button className="back-button" onClick={onBack}>
                    ← {t.profile.menu.home}
                </button>
                <h2>🎒 {t.profile.menu.backpack}</h2>
            </div>

            <div className="backpack-content">
                <div className="empty-backpack">
                    <div className="empty-icon">📂</div>
                    <p>{t.profile.backpack.empty}</p>
                    <p className="empty-hint">{t.profile.backpack.emptyHint}</p>
                </div>
            </div>

            <style>{`
                .user-backpack {
                    padding: 20px;
                }
                .backpack-header {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    margin-bottom: 25px;
                }
                .back-button {
                    background: none;
                    border: 1px solid var(--border-color);
                    padding: 5px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-size: 0.9rem;
                    transition: all 0.2s;
                }
                .back-button:hover {
                    background: var(--bg-secondary);
                    color: var(--text-primary);
                }
                .backpack-content {
                    background: var(--bg-secondary);
                    border-radius: 12px;
                    min-height: 400px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px dashed var(--border-color);
                }
                .empty-backpack {
                    text-align: center;
                    color: var(--text-secondary);
                }
                .empty-icon {
                    font-size: 3rem;
                    margin-bottom: 15px;
                    opacity: 0.5;
                }
                .empty-hint {
                    font-size: 0.85rem;
                    margin-top: 5px;
                }
            `}</style>
        </div>
    );
}
