# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## RealMoney — Reglas del proyecto

App de finanzas personales con ingesta asistida por IA. Autor: Jean Paul Reales.

**Documentos:** `docs/PROJECT_SPEC.md` (arquitectura) · `docs/IMPLEMENTATION_PLAN.md` (bloques y orden) · `docs/METRICS.md` (mediciones) · `docs/AUDIT.md` (histórico).
Si el spec y el plan se contradicen, **gana el plan** y el spec se corrige.

---

## Estado actual del repositorio

**Pre-implementación.** El repo contiene únicamente `docs/`, `README.md`, `CLAUDE.md` y `.gitignore`. No hay `src/`, no hay `package.json`, no hay commits todavía (la rama actual es `master`; la rama principal del proyecto será `main`).

La Fase 0 (validación empírica de la cobertura de Wallet) **no ha corrido**. Su resultado condiciona el alcance de la Fase 4 — ver `docs/IMPLEMENTATION_PLAN.md` §6.

**Orden de construcción — Fase 1** (`docs/IMPLEMENTATION_PLAN.md` §7). No se salta ni se adelanta:

| | Bloque | Entregable principal |
| :--- | :--- | :--- |
| B0 | Sincronización de documentos | ✅ hecho (los cuatro documentos de `docs/`) |
| B1 | Infraestructura y modelo de datos | `drizzle.config.ts`, `src/infrastructure/db/{client,schema}.ts`, `drizzle/migrations/` |
| B2 | Aritmética monetaria | `src/core/money.ts` + `money.test.ts` (100% cobertura) |
| B3 | Autenticación | `src/app/(auth)/`, `src/lib/auth.ts` |
| B4 | Repositorios y aislamiento | `src/core/repositories/`, `src/core/types.ts`, `tests/architecture.test.ts` |
| B5 | Entrada manual rápida | `src/app/(dashboard)/nuevo/`, `src/app/actions/transactions.ts` |
| B6 | Lista y total del mes | `src/app/(dashboard)/page.tsx`, `analytics.service.ts` |
| B7 | Export CSV | `src/app/api/v1/export/route.ts` |
| B8 | PWA y presupuesto de rendimiento | `manifest.ts`, `robots.ts`, `sitemap.ts`, Serwist |
| B9 | Instrumentación y líneas base | `src/lib/telemetry.ts`, `docs/METRICS.md` |

**Núcleo Sagrado:** las fases 0-3 se construyen sí o sí. Las fases 4-7 son proyectos derivados y cada una exige **4-8 semanas de uso diario sostenido** del núcleo antes de empezarse, verificado contra `docs/METRICS.md` y no contra la sensación. La Fase 4 además exige que la Fase 0 dé verde.

La lista de lo que **no** se construye en Fase 1 está en `docs/IMPLEMENTATION_PLAN.md` §10.

---

## Comandos

**Gestor: `pnpm`.** Todavía no existe `package.json` — se fija en **B1**, con versiones **exactas** y tras verificar la matriz `zod@4` × `drizzle-zod` × `@hookform/resolvers` en un proyecto de prueba (`docs/IMPLEMENTATION_PLAN.md` §B1).

Comandos que la verificación de Fase 1 (§11 del plan) da por existentes:

```bash
pnpm test                          # Vitest. Debe incluir money.ts al 100% y el test de arquitectura
pnpm drizzle-kit migrate           # SIEMPRE primero contra un branch de Neon creado desde main
```

Con Vitest, para un archivo o un caso concreto:

```bash
pnpm vitest run src/core/money.test.ts          # un solo archivo
pnpm vitest run -t "reparto con resto"          # un solo caso por nombre
pnpm vitest run --coverage src/core/money.ts    # comprobar el umbral del 100%
```

**Migraciones: nunca `db push`.** Solo migraciones versionadas, y se aplican primero sobre un branch de Neon creado desde producción. En dinero, un esquema que cambió sin dejar rastro no es auditable.

---

## Cómo trabajamos

**Modalidad obligatoria en cada bloque: explico → escribo → recapitulo.**

1. **Concepto** — qué problema resuelve, qué alternativas hay, por qué se descartan. *Antes* de mostrar código.
2. **Código** — completo y comentado. Los comentarios explican el **porqué**, nunca el qué.
3. **Recapitulación** — al cerrar el bloque, las decisiones tomadas y su porqué, en corto y en lenguaje llano.

**La recapitulación no bloquea el avance.** El objetivo sigue siendo que Jean Paul entienda cada decisión, pero eso se consigue explicando mejor, no frenando el trabajo con un examen. Si algo no queda claro, se re-explica cuando lo pida.

No adelantar bloques. No implementar fases futuras "de paso".

---

## Git

- **Nunca hacer `commit` ni `push` sin avisar y obtener confirmación explícita.** Sin excepciones.
- Mensajes de commit en **inglés**, formato convencional (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
- Nunca commitear `.env`, claves, tokens ni capturas con datos financieros reales.

### Una rama por cambio — sin excepciones

Nunca se commitea directo a `main`. **Cada cambio o feature nueva vive en su propia rama**, nombrada por lo que hace:

| Tipo | Ejemplo |
| :--- | :--- |
| Bloque del plan | `feat/b3-auth`, `feat/b5-quick-add` |
| Corrección | `fix/money-rounding`, `fix/tz-month-boundary` |
| Documentación | `docs/update-metrics` |
| Mantenimiento | `chore/bump-drizzle` |

Una rama que acumula dos cambios sin relación no se puede revisar ni revertir por separado. Si a mitad de un bloque aparece un arreglo que no pertenece ahí, sale en su propia rama.

### `/code-review` antes de cada push — obligatorio

**Claude debe recordárselo a Jean Paul antes de cualquier `push`, siempre, aunque el cambio parezca trivial.** El orden es:

1. `git diff --staged` revisando que no se cuele ningún dato financiero real ni secreto.
2. **`/code-review`** sobre el cambio. Se leen los hallazgos y se decide qué se arregla.
3. `pnpm test` y `pnpm typecheck` en verde.
4. Recién entonces se pide confirmación para hacer push.

Saltarse el paso 2 porque "es un cambio pequeño" es exactamente cuando se cuela el bug: los cambios pequeños son los que no se leen dos veces. Si la revisión no encuentra nada, cuesta un minuto; si encuentra algo, se ahorró un bug en una app de dinero.

---

## Datos sensibles — el repo es PÚBLICO

`github.com/01REALES01/RealMoney` es público. Esto no es una recomendación, es una condición de trabajo:

- **Ningún extracto bancario real, recibo o captura con datos financieros se commitea jamás.** El golden set del OCR (Fase 2, ≥20 extractos) vive **fuera del repo**, en local. `.gitignore` cubre `fixtures/statements/`, `**/golden-set/`, `*.statement.*` y `receipts/`, pero el `.gitignore` es la segunda barrera, no la primera.
- **Los fixtures que sí se commitean van anonimizados**: montos alterados, comercios genéricos, sin números de cuenta ni nombres. Lo mismo para el corpus de SMS de los parsers.
- **Ninguna clave, token ni connection string.** Solo `.env.example` con los nombres de variable y valores vacíos.
- **Antes de cada push**, revisar `git diff --staged` buscando datos reales. Si aparece algo dudoso, se detiene el push y se pregunta.
- Un secreto que ya se subió a un repo público se considera **comprometido aunque se borre después**: se rota, no se borra.

## Idioma

| Qué | Idioma |
| :--- | :--- |
| Código: identificadores, tipos, funciones | **Inglés** |
| Comentarios y JSDoc | **Inglés** |
| Mensajes de commit, ramas, PRs | **Inglés** |
| UI (copy por defecto) | **Inglés** |
| UI (segundo idioma disponible) | **Español** |
| Documentos en `docs/` | **Español** (traducibles antes de hacer público el repo) |
| Conversación con el usuario | **Español** |

**i18n desde el bloque B5, no como retrofit.** Ningún string literal en JSX ni en respuestas de API: todo pasa por el catálogo de traducciones. Formateo de dinero y fechas siempre con `Intl.*` respetando el locale activo, nunca concatenación manual. Las rutas públicas necesitan `hreflang` en el sitemap.

---

## Arquitectura — el mapa

Detalle en `docs/PROJECT_SPEC.md` §4. Lo esencial para no equivocarse de capa:

**El flujo va en un solo sentido y nunca se salta un escalón:**

```
clients/telegram · app/(dashboard) · app/api/v1     ← traducen entrada/salida. CERO lógica
                          ↓
                  core/services/                    ← toda capacidad vive aquí
                          ↓
                  core/repositories/                ← ÚNICO lugar con acceso a `db`
                          ↓
              infrastructure/db (Drizzle → Neon)
```

`core/money.ts` y `core/categorization.ts` son funciones puras: se testean sin base de datos. `infrastructure/` guarda los adaptadores de terceros (`ai/gemini.ts`, `storage/r2.ts`, `messaging/telegram.ts`, `sms-parsers/`), y `core/services/notification.service.ts` es **agnóstico del proveedor** — por eso migrar a WhatsApp en Fase 7 es configuración, no reescritura.

```
src/
├── app/                     (auth)/ · (dashboard)/ · api/v1/ · manifest.ts · robots.ts · sitemap.ts
├── components/              ui/ · dashboard/ · ocr/
├── clients/telegram/        cliente delgado (P9)
├── core/                    money.ts · categorization.ts · idempotency.ts · repositories/ · services/
├── infrastructure/          db/ · ai/gemini.ts · storage/r2.ts · messaging/ · sms-parsers/
└── lib/telemetry.ts
```

**Las tres superficies de captura** (`docs/PROJECT_SPEC.md` §1.2 y §4.3) — entender esto explica casi todas las decisiones del backend:

| Nivel | Mecanismo | Coste | Rol |
| :--- | :--- | :--- | :--- |
| 1 | Shortcut → `POST /api/v1/quick-add` → motor de reglas con confianza alta → guardado silencioso | **0 toques** | **El destino** |
| 2 | Telegram con `inline_keyboard` cuando el motor no tiene confianza | 2 gestos | **Andamio.** Su frecuencia debe *caer* |
| 3 | Menú en el propio Shortcut | 1 + apertura | Opción, no default |

Por debajo, dos respaldos: **OCR de extractos** (cobertura retroactiva) y **entrada manual / texto en Telegram** (`12000 juan valdez`), que es el suelo para efectivo, Nequi y QR. La ingesta automática es **best-effort**: todo lo que entra por ahí es reconciliable contra el extracto. El sistema nunca asume que el canal automático es completo.

**Webhooks vs Server Actions.** Los formularios de la PWA van por Server Actions. `quick-add` y el `callback_query` de Telegram **tienen que ser Route Handler**: los llama un tercero.

**Orden obligatorio en el `callback_query`** (`docs/PROJECT_SPEC.md` §3.6): `answerCallbackQuery` **primero** para matar el spinner sin esperar a la DB → escribir → `editMessageText` con el resultado real. El ack neutro no afirma éxito; la edición del mensaje es la que comunica la verdad. El handler debe ser idempotente sobre `callback_query.id`: Telegram reintenta si no recibe 200.

**Realidades operativas que condicionan el diseño:** Neon tiene cold start de 300 ms a ~2.6 s p95 tras auto-suspensión, Gemini Flash tarda 2-6 s reales (no <1.5 s), el body de Vercel corta en ~4.5 MB (por eso las imágenes suben a R2 con signed URL y se comprimen en cliente) y el timeout del Shortcut es de 30 s. Ninguna de esas cifras es pesimismo: están verificadas en el spec §2 y §4.

---

## Arquitectura — reglas que bloquean el merge

**1. Ningún acceso a `db` fuera de `src/core/repositories/`.**
Toda función de repositorio recibe `userId: UserId` (branded type) como **primer parámetro obligatorio**. Es la barrera primaria de aislamiento multi-tenant: RLS está activo pero es defensa en profundidad, no lo que te protege. Hay un test de arquitectura en CI que falla si aparece un `db.` fuera de esa carpeta.

**2. Ningún cliente lleva lógica de negocio.**
La PWA, el bot de Telegram y la futura app nativa son **clientes delgados** sobre `src/core/services/`. Los handlers solo traducen entrada/salida. Todo lo que se puede hacer en Telegram se puede hacer en la app.

**3. Dinero: prohibido `float` y `double`.**
`BIGINT` en unidades menores, escala **100** siempre (`$45.000 COP` = `4500000`). Toda la aritmética vive en `src/core/money.ts`, con cobertura de tests del **100%** — es el único módulo con ese umbral y bloquea el merge. Conversión a texto solo en la capa de formateo, con `Intl.NumberFormat`.

**4. Fechas: agregaciones siempre con zona horaria.**
Almacenamiento en UTC (`TIMESTAMPTZ`). **Toda** agregación por periodo se hace en SQL:
```sql
date_trunc('month', transaction_date AT TIME ZONE p.timezone)
```
Agrupar en UTC hace que un gasto del 31 de agosto a las 20:00 en Bogotá caiga en septiembre. El cliente no puede arreglar una suma ya mal agrupada.

**5. Regex de usuario solo con `node-re2`.**
Nunca `RegExp` nativo sobre `merchant_pattern`. RE2 garantiza tiempo lineal; el motor nativo permite ReDoS que bloquea el event loop.

**6. Idempotencia por constraint, nunca por check-then-insert.**
UUID generado por el cliente + `UNIQUE` parcial + `ON CONFLICT DO NOTHING`. Un `SELECT` previo seguido de `INSERT` es un TOCTOU: dos peticiones concurrentes insertan las dos.

**7. La transacción se guarda antes de notificar.**
En el flujo de captura, primero se persiste y después se pide categoría. Perder un gasto es mucho peor que tenerlo sin etiqueta.

---

## Rendimiento — presupuesto duro

Objetivos en **p75 de usuarios reales** (no Lighthouse de laboratorio):

| Métrica | Objetivo | Falla a partir de |
| :--- | :--- | :--- |
| LCP | < 2.5 s | > 4.0 s |
| **INP** | **< 200 ms** | > 500 ms |
| CLS | < 0.1 | > 0.25 |

- **INP es el crítico.** Riesgo conocido: la tabla de revisión del OCR con 40 filas. Estado por fila y virtualización — nunca re-render global al marcar un checkbox.
- **Framer Motion está fuera** de la v1 (~50 KB gz).
- **Glassmorphism (`backdrop-filter`) está prohibido en listas con scroll.** Destruye el framerate en Safari iOS justo en la pantalla más usada. Permitido solo en tarjetas estáticas.
- Lighthouse CI con estos umbrales bloquea el merge.
- Medición real con la librería `web-vitals`, reportada a `docs/METRICS.md`.

---

## Descubrimiento y PWA

- **`noindex` obligatorio en toda ruta autenticada.** El producto es privado; Google no debe indexarlo.
- `robots.txt` (`app/robots.ts`) bloquea `/dashboard` y `/api`.
- `sitemap.xml` (`app/sitemap.ts`) solo con páginas públicas: todas 200, canónicas, sin `noindex`, con `hreflang`.
- JSON-LD `SoftwareApplication` en la landing.
- Manifest completo: `name`, `short_name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, icono ≥ **512×512**. Cualquier error rojo en DevTools → Application → Manifest bloquea la instalación en silencio.

---

## Métricas (P6)

Ninguna métrica se reporta sin **n, metodología y línea base**. Las líneas base se miden **antes** de optimizar; no son recuperables después. Las métricas malas también se publican. Todo va a `docs/METRICS.md` con el formato definido allí.

Nada de precisión agregada sin desglose: "94%" es decoración; "96% en monto, 91% en fecha, 88% en comercio (n=847, 20 extractos)" es evidencia.

---

## Los nueve principios

Referencia rápida. Desarrollo completo en `docs/IMPLEMENTATION_PLAN.md` §3.

| # | Principio |
| :--- | :--- |
| P1 | La gamificación premia **comportamientos**, nunca montos ni resultados |
| P2 | Ninguna alerta se dispara sobre **ruido** |
| P3 | El contenido financiero **se cita o no se dice** |
| P4 | **Educación, no asesoría** (roboadvisors = vacío regulatorio en Colombia) |
| P5 | Dos canales: captura instantánea por Telegram · insights en digest semanal |
| P6 | Ninguna métrica sin **n, metodología y línea base** |
| P7 | El presupuesto de rendimiento es un **límite duro** |
| P8 | La app es privada; el **SEO es solo para la superficie pública** |
| P9 | **Ningún cliente tiene lógica de negocio** |

---

## Stack fijado

Next.js 15 (App Router, runtime **Node**, región `iad1` — no Edge) · TypeScript strict · Neon Postgres · Drizzle con **`neon-serverless`** (WebSocket; `neon-http` no soporta transacciones) · Neon Auth (magic link + Google + Apple) · Cloudflare R2 · Telegram Bot API · Gemini Flash · **Zod v4** · `node-re2` · Upstash · Tailwind v4 + Radix + Lucide · Serwist · Vitest.

**Gestor de paquetes: `pnpm`.** Versiones **exactas**, sin rangos `^` — hay fricción conocida entre Zod v4, `drizzle-zod` y `@hookform/resolvers` (ver `docs/PROJECT_SPEC.md` §2).

---

## Testing — puertas de CI

| Qué | Umbral |
| :--- | :--- |
| `src/core/money.ts` | Cobertura **100%**. Bloquea merge |
| Test de arquitectura (`db.` fuera de repositorios) | Bloquea merge |
| Aislamiento entre usuarios (contra branch de Neon) | Obligatorio |
| Lighthouse CI (presupuesto P7) | Bloquea merge |
| Migraciones | Se aplican **primero** a un branch de Neon creado desde producción |

---

## Diseño

Sistema fijado en **`docs/DESIGN_SYSTEM.md`**. Es la fuente de verdad; ningún componente inventa valores.

Reglas que bloquean el merge:

- **Ningún literal de color en `src/components/`.** Solo variables CSS.
- **Ningún importe se renderiza fuera del componente `<Money>`.** Ni interpolación en JSX ni `toLocaleString` suelto. La regla del decimal y las cifras tabulares viven ahí.
- **Solo se animan `transform` y `opacity`.** Es lo que permite tener movimiento rico sin tocar el INP: el compositor las resuelve fuera del hilo principal. Animar `width`, `height`, `top`, `margin` o `background-color` está prohibido.
- **Sin Framer Motion.** Todo el movimiento es CSS + View Transitions API nativa. 0 KB de bundle.
- **`prefers-reduced-motion` respetado** siempre.
- **`backdrop-filter` prohibido en contenedores con scroll.** Permitido solo en la barra inferior fija y fondos de modal.
- **La paleta categórica no se amplía sin volver a correr el validador.** Está verificada contra deuteranopía; añadir un color a ojo la rompe.
- **Los colores semánticos están reservados** (positivo/aviso/serio/crítico) y nunca se usan como categoría de gráfica.
- Un solo degradado en toda la app: la tarjeta de saldo héroe.

Tema **oscuro únicamente en v1**. Los tokens del tema claro ya están validados y documentados, pero no se implementan hasta la Fase 3.
