'use strict';

module.exports = (sequelize, DataTypes) => {
  const FeedbackSyncTombstone = sequelize.define(
    'FeedbackSyncTombstone',
    {
      public_id: { type: DataTypes.UUID, primaryKey: true },
      origin_env: { type: DataTypes.STRING(16), allowNull: false },
      deleted_at: { type: DataTypes.DATE, allowNull: false },
    },
    {
      tableName: 'FeedbackSyncTombstones',
      timestamps: false,
    }
  );

  return FeedbackSyncTombstone;
};
