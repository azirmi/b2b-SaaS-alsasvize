import { FileType, VisaStage } from '../generated/prisma/enums';
import {
  CustomerProcessStage,
  ProcessPaymentType,
} from '../visa-applications/process-flow.constants';

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
  processStage: CustomerProcessStage;
  paymentType: ProcessPaymentType;
  applicationId: string;
}

export interface DocAssistantStatusUpdatedEmailInput {
  to: string;
  customerName: string;
  documentName: string;
  statusLabel: string;
  applicationId: string;
}

export interface AppointmentFourDayReminderEmailInput {
  to: string;
  customerName: string;
  appointmentDate: string;
  applicationId: string;
}

export interface PasswordResetEmailInput {
  to: string;
  customerName: string;
  resetUrl: string;
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
  [FileType.VISA_FEE_RECEIPT]: 'Vize Harcı Dekontu',
  [FileType.FINAL_RECEIPT]: 'Kalan Ödeme Dekontu',
  [FileType.OTHER]: 'Belge',
};

interface StageCopy {
  subject: string;
  paragraphs: string[];
  attentionItems?: string[];
}

function buildStageAdvancedCopy(
  stage: CustomerProcessStage,
  paymentType: ProcessPaymentType,
): StageCopy {
  switch (stage) {
    case CustomerProcessStage.STAGE_1_RECORD_CREATED:
      return {
        subject: 'Başvuru Kaydınız Başarıyla Oluşturuldu',
        paragraphs: [
          'Başvuru kaydınız başarıyla oluşturulmuştur. Danışmanınız ile gerçekleştirdiğiniz ön görüşme doğrultusunda başvurunuz sistemimize alınmıştır. Uzman ekibimiz başvurunuzu kısa süre içerisinde inceleyerek işlem sürecinizi başlatacaktır. Bu aşamada herhangi bir işlem yapmanıza gerek bulunmamaktadır. Başvurunuzun güncel durumunu müşteri paneliniz üzerinden dilediğiniz zaman takip edebilirsiniz.',
        ],
      };
    case CustomerProcessStage.STAGE_3_OPERATION_STARTED:
      return {
        subject: 'Başvurunuz İşleme Alındı',
        paragraphs: [
          'Başvurunuz operasyon ekibimize başarıyla aktarılmıştır. Uzman ekibimiz başvurunuz üzerinde çalışmaya başlamıştır. Başvuru türünüze göre müşteri panelinizde gerekli işlem adımları kullanıma açılmıştır. Lütfen müşteri panelinizi düzenli olarak kontrol ederek yönlendirmeleri takip ediniz.',
        ],
      };
    case CustomerProcessStage.STAGE_4_FORM_READY:
      return paymentType === 'NORMAL'
        ? {
            subject: 'Başvuru Formunuz ve Evrak Yükleme Alanınız Hazır',
            paragraphs: [
              'Başvurunuz için gerekli işlem adımları müşteri panelinizde kullanıma açılmıştır. Bu aşamada; Başvuru Formunu doldurabilir, Talep edilen belgeleri güvenli şekilde yükleyebilirsiniz. Belgelerinizi eksiksiz ve okunaklı şekilde yüklemeniz, sürecinizin planlanan şekilde ilerlemesine katkı sağlayacaktır. Belgeleriniz uzman ekibimiz tarafından ayrıntılı olarak kontrol edilecektir.',
            ],
          }
        : {
            subject: 'Başvuru Formunuz Hazır',
            paragraphs: [
              'Başvurunuz operasyon sürecine alınmıştır. İlk adım olarak müşteri panelinizde bulunan başvuru formunu eksiksiz şekilde doldurmanız gerekmektedir. Formunuz incelendikten sonra başvurunuz için randevu planlama süreci başlatılacaktır.',
            ],
          };
    case CustomerProcessStage.STAGE_5_APPOINTMENT_CREATED:
      return paymentType === 'NORMAL'
        ? {
            subject: 'Başvuru Randevunuz Oluşturuldu',
            paragraphs: [
              'Başvurunuz için randevunuz oluşturulmuştur. Randevu bilgileriniz müşteri panelinize eklenmiştir. [Tarih, Saat, Başvuru Merkezi Değişkenleri]. Kalan ödeme işleminizin tamamlanmasının ardından evrak yükleme alanınız aktif edilecektir.',
            ],
          }
        : {
            subject: 'Başvuru Randevunuz Oluşturuldu',
            paragraphs: [
              'Başvurunuz için randevunuz oluşturulmuştur. Randevu bilgileriniz müşteri panelinize eklenmiştir. [Tarih, Saat, Başvuru Merkezi Değişkenleri]. Kalan ödeme işleminizin tamamlanmasının ardından evrak yükleme alanınız aktif edilecektir.',
            ],
          };
    case CustomerProcessStage.STAGE_6_DOCUMENT_UPLOAD_OPEN:
      return paymentType === 'NORMAL'
        ? {
            subject: 'Evrak Yükleme Alanınız Hazır',
            paragraphs: [
              'Başvurunuz için evrak yükleme alanınız aktif edilmiştir. Talep edilen belgeleri müşteri paneliniz üzerinden güvenli şekilde yükleyebilirsiniz. Belgeleriniz uzman ekibimiz tarafından tek tek incelenecek ve gerekli görülmesi halinde panel üzerinden bilgilendirme yapılacaktır.',
            ],
          }
        : {
            subject: 'Evrak Yükleme Alanınız Hazır',
            paragraphs: [
              'Başvurunuz için evrak yükleme alanınız aktif edilmiştir. Talep edilen belgeleri müşteri paneliniz üzerinden güvenli şekilde yükleyebilirsiniz. Belgeleriniz uzman ekibimiz tarafından tek tek incelenecek ve gerekli görülmesi halinde panel üzerinden bilgilendirme yapılacaktır.',
            ],
          };
    case CustomerProcessStage.STAGE_7_DOCUMENT_REVISION_REQUIRED:
      return {
        subject: 'Belgeleriniz İçin Düzenleme Gerekiyor',
        paragraphs: [
          'Yüklediğiniz belgeler incelenmiştir. Başvurunuzun eksiksiz hazırlanabilmesi için bazı belgeleriniz hakkında düzenleme, ek bilgi veya yeniden yükleme gerekmektedir. Lütfen müşteri panelinizde ilgili belgenin altında yer alan açıklamayı inceleyerek gerekli işlemleri tamamlayınız. Belgelerinizi yeniden yükledikten sonra uzman ekibimiz tarafından tekrar kontrol edilecektir.',
        ],
      };
    case CustomerProcessStage.STAGE_8_DOCUMENTS_CHECKED:
      return {
        subject: 'Belgeleriniz Başarıyla Kontrol Edildi',
        paragraphs: [
          'Müşteri paneli üzerinden yüklediğiniz tüm belgeler uzman ekibimiz tarafından incelenmiş ve gerekli kontroller başarıyla tamamlanmıştır. Başvuru dosyanızın hazırlanma süreci başlamıştır. Uzman ekibimiz, başvurunuz için gerekli olan tüm belgeleri başvuru merkezinde kullanılacak sıralamaya uygun şekilde hazırlamaktadır. Dosyanız hazır olduğunda tarafınıza ayrıca bilgilendirme yapılacaktır.',
        ],
      };
    case CustomerProcessStage.STAGE_9_DOSSIER_READY:
      return {
        subject: 'Başvuru Dosyanız Hazır',
        paragraphs: [
          'Başvurunuz için gerekli tüm belgeler uzman ekibimiz tarafından hazırlanmış ve müşteri panelinize yüklenmiştir. Başvuru dosyanız, başvuru merkezinde teslim edilmesi gereken belge sıralamasına uygun olarak düzenlenmiştir. Lütfen müşteri paneliniz üzerinden tüm belgeleri indirerek sıralamayı değiştirmeden çıktısını alınız. Başvurunuzun sorunsuz ilerleyebilmesi için belgelerin sırasını değiştirmemeniz önemlidir. Randevu günü ve saatinde, hazırladığınız başvuru dosyası ile birlikte ilgili başvuru merkezinde hazır bulunmanız yeterlidir.',
        ],
        attentionItems: [
          'Belgeleri panelde sunulan sıraya göre indiriniz.',
          'Belgelerin sırasını değiştirmeyiniz.',
          'Tüm belgelerin çıktısını eksiksiz alınız.',
          'Randevu günü dosyanızı eksiksiz şekilde yanınızda bulundurunuz.',
          'Randevu saatinizden önce başvuru merkezinde hazır olunuz.',
        ],
      };
    case CustomerProcessStage.STAGE_10_PROCESS_COMPLETED:
      return {
        subject: 'Başvuru Süreciniz Tamamlandı',
        paragraphs: [
          'Başvuru süreciniz tamamlanmıştır. Bu süreç boyunca bize duyduğunuz güven için teşekkür ederiz. Alsasvize olarak amacımız, başvurunuzun her aşamasını planlı, şeffaf ve titizlikle yöneterek size güvenilir bir danışmanlık hizmeti sunmaktır. İlerleyen dönemlerde gerçekleştireceğiniz yeni vize başvurularınızda da size destek vermekten memnuniyet duyarız.',
        ],
      };
    case CustomerProcessStage.STAGE_2_APPLICATION_TAKEN_IN:
      return {
        subject: 'Başvurunuz İşleme Alındı',
        paragraphs: [
          'Başvurunuz sistemde işleme alınmıştır. Bu aşama iç süreç adımıdır ve şu an için herhangi bir işlem yapmanıza gerek bulunmamaktadır.',
        ],
      };
    default:
      return {
        subject: 'Başvuru Durumunuz Güncellendi',
        paragraphs: [
          'Başvurunuzda yeni bir durum güncellemesi yapılmıştır. Güncel adımları müşteri paneliniz üzerinden takip edebilirsiniz.',
        ],
      };
  }
}

function bulletList(items: string[]): string {
  const rows = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px 0;font-family:${FONT};font-size:14px;line-height:22px;color:${BODY};">${escapeHtml(
          item,
        )}</li>`,
    )
    .join('');

  return `<ul style="margin:0 0 16px 18px;padding:0;">${rows}</ul>`;
}

function standardClosingHtml(loginUrl: string): string {
  return [
    actionButton('Müşteri Paneline Git', loginUrl),
    paragraph(
      `Destek: <a href="tel:+905471010301" style="color:${INK};text-decoration:none;">+90 547 101 0301</a> | <a href="mailto:info@alsasvize.com" style="color:${INK};text-decoration:none;">info@alsasvize.com</a>`,
    ),
    paragraph('Alsasvize Online Vize Danışmanlığı'),
  ].join('');
}

function standardClosingText(loginUrl: string): string[] {
  return [
    `Müşteri Paneli: ${loginUrl}`,
    'Destek: +90 547 101 0301 | info@alsasvize.com',
    'Alsasvize Online Vize Danışmanlığı',
  ];
}

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

function companyWebsiteUrl(): string {
  return process.env.COMPANY_WEBSITE_URL ?? 'https://alsasvize.com';
}

function companyInstagramUrl(): string {
  return process.env.COMPANY_INSTAGRAM_URL ?? 'https://instagram.com/alsasvize';
}

function formatDateTimeTr(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  widthPercent = 25,
): string {
  const labelStyle: Record<StepState, string> = {
    done: `color:${INK_SOFT};font-weight:600;`,
    current: `color:${INK};font-weight:700;`,
    future: `color:${FAINT};font-weight:500;`,
  };
  return `<td width="${widthPercent}%" valign="top" style="width:${widthPercent}%;padding:0;"><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr>${connector(
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
  const subject = `İşlem gerekli: ${fileLabel} belgesini yeniden yükleyin`;
  const preheader = `${fileLabel} belgesi onaylanamadı. Lütfen düzeltilmiş sürümü yeniden yükleyin.`;
  const loginUrl = customerLoginUrl();

  const contentHtml = [
    paragraph(`Merhaba ${name},`),
    heading('Bir belgeniz için işlem gerekiyor'),
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
    standardClosingHtml(loginUrl),
  ].join('');

  const html = renderShell({ preheader, contentHtml });
  const text = [
    `Merhaba ${input.customerName},`,
    '',
    'Bir belgeniz için işlem gerekiyor',
    '',
    'Vize başvurunuzdaki belgelerden biri onaylanamadı.',
    '',
    `Belge: ${fileLabel}`,
    `Neden: ${input.reason}`,
    '',
    'Lütfen panelinize giriş yapın, işaretlenen dosyayı kaldırın ve düzeltilmiş sürümünü yükleyin. Belge onaylandığında başvurunuz otomatik olarak ilerler.',
    '',
    ...standardClosingText(loginUrl),
  ].join('\n');

  return { subject, html, text };
}

export function renderStageAdvancedEmail(
  input: StageAdvancedEmailInput,
): RenderedEmail {
  const name = escapeHtml(input.customerName);
  const copy = buildStageAdvancedCopy(input.processStage, input.paymentType);
  const loginUrl = customerLoginUrl();
  const paragraphBlocks = copy.paragraphs.map((item) =>
    paragraph(escapeHtml(item)),
  );

  const contentHtml = [
    paragraph(`Merhaba ${name},`),
    ...paragraphBlocks,
    ...(copy.attentionItems && copy.attentionItems.length > 0
      ? [
          paragraph(
            `<strong style="color:${INK};font-weight:700;">DİKKAT EDİLMESİ GEREKENLER:</strong>`,
          ),
          bulletList(copy.attentionItems),
        ]
      : []),
    standardClosingHtml(loginUrl),
  ].join('');

  const html = renderShell({
    preheader: copy.subject,
    contentHtml,
  });
  const text = [
    `Merhaba ${input.customerName},`,
    '',
    ...copy.paragraphs,
    ...(copy.attentionItems && copy.attentionItems.length > 0
      ? [
          '',
          'DİKKAT EDİLMESİ GEREKENLER:',
          ...copy.attentionItems.map((item) => `- ${item}`),
        ]
      : []),
    '',
    ...standardClosingText(loginUrl),
  ].join('\n');

  return { subject: copy.subject, html, text };
}

export function renderDocAssistantStatusUpdatedEmail(
  input: DocAssistantStatusUpdatedEmailInput,
): RenderedEmail {
  const loginUrl = customerLoginUrl();
  const customerName = escapeHtml(input.customerName);
  const documentName = escapeHtml(input.documentName);
  const statusLabel = escapeHtml(input.statusLabel);

  const subject = `${input.documentName} durumu güncellendi`;
  const preheader = `${input.documentName} belgesi ${input.statusLabel} durumuna getirildi.`;

  const contentHtml = [
    paragraph(`Merhaba ${customerName},`),
    heading('Belge durum güncellemesi'),
    paragraph(
      `Sayın ${customerName}, <strong style="color:${INK};font-weight:700;">${documentName}</strong> adlı belgenizin durumu <strong style="color:${INK};font-weight:700;">${statusLabel}</strong> olarak güncellenmiştir.`,
    ),
    calloutBox([
      { label: 'Belge', value: input.documentName, strong: true },
      { label: 'Yeni durum', value: input.statusLabel },
    ]),
    paragraph(
      'Güncel durumu panelinizden takip edebilir, gerekli olduğunda belge süreci için yeni aksiyon alabilirsiniz.',
    ),
    standardClosingHtml(loginUrl),
  ].join('');

  const html = renderShell({
    preheader,
    contentHtml,
  });

  const text = [
    `Merhaba ${input.customerName},`,
    '',
    'Belge durum güncellemesi',
    '',
    `${input.documentName} adlı belgenizin durumu ${input.statusLabel} olarak güncellenmiştir.`,
    '',
    ...standardClosingText(loginUrl),
  ].join('\n');

  return { subject, html, text };
}

export function renderAppointmentFourDayReminderEmail(
  input: AppointmentFourDayReminderEmailInput,
): RenderedEmail {
  const loginUrl = customerLoginUrl();
  const customerName = escapeHtml(input.customerName);
  const appointmentLabel = formatDateTimeTr(input.appointmentDate);

  const subject = 'Randevunuza 4 gün kaldı';
  const preheader = `Randevu tarihinize 4 gün kaldı: ${appointmentLabel}`;

  const contentHtml = [
    paragraph(`Merhaba ${customerName},`),
    heading('Randevunuza 4 gün kaldı'),
    paragraph(
      `Randevu tarihiniz yaklaşıyor. Planlanan randevu zamanınız: <strong style="color:${INK};font-weight:700;">${escapeHtml(
        appointmentLabel,
      )}</strong>.`,
    ),
    calloutBox([
      { label: 'Bildirim', value: 'Randevunuza 4 gün kaldı', strong: true },
      { label: 'Randevu', value: appointmentLabel },
    ]),
    paragraph(
      'Panelinize giriş yaparak güncel belge ve süreç durumunuzu kontrol etmenizi öneririz.',
    ),
    standardClosingHtml(loginUrl),
  ].join('');

  const html = renderShell({
    preheader,
    contentHtml,
  });

  const text = [
    `Merhaba ${input.customerName},`,
    '',
    'Randevunuza 4 gün kaldı',
    '',
    `Randevu tarihiniz yaklaşıyor: ${appointmentLabel}`,
    '',
    ...standardClosingText(loginUrl),
  ].join('\n');

  return { subject, html, text };
}

export function renderPasswordResetEmail(
  input: PasswordResetEmailInput,
): RenderedEmail {
  const customerName = escapeHtml(input.customerName);
  const loginUrl = customerLoginUrl();
  const websiteUrl = companyWebsiteUrl();
  const instagramUrl = companyInstagramUrl();

  const subject = 'Şifre yenileme bağlantınız hazır';
  const preheader = 'Alsasvize hesabınız için şifre yenileme bağlantısı gönderildi.';

  const contentHtml = [
    paragraph(`Merhaba ${customerName},`),
    heading('Şifrenizi güvenle yenileyin'),
    paragraph(
      'Hesabınız için bir şifre yenileme talebi aldık. Yeni şifrenizi belirlemek için aşağıdaki butona tıklayın.',
    ),
    actionButton('Şifremi Yenile', input.resetUrl),
    paragraph(
      `Buton çalışmazsa bağlantıyı kopyalayarak tarayıcınıza yapıştırabilirsiniz:<br /><a href="${escapeHtml(
        input.resetUrl,
      )}" target="_blank" rel="noopener noreferrer" style="color:${INK};word-break:break-all;">${escapeHtml(
        input.resetUrl,
      )}</a>`,
    ),
    paragraph(
      'Bu bağlantı sınırlı süreyle geçerlidir. Bu işlemi siz başlatmadıysanız bu e-postayı güvenle yok sayabilirsiniz.',
    ),
    calloutBox([
      {
        label: 'Resmi web sitemiz',
        value: websiteUrl,
      },
      {
        label: 'Instagram',
        value: instagramUrl,
      },
    ]),
    standardClosingHtml(loginUrl),
  ].join('');

  const html = renderShell({
    preheader,
    contentHtml,
  });

  const text = [
    `Merhaba ${input.customerName},`,
    '',
    'Hesabınız için bir şifre yenileme talebi aldık.',
    `Şifrenizi yenilemek için bağlantı: ${input.resetUrl}`,
    '',
    'Bu bağlantı sınırlı süreyle geçerlidir. İşlemi siz başlatmadıysanız e-postayı yok sayabilirsiniz.',
    '',
    `Web: ${websiteUrl}`,
    `Instagram: ${instagramUrl}`,
    '',
    ...standardClosingText(loginUrl),
  ].join('\n');

  return { subject, html, text };
}
