import Link from 'next/link';
import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';
import { Money } from '@/components/ui/money';

/**
 * Los bancos: tres tarjetas y un titular centrado.
 *
 * Cada tarjeta enseña el recorrido real en vez de un logo: arriba lo que te
 * llega (el SMS de tu banco, o tu propio mensaje en Telegram) y abajo lo que
 * queda en Reasonny. Las tres respuestas a «¿funciona con mi banco?» pesan lo
 * mismo, incluida la que dice que no entra sola: es la pregunta que más se
 * hace y no puede leerse como letra pequeña.
 *
 * Los bancos listados son los que tienen parser en
 * infrastructure/sms-parsers (bancolombia.ts, banco-bogota.ts). Los SMS
 * siguen la ESTRUCTURA de cada banco con datos genéricos: comercio
 * inventado, tarjeta *0000 — nunca un mensaje real.
 */

interface Flow {
  readonly key: string;
  readonly title: string;
  readonly text: string;
  readonly chip: string;
  readonly sender: string;
  readonly avatar: React.ReactNode;
  /** Lo que llega: el cuerpo del SMS o del mensaje. */
  readonly incoming: React.ReactNode;
  /** Lo que queda registrado. */
  readonly merchant: string;
  readonly category: string;
  readonly icon: string;
  readonly amountMinor: bigint;
  readonly manual?: boolean;
}

/* El avión de papel de Telegram, de línea, al trazo de los iconos Lucide. */
function PaperPlane(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21.5 3.5 2.8 10.7c-.6.2-.6 1.1 0 1.3l4.6 1.6 1.7 5.4c.2.6 1 .8 1.4.3l2.6-2.8 4.6 3.4c.5.4 1.2.1 1.3-.5L22.5 4.6c.2-.7-.4-1.3-1-1.1Z" />
      <path d="m7.4 13.6 10.4-6.9" />
    </svg>
  );
}

const FLOWS: readonly Flow[] = [
  {
    key: 'bancolombia',
    title: 'Bancolombia',
    text: 'Los SMS de compras y de pagos con Apple Pay. Entran solos, clasificados, sin que abras nada.',
    chip: '0 toques',
    sender: 'Bancolombia',
    avatar: 'BC',
    incoming: (
      <>
        Compraste <Money amountMinor={1850000n} currency="COP" /> en CAFE GENERICO con tu T.Deb *0000, a las
        9:41.
      </>
    ),
    merchant: 'Cafe Generico',
    category: 'Cafetería',
    icon: 'Coffee',
    amountMinor: 1850000n,
  },
  {
    key: 'bogota',
    title: 'Banco de Bogotá',
    text: 'Las alertas SMS de débito y de crédito. Mismo Atajo, mismo resultado: el gasto aparece registrado.',
    chip: '0 toques',
    sender: 'Banco de Bogotá',
    avatar: 'BB',
    incoming: (
      <>
        Tu compra por <Money amountMinor={4250000n} currency="COP" /> fue aprobada con Tarjeta Débito 0000 en
        RESTAURANTE GENERICO.
      </>
    ),
    merchant: 'Restaurante Generico',
    category: 'Restaurante',
    icon: 'Utensils',
    amountMinor: 4250000n,
  },
  {
    key: 'manual',
    title: '¿Nu o Nequi?',
    text: 'No mandan SMS por compras y iOS no deja leer sus notificaciones. Entran por Telegram, con una línea.',
    chip: '1 mensaje',
    sender: 'Tú, en Telegram',
    avatar: <PaperPlane />,
    incoming: '12000 almuerzo',
    merchant: 'Almuerzo',
    category: 'Restaurante',
    icon: 'Utensils',
    amountMinor: 1200000n,
    manual: true,
  },
];

function FlowArt({ flow }: { readonly flow: Flow }): React.ReactElement {
  return (
    <div className="landing-banks-flow" aria-hidden="true">
      <div className={`landing-banks-msg${flow.manual ? ' landing-banks-msg--you' : ''}`}>
        <div className="landing-banks-msg-head">
          <span className="landing-banks-avatar">{flow.avatar}</span>
          <span className="landing-banks-sender">{flow.sender}</span>
          <span className="landing-banks-kind">{flow.manual ? 'mensaje' : 'SMS'}</span>
        </div>
        <p className="landing-banks-msg-body">{flow.incoming}</p>
      </div>

      <span className="landing-banks-arrow">
        <CategoryIcon name="ChevronDown" size={14} />
      </span>

      <div className="landing-banks-saved">
        <span className="landing-banks-saved-icon">
          <CategoryIcon name={flow.icon} size={15} />
        </span>
        <span className="landing-banks-saved-main">
          <span className="landing-banks-saved-merchant">{flow.merchant}</span>
          <span className="landing-banks-saved-cat">
            <CategoryIcon name="Check" size={11} /> {flow.category}
          </span>
        </span>
        <span className="landing-banks-saved-amount">
          <Money amountMinor={-flow.amountMinor} currency="COP" />
        </span>
      </div>
    </div>
  );
}

export function LandingBanksSection(): React.ReactElement {
  return (
    <div id="features-card" className="landing-banks reveal-on-scroll">
      <div className="landing-banks-head">
        <h3 className="landing-banks-title">
          Captura automática con tus <span className="landing-headline-gold">bancos que envían SMS.</span>
        </h3>
        <p className="landing-banks-sub">
          Si tu banco te avisa por SMS cada compra, el Atajo de iOS lo procesa en segundo plano. Sin
          contraseñas bancarias ni intermediarios.
        </p>
      </div>

      <div className="landing-banks-grid">
        {FLOWS.map((flow) => (
          <div key={flow.key} className={`landing-banks-card${flow.manual ? ' landing-banks-card--manual' : ''}`}>
            <FlowArt flow={flow} />
            <h4 className="landing-banks-card-title">{flow.title}</h4>
            <p className="landing-banks-card-text">{flow.text}</p>
            <span className="landing-banks-chip">{flow.chip}</span>
          </div>
        ))}
      </div>

      <div className="landing-banks-foot">
        <p className="landing-banks-pending">
          <span className="landing-banks-pending-dot" aria-hidden="true" />
          Davivienda, Scotiabank Colpatria y Falabella: en camino.
        </p>
        <p className="landing-banks-note">
          Tus credenciales nunca salen de tu teléfono: el Atajo corre en tu iPhone y solo envía el monto y el
          comercio del SMS.
        </p>
        {/* El dorado del héroe: sobre fondo oscuro, el vino del botón editorial
            se perdía (estaba pensado para la banda clara que ya no existe). */}
        <Link href="/sign-in" className="landing-gold-cta-btn">
          <span>Crear cuenta con tu correo</span>
          <span aria-hidden="true"> →</span>
        </Link>
      </div>
    </div>
  );
}
