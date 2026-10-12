/* Base class for components converted from the design exports (tools/dc2react.mjs). */
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
