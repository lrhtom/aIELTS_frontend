interface PaginationBarProps {
    page: number;
    totalPages: number;
    pageJumpInput: string;
    onPageChange: (page: number) => void;
    onPageJumpInputChange: (value: string) => void;
    onPageJump: () => void;
    prevLabel?: string;
    nextLabel?: string;
    jumpLabel?: string;
    pageInfo?: string;
}

export default function PaginationBar({
    page,
    totalPages,
    pageJumpInput,
    onPageChange,
    onPageJumpInputChange,
    onPageJump,
    prevLabel = '上一页',
    nextLabel = '下一页',
    jumpLabel = 'GO',
    pageInfo,
}: PaginationBarProps) {
    return (
        <div className="lp-pager">
            <button
                type="button"
                className="lp-page-btn"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
            >
                {prevLabel}
            </button>
            <span className="lp-page-info">{pageInfo ?? `${page} / ${totalPages}`}</span>
            <button
                type="button"
                className="lp-page-btn"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
            >
                {nextLabel}
            </button>
            <span className="lp-page-jump">
                <span>跳到</span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={pageJumpInput}
                    onChange={(e) => onPageJumpInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onPageJump(); }}
                    placeholder="页码"
                    aria-label="跳转到指定页"
                />
                <button type="button" onClick={onPageJump} disabled={!pageJumpInput.trim()}>{jumpLabel}</button>
            </span>
        </div>
    );
}
