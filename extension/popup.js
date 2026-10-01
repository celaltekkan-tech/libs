const emptyEl = document.getElementById('empty')
const readyEl = document.getElementById('ready')
const summaryEl = document.getElementById('summary')
const statusEl = document.getElementById('status')
const classPick = document.getElementById('class-pick')
const classSelect = document.getElementById('class-select')
const clearEmpty = document.getElementById('clear-empty')

function setStatus(text, kind) {
  statusEl.textContent = text || ''
  statusEl.className = kind || ''
}

function isProgram(value) {
  return Boolean(value && value.version === 1 && Array.isArray(value.classes) && value.project)
}

function showProgram(program) {
  const hours = program.classes.reduce((sum, item) => sum + item.slots.length, 0)
  summaryEl.textContent = `${program.project.name}: ${program.classes.length} şube, ${hours} dolu saat`
  emptyEl.hidden = true
  readyEl.hidden = false
}

async function storedProgram() {
  const data = await chrome.storage.local.get(['program', 'clearEmpty'])
  clearEmpty.checked = Boolean(data.clearEmpty)
  if (isProgram(data.program)) showProgram(data.program)
  return data.program
}

async function saveProgram(program) {
  await chrome.storage.local.set({ program })
  classPick.hidden = true
  showProgram(program)
  setStatus('Program hazır.', 'ok')
}

async function libsSession() {
  const tabs = await chrome.tabs.query({ url: ['http://localhost:5173/*', 'http://127.0.0.1:5173/*'] })
  const tab = tabs.find((item) => item.active) || tabs[0]
  if (!tab?.id) throw new Error('Bu tarayıcıda açık bir Libs sekmesi yok (localhost:5173).')
  const ask = () => chrome.tabs.sendMessage(tab.id, { type: 'libs-session' })
  let session
  try {
    session = await ask()
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/libs.js'] })
    session = await ask()
  }
  if (!session?.token) throw new Error('Libs oturumu yok. Panelde giriş yapıp ders programı sayfasını bir kez açın.')
  return session
}

async function pullFromLibs() {
  setStatus('Program alınıyor…')
  const session = await libsSession()
  const headers = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }
  const listRes = await fetch(`${session.origin}/api/timetable/projects`, { headers })
  const listBody = await listRes.json()
  if (!listRes.ok || listBody.success === false) throw new Error(listBody.message || 'Program listesi alınamadı')
  const projects = listBody.data || []
  if (!projects.length) throw new Error('Ders programı çalışması yok.')
  const preferred = new Set((session.projects || []).map((item) => item.projectId))
  const project = projects.find((item) => preferred.has(item.id)) || projects[0]
  const res = await fetch(`${session.origin}/api/timetable/projects/${project.id}/eokul`, { headers })
  const body = await res.json()
  if (!res.ok || body.success === false) throw new Error(body.message || 'Program alınamadı')
  if (!isProgram(body.data)) throw new Error('Sunucu beklenen paketi döndürmedi.')
  await saveProgram(body.data)
}

async function framesOf(tabId) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId })
    if (frames?.length) return frames
  } catch {
    // üst kare yeter
  }
  return [{ frameId: 0 }]
}

async function fillPage() {
  const { program } = await chrome.storage.local.get('program')
  if (!isProgram(program)) throw new Error('Önce programı alın.')
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url || !/meb\.gov\.tr/i.test(tab.url)) {
    throw new Error('Doldurmadan önce e-Okul ders programı sekmesine geçin.')
  }

  const payload = {
    type: 'libs-fill',
    program,
    clearEmpty: clearEmpty.checked,
    classLabel: classPick.hidden ? '' : classSelect.value,
  }

  const askFrames = async () => {
    const frames = await framesOf(tab.id)
    let fallback = null
    for (const frame of frames) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, payload, { frameId: frame.frameId })
        if (response?.handled) return response
        if (response) fallback = response
      } catch {
        // bu karede dinleyici yok
      }
    }
    return fallback
  }

  let response = await askFrames()
  if (!response) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content/eokul.js'],
    })
    response = await askFrames()
  }
  if (!response?.handled) {
    const selects = response?.selects ? ` Sayfada ${response.selects} açılır kutu var.` : ''
    throw new Error(
      `Ders programı tablosu bulunamadı.${selects} Şubeyi seçip Listele'ye bastıktan sonra, tablo görünürken tekrar deneyin.`
    )
  }
  if (response.needClass) {
    classSelect.replaceChildren(
      ...response.classes.map((label) => {
        const option = document.createElement('option')
        option.value = label
        option.textContent = label
        return option
      })
    )
    classPick.hidden = false
    throw new Error('Sayfadaki şube okunamadı. Şubeyi seçip yeniden doldurun.')
  }
  if (response.error) throw new Error(response.error)

  const missed = response.missed?.length ? ` Eşleşmeyen ${response.missed.length} saat: ${response.missed.slice(0, 4).join('; ')}` : ''
  const notes = response.notes?.length ? ` ${response.notes[0]}` : ''
  setStatus(
    `${response.classroom}: ${response.filled} saat yazıldı` +
      (response.cleared ? `, ${response.cleared} boşaltıldı` : '') +
      `. Kontrol edip Kaydet'e basın.${missed}${notes}`,
    response.missed?.length ? 'error' : 'ok'
  )
}

document.getElementById('pull').addEventListener('click', () => {
  pullFromLibs().catch((err) => setStatus(err.message || 'Alınamadı', 'error'))
})

document.getElementById('file').addEventListener('change', () => {
  const file = document.getElementById('file').files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const program = JSON.parse(String(reader.result || ''))
      if (!isProgram(program)) throw new Error('Bu dosya Libs e-Okul paketi değil.')
      saveProgram(program).catch((err) => setStatus(err.message, 'error'))
    } catch (err) {
      setStatus(err.message || 'Dosya okunamadı', 'error')
    }
  }
  reader.readAsText(file)
})

document.getElementById('fill').addEventListener('click', () => {
  setStatus('Dolduruluyor…')
  fillPage().catch((err) => setStatus(err.message || 'Doldurulamadı', 'error'))
})

document.getElementById('reset').addEventListener('click', () => {
  chrome.storage.local.remove('program').then(() => {
    readyEl.hidden = true
    emptyEl.hidden = false
    classPick.hidden = true
    setStatus('')
  })
})

clearEmpty.addEventListener('change', () => {
  chrome.storage.local.set({ clearEmpty: clearEmpty.checked })
})

storedProgram().catch(() => {})
