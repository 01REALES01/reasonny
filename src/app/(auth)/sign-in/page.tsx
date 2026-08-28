import type { Metadata } from 'next';

import { SignInForm } from './sign-in-form';

// P8: Nothing behind or adjacent to authentication belongs in an index.
export const metadata: Metadata = {
  title: 'Iniciar Sesión — RealMoney',
  robots: { index: false, follow: false },
};

export default function SignInPage(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient background glow */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '380px',
          height: '380px',
          background: 'radial-gradient(circle, rgba(129, 114, 242, 0.15) 0%, rgba(200, 80, 20, 0.08) 50%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-6)',
        }}
      >
        {/* Brand Logo & Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, var(--brand-500) 0%, #6366F1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              color: '#FFFFFF',
              boxShadow: '0 8px 24px rgba(129, 114, 242, 0.35)',
            }}
          >
            ◈
          </div>
          <h1 style={{ fontSize: 'var(--text-title)', fontWeight: 600, color: 'var(--ink-primary)', marginTop: 'var(--space-2)' }}>
            RealMoney
          </h1>
          <p style={{ fontSize: 'var(--text-body)', color: 'var(--ink-secondary)', maxWidth: '300px' }}>
            Finanzas personales con ingesta asistida por IA
          </p>
        </div>

        {/* Interactive Sign-In Card */}
        <div
          style={{
            width: '100%',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border-hairline)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-overlay)',
          }}
        >
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
