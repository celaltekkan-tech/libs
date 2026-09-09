import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AutoComplete, Button, Input, Layout, Menu, Space } from 'antd'
import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  BookOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  CalendarOutlined,
  ContactsOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FileDoneOutlined,
  FileProtectOutlined,
  HomeOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  ReadOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SearchOutlined,
  TableOutlined,
  TeamOutlined,
  UserOutlined,
  ClusterOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'

interface AppLayoutProps {
  title?: string
  children: ReactNode
}

interface NavItem {
  key: string
  icon: ReactNode
  label: string
}

const PLATFORM_ADMIN_ITEMS: NavItem[] = [
  { key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' },
  { key: '/platform/tenants', icon: <ApartmentOutlined />, label: 'Hesap Yönetimi' },
  { key: '/platform/licenses', icon: <IdcardOutlined />, label: 'Lisans Yönetimi' },
  { key: '/platform/feedback', icon: <CommentOutlined />, label: 'Geri Bildirimler' },
]

const MODULE_ITEMS: Record<string, NavItem> = {
  schools: { key: '/schools', icon: <BankOutlined />, label: 'Okullar' },
  teachers: { key: '/teachers', icon: <TeamOutlined />, label: 'Öğretmenler' },
  classrooms: { key: '/classrooms', icon: <ClusterOutlined />, label: 'Sınıflar' },
  students: { key: '/students', icon: <ReadOutlined />, label: 'Öğrenciler' },
  users: { key: '/users', icon: <UserOutlined />, label: 'Yetkilendirme' },
  schedule: { key: '/schedule', icon: <ScheduleOutlined />, label: 'Ders Programı' },
  leaves: { key: '/leaves', icon: <CalendarOutlined />, label: 'İzin Takibi' },
  duty: { key: '/duty', icon: <FieldTimeOutlined />, label: 'Nöbet Programı' },
  communications: { key: '/communications', icon: <NotificationOutlined />, label: 'Veli İletişim' },
  exams: { key: '/exams', icon: <FileDoneOutlined />, label: 'Sınav Programı' },
  discipline: { key: '/discipline', icon: <ExclamationCircleOutlined />, label: 'Disiplin' },
  guidance: { key: '/guidance', icon: <SafetyOutlined />, label: 'Rehberlik' },
}

const SCHEDULE_EXTRA_ITEM: NavItem = { key: '/subjects', icon: <IdcardOutlined />, label: 'Dersler' }
const NORM_POSITIONS_EXTRA_ITEM: NavItem = {
  key: '/norm-positions',
  icon: <ApartmentOutlined />,
  label: 'Norm Kadro',
}
const TRAININGS_EXTRA_ITEM: NavItem = {
  key: '/trainings',
  icon: <ReadOutlined />,
  label: 'Hizmet İçi Eğitim',
}
const ACADEMIC_YEARS_ITEM: NavItem = {
  key: '/academic-years',
  icon: <CalendarOutlined />,
  label: 'Eğitim Öğretim Yılları',
}
const EXTRA_LESSONS_ITEM: NavItem = { key: '/extra-lessons', icon: <DollarOutlined />, label: 'Ek Ders Puantajı' }
const ATTENDANCE_PAYROLL_ITEM: NavItem = {
  key: '/attendance',
  icon: <ClockCircleOutlined />,
  label: 'İşçi / TYP Puantaj',
}
const ABSENCES_ITEM: NavItem = { key: '/absences', icon: <AlertOutlined />, label: 'Devamsızlık Takibi' }
const DYK_ITEM: NavItem = { key: '/dyk', icon: <BookOutlined />, label: 'DYK Kursları' }
const KELEBEK_ITEM: NavItem = { key: '/kelebek', icon: <TableOutlined />, label: 'Kelebek Sistemi' }
const TEACHER_DOCUMENTS_ITEM: NavItem = {
  key: '/teacher-documents',
  icon: <FileProtectOutlined />,
  label: 'Öğretmen Evrak Arşivi',
}

export function AppLayout({ title = 'Okul İdare Sistemi', children }: AppLayoutProps) {
  const { session, logout, hasRole, hasModule } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const user = session?.user

  const [collapsed, setCollapsed] = useState(false)
  const [search, setSearch] = useState('')

  const items: NavItem[] = session?.is_platform_admin
    ? PLATFORM_ADMIN_ITEMS
    : [
        { key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' },
        ...(session?.modules || []).map((mod) => MODULE_ITEMS[mod]).filter((item): item is NavItem => Boolean(item)),
        ...(hasModule('schedule') ? [SCHEDULE_EXTRA_ITEM] : []),
        ...(hasModule('teachers') ? [NORM_POSITIONS_EXTRA_ITEM, TRAININGS_EXTRA_ITEM, TEACHER_DOCUMENTS_ITEM] : []),
        ...(hasModule('exams') ? [KELEBEK_ITEM] : []),
        ...(hasModule('payroll') ? [EXTRA_LESSONS_ITEM, ATTENDANCE_PAYROLL_ITEM] : []),
        ...(hasModule('attendance') ? [ABSENCES_ITEM, DYK_ITEM] : []),
        ACADEMIC_YEARS_ITEM,
        ...(hasModule('audit') && hasRole('Müdür')
          ? [{ key: '/audit-logs', icon: <AuditOutlined />, label: 'Denetim Kayıtları' } as NavItem]
          : []),
        { key: '/profile', icon: <ContactsOutlined />, label: 'Profilim' },
        { key: '/feedback', icon: <CommentOutlined />, label: 'Geri Bildirim' },
      ]

  const selected = items
    .filter((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0]

  const searchOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    if (!query) return []
    return items
      .filter((item) => item.label.toLocaleLowerCase('tr-TR').includes(query))
      .map((item) => ({
        value: item.key,
        label: (
          <Space>
            {item.icon}
            {item.label}
          </Space>
        ),
      }))
  }, [items, search])

  const goTo = (key: string) => {
    navigate(key)
    setSearch('')
  }

  return (
    <Layout className="app-shell">
      <Layout.Sider
        width={230}
        collapsedWidth={72}
        className="app-sider"
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        breakpoint="lg"
      >
        <div className="app-sider-brand">{collapsed ? 'Lİ' : 'Okul İdare'}</div>

        {!collapsed && (
          <div className="app-sider-search">
            <AutoComplete
              value={search}
              options={searchOptions}
              onChange={setSearch}
              onSelect={(value) => goTo(value as string)}
              popupMatchSelectWidth
              style={{ width: '100%' }}
            >
              <Input prefix={<SearchOutlined />} placeholder="Menülerde ara..." allowClear />
            </AutoComplete>
          </div>
        )}

        <Menu
          mode="inline"
          theme="dark"
          className="app-sider-menu"
          selectedKeys={selected ? [selected.key] : []}
          items={items.map(({ key, icon, label }) => ({ key, icon, label }))}
          onClick={({ key }) => goTo(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <span className="app-header-title">{title}</span>
          </Space>
          <Space>
            {!session?.is_platform_admin && (
              <Button type="link" onClick={() => goTo('/profile')} style={{ paddingInline: 4 }}>
                {user?.full_name}
              </Button>
            )}
            {session?.is_platform_admin && <span className="app-header-user">{user?.full_name}</span>}
            <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
              Çıkış
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content className="app-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  )
}
