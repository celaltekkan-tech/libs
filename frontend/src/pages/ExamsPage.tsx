import { Tabs, Typography } from 'antd'
import { AppLayout } from '../components/AppLayout'
import { OrtakExamPlanner } from '../components/OrtakExamPlanner'
import { SorumlulukExamPlanner } from '../components/SorumlulukExamPlanner'
import { useAuth } from '../auth/AuthContext'

export function ExamsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission('exams.create')
  const canUpdate = hasPermission('exams.update')
  const canDelete = hasPermission('exams.delete')

  return (
    <AppLayout title="Sınav Programı Hazırlama">
      <Typography.Title level={3} style={{ margin: 0, marginBottom: 16 }}>
        Sınav Programı Hazırlama
      </Typography.Title>

      <Tabs
        items={[
          {
            key: 'ortak',
            label: 'Ortak Sınav',
            children: <OrtakExamPlanner canCreate={canCreate} canDelete={canDelete} />,
          },
          {
            key: 'sorumluluk',
            label: 'Sorumluluk Sınavı',
            children: (
              <SorumlulukExamPlanner
                canCreate={canCreate}
                canUpdate={canUpdate}
                canDelete={canDelete}
              />
            ),
          },
        ]}
      />
    </AppLayout>
  )
}
