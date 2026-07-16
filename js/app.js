;(function() {
  const $ = id => document.getElementById(id)

  let currentChapterData = null
  let currentQuestions = []
  let currentQuestionIndex = 0
  let correctAnswers = 0
  let isAnswering = false
  let currentBookSlug = '1-ne'
  let currentChapterNum = 1
  let streakData = null
  let hasReadToday = false

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'))
    $(id).classList.add('active')
  }

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 6) return 'Buenas noches 🌙'
    if (h < 12) return '¡Buenos días! ☀️'
    if (h < 18) return '¡Buenas tardes! 🌤️'
    return '¡Buenas noches! 🌙'
  }

  function init() {
    show('screen-splash')
    streakData = Store.getStreak()
    const progress = Store.getProgress()
    currentBookSlug = progress.currentBook
    currentChapterNum = progress.currentChapter

    setTimeout(() => {
      show('screen-home')
      renderHome()
    }, 1200)
  }

  function renderHome() {
    const streak = Store.getStreak()
    const progress = Store.getProgress()

    $('greeting').textContent = getGreeting()
    $('streakCount').textContent = streak.currentStreak
    $('streakNumber').textContent = streak.currentStreak

    const weekDays = Store.getWeekStatus()
    $('weekBar').innerHTML = weekDays.map(d => `
      <div class="week-day">
        <div class="week-day-circle ${d.done ? 'done' : ''} ${d.isToday ? 'today' : ''}">
          ${d.done ? '🔥' : d.isToday ? '○' : '·'}
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
      $('btnReadText').textContent = 'Seguir Leyendo →'
    } else {
      $('btnReadText').textContent = 'Empezar Lectura de Hoy'
    }

    show('screen-home')
  }

  async function startReading() {
    show('screen-splash')
    try {
      const data = await API.getChapter(currentBookSlug, currentChapterNum)
      currentChapterData = data
      renderChapter(data)
    } catch (err) {
      console.error(err)
      alert('Error al cargar el capítulo. Verifica tu conexión.')
      show('screen-home')
    }
  }

  function renderChapter(data) {
    const title = data.titulo || `${API.getBookTitle(data.libro_slug)} ${data.capitulo}`
    $('chapterTitle').textContent = title

    if (data.sumario) {
      $('chapterSummary').textContent = data.sumario
      $('chapterSummary').style.display = 'block'
    } else {
      $('chapterSummary').style.display = 'none'
    }

    $('verses').innerHTML = data.versiculos.map(v => `
      <div class="verse">
        <span class="verse-num">${v.numero}</span>
        ${v.texto}
      </div>
    `).join('')

    $('readingProgress').style.width = '0%'
    show('screen-reading')

    const content = $('readingContent')
    content.removeEventListener('scroll', updateReadProgress)
    content.addEventListener('scroll', updateReadProgress)
    updateReadProgress()

    $('btnFinishReading').disabled = false
  }

  function updateReadProgress() {
    const el = $('readingContent')
    const scrollable = el.scrollHeight - el.clientHeight
    const scrolled = el.scrollTop
    const pct = scrollable > 0 ? Math.min(100, Math.round((scrolled / scrollable) * 100)) : 100
    $('readingProgress').style.width = pct + '%'
  }

  function finishReading() {
    const s = Store.updateStreak()
    streakData = s
    hasReadToday = true
    Store.completeChapter(currentBookSlug, currentChapterNum)
    generateAndStartQuiz()
  }

  function generateAndStartQuiz() {
    const data = currentChapterData
    if (!data) return

    const chapterKey = `${data.libro_slug}/${data.capitulo}`
    let questions = Store.getQuestions(chapterKey)

    if (!questions) {
      questions = generateQuestions(data)
      Store.saveQuestions(chapterKey, questions)
    }

    currentQuestions = questions
    currentQuestionIndex = 0
    correctAnswers = 0
    showQuizQuestion()
  }

  function generateQuestions(data) {
    const { sumario, versiculos } = data
    const questions = []

    // Question 1: based on summary
    if (sumario) {
      const parts = sumario.split(/ — |\. /).filter(s => s.trim().length > 10)
      if (parts.length >= 2) {
        const mainPart = parts[0].trim()
        questions.push({
          q: `¿Cuál fue el tema principal de ${data.titulo}?`,
          correct: mainPart,
          wrongs: generateWrongs(mainPart)
        })
      } else {
        questions.push({
          q: `¿De qué trata ${data.titulo}?`,
          correct: sumario.substring(0, 100),
          wrongs: generateWrongs(sumario.substring(0, 100))
        })
      }
    } else {
      questions.push(createGenericQuestion(data))
    }

    // Question 2: about a person
    const entities = extractEntities(versiculos)
    if (entities.length > 0) {
      const entity = entities[0]
      questions.push({
        q: `¿Quién aparece en ${data.titulo}?`,
        correct: entity.name,
        wrongs: generateEntityWrongs(entity.name)
      })
    } else {
      questions.push(createGenericQuestion(data))
    }

    // Question 3: verse comprehension
    const keyVerse = versiculos.length > 3 ? versiculos[Math.min(2, versiculos.length-1)] : versiculos[0]
    if (keyVerse) {
      const words = keyVerse.texto.split(' ')
      if (words.length > 10) {
        const segment = words.slice(0, Math.min(12, words.length)).join(' ')
        if (segment.length > 20) {
          questions.push({
            q: `El versículo ${keyVerse.numero} menciona:`,
            correct: segment + '...',
            wrongs: generateTextWrongs(segment, versiculos)
          })
        } else {
          questions.push(createGenericQuestion(data))
        }
      } else {
        questions.push(createGenericQuestion(data))
      }
    } else {
      questions.push(createGenericQuestion(data))
    }

    while (questions.length < 3) {
      questions.push(createGenericQuestion(data))
    }

    return questions.slice(0, 3)
  }

  function generateWrongs(correct) {
    const pool = [
      'Lehi tuvo una visión del árbol de la vida',
      'Jared construyó barcos para cruzar el océano',
      'Alma predicó al pueblo en Zarahemla',
      'Los nefitas lucharon contra los lamanitas',
      'Jacob enseñó sobre la expiación de Cristo',
      'Moroni escondió los anales en el monte',
      'El rey Benjamín dio un gran discurso',
      'Nefi rompió su arco y construyó otro',
      'Los hermanos de Nefi se rebelaron contra él',
      'Samuel el lamanita profetizó desde el muro'
    ]
    const filtered = pool.filter(w => !similar(w, correct))
    return shuffle(filtered).slice(0, 3)
  }

  function generateEntityWrongs(correctName) {
    const pool = ['Nefi', 'Lehi', 'Jacob', 'Enós', 'Mosíah', 'Alma', 'Helamán', 'Mormón', 'Éter', 'Moroni', 'Sariah', 'Labán', 'Zoram', 'Laman', 'Lemuel', 'Ismael', 'Benjamín', 'Coriántumr']
    return shuffle(pool.filter(n => n !== correctName)).slice(0, 3)
  }

  function generateTextWrongs(correctText, versiculos) {
    const otherTexts = versiculos
      .filter(v => !v.texto.includes(correctText.substring(0, 15)))
      .map(v => v.texto.substring(0, 60))

    const pool = otherTexts.length >= 3
      ? otherTexts
      : ['Y aconteció que...', 'Y así está escrito.', 'Por tanto, regocijaos.']

    return shuffle(pool.map(t => t + '...')).slice(0, 3)
  }

  function createGenericQuestion(data) {
    return {
      q: `¿Leíste el capítulo ${data.capitulo} de ${API.getBookTitle(data.libro_slug)}?`,
      correct: 'Sí, lo leí con atención',
      wrongs: ['No, todavía no', 'Tal vez', 'Solo lo hojeé']
    }
  }

  function extractEntities(versiculos) {
    const names = ['Nefi', 'Lehi', 'Jacob', 'Enós', 'Jarom', 'Mosíah', 'Alma', 'Helamán', 'Mormón', 'Éter', 'Moroni', 'Labán', 'Sariah', 'Zoram', 'Laman', 'Lemuel', 'Ismael', 'Benjamín', 'Coriántumr', 'Limbí']
    const found = []
    for (const name of names) {
      for (const v of versiculos) {
        if (v.texto.includes(name)) {
          found.push({ name, verse: v })
          break
        }
      }
    }
    return found
  }

  function similar(a, b) {
    return a.toLowerCase().substring(0, 15) === b.toLowerCase().substring(0, 15)
  }

  function shuffle(arr) {
    const a = [...arr]
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function showQuizQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
      showResults()
      return
    }

    const q = currentQuestions[currentQuestionIndex]
    const allOptions = shuffle([q.correct, ...q.wrongs])

    $('quizCounter').textContent = `${currentQuestionIndex + 1} / ${currentQuestions.length}`
    $('quizProgress').style.width = `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%`
    $('quizQuestion').textContent = q.q

    $('quizOptions').innerHTML = allOptions.map(opt => `
      <button class="quiz-option" data-answer="${opt}">${opt}</button>
    `).join('')

    $('quizFeedback').hidden = true
    $('btnNextQuestion').hidden = true
    isAnswering = true

    document.querySelectorAll('.quiz-option').forEach(el => {
      el.addEventListener('click', () => handleAnswer(el, q.correct))
    })

    show('screen-quiz')
  }

  function handleAnswer(el, correct) {
    if (!isAnswering) return
    isAnswering = false

    const answer = el.dataset.answer
    const isCorrect = answer === correct

    document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true)

    document.querySelectorAll('.quiz-option').forEach(b => {
      if (b.dataset.answer === correct) {
        b.classList.add('correct')
      }
      if (b === el && !isCorrect) {
        b.classList.remove('selected')
        b.classList.add('wrong')
      }
      if (b === el && isCorrect) {
        b.classList.add('correct')
      }
    })

    if (isCorrect) {
      $('feedbackIcon').textContent = '✅'
      $('feedbackText').textContent = '¡Correcto!'
      correctAnswers++
    } else {
      $('feedbackIcon').textContent = '❌'
      $('feedbackText').textContent = `La respuesta correcta era: "${correct}"`
    }
    $('quizFeedback').hidden = false

    setTimeout(() => {
      $('btnNextQuestion').hidden = false
      $('btnNextQuestion').textContent = currentQuestionIndex + 1 >= currentQuestions.length
        ? 'Ver Resultado'
        : 'Siguiente'
    }, 600)
  }

  function nextQuestion() {
    currentQuestionIndex++
    showQuizQuestion()
  }

  function showResults() {
    const total = currentQuestions.length
    const score = correctAnswers
    const streak = Store.getStreak()

    $('resultsIcon').textContent = score === total ? '🎉' : score >= 2 ? '👏' : '💪'
    $('resultsTitle').textContent = score === total
      ? '¡Capítulo Completado!'
      : score >= 2
        ? '¡Buen trabajo!'
        : '¡Sigue practicando!'
    $('scoreValue').textContent = `${score}/${total}`
    $('newStreak').textContent = streak.currentStreak

    const progress = Store.getProgress()
    const next = getNextChapter(progress)

    if (next) {
      $('btnContinue').textContent = `Seguir: ${API.getBookTitle(next.book)} ${next.chapter} →`
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
      $('btnContinue').textContent = '🎉 ¡Todos los capítulos completados!'
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

  document.addEventListener('DOMContentLoaded', () => {
    init()

    $('btnRead').addEventListener('click', startReading)
    $('btnBackReading').addEventListener('click', () => renderHome())
    $('btnBackQuiz').addEventListener('click', () => renderHome())
    $('btnFinishReading').addEventListener('click', finishReading)
    $('btnNextQuestion').addEventListener('click', nextQuestion)
    $('btnHome').addEventListener('click', renderHome)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
    }
  })
})()
