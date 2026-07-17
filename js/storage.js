const Store = {
  _prefix: 'ldm_',

  get(key, def) {
    try {
      const v = localStorage.getItem(this._prefix + key)
      return v !== null ? JSON.parse(v) : def
    } catch { return def }
  },

  set(key, val) {
    try {
      localStorage.setItem(this._prefix + key, JSON.stringify(val))
      if (Math.random() < 0.05) this._checkStorage()
    } catch (e) {
      console.warn('Storage quota exceeded o error al escribir:', key, e)
      toast('Almacenamiento lleno. Intenta borrar datos antiguos.', 'fa-triangle-exclamation')
    }
  },

  _checkStorage() {
    try {
      let total = 0
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(this._prefix)) {
          total += localStorage.getItem(k).length * 2
        }
      }
      const pct = total / (5 * 1024 * 1024) * 100
      if (pct > 80) console.warn('Storage al', Math.round(pct) + '%')
    } catch {}
  },

  getProgress() {
    return this.get('progress', {
      currentBook: '1-ne',
      currentChapter: 1,
      completedChapters: [],
      totalChapters: 239
    })
  },

  saveProgress(p) {
    this.set('progress', p)
  },

  completeChapter(bookSlug, chapter) {
    const p = this.getProgress()
    const key = `${bookSlug}/${chapter}`
    if (!p.completedChapters.includes(key)) {
      p.completedChapters.push(key)
      p.currentBook = bookSlug
      p.currentChapter = chapter
    }
    this.saveProgress(p)
    return p
  },

  getStreak() {
    return this.get('streak', {
      currentStreak: 0,
      longestStreak: 0,
      lastReadDate: null,
      todayDone: false,
      dates: []
    })
  },

  saveStreak(s) {
    this.set('streak', s)
  },

  updateStreak() {
    const s = this.getStreak()
    const today = dateKey(new Date())
    const yesterday = dateKey(new Date(Date.now() - 86400000))

    if (s.lastReadDate === today) {
      s.todayDone = true
    } else if (s.lastReadDate === yesterday) {
      s.currentStreak += 1
      s.lastReadDate = today
      s.todayDone = true
    } else if (s.lastReadDate !== today) {
      s.currentStreak = 1
      s.lastReadDate = today
      s.todayDone = true
    }

    if (s.currentStreak > s.longestStreak) {
      s.longestStreak = s.currentStreak
    }

    if (!s.dates) s.dates = []
    if (!s.dates.includes(today)) {
      s.dates.push(today)
    }

    this.saveStreak(s)
    return s
  },

  getWeekStatus() {
    const s = this.getStreak()
    const dates = s.dates || []
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = dateKey(d)
      days.push({
        label: dayNames[d.getDay()],
        date: key,
        isToday: i === 0,
        done: dates.includes(key)
      })
    }
    return days
  },

  getBookmark() {
    return this.get('bookmark', null)
  },

  saveBookmark(bookSlug, chapter, verse) {
    this.set('bookmark', { bookSlug, chapter, verse })
  },

  clearBookmark() {
    this.set('bookmark', null)
  },

  getReflections(chapterKey) {
    return this.get(`reflections_${chapterKey}`, [])
  },

  _refCache: null,

  _invalidateRefCache() {
    this._refCache = null
  },

  saveReflection(chapterKey, questionIndex, text) {
    const reflections = this.getReflections(chapterKey)
    reflections.push({
      questionIndex,
      text,
      date: dateKey(new Date()),
      timestamp: Date.now()
    })
    this.set(`reflections_${chapterKey}`, reflections)
    this._invalidateRefCache()
  },

  deleteReflection(chapterKey, timestamp) {
    const reflections = this.getReflections(chapterKey)
    this.set(`reflections_${chapterKey}`, reflections.filter(r => r.timestamp !== timestamp))
    this._invalidateRefCache()
  },

  editReflection(chapterKey, timestamp, newText) {
    const reflections = this.getReflections(chapterKey)
    const r = reflections.find(r => r.timestamp === timestamp)
    if (r) {
      r.text = newText
      r.editedAt = Date.now()
      this.set(`reflections_${chapterKey}`, reflections)
      this._invalidateRefCache()
    }
  },

  getAllReflections() {
    if (this._refCache) return this._refCache
    const all = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this._prefix + 'reflections_')) {
        const chapterKey = key.replace(this._prefix + 'reflections_', '')
        const entries = JSON.parse(localStorage.getItem(key))
        for (const e of entries) {
          all.push({ chapterKey, ...e })
        }
      }
    }
    this._refCache = all
    return all.sort((a, b) => b.timestamp - a.timestamp)
  },

  // --- Highlights ---

  getHighlights(bookSlug, chapter) {
    return this.get(`highlights_${bookSlug}/${chapter}`, [])
  },

  _hlCache: null,

  _invalidateHlCache() {
    this._hlCache = null
  },

  saveHighlight(bookSlug, chapter, hl) {
    const key = `highlights_${bookSlug}/${chapter}`
    const highlights = this.get(key, [])
    const idx = highlights.findIndex(h => h.id === hl.id)
    if (idx >= 0) highlights[idx] = hl
    else highlights.push(hl)
    this.set(key, highlights)
    this._invalidateHlCache()
    return hl
  },

  deleteHighlight(bookSlug, chapter, hlId) {
    const key = `highlights_${bookSlug}/${chapter}`
    this.set(key, this.get(key, []).filter(h => h.id !== hlId))
    this._invalidateHlCache()
  },

  getAllHighlights() {
    if (this._hlCache) return this._hlCache
    const all = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(this._prefix + 'highlights_')) {
        const chapterKey = key.replace(this._prefix + 'highlights_', '')
        const parts = chapterKey.split('/')
        const bookSlug = parts[0]
        const chapter = parseInt(parts[1])
        const entries = JSON.parse(localStorage.getItem(key))
        for (const e of entries) {
          all.push({ bookSlug, chapter, ...e })
        }
      }
    }
    this._hlCache = all
    return all.sort((a, b) => b.timestamp - a.timestamp)
  },

  chapterHasActivity(bookSlug, chapter) {
    const highlights = this.get(`highlights_${bookSlug}/${chapter}`, [])
    const reflections = this.getReflections(`${bookSlug}/${chapter}`)
    return highlights.length > 0 || reflections.length > 0
  },

  // --- Tags ---

  getTags() {
    return this.get('tags', { tags: [] })
  },

  saveTag(name, color) {
    const data = this.getTags()
    const existing = data.tags.find(t => t.name === name)
    if (existing) existing.color = color
    else data.tags.push({ name, color })
    this.set('tags', data)
  },

  deleteTag(name) {
    const data = this.getTags()
    data.tags = data.tags.filter(t => t.name !== name)
    this.set('tags', data)
  },

  // --- Threads ---

  getThreads() {
    return this.get('threads', [])
  },

  saveThread(thread) {
    const threads = this.getThreads()
    const idx = threads.findIndex(t => t.id === thread.id)
    if (idx >= 0) threads[idx] = thread
    else threads.push(thread)
    this.set('threads', threads)
    return thread
  },

  deleteThread(threadId) {
    this.set('threads', this.getThreads().filter(t => t.id !== threadId))
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// --- Shared UI utilities ---

function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
  const target = document.getElementById(id)
  if (target) target.classList.add('active')
}

function toast(msg, icon) {
  const el = document.getElementById('toast')
  if (!el) return
  el.innerHTML = '<i class="fa-solid ' + (icon || 'fa-check-circle') + '"></i> ' + msg
  el.classList.add('show')
  clearTimeout(el._hide)
  el._hide = setTimeout(() => el.classList.remove('show'), 2500)
}

// Escape key closes any open modal
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return
  const hlMenu = document.getElementById('hlMenu')
  if (hlMenu && hlMenu.style.display === 'flex') { hlMenu.style.display = 'none'; return }
  const tagModal = document.getElementById('hlTagModal')
  if (tagModal && tagModal.style.display === 'flex') {
    tagModal.style.display = 'none'
    const title = document.getElementById('hlTagModalTitle')
    if (title) title.textContent = 'Etiquetas'
    return
  }
  const overlay = document.getElementById('modalOverlay')
  if (overlay && overlay.classList.contains('active')) overlay.classList.remove('active')
})
