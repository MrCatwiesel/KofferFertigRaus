export function collectTokens(paths: string[], exts?: RegExp): Set<string>
export function makeKeep(tokens: Set<string>, safelist?: RegExp[]): (selector: string) => boolean
export function purgeCss(
  css: string,
  tokens: Set<string>,
  safelist?: RegExp[]
): { css: string; stats: { total: number; removed: number; before: number; after: number } }
export function purgeCssPostcss(opts: { content: string[]; safelist?: RegExp[]; files?: RegExp }): { postcssPlugin: string; OnceExit(root: unknown): void }
