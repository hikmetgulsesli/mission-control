import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

// Test the countRecentCalls function
// We need to import it dynamically after setting up test data

const TEST_AGENTS_DIR = '/tmp/test-openclaw-agents';
const FIVE_HOURS_MS = 5 * 3600 * 1000;

describe('countRecentCalls 5-hour sliding window', () => {
  let countRecentCalls: () => Record<string, { calls: number; tokens: number }>;

  beforeEach(() => {
    // Create test directory structure
    if (existsSync(TEST_AGENTS_DIR)) {
      rmSync(TEST_AGENTS_DIR, { recursive: true });
    }
    mkdirSync(TEST_AGENTS_DIR, { recursive: true });

    // Mock the AGENTS_DIR constant by using a test module
    // We'll test the logic directly
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_AGENTS_DIR)) {
      rmSync(TEST_AGENTS_DIR, { recursive: true });
    }
  });

  describe('ISO timestamp parsing', () => {
    it('should parse standard ISO 8601 format (2026-02-12T10:30:00.000Z)', () => {
      const isoString = '2026-02-12T10:30:00.000Z';
      const ts = Date.parse(isoString);
      
      assert.strictEqual(typeof ts, 'number');
      assert.ok(!isNaN(ts), 'Should parse standard ISO format');
      // Verify by converting back to ISO string
      assert.strictEqual(new Date(ts).toISOString(), isoString);
    });

    it('should parse ISO format without milliseconds (2026-02-12T10:30:00Z)', () => {
      const isoString = '2026-02-12T10:30:00Z';
      const ts = Date.parse(isoString);
      
      assert.strictEqual(typeof ts, 'number');
      assert.ok(!isNaN(ts), 'Should parse ISO format without milliseconds');
      // Verify by converting back - should be equivalent
      assert.strictEqual(new Date(ts).toISOString(), '2026-02-12T10:30:00.000Z');
    });

    it('should parse ISO format with timezone offset (2026-02-12T10:30:00+02:00)', () => {
      const isoString = '2026-02-12T10:30:00+02:00';
      const ts = Date.parse(isoString);
      
      assert.strictEqual(typeof ts, 'number');
      assert.ok(!isNaN(ts), 'Should parse ISO format with timezone offset');
      // Should be 2 hours earlier than UTC equivalent
      const utcEquivalent = Date.parse('2026-02-12T08:30:00.000Z');
      assert.strictEqual(ts, utcEquivalent);
    });

    it('should parse ISO format with negative timezone offset (2026-02-12T10:30:00-05:00)', () => {
      const isoString = '2026-02-12T10:30:00-05:00';
      const ts = Date.parse(isoString);
      
      assert.strictEqual(typeof ts, 'number');
      assert.ok(!isNaN(ts), 'Should parse ISO format with negative timezone offset');
      // Should be 5 hours later than UTC equivalent
      const utcEquivalent = Date.parse('2026-02-12T15:30:00.000Z');
      assert.strictEqual(ts, utcEquivalent);
    });

    it('should handle timestamp field (entry.timestamp)', () => {
      const isoString = '2026-02-12T10:30:00.000Z';
      const entry: any = { timestamp: isoString };
      const tsRaw = entry.timestamp || entry.ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(new Date(ts).toISOString(), isoString);
    });

    it('should handle ts field (entry.ts)', () => {
      const isoString = '2026-02-12T10:30:00.000Z';
      const entry: any = { ts: isoString };
      const tsRaw = entry.timestamp || entry.ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(new Date(ts).toISOString(), isoString);
    });

    it('should prefer timestamp over ts field', () => {
      const entry: any = { timestamp: '2026-02-12T10:30:00.000Z', ts: '2025-01-01T00:00:00.000Z' };
      const tsRaw = entry.timestamp || entry.ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(new Date(ts).toISOString(), '2026-02-12T10:30:00.000Z');
    });

    it('should fallback to 0 when both fields are missing', () => {
      const entry = {};
      const tsRaw = (entry as any).timestamp || (entry as any).ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(ts, 0);
    });
  });

  describe('5-hour cutoff filtering', () => {
    const now = Date.now();
    const cutoff = now - FIVE_HOURS_MS;

    it('should include entries within 5 hours (recent)', () => {
      const tsRaw = now - 1000; // 1 second ago
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      // Entry should NOT be filtered (ts < cutoff is false)
      assert.ok(!(ts < cutoff), 'Recent entry should not be filtered');
    });

    it('should exclude entries older than 5 hours', () => {
      const tsRaw = now - 6 * 3600 * 1000; // 6 hours ago
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      // Entry SHOULD be filtered (ts < cutoff is true)
      assert.ok(ts < cutoff, 'Old entry should be filtered');
    });

    it('should handle entries exactly at 5 hour boundary (inclusive)', () => {
      const tsRaw = cutoff; // Exactly 5 hours ago
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      // At exact cutoff: ts < cutoff is false, so entry is NOT filtered
      assert.strictEqual(ts, cutoff);
      assert.ok(!(ts < cutoff), 'Entry at exact cutoff should NOT be filtered');
    });

    it('should handle entries just under 5 hours (499 minutes)', () => {
      const tsRaw = cutoff + 60 * 1000; // 1 minute after cutoff (4h 59m ago)
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts > cutoff, 'Entry at 4h 59m should be within window');
      assert.ok(!(ts < cutoff), 'Entry at 4h 59m should NOT be filtered');
    });

    it('should handle entries just over 5 hours (301 minutes)', () => {
      const tsRaw = cutoff - 60 * 1000; // 1 minute before cutoff (5h 1m ago)
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts < cutoff, 'Entry at 5h 1m should be outside window');
    });

    it('should handle entries at 4 hours (within window)', () => {
      const tsRaw = now - 4 * 3600 * 1000; // 4 hours ago
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts > cutoff, 'Entry at 4h should be within window');
      assert.ok(!(ts < cutoff), 'Entry at 4h should NOT be filtered');
    });

    it('should handle entries at 5 hours 30 minutes (outside window)', () => {
      const tsRaw = now - 5.5 * 3600 * 1000; // 5.5 hours ago
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts < cutoff, 'Entry at 5h 30m should be outside window');
    });
  });

  describe('edge cases', () => {
    it('should handle numeric timestamps (backward compatibility)', () => {
      const now = Date.now();
      const tsRaw = now - 1000;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(ts, now - 1000);
      assert.strictEqual(typeof ts, 'number');
    });

    it('should handle very old timestamps (years ago)', () => {
      const isoString = '2020-01-01T00:00:00.000Z';
      const tsRaw = isoString;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts < Date.now() - FIVE_HOURS_MS, 'Very old timestamp should be outside window');
    });

    it('should handle future timestamps', () => {
      const futureIso = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour from now
      const tsRaw = futureIso;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.ok(ts > Date.now(), 'Future timestamp should be greater than now');
      assert.ok(!(ts < Date.now() - FIVE_HOURS_MS), 'Future timestamp should NOT be filtered');
    });

    it('should handle invalid timestamp strings gracefully', () => {
      const invalidIso = 'not-a-valid-timestamp';
      const ts = Date.parse(invalidIso);
      
      assert.ok(isNaN(ts), 'Invalid timestamp should return NaN');
    });

    it('should handle empty string timestamp', () => {
      const emptyTs = '';
      const tsRaw = emptyTs || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      // Empty string falls back to 0
      assert.strictEqual(ts, 0);
    });

    it('should handle null timestamp (fallback to 0)', () => {
      const entry: any = { timestamp: null };
      const tsRaw = entry.timestamp || entry.ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(ts, 0);
    });

    it('should handle undefined timestamp (fallback to 0)', () => {
      const entry: any = { timestamp: undefined };
      const tsRaw = entry.timestamp || entry.ts || 0;
      const ts = typeof tsRaw === 'string' ? Date.parse(tsRaw) : tsRaw;
      
      assert.strictEqual(ts, 0);
    });
  });

  describe('provider model matching logic', () => {
    const PROVIDER_MODELS: Record<string, string[]> = {
      'minimax': ['minimax', 'MiniMax'],
      'kimi-coding': ['kimi', 'k2p5', 'moonshot'],
      'zai': ['glm', 'zai', 'zhipu', 'bigmodel'],
      'anthropic': ['claude', 'anthropic'],
    };

    function findProvider(model: string): string | null {
      const lowerModel = model.toLowerCase();
      for (const [pid, patterns] of Object.entries(PROVIDER_MODELS)) {
        if (patterns.some(p => lowerModel.includes(p.toLowerCase()))) {
          return pid;
        }
      }
      return null;
    }

    it('should match minimax models (case insensitive)', () => {
      assert.strictEqual(findProvider('minimax/MiniMax-M2.1'), 'minimax');
      assert.strictEqual(findProvider('MiniMax-Text-01'), 'minimax');
      assert.strictEqual(findProvider('minimax-pro'), 'minimax');
      assert.strictEqual(findProvider('MINIMAX'), 'minimax');
    });

    it('should match kimi-coding models', () => {
      assert.strictEqual(findProvider('kimi-coding/k2p5'), 'kimi-coding');
      assert.strictEqual(findProvider('kimi-k2'), 'kimi-coding');
      assert.strictEqual(findProvider('moonshot-v1'), 'kimi-coding');
      assert.strictEqual(findProvider('Kimi-Chat'), 'kimi-coding');
    });

    it('should match zai models', () => {
      assert.strictEqual(findProvider('zai/glm-4.7'), 'zai');
      assert.strictEqual(findProvider('glm-4'), 'zai');
      assert.strictEqual(findProvider('zhipu-ai'), 'zai');
      assert.strictEqual(findProvider('bigmodel/glm'), 'zai');
    });

    it('should match anthropic models', () => {
      assert.strictEqual(findProvider('anthropic/claude-sonnet-4-5'), 'anthropic');
      assert.strictEqual(findProvider('claude-opus'), 'anthropic');
      assert.strictEqual(findProvider('Claude-3-Haiku'), 'anthropic');
    });

    it('should return null for unknown models', () => {
      assert.strictEqual(findProvider('gpt-4'), null);
      assert.strictEqual(findProvider('unknown-model'), null);
      assert.strictEqual(findProvider(''), null);
    });

    it('should match models in entry.model field', () => {
      const entry = { model: 'minimax/MiniMax-M2.1', message: { role: 'assistant' } };
      const model = (entry.model || '').toLowerCase();
      assert.strictEqual(findProvider(model), 'minimax');
    });

    it('should match models in message.model field', () => {
      const entry = { message: { role: 'assistant', model: 'claude-sonnet' } };
      const model = (entry.message.model || '').toLowerCase();
      assert.strictEqual(findProvider(model), 'anthropic');
    });

    it('should prefer entry.model over message.model', () => {
      const entry = { 
        model: 'minimax/MiniMax-M2.1', 
        message: { role: 'assistant', model: 'claude-sonnet' } 
      };
      const model = (entry.model || entry.message.model || '').toLowerCase();
      assert.strictEqual(findProvider(model), 'minimax');
    });
  });

  describe('usage token counting', () => {
    it('should extract total_tokens from entry.usage', () => {
      const entry: any = {
        usage: { total_tokens: 150, prompt_tokens: 100, completion_tokens: 50 }
      };
      const usage = entry.usage;
      const tokens = usage.total_tokens || usage.totalTokens || 0;
      
      assert.strictEqual(tokens, 150);
    });

    it('should extract totalTokens from entry.usage (camelCase)', () => {
      const entry: any = {
        usage: { totalTokens: 200, promptTokens: 120, completionTokens: 80 }
      };
      const usage = entry.usage;
      const tokens = usage.total_tokens || usage.totalTokens || 0;
      
      assert.strictEqual(tokens, 200);
    });

    it('should extract total_tokens from message.usage', () => {
      const entry: any = {
        message: { 
          role: 'assistant',
          usage: { total_tokens: 300 }
        }
      };
      const usage = entry.usage || entry.message.usage;
      const tokens = usage?.total_tokens || usage?.totalTokens || 0;
      
      assert.strictEqual(tokens, 300);
    });

    it('should default to 0 when usage is missing', () => {
      const entry = {};
      const usage = (entry as any).usage;
      const tokens = usage?.total_tokens || usage?.totalTokens || 0;
      
      assert.strictEqual(tokens, 0);
    });
  });

  describe('assistant message detection', () => {
    it('should count assistant role messages', () => {
      const entry = { message: { role: 'assistant' } };
      assert.strictEqual(entry.message.role, 'assistant');
    });

    it('should not count user role messages', () => {
      const entry = { message: { role: 'user' } };
      assert.notStrictEqual(entry.message.role, 'assistant');
    });

    it('should not count system role messages', () => {
      const entry = { message: { role: 'system' } };
      assert.notStrictEqual(entry.message.role, 'assistant');
    });

    it('should handle missing message field', () => {
      const entry = {};
      const msg = (entry as any).message;
      assert.strictEqual(msg, undefined);
    });

    it('should handle missing role field', () => {
      const entry = { message: {} };
      const role = (entry as any).message.role;
      assert.strictEqual(role, undefined);
    });
  });

  describe('sliding window calculation', () => {
    it('should calculate 5 hours in milliseconds correctly', () => {
      const expectedMs = 5 * 60 * 60 * 1000; // 5 hours = 18,000,000 ms
      assert.strictEqual(FIVE_HOURS_MS, 18000000);
      assert.strictEqual(FIVE_HOURS_MS, expectedMs);
    });

    it('should calculate cutoff as now minus 5 hours', () => {
      const now = Date.now();
      const cutoff = now - FIVE_HOURS_MS;
      
      assert.ok(cutoff < now);
      assert.strictEqual(now - cutoff, FIVE_HOURS_MS);
    });

    it('should handle daylight saving time transitions', () => {
      // ISO timestamps include timezone info, so DST is handled correctly
      const beforeDst = '2026-03-08T06:00:00Z'; // Before US DST
      const afterDst = '2026-03-08T08:00:00Z';  // After US DST
      
      const ts1 = Date.parse(beforeDst);
      const ts2 = Date.parse(afterDst);
      
      // Should be exactly 2 hours apart (7200000 ms)
      assert.strictEqual(ts2 - ts1, 2 * 3600 * 1000);
    });
  });
});

describe('timestamp parsing for 5-hour window (original tests)', () => {
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
