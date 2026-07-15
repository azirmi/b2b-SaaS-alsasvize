const MARKER_PREFIX = "[ALSA_NOTIFY:";

export interface AppointmentReminderMarker {
  applicationId: string;
  appointmentDate: string;
}

export function buildAppointmentReminderMarker(
  applicationId: string,
  appointmentDate: string,
): string {
  return `${MARKER_PREFIX}APPT4D:${applicationId}:${appointmentDate}]`;
}

export function parseAppointmentReminderMarker(
  content: string,
): AppointmentReminderMarker | null {
  const match = content.match(
    /^\[ALSA_NOTIFY:APPT4D:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})\]/i,
  );
  if (!match) {
    return null;
  }
  return {
    applicationId: match[1],
    appointmentDate: match[2],
  };
}

export function withNotificationMarker(marker: string, body: string): string {
  return `${marker}\n${body}`;
}

export function stripNotificationMarker(content: string): string {
  return content.replace(/^\[ALSA_NOTIFY:[^\]]+\]\s*/i, "").trim();
}
