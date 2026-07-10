import { FileType, VisaStage } from '../generated/prisma/enums';

/**
 * Pure, dependency-free HTML/text email builders.
 *
 * Everything is table + inline-CSS based so it survives the widest range of
 * email clients (Gmail, Apple Mail, Outlook desktop/mobile). The visual
 * language is deliberately monochrome (ink / gray / hairline) to match the
 * enterprise, anti-AI-slop design system — colour is never used decoratively.
 */

// -----------------------------------------------------------------------------
//  Palette (monochrome only)
// -----------------------------------------------------------------------------
const INK = '#0a0a0a'; // primary text, current/done markers
const INK_SOFT = '#18181b'; // completed labels
const BODY = '#3f3f46'; // paragraph copy
const MUTED = '#71717a'; // captions, footer, eyebrow labels
const FAINT = '#a1a1aa'; // future/disabled markers + labels
const LINE = '#e4e4e7'; // hairline borders + unfilled connectors
const CANVAS = '#f4f4f5'; // outer email background
const SURFACE = '#ffffff'; // card surface
const SURFACE_ALT = '#fafafa'; // subtle inner fills

const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif";

// -----------------------------------------------------------------------------
//  Public types
// -----------------------------------------------------------------------------
export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface DocumentRejectedEmailInput {
  to: string;
  customerName: string;
  fileType: FileType;
  reason: string;
  currentStage: VisaStage;
  applicationId: string;
}

export interface StageAdvancedEmailInput {
  to: string;
  customerName: string;
  previousStage: VisaStage;
  newStage: VisaStage;
  applicationId: string;
}

// -----------------------------------------------------------------------------
//  Customer-facing pipeline (4 milestones the customer actually cares about)
// -----------------------------------------------------------------------------
const PIPELINE_STEPS = [
  'Başvuru Alındı',
  'Evrak İncelemesi',
  'İşlemde',
  'Tamamlandı',
] as const;

/** Maps each internal stage onto one of the four customer-facing milestones. */
const STAGE_STEP_INDEX: Record<VisaStage, number> = {
  [VisaStage.SALES_POOL]: 0,
  [VisaStage.SALES_PROCESS]: 0,
  [VisaStage.DOC_POOL]: 1,
  [VisaStage.DOC_PROCESS]: 1,
  [VisaStage.SEC_POOL]: 2,
  [VisaStage.SEC_PROCESS]: 2,
  [VisaStage.COMPLETED]: 3,
  // Terminal/admin states never trigger these emails; keep the map exhaustive.
  [VisaStage.PAUSED]: 0,
  [VisaStage.CANCELLED]: 0,
};

const FILE_TYPE_LABEL: Record<FileType, string> = {
  [FileType.PASSPORT]: 'Pasaport',
  [FileType.BANK_STATEMENT]: 'Banka Hesap Dökümü',
  [FileType.INTENT_LETTER]: 'Niyet Mektubu',
  [FileType.CONSULATE_FORM]: 'Konsolosluk Formu',
  [FileType.VISA_GRANT]: 'Vize Sonuç Belgesi',
  [FileType.PAYMENT_RECEIPT]: 'Ödeme Dekontu',
  [FileType.FLIGHT_HOTEL_RESERVATION]: 'Uçak ve Otel Rezervasyonu',
  [FileType.LETTER_OF_INTENT]: 'Niyet Mektubu',
  [FileType.TRAVEL_PLAN]: 'Seyahat Planı',
  [FileType.HEALTH_INSURANCE]: 'Seyahat Sağlık Sigortası',
  [FileType.APPOINTMENT_CONFIRMATION]: 'Randevu Onayı',
  [FileType.FINAL_RECEIPT]: 'Kalan Ödeme Dekontu',
  [FileType.OTHER]: 'Belge',
};

interface StageCopy {
  subject: string;
  headline: string;
  message: string;
}

const STAGE_ADVANCED_COPY: Partial<Record<VisaStage, StageCopy>> = {
  [VisaStage.DOC_POOL]: {
    subject: 'Başvurunuz evrak inceleme aşamasına geçti',
    headline: 'Evraklarınız inceleniyor',
    message:
      'İyi haber: Başvurunuz ön kontrolden geçti ve Evrak İnceleme aşamasına alındı. Yüklediğiniz evraklar ekibimiz tarafından kontrol edilecek, ihtiyaç halinde sizinle iletişime geçilecektir.',
  },
  [VisaStage.SEC_POOL]: {
    subject: 'Başvurunuz işlem aşamasına alındı',
    headline: 'Başvurunuz işlemde',
    message:
      'Evraklarınız onaylandı ve başvurunuz işlem aşamasına geçti. Ekibimiz vize başvurunuzun son adımlarını hazırlamaktadır.',
  },
  [VisaStage.COMPLETED]: {
    subject: 'Vize başvurunuz tamamlandı',
    headline: 'Vize başvurunuz tamamlandı',
    message:
      'Vize başvurunuz sonuçlandırılmıştır. Alsasvize’i tercih ettiğiniz için teşekkür ederiz. Sonucu görüntülemek ve oluşturulan belgeleri indirmek için panelinize giriş yapabilirsiniz.',
  },
};

const DEFAULT_STAGE_COPY: StageCopy = {
  subject: 'Başvuru durumunuz güncellendi',
  headline: 'Başvurunuz bir sonraki aşamaya geçti',
  message:
    'Vize başvurunuz bir sonraki aşamaya geçmiştir. Güncel detaylar için panelinize giriş yapabilirsiniz.',
};

// -----------------------------------------------------------------------------
//  Small helpers
// -----------------------------------------------------------------------------
/** Escapes untrusted values before interpolating them into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A short, human-friendly reference derived from the application UUID. */
function shortRef(applicationId: string): string {
  return applicationId.slice(0, 8).toUpperCase();
}

function heading(text: string): string {
  return `<h1 style="margin:20px 0 4px 0;font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;color:${INK};letter-spacing:-0.2px;">${escapeHtml(
    text,
  )}</h1>`;
}

/** Paragraph. `html` is injected as-is, so callers must pre-escape any input. */
function paragraph(html: string): string {
  return `<p style="margin:0 0 16px 0;font-family:${FONT};font-size:15px;line-height:24px;color:${BODY};">${html}</p>`;
}

function actionButton(label: string, url: string): string {
  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:4px 0 20px 0;"><tr><td><a href="${escapeHtml(
    url,
  )}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 18px;font-family:${FONT};font-size:13px;font-weight:700;letter-spacing:0.2px;text-decoration:none;background:${INK};color:#ffffff;border-radius:8px;">${escapeHtml(
    label,
  )}</a></td></tr></table>`;
}

function customerLoginUrl(): string {
  return (
    process.env.CUSTOMER_LOGIN_URL ??
    process.env.FRONTEND_APP_URL ??
    'https://alsasvize.com/login'
  );
}

// -----------------------------------------------------------------------------
//  Visual stage tracker (the centrepiece)
// -----------------------------------------------------------------------------
type StepState = 'done' | 'current' | 'future';

/** A single 36px status node (circle degrades to a square on legacy Outlook). */
function trackerNode(state: StepState, numberLabel: string): string {
  const style: Record<
    StepState,
    { bg: string; color: string; border: string; content: string }
  > = {
    done: {
      bg: INK,
      color: '#ffffff',
      border: `2px solid ${INK}`,
      content: '&#10003;',
    },
    current: {
      bg: '#ffffff',
      color: INK,
      border: `2px solid ${INK}`,
      content: numberLabel,
    },
    future: {
      bg: '#ffffff',
      color: FAINT,
      border: `1px solid ${LINE}`,
      content: numberLabel,
    },
  };
  const s = style[state];
  return `<table role="presentation" align="center" border="0" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${s.bg};border:${s.border};border-radius:50%;color:${s.color};font-family:${FONT};font-size:14px;font-weight:700;line-height:36px;mso-line-height-rule:exactly;text-align:center;">${s.content}</td></tr></table>`;
}

/** Half-width horizontal connector, vertically centred on the node. */
function connector(color: string): string {
  return `<td valign="middle" style="padding:0;font-size:0;line-height:0;"><div style="height:2px;line-height:2px;font-size:0;background:${color};">&nbsp;</div></td>`;
}

function trackerStep(
  index: number,
  label: string,
  state: StepState,
  leftColor: string,
  rightColor: string,
): string {
  const labelStyle: Record<StepState, string> = {
    done: `color:${INK_SOFT};font-weight:600;`,
    current: `color:${INK};font-weight:700;`,
    future: `color:${FAINT};font-weight:500;`,
  };
  return `<td width="25%" valign="top" style="width:25%;padding:0;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${connector(
    leftColor,
  )}<td width="36" valign="middle" style="width:36px;padding:0;">${trackerNode(
    state,
    String(index + 1),
  )}</td>${connector(
    rightColor,
  )}</tr></table><div style="margin-top:10px;text-align:center;font-family:${FONT};font-size:12px;line-height:16px;${labelStyle[state]}">${escapeHtml(
    label,
  )}</div></td>`;
}

/**
 * Renders the step-by-step progress tracker for a stage: past steps are marked
 * done, the current step is highlighted in solid ink, future steps are greyed.
 */
export function renderStageTracker(stage: VisaStage): string {
  const isCompleted = stage === VisaStage.COMPLETED;
  const currentStep = STAGE_STEP_INDEX[stage];
  const lastIndex = PIPELINE_STEPS.length - 1;

  const cells = PIPELINE_STEPS.map((label, index) => {
    const state: StepState =
      isCompleted || index < currentStep
        ? 'done'
        : index === currentStep
          ? 'current'
          : 'future';

    const leftColor =
      index === 0
        ? 'transparent'
        : isCompleted || currentStep >= index
          ? INK
          : LINE;
    const rightColor =
      index === lastIndex
        ? 'transparent'
        : isCompleted || currentStep >= index + 1
          ? INK
          : LINE;

    return trackerStep(index, label, state, leftColor, rightColor);
  }).join('');

  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="width:100%;"><tr>${cells}</tr></table>`;
}

function trackerSection(stage: VisaStage): string {
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:8px 0 24px 0;background:${SURFACE_ALT};border:1px solid ${LINE};border-radius:10px;"><tr><td style="padding:26px 20px 22px 20px;">${renderStageTracker(
    stage,
  )}</td></tr></table>`;
}

/** Bordered detail box with an ink accent rule (used for the rejection reason). */
function calloutBox(
  rows: Array<{ label: string; value: string; strong?: boolean }>,
): string {
  const inner = rows
    .map(
      (row, i) =>
        `<div style="${i === rows.length - 1 ? '' : 'margin:0 0 14px 0;'}"><div style="font-family:${FONT};font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};margin-bottom:5px;">${escapeHtml(
          row.label,
        )}</div><div style="font-family:${FONT};font-size:15px;line-height:22px;color:${INK};${
          row.strong ? 'font-weight:700;' : ''
        }">${escapeHtml(row.value)}</div></div>`,
    )
    .join('');
  return `<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;border:1px solid ${LINE};border-left:3px solid ${INK};border-radius:8px;background:${SURFACE_ALT};"><tr><td style="padding:20px;">${inner}</td></tr></table>`;
}

// -----------------------------------------------------------------------------
//  Document shell
// -----------------------------------------------------------------------------
function renderShell(params: {
  preheader: string;
  contentHtml: string;
  applicationRef: string;
}): string {
  // Absolute URL required for email clients; overridable per environment.
  const logoUrl =
    process.env.EMAIL_LOGO_URL ?? 'https://alsasvize.com/logo.png';
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>Alsasvize Bildirim</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${CANVAS};opacity:0;">${escapeHtml(
    params.preheader,
  )}</div>
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:${CANVAS};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${SURFACE};border:1px solid ${LINE};border-radius:12px;overflow:hidden;">
<tr><td style="height:4px;background:${INK};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 40px 6px 40px;font-family:${FONT};"><img src="${logoUrl}" width="150" alt="Alsas Vize" style="display:block;margin:0 auto;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" /></td></tr>
<tr><td style="padding:4px 40px 8px 40px;font-family:${FONT};">${params.contentHtml}</td></tr>
<tr><td style="padding:22px 40px 30px 40px;font-family:${FONT};border-top:1px solid ${LINE};">
<div style="font-size:12px;line-height:18px;color:${MUTED};">Referans <span style="font-family:'Courier New',Courier,monospace;color:${INK_SOFT};">#${escapeHtml(
    params.applicationRef,
  )}</span></div>
<div style="margin-top:6px;font-size:12px;line-height:18px;color:${MUTED};">Bu e-posta Alsasvize tarafından otomatik olarak gönderilmiştir. Lütfen bu mesaja yanıt vermeyiniz.</div>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
//  Public builders
// -----------------------------------------------------------------------------
export function renderDocumentRejectedEmail(
  input: DocumentRejectedEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.customerName);
  const fileLabel = FILE_TYPE_LABEL[input.fileType];
  const ref = shortRef(input.applicationId);
  const subject = `İşlem gerekli: ${fileLabel} belgesini yeniden yükleyin`;
  const preheader = `${fileLabel} belgesi onaylanamadı. Lütfen düzeltilmiş sürümü yeniden yükleyin.`;
  const loginUrl = customerLoginUrl();

  const contentHtml = [
    heading('Bir belgeniz için işlem gerekiyor'),
    paragraph(`Merhaba ${name},`),
    paragraph(
      `Vize başvurunuzdaki belgelerden biri incelendi ve <strong style="color:${INK};font-weight:700;">onaylanamadı</strong>. Sürecin devam edebilmesi için lütfen düzeltilmiş sürümünü yeniden yükleyiniz.`,
    ),
    trackerSection(input.currentStage),
    calloutBox([
      { label: 'Belge', value: fileLabel, strong: true },
      { label: 'Reddedilme nedeni', value: input.reason },
    ]),
    paragraph(
      'Panelinize giriş yapıp işaretlenen dosyayı kaldırın ve yerine yeni dosya yükleyin. Belge onaylandığında başvurunuz otomatik olarak ilerleyecektir.',
    ),
    actionButton('Sisteme Giriş Yap', loginUrl),
  ].join('');

  const html = renderShell({ preheader, contentHtml, applicationRef: ref });
  const text = [
    'Bir belgeniz için işlem gerekiyor',
    '',
    `Merhaba ${input.customerName},`,
    'Vize başvurunuzdaki belgelerden biri onaylanamadı.',
    '',
    `Belge: ${fileLabel}`,
    `Neden: ${input.reason}`,
    '',
    'Lütfen panelinize giriş yapın, işaretlenen dosyayı kaldırın ve düzeltilmiş sürümünü yükleyin. Belge onaylandığında başvurunuz otomatik olarak ilerler.',
    `Sisteme Giriş Yap: ${loginUrl}`,
    '',
    `Referans #${ref}`,
    'Bu e-posta Alsasvize tarafından otomatik gönderilmiştir. Lütfen yanıtlamayın.',
  ].join('\n');

  return { subject, html, text };
}

export function renderStageAdvancedEmail(
  input: StageAdvancedEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.customerName);
  const copy = STAGE_ADVANCED_COPY[input.newStage] ?? DEFAULT_STAGE_COPY;
  const ref = shortRef(input.applicationId);
  const loginUrl = customerLoginUrl();

  const contentHtml = [
    heading(copy.headline),
    paragraph(`Merhaba ${name},`),
    paragraph(escapeHtml(copy.message)),
    actionButton('Sisteme Giriş Yap', loginUrl),
    trackerSection(input.newStage),
  ].join('');

  const html = renderShell({
    preheader: copy.subject,
    contentHtml,
    applicationRef: ref,
  });
  const text = [
    copy.headline,
    '',
    `Merhaba ${input.customerName},`,
    copy.message,
    `Sisteme Giriş Yap: ${loginUrl}`,
    '',
    `Referans #${ref}`,
    'Bu e-posta Alsasvize tarafından otomatik gönderilmiştir. Lütfen yanıtlamayın.',
  ].join('\n');

  return { subject: copy.subject, html, text };
}
