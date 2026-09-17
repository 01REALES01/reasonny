import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { CategoryIcon } from '@/components/ui/category-icon';
import { ensureProfile } from '@/core/repositories/profile.repository';
import { buildLinkInvite } from '@/core/services/telegram-link.service';
import { toUserId } from '@/core/types';
import { botUsername } from '@/infrastructure/messaging/telegram';
import { getCurrentUser } from '@/lib/session';

// P8: authenticated screens are strictly noindex.
export const metadata: Metadata = {
  title: 'Telegram — Reasonny',
  robots: { index: false, follow: false },
};

/**
 * Connecting the chat, on a screen of its own - like /captura.
 *
 * The whole screen is one button, because the deep link IS the flow: tapping
 * it opens Telegram, starts the chat and sends the token as the first message.
 * There is no code to copy, nothing to paste, and nothing the user can get
 * wrong by typing.
 *
 * WHY THE LINK IS MINTED ON EVERY RENDER
 * --------------------------------------
 * The token lasts fifteen minutes on purpose - whoever opens it starts writing
 * into this account - so a cached one would be dead before it was useful.
 * Rendering is dynamic anyway: the layout is force-dynamic because it reads
 * the session.
 */
export default async function TelegramPage(): Promise<React.ReactElement> {
  const session = await getCurrentUser();
  if (!session) {
    redirect('/sign-in');
  }

  const userId = toUserId(session.id);
  const profile = await ensureProfile(userId, session.email);
  const linked = profile.telegramChatId !== null;

  // A missing secret or an unnamed bot must not take the page down: the
  // explanation is still worth reading, and the button would only lead
  // somewhere broken.
  let invite: ReturnType<typeof buildLinkInvite> = null;
  try {
    invite = buildLinkInvite(userId, botUsername());
  } catch {
    invite = null;
  }

  return (
    <main className="ingest-fullscreen">
      <div className="ingest-aurora ingest-aurora--welcome" aria-hidden="true" />
      <div className="ingest-fullscreen-header">
        <Link href="/perfil" className="ingest-fullscreen-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>Perfil</span>
        </Link>
        <Link href="/dashboard" className="ingest-fullscreen-close" aria-label="Cerrar">
          <CategoryIcon name="X" size={17} />
        </Link>
      </div>

      <div className="ingest-fullscreen-body">
        <section className="ingest">
          {linked ? (
            <>
              <h2 className="ingest-hook">Conectado.</h2>
              <p className="ingest-lede">
                Tu chat de Telegram ya está enlazado con esta cuenta. Escríbele al bot
                lo que pagues en efectivo y queda registrado aquí.
              </p>
              {invite ? (
                <div className="ingest-lede">
                  <a href={invite.url} className="settings-link" target="_blank" rel="noreferrer">
                    <span className="settings-link-text">
                      <span className="settings-link-title">Abrir el chat</span>
                      <span className="settings-link-sub">
                        Vuelve a enlazar si cambiaste de cuenta de Telegram
                      </span>
                    </span>
                    <CategoryIcon name="ChevronRight" size={18} />
                  </a>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <h2 className="ingest-hook">El efectivo también.</h2>
              <p className="ingest-lede">
                Las tarjetas entran solas por SMS, pero el efectivo, Nequi y los QR no
                los ve nadie. Conecta Telegram y anótalos donde ya estás escribiendo:
                mandas <strong>12000 juan valdez</strong> y listo.
              </p>

              {invite ? (
                <>
                  <div className="ingest-lede">
                    <a href={invite.url} className="settings-link">
                      <span className="settings-link-text">
                        <span className="settings-link-title">Conectar Telegram</span>
                        <span className="settings-link-sub">
                          Se abre el chat y queda enlazado · caduca en 15 minutos
                        </span>
                      </span>
                      <CategoryIcon name="ChevronRight" size={18} />
                    </a>
                  </div>
                  {/* The dead end this removes: the deep link does not always
                      carry its token - Telegram Web shows an interstitial when
                      the browser is not signed in - and the user then lands in
                      the right chat, presses START, and is told the chat is not
                      connected with nothing on screen to do about it. */}
                  <p className="ingest-lede">
                    ¿Se abrió el chat pero no pasó nada? Pega esto en el chat con{' '}
                    <strong>@{invite.botUsername}</strong>:
                  </p>
                  <pre className="ingest-copy-block">{invite.command}</pre>
                </>
              ) : (
                <p className="ingest-lede">
                  Falta configurar el bot en el servidor. Vuelve a intentarlo en un rato.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
