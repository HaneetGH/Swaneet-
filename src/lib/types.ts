export type EventIcon = "moon" | "heart" | "sun" | "star" | "sparkles";

export type ManagedEvent = {
  id: string;
  name: string;
  date: string;
  day: string;
  time: string;
  venue: string;
  venueDetail: string;
  address: string;
  description: string;
  icon: EventIcon;
};

export type GalleryImage = {
  id: string;
  /** Managed event this photo/video belongs to */
  eventId: string;
  alt: string;
  src: string;
  aspect: "portrait" | "landscape" | "square";
  kind: "image" | "video";
  createdAt: string;
};

export type RsvpEntry = {
  id: string;
  name: string;
  guests: number;
  attendance: "yes" | "no" | "maybe";
  meal?: "vegetarian" | "non-vegetarian" | "no-preference";
  notes?: string;
  contactFamily?: string;
  /** Guest indicated they may need a stay */
  needsAccommodation?: boolean;
  createdAt: string;
};

export type AccommodationStatus = "pending" | "confirmed" | "declined";

export type AccommodationRequest = {
  id: string;
  name: string;
  phone: string;
  /** Contact email for confirmation messages */
  email: string;
  people: number;
  rooms: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
  contactFamily?: string;
  rsvpId?: string;
  /** Firebase Auth identity used to submit the request */
  authUid?: string;
  authEmail?: string;
  authPhone?: string;
  status: AccommodationStatus;
  /** What the family can provide */
  hotelName?: string;
  hotelAddress?: string;
  roomDetails?: string;
  adminNotes?: string;
  confirmedAt?: string;
  emailSentAt?: string;
  createdAt: string;
};

export type EmailOtpEntry = {
  hash: string;
  expiresAt: string;
};

export type ContentStore = {
  events: ManagedEvent[];
  gallery: GalleryImage[];
  rsvps: RsvpEntry[];
  accommodations: AccommodationRequest[];
  /** Pending email verification codes (hashed) */
  emailOtps?: Record<string, EmailOtpEntry>;
  /** scrypt hash in `salt:hash` form; falls back to ADMIN_PIN env when unset */
  adminPinHash?: string;
};
