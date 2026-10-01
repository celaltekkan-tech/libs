function isProgram(value) {
  return Boolean(value && value.version === 1 && Array.isArray(value.classes) && value.project)
}

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'oids-ping') {
    sendResponse({ ok: true })
    return
  }
  if (message?.type === 'oids-program' && isProgram(message.program)) {
    chrome.storage.local.set({ program: message.program }).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false })
    )
    return true
  }
  sendResponse({ ok: false })
})
