import type { Plugin } from 'vite';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'public/data');
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
