# Prueba de uso real — §11.8 del plan

> «Jean Paul registra sus gastos con la app 3 días seguidos sin tocar código.
> Si algo le da pereza usar, es un bug de Fase 1, no una mejora de Fase 3.»

**Build bajo prueba:** `main @ ______` (commit desplegado, no el local)
**URL:** https://reasonny-reales.vercel.app
**Día 1 = fecha del primer registro:** ______

Regla dura: **no se toca código durante los 3 días.** Un arreglo a mitad
invalida la medición — `n` quedaría repartido entre dos versiones distintas de
la app. Todo lo que falle se anota aquí y se arregla el día 4.

---

## Clasificación de cada anotación

Cada cosa que anotes lleva una etiqueta. Sin la etiqueta, los 3 días acaban
siendo una lista de deseos en vez de un veredicto.

| Etiqueta | Significado | Qué se hace |
| :--- | :--- | :--- |
| `BUG-F1` | La app hizo algo incorrecto, o me impidió registrar un gasto | Bloquea el cierre de Fase 1. Se arregla el día 4 |
| `FRICCION` | Funcionó, pero costó más de lo que debería | Se arregla si es barato; si no, se documenta |
| `F3` | Me gustaría que existiera | **No se construye.** Va a la lista de Fase 3 |

---

## Día 1 — fecha: ______

| | |
| :--- | :--- |
| Gastos que ocurrieron (contados a mano) | |
| Gastos registrados en la app | |
| Registrados fuera de la app (nota, memoria, nada) y por qué | |
| ¿Abrí el dashboard? ¿Cuántas veces? ¿Para qué? | |
| Peor momento de fricción del día, en una frase | |
| ¿Hubo algo que me dio pereza? | |

**Incidencias**

| Hora | Etiqueta | Qué pasó | Qué esperaba |
| :--- | :--- | :--- | :--- |
| | | | |

---

## Día 2 — fecha: ______

| | |
| :--- | :--- |
| Gastos que ocurrieron (contados a mano) | |
| Gastos registrados en la app | |
| Registrados fuera de la app y por qué | |
| ¿Abrí el dashboard? ¿Cuántas veces? ¿Para qué? | |
| Peor momento de fricción del día, en una frase | |
| ¿Hubo algo que me dio pereza? | |

**Incidencias**

| Hora | Etiqueta | Qué pasó | Qué esperaba |
| :--- | :--- | :--- | :--- |
| | | | |

---

## Día 3 — fecha: ______

| | |
| :--- | :--- |
| Gastos que ocurrieron (contados a mano) | |
| Gastos registrados en la app | |
| Registrados fuera de la app y por qué | |
| ¿Abrí el dashboard? ¿Cuántas veces? ¿Para qué? | |
| Peor momento de fricción del día, en una frase | |
| ¿Hubo algo que me dio pereza? | |

**Incidencias**

| Hora | Etiqueta | Qué pasó | Qué esperaba |
| :--- | :--- | :--- | :--- |
| | | | |

---

## Cierre — se hace el día 3 por la noche

- [ ] `pnpm metrics:report` — pegar la salida cruda aquí abajo, con su `n`
- [ ] `docs/METRICS.md` relleno en las cuatro entradas de Fase 1, en el formato
      de P6 (Valor · n · Método · Línea base · Delta · Conclusión)
- [ ] **§11.7 CSV:** exportar desde el dashboard, abrir en hoja de cálculo,
      comprobar montos y formato contra lo que recuerdo haber gastado
- [ ] **§11.4 borde de mes:** el registro hecho el 31-ago después de las 19:00
      Bogotá aparece en **agosto**, y el total de septiembre arranca en 0 el 1-sep
- [ ] **§11.5 PWA:** siguió abriendo a pantalla completa los 3 días, sin
      volver a pedir sesión
- [ ] Uso diario = días con ≥1 registro / 3

**Salida de `pnpm metrics:report`:**

```
(pegar aquí)
```

**Veredicto de la fase**

- ¿3/3 días con al menos un registro? ______
- ¿Algún gasto se quedó fuera *por culpa de la app*? ______
- Lista de `BUG-F1` a arreglar antes de declarar Fase 1 cerrada: ______
- Lista de `F3` (no se construyen ahora): ______
