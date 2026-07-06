-- CreateTable
CREATE TABLE "visa_application_details" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TEXT NOT NULL,
    "placeOfBirth" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "maritalStatus" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "passportNumber" TEXT NOT NULL,
    "passportIssueDate" TEXT NOT NULL,
    "passportExpiryDate" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "homeAddress" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "countryOfResidence" TEXT NOT NULL,
    "targetCountry" TEXT NOT NULL,
    "visaType" TEXT NOT NULL,
    "purposeOfTravel" TEXT NOT NULL,
    "intendedArrivalDate" TEXT NOT NULL,
    "intendedDepartureDate" TEXT NOT NULL,
    "durationOfStayDays" INTEGER NOT NULL,
    "occupation" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "monthlyIncome" TEXT NOT NULL,
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visa_application_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visa_application_details_applicationId_key" ON "visa_application_details"("applicationId");

-- AddForeignKey
ALTER TABLE "visa_application_details" ADD CONSTRAINT "visa_application_details_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "visa_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
