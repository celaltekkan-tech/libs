module.exports = (sequelize, DataTypes) => {
  const TeacherDocument = sequelize.define(
    'TeacherDocument',
    {
      tenant_id: DataTypes.INTEGER,
      teacher_id: DataTypes.INTEGER,
      doc_type: DataTypes.STRING,
      title: DataTypes.STRING,
      academic_year: DataTypes.STRING,
      content: DataTypes.TEXT,
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'taslak',
      },
      reviewer_note: DataTypes.STRING,
    },
    {
      tableName: 'TeacherDocuments',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  TeacherDocument.associate = function (models) {
    TeacherDocument.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    TeacherDocument.belongsTo(models.Teacher, { foreignKey: 'teacher_id' });
  };

  return TeacherDocument;
};
