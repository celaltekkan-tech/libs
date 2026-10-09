// Ücretsiz hesaplayıcı sayfaları (/araclar/<slug>). Hesap mantığı public/tools.js'te.

export const TOOLS = [
  {
    slug: 'rapor-kesintisi-hesaplama',
    name: 'Rapor Kesintisi Hesaplama',
    short: 'Rapor kesintisi',
    icon: '🩺',
    module: 'rapor-takibi',
    title: 'Rapor Kesintisi Hesaplama — Yıllık 7 Gün Kuralı ve Maaş Formu Ayı | OIDS',
    description:
      'Öğretmen ve memur sağlık raporlarında yıllık 7 günü aşan günleri ve hangi ayın maaş değişikliği bildirim formuna yazılacağını ücretsiz hesaplayın.',
    lead:
      'Yıl içindeki raporları girin; kaç günün kesintisiz olduğunu, kaç günün maaşa yansıyacağını ve hangi ayın Maaş Değişikliği Bildirim Formu’nda bildirileceğini görün.',
    form: `
      <div class="calc-grid">
        <label>Yıl<input type="number" class="rp-year" min="2000" max="2100" /></label>
        <label>Personel
          <select class="rp-type">
            <option value="kadrolu">Kadrolu öğretmen, memur veya yönetici</option>
            <option value="ucretli">Ücretli öğretmen</option>
          </select>
        </label>
      </div>
      <p class="calc-label">Raporlar</p>
      <div class="rp-list"></div>
      <button type="button" class="btn btn-outline rp-add">+ Rapor ekle</button>`,
    howTitle: 'Rapor kesintisi nasıl hesaplanır?',
    how: [
      'Takvim yılı (1 Ocak – 31 Aralık) içindeki tüm rapor günleri toplanır. Hafta sonu ve tatil günleri de rapor süresine dahildir.',
      'Aynı güne denk gelen raporlar (örneğin iki raporun çakışan günleri) bir kez sayılır.',
      'Yıl içindeki ilk 7 rapor günü kesintisizdir. 8. günden itibaren her gün maaşa yansır.',
      'Maaşa yansıyan günler, 7 günlük sınırın aşıldığı günün düştüğü dönemin Maaş Değişikliği Bildirim Formu’nda bildirilir. Form dönemi önceki ayın 15’i ile içinde bulunulan ayın 14’ü arasıdır: 16 Şubat’ta aşılan sınır Mart formuna yazılır.',
      'Ücretli öğretmenler bu hesaba girmez; raporlu oldukları günler ek ders puantajından düşülür.',
    ],
    faq: [
      ['Rapor kesintisinde hafta sonu sayılır mı?', 'Evet. Rapor süresi takvim günüyle sayılır; raporun kapsadığı cumartesi, pazar ve tatil günleri de yıllık toplama girer.'],
      ['7 gün hakkı her yıl yenilenir mi?', 'Evet. Sayım takvim yılı esaslıdır; 1 Ocak’ta sıfırlanır. Yılbaşını kapsayan bir raporun günleri ilgili yıllara ayrı ayrı yazılır.'],
      ['Aşan günler hangi ayın maaş formuna yazılır?', 'Sınırın aşıldığı gün ayın 1’i ile 14’ü arasındaysa o ayın, 15’i veya sonrasındaysa bir sonraki ayın formuna yazılır.'],
    ],
    automation:
      'OIDS Rapor Takibi’nde raporu girdiğiniz anda yıllık toplamı hesaplar ve 7 günü aşan kısmı ilgili ayın Maaş Değişikliği Bildirim Formu’na kendisi yazar. Aynı rapor günleri ek ders puantajından da otomatik düşülür.',
  },
  {
    slug: 'ek-ders-hesaplama',
    name: 'Ek Ders Saati Hesaplama (KBS Kodları)',
    short: 'Ek ders saati',
    icon: '💰',
    module: 'ek-ders-puantaji',
    title: 'Ek Ders Hesaplama — Ücretli ve Ders Tamamlama, KBS 101-123 Kodları | OIDS',
    description:
      'Ücretli ve dış kurum (ders tamamlama) öğretmenleri için aylık ek ders saatlerini KBS kodlarına göre ücretsiz hesaplayın: 101, 102, 119, 121, 122, 123.',
    lead:
      'Haftalık ders yükünü girin; ilk 15 saat maaş karşılığı, hazırlık (YEP), sosyal kişilik hizmeti ve nöbet saatleriyle birlikte KBS’ye girilecek aylık ek ders saatlerini görün.',
    form: `
      <div class="calc-grid">
        <label class="span-2">Görev türü
          <select name="mode">
            <option value="ucretli">Ücretli öğretmen</option>
            <option value="gorevlendirme">Dış kurum görevlendirme / ders tamamlama</option>
          </select>
        </label>
        <label>Haftalık gündüz ders saati<input type="number" name="day" min="0" max="60" value="12" /></label>
        <label>Haftalık gece ders saati<small>17:00 ve sonrası biten dersler, hafta sonu</small><input type="number" name="night" min="0" max="60" value="0" /></label>
        <label class="only-gorev">Gündüz derslerinden rehberlik saati<small>Görevlendirmede ek derse yazılmaz</small><input type="number" name="guidance" min="0" max="60" value="0" /></label>
        <label>Ayda ders yapılan hafta sayısı<input type="number" name="weeks" min="0" max="6" value="4" /></label>
        <label class="only-gorev">Aylık hafta içi nöbet sayısı<input type="number" name="dutyWd" min="0" max="31" value="0" /></label>
        <label class="only-gorev">Aylık hafta sonu nöbet sayısı<input type="number" name="dutyWe" min="0" max="31" value="0" /></label>
      </div>`,
    howTitle: 'Ek ders saatleri nasıl hesaplanır?',
    how: [
      'Ücretli öğretmende girilen her ders saati ek derstir: gündüz dersleri 101, gece dersleri 102 koduyla yazılır.',
      'Ücretli öğretmende her 2 ders saatine 1 saat hazırlık (YEP) eklenir; buçuklu sonuç aşağı yuvarlanır. Gece dersi gündüzden fazlaysa YEP 123, değilse 122 koduyla yazılır.',
      'Dış kurum görevlendirmesi ve ders tamamlamada haftalık ilk 15 saat maaş karşılığıdır; aşan saatler ek derstir. Ek dersin gece payı, gece derslerinin toplam içindeki oranıyla ayrılır.',
      'Görevlendirmede her 10 ders saatine 1 saat hazırlık (YEP) ve haftada 2 saat sosyal kişilik hizmeti eklenir. Rehberlik dersleri ek derse yazılmaz.',
      'Görevlendirmede her nöbet günü 1 saat sayılır: hafta içi nöbet 119, hafta sonu nöbet 121 (%25 fazla) koduyla yazılır.',
      'Gece dersi: bitiş saati 17:00 veya sonrası olan ders ile cumartesi-pazar dersleri.',
    ],
    faq: [
      ['Ek ders ücreti kaç TL?', 'Tutar, memur maaş katsayısına göre her dönem değişir. Bu araç KBS’ye girilecek saatleri hesaplar; tutar KBS’de güncel katsayıyla hesaplanır.'],
      ['Ücretli öğretmene sosyal kişilik hizmeti yazılır mı?', 'Hayır. Bu hesapta sosyal kişilik hizmeti ve 15 saat maaş karşılığı yalnızca dış kurum görevlendirmesi ve ders tamamlama için uygulanır.'],
      ['Raporlu veya izinli günler ne olur?', 'O günlerin dersleri ek dersten düşülür. Hafta sayısını veya haftalık saati buna göre azaltın. OIDS bunu devamsızlık takviminden otomatik yapar.'],
    ],
    automation:
      'OIDS Ek Ders Puantajı, aylık ders yükünü yayınlanmış ders programından hafta hafta çıkarır. Rapor ve devamsızlık günlerini düşer, zil saatlerinden gece derslerini bulur ve KBS kodlarını kendisi hesaplar.',
  },
  {
    slug: 'kademe-terfi-hesaplama',
    name: 'Kademe ve Derece Terfi Hesaplama',
    short: 'Kademe / derece terfi',
    icon: '📈',
    module: 'terfi-takibi',
    title: 'Kademe Derece Terfi Hesaplama — 8 Yıl Cezasız Kademe | OIDS',
    description:
      'Öğretmen ve memurlar için gelecek yılların kademe/derece terfi tarihlerini, 8 yıl cezasız ek kademeyi ve terfinin hangi ayın maaş formuna gireceğini hesaplayın.',
    lead:
      'Mevcut derece/kademenizi ve son terfi tarihinizi girin; önümüzdeki yıllarda hangi tarihte hangi kademeye geçeceğinizi ve terfinin hangi ayın maaş formunda bildirileceğini görün.',
    form: `
      <div class="calc-grid">
        <label>Mevcut derece<input type="number" name="degree" min="1" max="15" value="4" /></label>
        <label>Mevcut kademe<input type="number" name="rank" min="1" max="4" value="2" /></label>
        <label>Son kademe ilerleme (terfi) tarihi<input type="date" name="last" /></label>
        <label>Kaç yıl ileri<input type="number" name="years" min="1" max="30" value="10" /></label>
        <label>8 yıllık cezasız sayacın başlangıcı<small>Göreve başlama veya son ceza / bonus tarihi</small><input type="date" name="eight" /></label>
        <label class="check"><input type="checkbox" name="nopen" checked /> Bu sürede disiplin cezası almayacağımı varsay</label>
      </div>`,
    howTitle: 'Kademe ve derece ilerlemesi nasıl hesaplanır?',
    how: [
      'Her yıl terfi tarihinde kademe bir ilerler.',
      'Her derecede 3 kademe vardır; 3. kademeden sonra bir üst dereceye (sayıca küçük) ve 1. kademeye geçilir. 1. derecede 4 kademe vardır; 1/4 tavandır.',
      '8 yıl boyunca disiplin cezası almayan personele bir kademe ilerlemesi daha verilir. Ceza alınırsa 8 yıllık sayaç ceza tarihinden yeniden başlar.',
      'Uzman Öğretmen veya Başöğretmen unvanına geçişte bir defaya mahsus derece bir ilerler (kademe değişmez). Bu hesaplayıcı unvan değişikliğini hesaba katmaz.',
      'Terfi, tarihinin düştüğü dönemin Maaş Değişikliği Bildirim Formu’nda bildirilir (önceki ayın 15’i – bu ayın 14’ü).',
      'Derece ilerlemesi kadro ve öğrenim durumuna bağlı üst sınırlarla kısıtlanabilir; sonuçlar bilgilendirme amaçlıdır.',
    ],
    faq: [
      ['8 yıl cezasız kademe nedir?', 'Sekiz yıl boyunca disiplin cezası almayan personel, yıllık kademe ilerlemesine ek olarak bir kademe daha ilerler.'],
      ['Derece sınırına gelince ne olur?', 'Kademe ilerlemesi derecenin son kademesinde durursa bir üst dereceye geçilir. 1. derece 4. kademe tavandır, ötesinde ilerleme olmaz.'],
      ['Terfi hangi ayın maaşına yansır?', 'Terfi tarihi ayın 1’i ile 14’ü arasındaysa o ayın, 15’i veya sonrasındaysa bir sonraki ayın Maaş Değişikliği Bildirim Formu’nda bildirilir.'],
    ],
    automation:
      'OIDS Terfi Takibi her ay o dönemde terfisi gelen personeli listeler. “Terfiyi Uygula” ile kademe/derece ilerler, resmî terfi formu Excel olarak iner, değişiklik maaş formuna kendiliğinden yazılır. 8 yıl cezasız kademe hakkı da ayrıca işaretlenir.',
  },
]
