import { useCallback, useEffect, useMemo, useState } from 'react'
import { App, Button, Drawer, Dropdown, Empty, Form, Input, List, Modal, Popconfirm, Select, Space, Tabs, Tag, Typography } from 'antd'
import { DeleteOutlined, DownloadOutlined, EditOutlined, FileTextOutlined, MinusCircleOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { DisciplineExcelImportModal } from './DisciplineExcelImportModal'
import { DisciplineParticipantModal } from './DisciplineParticipantModal'
import { DisciplineStatementModal } from './DisciplineStatementModal'
import { DisciplineInfoRequestModal } from './DisciplineInfoRequestModal'
import { DisciplineMeetingNoticeModal } from './DisciplineMeetingNoticeModal'
import { DisciplineDecisionModal } from './DisciplineDecisionModal'
import { DisciplineNotificationModal } from './DisciplineNotificationModal'
import {
  addParticipant,
  createDecision,
  createInfoRequest,
  createMeetingNotice,
  createNotification,
  createStatement,
  deleteDecision,
  deleteInfoRequest,
  deleteMeetingNotice,
  deleteStatement,
  downloadDecisionDocument,
  downloadIncidentDocument,
  downloadInfoRequestDocument,
  downloadMeetingNoticeDocument,
  downloadNotificationDocument,
  downloadStatementDocument,
  listDecisions,
  listInfoRequests,
  listMeetingNotices,
  listNotifications,
  listRegulationArticles,
  listStatements,
  removeParticipant,
  updateDecision,
  updateIncident,
  updateInfoRequest,
  updateMeetingNotice,
  updateNotification,
  updateParticipant,
  updateStatement,
} from '../api/discipline'
import { getErrorMessage } from '../api/client'
import { downloadBlob } from '../utils/download'
import { listStudents } from '../api/students'
import {
  DECISION_STATUS_LABELS,
  INCIDENT_STATUS_OPTIONS,
  INFO_SOURCE_TYPE_LABELS,
  NOTICE_TYPE_LABELS,
  NOTIFICATION_TYPE_LABELS,
  PARTICIPANT_ROLE_LABELS,
  PARTICIPANT_ROLE_OPTIONS,
  PARTICIPANT_STATUS_LABELS,
  SANCTION_TYPE_LABELS,
  STATEMENT_TYPE_LABELS,
} from '../types/discipline'
import type {
  DisciplineDecision,
  DisciplineIncident,
  DisciplineInfoRequest,
  DisciplineMeetingNotice,
  DisciplineNotification,
  DisciplineParticipant,
  DisciplineRegulationArticle,
  DisciplineStatement,
} from '../types/discipline'
import type { Student } from '../types/student'

interface DisciplineIncidentDrawerProps {
  incident: DisciplineIncident | null
  open: boolean
  onClose: () => void
  onChanged: () => void
}

function studentLabel(p: DisciplineParticipant): string {
  return p.Student ? `${p.Student.first_name} ${p.Student.last_name}` : `#${p.id}`
}

export function DisciplineIncidentDrawer({ incident, open, onClose, onChanged }: DisciplineIncidentDrawerProps) {
  const { message, modal } = App.useApp()
  const [generalForm] = Form.useForm()
  const [addForm] = Form.useForm()
  const [savingGeneral, setSavingGeneral] = useState(false)
  const [students, setStudents] = useState<Student[]>([])
  const [addingParticipant, setAddingParticipant] = useState(false)
  const [excelOpen, setExcelOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<DisciplineParticipant | null>(null)
  const [savingParticipant, setSavingParticipant] = useState(false)

  const [statements, setStatements] = useState<DisciplineStatement[]>([])
  const [infoRequests, setInfoRequests] = useState<DisciplineInfoRequest[]>([])
  const [meetingNotices, setMeetingNotices] = useState<DisciplineMeetingNotice[]>([])
  const [decisions, setDecisions] = useState<DisciplineDecision[]>([])
  const [notifications, setNotifications] = useState<Record<number, DisciplineNotification[]>>({})
  const [articles, setArticles] = useState<DisciplineRegulationArticle[]>([])
  const [loadingForms, setLoadingForms] = useState(false);

  const [statementModal, setStatementModal] = useState<{ participant: DisciplineParticipant; editing: DisciplineStatement | null } | null>(null)
  const [infoModal, setInfoModal] = useState<{ participant: DisciplineParticipant; editing: DisciplineInfoRequest | null } | null>(null)
  const [meetingModal, setMeetingModal] = useState<{ editing: DisciplineMeetingNotice | null } | null>(null)
  const [decisionModal, setDecisionModal] = useState<{ editing: DisciplineDecision | null } | null>(null)
  const [notificationModal, setNotificationModal] = useState<{ decisionId: number; participantId: number; editing: DisciplineNotification | null } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [extensionOpen, setExtensionOpen] = useState(false)
  const [extensionForm] = Form.useForm<{ reasons: string[] }>()

  const participants = incident?.Participants || []

  const loadForms = useCallback(async () => {
    if (!incident) return
    setLoadingForms(true)
    try {
      const [s, i, m, d] = await Promise.all([
        listStatements({ incident_id: incident.id }),
        listInfoRequests({ incident_id: incident.id }),
        listMeetingNotices(incident.id),
        listDecisions({ incident_id: incident.id }),
      ])
      setStatements(s)
      setInfoRequests(i)
      setMeetingNotices(m)
      setDecisions(d)
      const notifPairs = await Promise.all(d.map(async (dec) => [dec.id, await listNotifications(dec.id)] as const))
      setNotifications(Object.fromEntries(notifPairs))
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoadingForms(false)
    }
  }, [incident, message])

  useEffect(() => {
    if (open && incident) {
      generalForm.setFieldsValue(incident)
      void loadForms()
      void listRegulationArticles().then(setArticles).catch(() => undefined)
      void listStudents().then(setStudents).catch(() => undefined)
    }
  }, [open, incident, generalForm, loadForms])

  const availableStudents = useMemo(() => {
    const existingIds = new Set(participants.map((p) => p.student_id))
    return students.filter((s) => !existingIds.has(s.id))
  }, [students, participants])

  const download = async (fn: () => Promise<Blob>, filename: string) => {
    try {
      const blob = await fn()
      downloadBlob(blob, filename)
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onSaveGeneral = async (values: Record<string, unknown>) => {
    if (!incident) return
    setSavingGeneral(true)
    try {
      await updateIncident(incident.id, values)
      message.success('Güncellendi')
      onChanged()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingGeneral(false)
    }
  }

  const onAddParticipant = async (values: { student_id: number; role: string }) => {
    if (!incident) return
    setAddingParticipant(true)
    try {
      await addParticipant(incident.id, values)
      message.success('Öğrenci eklendi')
      addForm.resetFields()
      onChanged()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setAddingParticipant(false)
    }
  }

  const onRemoveParticipant = (p: DisciplineParticipant) => {
    modal.confirm({
      title: 'Öğrenciyi olaydan çıkar',
      content: `${studentLabel(p)} bu olaydan çıkarılacak. Bu öğrenciye ait tüm ifade/karar kayıtları da silinir.`,
      okText: 'Çıkar',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await removeParticipant(p.id)
          message.success('Çıkarıldı')
          onChanged()
          void loadForms()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onSaveParticipant = async (values: Record<string, unknown>) => {
    if (!editingParticipant) return
    setSavingParticipant(true)
    try {
      await updateParticipant(editingParticipant.id, values)
      message.success('Güncellendi')
      setEditingParticipant(null)
      onChanged()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSavingParticipant(false)
    }
  }

  const onSaveStatement = async (values: Record<string, unknown>) => {
    if (!statementModal) return
    setSubmitting(true)
    try {
      if (statementModal.editing) {
        await updateStatement(statementModal.editing.id, values)
      } else {
        await createStatement({ ...values, participant_id: statementModal.participant.id } as never)
      }
      message.success('Kaydedildi')
      setStatementModal(null)
      void loadForms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSaveInfoRequest = async (values: Record<string, unknown>) => {
    if (!infoModal) return
    setSubmitting(true)
    try {
      if (infoModal.editing) {
        await updateInfoRequest(infoModal.editing.id, values)
      } else {
        await createInfoRequest({ ...values, participant_id: infoModal.participant.id } as never)
      }
      message.success('Kaydedildi')
      setInfoModal(null)
      void loadForms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSaveMeeting = async (values: Record<string, unknown>) => {
    if (!incident) return
    setSubmitting(true)
    try {
      if (meetingModal?.editing) {
        await updateMeetingNotice(meetingModal.editing.id, values)
      } else {
        await createMeetingNotice({ ...values, incident_id: incident.id } as never)
      }
      message.success('Kaydedildi')
      setMeetingModal(null)
      void loadForms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSaveDecision = async (values: Record<string, unknown>) => {
    setSubmitting(true)
    try {
      if (decisionModal?.editing) {
        await updateDecision(decisionModal.editing.id, values)
      } else {
        await createDecision(values as never)
      }
      message.success('Kaydedildi')
      setDecisionModal(null)
      void loadForms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onSaveNotification = async (values: Record<string, unknown>) => {
    if (!notificationModal) return
    setSubmitting(true)
    try {
      if (notificationModal.editing) {
        await updateNotification(notificationModal.editing.id, values)
      } else {
        await createNotification({ ...values, decision_id: notificationModal.decisionId, participant_id: notificationModal.participantId } as never)
      }
      message.success('Kaydedildi')
      setNotificationModal(null)
      void loadForms()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!incident) return null

  return (
    <Drawer title={`${incident.incident_code} - ${incident.title}`} open={open} onClose={onClose} width={920} destroyOnHidden>
      <Tabs
        items={[
          {
            key: 'genel',
            label: 'Genel Bilgiler',
            children: (
              <>
                <Form form={generalForm} layout="vertical" onFinish={onSaveGeneral}>
                  <Form.Item name="title" label="Olay Adı" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                  <Space.Compact block>
                    <Form.Item name="incident_date" label="Tarih" style={{ flex: 1 }}>
                      <Input type="date" />
                    </Form.Item>
                    <Form.Item name="incident_time" label="Saat" style={{ flex: 1 }}>
                      <Input type="time" />
                    </Form.Item>
                  </Space.Compact>
                  <Form.Item name="location" label="Yer">
                    <Input />
                  </Form.Item>
                  <Form.Item name="summary" label="Olayın Özeti">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Form.Item name="complainant_name" label="Dilekçeyi Veren Kişi">
                    <Input />
                  </Form.Item>
                  <Space.Compact block>
                    <Form.Item name="complaint_ref_date" label="Dilekçe Tarihi" style={{ flex: 1 }}>
                      <Input type="date" />
                    </Form.Item>
                    <Form.Item name="complaint_ref_no" label="Dilekçe Sayısı" style={{ flex: 1 }}>
                      <Input />
                    </Form.Item>
                  </Space.Compact>
                  <Form.Item name="status" label="Durum">
                    <Select options={INCIDENT_STATUS_OPTIONS} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={savingGeneral}>
                    Kaydet
                  </Button>
                </Form>

                <Typography.Title level={5} style={{ marginTop: 24 }}>
                  Belgeler
                </Typography.Title>
                <Space wrap>
                  <Button icon={<FileTextOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'sikayet_dilekcesi'), `sikayet-dilekcesi-${incident.id}.docx`)}>
                    Şikayet Dilekçesi
                  </Button>
                  <Button icon={<FileTextOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'bildirim_tutanagi'), `bildirim-tutanagi-${incident.id}.docx`)}>
                    Disiplin Bildirim Tutanağı
                  </Button>
                  <Button icon={<FileTextOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'sinif_kontrol_formu'), `sinif-kontrol-formu-${incident.id}.docx`)}>
                    Sınıf Kontrol Formu
                  </Button>
                  <Button icon={<FileTextOutlined />} onClick={() => download(() => downloadIncidentDocument(incident.id, 'dizi_pusulasi'), `dizi-pusulasi-${incident.id}.docx`)}>
                    Dizi Pusulası
                  </Button>
                  <Button icon={<FileTextOutlined />} onClick={() => { extensionForm.resetFields(); setExtensionOpen(true) }}>
                    Ek Süre Talebi
                  </Button>
                </Space>
              </>
            ),
          },
          {
            key: 'katilimcilar',
            label: `Katılımcılar (${participants.length})`,
            children: (
              <>
                <Space style={{ marginBottom: 16 }} wrap align="start">
                  <Form form={addForm} layout="inline" onFinish={onAddParticipant}>
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
                      <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={addingParticipant}>
                        Ekle
                      </Button>
                    </Form.Item>
                  </Form>
                  <Button icon={<UploadOutlined />} onClick={() => setExcelOpen(true)}>
                    Excel'den Öğrenci Al
                  </Button>
                </Space>

                <List
                  dataSource={participants}
                  locale={{ emptyText: <Empty description="Henüz öğrenci eklenmedi" /> }}
                  renderItem={(p) => (
                    <List.Item
                      actions={[
                        <Button key="ifade" size="small" onClick={() => setStatementModal({ participant: p, editing: null })}>
                          İfade / Savunma
                        </Button>,
                        <Button key="bilgi" size="small" onClick={() => setInfoModal({ participant: p, editing: null })}>
                          Bilgi Toplama
                        </Button>,
                        p.role === 'suclanan' && (
                          <Button key="karar" size="small" onClick={() => setDecisionModal({ editing: null })}>
                            Karar Oluştur
                          </Button>
                        ),
                        <Button key="duzenle" size="small" icon={<EditOutlined />} onClick={() => setEditingParticipant(p)} />,
                        <Button key="sil" size="small" danger icon={<DeleteOutlined />} onClick={() => onRemoveParticipant(p)} />,
                      ].filter(Boolean)}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            {studentLabel(p)}
                            <Tag>{PARTICIPANT_ROLE_LABELS[p.role] || p.role}</Tag>
                            <Tag color="blue">{PARTICIPANT_STATUS_LABELS[p.status] || p.status}</Tag>
                          </Space>
                        }
                        description={p.Student ? `${p.Student.Classroom ? `${p.Student.Classroom.class_level}/${p.Student.Classroom.section}` : ''} - No: ${p.Student.student_number || '—'}` : ''}
                      />
                    </List.Item>
                  )}
                />
              </>
            ),
          },
          {
            key: 'formlar',
            label: 'Tutanak ve Formlar',
            children: (
              <div>
                <Typography.Title level={5}>İfade / Savunma Tutanakları</Typography.Title>
                <List
                  loading={loadingForms}
                  dataSource={statements}
                  locale={{ emptyText: <Empty description="Kayıt yok" /> }}
                  renderItem={(s) => (
                    <List.Item
                      actions={[
                        <Button key="indir" size="small" icon={<DownloadOutlined />} onClick={() => download(() => downloadStatementDocument(s.id), `ifade-${s.id}.docx`)} />,
                        <Button key="duzenle" size="small" icon={<EditOutlined />} onClick={() => s.Participant && setStatementModal({ participant: s.Participant, editing: s })} />,
                        <Popconfirm key="sil" title="Silinsin mi?" onConfirm={async () => { await deleteStatement(s.id); void loadForms() }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={`${s.Participant ? studentLabel(s.Participant) : ''} - ${STATEMENT_TYPE_LABELS[s.statement_type] || s.statement_type}`}
                        description={s.taken_at || ''}
                      />
                    </List.Item>
                  )}
                />

                <Typography.Title level={5} style={{ marginTop: 24 }}>
                  Bilgi Toplama Formları
                </Typography.Title>
                <List
                  loading={loadingForms}
                  dataSource={infoRequests}
                  locale={{ emptyText: <Empty description="Kayıt yok" /> }}
                  renderItem={(r) => (
                    <List.Item
                      actions={[
                        <Button key="indir" size="small" icon={<DownloadOutlined />} onClick={() => download(() => downloadInfoRequestDocument(r.id), `bilgi-toplama-${r.id}.docx`)} />,
                        <Button key="duzenle" size="small" icon={<EditOutlined />} onClick={() => r.Participant && setInfoModal({ participant: r.Participant, editing: r })} />,
                        <Popconfirm key="sil" title="Silinsin mi?" onConfirm={async () => { await deleteInfoRequest(r.id); void loadForms() }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={`${r.Participant ? studentLabel(r.Participant) : ''} - ${INFO_SOURCE_TYPE_LABELS[r.source_type] || r.source_type}`}
                        description={r.source_name || ''}
                      />
                    </List.Item>
                  )}
                />

                <Typography.Title level={5} style={{ marginTop: 24 }}>
                  Çağrı Pusulaları / Toplantı Çağrıları
                </Typography.Title>
                <Button icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => setMeetingModal({ editing: null })}>
                  Çağrı Pusulası Ekle
                </Button>
                <List
                  loading={loadingForms}
                  dataSource={meetingNotices}
                  locale={{ emptyText: <Empty description="Kayıt yok" /> }}
                  renderItem={(m) => (
                    <List.Item
                      actions={[
                        <Button key="indir" size="small" icon={<DownloadOutlined />} onClick={() => download(() => downloadMeetingNoticeDocument(m.id), `cagri-${m.id}.docx`)} />,
                        <Button key="duzenle" size="small" icon={<EditOutlined />} onClick={() => setMeetingModal({ editing: m })} />,
                        <Popconfirm key="sil" title="Silinsin mi?" onConfirm={async () => { await deleteMeetingNotice(m.id); void loadForms() }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={NOTICE_TYPE_LABELS[m.notice_type] || m.notice_type}
                        description={[m.meeting_date, m.meeting_time, m.location].filter(Boolean).join(' - ')}
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
          {
            key: 'karar',
            label: 'Ceza ve Karar',
            children: (
              <div>
                <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 16 }} onClick={() => setDecisionModal({ editing: null })}>
                  Yeni Karar
                </Button>
                <List
                  loading={loadingForms}
                  dataSource={decisions}
                  locale={{ emptyText: <Empty description="Karar oluşturulmadı" /> }}
                  renderItem={(d) => (
                    <List.Item
                      actions={[
                        <Dropdown
                          key="tebligat"
                          menu={{
                            items: [
                              { key: 'new', label: 'Yeni Tebligat Ekle' },
                              ...(notifications[d.id] || []).map((n) => ({ key: `n-${n.id}`, label: `${NOTIFICATION_TYPE_LABELS[n.notification_type]} - İndir` })),
                            ],
                            onClick: ({ key }) => {
                              if (key === 'new') {
                                setNotificationModal({ decisionId: d.id, participantId: d.participant_id, editing: null })
                              } else {
                                const id = Number(key.replace('n-', ''))
                                void download(() => downloadNotificationDocument(id), `tebligat-${id}.docx`)
                              }
                            },
                          }}
                        >
                          <Button size="small">Tebligatlar ({(notifications[d.id] || []).length})</Button>
                        </Dropdown>,
                        <Button key="indir" size="small" icon={<DownloadOutlined />} onClick={() => download(() => downloadDecisionDocument(d.id), `karar-${d.id}.docx`)} />,
                        <Button key="duzenle" size="small" icon={<EditOutlined />} onClick={() => setDecisionModal({ editing: d })} />,
                        <Popconfirm key="sil" title="Silinsin mi?" onConfirm={async () => { await deleteDecision(d.id); void loadForms() }}>
                          <Button size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            {d.Participant ? studentLabel(d.Participant) : ''}
                            <Tag color="red">{SANCTION_TYPE_LABELS[d.sanction_type || ''] || 'Belirsiz'}</Tag>
                            <Tag>{DECISION_STATUS_LABELS[d.status] || d.status}</Tag>
                          </Space>
                        }
                        description={d.decision_date || ''}
                      />
                    </List.Item>
                  )}
                />
              </div>
            ),
          },
        ]}
      />

      <Modal
        title="Ek Süre Talebi"
        open={extensionOpen}
        onCancel={() => setExtensionOpen(false)}
        onOk={() =>
          extensionForm.validateFields().then((values) => {
            void download(
              () => downloadIncidentDocument(incident.id, 'ek_sure_talebi', { reasons: values.reasons || [] }),
              `ek-sure-talebi-${incident.id}.docx`,
            )
            setExtensionOpen(false)
          })
        }
        okText="Belgeyi Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form form={extensionForm} layout="vertical">
          <Form.List name="reasons" initialValue={['']}>
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item {...field} style={{ width: 420, marginBottom: 0 }}>
                      <Input.TextArea rows={2} placeholder="Ek süre gerekçesi" />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(field.name)} />
                  </Space>
                ))}
                <Button type="dashed" onClick={() => add('')} icon={<PlusOutlined />}>
                  Gerekçe Ekle
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      <DisciplineExcelImportModal
        open={excelOpen}
        incidentId={incident.id}
        onCancel={() => setExcelOpen(false)}
        onImported={onChanged}
      />
      <DisciplineParticipantModal
        open={!!editingParticipant}
        participant={editingParticipant}
        submitting={savingParticipant}
        onCancel={() => setEditingParticipant(null)}
        onSubmit={onSaveParticipant}
      />
      <DisciplineStatementModal
        open={!!statementModal}
        participant={statementModal?.participant || null}
        editing={statementModal?.editing || null}
        submitting={submitting}
        onCancel={() => setStatementModal(null)}
        onSubmit={onSaveStatement}
      />
      <DisciplineInfoRequestModal
        open={!!infoModal}
        participant={infoModal?.participant || null}
        editing={infoModal?.editing || null}
        submitting={submitting}
        onCancel={() => setInfoModal(null)}
        onSubmit={onSaveInfoRequest}
      />
      <DisciplineMeetingNoticeModal
        open={!!meetingModal}
        participants={participants}
        editing={meetingModal?.editing || null}
        submitting={submitting}
        onCancel={() => setMeetingModal(null)}
        onSubmit={onSaveMeeting}
      />
      <DisciplineDecisionModal
        open={!!decisionModal}
        participants={participants}
        articles={articles}
        editing={decisionModal?.editing || null}
        submitting={submitting}
        onCancel={() => setDecisionModal(null)}
        onSubmit={onSaveDecision}
      />
      <DisciplineNotificationModal
        open={!!notificationModal}
        editing={notificationModal?.editing || null}
        submitting={submitting}
        onCancel={() => setNotificationModal(null)}
        onSubmit={onSaveNotification}
      />
    </Drawer>
  )
}
