"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type ApplicantStatus = "Tamamlandı" | "Bekliyor";

export interface PersonBasedUploadApplicant {
  id: string;
  name: string;
  status: ApplicantStatus;
}

export function PersonBasedUploadSection({
  title,
  description,
  applicants,
  renderContent,
}: {
  title: string;
  description: string;
  applicants: PersonBasedUploadApplicant[];
  renderContent?: (params: {
    activeApplicant: PersonBasedUploadApplicant;
    activeIndex: number;
  }) => ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(0);

  const safeActiveIndex =
    applicants.length === 0 ? 0 : Math.min(activeTab, applicants.length - 1);
  const activeApplicant = applicants[safeActiveIndex] ?? null;

  const completedCount = useMemo(
    () => applicants.filter((item) => item.status === "Tamamlandı").length,
    [applicants],
  );

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{description}</p>
        </div>
        <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-600">
          {completedCount}/{applicants.length} Tamamlandı
        </span>
      </div>

      <div className="mt-4">
        <div className="bg-[#f9f8f4] border border-[#f0ead6] p-1 rounded-lg">
          <div className="flex gap-1 overflow-x-auto whitespace-nowrap">
            {applicants.map((applicant, index) => {
              const isActive = index === safeActiveIndex;
              return (
                <button
                  key={applicant.id}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={cn(
                    "shrink-0 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "border-gray-200 bg-white text-gray-800 shadow-sm"
                      : "border-transparent text-gray-500 hover:bg-white/70 hover:text-gray-700",
                  )}
                >
                  {index + 1}. Kişi
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {activeApplicant ? (
        <div className="mt-4 border border-gray-200 rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {safeActiveIndex + 1}. Kişi Formu
              </p>
              <p className="text-xs font-medium tracking-wide text-gray-500 uppercase">
                {activeApplicant.name}
              </p>
            </div>

            <span
              className={cn(
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                activeApplicant.status === "Tamamlandı"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-orange-200 bg-orange-50 text-orange-600",
              )}
            >
              {activeApplicant.status}
            </span>
          </div>

          <hr className="border-gray-200 mb-5 mt-4" />

          {renderContent ? (
            renderContent({
              activeApplicant,
              activeIndex: safeActiveIndex,
            })
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">Danışan henüz evrak göndermedi.</p>
              <button
                type="button"
                className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Dosya Yükle
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
          Bu başvuruda görüntülenecek kişi bulunamadı.
        </div>
      )}
    </section>
  );
}
