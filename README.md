# 📖 LdM Diario

**LdM Diario** es una PWA (Progressive Web App) para crear el hábito de leer el **Libro de Mormón** cada día, con una estética similar a Duolingo y un sistema de rachas.

## Funcionalidades

- **Lectura diaria** — Lee un capítulo por día con el texto completo en español
- **Rachas (streaks)** — Lleva el control de días consecutivos de lectura, con vista semanal
- **Quiz de comprensión** — Después de leer, responde 3 preguntas sobre el capítulo
- **Progreso total** — Barra de progreso sobre los 239 capítulos (15 libros)
- **Offline** — Al abrir un capítulo una vez, queda cacheado para lectura sin internet
- **Instalable** — Se puede instalar en el celular como una app nativa (PWA)

## Stack

- HTML, CSS y JavaScript vanilla (sin frameworks)
- PWA con Service Worker y manifest
- Datos locales: 239 archivos JSON con el texto completo en español
- [Open Scripture API](https://openscriptureapi.org/) (solo para referencia, no usado en runtime)
- Datos extraídos de [`elcarloss/libromormon-data`](https://github.com/elcarloss/libromormon-data)

## Uso

```bash
# Servir localmente con cualquier servidor estático
npx serve .
# o
python -m http.server 8080
```

Abrir `http://localhost:8080` en el navegador. Para instalar en el celular, abrir desde Chrome y seleccionar "Agregar a pantalla de inicio".

## Estructura

```
├── index.html            # App shell (5 pantallas)
├── manifest.json         # Manifest PWA
├── sw.js                 # Service Worker (cache-first para datos)
├── css/
│   └── style.css         # Estilos Duolingo-like
├── js/
│   ├── app.js            # Lógica principal y UI
│   ├── api.js            # Carga de capítulos desde JSON locales
│   └── storage.js        # localStorage: progreso, rachas, caché de quiz
└── data/
    └── by-chapter/       # 239 JSONs, uno por capítulo (español)
```

## Flujo de la app

1. **Splash** → Carga inicial
2. **Home** → Racha actual, progreso total, botón "Empezar Lectura de Hoy"
3. **Lectura** → Texto del capítulo con barra de progreso de scroll
4. **Quiz** → 3 preguntas de comprensión sobre el capítulo
5. **Resultados** → Puntaje, racha actualizada, botón para siguiente capítulo

## Datos

El texto del Libro de Mormón en español es © [Intellectual Reserve, Inc.](https://www.churchofjesuschrist.org/legal/terms-of-use) Usado con permiso para fines no comerciales.

## Licencia

MIT
