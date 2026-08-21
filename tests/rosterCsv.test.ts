import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRosterCsv } from '../src/features/admin/rosterCsv';

test('parses BOM, CRLF/LF and RFC-4180 quoted commas', () => {
  const csv = [
    '\uFEFFHọ và tên,Lớp,Số điện thoại',
    '"Nguyễn Văn A, Jr.",12 A1,+84 900 100 001',
    'Trần Thị B,11A2,0900100002',
  ].join('\r\n') + '\n';

  const result = parseRosterCsv(csv);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.rows, [
    {
      full_name: 'Nguyễn Văn A, Jr.',
      class_name: '12 A1',
      phone: '+84 900 100 001',
    },
    {
      full_name: 'Trần Thị B',
      class_name: '11A2',
      phone: '0900100002',
    },
  ]);
  assert.equal(result.totalDataRows, 2);
  assert.equal(result.skippedBlankRows, 0);
});

test('accepts backend field-name headers', () => {
  const result = parseRosterCsv(
    'full_name,class_name,phone\nLê Văn C,10A3,0900100003\n',
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.full_name, 'Lê Văn C');
});

test('reports required headers without inventing columns', () => {
  const result = parseRosterCsv(
    'Họ và tên,Lớp\nNguyễn Văn A,12A1\n',
  );

  assert.deepEqual(result.rows, []);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.code, 'missing_required_headers');
  assert.deepEqual(result.errors[0]?.fields, ['phone']);
});

test('skips blank lines and rejects incomplete rows', () => {
  const result = parseRosterCsv(
    'Họ và tên,Lớp,Số điện thoại\n\nNguyễn Văn A,12A1,0900100001\n,,\nTrần Thị B,11A2,\n',
  );

  assert.equal(result.skippedBlankRows, 2);
  assert.deepEqual(result.rows, [
    { full_name: 'Nguyễn Văn A', class_name: '12A1', phone: '0900100001' },
  ]);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.code, 'required_field_missing');
  assert.deepEqual(result.errors[0]?.fields, ['phone']);
});

test('flags only exact duplicate student rows and preserves twin-like ambiguity', () => {
  const result = parseRosterCsv(
    [
      'Họ và tên,Lớp,Số điện thoại',
      'Nguyễn Văn A,12A1,0900100001',
      'Nguyễn Văn A,12A1,0900100001',
      'Nguyễn Văn B,12A1,0900100001',
    ].join('\n'),
  );

  assert.deepEqual(result.rows, [
    { full_name: 'Nguyễn Văn A', class_name: '12A1', phone: '0900100001' },
    { full_name: 'Nguyễn Văn B', class_name: '12A1', phone: '0900100001' },
  ]);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.code, 'duplicate_row');
  assert.equal(result.errors[0]?.rowNumber, 3);
});

test('supports escaped double quotes and quoted embedded newlines', () => {
  const result = parseRosterCsv(
    'Họ và tên,Lớp,Số điện thoại\n"Nguyễn ""An""\nA",12A1,0900100004\n',
  );

  assert.deepEqual(result.errors, []);
  assert.equal(result.rows[0]?.full_name, 'Nguyễn "An"\nA');
});

test('reports malformed unclosed quoted field', () => {
  const result = parseRosterCsv(
    'Họ và tên,Lớp,Số điện thoại\n"Nguyễn Văn A,12A1,0900100001',
  );

  assert.deepEqual(result.rows, []);
  assert.equal(result.errors[0]?.code, 'malformed_csv');
});
