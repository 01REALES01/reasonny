/**
 * The data-processing policy published at /privacidad (Ley 1581 de 2012,
 * Decreto 1377 de 2013).
 *
 * Text, not code, and kept out of the JSX for the same reason the i18n catalog
 * exists: the page renders whatever locale is active, and both languages must
 * say the same thing. The test next to this file checks the two halves have
 * the same sections.
 *
 * A change to WHAT is collected, WHY, or WHO processes it needs a new
 * POLICY_VERSION in core/privacy.ts, so every user is asked again. Wording
 * fixes do not.
 */
import { POLICY_VERSION } from '@/core/privacy';
import type { Locale } from '@/lib/i18n';

export interface PolicySection {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
}

export interface PolicyDocument {
  readonly title: string;
  readonly description: string;
  readonly effective: string;
  readonly intro: string;
  readonly sections: readonly PolicySection[];
}

const CONTROLLER = 'Jean Paul Reales';
const CONTACT_EMAIL = 'realesjean12@gmail.com';

export const PRIVACY_CONTACT_EMAIL = CONTACT_EMAIL;

export const PRIVACY_POLICY: Readonly<Record<Locale, PolicyDocument>> = {
  es: {
    title: 'Política de tratamiento de datos personales',
    description:
      'Qué datos recoge Reasonny, para qué, quién los procesa y cómo ejercer tus derechos de habeas data.',
    effective: `Versión ${POLICY_VERSION}. Vigente desde el 6 de octubre de 2026.`,
    intro:
      'Reasonny es una app para llevar tus finanzas personales. Esta política explica qué datos tuyos guarda, para qué los usa, quién los procesa y cómo puedes consultarlos, corregirlos o borrarlos, conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.',
    sections: [
      {
        id: 'responsable',
        heading: '1. Responsable del tratamiento',
        paragraphs: [
          `${CONTROLLER}, persona natural, con domicilio en Colombia, es el responsable del tratamiento de tus datos.`,
          `Para cualquier consulta, corrección, queja o solicitud de borrado: ${CONTACT_EMAIL}.`,
        ],
      },
      {
        id: 'datos',
        heading: '2. Qué datos recogemos',
        paragraphs: ['Solo los que la app necesita para funcionar:'],
        items: [
          'Tu correo electrónico, para que puedas entrar. Si entras con Google, también el nombre y la foto de perfil que Google comparte, que guarda el sistema de inicio de sesión.',
          'El nombre con el que quieres que la app te salude, si lo escribes.',
          'Tus movimientos: monto, fecha, comercio o concepto, categoría, nota y la cuenta o banco, con los últimos dígitos de la tarjeta o cuenta cuando el mensaje del banco los trae.',
          'El texto de los mensajes de tu banco que envías con el Atajo de iPhone. Se lee para crear el movimiento; si no se puede leer, se guarda para corregir el lector.',
          'Tu ubicación al registrar un gasto, solo si activas esa opción (viene apagada), y el punto que marques como "casa".',
          'El identificador de tu chat de Telegram, si vinculas el bot.',
          'Mediciones de rendimiento de la app (por ejemplo, cuánto tarda en cargar), asociadas a tu cuenta.',
        ],
      },
      {
        id: 'finalidades',
        heading: '3. Para qué los usamos',
        paragraphs: [
          'Para registrar y categorizar tus gastos e ingresos, mostrarte tus saldos y resúmenes, avisarte por Telegram cuando un gasto necesita categoría, mejorar el lector de mensajes bancarios y medir y mejorar el rendimiento de la app.',
          'No vendemos ni cedemos tus datos, no los usamos para publicidad y no construimos perfiles comerciales con ellos.',
        ],
      },
      {
        id: 'sensibles',
        heading: '4. Datos sensibles y menores de edad',
        paragraphs: [
          'Reasonny no te pide datos sensibles. Algunas categorías de gasto (por ejemplo, "Salud") podrían revelar algo sobre ti; usarlas es opcional.',
          'La app es solo para mayores de 18 años. Si sabemos que una cuenta pertenece a un menor, la borramos.',
        ],
      },
      {
        id: 'encargados',
        heading: '5. Quién procesa tus datos por nosotros',
        paragraphs: [
          'Para funcionar, Reasonny usa estos proveedores, que tratan los datos por cuenta nuestra y solo para prestar su servicio:',
        ],
        items: [
          'Neon (Estados Unidos): la base de datos y el inicio de sesión.',
          'Vercel (Estados Unidos): el alojamiento de la app.',
          'Google (Estados Unidos): el inicio de sesión con Google, si lo usas, y Gemini, el modelo de inteligencia artificial que interpreta mensajes y extractos cuando la app lo necesita. Se usa en plan de pago, en el que Google no usa tus datos para entrenar sus modelos.',
          'Telegram: los mensajes del bot, si lo vinculas.',
          'Cloudflare (Estados Unidos): el almacenamiento de extractos bancarios, cuando esa función esté disponible.',
          'Meta (WhatsApp): los mensajes por WhatsApp, cuando esa función esté disponible.',
        ],
      },
      {
        id: 'transferencia',
        heading: '6. Transferencia internacional',
        paragraphs: [
          'Los servidores de estos proveedores están fuera de Colombia, principalmente en Estados Unidos. Al aceptar esta política autorizas que tus datos se transfieran y se traten allí, con las mismas finalidades y protecciones descritas aquí.',
        ],
      },
      {
        id: 'derechos',
        heading: '7. Tus derechos',
        paragraphs: ['Como titular de tus datos puedes, en cualquier momento y sin costo:'],
        items: [
          'Conocer, actualizar y corregir tus datos.',
          'Pedir prueba de la autorización que nos diste.',
          'Saber qué uso le hemos dado a tus datos.',
          'Revocar la autorización y pedir que borremos tus datos.',
          'Presentar quejas ante la Superintendencia de Industria y Comercio (SIC), después de haber hecho tu solicitud ante nosotros.',
        ],
      },
      {
        id: 'como',
        heading: '8. Cómo ejercerlos',
        paragraphs: [
          'Desde la app: en Perfil puedes corregir tu nombre y tus preferencias, descargar todos tus movimientos en CSV y borrar tu cuenta.',
          `Por correo a ${CONTACT_EMAIL}. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles, como indica la ley.`,
        ],
      },
      {
        id: 'conservacion',
        heading: '9. Cuánto tiempo los guardamos',
        paragraphs: [
          'Mientras tengas tu cuenta. Al borrarla eliminamos de inmediato todos tus datos de la base, incluida la constancia de tu autorización. Las copias de respaldo del proveedor de la base pueden conservarlos hasta 7 días más antes de desaparecer.',
        ],
      },
      {
        id: 'seguridad',
        heading: '10. Seguridad',
        paragraphs: [
          'Tus datos viajan cifrados y se guardan cifrados. Cada consulta a la base está limitada a tu propia cuenta, y solo el responsable tiene acceso administrativo.',
        ],
      },
      {
        id: 'cambios',
        heading: '11. Cambios a esta política',
        paragraphs: [
          'Si cambiamos qué datos recogemos, para qué o quién los procesa, te lo mostraremos al entrar y te pediremos una nueva autorización antes de seguir.',
        ],
      },
    ],
  },
  en: {
    title: 'Personal data processing policy',
    description:
      'What data Reasonny collects, why, who processes it, and how to exercise your data protection rights.',
    effective: `Version ${POLICY_VERSION}. In effect since October 6, 2026.`,
    intro:
      'Reasonny is an app for keeping track of your personal finances. This policy explains which of your data it keeps, what it uses it for, who processes it, and how you can view, correct or delete it, under Colombian Law 1581 of 2012 and Decree 1377 of 2013.',
    sections: [
      {
        id: 'responsable',
        heading: '1. Data controller',
        paragraphs: [
          `${CONTROLLER}, an individual domiciled in Colombia, is the controller of your data.`,
          `For any question, correction, complaint or deletion request: ${CONTACT_EMAIL}.`,
        ],
      },
      {
        id: 'datos',
        heading: '2. What we collect',
        paragraphs: ['Only what the app needs to work:'],
        items: [
          'Your email address, so you can sign in. If you sign in with Google, also the name and profile photo Google shares, which the sign-in system keeps.',
          'The name you want the app to greet you by, if you enter one.',
          'Your transactions: amount, date, merchant or description, category, note, and the account or bank, with the last digits of the card or account when the bank message includes them.',
          'The text of your bank messages that you send with the iPhone Shortcut. It is read to create the transaction; if it cannot be read, it is kept to fix the reader.',
          'Your location when you record a spend, only if you turn that option on (it is off by default), and the point you mark as "home".',
          'Your Telegram chat identifier, if you link the bot.',
          'Performance measurements of the app (for example, how long it takes to load), tied to your account.',
        ],
      },
      {
        id: 'finalidades',
        heading: '3. What we use it for',
        paragraphs: [
          'To record and categorise your spending and income, show you your balances and summaries, notify you on Telegram when a spend needs a category, improve the bank message reader, and measure and improve the app’s performance.',
          'We do not sell or share your data, we do not use it for advertising, and we do not build commercial profiles from it.',
        ],
      },
      {
        id: 'sensibles',
        heading: '4. Sensitive data and minors',
        paragraphs: [
          'Reasonny does not ask you for sensitive data. Some spending categories (for example, "Health") could reveal something about you; using them is optional.',
          'The app is for people aged 18 and over only. If we learn an account belongs to a minor, we delete it.',
        ],
      },
      {
        id: 'encargados',
        heading: '5. Who processes your data on our behalf',
        paragraphs: [
          'To work, Reasonny uses these providers, which process data on our behalf and only to provide their service:',
        ],
        items: [
          'Neon (United States): the database and sign-in.',
          'Vercel (United States): hosting for the app.',
          'Google (United States): Google sign-in, if you use it, and Gemini, the AI model that interprets messages and statements when the app needs it. It is used on a paid plan, under which Google does not use your data to train its models.',
          'Telegram: the bot’s messages, if you link it.',
          'Cloudflare (United States): storage for bank statements, once that feature is available.',
          'Meta (WhatsApp): WhatsApp messages, once that feature is available.',
        ],
      },
      {
        id: 'transferencia',
        heading: '6. International transfer',
        paragraphs: [
          'These providers’ servers are outside Colombia, mainly in the United States. By accepting this policy you authorise your data to be transferred and processed there, for the same purposes and with the same protections described here.',
        ],
      },
      {
        id: 'derechos',
        heading: '7. Your rights',
        paragraphs: ['As the owner of your data you can, at any time and free of charge:'],
        items: [
          'Know, update and correct your data.',
          'Ask for proof of the authorisation you gave us.',
          'Find out how your data has been used.',
          'Withdraw your authorisation and ask us to delete your data.',
          'File complaints with the Superintendence of Industry and Commerce (SIC), after making your request to us.',
        ],
      },
      {
        id: 'como',
        heading: '8. How to exercise them',
        paragraphs: [
          'In the app: under Profile you can correct your name and preferences, download all your transactions as CSV, and delete your account.',
          `By email to ${CONTACT_EMAIL}. We answer questions within 10 business days and complaints within 15 business days, as the law requires.`,
        ],
      },
      {
        id: 'conservacion',
        heading: '9. How long we keep it',
        paragraphs: [
          'For as long as you have an account. When you delete it, we immediately remove all your data from the database, including the record of your authorisation. The database provider’s backups may keep it for up to 7 more days before it disappears.',
        ],
      },
      {
        id: 'seguridad',
        heading: '10. Security',
        paragraphs: [
          'Your data is encrypted in transit and at rest. Every database query is limited to your own account, and only the controller has administrative access.',
        ],
      },
      {
        id: 'cambios',
        heading: '11. Changes to this policy',
        paragraphs: [
          'If we change what data we collect, why, or who processes it, we will show you when you sign in and ask for a new authorisation before you continue.',
        ],
      },
    ],
  },
};
