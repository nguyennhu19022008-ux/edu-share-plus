export type RosterCsvRow = {
  full_name: string;
  class_name: string;
  phone: string;
};

export type RosterCsvErrorCode =
  | 'malformed_csv'
  | 'missing_required_headers'
  | 'required_field_missing'
  | 'duplicate_row';

export type RosterCsvError = {
  code: RosterCsvErrorCode;
  message: string;
  rowNumber?: number;
  fields?: Array<keyof RosterCsvRow>;
};

export type RosterCsvParseResult = {
  rows: RosterCsvRow[];
  errors: RosterCsvError[];
  totalDataRows: number;
  skippedBlankRows: number;
};

type ParsedRecord = {
  values: string[];
  rowNumber: number;
};

const REQUIRED_FIELDS: Array<keyof RosterCsvRow> = [
  'full_name',
  'class_name',
  'phone',
];

function foldVietnamese(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLocaleLowerCase('vi')
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-]+/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function canonicalHeader(value: string): keyof RosterCsvRow | null {
  const normalized = foldVietnamese(value);

  if (
    normalized === 'full name'
    || normalized === 'fullname'
    || normalized === 'ho va ten'
    || normalized === 'ho ten'
    || normalized === 'ten hoc sinh'
  ) {
    return 'full_name';
  }

  if (
    normalized === 'class name'
    || normalized === 'classname'
    || normalized === 'lop'
    || normalized === 'lop hoc'
  ) {
    return 'class_name';
  }

  if (
    normalized === 'phone'
    || normalized === 'phone number'
    || normalized === 'so dien thoai'
    || normalized === 'dien thoai'
    || normalized === 'sdt'
  ) {
    return 'phone';
  }

  return null;
}

function parseRecords(source: string): {
  records: ParsedRecord[];
  malformed: boolean;
} {
  const text = source.replace(/^\uFEFF/, '');
  const records: ParsedRecord[] = [];
  let values: string[] = [];
  let field = '';
  let inQuotes = false;
  let afterClosingQuote = false;
  let recordStartLine = 1;
  let currentLine = 1;

  const pushRecord = () => {
    values.push(field);
    records.push({ values, rowNumber: recordStartLine });
    values = [];
    field = '';
    afterClosingQuote = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          afterClosingQuote = true;
        }
      } else {
        field += char;
        if (char === '\n') currentLine += 1;
        if (char === '\r' && text[index + 1] !== '\n') currentLine += 1;
      }
      continue;
    }

    if (char === '"') {
      if (field.length === 0 && !afterClosingQuote) {
        inQuotes = true;
        continue;
      }
      return { records: [], malformed: true };
    }

    if (char === ',') {
      values.push(field);
      field = '';
      afterClosingQuote = false;
      continue;
    }

    if (char === '\r' || char === '\n') {
      pushRecord();

      if (char === '\r' && text[index + 1] === '\n') {
        index += 1;
      }
      currentLine += 1;
      recordStartLine = currentLine;
      continue;
    }

    if (afterClosingQuote) {
      // RFC-4180 requires delimiter/newline after a closing quote. Permit only
      // horizontal whitespace before that delimiter for common spreadsheet CSVs.
      if (char === ' ' || char === '\t') continue;
      return { records: [], malformed: true };
    }

    field += char;
  }

  if (inQuotes) {
    return { records: [], malformed: true };
  }

  // Do not turn a terminal newline into an extra blank record.
  if (field.length > 0 || values.length > 0 || afterClosingQuote) {
    pushRecord();
  }

  return { records, malformed: false };
}

function isBlankRecord(record: ParsedRecord): boolean {
  return record.values.every((value) => value.trim() === '');
}

function duplicateKey(row: RosterCsvRow): string {
  const normalizedName = row.full_name
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/\s+/g, ' ');
  const normalizedClass = row.class_name
    .trim()
    .toLocaleLowerCase('vi')
    .replace(/[\s._-]+/g, '');
  const normalizedPhone = row.phone.replace(/\D/g, '');
  return `${normalizedName}\u0000${normalizedClass}\u0000${normalizedPhone}`;
}

export function parseRosterCsv(source: string): RosterCsvParseResult {
  const parsed = parseRecords(source);

  if (parsed.malformed) {
    return {
      rows: [],
      errors: [{
        code: 'malformed_csv',
        message: 'Tệp CSV có trường được đặt trong dấu ngoặc kép không hợp lệ.',
      }],
      totalDataRows: 0,
      skippedBlankRows: 0,
    };
  }

  let headerIndex = parsed.records.findIndex((record) => !isBlankRecord(record));
  if (headerIndex < 0) {
    return {
      rows: [],
      errors: [{
        code: 'missing_required_headers',
        message: 'CSV phải có các cột Họ và tên, Lớp và Số điện thoại.',
        fields: [...REQUIRED_FIELDS],
      }],
      totalDataRows: 0,
      skippedBlankRows: 0,
    };
  }

  const header = parsed.records[headerIndex];
  const columnByField = new Map<keyof RosterCsvRow, number>();

  header.values.forEach((value, index) => {
    const field = canonicalHeader(value);
    if (field && !columnByField.has(field)) {
      columnByField.set(field, index);
    }
  });

  const missingFields = REQUIRED_FIELDS.filter(
    (field) => !columnByField.has(field),
  );

  if (missingFields.length > 0) {
    return {
      rows: [],
      errors: [{
        code: 'missing_required_headers',
        message: `Thiếu cột bắt buộc: ${missingFields.join(', ')}.`,
        fields: missingFields,
      }],
      totalDataRows: 0,
      skippedBlankRows: 0,
    };
  }

  const rows: RosterCsvRow[] = [];
  const errors: RosterCsvError[] = [];
  const seen = new Set<string>();
  let totalDataRows = 0;
  let skippedBlankRows = 0;

  for (const record of parsed.records.slice(headerIndex + 1)) {
    if (isBlankRecord(record)) {
      skippedBlankRows += 1;
      continue;
    }

    totalDataRows += 1;

    const row: RosterCsvRow = {
      full_name: record.values[columnByField.get('full_name')!] ?? '',
      class_name: record.values[columnByField.get('class_name')!] ?? '',
      phone: record.values[columnByField.get('phone')!] ?? '',
    };

    row.full_name = row.full_name.trim();
    row.class_name = row.class_name.trim();
    row.phone = row.phone.trim();

    const emptyFields = REQUIRED_FIELDS.filter((field) => !row[field]);
    if (emptyFields.length > 0) {
      errors.push({
        code: 'required_field_missing',
        message: `Dòng ${record.rowNumber} thiếu trường bắt buộc.`,
        rowNumber: record.rowNumber,
        fields: emptyFields,
      });
      continue;
    }

    const key = duplicateKey(row);
    if (seen.has(key)) {
      errors.push({
        code: 'duplicate_row',
        message: `Dòng ${record.rowNumber} trùng hoàn toàn với một học sinh đã có trong tệp.`,
        rowNumber: record.rowNumber,
      });
      continue;
    }

    seen.add(key);
    rows.push(row);
  }

  return {
    rows,
    errors,
    totalDataRows,
    skippedBlankRows,
  };
}
