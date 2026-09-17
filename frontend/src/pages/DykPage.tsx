import { useCallback, useEffect, useState } from 'react'
import { App, Button, Checkbox, DatePicker, Form, Input, InputNumber, Modal, Select, Space, Tag, Typography } from 'antd'
import { SortableTable } from '../components/SortableTable'
import { DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  createDykCourse,
  deleteDykCourse,
  enrollDykStudents,
  fetchDykAttendanceSummary,
  listDykCourses,
  listDykEnrollments,
  markDykAttendance,
  unenrollDykStudent,
} from '../api/dyk'
import { listStudents } from '../api/students'
import { listSubjects } from '../api/subjects'
import { listTeachers } from '../api/teachers'
import { getErrorMessage } from '../api/client'
import type { DykAttendanceSummaryRow, DykCourse, DykCoursePayload, DykEnrollment } from '../types/dyk'
import type { Student } from '../types/student'
import type { Subject } from '../types/subject'
import type { Teacher } from '../types/teacher'
import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'
import { useBulkTypedDelete } from '../hooks/useBulkTypedDelete'

/** DYK kurs yoklaması — birleşik Devamsızlık sayfasında sekme olarak kullanılır. */
export function DykAttendancePanel() {
  const { message, modal } = App.useApp()
  const { session, hasPermission } = useAuth()

  const [courses, setCourses] = useState<DykCourse[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null)
  const [enrollments, setEnrollments] = useState<DykEnrollment[]>([])
  const [summary, setSummary] = useState<DykAttendanceSummaryRow[]>([])
  const [minRate, setMinRate] = useState(80)
  const [attendanceDate, setAttendanceDate] = useState(dayjs())
  const [presentSet, setPresentSet] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [courseModalOpen, setCourseModalOpen] = useState(false)
  const [enrollModalOpen, setEnrollModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm<DykCoursePayload>()

  const canCreate = hasPermission('attendance.create')
  const canDelete = hasPermission('attendance.delete')

  const loadCourses = useCallback(async () => {
    setLoading(true)
    try {
      const [courseData, studentData, subjectData, teacherData] = await Promise.all([
        listDykCourses(),
        listStudents(),
        listSubjects({ is_active: true }),
        listTeachers({ scope: 'teachers' }),
      ])
      setCourses(courseData)
      setStudents(studentData)
      setSubjects(subjectData)
      setTeachers(teacherData)
      if (courseData.length > 0 && !selectedCourseId) setSelectedCourseId(courseData[0].id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message])

  useEffect(() => {
    void loadCourses()
  }, [loadCourses])

  const loadCourseDetail = useCallback(async () => {
    if (!selectedCourseId) return
    try {
      const [enr, sum] = await Promise.all([
        listDykEnrollments(selectedCourseId),
        fetchDykAttendanceSummary(selectedCourseId),
      ])
      setEnrollments(enr)
      setSummary(sum.data)
      setMinRate(sum.min_attendance_rate)
      setPresentSet(new Set(enr.map((e) => e.student_id)))
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }, [selectedCourseId, message])

  useEffect(() => {
    void loadCourseDetail()
  }, [loadCourseDetail])

  const { bulkOpen, setBulkOpen, bulkLoading, onBulkDelete } = useBulkTypedDelete({
    getIds: () => enrollments.map((e) => e.student_id),
    deleteOne: async (studentId) => {
      if (!selectedCourseId) throw new Error('Kurs seçili değil')
      await unenrollDykStudent(selectedCourseId, Number(studentId))
    },
    noun: 'kurs kaydı',
    reload: () => void loadCourseDetail(),
    message,
  })

  const onCreateCourse = async (values: DykCoursePayload) => {
    if (!session) return
    setSubmitting(true)
    try {
      const course = await createDykCourse(session.user.tenant_id, values)
      message.success('DYK kursu oluşturuldu')
      setCourseModalOpen(false)
      form.resetFields()
      await loadCourses()
      setSelectedCourseId(course.id)
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const onDeleteCourse = (course: DykCourse) => {
    modal.confirm({
      title: 'DYK kursunu sil',
      content: `"${course.name}" kursunu silmek istediğinize emin misiniz?`,
      okText: 'Sil',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await deleteDykCourse(course.id)
          message.success('Silindi')
          setSelectedCourseId(null)
          void loadCourses()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onEnroll = async (studentIds: number[]) => {
    if (!session || !selectedCourseId) return
    try {
      await enrollDykStudents(session.user.tenant_id, selectedCourseId, studentIds)
      message.success('Öğrenciler kursa eklendi')
      setEnrollModalOpen(false)
      void loadCourseDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    }
  }

  const onUnenroll = (studentId: number) => {
    if (!selectedCourseId) return
    modal.confirm({
      title: 'Öğrenciyi kurstan çıkar',
      content: 'Bu öğrenciyi DYK kursundan çıkarmak istediğinize emin misiniz?',
      okText: 'Çıkar',
      okButtonProps: { danger: true },
      cancelText: 'Vazgeç',
      onOk: async () => {
        try {
          await unenrollDykStudent(selectedCourseId, studentId)
          message.success('Öğrenci kurstan çıkarıldı')
          void loadCourseDetail()
        } catch (err) {
          message.error(getErrorMessage(err))
        }
      },
    })
  }

  const onSaveAttendance = async () => {
    if (!session || !selectedCourseId) return
    setSubmitting(true)
    try {
      const entries = enrollments.map((e) => ({
        student_id: e.student_id,
        present: presentSet.has(e.student_id),
      }))
      await markDykAttendance(
        session.user.tenant_id,
        selectedCourseId,
        attendanceDate.format('YYYY-MM-DD'),
        entries,
      )
      message.success('Yoklama kaydedildi')
      void loadCourseDetail()
    } catch (err) {
      message.error(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const enrolledStudentIds = new Set(enrollments.map((e) => e.student_id))
  const availableStudents = students.filter((s) => !enrolledStudentIds.has(s.id))

  const enrollmentColumns: ColumnsType<DykEnrollment> = [
    {
      title: '',
      width: 40,
      render: (_: unknown, e: DykEnrollment) => (
        <Checkbox
          disabled={!canCreate}
          checked={presentSet.has(e.student_id)}
          onChange={(ev) =>
            setPresentSet((prev) => {
              const next = new Set(prev)
              if (ev.target.checked) next.add(e.student_id)
              else next.delete(e.student_id)
              return next
            })
          }
        />
      ),
    },
    {
      title: 'Öğrenci',
      render: (_: unknown, e: DykEnrollment) =>
        e.Student ? `${e.Student.first_name} ${e.Student.last_name}` : '—',
    },
    { title: 'Öğrenci No', render: (_: unknown, e: DykEnrollment) => e.Student?.student_number || '—' },
    ...(canDelete
      ? [
          {
            title: '',
            width: 60,
            render: (_: unknown, e: DykEnrollment) => (
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => onUnenroll(e.student_id)}
              />
            ),
          },
        ]
      : []),
  ]

  const summaryColumns: ColumnsType<DykAttendanceSummaryRow> = [
    { title: 'Öğrenci', dataIndex: 'student_name' },
    { title: 'Toplam Oturum', dataIndex: 'total_sessions' },
    { title: 'Katılım', dataIndex: 'attended_sessions' },
    {
      title: 'Devam Oranı',
      dataIndex: 'attendance_rate',
      render: (v: number | null, row: DykAttendanceSummaryRow) =>
        v == null ? '—' : <Tag color={row.below_threshold ? 'red' : 'green'}>%{v}</Tag>,
    },
  ]

  const belowThresholdCount = summary.filter((s) => s.below_threshold).length

  return (
    <>
      <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Select
          value={selectedCourseId ?? undefined}
          onChange={setSelectedCourseId}
          placeholder="Kurs seçin"
          loading={loading}
          options={courses.map((c) => ({ value: c.id, label: c.name }))}
          style={{ width: 260 }}
        />
        <Space wrap>
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCourseModalOpen(true)}>
              Yeni Kurs
            </Button>
          )}
          {selectedCourseId && canDelete && (
            <Button danger onClick={() => onDeleteCourse(courses.find((c) => c.id === selectedCourseId)!)}>
              Kursu Sil
            </Button>
          )}
        </Space>
      </Space>

      {selectedCourseId && (
        <>
          {belowThresholdCount > 0 && (
            <Typography.Paragraph type="danger">
              {belowThresholdCount} öğrenci devam şartını sağlamıyor (eşik: %{minRate}) — kursun kapatılması
              değerlendirilmelidir.
            </Typography.Paragraph>
          )}

          <Space wrap style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <DatePicker
                value={attendanceDate}
                onChange={(v) => v && setAttendanceDate(v)}
                format="DD.MM.YYYY"
              />
              {canCreate && (
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={submitting}
                  onClick={() => void onSaveAttendance()}
                >
                  Yoklamayı Kaydet
                </Button>
              )}
            </Space>
            {canCreate && (
              <Button icon={<PlusOutlined />} onClick={() => setEnrollModalOpen(true)}>
                Öğrenci Ekle
              </Button>
            )}
            {canDelete && enrollments.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({enrollments.length})
              </Button>
            )}
          </Space>

          <SortableTable
            rowKey="id"
            columns={enrollmentColumns}
            dataSource={enrollments}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />

          <Typography.Title level={4} style={{ marginTop: 32 }}>
            Devam Özeti
          </Typography.Title>
          <SortableTable
            rowKey="student_id"
            columns={summaryColumns}
            dataSource={summary}
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </>
      )}

      {!loading && courses.length === 0 && (
        <Typography.Paragraph type="secondary">
          Henüz DYK kursu yok. Yeni kurs oluşturarak yoklama almaya başlayabilirsiniz.
        </Typography.Paragraph>
      )}

      <Modal
        title="Yeni DYK Kursu"
        open={courseModalOpen}
        onCancel={() => setCourseModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        okText="Oluştur"
        cancelText="Vazgeç"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={onCreateCourse}
          initialValues={{ min_attendance_rate: 80 }}
        >
          <Form.Item name="name" label="Kurs adı" rules={[{ required: true, message: 'Kurs adı zorunludur' }]}>
            <Input placeholder="Örn. Matematik DYK" />
          </Form.Item>
          <Form.Item name="subject_id" label="Ders">
            <Select allowClear options={subjects.map((s) => ({ value: s.id, label: s.name }))} />
          </Form.Item>
          <Form.Item name="teacher_id" label="Öğretmen">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={teachers.map((t) => ({
                value: t.id,
                label: `${t.first_name} ${t.last_name}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="academic_year" label="Eğitim öğretim yılı">
            <Input placeholder="Örn. 2025-2026" />
          </Form.Item>
          <Form.Item name="min_attendance_rate" label="Minimum devam oranı (%)">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Kursa Öğrenci Ekle"
        open={enrollModalOpen}
        onCancel={() => setEnrollModalOpen(false)}
        footer={null}
        destroyOnHidden
      >
        <Select
          mode="multiple"
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="Öğrenci seçin"
          options={availableStudents.map((s) => ({
            value: s.id,
            label: `${s.first_name} ${s.last_name} (${s.student_number || '—'})`,
          }))}
          onChange={(ids: number[]) => void onEnroll(ids)}
        />
      </Modal>
      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="Kurs kayıtlarını toplu sil"
        description={`Seçili kurstaki ${enrollments.length} öğrenci kaydı silinecek (kurstan çıkarılacak).`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
    </>
  )
}

/** Eski /dyk yolu → birleşik sayfaya yönlendirir. */
export function DykPage() {
  return <Navigate to="/absences?tab=dyk" replace />
}
