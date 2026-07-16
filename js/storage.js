const Store = {
  _prefix: 'ldm_',

  get(key, def) {
    try {
      const v = localStorage.getItem(this._prefix + key)
      return v !== null ? JSON.parse(v) : def
    } catch { return def }
  },

  set(key, val) {
    localStorage.setItem(this._prefix + key, JSON.stringify(val))
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

  saveReflection(chapterKey, questionIndex, text) {
    const reflections = this.getReflections(chapterKey)
    reflections.push({
      questionIndex,
      text,
      date: dateKey(new Date()),
      timestamp: Date.now()
    })
    this.set(`reflections_${chapterKey}`, reflections)
  },

  getAllReflections() {
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
    return all.sort((a, b) => b.timestamp - a.timestamp)
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
