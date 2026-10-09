// Rehber yazıları (/rehber/<slug>). Kural: anlatılan her kural OIDS kodunda uygulanan kuraldır;
// emin olunmayan mevzuat ayrıntısı yazılmaz, "mutemet / güncel mevzuat ile teyit edin" denir.
// sections: [başlık, HTML gövde]. HTML güvenilir içeriktir (biz yazıyoruz), kaçışlanmaz.

export const GUIDES = [
  {
    slug: 'rapor-7-gun-kurali-maas-kesintisi',
    title: 'Raporda 7 Gün Kuralı: Öğretmen ve Memur Rapor Kesintisi Nasıl Hesaplanır?',
    h1: 'Raporda 7 gün kuralı ve maaş değişikliği formu',
    description:
      'Öğretmen ve memurlarda yıllık 7 günü aşan sağlık raporları nasıl sayılır, hafta sonu dahil mi, aşan günler hangi ayın maaş değişikliği formuna yazılır? Örneklerle.',
    lead:
      'Sağlık raporlarında yıl içindeki ilk 7 gün kesintisizdir; aşan günler Maaş Değişikliği Bildirim Formu ile bildirilir. Sayımın nasıl yapıldığını ve hangi aya yazıldığını örneklerle anlatıyoruz.',
    published: '2026-10-09',
    minutes: 5,
    tools: ['rapor-kesintisi-hesaplama'],
    modules: ['rapor-takibi', 'maas-degisikligi-bildirim-formu'],
    sections: [
      [
        'Kural kısaca',
        `<ul>
          <li>Sayım <strong>takvim yılı</strong> esaslıdır: 1 Ocak’ta sıfırlanır.</li>
          <li>Yıl içindeki <strong>ilk 7 rapor günü</strong> maaşa yansımaz.</li>
          <li><strong>8. günden itibaren</strong> her rapor günü maaşa yansır ve Maaş Değişikliği Bildirim Formu’nda bildirilir.</li>
          <li>Rapor süresi <strong>takvim günüyle</strong> sayılır; raporun kapsadığı cumartesi, pazar ve tatil günleri de toplama girer.</li>
        </ul>`,
      ],
      [
        'Günler nasıl sayılır?',
        `<p>Yıl içindeki bütün raporların kapsadığı günler tek bir listede toplanır. Aynı güne iki rapor denk geliyorsa (örneğin bir rapor bitmeden yenisi başlamışsa) o gün <strong>bir kez</strong> sayılır.</p>
        <p>Yılbaşını kapsayan bir raporun günleri ilgili yıllara ayrı ayrı yazılır. 30 Aralık – 2 Ocak arasındaki bir rapor, eski yıla 2 gün, yeni yıla 2 gün olarak sayılır.</p>
        <p>Yalnızca kadrolu öğretmen, memur ve yöneticiler bu hesaba girer. <strong>Ücretli öğretmenlerin</strong> raporlu günleri maaş formuna yazılmaz; bu günlerin dersleri ek ders puantajından düşülür.</p>`,
      ],
      [
        'Aşan günler hangi ayın formuna yazılır?',
        `<p>Maaş Değişikliği Bildirim Formu dönemi, <strong>önceki ayın 15’i ile içinde bulunulan ayın 14’ü</strong> arasıdır. Form, dönemin bittiği ayın adıyla anılır: 15 Eylül – 14 Ekim arası “Ekim formu”dur.</p>
        <p>Yıllık 7 günlük sınırın aşıldığı gün (yani 8. rapor günü):</p>
        <ul>
          <li>ayın <strong>1’i ile 14’ü</strong> arasındaysa o ayın formuna,</li>
          <li>ayın <strong>15’i veya sonrasındaysa</strong> bir sonraki ayın formuna yazılır.</li>
        </ul>`,
      ],
      [
        'Örnek',
        `<p>Bir öğretmen 2026’da şu raporları alıyor:</p>
        <div class="table-wrap"><table class="res-table">
          <thead><tr><th>Rapor</th><th>Tarih</th><th>Gün</th><th>Yıllık toplam</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>10.02 – 14.02</td><td>5</td><td>5</td></tr>
            <tr><td>2</td><td>13.02 – 16.02</td><td>2 yeni (13-14 Şubat zaten sayıldı)</td><td>7</td></tr>
            <tr><td>3</td><td>20.03 – 23.03</td><td>4</td><td>11</td></tr>
          </tbody>
        </table></div>
        <p>İlk 7 gün 16 Şubat’ta doluyor; 8. rapor günü <strong>20 Mart</strong>. 20 Mart ayın 15’inden sonra olduğu için aşan 4 gün <strong>Nisan formunda</strong> (15 Mart – 14 Nisan dönemi) bildirilir.</p>`,
      ],
      [
        'Dikkat edilecekler',
        `<ul>
          <li>Hangi ödeme kalemlerinden kesinti yapılacağı ve istisnalar (örneğin yatarak tedavi gibi durumlar) mevzuatla belirlenir. Kendi durumunuz için mutemetle ve güncel mevzuatla teyit edin.</li>
          <li>Rapor sonradan uzatılırsa veya iptal edilirse yıllık toplam değişir; aşan gün sayısını yeniden hesaplayın.</li>
          <li>Raporlu günler ders programında ve ek ders puantajında da dikkate alınmalıdır.</li>
        </ul>`,
      ],
    ],
    faq: [
      ['Raporda hafta sonu sayılır mı?', 'Evet. Rapor süresi takvim günüyle sayılır; raporun kapsadığı hafta sonu ve tatil günleri de yıllık toplama girer.'],
      ['7 gün hakkı ne zaman yenilenir?', 'Her yıl 1 Ocak’ta. Sayım takvim yılı esaslıdır.'],
      ['Ücretli öğretmenin raporu maaş formuna yazılır mı?', 'Hayır. Ücretli öğretmenin raporlu olduğu günlerin dersleri ek ders puantajından düşülür.'],
    ],
  },
  {
    slug: 'ek-ders-kbs-kodlari',
    title: 'Ek Ders KBS Kodları: 101, 102, 119, 121, 122, 123 Ne Anlama Gelir?',
    h1: 'Ek ders puantajında KBS kodları',
    description:
      'Ek ders puantajında 101 gündüz, 102 gece, 119 ve 121 nöbet, 122 ve 123 hazırlık (YEP) kodları ne zaman kullanılır? Ücretli ve ders tamamlama için örnekler.',
    lead:
      'Ek ders puantajı KBS’ye kod kod girilir. Ücretli öğretmen ile dış kurumdan görevlendirilen (ders tamamlama) öğretmenin hesabı farklıdır. Hangi saatin hangi koda yazıldığını örneklerle anlatıyoruz.',
    published: '2026-10-09',
    minutes: 6,
    tools: ['ek-ders-hesaplama'],
    modules: ['ek-ders-puantaji', 'otomatik-ders-programi'],
    sections: [
      [
        'Puantajda en sık kullanılan kodlar',
        `<div class="table-wrap"><table class="res-table">
          <thead><tr><th>Kod</th><th>Açıklama</th><th>Ne zaman?</th></tr></thead>
          <tbody>
            <tr><td>101</td><td>Gündüz</td><td>17:00’den önce biten hafta içi dersler</td></tr>
            <tr><td>102</td><td>Gece</td><td>17:00’de veya sonra biten dersler ve cumartesi-pazar dersleri</td></tr>
            <tr><td>119</td><td>Nöbet görevi (gündüz)</td><td>Hafta içi nöbet günleri (görevlendirme)</td></tr>
            <tr><td>121</td><td>Nöbet görevi (%25 fazla)</td><td>Hafta sonu nöbet günleri (görevlendirme)</td></tr>
            <tr><td>122</td><td>YEP (gündüz)</td><td>Hazırlık saati; gece dersi gündüzden fazla değilse</td></tr>
            <tr><td>123</td><td>YEP (gece)</td><td>Hazırlık saati; gece dersi gündüzden fazlaysa</td></tr>
          </tbody>
        </table></div>
        <p>KBS’de başka kodlar da vardır; burada okul puantajında en sık kullanılanları anlatıyoruz.</p>`,
      ],
      [
        'Ücretli öğretmen',
        `<ul>
          <li>Girilen <strong>her ders saati ek derstir</strong>: gündüz dersleri 101, gece dersleri 102.</li>
          <li>Her <strong>2 ders saatine 1 saat hazırlık</strong> (YEP) eklenir; buçuklu sonuç aşağı yuvarlanır (9 saate 4 YEP).</li>
          <li>YEP, gece dersi gündüzden fazlaysa 123, değilse 122 koduyla yazılır.</li>
        </ul>
        <p><strong>Örnek:</strong> Haftada 12 saat gündüz dersi olan ücretli öğretmen, 4 haftalık ayda 101 koduyla 48 saat, 122 koduyla 24 saat puantaja yazılır.</p>`,
      ],
      [
        'Dış kurum görevlendirmesi ve ders tamamlama',
        `<ul>
          <li>Haftalık <strong>ilk 15 saat maaş karşılığıdır</strong>; aşan saatler ek derstir.</li>
          <li>Ek dersin gece payı, gece derslerinin toplam ders içindeki oranıyla ayrılır (yuvarlanarak); kalanı gündüzdür.</li>
          <li>Her <strong>10 ders saatine 1 saat hazırlık</strong> (YEP) eklenir.</li>
          <li>Haftada <strong>2 saat sosyal kişilik hizmeti</strong> yazılır.</li>
          <li><strong>Rehberlik dersleri</strong> ek derse yazılmaz.</li>
          <li>Her nöbet günü 1 saat sayılır: hafta içi 119, hafta sonu 121.</li>
        </ul>
        <p><strong>Örnek:</strong> Haftada 18 saat gündüz, 4 saat gece dersi (toplam 22) olan ders tamamlama öğretmeninde 15 saat maaş karşılığı, 7 saat ek derstir. Gece payı 7 × 4 / 22 ≈ 1 saat (102), kalan 6 saat gündüzdür (101). YEP 22 / 10 = 2 saattir (122).</p>`,
      ],
      [
        'Raporlu ve devamsız günler',
        `<p>Öğretmenin gelmediği günlerin dersleri o haftanın hesabından düşülür; kısmi devamsızlıkta yalnızca girilmeyen saatler düşülür. Hesap haftalık yapıldığı için 15 saat sınırı ve YEP her hafta ayrı uygulanır.</p>`,
      ],
      [
        'Dikkat edilecekler',
        `<ul>
          <li>Ek ders ücretinin TL karşılığı memur maaş katsayısına göre her dönem değişir; tutarı KBS hesaplar.</li>
          <li>Kurumunuzun uygulaması ve güncel Ek Ders Kararı ile farklılık varsa mevzuatı esas alın.</li>
        </ul>`,
      ],
    ],
    faq: [
      ['Ek derste gece dersi ne demek?', 'Bitiş saati 17:00 veya sonrası olan dersler ile cumartesi ve pazar günü yapılan dersler gece dersi olarak 102 koduyla yazılır.'],
      ['Ücretli öğretmende hazırlık saati nasıl hesaplanır?', 'Her 2 ders saatine 1 saat; buçuk aşağı yuvarlanır. Haftada 9 saat derse 4 saat YEP.'],
      ['Ders tamamlamada ilk 15 saat neden yazılmaz?', 'Görevlendirmede haftalık ilk 15 saat maaş karşılığı sayılır; ek ders yalnızca aşan saatlerden doğar.'],
    ],
  },
  {
    slug: 'kademe-derece-ilerlemesi-8-yil-cezasiz',
    title: 'Kademe ve Derece İlerlemesi: Yıllık Terfi ve 8 Yıl Cezasız Kademe',
    h1: 'Kademe ve derece ilerlemesi nasıl işler?',
    description:
      'Kademe/derece terfisi nasıl ilerler, 3. kademeden sonra ne olur, 8 yıl cezasız ek kademe ne zaman verilir, terfi hangi ayın maaş formuna yazılır?',
    lead:
      'Her yıl bir kademe, derece dolunca bir üst derece ve sekiz yılda bir cezasız ek kademe. Terfi takviminin nasıl ilerlediğini ve maaş formuna nasıl yansıdığını anlatıyoruz.',
    published: '2026-10-09',
    minutes: 5,
    tools: ['kademe-terfi-hesaplama'],
    modules: ['terfi-takibi', 'maas-degisikligi-bildirim-formu'],
    sections: [
      [
        'Yıllık kademe ilerlemesi',
        `<p>Personel her yıl terfi tarihinde <strong>bir kademe</strong> ilerler. Her derecede 3 kademe vardır. 3. kademedeyken gelen ilerleme, personeli bir üst dereceye (sayıca küçük olan) ve o derecenin 1. kademesine taşır.</p>
        <p><strong>Örnek:</strong> 4/2 → 4/3 → 3/1 → 3/2 → 3/3 → 2/1 …</p>
        <p>1. derecede 4 kademe vardır ve <strong>1/4 tavandır</strong>; bundan sonra kademe ilerlemesi olmaz.</p>`,
      ],
      [
        '8 yıl cezasız kademe',
        `<p>Sekiz yıl boyunca disiplin cezası almayan personele, yıllık ilerlemeye ek olarak <strong>bir kademe daha</strong> verilir. Sayaç göreve başlama tarihinden ya da son ceza veya son 8 yıl ilerlemesinin uygulandığı tarihten başlar.</p>
        <p>Bu süre içinde ceza alınırsa sayaç <strong>ceza tarihinden yeniden başlar</strong>. 8 yıl ilerlemesi, yıllık ilerlemeyle aynı güne denk gelebilir; o yıl iki kademe ilerlenir.</p>`,
      ],
      [
        'Uzman Öğretmen ve Başöğretmen',
        `<p>Uzman Öğretmen veya Başöğretmen unvanına geçişte <strong>bir defaya mahsus derece bir ilerler</strong>; kademe değişmez. 1. derecedeki personelde derece ilerlemesi olmaz.</p>`,
      ],
      [
        'Terfi hangi ayın maaş formuna yazılır?',
        `<p>Maaş Değişikliği Bildirim Formu dönemi önceki ayın 15’i ile içinde bulunulan ayın 14’ü arasıdır. Terfi tarihi ayın 1–14’ü arasındaysa o ayın, 15’i veya sonrasındaysa bir sonraki ayın formunda bildirilir. 3 Kasım’daki terfi Kasım formuna, 20 Kasım’daki terfi Aralık formuna girer.</p>`,
      ],
      [
        'Dikkat edilecekler',
        `<ul>
          <li>Derece ilerlemesi kadro derecesi ve öğrenim durumuna bağlı üst sınırlarla kısıtlanabilir; ilerleme durduğunda personel kademe ilerlemesine devam edemeyebilir. Kendi durumunuz için güncel mevzuatı ve personel birimini esas alın.</li>
          <li>Terfi tarihinde yapılan düzeltmeler (askerlik, hizmet birleştirme vb.) sonraki bütün terfi tarihlerini kaydırır.</li>
        </ul>`,
      ],
    ],
    faq: [
      ['3. kademeden sonra ne olur?', 'Bir sonraki ilerlemede bir üst dereceye (örneğin 4’ten 3’e) ve 1. kademeye geçilir.'],
      ['8 yıl cezasız kademe ne zaman verilir?', 'Sayacın başladığı tarihten itibaren 8 yıl dolduğunda, bu sürede disiplin cezası alınmamışsa bir kademe ek ilerleme verilir.'],
      ['1. derece 4. kademeden sonra terfi var mı?', 'Hayır. 1/4 tavandır; kademe ilerlemesi durur.'],
    ],
  },
  {
    slug: 'maas-degisikligi-bildirim-formu-nasil-doldurulur',
    title: 'Maaş Değişikliği Bildirim Formu Nasıl Doldurulur? A–H Bölümleri',
    h1: 'Maaş Değişikliği Bildirim Formu nasıl doldurulur?',
    description:
      'Okul maaş değişikliği bildirim formunun A–H bölümleri: ayrılan, başlayan, terfi, kesinti, raporlu gün ve sendika. Hangi dönem, hangi bilgi, hangi belge.',
    lead:
      'Her ay bütçe bürosuna giden form sekiz bölümden oluşur. Hangi bölüme kimin yazılacağını, form döneminin nasıl hesaplandığını ve sık yapılan hataları anlatıyoruz.',
    published: '2026-10-09',
    minutes: 7,
    tools: ['rapor-kesintisi-hesaplama', 'kademe-terfi-hesaplama'],
    modules: ['maas-degisikligi-bildirim-formu', 'terfi-takibi'],
    sections: [
      [
        'Form dönemi',
        `<p>Form, <strong>önceki ayın 15’i ile içinde bulunulan ayın 14’ü</strong> arasındaki değişiklikleri bildirir ve dönemin bittiği ayın adıyla anılır. Ekim 2026 formu 15.09.2026 – 14.10.2026 dönemini kapsar. Ayın 15’i veya sonrasındaki bir değişiklik bir sonraki ayın formuna girer.</p>
        <p>Üst bilgide kurumun adı, banka şubesi, ilgili ay-yıl ve okulun saymanlık kodu yazılır. Formun altında düzenleyen ve okul müdürü imzası bulunur.</p>`,
      ],
      [
        'Bölümler ve içerikleri',
        `<div class="table-wrap"><table class="res-table">
          <thead><tr><th>Bölüm</th><th>Kim yazılır?</th><th>Bilgiler</th></tr></thead>
          <tbody>
            <tr><td>A</td><td>Mevcut personel sayısı</td><td>Geçen ayki sayı, bu ay giren, bu ay çıkan, bu ay ödeme yapılacak</td></tr>
            <tr><td>B</td><td>Ayrılan personel: geçen ay bordroda olup bu ay bordroya girmeyecek ayrılan veya aylıksız izne ayrılanlar</td><td>Personel no, ad soyad, T.C. no, görevden ayrıldığı tarih, ayrılma nedeni, belgeler</td></tr>
            <tr><td>C</td><td>Başlayan personel: bu ay ilk kez bordroya girecek yeni gelen veya aylıksız izinden dönenler</td><td>Personel no, ad soyad, T.C. no, IBAN, göreve başlama nedeni ve tarihi, belgeler</td></tr>
            <tr><td>D</td><td>Terfi edecek personel: bu ay intibak, derece ve kademe terfisi olanlar</td><td>Eski ve yeni derece/kademe, terfi tarihi, belgeler (terfi formu)</td></tr>
            <tr><td>E</td><td>Maaş değişikliği: aile ve çocuk yardımı, unvan ve kariyer basamağı, sosyal yardım ve tazminat değişiklikleri</td><td>Önceki durum (bordroda), yeni durum (MEBBİS’te), belgeler</td></tr>
            <tr><td>F</td><td>Kesintiler: icra, nafaka, ceza, ikraz gibi yasal kesintiler ve özel sigorta</td><td>Kesintinin nedeni ve miktarı, belgeler</td></tr>
            <tr><td>G</td><td>Raporlu gün: bu yıl 7 günü geçen ve daha önce kesintisi yapılmamış rapor günleri</td><td>Raporun başlama tarihi, 7 günden sonra kesinti yapılacak gün sayısı, belgeler</td></tr>
            <tr><td>H</td><td>Sendika değişikliği: bu ay sendikaya giren veya sendikadan çıkanlar</td><td>Ayrıldığı ve girdiği sendikanın adı, belgeler</td></tr>
          </tbody>
        </table></div>`,
      ],
      [
        'Bölüm bölüm ipuçları',
        `<ul>
          <li><strong>A:</strong> “Bu ay ödeme yapılacak” sayısı, geçen ayki sayı + giren − çıkan ile tutmalıdır. B ve C bölümlerindeki satır sayıları giren/çıkanla uyuşmalıdır.</li>
          <li><strong>C:</strong> IBAN eksik veya hatalı olursa ilk maaş gecikir; başlama yazısıyla birlikte kontrol edin.</li>
          <li><strong>D:</strong> Terfi tarihi dönem içinde olan herkes yazılır. Dönemi kaçırılmış bir terfi varsa sonraki forma eklenmelidir.</li>
          <li><strong>G:</strong> Yalnızca yıllık 7 günü aşan ve <em>daha önce bildirilmemiş</em> günler yazılır. Hesap için <a href="/rehber/rapor-7-gun-kurali-maas-kesintisi">raporda 7 gün kuralı</a> rehberine bakın.</li>
          <li><strong>Belgeler:</strong> Her satırın dayanağı olan belge (ayrılış/başlama yazısı, terfi formu, sağlık raporu, icra yazısı vb.) forma eklenir.</li>
        </ul>`,
      ],
      [
        'Sık yapılan hatalar',
        `<ul>
          <li>Ayın 15’inden sonraki bir değişikliği o ayın formuna yazmak.</li>
          <li>Aylıksız izne ayrılanı B’ye, izinden döneni C’ye yazmayı unutmak.</li>
          <li>Önceki ay bildirilmiş rapor günlerini tekrar G’ye yazmak.</li>
          <li>A bölümündeki sayılarla B/C satır sayılarının tutmaması.</li>
        </ul>`,
      ],
      [
        'OIDS formu nasıl dolduruyor?',
        `<p>OIDS her ay için bir taslak tutar ve ay boyunca şunları kendisi ekler:</p>
        <ul>
          <li><strong>B:</strong> Ayrılış yazısı hazırlanırken “maaş formuna ekle” seçiliyse personel satırı.</li>
          <li><strong>C:</strong> Yeni kadrolu personel kaydında başlama satırı (IBAN ve başlama nedeni sonradan girilir).</li>
          <li><strong>D:</strong> Dönemde terfisi gelen ve uygulanan kademe/derece değişiklikleri, terfi formu belge olarak.</li>
          <li><strong>G:</strong> Rapor girildikçe yıllık 7 günü aşan günler.</li>
        </ul>
        <p>A, E, F ve H bölümleri elle doldurulur. Form resmî şablonda Excel veya PDF olarak alınır.</p>`,
      ],
    ],
    faq: [
      ['Maaş değişikliği formu hangi tarihleri kapsar?', 'Önceki ayın 15’i ile içinde bulunulan ayın 14’ü arasını. Ekim formu 15 Eylül – 14 Ekim dönemini kapsar.'],
      ['Aylıksız izne ayrılan personel nereye yazılır?', 'B (ayrılan personel) bölümüne. İzinden dönüşünde C (başlayan personel) bölümüne yazılır.'],
      ['Raporlu gün bölümüne hangi günler yazılır?', 'Bu yıl içinde toplam 7 günü geçen ve daha önce kesintisi yapılmamış rapor günleri.'],
    ],
  },
  {
    slug: 'sorumluluk-sinavi-programi-hazirlama',
    title: 'Sorumluluk Sınavı Programı Nasıl Hazırlanır? Komisyon ve Gözetmen',
    h1: 'Sorumluluk sınavı programı nasıl hazırlanır?',
    description:
      'MEBBİS sorumlu ders listesinden sorumluluk sınavı takvimi, yazılı ve sözlü günleri, komisyon (müdür + 2 üye) ve gözetmen sayısı; çakışmasız program için adımlar.',
    lead:
      'Yüzlerce öğrencinin farklı sınıf seviyelerinden sorumlu olduğu dersleri, kimsenin aynı gün iki sınava girmeyeceği şekilde planlamak için adım adım yöntem.',
    published: '2026-10-09',
    minutes: 6,
    modules: ['sinav-programi', 'kelebek-sinav-sistemi'],
    sections: [
      [
        '1. Listeyi MEBBİS’ten alın',
        `<p>MEBBİS’teki <strong>“Öğrencilerin Sorumlu Olduğu Dersler”</strong> raporunu Excel olarak indirin. Listede sınıf başlıkları (“9. Sınıf / A”) altında her öğrencinin numarası, adı, dersin sınıf seviyesi ve ders adı bulunur. Bir öğrencinin birden fazla sorumlu dersi alt alta gelir.</p>
        <p>Önce aynı dersi farklı adlarla yazılmış satırları (örneğin “Yabancı Dil” ve “İngilizce”) birleştirin; aksi halde aynı ders iki kez planlanır.</p>`,
      ],
      [
        '2. Dersleri öğrenci sayısına göre sıralayın',
        `<p>En çok öğrencisi olan dersi önce yerleştirin. Kalabalık dersler en çok çakışma yaratır; bunlar boş takvime yerleşince küçük dersler aradaki günlere kolayca sığar.</p>
        <p>Her ders için ilk uygun iş günü, o dersin <strong>hiçbir öğrencisinin aynı gün başka sınavı olmayan</strong> gündür. Hiç uygun gün yoksa sınav aralığını uzatmak gerekir.</p>`,
      ],
      [
        '3. Yazılı ve sözlü günlerini ayırın',
        `<p>Yabancı dil ile Türk dili ve edebiyatı gibi yazılı ve sözlü sınavı olan dersler için sözlü sınav ayrı bir güne konur; <strong>yazılı ve sözlü aynı gün olamaz</strong>. Sözlü günü seçilirken de öğrencilerin o gün başka sınavı olmamasına dikkat edilir.</p>`,
      ],
      [
        '4. Komisyonu kurun',
        `<ul>
          <li>Komisyon başkanı <strong>okul müdürü</strong>dür.</li>
          <li>Her ders için <strong>2 üye</strong> seçilir; üyeler başkandan ve birbirinden farklı olmalı, tercihen dersin branşından öğretmen olmalıdır.</li>
          <li>Yabancı dil derslerinde okulun 1. veya 2. yabancı dil branşındaki öğretmenler seçilir.</li>
        </ul>`,
      ],
      [
        '5. Gözetmen sayısını belirleyin',
        `<p>Yazılı sınavlarda her tam 30 öğrenci için bir gözetmen planlanır (30’dan az öğrencili sınavda ek gözetmen gerekmez). Gözetmen, mümkünse dersin branşı dışından seçilir. Sözlü sınavda gözetmen yoktur.</p>
        <p>Görevlerin dönem boyunca öğretmenler arasında dengeli dağılması için her öğretmenin kaç komisyon ve gözetmenlik görevi aldığını sayın.</p>`,
      ],
      [
        '6. Programı ilan edin',
        `<p>Tarih, gün, saat, sözlü tarihi, ders ve komisyonun bulunduğu programı öğrencilere ve öğretmenlere duyurun. Öğrenci bazında kontrol için “aynı gün iki sınavı olan öğrenci var mı?” sorusunu son kez sorun.</p>`,
      ],
      [
        'OIDS bunu nasıl yapıyor?',
        `<p>OIDS, MEBBİS Excel’ini okur, ders adlarını eşleştirir ve programı yukarıdaki sırayla otomatik çıkarır: öğrenci sayısına göre sıralama, öğrencisi çakışmayan ilk iş günü, ayrı sözlü günü. Elle yerleştirmede aynı gün sınavı olan öğrencileri isimleriyle uyarır, yazılı ve sözlüyü aynı güne koydurmaz. Komisyon için branşa göre üye, gözetmen için branş dışı öğretmen önerir ve görev sayılarını tutar. Program Excel, PDF ve JPEG olarak alınır.</p>`,
      ],
    ],
    faq: [
      ['Sorumluluk sınavı komisyonu kaç kişidir?', 'Başkan olarak okul müdürü ve dersin branşından 2 üye.'],
      ['Sorumluluk sınavında kaç gözetmen gerekir?', 'Yazılı sınavda her tam 30 öğrenci için bir gözetmen planlanır. Sözlü sınavda gözetmen yoktur.'],
      ['Yazılı ve sözlü sınav aynı gün yapılabilir mi?', 'Hayır. Yazılı ve sözlü sınavı olan derslerde sözlü ayrı bir güne konur.'],
    ],
  },
  {
    slug: 'ortak-sinav-takvimi-hazirlama',
    title: 'Ortak Sınav Takvimi Nasıl Hazırlanır? Günlük Sınır ve Zor Dersler',
    h1: 'Ortak sınav takvimi nasıl hazırlanır?',
    description:
      'Ortak yazılı sınav takvimi hazırlarken sınıf seviyesi başına günlük sınav sınırı, zor derslerin dağıtımı ve şube çakışmaları. Adım adım yöntem.',
    lead:
      'Ortak sınav haftalarında aynı seviyedeki tüm şubelerin aynı dersi aynı gün yazması gerekir. Öğrencileri yormayan, çakışmasız bir takvim için kurallar.',
    published: '2026-10-09',
    minutes: 4,
    modules: ['sinav-programi', 'otomatik-ders-programi'],
    sections: [
      [
        'Önce sınav aralığını belirleyin',
        `<p>Okulun sınav haftalarını (dönem içindeki sınav tarihi aralığını) belirleyin. Sınavlar yalnızca bu aralıktaki iş günlerine konur.</p>`,
      ],
      [
        'Ders listesini ders programından çıkarın',
        `<p>Hangi seviyede hangi derslerin okutulduğu ders programında zaten vardır. Ortak sınav, bir dersi alan <strong>tüm şubeler için aynı gün</strong> yapılır; bu yüzden ders bazında planlanır, şube bazında değil.</p>`,
      ],
      [
        'Günlük sınır koyun',
        `<p>Bir sınıf seviyesine günde en fazla <strong>4 sınav</strong> konması öğrencileri korur. Bir şubenin aynı gün iki ayrı ortak sınavı olmamalıdır.</p>`,
      ],
      [
        'Zor dersleri yayın',
        `<p>Dersleri zor, orta ve kolay diye gruplayın ve önce zor dersleri yerleştirin. Bir zor dersin bir gün öncesinde veya sonrasında başka bir zor ders olmamasına çalışın. Takvim darsa bu tercih esnetilir, günlük sınır korunur.</p>`,
      ],
      [
        'OIDS bunu nasıl yapıyor?',
        `<p>OIDS dersleri ve şubeleri yayınlanmış ders programından alır. Otomatik planlamada zor → orta → kolay sırasıyla yerleştirir, zor dersleri mümkünse ardışık günlere koymaz, seviye başına günlük 4 sınav sınırını uygular. Bir şubeye aynı gün ikinci sınav konamaz. Takvim iki haftalık görünümde düzenlenir; Excel, PDF ve JPEG olarak alınır.</p>`,
      ],
    ],
    faq: [
      ['Bir günde kaç ortak sınav yapılmalı?', 'Öğrencileri yormamak için bir sınıf seviyesine günde en fazla 4 sınav önerilir; OIDS bu sınırı uygular.'],
      ['Zor dersler art arda günlere konabilir mi?', 'Mümkünse konmaz. Takvim yetmezse bu tercih esnetilir.'],
    ],
  },
  {
    slug: 'kelebek-sinav-sistemi-nedir',
    title: 'Kelebek Sınav Sistemi Nedir? Oturma Planı Nasıl Hazırlanır?',
    h1: 'Kelebek sınav sistemi nedir, oturma planı nasıl hazırlanır?',
    description:
      'Kelebek sistemi: farklı sınıflardaki öğrencileri salonlara karışık oturtarak kopyayı önleyen yöntem. Salon kapasitesi, harmanlama, gözetmen ve yoklama adımları.',
    lead:
      'Kelebek sisteminde aynı sınıftan öğrenciler yan yana oturmaz; farklı sınıflar salonlara karışık yerleştirilir. Oturma planını adım adım nasıl hazırlayacağınızı anlatıyoruz.',
    published: '2026-10-09',
    minutes: 4,
    modules: ['kelebek-sinav-sistemi', 'sinav-programi'],
    sections: [
      [
        'Kelebek sistemi nedir?',
        `<p>Ortak sınavlarda öğrenciler kendi sınıflarında değil, farklı sınıflardan öğrencilerle karışık olarak salonlara oturtulur. Amaç, yan yana oturan öğrencilerin aynı sınavı aynı sırayla çözmesini engellemektir. Adını, öğrencilerin salonlar arasında “dağılmasından” alır.</p>`,
      ],
      [
        '1. Salonları ve kapasiteyi tanımlayın',
        `<p>Her salonun sıra düzenini (sütun, sıra, sıra başına kişi) çıkarın; kullanılmayan sıraları düşün. Salonların toplam kapasitesi, sınava girecek öğrenci sayısından az olmamalıdır.</p>`,
      ],
      [
        '2. Öğrencileri harmanlayın',
        `<p>Sınava girecek sınıfların listelerini sıralayın ve <strong>her sınıftan birer öğrenci alarak</strong> tek bir liste oluşturun: 9-A’nın 1.’si, 9-B’nin 1.’si, 9-C’nin 1.’si, sonra her sınıfın 2.’si… Bu listeyi salonların sıralarına sırayla yerleştirin. Böylece art arda oturan öğrenciler farklı sınıflardan olur.</p>
        <p>Sınıf mevcutları çok farklıysa listenin sonunda aynı sınıftan öğrenciler art arda gelebilir; bu kısımları elle karıştırın veya farklı seviyeden sınıfları birlikte planlayın.</p>`,
      ],
      [
        '3. Gözetmen atayın ve yoklama alın',
        `<p>Her salona bir gözetmen atayın; sınav günü dersi olmayan öğretmenleri tercih edin. Oturma planı salona asılır, gözetmen yoklamayı plan üzerinden alır.</p>`,
      ],
      [
        'OIDS bunu nasıl yapıyor?',
        `<p>OIDS’te salonlar sıra düzeniyle tanımlanır, kapasite otomatik hesaplanır. Oturum için salonları ve sınıfları seçtiğinizde öğrenciler soyadı sırasıyla, sınıflar arasında birer birer harmanlanarak salonlara yerleşir. Her salona gözetmen atanır, yoklama oturma planı üzerinden alınır. Plan salon, sıra no, öğrenci ve sınıf bilgisiyle Excel ve PDF olarak çıkar.</p>`,
      ],
    ],
    faq: [
      ['Kelebek sınav sistemi ne işe yarar?', 'Farklı sınıflardan öğrencileri karışık oturtarak yan yana oturanların aynı sınavı birlikte çözmesini engeller.'],
      ['Salon kapasitesi yetmezse ne olur?', 'Plan oluşturulamaz; salon eklemek veya oturumu bölmek gerekir.'],
    ],
  },
  {
    slug: 'nobet-cizelgesi-hazirlama',
    title: 'Öğretmen Nöbet Çizelgesi Nasıl Hazırlanır? Haftalık Rotasyon',
    h1: 'Öğretmen nöbet çizelgesi nasıl hazırlanır?',
    description:
      'Nöbet yerlerini belirleme, haftalık nöbet çizelgesi, öğretmenleri yerler arasında döndürme, raporlu öğretmen ve yazdırılacak çizelge için pratik yöntem.',
    lead:
      'Nöbet çizelgesini her hafta sıfırdan hazırlamak yerine bir kez kurup haftadan haftaya döndürmek mümkün. Adil ve sürdürülebilir bir nöbet düzeni için adımlar.',
    published: '2026-10-09',
    minutes: 4,
    modules: ['nobet-programi', 'rapor-takibi'],
    sections: [
      [
        '1. Nöbet yerlerini belirleyin',
        `<p>Bahçe, katlar, kantin, giriş gibi nöbet yerlerini ve her yerde kaç öğretmen gerektiğini belirleyin. Yerleri katlara göre sıralamak, sonraki haftalarda döndürmeyi kolaylaştırır.</p>`,
      ],
      [
        '2. İlk haftayı yerleştirin',
        `<p>Günler satır, nöbet yerleri sütun olacak şekilde bir tablo hazırlayın. Her öğretmene <strong>günde en fazla bir nöbet</strong> verin. Öğretmenin dersinin bulunduğu günleri tercih etmek, okulda olduğu güne nöbet düşmesini sağlar.</p>`,
      ],
      [
        '3. Haftadan haftaya döndürün',
        `<p>Sonraki haftaya aynı tabloyu kopyalayın ve her öğretmeni bir sonraki nöbet yerine kaydırın. Böylece kimse dönem boyunca hep aynı yerde (örneğin hep bahçede) kalmaz. Sabit kalması gereken kişi veya yerleri (örneğin engel durumu nedeniyle zemin kat) dönüşün dışında tutun.</p>`,
      ],
      [
        '4. Dengeyi kontrol edin',
        `<p>Dönem içinde her öğretmenin kaç nöbet tuttuğunu sayın. Fark büyüdüğünde az nöbet tutanları boşalan yerlere yazın. Raporlu veya izinli öğretmenin nöbeti için yedek belirleyin.</p>`,
      ],
      [
        '5. Çizelgeyi yayınlayın',
        `<p>Çizelgenin altına okulun nöbet kurallarını ve müdür onayını ekleyip öğretmenler odasına asın. Siyah-beyaz, okunaklı bir düzen fotokopide bozulmaz.</p>`,
      ],
      [
        'OIDS bunu nasıl yapıyor?',
        `<p>OIDS’te nöbet yerleri bir kez tanımlanır, ilk hafta ızgarada yerleştirilir. “Sonraki haftaya aktar” haftayı kopyalar ve isterseniz her öğretmeni bir sonraki yere kaydırır; kilitlediğiniz kişi ve yerler sabit kalır. Bir kişiye aynı gün ikinci nöbet verilmez, öğretmen listesinde herkesin nöbet sayısı görünür. Çizelge nöbet kuralları ve müdür imzasıyla Excel ve PDF olarak çıkar.</p>`,
      ],
    ],
    faq: [
      ['Bir öğretmene günde kaç nöbet verilir?', 'En fazla bir. OIDS aynı gün ikinci nöbete izin vermez.'],
      ['Nöbet yerleri nasıl adil dağıtılır?', 'Her hafta öğretmenleri bir sonraki nöbet yerine kaydırarak ve dönem boyunca nöbet sayılarını dengeleyerek.'],
    ],
  },
  {
    slug: 'e-okul-ders-programi-aktarma',
    title: 'Ders Programını e-Okul’a Aktarma: Tarayıcı Eklentisiyle Adım Adım',
    h1: 'Ders programını e-Okul’a nasıl aktarırsınız?',
    description:
      'Hazırlanan ders programını e-Okul Kurum İşlemleri › Ders Programı ekranına tek tek girmeden aktarmak için OIDS tarayıcı eklentisinin kurulumu ve kullanımı.',
    lead:
      'e-Okul’a ders programını şube şube, saat saat elle girmek saatler sürer. OIDS’te hazırlanan programı e-Okul ekranına dolduran eklentiyi nasıl kuracağınızı ve kullanacağınızı anlatıyoruz.',
    published: '2026-10-09',
    minutes: 5,
    modules: ['e-okul-eklentisi', 'otomatik-ders-programi'],
    sections: [
      [
        'Ne yapar, ne yapmaz?',
        `<ul>
          <li>Açık e-Okul ders programı ekranında, seçili şubenin her gün/saat hücresindeki <strong>ders seçimini</strong> OIDS programına göre yapar.</li>
          <li>MEBBİS şifrenizi <strong>istemez</strong>; tarayıcıda açık olan oturumunuzu kullanır.</li>
          <li><strong>Kaydet’e basmaz.</strong> Doldurulan ekranı kontrol edip kaydetmek size kalır.</li>
          <li>Her seferinde bir şubeyi doldurur.</li>
        </ul>`,
      ],
      [
        'Kurulum (bir kez)',
        `<ol>
          <li>OIDS’te Ders Programı sayfasında <strong>e-Okul eklentisi › Eklentiyi indir</strong> deyin; zip dosyası iner.</li>
          <li>Zip’i açın; <code>oids-eokul</code> klasörü çıkar.</li>
          <li>Chrome’da adres çubuğuna <code>chrome://extensions</code> yazın.</li>
          <li>Sağ üstten <strong>Geliştirici modu</strong>nu açın.</li>
          <li><strong>Paketlenmemiş öğe yükle</strong> deyip klasörü seçin.</li>
        </ol>
        <p>Chrome, mağaza dışındaki eklentilerin tek tıkla kurulmasına izin vermediği için bu adımlar gerekir.</p>`,
      ],
      [
        'Sınıfları e-Okul’dan alma (isteğe bağlı)',
        `<p>e-Okul’daki şube listesini OIDS’e aktarmak için e-Okul ders programı ekranı açıkken eklentide <strong>Sınıfları e-Okul’dan al</strong> deyin. Çok programlı meslek liselerinde şubeler “AMP-A”, “ATP-A” gibi program adıyla yazılır.</p>`,
      ],
      [
        'Programı aktarma',
        `<ol>
          <li>OIDS’te programı yayınlayın ve <strong>Bu programı eklentiye yükle</strong> deyin (ya da eklentide <strong>Açık OIDS sekmesinden al</strong>).</li>
          <li>MEBBİS’ten e-Okul’a girin: <strong>Kurum İşlemleri › Ders İşlemleri › Ders Programı</strong>.</li>
          <li>Şubeyi seçip <strong>Listele</strong> deyin.</li>
          <li>Eklentide <strong>Açık sayfayı doldur</strong> deyin. İsterseniz “programda boş olan saatleri temizle” seçeneğini açın.</li>
          <li>Doldurulan hücreler yeşil, eşleşmeyenler kırmızı işaretlenir. Kontrol edip e-Okul’da <strong>Kaydet</strong>’e basın.</li>
          <li>Sonraki şube için 3–5. adımları tekrarlayın.</li>
        </ol>`,
      ],
      [
        'Eşleşmeyen dersler',
        `<p>Eklenti dersleri ad benzerliği veya ders koduyla eşleştirir. OIDS’teki ders adı e-Okul’dakinden çok farklıysa hücre kırmızı kalır ve eklenti eşleşmeyen saatleri listeler; bunları elle seçin veya OIDS’teki ders adını e-Okul’daki adla aynı yapın. Seçmeli derslerde aynı saatte birden fazla ders varsa eklenti e-Okul’da karşılığı olanı seçer ve not düşer.</p>`,
      ],
    ],
    faq: [
      ['Eklenti MEBBİS şifremi görür mü?', 'Hayır. Şifre istemez; tarayıcıda açık olan e-Okul oturumunuzu kullanır.'],
      ['Eklenti programı kendisi kaydeder mi?', 'Hayır. Ekranı doldurur, kontrol edip Kaydet’e basmak size kalır.'],
      ['Hangi tarayıcıda çalışır?', 'Chrome ve Chrome tabanlı tarayıcılarda geliştirici modunda yüklenen eklenti olarak.'],
    ],
  },
]
