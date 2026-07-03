import { useLang } from '../../i18n/LanguageContext';

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
    prevLabel,
    nextLabel,
    jumpLabel = 'GO',
    pageInfo,
}: PaginationBarProps) {
    const { translations: t } = useLang();
    return (
        <div className="lp-pager">
            <button
                type="button"
                className="lp-page-btn"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
            >
                {prevLabel ?? t.vocab.pagination.prev}
            </button>
            <span className="lp-page-info">{pageInfo ?? `${page} / ${totalPages}`}</span>
            <button
                type="button"
                className="lp-page-btn"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
            >
                {nextLabel ?? t.vocab.pagination.next}
            </button>
            <span className="lp-page-jump">
                <span>{t.vocab.pagination.jumpTo}</span>
                <input
                    type="text"
                    inputMode="numeric"
                    value={pageJumpInput}
                    onChange={(e) => onPageJumpInputChange(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') onPageJump(); }}
                    placeholder={t.vocab.pagination.pagePlaceholder}
                    aria-label={t.vocab.pagination.jumpAria}
                />
                <button type="button" onClick={onPageJump} disabled={!pageJumpInput.trim()}>{jumpLabel}</button>
            </span>
        </div>
    );
}
