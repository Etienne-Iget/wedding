import type { Plugin } from 'vite';
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import { resolve, dirname, extname, join } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'public/data');
const IMAGES_DIR = resolve(process.cwd(), 'public/images');
const DATA_FILE = resolve(DATA_DIR, 'wedding-data.json');

const EXTRA_FILES: Record<string, string> = {
  'table-occupancy': resolve(DATA_DIR, 'table-occupancy.json'),
  'recent-rsvps': resolve(DATA_DIR, 'recent-rsvps.json'),
  'arrivals': resolve(DATA_DIR, 'arrivals.json'),
  'guests': resolve(DATA_DIR, 'guests.json'),
  'floor-plan': resolve(DATA_DIR, 'floor-plan.json'),
};

export function jsonPersistPlugin(): Plugin {
  return {
    name: 'json-persist',
    configureServer(server) {
      // Save main or extra file — body: { file?: key, data: object }
      server.middlewares.use('/api/save', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        if (req.method !== 'POST') {
          next();
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 20 * 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            req.destroy();
            return;
          }
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const fileKey = parsed.file as string | undefined;
            const targetFile = fileKey && EXTRA_FILES[fileKey]
              ? EXTRA_FILES[fileKey]
              : DATA_FILE;
            const payload = parsed.data ?? parsed;
            mkdirSync(dirname(targetFile), { recursive: true });
            writeFileSync(targetFile, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Write failed';
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg }));
          }
        });
      });

      // Upload an image to public/images/ — multipart/form-data with field "image"
      server.middlewares.use('/api/upload-image', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }

        const contentType = req.headers['content-type'] || '';
        if (!contentType.startsWith('multipart/form-data')) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected multipart/form-data' }));
          return;
        }

        const boundary = contentType.match(/boundary=(.+)/)?.[1];
        if (!boundary) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No boundary found' }));
          return;
        }

        const chunks: Buffer[] = [];
        let totalSize = 0;
        const MAX_SIZE = 10 * 1024 * 1024;

        req.on('data', (chunk: Buffer) => {
          totalSize += chunk.length;
          if (totalSize > MAX_SIZE) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'File too large (max 10 Mo)' }));
            req.destroy();
            return;
          }
          chunks.push(chunk);
        });

        req.on('end', () => {
          try {
            const buf = Buffer.concat(chunks);
            const boundaryBuf = Buffer.from('--' + boundary);
            const boundaryIdx = buf.indexOf(boundaryBuf);
            if (boundaryIdx === -1) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Malformed multipart data' }));
              return;
            }

            // Find the file part (look for filename= in headers)
            const filenameMatch = buf.toString('latin1').match(/filename="([^"]+)"/);
            if (!filenameMatch) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No file found in upload' }));
              return;
            }

            const originalName = filenameMatch[1];
            const ext = extname(originalName).toLowerCase() || '.png';
            const allowedExts = ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif'];
            if (!allowedExts.includes(ext)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Unsupported file type' }));
              return;
            }

            // Extract file content: find \r\n\r\n after headers, then content until next boundary
            const headerEnd = buf.indexOf('\r\n\r\n', boundaryIdx);
            if (headerEnd === -1) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Malformed multipart headers' }));
              return;
            }

            const contentStart = headerEnd + 4;
            const nextBoundary = buf.indexOf(Buffer.from('\r\n--' + boundary), contentStart);
            if (nextBoundary === -1) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Malformed multipart content' }));
              return;
            }

            const fileContent = buf.subarray(contentStart, nextBoundary);

            // Generate unique filename
            const timestamp = Date.now();
            const random = Math.random().toString(36).slice(2, 8);
            const filename = `img-${timestamp}-${random}${ext}`;
            const filePath = join(IMAGES_DIR, filename);

            mkdirSync(IMAGES_DIR, { recursive: true });
            writeFileSync(filePath, fileContent);

            const publicUrl = `/images/${filename}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, url: publicUrl, filename }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Upload failed';
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg }));
          }
        });
      });

      // Delete an image from public/images/
      server.middlewares.use('/api/delete-image', (req, res, _next) => {
        if (req.method !== 'POST') {
          _next();
          return;
        }

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 1024 * 1024) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Payload too large' }));
            req.destroy();
            return;
          }
        });
        req.on('end', () => {
          try {
            const { url } = JSON.parse(body);
            if (!url || typeof url !== 'string') {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Missing url' }));
              return;
            }

            // Only allow deleting files in /images/
            if (!url.startsWith('/images/')) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid path' }));
              return;
            }

            const filename = url.replace('/images/', '');
            const filePath = join(IMAGES_DIR, filename);

            if (existsSync(filePath)) {
              unlinkSync(filePath);
            }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Delete failed';
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg }));
          }
        });
      });

      // Load main file
      server.middlewares.use('/api/load', (_req, res, _next) => {
        try {
          const content = readFileSync(DATA_FILE, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(content);
        } catch {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'File not found' }));
        }
      });
    },
  };
}
