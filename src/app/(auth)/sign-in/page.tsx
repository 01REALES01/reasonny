import type { Metadata } from 'next';

import { InteractiveArtworkCard } from '@/components/ui/interactive-artwork-card';
import { SignInForm } from './sign-in-form';

// P8: Nothing behind or adjacent to authentication belongs in an index.
export const metadata: Metadata = {
  title: 'RealMoney — Control Financiero Inteligente',
  robots: { index: false, follow: false },
};

export default function SignInPage(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-4) var(--space-6)',
        color: '#FFFFFF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle deep ambient glow behind the layout */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="desktop-auth-container"
        style={{
          width: '100%',
          maxWidth: '440px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-6)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Left / Top Column: Kinetic Brutalist Sculpture Card */}
        <div className="animate-entrance-1" style={{ width: '100%' }}>
          <InteractiveArtworkCard />
        </div>

        {/* Right / Bottom Column: Editorial Typography & Fluid Interactive Auth */}
        <div
          className="animate-entrance-2"
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
