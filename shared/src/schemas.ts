import { z } from "zod";

// ---------- Enums ----------
export const ITEM_TYPES = ["flight", "lodging", "transfer", "restaurant", "activity", "meetup", "note"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const ItemTypeSchema = z.enum(ITEM_TYPES);

export const ITEM_STATUSES = ["planned", "booked", "confirmed", "cancelled"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];
export const ItemStatusSchema = z.enum(ITEM_STATUSES);

export const TRANSFER_MODES = ["taxi", "rideshare", "train", "bus", "ferry", "car_hire", "shuttle", "metro", "walk", "bike", "other"] as const;
export type TransferMode = (typeof TRANSFER_MODES)[number];

export const MEMBER_ROLES = ["owner", "editor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

// ---------- Primitives ----------
export const LocationSchema = z.object({
  name: z.string().min(1).describe("Human name of the place, e.g. 'Park Hyatt Tokyo' or 'Heathrow T5'"),
  address: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});
export type Location = z.infer<typeof LocationSchema>;

const isoDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/, "Must be ISO-8601 with offset, e.g. 2026-03-14T09:30:00+09:00")
  .describe("ISO-8601 datetime WITH a UTC offset. Use the local time at the place the event happens, e.g. 2026-03-14T09:30:00+09:00");

const ianaTz = z.string().min(1).describe("IANA timezone of the event's local time, e.g. Asia/Tokyo");

// ---------- Per-type details ----------
export const FlightEndpointSchema = z.object({
  iata: z.string().length(3).transform((s) => s.toUpperCase()).describe("3-letter IATA airport code"),
  name: z.string().optional(),
  city: z.string().optional(),
  terminal: z.string().optional(),
  gate: z.string().optional(),
  tz: z.string().optional(),
});

export const FlightDetailsSchema = z.object({
  airline: z.string().optional().describe("Airline name, e.g. 'British Airways'"),
  airlineCode: z.string().optional().describe("IATA airline code, e.g. 'BA'"),
  flightNumber: z.string().optional().describe("e.g. 'BA5' (letters and digits, no space)"),
  from: FlightEndpointSchema,
  to: FlightEndpointSchema,
  seat: z.string().optional(),
  cabin: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
  aircraft: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  operatedBy: z.string().optional(),
  frequentFlyer: z.string().optional(),
});

export const LodgingDetailsSchema = z.object({
  provider: z.string().optional().describe("e.g. 'Booking.com', 'Airbnb', 'Direct'"),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional().describe("Local HH:MM"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  room: z.string().optional(),
  guests: z.number().int().positive().optional(),
  phone: z.string().optional(),
  breakfastIncluded: z.boolean().optional(),
});

export const TransferDetailsSchema = z.object({
  mode: z.enum(TRANSFER_MODES),
  provider: z.string().optional().describe("e.g. 'Uber', 'JR Central', 'Hertz'"),
  vehicle: z.string().optional(),
  pickupNotes: z.string().optional(),
  driverPhone: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  seat: z.string().optional(),
  carriage: z.string().optional(),
});

export const RestaurantDetailsSchema = z.object({
  cuisine: z.string().optional(),
  partySize: z.number().int().positive().optional(),
  platform: z.string().optional().describe("e.g. 'OpenTable', 'Resy', 'Tabelog', 'Phone'"),
  phone: z.string().optional(),
  dressCode: z.string().optional(),
  prepaid: z.boolean().optional(),
});

export const ActivityDetailsSchema = z.object({
  provider: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  ticketType: z.string().optional(),
  participants: z.number().int().positive().optional(),
});

export const MeetupDetailsSchema = z.object({
  expected: z.array(z.string()).optional().describe("Names of people expected to attend"),
  instructions: z.string().optional().describe("How to find each other, e.g. 'under the big clock'"),
  radiusM: z.number().int().positive().optional().describe("Arrival radius in metres for the live map ring"),
});

export const NoteDetailsSchema = z.object({}).passthrough();

export const DETAILS_BY_TYPE = {
  flight: FlightDetailsSchema,
  lodging: LodgingDetailsSchema,
  transfer: TransferDetailsSchema,
  restaurant: RestaurantDetailsSchema,
  activity: ActivityDetailsSchema,
  meetup: MeetupDetailsSchema,
  note: NoteDetailsSchema,
} as const;

export type FlightDetails = z.infer<typeof FlightDetailsSchema>;
export type LodgingDetails = z.infer<typeof LodgingDetailsSchema>;
export type TransferDetails = z.infer<typeof TransferDetailsSchema>;
export type RestaurantDetails = z.infer<typeof RestaurantDetailsSchema>;
export type ActivityDetails = z.infer<typeof ActivityDetailsSchema>;
export type MeetupDetails = z.infer<typeof MeetupDetailsSchema>;

// ---------- Items ----------
const itemBase = {
  type: ItemTypeSchema,
  title: z.string().max(200).optional().describe("Short display title, e.g. the property or venue name. Optional for flights (derived from airline code + number + route)"),
  status: ItemStatusSchema.default("planned"),
  startAt: isoDateTime,
  endAt: isoDateTime.optional().describe("Arrival / check-out / end time. Required for flights and lodging"),
  tz: ianaTz.optional().describe("Timezone for startAt. Flights infer from the departure airport if omitted"),
  endTz: ianaTz.optional().describe("Timezone for endAt (flights infer from arrival airport)"),
  costAmount: z.number().nonnegative().optional(),
  costCurrency: z.string().length(3).optional().describe("ISO 4217, e.g. GBP"),
  confirmationCode: z.string().max(64).optional(),
  url: z.string().url().optional(),
  notes: z.string().max(5000).optional(),
  tags: z.array(z.string()).optional(),
  location: LocationSchema.optional().describe("Where it happens (or departs from). Flights derive this from airports if omitted"),
  endLocation: LocationSchema.optional().describe("Where it ends (transfer drop-off, flight arrival)"),
  details: z.record(z.any()).optional().describe("Type-specific fields; see the per-type schema"),
};

export const ItemCreateSchema = z.object(itemBase).superRefine((val, ctx) => {
  const schema = DETAILS_BY_TYPE[val.type];
  const needsDetails = val.type === "flight" || val.type === "transfer";
  if (val.type !== "flight" && !val.title?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "title is required" });
  if (val.details === undefined) {
    if (needsDetails) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["details"], message: `${val.type} items require details` });
    return;
  }
  const r = schema.safeParse(val.details);
  if (!r.success) for (const i of r.error.issues) ctx.addIssue({ ...i, path: ["details", ...i.path] });
  if (val.endAt && new Date(val.endAt) < new Date(val.startAt)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endAt"], message: "endAt must be after startAt" });
});
export type ItemCreate = z.infer<typeof ItemCreateSchema>;

export const ItemUpdateSchema = z.object(itemBase).partial().extend({
  sortOrder: z.number().optional(),
});
export type ItemUpdate = z.infer<typeof ItemUpdateSchema>;

export const ActorSchema = z.object({
  kind: z.enum(["user", "agent", "share", "system"]),
  id: z.string().nullable(),
  label: z.string(),
});
export type Actor = z.infer<typeof ActorSchema>;

export const ItemSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  type: ItemTypeSchema,
  title: z.string(),
  status: ItemStatusSchema,
  startAt: z.string(),
  endAt: z.string().nullable(),
  tz: z.string(),
  endTz: z.string().nullable(),
  costAmount: z.number().nullable(),
  costCurrency: z.string().nullable(),
  confirmationCode: z.string().nullable(),
  url: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
  location: LocationSchema.nullable(),
  endLocation: LocationSchema.nullable(),
  details: z.record(z.any()),
  sortOrder: z.number(),
  createdBy: ActorSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Item = z.infer<typeof ItemSchema>;

// ---------- Trips ----------
export const TripCreateSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  emoji: z.string().max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  homeCurrency: z.string().length(3).optional(),
  homeTz: z.string().optional().describe("Traveller's home IANA timezone, used for 'what time is it at home'"),
});
export type TripCreate = z.infer<typeof TripCreateSchema>;
export const TripUpdateSchema = TripCreateSchema.partial();

export const MemberSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(MEMBER_ROLES),
  color: z.string(),
});
export type Member = z.infer<typeof MemberSchema>;

export const TripSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  emoji: z.string(),
  color: z.string(),
  homeCurrency: z.string(),
  homeTz: z.string(),
  ownerId: z.string(),
  myRole: z.enum(MEMBER_ROLES).nullable(),
  itemCount: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Trip = z.infer<typeof TripSchema>;

export const TripDetailSchema = TripSchema.extend({
  items: z.array(ItemSchema),
  members: z.array(MemberSchema),
});
export type TripDetail = z.infer<typeof TripDetailSchema>;

// ---------- Sharing ----------
export const ShareLinkCreateSchema = z.object({
  showConfirmations: z.boolean().default(false),
  showCosts: z.boolean().default(false),
  expiresAt: z.string().optional(),
  label: z.string().max(80).optional(),
});
export const ShareLinkSchema = z.object({
  id: z.string(),
  tripId: z.string(),
  token: z.string(),
  label: z.string().nullable(),
  showConfirmations: z.boolean(),
  showCosts: z.boolean(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
});
export type ShareLink = z.infer<typeof ShareLinkSchema>;

export const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]).default("editor"),
});

// ---------- Live ----------
export const LocationPingSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional(),
  heading: z.number().nullable().optional(),
  speed: z.number().nullable().optional(),
  label: z.string().max(80).optional().describe("Free text status, e.g. 'at the hotel'"),
});
export const TravelerLocationSchema = z.object({
  tripId: z.string(),
  userId: z.string(),
  name: z.string(),
  color: z.string(),
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().nullable(),
  heading: z.number().nullable(),
  speed: z.number().nullable(),
  label: z.string().nullable(),
  recordedAt: z.string(),
});
export type TravelerLocation = z.infer<typeof TravelerLocationSchema>;

export const ActivitySchema = z.object({
  id: z.string(),
  tripId: z.string(),
  actor: ActorSchema,
  action: z.enum(["create", "update", "delete", "join", "share", "location"]),
  entity: z.string(),
  entityId: z.string().nullable(),
  summary: z.string(),
  diff: z.record(z.any()).nullable(),
  createdAt: z.string(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const AirportSchema = z.object({
  iata: z.string(),
  icao: z.string(),
  name: z.string(),
  city: z.string(),
  country: z.string(),
  lat: z.number(),
  lng: z.number(),
  tz: z.string(),
});
export type Airport = z.infer<typeof AirportSchema>;

export const GeocodeResultSchema = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  kind: z.string().optional(),
});
export type GeocodeResult = z.infer<typeof GeocodeResultSchema>;

// WebSocket events
export type WsEvent =
  | { type: "item.created" | "item.updated" | "item.deleted"; tripId: string; itemId: string; actor: Actor }
  | { type: "trip.updated"; tripId: string }
  | { type: "traveler.location"; tripId: string; location: TravelerLocation }
  | { type: "presence"; tripId: string; users: { userId: string; name: string; color: string }[] }
  | { type: "hello"; tripId: string };
