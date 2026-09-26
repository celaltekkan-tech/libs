'use strict';

module.exports = (sequelize, DataTypes) => {
  const FeedbackSyncState = sequelize.define(
    'FeedbackSyncState',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      cursors: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      last_run_at: { type: DataTypes.DATE, allowNull: true },
      last_success_at: { type: DataTypes.DATE, allowNull: true },
      last_error: { type: DataTypes.TEXT, allowNull: true },
      last_summary: { type: DataTypes.JSONB, allowNull: true },
    },
    {
      tableName: 'FeedbackSyncStates',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  return FeedbackSyncState;
};
