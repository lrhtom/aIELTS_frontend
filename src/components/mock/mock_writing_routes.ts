// mock 写作子题 → 答题页路由（subtype 前缀约定与 mock_hub_page.answerRoute 一致）。
// 被 MockWritingTaskBar 和两个写作页的「提交后直通另一篇」共用。
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
