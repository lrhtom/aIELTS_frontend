/**
 * Renders an IELTS reading passage.
 * If the passage begins with paragraph labels like "[A]\n...\n\n[B]\n...", each
 * label is rendered as a bold marker beside its paragraph. Otherwise plain paragraphs.
 */
import { sanitize } from '../../utils/safe_html';

function formatHighlight(text: string): string {
    return (text || '').replace(/\*\*(.*?)\*\*/g, '<span class="highlight">$1</span>');
}

interface Props {
    title: string;
    passage: string;
    idPrefix?: string;
}

const LABEL_RE = /^\[([A-Z])\]\s*$/;

export default function ReadingPassageBlock({ title, passage, idPrefix = 'articleContent' }: Props) {
    // Try to split by labelled paragraphs first
    const rawParas = (passage || '').split(/\n\n+/);
    const hasLabels = rawParas.some(p => {
        const firstLine = p.split('\n')[0]?.trim() || '';
        return LABEL_RE.test(firstLine);
    });

    return (
        <div className="main-content">
            <h2 style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(title)) }} />
            <div
                id={idPrefix}
                style={{ outline: 'none', WebkitTouchCallout: 'none' }}
                onContextMenu={e => e.preventDefault()}
            >
                {rawParas.map((para, idx) => {
                    if (!para.trim()) return null;
                    if (hasLabels) {
                        const lines = para.split('\n');
                        const firstLine = lines[0]?.trim() || '';
                        const match = LABEL_RE.exec(firstLine);
                        if (match) {
                            const label = match[1];
                            const body = lines.slice(1).join('\n').trim();
                            return (
                                <p key={idx} className="labelled-paragraph">
                                    <strong className="para-label">[{label}]</strong>{' '}
                                    <span dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(body)) }} />
                                </p>
                            );
                        }
                    }
                    return <p key={idx} dangerouslySetInnerHTML={{ __html: sanitize(formatHighlight(para)) }} />;
                })}
            </div>
        </div>
    );
}
