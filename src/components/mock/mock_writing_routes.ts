// spotlight: a transparent hole plus a huge box-shadow dimming the surroundings; with no target, the whole screen dims
// Shared by MockWritingTaskBar and the 'go straight to the other essay after submitting' path in both writing pages.
import type { MockChildView } from '../../api/mock';

export function mockWritingTaskRoute(
    mockId: number,
    sub: 'task1' | 'task2',
    child: MockChildView | null | undefined,
): string | null {
    if (!child) return null;
    if (sub === 'task1') {
        const chartSubtype = child.subtype.startsWith('chart:') ? child.subtype.slice('chart:'.length) : 'line';
        return `/writing/chart/doing?bankId=${child.id}&type=${encodeURIComponent(chartSubtype)}&mockId=${mockId}`;
    }
    const t2Type = child.subtype.startsWith('task2:') ? child.subtype.slice('task2:'.length) : 'opinion';
    return `/writing/task2/doing?bankId=${child.id}&type=${encodeURIComponent(t2Type)}&mockId=${mockId}`;
}
