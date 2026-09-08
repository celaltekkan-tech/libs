import { Button, Layout, Space } from 'antd'
import { ApartmentOutlined, CommentOutlined, LogoutOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

interface AppHeaderProps {
  title?: string
}

export function AppHeader({ title = 'Okul İdare Sistemi' }: AppHeaderProps) {
  const { session, logout } = useAuth()
  const user = session?.user

  return (
    <Layout.Header className="app-header">
      <Link to="/" className="app-header-brand">
        {title}
      </Link>
      <Space>
        <Link to="/feedback">
          <Button icon={<CommentOutlined />}>Geri Bildirim</Button>
        </Link>
        {session?.is_platform_admin && (
          <>
            <Link to="/platform/tenants">
              <Button icon={<ApartmentOutlined />}>Hesap Yönetimi</Button>
            </Link>
            <Link to="/platform/feedback">
              <Button icon={<CommentOutlined />}>Geri Bildirimler</Button>
            </Link>
          </>
        )}
        <span className="app-header-user">{user?.full_name}</span>
        <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
          Çıkış
        </Button>
      </Space>
    </Layout.Header>
  )
}
