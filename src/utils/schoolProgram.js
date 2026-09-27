// Okulun uyguladığı MEB programı. Haftalık ders çizelgesi (ders havuzu) seçimi
// school_type + program_type + has_prep_class + is_special_program üzerinden yapılır.
// Kaynak: https://ttkb.meb.gov.tr/www/haftalik-ders-cizelgeleri/kategori/7

const SCHOOL_PROGRAMS = {
  ilkokul: { school_type: 'ilkokul', label: 'İlkokul' },
  ortaokul: { school_type: 'ortaokul', label: 'Ortaokul' },
  imam_hatip_ortaokulu: { school_type: 'ortaokul', label: 'İmam Hatip Ortaokulu' },
  anadolu_lisesi: { school_type: 'lise', label: 'Anadolu Lisesi', prep: true, special: true },
  fen_lisesi: { school_type: 'lise', label: 'Fen Lisesi', prep: true, special: true },
  sosyal_bilimler_lisesi: { school_type: 'lise', label: 'Sosyal Bilimler Lisesi', prep: true, special: true },
  anadolu_imam_hatip_lisesi: { school_type: 'lise', label: 'Anadolu İmam Hatip Lisesi', prep: true },
  spor_lisesi: { school_type: 'lise', label: 'Spor Lisesi', special: true },
  guzel_sanatlar_lisesi: { school_type: 'lise', label: 'Güzel Sanatlar Lisesi' },
  mesleki_teknik_anadolu_lisesi: { school_type: 'lise', label: 'Mesleki ve Teknik Anadolu Lisesi' },
};

const PROGRAM_TYPES = Object.keys(SCHOOL_PROGRAMS);

/** Program okul kademesiyle uyumlu mu ve seçilen bayraklar o programda anlamlı mı? */
function validateSchoolProgram({ school_type, program_type, has_prep_class, is_special_program }) {
  if (!program_type) return null;
  const def = SCHOOL_PROGRAMS[program_type];
  if (!def) return 'Geçersiz okul programı';
  if (school_type && def.school_type !== school_type) {
    return `${def.label} programı seçilen okul kademesiyle uyumlu değil`;
  }
  if (has_prep_class && !def.prep) return `${def.label} için hazırlık sınıfı seçilemez`;
  if (is_special_program && !def.special) return `${def.label} için özel program seçilemez`;
  return null;
}

module.exports = { SCHOOL_PROGRAMS, PROGRAM_TYPES, validateSchoolProgram };
