const FULL_APPOINTMENT_CITY_OPTIONS = [
  'Ankara',
  'İstanbul',
  'İzmir',
  'Bursa',
  'Gaziantep',
  'Antalya',
  'Edirne',
  'Bodrum',
  'Trabzon',
  'Adana',
];

const COUNTRY_MIN_DAYS: Record<string, number> = {
  Danimarka: 45,
  Hırvatistan: 15,
  Malta: 15,
  Almanya: 15,
  İtalya: 15,
  İngiltere: 21,
  Fransa: 15,
  Amerika: 0,
  Yunanistan: 15,
  Portekiz: 15,
  Romanya: 15,
  Norveç: 15,
  Kanada: 15,
  Dubai: 15,
  İsveç: 15,
  İspanya: 15,
  Hollanda: 15,
  Belçika: 15,
  Avusturya: 15,
  İsviçre: 15,
  Finlandiya: 15,
  Polonya: 15,
  Çekya: 15,
  Macaristan: 15,
  Slovakya: 15,
  Slovenya: 15,
  Litvanya: 15,
  Letonya: 15,
  Estonya: 15,
};

const RESTRICTED_CITY_RULES: Record<string, string[]> = {
  Danimarka: ['Ankara', 'İstanbul', 'İzmir', 'Antalya'],
  Malta: [
    'Ankara',
    'İstanbul',
    'İzmir',
    'Bursa',
    'Gaziantep',
    'Antalya',
    'Edirne',
    'Bodrum',
    'Trabzon',
  ],
};

export const COUNTRY_RULES: Record<string, { minDays: number; cities: string[] }> =
  Object.fromEntries(
    Object.entries(COUNTRY_MIN_DAYS).map(([country, minDays]) => [
      country,
      {
        minDays,
        cities: RESTRICTED_CITY_RULES[country] ?? FULL_APPOINTMENT_CITY_OPTIONS,
      },
    ]),
  );

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_RULES);
