import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateControlsLocalMutationV1 as valid } from './controls-local-request.js';
const base = { actualAddress: { address: '127.0.0.1', family: 'IPv4', port: 3080 }, peerAddress: '127.0.0.1', localAddress: '127.0.0.1',
    rawHeaders: ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'application/json'],
    method: 'POST', secFetchSite: 'same-origin', query: '', contentLength: 96 };
test('only the actual exact listener and local browser boundary authorize mutation', () => {
    assert.equal(valid(base), true);
    assert.equal(valid({ ...base, peerAddress: '::ffff:127.0.0.1' }), true);
    for (const patch of [{ actualAddress: null }, { actualAddress: { ...base.actualAddress, address: '0.0.0.0' } },
        { actualAddress: { ...base.actualAddress, port: 13082 } }, { peerAddress: '10.0.0.1' }, { localAddress: '::1' },
        { method: 'GET' }, { method: 'OPTIONS' }, { secFetchSite: 'cross-site' }, { query: '?token=secret' },
        { contentLength: null }, { contentLength: 2049 }, { contentLength: 0 },
        { rawHeaders: [...base.rawHeaders, 'Host', '127.0.0.1:3080'] },
        { rawHeaders: [...base.rawHeaders, 'X-Forwarded-For', '127.0.0.1'] },
        { rawHeaders: base.rawHeaders.filter((_, i) => i < 2 || i > 3) },
        { rawHeaders: ['Host', '127.0.0.1:3080', 'Origin', 'null', 'Content-Type', 'application/json'] },
        { rawHeaders: ['Host', '127.0.0.1:3080', 'Origin', 'http://127.0.0.1:3080', 'Content-Type', 'text/plain'] },
    ])
        assert.equal(valid({ ...base, ...patch }), false, JSON.stringify(patch));
});
