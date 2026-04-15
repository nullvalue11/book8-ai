/**
 * BOO-109A — multilingual welcome email (founder tone, transactional).
 * Locales: en, fr, es, ar (RTL).
 */

/** @param {{ dir: 'ltr' | 'rtl', lang: string, inner: string }} p */
export function baseHtml({ dir, lang, inner }) {
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Book8</title>
</head>
<body style="margin:0;padding:0;background:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.55;color:#e2e8f0;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#1e293b;border-radius:12px;padding:28px 24px;">
<tr><td>
${inner}
<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">${CASL_FOOTER}</p>
</td></tr></table>
</td></tr></table>
</body>
</html>`
}

const CASL_FOOTER =
  'Book8 is a trade name of 11111221 Canada INC., Ottawa, ON, Canada'

const DASHBOARD_PATH = '/dashboard'
const HELP_PATH = '/help/call-forwarding'

/**
 * @param {string} base - e.g. https://book8.io
 * @param {string | null | undefined} assigned - E.164 or null
 */
function helpLinkWithNumber(base, assigned) {
  const u = new URL(HELP_PATH, base)
  if (assigned?.trim()) u.searchParams.set('number', assigned.trim())
  return u.toString()
}

/**
 * @typedef {object} WelcomeBodyVars
 * @property {string} greeting
 * @property {string} opening
 * @property {string} setupHeader
 * @property {string} phoneBlockHtml
 * @property {string} languagesLine
 * @property {string} trialLine
 * @property {string} ctaTitle
 * @property {string} ctaBody
 * @property {string} nextHeader
 * @property {string} nextListHtml
 * @property {string} replyHint
 * @property {string} dashboardLabel
 * @property {string} dashboardUrl
 * @property {string} signature
 */

/** @param {WelcomeBodyVars} v */
function commonInner(v) {
  return `
<p style="margin:0 0 16px;font-size:16px;">${v.greeting}</p>
<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">${v.opening}</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#f8fafc;">${v.setupHeader}</p>
<div style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">${v.phoneBlockHtml}</div>
<p style="margin:0 0 8px;font-size:15px;color:#cbd5e1;">${v.languagesLine}</p>
<p style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">${v.trialLine}</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#f8fafc;">${v.ctaTitle}</p>
<p style="margin:0 0 16px;font-size:15px;color:#cbd5e1;">${v.ctaBody}</p>
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#f8fafc;">${v.nextHeader}</p>
<div style="margin:0 0 20px;font-size:15px;color:#cbd5e1;">${v.nextListHtml}</div>
<p style="margin:0 0 12px;font-size:15px;color:#cbd5e1;">${v.replyHint}</p>
<p style="margin:0 0 24px;font-size:15px;"><a href="${v.dashboardUrl}" style="color:#a78bfa;">${v.dashboardLabel}</a></p>
<p style="margin:0;font-size:15px;color:#cbd5e1;">${v.signature}</p>`
}

/** @param {{ book8Display: string, yourLine?: string|null, helpUrl: string }} p */
function phoneBlockNewEn(p) {
  return `
<p style="margin:0 0 8px;">📞 Your Book8 number: <strong style="color:#f8fafc;">${p.book8Display}</strong></p>
<p style="margin:0 0 12px;">This number is live right now. Call it to test — book a test appointment, try it in another language, see what it feels like.</p>
<p style="margin:0 0 8px;">Once you're ready, publish this number everywhere:</p>
<ul style="margin:0;padding-left:20px;">
<li>Update your Google Business Profile</li>
<li>Add it to your website and business cards</li>
<li>Set up call forwarding from your existing line (optional — <a href="${p.helpUrl}" style="color:#a78bfa;">see guide</a>)</li>
</ul>`
}

/** @param {{ yourLine: string, book8Display: string, helpUrl: string }} p */
function phoneBlockForwardFullEn(p) {
  return `
<p style="margin:0 0 8px;">📞 Your line: <strong style="color:#f8fafc;">${p.yourLine}</strong></p>
<p style="margin:0 0 8px;">📞 Forwards to Book8: <strong style="color:#f8fafc;">${p.book8Display}</strong></p>
<p style="margin:0 0 8px;">To activate call forwarding from your existing line, see:<br/><a href="${p.helpUrl}" style="color:#a78bfa;">${p.helpUrl}</a></p>
<p style="margin:0;">Once forwarding is set up, test by calling your own business line from another phone — Book8 will pick up.</p>`
}

function phoneBlockForwardPartialEn(p) {
  return `
<p style="margin:0 0 8px;">📞 Forwards to Book8: <strong style="color:#f8fafc;">${p.book8Display}</strong></p>
<p style="margin:0 0 8px;">To activate call forwarding from your existing line, see:<br/><a href="${p.helpUrl}" style="color:#a78bfa;">${p.helpUrl}</a></p>
<p style="margin:0;">Once forwarding is set up, test by calling your own business line from another phone — Book8 will pick up.</p>`
}

function phoneBlockPendingEn() {
  return `
<p style="margin:0 0 8px;">📞 Phone setup: in progress</p>
<p style="margin:0;">We're finalizing your number. You'll get a follow-up once it's active. If anything looks stuck, just reply to this email.</p>`
}

/** @param {import('../welcomeEmail.js').WelcomeTemplateInput} d */
export function buildWelcomeEmailEnglish(d) {
  const base = d.appOrigin
  const dash = new URL(DASHBOARD_PATH, base).toString()
  const helpUrl = helpLinkWithNumber(base, d.assignedRaw || null)

  let phoneBlockHtml
  if (!d.assignedDisplay) {
    phoneBlockHtml = phoneBlockPendingEn()
  } else if (d.forwardingEnabled) {
    const yourLine = d.forwardingFromDisplay || d.existingBusinessDisplay
    if (yourLine) {
      phoneBlockHtml = phoneBlockForwardFullEn({
        yourLine,
        book8Display: d.assignedDisplay,
        helpUrl
      })
    } else {
      phoneBlockHtml = phoneBlockForwardPartialEn({ book8Display: d.assignedDisplay, helpUrl })
    }
  } else {
    phoneBlockHtml = phoneBlockNewEn({ book8Display: d.assignedDisplay, helpUrl })
  }

  const trialLine = d.trialEndsFormatted
    ? `📅 Trial ends: <strong style="color:#f8fafc;">${d.trialEndsFormatted}</strong>`
    : `📅 Trial: <strong style="color:#f8fafc;">see your dashboard for dates</strong>`

  const nextListHtml = `<ul style="margin:0;padding-left:20px;">
<li>Add your services and pricing in the dashboard</li>
<li>Connect Google Calendar so bookings sync automatically</li>
<li>Invite your team or staff members to see the schedule</li>
</ul>`

  const inner = commonInner({
    greeting: `Hey ${d.firstName},`,
    opening: `I built Book8 because I was tired of watching great businesses lose customers to missed calls. Thanks for giving it a try.`,
    setupHeader: 'Your Book8 setup:',
    phoneBlockHtml,
    languagesLine: `🌍 Languages: ${d.languagesDisplay}`,
    trialLine,
    ctaTitle: `Here's the one thing I want you to do right now:`,
    ctaBody: `<strong>Call your Book8 number. Book a test appointment.</strong><br/><br/>
Call it in your language. See what your customers will experience when they call you late at night — that's when Book8 earns its keep while you're off the clock.`,
    nextHeader: 'Over the next two weeks, you can:',
    nextListHtml,
    replyHint: `If anything is confusing or broken, just reply to this email. I read every one.`,
    dashboardLabel: `${dash}`,
    dashboardUrl: dash,
    signature: `— Wais<br/>Founder, Book8<br/><a href="${base}" style="color:#a78bfa;">book8.io</a>`
  })

  return {
    subject: "Welcome to Book8 — here's your number",
    html: baseHtml({ dir: 'ltr', lang: 'en', inner })
  }
}

/** @param {import('../welcomeEmail.js').WelcomeTemplateInput} d */
export function buildWelcomeEmailFrench(d) {
  const base = d.appOrigin
  const dash = new URL(DASHBOARD_PATH, base).toString()
  const helpUrl = helpLinkWithNumber(base, d.assignedRaw || null)

  let phoneBlockHtml
  if (!d.assignedDisplay) {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Téléphone : en cours de configuration</p>
<p style="margin:0;">Nous finalisons votre numéro. Vous recevrez une suite à ce message une fois qu'il sera actif. Si quelque chose bloque, répondez simplement à cet e-mail.</p>`
  } else if (d.forwardingEnabled) {
    const yourLine = d.forwardingFromDisplay || d.existingBusinessDisplay
    if (yourLine) {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Votre ligne : <strong style="color:#f8fafc;">${yourLine}</strong></p>
<p style="margin:0 0 8px;">📞 Transfert vers Book8 : <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">Pour activer le renvoi d'appels depuis votre ligne existante :<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">Une fois le renvoi en place, testez en appelant votre ligne professionnelle depuis un autre téléphone — Book8 répondra.</p>`
    } else {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Transfert vers Book8 : <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">Pour activer le renvoi d'appels depuis votre ligne existante :<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">Une fois le renvoi en place, testez en appelant votre ligne professionnelle depuis un autre téléphone — Book8 répondra.</p>`
    }
  } else {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Votre numéro Book8 : <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 12px;">Ce numéro est actif maintenant. Appelez-le pour tester — prenez un rendez-vous test, essayez une autre langue, voyez ce que ça donne.</p>
<p style="margin:0 0 8px;">Quand vous êtes prêt, affichez ce numéro partout :</p>
<ul style="margin:0;padding-left:20px;">
<li>Mettez à jour votre fiche Google Business Profile</li>
<li>Ajoutez-le à votre site et vos cartes</li>
<li>Configurez le renvoi depuis votre ligne actuelle (facultatif — <a href="${helpUrl}" style="color:#a78bfa;">guide</a>)</li>
</ul>`
  }

  const trialLine = d.trialEndsFormatted
    ? `📅 Fin d'essai : <strong style="color:#f8fafc;">${d.trialEndsFormatted}</strong>`
    : `📅 Essai : <strong style="color:#f8fafc;">voir le tableau de bord pour les dates</strong>`

  const nextListHtml = `<ul style="margin:0;padding-left:20px;">
<li>Ajoutez vos services et tarifs dans le tableau de bord</li>
<li>Connectez Google Agenda pour synchroniser les réservations</li>
<li>Invitez votre équipe à voir le planning</li>
</ul>`

  const inner = commonInner({
    greeting: d.firstName === 'there' ? 'Bonjour,' : `Salut ${d.firstName},`,
    opening: `J'ai créé Book8 parce que j'en avais assez de voir de bonnes entreprises perdre des clients à cause d'appels manqués. Merci d'essayer.`,
    setupHeader: 'Votre configuration Book8 :',
    phoneBlockHtml,
    languagesLine: `🌍 Langues : ${d.languagesDisplay}`,
    trialLine,
    ctaTitle: `Une chose que j'aimerais que vous fassiez maintenant :`,
    ctaBody: `<strong>Appelez votre numéro Book8. Prenez un rendez-vous test.</strong><br/><br/>
Testez dans votre langue. Voyez ce que vivent vos clients quand ils appellent tard le soir — c'est là que Book8 fait la différence pendant que vous êtes déjà en dehors des heures.`,
    nextHeader: 'Dans les deux prochaines semaines, vous pouvez :',
    nextListHtml,
    replyHint: `Si quelque chose n'est pas clair ou ne fonctionne pas, répondez à cet e-mail. Je lis tout.`,
    dashboardLabel: dash,
    dashboardUrl: dash,
    signature: `— Wais<br/>Fondateur, Book8<br/><a href="${base}" style="color:#a78bfa;">book8.io</a>`
  })

  return {
    subject: 'Bienvenue chez Book8 — voici votre numéro',
    html: baseHtml({ dir: 'ltr', lang: 'fr', inner })
  }
}

/** @param {import('../welcomeEmail.js').WelcomeTemplateInput} d */
export function buildWelcomeEmailSpanish(d) {
  const base = d.appOrigin
  const dash = new URL(DASHBOARD_PATH, base).toString()
  const helpUrl = helpLinkWithNumber(base, d.assignedRaw || null)

  let phoneBlockHtml
  if (!d.assignedDisplay) {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Teléfono: en proceso</p>
<p style="margin:0;">Estamos finalizando tu número. Te avisaremos cuando esté activo. Si algo se atasca, responde a este correo.</p>`
  } else if (d.forwardingEnabled) {
    const yourLine = d.forwardingFromDisplay || d.existingBusinessDisplay
    if (yourLine) {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Tu línea: <strong style="color:#f8fafc;">${yourLine}</strong></p>
<p style="margin:0 0 8px;">📞 Desvía a Book8: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">Para activar el desvío desde tu línea actual:<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">Cuando esté listo, prueba llamando a tu línea de negocio desde otro teléfono — Book8 atenderá.</p>`
    } else {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Desvía a Book8: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">Para activar el desvío desde tu línea actual:<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">Cuando esté listo, prueba llamando a tu línea de negocio desde otro teléfono — Book8 atenderá.</p>`
    }
  } else {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 Tu número Book8: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 12px;">Este número ya está activo. Llámalo para probar — agenda una cita de prueba, prueba otro idioma, mira cómo se siente.</p>
<p style="margin:0 0 8px;">Cuando quieras, publica este número en todas partes:</p>
<ul style="margin:0;padding-left:20px;">
<li>Actualiza tu perfil de Google Business</li>
<li>Añádelo a tu web y tarjetas</li>
<li>Configura el desvío desde tu línea actual (opcional — <a href="${helpUrl}" style="color:#a78bfa;">guía</a>)</li>
</ul>`
  }

  const trialLine = d.trialEndsFormatted
    ? `📅 La prueba termina: <strong style="color:#f8fafc;">${d.trialEndsFormatted}</strong>`
    : `📅 Prueba: <strong style="color:#f8fafc;">mira el panel para las fechas</strong>`

  const nextListHtml = `<ul style="margin:0;padding-left:20px;">
<li>Añade servicios y precios en el panel</li>
<li>Conecta Google Calendar para sincronizar reservas</li>
<li>Invita a tu equipo a ver la agenda</li>
</ul>`

  const inner = commonInner({
    greeting: d.firstName === 'there' ? 'Hola,' : `Hola ${d.firstName},`,
    opening: `Creé Book8 porque me cansé de ver negocios excelentes perder clientes por llamadas perdidas. Gracias por probarlo.`,
    setupHeader: 'Tu configuración en Book8:',
    phoneBlockHtml,
    languagesLine: `🌍 Idiomas: ${d.languagesDisplay}`,
    trialLine,
    ctaTitle: `Lo único que quiero que hagas ahora:`,
    ctaBody: `<strong>Llama a tu número Book8. Agenda una cita de prueba.</strong><br/><br/>
Pruébalo en tu idioma. Mira lo que tus clientes viven cuando llaman tarde — ahí es donde Book8 se gana su lugar mientras tú descansas.`,
    nextHeader: 'En las próximas dos semanas puedes:',
    nextListHtml,
    replyHint: `Si algo no cuadra o falla, responde a este correo. Leo todos.`,
    dashboardLabel: dash,
    dashboardUrl: dash,
    signature: `— Wais<br/>Fundador, Book8<br/><a href="${base}" style="color:#a78bfa;">book8.io</a>`
  })

  return {
    subject: 'Bienvenido a Book8 — aquí está tu número',
    html: baseHtml({ dir: 'ltr', lang: 'es', inner })
  }
}

/** @param {import('../welcomeEmail.js').WelcomeTemplateInput} d */
export function buildWelcomeEmailArabic(d) {
  const base = d.appOrigin
  const dash = new URL(DASHBOARD_PATH, base).toString()
  const helpUrl = helpLinkWithNumber(base, d.assignedRaw || null)

  let phoneBlockHtml
  if (!d.assignedDisplay) {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 إعداد الهاتف: قيد الإنجاز</p>
<p style="margin:0;">نُنهي رقمك الآن. ستصلك رسالة متابعة عند تفعيله. إن توقف أي شيء، رد على هذا البريد.</p>`
  } else if (d.forwardingEnabled) {
    const yourLine = d.forwardingFromDisplay || d.existingBusinessDisplay
    if (yourLine) {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 خطك: <strong style="color:#f8fafc;">${yourLine}</strong></p>
<p style="margin:0 0 8px;">📞 يُحوَّل إلى Book8: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">لتفعيل تحويل المكالمات من خطك الحالي:<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">بعد الإعداد، جرّب الاتصال بخط عملك من هاتف آخر — سيرد Book8.</p>`
    } else {
      phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 يُحوَّل إلى Book8: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 8px;">لتفعيل تحويل المكالمات من خطك الحالي:<br/><a href="${helpUrl}" style="color:#a78bfa;">${helpUrl}</a></p>
<p style="margin:0;">بعد الإعداد، جرّب الاتصال بخط عملك من هاتف آخر — سيرد Book8.</p>`
    }
  } else {
    phoneBlockHtml = `
<p style="margin:0 0 8px;">📞 رقم Book8 الخاص بك: <strong style="color:#f8fafc;">${d.assignedDisplay}</strong></p>
<p style="margin:0 0 12px;">الرقم يعمل الآن. اتصل به للتجربة — احجز موعدًا تجريبيًا، جرّب لغة أخرى، وشاهد التجربة.</p>
<p style="margin:0 0 8px;">عندما تكون جاهزًا، انشر الرقم في كل مكان:</p>
<ul style="margin:0;padding-right:20px;">
<li>حدّث ملف Google Business</li>
<li>أضفه إلى موقعك وبطاقاتك</li>
<li>فعّل تحويل المكالمات من خطك الحالي (اختياري — <a href="${helpUrl}" style="color:#a78bfa;">دليل</a>)</li>
</ul>`
  }

  const trialLine = d.trialEndsFormatted
    ? `📅 نهاية الفترة التجريبية: <strong style="color:#f8fafc;">${d.trialEndsFormatted}</strong>`
    : `📅 الفترة التجريبية: <strong style="color:#f8fafc;">راجع لوحة التحكم للتواريخ</strong>`

  const nextListHtml = `<ul style="margin:0;padding-right:20px;">
<li>أضف خدماتك وأسعارك في لوحة التحكم</li>
<li>اربط Google Calendar لمزامنة الحجوزات</li>
<li>ادعُ فريقك لرؤية الجدول</li>
</ul>`

  const inner = commonInner({
    greeting: d.firstName === 'there' ? 'مرحبًا،' : `مرحبًا ${d.firstName}،`,
    opening: `بنيتُ Book8 لأنني تعبت من رؤية أعمال رائعة تفقد عملاء بسبب مكالمات فائتة. شكرًا لتجربتك.`,
    setupHeader: 'إعداد Book8 الخاص بك:',
    phoneBlockHtml,
    languagesLine: `🌍 اللغات: ${d.languagesDisplay}`,
    trialLine,
    ctaTitle: `الشيء الوحيد الذي أريدك أن تفعله الآن:`,
    ctaBody: `<strong>اتصل برقم Book8. احجز موعدًا تجريبيًا.</strong><br/><br/>
جرّب بلغتك. شاهد ما يعيشه عملاؤك عندما يتصلون متأخرًا — هناك يثبت Book8 قيمته بينما أنت خارج أوقات الدوام.`,
    nextHeader: 'خلال الأسبوعين القادمين يمكنك:',
    nextListHtml,
    replyHint: `إن كان أي شيء غير واضح أو معطّل، رد على هذا البريد. أقرأ كل الرسائل.`,
    dashboardLabel: dash,
    dashboardUrl: dash,
    signature: `— Wais<br/>المؤسس، Book8<br/><a href="${base}" style="color:#a78bfa;">book8.io</a>`
  })

  return {
    subject: 'مرحبًا بك في Book8 — رقمك هنا',
    html: baseHtml({ dir: 'rtl', lang: 'ar', inner })
  }
}

/** @param {import('../welcomeEmail.js').WelcomeTemplateInput} d */
export function buildWelcomeEmailForLocale(d) {
  const loc = d.locale === 'fr' ? 'fr' : d.locale === 'es' ? 'es' : d.locale === 'ar' ? 'ar' : 'en'
  if (loc === 'fr') return buildWelcomeEmailFrench(d)
  if (loc === 'es') return buildWelcomeEmailSpanish(d)
  if (loc === 'ar') return buildWelcomeEmailArabic(d)
  return buildWelcomeEmailEnglish(d)
}
