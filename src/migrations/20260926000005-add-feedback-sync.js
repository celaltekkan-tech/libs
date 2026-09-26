'use strict';

/** Geliştirme ve canlı veritabanları arasında geri bildirimi eşlemek için kimlik ve senkron tabloları. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Feedbacks" ALTER COLUMN tenant_id DROP NOT NULL'
    );

    await queryInterface.addColumn('Feedbacks', 'public_id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    });
    await queryInterface.addColumn('Feedbacks', 'origin_env', {
      type: Sequelize.STRING(16),
      allowNull: true,
    });
    await queryInterface.addColumn('Feedbacks', 'author_name', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('Feedbacks', 'author_email', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addColumn('Feedbacks', 'tenant_name', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addIndex('Feedbacks', ['public_id'], {
      unique: true,
      name: 'feedbacks_public_id_uq',
    });
    await queryInterface.addIndex('Feedbacks', ['updated_at'], { name: 'feedbacks_updated_at_idx' });

    await queryInterface.addColumn('FeedbackUpdates', 'public_id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    });
    await queryInterface.addColumn('FeedbackUpdates', 'author_name', {
      type: Sequelize.STRING(200),
      allowNull: true,
    });
    await queryInterface.addIndex('FeedbackUpdates', ['public_id'], {
      unique: true,
      name: 'feedback_updates_public_id_uq',
    });

    await queryInterface.addColumn('FeedbackAttachments', 'public_id', {
      type: Sequelize.UUID,
      allowNull: false,
      defaultValue: Sequelize.literal('gen_random_uuid()'),
    });
    await queryInterface.addIndex('FeedbackAttachments', ['public_id'], {
      unique: true,
      name: 'feedback_attachments_public_id_uq',
    });

    await queryInterface.sequelize.query(`
      UPDATE "Feedbacks" f
      SET tenant_name = t.name
      FROM "Tenants" t
      WHERE f.tenant_id = t.id AND f.tenant_name IS NULL
    `);
    await queryInterface.sequelize.query(`
      UPDATE "Feedbacks" f
      SET author_name = u.full_name,
          author_email = u.email
      FROM "Users" u
      WHERE f.user_id = u.id
        AND (f.author_name IS NULL OR f.author_email IS NULL)
    `);
    await queryInterface.sequelize.query(`
      UPDATE "FeedbackUpdates" fu
      SET author_name = u.full_name
      FROM "Users" u
      WHERE fu.user_id = u.id AND fu.author_name IS NULL
    `);

    await queryInterface.createTable('FeedbackSyncTombstones', {
      public_id: { type: Sequelize.UUID, primaryKey: true },
      origin_env: { type: Sequelize.STRING(16), allowNull: false },
      deleted_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('FeedbackSyncTombstones', ['origin_env', 'deleted_at'], {
      name: 'feedback_sync_tombstones_origin_idx',
    });

    await queryInterface.createTable('FeedbackSyncStates', {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      cursors: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      last_run_at: { type: Sequelize.DATE, allowNull: true },
      last_success_at: { type: Sequelize.DATE, allowNull: true },
      last_error: { type: Sequelize.TEXT, allowNull: true },
      last_summary: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('FeedbackSyncStates');
    await queryInterface.dropTable('FeedbackSyncTombstones');

    await queryInterface.removeIndex('FeedbackAttachments', 'feedback_attachments_public_id_uq');
    await queryInterface.removeColumn('FeedbackAttachments', 'public_id');

    await queryInterface.removeIndex('FeedbackUpdates', 'feedback_updates_public_id_uq');
    await queryInterface.removeColumn('FeedbackUpdates', 'author_name');
    await queryInterface.removeColumn('FeedbackUpdates', 'public_id');

    await queryInterface.removeIndex('Feedbacks', 'feedbacks_updated_at_idx');
    await queryInterface.removeIndex('Feedbacks', 'feedbacks_public_id_uq');
    await queryInterface.removeColumn('Feedbacks', 'tenant_name');
    await queryInterface.removeColumn('Feedbacks', 'author_email');
    await queryInterface.removeColumn('Feedbacks', 'author_name');
    await queryInterface.removeColumn('Feedbacks', 'origin_env');
    await queryInterface.removeColumn('Feedbacks', 'public_id');

    await queryInterface.sequelize.query('DELETE FROM "Feedbacks" WHERE tenant_id IS NULL');
    await queryInterface.sequelize.query(
      'ALTER TABLE "Feedbacks" ALTER COLUMN tenant_id SET NOT NULL'
    );
  },
};
