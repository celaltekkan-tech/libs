module.exports = (sequelize, DataTypes) => {
  const DisciplineRegulationArticle = sequelize.define(
    'DisciplineRegulationArticle',
    {
      tenant_id: DataTypes.INTEGER,
      article_no: DataTypes.STRING,
      title: DataTypes.STRING,
      description: DataTypes.TEXT,
      default_sanction_type: DataTypes.STRING,
      source: { type: DataTypes.STRING, allowNull: false, defaultValue: 'custom' },
    },
    {
      tableName: 'DisciplineRegulationArticles',
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    }
  );

  DisciplineRegulationArticle.associate = function (models) {
    DisciplineRegulationArticle.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    DisciplineRegulationArticle.hasMany(models.DisciplineDecision, { foreignKey: 'regulation_article_id' });
  };

  return DisciplineRegulationArticle;
};
