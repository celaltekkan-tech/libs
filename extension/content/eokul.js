// e-Okul "Kurum İşlemleri > Ders İşlemleri > Ders Programı" ızgarasını doldurur.
// Kaydet'e basmaz; kullanıcı kontrol edip kendisi kaydeder.
if (!globalThis.__libsEokulFill) {
  globalThis.__libsEokulFill = true

  const DAY_NAMES = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']
  const STOP = new Set(['ve', 'ile', 'ders', 'dal', 'secmeli'])

  function fold(value) {
    return String(value || '')
      .toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i')
      .replace(/İ/g, 'i')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  function dayOf(text) {
    const value = fold(text)
    if (!value) return null
    if (value.includes('cumartesi')) return 6
    if (value.includes('pazartesi')) return 1
    if (value.includes('carsamba')) return 3
    if (value.includes('persembe')) return 4
    if (value.includes('cuma')) return 5
    if (value.includes('sali')) return 2
    if (value === 'pazar' || value.startsWith('pazar ')) return 7
    return null
  }

  function periodNumber(text) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim()
    if (!raw || /^\d{1,2}:\d{2}/.test(raw)) return null
    const match = raw.match(/^(\d{1,2})\b/)
    if (!match) return null
    const value = Number(match[1])
    return value >= 1 && value <= 14 ? value : null
  }

  function tokens(value) {
    return fold(value)
      .split(' ')
      .filter((part) => part.length >= 3 && !STOP.has(part))
  }

  function scoreName(want, optionText) {
    const left = fold(want)
    const right = fold(optionText)
    if (!left || !right) return 0
    if (left === right) return 1
    if (right.includes(left) && left.length >= 5) return 0.92
    if (left.includes(right) && right.length >= 5) return 0.88
    const a = new Set(tokens(want))
    const b = new Set(tokens(optionText))
    if (!a.size || !b.size) return 0
    let shared = 0
    for (const part of a) if (b.has(part)) shared += 1
    const smaller = Math.min(a.size, b.size)
    if (shared === smaller && shared >= 1) {
      if (a.size === 1 && b.size > 1) return 0.55
      return 0.86
    }
    return shared / (a.size + b.size - shared)
  }

  function sectionKey(value) {
    const folded = fold(value)
    const match = folded.match(/^([a-z0-9]+)/)
    return match ? match[1] : folded
  }

  function sameClass(page, item) {
    return (
      String(Number(page.class_level)) === String(Number(item.class_level)) &&
      sectionKey(page.section) === sectionKey(item.section)
    )
  }

  function classFromParts(levelText, sectionText) {
    const levelMatch = String(levelText || '').match(/(\d{1,2})/)
    const sectionMatch = String(sectionText || '')
      .trim()
      .match(/^([A-Za-zÇĞİÖŞÜçğıöşü0-9]+)/)
    if (!levelMatch || !sectionMatch) return null
    const section = sectionMatch[1].toLocaleUpperCase('tr-TR')
    return {
      class_level: String(Number(levelMatch[1])),
      section,
      label: `${Number(levelMatch[1])}/${section}`,
    }
  }

  function parseClassLabel(text) {
    const raw = String(text || '').trim()
    const match = raw.match(/(\d{1,2})\s*[\/\-]\s*([A-Za-zÇĞİÖŞÜçğıöşü0-9]+)/)
    if (!match) return null
    return classFromParts(match[1], match[2])
  }

  function labelOf(select) {
    if (select.id) {
      const linked = document.querySelector(`label[for="${CSS.escape(select.id)}"]`)
      if (linked) return linked.textContent || ''
    }
    const cell = select.closest('td, th')
    const prevCell = cell?.previousElementSibling
    if (prevCell) return prevCell.textContent || ''
    const prev = select.parentElement?.previousElementSibling
    return prev?.textContent || ''
  }

  function selectedText(select) {
    const option = select.selectedOptions && select.selectedOptions[0]
    return option ? option.textContent || '' : ''
  }

  function pageClass() {
    const selects = [...document.querySelectorAll('select')]
    let level = ''
    let section = ''
    for (const select of selects) {
      const parsed = parseClassLabel(selectedText(select))
      if (parsed) return parsed
      const label = fold(labelOf(select))
      const text = selectedText(select).trim()
      if (!text) continue
      if (label.includes('sube')) section = text
      else if (label.includes('sinif')) level = text
    }
    if (level && section) return classFromParts(level, section)
    return null
  }

  function gridFromTable(table) {
    const rows = [...table.rows]
    if (rows.length < 2) return null
    let headerIndex = -1
    let columns = []
    for (let i = 0; i < Math.min(rows.length, 5); i += 1) {
      const found = [...rows[i].cells]
        .map((cell, index) => ({ index, day: dayOf(cell.innerText) }))
        .filter((item) => item.day)
      if (found.length >= 3) {
        headerIndex = i
        columns = found
        break
      }
    }
    if (headerIndex < 0) return null

    const cells = []
    let sequence = 0
    for (let r = headerIndex + 1; r < rows.length; r += 1) {
      const row = rows[r]
      const selectsInRow = row.querySelectorAll('select').length
      if (!selectsInRow) continue
      let period = null
      for (let c = 0; c < Math.min(row.cells.length, 3); c += 1) {
        period = periodNumber(row.cells[c].innerText)
        if (period) break
      }
      if (!period) {
        sequence += 1
        period = sequence
      } else {
        sequence = period
      }
      for (const column of columns) {
        const cell = row.cells[column.index]
        const select = cell?.querySelector('select')
        if (!select || select.disabled) continue
        cells.push({ day: column.day, period, select })
      }
    }
    return cells.length ? cells : null
  }

  function findGrid() {
    let best = null
    for (const table of document.querySelectorAll('table')) {
      const cells = gridFromTable(table)
      if (cells && (!best || cells.length > best.length)) best = cells
    }
    return best
  }

  function pickOption(select, subjects) {
    let best = null
    let bestScore = 0
    for (const option of select.options) {
      const text = (option.textContent || '').trim()
      const folded = fold(text)
      if (!folded || folded === 'seciniz' || folded.startsWith('seciniz')) continue
      for (const subject of subjects) {
        const byName = scoreName(subject.name, text)
        const byCode = subject.code && fold(subject.code) === folded ? 1 : 0
        const score = Math.max(byName, byCode)
        if (score > bestScore) {
          bestScore = score
          best = option
        }
      }
    }
    if (!best || bestScore < 0.75) return null
    return best
  }

  function applyOption(select, option) {
    const previous = select.selectedIndex
    select.value = option.value
    const postback = /__doPostBack|WebForm_DoPostBack/i.test(select.getAttribute('onchange') || '')
    if (!postback) select.dispatchEvent(new Event('change', { bubbles: true }))
    select.style.outline = '2px solid #2e7d32'
    return previous !== select.selectedIndex
  }

  function clearSelect(select) {
    const empty = [...select.options].find((option) => !fold(option.textContent) || fold(option.textContent).startsWith('seciniz'))
    if (!empty) return false
    select.value = empty.value
    const postback = /__doPostBack|WebForm_DoPostBack/i.test(select.getAttribute('onchange') || '')
    if (!postback) select.dispatchEvent(new Event('change', { bubbles: true }))
    select.style.outline = '2px solid #ef6c00'
    return true
  }

  function findClass(program, classLabel) {
    if (classLabel) {
      const wanted = program.classes.find((item) => item.label === classLabel)
      if (wanted) return { item: wanted, fromPage: false }
    }
    const detected = pageClass()
    if (!detected) return { needClass: true }
    const item = program.classes.find((row) => sameClass(detected, row))
    if (!item) {
      return {
        error: `Açık şube ${detected.label}, bu programda yok. Programdaki şubeler: ${program.classes.map((row) => row.label).join(', ')}`,
      }
    }
    return { item, fromPage: true }
  }

  function fill(message) {
    const program = message.program
    if (!program || !Array.isArray(program.classes)) {
      return { handled: true, error: 'Program paketi okunamadı.' }
    }
    const grid = findGrid()
    if (!grid) {
      return {
        handled: false,
        selects: document.querySelectorAll('select').length,
      }
    }

    const found = findClass(program, message.classLabel)
    if (found.needClass) {
      return {
        handled: true,
        needClass: true,
        classes: program.classes.map((item) => item.label),
      }
    }
    if (found.error) return { handled: true, error: found.error }

    const byKey = new Map(found.item.slots.map((slot) => [`${slot.day}-${slot.period}`, slot]))
    const missed = []
    const notes = []
    let filled = 0
    let cleared = 0

    for (const cell of grid) {
      const slot = byKey.get(`${cell.day}-${cell.period}`)
      if (!slot) {
        if (message.clearEmpty && clearSelect(cell.select)) cleared += 1
        continue
      }
      if (slot.subjects.length > 1) {
        notes.push(
          `${DAY_NAMES[cell.day]} ${cell.period}. saatte birden fazla ders var (${slot.subjects.map((item) => item.name).join(', ')}). Listede karşılığı olan biri seçildi.`
        )
      }
      const option = pickOption(cell.select, slot.subjects)
      if (!option) {
        missed.push(`${DAY_NAMES[cell.day]} ${cell.period}. saat: ${slot.subjects.map((item) => item.name).join(', ')}`)
        cell.select.style.outline = '2px solid #c62828'
        continue
      }
      if (applyOption(cell.select, option)) filled += 1
    }

    return {
      handled: true,
      classroom: found.item.label,
      filled,
      cleared,
      missed,
      notes: [...new Set(notes)].slice(0, 8),
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'libs-fill') return
    try {
      sendResponse(fill(message))
    } catch (err) {
      sendResponse({ handled: true, error: err && err.message ? err.message : 'Doldurma başarısız' })
    }
  })
}
