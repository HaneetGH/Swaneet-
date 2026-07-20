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
  /** Marked complete on the public timeline */
  done?: boolean;
};

export type GalleryStatus = "approved" | "pending" | "rejected";

export type GalleryImage = {
  id: string;
  /** Managed event this photo/video belongs to */
  eventId: string;
  alt: string;
  src: string;
  aspect: "portrait" | "landscape" | "square";
  kind: "image" | "video";
  /** Admin uploads are approved; guest shares start pending */
  status: GalleryStatus;
  source?: "admin" | "guest";
  uploadedByUid?: string;
  uploadedByEmail?: string;
  uploadedByName?: string;
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
  email?: string;
  authUid?: string;
  authEmail?: string;
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

/** Dashboard permissions for team members (master always has all) */
export type AdminPermission =
  | "rsvp"
  | "stay"
  | "gallery_upload"
  | "gallery_review"
  | "events"
  | "guests"
  | "team";

export type AdminMember = {
  id: string;
  name: string;
  email?: string;
  pinHash: string;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: string;
};

/** Guests who signed in (stay / photo share) */
export type GuestLogin = {
  uid: string;
  email?: string;
  name?: string;
  phone?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: Array<"stay" | "photos" | "rsvp">;
};

export type EmailKind =
  | "otp"
  | "stay"
  | "team_invite"
  | "team_update"
  | "photo_reject"
  | "owner_alert";

export type EmailLogEntry = {
  id: string;
  kind: EmailKind;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
  createdAt: string;
};

export type ContentStore = {
  events: ManagedEvent[];
  gallery: GalleryImage[];
  rsvps: RsvpEntry[];
  accommodations: AccommodationRequest[];
  /** Pending email verification codes (hashed) */
  emailOtps?: Record<string, EmailOtpEntry>;
  /** Team admins created by master (not including master PIN) */
  admins?: AdminMember[];
  /** Firebase guests who used stay or photo share */
  guestLogins?: GuestLogin[];
  /** Outbound email attempts (newest first, capped) */
  emailLogs?: EmailLogEntry[];
  /** scrypt hash in `salt:hash` form; falls back to ADMIN_PIN env when unset */
  adminPinHash?: string;
};
