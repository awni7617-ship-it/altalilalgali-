/**
 * Turns the single-file build into an Artifact-ready page.
 *
 * The Artifact host wraps whatever it is given in its own
 * <!doctype><html><head>…</head><body> skeleton, so the page must ship without
 * those tags. This lifts the <title>, the font <link>, the inlined <style> and
 * the body contents out of dist/index.html and writes dist/artifact.html.
 *
 * Usage: node scripts/make-artifact.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const html = await readFile(resolve(dist, 'index.html'), 'utf8')

const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? ''
const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? ''

// The host supplies charset and viewport; the manifest link would 404 on the
// artifact origin. Everything else in <head> is ours to keep.
const keptHead = head
  .replace(/<meta\s+charset[^>]*>/gi, '')
  .replace(/<meta\s+name="viewport"[^>]*>/gi, '')
  .replace(/<link\s+rel="manifest"[^>]*>/gi, '')
  .trim()

const out = `${keptHead}\n${body.trim()}\n`

await writeFile(resolve(dist, 'artifact.html'), out, 'utf8')

const kb = (out.length / 1024).toFixed(0)
console.log(`dist/artifact.html written — ${kb} KB`)

for (const tag of ['<!doctype', '<html', '<head', '<body']) {
  if (out.toLowerCase().includes(tag)) {
    console.error(`Refusing to ship: output still contains ${tag}`)
    process.exit(1)
  }
}
