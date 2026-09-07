# Auditoría de la landing principal (`/`)

**Fecha:** 2026-09-06 · **Alcance:** `src/app/page.tsx`, `src/app/layout.tsx`, `src/components/landing/*`, bloque landing de `src/app/globals.css` (líneas ~1187–4211), `robots.ts`/`sitemap.ts`/`manifest.ts`, `public/videos/`, `public/images/`.
**Inspiración declarada por Jean Paul:** https://www.zite.com/ (énfasis en móvil).

---

## Veredicto

La landing está **bien ejecutada como pieza de motion design y muy mal alineada con este proyecto**. Tres problemas la hacen no publicable tal cual:

1. **Contenido:** afirma cosas que el propio spec dice que son falsas o que aún no se han medido (0.2 s de captura, 100 % de conciliación, cifrado AES‑256, "insights" inventados con números concretos). En una app de dinero cuyo argumento es *precisión y confianza*, esto es el mayor riesgo.
2. **Rendimiento móvil:** hace casi todo lo que `DESIGN_SYSTEM.md` §5.5 y `CLAUDE.md` prohíben explícitamente por INP — `backdrop-filter` en ~15 contenedores que scrollean, 9 animaciones en bucle infinito, 4 bucles `requestAnimationFrame` simultáneos, y un `<video>` a pantalla completa scrubbeado por `currentTime` en cada frame. El presupuesto P7 (INP < 200 ms) no lo pasa en un gama media.
3. **Es la estética opuesta a tu referencia.** Zite es blanco, un acento, tipografía por peso, hero de texto, cero scroll‑animation, cero degradados, cero 3D. Esta landing es negro + burdeos + oro champán + vídeo cinemático + 20 degradados + tarjetas 3D falsas.

Y de fondo: **esto es trabajo de Fase 4+ hecho en Fase 1.** `CLAUDE.md` → "No adelantar bloques. No implementar fases futuras de paso." El bloque que toca ahora es B8 (PWA + presupuesto de rendimiento), no una landing de 3.000 líneas de CSS. `docs/PRUEBA_USO_REAL.md` dice que el núcleo aún no ha pasado su prueba de 3 días de uso real.

---

## 1. Contenido

### 1.1 Afirmaciones que no puedes sostener — viola P3 y P6

`CLAUDE.md`: *"El contenido financiero se cita o no se dice"* (P3) y *"Ninguna métrica sin n, metodología y línea base"* (P6). *"'94%' es decoración; '96% en monto, 91% en fecha, 88% en comercio (n=847)' es evidencia."*

| Dónde | Afirmación | Problema |
| :--- | :--- | :--- |
| `landing-product-showcase.tsx:95,179,321,391,565` | "captura en 0.2 segundos" (×5) | Cifra inventada. El spec §2/§4 no fija ninguna latencia así; el path real es un Shortcut de iOS que el usuario dispara. |
| `:107,482,593,713,764` | "concilia extractos al 100%", "100% garantizada", "Mes 100% Cuadrado" | La **Fase 0** (validación empírica de cobertura) *no ha corrido* — lo dice `CLAUDE.md`. Prometer 100 % de OCR es lo contrario de lo que exige METRICS.md. |
| `:708,717` | "precisión milimétrica en 3 segundos", "< 3 segundos" de extracción | El spec §2 dice explícitamente **Gemini Flash tarda 2–6 s reales, no < 1.5 s**. La landing contradice tus propios números verificados. |
| `:789` | "Gastas un **+252%** más en cenas los jueves después de las 11 PM" | Insight fabricado presentado como dato real del usuario. |
| `:799` | "Tres suscripciones olvidadas te cuestan **$84,000/mes**" | Ídem. Número concreto, cero respaldo. |
| `:432,446` y `landing-grand-finale-footer.tsx:93` | "AES‑256 GCM", "cifrado AES‑256 en reposo", "tus credenciales nunca tocan nuestros servidores en texto plano", "Enclave de solo lectura" | Reclamaciones de seguridad específicas que nada en el spec respalda. Neon Auth / Better Auth gestiona credenciales; no existe ningún "enclave de solo lectura". En finanzas, afirmar criptografía concreta que no puedes probar es responsabilidad legal, no marketing. |

**Acción:** o borras la cifra, o la sustituís por lenguaje de intención ("guardado en segundo plano, sin abrir la app"), o esperas a tener el número real de METRICS.md y lo citas con su `n`.

### 1.2 La promesa del héroe es técnicamente imposible

El eje de la página — "Just Tap & Go", "cero toques", "Real Money **escucha el toque físico en el datáfono**", "Apple Pay NFC · 0.2s captura · 0 toques" (`landing-product-showcase.tsx:178,313–396`) — describe una capacidad que no existe y no va a existir: **ni Apple ni la red de pagos exponen los datos de una transacción a una app de terceros**. El `PROJECT_SPEC` §1.2 lo sabe: el Nivel 1 es un **Shortcut que el usuario ejecuta**, no captura ambiental. Un visitante que entienda de pagos rebota en el hero.

**Acción:** el copy tiene que describir el Shortcut real (1 toque + confirmación), no magia. El propio spec te da la narrativa honesta: "0 toques" es *el destino* al que se aspira, con OCR de extracto como red de seguridad.

### 1.3 La tarjeta "Real Money" contradice tu propio texto

El centro visual son tarjetas de crédito con "REAL MONEY" grabado, chip dorado y número `5235 ···· ···· 2220` (`landing-product-showcase.tsx:191–305, 359–395`). Tres secciones más abajo: *"No somos un banco ni vendemos tarjetas"* (`:153`). El elemento gráfico principal de la landing vende exactamente lo que el producto dice que no hace.

### 1.4 Idioma: mezcla ES/EN en la misma vista, y cero i18n

`CLAUDE.md`: *"i18n desde el bloque B5, no como retrofit. Ningún string literal en JSX: todo pasa por el catálogo de traducciones."* El catálogo **ya existe** (`src/lib/i18n.ts`, 8 KB, con test) y el dashboard nuevo lo usa (`t(...)`). **La landing no lo toca**: ~150 strings hardcodeados.

Y mezcla los dos idiomas dentro de un mismo componente:

- `landing-section-enter.tsx`: `YOUR` / `MONEY` / "Made Clear." / "A personal finance companion engineered to understand your financial velocity." (inglés) → botón "Pruébalo ahora" (español).
- `landing-top-bar.tsx`: nav en español ("Filosofía", "Cero Toques", "Tarjeta 3D", "Enclave", "Telemetría") → marca "REAL MONEY".
- `page.tsx`: `title` en inglés, `openGraph.locale: 'es_LA'`, `<html lang="es">` (layout) sobre copy de hero en inglés.

`es_LA` además no es un locale OG válido (usa `es_CO`).

### 1.5 Nombre de marca inconsistente

"Real Money" (dos palabras, toda la landing) vs **"RealMoney"** (una palabra, en `layout.tsx`, `manifest.ts`, `CLAUDE.md`, el repo). Elige uno y aplícalo en los ~20 sitios.

### 1.6 Nombres reales de bancos y comercios en extractos falsos — y el repo es PÚBLICO

`landing-product-showcase.tsx:730–758`: filas de extracto inventadas con "Bancolombia", "Nu", "Éxito", "Starbucks Calle 85", "Crepes & Waffles", "Servibanca", "Bancolombia PDF · 14 movimientos". `CLAUDE.md` → *"Los fixtures que sí se commitean van anonimizados: montos alterados, comercios genéricos, sin números de cuenta ni nombres."* No son datos de un usuario real, pero marcas reales pegadas a una afirmación de "100 % conciliado" en un repo público es justo el patrón que las reglas del repo prohíben.

### 1.7 Los 9 CTA apuntan a una ruta autenticada

Todos los `Link href="/dashboard"` (hero, top‑bar, showcase ×3, trust, finale, footer). `robots.ts` bloquea `/dashboard`. Un visitante sin sesión que pulsa "Pruébalo ahora" cae en un redirect a `/sign-in`. El CTA debe ir a `/sign-in`.

### 1.8 "Just Tap & Go®"

`landing-product-showcase.tsx:316`. El símbolo ® sobre una marca no registrada es engañoso y en algunas jurisdicciones sancionable. Quítalo (o `™`, que no afirma registro).

---

## 2. Código

### 2.1 Rendimiento móvil — el bloque crítico

`DESIGN_SYSTEM.md` §5: *"lo que cuesta rendimiento no es la animación, es la animación gobernada por JavaScript."* La landing tiene:

| Qué | Dónde | Coste en móvil |
| :--- | :--- | :--- |
| **`<video>` a pantalla completa scrubbeado por scroll** poniendo `video.currentTime` en cada frame de un `rAF` infinito | `cinematic-video-canvas.tsx:64–99` | Seek de H.264 por frame en iOS Safari = stutter garantizado salvo encode all‑keyframe; y aun así, en Android gama media da tirones. Bloquea el hilo principal en el peor momento (scroll). |
| **`preload="auto"` en los DOS vídeos** (`landscape_desktop.mp4` 3.4 MB + `phone_mobile.mp4` 2.4 MB) | `:126–137` | ~5.8 MB descargados en carga pase lo que pase. Sin `poster` → el primer frame del hero es negro hasta que bufferea; probable elemento LCP vacío durante segundos. |
| **Los dos vídeos siempre en el DOM** (nunca `display:none`, solo `opacity`) | `globals.css:1209–1241` | Dos pipelines de decode de vídeo vivos. En Android de poca RAM es un golpe de memoria real. |
| **4 bucles `requestAnimationFrame` infinitos simultáneos** | `cinematic-video-canvas.tsx`, `landing-section-observe.tsx:27`, `landing-section-understand.tsx:40`, `landing-top-bar.tsx:36` | Cada uno llama `getBoundingClientRect()` por frame (reflow forzado). Ninguno para al salir de viewport ni con la pestaña oculta. |
| **`observe` y `understand` hacen `setState` en cada frame** | `landing-section-observe.tsx:22`, `landing-section-understand.tsx:33` | Re‑render de React 60 veces/s de un árbol con objetos de estilo inline. |
| **9 animaciones CSS en bucle infinito** | `globals.css:411,427,2176,2552,2684,2823,2939,3002,3020` | `DESIGN_SYSTEM.md` §5.5: *"Animaciones en bucle fuera de los esqueletos de carga"* = **prohibido**. Varias con `will-change: transform` permanente → capas de compositor y memoria GPU pinneadas para siempre. Batería. |
| **Ningún `rAF` comprueba `prefers-reduced-motion`** (solo `cinematic-video-canvas` lo hace) | `observe`, `understand`, `top-bar` | Siguen transformando aunque el usuario pida menos movimiento. |

Esto no es "optimizable con ajustes": el enfoque (scrubbing de vídeo + parallax por JS) es el que el proyecto decidió no usar. Zite, tu referencia, **no hace nada de esto** — "no heavy parallax, no scroll‑triggered animations, no video backgrounds".

### 2.2 Violaciones del sistema de diseño que, por `CLAUDE.md`, **bloquean el merge**

| Regla (`CLAUDE.md` / `DESIGN_SYSTEM.md` §9) | Estado en la landing |
| :--- | :--- |
| *"`backdrop-filter` prohibido en contenedores con scroll"* (§5.5, §9.3, la regla más explícita del doc: *"destruye el framerate en Safari iOS justo en la pantalla más usada"*) | **~15 infracciones**: `.landing-arch-strip-bar`, `.landing-enclave-vault-card`, `.landing-statement-terminal`, `.landing-friction-card--old-dark`/`--new-dark`, `.landing-truth-card--dark`, `.landing-vision-glass-panel`, `.landing-feature-tag-chip--dark`, `.landing-hardware-temple-overlay`, `.landing-finale-glass-card`, `.landing-finale-nav-grid`, `.landing-audio-scrubber`, `.landing-glass-asset-row`. Todos scrollean. |
| *"Nada de un segundo degradado más allá de la tarjeta héroe"* (§6.1, §9.5) | ~20 degradados: `.landing-gold-gradient-text`, `.landing-3d-card-body`, `.landing-mini-card--front`, `.landing-iridescent-orb`, `.landing-arch-strip-bar`, radiales en cada panel, mist de transición, etc. |
| *"Paleta categórica validada contra CVD; añadir un color a ojo la rompe"* (§2.6, §9.7) | Paleta entera nueva sin validar: `--landing-champagne-gold #e4cca6`, `--landing-rich-burgundy #4a101d`, `--landing-illuminated-wine`, `#5c1424`, `#781d32`… El burdeos/vino está peligrosamente cerca del `--critical #E5484D` reservado. |
| *"Nada de color semántico usado como categoría / decoración"* (§2.5, §9.6) | Verdes crudos `#4ade80`, `#22c55e`, `rgba(34,197,94,…)` para "confirmado" por todas partes (no es `--positive #34C77B` — ahora hay **dos verdes**). Rojos crudos `#f87171`, `rgba(239,68,68,…)` para "the old way". |
| *"Solo se animan `transform` y `opacity`"* | Los `@keyframes` en sí lo cumplen. Pero `.landing-friction-card:hover` etc. transicionan bien; ojo con no reintroducir `transition: all`. |
| *"El decimal y las cifras se renderizan solo en `<Money>`"* (§9.2) | La landing renderiza importes sueltos: `$1,842.56`, `$142,500`, `$68,000`, `-$14.200`… en JSX directo (`landing-product-showcase.tsx:479,564,578,592,739…`). Además mezcla formato US (`$1,842.56`) y CO (`$14.200`) en la misma vista. |

> Nota: la regla literal *"ningún literal de color en `src/components/`"* **sí se cumple** (0 literales en los `.tsx`) — se movieron todos a `globals.css`. Pero el espíritu ("ningún componente inventa valores; DESIGN_SYSTEM es la fuente de verdad") está roto: `globals.css` tiene ~140 literales de color no‑token en el bloque landing.

### 2.3 SEO y metadata — Discovery (P8) incompleto

`CLAUDE.md` → *"JSON‑LD `SoftwareApplication` en la landing"*, *"sitemap con `hreflang`"*, i18n obligatorio.

- **Sin JSON‑LD `SoftwareApplication`.** No existe en ningún sitio (`grep` limpio).
- **Sin `metadataBase`** (ni en `layout.tsx` ni en `page.tsx`) → Next avisa y `canonical`/OG resuelven contra `localhost` en dev.
- `openGraph.url: 'https://realmoney.app'` pero el deploy real es `realmoney-app.vercel.app` (`PRUEBA_USO_REAL.md`). `sitemap.ts` y `robots.ts` también apuntan a `realmoney.app`. Un dominio u otro, pero uno.
- **Sin `openGraph.images`** → preview de enlace en blanco. Para un posicionamiento "premium" eso importa.
- **Sin `alternates.languages` / hreflang** en `page.tsx` ni en `sitemap.ts`, con i18n como requisito duro.
- **El `<h1>` es solo "Made Clear."** (`landing-section-enter.tsx:17`). Las palabras que dominan la vista ("YOUR", "MONEY") son `<span>`. El H1 debería ser la proposición completa.
- `viewport` (layout) no lleva `viewportFit: 'cover'` pero `appleWebApp.statusBarStyle: 'black-translucent'` + hero a `100svh` → el contenido se mete bajo el notch; las palabras gigantes pueden chocar con el reloj. Falta `padding-top: env(safe-area-inset-top)` en el hero.

### 2.4 Accesibilidad

- **Contenido escondido tras el scroll:** `landing-section-understand.tsx:54–73` deja las palabras a `opacity: 0.18` hasta que haces scroll. `DESIGN_SYSTEM.md` §5.4: *"Nada de movimiento se convierte en un requisito para entender la interfaz."* Con `prefers-reduced-motion` el texto sigue tenue (el `opacity` inline viene del progreso de scroll, no de una transición).
- **Objetivos táctiles < 44 px:** `.landing-nav-link` (`padding: 8px 14px`, ~30 px), `.landing-mobile-toggle` (40×40), `.landing-finale-nav-item` (texto suelto, sin `min-height`). `DESIGN_SYSTEM.md` §8: ≥ 44×44.
- **Jerarquía de headings rota:** en `product-showcase` aparecen `<h4>` (`:127`) y `<h5>` (`:559,573,587`) sin `<h3>` de contexto en esa rama.
- `.landing-word-giant` con `white-space: nowrap` a `clamp(2.4rem, 9vw, 4.2rem)` + espaciador `clamp(200px, 55vw, 280px)` entre "YOUR" y "MONEY": en 320 px de ancho eso desborda y `overflow-x: hidden` lo recorta. Palabras cortadas en teléfonos pequeños.

### 2.5 Código muerto y peso

- **5 componentes muertos** (no los importa nadie): `landing-bento-showcase.tsx`, `landing-chapter-nav.tsx`, `landing-extended-experience.tsx`, `landing-timeline.tsx`, `landing-grand-finale.tsx` (el que se usa es `-footer`). Bórralos.
- **`globals.css` = 4.210 líneas; el bloque landing son ~3.024 (67 KB, el 71 %).** Se importa en `layout.tsx` → se envía en **todas** las rutas, incluidas `/sign-in` y `/dashboard`. Para un proyecto que echó Framer Motion "para ahorrar 50 KB", mandar 67 KB de CSS de landing al dashboard es incoherente. Debería ser un CSS de ruta importado solo por `app/page.tsx`.
- **CSS muerto dentro del bloque landing:** `.landing-top-bar--light *` (~40 líneas — ver bug 2.6), `.landing-kinetic-stream` (no se renderiza), `.landing-scroll-pip` (no existe), `.landing-mini-card-magnetic-stripe` (en JSX, sin CSS), `.glass-rim`.
- **Token indefinido:** `var(--landing-dark-wine)` se usa en `landing-product-showcase.tsx:239,412` y en gradientes de `globals.css`, pero **no está declarado** (lo declarado es `--landing-rich-burgundy` / `--landing-illuminated-wine`). Esos `stop-color` caen a transparente.
- **~15 MB de imágenes sin usar** a punto de entrar al repo público (`git status` → `?? public/images/`): `RM_ref_1/2/3` (capturas de otras apps — $savvy, etc.: mal gusto de IP en repo público), `tarjeta_detalle.*`, `nfc_zero_touch_render.jpg`, `telegram_haptic_device.jpg`, `vision_ai_scanner_render.jpg`, `intro-artwork.png`. La landing viva no referencia ninguna salvo `footer.jpeg`. No las commitees.
- **`scratch/`** (frames de vídeo) no está en `.gitignore` y aparece como `??`. Añádelo.
- **94 objetos `style={{…}}` inline** en los componentes landing. `globals.css` presume en sus comentarios de haber quitado los inline styles de sign‑in/dashboard "porque asignan un objeto nuevo por render en la pantalla que más le importa al INP". La landing reintrodujo 94.

### 2.6 Bugs concretos

| # | Archivo | Bug |
| :--- | :--- | :--- |
| 1 | `landing-top-bar.tsx:7,19–31,71` | `isLightMode` se calcula con scroll‑detection de `#product-showcase`/`#grand-finale`, pero el `className` está **hardcodeado a `landing-top-bar--dark`**. Todo el estado, el listener y los ~40 líneas de CSS `--light` son código muerto. Además `#product-showcase` ahora es `--dark`, así que la lógica ni tendría sentido. |
| 2 | `globals.css:1194–1195` | `.cinematic-video-canvas { width: 100vw }` → con scrollbar en desktop genera overflow horizontal; lo tapa `.landing-experience { overflow-x: hidden }`. Usa `100%`. |
| 3 | `globals.css:1195,1589,1600` | `height: 100vh` en el canvas del vídeo y el hero, cuando el resto del archivo ya migró a `100svh`/`100dvh`. En iOS el vídeo salta al aparecer/desaparecer la barra de direcciones. |
| 4 | `landing-top-bar.tsx:71` | `landing-top-bar--scrolled` se aplica pero no está definido en el CSS → no‑op. |
| 5 | `page.tsx:26` | `openGraph.locale: 'es_LA'` no es un locale OG válido. |

---

## 3. Móvil — resumen consolidado (lo que pediste priorizar)

1. **Quita el scrubbing de vídeo por scroll.** Es la causa raíz de la mala sensación de scroll en móvil. Si quieres el vídeo, que sea un `autoPlay muted loop playsInline` corto (< 1 MB, con `poster`) o una imagen. Zite no usa vídeo de fondo en absoluto.
2. **Mata los 4 `rAF` y las 9 animaciones infinitas.** Los efectos "flotantes" de las tarjetas no aportan y funden batería.
3. **Fuera `backdrop-filter` de todo lo que scrollea.** Sustituir por un fondo sólido/semisólido con el color de superficie. Es un buscar‑y‑reemplazar.
4. **Un vídeo, no dos**, y `preload="none"` o `metadata`. Ahorras ~5 MB en la carga móvil.
5. **Targets a 44 px**, hero con `env(safe-area-inset-top)`, y arregla el corte de "YOUR/MONEY" en 320 px.
6. **CSS de landing fuera de `globals.css`** para que el resto de la PWA no cargue 67 KB que no usa.

Con 1–4 hechos, la landing pasa de "cinemática pero pesada" a algo que un iPhone SE o un Android de $150 mueve a 60 fps.

---

## 4. Frente a zite.com — la brecha, y qué tomar de verdad

| Eje | Zite | Esta landing |
| :--- | :--- | :--- |
| Fondo | Blanco / gris muy claro | Negro + burdeos + oro |
| Acento | **Uno** (azul) | Oro champán + vino + verdes + rojos crudos |
| Hero | **Texto primero**, sin imagen full‑bleed, propuesta de valor y 2 botones | Vídeo cinemático full‑screen scrubbeado + palabras gigantes |
| Motion | **Ninguna** scroll‑animation, sin parallax, sin efectos de fondo | 4 rAF + 9 bucles infinitos + parallax por JS |
| Degradados / 3D | **Cero** | ~20 degradados, tarjetas 3D isométricas, orbes |
| Imágenes | **Capturas reales del producto** | Mockups "nativos en CSS" de un producto que no existe así |
| Densidad | Minimalista, whitespace como elemento | Muy densa, 8 "parts" en un solo scroll |
| Tipografía | Jerarquía **por peso**, sans, titulares cortos y punchy | Jerarquía por tamaño extremo (`clamp(3.8rem, 8vw, 8.5rem)`), titulares largos |
| Copy | "The AI builder that means business" — concreto, verificable | "entender tu velocidad financiera", "precisión milimétrica", "certeza matemática absoluta" |

**Qué tomar de Zite, de verdad:**

- Hero de **texto**: un `<h1>` con la proposición completa (p. ej. *"Tus gastos, registrados sin que muevas un dedo"*), un párrafo, un botón sólido a `/sign-in`. Sin vídeo de fondo.
- **Una** captura real del dashboard (ya existe, `(dashboard)/dashboard`) como imagen — `next/image`, `priority`, con su `poster`/blur. Eso es tu "database table visualization".
- **Fondo claro o el `--surface-base` sólido del sistema**, un acento (`--brand-500` violeta, que ya está validado), jerarquía por peso con la escala tipográfica de `DESIGN_SYSTEM.md` §3.2 — no `clamp` inventados.
- Ritmo vertical generoso (`--space-12`), 3–4 secciones máximo, cada una: titular corto + 1 frase + 1 visual real.
- **Cero** `backdrop-filter`, cero degradado salvo (si acaso) el héroe, cero animación de scroll. `prefers-reduced-motion` sale gratis porque no hay motion.
- Transiciones de sección = whitespace, no "mist gradients" de 520 px.

Es, además, mucho menos código: una landing tipo Zite son ~200 líneas de JSX y ~150 de CSS, no 5 componentes + 3.024 líneas.

---

## 5. Recomendación

**Orden sugerido (si se mantiene la landing en Fase 1, cosa que `CLAUDE.md` desaconseja):**

1. **Contenido primero** (§1). Reescribir el copy para que no afirme nada que el spec/METRICS no respalde, quitar la narrativa de "captura ambiental por NFC", quitar la tarjeta de marca, resolver el idioma vía `src/lib/i18n.ts`, unificar "RealMoney", CTAs a `/sign-in`, quitar nombres de bancos reales y el ®. Esto no depende de nada.
2. **Reducir a una landing tipo Zite** (§4). Es más rápido rehacerla minimalista que parchear 3.000 líneas. Borra los 5 componentes muertos y el bloque landing de `globals.css`; empieza de `app/page.tsx` con hero de texto + 1 captura real + 3 secciones.
3. **Metadata / discovery** (§2.3): `metadataBase`, JSON‑LD `SoftwareApplication`, OG image, hreflang en `page.tsx` y `sitemap.ts`, `<h1>` real.
4. **No commitees** `public/images/RM_ref_*` ni las demás imágenes sin usar; añade `scratch/` a `.gitignore`; revisa `git diff --staged` por nombres de banco antes del push.

**Si se puede aplazar:** archivar esta rama y retomar la landing en B8 / Fase 4, con el núcleo ya dogfooded (`PRUEBA_USO_REAL.md` en verde) y METRICS.md con números reales que citar.

---

## Estado tras la corrección — 2026-09-07

Pasada de correcciones aplicada sobre la landing existente (no reescritura). `pnpm test` (146), `tsc` y `next build` en verde; `/` sigue siendo estática.

### Hecho

| Área | Cambio |
| :--- | :--- |
| **CSS** | Bloque de landing (~3.025 líneas) movido de `globals.css` a `src/app/landing.css`, importado solo por `page.tsx`. `globals.css` pasó de 4.211 → 1.185 líneas. `/sign-in` y `/dashboard` ya no cargan el CSS de la landing. |
| **Perf — vídeo** | `CinematicVideoCanvas` reescrito. El scrubbing por scroll **se mantiene** (lo pediste), pero: gateado por `IntersectionObserver` sobre `#cinematic-track` (0 listeners/rAF cuando el héroe no está en viewport), `rAF` coalescido (1 `getBoundingClientRect` + 1 `seek` por frame como mucho), `preload="metadata"` en vez de `auto`, `poster` en cada `<video>`, `prefers-reduced-motion` → sin scrub. Sin estado de React aquí. |
| **Perf — rAF** | `LandingSectionObserve` pasó a componente estático; `LandingSectionUnderstand` usa un `IntersectionObserver` de un disparo (antes: `setState` por frame, 60/s); `LandingTopBar` usa un sentinel con `IntersectionObserver` (antes: `rAF` infinito + `getBoundingClientRect` por frame). |
| **Perf — animaciones en bucle** | Las 9 animaciones `infinite` (float, gleam, láser, orbe, sombras, waveform, mini-cards) neutralizadas. `will-change` permanente quitado. |
| **Perf — `backdrop-filter`** | Quitado de las ~13 superficies que scrollean (bloque de override en `landing.css`), con relleno opaco de repuesto. Se mantiene solo en la barra fija y el drawer. |
| **Héroe** | Restaurado: `YOUR` · [teléfono en el vídeo] · `MONEY`. Vídeo móvil cambiado a `hero-mobile.mp4` (hand-lowering-phone, 1.3 MB) — el que llevaba (`phone_mobile.mp4`, solo dunas, sin teléfono, 2.4 MB) se eliminó. `<h1>` real («Your money, made clear.»), scrim inferior para legibilidad, `env(safe-area-inset-top)`, palabras gigantes contenidas en 320 px. |
| **Contenido** | Fuera: «0.2 segundos» (×5), «100 % conciliado/garantizado», «< 3 s», «+252 % los jueves», «$84.000/mes», «AES-256 GCM», «Just Tap & Go®», «escucha el toque físico en el datáfono», la tarjeta de marca «REAL MONEY» (ahora «TUS TARJETAS»), la sección de dual-cards con nº de tarjeta falso, el scrubber de audio, el orbe iridiscente. Nombres reales de banco/comercio (Bancolombia, Nu, Éxito, Crepes & Waffles, Starbucks, Servibanca) → genéricos. Las «truth cards» se re-etiquetaron como ejemplos ilustrativos. Números del mock en formato COP consistente. |
| **CTAs** | Los 9 `Link href="/dashboard"` → `/sign-in`. |
| **Marca** | «Real Money» (prosa) → «RealMoney». El logotipo sigue siendo «REAL MONEY» espaciado. |
| **SEO / metadata** | `metadataBase` en `layout.tsx`; `page.tsx` con `es_CO`, `alternates.languages` + `x-default`, `openGraph.images` + `twitter`, JSON-LD `SoftwareApplication`. `viewportFit: 'cover'`. |
| **A11y** | Objetivos táctiles a ≥ 44 px (nav, hamburguesa, footer). El reveal de palabras ya no oculta contenido sin JS ni con `prefers-reduced-motion`. `--landing-dark-wine` definido (antes indefinido → trazos SVG transparentes). |
| **Muerto** | 5 componentes borrados (`landing-bento-showcase`, `landing-chapter-nav`, `landing-extended-experience`, `landing-timeline`, `landing-grand-finale`). `scratch/` añadido a `.gitignore`. Variantes `.webp` generadas y no usadas, eliminadas. |
| **Assets** | `~/Downloads/footer_mobile_re.jpeg` → `public/images/footer-mobile.jpeg` (77 KB, art-direction: retrato en móvil, panorámica ≥ 769 px). Posters de héroe ~25–52 KB. `og.jpg` 1200×630. |

### Pendiente — decisión tuya

1. **El vídeo del teléfono es material generado por IA**: el «dashboard» que se ve (`$12,680.42`, «Adobe Creative Cloud», «Stripe Payout», «Wiindrew», USD, inglés) está deformado y contradice el pitch de precisión. Sustituir por una **grabación real del dashboard de RealMoney** cuando exista. Es lo que más desentona ahora mismo.
2. **Idioma**: el héroe quedó en inglés («YOUR MONEY», «Your money, made clear.») y el resto en español. `CLAUDE.md` dice inglés por defecto + español segundo, y nada de literales en JSX (usar `src/lib/i18n.ts`). Falta decidir el idioma de la landing y pasar los strings por el catálogo.
3. **Conflicto de identidad**: `DESIGN_SYSTEM.md` fija violeta; `01_REAL_MONEY_MASTER_VISUAL_DNA.md` fija vino + oro champán; `realmoney design.png` fija amarillo. La landing usa vino + oro (coincide con el MASTER_VISUAL_DNA). Hay que reconciliar los tres documentos.
4. **`docs/PROJECT_SPEC.md` §07 / brand board** tienen un concepto de landing más sobrio y editorial (fondo oscuro, oro, mockup real, fila de 3 insights). Sigue siendo una buena referencia para una v2.
5. Las imágenes `public/images/RM_ref_*`, `tarjeta_detalle.*`, `*_render.jpg`, `intro-artwork.png` siguen sin usarse — no las commitees.

---

## Segunda pasada — 2026-09-07 (marca, paleta, vídeo, onboarding)

`pnpm test` (146), `tsc`, `next build` en verde. Nueva ruta estática `/onboarding`.

### 1. Nombre: RealMoney → **Reasonny**

Renombradas **todas** las cadenas visibles (`RealMoney` / `Real Money` / `REAL MONEY` → `Reasonny` / `REASONNY`): componentes de landing, `src/lib/i18n.ts` (`app_name`, `auth_enter`, `artwork_alt`), `layout.tsx`, `page.tsx` + JSON-LD, `manifest.ts`, títulos de `/sign-in`, `/nuevo`, `/dashboard`, el `<h1>` del panel, y sus tests. Dominio placeholder `realmoney.app` → `reasonny.app` (lo real lo pone `NEXT_PUBLIC_APP_URL`). Nombre del CSV export → `reasonny-export-…`.

**No tocado** (es operación de repo/infra, no de código): `package.json` `name`, el nombre del repo en GitHub, `CLAUDE.md`, `docs/`, y los strings de conexión Neon en fixtures de test (`auth-env.test.ts`, `db/env.test.ts` — ahí `realmoney` es solo un nombre de BD ficticio).

### 2. Paleta unificada a la de la landing (vino + oro champán)

`globals.css :root` — el acento pasó de violeta a **vino illuminado**, con **oro champán** como "la luz". Al ser tokens, `/dashboard`, `/sign-in` y `/nuevo` lo heredan solos.

| Token | Antes | Ahora |
| :--- | :--- | :--- |
| `--brand-500` (botones, foco, nav activa) | `#8172f2` violeta | `#9b2c45` vino (contraste 9.2:1 con texto blanco) |
| `--brand-600` (hover) | `#6d5ae0` | `#781d32` |
| `--brand-400` (enlaces/acento sobre oscuro) | `#9d91f6` | `#e4cca6` oro champán (13:1) |
| `--brand-tint` | violeta 14% | vino 16% |
| `--brand-indigo` (parada lejana del degradado del isotipo) | `#6366f1` | `#e4cca6` → el isotipo va vino→oro |
| `--hero-gradient-from/to` (tarjeta de saldo) | naranja `#c2410c → #ea580c` | **magenta→vino `#d1477f → #4a101d`** = los colores del celular del above-the-fold |
| `--shadow-brand-*` | violeta | vino |
| `--auth-surface` | `#000000` | `#070406` (negro cálido hacia el vino) |
| `--auth-glow` | blanco 4% | vino 12% |

**No tocado a propósito:** `--positive / --warning / --serious / --critical` y la escala `--cat-*`. Son semántica reservada y una rampa validada contra daltonismo; recolorearlas rompería accesibilidad, no la marca. Si quieres que también migren, hay que volver a correr `validate_palette.js`.

### 3. Vídeo del héroe: nunca se reproduce solo

`CinematicVideoCanvas` ya no llama a `play()` en ningún momento (había un `play()/pause()` de "prime" que causaba un parpadeo de reproducción con la página quieta). El `<video>` está pausado toda su vida; `currentTime` solo lo mueve el handler de scroll (gateado por `IntersectionObserver`, coalescido). Con `prefers-reduced-motion` no hay scrub. En reposo = fotograma fijo.

### 4. Onboarding — `/onboarding` (nuevo)

Mismo lenguaje visual que la landing: un `OB_mobile_reasonny.mp4` (→ `public/videos/onboarding.mp4`, 2.5 MB) fijo detrás, **scrubbeado por scroll** (no autoplay), 3 paneles:

1. «Razón **y dinero**, en el mismo lugar.» — el significado del nombre (reason + money).
2. «Registrar un gasto **deja de ser una tarea.**»
3. «Empieza por **un gasto.**» + botón `Registrar mi primer gasto` → `/nuevo`, enlace secundario → `/dashboard`.

Archivos: `src/app/onboarding/{page.tsx,onboarding.css}`, `src/components/onboarding/onboarding-experience.tsx`. `noindex` + añadido a `robots.ts`. Enlazado desde el footer de la landing («Ver la introducción»).

### Pendiente — decisión tuya

1. **Cuándo se ve `/onboarding`.** Ahora mismo es una página enlazada, no un gate. Para mostrarla solo a usuarios nuevos: `ensureProfile` tendría que devolver `{ profile, created }` y el `/dashboard` (o un callback de auth) redirige a `/onboarding` si `created`. Son ~5 líneas — dime si lo hago.
2. **El vídeo del onboarding**: lo dejé scrubbeado por scroll (coherente con tu regla «vídeo solo en scroll»). Si prefieres autoplay-loop ambiental en esa pantalla concreta, es un atributo.
3. **Rename de repo / `package.json` / Vercel**: es operación tuya (git + panel de Vercel). El código ya dice Reasonny.
4. **`intro-artwork.png`** (la escultura B&N de `/sign-in`) quedó fría respecto al mundo vino. Candidata a sustituir por un fotograma del vídeo del claw o un render cálido.
5. El vídeo del teléfono del héroe **sigue siendo material IA** (dashboard deformado, USD, inglés). Pendiente de la primera pasada: grabar el dashboard real.

---

## Tercera pasada — 2026-09-07 (sign-in cinemático, rename ejecutado)

`pnpm test` (146), `tsc`, `next build` en verde.

### Sign-in con el vídeo OB, autoplay (sin scroll)

- El `OB_mobile_reasonny.mp4` ahora vive en `/sign-in` como fondo fijo a pantalla completa, **autoplay muted loop** (esta pantalla no scrollea; no hay nada que lo scrubbe). `prefers-reduced-motion` → solo el póster.
- `src/components/auth/auth-video-backdrop.tsx` (nuevo). `sign-in/page.tsx` reescrito: fuera el layout de 2 columnas y la escultura B&N; el formulario va en un panel casi opaco sobre el vídeo (sin `backdrop-filter`, por coherencia con el resto de la pasada).
- `interactive-artwork-card.tsx` **borrado** (huérfano). `public/intro-artwork.png` ya no se usa.
- Copy del paso intro: `auth_hero_line_1/2/subtitle` en `i18n.ts` → «Razón y dinero, en el mismo lugar.» (es) / «Reason and money, in one place.» (en). Antes era «Bank Smarter. Quickly. Globally.», inglés heredado.

### `/onboarding` eliminado

La ruta standalone se plegó dentro de `/sign-in` (su razón de ser era mostrar el vídeo OB, que ahora es el fondo del sign-in). Borrados `src/app/onboarding/`, `src/components/onboarding/`, el enlace del footer y la entrada en `robots.ts`. El vídeo se queda en `public/videos/onboarding.mp4` (lo usa el fondo de auth).

### Rename ejecutado

- `package.json` `name`: `realmoney` → `reasonny`.
- `README.md` título → `Reasonny`.
- **Repo de GitHub renombrado** vía `gh repo rename reasonny`: `01REALES01/RealMoney` → `01REALES01/reasonny`. El remote `origin` local se actualizó solo; GitHub mantiene redirección desde la URL vieja.

### Pendiente

1. **Vercel**: el CLI está *Not authorized* aquí. Tú: `vercel login` y luego renombrar el proyecto (`realmoney-app` → `reasonny`) desde el dashboard o CLI. El `projectId` no cambia, así que los deploys actuales siguen funcionando; solo cambia el subdominio `*.vercel.app`.
2. **`CLAUDE.md`** tiene «RealMoney» y `github.com/01REALES01/RealMoney` por todo el documento — falta una pasada de rename ahí (lo dejé sin tocar porque ya tenía cambios sin commitear de otra cosa).
3. **Test del nombre**: decir «Reasonny» a 3 personas y que lo escriban, antes de comprar dominios. Si sale «Reasony», bajar a una n.
