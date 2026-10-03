/** Event types. Mirror backend/src/modules/events/events.ts. */

export const EVENT_TYPES = ["festival", "exhibition", "workshop", "gathering", "competition"] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "COMPLETED";
export type RegistrationStatus = "CONFIRMED" | "WAITLISTED" | "CANCELLED";

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  festival: "Festival",
  exhibition: "Exhibition",
  workshop: "Workshop",
  gathering: "Gathering",
  competition: "Competition",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = { DRAFT: "Draft", PUBLISHED: "Published", CANCELLED: "Cancelled", COMPLETED: "Completed" };

export interface EventCard {
  id: string;
  slug: string;
  name: string;
  type: EventType;
  city: string;
  venue: string;
  startsAt: string;
  endsAt: string | null;
  organizerName: string;
  fee: number;
  capacity: number | null;
  registrationRequired: boolean;
  registrationClosesAt: string | null;
  bannerUrl: string | null;
  status: EventStatus;
  attending: number;
  registrationOpen?: boolean;
}

export interface EventDetail extends EventCard {
  description: string;
  venueAddress: string | null;
  organizerContact: string | null;
  rules: string | null;
  safetyNotes: string;
  maxGuests: number;
  cancelReason: string | null;
  waitlisted: number;
  registrationOpen: boolean;
  myRegistration: { status: RegistrationStatus; guests: number } | null;
  tournament: { slug: string; name: string } | null;
}

export interface AdminEvent extends Omit<EventDetail, "myRegistration" | "tournament" | "waitlisted" | "registrationOpen"> {
  tournamentSlug: string | null;
  registrations: { id: string; status: RegistrationStatus; guests: number; createdAt: string; user: { fullName: string; email: string | null; phone: string | null } }[];
}
