if (!globalThis.__libsEokulBridge) {
  globalThis.__libsEokulBridge = true

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'libs-session') return
    const token = localStorage.getItem('lise_idari.token')
    const projects = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith('timetable.project.')) continue
      const projectId = Number(localStorage.getItem(key))
      const schoolId = Number(key.slice('timetable.project.'.length))
      if (projectId) projects.push({ schoolId, projectId })
    }
    sendResponse({ token, origin: location.origin, projects })
  })
}
