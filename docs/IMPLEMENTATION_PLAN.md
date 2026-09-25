# Plan de Implementación — RealMoney

> Documento de trabajo. Recoge todas las decisiones tomadas y su justificación.
> Complementa a `PROJECT_SPEC.md` (arquitectura) y `AUDIT.md` (defectos corregidos de la v1).
> Al aprobarse, este documento se copia al proyecto como `IMPLEMENTATION_PLAN.md`.
>
> **Estado (25-sep-2026):** en producción con 3 usuarios reales. Fases 1 y 4 hechas; el orden de lo que sigue cambió y está registrado en §4.5.

## Índice

1. [Contexto y objetivos](#1-contexto-y-objetivos)
2. [Cómo trabajamos](#2-cómo-trabajamos)
3. [Principios no negociables (P1-P9)](#3-principios-no-negociables)
4. [Registro de decisiones y sus contrapartidas](#4-registro-de-decisiones)
5. [Plataforma: PWA, rendimiento y descubrimiento](#5-plataforma)
6. [Fase 0 — Validación](#6-fase-0--validación)
7. [Fase 1 — Construcción](#7-fase-1--construcción)
8. [Catálogo de métricas](#8-catálogo-de-métricas)
9. [Fases 2-7](#9-fases-2-7)
10. [Fuera de alcance y diferidos](#10-fuera-de-alcance-y-diferidos)
11. [Verificación](#11-verificación)

---

## 1. Contexto y objetivos

Jean Paul construye RealMoney con dos objetivos simultáneos: que la app le sirva de verdad, y aprender las habilidades que le interesan profesionalmente (AI engineering, automatización, software engineering). Si sale una app que funciona pero no entiende por qué cada decisión está tomada así, el plan falló.

**Qué es realmente este proyecto.** No es un gestor de gastos. La capa CRUD es el sustrato; el sistema es: ingesta por eventos con reconciliación → motor de insights con rigor estadístico → notificación proactiva por mensajería → contenido educativo con grounding verificado. Esa combinación no es un proyecto de portafolio común, pero la diferenciación es **condicional a la ejecución**: un bot a medias con consejos alucinados es peor que un CRUD limpio. El listón para "IA en una app de dinero" es más alto, no más bajo.

**El entregable no es solo la app: son los números.** El valor está en "obtuve X% de precisión, medido así, contra esta línea base", no en "construí esto". Eso obliga a instrumentar desde la Fase 1 — las líneas base no se capturan retroactivamente.

**Riesgo principal del plan: dispersión.** Son ocho fases y la tentación será saltar a la 4 o la 6 porque son las divertidas. El orden importa: el motor de insights no tiene nada que analizar sin datos, y el RAG no tiene a quién enrutar sin arquetipos derivados de gasto real.

### Núcleo Sagrado — la regla que acota el alcance

Adoptada de la auditoría externa (`auditoria_gm.md`, Riesgo 1), que la formuló mejor que la versión original de este plan.

| Fases | Estatus | Condición |
| :--- | :--- | :--- |
| **0, 1, 2, 3** | **Núcleo Sagrado. Intocable.** | Se construyen sí o sí. Son la herramienta de uso diario |
| **4, 5, 6, 7** | **Proyectos derivados** | Cada una requiere **4-8 semanas de uso sostenido** del núcleo antes de empezarse. La Fase 4 además exige que la Fase 0 dé verde |

No es una recomendación blanda: si el núcleo no se está usando a diario, empezar la Fase 4 es construir sobre algo que ya fracasó. La condición se verifica contra el dato de uso diario de `METRICS.md`, no contra la sensación.

> **Revisión del 25-sep-2026.** La Fase 4 se construyó antes que la 2 y la 3, porque la captura por SMS resultó viable antes que el OCR. La condición que la regla protegía sí se cumple: el núcleo se usa **16 de 17 días** (`METRICS.md`, «Uso diario»). Con 3 usuarios reales, el orden de lo que queda se decidió de nuevo en **§4.5**. La regla sigue vigente para todo lo demás: un cambio de orden se registra ahí, con su porqué, no se hace en silencio.

### Criterio de éxito

- **Personal:** ≥70% de transacciones capturadas sin entrada manual completa durante 4 semanas consecutivas, y el dashboard se abre ≥3 veces por semana en la semana 6.
- **Producto:** solo tras 8 semanas cumpliendo lo anterior se considera abrir a terceros. Antes de eso, "SaaS" es hipótesis, no requisito.

---

## 2. Cómo trabajamos

Modalidad: **explico → escribo → recapitulo**. Sin excepción, en todos los bloques.

1. **Concepto** — qué problema resuelve, qué alternativas existen, por qué se descarta cada una. Antes de ver código.
2. **Código** — completo y comentado, con los comentarios explicando el *porqué*, no el *qué*.
3. **Recapitulación** — al cerrar el bloque, las decisiones tomadas y su porqué, en corto y en lenguaje llano.

La recapitulación **no bloquea el avance**. La comprensión se consigue explicando mejor, no frenando el trabajo con un examen. Si algo no queda claro, se re-explica cuando se pida.

*(Cambio del 25-ago-2026: la versión anterior exigía responder 2-4 preguntas de control antes de pasar de bloque. Frenaba el trabajo sin mejorar la comprensión, y se retira.)*

---

## 3. Principios no negociables

Se fijan ahora porque condicionan el esquema y la arquitectura desde la Fase 1.

### P1 — La gamificación premia comportamientos, nunca montos ni resultados

La evidencia es consistente: la gamificación en finanzas funciona sobre **consistencia y comportamiento**, y fracasa sobre **cantidades y métricas comparativas**. Las rachas que castigan imprevistos reales, los badges por monto depositado y las barras atadas a patrimonio producen vergüenza precisamente en quien más necesita la herramienta.

| Descartado | Adoptado |
| :--- | :--- |
| "Ahorraste 8% → badge" | "Registraste gastos 7 días seguidos" |
| "Eres un gastador impulsivo" | "Tus gastos se concentran en fin de semana" (dato, no juicio) |
| Barra de progreso sobre patrimonio | "Ajustaste tu presupuesto cuando no cuadró" (premia honestidad) |

Razón del descarte del primero: con ingreso variable (freelance, común en Colombia) un 8% de ahorro puede ser simplemente que pagaron tarde o que no hubo imprevisto. Premiar ruido enseña al usuario que los insights son decorativos. Y la ausencia de badge en un mes malo aterriza como vergüenza.

Los arquetipos de usuario existen **solo para enrutar contenido**, nunca como etiqueta mostrada.

### P2 — Ninguna alerta se dispara sobre ruido

El gasto semana-a-semana es altamente variable: si el arriendo cae en una semana, una comparación ingenua dispara una alerta sin sentido. Una alerta exige que la desviación supere la varianza histórica, sobre una línea base que excluya recurrentes y one-offs grandes. Herramientas: mediana móvil, MAD, ajuste por estacionalidad. Una alerta falsa cuesta más que una omitida — a la tercera, el usuario silencia el canal para siempre.

### P3 — El contenido financiero se cita o no se dice

Corpus curado por nosotros (Banco de la República, SFC, Asobancaria, DANE). El modelo no navega libremente. Pipeline: recuperación → generación → **verificación de cita** (comprobar que la afirmación aparece en el fragmento recuperado; es el paso que todo el mundo se salta). Si la recuperación no trae nada relevante, el sistema **calla**. "No tengo información sobre eso" es comportamiento correcto, no fallo.

### P4 — Educación, no asesoría

La SFC promueve explícitamente la educación financiera; la asesoría algorítmica (roboadvisors) está identificada como **vacío regulatorio** en Colombia. Contenido educativo con fuente citada: correcto. Recomendar productos financieros concretos ("mueve tu dinero a X"): fuera de alcance en todas las fases.

### P5 — Dos canales distintos, con economías distintas

**No confundir la captura con los insights.** Son flujos separados y aplicarles la misma regla fue un error de diseño inicial.

| | **Captura por transacción** | **Digest de insights** |
| :--- | :--- | :--- |
| Cuándo | Por evento, instantáneo | Semanal |
| Volumen | ~100/mes | ~4/mes |
| Texto | Dinámico e imprescindible | Encaja en plantilla |
| Canal | **Telegram**, y **WhatsApp** desde el bloque W1 (§4.5) | **WhatsApp** (alcance) |

**Captura:** instantánea siempre. Sin límite de frecuencia, porque en Telegram no cuesta y en WhatsApp casi tampoco (ver abajo).

**Insights:** semanal, nunca diario. Coincide con el mejor diseño conductual: el nudge diario se silencia.

**Lo que cuesta WhatsApp de verdad** (verificado el 25-sep-2026 contra la documentación de Meta; corrige la versión anterior de este párrafo, que decía que desde el 1-oct-2026 se cobrarían los mensajes dentro de la ventana):

- **Gratis:** todo lo que no es plantilla dentro de la ventana de 24 h que abre el usuario al escribir, y las plantillas utility enviadas dentro de esa ventana. Eso cubre «12000 almuerzo», `/hoy` y cualquier respuesta del bot.
- **Se paga:** una plantilla que el negocio envía **fuera** de la ventana. Utility en Colombia ≈ **US$0,0008** por mensaje; marketing ≈ US$0,0125. La pregunta de categoría tras un SMS, si el usuario no ha escrito en el día, es exactamente eso.
- Estimado con 3 usuarios: unas 90 plantillas al mes ≈ **US$0,07/mes**. Se vuelve a medir contra la tarifa oficial antes de construir W1.

La restricción que sigue vigente es de **forma**, no de coste: fuera de la ventana solo se puede mandar una plantilla aprobada, con texto fijo, variables en huecos y botones fijos. Los botones de categoría de cada usuario no caben en ella: la pregunta proactiva se convierte en una plantilla con un botón «Elegir categoría» que abre la ventana, y la lista llega después. Son **3 gestos**, no los 2 de Telegram, y se mide.

### P6 — Ninguna métrica se reporta sin n, metodología y línea base

Un número sin las tres cosas no es evidencia, es decoración, y no sobrevive la primera pregunta de alguien con experiencia.

- **La línea base se mide antes de optimizar.** No es recuperable después.
- Todo resultado va a `METRICS.md` con fecha, tamaño de muestra, método y qué cambió respecto a la medición anterior.
- **Las métricas malas también se publican.** "Wallet capturó el 34%, así que degradé esa fase a complemento" demuestra criterio; un fracaso escondido no demuestra nada.
- Nada de precisión agregada sin desglose: "94% de precisión" es inútil; "96% en monto, 91% en fecha, 88% en comercio (n=847 campos, 20 extractos)" es evidencia.

### P7 — El presupuesto de rendimiento es un límite duro, no una aspiración

Objetivos en p75 de usuarios reales:

| Métrica | Objetivo | Pobre a partir de |
| :--- | :--- | :--- |
| LCP | < 2.5s | > 4.0s |
| **INP** | **< 200ms** | > 500ms |
| CLS | < 0.1 | > 0.25 |

**INP es el crítico para esta app.** El riesgo concreto está en la tabla de revisión por lotes del OCR: 40 filas donde cada cambio de checkbox re-renderiza la tabla entera produce tareas largas que revientan el umbral. Mitigación desde el diseño: estado por fila y virtualización, no re-render global.

Consecuencia sobre el stack ya decidida: **Framer Motion fuera de la v1** (~50KB gz). **Glassmorphism fuera de la lista de transacciones** — `backdrop-filter` con scroll largo en Safari iOS destruye el framerate justo en la pantalla más usada; se permite solo en tarjetas estáticas del dashboard.

### P8 — La app es privada; el SEO es solo para la superficie pública

El dashboard está tras login y **debe** llevar `noindex`. Google no indexa el producto y eso es correcto. El SEO aplica únicamente a landing, precios y contenido público.

Nota importante sobre prioridad: los Core Web Vitals como factor de ranking se evalúan sobre **CrUX**, que requiere volumen de usuarios reales. Con un usuario no hay datos de CrUX, así que **los CWV no afectan al ranking hasta que haya tráfico**. Se cumplen igual por UX y porque el rendimiento no se retrofitea barato.

### P9 — Ningún cliente tiene lógica de negocio

**Telegram, la PWA y (en su día) la app nativa son clientes delgados sobre los mismos servicios.** No son conjuntos de funciones distintos.

- Toda capacidad vive en `core/services/`. El handler de Telegram y el componente de React **solo** traducen entrada/salida.
- **Todo lo que se puede hacer en Telegram se puede hacer en la app.** Sin excepciones. Protege de quedarse fuera de los datos si Telegram falla, y es necesario cuando se abra a terceros que no lo usen.
- Consecuencia práctica: la app nativa futura es **un tercer cliente**, no una reescritura. Y un test del servicio cubre las tres superficies.

Lo que *sí* cambia entre superficies es dónde cada una es mejor, no lo que puede hacer:

| Tarea | Mejor superficie | Por qué |
| :--- | :--- | :--- |
| Capturar y categorizar 1 transacción | **Telegram** | Notificación nativa, sin abrir app (2 gestos) |
| Consulta puntual | **Telegram** | Lenguaje natural, instantáneo |
| Revisar 40 filas de OCR | **PWA** | Un chat es lineal; no se puede escanear |
| Gráficas y tendencias | **PWA** | Comparación visual |
| Corregir un error de hace semanas | **PWA** | Buscar y editar |
| Reglas, presupuestos, logros | **PWA** | Configuración, no conversación |

Regla general: Telegram gana en lo puntual y en el momento; la PWA gana en revisar, comparar, corregir y configurar.

---

## 4. Registro de decisiones

Decisiones tomadas con sus contrapartidas explícitas. Un spec sin contrapartidas es material de marketing.

### 4.1 Por qué OCR antes que Shortcuts

**A favor del OCR primero:**

1. **Cobertura.** El Shortcut captura solo NFC. El OCR captura todo lo que salga en el extracto: retiros, compras online, PSE, transferencias, suscripciones, débitos automáticos.
2. **Riesgo y control.** El Shortcut depende de una API de Apple con bugs abiertos sin respuesta desde 2025.
3. **Arranque en frío.** Al terminar el Shortcut la app tiene **cero datos** y necesita un mes para decir algo. Con OCR subes seis meses de extractos el día 1 y ya tienes histórico y gráficas con significado. Es la diferencia entre abandonar en la semana 2 y quedarse enganchado — el problema que la app dice resolver.
4. **Entrena el motor de reglas.** El OCR da cientos de comercios de golpe, así que las reglas se construyen sobre datos reales. Al revés, el motor no tiene nada que aprender y cada captura pregunta la categoría a mano: la versión mala del Shortcut.
5. **Es la red de seguridad del Shortcut.** El modo de fallo del canal automático es perder transacciones en silencio. El OCR es el mecanismo de reconciliación. El verificador debe existir antes que lo verificado.
6. **Esfuerzo.** OCR ≈ 3-4 días. El Shortcut son endpoint + API keys + rate limiting + idempotencia + atajo + parsers + cola de reintentos + log de fallos.

**En contra del OCR — contrapartidas asumidas:**

1. **No es cero fricción, es fricción por lotes.** Sigue exigiendo acordarse, capturar, subir, revisar y confirmar: 10-15 min al mes. Y "acordarse una vez al mes" es el tipo de hábito que falla. Tres meses olvidados = backlog = abandono. Mismo modo de fallo, periodo más largo.
2. **Llega tarde para cambiar comportamiento.** Te dice el 31 lo que gastaste el 3. **El OCR es contabilidad; el Shortcut es comportamiento.** Objetivos distintos.
3. **Los errores del LLM son sutiles, no ruidosos.** `$45.000` → `$450.000` se ve plausible en una tabla. La gente aprueba en automático después de ~10 filas. El dato del Shortcut viene de Wallet y es *estructuralmente correcto*: ventaja de fiabilidad real del Shortcut.
4. **Costo variable.** Cada pasada cuesta. El Shortcut cuesta ~cero por transacción. A escala, el OCR es tu COGS.
5. **Radio de exposición.** Una captura lleva saldo, número de cuenta, nombre y 30 transacciones más. El Shortcut manda un comercio y un monto.
6. **Depende del banco.** Capturas con scroll = filas cortadas. Bancolombia trunca comercios.
7. **Tampoco controlas ambos extremos.** No controlas el diseño de la app de Bancolombia ni el versionado del modelo de Gemini. La diferencia real frente al Shortcut no es robustez: es que **tienes un eval set para detectar la regresión**, y contra el bug de Apple no tienes nada.

**Conclusión:** el OCR va primero porque arranca los datos, entrena las reglas y reconcilia el otro canal. El final del camino son los dos; son complementarios por diseño.

### 4.1.b Respuesta a la auditoría externa (`auditoria_gm.md`, 24-ago-2026)

**Contexto de lectura.** El documento declara en su cabecera haber evaluado `PROJECT_SPEC.md` **v2.0.0**, no la v3.0. Además, su Riesgo 4 (desincronización documental) reproduce casi punto por punto la tabla del bloque **B0** de este plan: no es un hallazgo independiente, es nuestra propia lista de problemas conocidos devuelta. Y el membrete institucional es atribución inventada — el contenido se juzga por sus méritos, no por la cabecera.

**Adoptado:**

| Hallazgo | Qué se cambió |
| :--- | :--- |
| **Riesgo 1 — alcance** | Regla del **Núcleo Sagrado** (§1). Mejor formulada que la versión original de este plan |
| **Riesgo 3 — ergonomía de Telegram en iOS** | El mejor hallazgo del documento, y **corrige una afirmación nuestra**: "1 toque" → **2 gestos**. Corregido en §5.0, en la tabla de P9 y en `PROJECT_SPEC.md` §1.2. Añadida prueba empírica a la Fase 0 |
| **Riesgo 2 — mecanismo** | `answerCallbackQuery` inmediato, en `PROJECT_SPEC.md` §3.6. **Con una corrección que la auditoría omite:** responder primero sin editar después el mensaje deja invisible un fallo de escritura. El ack es neutro; la edición comunica el resultado real |
| **Riesgo 5 — Zod v4** | Era vago ("pueden tener restricciones"). Verificado y concretado con issues reales. Verificación bloqueante en B1 |

**No adoptado:**

- **Cron de ping para mantener Neon caliente** (Riesgo 2, mitigación 2). Contradice el diagnóstico de la propia auditoría: cita el límite de 100 CU-h/mes del free tier y acto seguido propone mantener el cómputo despierto, lo que no cabe en ese presupuesto. Se reconsidera solo con una medición de horas activas reales.
- **La cifra de "3-4 segundos"** de timeout del spinner de Telegram. Sin fuente. La documentación describe que el spinner puede persistir **hasta un minuto** sin `answerCallbackQuery`. El mecanismo es correcto; el número parece inventado.

**Lo que la auditoría no encontró.** Cero defectos en el SQL, el manejo de dinero, el modelo de seguridad y el modelo de datos: cincuenta líneas de elogio contra cinco riesgos, todos operativos o de proceso. Un DDL escrito de una sola pasada no está impecable. Una revisión propia posterior encontró cuatro defectos concretos —`currency` sin cadena de resolución, `UNIQUE` que contradecía **P1**, índice de deduplicación incompleto y `categorized_by` sin valor para el Nivel 3— todos corregidos en `PROJECT_SPEC.md` v3.1.

**Lección de proceso:** una auditoría que valida la narrativa se siente bien y no enseña nada. Al pedir revisiones externas, hay que pedir explícitamente que se ataque el artefacto —el DDL, los índices, las constraints— y no el documento.

### 4.2 Cobertura real de la captura automática (verificado, agosto 2026)

| Mecanismo | Captura | NO captura |
| :--- | :--- | :--- |
| **Automatización de Wallet** (iOS 17+, "Wallet" desde iOS 26). Expone comercio, monto y tarjeta. Bancolombia soporta Apple Pay en Colombia (Visa/MC/Amex). | Pagos NFC con tarjetas en Wallet | Compras web e in-app. Efectivo. Nequi/QR. PSE. Transferencias. Tarjeta física sin NFC. |
| **Automatización de SMS** | SMS bancarios parseables por regex | Push de la app del banco (iOS no permite leerlos). Correo (no hay trigger). |

Limitaciones documentadas del trigger de Wallet: **solo NFC**; **dispara en transacciones rechazadas**; **timeouts** por retraso del emisor (bugs FB14035016, FB16379100, sin respuesta de Apple a diciembre de 2025, peor en Mastercard). UX real: una automatización con menú **abre Shortcuts en primer plano**; Apple obliga a notificar siempre. Son 3-4 segundos y un cambio de contexto, no "1 toque".

**Consecuencia:** la ingesta automática es *best-effort* y siempre reconciliable contra el extracto vía OCR.

### 4.3 Stack y contrapartidas

| Capa | Elección | Contrapartida asumida |
| :--- | :--- | :--- |
| Framework | Next.js 16 (App Router) | Runtime **Node, región `iad1`** — no Edge global: la DB vive en una región y distribuir el cómputo empeora la latencia. |
| Base de datos | **Neon** | Cold start **300ms-2.6s (p95)** tras auto-suspensión. En free tier no se puede mantener caliente (730h/mes vs 100 CU-h). Ventaja decisiva: **branching** — cada migración y cada test corre contra copia instantánea de producción. |
| ORM | Drizzle + **`neon-serverless`** (WebSocket) | `neon-http` **no soporta transacciones** y el batch-create de la Fase 2 las necesita. Fijado ahora para evitar migración dolorosa. |
| Auth | **Neon Auth** (Managed Better Auth) | IDs de usuario **UUID**. Métodos: código de un solo uso por correo + Google (Neon Auth no tiene magic link). **Apple** diferido hasta que la App Store esté sobre la mesa. |
| Archivos | **Cloudflare R2** (privado + signed URLs) | Neon no tiene object storage. Recibos nunca por URL pública. |
| OCR y lenguaje | Gemini Flash / Flash-Lite, **plan de pago** | Latencia real **2-6s** en visión, no <1.5s. Schema de salida: un subconjunto, se verifica contra el modelo. Un solo adaptador para OCR (F2) y texto libre (L1). |
| Validación | **Zod v4** | `z.toJSONSchema()` nativo. Zod v3 obligaba a conversión manual del schema. |
| Notificaciones | **Telegram → WhatsApp** | Capa agnóstica del proveedor. Se desarrolla contra Telegram (API gratis, sin aprobaciones, misma arquitectura) y se despliega en WhatsApp con la lógica ya probada. Evita el peaje de iteración de las plantillas. |
| Rate limiting | Cuota en la propia base (Upstash diferido a la Fase 7) | El endpoint de OCR cuesta dinero por invocación: sin límite, el abuso es tu factura. Con pocos usuarios, contar las importaciones del día basta. |

### 4.4 Modelo de seguridad

La v1 afirmaba que RLS garantizaba aislamiento a nivel de motor. Falso con esta arquitectura: Drizzle conecta por TCP con rol propietario, `auth.user_id()` nunca se evalúa; y el endpoint de ingesta no tiene JWT, así que solo funciona con `service_role`, que bypassa RLS por diseño.

- **Barrera primaria:** capa de repositorios. Branded type `UserId` obligatorio como primer parámetro. Test de arquitectura en CI que falla si aparece `db.` fuera de `core/repositories/`.
- **Defensa en profundidad:** RLS escrito y activo, adoptado de verdad en Fase 7 con rol sin `BYPASSRLS` y JWK validado. Advertencia de Neon: sin validación JWK, `request.jwt.claims` es modificable por cualquier usuario de base de datos.
- **API keys:** tabla aparte, `sha256(key)` almacenado, formato `rm_live_<32 bytes hex>`, mostrada una sola vez, con `last_used_at` / `revoked_at` / `expires_at`.
- **ReDoS:** las regex de usuario se ejecutan **solo con `node-re2`** (sin backtracking, tiempo lineal). Si RE2 no está disponible, se elimina la opción de regex.

### 4.5 Reordenamiento con usuarios reales (25-sep-2026)

**Qué cambió.** La app tiene 3 usuarios además del autor, **todos con iPhone**. El plan se escribió para un solo usuario, y tres de sus supuestos dejaron de valer:

1. **El coste de WhatsApp.** El criterio de escalado (§9, Fase 5) lo justificaba con «coste por mensaje sin beneficio». Medido contra la tarifa real, los mensajes que abre el usuario son gratis y el resto cuesta ≈ US$0,07/mes a este volumen (P5). La barrera era el coste, y el coste ya no existe.
2. **Los datos de terceros.** La Ley 1581 se había dejado para la Fase 7, «al abrir a terceros». Ya hay terceros.
3. **El plan gratuito de Gemini.** Era aceptable con los extractos del autor. En el gratuito Google puede usar lo que se le envía para mejorar sus productos; con datos de otros, no.

**Orden nuevo**, y el porqué de cada lugar:

| # | Bloque | Por qué aquí |
| :--- | :--- | :--- |
| H1 | **Habeas data mínimo** | Es una obligación que ya existe, no una función. Va primero y es pequeño |
| L1 | **Capa LLM agnóstica del canal** | Resuelve dos cosas que hoy fallan: el parser estricto rechaza «gasté 12 lucas en el almuerzo», y las consultas solo existen como comandos. La reusan W1 y F2 |
| W1 | **WhatsApp** | El canal que los usuarios ya tienen abierto. Llega como adaptador fino sobre L1 y la capa de notificación |
| F2 | **Fase 2 — OCR** | Sigue siendo núcleo y sigue planificada completa (§9). Llega con el adaptador de Gemini ya construido y probado en L1 |
| A1 | **Captura en Android** | **Diferida a propósito.** Todos los usuarios tienen iPhone; primero se prueba el flujo completo ahí y después se amplía el rango |
| — | Fases 3, 5, 6, 7 | Sin cambios de contenido; van después |

**Lo que NO cambia:** la Fase 2 no se descarta ni se degrada — se mueve dos lugares. La auto-categorización (4,8 %) sigue siendo la métrica central, y el OCR sigue siendo lo que más comercios le enseña al motor.

**El coste de esta decisión, dicho:** la medición de 4 semanas del canal Telegram (`METRICS.md`, «Captura por canal», hasta el 21-oct-2026) queda contaminada en cuanto L1 y W1 estén en producción. Se registra el día del cambio como delta, no se reinterpreta la línea base.

---

## 5. Plataforma

### 5.0 Separación de superficies: captura vs gestión

**La notificación instantánea de cada pago no sale de la PWA.** Sale del Shortcut de iOS o del bot de Telegram, ambos nativos. Las limitaciones de push y de background de las PWA en iOS **no tocan el camino de captura**. Esto no es un parche: es poner cada trabajo donde su restricción no molesta.

| Superficie | Tecnología | Qué hace |
| :--- | :--- | :--- |
| **Captura** | iOS Shortcut + bot de Telegram | Registrar y categorizar sin abrir nada |
| **Gestión** | PWA | Dashboard, subida OCR, revisión por lotes, presupuestos, reglas |

#### Arquitectura de captura en tres niveles

Diseñada para que el **Nivel 1 absorba la mayoría** de transacciones con el tiempo.

**Nivel 1 — Auto-categorización silenciosa. Cero toques.**
El Shortcut dispara y hace POST sin pedir nada. El motor de reglas asigna categoría con confianza alta y se guarda. Es el objetivo final: tras unas semanas "Éxito" siempre es Supermercado y no pregunta nunca. No es "un toque", es *ninguno*. Es la razón de ser del motor de reglas, y la razón de que el OCR vaya antes: es lo que lo entrena con cientos de comercios reales.

**Nivel 2 — Telegram con botones inline. Dos gestos, sin abrir la app.**
Cuando el motor no tiene confianza suficiente:

```
☕ $12.000 — Juan Valdez
¿Categoría?
[ Café ]  [ Comida ]  [ Otra ]
```

El botón dispara un `callback_query` directo al webhook — no publica mensaje en el chat, no abre ninguna app. El payload admite 1-64 bytes UTF-8, suficiente para `cat:<uuid>`.

**Coste real: dos gestos, no uno.** Los botones inline son *contenido del mensaje*, no acciones de notificación, así que en iOS el banner no los expone directamente: hace falta **pulsación larga para expandir → toque en la categoría**. La versión anterior de este plan decía "un toque" y era optimista. Sigue sin abrir ninguna app y sigue siendo muy superior a entrar a la PWA. **Se mide en la Fase 0** — si resultan ser tres gestos o si obliga a abrir Telegram, el Nivel 1 pasa de deseable a imprescindible.

**Orden de respuesta obligatorio** (`PROJECT_SPEC.md` §3.6): `answerCallbackQuery` **primero**, sin esperar a la base de datos — sumando cold start de Vercel y de Neon la escritura puede tardar, y Telegram deja el spinner hasta un minuto. Luego se escribe, y el resultado real se comunica **editando el mensaje**. Responder primero y escribir después sin ese paso final le diría "recibido" al usuario sobre algo que puede fallar en silencio.

**Regla de diseño crítica:** la transacción se guarda **antes** de enviar el mensaje. El botón solo asigna categoría. Si se ignora la notificación, el gasto no se pierde: queda sin categorizar. Perder un gasto es mucho peor que tenerlo sin etiqueta.

**Nivel 3 — Menú en el propio Shortcut.** Categorizar en el instante del pago sin esperar a Telegram. Contrapartida: **abre Shortcuts en primer plano**. Disponible como opción, no como default.

#### Por qué Telegram y no una notificación propia (todavía)

La acción **`Mostrar notificación` de Shortcuts es explícitamente no accionable**: no admite botones ni personalización. En iOS, una notificación con botones exige una app que haya registrado `UNNotificationCategory` con acciones. No hay forma de saltárselo. Solo hay tres caminos:

| | **Telegram** | **Pushcut** | **App nativa (Capacitor)** |
| :--- | :--- | :--- | :--- |
| Botones en la notificación | Sí, inline | Sí, al expandir | Sí, y Time Sensitive |
| Abre alguna app | No | No | No |
| Contenido dinámico por transacción | Gratis, ilimitado | **Requiere Pro** (el free tier son 3 notificaciones fijas: inservible) | Gratis |
| Costo | $0 | Suscripción Pro | **$99/año** Apple Developer |
| Trabajo | Horas | Horas | Semanas (Capacitor + APNs) |

**Decisión: Telegram ahora, nativo después.** La capa es agnóstica del proveedor, así que la app nativa entra como tercer cliente cuando haya datos para justificarla. Nota que elimina un obstáculo: **para uso personal no hace falta revisión de la App Store** — se instala vía Xcode o TestFlight. El Guideline 4.2 solo aplica si se distribuye.

#### Lo que esta arquitectura NO resuelve

Todo depende de que el trigger de Wallet dispare. Telegram no arregla los timeouts documentados de Apple (FB14035016). Si el trigger no salta, no hay notificación ni captura. Por eso la Fase 0 sigue siendo obligatoria y la reconciliación por OCR sigue siendo necesaria.

**Y el reencuadre que importa: la mejor notificación es ninguna notificación.** El Nivel 1 es el destino; el Nivel 2 es el andamio mientras el motor de reglas aprende, y su frecuencia debe **caer** con el tiempo. Si a los seis meses sigue haciendo falta tocar un botón en cada transacción, el motor de reglas falló. De ahí que la tasa de auto-categorización sea la métrica central de la Fase 4.

### 5.1 Decisión: PWA ahora, nativo solo si algo lo justifica

**PWA primero.** Capacitor más adelante y solo cuando una capacidad nativa concreta lo exija (Live Activities, widgets, biométrico). Construir para la App Store especulativamente son semanas por un canal de distribución que aún no se necesita.

**Límites de PWA en iOS a asumir:** no hay Background Sync, Periodic Background Sync ni Background Fetch. Afecta directo a la cola de reintentos — solo puede reintentar con la app abierta. El push web exige instalación en pantalla de inicio.

**Sinergia a favor:** como las notificaciones van por Telegram/WhatsApp, el push web es irrelevante. La capa de mensajería esquiva la peor limitación de las PWA en iOS.

**Si algún día se va a nativo con Capacitor**, tres obstáculos conocidos:
- **Guideline 4.2 (funcionalidad mínima):** Apple rechaza envoltorios sin integración nativa genuina. Hace falta algo real (notificaciones nativas, biométrico, widgets).
- **Fricción del stack:** Capacitor empaqueta assets estáticos, pero App Router con Server Components y Server Actions necesita servidor. Apuntar a un servidor remoto es justo el patrón que dispara el 4.2. Resoluble, pero hay que diseñarlo.
- **Sign in with Apple obligatorio** si se ofrece Google.

### 5.2 Instalabilidad PWA (requisitos duros)

- HTTPS
- Service worker registrado (Serwist)
- Manifest válido con: `name`, `short_name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, icono ≥ **512×512**
- Chrome exige además heurística de interacción (~30s) antes de disparar `beforeinstallprompt`
- Validación: DevTools → Application → Manifest. **Cualquier error rojo bloquea la instalación en silencio.**

### 5.3 Descubrimiento (solo superficie pública)

- `robots.txt`: permite público, **bloquea** `/dashboard` y `/api`
- `app/sitemap.ts`: solo páginas públicas, todas 200, canónicas, sin `noindex`
- JSON-LD `SoftwareApplication` en la landing
- Metadata API de Next para title/description/OG
- **`noindex` explícito en todas las rutas autenticadas**

---

## 6. Fase 0 — Validación

Se monta el **día 1 en ~30 minutos** y luego solo recoge datos durante una semana. Corre en paralelo con la Fase 1; no bloquea nada.

1. Endpoint receptor en `webhook.site`.
2. iPhone → Atajos → Automatización → **Wallet** ("Transaction" en iOS 17-25). Todas las tarjetas Bancolombia. Acción: `Obtener contenido de URL` → POST con comercio, monto, tarjeta, fecha. **Ejecutar inmediatamente**.
3. Durante 7 días, registro paralelo en notas de **todo** gasto real (efectivo, Nequi, online, PSE incluidos).

**Salida — primera línea base del proyecto:** `capturados_por_wallet / gastos_totales`.

| Resultado | Consecuencia |
| :--- | :--- |
| ≥60% | Fase 4 es un pilar. Se construye completa. |
| 40-60% | Fase 4 como complemento del OCR, no vía principal. |
| <40% | Fase 4 opcional. El OCR es el producto; la entrada manual, el respaldo. |

Registrar también transacciones **tardías** (>10 min) y de compras **rechazadas**. Todo a `METRICS.md`.

**Prueba adicional 1 — silenciamiento del banner.** Con la automatización en "Ejecutar inmediatamente", comprobar si aparece el toggle **"Notificar al ejecutar"** y si puede desactivarse para el trigger de Wallet. Es determinante para el **Nivel 1** de §5.0: si se puede silenciar, la captura es literalmente invisible; si no, cada pago deja un banner. Apple lo fuerza en las automatizaciones de Mensajes, pero para Wallet está sin confirmar — se verifica aquí, no se asume.

**Prueba adicional 2 — ergonomía real del Nivel 2 (10 minutos).** No requiere nada del backend:

1. Crear un bot con `@BotFather` y obtener el token.
2. Enviarse a uno mismo un mensaje con `inline_keyboard` de tres botones vía `curl` a `sendMessage`.
3. Con el iPhone **bloqueado**, observar el banner y contar los gestos reales hasta pulsar una categoría.

**Salida:** número de gestos (esperado: 2 — pulsación larga + toque) y si obliga a abrir Telegram. Va a `METRICS.md`.

**Por qué importa:** si son 3 gestos o abre Telegram, el Nivel 2 deja de ser cómodo y el motor de reglas del Nivel 1 pasa de deseable a imprescindible — lo que sube la prioridad de la Fase 2, porque es el OCR quien lo entrena.

---

## 7. Fase 1 — Construcción

Objetivo: al final de la semana existe una app que **ya se usa a diario**, aunque sea fea.

### B0 — Sincronización de documentos

Antes de escribir código, los documentos del proyecto deben decir lo mismo. Hoy se contradicen.

**Entregable: cuatro archivos en `/Users/reales/Desktop/Investigation/`**

| Archivo | Acción | Contenido |
| :--- | :--- | :--- |
| `PROJECT_SPEC.md` | **Actualizar** v2.0 → v3.0 | La arquitectura: *qué* se construye. Con las doce divergencias de abajo corregidas |
| `IMPLEMENTATION_PLAN.md` | **Crear** | Este plan: *cómo y en qué orden*. Bloques, preguntas de control, P1-P9, métricas |
| `AUDIT.md` | **No tocar** | Registro fechado de los defectos de la v1. Su valor está en no reescribirse |
| `METRICS.md` | **Crear vacío** | Estructura de **P6**: fecha, n, método, línea base, delta. Se llena desde la Fase 0 |

`PROJECT_SPEC.v1.backup.md` se queda como está: es el original, sirve de contraste con el audit.

**`PROJECT_SPEC.md` → v3.0.** Cambios a incorporar, todos decididos en conversación posterior a la v2.0:

Divergencias **verificadas** leyendo la v2.0 completa:

| Sección | Qué cambia |
| :--- | :--- |
| §1.2 Solución | Añadir la arquitectura de captura en tres niveles (§5.0 de este plan). Hoy lista tres mecanismos de entrada sin el Nivel 1 como destino ni el Nivel 2 como andamio |
| §2 Stack | Añadir **Telegram Bot API**. Auth: hoy dice "magic links, passkeys, Apple Sign In" — **falta Google**. Añadir `node-re2` (inconsistencia interna: §3.4 lo usa pero §2 no lo lista) |
| §3.2 Seguridad | **Referencia obsoleta:** dice "RLS con `pg_session_jwt` (Fase 5)". Ahora es **Fase 7** |
| §4.3 Flujos | El diagrama termina en feedback háptico. Reemplazar por: pago → `quick-add` → motor de reglas → (confianza alta: guardado silencioso \| confianza baja: Telegram con inline keyboard → `callback_query`) |
| §5 Datos | Añadir `telegram_chat_id` en `profiles`; tabla de logros para **P1**; `pgvector` previsto para Fase 6 |
| §6 Fiabilidad | Sin cambios. Ya correcta |
| §7 Testing | Sin cambios. Ya correcta |
| §8.1 Costos | Añadir Telegram ($0) y el corte del 1 de octubre de 2026 de WhatsApp |
| §8.3 Legal | **Referencia obsoleta:** dice "requisito de la Fase 5". Ahora es **Fase 7** |
| §9 Roadmap | **Contradicción directa.** Hoy son 6 fases (0-5) con Fase 5 = multi-tenant. Reemplazar por las **8 fases (0-7)** de este plan |
| §10 Decisiones abiertas | Añadir la prueba del banner de notificación de la Fase 0 (¿se puede silenciar el trigger de Wallet?) |
| **Nueva §11** | Los nueve principios **P1-P9** |
| **Nueva §12** | Plataforma: PWA vs nativo, instalabilidad, presupuesto de rendimiento (**P7**), descubrimiento (**P8**) |

**`AUDIT.md`** — no se toca. Es un documento histórico de los defectos de la v1 y su valor está en ser un registro fechado, no en estar al día.

**`METRICS.md`** — se crea vacío con la estructura de **P6** (fecha, n, método, línea base, delta).

- **Control:** ¿por qué `AUDIT.md` no se actualiza, si parte de su contenido ya está resuelto?

### B1 — Infraestructura y modelo de datos

`drizzle.config.ts`, `src/infrastructure/db/{client,schema}.ts`, `drizzle/migrations/`

Traducir el DDL de `PROJECT_SPEC.md` §5 a Drizzle: nueve tablas con sus `CHECK`, el índice único parcial de idempotencia y el trigger `set_updated_at()`.

**Verificación bloqueante antes de fijar `package.json`** (auditoría externa, Riesgo 5 — verificado y concretado): probar la matriz `zod@4` × `drizzle-zod` × `@hookform/resolvers` en un proyecto de prueba antes de comprometerse. Problemas conocidos: `drizzle-zod` 0.8.3 con `coerce: true` convierte `number` y `date` en `unknown` ([drizzle-orm#5659](https://github.com/drizzle-team/drizzle-orm/issues/5659)); `@hookform/resolvers` falla el overload a nivel de tipos con ciertos pares de versiones ([resolvers#842](https://github.com/react-hook-form/resolvers/issues/842)). **Fijar versiones exactas, no rangos.** Si la matriz no cierra, la salida es Zod v4 solo en el borde de Gemini y v3 en formularios — pero eso se decide con el resultado en la mano, no de antemano.

- **Concepto:** separación compute/storage en Neon y qué implica scale-to-zero. Branching como sustituto de staging. Migraciones versionadas vs `db push` y por qué en dinero solo vale lo primero.
- **Decisión a justificar:** `neon-serverless` sobre `neon-http`.
- **Control:** ¿por qué el índice único de idempotencia es *parcial* (`WHERE idempotency_key IS NOT NULL`)? ¿Qué pasaría con las manuales si no lo fuera?
- **Control:** `achievements` usa `UNIQUE NULLS NOT DISTINCT (user_id, code, period_key)`. ¿Qué se rompía con un `UNIQUE (user_id, code)` normal, y qué principio contradecía?
- **Control:** `transactions.currency` es `NOT NULL` sin default. Una transacción de `quick-add` no trae `account_id`. ¿De dónde sale la moneda y qué pasaría si nadie la resolviera?

### B2 — `core/money.ts`

`src/core/money.ts`, `src/core/money.test.ts`

El módulo más pequeño y el único con cobertura obligatoria del 100%. Suma, resta, reparto, formateo con `Intl.NumberFormat`, parseo de entrada (`"45.000"`, `"45000"`, `"$45.000"`).

- **Concepto:** por qué `0.1 + 0.2 !== 0.3` en IEEE 754 y por qué descuadra un balance. Unidades menores con escala fija 100. El caso COP, que no usa centavos en la práctica pero se almacena igual por consistencia multi-moneda.
- **Control:** si divides `100` entre `3` en unidades menores, ¿dónde va el céntimo sobrante y por qué no puede desaparecer?

### B3 — Autenticación

`src/app/(auth)/`, `src/lib/auth.ts` — Neon Auth con **magic link + Google + Apple**.

- **Concepto:** cookie httpOnly vs JWT en localStorage y por qué lo segundo es un error de seguridad. Flujo OAuth 2.0 / OIDC: qué viaja en cada paso y por qué existe el `state`. Qué es el esquema `neon_auth` y por qué **no** se pone FK dura contra `users_sync`.
- **Control:** los IDs son `TEXT`, no `UUID`. ¿Qué se rompería si hubiera dejado `UUID`? ¿Por qué añadir Apple ahora y no cuando toque la App Store?

### B4 — Capa de repositorios y aislamiento

`src/core/repositories/*.ts`, `src/core/types.ts`, `tests/architecture.test.ts`

Resuelve el bloqueante **B-1** del audit.

- **Concepto:** por qué RLS no protege con esta arquitectura. Branded types para hacer imposible el error en compilación en vez de confiar en la disciplina. Defensa en profundidad vs barrera primaria.
- **Control:** RLS queda activado pero no es lo que te protege. ¿Por qué dejarlo en vez de borrarlo?

### B5 — Entrada manual rápida

`src/app/(dashboard)/nuevo/page.tsx`, `src/app/actions/transactions.ts` — tres campos, un botón, dos toques desde la pantalla de inicio.

- **Concepto:** RSC vs cliente y dónde va cada cosa. Server Actions vs Route Handler, y por qué los webhooks de la Fase 4 (`quick-add` y el `callback_query` de Telegram) **sí** tienen que ser Route Handler. Validación con Zod en la frontera.
- **Control:** ¿por qué validar con Zod en el servidor si el formulario ya valida en el navegador?

### B6 — Lista y total del mes

`src/app/(dashboard)/page.tsx`, `src/core/services/analytics.service.ts`

- **Concepto:** aquí vive el bug de zona horaria. Agregación en SQL con `date_trunc('month', transaction_date AT TIME ZONE p.timezone)`. Demostrar el fallo primero con un gasto del 31 de agosto a las 20:00 Bogotá — cae en septiembre si se agrupa en UTC — y luego arreglarlo.
- **Control:** ¿por qué el cliente no puede corregir esta suma después de recibirla?

### B7 — Export CSV

`src/app/api/v1/export/route.ts`

- **Concepto:** por qué el export va en Fase 1 y no al final: es lo que te protege de tu propio bug y lo que hace que confíes en meter datos. Respuesta en streaming, `Content-Disposition`, por qué no se construye el CSV entero en memoria.
- **Control:** ¿qué pasa con 50.000 transacciones si se genera el string completo antes de responder?

### B8 — PWA y presupuesto de rendimiento

`src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts`, config de Serwist

Cumplir **P7** y **P8** desde el principio, no como retrofit.

- Manifest completo según §5.2, service worker con Serwist, verificación en DevTools.
- `robots.txt` + `sitemap.xml` + `noindex` en rutas autenticadas.
- Presupuesto de rendimiento en CI: Lighthouse CI con umbrales que bloquean el merge.
- **Concepto:** qué es INP y por qué sustituyó a FID. Por qué se mide en p75 de usuarios reales y no en laboratorio. Qué es CrUX y por qué no aplica todavía con un usuario. Cómo una tarea larga en el hilo principal destruye el INP.
- **Control:** la tabla de revisión del OCR (Fase 2) tendrá 40 filas con checkbox. ¿Por qué es el mayor riesgo de INP del proyecto y qué se hace al respecto?

### B9 — Instrumentación y captura de líneas base

`src/lib/telemetry.ts`, `METRICS.md`

El bloque que hace posible todo reclamo medible posterior. Sin esto, las fases 2-6 no pueden demostrar mejora contra nada.

- **Qué se instrumenta:**
  - **Tiempo de registro manual**: ms desde apertura del formulario hasta submit exitoso. Es *la* línea base contra la que se medirán el OCR y la automatización. Si no se captura ahora, "reduje el tiempo de entrada un X%" queda sin fundamento para siempre.
  - **Uso diario**: días con al menos un registro / días transcurridos. Línea base de retención.
  - **Latencia de consultas** p50/p95 del dashboard, incluyendo cold start de Neon.
  - **Core Web Vitals reales** vía `web-vitals`, no solo Lighthouse de laboratorio.
- **Concepto:** telemetría como parte del diseño, no del final. Métrica de vanidad vs métrica accionable. Por qué se guarda en la propia base y no en un servicio externo en esta etapa.
- **Control:** ¿por qué medir el tiempo de registro manual *ahora* y no cuando el OCR esté listo?

---

## 8. Catálogo de métricas

Lo que este proyecto puede producir honestamente. Todo se acumula en `METRICS.md` bajo las reglas de **P6**.

| Fase | Métrica | Por qué es defendible |
| :--- | :--- | :--- |
| 0 | Cobertura de captura automática (%) | Contra registro manual exhaustivo, n = gastos de 7 días |
| 1 | Tiempo de registro manual (p50/p95) | Instrumentado, no estimado |
| 1 | LCP / INP / CLS reales | p75, `web-vitals`, no laboratorio |
| 2 | **Precisión OCR desglosada por campo** (monto/fecha/comercio) | Golden set fijo, n de campos declarado |
| 2 | **Mejora entre versiones de prompt** | Mismo golden set, cambio aislado. La métrica más valiosa del proyecto. |
| 2 | Tasa de alucinación (filas sin correspondencia en el extracto) | Verificable contra la imagen |
| 2 | Costo y latencia por extracto | Medición directa |
| 4 | **Tasa de auto-categorización (Nivel 1)** | % guardado sin ninguna intervención. Mide el objetivo central de la app y debe **crecer con el tiempo** conforme el motor aprende. |
| 4 | Toques por transacción (Nivel 1 vs 2 vs 3) | Distribución medida, contra la línea base de registro manual de Fase 1 |
| 4 | Duplicados evitados bajo carga concurrente | Test de carga reproducible |
| 4 | Tasa de fallo de ingesta y de recuperación | De `ingestion_failures` |
| 5 | **Precisión de alertas** (% marcadas útiles) | Feedback explícito; es la métrica de P2 |
| 5 | Falsos positivos de detección de anomalías | Contra etiquetado manual |
| 6 | **Tasa de verificación de cita** | El número que demuestra el "no inventado" |
| 6 | Tasa de rechazo correcto | Sobre consultas sin cobertura en el corpus |

Las cuatro en negrita son las que sostienen una conversación técnica de verdad.

---

## 9. Fases 2-7

### Bloques de §4.5 (antes de la Fase 2)

**H1 — Habeas data mínimo.** Lo que la Ley 1581 pide desde el primer dato de un tercero, sin convertirlo en un proyecto legal:
- **Política de tratamiento publicada** (`/privacidad`, pública e indexable): qué se recoge, para qué, quién lo procesa, cómo pedir acceso, corrección y borrado.
- **Autorización previa, expresa e informada:** casilla en el alta que enlaza la política. Se guarda qué versión se aceptó y cuándo (tabla `consents`), porque la ley exige poder **probar** la autorización, no solo haberla pedido.
- **Encargados declarados** (quién procesa los datos por cuenta del producto): Neon, Vercel, Cloudflare, Google (Gemini), Telegram y, desde W1, Meta. La **transferencia internacional** (los servidores están fuera de Colombia) se declara en la política.
- **Derechos del titular:** el export CSV ya cubre el acceso; falta **borrar la cuenta** y todo lo que cuelga de ella.
- *Límite honesto:* esto es el mínimo que un proyecto personal puede sostener. Antes de cobrar o abrir de verdad, lo revisa un abogado; no lo sustituye este plan.

**L1 — Capa LLM agnóstica del canal.** Gemini Flash-Lite **en plan de pago**, por REST, en `infrastructure/ai/gemini.ts` (el mismo adaptador que usará F2). Dos usos, y en ninguno el modelo calcula dinero:
- **Entender lo que el parser estricto rechaza.** `core/quick-entry.ts` sigue siendo la primera puerta y rechaza en vez de adivinar. Solo cuando rechaza, el modelo extrae **el monto como texto**, el comercio y la fecha; el monto pasa por `core/money.ts`. Si el modelo tampoco está seguro, pregunta en vez de guardar.
- **Consultas libres** («¿cuánto llevo en comida este mes?»): el modelo **elige** uno de los servicios que ya responden `/saldo`, `/hoy` y `/mes`, con sus argumentos; la cifra sale de SQL con `AT TIME ZONE` y el modelo solo la narra. Es *function calling*, **no RAG**: RAG sirve para citar documentos (Fase 6), no para consultar los datos propios.
- **Se mide:** tasa de mensajes rescatados que el parser estricto rechazaba, tasa de aciertos contra un set etiquetado de frases reales (anonimizadas), coste y latencia p50/p95.

**W1 — WhatsApp.** Un adaptador más en `infrastructure/messaging/`, sobre la capa de notificación que ya no depende del proveedor y sobre L1. Cloud API directo de Meta, sin intermediario. Webhook verificado por firma, idempotente sobre el id del mensaje (Meta reintenta, igual que Telegram). La pregunta de categoría fuera de la ventana de 24 h va como plantilla utility aprobada (ver P5). Se mide lo mismo que en Telegram, por canal, y los gestos por transacción (P5 predice 3).

**A1 — Captura en Android (diferida).** Hallazgo que se deja escrito para no perderlo: Android permite a apps como MacroDroid reenviar los SMS al mismo `/api/v1/quick-add` **y leer las notificaciones de otras apps**, cosa que iOS no permite. Eso haría automáticas las compras con **Nequi y Nu**, que en iPhone solo entran por chat. Se retoma cuando el flujo completo esté probado en iPhone.

**Fase 2 — OCR / Vision.** Plan detallado del 25-sep-2026; corrige a `PROJECT_SPEC.md` §4.2 donde difiere.

- **Staging propio, no `pending_review` en `transactions`.** La mayoría de filas de un extracto ya existen (entraron por SMS). Insertarlas en `transactions` y borrarlas después ensucia el ledger, el índice de duplicados y el motor de reglas. Una fila extraída **no es una transacción hasta que se confirma**: tablas `statement_imports` y `statement_rows`.
- **Reconciliación antes que revisión.** Cada fila se clasifica en *ya estaba* (casa con una transacción existente: mismo monto, fecha ±2 días, comercio parecido sobre `normalizeMerchant`), *nueva* o *dudosa*. Dos candidatos para una fila → dudosa: nunca adivina. La pantalla muestra primero lo nuevo; lo que ya estaba va colapsado.
- **El monto llega como texto** («46.872,00») y lo convierte `core/money.ts`. Un número JSON del modelo ya es un double.
- **Los PDF se convierten en imágenes en el teléfono** con `pdfjs-dist` (cargado solo en `/extracto`). Si el PDF trae contraseña, se pide y se abre ahí: **la clave nunca sale del teléfono**. Gemini siempre recibe imágenes.
- **Subida directa a R2 con URL firmada** (`aws4fetch`, no el SDK de AWS): el archivo no pasa por Vercel (límite ~4,5 MB). Bucket privado; los originales se borran solos a los 30 días.
- **Cuota en la propia base, no Upstash** (diferido a la Fase 7): con pocos usuarios basta contar las importaciones del día.
- **Confirmar es una sola transacción de base de datos**, con la id de cada fila como `idempotency_key`: reintentar confirmar no duplica. Lo confirmado entra con `source='ocr_screenshot'` y enseña comercios al motor de reglas.
- **Revisión solo en la PWA**, con el cross-check aritmético contra el total del extracto; las filas con `confidence < 0.85` o dudosas no entran en «confirmar todas». Estado por fila para proteger el INP (P7).
- **Golden set:** los extractos que haya, fuera del repo, con la salida correcta anotada a mano. La línea base se publica con ese `n`, y el set crece cada mes hasta ≥20. Precisión **por campo**, tasa de alucinación, coste y latencia en `METRICS.md`. *Aquí está el grueso del aprendizaje de AI engineering.*

**Fase 3 — Dashboard, presupuestos, PWA completa.** Agregaciones con `AT TIME ZONE`. Presupuestos por periodo (tabla `budgets`, no valor único en `categories` — eso reescribía la historia retroactivamente).

**Fase 4 — Ingesta automática + cliente de Telegram** (solo si Fase 0 da verde). *Reordenada: la categorización por Telegram pertenece junto a la ingesta — sin ingesta no hay nada que categorizar.*

- `/api/v1/quick-add`: API keys hasheadas, rate limiting, idempotencia con **UUID del cliente** + `UNIQUE` + `ON CONFLICT DO NOTHING` (no el hash con ventana temporal de la v1, que estaba definido de tres formas distintas y fallaba en los bordes).
- Motor de reglas para el **Nivel 1** (auto-categorización silenciosa), entrenado con los comercios que el OCR acumuló en la Fase 2.
- **Capa de notificación agnóstica del proveedor.** Se despliega en Telegram: gratis, ilimitado, contenido dinámico, iteración instantánea. La app nativa con APNs queda como **tercer cliente futuro**, decidible con la tasa de auto-categorización ya medida — si es alta, puede que no haga falta.
- **Cliente de Telegram** (todo sobre `core/services/`, cero lógica de negocio en el handler, según **P9**):
  - Inline keyboards para el **Nivel 2** de categorización: webhook de `callback_query` + `answerCallbackQuery` (obligatorio; sin él algunos clientes muestran spinner hasta un minuto). Payload de 1-64 bytes UTF-8, suficiente para `cat:<uuid>`.
  - **Registro por texto**: `12000 juan valdez` → parseado y guardado. Es el canal para **efectivo y Nequi**, que el NFC nunca captura. El mismo servicio de parseo se expone en la PWA como campo de entrada en lenguaje natural.
  - **Consultas rápidas**: "¿cuánto llevo este mes?", "¿cuánto en comida?".
- Parsers de SMS con corpus de tests. Cola de reintentos local en el Shortcut. Vista de ingestas fallidas.

*Fuera de Telegram por decisión explícita:* la subida de fotos para OCR. Revisar 40 filas extraídas en un chat sería peor que en una tabla. El OCR se queda en la PWA (§P9).

**Fase 5 — Motor de insights y gamificación.**

- Detección de anomalías según **P2**: mediana móvil, MAD, exclusión de recurrentes y one-offs.
- Digest semanal por **P5**, sobre la capa de notificación agnóstica ya construida en la Fase 4.
- Logros según **P1**.

> **Criterio de escalado a WhatsApp — sustituido el 25-sep-2026 por §4.5 (bloque W1).** Se conserva el texto original porque explica el razonamiento; su premisa de coste resultó falsa al medirla (P5).
>
> **Criterio de escalado a WhatsApp — esto es lo que significa "con fundamentos".**
> No se migra por intuición ni por que suene mejor. Se activa cuando se cumple **al menos uno**:
>
> 1. Hay ≥5 usuarios reales que **no usan Telegram** y lo declaran como bloqueo para adoptar la app.
> 2. Se cumplió el criterio de producto de §1 (8 semanas) y se abre a terceros de verdad.
>
> Hasta entonces WhatsApp es coste por mensaje y fricción de plantillas sin beneficio. La penetración de WhatsApp en Colombia es la razón para tenerlo algún día, pero solo importa cuando hay usuarios que no eres tú. Gracias a la capa agnóstica de la Fase 4, el cambio es **configuración, no reescritura** — ese fue exactamente el objetivo de diseñarla así.

**Fase 6 — RAG de educación financiera.** Corpus curado, embeddings en `pgvector` sobre Neon, recuperación + **verificación de cita** + ruta de rechazo, según **P3** y **P4**. Enrutado por arquetipo, sin exponer la etiqueta.

**Fase 7 — Multi-tenant de verdad.** RLS con `pg_session_jwt`, rol sin `BYPASSRLS`, JWK validado. Cuotas, facturación, observabilidad. La revisión legal completa de la **Ley 1581 de 2012** (habeas data) antes de cobrar. El mínimo obligatorio ya no espera a esta fase: se adelantó al bloque **H1** (§4.5) porque hay usuarios terceros desde septiembre de 2026.

---

## 10. Fuera de alcance y diferidos

**No se construye en Fase 1:** OCR, dashboard con gráficas, `/api/v1/quick-add`, API keys, parsers de SMS, notificaciones, gamificación, RAG, RLS con `pg_session_jwt`, Capacitor. La tabla `budgets` se crea en B1 pero sin UI hasta la Fase 3.

**`CLAUDE.md`** — diferido a petición explícita. Debe recoger: la modalidad de trabajo, la regla de que ningún `db.` vive fuera de `core/repositories/`, la prohibición de `float` para dinero, que toda agregación por periodo usa `AT TIME ZONE`, la regla de que ningún cliente lleva lógica de negocio, y los nueve principios **P1-P9**.

**App nativa (Capacitor + APNs)** — diferida por decisión. Se reevalúa en la Fase 5 con la tasa de auto-categorización medida. Entra como tercer cliente sobre los mismos servicios, no como reescritura.

**Subida de fotos para OCR por Telegram** — descartada por ahora (§Fase 4). Podría añadirse más adelante como *solo subida*, con la revisión siempre en la PWA.

**Decisiones abiertas:**
1. ¿Qué porcentaje captura realmente Wallet? → Fase 0, sigue pendiente.
2. ~~¿Los SMS de Bancolombia llegan como SMS o como push?~~ **Resuelta:** llegan como SMS y hay parsers en producción para Bancolombia y Banco de Bogotá.
3. ¿Nequi y Nu? En iPhone, por chat (Telegram hoy, WhatsApp desde W1) y por OCR (F2). En Android podrían entrar solos leyendo la notificación (A1, diferido).
4. ¿Multi-moneda? El esquema lo soporta; la UI asume COP. Decidir antes de Fase 3.

---

## 11. Verificación

Fase 1 termina cuando todo esto pasa:

0. **Documentos sincronizados (B0):** `PROJECT_SPEC.md` en v3.0 reflejando P1-P9, la arquitectura de captura de §5.0 y el roadmap de Fases 0-7. `METRICS.md` creado. `AUDIT.md` intacto.
1. `pnpm test` verde, con `core/money.ts` al 100% y el test de arquitectura incluido.
2. `pnpm drizzle-kit migrate` aplicado primero sobre un **branch de Neon** creado desde main, después sobre main.
3. **Aislamiento:** dos usuarios, transacciones con cada uno, verificar por cada función de repositorio que A no ve nada de B. Automatizado, no manual.
4. **Borde de mes:** transacción el último día del mes a las 20:00 Bogotá, confirmar que cae en el mes correcto.
5. **Instalabilidad:** la PWA se instala en un iPhone real desde Safari y abre a pantalla completa. Sin errores en DevTools → Application → Manifest.
6. **Rendimiento:** Lighthouse CI pasando el presupuesto de **P7**.
7. Export CSV abierto en hoja de cálculo, montos correctos y bien formateados.
8. **Uso real:** Jean Paul registra sus gastos con la app 3 días seguidos sin tocar código. Si algo le da pereza usar, es un bug de Fase 1, no una mejora de Fase 3.
9. `METRICS.md` existe y contiene, con fecha y n: cobertura de Fase 0, tiempo de registro manual p50/p95, latencia del dashboard y CWV reales.

Los puntos **8 y 9** son los que importan. Los otros siete pueden pasar y el proyecto muere igual si la app no se usa — o queda sin nada demostrable si no se midió.
