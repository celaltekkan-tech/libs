// Sitenin tek yerden değişen sabitleri.
export const SITE = {
  name: 'Okul İdare Sistemi (OIDS)',
  // Kanonik adres: sitemap, canonical ve Open Graph bu adresle üretilir.
  // www kullanılıyorsa www -> çıplak alan adı 301 yönlendirmesi proxy'de yapılmalı.
  url: 'https://oids.com.tr',
  appUrl: 'https://uyg.oids.com.tr',
  email: 'info@oids.com.tr',
  // Uygulama Play'de herkese açılınca adresi yazın; boşken sitede mağaza düğmesi çıkmaz.
  playStoreUrl: '', // https://play.google.com/store/apps/details?id=tr.com.oids.mobil
  buildId: '', // build.mjs içerik hash'iyle doldurur
}
