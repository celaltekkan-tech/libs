// Ortak sayfa iskeleti: head (SEO + Open Graph + JSON-LD), header, footer.
import { SITE } from './site.mjs'
import { TOOLS } from './tools.mjs'

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const LOGIN_ICON =
  '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M7.5 3.75H5A1.25 1.25 0 0 0 3.75 5v10A1.25 1.25 0 0 0 5 16.25h2.5M13.125 6.875 16.25 10l-3.125 3.125M16.25 10H8.125" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'

export const loginButton = (cls = 'btn btn-login', text = 'Giriş Yap') =>
  `<a class="${cls}" href="${SITE.appUrl}"><span>${text}</span>${LOGIN_ICON}</a>`

export const ldJson = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`

export function breadcrumbLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE.url + it.path,
    })),
  }
}

export function breadcrumbNav(items) {
  return `<nav class="crumbs" aria-label="Sayfa yolu"><ol>${items
    .map((it, i) =>
      i === items.length - 1
        ? `<li aria-current="page">${esc(it.name)}</li>`
        : `<li><a href="${it.path}">${esc(it.name)}</a></li>`,
    )
    .join('')}</ol></nav>`
}

function header(active) {
  const link = (href, label) =>
    `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`
  return `<header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/">
        <img src="/assets/logo.png" alt="OIDS logosu" width="30" height="30" />
        <span>Okul İdare Sistemi</span>
      </a>
      <nav class="main-nav" aria-label="Ana menü">
        ${link('/moduller', 'Modüller')}
        ${link('/mobil-uygulama', 'Mobil Uygulama')}
        ${link('/araclar', 'Hesaplayıcılar')}
        ${link('/#planlar', 'Planlar')}
        ${link('/rehber', 'Rehber')}
        ${link('/#iletisim', 'İletişim')}
      </nav>
      <div class="header-cta">
        ${loginButton()}
        <a class="btn btn-primary" href="/#iletisim">Demo İsteyin</a>
      </div>
      <button class="nav-toggle" type="button" aria-label="Menüyü aç" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`
}

function footer(groups) {
  const cols = groups
    .map(
      (g) => `<div class="footer-col">
          <p class="footer-title">${esc(g.title)}</p>
          <ul>${g.modules.map((m) => `<li><a href="/moduller/${m.slug}">${esc(m.short || m.name)}</a></li>`).join('')}</ul>
        </div>`,
    )
    .join('')
  return `<footer class="site-footer">
    <div class="wrap">
      <div class="footer-grid">
        <div class="footer-col footer-about">
          <a class="brand" href="/">
            <img src="/assets/logo.png" alt="" width="26" height="26" />
            <span>Okul İdare Sistemi</span>
          </a>
          <p>İlkokul, ortaokul ve liseler için web ve mobil okul idare yazılımı. Ders programından disipline, nöbetten ek ders puantajına okul idaresinin tüm işleri tek panelde.</p>
          <p><a href="mailto:${SITE.email}">${SITE.email}</a></p>
        </div>
        ${cols}
        <div class="footer-col">
          <p class="footer-title">Ücretsiz araçlar</p>
          <ul>${TOOLS.map((t) => `<li><a href="/araclar/${t.slug}">${esc(t.short)}</a></li>`).join('')}</ul>
        </div>
        <div class="footer-col">
          <p class="footer-title">OIDS</p>
          <ul>
            <li><a href="/moduller">Tüm modüller</a></li>
            <li><a href="/mobil-uygulama">Mobil uygulama</a></li>
            <li><a href="/rehber">Rehberler</a></li>
            <li><a href="/#planlar">Planlar</a></li>
            <li><a href="/#sss">Sıkça sorulan sorular</a></li>
            <li><a href="${SITE.appUrl}">Panele giriş</a></li>
            <li><a href="/gizlilik">Gizlilik politikası</a></li>
            <li><a href="/hesap-silme">Hesap silme</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; <span id="year">${new Date().getFullYear()}</span> Okul İdare Sistemi (OIDS). Tüm hakları saklıdır.</p>
      </div>
    </div>
  </footer>`
}

/**
 * @param {object} p
 * @param {string} p.path      kanonik yol, örn. "/moduller/disiplin"
 * @param {string} p.title     <title>
 * @param {string} p.description meta description (~150-160 karakter)
 * @param {string} p.body      <main> içeriği
 * @param {object[]} [p.ld]    JSON-LD nesneleri
 * @param {boolean} [p.noindex]
 */
export function page({ path, title, description, body, ld = [], noindex = false, active, groups, scripts = [] }) {
  const canonical = SITE.url + (path === '/' ? '/' : path)
  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  ${noindex ? '<meta name="robots" content="noindex, follow" />' : `<link rel="canonical" href="${canonical}" />`}
  <meta name="theme-color" content="#7e14ff" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="tr_TR" />
  <meta property="og:site_name" content="${esc(SITE.name)}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE.url}/assets/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/assets/favicon.ico" sizes="any" />
  <link rel="icon" type="image/png" href="/assets/logo.png" />
  <link rel="apple-touch-icon" href="/assets/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/styles.css?v=${SITE.buildId}" />
  ${ld.map(ldJson).join('\n  ')}
</head>
<body>
  ${header(active)}
  <main id="top">
${body}
  </main>
  ${footer(groups)}
  <script src="/script.js?v=${SITE.buildId}" defer></script>${scripts.map((s) => `
  <script src="${s}?v=${SITE.buildId}" defer></script>`).join("")}
</body>
</html>
`
}
