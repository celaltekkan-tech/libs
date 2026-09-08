module.exports = (sequelize, DataTypes) => {
    const Teacher = sequelize.define('Teacher', {
    tenant_id: DataTypes.INTEGER,
    school_id: DataTypes.INTEGER,
    city: DataTypes.STRING,
    district: DataTypes.STRING,
    personnel_no: DataTypes.STRING,
    national_id: DataTypes.STRING,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    last_graduated_school: DataTypes.STRING,
    class_level: DataTypes.STRING,
    title_branch: DataTypes.STRING,
    working_institution: DataTypes.STRING,
    degree: DataTypes.STRING,
    pension_degree: DataTypes.STRING,
    rank: DataTypes.STRING,
    degree_rank_date: DataTypes.DATE,
    school_principal: DataTypes.STRING,
    meta: DataTypes.JSONB
    }, {
    tableName: 'Teachers',
    underscored: true
    });
    
    
    Teacher.associate = function(models) {
    Teacher.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Teacher.belongsTo(models.School, { foreignKey: 'school_id' });
    };
    
    
    return Teacher;
    };