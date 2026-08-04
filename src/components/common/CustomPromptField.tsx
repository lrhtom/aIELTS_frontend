import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/custom_prompt_field.css';

/**
 * User custom prompt instructions (shared by the listening/speaking/reading/writing generation configs).
 *
 * A red warning plus a mandatory 'I understand the risk' checkbox before the input can be edited; unchecking clears
 * the content, so it cannot 'still apply after being turned off'. The parent only holds value/onChange, and value is always empty while unchecked.
 */
export default function CustomPromptField({
    value,
    onChange,
    maxLength = 800,
}: {
    value: string;
    onChange: (v: string) => void;
    maxLength?: number;
}) {
    const { t } = useLang();
    const [ack, setAck] = useState(false);

    const toggleAck = (checked: boolean) => {
        setAck(checked);
        if (!checked) onChange(''); // cancelling the confirmation clears it
    };

    return (
        <div className="cpf-root">
            <div className="cpf-header">
                <AlertTriangle size={16} className="cpf-warn-icon" />
                <span className="cpf-title">{t('common.customPrompt.title')}</span>
            </div>
            <p className="cpf-warning">{t('common.customPrompt.warning')}</p>
            <label className="cpf-ack">
                <input type="checkbox" checked={ack} onChange={e => toggleAck(e.target.checked)} />
                <span>{t('common.customPrompt.ack')}</span>
            </label>
            <textarea
                className="cpf-textarea"
                value={value}
                onChange={e => onChange(e.target.value.slice(0, maxLength))}
                placeholder={t('common.customPrompt.placeholder')}
                disabled={!ack}
                rows={3}
                maxLength={maxLength}
            />
            {ack && <div className="cpf-count">{value.length}/{maxLength}</div>}
        </div>
    );
}
