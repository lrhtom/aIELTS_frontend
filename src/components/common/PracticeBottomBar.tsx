/**
 * PracticeBottomBar — 阅读/听力练习页共享的底部考试导航条。
 *
 * 结构（纵向两层，参考考试系统底部条）:
 *   1. 上层·题号导航区: 每个 Part 一列（细"一题一格"进度条在上、标签/胶囊在下），
 *      占满全宽; 当前 Part 展开胶囊，其余收起为 "Part N  x/y"，整列可点击切换。
 *   2. 下层·操作行: 独立一行横贯全宽，右对齐 [实时时钟 | 提交 | 退出]。
 *      只有一个 Part 时上层只渲染当前列。
 *
 * 题号胶囊三态:
 *   - 默认: 描边
 *   - 已答: teal 填充
 *   - 当前可见: 高亮描边环（IntersectionObserver 实时跟踪, 可与已答叠加）
 *
 * 跳转/高亮都锚定题目节点上的 data-question-id 属性（各题型渲染器逐处补齐），
 * 点击胶囊 scrollIntoView 平滑滚动; observer root 用视口 + 居中检测带，
 * 不依赖具体哪个祖先在滚动。
 */
import { useEffect, useRef, useState } from 'react';

export interface PracticeOverviewPart {
    label: string;
    /** 该 Part 全部题目的真实 id（进度条一题一格 + 收起标签的 x/y 都由此派生） */
    questionIds: number[];
    active: boolean;
}

export interface PracticeNavLabels {
    jumpTo: string;    // '跳转到第 {n} 题'
    progress: string;  // '{answered} / {total}'
    barLabel: string;
}

interface Props {
    /** 当前 Part 显示名（"Passage 2" / "Section 3"）；单题型模式可省略 */
    partLabel?: string | null;
    /** 当前可见 Part 的真实题目 id 列表（full-test 下如 [14..26]，与题面印的编号一致） */
    questionIds: number[];
    /** 已作答的题目 id 集合（全局，跨 Part） */
    answeredIds: Set<number>;
    /** 题目容器的 DOM id（'questionsForm' | 'listeningContent'） */
    scrollContainerId: string;
    onSubmit: () => void;
    onExit: () => void;
    submitLabel: string;
    exitLabel: string;
    navLabels: PracticeNavLabels;
    /** full-test 模式传入全部 Part（含当前）；单题型不传 */
    overviewParts?: PracticeOverviewPart[];
    /** 点击收起的 Part 标签切换过去（index 对应 overviewParts 下标） */
    onPartSelect?: (index: number) => void;
}

function fmt(tpl: string, vars: Record<string, string | number>): string {
    return Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), tpl);
}

/** 系统实时时钟（wall clock, HH:MM）——参考考试系统底部显示的真实时间。 */
function WallClock() {
    const [now, setNow] = useState<{ h: string; m: string }>(() => {
        const d = new Date();
        return { h: String(d.getHours()).padStart(2, '0'), m: String(d.getMinutes()).padStart(2, '0') };
    });
    useEffect(() => {
        const id = setInterval(() => {
            const d = new Date();
            setNow({ h: String(d.getHours()).padStart(2, '0'), m: String(d.getMinutes()).padStart(2, '0') });
        }, 1000);
        return () => clearInterval(id);
    }, []);
    return <span className="pbb-clock">{now.h}:{now.m}</span>;
}

export default function PracticeBottomBar({
    partLabel,
    questionIds,
    answeredIds,
    scrollContainerId,
    onSubmit,
    onExit,
    submitLabel,
    exitLabel,
    navLabels,
    overviewParts,
    onPartSelect,
}: Props) {
    const [currentId, setCurrentId] = useState<number | null>(null);
    // 点击跳转后的平滑滚动期间，IO 会连续触发一串中间题的高亮闪烁——
    // 用一个短暂的时间窗抑制。不能用"等目标进入视口中带再解锁"：列表两端的
    // 题目可能永远到不了中带，锁死后 scrollspy 就再也不动了。
    const suppressUntilRef = useRef(0);

    const idsKey = questionIds.join(',');

    useEffect(() => {
        const container = document.getElementById(scrollContainerId);
        if (!container) return;
        const anchors = container.querySelectorAll<HTMLElement>('[data-question-id]');
        if (anchors.length === 0) return;

        const visible = new Set<number>();
        const io = new IntersectionObserver(entries => {
            for (const e of entries) {
                const qid = Number((e.target as HTMLElement).dataset.questionId);
                if (Number.isNaN(qid)) continue;
                if (e.isIntersecting) visible.add(qid);
                else visible.delete(qid);
            }
            // 抑制窗内仍更新 visible 集合，只是不改高亮；窗口过后
            // 静止时无新事件（高亮停在点击题），一滚动立刻恢复跟踪。
            if (Date.now() < suppressUntilRef.current) return;
            if (visible.size > 0) setCurrentId(Math.min(...visible));
        }, { root: null, rootMargin: '-40% 0px -40% 0px', threshold: 0 });

        anchors.forEach(a => io.observe(a));
        return () => io.disconnect();
        // idsKey 变化 = Part 切换后题目 DOM 已重建，必须重挂载 observer
    }, [idsKey, scrollContainerId]);

    // Part 切换后旧的 currentId 已不在新 id 集里，清掉避免残留高亮
    useEffect(() => {
        setCurrentId(prev => (prev !== null && questionIds.includes(prev) ? prev : null));
        suppressUntilRef.current = 0;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idsKey]);

    const jumpTo = (qid: number) => {
        const el = document.querySelector<HTMLElement>(
            `#${scrollContainerId} [data-question-id="${qid}"]`
        );
        if (!el) return;
        suppressUntilRef.current = Date.now() + 800;
        setCurrentId(qid);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const pills = (
        <div className="pbb-pills" role="group" aria-label={navLabels.barLabel}>
            {questionIds.map(qid => {
                const answered = answeredIds.has(qid);
                const current = currentId === qid;
                return (
                    <button
                        key={qid}
                        type="button"
                        className={`pbb-pill${answered ? ' answered' : ''}${current ? ' current' : ''}`}
                        onClick={() => jumpTo(qid)}
                        title={fmt(navLabels.jumpTo, { n: qid })}
                        aria-label={fmt(navLabels.jumpTo, { n: qid })}
                        aria-current={current ? 'true' : undefined}
                    >
                        {qid}
                    </button>
                );
            })}
        </div>
    );

    // 每个 Part 自成一列：细进度条在上、标签+胶囊（当前）/ 标签+x/y（收起）在下，
    // 列内两行同宽天然对齐。收起的 Part 整列（含进度条区域）都是可点击的切换按钮。
    const partsToRender = overviewParts && overviewParts.length > 0
        ? overviewParts
        : [{ label: partLabel || '', questionIds, active: true }];

    const stripOf = (p: { questionIds: number[] }) => (
        <div className="pbb-part-strip" aria-hidden="true">
            {p.questionIds.map(qid => (
                <span key={qid} className={`pbb-ov-cell${answeredIds.has(qid) ? ' lit' : ''}`} />
            ))}
        </div>
    );

    return (
        <div className="practice-bottom-bar">
            <div className="pbb-parts">
                {partsToRender.map((p, i) =>
                    p.active ? (
                        <div key={i} className="pbb-part active">
                            {stripOf(p)}
                            <div className="pbb-part-row">
                                {p.label && <span className="pbb-part-label">{p.label}</span>}
                                {pills}
                            </div>
                        </div>
                    ) : (
                        <button
                            key={i}
                            type="button"
                            className="pbb-part collapsed"
                            onClick={() => onPartSelect?.(i)}
                            title={p.label}
                        >
                            {stripOf(p)}
                            <div className="pbb-part-row">
                                <span className="pbb-part-label">{p.label}</span>
                                <span className="pbb-part-progress">
                                    {fmt(navLabels.progress, {
                                        answered: p.questionIds.filter(id => answeredIds.has(id)).length,
                                        total: p.questionIds.length,
                                    })}
                                </span>
                            </div>
                        </button>
                    )
                )}
            </div>
            <div className="pbb-actions">
                <span className="pbb-clock-wrap" title="">🕐 <WallClock /></span>
                <button type="button" className="pbb-btn pbb-btn-submit" onClick={onSubmit}>
                    {submitLabel}
                </button>
                <button type="button" className="pbb-btn pbb-btn-exit" onClick={onExit}>
                    {exitLabel}
                </button>
            </div>
        </div>
    );
}
