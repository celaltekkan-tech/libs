export interface RolePermissionRef {
  id: number
  permission_key: string
  description?: string
}

export interface TenantRole {
  id: number
  role_name: string
  tenant_id: number | null
  is_system: boolean
  description: string | null
  permission_keys: string[]
  permission_ids: number[]
  Permissions?: RolePermissionRef[]
  created_at?: string
  updated_at?: string
}

export interface PermissionCatalogItem {
  key: string
  id: number | null
  description: string
  action: string
}

export interface PermissionMenuGroup {
  id: string
  label: string
  group: string
  module: string | null
  permissions: PermissionCatalogItem[]
}

export interface PermissionCatalog {
  menus: PermissionMenuGroup[]
  permissions: Array<{ id: number; permission_key: string; description: string | null }>
}

export interface RolePayload {
  role_name: string
  description?: string | null
  permission_keys?: string[]
  clone_from_role_id?: number | null
}
