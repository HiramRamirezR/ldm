;(function() {
  const $ = id => document.getElementById(id)

  window.__LDM = {}

  let currentChapterData = null
  let currentBookSlug = '1-ne'
  let currentChapterNum = 1
  const REFLECTION_QUESTIONS = [
    '¿Qué versículo de este capítulo te llamó más la atención y por qué?',
    '¿Qué aprendiste sobre Dios o sobre Jesucristo en este capítulo?',
    'Escribe un pensamiento, impresión o algo que quieras aplicar en tu vida después de esta lectura.'
  ]

  // --- Dark mode ---
  function updateDarkModeButtons() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
    const icon = isDark ? '<i class="fa-regular fa-sun"></i>' : '<i class="fa-regular fa-moon"></i>'
    const btn1 = $('btnDarkMode')
    const btn2 = $('btnDarkModeReading')
    if (btn1) btn1.innerHTML = icon
    if (btn2) btn2.innerHTML = icon
  }

  function toggleDarkMode() {
    const html = document.documentElement
    const isDark = html.getAttribute('data-theme') === 'dark'
    if (isDark) {
      html.removeAttribute('data-theme')
      Store.set('darkMode', false)
      toast('Modo claro', 'fa-sun')
    } else {
      html.setAttribute('data-theme', 'dark')
      Store.set('darkMode', true)
      toast('Modo oscuro', 'fa-moon')
    }
    updateDarkModeButtons()
  }

  // --- Font size ---
  function adjustFontSize(delta) {
    const el = document.documentElement
    const current = parseInt(el.style.getPropertyValue('--reading-font-size')) || 16
    const next = Math.max(12, Math.min(28, current + delta))
    el.style.setProperty('--reading-font-size', next + 'px')
    Store.set('fontSize', next)
    toast(`Tama&ntilde;o: ${next}px`, 'fa-text-height')
  }

  // --- Share ---
  function shareChapter() {
    const data = currentChapterData
    if (!data) return
    const title = data.titulo || `${API.getBookTitle(data.libro_slug)} ${data.capitulo}`
    const text = `Estoy leyendo ${title} en LdM Diario — creando el hábito de la lectura diaria del Libro de Mormón.`
    if (navigator.share) {
      navigator.share({ title: 'LdM Diario', text, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => toast('Copiado al portapapeles', 'fa-clipboard'))
    }
  }

  // --- Swipe navigation ---
  let touchStartX = 0
  let touchStartY = 0
  function initSwipe() {
    const el = $('readingContent')
    el.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].screenX
      touchStartY = e.changedTouches[0].screenY
    }, { passive: true })
    el.addEventListener('touchend', e => {
      // Don't navigate if user has selected text (trying to highlight)
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return

      const dx = e.changedTouches[0].screenX - touchStartX
      const dy = Math.abs(e.changedTouches[0].screenY - touchStartY)
      // Only navigate if horizontal movement dominates vertical (not a scroll)
      if (Math.abs(dx) < 50) return
      if (Math.abs(dx) < dy * 1.5) return
      if (dx > 0) navigateChapter(-1)
      else navigateChapter(1)
    }, { passive: true })
  }

  function navigateChapter(dir) {
    const progress = Store.getProgress()
    const order = API.getBookOrder()
    const counts = API.getChapterCounts()
    let book = currentBookSlug
    let ch = currentChapterNum + dir
    if (ch < 1) {
      const idx = order.indexOf(book)
      if (idx <= 0) { toast('Primer cap&iacute;tulo', 'fa-book-open'); return }
      book = order[idx - 1]
      ch = counts[book]
    } else if (ch > (counts[book] || 0)) {
      const idx = order.indexOf(book)
      if (idx >= order.length - 1) { toast('&Uacute;ltimo cap&iacute;tulo', 'fa-book-open'); return }
      book = order[idx + 1]
      ch = 1
    }
    currentBookSlug = book
    currentChapterNum = ch
    progress.currentBook = book
    progress.currentChapter = ch
    Store.saveProgress(progress)
    startReading()
  }

  // --- PWA Install ---
  let deferredPrompt = null
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      deferredPrompt = e
      const btn = $('btnInstall')
      if (btn) btn.style.display = ''
    })
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null
      const btn = $('btnInstall')
      if (btn) btn.style.display = 'none'
      toast('App instalada', 'fa-circle-check')
    })
  }

  function installApp() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    deferredPrompt.userChoice.then(() => { deferredPrompt = null; $('btnInstall').style.display = 'none' })
  }

  function handleBack() {
    const active = document.querySelector('.screen.active')
    if (!active) { window.history.back(); return }

    const screensToActions = {
      'screen-home': () => { /* already on home, do nothing */ },
      'screen-splash': () => { /* ignore splash state */ },
      'screen-reading': () => renderHome(),
      'screen-journal': () => renderHome(),
      'screen-study': () => show('screen-home'),
      'screen-thread': () => { if (window.Highlights) Highlights.openStudyView('threads') },
      'screen-reflection': () => renderHome(),
      'screen-results': () => renderHome()
    }
    const action = screensToActions[active.id]
    if (action) {
      action()
    } else {
      window.history.back()
    }
  }

  function pushScreenState(screenId) {
    if (!screenId || screenId === 'screen-splash') return
    history.pushState({ screen: screenId }, '')
  }

  function init() {
    show('screen-splash')

    const dark = Store.get('darkMode', false)
    if (dark) document.documentElement.setAttribute('data-theme', 'dark')
    updateDarkModeButtons()

    const fs = Store.get('fontSize', 16)
    document.documentElement.style.setProperty('--reading-font-size', fs + 'px')

    const progress = Store.getProgress()
    currentBookSlug = progress.currentBook
    currentChapterNum = progress.currentChapter

    window.__LDM.bookSlug = currentBookSlug
    window.__LDM.chapterNum = currentChapterNum

    initSwipe()

    // Create initial history entry so native back doesn't exit the app
    history.pushState({ screen: 'splash' }, '')
    window.addEventListener('popstate', handleBack)

    setTimeout(() => {
      show('screen-home')
      renderHome()
    }, 1200)
  }

  function renderHome() {
    const streak = Store.getStreak()
    const progress = Store.getProgress()

    const prevStreak = parseInt($('streakNumber').textContent) || 0
    $('streakCount').textContent = streak.currentStreak
    $('streakNumber').textContent = streak.currentStreak
    if (streak.currentStreak > prevStreak && prevStreak > 0) {
      $('streakNumber').classList.remove('pop')
      void $('streakNumber').offsetWidth
      $('streakNumber').classList.add('pop')
    }

    const weekDays = Store.getWeekStatus()
    $('weekBar').innerHTML = weekDays.map(d => `
      <div class="week-day">
        <div class="week-day-circle ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''}">
          ${d.done ? '<i class=\"fa-solid fa-fire\"></i>' : ''}
        </div>
        <span>${d.label}</span>
      </div>
    `).join('')

    const total = progress.totalChapters
    const done = progress.completedChapters.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    $('progressPercent').textContent = pct + '%'
    $('progressFill').style.width = pct + '%'
    $('progressDetail').textContent = `${done} / ${total} capítulos`

    $('currentChapterLabel').textContent = `${API.getBookTitle(currentBookSlug)} ${currentChapterNum}`

    if (streak.todayDone) {
      $('btnReadText').innerHTML = '<i class="fa-regular fa-circle-play"></i> Seguir Leyendo'
    } else {
      $('btnReadText').innerHTML = '<i class="fa-regular fa-circle-play"></i> Empezar Lectura de Hoy'
    }

    // Bookmark alert
    const bookmark = Store.getBookmark()
    const bookmarkAlert = $('bookmarkAlert')
    if (bookmark && !(bookmark.bookSlug === currentBookSlug && bookmark.chapter === currentChapterNum)) {
      const title = `${API.getBookTitle(bookmark.bookSlug)} ${bookmark.chapter}, v.${bookmark.verse}`
      bookmarkAlert.innerHTML = `
        <span class="alert-text"><i class="fa-solid fa-bookmark"></i> ${title}</span>
        <span class="alert-arrow"><i class="fa-solid fa-arrow-right"></i></span>
      `
      bookmarkAlert.style.display = 'flex'
      bookmarkAlert.onclick = () => {
        currentBookSlug = bookmark.bookSlug
        currentChapterNum = bookmark.chapter
        progress.currentBook = bookmark.bookSlug
        progress.currentChapter = bookmark.chapter
        Store.saveProgress(progress)
        startReading(true)
      }
    } else {
      bookmarkAlert.style.display = 'none'
    }

    show('screen-home')
    if (window.Badges) Badges.renderHomeCard()
  }

  // --- Modal Selector ---

  function openModal() {
    const order = API.getBookOrder()
    const counts = API.getChapterCounts()
    const progress = Store.getProgress()
    const completed = progress.completedChapters

    $('modalBody').innerHTML = order.map(slug => {
      const bookName = API.getBookTitle(slug)
      const numChaps = counts[slug]
      const chapters = []
      for (let i = 1; i <= numChaps; i++) {
        const key = `${slug}/${i}`
        const isDone = completed.includes(key)
        const isCurrent = slug === currentBookSlug && i === currentChapterNum
        const hasAct = Store.chapterHasActivity(slug, i)
        chapters.push({ num: i, done: isDone, current: isCurrent, activity: hasAct })
      }
      return `
        <div class="book-item" data-slug="${slug}">
          <div class="book-header" onclick="toggleBook(this)">
            <span class="book-name">${bookName} (${numChaps})</span>
            <span class="book-arrow"><i class="fa-solid fa-chevron-down"></i></span>
          </div>
          <div class="chapter-list">
            ${chapters.map(c => `
              <button class="chapter-chip ${c.done ? 'done' : ''} ${c.current ? 'current' : ''} ${c.activity ? 'has-activity' : ''}" 
                      data-slug="${slug}" data-chapter="${c.num}">
                ${c.num}${c.done ? ' <i class="fa-solid fa-check"></i>' : ''}${c.activity ? ' <i class="fa-regular fa-pen-to-square activity-icon"></i>' : ''}
              </button>
            `).join('')}
          </div>
        </div>
      `
    }).join('')

    $('modalOverlay').classList.add('active')

    // Bind chapter clicks
    $('modalBody').querySelectorAll('.chapter-chip').forEach(el => {
      el.addEventListener('click', () => {
        const slug = el.dataset.slug
        const chapter = parseInt(el.dataset.chapter)
        currentBookSlug = slug
        currentChapterNum = chapter
        const progress = Store.getProgress()
        progress.currentBook = slug
        progress.currentChapter = chapter
        Store.saveProgress(progress)
        closeModal()
        startReading()
      })
    })
  }

  window.toggleBook = function(header) {
    header.classList.toggle('open')
    const list = header.nextElementSibling
    list.classList.toggle('open')
  }

  function closeModal() {
    $('modalOverlay').classList.remove('active')
  }

  // --- Reading ---

  async function startReading(scrollToBookmark, scrollToVerse) {
    window.__LDM.bookSlug = currentBookSlug
    window.__LDM.chapterNum = currentChapterNum
    show('screen-splash')
    try {
      const data = await API.getChapter(currentBookSlug, currentChapterNum)
      currentChapterData = data
      Store.saveProgress(Store.getProgress())
      renderChapter(data, scrollToBookmark, scrollToVerse)
    } catch (err) {
      console.error(err)
      toast('Error al cargar el capítulo. Verifica tu conexión.', 'fa-triangle-exclamation')
      show('screen-home')
    }
  }

  window.startReadingAt = (verse) => {
    startReading(false, verse)
  }

  let _swipeTimer = null
  function renderChapter(data, scrollToBookmark, scrollToVerse) {
    const title = data.titulo || `${API.getBookTitle(data.libro_slug)} ${data.capitulo}`
    $('chapterTitle').textContent = title

    // Swipe hint (show once briefly)
    const hint = $('swipeHint')
    hint.classList.add('show')
    clearTimeout(_swipeTimer)
    _swipeTimer = setTimeout(() => hint.classList.remove('show'), 3000)

    if (data.sumario) {
      $('chapterSummary').textContent = data.sumario
      $('chapterSummary').style.display = 'block'
    } else {
      $('chapterSummary').style.display = 'none'
    }

    // Show "Leído" badge if this chapter was already completed
    const completedChapters = Store.getProgress().completedChapters
    const isRead = completedChapters.includes(`${data.libro_slug}/${data.capitulo}`)
    const readBadge = $('chapterReadBadge')
    if (readBadge) readBadge.style.display = isRead ? 'inline-flex' : 'none'

    const bookmark = Store.getBookmark()
    const isBookmarkedHere = bookmark && bookmark.bookSlug === data.libro_slug && bookmark.chapter === data.capitulo

    $('verses').innerHTML = data.versiculos.map(v => {
      const isTarget = isBookmarkedHere && bookmark.verse === v.numero
      return `<div class="verse ${isTarget ? 'bookmarked' : ''}" data-verse="${v.numero}">
        <span class="verse-num">${v.numero}</span>
        ${v.texto}
      </div>`
    }).join('')

    // Bookmark button state
    updateBookmarkBtn(isBookmarkedHere ? (bookmark.verse || null) : null)
    $('bookmarkBtn').onclick = () => toggleBookmark(data)

    $('readingProgress').style.width = '0%'
    show('screen-reading')
    pushScreenState('screen-reading')

    const content = $('readingContent')
    content.scrollTop = 0
    content.removeEventListener('scroll', updateReadProgress)
    content.addEventListener('scroll', updateReadProgress)
    updateReadProgress()

    $('btnFinishReading').disabled = false

    // Apply highlights
    if (window.Highlights) {
      Highlights.applyHighlights(data)
    }

    if (scrollToBookmark && isBookmarkedHere) {
      setTimeout(() => {
        const target = content.querySelector(`[data-verse="${bookmark.verse}"]`)
        if (target) {
          target.scrollIntoView({ block: 'center' })
          target.classList.add('highlight')
          setTimeout(() => target.classList.remove('highlight'), 2000)
        }
      }, 300)
    }

    if (scrollToVerse) {
      setTimeout(() => {
        const target = content.querySelector(`[data-verse="${scrollToVerse}"]`)
        if (target) target.scrollIntoView({ block: 'center' })
      }, 400)
    }
  }

  function updateReadProgress() {
    const el = $('readingContent')
    const scrollable = el.scrollHeight - el.clientHeight
    const scrolled = el.scrollTop
    const pct = scrollable > 0 ? Math.min(100, Math.round((scrolled / scrollable) * 100)) : 100
    $('readingProgress').style.width = pct + '%'
  }

  function toggleBookmark(data) {
    const content = $('readingContent')
    const verses = content.querySelectorAll('.verse')
    const scrollTop = content.scrollTop

    // Find the first verse visible in the viewport
    let targetVerse = 1
    for (const el of verses) {
      const offsetTop = el.offsetTop
      if (offsetTop >= scrollTop - 60) {
        targetVerse = parseInt(el.dataset.verse)
        break
      }
    }

    const currentBookmark = Store.getBookmark()
    if (currentBookmark && currentBookmark.bookSlug === data.libro_slug && currentBookmark.chapter === data.capitulo && currentBookmark.verse === targetVerse) {
      Store.clearBookmark()
      updateBookmarkBtn(null)
      verses.forEach(v => v.classList.remove('bookmarked'))
      toast('Separador quitado', 'fa-bookmark-slash')
    } else {
      Store.saveBookmark(data.libro_slug, data.capitulo, targetVerse)
      updateBookmarkBtn(targetVerse)
      verses.forEach(v => v.classList.remove('bookmarked'))
      const target = content.querySelector(`[data-verse="${targetVerse}"]`)
      if (target) target.classList.add('bookmarked')
      toast('Separador guardado', 'fa-bookmark')
    }
  }

  function updateBookmarkBtn(verse) {
    const btn = $('bookmarkBtn')
    const label = $('bookmarkLabel')
    if (verse) {
      label.textContent = `v.${verse}`
      btn.classList.add('active')
    } else {
      label.textContent = 'Marcar'
      btn.classList.remove('active')
    }
  }

  let _finishing = false
  function finishReading() {
    if (_finishing) return
    _finishing = true
    $('btnFinishReading').disabled = true
    const s = Store.updateStreak()
    Store.completeChapter(currentBookSlug, currentChapterNum)
    Store.clearBookmark()
    AudioFX.complete()
    toast('Cap&iacute;tulo completado', 'fa-check-circle')
    // Check badges after chapter completion
    if (window.Badges) {
      const newBadges = Badges.checkAll()
      if (newBadges.length > 0) AudioFX.badge()
      else AudioFX.streak()
    }
    showReflection()
    setTimeout(() => { _finishing = false }, 1000)
  }

  // --- Reflection ---

  function showReflection() {
    const data = currentChapterData
    if (!data) { renderHome(); return }

    const chapterLabel = `${API.getBookTitle(data.libro_slug)} ${data.capitulo}`
    $('reflectionTitle').textContent = chapterLabel
    $('reflectionChapter').textContent = chapterLabel

    $('reflectionCards').innerHTML = REFLECTION_QUESTIONS.map((q, i) => `
      <div class="reflection-card" data-q="${i}">
        <div class="question-text">${q}</div>
        <textarea placeholder="Escribe aquí tus pensamientos... (opcional)"></textarea>
        <div class="reflection-actions">
          <button class="btn-skip">Omitir</button>
          <button class="btn-save-reflection">Guardar</button>
        </div>
      </div>
    `).join('')

    // Bind card actions
    $('reflectionCards').querySelectorAll('.reflection-card').forEach((card, idx) => {
      const textarea = card.querySelector('textarea')
      const skipBtn = card.querySelector('.btn-skip')
      const saveBtn = card.querySelector('.btn-save-reflection')

      skipBtn.addEventListener('click', () => {
        card.style.display = 'none'
      })

      saveBtn.addEventListener('click', () => {
        const text = textarea.value.trim()
        if (text) {
          Store.saveReflection(`${data.libro_slug}/${data.capitulo}`, idx, text)
          toast('Reflexi&oacute;n guardada', 'fa-pen-to-square')
        }
        card.style.display = 'none'
      })
    })

    show('screen-reflection')
    pushScreenState('screen-reflection')
  }

  function finishReflection() {
    showResults()
  }

  // --- Results ---

  function showResults() {
    const streak = Store.getStreak()
    const progress = Store.getProgress()
    const data = currentChapterData

    $('resultsTitle').textContent = '¡Capítulo Completado!'
    $('resultsSubtitle').textContent = data ? `${API.getBookTitle(data.libro_slug)} ${data.capitulo}` : ''
    $('newStreak').textContent = streak.currentStreak

    const next = getNextChapter(progress)
    if (next) {
      $('btnContinue').innerHTML = `<i class="fa-solid fa-arrow-right"></i> Siguiente: ${API.getBookTitle(next.book)} ${next.chapter}`
      $('btnContinue').onclick = async () => {
        currentBookSlug = next.book
        currentChapterNum = next.chapter
        progress.currentBook = next.book
        progress.currentChapter = next.chapter
        Store.saveProgress(progress)
        await startReading()
      }
      $('btnContinue').disabled = false
    } else {
      $('btnContinue').innerHTML = '<i class="fa-solid fa-trophy"></i> Todos los cap&iacute;tulos completados'
      $('btnContinue').disabled = true
    }

    show('screen-results')
    pushScreenState('screen-results')
  }

  function getNextChapter(progress) {
    const order = API.getBookOrder()
    const counts = API.getChapterCounts()
    const book = progress.currentBook
    const chapter = progress.currentChapter

    if (chapter < (counts[book] || 0)) {
      return { book, chapter: chapter + 1 }
    }
    const idx = order.indexOf(book)
    if (idx >= 0 && idx < order.length - 1) {
      return { book: order[idx + 1], chapter: 1 }
    }
    return null
  }

  // --- Journal ---

  function showJournalEditModal(chapterKey, timestamp, currentText) {
    const existing = document.getElementById('journalEditModal')
    if (existing) existing.remove()

    const overlay = document.createElement('div')
    overlay.id = 'journalEditModal'
    overlay.className = 'journal-edit-overlay'
    const content = document.createElement('div')
    content.className = 'journal-edit-content'
    content.innerHTML = `
      <div class="journal-edit-title">Editar reflexión</div>
      <textarea class="journal-edit-textarea" rows="5"></textarea>
      <div class="journal-edit-actions">
        <button class="journal-edit-cancel">Cancelar</button>
        <button class="journal-edit-save">Guardar</button>
      </div>
    `
    content.querySelector('textarea').value = currentText
    overlay.appendChild(content)

    document.getElementById('app').appendChild(overlay)
    overlay.style.display = 'flex'

    const textarea = overlay.querySelector('textarea')
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)

    overlay.querySelector('.journal-edit-cancel').onclick = () => overlay.remove()
    overlay.querySelector('.journal-edit-save').onclick = () => {
      const newText = textarea.value.trim()
      if (!newText) return
      Store.editReflection(chapterKey, timestamp, newText)
      overlay.remove()
      openJournal()
      toast('Reflexión actualizada', 'fa-pen-to-square')
    }

    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove() }

    const keydown = (e) => { if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', keydown) } }
    document.addEventListener('keydown', keydown)
  }

  function openJournal() {
    const reflections = Store.getAllReflections()
    if (reflections.length === 0) {
      $('journalList').innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px 0;"><i class="fa-regular fa-pen-to-square"></i> A&uacute;n no has escrito ninguna reflexi&oacute;n. Lee un cap&iacute;tulo y comparte tus pensamientos.</p>'
    } else {
      $('journalList').innerHTML = reflections.map(r => {
        const [slug, ch] = r.chapterKey.split('/')
        const label = `${API.getBookTitle(slug)} ${ch}`
        const qText = REFLECTION_QUESTIONS[r.questionIndex] || ''
        return `<div class="journal-entry" data-key="${r.chapterKey}" data-ts="${r.timestamp}">
          <div class="entry-header">
            <span class="entry-title">${label}</span>
            <span>${r.date}</span>
          </div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:6px;">${qText}</div>
          <div class="entry-answer">${r.text}</div>
          <div class="journal-entry-actions">
            <button class="journal-edit-btn" title="Editar"><i class="fa-solid fa-pen"></i> Editar</button>
            <button class="journal-delete-btn" title="Eliminar"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        </div>`
      }).join('')

      // Bind edit buttons
      $('journalList').querySelectorAll('.journal-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const entry = btn.closest('.journal-entry')
          const key = entry.dataset.key
          const ts = parseInt(entry.dataset.ts)
          const currentText = entry.querySelector('.entry-answer').textContent
          showJournalEditModal(key, ts, currentText)
        })
      })

      // Bind delete buttons
      $('journalList').querySelectorAll('.journal-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation()
          const entry = btn.closest('.journal-entry')
          const key = entry.dataset.key
          const ts = parseInt(entry.dataset.ts)
          if (confirm('¿Eliminar esta reflexión?')) {
            Store.deleteReflection(key, ts)
            openJournal()
            toast('Reflexión eliminada', 'fa-trash-can')
          }
        })
      })
    }
    show('screen-journal')
    pushScreenState('screen-journal')
  }

  // --- Init ---

  document.addEventListener('DOMContentLoaded', () => {
    init()

    $('btnRead').addEventListener('click', () => startReading())
    $('currentBook').addEventListener('click', openModal)
    $('modalClose').addEventListener('click', closeModal)
    $('modalOverlay').addEventListener('click', e => { if (e.target === $('modalOverlay')) closeModal() })
    $('btnBackReading').addEventListener('click', () => renderHome())
    $('btnFinishReading').addEventListener('click', finishReading)
    $('btnFinishReflection').addEventListener('click', finishReflection)
    $('btnContinue').addEventListener('click', () => {}) // handler set dynamically
    $('btnHome').addEventListener('click', renderHome)
    $('btnJournal').addEventListener('click', openJournal)
    $('btnJournalBack').addEventListener('click', renderHome)

    $('btnDarkMode').addEventListener('click', toggleDarkMode)
    $('btnDarkModeReading').addEventListener('click', toggleDarkMode)
    $('btnFontUp').addEventListener('click', () => adjustFontSize(2))
    $('btnFontDown').addEventListener('click', () => adjustFontSize(-2))
    $('btnShare').addEventListener('click', shareChapter)
    $('btnShareReading').addEventListener('click', shareChapter)
    $('btnInstall').addEventListener('click', installApp)

    $('btnStudy').addEventListener('click', () => {
      if (window.Highlights) Highlights.openStudyView('highlights')
    })

    // Sound toggle
    const soundBtn = $('btnSound')
    if (soundBtn) {
      soundBtn.innerHTML = AudioFX.isMuted() ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>'
      soundBtn.addEventListener('click', () => {
        const nowOn = AudioFX.toggle()
        soundBtn.innerHTML = nowOn ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>'
        toast(nowOn ? 'Sonido activado' : 'Sonido silenciado', nowOn ? 'fa-volume-high' : 'fa-volume-xmark')
      })
    }
  })
})()
