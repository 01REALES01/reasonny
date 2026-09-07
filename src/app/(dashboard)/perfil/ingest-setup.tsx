'use client';

import React, { useState } from 'react';

import { CategoryIcon } from '@/components/ui/category-icon';

interface IngestSetupProps {
  readonly token: string;
  readonly endpoint: string;
}

/**
 * The credentials and steps for the SMS automation.
 *
 * The token is hidden until asked for. It writes transactions to this account,
 * so it is a password, and a password rendered by default is one that ends up
 * in a screen recording or over somebody's shoulder.
 */
export function IngestSetup({ token, endpoint }: IngestSetupProps): React.ReactElement {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard is blocked outside a secure context and in some in-app
      // browsers. The value is on screen, so this is not worth an error state.
    }
  }

  return (
    <section className="ingest">
      <h2 className="ingest-title">Guardado automático por SMS</h2>
      <p className="ingest-lede">
        Cuando te llegue un SMS del banco, el iPhone lo manda aquí y la
        transacción se guarda sola, sin categoría, para que la clasifiques en
        «Por revisar».
      </p>

      <div className="ingest-field">
        <span className="ingest-label">URL</span>
        <code className="ingest-value">{endpoint}</code>
        <button type="button" onClick={() => copy('url', endpoint)} className="ingest-copy">
          {copied === 'url' ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <div className="ingest-field">
        <span className="ingest-label">Token</span>
        <code className="ingest-value">
          {revealed ? token : '••••••••••••••••••••••••••••'}
        </code>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="ingest-copy"
          aria-label={revealed ? 'Ocultar token' : 'Mostrar token'}
        >
          <CategoryIcon name={revealed ? 'EyeOff' : 'Eye'} size={14} />
        </button>
        <button type="button" onClick={() => copy('token', token)} className="ingest-copy">
          {copied === 'token' ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      <p className="ingest-warning">
        Este token escribe transacciones en tu cuenta. Trátalo como una
        contraseña: no lo pegues en un chat ni lo muestres en una captura.
      </p>

      <ol className="ingest-steps">
        <li>
          Abre la app <strong>Atajos</strong> (viene instalada; si no la ves,
          búscala deslizando hacia abajo en la pantalla de inicio).
        </li>
        <li>
          Pestaña <strong>Automatización</strong>, abajo. Toca <strong>+</strong> arriba
          a la derecha.
        </li>
        <li>
          Busca y elige <strong>Mensaje</strong>.
        </li>
        <li>
          En <em>Mensaje contiene</em>, escribe <strong>Bancolombia</strong>. Deja
          «Remitente» vacío.
        </li>
        <li>
          Marca <strong>Ejecutar inmediatamente</strong> y desactiva{' '}
          <strong>Notificar al ejecutar</strong> si te deja. Toca Siguiente.
        </li>
        <li>
          Añade la acción <strong>Obtener contenido de la URL</strong> y pega la URL
          de arriba.
        </li>
        <li>
          Despliega <strong>Mostrar más</strong> y pon:
          <br />
          Método <strong>POST</strong>
          <br />
          Encabezados: <code>Authorization</code> con valor{' '}
          <code>Bearer TU_TOKEN</code>
          <br />
          Cuerpo de la petición: <strong>JSON</strong>, un campo de texto llamado{' '}
          <code>text</code>, y como valor la variable <strong>Contenido del mensaje</strong>.
        </li>
        <li>Guarda, y repite todo con la palabra <strong>Bogota</strong> para el otro banco.</li>
      </ol>
    </section>
  );
}
