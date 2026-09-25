import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AutoComplete, Button, Input, Layout, Menu, Select, Space } from 'antd'
import type { MenuProps } from 'antd'
import {
  ApartmentOutlined,
  BankOutlined,
  BellOutlined,
  CommentOutlined,
  DatabaseOutlined,
  GlobalOutlined,
  HomeOutlined,
  IdcardOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  MoonOutlined,
  SunOutlined,
  UserOutlined,
  QuestionCircleOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons'
import { useAuth } from '../auth/AuthContext'
import { useActiveSchool } from '../auth/ActiveSchoolContext'
import { useThemeMode } from '../theme/ThemeContext'
import { FeedbackFabModal } from './FeedbackFabModal'
import { NotificationBell } from './NotificationBell'
import { MandatoryWorkReminder } from './MandatoryWorkReminder'
import { MenuLayoutEditorModal } from './MenuLayoutEditorModal'
import { PageHelpModal } from './PageHelpModal'
import { MENU_PATH_PERMISSION } from '../constants/menuPermissions'
import { CALENDAR_MENU_SOURCE_PERMISSIONS } from '../types/calendarEvent'
import { getPageHelp } from '../constants/pageHelp'
import {
  buildTenantMenu,
  flattenNavLeaves,
  isNavGroup,
  type NavLeaf,
  type NavNode,
} from '../nav/tenantMenu'
import { applyMenuLayout } from '../utils/menuLayout'
import { SchoolLogoImage } from './SchoolLogoImage'

interface AppLayoutProps {
  title?: string
  children: ReactNode
}

const PLATFORM_ADMIN_ITEMS: NavNode[] = [
  { key: '/', icon: <HomeOutlined />, label: 'Ana Sayfa' },
  { key: '/platform/tenants', icon: <ApartmentOutlined />, label: 'Hesap Yönetimi' },
  { key: '/platform/roles', icon: <SafetyCertificateOutlined />, label: 'Global Yetkiler' },
  { key: '/platform/licenses', icon: <IdcardOutlined />, label: 'Lisans Yönetimi' },
  { key: '/platform/directory-schools', icon: <GlobalOutlined />, label: 'MEB Okul Kataloğu' },
  { key: '/platform/feedback', icon: <CommentOutlined />, label: 'Geri Bildirimler' },
  { key: '/platform/notifications', icon: <BellOutlined />, label: 'Bildirimler' },
  { key: '/platform/backups', icon: <DatabaseOutlined />, label: 'Yedekleme' },
  { key: '/platform/sms-test', icon: <MessageOutlined />, label: 'SMS Test' },
  { key: '/profile', icon: <UserOutlined />, label: 'Profilim' },
]

function toMenuItems(nodes: NavNode[]): MenuProps['items'] {
  const items: MenuProps['items'] = []
  nodes.forEach((node, idx) => {
    if (idx > 0) {
      items!.push({ type: 'divider', key: `divider-${idx}` })
    }
    if (isNavGroup(node)) {
      items!.push({
        key: node.key,
        icon: node.icon,
        label: node.label,
        children: node.children.map((c) => ({ key: c.key, icon: c.icon, label: c.label })),
      })
    } else {
      items!.push({ key: node.key, icon: node.icon, label: node.label })
    }
  })
  return items
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
  const { schools, activeSchoolId, activeSchool, setActiveSchoolId } = useActiveSchool()
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
  const [helpOpen, setHelpOpen] = useState(false)
  const [menuEditorOpen, setMenuEditorOpen] = useState(false)

  const pageHelp = useMemo(() => getPageHelp(location.pathname), [location.pathname])

  useEffect(() => {
    setHelpOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const canSeePath = (path: string) => {
    if (session?.is_global_admin || session?.is_platform_admin) return true
    if (path === '/calendar') {
      return CALENDAR_MENU_SOURCE_PERMISSIONS.some((perm) => hasPermission(perm))
    }
    const need = MENU_PATH_PERMISSION[path]
    if (!need) return true
    return hasPermission(need)
  }

  const catalogNodes = useMemo(() => {
    if (session?.is_platform_admin) return PLATFORM_ADMIN_ITEMS
    const built = buildTenantMenu({ hasModule })
    return built
      .map((node) => {
        if (!isNavGroup(node)) {
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

  const navNodes: NavNode[] = useMemo(() => {
    if (session?.is_platform_admin) return PLATFORM_ADMIN_ITEMS
    return applyMenuLayout(catalogNodes, session?.menu_layout)
  }, [session?.is_platform_admin, session?.menu_layout, catalogNodes])

  const leaves = useMemo(() => flattenNavLeaves(navNodes), [navNodes])

  const selected = leaves
    .filter((item) => location.pathname === item.key || location.pathname.startsWith(`${item.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0]

  const activeGroupKey = useMemo(() => {
    if (!selected) return null
    for (const node of navNodes) {
      if (isNavGroup(node) && node.children.some((c) => c.key === selected.key)) return node.key
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
      .filter((item: NavLeaf) => item.label.toLocaleLowerCase('tr-TR').includes(query))
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

  const canEditMenu = Boolean(session?.is_global_admin && !session?.is_platform_admin)

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
        <div className="app-sider-brand">
          <SchoolLogoImage school={session?.is_platform_admin ? null : activeSchool} className="app-brand-logo" />
          {collapsed
            ? activeSchool?.logo_url
              ? null
              : 'Lİ'
            : 'Okul İdare'}
        </div>

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

        {canEditMenu && (
          <div className="app-sider-menu-edit">
            <Button
              type="text"
              block
              icon={<UnorderedListOutlined />}
              onClick={() => setMenuEditorOpen(true)}
              title="Menüyü düzenle"
            >
              {!collapsed && 'Menüyü düzenle'}
            </Button>
          </div>
        )}
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
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              onClick={() => setHelpOpen(true)}
              title="Bu sayfa için yardım"
              aria-label="Bu sayfa için yardım"
            />
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
      {!session?.is_platform_admin && <MandatoryWorkReminder />}
      <PageHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} content={pageHelp} />
      {canEditMenu && (
        <MenuLayoutEditorModal
          open={menuEditorOpen}
          onClose={() => setMenuEditorOpen(false)}
          catalogNodes={catalogNodes}
          initialLayout={session?.menu_layout}
        />
      )}
    </Layout>
  )
}
