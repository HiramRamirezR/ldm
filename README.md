# LdM Diario

**LdM Diario** es una PWA para crear el hábito de leer el **Libro de Mormón** cada día, con una estética de azul marino (`#0d1b3e`) y dorado (`#d4a017`), los colores representativos de la portada original.

## Funcionalidades

- **Lectura diaria** — Lee un capítulo por día con el texto completo en español (239 capítulos)
- **Selector de capítulo** — Modal acordeón para elegir cualquier libro y capítulo; el chip actual se marca con borde dorado
- **Separador por versículo** — Marca el versículo donde te quedaste; al volver al capítulo te desplaza automáticamente a ese versículo
- **Rachas (streaks)** — Control de días consecutivos con vista semanal y badge en el header
- **Reflexión post-lectura** — 3 preguntas abiertas opcionales, se guardan por capítulo y se consultan en el diario
- **Repaso de conocimientos** — Quiz de opción múltiple generado automáticamente del resumen, personajes y versículos del capítulo
- **Diario personal** — Todas las reflexiones ordenadas por fecha
- **Progreso total** — Barra de progreso sobre los 239 capítulos
- **Offline** — Los JSON de los capítulos se cachean al primer acceso (cache-first)
- **Instalable** — PWA con service worker, manifest y splash screen

## Stack

- HTML, CSS y JavaScript vanilla
- [Font Awesome 6](https://fontawesome.com) (iconos vía CDN, reemplazan emojis)
- PWA con Service Worker + manifest (cache busting con `ignoreSearch`)
- 239 archivos JSON con el texto completo en español incluidos en la app
- Datos extraídos de [`elcarloss/libromormon-data`](https://github.com/elcarloss/libromormon-data)
- Diseño responsive con CSS custom properties (tema azul + dorado)

## Uso

```bash
# Servir con cualquier servidor estático
npx serve .
```

Abrir en el navegador. Para instalar en el celular, usar "Agregar a pantalla de inicio".

## Estructura

```
├── index.html            # App shell (10 pantallas)
├── manifest.json         # PWA manifest
├── sw.js                 # Service Worker (ldm-v3)
├── css/
│   └── style.css         # ~980 líneas, tema navy + gold
├── js/
│   ├── app.js            # Lógica principal (eventos, navegación, quiz, reflexión)
│   ├── api.js            # Carga de capítulos desde JSON locales + metadatos
│   └── storage.js        # localStorage: progreso, rachas, bookmark, reflexiones
└── data/
    └── by-chapter/       # 239 JSONs (slug-xxx.json)
```

## Flujo

1. **Splash** — Carga inicial con spinner dorado sobre fondo azul marino
2. **Home** — Saludo según hora, racha semanal, progreso, alerta de bookmark pendiente, selector de capítulo con badge "CAMBIAR", botones de acción
3. **Lectura** — Resumen destacado, versículos con numeración, barra de progreso de scroll, botón de bookmark y "Leí el capítulo"
4. **Reflexión** — 3 preguntas opcionales con textarea; cada una se puede omitir o guardar
5. **Resultados** — Trofeo animado, racha actualizada, botón para continuar al siguiente capítulo o volver al inicio
6. **Repaso** — Lista de capítulos completados; al seleccionar uno inicia un quiz de 3 preguntas
7. **Quiz** — Preguntas de opción múltiple con feedback inmediato (verde/rojo)
8. **Resultado del quiz** — Puntaje obtenido
9. **Diario** — Reflexiones guardadas, ordenadas por fecha (más reciente primero)

## Diseño y tema

Los colores se definen como CSS custom properties en `:root`:
- `--navy: #0d1b3e` — color principal (barras, botones, fondos)
- `--gold: #d4a017` — color de acento (rachas, badges, detalles)
- Los iconos usan Font Awesome 6 (clases `fa-solid`, `fa-regular`)

## Datos

Texto del Libro de Mormón en español © [Intellectual Reserve, Inc.](https://www.churchofjesuschrist.org/legal/terms-of-use) — uso no comercial con atribución.

## Licencia

MIT
