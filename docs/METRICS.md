# METRICS — RealMoney

Registro de mediciones del proyecto. Gobernado por el **principio P6** de `IMPLEMENTATION_PLAN.md`.

## Reglas (P6)

1. **Ninguna métrica se reporta sin `n`, metodología y línea base.** Un número sin las tres cosas es decoración, no evidencia, y no sobrevive la primera pregunta de alguien con experiencia.
2. **La línea base se mide antes de optimizar.** No es recuperable después.
3. **Las métricas malas también se publican.** "Wallet capturó el 34%, así que degradé esa fase a complemento" demuestra criterio. Un fracaso escondido no demuestra nada.
4. **Nada de precisión agregada sin desglose.** "94% de precisión" es inútil. "96% en monto, 91% en fecha, 88% en comercio (n=847 campos, 20 extractos)" es evidencia.

## Formato de cada entrada

```markdown
### [YYYY-MM-DD] Nombre de la métrica

- **Valor:** …
- **n:** …
- **Método:** cómo se midió exactamente, con qué herramienta
- **Línea base:** contra qué se compara (o "primera medición")
- **Delta:** cambio respecto a la medición anterior, y qué lo causó
- **Conclusión:** qué decisión se toma con este número
```

---

## Fase 0 — Validación

### [ pendiente ] Cobertura de captura automática (Wallet)

- **Valor:** —
- **n:** gastos reales de 7 días
- **Método:** automatización de Wallet → webhook.site, contra registro manual exhaustivo en notas (efectivo, Nequi, online y PSE incluidos)
- **Línea base:** primera medición del proyecto
- **Conclusión:** ≥60% → Fase 4 es pilar · 40-60% → complemento del OCR · <40% → Fase 4 opcional

### [ pendiente ] Transacciones tardías y rechazadas

- **Tardías (>10 min):** —
- **Rechazadas que dispararon el trigger:** —
- **Método:** comparación de timestamp de pago vs recepción en webhook.site
- **Conclusión:** determina cuánta lógica de reconciliación y de reversión hace falta

### [ pendiente ] ¿Se puede silenciar el banner del trigger de Wallet?

- **Resultado:** —
- **Método:** automatización en "Ejecutar inmediatamente", comprobar si aparece el toggle "Notificar al ejecutar" y si se puede desactivar
- **Conclusión:** determina si el **Nivel 1** (captura silenciosa) es realmente invisible o deja banner en cada pago

### [ pendiente ] Gestos reales del Nivel 2 (notificación de Telegram en iOS)

- **Gestos hasta pulsar una categoría:** —
- **¿Obliga a abrir Telegram?:** —
- **n:** al menos 5 intentos, con el iPhone bloqueado y desbloqueado
- **Método:** bot creado con `@BotFather`, `sendMessage` con `inline_keyboard` de 3 botones vía `curl`. Contar gestos desde que aparece el banner
- **Línea base:** primera medición. La hipótesis actual es **2 gestos** (pulsación larga + toque); el plan afirmaba 1 y era optimista
- **Conclusión:** si son 3 o más, o si obliga a abrir Telegram, el Nivel 2 deja de ser cómodo y el motor de reglas del Nivel 1 pasa de deseable a imprescindible — lo que sube la prioridad de la Fase 2, que es quien lo entrena

---

## Fase 1 — Líneas base

> **Estado del instrumento (23-sep-2026).** La instrumentación existe, está
> cableada — `src/lib/telemetry.ts` en el navegador, `POST /api/v1/telemetry`
> como receptor, tabla `telemetry_events` con escala fija 1000 — y **ya tiene
> lecturas reales**: 17 días de uso diario, 795 cargas del dashboard. El
> criterio §11.8 del plan está cubierto para las entradas de abajo. Se
> regeneran con:
>
> ```bash
> pnpm metrics:report          # imprime p50/p75/p95 y n de todo lo de abajo
> ```
>
> Ningún número se copia aquí sin el `n` que lo acompaña en esa salida (P6).

### [2026-09-23] Tiempo de registro manual

- **p50 / p75 / p95:** **21,5 s / 59,9 s / 170,2 s**
- **n:** 11 registros
- **Método:** cronómetro monótono (`performance.now()`) en `src/lib/telemetry.ts`,
  arrancado al montar el formulario de `/nuevo` y detenido en el `submit`
  **exitoso**. Los intentos fallidos no cuentan: medirían "cuánto tarda un
  error", no cuánto cuesta registrar un gasto. Enviado inmediatamente, no al
  cerrar la pestaña, porque el usuario suele quedarse en la app
- **Línea base:** primera medición
- **Conclusión:** es *la* referencia contra la que se medirán el OCR (Fase 2) y
  la automatización (Fase 4). Solo puede capturarse mientras la entrada siga
  siendo 100% manual.
  **21,5 segundos de mediana para anotar un gasto** es el número que justifica
  todo lo demás: contra eso, `12000 juan valdez` en un chat es otro orden de
  magnitud, y el Atajo de SMS son cero segundos.
  El p95 de 170 s no es un formulario lento — es alguien que lo abrió, se
  distrajo y volvió. Con n=11 la cola alta es anécdota, no distribución; lo
  honesto de esta medición es la mediana

### [2026-09-23] Core Web Vitals reales

- **LCP p75:** **2072 ms** ✅ · **INP p75:** **144 ms** ✅ · **CLS p75:** **0,041** ✅
- **n:** 109 / 174 / 79 lecturas respectivamente
- **Método:** librería `web-vitals` 6.2.1 sobre uso real, enviada con
  `navigator.sendBeacon` en `visibilitychange`/`pagehide` — el único momento en
  que INP es definitivo. Sin `reportAllChanges`: se guarda el valor final, no
  los intermedios. No es Lighthouse de laboratorio
- **Objetivo (P7):** LCP <2.5s · INP <200ms · CLS <0.1
- **Nota:** el veredicto se calcula sobre **p75**, no sobre p50. Un p50 que pasa
  mientras el p75 falla no es un aprobado
- **Línea base:** primera medición
- **Conclusión:** los tres dentro del presupuesto P7, en uso real y en un
  teléfono real, no en Lighthouse. Pero **las colas dicen otra cosa y se
  publican igual** (regla 3): LCP p95 4256 ms está en el umbral de fallo
  (>4,0 s) y CLS p95 0,877 lo supera por mucho (>0,25). Uno de cada veinte
  arranques ve una página que salta. Con n=79 no es una conclusión, es un hilo
  del que tirar cuando haya más lecturas

### [2026-09-23] Latencia del dashboard

- **p50 / p75 / p95:** **526 ms / 655 ms / 1006 ms**
- **n:** 795 cargas
- **Método:** medido en servidor alrededor de `getDashboardData` y registrado
  con `after()` de Next, ya enviada la respuesta, para que instrumentar no
  cueste latencia. **Incluye el cold start de Neon** (300ms-2.6s p95
  documentado): excluirlo describiría una base de datos que nadie usa
- **Línea base:** primera medición
- **Conclusión:** con n=795 esta sí es una distribución y no una anécdota. El
  p95 de 1 s queda por debajo de los 2,6 s que el spec documenta para el cold
  start de Neon, lo que sugiere que la auto-suspensión casi nunca se alcanza
  con este patrón de uso — dato a revisar cuando pasen varios días sin abrir
  la app

### [2026-09-23] Uso diario

- **Valor:** **16 de 17 días** (94%)
- **n:** 63 transacciones, un perfil, 2026-09-07 → 2026-09-23
- **Método:** `COUNT(DISTINCT)` sobre fechas **locales** de `transactions`
  (`AT TIME ZONE 'America/Bogota'`), no sobre `telemetry_events`: la evidencia
  de que la app se usa es una transacción que el usuario decidió crear, no una
  visita de página. Días transcurridos se cuentan desde el primer registro,
  inclusive
- **Línea base:** primera medición
- **Conclusión:** el criterio de §1 pedía ≥3 aperturas/semana en la semana 6 y
  está superado con holgura desde la primera. **Pero el número está inflado por
  construcción y no debe leerse como retención:** 78% de estos registros los
  creó el Atajo de SMS sin que nadie abriera nada. Mide que el canal automático
  funciona, no que la persona vuelva. La retención honesta es la entrada de
  captura por canal, más abajo

---

## Fase 2 — OCR

*Las métricas de esta sección son las de mayor valor del proyecto.*

### [ pendiente ] Precisión de extracción, desglosada por campo

- **Monto:** — · **Fecha:** — · **Comercio:** —
- **n:** — campos, sobre — extractos del golden set
- **Método:** golden set fijo de ≥20 extractos reales con salida esperada anotada a mano
- **Versión de prompt:** —

### [ pendiente ] Mejora entre versiones de prompt

- **Método:** mismo golden set, un solo cambio aislado por versión
- **Conclusión:** es la métrica que demuestra que existe un ciclo de evaluación, no solo llamadas a una API

### [ pendiente ] Tasa de alucinación

- **Valor:** % de filas extraídas sin correspondencia real en la imagen
- **Método:** verificación manual contra el extracto original

### [ pendiente ] Costo y latencia por extracto

- **Costo:** — · **Latencia p50/p95:** — / —
- **Nota:** la latencia esperada es 2-6s, no <1.5s

---

## Fase 4 — Ingesta y Telegram

### [2026-09-23] Tasa de auto-categorización (Nivel 1)

- **Valor:** **4,8%** (3 de 63)
- **n:** 63 transacciones vivas, un perfil, 2026-09-07 → 2026-09-23
- **Método:** `transactions.categorized_by = 'rule_engine'` sobre el total con
  `deleted_at IS NULL`, un solo `user_id`. El segundo perfil de la base (6
  filas, creado hoy probando el bot) queda fuera: mezclarlo subiría el `n` sin
  añadir un solo día de uso real
- **Línea base:** primera medición. El motor de reglas se desplegó **hoy**, así
  que 4,8% es el punto cero por construcción, no un resultado
- **Delta:** —
- **Conclusión:** **la métrica central de la app.** Debe *crecer con el tiempo*
  conforme el motor aprende. Si a los 6 meses sigue baja, el motor falló y el
  Nivel 2 dejó de ser andamio para volverse muleta.
  Punto de partida real: 9 reglas aprendidas, 4 disparos acumulados

> **Corrección aplicada el mismo día, después de tomar la foto de arriba.**
> Las cifras de la línea base se dejan como se midieron; esto es lo que cambió
> y por qué, que es lo que hace comparable la siguiente lectura.
>
> **Reglas 9 → 8, disparos 4 → 2.** Se borró la regla
> `transferencia enviada → Restaurantes y Café`, aprendida antes de que
> existiera `isLearnableMerchantKey`. Sus 2 disparos nunca fueron una decisión
> del motor sobre un comercio: eran un marcador de posición del banco
> actuando como si fuera uno.
>
> **4 filas con la clave desfasada, reparadas.** `merchant` y
> `merchant_normalized` no concordaban — ediciones hechas en la app antes de
> que `updateTransaction` recalculara la segunda. La fila se mostraba como
> "SARKU K33" pero buscaba como "transferencia enviada", que es exactamente
> cómo la regla envenenada llegó a categorizarla. Ninguna transacción se
> borró: 69 antes, 69 después.
>
> La tasa del 4,8% no se movió: las 4 filas ya tenían categoría, así que la
> reparación cambió con qué clave casan en el futuro, no el conteo de hoy.

### [2026-09-23] Captura por canal

- **Valor:** SMS 77,8% (49) · manual 17,5% (11) · **Telegram 4,8% (3)**
- **n:** 63 transacciones, un perfil, 17 días
- **Método:** conteo sobre `transactions.source`, `deleted_at IS NULL`
- **Línea base:** primera medición. El canal de Telegram abrió el 2026-09-23,
  así que sus 3 filas son de un solo día y no significan nada todavía
- **Conclusión:** esta es la entrada que decide si la Fase 4 valió la pena. La
  hipótesis es que el efectivo, Nequi y los QR estaban **estructuralmente
  fuera** del dato — ningún SMS los anuncia — y que por tanto el 77,8% del SMS
  no es cobertura, es sesgo: mide los pagos con tarjeta, que son los únicos que
  se anunciaban solos. Si en 4 semanas Telegram no pasa del 15%, o el efectivo
  pesa menos de lo que se creía, o el canal no es tan cómodo como se pensó — y
  ambas respuestas se publican

### [2026-09-23] Gestos por transacción, por nivel

- **Distribución Nivel 1 / 2 / 3:** 4,8% (3) / 0% (0) / 0% (0)
- **Sin categoría:** **44,4% (28 de 63)**
- **A mano, en la app:** 50,8% (32)
- **Prompts del bot:** 4 enviados, 3 respondidos (75%, n=4 — sin valor
  estadístico, solo confirma que el instrumento registra)
- **n:** 63 transacciones, un perfil
- **Método:** conteo sobre `transactions.categorized_by` (`rule_engine` = Nivel
  1, 0 gestos · `telegram` = Nivel 2 · `shortcut_menu` = Nivel 3) y sobre
  `notification_prompts` (`kind = 'category_pick'`), ambos `AT TIME ZONE` no
  aplicable por ser conteos absolutos
- **Línea base:** primera medición
- **Conclusión:** el 44,4% sin categoría es el hallazgo, y **no es un problema
  de captura sino de momento.** El gasto se guarda solo; ponerle categoría es
  un segundo acto, en otro rato, y ese se olvida — la ubicación y la hora
  quedan grabadas justamente para poder reconstruirlo después. De esas 28,
  **22 no tienen comercio que aprender**: "Transferencia enviada", "Retiro en
  cajero" y las cuentas enmascaradas, todo lo que `isLearnableMerchantKey`
  rechaza. Ninguna regla podrá categorizarlas jamás. Solo quedan **6** al
  alcance del motor. Solo la persona sabe qué fueron las otras, y solo
  mientras lo recuerde.
  Ese es el argumento entero del Nivel 2: mover la pregunta al instante del
  gasto, cuando la respuesta todavía existe
- **Método:** conteo sobre `transactions.categorized_by` (`rule_engine` = Nivel 1, 0 gestos · `telegram` = Nivel 2 · `shortcut_menu` = Nivel 3)
- **Línea base:** tiempo de registro manual de Fase 1, y los gestos medidos del Nivel 2 en Fase 0
- **Nota:** se cuentan **gestos**, no toques. El Nivel 2 cuesta pulsación larga + toque

### [ pendiente ] Duplicados evitados bajo carga concurrente

- **Método:** test de carga reproducible con peticiones simultáneas de la misma `Idempotency-Key`

### [2026-09-23] Tasa de fallo de ingesta y de recuperación

- **Valor:** **10,9% de fallo** en el canal de SMS (6 de 55 intentos)
- **Recuperación:** **0 de 7** resueltas (`resolved_at IS NULL` en todas)
- **Desglose:** `unrecognized_format` 3 · `invalid_body` 3 · `no_merchant` 1
- **n:** 7 filas de `ingestion_failures` para un perfil, 17 días
- **Método:** conteo sobre `ingestion_failures`; el denominador del SMS son las
  49 guardadas más las 6 fallidas de ese canal. Las `unauthorized` quedan fuera
  del desglose por perfil porque un token que no verifica no tiene usuario al
  que atribuirse
- **Línea base:** primera medición
- **Conclusión:** dos lecturas distintas y las dos incómodas. Las 3
  `unrecognized_format` son **plata que se perdió**: un SMS que llegó, que el
  parser no supo leer, y que nadie fue a buscar — son la evidencia de qué
  plantilla cambió un banco. Las 3 `invalid_body` son el bug de coordenadas ya
  corregido, y sirven para comprobar que no vuelven a aparecer. Y el 0 de
  recuperación dice lo importante: **la tabla registra, pero nadie la lee.**
  Un registro de fallos que no se revisa es un cajón, no un instrumento

---

## Fase 5 — Insights

### [ pendiente ] Precisión de alertas

- **Valor:** % de alertas marcadas como útiles por el usuario
- **Conclusión:** es la métrica de **P2**. Una alerta falsa cuesta más que una omitida

### [ pendiente ] Falsos positivos de detección de anomalías

- **Método:** contra etiquetado manual de qué semanas fueron realmente anómalas

---

## Fase 6 — RAG

### [ pendiente ] Tasa de verificación de cita

- **Valor:** % de afirmaciones generadas que aparecen verificablemente en el fragmento recuperado
- **Conclusión:** **el número que demuestra el "no inventado".** Es la métrica de **P3**

### [ pendiente ] Tasa de rechazo correcto

- **Valor:** % de consultas sin cobertura en el corpus donde el sistema calló en vez de generar
- **Nota:** un rechazo correcto es comportamiento deseado, no fallo
