const API = {
  async getChapter(bookSlug, chapter) {
    const padded = String(chapter).padStart(3, '0')
    const url = `data/by-chapter/${bookSlug}-${padded}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Error al cargar capítulo: ${res.status}`)
    return res.json()
  },

  getBookTitle(bookSlug) {
    const map = {
      '1-ne': '1 Nefi',
      '2-ne': '2 Nefi',
      'jacob': 'Jacob',
      'enos': 'Enós',
      'jarom': 'Jarom',
      'omni': 'Omni',
      'w-of-m': 'Palabras de Mormón',
      'mosiah': 'Mosíah',
      'alma': 'Alma',
      'hel': 'Helamán',
      '3-ne': '3 Nefi',
      '4-ne': '4 Nefi',
      'morm': 'Mormón',
      'ether': 'Éter',
      'moro': 'Moroni'
    }
    return map[bookSlug] || bookSlug
  },

  getBookOrder() {
    return ['1-ne','2-ne','jacob','enos','jarom','omni','w-of-m','mosiah','alma','hel','3-ne','4-ne','morm','ether','moro']
  },

  getChapterCounts() {
    return {
      '1-ne': 22, '2-ne': 33, 'jacob': 7, 'enos': 1, 'jarom': 1, 'omni': 1,
      'w-of-m': 1, 'mosiah': 29, 'alma': 63, 'hel': 16, '3-ne': 30,
      '4-ne': 1, 'morm': 9, 'ether': 15, 'moro': 10
    }
  }
}
