module.exports = (sequelize, DataTypes) => {
    const Teacher = sequelize.define('Teacher', {
    tenant_id: DataTypes.INTEGER,
    school_id: DataTypes.INTEGER,
    city: DataTypes.STRING,
    district: DataTypes.STRING,
    personnel_no: DataTypes.STRING,
    national_id: DataTypes.STRING,
    phone: DataTypes.STRING(30),
    email: DataTypes.STRING,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    birth_date: DataTypes.DATEONLY,
    last_graduated_school: DataTypes.STRING,
    class_level: DataTypes.STRING,
    title_branch: DataTypes.STRING,
    unvan: DataTypes.STRING,
    brans: DataTypes.STRING,
    kariyer: DataTypes.STRING,
    working_institution: DataTypes.STRING,
    degree: DataTypes.STRING,
    pension_degree: DataTypes.STRING,
    rank: DataTypes.STRING,
    degree_rank_date: DataTypes.DATE,
    degree_rank_anchor_date: DataTypes.DATE,
    eight_year_base_date: DataTypes.DATEONLY,
    school_principal: DataTypes.STRING,
    annual_leave_quota: DataTypes.INTEGER,
    service_start_date: DataTypes.DATEONLY,
    first_duty_date: DataTypes.DATEONLY,
    personnel_type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ogretmen',
    },
    contract_start_date: DataTypes.DATEONLY,
    contract_end_date: DataTypes.DATEONLY,
    union_name: DataTypes.STRING,
    personnel_category_id: DataTypes.INTEGER,
    meta: DataTypes.JSONB
    }, {
    tableName: 'Teachers',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
    });
    
    
    Teacher.associate = function(models) {
    Teacher.belongsTo(models.Tenant, { foreignKey: 'tenant_id' });
    Teacher.belongsTo(models.School, { foreignKey: 'school_id' });
    Teacher.belongsTo(models.PersonnelCategory, { foreignKey: 'personnel_category_id' });
    Teacher.hasMany(models.Classroom, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.ScheduleEntry, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.LeaveRecord, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.DutyAssignment, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.ExtraLessonEntry, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.AttendanceRecord, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.DykCourse, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.ProctorAssignment, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.TeacherDocument, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.PromotionHistory, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.User, { foreignKey: 'teacher_id' });
    Teacher.hasMany(models.ResponsibilityExamItem, { foreignKey: 'teacher_id' });
    };
    
    
    return Teacher;
    };