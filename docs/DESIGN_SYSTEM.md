# RealMoney — Sistema de Diseño

**Versión:** 1.0.0 · 24 de agosto de 2026
**Estado:** Fijado. Los tokens son la fuente de verdad; ningún componente inventa valores.

Derivado de dos referencias aportadas por Jean Paul. Este documento explica **qué se tomó de cada una, qué se rechazó y por qué** — un sistema que solo copia no se puede extender cuando aparece una pantalla que la referencia no tenía.

---

## 1. Lectura de las referencias

### Referencia A — dashboard financiero denso (acento naranja)

| Se toma | Se rechaza |
| :--- | :--- |
| **De-énfasis del decimal** en cifras grandes (`$13,984` grande + `.73` pequeño) | El **naranja como color de marca** — ver §2.1 |
| Barra de progreso segmentada multicolor con leyenda de puntos | Densidad de 5 pestañas inferiores: demasiadas para el alcance de v1 |
| Fila de acciones rápidas: icono arriba, etiqueta abajo, tarjeta redondeada | La tarjeta de crédito con degradado como elemento estructural |
| Selector de rango temporal en píldoras (`1H 24H 7D 30D 1M 6M 1Y`) | Gauge de arco: mal uso de espacio para un solo número |
| Etiquetas de estado con color semántico ("Good", "Under Control") | |
| Contenedor de icono redondeado en cada fila de lista | |

### Referencia B — presupuesto minimalista (acento violeta)

| Se toma | Se rechaza |
| :--- | :--- |
| **Violeta como acento de marca** — ver §2.1 | Ilustraciones de personajes: no envejecen bien y no aportan aquí |
| **Encabezados de peso mixto** (`Monthly **Budget**`, `Spending **March**`) | Navegación flotante de 3 iconos: oculta destinos y el alcance pide más |
| Radios generosos y respiración entre bloques | Tarjeta blanca sólida entre tarjetas de color: rompe la jerarquía |
| Tarjetas de categoría con relleno de color y badge de porcentaje | |
| Píldoras de delta (`+08%`) con color semántico | |
| Filas de transacción: icono circular + título + hora, importe a la derecha | |

### ADN común — lo que define el sistema

Ambas referencias, sin conocerse, coinciden en cinco cosas. Eso no es casualidad: es lo que funciona en finanzas móviles.

1. Fondo casi negro con superficies elevadas, no bordes.
2. **El decimal se de-enfatiza.** El peso visual está en los pesos, no en los centavos.
3. Jerarquía por **tamaño y peso**, no por líneas divisorias.
4. Color **categórico** para datos, nunca decorativo.
5. Estados seleccionados en forma de **píldora**.

---

## 2. Color

### 2.1 Por qué violeta y no naranja

La referencia A es preciosa, pero su naranja es un problema estructural: en una app de dinero el **naranja y el rojo están reservados** para advertencia y pérdida. Un acento de marca naranja colisiona con la paleta semántica — cuando todo es naranja, un aviso deja de avisar.

El violeta no significa nada en finanzas, y eso es exactamente lo que se quiere de un color de marca: que no compita con el significado del dato.

El degradado cálido de la referencia A **sí sobrevive**, pero acotado a un único sitio: la tarjeta de saldo principal (§7.1). Un objeto héroe, no un sistema.

### 2.2 Superficies (tema oscuro — primario)

```css
--surface-base:      #09090B;  /* fondo de la app */
--surface-raised:    #141417;  /* tarjetas */
--surface-overlay:   #1C1C21;  /* modales, hojas, menús */
--surface-sunken:    #050506;  /* campos de entrada, pozos */
--border-hairline:   #26262B;  /* separadores de 1px */
--border-strong:     #35353C;  /* bordes de foco e input */
```

**No se usa negro puro (`#000`).** Sobre OLED, el texto blanco sobre negro absoluto produce halación y aumenta la fatiga en sesiones de lectura. `#09090B` conserva el ahorro de batería sin el artefacto.

### 2.3 Tinta

```css
--ink-primary:    #FAFAFA;  /* cifras, títulos */
--ink-secondary:  #A1A1AA;  /* etiquetas, subtítulos */
--ink-muted:      #71717A;  /* metadatos, marcas de tiempo */
--ink-inverse:    #09090B;  /* sobre rellenos de acento */
```

### 2.4 Marca

```css
--brand-500: #8172F2;  /* acento por defecto, botones primarios */
--brand-600: #6D5AE0;  /* hover, estados presionados */
--brand-400: #9D91F6;  /* enlaces sobre superficie oscura */
--brand-tint: rgba(129,114,242,0.14);  /* fondos seleccionados, píldoras */
```

### 2.5 Semántica — reservada

Estos cuatro colores **nunca** se reutilizan como categoría de gráfica ni como decoración. Siempre acompañados de icono o texto, jamás color a secas.

```css
--positive: #34C77B;  /* ingreso, ahorro, dentro de presupuesto */
--warning:  #E0A32E;  /* cerca del límite, confianza OCR baja */
--serious:  #E8833A;  /* presupuesto excedido */
--critical: #E5484D;  /* fallo, transacción rechazada */
```

### 2.6 Categórica — validada, no elegida a ojo

Orden **fijo**. Nunca se cicla: una séptima serie se agrupa en "Otros" o se facetan los datos. El color sigue a la entidad, no a su posición en el ranking — filtrar no debe repintar las series supervivientes.

```css
/* Tema oscuro */
--cat-1: #8172F2;  /* violeta */
--cat-2: #26A75F;  /* verde   */
--cat-3: #3494B8;  /* cian    */
--cat-4: #C97F18;  /* ámbar   */
--cat-5: #D14487;  /* rosa    */
--cat-6: #77A024;  /* oliva   */
```

**Verificación ejecutada** (`validate_palette.js`, superficie oscura):

```
[PASS] Banda de luminosidad   las 6 dentro de L 0.48–0.67
[PASS] Piso de croma          las 6 >= 0.1
[PASS] Separación CVD         peor par adyacente ΔE 12.6 (deutan)
[PASS] Piso de visión normal  peor par adyacente ΔE 15.9
[PASS] Contraste vs fondo     las 6 >= 3:1
```

El orden importa: con violeta y ámbar contiguos el par verde↔ámbar caía a ΔE 7.7 bajo deuteranopía. Reordenar lo subió a 12.6. **Si añades o cambias un color, vuelve a correr el validador** — no lo razones.

### 2.7 Tema claro — diferido a Fase 3

Los pasos ya están validados contra superficie `#FCFCFB` y quedan aquí para no re-derivarlos:

```css
--cat-1: #6D5AE0;  --cat-2: #1F8F50;  --cat-3: #0E7FAD;
--cat-4: #A96612;  --cat-5: #B33A72;  --cat-6: #63871F;
```

**No se implementa en Fase 1.** Ambas referencias son oscuras, la app se abre en ráfagas cortas y duplicar el QA visual no se paga todavía. Los tokens se estructuran para que sea un intercambio de variables, no una reescritura.

---

## 3. Tipografía

### 3.1 Familia

**Inter Variable**, vía `next/font` (auto-alojada: sin petición a Google, sin CLS por swap).

```css
--font-sans: 'Inter Variable', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
```

**Todo importe monetario lleva cifras tabulares:**

```css
.money { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
```

Sin esto, las columnas de importes no alinean y el saldo "salta" horizontalmente al actualizarse. En una app de dinero es un defecto, no un detalle.

### 3.2 Escala

| Token | Tamaño / Interlineado | Peso | Uso |
| :--- | :--- | :--- | :--- |
| `--text-hero` | 44 / 48 px | 600 | Saldo principal, total del mes |
| `--text-display` | 32 / 38 px | 600 | Cifra de encabezado de sección |
| `--text-title` | 20 / 28 px | 600 | Títulos de pantalla |
| `--text-heading` | 17 / 24 px | 600 | Encabezados de tarjeta |
| `--text-body` | 15 / 22 px | 400 | Texto general, nombres de comercio |
| `--text-label` | 13 / 18 px | 500 | Etiquetas, pestañas, botones |
| `--text-caption` | 11 / 16 px | 500 | Marcas de tiempo, ejes, metadatos |

Interlineado apretado en las cifras grandes (ratio ~1.1) y holgado en el cuerpo (~1.45). Es lo que hace que un número se lea como objeto y un párrafo como texto.

### 3.3 La regla del decimal — firma del sistema

Las dos referencias coinciden en esto y es lo más distintivo que tienen. **Todo importe destacado separa la parte decimal**, que se renderiza más pequeña y en tinta secundaria:

```tsx
// El componente <Money> es el ÚNICO lugar que renderiza dinero.
// Nunca interpolar importes directamente en JSX.
<span className="money">
  <span className="money__integer">$1.847</span>
  <span className="money__fraction">,300</span>
</span>
```

```css
.money__fraction {
  font-size: 0.58em;
  color: var(--ink-secondary);
  font-weight: 500;
  vertical-align: baseline;
}
```

**Caso COP.** El peso colombiano no usa centavos en la práctica. Para COP, la "fracción" de-enfatizada son **los tres últimos dígitos** (los miles), que es donde cae la lectura rápida: `$1.847` **`,300`**. El componente decide según el locale; nunca se hardcodea.

Aplica en: saldo héroe, total del mes, importes de fila de transacción, tarjetas de presupuesto.
No aplica en: ejes de gráfica, tablas densas, CSV exportado.

### 3.4 Encabezados de peso mixto

Tomado de la referencia B. El encabezado nombra la **dimensión** en peso normal y el **valor** en negrita:

```tsx
<h2>Spending <strong>March</strong></h2>
<h2>Monthly <strong>Budget</strong></h2>
```

```css
h2 { font-weight: 400; color: var(--ink-secondary); }
h2 strong { font-weight: 600; color: var(--ink-primary); }
```

Da jerarquía sin añadir tamaño ni color. Se usa en encabezados de sección; **no** en títulos de pantalla ni en botones.

---

## 4. Espaciado, radios, elevación

### 4.1 Espaciado — escala de 4px

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
--space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
--space-12: 48px;
```

Margen lateral de pantalla: `--space-4` (16px). Separación entre tarjetas: `--space-3` (12px). Relleno interno de tarjeta: `--space-4`.

### 4.2 Radios

```css
--radius-sm:   8px;   /* píldoras, badges, chips */
--radius-md:   12px;  /* botones, campos, iconos contenedores */
--radius-lg:   16px;  /* tarjetas */
--radius-xl:   24px;  /* tarjeta héroe, hojas inferiores */
--radius-full: 9999px;/* avatares, píldoras de estado, FAB */
```

**Regla de anidación:** el radio interior es siempre menor que el exterior. Radio interior = exterior − relleno. Un elemento de 12px dentro de una tarjeta de 16px con 4px de relleno encaja; uno de 16px dentro de otro de 16px produce esquinas visualmente rotas.

### 4.3 Elevación — por superficie, no por sombra

En tema oscuro las sombras casi no se ven. La jerarquía se construye **subiendo el valor de la superficie**, no proyectando sombra:

| Nivel | Superficie | Uso |
| :--- | :--- | :--- |
| 0 | `--surface-base` | Fondo de página |
| 1 | `--surface-raised` | Tarjetas, filas de lista |
| 2 | `--surface-overlay` | Hojas, menús, popovers |

Sombra permitida **solo** en el nivel 2 y en el FAB, para separarlos del contenido que scrollea por debajo:

```css
--shadow-overlay: 0 8px 32px rgba(0,0,0,0.48);
```

---

## 5. Movimiento

Jean Paul lo señaló como clave. Y **P7 prohíbe Framer Motion**. No es una contradicción: lo que cuesta rendimiento no es la animación, es la **animación gobernada por JavaScript**.

### 5.1 La regla que lo resuelve

> **Solo se animan `transform` y `opacity`.**

Esas dos propiedades las resuelve el compositor, fuera del hilo principal. No provocan layout ni repaint, no bloquean la interacción y por tanto **no afectan al INP**. Animar `width`, `height`, `top`, `left`, `margin` o `background-color` sí lo hace, y está prohibido.

Con eso se consigue un sistema de movimiento rico con **0 KB de bundle** y sin tocar el presupuesto de P7.

### 5.2 Tokens

```css
--duration-instant:   100ms;  /* realimentación de pulsación */
--duration-fast:      150ms;  /* hover, foco, cambio de estado */
--duration-base:      220ms;  /* entrada de elementos, pestañas */
--duration-slow:      320ms;  /* hojas, transiciones de ruta */
--duration-deliberate:600ms;  /* conteo de cifras, celebración */

--ease-standard:  cubic-bezier(0.2, 0, 0, 1);      /* por defecto */
--ease-decelerate:cubic-bezier(0.05, 0.7, 0.1, 1); /* entradas */
--ease-accelerate:cubic-bezier(0.3, 0, 1, 1);      /* salidas */
--ease-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1); /* confirmaciones */
```

### 5.3 Patrones nombrados

| Patrón | Especificación | Dónde |
| :--- | :--- | :--- |
| **Conteo de cifra** | Interpolar el valor numérico en `--duration-deliberate` con `--ease-decelerate`. La cifra sube, no aparece de golpe | Saldo héroe, total del mes — solo en carga inicial, no en cada re-render |
| **Entrada escalonada de lista** | `opacity 0→1` + `translateY(8px)→0`, `--duration-base`, retardo de 24ms por fila, **máximo 8 filas** | Lista de transacciones al montar |
| **Deslizado del indicador de pestaña** | `transform: translateX()` sobre un subrayado absoluto, `--duration-base` | Control segmentado, barra inferior |
| **Hoja inferior** | `translateY(100%)→0`, `--duration-slow`, `--ease-decelerate`. Fondo `opacity 0→0.6` | Modales, selector de categoría |
| **Pulsación de éxito** | `scale(1)→1.06→1`, `--duration-base`, `--ease-overshoot`, una sola vez | Transacción guardada, logro obtenido |
| **Realimentación de pulsación** | `scale(0.97)` mientras `:active`, `--duration-instant` | Todos los elementos táctiles |
| **Esqueleto** | `opacity` pulsando 0.4↔0.7, 1.4s, infinito | Estados de carga |
| **Transición de ruta** | **View Transitions API** nativa. Cero librería | Navegación entre pestañas |

### 5.4 Movimiento reducido — obligatorio

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

El conteo de cifras salta al valor final. Las entradas escalonadas aparecen ya colocadas. **Nada de movimiento se convierte en un requisito para entender la interfaz** — si una animación comunica algo que el estado estático no comunica, la animación está mal diseñada.

### 5.5 Prohibido

- Framer Motion y cualquier librería de animación en la v1.
- Animar cualquier propiedad que no sea `transform` u `opacity`.
- Escalonar más de 8 elementos: a partir de ahí el último se siente lento.
- Animaciones en bucle fuera de los esqueletos de carga.
- `backdrop-filter` en cualquier contenedor con scroll (P7). Permitido solo en la barra inferior fija y en fondos de modal.

---

## 6. Componentes

### 6.1 Tarjeta de saldo héroe

El único sitio donde sobrevive el degradado cálido de la referencia A.

- Superficie: degradado lineal 135° de `#C2410C` a `#EA580C`.
- Radio `--radius-xl`, relleno `--space-5`.
- Etiqueta en `--text-label` sobre `rgba(255,255,255,0.72)`.
- Cifra en `--text-hero`, blanco puro, con la regla del decimal (§3.3).
- Acción de ocultar/mostrar saldo en la esquina superior derecha.
- **Sin sombra, sin borde.** El degradado ya la separa del fondo.

Es el único elemento con degradado en toda la app. Si aparece un segundo, deja de ser jerarquía y pasa a ser ruido.

### 6.2 Tarjeta estándar

```css
background: var(--surface-raised);
border-radius: var(--radius-lg);
padding: var(--space-4);
/* sin borde, sin sombra */
```

### 6.3 Fila de transacción

```
[ icono 40px ]  Nombre del comercio        $12.000
   radius-md    Categoría · 14:32            ,00
```

- Contenedor de icono: 40×40, `--radius-md`, fondo `--surface-overlay`.
- Comercio en `--text-body` / `--ink-primary`.
- Metadatos en `--text-caption` / `--ink-muted`.
- Importe alineado a la derecha, tabular, con regla del decimal.
- Altura mínima táctil: **44px**.
- Sin separadores: el espaciado de `--space-3` ya separa.
- Estado sin categorizar: punto de 6px en `--warning` a la izquierda del comercio.

### 6.4 Control segmentado

Píldora blanca sobre pista oscura, tomada de la referencia A.

- Pista: `--surface-raised`, `--radius-full`, relleno 3px.
- Elemento activo: fondo `--ink-primary`, texto `--ink-inverse`.
- El indicador se mueve con `transform: translateX()`, nunca reordenando el DOM.

### 6.5 Píldora de estado y delta

- Relleno `2px 8px`, `--radius-full`, `--text-caption`.
- Fondo: color semántico al 14% de opacidad. Texto: el color semántico pleno.
- **Siempre con símbolo direccional** (`↑` `↓`) además del color. Nunca color a secas.

### 6.6 Barra de progreso segmentada

De la referencia A, y es la mejor alternativa al donut para presupuestos.

- Altura 8px, `--radius-full`.
- Segmentos con la paleta categórica en orden fijo.
- **Separación de 2px del color de superficie entre segmentos.**
- Leyenda debajo: punto de 8px + etiqueta + valor.
- Pista sin consumir: `--surface-overlay`.

### 6.7 Tarjeta de métrica

Para un número que no necesita gráfica. **Preferir esto a un gráfico de un solo valor** — un gauge de arco para mostrar "76%" gasta el doble de espacio que el texto "76%".

```
Gasto semanal            <- --text-label, --ink-secondary
$500.200                 <- --text-display, regla del decimal
↑ 12% vs semana pasada   <- píldora de delta
```

### 6.8 Barra de navegación inferior

- 4 destinos en v1: **Inicio · Transacciones · Presupuestos · Ajustes**. La referencia A tenía 5; sobra uno para el alcance actual.
- Icono 24px + etiqueta `--text-caption`.
- Activo: icono y etiqueta en `--brand-400`.
- Fondo `--surface-raised` con `backdrop-filter: blur(20px)` — permitido aquí porque es fija y no scrollea.
- Respeta `env(safe-area-inset-bottom)`.

---

## 7. Gráficas

Regla previa: **antes de dibujar, preguntar si hace falta un gráfico.** Un solo número es una tarjeta de métrica, no un gauge.

### 7.1 Formas permitidas

| Trabajo del dato | Forma | Notas |
| :--- | :--- | :--- |
| Gasto por categoría a lo largo del tiempo | **Barras apiladas** | Como la referencia A. Máximo 6 categorías, el resto en "Otros" |
| Comparación entre categorías | **Barras horizontales**, ordenadas por valor | Etiquetas legibles sin rotar |
| Parte de un todo | **Barra segmentada** (§6.6) | Preferida sobre el donut |
| Tendencia continua | **Línea**, 2px | Con crosshair y tooltip |
| Un solo número | **Tarjeta de métrica** (§6.7) | Nunca un gauge |

**Donut:** permitido solo en la tarjeta de presupuesto, con **≤4 segmentos** y etiquetas directas. Con más segmentos se vuelve ilegible y hay que cambiar a barra segmentada.

### 7.2 Especificación de marcas

- Extremos de dato redondeados a 4px, anclados a la línea base.
- **2px de separación del color de superficie** entre segmentos apilados y entre barras adyacentes.
- Líneas de 2px; marcadores ≥8px.
- Rejilla y ejes recesivos: `--border-hairline`, sin línea de eje vertical.
- Etiquetas directas selectivas — **nunca un número sobre cada punto**.
- El texto lleva tokens de tinta, **jamás el color de la serie**.

### 7.3 Obligatorio en toda gráfica

- **Un solo eje.** Nunca dos escalas verticales. Dos magnitudes distintas → dos gráficas.
- **Leyenda siempre que haya ≥2 series** (una sola serie no la necesita: el título la nombra).
- **Capa de hover por defecto:** crosshair y tooltip en línea/área, tooltip por marca en barras.
- **Vista de tabla disponible** para cada gráfica. Es accesibilidad y además es lo que permite verificar un número.
- Con overflow horizontal, el contenedor scrollea; **la página nunca**.

---

## 8. Accesibilidad

- Contraste de texto ≥ 4.5:1 (`--ink-secondary` sobre `--surface-raised` cumple; `--ink-muted` solo para metadatos no esenciales).
- Objetivos táctiles ≥ 44×44 px.
- Foco visible siempre: anillo de 2px en `--brand-400` con 2px de separación.
- **La información nunca se codifica solo con color.** Todo color semántico va con icono o texto; toda serie de gráfica va con leyenda o etiqueta directa.
- `prefers-reduced-motion` respetado (§5.4).
- Jerarquía de encabezados real: los encabezados de peso mixto (§3.4) siguen siendo `<h2>`, no `<div>` estilizados.

---

## 9. Prohibiciones

1. **Nada de literales de color en componentes.** Solo variables CSS. Un test de CI puede grepear `#` en `src/components/`.
2. **Nada de renderizar dinero fuera del componente `<Money>`.** Ni interpolación, ni `toLocaleString` suelto.
3. **Nada de `backdrop-filter` en contenedores con scroll.**
4. **Nada de animar propiedades que no sean `transform` u `opacity`.**
5. **Nada de un segundo degradado** más allá de la tarjeta héroe.
6. **Nada de color semántico usado como categoría** de gráfica.
7. **Nada de paleta categórica ampliada sin volver a correr el validador.**
