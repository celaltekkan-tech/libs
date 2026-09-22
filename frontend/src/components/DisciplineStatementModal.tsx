import { useEffect } from 'react'
import { Button, Divider, Form, Input, Modal, Select, Space, Typography } from 'antd'
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { STATEMENT_TYPE_OPTIONS } from '../types/discipline'
import type { DisciplineParticipant, DisciplineStatement } from '../types/discipline'

const DEFAULT_QUESTIONS = [
  { question: 'Okulunuzu, öğretmenlerinizi ve arkadaşlarınızı seviyor musunuz?', answer: '' },
  {
    question: 'Kaç kardeşsiniz? Okuyan kardeş sayısı kaç? Okuyan kardeşleriniz hangi okula gidiyorlar? Ailenizle ilgili problemleriniz var mı?',
    answer: '',
  },
  { question: 'Disiplin olayının öncesini, olay zamanını ve olaydan sonra yaşanan gelişmeleri anlatınız.', answer: '' },
  { question: 'Yaptığınız hareketten dolayı neler hissediyorsunuz?', answer: '' },
]

interface DisciplineStatementModalProps {
  open: boolean
  participant: DisciplineParticipant | null
  editing: DisciplineStatement | null
  submitting: boolean
  onCancel: () => void
  onSubmit: (values: Record<string, unknown>) => void
}

export function DisciplineStatementModal({ open, participant, editing, submitting, onCancel, onSubmit }: DisciplineStatementModalProps) {
  const [form] = Form.useForm()
  const statementType = Form.useWatch('statement_type', form)

  useEffect(() => {
    if (!open) return
    if (editing) {
      form.setFieldsValue({ ...editing, questions: editing.questions?.length ? editing.questions : DEFAULT_QUESTIONS })
    } else {
      form.resetFields()
      form.setFieldsValue({ statement_type: 'yazili_ifade', questions: DEFAULT_QUESTIONS })
    }
  }, [open, editing, form])

  const handleTypeChange = (type: string) => {
    if (type === 'savunma' && !form.getFieldValue('questions')?.length) {
      form.setFieldsValue({ questions: DEFAULT_QUESTIONS })
    }
  }

  const studentName = participant?.Student ? `${participant.Student.first_name} ${participant.Student.last_name}` : '—'

  return (
    <Modal
      title={`İfade / Savunma - ${studentName}`}
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Kaydet"
      cancelText="Vazgeç"
      destroyOnHidden
      width={720}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="statement_type" label="Tür" rules={[{ required: true }]}>
          <Select options={STATEMENT_TYPE_OPTIONS} onChange={handleTypeChange} disabled={!!editing} />
        </Form.Item>

        {statementType === 'sozlu_ifade' && (
          <>
            <Form.Item name="taken_by" label="İfadeyi Alan">
              <Input />
            </Form.Item>
            <Form.Item name="written_by" label="İfadeyi Yazan">
              <Input />
            </Form.Item>
          </>
        )}

        {statementType === 'savunma' && (
          <>
            <Space.Compact block>
              <Form.Item name="student_home_phone" label="Öğrenci Ev Telefonu" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
              <Form.Item name="student_mobile_phone" label="Öğrenci Cep Telefonu" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item name="student_home_address" label="Öğrenci Ev Adresi">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space.Compact block>
              <Form.Item name="guardian_work_phone" label="Veli İş Telefonu" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
              <Form.Item name="guardian_mobile_phone" label="Veli Cep Telefonu" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item name="guardian_work_address" label="Veli İş Adresi">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Space.Compact block>
              <Form.Item name="taken_at" label="Savunmanın Alındığı Tarih" style={{ flex: 1 }}>
                <Input type="date" />
              </Form.Item>
              <Form.Item name="location" label="Yer" style={{ flex: 1 }}>
                <Input />
              </Form.Item>
            </Space.Compact>
            <Form.Item name="taken_by" label="Savunmayı Alan">
              <Input />
            </Form.Item>

            <Divider titlePlacement="left" plain>
              Sorular
            </Divider>
            <Form.List name="questions">
              {(fields, { add, remove }) => (
                <>
                  {fields.map((field) => (
                    <Space key={field.key} align="start" style={{ display: 'flex', marginBottom: 8 }}>
                      <Form.Item name={[field.name, 'question']} style={{ width: 380, marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="Soru" />
                      </Form.Item>
                      <Form.Item name={[field.name, 'answer']} style={{ width: 260, marginBottom: 0 }}>
                        <Input.TextArea rows={2} placeholder="Cevap" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(field.name)} />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add({ question: '', answer: '' })} icon={<PlusOutlined />}>
                    Soru Ekle
                  </Button>
                </>
              )}
            </Form.List>
            <Typography.Paragraph style={{ marginTop: 16 }}>
              <strong>SAVUNMAMDIR</strong>
            </Typography.Paragraph>
          </>
        )}

        {statementType === 'yazili_ifade' && (
          <Form.Item name="taken_at" label="Tarih">
            <Input type="date" />
          </Form.Item>
        )}
        {statementType === 'sozlu_ifade' && (
          <>
            <Form.Item name="taken_at" label="Tarih">
              <Input type="date" />
            </Form.Item>
            <Form.Item name="location" label="Yer">
              <Input />
            </Form.Item>
          </>
        )}

        <Form.Item name="content" label={statementType === 'savunma' ? 'Savunma Metni' : 'İfade Metni'}>
          <Input.TextArea rows={6} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
