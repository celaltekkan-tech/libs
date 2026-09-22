import { useEffect, useState } from 'react'
import { App, Alert, Button, Empty, Form, Input, List, Modal, Select, Space, Steps, Tag, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons'
import {
  addParticipant,
  createIncident,
  createStatement,
  downloadIncidentDocument,
  downloadStatementDocument,
  removeParticipant,
  updateIncident,
} from '../api/discipline'
import { listStudents } from '../api/students'
import { getErrorMessage } from '../api/client'
import { downloadBlob } from '../utils/download'
import { PARTICIPANT_ROLE_OPTIONS, STATEMENT_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineIncident, DisciplineIncidentPayload, DisciplineParticipant } from '../types/discipline'
import type { SchoolAssignment } from '../types/auth'
import type { Student } from '../types/student'

interface DisciplineIncidentWizardModalProps {
  open: boolean
  schools: SchoolAssignment[]
  defaultSchoolId: number | null
  onCancel: () => void
  onFinished: (incident: DisciplineIncident) => void
}

function studentLabel(p: DisciplineParticipant): string {
  return p.Student ? `${p.Student.first_name} ${p.Student.last_name}` : `#${p.id}`
}

export function DisciplineIncidentWizardModal({ open, schools, defaultSchoolId, onCancel, onFinished }: DisciplineIncidentWizardModalProps) {
  const { message } = App.useApp()
  const [step, setStep] = useState(0)
  const [incidentForm] = Form.useForm<DisciplineIncidentPayload>()
  const [participantForm] = Form.useForm<{ student_id: number; role: string }>()
  const [statementForm] = Form.useForm<{ participant_id: number; statement_type: string; content: string }>()

  const [incident, setIncident] = useState<DisciplineIncident | null>(null)
  const [participants, setParticipants] = useState<DisciplineParticipant[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [savingIncident, setSavingIncident] = useState(false)
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [creatingStatement, setCreatingStatement] = useState(false)

  useEffect(() => {
    if (open) {
      setStep(0)
      setIncident(null)
      setParticipants([])
      incidentForm.resetFields()
      incidentForm.setFieldsValue({ school_id: defaultSchoolId ?? schools[0]?.id })
      void listStudents().then(setStudents).catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSchoolId, schools])

  const handleClose = () => {
    if (incident) onFinished({ ...incident, Participants: participants })
    onCancel()
  }

  const goToStep1 = async () => {
    try {
      const values = await incidentForm.validateFields()
      setSavingIncident(true)
      if (incident) {
        const updated = await updateIncident(incident.id, values)
        setIncident(updated)
      } else {
        const created = await createIncident(values)
        setIncident(created)
      }
      setStep(1)
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) return
      message.error(getErrorMessage(err))
    } finally {
      setSavingIncident(false)
    }
  }

  const onAddParticipant = async (values: { student_id: number; role: string }) => {
    if (!incident) return
    setAddingParticipant(true)
    try {
      const row = await addParticipant(incident.id, values)
      setParticipants((prev) => [...prev, row])
      participantForm.resetFields()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setAddingParticipant(false)
    }
  }

  const onRemoveParticipant = async (p: DisciplineParticipant) => {
    try {
      await removeParticipant(p.id)
      setParticipants((prev) => prev.filter((x) => x.id !== p.id))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const availableStudents = students.filter((s) => !participants.some((p) => p.student_id === s.id))

  const download = async (fn: () => Promise<Blob>, filename: string) => {
    try {
      const blob = await fn()
      downloadBlob(blob, filename)
      message.success('Belge oluşturuldu')
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onCreateStatement = async (values: { participant_id: number; statement_type: string; content: string }) => {
    setCreatingStatement(true)
    try {
      const row = await createStatement(values)
      await download(() => downloadStatementDocument(row.id), `ifade-${row.id}.docx`)
      statementForm.resetFields()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setCreatingStatement(false)
    }
  }

  return (
    <Modal
      title="Yeni Disiplin Olayı Sihirbazı"
      open={open}
      onCancel={handleClose}
      width={720}
      destroyOnHidden
      footer={
        <Space>
          {step > 0 && <Button onClick={() => setStep(step - 1)}>Geri</Button>}
          {step < 2 && (
            <Button type="primary" loading={savingIncident} onClick={step === 0 ? goToStep1 : () => setStep(2)}>
              İleri
            </Button>
          )}
          {step === 2 && (
            <Button type="primary" onClick={handleClose}>
              Bitir
            </Button>
          )}
        </Space>
      }
    >
      <Steps
        current={step}
        style={{ marginBottom: 24 }}
        items={[{ title: 'Olay Bilgileri' }, { title: 'Katılımcı Ekle' }, { title: 'İlk Belge' }]}
      />

      {step === 0 && (
        <Form form={incidentForm} layout="vertical">
          <Form.Item name="school_id" label="Okul" rules={[{ required: true, message: 'Okul seçimi zorunludur' }]}>
            <Select options={schools.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="title" label="Olay Adı" rules={[{ required: true, message: 'Olay adı zorunludur' }]}>
            <Input placeholder="Örn: Ders Çıkışı Kavga" />
          </Form.Item>
          <Form.Item name="incident_date" label="Olay Tarihi" rules={[{ required: true, message: 'Tarih zorunludur' }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="incident_time" label="Olay Saati">
            <Input type="time" />
          </Form.Item>
          <Form.Item name="location" label="Olay Yeri">
            <Input placeholder="Örn: 11/E sınıfı, koridor..." />
          </Form.Item>
          <Form.Item name="summary" label="Olayın Özeti">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="complainant_name" label="Dilekçeyi Veren Kişi">
            <Input />
          </Form.Item>
          <Form.Item name="complaint_ref_date" label="Dilekçe Tarihi">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="complaint_ref_no" label="Dilekçe Sayısı">
            <Input />
          </Form.Item>
        </Form>
      )}

      {step === 1 && incident && (
        <>
          <Typography.Paragraph type="secondary">
            {incident.incident_code} - {incident.title} olayına katılımcı öğrencileri ekleyin. Daha fazlasını, olayı kaydettikten sonra da
            ekleyebilirsiniz.
          </Typography.Paragraph>
          <Form form={participantForm} layout="inline" onFinish={onAddParticipant} style={{ marginBottom: 16 }}>
            <Form.Item name="student_id" rules={[{ required: true, message: 'Öğrenci seçiniz' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                style={{ width: 240 }}
                placeholder="Öğrenci seç"
                options={availableStudents.map((s) => ({ value: s.id, label: `${s.first_name} ${s.last_name}${s.student_number ? ` (${s.student_number})` : ''}` }))}
              />
            </Form.Item>
            <Form.Item name="role" rules={[{ required: true, message: 'Rol seçiniz' }]} initialValue="suclanan">
              <Select style={{ width: 180 }} options={PARTICIPANT_ROLE_OPTIONS} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={addingParticipant}>
                Ekle
              </Button>
            </Form.Item>
          </Form>
          <List
            dataSource={participants}
            locale={{ emptyText: <Empty description="Henüz katılımcı eklenmedi" /> }}
            renderItem={(p) => (
              <List.Item actions={[<Button key="sil" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemoveParticipant(p)} />]}>
                <List.Item.Meta title={<Space>{studentLabel(p)} <Tag>{PARTICIPANT_ROLE_OPTIONS.find((r) => r.value === p.role)?.label}</Tag></Space>} />
              </List.Item>
            )}
          />
        </>
      )}

      {step === 2 && incident && (
        <>
          <Typography.Title level={5}>Olay Belgeleri</Typography.Title>
          <Space wrap style={{ marginBottom: 24 }}>
            <Button icon={<DownloadOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'sikayet_dilekcesi'), `sikayet-dilekcesi-${incident.id}.docx`)}>
              Şikayet Dilekçesi
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'bildirim_tutanagi'), `bildirim-tutanagi-${incident.id}.docx`)}>
              Disiplin Bildirim Tutanağı
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'sinif_kontrol_formu'), `sinif-kontrol-formu-${incident.id}.docx`)}>
              Sınıf Kontrol Formu
            </Button>
          </Space>

          {participants.length > 0 ? (
            <>
              <Typography.Title level={5}>İlk İfade Tutanağı</Typography.Title>
              <Form form={statementForm} layout="vertical" onFinish={onCreateStatement}>
                <Form.Item name="participant_id" label="Katılımcı" rules={[{ required: true, message: 'Katılımcı seçiniz' }]}>
                  <Select options={participants.map((p) => ({ value: p.id, label: studentLabel(p) }))} />
                </Form.Item>
                <Form.Item name="statement_type" label="Tür" rules={[{ required: true }]} initialValue="yazili_ifade">
                  <Select options={STATEMENT_TYPE_OPTIONS} />
                </Form.Item>
                <Form.Item name="content" label="İfade Metni">
                  <Input.TextArea rows={4} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={creatingStatement} icon={<DownloadOutlined />}>
                  Oluştur ve İndir
                </Button>
              </Form>
            </>
          ) : (
            <Alert type="info" showIcon message="Katılımcı eklemediğiniz için ifade tutanağı oluşturma adımı atlandı." />
          )}

          <Alert
            style={{ marginTop: 24 }}
            type="success"
            showIcon
            message="Olay kaydedildi"
            description="Diğer tüm tutanak, karar ve tebligat işlemlerini olay listesinden bu kaydı açarak devam ettirebilirsiniz."
          />
        </>
      )}
    </Modal>
  )
}
