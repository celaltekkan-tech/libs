import { Typography } from 'antd'
import { AppLayout } from '../../components/AppLayout'
import { RoleGroupsPanel } from '../../components/RoleGroupsPanel'

export function PlatformRolesPage() {
  return (
    <AppLayout title="Global Yetkiler">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 4 }}>
        Global kullanıcı yetkileri
      </Typography.Title>
      <RoleGroupsPanel variant="platform" />
    </AppLayout>
  )
}
