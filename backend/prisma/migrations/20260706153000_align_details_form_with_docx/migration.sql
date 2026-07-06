-- Extend and reshape visa_application_details to match BAŞVURU FORMU.docx
ALTER TABLE "visa_application_details"
ADD COLUMN "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "maidenSurname" TEXT,
ADD COLUMN "registeredAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN "employmentStatus" TEXT NOT NULL DEFAULT '',
ADD COLUMN "employerAddress" TEXT,
ADD COLUMN "employerPhone" TEXT,
ADD COLUMN "educationInstitution" TEXT,
ADD COLUMN "educationLevel" TEXT,
ADD COLUMN "passportType" TEXT NOT NULL DEFAULT '',
ADD COLUMN "passportIssuePlace" TEXT NOT NULL DEFAULT '',
ADD COLUMN "appointmentLocation" TEXT NOT NULL DEFAULT '',
ADD COLUMN "fingerprintGiven" TEXT NOT NULL DEFAULT '',
ADD COLUMN "fingerprintDate" TEXT,
ADD COLUMN "schengenAppliedBefore" TEXT NOT NULL DEFAULT '',
ADD COLUMN "previousSchengenCountries" TEXT,
ADD COLUMN "plannedTravelDates" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sponsorFullName" TEXT,
ADD COLUMN "sponsorIdentity" TEXT,
ADD COLUMN "sponsorContact" TEXT,
ADD COLUMN "sponsorRelation" TEXT;

-- Best-effort backfill for existing rows.
UPDATE "visa_application_details"
SET
  "firstName" = COALESCE(NULLIF(split_part("fullName", ' ', 1), ''), 'Belirtilmedi'),
  "lastName" = COALESCE(
    NULLIF(trim(substr("fullName", length(split_part("fullName", ' ', 1)) + 1)), ''),
    COALESCE(NULLIF(split_part("fullName", ' ', 1), ''), 'Belirtilmedi')
  ),
  "registeredAddress" = COALESCE(NULLIF("homeAddress", ''), ''),
  "employmentStatus" = 'Çalışan',
  "passportType" = 'Umuma Mahsus (Bordo)',
  "passportIssuePlace" = COALESCE(NULLIF("placeOfBirth", ''), 'Belirtilmedi'),
  "appointmentLocation" = COALESCE(NULLIF("city", ''), 'Belirtilmedi'),
  "fingerprintGiven" = 'Hayır',
  "schengenAppliedBefore" = 'Hayır',
  "plannedTravelDates" =
    COALESCE(NULLIF("intendedArrivalDate", ''), 'Belirtilmedi')
    || ' - ' ||
    COALESCE(NULLIF("intendedDepartureDate", ''), 'Belirtilmedi');

ALTER TABLE "visa_application_details"
ALTER COLUMN "employerName" DROP NOT NULL;

ALTER TABLE "visa_application_details"
DROP COLUMN "fullName",
DROP COLUMN "homeAddress",
DROP COLUMN "city",
DROP COLUMN "countryOfResidence",
DROP COLUMN "targetCountry",
DROP COLUMN "visaType",
DROP COLUMN "intendedArrivalDate",
DROP COLUMN "intendedDepartureDate",
DROP COLUMN "durationOfStayDays",
DROP COLUMN "monthlyIncome",
DROP COLUMN "emergencyContactName",
DROP COLUMN "emergencyContactPhone";
