export const MENU_HOME_KEY = '/'

export interface TenantMenuGroupLayout {
  label: string
  children: string[]
}

export interface TenantMenuLayout {
  version: 1
  order: string[]
  groups: Record<string, TenantMenuGroupLayout>
  hidden: string[]
}
