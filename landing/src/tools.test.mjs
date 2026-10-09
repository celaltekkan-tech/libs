// node --test landing/src/tools.test.mjs
// Sitedeki hesaplayıcıların OIDS backend kurallarıyla aynı sonucu verdiğini doğrular.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const C = require('../public/tools.js')
const { advanceDegreeRank } = require('../../src/utils/promotionEngine.js')
const { getSalaryPeriodForDate } = require('../../src/utils/salaryPeriod.js')

test('kademe ilerlemesi backend ile aynı (tüm derece/kademe)', () => {
  for (let deg = 1; deg <= 15; deg += 1) {
    for (let rank = 1; rank <= (deg === 1 ? 4 : 3); rank += 1) {
      const be = advanceDegreeRank(deg, rank)
      const fe = C.advance(deg, rank)
      assert.equal(String(fe.deg), be.degree, `${deg}/${rank}`)
      assert.equal(String(fe.rank), be.rank, `${deg}/${rank}`)
      assert.equal(!!fe.ceiling, be.atCeiling, `${deg}/${rank}`)
    }
  }
})

test('maaş formu dönemi backend ile aynı (iki yılın her günü)', () => {
  for (let d = new Date(2025, 0, 1, 12); d.getFullYear() < 2027; d.setDate(d.getDate() + 1)) {
    const be = getSalaryPeriodForDate(new Date(d))
    const fe = C.salaryForm(new Date(d))
    assert.deepEqual([fe.month, fe.year], [be.month, be.year], d.toISOString())
    assert.equal(fe.range, `${be.startLabel} – ${be.endLabel}`)
  }
})

test('rapor: ilk 7 gün kesintisiz, çakışma bir kez sayılır, yıl sınırı', () => {
  const r = C.reportCalc(
    [
      { start: '2026-02-10', end: '2026-02-14' }, // 5
      { start: '2026-02-13', end: '2026-02-16' }, // 2 yeni (13-14 çakışık)
      { start: '2026-03-20', end: '2026-03-23' }, // 4
      { start: '2025-12-30', end: '2026-01-01' }, // 2026'ya 1 gün
    ],
    2026,
  )
  assert.equal(r.total, 12)
  assert.equal(r.overlaps, 2)
  assert.equal(r.excess, 5)
  assert.equal(r.firstExcessDay, '2026-02-16')
  assert.deepEqual([r.form.month, r.form.year], [3, 2026]) // 16 Şubat → Mart formu
})

test('ek ders ücretli: tümü ek ders, her 2 derse 1 YEP', () => {
  const r = C.extraLessonCalc({ mode: 'ucretli', dayHours: 9, nightHours: 0, weeks: 4 })
  const by = Object.fromEntries(r.lines.map((l) => [l.code, l.hours]))
  assert.deepEqual(by, { 101: 36, 122: 16 })
})

test('ek ders görevlendirme: ilk 15 saat maaş, rehberlik düşülür, 10 derse 1 YEP', () => {
  const r = C.extraLessonCalc({ mode: 'gorevlendirme', dayHours: 20, nightHours: 4, guidanceHours: 2, weeks: 4, dutyWeekday: 3, dutyWeekend: 1 })
  const by = Object.fromEntries(r.lines.map((l) => [l.code || l.label, l.hours]))
  // taught = 18 gündüz + 4 gece = 22; ek = 7; gece payı round(7*4/22)=1
  assert.equal(by['Maaş karşılığı'], 60)
  assert.equal(by['101'], 24)
  assert.equal(by['102'], 4)
  assert.equal(by['122'], 8)
  assert.equal(by['Sosyal kişilik hizmetleri'], 8)
  assert.equal(by['119'], 3)
  assert.equal(by['121'], 1)
})

test('terfi takvimi: yıllık + 8 yıl bonusu aynı yıl', () => {
  const r = C.promotionCalc({ degree: 3, rank: 2, lastDate: '2025-11-03', years: 3, eightBase: '2019-11-03' })
  assert.deepEqual(
    r.events.map((e) => [e.date, e.kind, e.to]),
    [
      ['2026-11-03', 'yillik', '3/3'],
      ['2027-11-03', 'yillik', '2/1'],
      ['2027-11-03', 'sekiz', '2/2'],
      ['2028-11-03', 'yillik', '2/3'],
    ],
  )
})
