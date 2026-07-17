;(function() {
  const STREAK_BADGES = [
    { id: 'streak_3',    name: 'Barra de Hierro',       days: 3,  icon: 'fa-link',         desc: '3 días de racha' },
    { id: 'streak_7',    name: 'Fe en Cada Paso',       days: 7,  icon: 'fa-shoe-prints',  desc: '7 días de racha' },
    { id: 'streak_14',   name: 'Liahona',               days: 14, icon: 'fa-compass',      desc: '14 días de racha' },
    { id: 'streak_30',   name: 'Arco de Nefi',           days: 30, icon: 'fa-bow-arrow',    desc: '30 días de racha' },
    { id: 'streak_50',   name: 'Ejército de Helamán',    days: 50, icon: 'fa-shield-halved',desc: '50 días de racha' },
    { id: 'streak_100',  name: 'Aguas de Mormón',        days: 100,icon: 'fa-droplet',      desc: '100 días de racha' },
    { id: 'streak_200',  name: 'Tierra de Abundancia',   days: 200,icon: 'fa-tree',         desc: '200 días de racha' },
    { id: 'streak_365',  name: 'Árbol de la Vida',       days: 365,icon: 'fa-seedling',     desc: '365 días de racha' },
  ]

  const BOOK_BADGES = [
    { id: 'book_1-ne',     name: '1 Nefi' },
    { id: 'book_2-ne',     name: '2 Nefi' },
    { id: 'book_jacob',    name: 'Jacob' },
    { id: 'book_enos',     name: 'Enós' },
    { id: 'book_jarom',    name: 'Jarom' },
    { id: 'book_omni',     name: 'Omni' },
    { id: 'book_w-of-m',   name: 'Palabras de Mormón' },
    { id: 'book_mosiah',   name: 'Mosíah' },
    { id: 'book_alma',     name: 'Alma' },
    { id: 'book_hel',      name: 'Helamán' },
    { id: 'book_3-ne',     name: '3 Nefi' },
    { id: 'book_4-ne',     name: '4 Nefi' },
    { id: 'book_morm',     name: 'Mormón' },
    { id: 'book_ether',    name: 'Éter' },
    { id: 'book_moro',     name: 'Moroni' },
  ]

  const ALL_BADGES = [
    ...STREAK_BADGES.map(b => ({ ...b, type: 'streak' })),
    ...BOOK_BADGES.map(b => ({ ...b, type: 'book', icon: 'fa-book', desc: 'Completar el libro' }))
  ]

  function isUnlocked(badgeId) {
    const unlocked = Store.get('badges', [])
    return unlocked.includes(badgeId)
  }

  function unlock(badgeId) {
    const unlocked = Store.get('badges', [])
    if (unlocked.includes(badgeId)) return false
    unlocked.push(badgeId)
    Store.set('badges', unlocked)
    return true
  }

  function checkAll(silent) {
    const progress = Store.getProgress()
    const streak = Store.getStreak()
    const completed = progress.completedChapters || []
    const counts = API.getChapterCounts()
    const newlyUnlocked = []

    // Streak badges
    for (const b of STREAK_BADGES) {
      if (!isUnlocked(b.id) && streak.currentStreak >= b.days) {
        if (unlock(b.id)) newlyUnlocked.push(b)
      }
    }

    // Book badges — check if all chapters of a book are completed
    for (const b of BOOK_BADGES) {
      if (isUnlocked(b.id)) continue
      const slug = b.id.replace('book_', '')
      const totalChaps = counts[slug]
      if (!totalChaps) continue
      let allDone = true
      for (let ch = 1; ch <= totalChaps; ch++) {
        if (!completed.includes(`${slug}/${ch}`)) { allDone = false; break }
      }
      if (allDone) {
        if (unlock(b.id)) newlyUnlocked.push(b)
      }
    }

    // Fire events for newly unlocked
    for (const b of newlyUnlocked) {
      if (!silent) {
        AudioFX.badge()
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#d4a017', '#0d1b3e', '#e8c44a', '#fff3b0'] })
      }
      const newBadges = Store.get('newBadges', [])
      if (!newBadges.includes(b.id)) {
        newBadges.push(b.id)
        Store.set('newBadges', newBadges)
      }
      if (!silent) {
        setTimeout(() => {
          toast('¡Logro desbloqueado: ' + b.name + '!', 'fa-crown')
        }, 500)
      }
    }

    return newlyUnlocked
  }

  function clearNewFlag(badgeId) {
    const newBadges = Store.get('newBadges', [])
    Store.set('newBadges', newBadges.filter(id => id !== badgeId))
  }

  function clearAllNew() {
    Store.set('newBadges', [])
  }

  function getNewCount() {
    return Store.get('newBadges', []).length
  }

  function getUnlockedCount() {
    return Store.get('badges', []).length
  }

  function getTotalCount() {
    return ALL_BADGES.length
  }

  function renderHomeCard() {
    const container = document.getElementById('badgeHomeCard')
    if (!container) return

    const unlocked = Store.get('badges', [])
    const newBadges = Store.get('newBadges', [])
    const total = ALL_BADGES.length
    const count = unlocked.length

    // Show last 3 unlocked
    const recent = ALL_BADGES.filter(b => unlocked.includes(b.id)).slice(-3).reverse()

    container.innerHTML = `
      <div class="badge-home-header">
        <span><i class="fa-solid fa-crown" style="color:var(--gold)"></i> Logros</span>
        <span class="badge-home-count">${count}/${total}</span>
      </div>
      <div class="badge-home-grid">
        ${recent.length > 0 ? recent.map(b => `
          <div class="badge-home-item ${newBadges.includes(b.id) ? 'new' : ''}">
            <div class="badge-icon-small"><i class="fa-solid ${b.icon}"></i></div>
            <div class="badge-name-small">${b.name}</div>
          </div>
        `).join('') : '<div class="badge-empty">Aún no has ganado logros</div>'}
      </div>
      ${count > 0 ? `<div class="badge-home-footer">${getNewCount() > 0 ? '<span class="badge-new-dot">' + getNewCount() + ' nuevo' + (getNewCount() > 1 ? 's' : '') + '</span>' : ''}<span>Ver todos →</span></div>` : ''}
    `

    container.onclick = () => renderGridModal()
  }

  function renderGridModal() {
    const overlay = document.getElementById('badgeOverlay')
    const unlocked = Store.get('badges', [])
    const newBadges = Store.get('newBadges', [])

    // Group by type
    const streakHtml = STREAK_BADGES.map(b => badgeCard(b, unlocked.includes(b.id), newBadges.includes(b.id))).join('')
    const bookHtml = BOOK_BADGES.map(b => badgeCard(b, unlocked.includes(b.id), newBadges.includes(b.id))).join('')

    overlay.innerHTML = `
      <div class="badge-modal-content">
        <div class="badge-modal-header">
          <h2><i class="fa-solid fa-crown" style="color:var(--gold)"></i> Logros</h2>
          <span class="badge-modal-close" id="badgeModalClose"><i class="fa-solid fa-xmark"></i></span>
        </div>
        <div class="badge-modal-body">
          <div class="badge-section">
            <h3 class="badge-section-title"><i class="fa-solid fa-fire"></i> Racha</h3>
            <div class="badge-grid">${streakHtml}</div>
          </div>
          <div class="badge-section">
            <h3 class="badge-section-title"><i class="fa-solid fa-book"></i> Libros</h3>
            <div class="badge-grid">${bookHtml}</div>
          </div>
        </div>
      </div>
    `

    overlay.style.display = 'flex'
    document.getElementById('badgeModalClose').onclick = () => { overlay.style.display = 'none'; clearAllNew(); renderHomeCard() }
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.style.display = 'none'; clearAllNew(); renderHomeCard() } }
  }

  function badgeCard(badge, unlocked, isNew) {
    const type = badge.type || 'streak'
    const days = badge.days || ''
    return `<div class="badge-card ${unlocked ? 'unlocked' : 'locked'} ${isNew ? 'just-unlocked' : ''}">
      <div class="badge-icon ${unlocked ? '' : 'locked-icon'}"><i class="fa-solid ${badge.icon}"></i></div>
      <div class="badge-info">
        <div class="badge-name">${badge.name}</div>
        <div class="badge-desc">${type === 'streak' ? days + ' días de racha' : 'Libro completado'}</div>
      </div>
      ${isNew ? '<div class="badge-new-tag">NUEVO</div>' : ''}
    </div>`
  }

  window.Badges = {
    checkAll,
    renderHomeCard,
    renderGridModal,
    clearNewFlag,
    getNewCount,
    getUnlockedCount,
    getTotalCount,
    getAll: () => ALL_BADGES,
    isUnlocked
  }

  // Silent catch-up on first load (badges from existing streaks/books)
  setTimeout(() => Badges.checkAll(true), 1000)
})()
