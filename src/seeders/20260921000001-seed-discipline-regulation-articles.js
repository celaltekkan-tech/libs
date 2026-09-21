'use strict';

const ARTICLES = [
  {
    article_no: '12',
    title: 'Cezayı Gerektiren Davranışlar ve Cezalar',
    description:
      'Öğrenciye uygulanacak disiplin cezalarının türleri bu maddede düzenlenir (Uyarı, Kınama, Okuldan Kısa Süreli Uzaklaştırma, Okuldan Uzun Süreli Uzaklaştırma, Okul Değiştirme).',
    default_sanction_type: null,
  },
  {
    article_no: '16',
    title: 'Ceza Takdirinde Dikkat Edilecek Hususlar',
    description:
      'Kurul, ceza takdir ederken öğrencinin genel durumunu, davranışın ağırlığını ve hafifletici/ağırlaştırıcı nedenleri değerlendirir.',
    default_sanction_type: null,
  },
  {
    article_no: '43',
    title: 'Disiplin Kurulunun Toplanması ve Çağrı Usulü',
    description: 'İlgilinin disiplin kurulu toplantısına çağrılma usulünü düzenler.',
    default_sanction_type: null,
  },
  { article_no: '', title: 'Uyarı', description: null, default_sanction_type: 'uyari' },
  { article_no: '', title: 'Kınama', description: null, default_sanction_type: 'kinama' },
  {
    article_no: '',
    title: 'Okuldan Kısa Süreli Uzaklaştırma',
    description: null,
    default_sanction_type: 'okuldan_kisa_sureli_uzaklastirma',
  },
  {
    article_no: '',
    title: 'Okuldan Uzun Süreli Uzaklaştırma',
    description: null,
    default_sanction_type: 'okuldan_uzun_sureli_uzaklastirma',
  },
  { article_no: '', title: 'Okul Değiştirme', description: null, default_sanction_type: 'okul_degistirme' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query(
      `SELECT title FROM "DisciplineRegulationArticles" WHERE tenant_id IS NULL AND source = 'meb'`
    );
    const existingTitles = new Set(existing.map((r) => r.title));
    const missing = ARTICLES.filter((a) => !existingTitles.has(a.title));
    if (missing.length === 0) return;

    await queryInterface.bulkInsert(
      'DisciplineRegulationArticles',
      missing.map((a) => ({
        tenant_id: null,
        article_no: a.article_no,
        title: a.title,
        description: a.description,
        default_sanction_type: a.default_sanction_type,
        source: 'meb',
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM "DisciplineRegulationArticles" WHERE tenant_id IS NULL AND source = 'meb'`
    );
  },
};
