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

/** Public surfaces: main wedding site + bride invite links */
export type FeatureSite = "main" | "mehfil" | "laavan";

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

export type RsvpDayResponse = {
  /** ISO-ish key from parseDisplayDate, e.g. 2026-08-09 */
  dateKey: string;
  /** Display date, e.g. 9th August 2026 */
  date: string;
  label?: string;
  attendance: "yes" | "no" | "maybe";
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
  /** Which invite page this RSVP belongs to */
  inviteSite?: FeatureSite;
  /** Bride invite path used (mehfil / laavan); omit for main site */
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
  /** One answer per celebration day on that invite */
  dayResponses?: RsvpDayResponse[];
  createdAt: string;
};

export type AccommodationStatus = "pending" | "confirmed" | "declined";

/** A hotel / stay option the family can assign rooms from */
export type StayHotel = {
  id: string;
  name: string;
  address?: string;
  totalRooms: number;
  notes?: string;
  createdAt: string;
};

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
  /** Which hotel inventory this assignment draws from */
  hotelId?: string;
  /** Rooms taken from the selected hotel when confirmed */
  roomsAssigned?: number;
  /** What the family can provide */
  hotelName?: string;
  hotelAddress?: string;
  roomDetails?: string;
  adminNotes?: string;
  confirmedAt?: string;
  emailSentAt?: string;
  createdAt: string;
  /** Bride invite path used; omit for main site */
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
  /** Which invite page this stay belongs to */
  inviteSite?: FeatureSite;
};

export type EmailOtpEntry = {
  hash: string;
  expiresAt: string;
};

export type FeatureKey =
  | "rsvp"
  | "accommodation"
  | "gallery"
  | "guest_photos"
  | "stay_banner";

export type SiteFeatureFlags = Record<FeatureKey, boolean>;

export type FeatureFlags = Record<FeatureSite, SiteFeatureFlags>;

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

/** Guests who signed in (stay / photo share / gallery / RSVP) */
export type GuestActivityAction =
  | "login"
  | "stay"
  | "photos"
  | "rsvp"
  | "gallery_view"
  | "gallery_download";

export type GuestActivityEntry = {
  action: GuestActivityAction;
  at: string;
  detail?: string;
};

export type GuestLoginStats = {
  galleryViews: number;
  galleryDownloads: number;
  lastGalleryViewAt?: string;
  lastGalleryDownloadAt?: string;
  lastLoginAt?: string;
  lastRsvpAt?: string;
  lastStayAt?: string;
  lastPhotoUploadAt?: string;
};

export type GuestLogin = {
  uid: string;
  email?: string;
  name?: string;
  phone?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: GuestActivityAction[];
  stats?: GuestLoginStats;
  /** Newest first, capped */
  activity?: GuestActivityEntry[];
  /** Last known invite path (from RSVP/stay/activity) */
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
};

/** Linked RSVP summary on a guest profile row */
export type GuestProfileRsvp = {
  id: string;
  name: string;
  guests: number;
  attendance: RsvpEntry["attendance"];
  createdAt: string;
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
  inviteSite?: FeatureSite;
};

export type GuestProfileStay = {
  id: string;
  name: string;
  status: AccommodationStatus;
  people: number;
  rooms: number;
  createdAt: string;
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
  inviteSite?: FeatureSite;
};

/** Dashboard view: login record + linked RSVP / stay / uploads */
export type GuestProfile = GuestLogin & {
  rsvp?: GuestProfileRsvp | null;
  /** All RSVPs from this Google account (one per invite site) */
  rsvps?: GuestProfileRsvp[];
  stay?: GuestProfileStay | null;
  stays?: GuestProfileStay[];
  photoUploads: number;
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
  /** Hotels / stays the family can assign rooms from */
  hotels?: StayHotel[];
  /** @deprecated Prefer hotels[].totalRooms — kept for older data */
  totalRooms?: number;
  /** Homepage RSVP / stay shortcut banner */
  rsvpBanner?: {
    imageUrl?: string;
  };
  /** Master-controlled feature toggles per site */
  featureFlags?: FeatureFlags;
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

export type HotelInventory = {
  id: string;
  name: string;
  address?: string;
  totalRooms: number;
  assigned: number;
  available: number;
  notes?: string;
};

export type RoomInventory = {
  total: number;
  assigned: number;
  available: number;
  hotels: HotelInventory[];
};
