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
  /**
   * Rooms held back from the free pool (still in total inventory).
   * Can be drawn from at approval time with “use blocked rooms”.
   */
  blockedRooms?: number;
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
  /** Original dates the guest asked for (snapshot; admin may revise checkIn/Out) */
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  /**
   * When admin offers fewer nights than requested:
   * pending = waiting for guest accept, accepted = guest OK, declined = guest said no
   */
  offerStatus?: "none" | "pending" | "accepted" | "declined";
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
  /**
   * Shared-room group. All members keep their own stay request (never deleted).
   * Only the primary counts roomsAssigned toward inventory.
   */
  roomGroupId?: string;
  roomGroupRole?: "primary" | "member";
  /** Display names of people sharing this room */
  roomShareWith?: string[];
};

/** One assigned room unit for the occupancy board */
export type RoomOccupancyUnit = {
  key: string;
  hotelId: string;
  hotelName: string;
  roomDetails?: string;
  roomsHeld: number;
  people: number;
  roomGroupId?: string;
  stays: Array<{
    id: string;
    name: string;
    people: number;
    role?: "primary" | "member" | "solo";
    email?: string;
    phone?: string;
  }>;
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
  | "stay_banner"
  | "face_find"
  | "guest_messages";

export type SiteFeatureFlags = Record<FeatureKey, boolean>;

export type FeatureFlags = Record<FeatureSite, SiteFeatureFlags>;

/** Dashboard permissions for team members (master always has all) */
export type AdminPermission =
  | "rsvp"
  | "stay"
  | "gallery_upload"
  | "gallery_review"
  | "faces"
  | "events"
  | "guests"
  | "messages"
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
  | "gallery_download"
  | "query"
  | "message";

export type GuestActivityEntry = {
  action: GuestActivityAction;
  at: string;
  detail?: string;
};

export type GuestMessageStatus = "pending" | "approved" | "rejected";

/** Public guestbook wish / quote for the couple */
export type GuestMessage = {
  id: string;
  body: string;
  displayName: string;
  authUid: string;
  authEmail?: string;
  status: GuestMessageStatus;
  /** guest = person-written; sample = seeded social-proof wish stored in DB */
  source?: "guest" | "sample";
  inviteSite?: FeatureSite;
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
  createdAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
};

/** Gallery items a guest downloaded (newest first) */
export type GuestDownloadedMedia = {
  imageId: string;
  at: string;
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
  /** Distinct gallery downloads with timestamps */
  downloadedMedia?: GuestDownloadedMedia[];
  /** Last known invite path (from RSVP/stay/activity) */
  inviteSide?: "bride" | "groom";
  inviteTier?: "mehfil" | "laavan";
  inviteSlug?: string;
};

/** Guest selfie + matched gallery photos (face find) */
export type GuestFaceProfile = {
  uid: string;
  email?: string;
  name?: string;
  /** Blob / public URL of enrolled selfie */
  selfieSrc: string;
  status: "ready" | "matching" | "failed" | "needs_selfie";
  error?: string;
  /** Approved gallery image ids matched to this guest */
  matchedImageIds: string[];
  matchCount: number;
  enrolledAt: string;
  lastMatchedAt?: string;
  updatedAt: string;
};

/** Per-gallery-image Rekognition index state */
export type GalleryFaceIndexEntry = {
  imageId: string;
  status: "indexed" | "failed" | "skipped";
  faceCount: number;
  error?: string;
  indexedAt: string;
};

/** Normalized 0–1 box from Rekognition */
export type FaceBoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** One detected face in a gallery photo */
export type FaceDetection = {
  faceId: string;
  imageId: string;
  boundingBox: FaceBoundingBox;
  personId: string;
  createdAt: string;
};

/** Clustered person (named or unnamed) across many photos */
export type FacePerson = {
  id: string;
  /** Empty string = unnamed — set from dashboard */
  name: string;
  representativeFaceId: string;
  faceIds: string[];
  imageIds: string[];
  /** Set when an admin merged faces — prefer this cluster for future matches */
  userConfirmed?: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Snapshot so an accidental merge can be undone */
export type FaceMergeLog = {
  id: string;
  targetId: string;
  sourceSnapshot: FacePerson;
  movedFaceIds: string[];
  movedImageIds: string[];
  createdAt: string;
};

/** Guest asked for photos before matches existed — email when ready */
export type FacePhotoRequest = {
  id: string;
  uid: string;
  email: string;
  name?: string;
  selfieSrc: string;
  status: "pending" | "ready" | "emailed" | "failed";
  matchedImageIds?: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  emailedAt?: string;
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
  /** Resolved gallery items this guest downloaded */
  downloadedImages?: Array<{
    id: string;
    src: string;
    alt: string;
    kind: GalleryImage["kind"];
    at: string;
  }>;
  /** Photos this guest uploaded (newest first) */
  uploadedImages?: Array<{
    id: string;
    src: string;
    alt: string;
    kind: GalleryImage["kind"];
    status: GalleryStatus;
    createdAt: string;
    eventName?: string;
  }>;
};

export type EmailKind =
  | "otp"
  | "stay"
  | "stay_offer"
  | "team_invite"
  | "team_update"
  | "photo_reject"
  | "wish_received"
  | "wish_live"
  | "wish_note"
  | "owner_alert"
  | "face_photos";

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
  /** Face-find guest selfies + matches (local fallback; Neon uses face_profiles table) */
  faceProfiles?: GuestFaceProfile[];
  /** Face-find gallery index status (local fallback; Neon uses face_image_index) */
  faceImageIndex?: GalleryFaceIndexEntry[];
  /** Clustered people for dashboard Faces tab */
  facePeople?: FacePerson[];
  /** Individual face detections linked to people */
  faceDetections?: FaceDetection[];
  /** Recent face merges for undo */
  faceMergeLogs?: FaceMergeLog[];
  /** Guest “email me when ready” photo requests */
  facePhotoRequests?: FacePhotoRequest[];
  /** Guest wishes / quotes for the couple (local fallback; Neon uses guest_messages) */
  guestMessages?: GuestMessage[];
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
  /** Held back from free — still part of totalRooms */
  blocked: number;
  available: number;
  notes?: string;
};

export type RoomInventory = {
  total: number;
  assigned: number;
  blocked: number;
  available: number;
  hotels: HotelInventory[];
};
