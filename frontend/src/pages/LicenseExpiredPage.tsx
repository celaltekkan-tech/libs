import { Button, Result, Space, Typography } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'

export function LicenseExpiredPage() {
  const { session, logout } = useAuth()
  const license = session?.license

  return (
    <div className="license-expired-page">
      <Result
        status="warning"
        title="Lisans süresi doldu"
        subTitle={
          <Space direction="vertical" size={4}>
            <Typography.Text>
              Hesabınızın {license ? `"${license.plan}" planı için ` : ''}lisansı sona ermiş veya hiç
              tanımlanmamış. Sisteme erişebilmek için lisansınızın yenilenmesi gerekiyor.
            </Typography.Text>
            <Typography.Text type="secondary">
              Yeni lisans talebi için lütfen platform yöneticinizle iletişime geçin.
            </Typography.Text>
          </Space>
        }
        extra={
          <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
            Çıkış Yap
          </Button>
        }
      />
    </div>
  )
}
