import { Router } from 'express';
import { readdir, stat, readFile } from 'fs/promises';
import { resolve, normalize, join, basename, dirname } from 'path';
const router = Router();
const ALLOWED_BASES = ['/home/setrox', '/var/log', '/etc/systemd/system'];
const BLOCKED_NAMES = new Set([
    '.env', '.ssh', '.gnupg', 'credentials', 'secrets',
    'node_modules', '.cloudflare-api-token', '.git',
]);
const BLOCKED_PATTERNS = [/\.pem$/, /\.key$/, /id_rsa/, /id_ed25519/];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB
function isPathAllowed(requestedPath) {
    const resolved = resolve(normalize(requestedPath));
    return ALLOWED_BASES.some(base => resolved === base || resolved.startsWith(base + '/'));
}
function isBlocked(name) {
    if (BLOCKED_NAMES.has(name))
        return true;
    if (BLOCKED_PATTERNS.some(p => p.test(name)))
        return true;
    return false;
}
function isBlockedPath(fullPath) {
    const parts = fullPath.split('/');
    return parts.some(part => isBlocked(part));
}
router.get('/files/list', async (req, res) => {
    try {
        const dirPath = req.query.path || '/home/setrox/';
        const showHidden = req.query.hidden === 'true';
        const resolved = resolve(normalize(dirPath));
        if (!isPathAllowed(resolved)) {
            res.status(403).json({ error: 'Access denied: path not in allowed directories' });
            return;
        }
        if (isBlockedPath(resolved)) {
            res.status(403).json({ error: 'Access denied: blocked path' });
            return;
        }
        const entries = await readdir(resolved, { withFileTypes: true });
        const items = [];
        for (const entry of entries) {
            if (!showHidden && entry.name.startsWith('.'))
                continue;
            if (isBlocked(entry.name))
                continue;
            try {
                const fullPath = join(resolved, entry.name);
                const s = await stat(fullPath);
                items.push({
                    name: entry.name,
                    type: entry.isDirectory() ? 'directory' : 'file',
                    size: s.size,
                    mtime: s.mtime.toISOString(),
                });
            }
            catch {
                // Skip entries we can't stat
            }
        }
        // Directories first, then alphabetical
        items.sort((a, b) => {
            if (a.type !== b.type)
                return a.type === 'directory' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        res.json({ path: resolved, entries: items });
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'Directory not found' });
        }
        else if (err.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
});
router.get('/files/read', async (req, res) => {
    try {
        const filePath = req.query.path;
        if (!filePath) {
            res.status(400).json({ error: 'path parameter is required' });
            return;
        }
        const resolved = resolve(normalize(filePath));
        if (!isPathAllowed(resolved)) {
            res.status(403).json({ error: 'Access denied: path not in allowed directories' });
            return;
        }
        if (isBlockedPath(resolved)) {
            res.status(403).json({ error: 'Access denied: blocked file' });
            return;
        }
        const s = await stat(resolved);
        if (s.isDirectory()) {
            res.status(400).json({ error: 'Cannot read a directory' });
            return;
        }
        if (s.size > MAX_FILE_SIZE) {
            res.status(413).json({ error: `File too large (${(s.size / 1024 / 1024).toFixed(1)}MB). Max: 1MB` });
            return;
        }
        const content = await readFile(resolved, 'utf-8');
        const lines = content.split('\n').length;
        res.json({
            path: resolved,
            name: basename(resolved),
            dir: dirname(resolved),
            size: s.size,
            mtime: s.mtime.toISOString(),
            lines,
            content,
        });
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: 'File not found' });
        }
        else if (err.code === 'EACCES') {
            res.status(403).json({ error: 'Permission denied' });
        }
        else {
            res.status(500).json({ error: err.message });
        }
    }
});
export default router;
