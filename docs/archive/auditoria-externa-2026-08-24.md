# Auditoría Técnica y Evaluación de Arquitectura — ExpenseFlow v3.1.0
**Documento:** `auditoria_gm.md` (Actualización a v3.1.0)  
**Auditor:** Google DeepMind / Antigravity Engineering Review  
**Fecha:** 24 de agosto de 2026  
**Documentos evaluados:** `PROJECT_SPEC.md` (v3.1.0), `IMPLEMENTATION_PLAN.md`, `METRICS.md` y `AUDIT.md`  

---

## 1. Veredicto Ejecutivo v3.1.0

La versión **3.1.0 de `PROJECT_SPEC.md`** y su sincronización con `IMPLEMENTATION_PLAN.md` representan la versión **más madura, sólida y lista para producción** del proyecto:

1. **Sincronización Total (Bloque B0 Resuelto):** La brecha entre el spec y el plan de implementación quedó completamente cerrada. Ambos documentos manejan ahora el mismo roadmap de 8 fases (0 a 7), los mismos principios (P1-P9), la misma arquitectura de captura en 3 niveles y el mismo catálogo empírico de métricas.
2. **Defectos Críticos del DDL Subsanados:** Se corrigieron sutilezas técnicas de alto impacto que habrían causado fallos silenciosos en producción (resolución de `currency`, repetibilidad de `achievements`, índice compuesto de deduplicación).
3. **Resolución Elegante del Problema de Latencia (Cold Starts):** Se descartó con sensatez el ping cron (que habría consumido las 100 CU-h del free tier de Neon) y se adoptó el **patrón de respuesta desacoplada en Telegram** (`answerCallbackQuery` inmediato + `editMessageText` asíncrono).

> **Estado del Proyecto:** **APROBADO PARA INICIAR FASE 0 Y FASE 1 (BLOQUES B1-B9).** El diseño ya no contiene vacíos arquitectónicos que justifiquen retrasar la escritura de código.

---

## 2. Auditoría Detallada de los Nuevos Cambios (v3.0 → v3.1)

A continuación, la evaluación técnica de las 8 correcciones incorporadas:

### ✅ 1. Cadena de Resolución de `transactions.currency`
* **El problema previo:** `currency CHAR(3) NOT NULL` no tenía default ni regla de inferencia. Como el endpoint `/api/v1/quick-add` invocado por el Shortcut no envía `account_id`, la base de datos habría lanzado una violación de `NOT NULL` en el primer pago real.
* **La solución en v3.1:** Documentar formalmente la cadena `accounts.currency` (si hay cuenta) $\rightarrow$ `profiles.base_currency` (fallback obligatorio) en `ingestion.service.ts`.
* **Veredicto:** **Impecable.** Resuelve un bug bloqueante de producción en tiempo de diseño.

### ✅ 2. Restricción `UNIQUE NULLS NOT DISTINCT` en `achievements`
* **El problema previo:** `UNIQUE (user_id, code)` impedía volver a ganar logros periódicos como `streak_7d` o `monthly_budget_kept`, destruyendo el principio **P1** (premiar la consistencia continua, no solo el inicio).
* **La solución en v3.1:** `CONSTRAINT uq_achievement UNIQUE NULLS NOT DISTINCT (user_id, code, period_key)`.
* **Veredicto:** **Excelente uso de Postgres 15+.** `NULLS NOT DISTINCT` garantiza que los logros de una sola vez (`period_key = NULL`, ej: `first_export`) no se dupliquen, mientras que los semanales/mensuales (`period_key = '2026-W34'`) pueden ganarse en cada ciclo.

### ✅ 3. Corrección del Índice de Deduplicación `idx_tx_dedupe`
* **El problema previo:** El índice cubría `(user_id, amount_minor, transaction_date)`, pero la consulta de similitud de §6 filtra por comercio normalizado. Postgres habría tenido que hacer un *Filter* post-escaneo.
* **La solución en v3.1:** `CREATE INDEX idx_tx_dedupe ON transactions(user_id, amount_minor, merchant_normalized, transaction_date) WHERE deleted_at IS NULL;`.
* **Veredicto:** **Óptimo.** La consulta de detección de duplicados en ventana de 24h ahora es 100% soportada por índice.

### ✅ 4. Adición de `'shortcut_menu'` en `categorized_by`
* **El problema previo:** La columna `categorized_by` omitía el Nivel 3 (menú interactivo en el Shortcut de iOS), rompiendo la métrica de distribución por nivel en `METRICS.md`.
* **La solución en v3.1:** Se incluye formalmente en el `CHECK` constraint y en la telemetría.
* **Veredicto:** **Consistencia total entre base de datos y métricas.**

### ✅ 5. Realismo en los Gestos del Nivel 2 (Telegram)
* **La corrección:** Se ajustó la afirmación optimista de "1 toque" a **"2 gestos"** (Haptic Touch sobre el banner de iOS para desplegar el contenido + Tap en la categoría).
* **Veredicto:** **Honestidad de diseño.** Esto evita frustraciones operativas y refuerza por qué el Nivel 1 (cero toques) es el verdadero objetivo final.

### ✅ 6. Patrón de Desacoplamiento para `callback_query` (§3.6)
* **El mecanismo:**
  ```typescript
  // 1. Responde al cliente de Telegram de inmediato (mata el spinner en <100ms)
  await answerCallbackQuery(query.id);
  // 2. Ejecuta la escritura en DB (absorbe el cold start de Neon sin timeout)
  const result = await categorize(userId, txId, categoryId);
  // 3. Comunica el resultado real editando el mensaje
  await editMessageText(chatId, messageId, result.ok ? `✅ ...` : `⚠️ ...`);
  ```
* **Veredicto:** **Patrón Senior de alta resiliencia.** Elimina el riesgo de timeout en Telegram y mantiene informado al usuario si ocurre un error de base de datos.

### ✅ 7. Detección Temprana de Fricción con Zod v4
* **La verificación:** Se identificaron y documentaron los issues reales del ecosistema (`drizzle-zod#5659` y `@hookform/resolvers#842`), estableciendo la regla de fijar versiones exactas en el Bloque B1 en lugar de rangos flotantes (`^`).
* **Veredicto:** **Ahorro de horas de debugging.**

### ✅ 8. Descarte Justificado del Cron de Ping
* **El análisis:** Un cron que mantuviera caliente a Neon las 24 horas del día sumaría 730 horas/mes, sobrepasando las 100 CU-h del free tier.
* **Veredicto:** **Decisión correcta.** El patrón del punto 6 absorbe el cold start sin incurrir en costos ni agotar el tier gratuito.

---

## 3. Revisión de `IMPLEMENTATION_PLAN.md`

El plan de implementación (`IMPLEMENTATION_PLAN.md`) ha sido auditado en detalle:

* **Estructura Pedagógica (Explico $\rightarrow$ Escribo $\rightarrow$ Interrogo):** La inclusión de preguntas de control en cada bloque (B0 a B9) asegura que no se escriba código en automático, garantizando el aprendizaje de los fundamentos.
* **Secuencia de Fases:** El orden es impecable:
  * **Fase 0 (Validación empírica):** Corre en paralelo midiendo la cobertura real de Wallet sin bloquear el desarrollo.
  * **Fase 1 (Core mínimo):** Deja una app funcional en ~10-12 días con exportación a CSV, validación de dinero y telemetría.
  * **Fase 2 (OCR):** Carga el histórico y entrena el motor de reglas con cientos de comercios reales antes de construir la automatización.
  * **Fase 3 (Dashboard):** Se construye cuando ya existen datos reales que graficar.
  * **Fase 4 (Ingesta + Telegram):** Se implementa cuando el motor de reglas ya tiene datos aprendidos del OCR.
  * **Fases 5 a 7:** Insights estadísticos, RAG educativo y multi-tenant formal.

---

## 4. Matriz de Estado de Riesgos

| Riesgo Identificado Previamente | Estado en v3.1.0 | Mitigación Implementada |
| :--- | :---: | :--- |
| **1. Cold Starts de Neon en Telegram** | 🟢 **Resuelto** | Secuencia de respuesta desacoplada en §3.6 (`answerCallbackQuery` inmediato). |
| **2. Fricciones de Zod v4 con Drizzle** | 🟢 **Bajo Control** | Issues documentados; fijación de versiones exactas en Bloque B1. |
| **3. Desincronización Spec vs Plan (B0)** | 🟢 **Resuelto** | `PROJECT_SPEC.md` v3.1.0 y `IMPLEMENTATION_PLAN.md` completamente alineados. |
| **4. Falsas expectativas en iOS (Nivel 2)** | 🟢 **Resuelto** | Corregido a 2 gestos en spec y añadido como medición empírica en Fase 0 (§10.3). |
| **5. Riesgo de Scope Creep** | 🟡 **Controlado** | Las Fases 0 a 3 constituyen el "Core Sagrado". Fases 4-7 condicionadas al uso real de 4-8 semanas. |

---

## 5. Conclusión y Próxima Acción

El diseño técnico ha alcanzado el **punto óptimo de ingeniería**: es preciso, no tiene cabos sueltos en el modelo de datos, respeta los límites de los tiers gratuitos y está protegido contra errores humanos mediante el compilador y los tests.

### Siguiente Paso Recomendado:
Iniciar la ejecución técnica comenzando por:
1. **Fase 0 (Setup de 20 min):** Crear la automatización de Wallet en tu iPhone apuntando a `webhook.site` para empezar a registrar los 7 días de muestra.
2. **Fase 1 - Bloque B1:** Inicializar el proyecto con Next.js 15, Drizzle ORM, Neon DB y traducir el DDL de `PROJECT_SPEC.md` v3.1.0 a esquemas de Drizzle.
