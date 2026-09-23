import type { Plugin } from 'vite';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const DATA_FILE = resolve(process.cwd(), 'public/data/wedding-data.json');

export function jsonPersistPlugin(): Plugin {
  return {
    name: 'json-persist',
    configureServer(server) {
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
            mkdirSync(dirname(DATA_FILE), { recursive: true });
            writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Write failed';
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: msg }));
          }
        });
      });

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
