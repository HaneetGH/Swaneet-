import type {
  AccommodationRequest,
  RoomOccupancyUnit,
  StayHotel,
} from "@/lib/types";

/**
 * Occupancy board: who is in which assigned room (solo or shared).
 * Only lists units that actually hold inventory rooms — same rule as
 * computeRoomInventory — so “rooms held” matches Hotels & rooms “assigned”.
 */
export function buildRoomOccupancy(
  accommodations: AccommodationRequest[],
  hotels: StayHotel[],
): RoomOccupancyUnit[] {
  const hotelName = (id?: string) =>
    hotels.find((hotel) => hotel.id === id)?.name || "Hotel";
  const units: RoomOccupancyUnit[] = [];
  const seenGroups = new Set<string>();

  for (const stay of accommodations) {
    if (stay.status !== "confirmed") continue;

    if (stay.roomGroupId) {
      if (seenGroups.has(stay.roomGroupId)) continue;
      seenGroups.add(stay.roomGroupId);
      const members = accommodations.filter(
        (item) => item.roomGroupId === stay.roomGroupId,
      );
      const primary =
        members.find((item) => item.roomGroupRole === "primary") || members[0]!;
      // Inventory only counts the primary's roomsAssigned — skip empty groups
      if (
        !(
          typeof primary.roomsAssigned === "number" &&
          primary.roomsAssigned > 0
        )
      ) {
        continue;
      }
      units.push({
        key: stay.roomGroupId,
        hotelId: primary.hotelId || "",
        hotelName: primary.hotelName || hotelName(primary.hotelId),
        roomDetails: primary.roomDetails,
        roomsHeld: primary.roomsAssigned,
        people: members.reduce((sum, item) => sum + (item.people || 0), 0),
        roomGroupId: stay.roomGroupId,
        stays: members.map((item) => ({
          id: item.id,
          name: item.name,
          people: item.people,
          role: item.roomGroupRole || "member",
          email: item.email || item.authEmail,
          phone: item.phone,
        })),
      });
      continue;
    }

    if (typeof stay.roomsAssigned === "number" && stay.roomsAssigned > 0) {
      units.push({
        key: stay.id,
        hotelId: stay.hotelId || "",
        hotelName: stay.hotelName || hotelName(stay.hotelId),
        roomDetails: stay.roomDetails,
        roomsHeld: stay.roomsAssigned,
        people: stay.people || 0,
        stays: [
          {
            id: stay.id,
            name: stay.name,
            people: stay.people,
            role: "solo",
            email: stay.email || stay.authEmail,
            phone: stay.phone,
          },
        ],
      });
    }
  }

  return units.sort((a, b) => a.hotelName.localeCompare(b.hotelName));
}

/** Sum of rooms held across occupancy units (matches inventory.assigned when hotelIds align). */
export function occupancyRoomsHeld(units: RoomOccupancyUnit[]): number {
  return units.reduce((sum, unit) => sum + (unit.roomsHeld || 0), 0);
}
