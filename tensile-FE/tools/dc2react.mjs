#!/usr/bin/env node
/**
 * Converts the design exports (*.dc.html) into React components under src/design/.
 *
 *   node tools/dc2react.mjs <folder-with-unzipped-design-exports> [--force]
 *
 * - Each <x-dc> template becomes JSX; its logic class is kept verbatim (it is a React class component now).
 * - Bindings {{a.b}} read from { ...props, ...renderVals() }, exactly like the design runtime.
 * - <sc-for> -> .map(), <sc-if> -> ternary, <dc-import> -> component, <helmet><style> -> <Name>.css.
 * - Links to "X.dc.html" become app routes (ROUTES below).
 * - Also copies tensile.css to src/styles/ and design assets to public/design-assets/.
 * Existing files are skipped unless --force, so generated files can be edited safely.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'htmlparser2';
import { unzipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'src', 'design');
const STYLES_DIR = path.join(ROOT, 'src', 'styles');
const ASSETS_DIR = path.join(ROOT, 'public', 'design-assets');

export const ROUTES = {
  'Landing.dc.html': '/',
  'Main.dc.html': '/overview',
  'Overview.dc.html': '/overview',
  'Onboarding.dc.html': '/onboarding',
  'Tokenize.dc.html': '/tokenize',
  'LotPassport.dc.html': '/lots',
  'Borrow.dc.html': '/borrow',
  'Lend.dc.html': '/lend',
  'Marketplace.dc.html': '/marketplace',
  'Purchase.dc.html': '/marketplace/buy',
  'RFQ.dc.html': '/marketplace/rfq',
  'Portfolio.dc.html': '/portfolio',
  'Redemption.dc.html': '/redemptions',
  'Dispute.dc.html': '/disputes',
  'ReserveHealth.dc.html': '/reserve',
  'Liquidation.dc.html': '/risk',
  'Operations.dc.html': '/console',
  'Inspector.dc.html': '/inspections',
  'States.dc.html': '/states',
  'Film.dc.html': '/film',
};

// Screens import these live shell components instead of the static design versions.
const IMPORT_OVERRIDES = { TopBar: '../shell/TopBar', Sidebar: '../shell/Sidebar' };

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
// Whitespace text nodes are invalid (React warns) or meaningless inside these.
const NO_WS = new Set([
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select', 'optgroup', 'svg', 'g', 'defs',
  'linearGradient', 'radialGradient', 'clipPath', 'mask', 'pattern', 'symbol', 'marker',
]);
// Whitespace next to these renders nothing (block-level boxes), so it is dropped to keep the JSX readable.
const BLOCK = new Set([
  'div', 'section', 'main', 'header', 'footer', 'nav', 'aside', 'article', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'form', 'fieldset', 'hr', 'pre',
  'blockquote', 'figure', 'dl', 'dt', 'dd', 'details', 'summary', 'dc-import', 'helmet', 'style',
]);
const BOOL_ATTRS = new Set(['disabled', 'readonly', 'checked', 'selected', 'required', 'autofocus', 'multiple', 'hidden', 'open', 'novalidate']);
const ATTR_MAP = {
  class: 'className', for: 'htmlFor', readonly: 'readOnly', tabindex: 'tabIndex', colspan: 'colSpan',
  rowspan: 'rowSpan', maxlength: 'maxLength', minlength: 'minLength', autocomplete: 'autoComplete',
  spellcheck: 'spellCheck', inputmode: 'inputMode', crossorigin: 'crossOrigin', autofocus: 'autoFocus',
  novalidate: 'noValidate', enterkeyhint: 'enterKeyHint', 'xlink:href': 'xlinkHref', 'xml:space': 'xmlSpace',
};

const warnings = [];
const warn = (msg) => warnings.push(msg);
const camel = (s) => s.replace(/[-:]([a-z])/g, (_, c) => c.toUpperCase());

// ------------------------------------------------------------------ routes

function routeFor(target) {
  const [file, hash] = target.split('#');
  let route = ROUTES[file];
  if (!route) {
    route = '/' + file.replace(/\.dc\.html$/, '').toLowerCase();
    warn(`no route for ${file}; using ${route}`);
  }
  return hash ? `${route}#${hash}` : route;
}
const rewriteLinksInCode = (code) =>
  code.replace(/(['"`])([A-Za-z0-9_-]+\.dc\.html(?:#[\w-]*)?)\1/g, (_, q, target) => `${q}${routeFor(target)}${q}`);

// ------------------------------------------------------------------ expressions

class Ctx {
  constructor(parent = null, loopVar = null, indexVar = null) {
    this.parent = parent;
    this.loopVar = loopVar;
    this.indexVar = indexVar;
    this.depth = parent ? parent.depth + (loopVar ? 1 : 0) : 0;
  }
  isLoopVar(name) {
    for (let c = this; c; c = c.parent) if (c.loopVar === name) return true;
    return false;
  }
  index() {
    for (let c = this; c; c = c.parent) if (c.indexVar) return c.indexVar;
    warn('$index used outside <sc-for>');
    return 'undefined';
  }
}

/** "a.b[0].c" -> "$v.a?.b?.[0]?.c" (loop vars and $index resolved from ctx). */
function compilePath(src, ctx) {
  const s = src.trim();
  const m = /^([A-Za-z_$][\w$]*)/.exec(s);
  if (!m) {
    warn(`unsupported binding {{${src}}}`);
    return 'undefined';
  }
  const root = m[1];
  let out = root === '$index' ? ctx.index() : ctx.isLoopVar(root) ? root : `$v.${root}`;
  let i = root.length;
  while (i < s.length) {
    if (s[i] === '.') {
      const pm = /^\.([\w$]+)/.exec(s.slice(i));
      if (!pm) break;
      out += `?.${pm[1]}`;
      i += pm[0].length;
    } else if (s[i] === '[') {
      let depth = 1;
      let j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === '[') depth++;
        else if (s[j] === ']') depth--;
        if (depth > 0) j++;
      }
      const inner = s.slice(i + 1, j).trim();
      const key = /^\d+$/.test(inner) || /^(['"]).*\1$/.test(inner) ? inner : compilePath(inner, ctx);
      out += `?.[${key}]`;
      i = j + 1;
    } else {
      warn(`unsupported binding {{${src}}}`);
      break;
    }
  }
  return out;
}

const BINDING = /\{\{([\s\S]+?)\}\}/g;
const SINGLE = /^\s*\{\{([\s\S]+?)\}\}\s*$/;

/** Attribute/style value -> { kind: 'static', text } | { kind: 'expr', code } */
function compileValue(value, ctx) {
  const single = SINGLE.exec(value);
  if (single) return { kind: 'expr', code: compilePath(single[1], ctx) };
  if (!value.includes('{{')) return { kind: 'static', text: value };
  const parts = value.split(BINDING);
  const tpl = parts
    .map((p, i) => (i % 2 ? '${' + compilePath(p, ctx) + " ?? ''}" : p.replace(/[`\\]/g, '\\$&').replace(/\$\{/g, '\\${')))
    .join('');
  return { kind: 'expr', code: '`' + tpl + '`' };
}

const jsxAttrString = (text) => (/["\\&{}]/.test(text) || /\n/.test(text) ? `{${JSON.stringify(text)}}` : `"${text}"`);
const emitValue = (v) => (v.kind === 'static' ? jsxAttrString(v.text) : `{${v.code}}`);

// ------------------------------------------------------------------ style

function splitDeclarations(style) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < style.length; i++) {
    const ch = style[i];
    if (style.startsWith('{{', i)) {
      const end = style.indexOf('}}', i);
      cur += style.slice(i, end + 2);
      i = end + 1;
      continue;
    }
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((d) => d.trim()).filter(Boolean);
}

function styleKey(prop) {
  if (prop.startsWith('--')) return JSON.stringify(prop);
  if (prop.startsWith('-ms-')) return camel(prop.slice(1));
  if (prop.startsWith('-')) {
    const c = camel(prop.slice(1));
    return c[0].toUpperCase() + c.slice(1);
  }
  return camel(prop);
}

function compileStyle(style, ctx, imports) {
  const decls = splitDeclarations(style);
  if (decls.some((d) => d.replace(BINDING, '').indexOf(':') < 0)) {
    // A binding supplies whole declarations ("...; {{extraStyle}}"): build the string, parse it at runtime.
    imports.css = true;
    const v = compileValue(style, ctx);
    return `{css(${v.kind === 'static' ? JSON.stringify(v.text) : v.code})}`;
  }
  const entries = decls.map((decl) => {
    const idx = decl.indexOf(':');
    if (idx < 0) {
      warn(`bad style declaration "${decl}"`);
      return null;
    }
    const prop = decl.slice(0, idx).trim();
    const v = compileValue(decl.slice(idx + 1).trim(), ctx);
    return `${styleKey(prop)}: ${v.kind === 'static' ? JSON.stringify(v.text) : v.code}`;
  });
  return `{{ ${entries.filter(Boolean).join(', ')} }}`;
}

// ------------------------------------------------------------------ JSX emit

const pad = (n) => '  '.repeat(n);
const isWs = (node) => node.type === 'text' && !node.data.trim();

function attrsOf(el) {
  return Object.entries(el.attribs || {});
}

function emitAttrs(el, ctx, imports) {
  const tag = el.name;
  const attrs = attrsOf(el);
  const has = (n) => attrs.some(([k]) => k.toLowerCase() === n);
  const hasChange = has('oninput') || has('onchange');
  const isField = tag === 'input' || tag === 'textarea' || tag === 'select';
  const out = [];
  for (let [name, value] of attrs) {
    const lower = name.toLowerCase();
    if (lower.startsWith('hint-')) continue;
    if (lower === 'style') {
      out.push(`style=${compileStyle(value, ctx, imports)}`);
      continue;
    }
    let jsxName;
    if (ATTR_MAP[lower]) jsxName = ATTR_MAP[lower];
    else if (/^on[a-z]/i.test(name)) jsxName = 'on' + name[2].toUpperCase() + name.slice(3);
    else if (lower.startsWith('aria-') || lower.startsWith('data-')) jsxName = lower;
    else if (name.includes('-') || name.includes(':')) jsxName = camel(name);
    else jsxName = name;

    if (jsxName === 'onInput' && isField) jsxName = 'onChange';

    if (lower === 'href' && /\.dc\.html(#|$)/.test(value)) value = routeFor(value);
    if (lower === 'src' && /^(\.\/)?assets\//.test(value)) value = value.replace(/^(\.\/)?assets\//, '/design-assets/');

    const bound = value.includes('{{');
    if (!bound && BOOL_ATTRS.has(lower) && (value === '' || value === lower || value === 'true')) {
      if (lower === 'checked' && !hasChange) out.push('defaultChecked');
      else out.push(jsxName);
      continue;
    }
    if (isField && !hasChange && (lower === 'value' || lower === 'checked')) {
      if (!bound) {
        out.push(`${lower === 'value' ? 'defaultValue' : 'defaultChecked'}=${jsxAttrString(value)}`);
        continue;
      }
      if (!has('readonly') && tag !== 'select') out.push('readOnly');
    }
    out.push(`${jsxName}=${emitValue(compileValue(value, ctx))}`);
  }
  return out;
}

function compileText(raw, ctx, { first, last, keepWs }) {
  let text = keepWs ? raw : raw.replace(/\s+/g, ' ');
  if (!keepWs) {
    if (first) text = text.replace(/^ /, '');
    if (last) text = text.replace(/ $/, '');
  }
  if (!text) return [];
  const parts = text.split(BINDING);
  const out = [];
  parts.forEach((p, i) => {
    // The design runtime renders each text binding inside <span class="sc-interp">; some design CSS relies on it.
    if (i % 2) out.push(`<span className="sc-interp">{${compilePath(p, ctx)}}</span>`);
    else if (p) out.push(/^[^{}<>&"'`\s][^{}<>&]*[^{}<>&\s]$|^[^{}<>&\s]$/.test(p) ? p : `{${JSON.stringify(p)}}`);
  });
  return out;
}

function emitChildren(nodes, ctx, depth, parentTag, imports) {
  const kids = nodes.filter((n) => n.type !== 'comment' && n.type !== 'directive');
  const lines = [];
  kids.forEach((node, idx) => {
    const first = idx === 0;
    const last = idx === kids.length - 1;
    if (node.type === 'text') {
      if (isWs(node)) {
        const prev = kids[idx - 1];
        const next = kids[idx + 1];
        const nextToBlock = [prev, next].some((n) => n && n.type === 'tag' && BLOCK.has(n.name));
        const afterWs = prev && prev.type === 'text' && isWs(prev);
        if (first || last || afterWs || nextToBlock || NO_WS.has(parentTag) || parentTag === 'fragment' || parentTag === 'pre') return;
        lines.push(pad(depth) + '{" "}');
        return;
      }
      for (const piece of compileText(node.data, ctx, { first, last, keepWs: parentTag === 'pre' })) lines.push(pad(depth) + piece);
      return;
    }
    if (node.type === 'tag' || node.type === 'script' || node.type === 'style') {
      const out = emitNode(node, ctx, depth, parentTag, imports);
      if (out) lines.push(out);
    }
  });
  return lines;
}

function emitNode(el, ctx, depth, parentTag, imports) {
  const tag = el.name;
  if (tag === 'sc-for') {
    const listAttr = el.attribs.list || '';
    const as = el.attribs.as || 'item';
    const listExpr = compileValue(listAttr, ctx);
    const list = listExpr.kind === 'expr' ? listExpr.code : '[]';
    const idx = `$i${ctx.depth}`;
    const inner = new Ctx(ctx, as, idx);
    imports.fragment = true;
    const body = emitChildren(el.children, inner, depth + 2, parentTag, imports);
    return [
      `${pad(depth)}{(${list} ?? []).map((${as}, ${idx}) => (`,
      `${pad(depth + 1)}<Fragment key={${idx}}>`,
      ...body,
      `${pad(depth + 1)}</Fragment>`,
      `${pad(depth)}))}`,
    ].join('\n');
  }
  if (tag === 'sc-if') {
    const cond = compileValue(el.attribs.value || '', ctx);
    const test = cond.kind === 'expr' ? cond.code : JSON.stringify(cond.text);
    const body = emitChildren(el.children, ctx, depth + 2, parentTag, imports);
    if (!body.length) return null;
    return [`${pad(depth)}{${test} ? (`, `${pad(depth + 1)}<>`, ...body, `${pad(depth + 1)}</>`, `${pad(depth)}) : null}`].join('\n');
  }
  if (tag === 'dc-import') {
    const name = el.attribs.name;
    imports.components.add(name);
    const props = [];
    for (const [k, v] of attrsOf(el)) {
      if (k === 'name' || k.startsWith('hint-') || k === 'style') continue;
      props.push(`${k.includes('-') ? camel(k) : k}=${emitValue(compileValue(v, ctx))}`);
    }
    return `${pad(depth)}<${name}${props.length ? ' ' + props.join(' ') : ''} />`;
  }
  if (tag === 'helmet' || tag === 'link' || tag === 'meta') return null;

  const attrs = emitAttrs(el, ctx, imports);
  const open = `<${tag}${attrs.length ? ' ' + attrs.join(' ') : ''}`;
  if (VOID.has(tag)) return `${pad(depth)}${open} />`;

  if (tag === 'textarea') {
    const text = el.children.map((c) => c.data || '').join('');
    const val = text ? ` defaultValue=${jsxAttrString(text.replace(/^\n/, ''))}` : '';
    return `${pad(depth)}${open}${val} />`;
  }
  const body = emitChildren(el.children, ctx, depth + 1, tag, imports);
  if (!body.length) return `${pad(depth)}${open} />`;
  return [`${pad(depth)}${open}>`, ...body, `${pad(depth)}</${tag}>`].join('\n');
}

// ------------------------------------------------------------------ files

function extractTemplate(html) {
  const start = /<x-dc(?:\s[^>]*)?>/.exec(html);
  const end = html.lastIndexOf('</x-dc>');
  if (!start || end < start.index) return null;
  return html.slice(start.index + start[0].length, end);
}

function extractScript(html) {
  const m = /<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  return m ? m[1].trim() : 'class Component extends DCLogic {}';
}

function collectStyles(nodes, acc = []) {
  for (const n of nodes) {
    if (n.type === 'style' || (n.type === 'tag' && n.name === 'style')) acc.push(n.children.map((c) => c.data).join(''));
    else if (n.children) collectStyles(n.children, acc);
  }
  return acc;
}

function convert(name, html) {
  const template = extractTemplate(html);
  if (template == null) throw new Error(`${name}: no <x-dc> block`);
  const doc = parseDocument(template, { lowerCaseTags: false, lowerCaseAttributeNames: false, recognizeSelfClosing: true, decodeEntities: true });
  const helmets = doc.children.filter((n) => n.type === 'tag' && n.name === 'helmet');
  const css = collectStyles(helmets).join('\n').trim();
  const roots = doc.children.filter((n) => !(n.type === 'tag' && n.name === 'helmet'));

  const imports = { fragment: false, css: false, components: new Set() };
  const body = emitChildren(roots, new Ctx(), 3, 'fragment', imports);
  const jsx = body.length === 1 ? body[0] : [`${pad(3)}<>`, ...body.map((l) => '  ' + l.replace(/\n/g, '\n  ')), `${pad(3)}</>`].join('\n');

  const logic = rewriteLinksInCode(extractScript(html)).replace(/class\s+Component\s+extends\s+DCLogic/, `class ${name}Logic extends DCLogic`);
  const importLines = [
    `import ${imports.fragment ? '{ Fragment }' : 'React'} from 'react';`,
    `import { ${imports.css ? 'DCLogic, css' : 'DCLogic'} } from './runtime';`,
    ...[...imports.components].sort().map((c) => `import ${c} from '${IMPORT_OVERRIDES[c] ?? './' + c}';`),
    ...(css ? [`import './${name}.css';`] : []),
  ];
  const tsx = `// @ts-nocheck
/* Generated from ${name}.dc.html by tools/dc2react.mjs. The app owns this file now: edit freely. */
${importLines.join('\n')}

${logic}

export default class ${name} extends ${name}Logic {
  render() {
    const $v = { ...this.props, ...this.renderVals() };
    return (
${jsx}
    );
  }
}
`;
  return { tsx, css };
}

const RUNTIME = `/* Base class for components converted from the design exports (tools/dc2react.mjs). */
import { Component } from 'react';

export class DCLogic<P = Record<string, any>, S = any> extends Component<P & Record<string, any>, S> {
  state: any = {};

  /** Values the template binds to, merged over props: { ...props, ...renderVals() }. */
  renderVals(): Record<string, any> {
    return {};
  }
}

/** "a: b; --c: d" -> React style object (for style attributes bound to a whole CSS string). */
export function css(text?: string | null): Record<string, string> | undefined {
  if (!text) return undefined;
  const out: Record<string, string> = {};
  for (const decl of text.split(/;(?![^(]*[)])/)) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim();
    const key = prop.startsWith('--')
      ? prop
      : prop.replace(/^-ms-/, 'ms-').replace(/^-(webkit|moz)-/, (_m, v) => v[0].toUpperCase() + v.slice(1) + '-').replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    out[key] = decl.slice(i + 1).trim();
  }
  return out;
}
`;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) walk(p, acc);
    } else acc.push(p);
  }
  return acc;
}

// Only these files matter; everything else in an export (support.js, vendor/, README) is the design tool's runtime.
const WANTED = (p) => p.endsWith('.dc.html') || path.posix.basename(p) === 'tensile.css' || path.posix.basename(path.posix.dirname(p)) === 'assets';

/** Design files from plain folders and from inside any .zip, as { path, data } (paths use "/"). */
function collect(src) {
  const files = fs.statSync(src).isDirectory() ? walk(src).sort() : [src];
  const out = [];
  for (const file of files) {
    const rel = path.relative(path.dirname(src), file).split(path.sep).join('/');
    if (file.toLowerCase().endsWith('.zip')) {
      const entries = unzipSync(fs.readFileSync(file), { filter: (f) => !f.name.startsWith('__MACOSX/') && WANTED(f.name) });
      for (const name of Object.keys(entries).sort()) {
        if (!name.endsWith('/')) out.push({ path: `${rel}/${name}`, data: Buffer.from(entries[name]) });
      }
    } else if (WANTED(rel)) {
      out.push({ path: rel, data: fs.readFileSync(file) });
    }
  }
  return out;
}


function writeIfNew(file, content, force, stats) {
  if (fs.existsSync(file) && !force) {
    stats.skipped.push(path.relative(ROOT, file));
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  stats.written.push(path.relative(ROOT, file));
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const src = args.find((a) => !a.startsWith('--'));
  if (!src || !fs.existsSync(src)) {
    console.error('usage: node tools/dc2react.mjs <folder-of-design-zips | design-zip | unzipped-exports> [--force]');
    process.exit(1);
  }
  const files = collect(path.resolve(src));
  const stats = { written: [], skipped: [] };

  const seen = new Map();
  for (const file of files.filter((f) => f.path.endsWith('.dc.html'))) {
    const name = path.posix.basename(file.path, '.dc.html');
    const html = file.data.toString('utf8');
    if (seen.has(name)) {
      if (seen.get(name) !== html) warn(`${name}.dc.html differs between exports; using the first one`);
      continue;
    }
    seen.set(name, html);
  }
  for (const [name, html] of seen) {
    const { tsx, css } = convert(name, html);
    writeIfNew(path.join(OUT_DIR, `${name}.tsx`), tsx, force, stats);
    if (css) writeIfNew(path.join(OUT_DIR, `${name}.css`), css + '\n', force, stats);
  }
  writeIfNew(path.join(OUT_DIR, 'runtime.ts'), RUNTIME, force, stats);

  const tensileCss = files.find((f) => path.posix.basename(f.path) === 'tensile.css');
  if (tensileCss) writeIfNew(path.join(STYLES_DIR, 'tensile.css'), tensileCss.data, force, stats);
  else warn('tensile.css not found');

  const assets = new Map();
  for (const f of files) if (path.posix.basename(path.posix.dirname(f.path)) === 'assets') assets.set(path.posix.basename(f.path), f.data);
  for (const [base, data] of assets) writeIfNew(path.join(ASSETS_DIR, base), data, force, stats);

  if (!seen.size) {
    console.error(`No *.dc.html design files found in ${src}. Point it at the folder holding the design zips.`);
    process.exit(1);
  }

  console.log(`components: ${[...seen.keys()].join(', ')}`);
  console.log(`written ${stats.written.length} files, skipped ${stats.skipped.length} existing (use --force to overwrite)`);
  for (const w of [...new Set(warnings)]) console.warn('warning:', w);
}

main();