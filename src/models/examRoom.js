module.exports = (sequelize, DataTypes) => {
  const ExamRoom = sequelize.define(
    'ExamRoom',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      name: DataTypes.STRING,
      capacity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
    },
    {
      tableName: 'ExamRooms',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  ExamRoom.associate = function (models) {
    ExamRoom.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    ExamRoom.belongsTo(models.School, { foreignKey: 'school_id' });
    ExamRoom.hasMany(models.SeatAssignment, { foreignKey: 'exam_room_id' });
    ExamRoom.hasMany(models.ProctorAssignment, { foreignKey: 'exam_room_id' });
  };

  return ExamRoom;
};
