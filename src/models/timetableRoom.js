module.exports = (sequelize, DataTypes) => {
  const TimetableRoom = sequelize.define(
    'TimetableRoom',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      room_type: DataTypes.STRING,
      capacity: DataTypes.INTEGER,
      is_active: DataTypes.BOOLEAN,
    },
    {
      tableName: 'TimetableRooms',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TimetableRoom.associate = function (models) {
    TimetableRoom.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    TimetableRoom.belongsTo(models.School, { foreignKey: 'school_id' });
  };

  return TimetableRoom;
};
