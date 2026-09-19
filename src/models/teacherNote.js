module.exports = (sequelize, DataTypes) => {
  const TeacherNote = sequelize.define(
    'TeacherNote',
    {
      tenant_id: DataTypes.INTEGER,
      school_id: DataTypes.INTEGER,
      student_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      tags: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      note: DataTypes.TEXT,
    },
    {
      tableName: 'TeacherNotes',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeacherNote.associate = function (models) {
    TeacherNote.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    TeacherNote.belongsTo(models.Student, { foreignKey: 'student_id' });
    TeacherNote.belongsTo(models.User, { foreignKey: 'teacher_id', as: 'Teacher' });
  };

  return TeacherNote;
};
