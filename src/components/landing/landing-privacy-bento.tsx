import React from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

/**
 * La privacidad, en bento.
 *
 * Antes eran cuatro píldoras de «etiqueta: valor» que se leían como una
 * ficha técnica. Aquí cada garantía tiene su tarjeta y una gráfica de línea
 * fina que la dibuja: el cero rodeado, la lectura que corta el SMS, la
 * descarga del CSV, la fila que solo es tuya, quién no ve nada.
 *
 * Solo se afirma lo que el código sostiene:
 *  - sin clave del banco: no existe ese campo; el Atajo manda monto y
 *    comercio (quick-add);
 *  - export: /api/v1/export con las once columnas de csv-export.service.ts;
 *  - aislamiento: todo repositorio recibe `userId` primero y
 *    tests/architecture.test.ts rompe el build si aparece `db.` fuera de
 *    ellos; RLS encima como defensa en profundidad;
 *  - sin publicidad ni venta: no hay SDK de anuncios ni pasarela en el repo.
 */

/* La onda de la descarga: decorativa, dibuja «datos que salen», no mide. */
const WAVE =
  'M0 58 C 18 40, 30 36, 48 38 S 70 30, 78 16 S 92 40, 104 34 S 128 30, 140 34 ' +
  'S 156 10, 166 12 S 180 38, 190 30 S 206 6, 216 8 S 232 32, 244 26 S 266 14, 278 20 S 292 34, 300 44';

const HIDDEN_FROM: ReadonlyArray<{ readonly who: string; readonly you?: boolean }> = [
  { who: 'Tú', you: true },
  { who: 'Anunciantes' },
  { who: 'Terceros' },
];

export function LandingPrivacyBento(): React.ReactElement {
  return (
    <div id="features-security" className="landing-vault reveal-on-scroll">
      <div className="landing-vault-head">
        <h3 className="landing-vault-title">
          Tu privacidad no es una opción <span className="landing-headline-gold">de configuración.</span>
        </h3>
        <p className="landing-vault-sub">Es la arquitectura del sistema. Esto es lo que eso significa, en concreto.</p>
      </div>

      <div className="landing-vault-grid">
        {/* El cero rodeado a mano: la única cifra que importa aquí. */}
        <div className="landing-vault-card landing-vault-card--zero">
          <div className="landing-vault-zero">
            <svg viewBox="0 0 260 120" className="landing-vault-svg landing-vault-zero-ring" aria-hidden="true">
              <path d="M 214 26 C 180 8, 60 10, 26 44 C 2 70, 40 108, 130 110 C 214 112, 250 84, 236 54 C 226 34, 190 22, 150 20" />
            </svg>
            <span className="landing-vault-zero-figure">0</span>
          </div>
          <p className="landing-vault-zero-label">datos vendidos</p>
          <p className="landing-vault-text landing-vault-text--center">Ni publicidad, ni perfiles, ni terceros.</p>
        </div>

        {/* La lectura corta el SMS, no tu banco. */}
        <div className="landing-vault-card landing-vault-card--center">
          <div className="landing-vault-art">
            <svg viewBox="0 0 200 200" className="landing-vault-svg landing-vault-scan" aria-hidden="true">
              <defs>
                <linearGradient id="vault-arc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="landing-vault-stop-cream" />
                  <stop offset="1" className="landing-vault-stop-fade" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="94" className="landing-vault-ring" />
              <circle cx="100" cy="100" r="78" className="landing-vault-ring landing-vault-ring--inner" />
              {[16, 28, 40, 52].map((r) => (
                <path key={r} d={`M ${100 - r} 118 A ${r} ${r} 0 0 1 ${100 + r} 118`} className="landing-vault-arc" stroke="url(#vault-arc)" />
              ))}
              <line x1="44" y1="100" x2="156" y2="100" className="landing-vault-scanline" />
            </svg>
          </div>
          <h4 className="landing-vault-card-title">Sin la clave de tu banco</h4>
          <p className="landing-vault-text landing-vault-text--center">
            No existe ese campo. El Atajo lee el SMS en tu iPhone y solo nos manda el monto y el comercio.
          </p>
        </div>

        {/* Lo que es tuyo se va contigo. */}
        <div className="landing-vault-card landing-vault-card--center">
          <div className="landing-vault-art landing-vault-art--wave">
            <div className="landing-vault-download">
              <span className="landing-vault-download-name">
                <span className="landing-vault-download-icon" aria-hidden="true">
                  <CategoryIcon name="Download" size={12} />
                </span>
                historial.csv
              </span>
              <span className="landing-vault-download-meta">11 columnas</span>
            </div>
            <svg viewBox="0 0 300 70" className="landing-vault-svg landing-vault-wave" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="vault-wave" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className="landing-vault-stop-rose" />
                  <stop offset="1" className="landing-vault-stop-clear" />
                </linearGradient>
              </defs>
              <path d={`${WAVE} V 70 H 0 Z`} fill="url(#vault-wave)" />
              <path d={WAVE} className="landing-vault-wave-line" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <h4 className="landing-vault-card-title">Tus datos se van contigo</h4>
          <p className="landing-vault-text landing-vault-text--center">
            Todo tu historial en CSV, cuando quieras y sin pedir permiso.
          </p>
        </div>

        {/* Aislamiento: tu fila, encendida; las de los demás, fuera de alcance. */}
        <div className="landing-vault-card landing-vault-card--wide">
          <div className="landing-vault-wide-copy">
            <span className="landing-vault-badge" aria-hidden="true">
              <CategoryIcon name="ShieldCheck" size={20} />
            </span>
            <div>
              <h4 className="landing-vault-card-title">Aislada por usuario</h4>
              <p className="landing-vault-text">
                Cada consulta a la base lleva tu usuario como primer dato, y un test rompe el build si alguien se lo salta.
                Encima, seguridad por fila en la propia base.
              </p>
            </div>
          </div>
          <div className="landing-vault-window" aria-hidden="true">
            <span className="landing-vault-window-dots">
              <span />
              <span />
              <span />
            </span>
            {['you', 'other', 'you', 'other', 'other', 'you'].map((row, i) => (
              <span key={i} className={`landing-vault-row landing-vault-row--${row}`}>
                <span className="landing-vault-row-key">{row === 'you' ? 'tú' : '•••'}</span>
                <span className="landing-vault-row-bar" style={{ width: `${38 + ((i * 23) % 40)}%` }} />
              </span>
            ))}
          </div>
        </div>

        {/* Quién ve tus movimientos. */}
        <div className="landing-vault-card landing-vault-card--wide">
          <div className="landing-vault-wide-copy">
            <span className="landing-vault-badge" aria-hidden="true">
              <CategoryIcon name="EyeOff" size={20} />
            </span>
            <div>
              <h4 className="landing-vault-card-title">Solo tú los ves</h4>
              <p className="landing-vault-text">
                Tus movimientos no se comparten ni se venden. Viajan cifrados y se guardan cifrados.
              </p>
            </div>
          </div>
          <ul className="landing-vault-who" aria-label="Quién ve tus movimientos">
            {HIDDEN_FROM.map((w) => (
              <li key={w.who} className={`landing-vault-who-row${w.you ? ' landing-vault-who-row--you' : ''}`}>
                <span className="landing-vault-who-tag">{w.who}</span>
                <span className="landing-vault-who-icon">
                  <CategoryIcon name={w.you ? 'Eye' : 'EyeOff'} size={15} />
                </span>
                <span className="sr-only">{w.you ? 'los ve' : 'no los ve'}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
