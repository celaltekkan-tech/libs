require('dotenv').config();

// Seeder'ların tekrar tekrar çalışıp veriyi çoğaltmaması için çalışma
// geçmişi veritabanında tutulur.
const common = {
  dialect: 'postgres',
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: {
    ...common,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'lise_idari_dev',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    logging: false,
  },
  test: {
    ...common,
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'lise_idari_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 5432,
    logging: false,
  },
  production: {
    ...common,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    logging: false,
  },
};
