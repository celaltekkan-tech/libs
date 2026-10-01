import { useEffect } from 'react'
import { Checkbox, Form, InputNumber, Modal, Radio, Select, Switch } from 'antd'
import { DAY_OPTIONS } from '../../types/scheduleEntry'
import type { ConstraintInput, ConstraintParams, ConstraintType, TimetableConstraint } from '../../types/timetable'
import { SlotPicker } from './SlotPicker'
import { shortClassroom, type TimetableCtx } from './shared'

interface Props {
  ctx: TimetableCtx
  open: boolean
  editing: TimetableConstraint | null
  seed?: { type: ConstraintType; params?: ConstraintParams } | null
  onCancel: () => void
  onSubmit: (input: ConstraintInput) => Promise<void>
}

interface FormValues extends ConstraintParams {
  type: ConstraintType
  is_hard: boolean
  weight?: number | null
  scope?: 'class' | 'school'
}

export function ConstraintFormModal({ ctx, open, editing, seed, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>()
  const type = Form.useWatch('type', form)
  const scope = Form.useWatch('scope', form)
  const isHard = Form.useWatch('is_hard', form)
  const { project } = ctx
  const fields = ctx.meta.constraint_types.find((t) => t.key === type)?.fields || []
  const has = (name: string) => fields.some((f) => f.replace('?', '') === name)
  const optional = (name: string) => fields.includes(`${name}?`)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (editing) form.setFieldsValue({ type: editing.type, is_hard: editing.is_hard, weight: editing.weight, scope: 'class', ...editing.params })
    else if (seed) form.setFieldsValue({ type: seed.type, is_hard: true, weight: 20, scope: 'class', ...seed.params })
    else form.setFieldsValue({ type: 'teacher_unavailable', is_hard: true, weight: 20, scope: 'class' })
  }, [open, editing, seed, form])

  const periodOptions = Array.from({ length: project.periods_per_day }, (_, i) => ({ value: i + 1, label: `${i + 1}.` }))
  const dayOptions = DAY_OPTIONS.filter((d) => project.days.includes(d.value))

  const handleOk = async () => {
    const v = await form.validateFields()
    const params: ConstraintParams = {}
    for (const f of fields) {
      const key = f.replace('?', '') as keyof ConstraintParams
      const val = v[key]
      ;(params as Record<string, unknown>)[key] = val ?? null
    }
    if (v.type === 'subjects_not_same_day') {
      params.scope = v.scope === 'school' ? 'school' : 'class'
      if (params.scope === 'school') params.classroom_id = null
    }
    await onSubmit({ type: v.type, is_hard: v.is_hard, weight: v.is_hard ? null : v.weight ?? 20, params })
  }

  return (
    <Modal
      open={open}
      title={editing ? 'Kısıtı Düzenle' : 'Yeni Kısıt'}
      onCancel={onCancel}
      onOk={handleOk}
      okText="Kaydet"
      cancelText="Vazgeç"
      width={640}
      destroyOnHidden
    >
      <Form form={form} layout="horizontal" labelCol={{ flex: '150px' }} wrapperCol={{ flex: 1 }} labelAlign="left" labelWrap colon={false}>
        <Form.Item name="type" label="Kısıt türü" rules={[{ required: true }]}>
          <Select
            disabled={Boolean(editing)}
            options={ctx.meta.constraint_types.map((t) => ({ value: t.key, label: t.label }))}
          />
        </Form.Item>

        {has('teacher_id') && (
          <Form.Item
            name="teacher_id"
            label="Öğretmen"
            rules={optional('teacher_id') ? [] : [{ required: true, message: 'Öğretmen seçin' }]}
            extra={optional('teacher_id') ? 'Boş bırakılırsa tüm öğretmenlere uygulanır.' : undefined}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Tüm öğretmenler"
              options={ctx.teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
        )}
        {has('teacher_ids') && (
          <Form.Item
            name="teacher_ids"
            label="Öğretmenler"
            rules={[{ required: true, message: 'En az bir öğretmen seçin' }]}
            extra="Bu kişiler nöbet çizelgesine yazılmaz ve nöbet günü ders sınırına girmez."
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={ctx.teachers.map((t) => ({ value: t.id, label: `${t.first_name} ${t.last_name}` }))}
            />
          </Form.Item>
        )}
        {has('subject_id') && (
          <Form.Item name="subject_id" label="Ders" rules={[{ required: true, message: 'Ders seçin' }]}>
            <Select showSearch optionFilterProp="label" options={ctx.subjects.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
        )}
        {type === 'subjects_not_same_day' && (
          <Form.Item name="scope" label="Kapsam" extra="Ortak atölyede dersler farklı şubelerde de aynı güne gelmesin.">
            <Radio.Group>
              <Radio value="class">Aynı şubede</Radio>
              <Radio value="school">Okul genelinde</Radio>
            </Radio.Group>
          </Form.Item>
        )}
        {has('subject_ids') && (
          <Form.Item
            name="subject_ids"
            label="Dersler"
            rules={[
              { required: true, message: 'Ders seçin' },
              {
                validator: async (_, value) => {
                  const list = Array.isArray(value) ? value : []
                  if (type === 'subjects_same_day' && list.length < 2) throw new Error('En az iki ders seçin')
                  if (type === 'subjects_not_same_day' && scope !== 'school' && list.length < 2) {
                    throw new Error('Aynı şubede en az iki ders seçin')
                  }
                },
              },
            ]}
            extra={
              type === 'subject_no_lunch_split'
                ? 'Yalnız "bloklar öğle arasını aşabilir" ayarı açıkken etkilidir; kapalıyken hiçbir blok bölünmez.'
                : type === 'subjects_same_day'
                  ? 'Az saatli dersin günleri, en çok saatli dersin günlerinin içinde kalır.'
                  : type === 'subjects_not_same_day' && scope === 'school'
                    ? 'Tek ders seçerseniz o ders farklı şubelerde aynı güne gelmez. Birden fazla ders, ortak atölyeyi aynı gün paylaşmaz.'
                    : undefined
            }
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              options={ctx.subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
        )}
        {has('classroom_id') && !(type === 'subjects_not_same_day' && scope === 'school') && (
          <Form.Item
            name="classroom_id"
            label="Şube"
            rules={optional('classroom_id') ? [] : [{ required: true, message: 'Şube seçin' }]}
            extra={optional('classroom_id') ? 'Boş bırakılırsa tüm şubelere uygulanır.' : undefined}
          >
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder={optional('classroom_id') ? 'Tüm şubeler' : undefined}
              options={ctx.classrooms.map((c) => ({ value: c.id, label: shortClassroom(c) }))}
            />
          </Form.Item>
        )}
        {has('room_id') && (
          <Form.Item name="room_id" label="Mekan" rules={[{ required: true, message: 'Mekan seçin' }]}>
            <Select options={ctx.rooms.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
        )}
        {has('slots') && (
          <Form.Item
            name="slots"
            label="Saatler"
            extra="Seçili hücreler mavi olur. Gün adına tıklamak tüm günü, saat numarasına tıklamak tüm satırı seçer."
            rules={[{ required: true, message: 'En az bir hücre seçin' }]}
          >
            <SlotPicker days={project.days} periods={project.periods_per_day} />
          </Form.Item>
        )}
        {has('mode') && (
          <Form.Item name="mode" label="Kural" initialValue="avoid">
            <Radio.Group>
              <Radio value="avoid">Bu saatlere konmasın</Radio>
              <Radio value="only">Yalnızca bu saatlerde olsun</Radio>
            </Radio.Group>
          </Form.Item>
        )}
        {has('periods') && (
          <Form.Item name="periods" label="Ders saatleri" rules={[{ required: true, message: 'Saat seçin' }]}>
            <Checkbox.Group options={periodOptions} />
          </Form.Item>
        )}
        {has('days') && (
          <Form.Item name="days" label="Günler" extra="Boş bırakılırsa tüm günler.">
            <Checkbox.Group options={dayOptions} />
          </Form.Item>
        )}
        {has('max') && (
          <Form.Item name="max" label="En fazla" rules={[{ required: true, message: 'Değer girin' }]}>
            <InputNumber min={1} max={12} addonAfter="saat" />
          </Form.Item>
        )}
        {has('count') && (
          <Form.Item name="count" label="Boş gün sayısı" rules={[{ required: true, message: 'Değer girin' }]}>
            <InputNumber min={1} max={5} addonAfter="gün" />
          </Form.Item>
        )}

        <Form.Item
          name="is_hard"
          label="Kesin kural"
          valuePropName="checked"
          extra={isHard ? 'Asla ihlal edilmez.' : 'Mümkün olduğunca uyulur.'}
        >
          <Switch />
        </Form.Item>
        {!isHard && (
          <Form.Item name="weight" label="Önem (1-100)">
            <InputNumber min={1} max={100} addonAfter="puan" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
