import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Form, InputNumber, Select, Typography } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { SortableTable } from '../SortableTable'
import {
  createSubjectClassHour,
  deleteSubjectClassHour,
  listSubjectClassHours,
  updateSubjectClassHour,
} from '../../api/subjectClassHours'
import { getErrorMessage } from '../../api/client'
import { compareClassrooms } from '../../types/classroom'
import type { SubjectClassHour } from '../../types/subject'
import type { TimetableCtx } from './shared'

const LEVELS = ['9', '10', '11', '12']

export function LessonPoolTab({ ctx }: { ctx: TimetableCtx }) {
  const { message, modal } = App.useApp()
  const [rows, setRows] = useState<SubjectClassHour[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm<{ subject_id: number; class_level: string; weekly_hours: number }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await listSubjectClassHours())
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const subjectName = useMemo(() => {
    const map = new Map(ctx.subjects.map((subject) => [subject.id, subject.name]))
    return (id: number) => map.get(id) || 'Ders'
  }, [ctx.subjects])

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byName = subjectName(a.subject_id).localeCompare(subjectName(b.subject_id), 'tr')
        if (byName) return byName
        return compareClassrooms({ class_level: a.class_level, section: '' }, { class_level: b.class_level, section: '' })
      }),
    [rows, subjectName],
  )

  const onAdd = async (values: { subject_id: number; class_level: string; weekly_hours: number }) => {
    try {
      await createSubjectClassHour(ctx.project.tenant_id, values)
      form.resetFields(['weekly_hours'])
      message.success('Ders havuzuna eklendi')
      await load()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onHours = async (row: SubjectClassHour, weeklyHours: number) => {
    try {
      await updateSubjectClassHour(row.id, weeklyHours)
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, weekly_hours: weeklyHours } : item)))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onDelete = (row: SubjectClassHour) => {
    modal.confirm({
      title: 'Havuzdan kaldırılsın mı?',
      content: `${subjectName(row.subject_id)} dersi ${row.class_level}. sınıflarda okutulabilir listesinden çıkarılacak.`,
      okText: 'Kaldır',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteSubjectClassHour(row.id)
          await load()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const columns: ColumnsType<SubjectClassHour> = [
    { title: 'Ders', render: (_v, row) => subjectName(row.subject_id) },
    { title: 'Sınıf', dataIndex: 'class_level', render: (v: string) => `${v}. sınıf` },
    {
      title: 'Okutulabileceği saat',
      dataIndex: 'weekly_hours',
      render: (v: number, row) => (
        <InputNumber
          min={0}
          max={40}
          value={v}
          disabled={!ctx.canUpdate}
          onBlur={(event) => {
            const next = Number(event.target.value)
            if (!Number.isNaN(next) && next !== v) void onHours(row, next)
          }}
        />
      ),
    },
    ...(ctx.canDelete
      ? [
          {
            title: 'İşlem',
            width: 80,
            render: (_v: unknown, row: SubjectClassHour) => (
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onDelete(row)} />
            ),
          },
        ]
      : []),
  ]

  return (
    <>
      <Typography.Paragraph type="secondary">
        Ders havuzu, bir dersin hangi sınıf seviyesinde kaç saat okutulabileceğini tutar. Her şubeye otomatik
        yazılmaz. Örneğin Almanca 12. sınıflarda yalnız dil şubesinde okutuluyorsa burada 12. sınıf saatini
        tanımlayın; hangi şubeye gireceğini bir sonraki adımda siz seçin.
      </Typography.Paragraph>
      {ctx.canCreate && (
        <Form form={form} layout="inline" onFinish={onAdd} style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Form.Item name="subject_id" rules={[{ required: true, message: 'Ders seçin' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Ders"
              style={{ width: 220 }}
              options={ctx.subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
            />
          </Form.Item>
          <Form.Item name="class_level" rules={[{ required: true, message: 'Sınıf seçin' }]}>
            <Select placeholder="Sınıf" style={{ width: 120 }} options={LEVELS.map((level) => ({ value: level, label: `${level}. sınıf` }))} />
          </Form.Item>
          <Form.Item name="weekly_hours" rules={[{ required: true, message: 'Saat girin' }]}>
            <InputNumber min={1} max={40} placeholder="Saat" />
          </Form.Item>
          <Form.Item>
            <Button htmlType="submit" icon={<PlusOutlined />}>
              Ekle
            </Button>
          </Form.Item>
        </Form>
      )}
      <SortableTable rowKey="id" loading={loading} columns={columns} dataSource={sorted} pagination={false} />
      {!loading && sorted.length === 0 && (
        <Typography.Text type="secondary">Henüz ders havuzu boş.</Typography.Text>
      )}
    </>
  )
}
