'use strict';

const { Op } = require('sequelize');
const { Role, Permission, RolePermission, UserSchool } = require('../models');
const { MENU_PERMISSION_GROUPS } = require('../config/permissionCatalog');
const audit = require('../services/auditService');

function assertTenantAccess(req, role) {
  if (!req.user?.tenant_id) return false;
  if (role.is_system || role.tenant_id == null) return false;
  return role.tenant_id === req.user.tenant_id;
}

async function loadRoleWithPermissions(id) {
  return Role.findByPk(id, {
    include: [{ model: Permission, through: { attributes: [] }, attributes: ['id', 'permission_key', 'description'] }],
  });
}

function serializeRole(role) {
  const data = role.toJSON ? role.toJSON() : { ...role };
  data.permission_keys = (data.Permissions || []).map((p) => p.permission_key).sort();
  data.permission_ids = (data.Permissions || []).map((p) => p.id);
  return data;
}

module.exports = {
  async catalog(req, res, next) {
    try {
      const permissions = await Permission.findAll({
        attributes: ['id', 'permission_key', 'description'],
        order: [['permission_key', 'ASC']],
      });
      const byKey = Object.fromEntries(permissions.map((p) => [p.permission_key, p]));

      const menus = MENU_PERMISSION_GROUPS.map((menu) => ({
        id: menu.id,
        label: menu.label,
        group: menu.group,
        module: menu.module,
        permissions: menu.permissions.map((key) => {
          const row = byKey[key];
          return {
            key,
            id: row?.id || null,
            description: row?.description || key,
            action: key.split('.').pop(),
          };
        }),
      }));

      res.json({
        success: true,
        data: {
          menus,
          permissions,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async list(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const roles = await Role.findAll({
        where: {
          [Op.or]: [{ is_system: true, tenant_id: null }, { tenant_id: tenantId }],
        },
        include: [{ model: Permission, through: { attributes: [] }, attributes: ['id', 'permission_key'] }],
        order: [
          ['is_system', 'DESC'],
          ['role_name', 'ASC'],
        ],
      });
      res.json({ success: true, data: roles.map(serializeRole) });
    } catch (err) {
      next(err);
    }
  },

  async get(req, res, next) {
    try {
      const role = await loadRoleWithPermissions(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: 'Rol bulunamadı' });
      if (!role.is_system && role.tenant_id !== req.user.tenant_id) {
        return res.status(403).json({ success: false, message: 'Erişim reddedildi' });
      }
      res.json({ success: true, data: serializeRole(role) });
    } catch (err) {
      next(err);
    }
  },

  async create(req, res, next) {
    try {
      const tenantId = req.user.tenant_id;
      const { role_name, description, permission_keys, clone_from_role_id } = req.validatedBody || req.body;

      const exists = await Role.findOne({
        where: { tenant_id: tenantId, role_name },
      });
      if (exists) {
        return res.status(409).json({ success: false, message: 'Bu isimde bir yetki grubu zaten var' });
      }

      let keys = Array.isArray(permission_keys) ? permission_keys : [];
      if (clone_from_role_id) {
        const source = await loadRoleWithPermissions(clone_from_role_id);
        if (
          !source ||
          (!source.is_system && source.tenant_id !== tenantId)
        ) {
          return res.status(400).json({ success: false, message: 'Kopyalanacak rol bulunamadı' });
        }
        keys = (source.Permissions || []).map((p) => p.permission_key);
      }

      const role = await Role.create({
        role_name,
        description: description || null,
        tenant_id: tenantId,
        is_system: false,
      });

      if (keys.length) {
        const perms = await Permission.findAll({ where: { permission_key: keys } });
        await role.setPermissions(perms);
      }

      const full = await loadRoleWithPermissions(role.id);
      await audit.log(req, {
        action: 'create',
        entityType: 'role',
        entityId: role.id,
        summary: `Yetki grubu oluşturuldu: ${role_name}`,
      });
      res.status(201).json({ success: true, data: serializeRole(full) });
    } catch (err) {
      next(err);
    }
  },

  async update(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: 'Rol bulunamadı' });
      if (!assertTenantAccess(req, role)) {
        return res.status(403).json({
          success: false,
          message: 'Sistem rolleri düzenlenemez; kopyalayarak özel grup oluşturun',
        });
      }

      const { role_name, description, permission_keys } = req.validatedBody || req.body;
      if (role_name && role_name !== role.role_name) {
        const exists = await Role.findOne({
          where: { tenant_id: req.user.tenant_id, role_name, id: { [Op.ne]: role.id } },
        });
        if (exists) {
          return res.status(409).json({ success: false, message: 'Bu isimde bir yetki grubu zaten var' });
        }
        role.role_name = role_name;
      }
      if (description !== undefined) role.description = description;
      await role.save();

      if (Array.isArray(permission_keys)) {
        const perms = await Permission.findAll({ where: { permission_key: permission_keys } });
        await role.setPermissions(perms);
      }

      const full = await loadRoleWithPermissions(role.id);
      await audit.log(req, {
        action: 'update',
        entityType: 'role',
        entityId: role.id,
        summary: `Yetki grubu güncellendi: ${role.role_name}`,
      });
      res.json({ success: true, data: serializeRole(full) });
    } catch (err) {
      next(err);
    }
  },

  async remove(req, res, next) {
    try {
      const role = await Role.findByPk(req.params.id);
      if (!role) return res.status(404).json({ success: false, message: 'Rol bulunamadı' });
      if (!assertTenantAccess(req, role)) {
        return res.status(403).json({ success: false, message: 'Sistem rolleri silinemez' });
      }

      const inUse = await UserSchool.count({ where: { role_id: role.id } });
      if (inUse > 0) {
        return res.status(409).json({
          success: false,
          message: `Bu yetki grubu ${inUse} kullanıcıda tanımlı; önce kullanıcı rollerini değiştirin`,
        });
      }

      const name = role.role_name;
      await RolePermission.destroy({ where: { role_id: role.id } });
      await role.destroy();
      await audit.log(req, {
        action: 'delete',
        entityType: 'role',
        entityId: Number(req.params.id),
        summary: `Yetki grubu silindi: ${name}`,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
};
