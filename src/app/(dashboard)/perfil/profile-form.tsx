'use client';

import Link from 'next/link';
import React, { useEffect, useState, useTransition } from 'react';

import {
  clearLocationsAction,
  setHomeLocationAction,
  setLocationEnabledAction,
} from '@/app/actions/location';
import { updateDisplayNameAction } from '@/app/actions/profile';
import { AnimatedCheck } from '@/components/ui/animated-check';
import { CategoryIcon } from '@/components/ui/category-icon';
import { t } from '@/lib/i18n';
import {
  getNotificationPermission,
  type PermissionStatus,
  requestNotificationPermission,
  sendAppNotification,
} from '@/lib/notifications';

interface ProfileFormProps {
  readonly email: string;
  readonly initialName: string;
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly locationEnabled: boolean;
  readonly home: { readonly latitude: number; readonly longitude: number } | null;
}

export function ProfileForm({
  email,
  initialName,
  baseCurrency,
  timezone,
  locationEnabled,
  home,
}: ProfileFormProps): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [locationOn, setLocationOn] = useState(locationEnabled);
  const [homePoint, setHomePoint] = useState(home);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const [notifPermission, setNotifPermission] = useState<PermissionStatus>('default');
  const [notifNote, setNotifNote] = useState<string | null>(null);

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
  }, []);

  async function handleRequestNotif(): Promise<void> {
    setNotifNote(null);
    const status = await requestNotificationPermission();
    setNotifPermission(status);
    if (status === 'granted') {
      await sendAppNotification({
        title: 'Reasonny',
        body: '🔔 ¡Notificaciones activadas con éxito!',
      });
      setNotifNote('¡Notificaciones activadas con éxito!');
    } else if (status === 'denied') {
      setNotifNote('Permiso denegado en tu navegador. Puedes activarlo en los ajustes del navegador.');
    }
  }

  async function handleTestNotification(): Promise<void> {
    setNotifNote(null);
    const ok = await sendAppNotification({
      title: 'Gasto de $50.000 guardado',
      body: '¡Categorízalo para mantener tus finanzas al día!',
      url: '/revisar',
    });
    if (!ok) {
      if (notifPermission !== 'granted') {
        const status = await requestNotificationPermission();
        setNotifPermission(status);
        if (status === 'granted') {
          await sendAppNotification({
            title: 'Gasto de $50.000 guardado',
            body: '¡Categorízalo para mantener tus finanzas al día!',
            url: '/revisar',
          });
          setNotifNote('Notificación de prueba enviada a tu dispositivo.');
        } else {
          setNotifNote('Activa los permisos de notificación para recibir avisos.');
        }
      } else {
        setNotifNote('No se pudo enviar la notificación. Verifica los permisos del navegador.');
      }
    } else {
      setNotifNote('Notificación de prueba enviada a tu dispositivo.');
    }
  }

  function handleToggleLocation(next: boolean): void {
    setLocationNote(null);
    // Optimistic, and reverted if the server disagrees: the switch has to feel
    // instant, but it must never show "on" over a profile that says off - that
    // is a promise about data collection the database is not keeping.
    setLocationOn(next);
    startTransition(async () => {
      const result = await setLocationEnabledAction(next);
      if (!result.success) {
        setLocationOn(!next);
        setLocationNote(result.error ?? t('error_generic'));
      }
    });
  }

  /** The prompt belongs on this tap: the user asked for it, explicitly. */
  function handleSetHome(): void {
    setLocationNote(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationNote(t('location_unavailable'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        startTransition(async () => {
          const result = await setHomeLocationAction(point);
          if (result.success) {
            setHomePoint(point);
            setLocationNote(t('location_home_saved'));
          } else {
            setLocationNote(result.error ?? t('error_generic'));
          }
        });
      },
      (positionError) => {
        setLocationNote(
          positionError.code === positionError.PERMISSION_DENIED
            ? t('location_permission_denied')
            : t('location_unavailable'),
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleForgetHome(): void {
    setLocationNote(null);
    startTransition(async () => {
      const result = await setHomeLocationAction(null);
      if (result.success) {
        setHomePoint(null);
      } else {
        setLocationNote(result.error ?? t('error_generic'));
      }
    });
  }

  function handleClearLocations(): void {
    setLocationNote(null);
    startTransition(async () => {
      const result = await clearLocationsAction();
      setConfirmingClear(false);
      setLocationNote(
        result.success
          ? `${t('location_cleared')} ${result.clearedCount ?? 0}`
          : (result.error ?? t('error_generic')),
      );
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateDisplayNameAction(name);
      if (result.success) {
        setSaved(true);
      } else {
        setError(result.error ?? null);
      }
    });
  }

  return (
    <div className="entry">
      <div className="entry-bar">
        <Link href="/dashboard" className="entry-back">
          <CategoryIcon name="ArrowLeft" size={15} />
          <span>{t('back')}</span>
        </Link>
      </div>

      <div className="step-slide entry-card">
        <h1 className="profile-heading">{t('profile_title')}</h1>

        {saved && (
          <div role="status" className="entry-banner entry-banner--success">
            <span className="entry-banner-msg">
              <AnimatedCheck size={20} />
              <span>{t('profile_saved')}</span>
            </span>
          </div>
        )}

        {error && (
          <div role="alert" className="entry-banner entry-banner--error">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="entry-form">
          <div className="entry-field">
            <label htmlFor="display-name" className="entry-label">
              {t('profile_name_label')}
            </label>
            <input
              id="display-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              placeholder={t('profile_name_placeholder')}
              maxLength={60}
              autoComplete="name"
              className="entry-input"
            />
            <span className="entry-hint">{t('profile_name_hint')}</span>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`entry-submit${saved ? ' entry-submit--saved' : ''}`}
          >
            {isPending ? (
              t('profile_saving')
            ) : saved ? (
              <span className="entry-submit-success">
                <AnimatedCheck size={18} />
                <span>{t('profile_saved')}</span>
              </span>
            ) : (
              t('profile_save')
            )}
          </button>
        </form>
      </div>

      {/* Read-only for a reason. The email is issued by the identity provider,
          and currency and timezone are what every monetary aggregation groups
          by - changing either reinterprets history, so neither belongs behind a
          text field next to "what should we call you". */}
      <div className="profile-facts">
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_email')}</span>
          <span className="profile-fact-value">{email}</span>
        </div>
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_currency')}</span>
          <span className="profile-fact-value">{baseCurrency}</span>
        </div>
        <div className="profile-fact">
          <span className="profile-fact-label">{t('profile_timezone')}</span>
          <span className="profile-fact-value">{timezone}</span>
        </div>
      </div>

      {/* App notifications section */}
      <section className="location-settings" aria-labelledby="notif-settings-title">
        <h2 id="notif-settings-title" className="location-settings-title">
          Notificaciones de la app
        </h2>
        <div className="location-home">
          <span className="location-home-head">
            <span className="profile-fact-label">Estado</span>
            <span className="profile-fact-value">
              {notifPermission === 'granted'
                ? 'Activas'
                : notifPermission === 'denied'
                ? 'Bloqueadas en el navegador'
                : notifPermission === 'unsupported'
                ? 'No disponibles en este navegador'
                : 'Sin configurar'}
            </span>
          </span>
          <span className="entry-hint">
            Reasonny te avisa en tiempo real cada vez que se guarda un gasto o cuando una compra necesita ser categorizada.
          </span>
          <div className="location-home-actions">
            {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
              <button
                type="button"
                onClick={handleRequestNotif}
                className="location-btn"
              >
                <CategoryIcon name="Bell" size={14} />
                Activar notificaciones
              </button>
            )}
            <button
              type="button"
              onClick={handleTestNotification}
              className="location-btn location-btn--quiet"
            >
              <CategoryIcon name="Bell" size={14} />
              Probar notificación
            </button>
          </div>
          {notifNote && (
            <p role="status" className="location-note">
              {notifNote}
            </p>
          )}
        </div>
      </section>

      {/* Location lives at the bottom, off by default, with its own delete.
          Everything above is about how the app addresses you; this is the only
          block that decides whether the app records where you were. */}
      <section className="location-settings" aria-labelledby="location-settings-title">
        <h2 id="location-settings-title" className="location-settings-title">
          {t('location_settings_title')}
        </h2>

        <label className="location-toggle">
          <input
            type="checkbox"
            checked={locationOn}
            onChange={(e) => handleToggleLocation(e.target.checked)}
            disabled={isPending}
          />
          <span className="location-toggle-text">
            <span className="location-toggle-label">{t('location_enable')}</span>
            <span className="entry-hint">{t('location_enable_hint')}</span>
          </span>
        </label>

        {locationOn && (
          <div className="location-home">
            <span className="location-home-head">
              <span className="profile-fact-label">{t('location_home_title')}</span>
              <span className="profile-fact-value">
                {homePoint
                  ? `${homePoint.latitude.toFixed(4)}, ${homePoint.longitude.toFixed(4)}`
                  : t('location_home_none')}
              </span>
            </span>
            <span className="entry-hint">{t('location_home_hint')}</span>

            <div className="location-home-actions">
              <button
                type="button"
                onClick={handleSetHome}
                disabled={isPending}
                className="location-btn"
              >
                <CategoryIcon name="Home" size={14} />
                {t('location_home_set')}
              </button>
              {homePoint && (
                <button
                  type="button"
                  onClick={handleForgetHome}
                  disabled={isPending}
                  className="location-btn location-btn--quiet"
                >
                  {t('location_home_clear')}
                </button>
              )}
            </div>
          </div>
        )}

        {locationNote && (
          <p role="status" className="location-note">
            {locationNote}
          </p>
        )}
      </section>

      {/* Two steps, like deleting a transaction: this one cannot be undone
          either, and it is deliberately reachable whether the switch is on or
          off - turning capture off must never be the only way to ask for what
          is already stored to be erased. */}
      <div className="danger-zone">
        {confirmingClear ? (
          <>
            <p className="danger-zone-question">{t('location_clear_confirm')}</p>
            <div className="danger-zone-actions">
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="danger-cancel"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleClearLocations}
                disabled={isPending}
                className="danger-confirm"
              >
                {t('delete_confirm_yes')}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingClear(true)}
            className="danger-trigger"
          >
            {t('location_clear')}
          </button>
        )}
      </div>
    </div>
  );
}
