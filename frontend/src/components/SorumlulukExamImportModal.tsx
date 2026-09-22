import { useState } from 'react'
import { App, Alert, Button, Modal, Tag, Typography, Upload } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { RcFile } from 'antd/es/upload/interface'
import { SortableTable } from './SortableTable'
import { commitSorumlulukImport, previewSorumlulukImport } from '../api/exams'
import { getErrorMessage } from '../api/client'
import type { SorumlulukImportPreview, SorumlulukImportPreviewRow } from '../types/exam'
import { tablePagination } from '../utils/tablePagination'

interface SorumlulukExamImportModalProps {
  open: boolean
  schoolId: number | null
  hasExisting: boolean
  onCancel: () => void
  onImported: () => void
}

export function SorumlulukExamImportModal({
  open,
  schoolId,
  hasExisting,
  onCancel,
  onImported,
}: SorumlulukExamImportModalProps) {
  const { message } = App.useApp()
  const [step, setStep] = useState<'upload' | 'preview'>('upload')
  const [parsing, setParsing] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [preview, setPreview] = useState<SorumlulukImportPreview | null>(null)

  const reset = () => {
    setStep('upload')
    setPreview(null)
  }

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleFile = async (file: RcFile) => {
    setParsing(true)
    try {
      const parsed = await previewSorumlulukImport(file)
      setPreview(parsed)
      setStep('preview')
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setParsing(false)
    }
    return false
  }

  const handleCommit = async () => {
    if (!preview) return
    setCommitting(true)
    try {
      const result = await commitSorumlulukImport(schoolId, preview.rows)
      message.success(
        (result.created_subjects
          ? `${result.created_subjects} ders kataloğa eklendi, `
          : '') +
          `${result.created} kayıt içe aktarıldı` +
          (result.preserved ? ` (${result.preserved} sınav tarihi korundu)` : ''),
      )
      reset()
      onImported()
      onCancel()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCommitting(false)
    }
  }

  const columns: ColumnsType<SorumlulukImportPreviewRow> = [
    { title: 'No', dataIndex: 'student_number', width: 80 },
    { title: 'Ad Soyad', dataIndex: 'student_name' },
    {
      title: 'Şube',
      key: 'class',
      width: 90,
      render: (_, r) =>
        r.current_class_level && r.current_section
          ? `${r.current_class_level}/${r.current_section}`
          : '—',
    },
    {
      title: 'Sorumlu ders',
      key: 'subject',
      render: (_, r) => `${r.subject_class_level}. ${r.subject_name}`,
    },
    {
      title: 'Öğrenci',
      dataIndex: 'student_matched',
      width: 110,
      render: (matched: boolean, r) => (
        <Tag color={matched ? 'green' : 'orange'}>
          {matched ? (r.student_match === 'name' ? 'Ada göre' : 'Eşleşti') : 'Yok'}
        </Tag>
      ),
    },
    {
      title: 'Ders',
      dataIndex: 'subject_matched',
      width: 90,
      render: (matched: boolean) => (
        <Tag color={matched ? 'green' : 'orange'}>{matched ? 'Eşleşti' : 'Yok'}</Tag>
      ),
    },
  ]

  return (
    <Modal
      title="MEBBİS sorumluluk listesi"
      open={open}
      onCancel={handleCancel}
      width={920}
      destroyOnHidden
      footer={
        step === 'preview'
          ? [
              <Button key="back" onClick={() => setStep('upload')}>
                Başka dosya
              </Button>,
              <Button key="ok" type="primary" loading={committing} onClick={() => void handleCommit()}>
                İçe aktar
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
        <Upload.Dragger
          accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => handleFile(file)}
          disabled={parsing}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {parsing ? 'Okunuyor…' : 'MEBBİS «Öğrencilerin Sorumlu Olduğu Dersler» Excel dosyasını bırakın'}
          </p>
          <p className="ant-upload-hint">.xls veya .xlsx</p>
        </Upload.Dragger>
      )}

      {step === 'preview' && preview && (
        <>
          {hasExisting && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Mevcut sorumluluk kayıtlarının üzerine yazılacak. Aynı öğrenci-ders çiftinin sınav tarihi varsa korunur."
            />
          )}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message={
              `${preview.stats.student_count} öğrenci, ${preview.stats.row_count} ders kaydı, ${preview.stats.subject_count} farklı ders. ` +
              (preview.stats.unmatched_students
                ? `${preview.stats.unmatched_students} öğrenci okul listesinde bulunamadı. `
                : 'Tüm öğrenciler eşleşti. ') +
              (preview.stats.unmatched_subjects
                ? `${preview.stats.unmatched_subject_names.length} ders katalogda yok; önce eklenecek, sonra içe aktarılacak.`
                : 'Tüm dersler eşleşti.')
            }
          />
          {preview.stats.unmatched_subject_names.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Eklenecek dersler"
              description={preview.stats.unmatched_subject_names.join(', ')}
            />
          )}
          {preview.title && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
              {preview.title}
            </Typography.Paragraph>
          )}
          <SortableTable
            size="small"
            rowKey={(r) => `${r.row_index}-${r.student_number}-${r.subject_name}`}
            columns={columns}
            dataSource={preview.rows}
            pagination={tablePagination(20)}
            scroll={{ y: 360 }}
          />
        </>
      )}
    </Modal>
  )
}
