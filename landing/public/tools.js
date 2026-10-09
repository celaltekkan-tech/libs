// Ücretsiz hesaplayıcılar. Hesap kuralları OIDS'teki kodun birebir aynısıdır:
//   rapor  → src/services/reportSalarySync.js + src/utils/salaryPeriod.js
//   ekders → src/services/extraLessonPayroll.js
//   terfi  → src/utils/promotionEngine.js
// Kural değişirse iki tarafı birlikte güncelleyin (landing/src/tools.test.mjs karşılaştırır).
;(function (root) {
  const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

  const pad = (n) => String(n).padStart(2, '0')
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const parse = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''))
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null
  }
  const trDate = (s) => {
    const d = typeof s === 'string' ? parse(s) : s
    return d ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}` : ''
  }

  /** Maaş formu dönemi: önceki ayın 15'i – bu ayın 14'ü. Ayın 15'i ve sonrası sonraki ayın formudur. */
  function salaryForm(date) {
    let month = date.getMonth() + 1
    let year = date.getFullYear()
    if (date.getDate() >= 15) {
      month += 1
      if (month === 13) { month = 1; year += 1 }
    }
    const pm = month === 1 ? 12 : month - 1
    const py = month === 1 ? year - 1 : year
    return { month, year, label: `${MONTHS[month - 1]} ${year}`, range: `15.${pad(pm)}.${py} – 14.${pad(month)}.${year}` }
  }

  // ───────────────────────── Rapor
  const FREE_REPORT_DAYS = 7

  function reportCalc(reports, year) {
    const covered = []
    reports.forEach((r, idx) => {
      const s = parse(r.start), e = parse(r.end)
      if (!s || !e || e < s) return
      for (const d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year) covered.push({ day: iso(d), idx })
      }
    })
    covered.sort((a, b) => a.day.localeCompare(b.day) || a.idx - b.idx)
    const seen = new Set()
    const unique = covered.filter((c) => (seen.has(c.day) ? false : (seen.add(c.day), true)))
    const excess = unique.slice(FREE_REPORT_DAYS)
    const perReport = reports.map((_, idx) => ({
      days: unique.filter((c) => c.idx === idx).length,
      excess: excess.filter((c) => c.idx === idx).length,
    }))
    return {
      total: unique.length,
      free: Math.min(FREE_REPORT_DAYS, unique.length),
      excess: excess.length,
      firstExcessDay: excess.length ? excess[0].day : null,
      form: excess.length ? salaryForm(parse(excess[0].day)) : null,
      perReport,
      overlaps: covered.length - unique.length,
    }
  }

  // ───────────────────────── Ek ders
  const SALARY_HOURS = 15
  const SOCIAL_HOURS = 2

  /**
   * Haftalık ders yükünden aylık KBS satırları.
   * mode: 'ucretli' | 'gorevlendirme' (dış kurum, ders tamamlama)
   * dayHours/nightHours: haftalık okutulan saat (gece = 17:00'de veya sonra biten ders ya da hafta sonu)
   * guidanceHours: rehberlik saati (gündüz derslerinin içinde; görevlendirmede ek derse yazılmaz)
   */
  function extraLessonCalc({ mode, dayHours, nightHours, guidanceHours = 0, weeks, dutyWeekday = 0, dutyWeekend = 0 }) {
    const n = (v) => Math.max(0, Math.floor(Number(v) || 0))
    const w = n(weeks)
    const lines = new Map()
    const add = (code, label, hours) => {
      if (hours <= 0) return
      const prev = lines.get(code || label) || { code, label, hours: 0 }
      prev.hours += hours
      lines.set(code || label, prev)
    }
    let week
    if (mode === 'gorevlendirme') {
      const night = n(nightHours)
      const day = Math.max(0, n(dayHours) - n(guidanceHours))
      const taught = day + night
      const salary = Math.min(SALARY_HOURS, taught)
      const extra = Math.max(0, taught - SALARY_HOURS)
      const extraNight = taught === 0 ? 0 : Math.round((extra * night) / taught)
      const prep = Math.floor(taught / 10)
      const prepNight = night > day
      week = { taught, salary, extra, extraDay: extra - extraNight, extraNight, social: taught > 0 ? SOCIAL_HOURS : 0, prep, prepNight }
      add('', 'Maaş karşılığı', salary * w)
      add('101', 'Gündüz', week.extraDay * w)
      add('102', 'Gece', extraNight * w)
      add('', 'Sosyal kişilik hizmetleri', week.social * w)
      add(prepNight ? '123' : '122', prepNight ? 'YEP (Gece)' : 'YEP (Gündüz)', prep * w)
      add('119', 'Nöbet Görevi (Gündüz)', n(dutyWeekday))
      add('121', 'Nöbet Görevi (%25 Fazla)', n(dutyWeekend))
    } else {
      const day = n(dayHours), night = n(nightHours)
      const taught = day + night
      const yep = Math.floor(taught / 2)
      const yepNight = night > day
      week = { taught, yep, yepNight }
      add('101', 'Gündüz', day * w)
      add('102', 'Gece', night * w)
      add(yepNight ? '123' : '122', yepNight ? 'YEP (Gece)' : 'YEP (Gündüz)', yep * w)
    }
    const all = [...lines.values()]
    return { week, lines: all, kbsTotal: all.filter((l) => l.code).reduce((s, l) => s + l.hours, 0) }
  }

  // ───────────────────────── Terfi
  const maxRank = (deg) => (deg === 1 ? 4 : 3)

  function advance(deg, rank) {
    if (deg === 1 && rank >= 4) return { deg, rank, ceiling: true }
    if (rank < maxRank(deg)) return { deg, rank: rank + 1 }
    return { deg: Math.max(1, deg - 1), rank: 1 }
  }

  const addYears = (d, y) => { const x = new Date(d); x.setFullYear(x.getFullYear() + y); return x }

  /**
   * Gelecek terfi takvimi. lastDate: son kademe ilerlemesi (terfi) tarihi.
   * eightBase: 8 yıllık cezasız sayacın başladığı tarih (boşsa hesaplanmaz).
   */
  function promotionCalc({ degree, rank, lastDate, years = 10, eightBase, noPenalty = true }) {
    let deg = Number(degree), rk = Number(rank)
    const base = parse(lastDate)
    if (!deg || !rk || !base) return { events: [] }
    const events = []
    for (let i = 1; i <= years; i += 1) events.push({ date: addYears(base, i), kind: 'yillik' })
    const eb = parse(eightBase)
    if (eb && noPenalty) {
      const limit = addYears(base, years)
      for (let k = 1; addYears(eb, 8 * k) <= limit; k += 1) events.push({ date: addYears(eb, 8 * k), kind: 'sekiz' })
    }
    events.sort((a, b) => a.date - b.date || (a.kind === 'yillik' ? -1 : 1))
    return {
      events: events.map((e) => {
        const from = `${deg}/${rk}`
        const next = advance(deg, rk)
        deg = next.deg
        rk = next.rank
        return { date: iso(e.date), kind: e.kind, from, to: `${deg}/${rk}`, ceiling: !!next.ceiling, form: salaryForm(e.date) }
      }),
    }
  }

  const api = { salaryForm, reportCalc, extraLessonCalc, promotionCalc, advance, trDate, parse, MONTHS }
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  root.OIDSCalc = api
})(typeof window !== 'undefined' ? window : globalThis)

// ───────────────────────── Arayüz
;(function () {
  if (typeof document === 'undefined') return
  const C = window.OIDSCalc
  const $ = (sel, el = document) => el.querySelector(sel)
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  // Rapor
  const rapor = $('[data-tool="rapor"]')
  if (rapor) {
    const list = $('.rp-list', rapor)
    const tpl = (s = '', e = '') => `<div class="rp-row"><label>Başlangıç<input type="date" class="rp-s" value="${s}"></label><label>Bitiş<input type="date" class="rp-e" value="${e}"></label><button type="button" class="rp-del" aria-label="Raporu sil">×</button></div>`
    const y = new Date().getFullYear()
    list.innerHTML = tpl(`${y}-02-10`, `${y}-02-14`) + tpl(`${y}-03-02`, `${y}-03-06`)
    $('.rp-year', rapor).value = y
    const run = () => {
      const year = Number($('.rp-year', rapor).value)
      const rows = [...list.querySelectorAll('.rp-row')]
      const reports = rows.map((r) => ({ start: $('.rp-s', r).value, end: $('.rp-e', r).value }))
      const ucretli = $('.rp-type', rapor).value === 'ucretli'
      const r = C.reportCalc(reports, year)
      rows.forEach((row, i) => {
        let tag = row.querySelector('.rp-tag')
        if (!tag) { tag = document.createElement('span'); tag.className = 'rp-tag'; row.insertBefore(tag, row.lastElementChild) }
        const p = r.perReport[i]
        tag.textContent = p.days ? `${p.days} gün${p.excess ? ` · ${p.excess} aşan` : ''}` : ''
        tag.classList.toggle('warn', p.excess > 0)
      })
      const out = $('.calc-result', rapor)
      if (ucretli) {
        out.innerHTML = `<p class="res-big">Ücretli personel</p><p>Ücretli öğretmenlerin raporları maaş değişikliği formuna yazılmaz; ek ders puantajında o günler düşülür.</p>`
        return
      }
      out.innerHTML = `
        <div class="res-stats">
          <div><span>${year} toplam rapor</span><strong>${r.total} gün</strong></div>
          <div><span>Kesintisiz (ilk 7 gün)</span><strong>${r.free} gün</strong></div>
          <div class="${r.excess ? 'hot' : ''}"><span>Maaşa yansıyan</span><strong>${r.excess} gün</strong></div>
        </div>
        ${r.excess
          ? `<p>8. rapor günü <strong>${C.trDate(r.firstExcessDay)}</strong>; 7 günlük sınır bu tarihte aşılıyor. Aşan ${r.excess} gün <strong>${r.form.label}</strong> Maaş Değişikliği Bildirim Formu’nda bildirilir (dönem ${r.form.range}).</p>`
          : `<p>Bu yıl 7 günlük sınır aşılmadı; maaş değişikliği formuna yazılacak rapor günü yok. Kalan hak: <strong>${7 - r.total} gün</strong>.</p>`}
        ${r.overlaps ? `<p class="muted">Çakışan ${r.overlaps} gün bir kez sayıldı.</p>` : ''}`
    }
    rapor.addEventListener('input', run)
    rapor.addEventListener('click', (e) => {
      if (e.target.closest('.rp-add')) { list.insertAdjacentHTML('beforeend', tpl()); run() }
      if (e.target.closest('.rp-del')) { e.target.closest('.rp-row').remove(); run() }
    })
    run()
  }

  // Ek ders
  const ek = $('[data-tool="ekders"]')
  if (ek) {
    const val = (n) => $(`[name="${n}"]`, ek).value
    const run = () => {
      const mode = val('mode')
      ek.classList.toggle('is-gorev', mode === 'gorevlendirme')
      const r = C.extraLessonCalc({
        mode,
        dayHours: val('day'), nightHours: val('night'), guidanceHours: val('guidance'),
        weeks: val('weeks'), dutyWeekday: val('dutyWd'), dutyWeekend: val('dutyWe'),
      })
      const wk = r.week
      const summary = mode === 'gorevlendirme'
        ? `Haftada ${wk.taught} saat derse girdiniz: ilk ${wk.salary} saat maaş karşılığı, ${wk.extra} saat ek ders. Her 10 derse 1 saat hazırlık (YEP: ${wk.prep}) ve haftalık ${wk.social} saat sosyal kişilik hizmeti eklenir.`
        : `Haftada ${wk.taught} saatin tamamı ek derstir. Her 2 derse 1 saat hazırlık (YEP: ${wk.yep}, buçuk aşağı yuvarlanır) eklenir.`
      $('.calc-result', ek).innerHTML = `
        <p>${esc(summary)}</p>
        <div class="table-wrap"><table class="res-table">
          <thead><tr><th>KBS kodu</th><th>Açıklama</th><th>Aylık saat</th></tr></thead>
          <tbody>${r.lines.map((l) => `<tr${l.code ? '' : ' class="muted"'}><td>${l.code || '—'}</td><td>${esc(l.label)}</td><td>${l.hours}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="2">KBS’ye girilecek toplam</td><td>${r.kbsTotal}</td></tr></tfoot>
        </table></div>`
    }
    ek.addEventListener('input', run)
    ek.addEventListener('change', run)
    run()
  }

  // Terfi
  const tf = $('[data-tool="terfi"]')
  if (tf) {
    const val = (n) => $(`[name="${n}"]`, tf)
    const y = new Date().getFullYear()
    val('last').value = `${y - 1}-11-03`
    val('eight').value = `${y - 6}-11-03`
    const run = () => {
      const r = C.promotionCalc({
        degree: val('degree').value, rank: val('rank').value, lastDate: val('last').value,
        years: Number(val('years').value), eightBase: val('eight').value, noPenalty: val('nopen').checked,
      })
      const out = $('.calc-result', tf)
      if (!r.events.length) { out.innerHTML = '<p>Derece, kademe ve son terfi tarihini girin.</p>'; return }
      out.innerHTML = `<div class="table-wrap"><table class="res-table">
        <thead><tr><th>Tarih</th><th>İlerleme</th><th>Derece/Kademe</th><th>Maaş formu</th></tr></thead>
        <tbody>${r.events.map((e) => `<tr class="${e.kind === 'sekiz' ? 'hl' : ''}">
          <td>${C.trDate(e.date)}</td>
          <td>${e.kind === 'sekiz' ? '8 yıl cezasız (+1 kademe)' : 'Yıllık kademe'}</td>
          <td>${e.ceiling ? `${e.from} <em>(tavan)</em>` : `${e.from} → <strong>${e.to}</strong>`}</td>
          <td>${e.form.label}</td></tr>`).join('')}</tbody></table></div>`
    }
    tf.addEventListener('input', run)
    tf.addEventListener('change', run)
    run()
  }
})()
