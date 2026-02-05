export const ARCHIVE_PAGE_SIZE = 60;

export function getArchivePageCount(total: number, pageSize = ARCHIVE_PAGE_SIZE) {
  if (!total || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / pageSize));
}
