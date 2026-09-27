import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Checkbox, Empty, Modal, Radio, Select, Space, Spin, Table, Tag, Typography } from 'antd'
import {
  formatHours,
  importPoolTemplate,
  KIND_LABELS,
  listAvailablePoolTemplates,
  SCHOOL_TYPE_LABELS,
  type AvailablePoolTemplate,
  type LessonPoolKind,
} from '../../api/lessonPools'
import { getErrorMessage } from '../../api/client'

interface Props {
  projectId: number
  open: boolean
  onClose: () => void
  onImported: () => Promise<void> | void
}

const ALL_KINDS: LessonPoolKind[] = ['ortak', 'secmeli', 'rehberlik']

function defaultTarget(level: string, classLevels: string[]): string | null {
  if (classLevels.includes(level)) return level
  if (level === 'Hazırlık') return classLevels.find((l) => /haz|^h$|^0$/i.test(l)) || null
  return null
}

// Platformdaki hazır (MEB) ders havuzunu okulun ders havuzuna aktarır.
export function PoolTemplateImportModal({ projectId, open, onClose, onImported }: Props) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [templates, setTemplates] = useState<AvailablePoolTemplate[]>([])
  const [classLevels, setClassLevels] = useState<string[]>([])
  const [schoolType, setSchoolType] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [levelMap, setLevelMap] = useState<Record<string, string | null>>({})
  const [kinds, setKinds] = useState<LessonPoolKind[]>(ALL_KINDS)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [importing, setImporting] = useState(false)
  const [subjects, setSubjects] = useState<Array<{ id: number; name: string; is_active: boolean }>>([])
  const [subjectMap, setSubjectMap] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listAvailablePoolTemplates(projectId)
      .then((res) => {
        setTemplates(res.templates)
        setClassLevels(res.class_levels)
        setSchoolType(res.school_type)
        setSubjects(res.subjects)
        setTemplateId(res.templates.find((t) => t.matches_school)?.id ?? res.templates[0]?.id ?? null)
      })
      .catch((err) => message.error(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [open, projectId, message])

  const template = templates.find((t) => t.id === templateId) || null

  useEffect(() => {
    if (!template) return
    setLevelMap(Object.fromEntries(template.levels.map((l) => [l, defaultTarget(l, classLevels)])))
    setSubjectMap(Object.fromEntries(template.items.map((it) => [it.name, template.matches[it.name]?.subject_id ?? 0])))
  }, [template, classLevels])

  const preview = useMemo(
    () => (template ? template.items.filter((it) => kinds.includes(it.kind)) : []),
    [template, kinds],
  )
  const mappedCount = Object.values(levelMap).filter(Boolean).length
  const newCount = preview.filter((it) => !subjectMap[it.name]).length
  const subjectOptions = useMemo(
    () => [
      { value: 0, label: 'Yeni ders oluştur' },
      ...subjects.map((s) => ({ value: s.id, label: s.is_active ? s.name : `${s.name} (pasif)` })),
    ],
    [subjects],
  )

  const onOk = async () => {
    if (!template) return
    setImporting(true)
    try {
      const res = await importPoolTemplate(projectId, {
        template_id: template.id,
        level_map: levelMap,
        mode,
        kinds,
        subject_map: subjectMap,
      })
      message.success(
        `${res.subjects_created} yeni ders, ${res.hours_created} saat eklendi` +
          (res.hours_removed ? `, ${res.hours_removed} eski saat kaldırıldı` : '') +
          (res.skipped ? ` (${res.skipped} ders bu okulun seviyelerinde yok)` : ''),
      )
      await onImported()
      onClose()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setImporting(false)
    }
  }

  const levelLabel = (l: string) => (l === 'Hazırlık' ? 'Hazırlık' : `${l}. sınıf`)

  return (
    <Modal
      open={open}
      title="Hazır ders havuzundan aktar"
      width={1100}
      onCancel={onClose}
      onOk={onOk}
      okText="Aktar"
      cancelText="Vazgeç"
      okButtonProps={{ disabled: !template || !mappedCount || !kinds.length, loading: importing }}
      destroyOnHidden
    >
      {loading ? (
        <Spin />
      ) : !templates.length ? (
        <Empty description="Platformda henüz hazır ders havuzu tanımlanmamış." />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Select
            style={{ width: '100%' }}
            value={templateId ?? undefined}
            onChange={setTemplateId}
            options={templates.map((t) => ({
              value: t.id,
              label: (
                <Space>
                  {t.name}
                  {t.school_type && <Tag>{SCHOOL_TYPE_LABELS[t.school_type]}</Tag>}
                  {!t.matches_school && <Tag color="orange">okul türü farklı</Tag>}
                </Space>
              ),
            }))}
          />
          {template?.note && <Typography.Text type="secondary">{template.note}</Typography.Text>}
          {schoolType && template && !template.matches_school && (
            <Alert type="warning" showIcon message="Bu havuz okulunuzun türü için hazırlanmamış." />
          )}

          <div>
            <Typography.Text strong>Sınıf seviyesi eşleştirme</Typography.Text>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 6 }}>
              {template?.levels.map((l) => (
                <Space key={l} size={4}>
                  <span>{levelLabel(l)} →</span>
                  <Select
                    size="small"
                    allowClear
                    style={{ width: 120 }}
                    placeholder="aktarma"
                    value={levelMap[l] ?? undefined}
                    onChange={(v) => setLevelMap((prev) => ({ ...prev, [l]: v ?? null }))}
                    options={classLevels.map((c) => ({ value: c, label: c }))}
                  />
                </Space>
              ))}
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Boş bırakılan seviye aktarılmaz. Okulunuzda şubesi olan seviyeler listelenir.
            </Typography.Text>
          </div>

          <Space wrap size="large">
            <Checkbox.Group
              value={kinds}
              onChange={(v) => setKinds(v as LessonPoolKind[])}
              options={ALL_KINDS.map((k) => ({ value: k, label: `${KIND_LABELS[k]} dersler` }))}
            />
            <Radio.Group value={mode} onChange={(e) => setMode(e.target.value)}>
              <Radio value="merge">Mevcut saatleri koru, eksikleri ekle</Radio>
              <Radio value="replace">Aktarılan derslerin saatlerini değiştir</Radio>
            </Radio.Group>
          </Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            "Okuldaki ders" sütununda her dersin okulunuzdaki hangi derse aktarılacağını seçin. Aynı adlı dersler
            kendiliğinden eşleşir; benzer adlar (ör. Beden Eğitimi → Beden Eğitimi ve Spor) önerilir. Eşleşen dersin
            kodu, branşı ve adı korunur. Seçenekli saatler (ör. 3/5) aynı seviyede ayrı saat seçenekleri olarak eklenir.
            Bu aktarımda {newCount} yeni ders açılacak.
          </Typography.Text>

          <Table
            rowKey="name"
            size="small"
            pagination={false}
            dataSource={preview}
            scroll={{ y: 300 }}
            columns={[
              { title: 'Ders', dataIndex: 'name', width: 230 },
              {
                title: 'Okuldaki ders',
                key: 'target',
                width: 240,
                render: (_: unknown, it: AvailablePoolTemplate['items'][number]) => (
                  <Space size={4}>
                    <Select
                      size="small"
                      showSearch
                      optionFilterProp="label"
                      style={{ width: 190 }}
                      value={subjectMap[it.name] ?? 0}
                      onChange={(v: number) => setSubjectMap((prev) => ({ ...prev, [it.name]: v }))}
                      options={subjectOptions}
                    />
                    {template?.matches[it.name]?.match === 'similar' &&
                      subjectMap[it.name] === template.matches[it.name].subject_id && <Tag color="orange">benzer</Tag>}
                  </Space>
                ),
              },
              {
                title: 'Tür',
                dataIndex: 'kind',
                width: 100,
                render: (k: LessonPoolKind) => <Tag color={k === 'secmeli' ? 'purple' : k === 'rehberlik' ? 'cyan' : 'blue'}>{KIND_LABELS[k]}</Tag>,
              },
              ...(template?.levels || []).map((l) => ({
                title: levelLabel(l),
                key: l,
                width: 80,
                render: (_: unknown, it: AvailablePoolTemplate['items'][number]) => (
                  <span style={{ color: levelMap[l] ? undefined : '#bfbfbf' }}>{formatHours(it.hours[l]) || '—'}</span>
                ),
              })),
            ]}
          />
        </Space>
      )}
    </Modal>
  )
}
