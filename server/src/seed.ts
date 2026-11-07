// Seed a demo user, an agent key and a sample trip. Safe to re-run (skips if the demo user exists).
import { createApiKey, createUser, findUserByEmail, principalForUser, principalForAgent } from "./auth.js";
import { createTrip, invite } from "./services/trips.js";
import { createItem } from "./services/items.js";
import { pingLocation } from "./services/locations.js";
import { ItemCreateSchema } from "@tmt/shared";
import type { z } from "zod";

const DEMO_EMAIL = process.env.SEED_EMAIL ?? "mike@example.com";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "tripface123";

if (findUserByEmail(DEMO_EMAIL)) { console.log(`Demo user ${DEMO_EMAIL} already exists — nothing to do.`); process.exit(0); }

const mike = await createUser(DEMO_EMAIL, "Mike", DEMO_PASSWORD);
const sam = await createUser("sam@example.com", "Sam", DEMO_PASSWORD);
const user = principalForUser(mike);
const { key } = createApiKey(mike.id, "Claude");
const agent = principalForAgent(mike, "Claude");

const trip = createTrip(mike, user.actor, { name: "Japan in spring", description: "Two weeks of cherry blossom, ramen and bullet trains. Sam joins in Kyoto.", startDate: "2027-03-28", endDate: "2027-04-10", emoji: "🌸", color: "#f43f5e", homeCurrency: "GBP", homeTz: "Europe/London" });
invite(mike, user.actor, trip.id, "sam@example.com", "editor");

const add = (i: z.input<typeof ItemCreateSchema>, who = user) => createItem(who.user, who.actor, trip.id, ItemCreateSchema.parse(i));

add({ type: "flight", title: "", status: "confirmed", startAt: "2027-03-28T11:45:00+00:00", endAt: "2027-03-29T08:05:00+09:00", confirmationCode: "XK7P2Q", costAmount: 842, costCurrency: "GBP",
  details: { airline: "British Airways", airlineCode: "BA", flightNumber: "BA5", from: { iata: "LHR", terminal: "5" }, to: { iata: "HND", terminal: "3" }, seat: "34K", cabin: "premium_economy", aircraft: "Boeing 787-9", durationMin: 860 }, notes: "Online check-in opens 24h before. Window seat requested." });
add({ type: "transfer", title: "Limousine bus to Shinjuku", status: "planned", startAt: "2027-03-29T09:30:00+09:00", endAt: "2027-03-29T10:45:00+09:00", costAmount: 1400, costCurrency: "JPY",
  location: { name: "Haneda T3 bus stop 5", lat: 35.5494, lng: 139.7798 }, endLocation: { name: "Shinjuku Expressway Bus Terminal (Busta)", lat: 35.6896, lng: 139.7006 }, details: { mode: "bus", provider: "Airport Limousine", durationMin: 75 } });
add({ type: "lodging", title: "Park Hyatt Tokyo", status: "confirmed", startAt: "2027-03-29T15:00:00+09:00", endAt: "2027-04-02T12:00:00+09:00", tz: "Asia/Tokyo", confirmationCode: "PH-88213", costAmount: 1860, costCurrency: "GBP", url: "https://www.hyatt.com/park-hyatt/tyoph-park-hyatt-tokyo",
  location: { name: "Park Hyatt Tokyo", address: "3-7-1-2 Nishi-Shinjuku, Shinjuku City, Tokyo", lat: 35.6857, lng: 139.6906 }, details: { provider: "Direct", checkInTime: "15:00", checkOutTime: "12:00", room: "Park Deluxe King, high floor", guests: 1, phone: "+81 3-5322-1234", breakfastIncluded: true } });
add({ type: "restaurant", title: "Fuunji", status: "planned", startAt: "2027-03-29T19:00:00+09:00", tz: "Asia/Tokyo", costAmount: 1200, costCurrency: "JPY",
  location: { name: "Fuunji", address: "2-14-3 Yoyogi, Shibuya City, Tokyo", lat: 35.6835, lng: 139.6986 }, details: { cuisine: "Tsukemen", partySize: 1, platform: "Walk-in" }, notes: "Expect a 30–40 min queue. Cash only, ticket machine." }, agent);
add({ type: "activity", title: "Meiji Jingu + Yoyogi Park sakura", status: "planned", startAt: "2027-03-30T09:00:00+09:00", endAt: "2027-03-30T12:00:00+09:00", tz: "Asia/Tokyo",
  location: { name: "Meiji Jingu", address: "1-1 Yoyogikamizonocho, Shibuya City, Tokyo", lat: 35.6764, lng: 139.6993 }, details: { durationMin: 180 } }, agent);
add({ type: "restaurant", title: "Sushi Saito", status: "confirmed", startAt: "2027-03-30T18:30:00+09:00", tz: "Asia/Tokyo", confirmationCode: "via concierge", costAmount: 45000, costCurrency: "JPY",
  location: { name: "Sushi Saito", address: "1F Ark Hills South Tower, 1-4-5 Roppongi, Minato City", lat: 35.6660, lng: 139.7409 }, details: { cuisine: "Sushi omakase", partySize: 1, platform: "Hotel concierge", dressCode: "Smart casual" } });
add({ type: "activity", title: "teamLab Planets", status: "booked", startAt: "2027-03-31T10:00:00+09:00", endAt: "2027-03-31T12:00:00+09:00", tz: "Asia/Tokyo", confirmationCode: "TLP-449021", costAmount: 3800, costCurrency: "JPY", url: "https://www.teamlab.art/e/planets/",
  location: { name: "teamLab Planets TOKYO", address: "6-1-16 Toyosu, Koto City, Tokyo", lat: 35.6493, lng: 139.7899 }, details: { provider: "teamLab", ticketType: "Adult, timed entry 10:00" } });
add({ type: "note", title: "Pick up Suica + pocket wifi", startAt: "2027-03-29T09:00:00+09:00", tz: "Asia/Tokyo", notes: "Welcome Suica from the JR East counter at Haneda T3 arrivals. Pocket wifi reserved under Smith at the Ninja WiFi counter." });
add({ type: "transfer", title: "Nozomi 215 to Kyoto", status: "booked", startAt: "2027-04-02T13:12:00+09:00", endAt: "2027-04-02T15:27:00+09:00", confirmationCode: "SmartEX 7Z2K", costAmount: 14170, costCurrency: "JPY",
  location: { name: "Tokyo Station", address: "1 Chome Marunouchi, Chiyoda City, Tokyo", lat: 35.6812, lng: 139.7671 }, endLocation: { name: "Kyoto Station", address: "Higashishiokoji Kamadonocho, Shimogyo Ward, Kyoto", lat: 34.9858, lng: 135.7588 }, details: { mode: "train", provider: "JR Central", vehicle: "N700S Shinkansen", carriage: "7", seat: "12E", durationMin: 135 }, notes: "Mt Fuji on the right side (E seats) about 40 min out of Tokyo." });
add({ type: "lodging", title: "Hoshinoya Kyoto", status: "confirmed", startAt: "2027-04-02T15:00:00+09:00", endAt: "2027-04-06T12:00:00+09:00", tz: "Asia/Tokyo", confirmationCode: "HSK-20226", costAmount: 2400, costCurrency: "GBP",
  location: { name: "Hoshinoya Kyoto", address: "11-2 Arashiyama Genrokuzancho, Nishikyo Ward, Kyoto", lat: 35.0154, lng: 135.6734 }, details: { provider: "Direct", checkInTime: "15:00", checkOutTime: "12:00", room: "Riverside Yamanoha", guests: 2, breakfastIncluded: true }, notes: "Boat pickup from the Togetsukyo pier." });
add({ type: "flight", title: "", status: "confirmed", startAt: "2027-04-02T09:15:00+00:00", endAt: "2027-04-03T06:50:00+09:00", confirmationCode: "N4QD8R", costAmount: 910, costCurrency: "GBP",
  details: { airline: "Japan Airlines", airlineCode: "JL", flightNumber: "JL42", from: { iata: "LHR", terminal: "3" }, to: { iata: "HND", terminal: "3" }, seat: "22A", cabin: "economy" }, notes: "Sam's flight." }, principalForUser(sam));
add({ type: "meetup", title: "Meet Sam at Kyoto Station", status: "planned", startAt: "2027-04-03T11:30:00+09:00", tz: "Asia/Tokyo",
  location: { name: "Kyoto Station, central gate (by the big staircase)", lat: 34.9858, lng: 135.7588 }, details: { expected: ["Mike", "Sam"], instructions: "Under the giant staircase on the north side. Mike will have coffee.", radiusM: 150 } });
add({ type: "activity", title: "Fushimi Inari at dawn", status: "planned", startAt: "2027-04-04T06:00:00+09:00", endAt: "2027-04-04T08:30:00+09:00", tz: "Asia/Tokyo",
  location: { name: "Fushimi Inari Taisha", address: "68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto", lat: 34.9671, lng: 135.7727 }, details: { durationMin: 150 } }, agent);
add({ type: "restaurant", title: "Gion Karyo", status: "booked", startAt: "2027-04-04T19:00:00+09:00", tz: "Asia/Tokyo", confirmationCode: "Tabelog 338211", costAmount: 24000, costCurrency: "JPY",
  location: { name: "Gion Karyo", address: "570-235 Gionmachi Minamigawa, Higashiyama Ward, Kyoto", lat: 35.0030, lng: 135.7750 }, details: { cuisine: "Kaiseki", partySize: 2, platform: "Tabelog" } });
add({ type: "transfer", title: "Haruka to Kansai Airport", status: "planned", startAt: "2027-04-10T07:30:00+09:00", endAt: "2027-04-10T08:50:00+09:00",
  location: { name: "Kyoto Station", lat: 34.9858, lng: 135.7588 }, endLocation: { name: "Kansai International Airport", lat: 34.4320, lng: 135.2304 }, details: { mode: "train", provider: "JR West", vehicle: "Haruka Limited Express", durationMin: 80 } });
add({ type: "lodging", title: "Ace Hotel Kyoto", status: "booked", startAt: "2027-04-06T15:00:00+09:00", endAt: "2027-04-10T11:00:00+09:00", tz: "Asia/Tokyo", confirmationCode: "ACE-1190", costAmount: 980, costCurrency: "GBP",
  location: { name: "Ace Hotel Kyoto", address: "245-2 Kurumayacho, Nakagyo Ward, Kyoto", lat: 35.0083, lng: 135.7593 }, details: { provider: "Booking.com", checkInTime: "15:00", checkOutTime: "11:00", room: "Historic Twin", guests: 2 } });
add({ type: "flight", title: "", status: "confirmed", startAt: "2027-04-10T11:20:00+09:00", endAt: "2027-04-10T16:35:00+01:00", confirmationCode: "XK7P2Q", costAmount: 0, costCurrency: "GBP",
  details: { airline: "British Airways", airlineCode: "BA", flightNumber: "BA20", from: { iata: "KIX" }, to: { iata: "LHR", terminal: "5" }, seat: "35A", cabin: "premium_economy", durationMin: 855 }, notes: "Return leg of XK7P2Q (cost included in outbound)." });

pingLocation(sam, principalForUser(sam).actor, trip.id, { lat: 34.9858, lng: 135.7588, accuracy: 20, label: "Just off the Shinkansen" });

console.log(`\nSeeded trip "${trip.name}" (slug ${trip.slug}).`);
console.log(`Login:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}   (also sam@example.com / same password)`);
console.log(`API key for your agent (shown once): ${key}\n`);
