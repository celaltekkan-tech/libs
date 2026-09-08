import { Card, Descriptions, Layout, Space, Tag, Typography } from 'antd'
import { useAuth } from '../auth/AuthContext'
import { AppHeader } from '../components/AppHeader'

export function DashboardPage() {
  const { session } = useAuth()
  const user = session?.user

  return (
    <Layout className="app-shell">
      <AppHeader />

      <Layout.Content className="app-content">
        <Typography.Title level={3}>Hoş geldiniz</Typography.Title>
        <Typography.Paragraph type="secondary">
          Oturum doğrulandı. Modül ekranları bu iskeletin üzerine eklenecek.
        </Typography.Paragraph>

        <Card title="Oturum bilgisi">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Ad soyad">{user?.full_name}</Descriptions.Item>
            <Descriptions.Item label="E-posta">{user?.email}</Descriptions.Item>
            <Descriptions.Item label="Global rol">{user?.role}</Descriptions.Item>
            <Descriptions.Item label="Okul rolleri">
              <Space wrap>
                {(session?.roles || []).map((role) => (
                  <Tag key={role} color="blue">
                    {role}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Bağlı okullar">
              {(session?.schools || [])
                .map((school) => `${school.name} (${school.role || 'rol yok'})`)
                .join(', ') || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="İzin sayısı">{session?.permissions.length}</Descriptions.Item>
          </Descriptions>
        </Card>
      </Layout.Content>
    </Layout>
  )
}
