import { useState } from 'react'
import { App, Alert, Modal, Select, Tag, Typography, Upload } from 'antd'
import { SortableTable } from './SortableTable'
import { InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile } from 'antd/es/upload/interface'
import { commitIncidentExcel, previewIncidentExcel } from '../api/discipline'
import { getErrorMessage } from '../api/client'
import { PARTICIPANT_ROLE_OPTIONS } from '../types/discipline'
import type { DisciplineExcelPreviewRow } from '../types/discipline'
import { tablePagination } from '../utils/tablePagination'

interface DisciplineExcelImportModalProps {
  open: boolean
  incidentId: number | null
  onCancel: () => void
  onImported: () => void
}

export function DisciplineExcelImportModal({ open, incidentId, onCancel, onImported }: DisciplineExcelImportModalProps) {
  const { message } = App.useApp()
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<DisciplineExcelPreviewRow[]>([])
  const [committing, setCommitting] = useState(false)

  const reset = () => {
    setStep('upload')
    setRows([])
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleFile = async (file: RcFile) => {
    if (!incidentId) return false
    setParsing(true)
    try {
      const parsed = await previewIncidentExcel(incidentId, file)
      setRows(parsed)
      setStep('preview')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setParsing(false)
    }
    return false
  }

  const updateRow = (rowIndex: number, patch: Partial<DisciplineExcelPreviewRow>) => {
    setRows((prev) => prev.map((r) => (r.row_index === rowIndex ? { ...r, ...patch } : r)))
  }

  const handleCommit = async () => {
    if (!incidentId) return
    const matchedRows = rows.filter((r) => r.matched && !r.already_added)
    if (matchedRows.length === 0) {
      message.warning('Eklenecek eşleşen öğrenci bulunamadı')
      return
    }
    setCommitting(true)
    try {
      const result = await commitIncidentExcel(
        incidentId,
        matchedRows.map((r) => ({ student_id: r.student_id as number, role: r.role })),
      )
      message.success(`${result.created} öğrenci eklendi${result.skipped ? `, ${result.skipped} zaten kayıtlıydı` : ''}`)
      reset()
      onImported()
      onCancel()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const matchedCount = rows.filter((r) => r.matched && !r.already_added).length

  const columns: ColumnsType<DisciplineExcelPreviewRow> = [
    { title: 'Girilen No / TC', render: (_: unknown, r) => r.input_number || r.input_national_id || '—' },
    { title: 'Ad Soyad', dataIndex: 'full_name' },
    { title: 'Sınıf', dataIndex: 'classroom' },
    {
      title: 'Durum',
      render: (_: unknown, r) => {
        if (r.already_added) return <Tag color="orange">Zaten Ekli</Tag>
        if (!r.matched) return <Tag color="red">Eşleşmedi</Tag>
        return <Tag color="green">Eşleşti</Tag>
      },
    },
    {
      title: 'Rol',
      width: 220,
      render: (_: unknown, r) => (
        <Select
          size="small"
          style={{ width: 200 }}
          value={r.role}
          options={PARTICIPANT_ROLE_OPTIONS}
          disabled={!r.matched || r.already_added}
          onChange={(role) => updateRow(r.row_index, { role })}
        />
      ),
    },
  ]

  return (
    <Modal
      title="Excel'den Öğrenci Ekle"
      open={open}
      onCancel={handleCancel}
      onOk={step === 'preview' ? handleCommit : undefined}
      okText={`Ekle (${matchedCount})`}
      okButtonProps={{ disabled: matchedCount === 0 }}
      confirmLoading={committing}
      cancelText="Vazgeç"
      width={720}
      footer={step === 'upload' ? null : undefined}
      destroyOnHidden
    >
      {step === 'upload' ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Excel dosyasında 'Okul Numarası' veya 'TC Kimlik No' sütunu bulunmalıdır. Sistemdeki öğrencilerle eşleştirilecektir."
          />
          <Upload.Dragger accept=".xlsx,.xls" showUploadList={false} beforeUpload={handleFile} disabled={parsing}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">{parsing ? 'Yükleniyor...' : 'Excel dosyasını sürükleyin veya seçin'}</p>
          </Upload.Dragger>
        </>
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            {matchedCount} öğrenci eklenecek. Eşleşmeyen satırlar atlanır.
          </Typography.Paragraph>
          <SortableTable rowKey="row_index" columns={columns} dataSource={rows} pagination={tablePagination(10)} scroll={{ x: 'max-content' }} />
        </>
      )}
    </Modal>
  )
}
