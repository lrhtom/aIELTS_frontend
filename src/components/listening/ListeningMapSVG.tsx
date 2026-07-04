/**
 * ListeningMapSVG — renders an IELTS-style listening map.
 *
 * Used in two places:
 *   1. Standalone map question type (renderMapMode inline in listening_page.tsx)
 *   2. Section 2 mixed subsection (was dropdown-only, now shows the actual map)
 *
 * `questionIdOffset` shifts the number displayed on question-landmarks so
 * global IDs match what the dropdown shows.
 * e.g. Section 2 map subsection has landmark.questionId ∈ [1..5] but the
 * global qid range is [16..20] — pass `startId - 1 = 15` as the offset.
 */
import type { MapData, MapDecoration, MapLandmark } from '../../store/listen_page_store';

interface Props {
    map: MapData;
    questionIdOffset?: number;
    maxWidth?: number;
}

function renderDecoration(d: MapDecoration, i: number) {
    const dw = d.w || 40;
    const dh = d.h || 40;
    switch (d.type) {
        case 'tree':
            return (
                <g key={`dec-${i}`}>
                    <circle cx={d.x} cy={d.y - 8} r={12} fill="#22c55e" opacity={0.6} />
                    <rect x={d.x - 2} y={d.y} width={4} height={10} fill="#a16207" />
                </g>
            );
        case 'lake':
            return (
                <ellipse
                    key={`dec-${i}`}
                    cx={d.x + dw / 2} cy={d.y + dh / 2}
                    rx={dw / 2} ry={dh / 2}
                    fill="#93c5fd" opacity={0.5}
                    stroke="#60a5fa" strokeWidth={1}
                />
            );
        case 'garden':
            return (
                <rect
                    key={`dec-${i}`}
                    x={d.x} y={d.y} width={dw} height={dh}
                    fill="#86efac" opacity={0.4} rx={6}
                    stroke="#4ade80" strokeWidth={1}
                />
            );
        case 'parking':
            return (
                <g key={`dec-${i}`}>
                    <rect x={d.x} y={d.y} width={dw} height={dh} fill="#e5e7eb" rx={4} stroke="#9ca3af" strokeWidth={1} />
                    <text x={d.x + dw / 2} y={d.y + dh / 2 + 4} textAnchor="middle" fontSize={10} fill="#6b7280">P</text>
                </g>
            );
        case 'fountain':
            return (
                <g key={`dec-${i}`}>
                    <circle cx={d.x} cy={d.y} r={15} fill="#bfdbfe" stroke="#60a5fa" strokeWidth={1} />
                    <circle cx={d.x} cy={d.y} r={6} fill="#93c5fd" />
                </g>
            );
        default:
            return null;
    }
}

function renderLandmark(lm: MapLandmark, questionIdOffset: number) {
    if (lm.questionId != null) {
        const displayId = lm.questionId + questionIdOffset;
        return (
            <g key={lm.id}>
                <circle cx={lm.x} cy={lm.y} r={16} fill="#ef4444" opacity={0.9} />
                <text x={lm.x} y={lm.y + 5} textAnchor="middle" fontSize={13} fontWeight="bold" fill="white">
                    {displayId}
                </text>
            </g>
        );
    }
    if (lm.shape === 'circle') {
        const r = lm.r || 25;
        return (
            <g key={lm.id}>
                <circle cx={lm.x} cy={lm.y} r={r} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} />
                <text x={lm.x} y={lm.y + 4} textAnchor="middle" fontSize={10} fontWeight="600" fill="#334155">{lm.label}</text>
            </g>
        );
    }
    const w = lm.w || 70;
    const h = lm.h || 45;
    return (
        <g key={lm.id}>
            <rect x={lm.x - w / 2} y={lm.y - h / 2} width={w} height={h} fill="#f1f5f9" stroke="#94a3b8" strokeWidth={1.5} rx={4} />
            <text x={lm.x} y={lm.y + 4} textAnchor="middle" fontSize={10} fontWeight="600" fill="#334155">{lm.label}</text>
        </g>
    );
}

export default function ListeningMapSVG({ map, questionIdOffset = 0, maxWidth = 640 }: Props) {
    const vw = map.width || 600;
    const vh = map.height || 400;
    return (
        <div className="listening-map-svg-wrap" style={{ maxWidth, margin: '0 0 16px 0' }}>
            {map.name && (
                <h5 style={{ margin: '0 0 8px 0', color: 'var(--color-text)', fontSize: 14, fontWeight: 600 }}>
                    🗺️ {map.name}
                </h5>
            )}
            <svg
                viewBox={`0 0 ${vw} ${vh}`}
                style={{ width: '100%', height: 'auto', background: '#fefce8', borderRadius: 8, border: '1px solid var(--color-border)' }}
            >
                {Array.from({ length: Math.floor(vw / 50) }, (_, i) => (
                    <line key={`gv-${i}`} x1={(i + 1) * 50} y1={0} x2={(i + 1) * 50} y2={vh} stroke="#e5e7eb" strokeWidth={0.5} />
                ))}
                {Array.from({ length: Math.floor(vh / 50) }, (_, i) => (
                    <line key={`gh-${i}`} x1={0} y1={(i + 1) * 50} x2={vw} y2={(i + 1) * 50} stroke="#e5e7eb" strokeWidth={0.5} />
                ))}
                {(map.decorations || []).map((d, i) => renderDecoration(d, i))}
                {(map.paths || []).map((p, i) => (
                    <polyline
                        key={`path-${i}`}
                        points={p.points.map(pt => pt.join(',')).join(' ')}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
                {(map.landmarks || []).map(lm => renderLandmark(lm, questionIdOffset))}
            </svg>
        </div>
    );
}
