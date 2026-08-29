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
    <main className="auth-screen">
      {/* Subtle deep ambient glow behind the layout */}
      <div className="auth-glow" />

      <div className="auth-layout desktop-auth-container">
        {/* Left / Top Column: Kinetic Brutalist Sculpture Card */}
        <div className="animate-entrance-1 auth-column">
          <InteractiveArtworkCard />
        </div>

        {/* Right / Bottom Column: Editorial Typography & Fluid Interactive Auth */}
        <div className="animate-entrance-2 auth-column">
          <SignInForm />
        </div>
      </div>
    </main>
  );
}
