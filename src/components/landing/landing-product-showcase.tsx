'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';

import { LandingBanksSection } from '@/components/landing/landing-banks-section';
import { LandingDayJourney } from '@/components/landing/landing-day-journey';
import { LandingPrivacyBento } from '@/components/landing/landing-privacy-bento';
import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';

interface SimulationItem {
  readonly store: string;
  readonly amountMinor: bigint;
  readonly categoryName: string;
  readonly categoryIcon: string;
  readonly time: string;
}

const SIMULATION_POOL: readonly SimulationItem[] = [
  {
    store: 'Starbucks Reserva · Chicó',
    amountMinor: 1850000n,
    categoryName: 'Cafetería',
    categoryIcon: 'Coffee',
    time: 'hace segundos',
  },
  {
    store: 'Éxito Express · Cra 11',
    amountMinor: 8630000n,
    categoryName: 'Supermercado',
    categoryIcon: 'ShoppingCart',
    time: 'hace segundos',
  },
  {
    store: 'Uber Trip · Carrera 7',
    amountMinor: 2480000n,
    categoryName: 'Transporte',
    categoryIcon: 'Car',
    time: 'hace segundos',
  },
  {
    store: 'Rappi · Farmacia',
    amountMinor: 3450000n,
    categoryName: 'Salud',
    categoryIcon: 'HeartPulse',
    time: 'hace segundos',
  },
];


/**
 * El contraste vive en datos y no en JSX porque las dos columnas tienen que
 * mantener el mismo número de filas: si se desincronizan, la comparación
 * deja de leerse como comparación.
 */
/* La franja de cifras.
 *
 * La versión anterior contaba INVENTARIO — «2 bancos», «3 formas» — y el
 * inventario de un producto joven siempre se lee pequeño. Estas cuatro
 * cuentan lo que el producto le ahorra o le garantiza a la persona, que es
 * lo que no depende de cuánto hayamos construido todavía: el trabajo que
 * desaparece, cuándo funciona, de quién son los datos y qué cuesta.
 *
 * Las cuatro se pueden comprobar: los ocho pasos son los de la comparación
 * de aquí arriba, el Atajo corre con el teléfono bloqueado, el export vive
 * en /api/v1/export con las once columnas de csv-export.service.ts, y no
 * hay pasarela de pago en ninguna parte del repositorio.
 */
const HEADLINE_FACTS = [
  { value: '8→0', label: 'pasos por gasto', note: 'Los ocho de arriba desaparecen. No quedan dos: quedan cero' },
  { value: '24/7', label: 'capturando', note: 'Con el teléfono bloqueado y en el bolsillo' },
  { value: '100%', label: 'tuyo y exportable', note: 'Todo tu historial en CSV, cuando quieras, sin pedir permiso' },
  { value: '$0', label: 'para siempre gratis', note: 'Sin tarjeta, sin publicidad, sin vender tus datos' },
];

/* Las FAQ del final.
 *
 * No son relleno de SEO: son las objeciones que frenan el registro, puestas
 * donde se decide. Baymard mide que las señales de confianza convierten
 * cerca del botón y casi nada desde el pie, y la mitad de estas preguntas
 * son exactamente eso — la clave del banco, el precio, quién ve los datos.
 *
 * Las respuestas dicen que no cuando la respuesta es que no. Una FAQ que
 * solo confirma lo que el producto quiere oír no la lee nadie dos veces.
 */
interface Faq {
  readonly q: string;
  readonly a: string;
}

const FAQS: readonly Faq[] = [
  {
    q: '¿Necesito un iPhone?',
    a: 'Para la captura automática de compras con tarjeta, sí: depende de un Atajo de iOS que lee la alerta de tu banco. Desde cualquier otro teléfono puedes registrar por Telegram escribiendo «12000 almuerzo», o a mano en la app, y todo lo demás funciona igual.',
  },
  {
    q: '¿Tengo que darte la clave de mi banco?',
    a: 'No, y no hay forma de dárnosla aunque quisieras: no existe ese campo. El Atajo corre en tu teléfono y solo nos manda el monto y el nombre del comercio que venían en la alerta. Nunca tocamos tu cuenta.',
  },
  {
    q: '¿Gratis de verdad? ¿Dónde está la trampa?',
    a: 'Es un proyecto personal que uso a diario, no una empresa con inversionistas que recuperar. No hay publicidad, no vendemos datos y no hay pasarela de pago en ninguna parte. Si algún día hay un plan pago, lo que ya tengas seguirá siendo tuyo y exportable.',
  },
  {
    q: '¿Qué pasa con el efectivo, Nequi y los QR?',
    a: 'Ningún SMS los anuncia, así que no entran solos. Le escribes al bot de Telegram —«12000 almuerzo»— y queda registrado y categorizado en el momento. Es el mismo gesto que mandar un mensaje.',
  },
  {
    q: '¿Puedo sacar mis datos si me quiero ir?',
    a: 'Cuando quieras y sin pedir permiso: un CSV con todo tu historial, once columnas, listo para Excel o para otra app. Está en tu perfil.',
  },
  {
    q: '¿Reasonny me va a decir en qué invertir?',
    a: 'No. Te muestra tu propio comportamiento —en qué se te va el mes, qué se está acelerando— y ahí para. Asesoría financiera es otra cosa, con otra regulación, y no es lo que esto es.',
  },
];

const MANUAL_STEPS: readonly string[] = [
  'Terminas de pagar y vuelves a sacar el celular',
  'Desbloqueas y buscas la app entre las demás',
  'Esperas a que cargue y pulsas «+»',
  'Escribes el monto a mano, dígito por dígito',
  'Eliges la cuenta o la tarjeta con que pagaste',
  'Buscas la categoría en una lista larga',
  'Guardas, y repites decenas de veces al mes',
  'A los pocos días lo dejas, y el mes ya no cuadra',
];

const REASONNY_STEPS: readonly string[] = [
  'Pagas normal, con tu tarjeta o con Apple Pay',
  'Un atajo en tu iPhone lo registra en segundo plano',
  'El motor de reglas reconoce tus comercios de siempre',
  'Solo te pregunta la categoría cuando de verdad duda',
  'Respondes con dos toques desde la pantalla de bloqueo',
  'El efectivo y los QR entran por un mensaje de Telegram',
  'A fin de mes el extracto recupera lo que faltara',
  'Nunca abriste un formulario, y el mes cuadra',
];

interface InsightExample {
  readonly quote: string;
  readonly desc: string;
}

const INSIGHT_EXAMPLES: readonly InsightExample[] = [
  {
    quote: '«Tus pedidos de comida a domicilio de noche vienen subiendo estas últimas semanas.»',
    desc: 'Detecta cuándo un hábito se acelera, mientras todavía queda mes por delante.',
  },
  {
    quote: '«Hay cobros que se repiten todos los meses y quizá ya no estés usando.»',
    desc: 'Identifica cargos recurrentes que se camuflan bajo nombres poco claros en el extracto.',
  },
  {
    quote: '«A este ritmo, terminas el mes por encima de lo que gastaste el anterior.»',
    desc: 'Proyecta hacia dónde va tu comportamiento y te lo dice mientras aún puedes ajustarlo.',
  },
];

export function LandingProductShowcase(): React.ReactElement {
  const [simulatedBalanceMinor, setSimulatedBalanceMinor] = useState<bigint>(348000000n);
  const [simulationStep, setSimulationStep] = useState<number>(0);
  const [phoneToast, setPhoneToast] = useState<string>('Toca el botón para registrar un pago en vivo');

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    const elements = document.querySelectorAll('.reveal-on-scroll');
    elements.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, []);

  function handleTriggerSimulation(): void {
    const nextStep = (simulationStep + 1) % SIMULATION_POOL.length;
    const currentTx = SIMULATION_POOL[nextStep]!;
    setSimulationStep(nextStep);
    setSimulatedBalanceMinor((prev) => (prev > currentTx.amountMinor ? prev - currentTx.amountMinor : 348000000n));
    setPhoneToast(`Pago detectado y registrado: ${currentTx.store}`);
  }

  const activeSimulation = SIMULATION_POOL[simulationStep]!;

  return (
    <section
      id="product-showcase"
      className="landing-showcase-section--app"
      aria-label="Cómo funciona Reasonny"
    >
      {/* ── 1. Hero de Sección (El Problema Real vs. Reasonny) ────────────── */}
      <div className="landing-app-hero reveal-on-scroll">
        <h2 className="landing-app-headline">
          Registrar gastos a mano <br />
          <span className="landing-headline-gold">casi siempre se abandona.</span>
        </h2>
        <p className="landing-app-subhead">
          Las apps tradicionales te exigen abrir una pantalla decenas de veces al mes para anotar cada café. A los pocos días da pereza y el balance no cuadra. Reasonny fue diseñado para que registrar tus gastos cueste lo más cerca de <strong className="landing-headline-gold">cero esfuerzo posible</strong>.
        </p>
      </div>

      {/* ── 1b. El contraste ──────────────────────────────────────────────
          Las dos columnas se generan de dos arreglos del mismo largo: una
          comparación con distinto número de filas se lee como trampa.        */}
      <div className="landing-shift-grid reveal-on-scroll">
        <div className="landing-shift-card landing-shift-card--old">
          <div className="landing-shift-head">
            <h3 className="landing-shift-title">Hasta hoy: anotar cada compra a mano</h3>
          </div>
          <ol className="landing-shift-steps">
            {MANUAL_STEPS.map((step, i) => (
              <li key={step} className="landing-shift-step">
                <span className="landing-shift-num landing-shift-num--old" aria-hidden="true">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="landing-shift-card landing-shift-card--new">
          <div className="landing-shift-head">
            <h3 className="landing-shift-title">Con Reasonny: lo mismo, sin que hagas nada</h3>
          </div>
          <ol className="landing-shift-steps">
            {REASONNY_STEPS.map((step, i) => (
              <li key={step} className="landing-shift-step">
                <span className="landing-shift-num landing-shift-num--new" aria-hidden="true">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── 2. Las cifras y un día ─────────────────────────────────────
          Primero las cuatro cifras que se pueden comprobar; después un
          solo martes recorriendo el sistema, en vez de cuatro mockups de
          pantallas falsas. */}
      <div className="landing-facts-strip reveal-on-scroll">
        {HEADLINE_FACTS.map((f) => (
          <div key={f.label} className="landing-fact">
            <span className="landing-fact-value">{f.value}</span>
            <span className="landing-fact-label">{f.label}</span>
            <span className="landing-fact-note">{f.note}</span>
          </div>
        ))}
      </div>

      <LandingDayJourney />

      {/* ── 3. Los bancos ────────────────────────────────────────────── */}
      <LandingBanksSection />

      {/* ── 4. Banner con Mockup de la App Real (Velvet & Imperial Wine) ─────── */}
      <div className="landing-app-phone-banner reveal-on-scroll">
        <div className="landing-app-phone-copy-col">

          <h3 className="landing-app-phone-headline">
            Diseñada para vivir en reposo.
          </h3>

          <p className="landing-app-phone-subhead">
            Con la estética de un reloj de lujo y la precisión de un libro contable. Pulsa el botón para simular una compra y ver cómo Reasonny reacciona en tiempo real.
          </p>

          <div className="landing-app-phone-stats-row">
            <div className="landing-app-phone-stat-item">
              <span className="landing-app-phone-stat-val">0</span>
              <span className="landing-app-phone-stat-label">Pantallas que abrir</span>
            </div>
            <div className="landing-app-phone-stat-item">
              <span className="landing-app-phone-stat-val">0</span>
              <span className="landing-app-phone-stat-label">Formularios manuales</span>
            </div>
            <div className="landing-app-phone-stat-item">
              <span className="landing-app-phone-stat-val">Cifrado</span>
              <span className="landing-app-phone-stat-label">En reposo y en tránsito</span>
            </div>
          </div>

          <Link href="/sign-in" className="landing-luxury-cta-btn">
            <span>Crear cuenta con tu correo</span>
            <span className="landing-luxury-cta-arrow" aria-hidden="true">
              <CategoryIcon name="ChevronRight" size={15} />
            </span>
          </Link>
        </div>

        {/* Mockup del Teléfono Mostrando el Dashboard Real */}
        <div className="landing-phone-stage-wrapper">
          <div className="landing-phone-device--app">
            <div className="landing-phone-screen-inner--app">
              <div className="landing-phone-island" aria-hidden="true" />

              {/* Balance Hero Card Real de la App */}
              <div className="landing-phone-app-hero">
                <div className="landing-phone-app-greeting">
                  <span>Hola, Jean Paul</span>
                  <div className="landing-phone-app-avatar">JP</div>
                </div>
                <div className="landing-phone-app-balance">
                  <Money amountMinor={simulatedBalanceMinor} currency="COP" />
                </div>
                <div className="landing-phone-app-pacing">
                  Ritmo: Óptimo · $125.000/día proyectado
                </div>
              </div>

              {/* Mini Ledger de Transacciones */}
              <div className="landing-phone-mini-ledger">
                <div className="landing-phone-mini-row">
                  <div className="landing-phone-mini-left">
                    <div className="landing-phone-mini-icon">
                      <CategoryIcon name={activeSimulation.categoryIcon} size={13} />
                    </div>
                    <div className="landing-phone-mini-info">
                      <span className="landing-phone-mini-name">{activeSimulation.store}</span>
                      <span className="landing-phone-mini-meta">
                        <span>{activeSimulation.time}</span>
                        <span className="landing-phone-auto-badge">Auto</span>
                      </span>
                    </div>
                  </div>
                  <span className="landing-phone-mini-amt">
                    -<Money amountMinor={activeSimulation.amountMinor} currency="COP" />
                  </span>
                </div>

                <div className="landing-phone-mini-row">
                  <div className="landing-phone-mini-left">
                    <div className="landing-phone-mini-icon">
                      <CategoryIcon name="ShoppingCart" size={13} />
                    </div>
                    <div className="landing-phone-mini-info">
                      <span className="landing-phone-mini-name">Carulla Express</span>
                      <span className="landing-phone-mini-meta">
                        <span>hace 2h</span>
                        <span className="landing-phone-auto-badge">Auto</span>
                      </span>
                    </div>
                  </div>
                  <span className="landing-phone-mini-amt">
                    -<Money amountMinor={4820000n} currency="COP" />
                  </span>
                </div>
              </div>

              {/* Botón de Simulación Táctil */}
              <button
                type="button"
                onClick={handleTriggerSimulation}
                className="landing-phone-sim-btn--app"
              >
                <CategoryIcon name="Zap" size={14} />
                <span>Simular compra con Apple Pay</span>
              </button>

              <div className="landing-phone-toast">
                {phoneToast}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. La privacidad, en bento ─────────────────────────────── */}
      <LandingPrivacyBento />

      <div id="features-faq" className="landing-faq reveal-on-scroll">
        <div className="landing-faq-intro">
          <h3 className="landing-faq-headline">
            Lo que preguntarías <span className="landing-headline-gold">si me tuvieras enfrente.</span>
          </h3>
        </div>

        <div className="landing-faq-list">
          {FAQS.map((f) => (
            <details key={f.q} className="landing-faq-item">
              <summary className="landing-faq-q">
                <span>{f.q}</span>
                <span className="landing-faq-sign" aria-hidden="true" />
              </summary>
              <p className="landing-faq-a">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* ── 6. Qué ve el sistema una vez el gasto ya está dentro ──────────
          Va con descargo explícito: son ejemplos de la FORMA de la
          observación, no cifras medidas (P3 y P6).                        */}
      <div className="landing-insight-block reveal-on-scroll">
        <div className="landing-insight-header">
          <h3 className="landing-insight-headline">
            Capturar es la mitad. <span className="landing-headline-gold">La otra es entender.</span>
          </h3>
          <p className="landing-insight-subhead">
            Ejemplos del tipo de observación que el sistema puede generar a partir de tus propios datos. No son cifras reales ni promesas de resultado: son la forma que tendría lo que te diría.
          </p>
        </div>

        <div className="landing-insight-grid">
          {INSIGHT_EXAMPLES.map((item, i) => (
            <div key={item.quote} className="landing-insight-card">
              <span className="landing-insight-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <p className="landing-insight-quote">{item.quote}</p>
              <p className="landing-insight-desc">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
