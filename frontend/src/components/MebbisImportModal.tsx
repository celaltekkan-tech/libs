import { useState } from 'react'
import { App, Alert, Button, Checkbox, Input, Modal, Select, Tag, Typography, Upload } from 'antd'
import { SortableTable } from './SortableTable'
import { InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile } from 'antd/es/upload/interface'
import { commitMebbisImport, previewMebbisImport, type MebbisImportRow } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import { tablePagination } from '../utils/tablePagination'

const PERSONNEL_TYPE_OPTIONS = [
  { value: 'ogretmen', label: 'Öğretmen' },
  { value: 'memur', label: 'Memur' },
  { value: 'isci', label: 'İşçi' },
  { value: 'typ', label: 'TYP Personeli' },
]

interface MebbisImportModalProps {
  open: boolean
  schoolId: number | null
  schoolName?: string | null
  onCancel: () => void
  onImported: () => void
}

export function MebbisImportModal({ open, schoolId, schoolName, onCancel, onImported }: MebbisImportModalProps) {
  const { message } = App.useApp()
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<MebbisImportRow[]>([])
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
    setParsing(true)
    try {
      const parsed = await previewMebbisImport(file)
      setRows(parsed)
      setStep('preview')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setParsing(false)
    }
    return false
  }

  const updateRow = (rowIndex: number, patch: Partial<MebbisImportRow>) => {
    setRows((prev) => prev.map((r) => (r.row_index === rowIndex ? { ...r, ...patch } : r)))
  }

  const handleCommit = async () => {
    if (!schoolId) {
      message.error('Önce üstteki menüden aktif bir okul seçin')
      return
    }
    setCommitting(true)
    try {
      const result = await commitMebbisImport(schoolId, rows)
      message.success(`İçe aktarıldı: ${result.created} yeni, ${result.updated} güncellenen personel`)
      reset()
      onImported()
      onCancel()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const includedCount = rows.filter((r) => r.include !== false).length
  const newCount = rows.filter((r) => r.include !== false && !r.matched_teacher_id).length
  const updateCount = includedCount - newCount

  const columns: ColumnsType<MebbisImportRow> = [
    {
      title: (
        <Checkbox
          checked={rows.length > 0 && rows.every((r) => r.include !== false)}
          indeterminate={rows.some((r) => r.include !== false) && rows.some((r) => r.include === false)}
          onChange={(e) => setRows((prev) => prev.map((r) => ({ ...r, include: e.target.checked })))}
        />
      ),
      width: 40,
      render: (_: unknown, row) => (
        <Checkbox
          checked={row.include !== false}
          onChange={(e) => updateRow(row.row_index, { include: e.target.checked })}
        />
      ),
    },
    {
      title: 'Ad Soyad',
      render: (_: unknown, row) => `${row.first_name} ${row.last_name}`,
    },
    { title: 'TC Kimlik No', dataIndex: 'national_id' },
    {
      title: 'Unvan / Branş',
      render: (_: unknown, row) => [row.gorev, row.brans].filter(Boolean).join(' / ') || '—',
    },
    {
      title: 'Personel Tipi',
      width: 140,
      render: (_: unknown, row) => (
        <Select
          size="small"
          value={row.personnel_type}
          options={PERSONNEL_TYPE_OPTIONS}
          style={{ width: '100%' }}
          onChange={(value) => updateRow(row.row_index, { personnel_type: value })}
        />
      ),
    },
    {
      title: 'Sendika',
      width: 160,
      render: (_: unknown, row) => (
        <Input
          size="small"
          value={row.union_name || ''}
          placeholder="Sendika adı (isteğe bağlı)"
          onChange={(e) => updateRow(row.row_index, { union_name: e.target.value })}
        />
      ),
    },
    {
      title: 'Durum',
      width: 130,
      render: (_: unknown, row) =>
        row.matched_teacher_id ? (
          <Tag color="gold">Güncellenecek</Tag>
        ) : (
          <Tag color="blue">Yeni eklenecek</Tag>
        ),
    },
  ]

  return (
    <Modal
      title="MEBBİS'ten İçe Aktar"
      open={open}
      onCancel={handleCancel}
      width={step === 'preview' ? 1000 : 520}
      destroyOnHidden
      footer={
        step === 'preview'
          ? [
              <Button key="back" onClick={() => setStep('upload')}>
                Geri
              </Button>,
              <Button key="cancel" onClick={handleCancel}>
                Vazgeç
              </Button>,
              <Button
                key="commit"
                type="primary"
                loading={committing}
                disabled={includedCount === 0}
                onClick={() => void handleCommit()}
              >
                İçe Aktar ({includedCount})
              </Button>,
            ]
          : [
              <Button key="cancel" onClick={handleCancel}>
                Vazgeç
              </Button>,
            ]
      }
    >
      {step === 'upload' && (
        <>
          <Typography.Paragraph type="secondary">
            MEBBİS'ten indirdiğiniz "Personel Listesi Özet Bilgiler" dökümünü (.xls/.xlsx) yükleyin. Sendika
            bilgisi bu dosyada bulunmadığından, içe aktarmadan önce önizleme ekranında personel başına manuel
            olarak girebilirsiniz.
          </Typography.Paragraph>
          {!schoolId && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Önce üst menüden bir okul seçin"
              description="İçe aktarılan personel, üst menüde seçili olan aktif okula bağlanacaktır."
            />
          )}
          {schoolId && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`İçe aktarılan personel "${schoolName}" okuluna bağlanacak`}
            />
          )}
          <Upload.Dragger
            accept=".xls,.xlsx"
            multiple={false}
            showUploadList={false}
            disabled={!schoolId || parsing}
            beforeUpload={(file) => void handleFile(file)}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Dosyayı buraya sürükleyin veya seçmek için tıklayın</p>
            <p className="ant-upload-hint">Yalnızca .xls / .xlsx dosyaları desteklenir</p>
          </Upload.Dragger>
        </>
      )}

      {step === 'preview' && (
        <>
          <Typography.Paragraph>
            {rows.length} kayıt bulundu — {newCount} yeni eklenecek, {updateCount} mevcut kayıt güncellenecek
            (TC kimlik no ile eşleşenler MEBBİS verisiyle tamamen güncellenir; Sendika alanı korunur/manuel
            girilir).
          </Typography.Paragraph>
          <SortableTable
            rowKey="row_index"
            size="small"
            columns={columns}
            dataSource={rows}
            pagination={tablePagination(10)}
            scroll={{ x: 900 }}
          />
        </>
      )}
    </Modal>
  )
}
