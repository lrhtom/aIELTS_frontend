import { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { v4 as uuidv4 } from 'uuid';

interface MermaidChartProps {
    chart: string;
}

function normalizeMermaidInput(raw: string): string {
    const input = (raw || '').trim();
    if (!input) return '';

    const lower = input.toLowerCase();
    const looksLikePython =
        lower.includes('import matplotlib') ||
        lower.includes('def draw_') ||
        lower.includes('plt.') ||
        lower.includes('ax.') ||
        lower.includes('sys.argv');

    if (looksLikePython) {
        return [
            'flowchart TD',
            '  A["Input Received"] --> B["Parse/Sort Data"]',
            '  B --> C["Process Transformation"]',
            '  C --> D["Generate Output"]',
            '  D --> E["Distribution"]',
        ].join('\n');
    }

    if (lower.startsWith('flowchart ') || lower.startsWith('graph ')) {
        return input;
    }

    return [
        'flowchart TD',
        '  A["Step 1"] --> B["Step 2"]',
        '  B --> C["Step 3"]',
    ].join('\n');
}

export default function MermaidChart({ chart }: MermaidChartProps) {
    const [svgContent, setSvgContent] = useState<string>('');
    const [error, setError] = useState<string>('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let isMounted = true;

        const renderChart = async () => {
            if (!chart) return;
            try {
                const safeChart = normalizeMermaidInput(chart);
                // dynamically import via CDN to prevent Vite bundler from crashing and OOM
                // @ts-ignore
                if (!window._mermaidInited) {
                    // @ts-ignore
                    const mermaidModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs');
                    const mermaidObj = mermaidModule.default;
                    mermaidObj.initialize({
                        startOnLoad: false,
                        theme: 'default',
                        securityLevel: 'loose',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                    });
                    // @ts-ignore
                    window.mermaid = mermaidObj;
                    // @ts-ignore
                    window._mermaidInited = true;
                }
                
                // @ts-ignore
                const mermaid = window.mermaid;
                const id = `mermaid-${uuidv4()}`;
                const { svg } = await mermaid.render(id, safeChart);
                
                if (isMounted) {
                    setSvgContent(svg);
                    setError('');
                }
            } catch (err: any) {
                console.error("Mermaid Render Error", err);
                if (isMounted) {
                    setError(err.message || 'Failed to render Flowchart SVG representation.');
                }
            }
        };

        renderChart();

        return () => {
            isMounted = false;
        };
    }, [chart]);

    if (error) {
        return (
            <div style={{ padding: '20px', border: '1px solid #ff4d4f', color: '#cf1322', background: '#fff1f0', borderRadius: '8px' }}>
                <p><strong>🚨 Warning:</strong> {error}</p>
                <p>The AI might have generated malformed Mermaid syntax.</p>
                <details style={{ marginTop: '10px' }}>
                    <summary>View raw output</summary>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', overflowX: 'auto' }}>{chart}</pre>
                </details>
            </div>
        );
    }

    return (
        <div 
            ref={containerRef}
            className="mermaid-container"
            style={{ 
                width: '100%', 
                display: 'flex', 
                justifyContent: 'center', 
                background: 'white', 
                padding: '24px', 
                borderRadius: '8px', 
                border: '1px solid var(--color-border)',
                minHeight: '200px',
                overflowX: 'auto'
            }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
        />
    );
}
