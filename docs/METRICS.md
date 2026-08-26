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

### [ pendiente ] Tiempo de registro manual

- **p50 / p95:** — / —
- **n:** —
- **Método:** instrumentado en `src/lib/telemetry.ts`, ms desde apertura del formulario hasta submit exitoso
- **Línea base:** primera medición
- **Conclusión:** es *la* referencia contra la que se medirán el OCR (Fase 2) y la automatización (Fase 4)

### [ pendiente ] Core Web Vitals reales

- **LCP p75:** — · **INP p75:** — · **CLS p75:** —
- **Método:** librería `web-vitals` sobre uso real, no Lighthouse de laboratorio
- **Objetivo (P7):** LCP <2.5s · INP <200ms · CLS <0.1

### [ pendiente ] Latencia del dashboard

- **p50 / p95:** — / —
- **Método:** incluye cold start de Neon (300ms-2.6s p95 documentado)

### [ pendiente ] Uso diario

- **Valor:** días con ≥1 registro / días transcurridos
- **Conclusión:** línea base de retención. El criterio de §1 exige ≥3 aperturas/semana en la semana 6

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

### [ pendiente ] Tasa de auto-categorización (Nivel 1)

- **Valor:** % guardado sin ninguna intervención del usuario
- **Conclusión:** **la métrica central de la app.** Debe *crecer con el tiempo* conforme el motor de reglas aprende. Si a los 6 meses sigue baja, el motor falló y el Nivel 2 dejó de ser andamio para volverse muleta

### [ pendiente ] Gestos por transacción, por nivel

- **Distribución Nivel 1 / 2 / 3:** — / — / —
- **Método:** conteo sobre `transactions.categorized_by` (`rule_engine` = Nivel 1, 0 gestos · `telegram` = Nivel 2 · `shortcut_menu` = Nivel 3)
- **Línea base:** tiempo de registro manual de Fase 1, y los gestos medidos del Nivel 2 en Fase 0
- **Nota:** se cuentan **gestos**, no toques. El Nivel 2 cuesta pulsación larga + toque

### [ pendiente ] Duplicados evitados bajo carga concurrente

- **Método:** test de carga reproducible con peticiones simultáneas de la misma `Idempotency-Key`

### [ pendiente ] Tasa de fallo de ingesta y de recuperación

- **Método:** conteo sobre la tabla `ingestion_failures`

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
