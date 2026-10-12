import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { renderHome } = await server.ssrLoadModule('/src/entry-server.tsx');
  const markup = renderHome();
  if (!markup.includes('Master Your Job Search') || !markup.includes('Message Analyzer') || !markup.includes('Reply Generator')) {
    throw new Error('SSR output does not contain the actual React homepage');
  }
  const file = new URL('../dist/index.html', import.meta.url);
  const html = await readFile(file, 'utf8');
  const root = /<div id="root"[^>]*>[\s\S]*?<\/div>/;
  if (!root.test(html)) throw new Error('Missing root element in Vite HTML');
  await writeFile(file, html.replace(root, `<div id="root" data-prerendered="react">${markup}</div>`));
} finally {
  await server.close();
}
