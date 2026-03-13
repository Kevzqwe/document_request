import { useState, useMemo } from 'react';

interface UsePaginationProps<T> {
  data: T[];
  itemsPerPage?: number;
}

interface UsePaginationReturn<T> {
  currentPage: number;
  setCurrentPage: (page: number) => void;
  totalPages: number;
  currentData: T[];
  startIndex: number;
  endIndex: number;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  goToPage: (page: number) => void;
}

export function usePagination<T>({
  data,
  itemsPerPage = 10,
}: UsePaginationProps<T>): UsePaginationReturn<T> {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(data.length / itemsPerPage);

  const { currentData, startIndex, endIndex } = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      currentData: data.slice(start, end),
      startIndex: start,
      endIndex: Math.min(end, data.length),
    };
  }, [data, currentPage, itemsPerPage]);

  const goToNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNumber);
  };

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    currentData,
    startIndex,
    endIndex,
    goToNextPage,
    goToPreviousPage,
    goToPage,
  };
}
