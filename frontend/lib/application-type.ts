import { ApplicationType } from "@/lib/enums";

export const APPLICATION_TYPE_LABEL: Record<ApplicationType, string> = {
  TOURISTIC: "Turistik Vize",
  COMMERCIAL: "Ticari Vize",
  FAMILY_VISIT: "Aile / Arkadas Ziyareti",
  EDUCATION: "Egitim",
  OTHER: "Diger",
};

export const APPLICATION_TYPE_OPTIONS: Array<{
  value: ApplicationType;
  label: string;
  description: string;
}> = [
  {
    value: ApplicationType.TOURISTIC,
    label: APPLICATION_TYPE_LABEL[ApplicationType.TOURISTIC],
    description: "Turistik gezi ve kisa sureli ziyaret basvurulari.",
  },
  {
    value: ApplicationType.COMMERCIAL,
    label: APPLICATION_TYPE_LABEL[ApplicationType.COMMERCIAL],
    description: "Is gorusmesi, fuar ve ticari seyahat basvurulari.",
  },
  {
    value: ApplicationType.FAMILY_VISIT,
    label: APPLICATION_TYPE_LABEL[ApplicationType.FAMILY_VISIT],
    description: "Aile, akraba veya arkadas ziyareti amacli basvurular.",
  },
  {
    value: ApplicationType.EDUCATION,
    label: APPLICATION_TYPE_LABEL[ApplicationType.EDUCATION],
    description: "Dil okulu, egitim ve kurs odakli basvurular.",
  },
  {
    value: ApplicationType.OTHER,
    label: APPLICATION_TYPE_LABEL[ApplicationType.OTHER],
    description: "Yukaridaki kategorilere girmeyen diger talepler.",
  },
];
