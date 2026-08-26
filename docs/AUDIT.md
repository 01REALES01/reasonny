# Auditoría Técnica — RealMoney v1.0.0
**Auditor:** revisión de ingeniería independiente
**Fecha:** 24 de agosto de 2026
**Documento auditado:** `PROJECT_SPEC.md` (marcado "Aprobado para Implementación")

---

## 0. Veredicto

El stack está bien elegido y el modelo de datos es razonable en su esqueleto. Ese no es el problema.

El problema es que el documento está escrito como material de venta, no como especificación de ingeniería. Cada fila de la tabla de stack lista ventajas y ninguna desventaja. Cada afirmación de rendimiento (`<1.5s`, `<200ms`, `95% de fricción eliminada`, `90% de abandono`) aparece sin fuente ni medición. Un documento en estado "Aprobado para Implementación" que no contiene una sola estrategia de testing, ni rate limiting, ni plan de backup, no está aprobado para implementación: está aprobado para maquetación.

Hay **tres bloqueantes** que invalidan promesas centrales del spec, **catorce defectos concretos** en el SQL y los diagramas, y **seis ausencias** que en una app de dinero no son opcionales.

Lo más importante primero: la premisa de "captura de cero fricción" cubre bastante menos gasto del que el documento supone, y el mecanismo de seguridad que el documento presenta como garantía principal (RLS) será decorativo con la arquitectura descrita.

---

## 1. BLOQUEANTES

### B-1. RLS + Drizzle + API Key: la garantía de seguridad no existe tal como está descrita

El spec vende RLS como *"garantiza que ningún usuario pueda acceder a datos de otro a nivel de motor de base de datos, no solo a nivel de código"*. Con la arquitectura descrita, esto es falso por dos vías independientes:

**Vía 1 — Drizzle no habla PostgREST.** Drizzle se conecta por TCP directo con una connection string. Esa conexión usa el rol de la string (típicamente `postgres`, que es superusuario y tiene `BYPASSRLS`). Las políticas `USING (auth.uid() = user_id)` **no se evalúan nunca** en esa conexión, porque `auth.uid()` lee `current_setting('request.jwt.claims')`, que PostgREST inyecta y Drizzle no. Resultado: cada `db.select()` de tu aplicación devuelve filas de todos los usuarios, y tu única protección real es acordarte de escribir `.where(eq(transactions.userId, session.user.id))` en cada consulta. Es exactamente la protección "a nivel de código" que el documento afirma haber superado.

**Vía 2 — El endpoint de ingesta no tiene JWT.** `/api/v1/quick-add` se autentica con una API key propia. No hay sesión de Supabase, no hay JWT, `auth.uid()` es NULL. Si intentas insertar con el cliente normal, RLS bloquea el INSERT. La salida práctica es usar `service_role`, que bypassa RLS por diseño. Es decir: el endpoint más expuesto de todo el sistema —el único accesible desde internet con una credencial estática— es precisamente el que corre sin ninguna protección de base de datos, determinando el `user_id` en código de aplicación.

**Qué hacer.** Elige una y documéntala en el spec:
- **(a) Rol restringido + claims por transacción.** Conéctate con un rol sin `BYPASSRLS` y abre cada transacción con `SELECT set_config('request.jwt.claims', $1, true)`. Exige pooler en modo *transaction* y disciplina absoluta: una consulta fuera de transacción = fuga. Es lo correcto pero cuesta.
- **(b) Acepta que RLS es defensa en profundidad, no la primaria.** Usa `service_role` desde el servidor, centraliza TODO acceso en repositorios que reciban `userId` obligatorio por firma de tipos, y mantén RLS activo solo para el cliente Supabase del browser. Es honesto y suficiente para v1.
- No hagas lo que el spec hace: prometer (a) e implementar (b) sin saberlo.

### B-2. La cobertura real de la "captura de cero fricción" es una fracción del gasto

Verifiqué el mecanismo. Buenas noticias parciales: el trigger existe (iOS 17+, "Transaction", renombrado a "Wallet" en iOS 26), expone comercio, monto y tarjeta como entrada, y Bancolombia sí soporta Apple Pay en Colombia con Visa/Mastercard/Amex.

Las limitaciones que el spec no menciona:

| Limitación | Consecuencia |
| :--- | :--- |
| **Solo NFC.** El trigger no dispara en compras web ni in-app. | Rappi, Uber, suscripciones, PSE, marketplaces: todo manual. |
| **Dispara también en transacciones rechazadas.** | Gastos fantasma en tu balance sin lógica de reversión. |
| **Timeouts documentados.** El proveedor de la tarjeta notifica a Wallet con retraso (horas, en algunos casos); el trigger de Shortcuts expira antes. Bug reportado (FB14035016, FB16379100), sin respuesta de Apple a diciembre de 2025. Afecta especialmente a tarjetas Mastercard. | Pérdida silenciosa de transacciones. El usuario no se entera. |
| **Efectivo y Nequi/QR: 0% capturable.** | En Colombia esto no es un caso borde. |

El spec abre diciendo que el problema son los *"gastos hormiga"* —el café, la tienda de barrio—. En Colombia esos son desproporcionadamente efectivo y QR. **La solución no cubre el problema que el documento declara.** Esa es una brecha de producto, no de código, y es la más cara de descubrir tarde.

Además la UX del diagrama 4.1 no es la real. El paso *"Muestra notificación interactiva rápida con Categorías"* no existe: una automatización de Shortcuts con un menú de elección **abre la app Shortcuts en primer plano**. Y las automatizaciones disparadas por Mensajes están obligadas por Apple a notificar siempre; el toggle "Notify When Run" no se puede desactivar. El flujo real es: notificación → tap → se abre Shortcuts → menú → tap. Son 3-4 segundos y un cambio de contexto, no "1 toque en 1 segundo".

**Qué hacer.** Antes de escribir una línea de la Fase 2, haz el experimento de 30 minutos: crea la automatización de Wallet, apúntala a un webhook de prueba (webhook.site sirve), y vive con ella una semana. Mide qué porcentaje de tus gastos reales capturó. Si es menos del 40%, la Fase 2 no es la fase 2 — es un complemento, y la entrada manual rápida y el OCR son el producto.

### B-3. La idempotencia está especificada tres veces de forma distinta, y ninguna es correcta

- §3.2 dice `SHA256(user_id + amount_cents + merchant_normalized + timestamp_window_10min)`
- §6 dice `sha256(userId + amount + normalize(merchant) + roundToHour(date))`
- §6 dice también *"rango menor a 15 minutos"*

Tres definiciones incompatibles en el mismo documento. Peor: el bucketing por redondeo está roto por diseño. Dos peticiones a las 10:59 y 11:01 caen en buckets distintos y **no se detectan como duplicado**; es el fallo clásico del redondeo temporal como clave.

Y el falso positivo es peor que el falso negativo: dos cafés idénticos seguidos (mismo monto, mismo comercio, misma hora) son una compra real duplicada que el sistema **descartará silenciosamente**. Estás perdiendo dinero real del usuario para resolver un problema de reintentos de red.

Son dos problemas distintos y hay que separarlos:
1. **Reintento del mismo evento** → el cliente (el Shortcut) genera un UUID por evento y lo manda como `Idempotency-Key`. Determinista, exacto, sin heurística.
2. **Duplicado genuino** → detección por similitud, presentada al usuario como *sugerencia* ("¿esto es un duplicado?"), nunca descarte automático.

**Y el defecto de implementación:** `idempotency_hash VARCHAR(64)` no tiene constraint `UNIQUE`, y `idx_transactions_idempotency` no es único. Un check-then-insert sin constraint es un TOCTOU: dos peticiones concurrentes (exactamente el caso que la idempotencia debe cubrir) pasan ambas la verificación e insertan las dos. Necesitas:

```sql
CREATE UNIQUE INDEX idx_tx_idem ON public.transactions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
```
y `INSERT ... ON CONFLICT DO NOTHING RETURNING *`. Sin esto la idempotencia es decorativa.

---

## 2. DEFECTOS CONCRETOS EN EL ESQUEMA Y LOS DIAGRAMAS

Lista accionable. Cada uno es verificable contra el documento.

**D-1. `gen_random_bytes()` requiere `pgcrypto`, que nunca se habilita.** El DDL habilita `uuid-ossp` y usa `gen_random_bytes(32)` en el DEFAULT de `api_key`. El script falla al ejecutarse. (De paso: `uuid-ossp` es innecesario en PG13+; usa `gen_random_uuid()` nativo, o UUIDv7 si vas a PG18, por localidad de índice.)

**D-2. La columna `status` no existe.** El diagrama 4.1 dice `INSERT INTO transactions (status = 'confirmed')`. No hay columna `status` en el DDL. Y sí hace falta: el flujo OCR necesita `pending_review`, y los pagos con tarjeta de crédito tienen autorización → liquidación, donde el monto **cambia** (propinas, hoteles, gasolineras).

**D-3. `updated_at` nunca se actualizará.** `DEFAULT NOW()` solo aplica al INSERT. Sin un trigger `BEFORE UPDATE`, la columna miente para siempre.

**D-4. No hay modelo de transferencias.** `type` acepta `'transfer'` pero solo existe un `account_id`. Una transferencia tiene dos patas y afecta dos balances. Sin `transfer_group_id` (o `counterparty_account_id`), las transferencias inflan tus gastos o quedan rotas. Es un fallo de modelado, no un detalle.

**D-5. No hay moneda en `transactions`.** `accounts.currency` existe, pero `account_id` es NULLABLE con `ON DELETE SET NULL` → transacción huérfana sin moneda determinable. Y si algún día tienes COP y USD, todo `SUM(amount_cents) GROUP BY category` suma peras con manzanas. Decide ahora: o declaras "mono-moneda en v1" explícitamente, o añades `currency` + `fx_rate` congelado + `amount_base_cents`.

**D-6. `amount_cents` sin constraint.** El comentario dice *"Siempre en enteros positivos"*. Un comentario no es una restricción. Falta `CHECK (amount_cents > 0)`. Igual `merchant`: `NOT NULL` no impide `''`; falta `CHECK (length(trim(merchant)) > 0)`.

**D-7. `monthly_budget_cents` en `categories` reescribe la historia.** Es un valor único por categoría. Si cambias el presupuesto de "Comida" en agosto, los reportes de julio mienten retroactivamente. Necesitas una tabla `budgets(user_id, category_id, period_start, amount_cents)`.

**D-8. `accounts.current_balance_cents` es un campo denormalizado sin mecanismo de mantenimiento.** Nada en el spec dice cómo se actualiza, y el endpoint devuelve `new_balance` al Shortcut. Se desincroniza en el primer edit, delete o transferencia. Para un usuario personal con unos miles de filas, `SUM()` sobre un índice es instantáneo — **elimina la columna en Fase 1** y calcula. Añade caché cuando midas que hace falta, no antes.

**D-9. Regex de usuario = ReDoS.** `merchant_pattern` con `is_regex = TRUE` deja que el usuario inyecte su propia regex. Un patrón catastrófico ejecutado en Node bloquea el event loop de tu servidor; en Postgres (`~`) el backtracking hace lo mismo. En un producto multi-tenant es un DoS de una línea. Mitigación: usa RE2 (`node-re2`), o no expongas regex libre y quédate con substring/glob.

**D-10. Políticas RLS sin `(select ...)` y sin `TO authenticated`.** `USING (auth.uid() = user_id)` se reevalúa **por fila**. Envolver como `USING ((select auth.uid()) = user_id)` permite que Postgres lo trate como constante e use el índice. Es una diferencia de rendimiento de órdenes de magnitud en tablas grandes, y está documentada por Supabase. Añade también `TO authenticated` para no evaluar políticas contra el rol `anon`.

**D-11. Faltan índices que el propio spec necesita.** No hay índice en `categorization_rules(user_id)` — el motor de categorización lo consulta en cada ingesta. Tampoco en `transactions(user_id, category_id)`, que es la consulta principal del dashboard.

**D-12. Falta `UNIQUE(user_id, name, type)` en `categories`.** Nada impide dos categorías "Comida". Y `is_system_default` junto a `user_id NOT NULL` significa que duplicas las categorías por defecto en cada usuario — decisión defendible (permite editarlas), pero entonces el nombre de la columna describe mal lo que hace.

**D-13. `receipt_image_url TEXT` sin infraestructura ni políticas.** No hay Supabase Storage en el spec, ni buckets, ni políticas. Y una URL pública a un recibo bancario es una fuga de datos. Debe ser bucket privado + signed URLs con expiración.

**D-14. Inconsistencia de rutas.** El diagrama 4.2 usa `/api/v1/ocr/parse`; la Fase 3 dice `/api/v1/ocr/parse-statement`. Menor, pero es el tipo de detalle que indica que el documento no se releyó antes de marcarlo como aprobado.

---

## 3. RIESGOS DE ARQUITECTURA Y AFIRMACIONES NO SOSTENIDAS

**R-1. "Despliegue global en Edge" es la decisión equivocada aquí.** Drizzle sobre `postgres-js` usa TCP; no corre en Edge runtime. Y aunque corriera: tu base de datos vive en **una** región. Distribuir el cómputo globalmente contra una DB single-region *empeora* la latencia, no la mejora. Para un usuario en Colombia con Supabase en `us-east-1`, lo correcto es fijar las funciones en Node runtime, región `iad1`. La tabla de stack vende lo contrario.

**R-2. `<200ms` para una llamada a Gemini es imposible.** El spec propone, cuando el regex de SMS falla, pasar el texto crudo a Gemini Flash "en <200ms". Solo el RTT hasta la API de Google más el time-to-first-token supera ese número. Espera 1-3s. Y `<1.5s` para OCR de un extracto completo es optimista; el rango realista es 2-6s. Estos números no vienen de una medición — quítalos o mídelos.

**R-3. Los límites de Vercel van a morder en el flujo OCR.** Dos, concretos:
- **Body size.** Las funciones serverless de Vercel limitan el cuerpo de la petición (~4.5 MB). Una captura de un iPhone reciente se acerca peligrosamente, y un batch de varias lo revienta. Solución: comprimir en cliente, o subida directa a Supabase Storage con signed URL y mandar solo la URL.
- **Timeout.** El OCR de varias imágenes puede exceder el `maxDuration`. Necesitas streaming de resultados o un job en background, no una petición síncrona.

**R-4. Zod v3 con Gemini no es "Structured Output Schema (Zod)".** Gemini acepta un subconjunto de OpenAPI 3.0 Schema, no Zod. Necesitas `zod-to-json-schema` y podar los campos no soportados a mano. Es un detalle de implementación que el spec da por resuelto y no lo está. Además, Zod v4 lleva estable desde 2025 y trae `z.toJSONSchema()` nativo: elegir v3 en 2026 es elegir a propósito la versión vieja y el trabajo manual.

**R-5. No hay estrategia contra la alucinación de montos.** Es un LLM leyendo dinero, y el spec propone *"confirmación en 1 solo clic"* sobre un lote entero. Ese diseño empuja al usuario a aprobar a ciegas exactamente los datos que más necesitan revisión. Mínimo: `confidence` por fila, resaltado visual de las filas dudosas, y un cross-check de que la suma extraída cuadre con el total del extracto cuando aparezca en la imagen.

**R-6. Clean Architecture aquí es sobre-ingeniería.** `core/domain` + `core/services` + `infrastructure` + Repository + Unit of Work, para un desarrollador y un usuario, es indirección que te va a costar velocidad sin devolverte nada. Drizzle **ya es** tu capa de acceso a datos; envolverla en repositorios para poder "cambiar de base de datos" resuelve un problema que no vas a tener. Conserva `core/services` —la lógica de dinero y categorización sí merece estar aislada y ser testeable sin DB— y tira el resto. El valor está en poder testear, no en el árbol de carpetas.

**R-7. Privacidad y marco legal, ausentes.** Mandas extractos bancarios completos a Google. Para ti solo, es tu decisión. Para un SaaS multi-tenant en Colombia, la Ley 1581 de 2012 (habeas data) regula el tratamiento y la **transferencia internacional** de datos personales financieros, y exige consentimiento informado y política de tratamiento publicada. No es un detalle a resolver en la Fase 4: condiciona si puedes cobrar por esto.

**R-8. "Sin costes de servidor fijo" tiene fecha de caducidad.** El free tier de Supabase pausa el proyecto tras inactividad; Pro son $25/mes, Vercel Pro $20/mes, más el consumo de Gemini. Para ti solo, gratis. "Escalable a miles de usuarios" y "sin costes fijos" no coexisten — hace falta una sección de costos con el punto en que el free tier se rompe.

**R-9. Glassmorphism + Framer Motion contra "cero bundle overhead" y "ultra rápida".** Framer Motion son ~50KB gzip. Y `backdrop-filter` sobre listas largas con scroll en Safari iOS destruye el framerate — que es justo tu pantalla principal (lista de transacciones). Elige: o el efecto, o los 60fps en la vista que más vas a usar.

---

## 4. LO QUE FALTA POR COMPLETO

Esto es lo que más me preocupa en un documento marcado como aprobado.

**F-1. Cero estrategia de testing. Ni una línea. En una app de dinero.** Mínimo indispensable:
- Corpus real de SMS de Bancolombia (guárdalos desde hoy) con tests del parser.
- Tests unitarios de toda la aritmética monetaria.
- Tests de las políticas RLS — Supabase soporta pgTAP, y una policy sin test es una policy que no sabes si funciona.
- Golden set de imágenes de extractos con una métrica de precisión, para saber si un cambio de prompt mejoró o empeoró el OCR.

**F-2. Cero rate limiting.** `/api/v1/quick-add` es público, autenticado con una credencial estática que vive en texto plano dentro de un Shortcut. El endpoint de OCR **cuesta dinero real por invocación**: abuso = tu factura. Rate limit por usuario y cuota de OCR, ambos en Fase 2.

**F-3. La gestión de API keys es insegura.** La key se guarda en texto plano, es una sola por usuario, sin hash, sin prefijo, sin rotación, sin `last_used_at`, sin revocación, sin expiración. Un volcado de la tabla `profiles` entrega acceso de escritura a las cuentas de todos. Guarda `sha256(key)`, muéstrala una sola vez, tabla `api_keys` aparte con múltiples keys revocables. (Nota: `encode(gen_random_bytes(32),'hex')` produce exactamente 64 caracteres y llena el `VARCHAR(64)`; si añades un prefijo tipo `ef_live_`, desborda.)

**F-4. Cero manejo de errores end-to-end.** Si el webhook falla, el Shortcut ya se cerró y **la transacción se pierde en silencio**. Sumado a los timeouts documentados del trigger de Wallet (B-2), vas a perder gastos sin enterarte — el peor fallo posible en una app de finanzas, porque erosiona la confianza en todo el dataset. Necesitas logging estructurado, alertas, y una vista de "ingestas fallidas" que puedas revisar.

**F-5. Cero backup y cero export.** El export a CSV/JSON es la función que retiene usuarios en apps de finanzas y la que te protege a ti de tu propio bug. Va en Fase 1, no está en ninguna.

**F-6. Cero métricas de éxito.** Dijiste "si le veo futuro, escalarla". ¿Cómo lo vas a medir? Defínelo ahora, antes de construir, o vas a decidir con la sensación en vez de con datos. Sugerencia concreta: *"≥70% de mis transacciones de 4 semanas consecutivas capturadas sin entrada manual, y sigo abriendo el dashboard al menos 3 veces por semana en la semana 6"*. Si no lo cumples tú, no lo cumple nadie.

---

## 5. EL ROADMAP ESTÁ INVERTIDO

Dijiste que primero tiene que servirte a ti. El roadmap hace lo contrario: pone el dashboard —la única razón por la que abrirías la app— en la Fase 4, y construye la infraestructura multi-tenant de SaaS en la Fase 1, para una hipótesis de negocio que aún no has validado.

Y el orden de las fases 2 y 3 está al revés en relación calidad/esfuerzo. La Fase 2 (Shortcuts) es la de mayor riesgo técnico y menor cobertura (B-2). La Fase 3 (OCR) captura *retroactivamente todo* —efectivo incluido, si sale en el extracto— y no depende de ninguna API frágil de Apple.

Reordenamiento propuesto:

```
FASE 0  (un fin de semana)  — Validar antes de construir
 ├── Automatización de Wallet apuntando a webhook.site. Una semana de uso real.
 └── Medir: % de gastos capturados. Esto decide si la Fase 2 existe.

FASE 1  (semana 1) — Algo que YA uses
 ├── Esquema + auth + entrada manual rápida (3 campos, un botón).
 ├── Lista de transacciones + total del mes. Feo pero funcional.
 └── Export CSV. Desde el día uno.

FASE 2  (semana 2-3) — OCR: el mayor valor por esfuerzo
 └── Sube el extracto del mes → revisa → confirma. Resuelve el histórico completo.

FASE 3  (semana 4) — Dashboard y presupuestos
 └── Ahora que tienes datos reales que graficar.

FASE 4  — Ingesta automática, si y solo si la Fase 0 dio verde
 └── Con reintentos, cola de fallos y las limitaciones de B-2 asumidas por diseño.

FASE 5  — Multi-tenant en serio: keys hasheadas, rate limits, política de datos.
```

Mantén `user_id` y RLS desde el principio: son baratos y quitarlos después duele. Lo que hay que aplazar no es la arquitectura multi-tenant, es la *inversión* en multi-tenant.

---

## 6. QUÉ ESTÁ BIEN

Para que la lista anterior tenga escala:

- **Enteros para dinero, prohibición de float.** Correcto y explícito. Es el error nº1 en apps financieras y no lo cometiste.
- **El stack es coherente y actual.** Next.js + Drizzle + Supabase + Postgres es una elección sólida, no moda.
- **TIMESTAMPTZ en UTC.** Correcto. (Con la salvedad de §7 abajo.)
- **Strategy Pattern para los parsers bancarios.** Justificado: los formatos de SMS cambian por banco y con el tiempo. Es el sitio donde la abstracción sí se paga.
- **Motor de categorización en 3 niveles con la IA como *fallback*, no como primera opción.** Buen criterio de ingeniería y de costos.
- **Pensar en idempotencia desde el diseño.** La implementación está mal (B-3), pero la mayoría de specs ni la mencionan.

---

## 7. UN DETALLE QUE VA A ROMPER LOS TOTALES DE FIN DE MES

§6 dice guardar en UTC y hacer *"conversión a la zona horaria del usuario en el cliente"*. Eso rompe cualquier agregación hecha en el servidor: un gasto del 31 de agosto a las 20:00 en Bogotá es el 1 de septiembre en UTC. Tu "total de agosto" calculado en SQL va a excluirlo, y el cliente no puede arreglar una suma que ya vino mal agrupada.

Toda agregación por periodo debe hacerse así:

```sql
date_trunc('month', transaction_date AT TIME ZONE p.timezone)
```

Es un bug de una línea que produce números incorrectos justo en la pantalla que más vas a mirar.

---

## Fuentes

- [Transaction triggers in Shortcuts — Apple Support](https://support.apple.com/guide/shortcuts/transaction-trigger-apd65c67538a/ios)
- [Shortcuts Automation Trigger Transaction Timeouts — Apple Developer Forums](https://developer.apple.com/forums/thread/765516)
- [Shortcuts | Transaction Automation | iOS 18 — Apple Developer Forums](https://developer.apple.com/forums/thread/758053)
- [All Automations Now Run Immediately In Shortcuts (Notifications Required) — Matthew Cassinelli](https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications/)
- [Apple Pay automation — Graham Haley](https://grahamhaley.co.uk/2024/11/19/apple-pay-automation/)
- [Apple Pay Bancolombia](https://www.bancolombia.com/pagos/apple-pay)
- [Apple Pay — Bancos participantes en Colombia](https://www.apple.com/co/apple-pay/banks/co/es-co.html)
