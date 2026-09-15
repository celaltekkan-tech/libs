import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AutoComplete, Button, Input, Layout, Menu, Select, Space } from 'antd'
import type { MenuProps } from 'antd'
import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  ClockCircleOutlined,
  CommentOutlined,
  BellOutlined,
  CalendarOutlined,
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
  MoonOutlined,
  SunOutlined,
  NotificationOutlined,
  ReadOutlined,
  SafetyOutlined,
  ScheduleOutlined,
  SearchOutlined,
  TableOutlined,
  TeamOutlined,
  UserOutlined,
  ClusterOutlined,
  ContactsOutlined,
  SettingOutlined,
  DatabaseOutlined,
  SolutionOutlined,
  AppstoreOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import { useThemeMode } from '../theme/ThemeContext'
import { FeedbackFabModal } from './FeedbackFabModal'
import { NotificationBell } from './NotificationBell'
import { MENU_PATH_PERMISSION } from '../constants/menuPermissions'

interface AppLayoutProps {
  title?: string
  children: ReactNode
}

interface NavLeaf {
  key: string
  icon?: ReactNode
  label: string
}

interface NavGroup {
  key: string
  icon: ReactNode
  label: string
  children: NavLeaf[]
}

type NavNode = NavLeaf | NavGroup

function isGroup(item: NavNode): item is NavGroup {
  return 'children' in item && Array.isArray(item.children)
}

function flattenLeaves(nodes: NavNode[]): NavLeaf[] {
  const out: NavLeaf[] = []
  for (const node of nodes) {
    if (isGroup(node)) out.push(...node.children)
    else out.push(node)
  }
  return out
}

const PLATFORM_ADMIN_ITEMS: NavNode[] = [
  { key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' },
  { key: '/platform/tenants', icon: <ApartmentOutlined />, label: 'Hesap Yönetimi' },
  { key: '/platform/licenses', icon: <IdcardOutlined />, label: 'Lisans Yönetimi' },
  { key: '/platform/feedback', icon: <CommentOutlined />, label: 'Geri Bildirimler' },
  { key: '/platform/notifications', icon: <BellOutlined />, label: 'Bildirimler' },
  { key: '/platform/backups', icon: <DatabaseOutlined />, label: 'Yedekleme' },
  { key: '/profile', icon: <UserOutlined />, label: 'Profilim' },
]

function buildTenantMenu(opts: {
  hasModule: (m: string) => boolean
  modules: string[]
}): NavNode[] {
  const { hasModule } = opts
  const nodes: NavNode[] = [{ key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' }]

  const definitions: NavLeaf[] = []
  if (hasModule('schools')) definitions.push({ key: '/schools', icon: <BankOutlined />, label: 'Okullar' })
  if (hasModule('classrooms')) definitions.push({ key: '/classrooms', icon: <ClusterOutlined />, label: 'Sınıflar' })
  if (hasModule('students')) definitions.push({ key: '/students', icon: <ReadOutlined />, label: 'Öğrenciler' })
  if (hasModule('teachers')) {
    definitions.push({ key: '/teachers', icon: <TeamOutlined />, label: 'Öğretmenler' })
    definitions.push({ key: '/other-personnel', icon: <ContactsOutlined />, label: 'Diğer Personeller' })
  }
  if (hasModule('schedule')) definitions.push({ key: '/subjects', icon: <IdcardOutlined />, label: 'Dersler' })
  definitions.push({ key: '/academic-years', icon: <CalendarOutlined />, label: 'Eğitim Öğretim Yılları' })
  if (definitions.length > 0) {
    nodes.push({
      key: 'grp-definitions',
      icon: <AppstoreOutlined />,
      label: 'Temel Tanımlar',
      children: definitions,
    })
  }

  const personnel: NavLeaf[] = []
  if (hasModule('teachers')) {
    personnel.push(
      { key: '/norm-positions', icon: <ApartmentOutlined />, label: 'Norm Kadro' },
      { key: '/teacher-documents', icon: <FileProtectOutlined />, label: 'Öğretmen Evrak Arşivi' },
    )
  }
  if (hasModule('leaves')) personnel.push({ key: '/leaves', icon: <CalendarOutlined />, label: 'İzin Takibi' })
  if (hasModule('duty')) personnel.push({ key: '/duty', icon: <FieldTimeOutlined />, label: 'Nöbet Programı' })
  if (hasModule('payroll')) {
    personnel.push(
      { key: '/extra-lessons', icon: <DollarOutlined />, label: 'Ek Ders Puantajı' },
      { key: '/attendance', icon: <ClockCircleOutlined />, label: 'İşçi / TYP Puantaj' },
    )
  }
  if (personnel.length > 0) {
    nodes.push({
      key: 'grp-personnel',
      icon: <SolutionOutlined />,
      label: 'Personel İşleri',
      children: personnel,
    })
  }

  const programs: NavLeaf[] = []
  if (hasModule('schedule')) programs.push({ key: '/schedule', icon: <ScheduleOutlined />, label: 'Ders Programı' })
  if (hasModule('exams')) {
    programs.push(
      { key: '/exams', icon: <FileDoneOutlined />, label: 'Sınav Programı Hazırlama' },
      { key: '/kelebek', icon: <TableOutlined />, label: 'Kelebek Sistemi' },
    )
  }
  if (programs.length > 0) {
    nodes.push({
      key: 'grp-programs',
      icon: <ScheduleOutlined />,
      label: 'Programlar',
      children: programs,
    })
  }

  const studentOps: NavLeaf[] = []
  if (hasModule('attendance')) {
    studentOps.push({
      key: '/absences',
      icon: <AlertOutlined />,
      label: 'DYK Devamsızlık Takibi',
    })
  }
  if (hasModule('communications')) {
    studentOps.push({ key: '/communications', icon: <NotificationOutlined />, label: 'Veli İletişim' })
  }
  if (hasModule('discipline')) {
    studentOps.push({ key: '/discipline', icon: <ExclamationCircleOutlined />, label: 'Disiplin' })
  }
  if (studentOps.length > 0) {
    nodes.push({
      key: 'grp-students',
      icon: <ReadOutlined />,
      label: 'Öğrenci İşleri',
      children: studentOps,
    })
  }

  if (hasModule('guidance')) {
    nodes.push({ key: '/guidance', icon: <SafetyOutlined />, label: 'Rehberlik' })
  }

  const system: NavLeaf[] = []
  if (hasModule('users')) system.push({ key: '/users', icon: <UserOutlined />, label: 'Yetkilendirme' })
  if (hasModule('audit')) {
    system.push({ key: '/audit-logs', icon: <AuditOutlined />, label: 'Denetim Kayıtları' })
  }
  system.push({ key: '/feedback', icon: <CommentOutlined />, label: 'Geri Bildirim' })
  nodes.push({
    key: 'grp-system',
    icon: <SettingOutlined />,
    label: 'Sistem',
    children: system,
  })

  return nodes
}

function toMenuItems(nodes: NavNode[]): MenuProps['items'] {
  return nodes.map((node) => {
    if (isGroup(node)) {
      return {
        key: node.key,
        icon: node.icon,
        label: node.label,
        children: node.children.map((c) => ({ key: c.key, icon: c.icon, label: c.label })),
      }
    }
    return { key: node.key, icon: node.icon, label: node.label }
  })
}

const MOBILE_BREAKPOINT = 767
const SIDER_COLLAPSED_KEY = 'okul-idare-sider-collapsed'

function readStoredCollapsed(): boolean | null {
  try {
    const stored = localStorage.getItem(SIDER_COLLAPSED_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    /* ignore */
  }
  return null
}

function writeStoredCollapsed(value: boolean) {
  try {
    localStorage.setItem(SIDER_COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export function AppLayout({ title = 'Okul İdare Sistemi', children }: AppLayoutProps) {
  const { session, logout, hasModule, hasPermission } = useAuth()
  const { schools, activeSchoolId, setActiveSchoolId } = useActiveSchool()
  const { mode, toggleMode } = useThemeMode()
  const location = useLocation()
  const navigate = useNavigate()
  const user = session?.user

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= MOBILE_BREAKPOINT)
  const [collapsed, setCollapsed] = useState(() => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) return true
    return readStoredCollapsed() ?? false
  })
  const [search, setSearch] = useState('')
  const [openKeys, setOpenKeys] = useState<string[]>([])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const canSeePath = (path: string) => {
    if (session?.is_global_admin || session?.is_platform_admin) return true
    const need = MENU_PATH_PERMISSION[path]
    if (!need) return true
    return hasPermission(need)
  }

  const navNodes: NavNode[] = useMemo(() => {
    if (session?.is_platform_admin) return PLATFORM_ADMIN_ITEMS
    const built = buildTenantMenu({
      hasModule,
      modules: session?.modules || [],
    })
    return built
      .map((node) => {
        if (!isGroup(node)) {
          if (node.key === '/') return node
          return canSeePath(node.key) ? node : null
        }
        const children = node.children.filter((c) => canSeePath(c.key))
        if (children.length === 0) return null
        return { ...node, children }
      })
      .filter((n): n is NavNode => Boolean(n))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasModule, hasPermission])

  const leaves = useMemo(() => flattenLeaves(navNodes), [navNodes])

  const selected = leaves
    .filter((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0]

  const activeGroupKey = useMemo(() => {
    if (!selected) return null
    for (const node of navNodes) {
      if (isGroup(node) && node.children.some((c) => c.key === selected.key)) return node.key
    }
    return null
  }, [navNodes, selected])

  useEffect(() => {
    if (collapsed) return
    if (activeGroupKey) {
      setOpenKeys((prev) => (prev.includes(activeGroupKey) ? prev : [...prev, activeGroupKey]))
    }
  }, [activeGroupKey, collapsed])

  const searchOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('tr-TR')
    if (!query) return []
    return leaves
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
  }, [leaves, search])

  const goTo = (key: string) => {
    if (key.startsWith('grp-')) return
    navigate(key)
    setSearch('')
    if (isMobile) setCollapsed(true)
  }

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      if (!isMobile) writeStoredCollapsed(next)
      return next
    })
  }

  return (
    <Layout className="app-shell">
      {isMobile && !collapsed && (
        <div className="app-sider-backdrop" onClick={() => setCollapsed(true)} />
      )}
      <Layout.Sider
        width={240}
        collapsedWidth={72}
        className="app-sider"
        collapsible
        collapsed={collapsed}
        trigger={null}
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
          inlineCollapsed={collapsed}
          selectedKeys={selected ? [selected.key] : []}
          triggerSubMenuAction="click"
          getPopupContainer={() => document.body}
          {...(collapsed ? {} : { openKeys, onOpenChange: setOpenKeys })}
          items={toMenuItems(navNodes)}
          onClick={({ key }) => goTo(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header className="app-header">
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
            />
            <span className="app-header-title">{title}</span>
          </Space>
          <Space wrap className="app-header-actions">
            {!session?.is_platform_admin && schools.length > 0 && (
              <Select
                size="small"
                value={activeSchoolId ?? undefined}
                onChange={(value) => setActiveSchoolId(value)}
                options={schools.map((s) => ({ value: s.id, label: s.name }))}
                style={{ minWidth: 160 }}
                placeholder="Okul seçin"
                suffixIcon={<BankOutlined />}
                title="Aktif okul"
              />
            )}
            <Button
              type="text"
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              onClick={toggleMode}
              title={mode === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
              aria-label={mode === 'dark' ? 'Açık moda geç' : 'Koyu moda geç'}
            />
            <NotificationBell />
            <Button
              type="link"
              icon={<UserOutlined />}
              onClick={() => goTo('/profile')}
              style={{ paddingInline: 4 }}
              title="Profilim"
            >
              <span className="app-header-username">{user?.full_name}</span>
            </Button>
            <Button icon={<LogoutOutlined />} onClick={() => void logout()}>
              <span className="app-header-logout-label">Çıkış</span>
            </Button>
          </Space>
        </Layout.Header>
        <Layout.Content className="app-content">{children}</Layout.Content>
      </Layout>
      {!session?.is_platform_admin && <FeedbackFabModal />}
    </Layout>
  )
}
