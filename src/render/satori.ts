import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import satori, { type Font } from 'satori';

const require = createRequire(import.meta.url);

function fontFile(pkg: string, file: string): Buffer {
  return readFileSync(require.resolve(`${pkg}/files/${file}`));
}

let fonts: Font[] | null = null;

function loadFonts(): Font[] {
  fonts ??= [
    { name: 'Bebas Neue', data: fontFile('@fontsource/bebas-neue', 'bebas-neue-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Plex Mono', data: fontFile('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Plex Mono', data: fontFile('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-600-normal.woff'), weight: 600, style: 'normal' },
    { name: 'Plex Sans', data: fontFile('@fontsource/ibm-plex-sans-condensed', 'ibm-plex-sans-condensed-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Plex Sans', data: fontFile('@fontsource/ibm-plex-sans-condensed', 'ibm-plex-sans-condensed-latin-600-normal.woff'), weight: 600, style: 'normal' },
  ];
  return fonts;
}

/** Nodo minimale compatibile con Satori (equivalente a un elemento React). */
export interface Node {
  type: string;
  props: Record<string, unknown> & { children?: Child | Child[] };
}
export type Child = Node | string | number | null | undefined | false;
export type Style = Record<string, string | number>;

/** Crea un `div` flex: Satori richiede display flex sui contenitori con più figli. */
export function div(style: Style, ...children: Child[]): Node {
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: clean(children) } };
}

export function svg(attrs: Record<string, unknown>, ...children: Child[]): Node {
  return { type: 'svg', props: { ...attrs, children: clean(children) } };
}

export function el(type: string, attrs: Record<string, unknown>): Node {
  return { type, props: attrs };
}

function clean(children: Child[]): Child[] {
  return children.filter((c) => c !== null && c !== undefined && c !== false);
}

/** Renderizza un albero in PNG. `scale` 2 dà un'immagine nitida sugli schermi ad alta densità. */
export async function renderPng(node: Node, width: number, scale = 2): Promise<Buffer> {
  // Satori accetta qualsiasi oggetto con forma da elemento React.
  const svgText = await satori(node as unknown as Parameters<typeof satori>[0], {
    width,
    fonts: loadFonts(),
  });
  const png = new Resvg(svgText, { fitTo: { mode: 'width', value: width * scale } }).render().asPng();
  return Buffer.from(png);
}
