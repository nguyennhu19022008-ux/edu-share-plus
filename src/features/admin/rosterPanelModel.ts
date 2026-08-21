import type { RosterCsvParseResult, RosterCsvRow } from './rosterCsv';
import type { ActiveRosterRow } from './rosterService';

export type RosterImportPreview = {
  academicYear: string;
  sourceFilename: string;
  canImport: boolean;
  totalDataRows: number;
  validRows: number;
  invalidRows: number;
  skippedBlankRows: number;
  errors: RosterCsvParseResult['errors'];
  previewRows: RosterCsvRow[];
};

function fold(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('vi')
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildRosterImportPreview(input: {
  academicYear: string;
  sourceFilename: string;
  parsed: RosterCsvParseResult;
}): RosterImportPreview {
  const academicYear = input.academicYear.trim();
  const sourceFilename = input.sourceFilename.trim();
  const invalidRows = input.parsed.errors.length;
  const validRows = input.parsed.rows.length;

  return {
    academicYear,
    sourceFilename,
    canImport:
      academicYear.length >= 4
      && academicYear.length <= 32
      && sourceFilename.length > 0
      && validRows > 0
      && invalidRows === 0,
    totalDataRows: input.parsed.totalDataRows,
    validRows,
    invalidRows,
    skippedBlankRows: input.parsed.skippedBlankRows,
    errors: input.parsed.errors,
    previewRows: input.parsed.rows.slice(0, 20),
  };
}

export function filterActiveRoster(
  rows: ActiveRosterRow[],
  filters: {
    keyword?: string;
    claimStatus?: '' | ActiveRosterRow['claimStatus'];
  },
): ActiveRosterRow[] {
  const keyword = fold(filters.keyword ?? '');
  const claimStatus = filters.claimStatus ?? '';

  return rows.filter((row) => {
    if (claimStatus && row.claimStatus !== claimStatus) return false;
    if (!keyword) return true;

    return fold([
      row.fullName,
      row.className,
      row.phoneNormalized,
      row.academicYear,
    ].join(' ')).includes(keyword);
  });
}
