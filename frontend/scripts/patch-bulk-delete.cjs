const fs = require('fs')
const path = require('path')

function insertImport(src, marker, importLine) {
  if (src.includes(importLine.trim())) return src
  const idx = src.indexOf(marker)
  if (idx < 0) throw new Error('Missing marker: ' + marker)
  const end = src.indexOf('\n', idx)
  const insertAt = end + 1
  return src.slice(0, insertAt) + importLine + src.slice(insertAt)
}

function insertAfterLineContaining(src, contains, insertLines) {
  if (src.includes(insertLines.trim().split('\n')[0])) return src
  const idx = src.indexOf(contains)
  if (idx < 0) throw new Error('Missing contains: ' + contains)
  const end = src.indexOf('\n', idx)
  return src.slice(0, end + 1) + insertLines + src.slice(end + 1)
}

function insertAfterFunction(src, fnStartNeedle, insertText) {
  if (src.includes('const onBulkDelete')) return src
  const idx = src.indexOf(fnStartNeedle)
  if (idx < 0) throw new Error('Missing function: ' + fnStartNeedle)
  let i = src.indexOf('{', idx)
  let depth = 0
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) {
        i++
        break
      }
    }
  }
  while (i < src.length && (src[i] === '\r' || src[i] === '\n' || src[i] === ' ')) i++
  return src.slice(0, i) + insertText + src.slice(i)
}

function replaceOnce(src, from, to) {
  if (src.includes(to.trim().slice(0, 40)) && src.includes('Toplu sil')) return src
  if (!src.includes(from)) throw new Error('Missing button block')
  return src.replace(from, to)
}

function ensureModal(src, title, descExpr) {
  if (src.includes('open={bulkOpen}')) return src
  const re = /(\n {4}<\/AppLayout>\r?\n {2}\)\r?\n\})/
  if (!re.test(src)) throw new Error('AppLayout close not found')
  const modal = `      <TypedPhraseConfirmModal
        open={bulkOpen}
        title="${title}"
        description={\`${descExpr}\`}
        loading={bulkLoading}
        onCancel={() => setBulkOpen(false)}
        onConfirm={onBulkDelete}
      />
`
  return src.replace(re, `\n${modal}$1`)
}

function bulkHandler(idsExpr, deleteCall, noun) {
  return `  const onBulkDelete = async () => {
    setBulkLoading(true)
    try {
      const result = await bulkDeleteByIds(
        ${idsExpr},
        (id) => ${deleteCall},
      )
      const text = bulkDeleteResultMessage(result, '${noun}')
      if (result.failed === 0) message.success(text)
      else message.warning(text)
      setBulkOpen(false)
      void load()
    } finally {
      setBulkLoading(false)
    }
  }

`
}

const configs = [
  {
    file: 'src/pages/ClassroomsPage.tsx',
    layoutMarker: "from '../components/AppLayout'",
    utilMarker: "from '../utils/tablePagination'",
    stateContains: "useState<ExportFormat>('xlsx')",
    fnNeedle: 'const onDelete = (row: Classroom) => {',
    ids: 'filteredRows.map((r) => r.id)',
    del: 'deleteClassroom(Number(id))',
    noun: 'sınıf',
    title: 'Sınıfları toplu sil',
    desc: 'Filtreye uyan ${filteredRows.length} sınıf/şube kaydı silinecek.',
    buttonFrom: `          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>`,
    buttonTo: `          <Space wrap>
            {canDelete && filteredRows.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredRows.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>`,
  },
  {
    file: 'src/pages/SubjectsPage.tsx',
    layoutMarker: "from '../components/AppLayout'",
    utilMarker: "from '../utils/tablePagination'",
    stateContains: "useState<ExportFormat>('xlsx')",
    fnNeedle: 'const onDelete = (row: Subject) => {',
    ids: 'filteredRows.map((r) => r.id)',
    del: 'deleteSubject(Number(id))',
    noun: 'ders',
    title: 'Dersleri toplu sil',
    desc: 'Filtreye uyan ${filteredRows.length} ders kaydı silinecek.',
    buttonFrom: `          <Space wrap>
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>`,
    buttonTo: `          <Space wrap>
            {canDelete && filteredRows.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredRows.length})
              </Button>
            )}
            <Button icon={<DownloadOutlined />} onClick={() => setExportOpen(true)}>
              Dışa Aktar
            </Button>`,
  },
  {
    file: 'src/pages/UsersPage.tsx',
    layoutMarker: "from '../components/AppLayout'",
    utilMarker: "from '../utils/tablePagination'",
    stateContains: "const [search, setSearch] = useState('')",
    fnNeedle: 'const onDelete = (user: ManagedUser) => {',
    ids: 'filteredUsers.map((u) => u.id)',
    del: 'deleteManagedUser(Number(id))',
    noun: 'kullanıcı',
    title: 'Kullanıcıları toplu sil',
    desc: 'Filtreye uyan ${filteredUsers.length} kullanıcı kaydı silinecek.',
    buttonFrom: `                    {canCreate && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreate}
                        disabled={options.schools.length === 0 || atUserLimit}
                      >
                        Yeni Kullanıcı
                      </Button>
                    )}`,
    buttonTo: `                    {canDelete && filteredUsers.length > 0 && (
                      <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                        Toplu sil ({filteredUsers.length})
                      </Button>
                    )}
                    {canCreate && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={openCreate}
                        disabled={options.schools.length === 0 || atUserLimit}
                      >
                        Yeni Kullanıcı
                      </Button>
                    )}`,
  },
  {
    file: 'src/pages/OtherPersonnelPage.tsx',
    layoutMarker: "from '../components/AppLayout'",
    utilMarker: "from '../types/personnelCategory'",
    stateContains: 'const [submitting, setSubmitting] = useState(false)',
    fnNeedle: 'const onDeleteStaff = (person: Teacher) => {',
    ids: 'filteredStaff.map((p) => p.id)',
    del: 'deleteTeacher(Number(id))',
    noun: 'personel',
    title: 'Personelleri toplu sil',
    desc: 'Filtreye uyan ${filteredStaff.length} personel kaydı silinecek.',
    buttonFrom: `          <Space wrap>
            {canCreate && (
              <Button icon={<TagOutlined />} onClick={openCreateCategory}>
                Kategori ekle
              </Button>
            )}`,
    buttonTo: `          <Space wrap>
            {canDelete && filteredStaff.length > 0 && (
              <Button danger icon={<DeleteOutlined />} onClick={() => setBulkOpen(true)}>
                Toplu sil ({filteredStaff.length})
              </Button>
            )}
            {canCreate && (
              <Button icon={<TagOutlined />} onClick={openCreateCategory}>
                Kategori ekle
              </Button>
            )}`,
  },
]

for (const cfg of configs) {
  const file = path.resolve(cfg.file)
  let src = fs.readFileSync(file, 'utf8')
  // normalize button blocks to \n for matching while preserving file later - work on normalized
  const nl = src.includes('\r\n') ? '\r\n' : '\n'
  src = insertImport(src, cfg.layoutMarker, `import { TypedPhraseConfirmModal } from '../components/TypedPhraseConfirmModal'${nl}`)
  src = insertImport(src, cfg.utilMarker, `import { bulkDeleteByIds, bulkDeleteResultMessage } from '../utils/bulkDelete'${nl}`)
  if (!src.includes('bulkOpen')) {
    src = insertAfterLineContaining(
      src,
      cfg.stateContains,
      `  const [bulkOpen, setBulkOpen] = useState(false)${nl}  const [bulkLoading, setBulkLoading] = useState(false)${nl}`,
    )
  }
  src = insertAfterFunction(src, cfg.fnNeedle, bulkHandler(cfg.ids, cfg.del, cfg.noun).replace(/\n/g, nl))
  // button: try both LF and CRLF versions
  const fromLF = cfg.buttonFrom
  const fromCRLF = cfg.buttonFrom.replace(/\n/g, '\r\n')
  const toLF = cfg.buttonTo
  const toCRLF = cfg.buttonTo.replace(/\n/g, '\r\n')
  if (!src.includes('Toplu sil')) {
    if (src.includes(fromCRLF)) src = src.replace(fromCRLF, toCRLF)
    else if (src.includes(fromLF)) src = src.replace(fromLF, toLF)
    else throw new Error('Button block not found in ' + cfg.file)
  }
  src = ensureModal(src, cfg.title, cfg.desc)
  fs.writeFileSync(file, src)
  console.log('OK', cfg.file)
}
