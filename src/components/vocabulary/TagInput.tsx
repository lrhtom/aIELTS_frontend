import { useLang } from '../../i18n/LanguageContext';

interface Props {
    tags: string[];
    tagInput: string;
    onChange: (v: string) => void;
    onTagsChange: (tags: string[]) => void;
}

export default function TagInput({ tags, tagInput, onChange, onTagsChange }: Props) {
    const { t } = useLang();
    const commitTag = (val: string) => {
        const trimmed = val.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed)) {
            onTagsChange([...tags, trimmed]);
        }
        onChange('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitTag(tagInput);
        } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
            onTagsChange(tags.slice(0, -1));
        }
    };

    const removeTag = (t: string) => onTagsChange(tags.filter(x => x !== t));

    return (
        <div className="wf-tag-input-wrap" onClick={() => (document.querySelector('.wf-tag-raw-input') as HTMLElement)?.focus()}>
            {tags.map(t => (
                <span key={t} className="tag-chip active">
                    #{t}
                    <span className="tag-chip-remove" onClick={() => removeTag(t)}>×</span>
                </span>
            ))}
            <input
                className="wf-tag-raw-input"
                value={tagInput}
                placeholder={tags.length === 0 ? t('vocab.common.tagPlaceholder') : ''}
                onChange={e => onChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => { if (tagInput.trim()) commitTag(tagInput); }}
            />
        </div>
    );
}
