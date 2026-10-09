// Statik siteyi üretir: node src/build.mjs  →  public/
// Çıktılar (public/*.html, sitemap.xml, robots.txt) repoya commit edilir; Docker yalnızca public/ kopyalar.
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FAQ, GROUPS, MOBILE, MODULES } from './content.mjs'
import { SITE } from './site.mjs'
import { breadcrumbLd, breadcrumbNav, esc, loginButton, page } from './layout.mjs'

const SRC = dirname(fileURLToPath(import.meta.url))
const OUT = join(SRC, '..', 'public')
const TODAY = new Date().toISOString().slice(0, 10)

// Önbellek kırıcı: içerik değişmedikçe aynı kalır (her build'de gereksiz diff olmasın).
SITE.buildId = createHash('sha1')
  .update(readFileSync(join(OUT, 'styles.css')))
  .update(readFileSync(join(OUT, 'script.js')))
  .digest('hex')
  .slice(0, 8)

const groups = GROUPS.map((g) => ({ ...g, modules: MODULES.filter((m) => m.group === g.key) }))
const bySlug = Object.fromEntries(MODULES.map((m) => [m.slug, m]))
const common = { groups }

const pages = [] // { path, file, html, priority, sitemap }
const add = (p) => pages.push(p)

const relatedLink = (slug) => {
  if (slug === 'mobil-uygulama') return { href: '/mobil-uygulama', name: 'Öğretmen Mobil Uygulaması', icon: '📱' }
  const m = bySlug[slug]
  if (!m) throw new Error(`Bilinmeyen ilgili modül: ${slug}`)
  return { href: `/moduller/${m.slug}`, name: m.name, icon: m.icon }
}

const faqLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: items.map(([q, a]) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
})

const faqBlock = (items, id = 'sss') => `
    <section id="${id}" class="section">
      <div class="wrap narrow">
        <div class="section-head">
          <p class="eyebrow">Sıkça sorulan sorular</p>
          <h2>Merak edilenler</h2>
        </div>
        <div class="faq">
          ${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n          ')}
        </div>
      </div>
    </section>`

const ctaBlock = (title = 'Okulunuz için birlikte bakalım', text = 'Kısa bir demo ile modülleri birlikte inceleyelim, okulunuzun ihtiyacına uygun planı belirleyelim.') => `
    <section id="iletisim" class="section section-cta">
      <div class="wrap cta-inner">
        <div>
          <h2>${esc(title)}</h2>
          <p>${esc(text)}</p>
        </div>
        <div class="cta-actions">
          <a class="btn btn-primary btn-lg btn-on-dark" href="mailto:${SITE.email}?subject=OIDS%20demo%20talebi">${SITE.email}</a>
          ${loginButton('btn btn-ghost-light btn-lg', 'Panele Giriş Yap')}
        </div>
      </div>
    </section>`

const phoneMock = () => `
          <div class="phone" aria-hidden="true">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              <div class="ph-top"><span>Öğrenci Ara</span><span class="ph-bell">🔔<i>2</i></span></div>
              <div class="ph-search">1 2 4 7</div>
              <div class="ph-student">
                <div class="ph-avatar">EK</div>
                <div><strong>Elif K.</strong><span>10-B · No 1247</span></div>
              </div>
              <p class="ph-label">Sebep seçin</p>
              <div class="ph-tags"><span class="on">Derse geç kalma</span><span>Ödev</span><span class="on">Araç gereç</span><span>Kıyafet</span></div>
              <div class="ph-note">Not ekleyin…</div>
              <div class="ph-btn">Bildirimi Gönder</div>
            </div>
          </div>`

// ───────────────────────────── Anasayfa
const SPOTLIGHTS = [
  {
    slug: 'otomatik-ders-programi',
    eyebrow: 'Programlar',
    title: 'Ders programı dakikalar içinde, çakışmasız',
    text: 'Google OR-Tools tabanlı optimizasyon motoru 13 farklı kısıt türünü birlikte çözer. “Matematik dersleri ilk saatlere gelmesin” gibi kuralları Türkçe yazın, yapay zekâ kısıta çevirsin. Bitince e-Okul’a eklentiyle aktarın.',
    points: ['Bilsan ve e-Okul PDF’lerinden içe aktarma', 'Şube, öğretmen, derslik ve çarşaf Excel çıktıları', 'Sürükle-bırak ince ayar'],
    visual: `<div class="mini-grid" aria-hidden="true">
            <div class="mg-h"></div><div class="mg-h">Pzt</div><div class="mg-h">Sal</div><div class="mg-h">Çar</div><div class="mg-h">Per</div><div class="mg-h">Cum</div>
            <div class="mg-t">1</div><div class="c1">MAT</div><div class="c2">TDE</div><div class="c3">FİZ</div><div class="c1">MAT</div><div class="c4">İNG</div>
            <div class="mg-t">2</div><div class="c1">MAT</div><div class="c2">TDE</div><div class="c5">KİM</div><div class="c6">TAR</div><div class="c4">İNG</div>
            <div class="mg-t">3</div><div class="c4">İNG</div><div class="c6">TAR</div><div class="c1">MAT</div><div class="c2">TDE</div><div class="c3">FİZ</div>
            <div class="mg-t">4</div><div class="c5">KİM</div><div class="c3">FİZ</div><div class="c2">TDE</div><div class="c7">BİY</div><div class="c6">COĞ</div>
            <div class="mg-t">5</div><div class="c7">BİY</div><div class="c1">MAT</div><div class="c4">İNG</div><div class="c5">KİM</div><div class="c8">BED</div>
            <div class="mg-t">6</div><div class="c8">BED</div><div class="c7">BİY</div><div class="c6">COĞ</div><div class="c3">FİZ</div><div class="c8">BED</div>
          </div>
          <div class="ai-bubble" aria-hidden="true"><span>✨</span>“Ahmet Bey çarşamba ilk iki saat boş olsun”<em>→ Zorunlu kısıt eklendi</em></div>`,
  },
  {
    slug: 'maas-degisikligi-bildirim-formu',
    eyebrow: 'Personel İşleri',
    title: 'Maaş değişikliği formu ay boyunca kendini doldursun',
    text: 'Bir öğretmen ayrıldığında, terfi aldığında ya da raporu yıllık 7 günü aştığında OIDS bunu ilgili ayın Maaş Değişikliği Bildirim Formu’na kendisi yazar. Ay sonunda resmî şablonda Excel veya PDF alırsınız.',
    points: ['Rapor günlerinde 7 gün kuralı otomatik', 'Terfi formları resmî şablondan', 'Görevlendirme, başlama, ayrılış yazıları Word olarak'],
    visual: `<div class="flow" aria-hidden="true">
            <div class="flow-src"><span>🩺 Rapor &gt; 7 gün</span><span>📈 Kademe terfisi</span><span>🚪 Personel ayrılışı</span></div>
            <div class="flow-arrow">→</div>
            <div class="flow-doc"><strong>Maaş Değişikliği Bildirim Formu</strong><i>A</i><i>B</i><i>C</i><i>D</i><em>Excel · PDF</em></div>
          </div>`,
  },
  {
    slug: 'disiplin',
    eyebrow: 'Öğrenci İşleri',
    title: 'Disiplin süreci olaydan tebliğe kadar tek dosyada',
    text: 'Öğretmen sınıfta telefonundan bildirimi gönderir, idare Disiplin ekranında görür. Olay açılır, ifadeler alınır, kurul toplanır; tutanaktan tebliğ yazısına kadar tüm belgeler Word olarak hazır çıkar.',
    points: ['Olay, ifade, bilgi isteme, kurul çağrısı, karar ve tebliğ belgeleri', 'Aynı sebebin tekrarında uyarı', 'Mevzuat madde kütüphanesi ve davranış puanı'],
    visual: `<ol class="timeline" aria-hidden="true">
            <li><b>📱</b>Öğretmen bildirimi</li><li><b>📂</b>Olay kaydı</li><li><b>🗣️</b>İfade tutanakları</li><li><b>👥</b>Kurul toplantısı</li><li><b>📄</b>Karar ve tebliğ (.docx)</li>
          </ol>`,
  },
  {
    slug: 'sinav-programi',
    eyebrow: 'Programlar',
    title: 'Ortak sınav, sorumluluk sınavı ve kelebek sistemi',
    text: 'MEBBİS’ten aldığınız sorumlu ders listesini yükleyin; sınav takvimi, komisyon ve gözetmen önerisi otomatik çıksın. Kelebek oturma planını salonlara tek tıkla dağıtın.',
    points: ['Aynı gün iki sınav uyarısı', 'Her 30 öğrenciye 1 gözetmen önerisi', 'Excel, PDF ve JPEG çıktı'],
    visual: `<div class="seats" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<span class="s${(i * 7) % 4}"></span>`).join('')}</div>
          <p class="seats-legend" aria-hidden="true"><i class="s0"></i>9-A <i class="s1"></i>10-C <i class="s2"></i>11-B <i class="s3"></i>12-D</p>`,
  },
]

const INTEGRATIONS = [
  ['e-Okul', 'Öğrenci ve fotoğraflı liste Excel’i, şube programı PDF’i; sınıf listesi ve ders programı eklentiyle'],
  ['MEBBİS', 'Personel listesi ve sorumlu ders listesi Excel’i'],
  ['Bilsan', 'Öğretmen ders programı PDF’leri'],
  ['MEB çizelgeleri', 'Haftalık ders çizelgelerinden hazır ders havuzları'],
  ['KBS', 'Ek ders puantajında 101–123 kodları'],
  ['İŞKUR', 'TYP puantajı EK-2 formu'],
  ['Word / Excel / PDF', 'Resmî şablonlarda belge ve liste çıktıları'],
  ['Google Drive', 'Şifreli yedek kopyası'],
]

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'OIDS — Okul İdare Sistemi',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Okul yönetim yazılımı',
  operatingSystem: 'Web, Android',
  inLanguage: 'tr',
  url: SITE.url + '/',
  description:
    'Okul idaresi için web ve mobil yazılım: otomatik ders programı, nöbet, sınav ve kelebek sistemi, disiplin, devamsızlık, ek ders puantajı, terfi ve maaş bildirimi, veli SMS.',
  featureList: MODULES.map((m) => m.name),
  publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url + '/' },
}

const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE.name,
  alternateName: ['OIDS', 'Okul İdare Sistemi'],
  url: SITE.url + '/',
  logo: SITE.url + '/assets/logo.png',
  email: SITE.email,
  contactPoint: { '@type': 'ContactPoint', email: SITE.email, contactType: 'sales', availableLanguage: 'Turkish' },
}

const websiteLd = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url + '/', inLanguage: 'tr' }

const moduleCount = MODULES.length

add({
  path: '/',
  file: 'index.html',
  priority: '1.0',
  html: page({
    ...common,
    path: '/',
    title: 'OIDS Okul İdare Sistemi — Ders Programı, Nöbet, Sınav ve Disiplin Yazılımı',
    description:
      'Okul idaresinin tüm işleri tek panelde: otomatik ders programı, nöbet, kelebek sınav sistemi, disiplin, devamsızlık, ek ders, terfi ve veli SMS. Web ve mobil.',
    ld: [orgLd, websiteLd, softwareLd, faqLd(FAQ)],
    body: `
    <section class="hero">
      <div class="wrap hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">Okullar için idari yönetim platformu</p>
          <h1>Okulunuzun tüm idari işlerini <span>tek panelden</span> yönetin</h1>
          <p class="lead">
            Ders programından nöbete, ortak sınavdan kelebek sistemine, disiplinden
            ek ders puantajına, terfiden maaş bildirim formuna kadar okul idaresinin
            her işi; e-Okul ve MEBBİS verilerinizle, web ve mobilde tek sistemde.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#iletisim">Okulunuz İçin Demo İsteyin</a>
            <a class="btn btn-outline btn-lg" href="/moduller">Modülleri İnceleyin</a>
          </div>
          <ul class="hero-stats">
            <li><strong>${moduleCount}</strong><span>modül</span></li>
            <li><strong>13</strong><span>ders programı kısıtı</span></li>
            <li><strong>Web + Android</strong><span>erişim</span></li>
            <li><strong>e-Okul · MEBBİS</strong><span>veri aktarımı</span></li>
          </ul>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="hero-glow"></div>
          <div class="app-window">
            <div class="aw-bar"><i></i><i></i><i></i><span>uyg.oids.com.tr</span></div>
            <div class="aw-body">
              <nav class="aw-side">
                <b class="on">🏠 Ana Sayfa</b>
                <em>Personel</em><b>🛎️ Nöbet</b><b>💰 Ek Ders</b><b>📈 Terfi</b>
                <em>Programlar</em><b>🤖 Ders Prog.</b><b>🦋 Kelebek</b>
                <em>Öğrenci</em><b>⚖️ Disiplin</b><b>📣 Veli SMS</b>
              </nav>
              <div class="aw-main">
                <div class="aw-stats">
                  <div><span>Öğretmen</span><strong>64</strong></div>
                  <div><span>Öğrenci</span><strong>812</strong></div>
                  <div><span>Bugün nöbetçi</span><strong>6</strong></div>
                </div>
                <div class="aw-panel">
                  <p class="aw-title">Bugün · 10-B</p>
                  <div class="aw-day">
                    <span class="c1">MAT</span><span class="c1">MAT</span><span class="c2">TDE</span><span class="c3">FİZ</span><span class="c4">İNG</span><span class="c7">BİY</span><span class="c8">BED</span>
                  </div>
                </div>
                <div class="aw-panel">
                  <p class="aw-title">Yapılacaklar</p>
                  <ul class="aw-tasks">
                    <li><span>Maaş değişikliği formu</span><i class="pill pill-amber">3 gün</i></li>
                    <li><span>DYK yoklama girişi</span><i class="pill pill-green">Tamam</i></li>
                    <li><span>Sorumluluk sınavı programı</span><i class="pill pill-purple">Taslak</i></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div class="toast toast-1"><span class="toast-ic ic-green">✓</span><div><strong>Ders programı hazır</strong><small>0 çakışma · 38 şube</small></div></div>
          <div class="toast toast-2"><span class="toast-ic ic-purple">📱</span><div><strong>Yeni öğretmen bildirimi</strong><small>10-B · Derse geç kalma</small></div></div>
        </div>
      </div>
    </section>

    <section class="logos-strip">
      <div class="wrap">
        <ul class="strip-list">
          <li>e-Okul ve MEBBİS Excel içe aktarma</li>
          <li>Resmî şablonlarda Word / Excel / PDF</li>
          <li>KBS ek ders kodları</li>
          <li>Rol bazlı yetki · İki adımlı doğrulama</li>
          <li>Günlük şifreli yedek</li>
        </ul>
      </div>
    </section>

    <section id="moduller" class="section">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Modüller</p>
          <h2>Okul idaresinin her alanı için bir modül</h2>
          <p class="section-lead">
            ${moduleCount} modül beş iş alanında toplanır ve birbirine bağlı çalışır:
            ders programı ek derse, rapor maaş formuna, öğretmen bildirimi disipline kendiliğinden akar.
          </p>
        </div>
        <div class="module-groups">
          ${groups
            .map(
              (g) => `<article class="module-card">
            <div class="module-icon icon-${g.color}">${g.icon}</div>
            <h3>${esc(g.title)}</h3>
            <p>${esc(g.summary)}</p>
            <ul class="link-list">
              ${g.modules.map((m) => `<li><a href="/moduller/${m.slug}"><span>${m.icon}</span>${esc(m.name)}</a></li>`).join('\n              ')}
            </ul>
          </article>`,
            )
            .join('\n          ')}
          <article class="module-card module-card-mobile">
            <div class="module-icon icon-sky">📱</div>
            <h3>Öğretmen Mobil Uygulaması</h3>
            <p>Öğretmenler telefondan öğrenci arar, disiplin bildirimi gönderir, okul bildirimlerini takip eder.</p>
            <a class="btn btn-outline" href="/mobil-uygulama">Mobil uygulamayı inceleyin</a>
          </article>
        </div>
      </div>
    </section>

    ${SPOTLIGHTS.map(
      (s, i) => `<section class="section spotlight${i % 2 ? ' section-alt' : ''}">
      <div class="wrap spot-inner${i % 2 ? ' reverse' : ''}">
        <div class="spot-copy">
          <p class="eyebrow">${esc(s.eyebrow)}</p>
          <h2>${esc(s.title)}</h2>
          <p class="section-lead">${esc(s.text)}</p>
          <ul class="check-list">${s.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
          <a class="text-link" href="/moduller/${s.slug}">${esc(bySlug[s.slug].name)} modülünü inceleyin →</a>
        </div>
        <div class="spot-visual">
          ${s.visual}
        </div>
      </div>
    </section>`,
    ).join('\n\n    ')}

    <section id="mobil" class="section section-dark">
      <div class="wrap spot-inner">
        <div class="spot-copy">
          <p class="eyebrow eyebrow-light">Mobil uygulama</p>
          <h2>Öğretmenin cebinde, idarenin ekranında</h2>
          <p class="section-lead">
            OIDS Android uygulamasıyla öğretmen, okul numarasını tuşlayıp öğrenciyi fotoğrafıyla bulur
            ve birkaç dokunuşla bildirim gönderir. Bildirim aynı anda idarenin Disiplin ekranına düşer.
          </p>
          <ul class="mobile-feats">
            ${MOBILE.features.slice(0, 4).map(([ic, t, d]) => `<li><span>${ic}</span><div><strong>${esc(t)}</strong><p>${esc(d)}</p></div></li>`).join('\n            ')}
          </ul>
          <a class="btn btn-primary btn-lg btn-on-dark" href="/mobil-uygulama">Mobil uygulama hakkında</a>
        </div>
        <div class="spot-visual">${phoneMock()}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Entegrasyonlar</p>
          <h2>Elinizdeki veriyle başlayın</h2>
          <p class="section-lead">Sıfırdan veri girmeyin. OIDS, okulun zaten kullandığı sistemlerin dosyalarını okur ve resmî formatlarda çıktı verir.</p>
        </div>
        <ul class="integration-grid">
          ${INTEGRATIONS.map(([n, d]) => `<li><strong>${esc(n)}</strong><span>${esc(d)}</span></li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Nasıl başlarsınız</p>
          <h2>Üç adımda kullanıma hazır</h2>
        </div>
        <ol class="steps">
          <li><span>1</span><h3>Okulunuzu tanımlayın</h3><p>MEB kataloğundan okulunuzu seçin; sınıfları e-Okul’dan, öğretmenleri MEBBİS’ten, öğrencileri e-Okul Excel’inden aktarın.</p></li>
          <li><span>2</span><h3>Yetkileri dağıtın</h3><p>Müdür yardımcısı, rehber öğretmen ve memur için menü bazında yetki verin; öğretmenler mobil uygulamadan kayıt isteği göndersin.</p></li>
          <li><span>3</span><h3>Programları üretin</h3><p>Ders programını ve nöbet çizelgesini otomatik hazırlayın; ek ders, rapor ve maaş formu kendiliğinden beslensin.</p></li>
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Güvenlik</p>
          <h2>Okulun verisi okulun kontrolünde</h2>
        </div>
        <div class="highlight-grid">
          <article class="highlight-card"><div class="highlight-icon">🔑</div><h3>İki adımlı doğrulama</h3><p>Doğrulayıcı uygulama (QR kod) veya SMS kodu ile giriş; görsel doğrulama ve hatalı girişte geçici engel.</p></article>
          <article class="highlight-card"><div class="highlight-icon">👥</div><h3>Menü bazında yetki</h3><p>Her rol için görme, ekleme, düzenleme ve silme yetkisi ayrı ayrı verilir.</p></article>
          <article class="highlight-card"><div class="highlight-icon">🧾</div><h3>Silinemez denetim kaydı</h3><p>Kim, ne zaman, neyi değiştirdi; tüm işlemler kayıt altında.</p></article>
          <article class="highlight-card"><div class="highlight-icon">💾</div><h3>Şifreli yedek</h3><p>Her gün otomatik yedek, AES-256 ile şifrelenmiş kopyası Google Drive’da.</p></article>
        </div>
      </div>
    </section>

    <section id="planlar" class="section section-alt">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow">Planlar</p>
          <h2>Okulunuzun büyüklüğüne uygun plan</h2>
          <p class="section-lead">Fiyatlandırma okul sayınıza ve seçtiğiniz ek paketlere göre teklifle belirlenir.</p>
        </div>
        <div class="plan-grid">
          <article class="plan-card">
            <h3>Basic</h3>
            <p class="plan-summary">Tek okulda öğretmen, öğrenci ve sınıf kayıtlarını tutmak için.</p>
            <ul class="plan-features">
              <li>1 okul</li><li>Öğretmen kayıtları</li><li>Sınıf / şube tanımları</li><li>Öğrenci kayıtları ve e-Okul içe aktarma</li>
            </ul>
            <a class="btn btn-outline" href="#iletisim">Teklif Alın</a>
          </article>
          <article class="plan-card plan-featured">
            <p class="plan-badge">En çok tercih edilen</p>
            <h3>Standart</h3>
            <p class="plan-summary">Tek okulda idari işlerin tamamı için.</p>
            <ul class="plan-features">
              <li>1 okul, sınırsız öğretmen kaydı</li>
              <li>Otomatik ders programı ve e-Okul eklentisi</li>
              <li>Nöbet, rapor, terfi ve maaş bildirim formu</li>
              <li>Ek ders ve İşçi / TYP puantajı</li>
              <li>Ortak / sorumluluk sınavı ve kelebek sistemi</li>
              <li>Devamsızlık, DYK, disiplin, rehberlik</li>
              <li>Veli iletişimi (SMS)</li>
              <li>Yetkilendirme ve denetim kayıtları</li>
              <li>Öğretmen mobil uygulaması</li>
            </ul>
            <a class="btn btn-primary" href="#iletisim">Teklif Alın</a>
          </article>
          <article class="plan-card">
            <h3>Premium</h3>
            <p class="plan-summary">Standart planın tamamı; birden fazla okul ve sınırsız kullanıcı.</p>
            <ul class="plan-features">
              <li>Standart planın tamamı</li><li>En fazla 3 okul</li><li>Sınırsız kullanıcı hesabı</li><li>Okul kodunu kendiniz belirleme</li><li>Öncelikli destek</li>
            </ul>
            <a class="btn btn-outline" href="#iletisim">Teklif Alın</a>
          </article>
        </div>
        <div class="addon-row">
          <div class="addon"><strong>📨 SMS paketleri</strong><span>3.000 veya 10.000 kontör. Veli duyurusu, iş hatırlatması ve SMS ile giriş bu kotadan kullanılır.</span></div>
          <div class="addon"><strong>✨ Yapay Zekâ paketi</strong><span>Ders programında Türkçe kısıt yazma, ürün içi soru-cevap asistanı ve çözücü desteği.</span></div>
        </div>
      </div>
    </section>
${faqBlock(FAQ)}
${ctaBlock()}`,
  }),
})

// ───────────────────────────── Modüller dizini
add({
  path: '/moduller',
  file: 'moduller.html',
  priority: '0.9',
  html: page({
    ...common,
    path: '/moduller',
    active: '/moduller',
    title: `Okul İdare Yazılımı Modülleri — ${moduleCount} Modül | OIDS`,
    description:
      'OIDS modülleri: öğrenci ve personel, terfi, rapor, nöbet, ek ders, ders programı, sınav, kelebek, devamsızlık, disiplin, rehberlik ve daha fazlası.',
    ld: [
      breadcrumbLd([{ name: 'Anasayfa', path: '/' }, { name: 'Modüller', path: '/moduller' }]),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: MODULES.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.name, url: `${SITE.url}/moduller/${m.slug}` })),
      },
    ],
    body: `
    <section class="page-hero">
      <div class="wrap">
        ${breadcrumbNav([{ name: 'Anasayfa', path: '/' }, { name: 'Modüller', path: '/moduller' }])}
        <h1>OIDS modülleri</h1>
        <p class="lead">${moduleCount} modül, beş iş alanı ve öğretmen mobil uygulaması. Her modül diğerleriyle aynı veriyi paylaşır; bir kez girilen bilgi tüm okulda kullanılır.</p>
      </div>
    </section>
    ${groups
      .map(
        (g, i) => `<section class="section${i % 2 ? ' section-alt' : ''}" id="${g.key}">
      <div class="wrap">
        <div class="group-head"><div class="module-icon icon-${g.color}">${g.icon}</div><div><h2>${esc(g.title)}</h2><p>${esc(g.summary)}</p></div></div>
        <div class="feature-index">
          ${g.modules
            .map(
              (m) => `<a class="feature-tile" href="/moduller/${m.slug}">
            <span class="ft-icon">${m.icon}</span>
            <h3>${esc(m.name)}</h3>
            <p>${esc(m.lead)}</p>
            <span class="ft-more">İncele →</span>
          </a>`,
            )
            .join('\n          ')}
        </div>
      </div>
    </section>`,
      )
      .join('\n    ')}
    <section class="section">
      <div class="wrap">
        <a class="feature-tile feature-tile-wide" href="/mobil-uygulama">
          <span class="ft-icon">📱</span>
          <h3>Öğretmen Mobil Uygulaması</h3>
          <p>${esc(MOBILE.description)}</p>
          <span class="ft-more">İncele →</span>
        </a>
      </div>
    </section>
${ctaBlock()}`,
  }),
})

// ───────────────────────────── Modül sayfaları
for (const m of MODULES) {
  const g = groups.find((x) => x.key === m.group)
  const path = `/moduller/${m.slug}`
  const crumbs = [
    { name: 'Anasayfa', path: '/' },
    { name: 'Modüller', path: '/moduller' },
    { name: m.name, path },
  ]
  const siblings = g.modules.filter((x) => x.slug !== m.slug)
  add({
    path,
    file: `moduller/${m.slug}.html`,
    priority: '0.8',
    html: page({
      ...common,
      path,
      active: '/moduller',
      title: m.title,
      description: m.description,
      ld: [breadcrumbLd(crumbs), ...(m.faq ? [faqLd(m.faq)] : [])],
      body: `
    <section class="page-hero">
      <div class="wrap">
        ${breadcrumbNav(crumbs)}
        <p class="eyebrow">${esc(g.title)}</p>
        <h1><span class="h1-icon" aria-hidden="true">${m.icon}</span>${esc(m.name)}</h1>
        <p class="lead">${esc(m.lead)}</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="#iletisim">Demo İsteyin</a>
          ${loginButton('btn btn-login btn-lg', 'Panele Giriş Yap')}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2 class="section-title">Neler yapabilirsiniz?</h2>
        <div class="feature-list">
          ${m.features.map(([t, d]) => `<article class="feature-item"><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join('\n          ')}
        </div>
      </div>
    </section>
${m.faq ? faqBlock(m.faq) : ''}
    <section class="section section-alt">
      <div class="wrap">
        <h2 class="section-title">Birlikte çalıştığı modüller</h2>
        <div class="related">
          ${m.related.map(relatedLink).map((r) => `<a href="${r.href}"><span>${r.icon}</span>${esc(r.name)}</a>`).join('\n          ')}
        </div>
        ${siblings.length ? `<p class="also">${esc(g.title)} altında ayrıca: ${siblings.map((s) => `<a href="/moduller/${s.slug}">${esc(s.short)}</a>`).join(' · ')}</p>` : ''}
      </div>
    </section>
${ctaBlock(`${m.name} okulunuzda nasıl çalışır?`, 'Kısa bir demo ile bu modülü kendi okulunuzun verisiyle birlikte inceleyelim.')}`,
    }),
  })
}

// ───────────────────────────── Mobil uygulama
{
  const crumbs = [
    { name: 'Anasayfa', path: '/' },
    { name: 'Mobil Uygulama', path: '/mobil-uygulama' },
  ]
  const store = SITE.playStoreUrl
    ? `<a class="btn btn-primary btn-lg" href="${SITE.playStoreUrl}" rel="noopener">Google Play’den İndirin</a>`
    : `<a class="btn btn-primary btn-lg" href="/#iletisim">Okulunuz İçin Demo İsteyin</a>`
  add({
    path: '/mobil-uygulama',
    file: 'mobil-uygulama.html',
    priority: '0.9',
    html: page({
      ...common,
      path: '/mobil-uygulama',
      active: '/mobil-uygulama',
      title: MOBILE.title,
      description: MOBILE.description,
      ld: [
        breadcrumbLd(crumbs),
        faqLd(MOBILE.faq),
        {
          '@context': 'https://schema.org',
          '@type': 'MobileApplication',
          name: 'OIDS',
          operatingSystem: 'Android',
          applicationCategory: 'EducationalApplication',
          inLanguage: 'tr',
          description: MOBILE.description,
          ...(SITE.playStoreUrl ? { installUrl: SITE.playStoreUrl } : {}),
          publisher: { '@type': 'Organization', name: SITE.name },
        },
      ],
      body: `
    <section class="page-hero">
      <div class="wrap spot-inner">
        <div class="spot-copy">
          ${breadcrumbNav(crumbs)}
          <p class="eyebrow">OIDS Mobil · Android</p>
          <h1>Öğretmenler için OIDS mobil uygulaması</h1>
          <p class="lead">Sınıftayken bilgisayara gitmeden öğrenciyi bulun, bildirimi gönderin. Gönderdiğiniz her bildirim anında idarenin Disiplin ekranında görünür.</p>
          <div class="hero-actions">${store}</div>
        </div>
        <div class="spot-visual">${phoneMock()}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2 class="section-title">Uygulamada neler var?</h2>
        <div class="feature-list">
          ${MOBILE.features.map(([ic, t, d]) => `<article class="feature-item"><h3><span aria-hidden="true">${ic}</span> ${esc(t)}</h3><p>${esc(d)}</p></article>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="wrap">
        <div class="section-head"><p class="eyebrow">Kayıt</p><h2>Üç adımda giriş</h2></div>
        <ol class="steps">
          ${MOBILE.steps.map(([t, d], i) => `<li><span>${i + 1}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('\n          ')}
        </ol>
      </div>
    </section>

    <section class="section">
      <div class="wrap spot-inner">
        <div class="spot-copy">
          <p class="eyebrow">İdare tarafı</p>
          <h2>Bildirim idareye nasıl ulaşır?</h2>
          <p class="section-lead">Öğretmen bildirimleri Disiplin modülünde ayrı bir sekmede toplanır. İdare sebep istatistiğini görür; aynı öğrenci için aynı sebep tekrarlandığında uyarı alır ve gerekirse bildirimden disiplin olayı başlatır.</p>
          <a class="text-link" href="/moduller/disiplin">Disiplin modülünü inceleyin →</a>
        </div>
        <div class="spot-visual">
          <ol class="timeline" aria-hidden="true">
            <li><b>📱</b>Öğretmen bildirimi gönderir</li><li><b>🔔</b>İdare Disiplin ekranında görür</li><li><b>📊</b>Sebep istatistiği ve tekrar uyarısı</li><li><b>📂</b>Gerekirse olay kaydı açılır</li>
          </ol>
        </div>
      </div>
    </section>
${faqBlock(MOBILE.faq)}
${ctaBlock('Öğretmenleriniz için mobil erişim', 'Okulunuz OIDS’e geçtiğinde öğretmenleriniz mobil uygulamayla hemen kayıt isteği gönderebilir.')}`,
    }),
  })
}

// ───────────────────────────── Yasal sayfalar
for (const [slug, title, description] of [
  ['gizlilik', 'Gizlilik politikası — OIDS', 'OIDS (Okul İdare Sistemi) mobil uygulaması ve yönetim paneli gizlilik politikası.'],
  ['hesap-silme', 'Hesap silme — OIDS', 'OIDS (Okul İdare Sistemi) mobil uygulaması hesap silme talebi.'],
]) {
  add({
    path: `/${slug}`,
    file: `${slug}.html`,
    priority: '0.3',
    html: page({
      ...common,
      path: `/${slug}`,
      title,
      description,
      body: `<div class="legal">\n${readFileSync(join(SRC, `${slug}.body.html`), 'utf8')}</div>`,
    }),
  })
}

// ───────────────────────────── 404
add({
  path: '/404',
  file: '404.html',
  sitemap: false,
  html: page({
    ...common,
    path: '/404',
    noindex: true,
    title: 'Sayfa bulunamadı — OIDS',
    description: 'Aradığınız sayfa bulunamadı.',
    body: `
    <section class="page-hero not-found">
      <div class="wrap">
        <p class="eyebrow">404</p>
        <h1>Aradığınız sayfa bulunamadı</h1>
        <p class="lead">Adres değişmiş veya kaldırılmış olabilir.</p>
        <div class="hero-actions">
          <a class="btn btn-primary btn-lg" href="/">Anasayfaya dön</a>
          <a class="btn btn-outline btn-lg" href="/moduller">Modüller</a>
        </div>
      </div>
    </section>`,
  }),
})

// ───────────────────────────── Yaz
// lastmod yalnızca sayfa içeriği değiştiğinde güncellenir; her build'de bugünü yazmak
// Google'ın lastmod'a güvenini düşürür.
const sitemapFile = join(OUT, 'sitemap.xml')
const prevLastmod = new Map()
if (existsSync(sitemapFile)) {
  for (const [, loc, mod] of readFileSync(sitemapFile, 'utf8').matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)) prevLastmod.set(loc, mod)
}
const prevHtml = new Map(pages.map((p) => [p.file, existsSync(join(OUT, p.file)) ? readFileSync(join(OUT, p.file), 'utf8') : null]))
// Önbellek kırıcı ve telif yılı içerik değişikliği sayılmaz.
const strip = (h) => h && h.replace(/\?v=[0-9a-f]{8}/g, '').replace(/<span id="year">\d+<\/span>/, '')

rmSync(join(OUT, 'moduller'), { recursive: true, force: true })
for (const p of pages) {
  const f = join(OUT, p.file)
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, p.html)
  const loc = SITE.url + (p.path === '/' ? '/' : p.path)
  p.loc = loc
  p.lastmod = strip(prevHtml.get(p.file)) === strip(p.html) && prevLastmod.get(loc) ? prevLastmod.get(loc) : TODAY
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .filter((p) => p.sitemap !== false)
  .map((p) => `  <url><loc>${p.loc}</loc><lastmod>${p.lastmod}</lastmod><priority>${p.priority}</priority></url>`)
  .join('\n')}
</urlset>
`
writeFileSync(sitemapFile, sitemap)
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`)

console.log(`${pages.length} sayfa, sitemap ${pages.filter((p) => p.sitemap !== false).length} URL → ${OUT}`)
