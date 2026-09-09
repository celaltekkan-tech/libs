module.exports = (sequelize, DataTypes) => {
    const Tenant = sequelize.define('Tenant', {
    name: DataTypes.STRING,
    stripe_customer_id: DataTypes.STRING,
    plan: DataTypes.STRING,
    data: DataTypes.JSONB,
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
    }, {
    tableName: 'Tenants',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
    });
    
    
    Tenant.associate = function(models) {
    Tenant.hasMany(models.School, { foreignKey: 'tenant_id' });
    Tenant.hasMany(models.User, { foreignKey: 'tenant_id' });
    Tenant.hasMany(models.Teacher, { foreignKey: 'tenant_id' });
    Tenant.hasMany(models.Feedback, { foreignKey: 'tenant_id' });
    Tenant.hasMany(models.License, { foreignKey: 'tenant_id' });
    };
    
    
    return Tenant;
    };