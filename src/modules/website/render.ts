import { esc, rgbOf, safeColor } from './logic'
import { TEMPLATES } from './templates'
import { FONT_INFO, type SiteData, type WebsiteSettingsDraft } from './types'

/** Winzige Fotoansicht ohne Bibliothek: Klick auf ein Bild öffnet es groß, Klick/Esc schließt. */
const LIGHTBOX_JS = `
(function(){
  var imgs=[].slice.call(document.querySelectorAll('img[data-lb]'));
  if(!imgs.length)return;
  var box=document.createElement('div');box.className='lb';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
  var big=document.createElement('img');var cap=document.createElement('div');cap.className='lb-cap';
  box.appendChild(big);box.appendChild(cap);document.body.appendChild(box);
  var i=0;
  function show(n){i=(n+imgs.length)%imgs.length;big.src=imgs[i].src;big.alt=imgs[i].alt;cap.textContent=imgs[i].alt;box.classList.add('open');}
  function hide(){box.classList.remove('open');big.removeAttribute('src');}
  imgs.forEach(function(el,n){el.addEventListener('click',function(){show(n);});});
  box.addEventListener('click',function(e){var x=e.clientX/window.innerWidth;if(e.target===big&&imgs.length>1){show(i+(x>0.5?1:-1));}else{hide();}});
  document.addEventListener('keydown',function(e){if(!box.classList.contains('open'))return;if(e.key==='Escape')hide();if(e.key==='ArrowRight')show(i+1);if(e.key==='ArrowLeft')show(i-1);});
})();`

const BASE_CSS = `
:root { --accent: VAR_ACCENT; --accent-rgb: VAR_RGB; }
body { font-family: VAR_FONT; --bs-body-font-family: VAR_FONT; --bs-link-color: var(--accent); --bs-link-color-rgb: var(--accent-rgb); --bs-link-hover-color: var(--accent); }
img { max-width: 100%; }
.lb { position: fixed; inset: 0; background: rgba(0,0,0,.94); display: none; align-items: center; justify-content: center; z-index: 2000; cursor: zoom-out; }
.lb.open { display: flex; }
.lb img { max-width: 100%; max-height: calc(100% - 3rem); object-fit: contain; cursor: pointer; }
.lb-cap { position: absolute; bottom: 1rem; left: 0; right: 0; text-align: center; color: #fff; font-size: .9rem; padding: 0 1rem; }
.route { margin: 1rem 0 2rem; }
.route-head { margin-bottom: .5rem; }
.route-dot { display: inline-block; width: .8rem; height: .8rem; border-radius: 50%; margin-right: .4rem; vertical-align: -.05rem; }
.route-track { background: var(--bs-tertiary-bg); border-radius: .5rem; }
.route svg { display: block; width: 100%; height: auto; }
.route-profile { margin-top: .5rem; color: var(--bs-body-color); }
.section-title { color: var(--accent); }
.stay-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: .75rem; }
.stay { display: flex; gap: .75rem; padding: .75rem 1rem; border: 1px solid var(--bs-border-color); border-radius: .75rem; background: var(--bs-body-bg); }
.stay-emoji, .act-emoji { font-size: 1.5rem; line-height: 1.2; }
.stay-type { font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--accent); font-weight: 600; }
.stay-name { font-weight: 600; }
.act-list { list-style: none; padding: 0; margin: 0; }
.act-list li { display: flex; gap: .75rem; padding: .6rem 0; border-bottom: 1px solid var(--bs-border-color); }
.act-list li:last-child { border-bottom: 0; }
@media print { .lb { display: none !important; } }
`

/**
 * Setzt die komplette Webseite als eine HTML-Datei zusammen.
 * `bootstrapCss` wird eingebettet, damit die Seite ohne Internet und ohne weitere Dateien funktioniert.
 * `fontCss` enthält die @font-face-Regeln einer mitgelieferten Schrift (siehe fonts.ts).
 */
export function renderSite(site: SiteData, settings: WebsiteSettingsDraft, bootstrapCss: string, fontCss = ''): string {
  const tpl = TEMPLATES[settings.template] ?? TEMPLATES.klassisch
  const accent = safeColor(settings.accent)
  const font = FONT_INFO[settings.font]?.css ?? FONT_INFO.modern.css
  const css = BASE_CSS.replace(/VAR_ACCENT/g, accent).replace(/VAR_RGB/g, rgbOf(accent)).replace(/VAR_FONT/g, font)
  const description = site.subtitle || site.destination

  return `<!doctype html>
<html lang="de" data-bs-theme="${settings.dark ? 'dark' : 'light'}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(site.title)}">
<meta property="og:description" content="${esc(description)}">
<meta name="generator" content="Nix wie weg">
<style>${bootstrapCss}</style>
<style>${fontCss}${css}${tpl.css}</style>
</head>
<body>
${tpl.body({ site, settings })}
<script>${LIGHTBOX_JS}</script>
</body>
</html>
`
}
