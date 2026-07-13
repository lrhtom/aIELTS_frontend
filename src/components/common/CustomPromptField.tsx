import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';
import '../../styles/custom_prompt_field.css';

/**
 * 用户自定义提示词指令（听/说/读/写 主生成配置通用）。
 *
 * 红色警告 + 强制勾选「我已了解风险」后才能编辑输入框；取消勾选会清空内容，
 * 避免「关了还生效」。父组件只需持有 value/onChange，未勾选时 value 恒为空。
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
    const { translations } = useLang();
    const t = translations.common.customPrompt;
    const [ack, setAck] = useState(false);

    const toggleAck = (checked: boolean) => {
        setAck(checked);
        if (!checked) onChange(''); // 取消确认即清空
    };

    return (
        <div className="cpf-root">
            <div className="cpf-header">
                <AlertTriangle size={16} className="cpf-warn-icon" />
                <span className="cpf-title">{t.title}</span>
            </div>
            <p className="cpf-warning">{t.warning}</p>
            <label className="cpf-ack">
                <input type="checkbox" checked={ack} onChange={e => toggleAck(e.target.checked)} />
                <span>{t.ack}</span>
            </label>
            <textarea
                className="cpf-textarea"
                value={value}
                onChange={e => onChange(e.target.value.slice(0, maxLength))}
                placeholder={t.placeholder}
                disabled={!ack}
                rows={3}
                maxLength={maxLength}
            />
            {ack && <div className="cpf-count">{value.length}/{maxLength}</div>}
        </div>
    );
}
