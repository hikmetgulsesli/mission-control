import { Router } from 'express';
import { readdir, stat, readFile, writeFile, rm, mkdir, rename } from 'fs/promises';
import { resolve, normalize, join, basename, dirname } from 'path';
import { existsSync } from 'fs';

const router = Router();

const ALLOWED_BASES = ['/home/setrox', '/var/log', '/etc/systemd/system'];

const BLOCKED_NAMES = new Set([
  '.env', '.ssh', '.gnupg', 'credentials', 'secrets',
  'node_modules', '.cloudflare-api-token', '.git',
]);

const BLOCKED_PATTERNS = [/\.pem$/, /\.key$/, /id_rsa/, /id_ed25519/];

const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

function isPathAllowed(requestedPath: string): boolean {
  const resolved = resolve(normalize(requestedPath));
  return ALLOWED_BASES.some(base =>
    resolved === base || resolved.startsWith(base + '/')
  );
}

function isBlocked(name: string): boolean {
  if (BLOCKED_NAMES.has(name)) return true;
  if (BLOCKED_PATTERNS.some(p => p.test(name))) return true;
  return false;
}

function isBlockedPath(fullPath: string): boolean {
  const parts = fullPath.split('/');
  return parts.some(part => isBlocked(part));
}

function isRootPath(resolved: string): boolean {
  return ALLOWED_BASES.some(base => resolved === base);
}

function validatePath(path: string): { ok: true; resolved: string } | { ok: false; error: string; status: number } {
  if (!path) return { ok: false, error: 'path is required', status: 400 };
  const resolved = resolve(normalize(path));
  if (!isPathAllowed(resolved)) return { ok: false, error: 'Access denied: path not in allowed directories', status: 403 };
  if (isBlockedPath(resolved)) return { ok: false, error: 'Access denied: blocked path', status: 403 };
  return { ok: true, resolved };
}

// GET /files/list
router.get('/files/list', async (req, res) => {
  try {
    const dirPath = (req.query.path as string) || '/home/setrox/';
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
      if (!showHidden && entry.name.startsWith('.')) continue;
      if (isBlocked(entry.name)) continue;
      try {
        const fullPath = join(resolved, entry.name);
        const s = await stat(fullPath);
        items.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: s.size,
          mtime: s.mtime.toISOString(),
        });
      } catch {
        // Skip entries we can't stat
      }
    }
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    res.json({ path: resolved, entries: items });
  } catch (err: any) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'Directory not found' });
    else if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// GET /files/read
router.get('/files/read', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'path parameter is required' }); return; }
    const resolved = resolve(normalize(filePath));
    if (!isPathAllowed(resolved)) { res.status(403).json({ error: 'Access denied: path not in allowed directories' }); return; }
    if (isBlockedPath(resolved)) { res.status(403).json({ error: 'Access denied: blocked file' }); return; }

    const s = await stat(resolved);
    if (s.isDirectory()) { res.status(400).json({ error: 'Cannot read a directory' }); return; }
    if (s.size > MAX_FILE_SIZE) { res.status(413).json({ error: 'File too large. Max: 1MB' }); return; }

    const content = await readFile(resolved, 'utf-8');
    const lines = content.split('\n').length;
    res.json({ path: resolved, name: basename(resolved), dir: dirname(resolved), size: s.size, mtime: s.mtime.toISOString(), lines, content });
  } catch (err: any) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'File not found' });
    else if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// PUT /files/write - Create or overwrite a file
router.put('/files/write', async (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    const v = validatePath(filePath);
    if (!v.ok) { res.status(v.status).json({ error: v.error }); return; }
    if (typeof content !== 'string') { res.status(400).json({ error: 'content must be a string' }); return; }
    const buf = Buffer.from(content, 'utf-8');
    if (buf.length > MAX_FILE_SIZE) { res.status(413).json({ error: 'Content too large. Max: 1MB' }); return; }

    await writeFile(v.resolved, content, 'utf-8');
    const s = await stat(v.resolved);
    res.json({ success: true, path: v.resolved, size: s.size });
  } catch (err: any) {
    if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// DELETE /files/delete - Delete file or directory
router.delete('/files/delete', async (req, res) => {
  try {
    const { path: filePath } = req.body;
    const v = validatePath(filePath);
    if (!v.ok) { res.status(v.status).json({ error: v.error }); return; }
    if (isRootPath(v.resolved)) { res.status(403).json({ error: 'Cannot delete root directory' }); return; }

    await rm(v.resolved, { recursive: true });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'Not found' });
    else if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// POST /files/mkdir - Create directory
router.post('/files/mkdir', async (req, res) => {
  try {
    const { path: dirPath } = req.body;
    const v = validatePath(dirPath);
    if (!v.ok) { res.status(v.status).json({ error: v.error }); return; }
    if (existsSync(v.resolved)) { res.status(409).json({ error: 'Already exists' }); return; }

    await mkdir(v.resolved);
    res.json({ success: true, path: v.resolved });
  } catch (err: any) {
    if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// POST /files/rename - Rename file or directory
router.post('/files/rename', async (req, res) => {
  try {
    const { oldPath, newPath } = req.body;
    const vOld = validatePath(oldPath);
    if (!vOld.ok) { res.status(vOld.status).json({ error: vOld.error }); return; }
    const vNew = validatePath(newPath);
    if (!vNew.ok) { res.status(vNew.status).json({ error: vNew.error }); return; }

    if (dirname(vOld.resolved) !== dirname(vNew.resolved)) {
      res.status(400).json({ error: 'Rename must stay in the same directory' }); return;
    }
    if (isRootPath(vOld.resolved)) { res.status(403).json({ error: 'Cannot rename root directory' }); return; }

    await rename(vOld.resolved, vNew.resolved);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'Not found' });
    else if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// POST /files/upload - Upload file (base64)
router.post('/files/upload', async (req, res) => {
  try {
    const { directory, filename, content } = req.body;
    if (!directory || !filename || !content) {
      res.status(400).json({ error: 'directory, filename, and content are required' }); return;
    }
    if (/[/\\]|\.\./.test(filename)) { res.status(400).json({ error: 'Invalid filename' }); return; }

    const vDir = validatePath(directory);
    if (!vDir.ok) { res.status(vDir.status).json({ error: vDir.error }); return; }

    const fullPath = join(vDir.resolved, filename);
    if (isBlockedPath(fullPath)) { res.status(403).json({ error: 'Access denied: blocked path' }); return; }
    if (existsSync(fullPath)) { res.status(409).json({ error: 'File already exists' }); return; }

    const buf = Buffer.from(content, 'base64');
    if (buf.length > MAX_FILE_SIZE) { res.status(413).json({ error: 'File too large. Max: 1MB' }); return; }

    await writeFile(fullPath, buf);
    res.json({ success: true, path: fullPath, size: buf.length });
  } catch (err: any) {
    if (err.code === 'EACCES') res.status(403).json({ error: 'Permission denied' });
    else res.status(500).json({ error: err.message });
  }
});

// GET /files/download - Download file as attachment
router.get('/files/download', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ error: 'path parameter is required' }); return; }
    const resolved = resolve(normalize(filePath));
    if (!isPathAllowed(resolved)) { res.status(403).json({ error: 'Access denied' }); return; }
    if (isBlockedPath(resolved)) { res.status(403).json({ error: 'Access denied: blocked file' }); return; }

    const s = await stat(resolved);
    if (s.isDirectory()) { res.status(400).json({ error: 'Cannot download a directory' }); return; }

    res.download(resolved, basename(resolved));
  } catch (err: any) {
    if (err.code === 'ENOENT') res.status(404).json({ error: 'File not found' });
    else res.status(500).json({ error: err.message });
  }
});

export default router;
