const API = 'https://api.oids.com.tr'
const UPDATE_ALARM = 'oids-extension-update'

function currentVersion() {
  return chrome.runtime.getManifest().version
}

function compareVersions(left, right) {
  const a = String(left || '')
    .split('.')
    .map((part) => Number(part) || 0)
  const b = String(right || '')
    .split('.')
    .map((part) => Number(part) || 0)
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0)
    if (delta) return delta < 0 ? -1 : 1
  }
  return 0
}

function isProgram(value) {
  return Boolean(value && value.version === 1 && Array.isArray(value.classes) && value.project)
}

async function markUpdate(latest, downloadUrl) {
  const outdated = Boolean(latest && compareVersions(currentVersion(), latest) < 0)
  await chrome.storage.local.set({
    extensionUpdate: {
      latest: latest || '',
      downloadUrl: downloadUrl || `${API}/api/extension/oids-eokul-eklentisi.zip`,
      outdated,
      checkedAt: Date.now(),
    },
  })
  await chrome.action.setBadgeText({ text: outdated ? '!' : '' })
  if (outdated) await chrome.action.setBadgeBackgroundColor({ color: '#b45309' })
  return { version: currentVersion(), latest, outdated }
}

async function checkUpdate() {
  try {
    const res = await fetch(`${API}/api/extension/version`)
    const body = await res.json()
    const data = body?.data || {}
    return markUpdate(data.version, data.download_url)
  } catch {
    const stored = await chrome.storage.local.get('extensionUpdate')
    const latest = stored.extensionUpdate?.latest
    return {
      version: currentVersion(),
      latest,
      outdated: Boolean(latest && compareVersions(currentVersion(), latest) < 0),
    }
  }
}

function ensureAlarm() {
  chrome.alarms.create(UPDATE_ALARM, { periodInMinutes: 360 })
}

chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm()
  checkUpdate()
})
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm()
  checkUpdate()
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === UPDATE_ALARM) checkUpdate()
})
ensureAlarm()
checkUpdate()

function pingPayload(sendResponse) {
  chrome.storage.local.get('extensionUpdate').then((data) => {
    const latest = data.extensionUpdate?.latest
    sendResponse({
      ok: true,
      version: currentVersion(),
      latest,
      outdated: Boolean(data.extensionUpdate?.outdated),
    })
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'oids-update-status') {
    checkUpdate().then(sendResponse, () => sendResponse({ version: currentVersion(), outdated: false }))
    return true
  }
  return false
})

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'oids-ping') {
    pingPayload(sendResponse)
    return true
  }
  if (message?.type === 'oids-program' && isProgram(message.program)) {
    chrome.storage.local.set({ program: message.program }).then(
      () => sendResponse({ ok: true, version: currentVersion() }),
      () => sendResponse({ ok: false, version: currentVersion() })
    )
    return true
  }
  sendResponse({ ok: false, version: currentVersion() })
})
