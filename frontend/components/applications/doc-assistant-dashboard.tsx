"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Paperclip, Upload } from "lucide-react";

import {
  deliverToCustomer,
  updateDocAssistantStatus,
} from "@/lib/actions/applications";
import { requestDocumentUpload } from "@/lib/actions/documents";
import {
  DocAssistantDocumentStatus,
  DocAssistantDocumentType,
  FileType,
} from "@/lib/enums";
import { INTENT_CLASSES, type Intent } from "@/lib/status";
import type { DocAssistantItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DocAssistantCardDef {
  id: number;
  type: DocAssistantDocumentType;
  constraint: "Kontrol" | "Zorunlu" | "Opsiyonel" | "Şartlı" | "Şartlı Zorunlu" | "Süreç Sonu";
  title: string;
  desc: string;
  btn: string;
  uploadFileType: FileType;
}

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
const FILE_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DELIVERY_GATEKEEPER_ERROR_MESSAGE =
  "Hata: Tüm zorunlu belgeler yüklenmeden ve durumları Teslime Hazır yapılmadan danışana gönderim yapılamaz.";

const DOC_ASSISTANT_CARDS: DocAssistantCardDef[] = [
  {
    id: 2,
    type: DocAssistantDocumentType.VIZE_DILEKCESI_NIYET_YAZISI,
    title: "Vize Dilekçesi / Niyet Yazısı",
    constraint: "Zorunlu",
    desc:
      "Danışanın seyahat amacını, planlanan tarihlerini, mesleki/finansal durumunu ve geri dönüş niyetini açıklayan vize dilekçesi bu alandan yüklenir. Dilekçe, danışan profiline ve başvuru dosyasındaki evraklara uygun şekilde hazırlanmalıdır.",
    btn: "Dilekçeyi Yükle",
    uploadFileType: FileType.LETTER_OF_INTENT,
  },
  {
    id: 3,
    type: DocAssistantDocumentType.SEYAHAT_PLANI,
    title: "Seyahat Planı",
    constraint: "Opsiyonel",
    desc:
      "Danışanın seyahat tarihlerini, ülke/şehir geçişlerini, konaklama planını ve genel seyahat akışını gösteren seyahat planı bu alandan yüklenir. Planlanan tarihlerin otel, uçak ve sigorta belgeleriyle uyumlu olmasına dikkat edilmelidir.",
    btn: "Seyahat Planını Yükle",
    uploadFileType: FileType.TRAVEL_PLAN,
  },
  {
    id: 4,
    type: DocAssistantDocumentType.UCAK_REZERVASYONU,
    title: "Uçak Rezervasyonu",
    constraint: "Opsiyonel",
    desc:
      "Danışan uçak biletini kendisi satın aldıysa ilgili belge danışan panelinden alınabilir. Danışan satın alma yapmadıysa, dosya asistanı tarafından hazırlanan uçak rezervasyonu bu alandan yüklenir. Belgede ad-soyad, seyahat tarihleri, güzergâh ve PNR/rezervasyon numarası görünmelidir.",
    btn: "Uçak Rezervasyonunu Yükle",
    uploadFileType: FileType.FLIGHT_HOTEL_RESERVATION,
  },
  {
    id: 5,
    type: DocAssistantDocumentType.OTEL_KONAKLAMA_REZERVASYONU,
    title: "Otel / Konaklama Rezervasyonu",
    constraint: "Opsiyonel",
    desc:
      "Danışan otel rezervasyonunu kendisi satın aldıysa ilgili belge danışan panelinden alınabilir. Danışan satın alma yapmadıysa, dosya asistanı tarafından hazırlanan otel veya konaklama rezervasyonu bu alandan yüklenir. Belgede ad-soyad, konaklama tarihleri, tesis adı ve adres bilgileri görünmelidir.",
    btn: "Otel Rezervasyonunu Yükle",
    uploadFileType: FileType.FLIGHT_HOTEL_RESERVATION,
  },
  {
    id: 6,
    type: DocAssistantDocumentType.SEYAHAT_SAGLIK_SIGORTASI,
    title: "Seyahat Sağlık Sigortası",
    constraint: "Zorunlu",
    desc:
      "Danışanın seyahat tarihlerini kapsayan seyahat sağlık sigortası poliçesi dosya asistanı tarafından hazırlanır ve bu alandan yüklenir. Poliçede ad-soyad, tarih aralığı, teminat bilgisi ve geçerlilik bölgesi net şekilde görünmelidir.",
    btn: "Sigorta Poliçesini Yükle",
    uploadFileType: FileType.HEALTH_INSURANCE,
  },
  {
    id: 7,
    type: DocAssistantDocumentType.SPONSORLUK_YAZISI,
    title: "Sponsorluk Yazısı",
    constraint: "Opsiyonel",
    desc:
      "Seyahat masrafları sponsor tarafından karşılanacaksa sponsorluk yazısı dosya asistanı tarafından hazırlanır ve bu alandan yüklenir. Yazıdaki sponsor bilgileri, danışan tarafından yüklenen sponsor evraklarıyla uyumlu olmalıdır.",
    btn: "Sponsorluk Yazısını Yükle",
    uploadFileType: FileType.OTHER,
  },
  {
    id: 8,
    type: DocAssistantDocumentType.EK_TURISTIK_DESTEK_BELGELERI,
    title: "Ek Turistik Destek Belgeleri",
    constraint: "Opsiyonel",
    desc:
      "Müze bileti, konser bileti, maç bileti, etkinlik kaydı veya turistik seyahat amacını destekleyen benzeri belgeler gerekli görülürse dosya asistanı tarafından hazırlanır, düzenlenir veya başvuru dosyasına eklenir. Bu alan yalnızca dosyayı destekleyici turistik belgeler için kullanılmalıdır.",
    btn: "Turistik Destek Belgesini Yükle",
    uploadFileType: FileType.OTHER,
  },
  {
    id: 9,
    type: DocAssistantDocumentType.RANDEVU_ONAYI,
    title: "Randevu Onayı",
    constraint: "Zorunlu",
    desc:
      "Başvuru merkezi veya konsolosluk randevu onay belgesi bu alandan yüklenir. Belgede danışanın adı, randevu tarihi, randevu saati, başvuru merkezi ve referans numarası görünmelidir.",
    btn: "Randevu Onayını Yükle",
    uploadFileType: FileType.APPOINTMENT_CONFIRMATION,
  },
  {
    id: 10,
    type: DocAssistantDocumentType.BASVURU_TESLIM_FORMU,
    title: "Başvuru Teslim Formu",
    constraint: "Zorunlu",
    desc:
      "Başvuru dosyasının teslim edildiğini gösteren form veya teslim belgesi bu alandan yüklenir. Belgede danışan bilgileri, teslim tarihi ve başvuru merkezi bilgileri okunabilir olmalıdır.",
    btn: "Teslim Formunu Yükle",
    uploadFileType: FileType.CONSULATE_FORM,
  },
  {
    id: 11,
    type: DocAssistantDocumentType.VIZE_HARCI_SERVIS_BEDELI_DEKONTU,
    title: "Vize Harcı / Servis Bedeli Dekontu",
    constraint: "Opsiyonel",
    desc:
      "Başvuru sürecinde oluşan vize harcı, servis bedeli veya başvuru merkezi ödeme dekontu bu alandan yüklenir. Bu alan yalnızca başvuru dosyasıyla ilgili resmi ödeme belgeleri için kullanılmalıdır.",
    btn: "Ödeme Dekontunu Yükle",
    uploadFileType: FileType.VISA_FEE_RECEIPT,
  },
  {
    id: 12,
    type: DocAssistantDocumentType.KALAN_ODEME_DEKONTU,
    title: "Kalan Ödeme Dekontu",
    constraint: "Şartlı Zorunlu",
    desc:
      "Danışan kalan ödemeli bir süreçle başlatıldıysa, dosya teslim adımına geçilebilmesi için kalan ödeme dekontu dosya asistanı tarafından bu alana yüklenmelidir. Kalan ödeme dekontu yüklenmeden dosya teslim süreci tamamlanmamalıdır.",
    btn: "Kalan Ödeme Dekontunu Yükle",
    uploadFileType: FileType.FINAL_RECEIPT,
  },
  {
    id: 13,
    type: DocAssistantDocumentType.VIZE_SONUC_BELGESI,
    title: "Onaylı Pasaport",
    constraint: "Süreç Sonu",
    desc:
      "Başvuru sonucu açıklandıktan sonra onaylı pasaport bu alandan yüklenir. Bu belge yalnızca sonuç takibi ve danışan bilgilendirme süreci için kullanılmalıdır.",
    btn: "Onaylı Pasaportu Yükle",
    uploadFileType: FileType.VISA_GRANT,
  },
  {
    id: 16,
    type: DocAssistantDocumentType.DIGER_EK_OPERASYON_BELGESI,
    title: "Diğer / Ek Operasyon Belgesi",
    constraint: "Opsiyonel",
    desc:
      "Yukarıdaki kategorilere girmeyen ancak dosya sürecinde gerekli olabilecek ek operasyon belgeleri bu alandan yüklenir. Belge adının ve içeriğinin anlaşılır olmasına dikkat edilmelidir.",
    btn: "Ek Belgeyi Yükle",
    uploadFileType: FileType.OTHER,
  },
];

const STATUS_OPTIONS: Array<{
  value: DocAssistantDocumentStatus;
  label: string;
  intent: Intent;
}> = [
  {
    value: DocAssistantDocumentStatus.HAZIRLANIYOR,
    label: "Hazırlanıyor",
    intent: "info",
  },
  {
    value: DocAssistantDocumentStatus.YUKLENDI,
    label: "Yüklendi",
    intent: "success",
  },
  {
    value: DocAssistantDocumentStatus.TESLIME_HAZIR,
    label: "Teslime Hazır",
    intent: "success",
  },
];

const STATUS_LABEL_TR = Object.fromEntries(
  STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<DocAssistantDocumentStatus, string>;

function getDefaultStatusByType(
  items: DocAssistantItem[],
): Record<DocAssistantDocumentType, DocAssistantDocumentStatus> {
  const itemByType = new Map(items.map((item) => [item.type, item.status] as const));

  return DOC_ASSISTANT_CARDS.reduce(
    (acc, card) => {
      acc[card.type] =
        itemByType.get(card.type) ?? DocAssistantDocumentStatus.HAZIRLANIYOR;
      return acc;
    },
    {} as Record<DocAssistantDocumentType, DocAssistantDocumentStatus>,
  );
}

function validateUploadFile(file: File): string | null {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    return "Desteklenmeyen dosya türü. JPG, PNG, WebP veya PDF yükleyin.";
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    return "Dosya 10 MB sınırını aşıyor.";
  }
  return null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocAssistantDashboard({
  applicationId,
  items,
  canEdit,
}: {
  applicationId: string;
  items: DocAssistantItem[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busyType, setBusyType] = useState<DocAssistantDocumentType | null>(null);
  const [isDelivering, setIsDelivering] = useState(false);
  const initialStatus = useMemo(() => getDefaultStatusByType(items), [items]);
  const [statusByType, setStatusByType] = useState(initialStatus);
  const [uploadedFileNameByType, setUploadedFileNameByType] = useState<
    Partial<Record<DocAssistantDocumentType, string>>
  >({});
  const [uploadedFileSizeByType, setUploadedFileSizeByType] = useState<
    Partial<Record<DocAssistantDocumentType, number>>
  >({});
  const [globalFeedback, setGlobalFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const inputRefs = useRef<
    Partial<Record<DocAssistantDocumentType, HTMLInputElement | null>>
  >({});

  async function persistStatus(
    type: DocAssistantDocumentType,
    nextStatus: DocAssistantDocumentStatus,
  ) {
    const previousStatus = statusByType[type];
    if (previousStatus === nextStatus || !canEdit) {
      return true;
    }

    setStatusByType((current) => ({ ...current, [type]: nextStatus }));
    setBusyType(type);
    setGlobalFeedback(null);

    const result = await updateDocAssistantStatus(applicationId, type, nextStatus);
    if (!result.ok) {
      setStatusByType((current) => ({ ...current, [type]: previousStatus }));
      setGlobalFeedback({
        type: "error",
        message: result.error ?? "Belge durumu güncellenemedi.",
      });
      setBusyType(null);
      return false;
    }

    setGlobalFeedback({
      type: "success",
      message: "Belge durumu güncellendi ve danışan bildirimi gönderildi.",
    });
    setBusyType(null);
    return true;
  }

  async function uploadForCard(card: DocAssistantCardDef, file: File) {
    const validationError = validateUploadFile(file);
    if (validationError) {
      setGlobalFeedback({ type: "error", message: validationError });
      return;
    }

    if (!canEdit) {
      return;
    }

    setBusyType(card.type);
    setGlobalFeedback(null);

    const ticket = await requestDocumentUpload(
      applicationId,
      card.uploadFileType,
      file.name,
      card.type,
    );
    if (!ticket.ok) {
      setGlobalFeedback({
        type: "error",
        message: ticket.error,
      });
      setBusyType(null);
      return;
    }

    try {
      const response = await fetch(ticket.uploadUrl, {
        method: "PUT",
        body: file,
      });
      if (!response.ok) {
        setGlobalFeedback({
          type: "error",
          message: "Depolama alanına yükleme başarısız oldu. Lütfen tekrar deneyin.",
        });
        setBusyType(null);
        return;
      }
    } catch {
      setGlobalFeedback({
        type: "error",
        message: "Depolama hizmetine ulaşılamadı. Lütfen tekrar deneyin.",
      });
      setBusyType(null);
      return;
    }

    setUploadedFileNameByType((current) => ({
      ...current,
      [card.type]: file.name,
    }));
    setUploadedFileSizeByType((current) => ({
      ...current,
      [card.type]: file.size,
    }));

    const previousStatus = statusByType[card.type];
    if (previousStatus !== DocAssistantDocumentStatus.YUKLENDI) {
      setStatusByType((current) => ({
        ...current,
        [card.type]: DocAssistantDocumentStatus.YUKLENDI,
      }));

      const statusResult = await updateDocAssistantStatus(
        applicationId,
        card.type,
        DocAssistantDocumentStatus.YUKLENDI,
      );
      if (!statusResult.ok) {
        setStatusByType((current) => ({ ...current, [card.type]: previousStatus }));
        setGlobalFeedback({
          type: "error",
          message:
            statusResult.error ??
            "Dosya yüklendi ancak durum güncellenemedi. Lütfen durumu manuel güncelleyin.",
        });
        setBusyType(null);
        return;
      }
    }

    setGlobalFeedback({
      type: "success",
      message: "Dosya yüklendi ve kart durumu Yüklendi olarak güncellendi.",
    });
    setBusyType(null);
  }

  async function deliverFilesToCustomer() {
    if (!canEdit || isDelivering) {
      return;
    }

    setIsDelivering(true);
    setGlobalFeedback(null);

    const result = await deliverToCustomer(applicationId);
    if (!result.ok) {
      setGlobalFeedback({
        type: "error",
        message:
          result.error === DELIVERY_GATEKEEPER_ERROR_MESSAGE
            ? DELIVERY_GATEKEEPER_ERROR_MESSAGE
            : result.error ?? "Dosyalar danışana iletilemedi.",
      });
      setIsDelivering(false);
      return;
    }

    setGlobalFeedback({
      type: "success",
      message: "Dosyalar danışana iletildi.",
    });
    setIsDelivering(false);
    router.refresh();
  }

  return (
    <section className="space-y-4 rounded-lg border border-border/40 bg-card p-5 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-sm font-medium">Dosya Asistanı Yüklemeleri</h2>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Belge Türü Seçimi, durum yönetimi ve dosya operasyonları bu panelden
          yürütülür. Listelenen belge kartlarında durum güncellemesi
          yapıldığında danışana otomatik bilgilendirme gönderilir.
        </p>
      </div>

      {globalFeedback ? (
        <div
          className={cn(
            "rounded-md border px-3 py-2 text-xs",
            globalFeedback.type === "success"
              ? INTENT_CLASSES.success
              : INTENT_CLASSES.danger,
          )}
        >
          {globalFeedback.message}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {DOC_ASSISTANT_CARDS.map((card, index) => {
          const status = statusByType[card.type];
          const statusMeta = STATUS_OPTIONS.find((option) => option.value === status);
          const isCardSaving = busyType === card.type;
          const uploadedFileName = uploadedFileNameByType[card.type] ?? null;
          const uploadedFileSize = uploadedFileSizeByType[card.type] ?? null;

          return (
            <article
              key={card.type}
              className="rounded-lg border border-border/40 bg-background p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h3 className="text-sm font-medium tracking-tight">{`${index + 1}. ${card.title}`}</h3>
                </div>
                <Badge variant="outline" className="rounded-md text-[11px]">
                  {card.constraint}
                </Badge>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {card.desc}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md text-[11px]",
                    statusMeta ? INTENT_CLASSES[statusMeta.intent] : INTENT_CLASSES.neutral,
                  )}
                >
                  {STATUS_LABEL_TR[status]}
                </Badge>
                {isCardSaving ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    İşleniyor
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-col gap-2">
                <Select
                  value={status}
                  onValueChange={(value) => {
                    void persistStatus(card.type, value as DocAssistantDocumentStatus);
                  }}
                  disabled={!canEdit || isCardSaving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Durum seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-auto w-full rounded-md px-3 py-2 whitespace-normal text-center leading-tight"
                  disabled={!canEdit || isCardSaving}
                  onClick={() => inputRefs.current[card.type]?.click()}
                >
                  {isCardSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden />
                  )}
                  {card.btn}
                </Button>

                <input
                  ref={(node) => {
                    inputRefs.current[card.type] = node;
                  }}
                  type="file"
                  accept={FILE_ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    const selectedFile = event.currentTarget.files?.[0] ?? null;
                    event.currentTarget.value = "";
                    if (!selectedFile) {
                      return;
                    }
                    void uploadForCard(card, selectedFile);
                  }}
                />
              </div>

              <div className="mt-3 rounded-md border border-border/40 bg-muted/40 px-3 py-2">
                <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                  Yüklenen Dosya
                </p>
                {uploadedFileName ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-foreground">
                    <Paperclip className="h-3.5 w-3.5" aria-hidden />
                    <span className="font-medium">{uploadedFileName}</span>
                    {uploadedFileSize ? (
                      <span className="text-muted-foreground tabular-nums">
                        ({formatFileSize(uploadedFileSize)})
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Henüz dosya yüklenmedi.
                  </p>
                )}
              </div>

              {status === DocAssistantDocumentStatus.YUKLENDI ? (
                <p className="mt-3 inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  Kart durumu Yüklendi.
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="button"
          size="sm"
          className="rounded-md"
          disabled={!canEdit || isDelivering || busyType !== null}
          onClick={() => {
            void deliverFilesToCustomer();
          }}
        >
          {isDelivering ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          Dosyaları Danışana İlet
        </Button>
      </div>
    </section>
  );
}
