'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  maxVisible?: number;
}

function getPageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number
): (number | string)[] {
  const pages: (number | string)[] = [];

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (currentPage <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    }
  }
  return pages;
}

export function Pagination({
  currentPage,
  totalPages,
  isLoading = false,
  onPageChange,
  maxVisible = 5,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const pageNumbers = getPageNumbers(currentPage, totalPages, maxVisible);

  return (
    <nav
      className="mt-4 pt-4 border-t border-border"
      role="navigation"
      aria-label="도착 기록 페이지네이션"
    >
      <div className="flex items-center justify-center gap-1 sm:gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="px-3 py-2 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          aria-label="이전 페이지"
        >
          이전
        </button>
        {pageNumbers.map((pageNum, idx) =>
          typeof pageNum === 'number' ? (
            <button
              key={idx}
              onClick={() => onPageChange(pageNum)}
              disabled={isLoading}
              className={`min-w-[44px] min-h-[44px] text-sm rounded ${
                pageNum === currentPage
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border hover:bg-muted'
              } disabled:opacity-50`}
              aria-label={`${pageNum} 페이지${pageNum === currentPage ? ' (현재 페이지)' : ''}`}
              aria-current={pageNum === currentPage ? 'page' : undefined}
            >
              {pageNum}
            </button>
          ) : (
            <span key={idx} className="px-1 text-muted-foreground" aria-hidden="true">
              ...
            </span>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="px-3 py-2 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          aria-label="다음 페이지"
        >
          다음
        </button>
      </div>
      {isLoading && (
        <div className="flex justify-center mt-2" role="status" aria-label="로딩 중">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </nav>
  );
}
