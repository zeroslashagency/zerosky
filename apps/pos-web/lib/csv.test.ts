import { describe, expect, it } from 'vitest';
import { escapeCsvField, objectArrayToCsv } from './csv';

describe('escapeCsvField', () => {
  it('returns empty string for null and undefined', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('returns plain value for simple strings', () => {
    expect(escapeCsvField('hello')).toBe('hello');
    expect(escapeCsvField('123')).toBe('123');
  });

  it('wraps and escapes values containing commas', () => {
    expect(escapeCsvField('hello, world')).toBe('"hello, world"');
  });

  it('doubles quotes and wraps values containing quotes', () => {
    expect(escapeCsvField('say "hello"')).toBe('"say ""hello"""');
    expect(escapeCsvField('"quoted"')).toBe('"""quoted"""');
  });

  it('wraps values containing newlines', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCsvField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('handles complex cases with multiple special characters', () => {
    expect(escapeCsvField('Name: "John, Sr."\nAge: 42')).toBe(
      '"Name: ""John, Sr.""\nAge: 42"'
    );
  });

  it('converts numbers to strings', () => {
    expect(escapeCsvField(123)).toBe('123');
    expect(escapeCsvField(45.67)).toBe('45.67');
  });
});

describe('objectArrayToCsv', () => {
  it('returns empty string for empty array', () => {
    expect(objectArrayToCsv([])).toBe('');
  });

  it('generates CSV with headers from object keys', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const csv = objectArrayToCsv(data);
    expect(csv).toBe('name,age\nAlice,30\nBob,25');
  });

  it('uses custom headers when provided', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const csv = objectArrayToCsv(data, ['age', 'name']);
    expect(csv).toBe('age,name\n30,Alice\n25,Bob');
  });

  it('properly escapes fields containing special characters', () => {
    const data = [
      { product: 'Coffee, Latte', price: '₹250', note: 'Customer said "hot"' },
    ];
    const csv = objectArrayToCsv(data);
    expect(csv).toBe('product,price,note\n"Coffee, Latte",₹250,"Customer said ""hot"""');
  });

  it('handles null and undefined values', () => {
    const data = [
      { name: 'Alice', note: null },
      { name: 'Bob', note: undefined },
    ];
    const csv = objectArrayToCsv(data);
    expect(csv).toBe('name,note\nAlice,\nBob,');
  });

  it('handles newlines in data', () => {
    const data = [
      { item: 'Item 1', description: 'Line 1\nLine 2' },
    ];
    const csv = objectArrayToCsv(data);
    expect(csv).toBe('item,description\nItem 1,"Line 1\nLine 2"');
  });
});
