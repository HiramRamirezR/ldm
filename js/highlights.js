;(function() {
  const COLORS = [
    { id: 'yellow',  light: '#fff3b0', dark: '#4a3f00' },
    { id: 'green',   light: '#b5e6b5', dark: '#143014' },
    { id: 'purple',  light: '#d4b8f5', dark: '#2d1a4a' },
    { id: 'pink',    light: '#fbc4c4', dark: '#3d0a22' },
    { id: 'blue',    light: '#b5d6f5', dark: '#0a1e3d' },
    { id: 'orange',  light: '#fdd9a0', dark: '#3d1c00' }
  ]

  const $ = id => document.getElementById(id)

  let currentHighlights = []
  let contextTarget = null
  let tagPendingHlId = null
  let tagPendingCallback = null
  let filterTag = null
  let threadEditMode = false

  function uid(prefix) {
    return (prefix || 'hl') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  }

  function ctx() {
    return window.__LDM || {}
  }

  // ========================
  // HIGHLIGHT RENDERING
  // ========================

  function getVerseRawText(verseEl) {
    const numSpan = verseEl.querySelector('.verse-num')
    const clone = verseEl.cloneNode(true)
    if (numSpan) {
      const sn = clone.querySelector('.verse-num')
      if (sn) sn.remove()
    }
    clone.querySelectorAll('mark.hl-inline').forEach(m => {
      m.replaceWith(m.textContent)
    })
    return clone.textContent || ''
  }

  function renderVerseHighlights(verseEl) {
    const verseNum = parseInt(verseEl.dataset.verse)
    const vh = currentHighlights.filter(h => h.verseNum === verseNum)

    // Always clean up full-verse highlight classes first
    COLORS.forEach(c => verseEl.classList.remove('hl-full-' + c.id))

    if (vh.length === 0) {
      // No highlights at all — restore original text without mark tags
      const numSpan = verseEl.querySelector('.verse-num')
      const raw = getVerseRawText(verseEl)
      const numLen = numSpan ? numSpan.textContent.length : 0
      const textOnly = raw.substring(numLen)
      verseEl.innerHTML = (numSpan ? numSpan.outerHTML : '') + escHtml(textOnly)
      return
    }

    const fullHl = vh.find(h => h.startOffset === null)
    if (fullHl) verseEl.classList.add('hl-full-' + fullHl.color)

    const textHls = vh.filter(h => h.startOffset !== null).sort((a, b) => a.startOffset - b.startOffset)
    if (textHls.length === 0) return

    const raw = getVerseRawText(verseEl)
    const numSpan = verseEl.querySelector('.verse-num')
    const numLen = numSpan ? numSpan.textContent.length : 0
    const textOnly = raw.substring(numLen)

    let html = numSpan ? numSpan.outerHTML : ''
    let pos = 0
    for (const hl of textHls) {
      if (hl.startOffset > pos) {
        html += escHtml(textOnly.substring(pos, hl.startOffset))
      }
      html += '<mark class="hl-inline hl-' + hl.color + '" data-hl-id="' + hl.id + '">' + escHtml(textOnly.substring(hl.startOffset, hl.endOffset)) + '</mark>'
      pos = hl.endOffset
    }
    if (pos < textOnly.length) {
      html += escHtml(textOnly.substring(pos))
    }
    verseEl.innerHTML = html
  }

  function escHtml(s) {
    const d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function applyHighlightsToChapter(data) {
    const c = ctx()
    currentHighlights = Store.getHighlights(c.bookSlug, c.chapterNum)
    const verses = document.querySelectorAll('.verse')
    verses.forEach(renderVerseHighlights)

    // Activity badge
    const hasAct = currentHighlights.length > 0 || Store.getReflections(c.bookSlug + '/' + c.chapterNum).length > 0
    const badge = $('chapterActivityBadge')
    if (badge) badge.style.display = hasAct ? '' : 'none'
  }

  function getHlColorById(id) {
    return COLORS.find(c => c.id === id) || COLORS[0]
  }

  // ========================
  // MENU
  // ========================

  function showMenu(type, verseEl, verseNum, extra) {
    const menu = $('hlMenu')
    const label = $('hlMenuLabel')
    const removeBtn = $('hlRemoveBtn')

    if (type === 'verse') {
      label.textContent = 'Subrayar versículo ' + verseNum
      contextTarget = { type: 'verse', verseEl, verseNum, startOffset: null, endOffset: null, text: getVerseRawText(verseEl).trim().substring(0, 200) }
    } else if (type === 'selection') {
      label.textContent = 'Subrayar selección'
      contextTarget = { type: 'selection', verseEl, verseNum, startOffset: extra.startOffset, endOffset: extra.endOffset, text: extra.text.substring(0, 200) }
    }

    // Check if already highlighted
    const existing = currentHighlights.filter(h =>
      h.verseNum === contextTarget.verseNum &&
      h.startOffset === contextTarget.startOffset
    )
    removeBtn.style.display = existing.length > 0 ? '' : 'none'
    removeBtn._hlId = existing.length > 0 ? existing[0].id : null

    menu.style.display = 'flex'
  }

  function hideMenu() {
    $('hlMenu').style.display = 'none'
    contextTarget = null
  }

  function applyHighlight(color) {
    if (!contextTarget) return
    const c = ctx()
    const { verseEl, verseNum, startOffset, endOffset, text, _portions } = contextTarget

    const targets = _portions || [{ verseEl, verseNum, startOffset, endOffset, text }]

    // Apply highlight for each target
    for (const t of targets) {
      const existing = currentHighlights.filter(h =>
        h.verseNum === t.verseNum && h.startOffset === t.startOffset
      )
      for (const ex of existing) {
        Store.deleteHighlight(c.bookSlug, c.chapterNum, ex.id)
      }

      const hl = {
        id: uid('hl'),
        verseNum: t.verseNum,
        startOffset: t.startOffset,
        endOffset: t.endOffset,
        text: t.text,
        color,
        tags: [],
        timestamp: Date.now()
      }

      Store.saveHighlight(c.bookSlug, c.chapterNum, hl)
    }

    currentHighlights = Store.getHighlights(c.bookSlug, c.chapterNum)
    // Re-render all affected verses
    const rendered = new Set()
    for (const t of targets) {
      if (!rendered.has(t.verseEl)) {
        renderVerseHighlights(t.verseEl)
        rendered.add(t.verseEl)
      }
    }

    hideMenu()
    window.getSelection().removeAllRanges()

    tagPendingHlId = targets.length === 1 ? (Store.getHighlights(c.bookSlug, c.chapterNum).find(h => h.verseNum === targets[0].verseNum && h.startOffset === targets[0].startOffset)?.id) : null
    if (tagPendingHlId) {
      showTagPrompt(tagPendingHlId)
    } else {
      toast('Subrayado guardado (' + targets.length + ' versículos)', 'fa-highlighter')
    }
  }

  function removeHighlight(hlId) {
    if (!hlId) return
    const c = ctx()
    const hl = currentHighlights.find(h => h.id === hlId)
    if (!hl) return
    Store.deleteHighlight(c.bookSlug, c.chapterNum, hlId)
    currentHighlights = Store.getHighlights(c.bookSlug, c.chapterNum)

    // Re-render verse
    const verseEl = document.querySelector('.verse[data-verse="' + hl.verseNum + '"]')
    if (verseEl) renderVerseHighlights(verseEl)

    hideMenu()
    toast('Subrayado eliminado', 'fa-eraser')
  }

  // ========================
  // TAG PROMPT
  // ========================

  function showTagPrompt(hlId) {
    const modal = $('hlTagModal')
    const list = $('hlTagList')
    const input = $('hlTagInput')
    const doneBtn = $('hlTagDone')
    tagPendingHlId = hlId

    // Get current tags on this highlight
    const c = ctx()
    const allHls = Store.getHighlights(c.bookSlug, c.chapterNum)
    const hl = allHls.find(h => h.id === hlId)
    const currentTags = hl ? hl.tags : []

    const allTags = Store.getTags().tags
    list.innerHTML = allTags.map(t =>
      '<button class="tag-chip ' + (currentTags.includes(t.name) ? 'selected' : '') + '" data-tag="' + escAttr(t.name) + '" style="--tag-color:' + t.color + '">' +
        escHtml(t.name) +
      '</button>'
    ).join('')

    input.value = ''
    modal.style.display = 'flex'

    list.querySelectorAll('.tag-chip').forEach(btn => {
      btn.onclick = () => {
        btn.classList.toggle('selected')
      }
    })

    function closeTagModal() {
      modal.style.display = 'none'
      tagPendingHlId = null
      window.getSelection().removeAllRanges()
    }

    doneBtn.onclick = () => {
      const selected = Array.from(list.querySelectorAll('.tag-chip.selected')).map(b => b.dataset.tag)
      const newTag = input.value.trim()
      if (newTag && !selected.includes(newTag)) {
        selected.push(newTag)
        const tagColor = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
        Store.saveTag(newTag, tagColor)
      }

      const allHls2 = Store.getHighlights(c.bookSlug, c.chapterNum)
      const hl2 = allHls2.find(h => h.id === hlId)
      if (hl2) {
        hl2.tags = selected
        Store.saveHighlight(c.bookSlug, c.chapterNum, hl2)
        currentHighlights = Store.getHighlights(c.bookSlug, c.chapterNum)
      }

      closeTagModal()
      toast('Etiqueta' + (selected.length > 1 ? 's' : '') + ' guardada', 'fa-tag')
    }
  }

  // ========================
  // TEXT SELECTION
  // ========================

  let lastTapTime = 0
  let lastTapVerse = null

  function initTextSelection() {
    const versesEl = $('verses')
    // Prevent native context menu on verses
    versesEl.addEventListener('contextmenu', e => e.preventDefault())

    // Selection change for both mobile and desktop
    document.addEventListener('selectionchange', onSelectionChange)

    // Desktop: mouseup to catch selection immediately
    versesEl.addEventListener('mouseup', onMouseUp)

    // Mobile: touchend to catch text selection immediately after gesture ends
    versesEl.addEventListener('touchend', onTouchEnd)

    // Double-tap tracking (using both touch and click)
    let touchTapTime = 0
    let touchTapVerse = null
    versesEl.addEventListener('touchstart', (e) => {
      const verse = e.target.closest('.verse')
      if (!verse) return
      const now = Date.now()
      if (touchTapVerse === verse && now - touchTapTime < 350) {
        // Double-tap on same verse (mobile)
        clearTimeout(selDebounce)
        window.getSelection().removeAllRanges()
        const vNum = parseInt(verse.dataset.verse)
        showMenu('verse', verse, vNum)
        touchTapTime = 0
        touchTapVerse = null
        return
      }
      touchTapTime = now
      touchTapVerse = verse
    }, { passive: true })

    versesEl.addEventListener('click', (e) => {
      const verse = e.target.closest('.verse')
      if (!verse) return
      const now = Date.now()
      if (lastTapVerse === verse && now - lastTapTime < 350) {
        // Double-click on same verse (desktop)
        clearTimeout(selDebounce)
        window.getSelection().removeAllRanges()
        const vNum = parseInt(verse.dataset.verse)
        showMenu('verse', verse, vNum)
        lastTapTime = 0
        lastTapVerse = null
        return
      }
      lastTapTime = now
      lastTapVerse = verse
    })

    // Desktop: double-click also works
    versesEl.addEventListener('dblclick', (e) => {
      const verse = e.target.closest('.verse')
      if (!verse) return
      clearTimeout(selDebounce)
      window.getSelection().removeAllRanges()
      const vNum = parseInt(verse.dataset.verse)
      showMenu('verse', verse, vNum)
    })
  }

  function onMouseUp() {
    const sel = window.getSelection()
    if (sel && !sel.isCollapsed && sel.toString().trim()) {
      const verseEl = sel.anchorNode?.closest?.('.verse') || sel.focusNode?.closest?.('.verse')
      if (verseEl && document.getElementById('verses')?.contains(verseEl)) {
        clearTimeout(selDebounce)
        handleTextSelection(sel)
      }
    }
  }

  function onTouchEnd() {
    // On mobile, check for selection immediately after touch ends
    setTimeout(() => {
      const sel = window.getSelection()
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        const verseEl = sel.anchorNode?.closest?.('.verse') || sel.focusNode?.closest?.('.verse')
        if (verseEl && document.getElementById('verses')?.contains(verseEl)) {
          if ($('hlMenu').style.display === 'flex') return
          if ($('hlTagModal').style.display === 'flex') return
          clearTimeout(selDebounce)
          handleTextSelection(sel)
        }
      }
    }, 50)
  }

  let selDebounce = null
  function onSelectionChange() {
    clearTimeout(selDebounce)

    selDebounce = setTimeout(() => {
      if ($('hlMenu').style.display === 'flex') return
      if ($('hlTagModal').style.display === 'flex') return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || !sel.toString().trim()) return

      const verseEl = sel.anchorNode?.closest?.('.verse') || sel.focusNode?.closest?.('.verse')
      if (!verseEl) return
      if (!document.getElementById('verses')?.contains(verseEl)) return

      handleTextSelection(sel)
    }, 100)
  }

  function handleTextSelection(sel) {
    const range = sel.getRangeAt(0)

    // Collect all verses touched by the selection
    const versesContainer = document.getElementById('verses')
    if (!versesContainer) return
    const allVerses = Array.from(versesContainer.querySelectorAll('.verse'))
    const startVerse = range.startContainer.closest?.('.verse')
    const endVerse = range.endContainer.closest?.('.verse')
    if (!startVerse || !endVerse) return

    const startIdx = allVerses.indexOf(startVerse)
    const endIdx = allVerses.indexOf(endVerse)
    if (startIdx === -1 || endIdx === -1) return

    const involved = allVerses.slice(Math.min(startIdx, endIdx), Math.max(startIdx, endIdx) + 1)

    const fullSelectedText = sel.toString().trim()
    if (!fullSelectedText) return

    // Compute selected portion per verse
    const portions = []
    let searchPos = 0

    for (const verseEl of involved) {
      const vNum = parseInt(verseEl.dataset.verse)
      const raw = getVerseRawText(verseEl)
      const numSpan = verseEl.querySelector('.verse-num')
      const numLen = numSpan ? numSpan.textContent.length : 0
      const textOnly = raw.substring(numLen)

      // Find the portion of fullSelectedText that falls within this verse
      // by searching from where we left off
      const remaining = fullSelectedText.substring(searchPos)
      if (!remaining) break

      const idx = textOnly.indexOf(remaining)
      if (idx >= 0) {
        // The entire remaining text is within this verse
        portions.push({
          verseEl,
          verseNum: vNum,
          startOffset: idx,
          endOffset: idx + remaining.length,
          text: remaining
        })
        break
      }

      // Partial: find overlap
      // The selected text starts somewhere in this verse
      // Find the longest prefix of remaining that matches the end of textOnly
      let overlapLen = 0
      for (let i = Math.min(remaining.length, textOnly.length); i >= 0; i--) {
        const test = remaining.substring(0, i)
        if (textOnly.endsWith(test) || textOnly.indexOf(test) >= 0) {
          const foundIdx = textOnly.indexOf(test)
          if (foundIdx >= 0) {
            overlapLen = i
            portions.push({
              verseEl,
              verseNum: vNum,
              startOffset: foundIdx,
              endOffset: foundIdx + i,
              text: test
            })
            break
          }
        }
      }
      if (overlapLen === 0) break
      searchPos += overlapLen
    }

    if (portions.length === 0) return

    hideMenu()
    sel.removeAllRanges()

    if (portions.length === 1) {
      const p = portions[0]
      showMenu('selection', p.verseEl, p.verseNum, {
        startOffset: p.startOffset,
        endOffset: p.endOffset,
        text: p.text
      })
      contextTarget._portions = null
    } else {
      showMenu('selection', portions[0].verseEl, portions[0].verseNum, {
        startOffset: portions[0].startOffset,
        endOffset: portions[0].endOffset,
        text: portions.map(p => p.text).join(' ')
      })
      contextTarget._portions = portions
    }
  }

  // ========================
  // TAG ON VERSE (tap on highlighted verse to add/remove tags)
  // ========================

  function initTagOnTap() {
    const versesEl = $('verses')
    versesEl.addEventListener('click', (e) => {
      if ($('hlMenu').style.display === 'flex') return
      if ($('hlTagModal').style.display === 'flex') return

      // Don't open tag prompt if there's an active text selection
      const activeSel = window.getSelection()
      if (activeSel && !activeSel.isCollapsed && activeSel.toString().trim()) {
        const inVerse = activeSel.anchorNode?.closest?.('.verse')
        if (inVerse && document.getElementById('verses')?.contains(inVerse)) return
      }

      // Tap on verse number → full-verse highlight menu
      const verseNumEl = e.target.closest('.verse-num')
      if (verseNumEl) {
        const verse = verseNumEl.closest('.verse')
        if (verse) {
          const vNum = parseInt(verse.dataset.verse)
          showMenu('verse', verse, vNum)
        }
        return
      }

      const mark = e.target.closest('mark.hl-inline')
      if (mark) {
        const hlId = mark.dataset.hlId
        if (hlId) showTagPrompt(hlId)
        return
      }
      // Tap on already-highlighted verse → show color menu (with Quitar)
      const verse = e.target.closest('.verse')
      if (!verse) return
      const vNum = parseInt(verse.dataset.verse)
      const fullHl = currentHighlights.find(h => h.verseNum === vNum && h.startOffset === null)
      if (!fullHl) return
      showMenu('verse', verse, vNum)
    })
  }

  // ========================
  // STUDY VIEW
  // ========================

  function openStudyView(tab) {
    filterTag = null
    renderStudyView(tab || 'highlights')
    show('screen-study')
    history.pushState({ screen: 'screen-study' }, '')
  }

  function renderStudyView(tab) {
    const tabs = $('studyTabs')
    tabs.querySelectorAll('.study-tab').forEach(t => t.classList.remove('active'))
    const activeTab = tabs.querySelector('[data-tab="' + tab + '"]')
    if (activeTab) activeTab.classList.add('active')

    if (tab === 'highlights') renderHighlightsList()
    else renderThreadsList()
  }

  function renderHighlightsList(tagFilter) {
    const list = $('studyList')
    const tagContainer = $('studyTags')
    filterTag = tagFilter || null

    const all = Store.getAllHighlights()
    const allTags = Store.getTags().tags

    // Count tags
    const tagCounts = {}
    for (const hl of all) {
      for (const t of hl.tags) {
        tagCounts[t] = (tagCounts[t] || 0) + 1
      }
    }

    // Render tag filters
    tagContainer.innerHTML = '<button class="tag-chip ' + (!filterTag ? 'selected' : '') + '" data-tag="">Todas</button>' +
      allTags.map(t =>
        '<button class="tag-chip ' + (filterTag === t.name ? 'selected' : '') + '" data-tag="' + escAttr(t.name) + '" style="--tag-color:' + t.color + '">' +
          escHtml(t.name) + ' (' + (tagCounts[t.name] || 0) + ')' +
        '</button>'
      ).join('')

    tagContainer.querySelectorAll('.tag-chip').forEach(btn => {
      btn.onclick = () => {
        renderHighlightsList(btn.dataset.tag || null)
      }
    })

    // Filter
    let filtered = filterTag ? all.filter(h => h.tags.includes(filterTag)) : all

    if (filtered.length === 0) {
      list.innerHTML = '<div class="study-empty"><i class="fa-regular fa-highlighter"></i><p>Aún no has subrayado nada. Comienza a leer y subraya versículos que te llamen la atención.</p></div>'
      return
    }

    list.innerHTML = filtered.map(hl => {
      const ref = API.getBookTitle(hl.bookSlug) + ' ' + hl.chapter + ', v.' + hl.verseNum
      const color = getHlColorById(hl.color)
      return '<div class="study-item" data-hl-id="' + hl.id + '" data-book="' + hl.bookSlug + '" data-chapter="' + hl.chapter + '" data-verse="' + hl.verseNum + '">' +
        '<div class="study-item-color" style="background:' + color.light + ';border-left:4px solid ' + color.light + '"></div>' +
        '<div class="study-item-body">' +
          '<div class="study-item-ref">' + escHtml(ref) + '</div>' +
          '<div class="study-item-text">"' + escHtml(hl.text) + '"</div>' +
          '<div class="study-item-tags">' +
            hl.tags.map(t => {
              const tagObj = allTags.find(at => at.name === t)
              return '<span class="tag-chip mini" style="--tag-color:' + (tagObj ? tagObj.color : '#888') + '">' + escHtml(t) + '</span>'
            }).join('') +
          '</div>' +
          '<div class="study-item-actions">' +
            '<button class="study-tag-btn" data-hl-id="' + hl.id + '" title="Editar etiquetas"><i class="fa-solid fa-tag"></i></button>' +
            '<button class="study-hl-delete-btn" data-hl-id="' + hl.id + '" title="Eliminar subrayado"><i class="fa-solid fa-trash-can"></i></button>' +
          '</div>' +
        '</div>' +
        '<button class="study-item-thread-btn" data-hl-id="' + hl.id + '" title="Agregar a hilo"><i class="fa-solid fa-link"></i></button>' +
      '</div>'
    }).join('')

    // Tap to navigate
    list.querySelectorAll('.study-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.study-item-thread-btn')) return
        if (e.target.closest('.study-item-actions')) return
        const slug = item.dataset.book
        const chapter = parseInt(item.dataset.chapter)
        const verse = parseInt(item.dataset.verse)
        navigateToHighlight(slug, chapter, verse)
      })
    })

    // Thread button
    list.querySelectorAll('.study-item-thread-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const hlId = btn.dataset.hlId
        showThreadSelector(hlId)
      })
    })

    // Edit tags button
    list.querySelectorAll('.study-tag-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const hlId = btn.dataset.hlId
        showTagPrompt(hlId)
      })
    })

    // Delete highlight button
    list.querySelectorAll('.study-hl-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation()
        const hlId = btn.dataset.hlId
        if (!confirm('¿Eliminar este subrayado?')) return
        const c = ctx()
        // Find which book/chapter this highlight belongs to
        const all = Store.getAllHighlights()
        const hl = all.find(h => h.id === hlId)
        if (hl) {
          Store.deleteHighlight(hl.bookSlug, hl.chapter, hlId)
          renderHighlightsList(filterTag)
          toast('Subrayado eliminado', 'fa-trash-can')
        }
      })
    })
  }

  function navigateToHighlight(slug, chapter, verse) {
    const progress = Store.getProgress()
    progress.currentBook = slug
    progress.currentChapter = chapter
    Store.saveProgress(progress)
    window.__LDM.bookSlug = slug
    window.__LDM.chapterNum = chapter
    show('screen-splash')
    // Trigger reading via global function
    if (window.startReadingAt) {
      window.startReadingAt(verse)
    }
  }

  // ========================
  // THREADS
  // ========================

  function showThreadSelector(hlId) {
    const threads = Store.getThreads()
    if (threads.length === 0) {
      // Create new thread
      const name = prompt('Nombre del hilo:')
      if (!name) return
      const thread = {
        id: uid('thread'),
        name: name.trim(),
        entries: [{ highlightId: hlId, order: 0, note: '' }],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      Store.saveThread(thread)
      toast('Hilo creado', 'fa-link')
      return
    }

    // Show thread selector modal
    const modal = $('hlTagModal')
    const list = $('hlTagList')
    const input = $('hlTagInput')
    const doneBtn = $('hlTagDone')

    tagPendingHlId = hlId

    list.innerHTML = threads.map(t =>
      '<div class="thread-select-item" data-thread-id="' + t.id + '">' +
        '<span>' + escHtml(t.name) + '</span>' +
        '<span class="thread-count">' + t.entries.length + ' subrayados</span>' +
      '</div>'
    ).join('') +
    '<div class="thread-select-item new-thread" data-new="1">' +
      '<span><i class="fa-solid fa-plus"></i> Nuevo hilo</span>' +
    '</div>'

    $('hlTagModalTitle').textContent = 'Agregar a hilo'
    input.style.display = 'none'
    modal.style.display = 'flex'

    list.querySelectorAll('.thread-select-item').forEach(item => {
      item.onclick = () => {
        const tid = item.dataset.threadId
        if (tid) {
          const threads2 = Store.getThreads()
          const t = threads2.find(th => th.id === tid)
          if (t) {
            if (!t.entries.find(e => e.highlightId === hlId)) {
              t.entries.push({ highlightId: hlId, order: t.entries.length, note: '' })
              t.updatedAt = Date.now()
              Store.saveThread(t)
              toast('Agregado a ' + t.name, 'fa-link')
            } else {
              toast('Ya está en este hilo', 'fa-info-circle')
            }
          }
        } else {
          const name = prompt('Nombre del hilo:')
          if (!name) return
          const thread = {
            id: uid('thread'),
            name: name.trim(),
            entries: [{ highlightId: hlId, order: 0, note: '' }],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          Store.saveThread(thread)
          toast('Hilo creado', 'fa-link')
        }
        modal.style.display = 'none'
        input.style.display = ''
        $('hlTagModalTitle').textContent = 'Etiquetas'
        tagPendingHlId = null
      }
    })

    doneBtn.onclick = () => {
      modal.style.display = 'none'
      input.style.display = ''
      $('hlTagModalTitle').textContent = 'Etiquetas'
      tagPendingHlId = null
    }
  }

  function renderThreadsList() {
    const list = $('studyList')
    const tagContainer = $('studyTags')
    tagContainer.innerHTML = ''

    const threads = Store.getThreads()

    // Auto threads by tag
    const all = Store.getAllHighlights()
    const tagGroups = {}
    for (const hl of all) {
      for (const t of hl.tags) {
        if (!tagGroups[t]) tagGroups[t] = []
        tagGroups[t].push(hl)
      }
    }

    // Auto threads (tags with >= 2 highlights)
    const autoThreads = Object.entries(tagGroups).filter(([,hls]) => hls.length >= 2)
      .sort((a, b) => b[1].length - a[1].length)

    let html = ''

    if (threads.length > 0) {
      html += '<div class="thread-section"><h3 class="thread-section-title"><i class="fa-solid fa-link"></i> Mis hilos</h3></div>'
      html += threads.map(t => {
        const entryInfo = t.entries.map(e => {
          // Find highlight by id across all
          const allHls = Store.getAllHighlights()
          const hl = allHls.find(h => h.id === e.highlightId)
          return hl ? API.getBookTitle(hl.bookSlug) + ' ' + hl.chapter + ', v.' + hl.verseNum : '?'
        })
        return '<div class="thread-card" data-thread-id="' + t.id + '">' +
          '<div class="thread-card-name">' + escHtml(t.name) + '</div>' +
          '<div class="thread-card-count">' + t.entries.length + ' escrituras</div>' +
          '<div class="thread-card-preview">' + entryInfo.join(' → ') + '</div>' +
        '</div>'
      }).join('')
    }

    if (autoThreads.length > 0) {
      html += '<div class="thread-section"><h3 class="thread-section-title"><i class="fa-solid fa-hashtag"></i> Hilos automáticos por etiqueta</h3></div>'
      html += autoThreads.map(([tagName, hls]) => {
        // Sort canonically
        const order = API.getBookOrder()
        hls.sort((a, b) => {
          const ai = order.indexOf(a.bookSlug)
          const bi = order.indexOf(b.bookSlug)
          if (ai !== bi) return ai - bi
          if (a.chapter !== b.chapter) return a.chapter - b.chapter
          return a.verseNum - b.verseNum
        })
        const tagObj = Store.getTags().tags.find(t => t.name === tagName)
        return '<div class="thread-card auto" data-tag="' + escAttr(tagName) + '">' +
          '<div class="thread-card-name" style="--tag-color:' + (tagObj ? tagObj.color : '#888') + '">#' + escHtml(tagName) + '</div>' +
          '<div class="thread-card-count">' + hls.length + ' escrituras</div>' +
          '<div class="thread-card-preview">' +
            hls.map(hl => API.getBookTitle(hl.bookSlug) + ' ' + hl.chapter + ':' + hl.verseNum).join(' → ') +
          '</div>' +
        '</div>'
      }).join('')
    }

    if (!html) {
      html = '<div class="study-empty"><i class="fa-solid fa-link"></i><p>Aún no hay hilos. Subraya varias escrituras con una misma etiqueta para ver hilos automáticos, o conéctalas manualmente.</p></div>'
    }

    list.innerHTML = html

    // Tap manual thread
    list.querySelectorAll('.thread-card:not(.auto)').forEach(card => {
      card.addEventListener('click', () => {
        const tid = card.dataset.threadId
        openThreadView(tid)
      })
    })

    // Tap auto thread
    list.querySelectorAll('.thread-card.auto').forEach(card => {
      card.addEventListener('click', () => {
        const tag = card.dataset.tag
        openAutoThreadView(tag)
      })
    })
  }

  function openThreadView(threadId) {
    const threads = Store.getThreads()
    const thread = threads.find(t => t.id === threadId)
    if (!thread) return

    renderThreadView(thread)
  }

  function openAutoThreadView(tagName) {
    const all = Store.getAllHighlights()
    let hls = all.filter(h => h.tags.includes(tagName))
    const order = API.getBookOrder()
    hls.sort((a, b) => {
      const ai = order.indexOf(a.bookSlug)
      const bi = order.indexOf(b.bookSlug)
      if (ai !== bi) return ai - bi
      if (a.chapter !== b.chapter) return a.chapter - b.chapter
      return a.verseNum - b.verseNum
    })
    const tagObj = Store.getTags().tags.find(t => t.name === tagName)
    const thread = {
      id: 'auto_' + tagName,
      name: '#' + tagName + ' (automático)',
      isAuto: true,
      entries: hls.map((hl, i) => ({ highlightId: hl.id, order: i, note: '' }))
    }
    renderThreadView(thread)
  }

  function renderThreadView(thread) {
    const content = $('threadContent')
    const title = $('threadTitle')
    title.textContent = thread.name

    const allHls = Store.getAllHighlights()

    if (thread.entries.length === 0) {
      content.innerHTML = '<div class="study-empty"><p>Este hilo está vacío.</p></div>'
    } else {
      content.innerHTML = thread.entries.sort((a, b) => a.order - b.order).map((entry, idx) => {
        const hl = allHls.find(h => h.id === entry.highlightId)
        if (!hl) return ''
        const ref = API.getBookTitle(hl.bookSlug) + ' ' + hl.chapter + ', v.' + hl.verseNum
        const color = getHlColorById(hl.color)
        return '<div class="thread-entry" data-hl-id="' + hl.id + '" data-book="' + hl.bookSlug + '" data-chapter="' + hl.chapter + '" data-verse="' + hl.verseNum + '">' +
          '<div class="thread-entry-num">' + (idx + 1) + '</div>' +
          '<div class="thread-entry-body">' +
            '<div class="thread-entry-ref" style="border-left-color:' + color.light + '">' + escHtml(ref) + '</div>' +
            '<div class="thread-entry-text">"' + escHtml(hl.text) + '"</div>' +
            (entry.note ? '<div class="thread-entry-note"><i class="fa-solid fa-quote-left"></i> ' + escHtml(entry.note) + '</div>' : '') +
          '</div>' +
        '</div>'
      }).join('')
    }

    // Tap to navigate
    content.querySelectorAll('.thread-entry').forEach(item => {
      item.addEventListener('click', () => {
        const slug = item.dataset.book
        const chapter = parseInt(item.dataset.chapter)
        const verse = parseInt(item.dataset.verse)
        navigateToHighlight(slug, chapter, verse)
      })
    })

    show('screen-thread')
    history.pushState({ screen: 'screen-thread' }, '')
  }

  // ========================
  // EVENT BINDING
  // ========================

  function bindMenuEvents() {
    // Color buttons in menu
    document.querySelectorAll('#hlMenu .hl-color').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color
        applyHighlight(color)
      })
    })

    // Remove button
    $('hlRemoveBtn').addEventListener('click', () => {
      const hlId = $('hlRemoveBtn')._hlId
      removeHighlight(hlId)
    })

    // Menu close
    $('hlMenuClose').addEventListener('click', hideMenu)

    // Tag modal close on overlay
    $('hlTagModal').addEventListener('click', (e) => {
      if (e.target === $('hlTagModal')) {
        $('hlTagModal').style.display = 'none'
        $('hlTagModalTitle').textContent = 'Etiquetas'
        $('hlTagInput').style.display = ''
        tagPendingHlId = null
        window.getSelection().removeAllRanges()
      }
    })

    // Tag input enter
    $('hlTagInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        $('hlTagDone').click()
      }
    })
  }

  // ========================
  // INIT
  // ========================

  function init() {
    bindMenuEvents()
    initTextSelection()
    initTagOnTap()

    // Study tabs
    $('studyTabs').querySelectorAll('.study-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        renderStudyView(tab.dataset.tab)
      })
    })

    // Thread back
    $('btnThreadBack').addEventListener('click', () => {
      openStudyView('threads')
    })

    // Study back
    $('btnStudyBack').addEventListener('click', () => {
      show('screen-home')
    })
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init)
  } else {
    init()
  }

  // ========================
  // EXPOSED API
  // ========================

  window.Highlights = {
    applyHighlights: applyHighlightsToChapter,
    getCurrent: () => currentHighlights,
    openStudyView: openStudyView,
    openThreadView: openThreadView,
    renderStudyView: renderStudyView,
    showMenu: showMenu,
    hideMenu: hideMenu
  }

})()
