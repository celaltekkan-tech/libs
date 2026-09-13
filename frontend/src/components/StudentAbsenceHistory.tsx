import { useEffect, useMemo, useState } from 'react'
import { App, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { listAbsences } from '../api/absences'
import { getErrorMessage } from '../api/client'
import {
  ABSENCE_TYPE_COLORS,
  ABSENCE_TYPE_LABELS,
  ABSENCE_TYPE_WEIGHTS,
} from '../types/studentAbsence'
import type { StudentAbsence } from '../types/studentAbsence'

function formatTotalDays(total: number): string {
  const text = Number.isInteger(total) ? String(total) : total.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
  return `${text} gün`
}

export function computeAbsenceTotal(records: StudentAbsence[]): number {
  return records.reduce((sum, r) => sum + (ABSENCE_TYPE_WEIGHTS[r.absence_type] ?? 0), 0)
}

interface StudentAbsenceHistoryProps {
  studentId: number
  studentName?: string
  /** Kayıt silindikten / güncellendikten sonra yenilemek için */
  refreshKey?: number
}

export function StudentAbsenceHistory({ studentId, studentName, refreshKey = 0 }: StudentAbsenceHistoryProps) {
  const { message } = App.useApp()
  const [records, setRecords] = useState<StudentAbsence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAbsences({ student_id: studentId })
      .then((data) => {
        if (!cancelled) setRecords(data)
      })
      .catch((err) => {
        if (!cancelled) message.error(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [studentId, refreshKey, message])

  const total = useMemo(() => computeAbsenceTotal(records), [records])

  const columns: ColumnsType<StudentAbsence> = [
    {
      title: 'Tarih',
      dataIndex: 'absence_date',
      render: (v: string) => dayjs(v).format('DD.MM.YYYY'),
      width: 120,
    },
    {
      title: 'Durum',
      dataIndex: 'absence_type',
      render: (v: string) => <Tag color={ABSENCE_TYPE_COLORS[v]}>{ABSENCE_TYPE_LABELS[v] || v}</Tag>,
      width: 130,
    },
    {
      title: 'Katkı',
      width: 80,
      render: (_: unknown, r: StudentAbsence) => {
        const w = ABSENCE_TYPE_WEIGHTS[r.absence_type] ?? 0
        if (w === 0) return <Typography.Text type="secondary">—</Typography.Text>
        return w === 0.5 ? '0,5' : String(w)
      },
    },
    {
      title: 'Açıklama',
      dataIndex: 'reason',
      render: (v: string | null) => v || '—',
    },
  ]

  return (
    <div>
      <Space wrap style={{ marginBottom: 12, width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text>
          {studentName ? <strong>{studentName}</strong> : null}
          {studentName ? ' — ' : null}
          Toplam devamsızlık:{' '}
          <Typography.Text strong style={{ fontSize: 16 }}>
            {loading ? '…' : formatTotalDays(total)}
          </Typography.Text>
        </Typography.Text>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          İki yarım gün 1 gün sayılır; mazeretli / raporlu toplama dahil edilmez.
        </Typography.Text>
      </Space>
      <Table
        size="small"
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={records}
        pagination={records.length > 10 ? { pageSize: 10 } : false}
        locale={{ emptyText: 'Bu öğrenci için devamsızlık kaydı yok.' }}
      />
    </div>
  )
}
