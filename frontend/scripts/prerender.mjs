import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceMeta(html, selector, replacement) {
  const pattern = new RegExp(`<meta[^>]*${selector}[^>]*>`, 'i');
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function headFor(html, route, canonicalUrl, ogImage) {
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);
  const canonical = canonicalUrl(route.path);
  let output = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`);
  output = replaceMeta(output, 'name=["\']description["\']', `<meta name="description" content="${description}" />`);
  output = replaceMeta(output, 'property=["\']og:title["\']', `<meta property="og:title" content="${title}" />`);
  output = replaceMeta(output, 'property=["\']og:description["\']', `<meta property="og:description" content="${description}" />`);
  output = replaceMeta(output, 'property=["\']og:url["\']', `<meta property="og:url" content="${canonical}" />`);
  output = replaceMeta(output, 'property=["\']og:image["\']', `<meta property="og:image" content="${ogImage}" />`);
  output = replaceMeta(output, 'name=["\']twitter:title["\']', `<meta name="twitter:title" content="${title}" />`);
  output = replaceMeta(output, 'name=["\']twitter:description["\']', `<meta name="twitter:description" content="${description}" />`);
  output = replaceMeta(output, 'name=["\']twitter:image["\']', `<meta name="twitter:image" content="${ogImage}" />`);
  output = output.replace(/<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`);
  output = output.replace(/\s*<meta\s+name=["']robots["'][^>]*>/gi, '');
  output = output.replace('</head>', `    <meta name="robots" content="${route.noindex ? 'noindex, nofollow' : 'index, follow'}" />\n  </head>`);
  return output;
}

function outputPath(pathname) {
  return pathname === '/' ? 'index.html' : `${pathname.replace(/^\//, '')}/index.html`;
}

try {
  const { renderPath } = await server.ssrLoadModule('/src/entry-server.tsx');
  const { publicRoutes, noindexRoutes, notFoundRoute, canonicalUrl, OG_IMAGE } = await server.ssrLoadModule('/src/seo/routes.ts');
  const templatePath = new URL('../dist/index.html', import.meta.url);
  const template = await readFile(templatePath, 'utf8');
  const routes = [...publicRoutes, ...noindexRoutes, notFoundRoute];

  for (const route of routes) {
    const markup = renderPath(route.path);
    if (!route.noindex && !markup.includes('<h1')) throw new Error(`SSR output for ${route.path} is missing an H1`);
    const root = /<div id="root"[^>]*>[\s\S]*?<\/div>/;
    const html = headFor(template.replace(root, `<div id="root" data-prerendered="react">${markup}</div>`), route, canonicalUrl, OG_IMAGE);
    const file = new URL(`../dist/${outputPath(route.path)}`, import.meta.url);
    await mkdir(new URL('.', file), { recursive: true });
    await writeFile(file, html);
  }
} finally {
  await server.close();
}
