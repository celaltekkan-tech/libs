'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Schools', 'program_type', {
      type: Sequelize.STRING(40),
      allowNull: true,
    });
    await queryInterface.addColumn('Schools', 'has_prep_class', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('Schools', 'is_special_program', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Mevcut okullar için addan tahmin; kullanıcı Okullar ekranından düzeltebilir.
    // Sıra önemli: özel adlar genel "anadolu lisesi" eşleşmesinden önce gelir.
    await queryInterface.sequelize.query(`
      UPDATE "Schools" SET program_type = CASE
        WHEN school_type = 'ilkokul' THEN 'ilkokul'
        WHEN school_type = 'ortaokul' AND name ILIKE '%imam hatip%' THEN 'imam_hatip_ortaokulu'
        WHEN school_type = 'ortaokul' THEN 'ortaokul'
        WHEN name ILIKE '%imam hatip%' THEN 'anadolu_imam_hatip_lisesi'
        WHEN name ILIKE '%sosyal bilimler%' THEN 'sosyal_bilimler_lisesi'
        WHEN name ILIKE '%fen lisesi%' THEN 'fen_lisesi'
        WHEN name ILIKE '%spor lisesi%' THEN 'spor_lisesi'
        WHEN name ILIKE '%güzel sanatlar%' OR name ILIKE '%guzel sanatlar%' THEN 'guzel_sanatlar_lisesi'
        WHEN name ILIKE '%mesleki%' OR name ILIKE '%teknik%' THEN 'mesleki_teknik_anadolu_lisesi'
        WHEN name ILIKE '%anadolu lisesi%' THEN 'anadolu_lisesi'
        ELSE NULL
      END
      WHERE program_type IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('Schools', 'is_special_program');
    await queryInterface.removeColumn('Schools', 'has_prep_class');
    await queryInterface.removeColumn('Schools', 'program_type');
  },
};
