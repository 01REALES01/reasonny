'use client';

import React, { useEffect, useState, useTransition } from 'react';

import { setLocationEnabledAction } from '@/app/actions/location';
import { CategoryIcon } from '@/components/ui/category-icon';
import {
  requestNotificationPermission,
  sendWelcomeNotification,
} from '@/lib/notifications';

const PERMISSIONS_STORAGE_KEY = 'reasonny_permissions_prompted_v1';

export function AppPermissionsPrompt(): React.ReactElement | null {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const alreadyPrompted = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      if (!alreadyPrompted) {
        // Subtle micro-delay so the dashboard finishes rendering smoothly first
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage may fail in strict privacy modes; fail gracefully
    }
  }, []);

  function markDismissed(): void {
    try {
      localStorage.setItem(PERMISSIONS_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setIsOpen(false);
  }

  function handleEnableAll(): void {
    startTransition(async () => {
      // 1. Request notification permission
      const notifStatus = await requestNotificationPermission();
      if (notifStatus === 'granted') {
        void sendWelcomeNotification();
      }

      // 2. Request geolocation permission & sync with profile
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          () => {
            void setLocationEnabledAction(true);
          },
          () => {
            // Permission denied or timeout: do not block flow
          },
          { enableHighAccuracy: true, timeout: 8000 },
        );
      }

      markDismissed();
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="perm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-dialog-title"
    >
      <div className="perm-card">
        {/* Brand visual header */}
        <div className="perm-header">
          <div className="perm-brand-mark" aria-hidden="true">
            <svg
              className="perm-brand-svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M6 4C6 3.45 6.45 3 7 3H8.5C9.05 3 9.5 3.45 9.5 4V20C9.5 20.55 9.05 21 8.5 21H7C6.45 21 6 20.55 6 20V4Z" />
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.5 3H14.2C17.2 3 19.5 5.1 19.5 8C19.5 10.9 17.2 13 14.2 13H9.5V3ZM12 5.5H14C15.4 5.5 16.8 6.5 16.8 8C16.8 9.5 15.4 10.5 14 10.5H12V5.5Z"
              />
              <path d="M12.8 11.8L17.8 19.8C18.1 20.3 18.8 20.4 19.3 20.1C19.7 19.8 19.9 19.1 19.6 18.6L14.8 11.2C14.1 11.3 13.4 11.5 12.8 11.8Z" />
            </svg>
          </div>
          <h2 id="perm-dialog-title" className="perm-title">
            Activa tu experiencia Reasonny
          </h2>
          <p className="perm-subtitle">
            Notificaciones en tiempo real y ubicación inteligente para registrar tus
            finanzas sin esfuerzo.
          </p>
        </div>

        {/* Feature Highlights */}
        <div className="perm-features">
          <div className="perm-feature-row">
            <div className="perm-feature-icon" aria-hidden="true">
              <CategoryIcon name="Bell" size={18} />
            </div>
            <div className="perm-feature-content">
              <strong className="perm-feature-title">Notificaciones instantáneas</strong>
              <p className="perm-feature-desc">
                Avisos cada vez que registres un gasto, alertas para categorizar
                compras y recordatorios de presupuesto.
              </p>
            </div>
          </div>

          <div className="perm-feature-row">
            <div className="perm-feature-icon" aria-hidden="true">
              <CategoryIcon name="MapPin" size={18} />
            </div>
            <div className="perm-feature-content">
              <strong className="perm-feature-title">Ubicación inteligente</strong>
              <p className="perm-feature-desc">
                Asocia comercios cercanos a tus compras para autocompletar categorías y
                reconocer lugares automáticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="perm-actions">
          <button
            type="button"
            className="perm-btn-primary"
            onClick={handleEnableAll}
            disabled={isPending}
          >
            {isPending ? 'Activando...' : 'Activar Notificaciones y Ubicación'}
          </button>
          <button
            type="button"
            className="perm-btn-secondary"
            onClick={markDismissed}
            disabled={isPending}
          >
            Quizás más tarde
          </button>
        </div>
      </div>
    </div>
  );
}
