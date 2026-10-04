'use strict';

// Yapay zekâ asistanının "bunu nasıl yaparım" sorularına cevap verebilmesi için
// OIDS'in menü menü tanıtımı. Kaynaklar: uygulama içi sayfa yardımları
// (frontend/src/constants/pageHelp.ts), menü ağacı (frontend/src/nav/tenantMenu.tsx),
// lisans planları (src/config/licensePlans.js) ve README.
// Ekranlar değiştiğinde burası da güncellenmeli; asistan buranın dışına çıkmaz.

const PRODUCT_GUIDE = `=== OIDS NEDİR ===
OIDS, ortaokul ve liseler için web tabanlı okul idaresi yazılımıdır. Her kurum kendi hesabıyla (kiracı) çalışır; hesaba bağlı okullar, kullanıcılar ve yetki grupları vardır. Panel okul yöneticileri içindir.
Öğretmenler için ayrı bir mobil uygulama vardır: öğrenci numarasıyla arama ve disiplin bildirimi (öğretmen notu) gönderme. Panelin adresini telefon tarayıcısında açmak mobil uygulama değildir; uygulamanın kurulması gerekir.
Hangi menülerin açık olduğu lisans planına bağlıdır. Modülü kapalı hesapta o menü hiç görünmez.

=== ARAYÜZ VE GENEL KULLANIM ===
- Sol menü grupları: Ana Sayfa, Temel Tanımlar, Personel İşleri, Programlar, Öğrenci İşleri, Rehberlik, Sistem. Menünün üstünde "Menülerde ara" kutusu vardır.
- Sol menünün altındaki "Menüyü düzenle" hesap yöneticisinde ve platform yöneticisinde görünür; menü sırasını, gruplarını ve gizlenecek öğeleri hesapta tüm kurum, platformda tüm yöneticiler için ayarlar.
- Üst çubuk: sayfa başlığı, soru işareti düğmesi (o sayfanın yardımı), aktif okul seçici, açık/koyu tema, bildirim çanı, Profilim, Çıkış.
- Sayfalar liste + arama + filtre düzenindedir. Yeni / Düzenle / Sil düğmeleri kullanıcının yetki grubuna göre görünür; görünmüyorsa yetki eksiktir (Sistem > Yetkilendirme).
- Çoğu ekran seçili okula göre çalışır. Kayıt görünmüyorsa önce üst çubuktan doğru okul seçilmelidir.
- Birçok listede "Filtre alanları" düğmesi vardır; hangi alanların görünüp filtreleneceğini seçer ve tercih o tarayıcıda kullanıcıya özel saklanır.

=== TEMEL TANIMLAR ===
Okullar (Temel Tanımlar > Okullar): Hesaba bağlı okul kayıtları.
- Nasıl eklenir: Yeni Okul > il ve ilçe seç > katalogdan okul adını seç > okul katalogda yoksa "Okul listede yok, yeni ad gireceğim" kutusunu işaretle ve adı yaz > kademe ve okul kodunu kontrol et > Kaydet. Katalogdan seçilende MEB kurum kodu kendiliğinden dolar.
- Okul sayısı plana bağlıdır: Standart 1, Premium en fazla 3. Hesapta en az bir okul kalmak zorundadır; tek okul varken silme kapalıdır.
- Düzenle formundan okul logosu yüklenir; logosu olan okulun e-postalarında bu logo kullanılır. "Okul müdürü" alanı evraklarda yazan müdür adıdır, hesabı açan kişi olmak zorunda değildir.
- Birinci ve ikinci yabancı dil alanları, sorumluluk sınavında Yabancı Dil ve İkinci Yabancı Dil derslerinin öğretmenini belirler.
Sınıflar (Temel Tanımlar > Sınıflar): Sınıf ve şube tanımları. Ders programı ve öğrenci ataması bu kayda dayanır.
- Nasıl eklenir: Yeni kayıt > sınıf düzeyi, şube ve kapasite > Kaydet.
- e-Okul ders programı sayfasındaki sınıf şube listesi, eklentideki "Sınıfları e-Okul'dan al" ile okula yazılır. Tek programda ad 9/A kalır. AMP ve ATP gibi birden fazla program varsa şube AMP-A biçiminde açılır.
Öğrenciler (Temel Tanımlar > Öğrenciler): Öğrenci kayıtları, sınıf ataması, kayıt durumu.
- Nasıl eklenir: Yeni Öğrenci > kimlik, sınıf, anne/baba adı, veli iletişim bilgileri > istenirse fotoğraf > kayıt durumu > Kaydet.
- Ad, numara veya T.C. ile arama yapılır. e-Okul Excel'i içe aktarılabilir, liste Excel/PDF olarak indirilebilir.
- Doğum tarihi girilince yaş hesaplanır; kayıtlar her gece doğum günlerine göre güncellenir.
Öğretmenler (Temel Tanımlar > Öğretmenler): Öğretmen kadrosu, branş ve okul bağlantıları.
- Nasıl eklenir: Yeni Öğretmen > kimlik, doğum tarihi, branş, iletişim > Kaydet.
- Satıra tıklanınca listede görünmeyen bilgiler açılır. Okul müdürü bilgisi, seçili okula müdür rolüyle atanmış hesaptan gelir.
Diğer Personeller (Temel Tanımlar > Diğer Personeller): Öğretmen dışı personel (memur, hizmetli vb.).
- Nasıl eklenir: Yeni kayıt > görev/kategori > Kaydet.
Dersler (Temel Tanımlar > Dersler): Ders programında kullanılacak ders tanımları.
- Nasıl eklenir: Yeni Ders > ad, kod, varsa haftalık saat > Kaydet.
Eğitim Öğretim Yılları (Temel Tanımlar > Eğitim Öğretim Yılları): Aktif yıl ve dönemler.
- Nasıl eklenir: Yeni yıl > başlangıç ve bitiş tarihi > aktif yılı işaretle > Kaydet. Yayınlanan ders programı aktif yılın resmi programına yazılır.

=== PERSONEL İŞLERİ ===
Terfi Takibi (Personel İşleri > Terfi Takibi): Derece/kademe ilerlemesi, 8 yıllık cezasızlık bonusu, kariyer terfisi.
- Ay seçilerek o dönemin terfileri görülür; dönem seçilen ayın 14'ü ile önceki ayın 15'i arasıdır.
- "Terfiyi Uygula" kademeyi, gerekiyorsa dereceyi ilerletir, süreyi sonraki yıla alır ve formu indirir. Terfi tarihini değiştirmek yalnızca kaydeder, form indirmez; sebep yazmak zorunludur. Sürekli seçilirse takvim yeni tarihe göre devam eder, tek seferlikte sıradaki yıllık takvim değişmez.
- Cezasız 8 yıl geçen personele kademe bonusu uygulanır; ceza tarihi girilirse sayaç sıfırlanır. Uzman Öğretmen / Başöğretmen olana tek seferlik derece -1 uygulanır.
- Maaş formunun D bölümünde eklenecek belge "Terfi Formu"dur. Dönemi kaçırmış ve uzmanlık terfisi verilmiş personel D bölümünde kalır.
Öğretmen Evrak Arşivi (Personel İşleri > Öğretmen Evrak Arşivi): Belge yükleme ve indirme.
- Nasıl yapılır: Öğretmeni seç > belge türünü seç > dosyayı yükle > Kaydet.
Rapor Takibi (Personel İşleri > Rapor Takibi): Personelin izin ve rapor günleri.
- Nasıl yapılır: Personeli seç > izin türü ve tarih aralığı > Kaydet.
- Ders programı bağı: "X şu gün gelemiyor / raporlu" bir ders programı kısıtıdır (teacher_unavailable). Rapor kaydının kendisi bu menüde açılır. Rapor ve izin günleri ek ders önerisini de düşürür.
Nöbet Programı (Personel İşleri > Nöbet Programı): Haftalık nöbet yerleri ve öğretmen atamaları.
- Nasıl yapılır: Nöbet yerlerini (koridor, bahçe vb.) tanımla > hafta görünümünde hücreye tıklayıp öğretmeni seç > gerekirse kapasiteyi düzenle.
- Çizelge kart düzeninde, siyah-beyaz basılacak Excel ve PDF olarak iner; açıklama alanına nöbet kuralları yazılır.
- Ders programı bağı: "Şu öğretmen nöbet tutmasın" (teacher_no_duty) ve "nöbet gününde en fazla N saat ders" (teacher_duty_day_max_hours) ders programı kısıtıdır. Nöbet programı yayındaki ders programına bakar.
Ek Ders Puantajı (Personel İşleri > Ek Ders Puantajı): Ücretli öğretmen ve dış kurum görevlendirmesinin aylık devamsızlığı.
- Saat nasıl bulunur: Yayındaki haftalık ders slotlarının ay içinde kaç kez tekrarladığına göre tahmini ders yükü önerilir; rapor ve izin günleri öneriyi düşürür. Kesin MEBBİS hesabı değildir.
- Devamsızlık nasıl girilir: Ücretli veya Dış kurum sekmesini aç > öğretmeni seç > takvimde güne tıklayıp nedeni yaz. Kurumun kendi kadrolu personeli bu ekranda yoktur.
- Ücretli öğretmen girdiği her saatin ek dersini alır. Takvimde günlerin üstünde haftalık ders saati görünür. Her 2 derse 1 eğitim-öğretim yerine geçen saat vardır; buçuk aşağı yuvarlanır, günlere dengeli dağıtılır, takvimde gösterilmez, puantaja yazılır. Devamsızlık kısmi olabilir ve kısmi saat puantajdan düşülür.
- Dış kurum görevlendirmesinde haftada ilk 15 saat maaş karşılığıdır, üstü ek derstir. Rehberlik dersi ek dersten sayılmaz. Haftada 2 saat sosyal kişilik hizmeti, girilen her 10 saat için 1 saat hazırlık/planlama (YEP) vardır. Nöbet ücreti nöbet programındaki görevden gelir. Hafta sonu ve 17:00'den sonraki ders gece kodudur. KBS kodları: gündüz 101, gece 102, nöbet gündüz 119, nöbet yüzde 25 fazla 121, YEP gündüz 122, YEP gece 123.
İşçi / TYP Puantaj (Personel İşleri > İşçi / TYP Puantaj): İşçi ve TYP personelinin devamı. Öğretmen ek dersinden ayrıdır.
- Nasıl yapılır: Tarihi seç > personelin devam durumunu işaretle > Kaydet.
Norm Kadro sayfası vardır ama sol menüde listelenmez; branş bazında norm ve mevcut kadro girilir, Excel/PDF çıktı ve maaş değişikliği formu alınır.

=== PROGRAMLAR ===
Otomatik Ders Programı (Programlar > Otomatik Ders Programı): Haftalık ders programını üreten ekran. Yapay zekâ asistanı da bu ekrandadır.
- Programı çözücü (OR-Tools) üretir, yapay zekâ üretmez. Asistan serbest metni kısıta çevirir, kullanıcı onaylar, çözücü uygular.
- Adımlar: 1) Okul saatlerinde başlangıç saatini ve ders dakikasını gir; her teneffüsü ayrı yaz ("Tüm teneffüslere ata" 1. teneffüsün süresini diğerlerine kopyalar); cumartesi/pazar işaretli değilse zaman tablosunda görünmez. 2) Kültür dersi ile meslek/atölye dersinin günlük en fazla saatini ayrı ayrı yaz; atölye dersini ders havuzunda Meslek olarak işaretle. 3) Ders havuzuna dersleri ekle; aynı sınıf için birden fazla saat yazılabilir, bu her şubeye otomatik ders eklemez. 4) Ders ve öğretmen adımında hangi şubede kimin gireceğini seç. 5) İstekler sekmesinde kuralları düz Türkçe yaz. 6) Okul saatlerinde dağıtım süresi, karnıyarık süresi, blok kuralları ve kıyaslanacak algoritmaları gir; cezası düşük olan algoritma yazılır. 7) Programı oluştur, ders programında sürükleyerek düzelt, yayınla.
- Hazır program varsa Ders programı sekmesinden PDF veya Excel içe aktarılır (Bilsan öğretmen programı ve e-Okul şube programı PDF'leri okunur). Aynı sekmeden tek ders, görünen şube/öğretmen/mekân ya da tüm taslak silinebilir; yayındaki resmi program da şube, öğretmen veya okulun tamamı olarak silinebilir.
- Excel menüsünden şube, öğretmen, öğrenci veya mekân programı indirilir.
- Kesin kurallar asla ihlal edilmez; çelişirse çözücü hangilerinin çeliştiğini söyler. Esnek kurallara önem puanına göre uyulur.
- Taslak yayınlanınca o yılın resmi ders programına yazılır. Nöbet, sınav ve ek ders yayındaki programa bakar; taslak tek başına onları güncellemez.
Sınav Programı Hazırlama (Programlar > Sınav Programı Hazırlama): Ortak sınav ve sorumluluk sınavı.
- Ortak sınav: ders programından gelen dersi seç > takvimde güne tıklayıp yerleştir > istenirse tarih aralığı seçip otomatik program oluştur.
- Sorumluluk sınavı: MEBBİS "Öğrencilerin Sorumlu Olduğu Dersler" Excel'ini içe aktar > önizlemede eşleşmeleri kontrol et (katalogda olmayan dersler önce eklenir) > dersi seçip takvimde güne tıklayarak tüm öğrenciler için tarihlendir. Yerleşen ders basılı tutulup başka güne sürüklenebilir, "Saat ekle" ile saat girilir.
- Komisyon başkanı seçili okulun müdürüdür; iki üye ders branşına göre önerilir; her 30 öğrenci için bir gözetmen önerilir. İngilizce, ikinci yabancı dil, Türk Dili ve Edebiyatı ve Türkçe'de yazılı ve sözlü ayrı günlere konur, sözlüde gözetmen yoktur. Aynı öğrencinin iki sınavı aynı güne gelirse sistem uyarır.
- Şubedeki dersin öğretmeni yayındaki ders programından bulunur.
Kelebek Sistemi (Programlar > Kelebek Sistemi): Sınav salonu, oturma düzeni ve gözetmen planı.
- Nasıl yapılır: Sınav/sınıf seçimini yap > salon ve sıra düzenini oluştur > yazdır veya dışa aktar.

=== ÖĞRENCİ İŞLERİ ===
DYK Devamsızlık Takibi (Öğrenci İşleri > DYK Devamsızlık Takibi): Destekleme ve yetiştirme kursu devamsızlığı.
- Nasıl yapılır: Tarih ve sınıf/grup seç > öğrenci durumunu işaretle > Kaydet.
Veli İletişim (Öğrenci İşleri > Veli İletişim): Duyuru, SMS ve bildirim gönderimi.
- Nasıl yapılır: Yeni duyuru > başlık, metin ve kanal (SMS / e-posta / uygulama) > hedef sınıf veya öğrencileri seç > Gönder.
- SMS için hesabın aktif SMS 3000 veya SMS 10000 lisansı ve yeterli kotası olmalıdır. Lisans bitince kullanılmayan krediler sıfırlanır. Veli telefonu tanımsız alıcılar iptal sayılır ve kotadan düşmez. Öğretmen kayıt SMS'i lisans gerektirmez.
Disiplin (Öğrenci İşleri > Disiplin): Disiplin olayları ve süreç takibi.
- Nasıl yapılır: Yeni olay > öğrenci, tarih, açıklama > durumu güncelle > Kaydet.
- Öğretmen Bildirimleri sekmesinde mobil uygulamadan gelen kayıtlar listelenir; ad, öğrenci no, öğretmen ve sebeple arama, sınıf/öğretmen/sebep filtreleri vardır.
İşletmede Beceri Eğitimi (Öğrenci İşleri > İşletmede Beceri Eğitimi): Meslek liselerinde işletme, sözleşme, devlet katkısı ve SGK bildirimi.
- Nasıl yapılır: İşletmeyi, usta öğreticiyi ve SGK işyeri sicilini kaydet > öğrenciyi işletmeye yerleştir (koordinatör öğretmen, sözleşme no, tarihler) > Evraklar sekmesinden sözleşme özeti ve aylık devam çizelgesini indir > devlet katkısında ayı oluştur, çalışılan günü ve tutarı yaz, ödenince işaretle > SGK sekmesinde işe giriş/çıkış listesini hazırla ve bildirildi olarak işaretle (bildirim SGK'ya kurum tarafından yapılır).
Rehberlik (sol menüde tek başına): Rehberlik görüşme ve notları.
- Nasıl yapılır: Öğrenciyi seç > görüşme notunu yaz > Kaydet.

=== SİSTEM ===
Yetkilendirme (Sistem > Yetkilendirme): Kullanıcılar ve yetki grupları.
- Kullanıcı ekleme: Kullanıcılar sekmesi > Yeni Kullanıcı > ad soyad listesinden personeli seç (e-posta ve telefon kayıttan gelir, değiştirilebilir) > şifre belirle > Oluştur.
- Yetki grupları: Yetki Grupları sekmesinde menü bazlı görüntüle / ekle / düzenle / sil izinleri tanımlanır. Bir düğmeyi görmeyen kullanıcının izni burada açılır.
- Kullanıcı sayısı plana bağlıdır: Basic'te modül kapalı, Standart'ta 2, Premium'da sınırsız. Öğretmen, rehber öğretmen ve okul yöneticisi rolleri bu sayıya girmez.
Denetim Kayıtları (Sistem > Denetim Kayıtları): Kritik işlemlerin kim/ne zaman/ne yaptığı. Salt okunur, silinemez.
İş Takibi (Sistem > İş Takibi): Periyodik görevler, hatırlatma ve gecikme bildirimleri.
- Nasıl yapılır: Yeni görev > başlık, atanan kullanıcı, periyot, son tarih > zorunlu iş ve uyarı tiplerini (uygulama / SMS / e-posta) işaretle > Oluştur. Atanan kişi veya düzenleme yetkisi olanlar "Yapıldı" ile tamamlar; tekrarlayan görevde sonraki vade otomatik ilerler. SMS uyarısı için kullanıcının telefonu dolu olmalıdır.
Kurum Takvimi (Sistem > Kurum Takvimi): İş takibi ve diğer programların tarihleri tek ay görünümünde. Üstteki kutularla kaynak seçilir, güne tıklanınca o günün olayları ve ilgili sayfaya bağlantı görünür.
SMS / E-posta Kayıtları (Sistem > SMS / E-posta Kayıtları): Gönderilen mesajların salt okunur kaydı. Kanal, durum veya alıcıya göre filtrelenir. "Gizle" kaydı yalnızca kendi listenizden kaldırır, Gizlenenler sekmesinden geri alınır.
Teknik Destek (Sistem > Teknik Destek): Sorun bildirimi. Sorunu yaz, istenirse dosya/ekran görüntüsü ekle, Gönder; yanıt listeden takip edilir.
Geri Bildirim (Sistem > Geri Bildirim): Öneri ve sorun bildirimi; konu ve açıklama yazılıp gönderilir.
Ana Sayfa: Okul, öğretmen, öğrenci ve yaklaşan iş sayılarını gösteren özet kartlar (dakikada bir yenilenir, karta tıklanınca ilgili sayfaya gidilir), yaklaşan ve geciken görevler, sürüklenerek değiştirilebilen kart düzeni (tarayıcıda saklanır).
Profilim (üst çubuktaki kullanıcı adı): Ad soyad ve e-posta güncelleme, şifre değiştirme (mevcut şifre + yeni şifre iki kez), iki adımlı doğrulama. 2FA'yı önce okul yöneticisi Hesap güvenliği kartından açar, sonra her kullanıcı kendi kurulumunu başlatır.

=== PLATFORM YÖNETİCİSİ MENÜLERİ (kurum kullanıcılarında görünmez) ===
Hesap Yönetimi, Global Yetkiler, Lisans Yönetimi, MEB Okul Kataloğu, Hazır Ders Havuzları, Teknik Destek, Geri Bildirimler, Bildirimler, Yedekleme, SMS Test. Lisans tanımlama, hesap açma, şifre sıfırlama ve yedekleme bu menülerden yapılır. Kurum kullanıcısı lisans veya eklenti satın alma isteğini platform yöneticisine iletir.

=== LİSANS VE EKLENTİLER ===
- Ana planlar: Basic (öğretmen, öğrenci, sınıf), Standart ve Premium (tüm modüller). Okul sayısı: Basic/Standart 1, Premium 3.
- Eklentiler ana lisansa ek verilir ve birbirini iptal etmez: SMS 3000, SMS 10000 ve Yapay Zekâ.
- Yapay zekâ eklentisi olmayan hesapta asistan kutusu "lisans gerekli" uyarısı gösterir; kısıtlar elle eklenebilir ve program oluşturma lisanstan bağımsız çalışır.
- Lisans ve eklenti tanımı Platform > Lisans Yönetimi'nden yapılır; kurum kullanıcısı kendi lisansını değiştiremez.

=== MOBİL UYGULAMA (ÖĞRETMEN) ===
- Öğretmen kaydı: Giriş ekranında "Hesabım yok, öğretmen kaydı oluştur" > il / ilçe / okul (yalnızca geçerli lisanslı okullar listelenir) > T.C. kimlik no, soyad, e-posta, cep telefonu. T.C. + soyad o okuldaki öğretmen kartıyla eşleşir ve telefon kayıtlı telefonla aynıysa Öğretmen yetkisiyle hesap açılır ve telefona 6 haneli SMS kodu gider. Varsayılan şifre T.C. kimlik numarasıdır.
- Kullanım: öğrenci numarasıyla arama, öğrenci kartından "Bildirim Oluştur" (hazır sebep etiketleri çoklu seçilir, kendi sebebi yazılabilir, not eklenebilir), "Geçmiş" ile kendi gönderdiği bildirimler, "Şifre" ile şifre değiştirme, "Çıkış".
- Gönderilen bildirim okul yönetiminin Disiplin ekranındaki Öğretmen Bildirimleri sekmesine düşer.
- Hesapta iki adımlı doğrulama veya SMS girişi açıksa mobil uygulama şu an bunu desteklemez; okul yöneticisinden kapatılması istenir. Disiplin modülü kapalıysa bildirim oluşturulamaz.

=== ASİSTANIN KENDİ SINIRLARI ===
- Asistan Otomatik Ders Programı ekranındadır, Yapay Zekâ eklenti lisansı ister ve günlük istek kotası vardır.
- Ders programı kuralını kısıt önerisine çevirir, OIDS modülleriyle ilgili soruları ve "nasıl yaparım" sorularını cevaplar.
- Hiçbir modülde kayıt açamaz, silemez, güncelleyemez ve kayıtların içeriğini (maaş, not, devamsızlık, izin günü) okuyamaz; yalnızca yolu ve adımları anlatır.`;

module.exports = { PRODUCT_GUIDE };
