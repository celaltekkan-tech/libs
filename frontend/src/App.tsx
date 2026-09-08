import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import trTR from 'antd/locale/tr_TR'
import { AuthProvider } from './auth/AuthContext'
import { GuestRoute, PlatformAdminRoute, ProtectedRoute } from './auth/routes'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { TenantsListPage } from './pages/platform/TenantsListPage'
import { TenantDetailPage } from './pages/platform/TenantDetailPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { FeedbackListPage } from './pages/platform/FeedbackListPage'

const theme = {
  token: {
    colorPrimary: '#1d4e89',
    borderRadius: 8,
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
}

export default function App() {
  return (
    <ConfigProvider locale={trTR} theme={theme}>
      <AntApp>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route path="/login" element={<LoginPage />} />
              </Route>
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route element={<PlatformAdminRoute />}>
                  <Route path="/platform/tenants" element={<TenantsListPage />} />
                  <Route path="/platform/tenants/:id" element={<TenantDetailPage />} />
                  <Route path="/platform/feedback" element={<FeedbackListPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AntApp>
    </ConfigProvider>
  )
}
