'use client';

import Link from 'next/link';
import React, { useState } from 'react';

export function LandingProductShowcase(): React.ReactElement {
  const [telegramSelected, setTelegramSelected] = useState<string>('Restaurante');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  function handleTelegramSelect(cat: string): void {
    setTelegramSelected(cat);
    setFeedbackToast(`Regla aprendida: este comercio → ${cat} ✓`);
    window.setTimeout(() => setFeedbackToast(null), 2800);
  }

  return (
    <section
      id="product-showcase"
      className="landing-showcase-section landing-showcase-section--dark"
      aria-label="Cómo funciona Reasonny"
    >
      {/* ── Tesis ─────────────────────────────────────────────────────────── */}
      <div className="landing-thesis-block">
        <h2 className="landing-thesis-headline landing-thesis-headline--dark">
          Registrar gastos a mano <br />
          <span className="landing-thesis-gold-highlight">casi siempre se abandona.</span>
        </h2>
        <p className="landing-thesis-subhead landing-thesis-subhead--dark">
          Las apps tradicionales te piden abrir una pantalla decenas de veces al mes para anotar
          cada café. A los pocos días da pereza, las compras pequeñas se olvidan y a fin de mes el
          balance no cuadra. La meta de Reasonny es que registrar{' '}
          <strong className="landing-thesis-strong-dark">cueste lo más cerca de cero esfuerzo posible.</strong>
        </p>
      </div>

      {/* ── Comparación de fricción ───────────────────────────────────────── */}
      <div className="landing-friction-grid">
        <div className="landing-friction-card landing-friction-card--old-dark">
          <h3 className="landing-friction-title landing-friction-title--old-dark">
            El camino manual, cada compra
          </h3>
          <div className="landing-friction-steps">
            {[
              'Sacar el celular después de pagar',
              'Desbloquear y buscar la app de gastos',
              'Esperar que cargue y pulsar «+»',
              'Escribir el monto y elegir la cuenta',
              'Buscar la categoría en una lista larga',
              'Repetirlo decenas de veces al mes… hasta dejarlo',
            ].map((step) => (
              <div key={step} className="landing-friction-step-item landing-friction-step-item--dark">
                <span className="landing-friction-icon-cross-dark">✕</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-friction-card landing-friction-card--new-dark">
          <h3 className="landing-friction-title landing-friction-title--new-dark">
            Con Reasonny
          </h3>
          <div className="landing-friction-steps">
            {[
              'Pagas normal, con tu tarjeta o Apple Pay',
              'Un atajo en tu iPhone lo registra al instante',
              'El motor de reglas aprende tus comercios habituales',
              'Solo te pregunta la categoría cuando duda',
              'Al final del mes, subes el extracto y se concilia lo que falte',
              'Tu tiempo es para vivir, no para llevar la contabilidad',
            ].map((step) => (
              <div key={step} className="landing-friction-step-item landing-friction-step-item--dark">
                <span className="landing-friction-icon-check-dark">✓</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tira de arquitectura ──────────────────────────────────────────── */}
      <div className="landing-arch-strip-bar">
        <div className="landing-arch-strip-item">
          <span className="landing-arch-strip-num">01</span>
          <div className="landing-arch-strip-content">
            <h4 className="landing-arch-strip-title">Aislamiento por usuario</h4>
            <p className="landing-arch-strip-desc">
              Cada cuenta está separada de las demás a nivel de base de datos. Tus movimientos son tuyos.
            </p>
          </div>
        </div>

        <div className="landing-arch-strip-divider" aria-hidden="true" />

        <div className="landing-arch-strip-item">
          <span className="landing-arch-strip-num">02</span>
          <div className="landing-arch-strip-content">
            <h4 className="landing-arch-strip-title">Captura de baja fricción</h4>
            <p className="landing-arch-strip-desc">
              Atajo de iPhone, mensaje de Telegram o texto en lenguaje natural. Tú eliges.
            </p>
          </div>
        </div>

        <div className="landing-arch-strip-divider" aria-hidden="true" />

        <div className="landing-arch-strip-item">
          <span className="landing-arch-strip-num">03</span>
          <div className="landing-arch-strip-content">
            <h4 className="landing-arch-strip-title">Tus cuentas de siempre</h4>
            <p className="landing-arch-strip-desc">
              Reasonny no es un banco ni emite tarjetas. Funciona con las cuentas y tarjetas que ya usas.
            </p>
          </div>
        </div>
      </div>

      {/* ── Tarjeta (genérica, no de marca) ───────────────────────────────── */}
      <div id="features-card" className="landing-3d-feature-stage">
        <div className="landing-3d-stage-header">
          <div className="landing-3d-headline-copy">
            <h3 className="landing-3d-title">
              Claridad sobre tu dinero, <br />
              <span className="landing-gold-gradient-text">sin cambiar de banco ni de tarjeta.</span>
            </h3>
            <p className="landing-3d-subhead">
              Pagas con las tarjetas que ya tienes. Reasonny recibe el registro del pago, lo
              clasifica con su motor de reglas y mantiene tu mes cuadrado.
            </p>
          </div>

          <div className="landing-3d-cta-wrap">
            <Link href="/sign-in" className="landing-gold-cta-btn">
              <span>Probar Reasonny</span>
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        </div>

        <div className="landing-isometric-card-stage">
          <div className="landing-isometric-card-glow" aria-hidden="true" />

          <div className="landing-isometric-card-wrapper">
            <div className="landing-3d-card-body">
              <svg
                className="landing-topographic-pattern"
                viewBox="0 0 540 340"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M0 60C80 40 160 90 240 60C320 30 400 70 480 50C520 40 560 50 600 60" stroke="url(#contourGrad)" strokeWidth="1.2" strokeOpacity="0.4" />
                <path d="M0 110C90 90 180 140 270 110C360 80 440 120 520 100C560 90 600 105 640 110" stroke="url(#contourGrad)" strokeWidth="1.2" strokeOpacity="0.35" />
                <path d="M0 160C110 140 200 200 300 160C400 120 480 170 560 150C600 140 630 155 670 160" stroke="url(#contourGrad)" strokeWidth="1.2" strokeOpacity="0.3" />
                <path d="M0 210C100 190 190 250 290 220C390 180 460 230 550 210C600 200 640 215 680 220" stroke="url(#contourGrad)" strokeWidth="1.2" strokeOpacity="0.25" />
                <path d="M0 260C90 240 180 290 280 270C380 240 450 280 540 260C600 250 630 265 670 270" stroke="url(#contourGrad)" strokeWidth="1.2" strokeOpacity="0.2" />
                <defs>
                  <linearGradient id="contourGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--landing-champagne-gold)" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="var(--landing-champagne-dim)" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="var(--landing-dark-wine)" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="landing-3d-card-header">
                <div className="landing-3d-card-brand">
                  <span className="landing-3d-card-logo-text">TUS TARJETAS</span>
                </div>
                <div className="landing-3d-contactless-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--landing-champagne-gold)" strokeWidth="2">
                    <path d="M8.5 16.5C9.5 15.5 10 14 10 12C10 10 9.5 8.5 8.5 7.5" strokeLinecap="round" />
                    <path d="M12 19C14 17 15 14.5 15 12C15 9.5 14 7 12 5" strokeLinecap="round" />
                    <path d="M15.5 21.5C18.5 19 20 15.5 20 12C20 8.5 18.5 5 15.5 2.5" strokeLinecap="round" />
                  </svg>
                </div>
              </div>

              <div className="landing-3d-gold-chip" aria-hidden="true">
                <div className="landing-chip-pin-lines">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>

              <div className="landing-3d-card-footer">
                <div>
                  <span className="landing-3d-card-label">FUNCIONA CON</span>
                  <p className="landing-3d-card-name">APPLE PAY · VISA · MASTERCARD</p>
                </div>
                <div>
                  <span className="landing-3d-card-label">CONCILIACIÓN</span>
                  <p className="landing-3d-card-date">MENSUAL</p>
                </div>
              </div>

              <div className="landing-3d-card-sheen" aria-hidden="true" />
            </div>
          </div>

          <div className="landing-isometric-shadow" aria-hidden="true" />
        </div>
      </div>

      {/* ── Cero fricción ─────────────────────────────────────────────────── */}
      <div id="features-zero-touch" className="landing-tap-go-stage landing-tap-go-stage--single">
        <div className="landing-tap-go-info">
          <span className="landing-dark-pill-tag">Registro sin esfuerzo</span>
          <h3 className="landing-tap-go-title">
            Un gesto y listo. <br />
            <span className="landing-gold-gradient-text">O ni siquiera eso.</span>
          </h3>
          <p className="landing-tap-go-desc">
            El objetivo de la primera versión es una sola cosa: eliminar la fricción de registrar
            un gasto. En lugar de «tengo que abrir la app y anotar esto», la sensación es
            «el gasto ya quedó registrado». La entrada puede venir de un atajo en tu teléfono,
            de un mensaje de Telegram («gasté 35.000 en un café») o de escribirlo a mano en segundos.
          </p>
          <Link href="/sign-in" className="landing-gold-cta-btn">
            <span>Ver cómo funciona</span>
            <span aria-hidden="true"> →</span>
          </Link>
        </div>
      </div>

      {/* ── Privacidad ───────────────────────────────────────────────────── */}
      <div id="features-security" className="landing-enclave-panel-stage">
        <div className="landing-enclave-vault-card">
          <div className="landing-enclave-shield-wrap" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="54" height="54" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M32 6L52 14V28C52 42 43 53 32 58C21 53 12 42 12 28V14L32 6Z"
                stroke="var(--landing-champagne-gold)"
                strokeWidth="2"
                fill="var(--landing-dark-wine)"
                fillOpacity="0.25"
              />
              <path d="M32 22V34M32 42H32.02" stroke="var(--landing-champagne-gold)" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>

          <h3 className="landing-enclave-vault-title">
            Tu dinero. Tus datos.<br />
            <span className="landing-gold-gradient-text">Sin publicidad.</span>
          </h3>

          <p className="landing-enclave-vault-desc">
            Reasonny separa los datos de cada usuario a nivel de base de datos. No vendemos ni
            perfilamos tus hábitos de consumo para redes de anunciantes, y cualquier integración
            bancaria futura será estrictamente de solo lectura.
          </p>

          <div className="landing-hardware-stats-grid">
            <div className="landing-hardware-stat-box">
              <span className="landing-stat-box-label">Aislamiento por usuario</span>
              <span className="landing-stat-box-val" style={{ color: 'var(--positive)' }}>A nivel de datos</span>
            </div>
            <div className="landing-hardware-stat-box">
              <span className="landing-stat-box-label">Venta o perfilado</span>
              <span className="landing-stat-box-val" style={{ color: 'var(--positive)' }}>Nunca</span>
            </div>
            <div className="landing-hardware-stat-box">
              <span className="landing-stat-box-label">Cifrado en reposo</span>
              <span className="landing-stat-box-val" style={{ color: 'var(--landing-champagne-gold)' }}>Sí</span>
            </div>
            <div className="landing-hardware-stat-box">
              <span className="landing-stat-box-label">Acceso a tu banco</span>
              <span className="landing-stat-box-val" style={{ color: 'var(--landing-champagne-gold)' }}>Solo lectura</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Panel de telemetría (mock de la app) ──────────────────────────── */}
      <div id="features-telemetry" className="landing-vision-telemetry-stage">
        <div className="landing-vision-header">
          <h3 className="landing-vision-title">
            Los datos descubren los hechos. <br />
            <span className="landing-gold-gradient-text">Reasonny te cuenta la historia.</span>
          </h3>
          <p className="landing-vision-subhead">
            No se trata de otra pantalla llena de gráficas. El backend agrupa, compara periodos y
            detecta tendencias; luego eso se traduce a una explicación en lenguaje claro.
          </p>
        </div>

        <div className="landing-vision-glass-panel">
          <div className="landing-vision-panel-top">
            <div>
              <span className="landing-vision-kicker-label">GASTO DEL MES · EJEMPLO</span>
              <div className="landing-vision-amount-row">
                <span className="landing-vision-main-amount">$1.842.560</span>
                <span className="landing-vision-trend-badge">↓ 8% vs. mes anterior</span>
              </div>
              <span className="landing-vision-period-tag">Datos de muestra</span>
            </div>

            <div className="landing-vision-calendar-pill">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              <span>Este mes</span>
            </div>
          </div>

          <div className="landing-vision-chart-area">
            <svg className="landing-vision-spline-svg" viewBox="0 0 800 240" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="chartFillGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--landing-champagne-gold)" stopOpacity="0.28" />
                  <stop offset="60%" stopColor="var(--landing-dark-wine)" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="var(--landing-deep-black)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="chartStrokeGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--landing-champagne-dim)" />
                  <stop offset="40%" stopColor="var(--landing-champagne-gold)" />
                  <stop offset="75%" stopColor="var(--landing-warm-white)" />
                  <stop offset="100%" stopColor="var(--landing-champagne-gold)" />
                </linearGradient>
              </defs>
              <path d="M 0 170 Q 70 185 130 195 T 260 140 T 380 120 T 500 135 T 620 90 T 730 65 L 800 50 L 800 240 L 0 240 Z" fill="url(#chartFillGrad)" />
              <path d="M 0 170 Q 70 185 130 195 T 260 140 T 380 120 T 500 135 T 620 90 T 730 65 L 800 50" fill="none" stroke="url(#chartStrokeGrad)" strokeWidth="3.2" strokeLinecap="round" />
              <circle cx="620" cy="90" r="5" fill="var(--landing-warm-white)" />
              <circle cx="620" cy="90" r="12" fill="none" stroke="var(--landing-champagne-gold)" strokeWidth="2" strokeOpacity="0.6" />
            </svg>

            <div className="landing-vision-timeline-axis">
              <span>Sem 1</span>
              <span>Sem 2</span>
              <span>Sem 3</span>
              <span>Sem 4</span>
            </div>
          </div>

          <div className="landing-vision-stacked-pills">
            <div className="landing-glass-asset-row">
              <div className="landing-glass-asset-left">
                <span className="landing-asset-icon-badge landing-badge-nfc">⚡</span>
                <div>
                  <h5 className="landing-asset-name">Atajo de iPhone</h5>
                  <span className="landing-asset-desc">Supermercado</span>
                </div>
              </div>
              <div className="landing-glass-asset-right">
                <span className="landing-asset-amount">$142.500</span>
                <span className="landing-asset-status-pill">Registrado ✓</span>
              </div>
            </div>

            <div className="landing-glass-asset-row">
              <div className="landing-glass-asset-left">
                <span className="landing-asset-icon-badge landing-badge-bot">💬</span>
                <div>
                  <h5 className="landing-asset-name">Mensaje de Telegram</h5>
                  <span className="landing-asset-desc">Restaurante</span>
                </div>
              </div>
              <div className="landing-glass-asset-right">
                <span className="landing-asset-amount">$68.000</span>
                <span className="landing-asset-status-pill">Categoría confirmada ✓</span>
              </div>
            </div>

            <div className="landing-glass-asset-row">
              <div className="landing-glass-asset-left">
                <span className="landing-asset-icon-badge landing-badge-vision">📄</span>
                <div>
                  <h5 className="landing-asset-name">Extracto en PDF</h5>
                  <span className="landing-asset-desc">14 movimientos leídos</span>
                </div>
              </div>
              <div className="landing-glass-asset-right">
                <span className="landing-asset-amount">$1.842.560</span>
                <span className="landing-asset-status-pill">Conciliado ✓</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Telegram ──────────────────────────────────────────────────────── */}
      <div id="features-telegram" className="landing-showcase-feature-row landing-showcase-feature-row--reversed">
        <div className="landing-feature-media-frame landing-feature-media-frame--dark">
          <div className="landing-native-phone-frame">
            <div className="landing-phone-speaker" aria-hidden="true" />

            <div className="landing-phone-screen">
              <div className="landing-tg-app-header">
                <div className="landing-tg-user-avatar">💬</div>
                <div>
                  <div className="landing-tg-bot-name">Reasonny</div>
                  <div className="landing-tg-bot-sub">bot · hoy 2:15 PM</div>
                </div>
              </div>

              <div className="landing-tg-balloon">
                <p className="landing-tg-balloon-text">
                  <strong>Nueva compra registrada:</strong><br />
                  <span className="landing-tg-highlight">$42.500</span> en un comercio nuevo con tu tarjeta terminada en 20.
                </p>
                <p className="landing-tg-balloon-sub">
                  El motor no está seguro de la categoría. ¿Dónde la ponemos?
                </p>

                <div className="landing-tg-buttons-grid">
                  {['Restaurante', 'Mercado', 'Salidas'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => handleTelegramSelect(cat)}
                      className={`landing-telegram-btn landing-telegram-btn--dark ${
                        telegramSelected === cat ? 'landing-telegram-btn--selected-dark' : ''
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {feedbackToast && (
                <div className="landing-telegram-live-feedback">{feedbackToast}</div>
              )}
            </div>
          </div>
        </div>

        <div className="landing-tier-info">
          <h3 className="landing-tier-title landing-tier-title--dark">
            Una notificación con botones.<br />
            <span className="landing-gold-gradient-text">Sin abrir ninguna web.</span>
          </h3>
          <p className="landing-tier-desc landing-tier-desc--dark">
            Si compraste en un comercio nuevo y el motor de reglas no tiene certeza, recibes una
            alerta en Telegram con botones de categoría. Dos toques desde la pantalla de bloqueo y
            el sistema aprende la regla para la próxima vez.
          </p>
          <div className="landing-showcase-stats">
            <div className="landing-showcase-stat-pill landing-showcase-stat-pill--dark">
              <span className="landing-stat-label" style={{ color: 'var(--landing-champagne-gold)' }}>Esfuerzo</span>
              <span className="landing-stat-value" style={{ color: 'var(--landing-champagne-gold)' }}>2 toques</span>
            </div>
            <div className="landing-showcase-stat-pill landing-showcase-stat-pill--dark">
              <span className="landing-stat-label" style={{ color: 'var(--landing-champagne-gold)' }}>Abrir la app</span>
              <span className="landing-stat-value" style={{ color: 'var(--positive)' }}>No hace falta</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Conciliación por extracto ─────────────────────────────────────── */}
      <div id="features-vision" className="landing-showcase-feature-row">
        <div className="landing-tier-info">
          <h3 className="landing-tier-title landing-tier-title--dark">
            ¿Efectivo, transferencias, QR?<br />
            <span className="landing-gold-gradient-text">El extracto los recupera.</span>
          </h3>
          <p className="landing-tier-desc landing-tier-desc--dark">
            Lo que no pasa por tarjeta se te escaparía. A fin de mes subes el PDF o la captura de
            tu extracto: el sistema lee cada línea, la cruza con lo que ya tienes y te deja el mes
            conciliado. La ingesta automática es «best-effort»; el extracto es la red de seguridad.
          </p>
          <div className="landing-showcase-stats">
            <div className="landing-showcase-stat-pill landing-showcase-stat-pill--dark">
              <span className="landing-stat-label" style={{ color: 'var(--landing-champagne-gold)' }}>Cobertura</span>
              <span className="landing-stat-value" style={{ color: 'var(--positive)' }}>Todo el mes</span>
            </div>
            <div className="landing-showcase-stat-pill landing-showcase-stat-pill--dark">
              <span className="landing-stat-label" style={{ color: 'var(--landing-champagne-gold)' }}>Lectura del extracto</span>
              <span className="landing-stat-value">En segundos</span>
            </div>
          </div>
        </div>

        <div className="landing-feature-media-frame landing-feature-media-frame--dark">
          <div className="landing-statement-terminal">
            <div className="landing-statement-terminal-header">
              <div className="landing-statement-title-wrap">
                <span className="landing-terminal-dot" aria-hidden="true" />
                <span className="landing-statement-terminal-title">Extracto · conciliación (ejemplo)</span>
              </div>
              <span className="landing-statement-terminal-badge">14 / 14 ✓</span>
            </div>

            <div className="landing-statement-table">
              {[
                ['14 FEB', 'Café', '-$14.200', 'Conciliado ✓'],
                ['16 FEB', 'Supermercado', '-$185.000', 'Conciliado ✓'],
                ['21 FEB', 'Transferencia · arriendo', '-$1.200.000', 'Conciliado ✓'],
                ['28 FEB', 'Retiro en cajero', '-$100.000', 'Conciliado ✓'],
              ].map(([date, desc, val, status]) => (
                <div key={date} className="landing-statement-row">
                  <span className="landing-stmt-date">{date}</span>
                  <span className="landing-stmt-desc">{desc}</span>
                  <span className="landing-stmt-val">{val}</span>
                  <span className="landing-stmt-status">{status}</span>
                </div>
              ))}
            </div>

            <div className="landing-statement-footer-bar">
              <span>Lectura del extracto y cruce con lo ya registrado</span>
              <span className="landing-statement-success-tag">Mes cuadrado</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Ejemplos de insights (ilustrativo) ────────────────────────────── */}
      <div className="landing-truth-section landing-truth-section--dark">
        <div className="landing-truth-header">
          <h2 className="landing-thesis-headline landing-thesis-headline--dark">
            El tipo de cosas que <span className="landing-thesis-gold-highlight">Reasonny detecta.</span>
          </h2>
          <p className="landing-thesis-subhead landing-thesis-subhead--dark">
            Ejemplos del tipo de observación que el sistema puede generar a partir de tus datos —
            no cifras reales, solo la forma que tendrían.
          </p>
        </div>

        <div className="landing-truth-grid">
          <div className="landing-truth-card landing-truth-card--dark">
            <span className="landing-truth-number landing-truth-number--dark">01</span>
            <p className="landing-truth-quote landing-truth-quote--dark">
              «Tus compras nocturnas de comida a domicilio vienen subiendo estas últimas semanas.»
            </p>
            <p className="landing-truth-desc landing-truth-desc--dark">
              Detecta cuándo un hábito se acelera, antes de que impacte la liquidez del mes siguiente.
            </p>
          </div>

          <div className="landing-truth-card landing-truth-card--dark">
            <span className="landing-truth-number landing-truth-number--dark">02</span>
            <p className="landing-truth-quote landing-truth-quote--dark">
              «Hay suscripciones que se cobran solas cada mes y quizá ya no usas.»
            </p>
            <p className="landing-truth-desc landing-truth-desc--dark">
              Identifica cargos recurrentes que se camuflan bajo nombres poco claros en el extracto.
            </p>
          </div>

          <div className="landing-truth-card landing-truth-card--dark">
            <span className="landing-truth-number landing-truth-number--dark">03</span>
            <p className="landing-truth-quote landing-truth-quote--dark">
              «A este ritmo, terminas el mes por encima de lo que gastaste el anterior.»
            </p>
            <p className="landing-truth-desc landing-truth-desc--dark">
              Proyecta hacia dónde va tu comportamiento y te lo dice mientras aún puedes ajustarlo.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
