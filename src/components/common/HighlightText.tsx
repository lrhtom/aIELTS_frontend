import { Fragment } from 'react';

interface HighlightTextProps {
    text: string;
    [key: string]: string | number;
}

export default function HighlightText({ text, ...values }: HighlightTextProps) {
    const parts = text.split(/(<strong>.*?<\/strong>)/g);

    return (
        <>
            {parts.map((part, i) => {
                const strongMatch = part.match(/^<strong>(.*?)<\/strong>$/);
                if (strongMatch) {
                    let content = strongMatch[1];
                    for (const [key, val] of Object.entries(values)) {
                        content = content.replace(`{${key}}`, String(val));
                    }
                    return <strong key={i}>{content}</strong>;
                }

                let content = part;
                for (const [key, val] of Object.entries(values)) {
                    content = content.replace(`{${key}}`, String(val));
                }
                return <Fragment key={i}>{content}</Fragment>;
            })}
        </>
    );
}
