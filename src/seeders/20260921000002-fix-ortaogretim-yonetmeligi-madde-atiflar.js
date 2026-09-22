'use strict';

// 2026-09-21 önceki seed, kaldırılmış (2007 tarihli) Orta Öğretim Kurumları Ödül ve Disiplin
// Yönetmeliği'nin madde numaralarını kullanıyordu. Bu seeder, aynı satırları yürürlükteki
// (07/09/2013-28758, en son 03/07/2026-33299 ile değişik) Millî Eğitim Bakanlığı Ortaöğretim
// Kurumları Yönetmeliği'nin güncel madde numaraları ve içerikleriyle günceller (UPDATE, satırlar
// başka kayıtlardan (DisciplineDecision.regulation_article_id) referans alınıyor olabileceğinden
// silinip yeniden eklenmiyor).

const FIXES = [
  {
    match: { source: 'meb', article_no: '12', title: 'Cezayı Gerektiren Davranışlar ve Cezalar' },
    update: {
      article_no: '163',
      title: 'Disiplin Cezaları',
      description:
        'Öğrenciye, davranış ve fiillerinin niteliğine göre şu cezalardan biri verilir: Kınama, okuldan kısa süreli uzaklaştırma (1-5 gün), okul değiştirme, örgün eğitim dışına çıkarma. Cezayı gerektiren davranış ve fiillerin ayrıntısı MADDE 164\'te düzenlenir.',
    },
  },
  {
    match: { source: 'meb', article_no: '16', title: 'Ceza Takdirinde Dikkat Edilecek Hususlar' },
    update: {
      article_no: '168',
      title: 'Ceza Takdirinde Dikkat Edilecek Hususlar',
      description:
        'Ceza takdir edilirken öğrencinin 18 yaşına kadar çocuk olduğu, üstün yararı, gizlilik ilkesi, sınıf rehber öğretmeni/öğrenci velisinin görüşleri, ailesi ve çevresiyle ilgili bilgiler, kişisel özellikleri, fiilin işlendiği şartlar, yaşı ve cinsiyeti, daha önce ceza alıp almadığı göz önünde bulundurulur; uygun görülmesi hâlinde bir alt ceza verilebilir.',
    },
  },
  {
    match: { source: 'meb', article_no: '43', title: 'Disiplin Kurulunun Toplanması ve Çağrı Usulü' },
    update: {
      article_no: '190-191',
      title: 'Toplantıya Çağrı ve Toplantı/Karar Alma Usulü',
      description:
        'Okul öğrenci ödül ve disiplin kurulu, kurul başkanının yazılı çağrısıyla toplanır (MADDE 190). Kurul üyelerin salt çoğunluğuyla toplanır, oy çoğunluğuyla karar alır; üyeler çekimser oy kullanamaz, kurula iletilen disiplin olaylarını görüşüp karara bağlamak zorundadır (MADDE 191).',
    },
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    for (const fix of FIXES) {
      await queryInterface.bulkUpdate(
        'DisciplineRegulationArticles',
        { ...fix.update, updated_at: now },
        {
          tenant_id: null,
          source: fix.match.source,
          article_no: fix.match.article_no,
          title: fix.match.title,
        }
      );
    }
  },

  async down(queryInterface) {
    const now = new Date();
    const reverts = [
      {
        match: { article_no: '163' },
        update: {
          article_no: '12',
          title: 'Cezayı Gerektiren Davranışlar ve Cezalar',
          description:
            'Öğrenciye uygulanacak disiplin cezalarının türleri bu maddede düzenlenir (Uyarı, Kınama, Okuldan Kısa Süreli Uzaklaştırma, Okuldan Uzun Süreli Uzaklaştırma, Okul Değiştirme).',
        },
      },
      {
        match: { article_no: '168' },
        update: {
          article_no: '16',
          title: 'Ceza Takdirinde Dikkat Edilecek Hususlar',
          description:
            'Kurul, ceza takdir ederken öğrencinin genel durumunu, davranışın ağırlığını ve hafifletici/ağırlaştırıcı nedenleri değerlendirir.',
        },
      },
      {
        match: { article_no: '190-191' },
        update: {
          article_no: '43',
          title: 'Disiplin Kurulunun Toplanması ve Çağrı Usulü',
          description: 'İlgilinin disiplin kurulu toplantısına çağrılma usulünü düzenler.',
        },
      },
    ];
    for (const revert of reverts) {
      await queryInterface.bulkUpdate(
        'DisciplineRegulationArticles',
        { ...revert.update, updated_at: now },
        { tenant_id: null, source: 'meb', article_no: revert.match.article_no }
      );
    }
  },
};
