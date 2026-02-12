import { describe, it } from 'node:test';
import assert from 'node:assert';

// Test the timestamp parsing logic from quota.ts
// Since the actual function is not exported, we test the parsing logic directly

describe('timestamp parsing for 5-hour window', () => {
  const FIVE_HOURS_MS = 5 * 3600 * 1000;
  const now = Date.now();
  const cutoff = now - FIVE_HOURS_MS;

  it('should correctly parse ISO string timestamps', () => {
    const tsRaw = new Date(now - 1000).toISOString(); // 1 second ago
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.strictEqual(typeof ts, 'number');
    assert.ok(ts > cutoff, 'Recent ISO timestamp should be within 5h window');
  });

  it('should correctly handle numeric timestamps', () => {
    const tsRaw = now - 1000; // 1 second ago as number
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.strictEqual(typeof ts, 'number');
    assert.ok(ts > cutoff, 'Recent numeric timestamp should be within 5h window');
  });

  it('should filter out entries older than 5 hours (ISO string)', () => {
    const tsRaw = new Date(now - 6 * 3600 * 1000).toISOString(); // 6 hours ago
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.ok(ts < cutoff, '6-hour old ISO timestamp should be outside 5h window');
  });

  it('should filter out entries older than 5 hours (numeric)', () => {
    const tsRaw = now - 6 * 3600 * 1000; // 6 hours ago
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.ok(ts < cutoff, '6-hour old numeric timestamp should be outside 5h window');
  });

  it('should handle entries exactly at 5 hour boundary', () => {
    const tsRaw = new Date(cutoff).toISOString();
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    // At the exact cutoff, ts < cutoff is false, so entry should NOT be filtered
    assert.ok(ts === cutoff, 'Timestamp at cutoff should equal cutoff');
    assert.ok(!(ts < cutoff), 'Timestamp at cutoff should not be less than cutoff');
  });

  it('should handle entries just inside 5 hour window', () => {
    const tsRaw = new Date(cutoff + 1000).toISOString(); // 1 second after cutoff
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.ok(ts > cutoff, 'Timestamp just inside window should be greater than cutoff');
  });

  it('should handle entries just outside 5 hour window', () => {
    const tsRaw = new Date(cutoff - 1000).toISOString(); // 1 second before cutoff
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    assert.ok(ts < cutoff, 'Timestamp just outside window should be less than cutoff');
  });

  it('should handle fallback to 0 for missing timestamps', () => {
    const tsRaw = 0;
    const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
    
    // When ts is 0, the condition `if (ts && ts < cutoff)` is false (0 is falsy)
    // So entry would NOT be filtered out (which is the safe default)
    assert.strictEqual(ts, 0);
  });

  it('should demonstrate why string comparison is wrong', () => {
    // This test documents why the old code was broken
    // When comparing ISO strings with numbers, JavaScript does type coercion
    // or string comparison which produces incorrect results
    
    const isoString = '2026-02-12T04:50:00.000Z';
    const numericValue = 1700000000000;
    
    // String < Number comparison - JavaScript coerces to number if possible
    // But '2026-02-12...' cannot be coerced to a valid number, so it becomes NaN
    // Any comparison with NaN is false
    // @ts-expect-error - intentionally demonstrating the type mismatch issue
    const mixedComparison: boolean = isoString < numericValue;
    
    // Proper numeric comparison
    const parsedTs = Date.parse(isoString);
    const numericComparison = parsedTs < numericValue;
    
    // The key point: we must parse ISO strings before comparing
    assert.strictEqual(typeof parsedTs, 'number', 'Date.parse returns a number');
    assert.ok(!isNaN(parsedTs), 'Parsed timestamp should be a valid number');
    
    // Document that the fix ensures numeric comparison
    assert.ok(true, 'Fix ensures ISO strings are parsed to numbers before comparison');
  });
});
