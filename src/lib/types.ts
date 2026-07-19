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

export type AccommodationRequest = {
  id: string;
  name: string;
  phone: string;
  people: number;
  rooms: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
  contactFamily?: string;
  rsvpId?: string;
  createdAt: string;
};

export type ContentStore = {
  events: ManagedEvent[];
  gallery: GalleryImage[];
  rsvps: RsvpEntry[];
  accommodations: AccommodationRequest[];
  /** scrypt hash in `salt:hash` form; falls back to ADMIN_PIN env when unset */
  adminPinHash?: string;
};
