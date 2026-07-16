;(function() {
  const $ = id => document.getElementById(id)

  let currentChapterData = null
  let currentBookSlug = '1-ne'
  let currentChapterNum = 1
  const REFLECTION_QUESTIONS = [
    '¿Qué versículo de este capítulo te llamó más la atención y por qué?',
    '¿Qué aprendiste sobre Dios o sobre Jesucristo en este capítulo?',
    'Escribe un pensamiento, impresión o algo que quieras aplicar en tu vida después de esta lectura.'
  ]

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
    $(id).classList.add('active')
  }

  // --- Init & Home ---

  // --- Toast ---
  function toast(msg, icon) {
    const el = $('toast')
    el.innerHTML = `<i class="fa-solid ${icon || 'fa-check-circle'}"></i> ${msg}`
    el.classList.add('show')
    clearTimeout(el._hide)
    el._hide = setTimeout(() => el.classList.remove('show'), 2500)
  }

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
  function initSwipe() {
    const el = $('readingContent')
    el.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX }, { passive: true })
    el.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].screenX - touchStartX
      if (Math.abs(dx) < 50) return
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

    initSwipe()

    setTimeout(() => {
      show('screen-home')
      renderHome()
    }, 1200)
  }

  function renderHome() {
    const streak = Store.getStreak()
    const progress = Store.getProgress()

    $('streakCount').textContent = streak.currentStreak
    $('streakNumber').textContent = streak.currentStreak

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
        chapters.push({ num: i, done: isDone, current: isCurrent })
      }
      return `
        <div class="book-item" data-slug="${slug}">
          <div class="book-header" onclick="toggleBook(this)">
            <span class="book-name">${bookName} (${numChaps})</span>
            <span class="book-arrow"><i class="fa-solid fa-chevron-down"></i></span>
          </div>
          <div class="chapter-list">
            ${chapters.map(c => `
              <button class="chapter-chip ${c.done ? 'done' : ''} ${c.current ? 'current' : ''}" 
                      data-slug="${slug}" data-chapter="${c.num}">
                ${c.num}${c.done ? ' <i class="fa-solid fa-check"></i>' : ''}
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

  async function startReading(scrollToBookmark) {
    show('screen-splash')
    try {
      const data = await API.getChapter(currentBookSlug, currentChapterNum)
      currentChapterData = data
      Store.saveProgress(Store.getProgress())
      renderChapter(data, scrollToBookmark)
    } catch (err) {
      console.error(err)
      alert('Error al cargar el capítulo.')
      show('screen-home')
    }
  }

  let _swipeTimer = null
  function renderChapter(data, scrollToBookmark) {
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

    const content = $('readingContent')
    content.removeEventListener('scroll', updateReadProgress)
    content.addEventListener('scroll', updateReadProgress)
    updateReadProgress()

    $('btnFinishReading').disabled = false

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

  function finishReading() {
    const s = Store.updateStreak()
    Store.completeChapter(currentBookSlug, currentChapterNum)
    Store.clearBookmark()
    toast('Cap&iacute;tulo completado', 'fa-check-circle')
    showReflection()
  }

  // --- Reflection ---

  function showReflection() {
    const data = currentChapterData
    if (!data) { showHome(); return }

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

  function openJournal() {
    const reflections = Store.getAllReflections()
    if (reflections.length === 0) {
      $('journalList').innerHTML = '<p style="color: var(--text-light); text-align: center; padding: 40px 0;"><i class="fa-regular fa-pen-to-square"></i> A&uacute;n no has escrito ninguna reflexi&oacute;n. Lee un cap&iacute;tulo y comparte tus pensamientos.</p>'
    } else {
      $('journalList').innerHTML = reflections.map(r => {
        const [slug, ch] = r.chapterKey.split('/')
        const label = `${API.getBookTitle(slug)} ${ch}`
        const qText = REFLECTION_QUESTIONS[r.questionIndex] || ''
        return `<div class="journal-entry">
          <div class="entry-header">
            <span class="entry-title">${label}</span>
            <span>${r.date}</span>
          </div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:6px;">${qText}</div>
          <div class="entry-answer">${r.text}</div>
        </div>`
      }).join('')
    }
    show('screen-journal')
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
  })
})()
