"use client";

import {
  ArrowLeftRight,
  BedDouble,
  Building2,
  ClipboardList,
  Mail,
  Plus,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AccommodationRequest,
  AccommodationStatus,
  RoomInventory,
  RoomOccupancyUnit,
  StayHotel,
} from "@/lib/types";
import { buildRoomOccupancy, occupancyRoomsHeld } from "@/lib/room-occupancy";
import { isShorterStayOffer, stayNights } from "@/lib/stay-dates";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type AccommodationManagerProps = {
  initialAccommodations: AccommodationRequest[];
  initialInventory?: RoomInventory;
};

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60";

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const statusStyle: Record<AccommodationStatus, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  confirmed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  declined: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

type StayDraft = {
  status?: AccommodationStatus;
  hotelId?: string;
  hotelName?: string;
  hotelAddress?: string;
  roomDetails?: string;
  adminNotes?: string;
  email?: string;
  roomsAssigned?: number | "";
  checkIn?: string;
  checkOut?: string;
  useBlockedRooms?: boolean;
};

const emptyInventory: RoomInventory = {
  total: 0,
  assigned: 0,
  blocked: 0,
  available: 0,
  hotels: [],
};

export function AccommodationManager({
  initialAccommodations,
  initialInventory = emptyInventory,
}: AccommodationManagerProps) {
  const [items, setItems] = useState(initialAccommodations);
  const [inventory, setInventory] = useState<RoomInventory>({
    ...emptyInventory,
    ...initialInventory,
    hotels: initialInventory.hotels || [],
  });
  const [hotelForm, setHotelForm] = useState({
    name: "",
    address: "",
    totalRooms: "",
    blockedRooms: "",
    notes: "",
  });
  const [editingHotelId, setEditingHotelId] = useState<string | null>(null);
  const [savingHotel, setSavingHotel] = useState(false);
  const [filter, setFilter] = useState<"all" | AccommodationStatus>("all");
  const [openId, setOpenId] = useState<string | null>(
    initialAccommodations[0]?.id || null,
  );
  const [drafts, setDrafts] = useState<Record<string, StayDraft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [mergeIds, setMergeIds] = useState<string[]>([]);
  const [mergeHotelId, setMergeHotelId] = useState("");
  const [mergeRoomDetails, setMergeRoomDetails] = useState("");
  const [mergeUseBlocked, setMergeUseBlocked] = useState(false);
  const [joinStayId, setJoinStayId] = useState<Record<string, string>>({});
  const [roomBusyKey, setRoomBusyKey] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [bulkHotelIds, setBulkHotelIds] = useState<string[]>([]);
  const [bulkHotelId, setBulkHotelId] = useState("");
  const [bulkUseBlocked, setBulkUseBlocked] = useState(false);
  const [bulkClearRoomDetails, setBulkClearRoomDetails] = useState(true);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [tab, setTab] = useState<"requests" | "rooms" | "hotels">("requests");
  /** First guest selected for room swap */
  const [swapFromId, setSwapFromId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignForm, setAssignForm] = useState({
    name: "",
    email: "",
    phone: "",
    people: "2",
    rooms: "1",
    hotelId: "",
    roomsAssigned: "1",
    checkIn: "2026-08-12",
    checkOut: "2026-08-14",
    roomDetails: "",
    useBlockedRooms: false,
    sendEmail: true,
  });

  useEffect(() => {
    fetch("/api/accommodation")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          accommodations?: AccommodationRequest[];
          inventory?: RoomInventory;
          hotels?: StayHotel[];
        } | null) => {
          if (data?.accommodations) setItems(data.accommodations);
          if (data?.inventory) {
            setInventory({
              ...emptyInventory,
              ...data.inventory,
              hotels: data.inventory.hotels || [],
            });
          }
        },
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!mergeHotelId && (inventory.hotels || []).length === 1) {
      setMergeHotelId(inventory.hotels[0]!.id);
    }
  }, [inventory.hotels, mergeHotelId]);

  const filtered = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((item) => (item.status || "pending") === filter),
    [filter, items],
  );

  const stats = useMemo(() => {
    const pending = items.filter((i) => (i.status || "pending") === "pending");
    const confirmed = items.filter((i) => i.status === "confirmed");
    const people = items.reduce((sum, item) => sum + item.people, 0);
    return {
      requests: items.length,
      pending: pending.length,
      confirmed: confirmed.length,
      people,
    };
  }, [items]);

  const draftFor = (item: AccommodationRequest): StayDraft => {
    const baseRooms =
      typeof item.roomsAssigned === "number"
        ? item.roomsAssigned
        : item.roomGroupRole === "member"
          ? 0
          : Math.max(1, item.rooms || 1);
    return {
      status: item.status || "pending",
      hotelId: item.hotelId || "",
      hotelName: item.hotelName || "",
      hotelAddress: item.hotelAddress || "",
      roomDetails: item.roomDetails || "",
      adminNotes: item.adminNotes || "",
      email: item.email || item.authEmail || "",
      roomsAssigned: baseRooms,
      checkIn: item.checkIn || "",
      checkOut: item.checkOut || "",
      ...drafts[item.id],
    };
  };

  const setDraft = (id: string, patch: StayDraft) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const resetHotelForm = () => {
    setEditingHotelId(null);
    setHotelForm({
      name: "",
      address: "",
      totalRooms: "",
      blockedRooms: "",
      notes: "",
    });
  };

  const saveHotel = async () => {
    const totalRooms = Number(hotelForm.totalRooms);
    const blockedRooms =
      hotelForm.blockedRooms === "" ? 0 : Number(hotelForm.blockedRooms);
    if (!hotelForm.name.trim()) {
      setMessage("Enter a hotel name");
      return;
    }
    if (!Number.isFinite(totalRooms) || totalRooms < 0) {
      setMessage("Enter how many rooms this hotel has");
      return;
    }
    if (!Number.isFinite(blockedRooms) || blockedRooms < 0) {
      setMessage("Blocked rooms must be 0 or more");
      return;
    }
    if (blockedRooms > totalRooms) {
      setMessage("Blocked rooms cannot exceed total rooms");
      return;
    }
    setSavingHotel(true);
    setMessage("");
    try {
      const res = await fetch("/api/accommodation/hotels", {
        method: editingHotelId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingHotelId || undefined,
          name: hotelForm.name,
          address: hotelForm.address,
          totalRooms,
          blockedRooms,
          notes: hotelForm.notes,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        inventory?: RoomInventory;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not save hotel");
        return;
      }
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      setMessage(
        editingHotelId ? "Hotel updated." : "Hotel added to your stay list.",
      );
      resetHotelForm();
    } catch {
      setMessage("Could not save hotel");
    } finally {
      setSavingHotel(false);
    }
  };

  const editHotel = (hotel: {
    id: string;
    name: string;
    address?: string;
    totalRooms: number;
    blocked?: number;
    notes?: string;
  }) => {
    setEditingHotelId(hotel.id);
    setHotelForm({
      name: hotel.name,
      address: hotel.address || "",
      totalRooms: String(hotel.totalRooms),
      blockedRooms: String(hotel.blocked || 0),
      notes: hotel.notes || "",
    });
  };

  const removeHotel = async (id: string, name: string) => {
    if (!confirm(`Remove “${name}” from your hotel list?`)) return;
    setMessage("");
    try {
      const res = await fetch(
        `/api/accommodation/hotels?id=${encodeURIComponent(id)}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        inventory?: RoomInventory;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not delete hotel");
        return;
      }
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      if (editingHotelId === id) resetHotelForm();
      setMessage("Hotel removed.");
    } catch {
      setMessage("Could not delete hotel");
    }
  };

  const assignDirect = async () => {
    setAssigning(true);
    setMessage("");
    try {
      const people = Number(assignForm.people);
      const rooms = Number(assignForm.rooms);
      const roomsAssigned = Number(assignForm.roomsAssigned || assignForm.rooms);
      const res = await fetch("/api/accommodation/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: assignForm.name.trim(),
          email: assignForm.email.trim(),
          phone: assignForm.phone.trim() || undefined,
          people,
          rooms,
          hotelId: assignForm.hotelId,
          roomsAssigned,
          checkIn: assignForm.checkIn,
          checkOut: assignForm.checkOut,
          roomDetails: assignForm.roomDetails.trim() || undefined,
          useBlockedRooms: assignForm.useBlockedRooms,
          sendEmail: assignForm.sendEmail,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        accommodation?: AccommodationRequest;
        inventory?: RoomInventory;
        email?: { sent?: boolean; error?: string };
      };
      if (!res.ok) {
        setMessage(data.error || "Could not assign room");
        return;
      }
      if (data.accommodation) {
        setItems((prev) => [data.accommodation!, ...prev]);
        setOpenId(data.accommodation.id);
      }
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      setAssignForm((prev) => ({
        ...prev,
        name: "",
        email: "",
        phone: "",
        roomDetails: "",
      }));
      setMessage(
        data.email?.sent
          ? `Room assigned and emailed to ${data.accommodation?.email}.`
          : data.email?.error
            ? `Room assigned, but email failed: ${data.email.error}`
            : `Room assigned for ${data.accommodation?.name}.`,
      );
      setTab("requests");
    } catch {
      setMessage("Could not assign room");
    } finally {
      setAssigning(false);
    }
  };

  const save = async (id: string, sendEmail: boolean) => {
    const draft = drafts[id] || {};
    const current = items.find((item) => item.id === id);
    if (!current) return;

    setSavingId(id);
    setMessage("");
    try {
      const status = (draft.status ||
        current.status ||
        "pending") as AccommodationStatus;
      const body: Record<string, unknown> = {
        status,
        hotelName: draft.hotelName ?? current.hotelName ?? "",
        hotelAddress: draft.hotelAddress ?? current.hotelAddress ?? "",
        roomDetails: draft.roomDetails ?? current.roomDetails ?? "",
        adminNotes: draft.adminNotes ?? current.adminNotes ?? "",
        email: draft.email ?? current.email ?? current.authEmail ?? "",
        checkIn: draft.checkIn || current.checkIn,
        checkOut: draft.checkOut || current.checkOut,
        sendEmail,
        useBlockedRooms: Boolean(draft.useBlockedRooms),
      };

      const hotelId = (draft.hotelId || current.hotelId || "").trim();
      const rawAssign = draft.roomsAssigned;
      const parsedAssign =
        rawAssign === "" || rawAssign === undefined || rawAssign === null
          ? NaN
          : Number(rawAssign);
      const isSharedMember =
        Boolean(current.roomGroupId) && current.roomGroupRole === "member";

      if (status === "confirmed" && !isSharedMember) {
        if (!hotelId) {
          setMessage(
            "To confirm, pick a hotel and set rooms to assign — inventory only updates when rooms are assigned.",
          );
          setSavingId(null);
          return;
        }
        const roomsAssigned = Number.isFinite(parsedAssign)
          ? parsedAssign
          : Math.max(1, current.rooms || 1);
        if (roomsAssigned < 1) {
          setMessage("Rooms to assign must be at least 1 when confirming.");
          setSavingId(null);
          return;
        }
        body.hotelId = hotelId;
        body.roomsAssigned = roomsAssigned;
      } else if (Number.isFinite(parsedAssign)) {
        body.roomsAssigned = parsedAssign;
        if (parsedAssign > 0) {
          if (!hotelId) {
            setMessage("Select a hotel before assigning rooms.");
            setSavingId(null);
            return;
          }
          body.hotelId = hotelId;
        }
      } else if (hotelId && status === "confirmed") {
        body.hotelId = hotelId;
      }

      const res = await fetch(`/api/accommodation/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        accommodation?: AccommodationRequest;
        inventory?: RoomInventory;
        email?: { sent?: boolean; error?: string; kind?: string };
        offer?: boolean;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not save");
        return;
      }
      if (data.accommodation) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? data.accommodation! : item,
          ),
        );
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      if (sendEmail) {
        if (data.offer || data.email?.kind === "offer") {
          setMessage(
            data.email?.sent
              ? "Shorter-stay offer emailed — guest can Accept or Decline from the link."
              : data.email?.error ||
                  "Saved, but offer email could not be sent.",
          );
        } else {
          const hasHotelCopy =
            Boolean(data.accommodation?.hotelName?.trim()) ||
            Boolean(data.accommodation?.hotelAddress?.trim()) ||
            Boolean(data.accommodation?.roomDetails?.trim()) ||
            Boolean(data.accommodation?.adminNotes?.trim());
          if (status === "confirmed" && !hasHotelCopy && data.email?.sent) {
            setMessage(
              "Email sent, but hotel details were empty — add hotel info and email again if needed.",
            );
          } else {
            setMessage(
              data.email?.sent
                ? data.accommodation?.roomsAssigned
                  ? `Hotel details emailed. ${data.accommodation.roomsAssigned} room(s) assigned.`
                  : "Hotel details emailed to the guest."
                : data.email?.error || "Saved, but email could not be sent.",
            );
          }
        }
      } else if (data.accommodation?.roomsAssigned) {
        setMessage(
          `Saved — ${data.accommodation.roomsAssigned} room(s) assigned.`,
        );
      } else {
        setMessage("Saved stay details.");
      }
    } catch {
      setMessage("Could not save. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this accommodation request?")) return;
    const res = await fetch(`/api/accommodation/${id}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as {
      inventory?: RoomInventory;
    };
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setMergeIds((prev) => prev.filter((x) => x !== id));
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      if (openId === id) setOpenId(null);
    }
  };

  const occupancy = useMemo<RoomOccupancyUnit[]>(() => {
    const hotelRows: StayHotel[] = (inventory.hotels || []).map((hotel) => ({
      id: hotel.id,
      name: hotel.name,
      address: hotel.address,
      totalRooms: hotel.totalRooms,
      notes: hotel.notes,
      createdAt: "",
    }));
    return buildRoomOccupancy(items, hotelRows);
  }, [items, inventory.hotels]);

  const occupancyHeld = useMemo(
    () => occupancyRoomsHeld(occupancy),
    [occupancy],
  );

  /** Flat sheet: one row per guest with the room they were assigned. */
  const assignmentSheetRows = useMemo(() => {
    const rows: Array<{
      key: string;
      hotel: string;
      room: string;
      guest: string;
      people: number;
      phone: string;
      email: string;
      shared: boolean;
    }> = [];

    const byHotel = new Map<string, RoomOccupancyUnit[]>();
    for (const unit of occupancy) {
      const hotelKey = unit.hotelId || unit.hotelName || "hotel";
      const list = byHotel.get(hotelKey) || [];
      list.push(unit);
      byHotel.set(hotelKey, list);
    }

    for (const units of byHotel.values()) {
      units.forEach((unit, unitIndex) => {
        const roomLabel = unit.roomDetails?.trim()
          ? unit.roomDetails.trim()
          : unit.roomGroupId
            ? `Shared room ${unitIndex + 1}`
            : `Room ${unitIndex + 1}`;
        for (const guest of unit.stays) {
          rows.push({
            key: `${unit.key}-${guest.id}`,
            hotel: unit.hotelName || "Hotel",
            room: roomLabel,
            guest: guest.name,
            people: guest.people || 0,
            phone: guest.phone || "",
            email: guest.email || "",
            shared: Boolean(unit.roomGroupId) || unit.stays.length > 1,
          });
        }
      });
    }

    return rows.sort((a, b) => {
      const hotelCmp = a.hotel.localeCompare(b.hotel);
      if (hotelCmp !== 0) return hotelCmp;
      const roomCmp = a.room.localeCompare(b.room);
      if (roomCmp !== 0) return roomCmp;
      return a.guest.localeCompare(b.guest);
    });
  }, [occupancy]);

  /** Booked rooms grouped by hotel for a clearer board */
  const occupancyByHotel = useMemo(() => {
    type HotelGroup = {
      key: string;
      hotelId: string;
      hotelName: string;
      units: RoomOccupancyUnit[];
      roomsHeld: number;
      people: number;
      guests: number;
    };
    const map = new Map<string, HotelGroup>();

    for (const unit of occupancy) {
      const hotelId = unit.hotelId || "";
      const hotelName = unit.hotelName?.trim() || "Unassigned hotel";
      const key = hotelId || `name:${hotelName.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.units.push(unit);
        existing.roomsHeld += unit.roomsHeld || 0;
        existing.people += unit.people || 0;
        existing.guests += unit.stays.length;
      } else {
        map.set(key, {
          key,
          hotelId,
          hotelName,
          units: [unit],
          roomsHeld: unit.roomsHeld || 0,
          people: unit.people || 0,
          guests: unit.stays.length,
        });
      }
    }

    const groups = [...map.values()];
    const hotelOrder = new Map(
      (inventory.hotels || []).map((hotel, index) => [hotel.id, index]),
    );
    groups.sort((a, b) => {
      const ai = a.hotelId ? hotelOrder.get(a.hotelId) : undefined;
      const bi = b.hotelId ? hotelOrder.get(b.hotelId) : undefined;
      if (ai !== undefined && bi !== undefined) return ai - bi;
      if (ai !== undefined) return -1;
      if (bi !== undefined) return 1;
      return a.hotelName.localeCompare(b.hotelName);
    });
    return groups;
  }, [occupancy, inventory.hotels]);

  /** Anyone not declined can be added/moved into a room (join auto-leaves prior share). */
  const joinCandidates = useMemo(
    () => items.filter((item) => item.status !== "declined"),
    [items],
  );

  const assignedGuests = useMemo(
    () =>
      items.filter((item) => {
        if (item.status !== "confirmed") return false;
        if (item.roomGroupId) return true;
        return typeof item.roomsAssigned === "number" && item.roomsAssigned > 0;
      }),
    [items],
  );

  const shareCandidates = useMemo(
    () =>
      items.filter(
        (item) => item.status !== "declined" && !item.roomGroupId,
      ),
    [items],
  );

  const guestRoomLabel = (item: AccommodationRequest) => {
    if (item.roomGroupId) {
      return `${item.name} · in shared room`;
    }
    if (
      item.status === "confirmed" &&
      typeof item.roomsAssigned === "number" &&
      item.roomsAssigned > 0
    ) {
      return `${item.name} · solo${item.hotelName ? ` · ${item.hotelName}` : ""}`;
    }
    return `${item.name} · unassigned · ${item.people} people`;
  };

  const refreshStays = async () => {
    try {
      const res = await fetch("/api/accommodation");
      if (!res.ok) return;
      const data = (await res.json()) as {
        accommodations?: AccommodationRequest[];
        inventory?: RoomInventory;
      };
      if (data.accommodations) setItems(data.accommodations);
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
    } catch {
      // ignore
    }
  };

  const applyInventoryAndStays = (
    inventoryNext?: RoomInventory,
    staysNext?: AccommodationRequest[],
  ) => {
    if (inventoryNext) {
      setInventory({
        ...emptyInventory,
        ...inventoryNext,
        hotels: inventoryNext.hotels || [],
      });
    }
    if (staysNext?.length) {
      setItems((prev) => {
        const map = new Map(staysNext.map((row) => [row.id, row]));
        const merged = prev.map((row) => map.get(row.id) || row);
        for (const row of staysNext) {
          if (!prev.some((item) => item.id === row.id)) merged.unshift(row);
        }
        return merged;
      });
    }
  };

  const roomAction = async (
    key: string,
    body: Record<string, unknown>,
  ) => {
    setRoomBusyKey(key);
    setMessage("");
    try {
      const res = await fetch("/api/accommodation/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        inventory?: RoomInventory;
        stays?: AccommodationRequest[];
        stay?: AccommodationRequest;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not update room");
        return;
      }
      applyInventoryAndStays(
        data.inventory,
        data.stays || (data.stay ? [data.stay] : undefined),
      );
      await refreshStays();
      setMessage(data.message || "Room updated.");
    } catch {
      setMessage("Could not update room. Please try again.");
    } finally {
      setRoomBusyKey(null);
    }
  };

  const resendEmail = async (stayId: string) => {
    setRoomBusyKey(`email-${stayId}`);
    setMessage("");
    try {
      const res = await fetch(`/api/accommodation/${stayId}/resend`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        accommodation?: AccommodationRequest;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not resend email");
        return;
      }
      if (data.accommodation) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === stayId ? data.accommodation! : item,
          ),
        );
      }
      setMessage(data.message || "Email resent.");
    } catch {
      setMessage("Could not resend email. Please try again.");
    } finally {
      setRoomBusyKey(null);
    }
  };

  const toggleMergeId = (id: string) => {
    setMergeIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 10) {
        setMessage("Select at most 10 stay requests for one shared room.");
        return prev;
      }
      return [...prev, id];
    });
  };

  const toggleBulkHotelId = (id: string) => {
    const stay = items.find((item) => item.id === id);
    if (!stay) return;
    const groupIds = stay.roomGroupId
      ? items
          .filter((item) => item.roomGroupId === stay.roomGroupId)
          .map((item) => item.id)
      : [id];

    setBulkHotelIds((prev) => {
      const removing = groupIds.every((gid) => prev.includes(gid));
      if (removing) {
        return prev.filter((item) => !groupIds.includes(item));
      }
      const next = new Set(prev);
      for (const gid of groupIds) next.add(gid);
      if (next.size > 40) {
        setMessage("Select at most 40 guests for one hotel move.");
        return prev;
      }
      return [...next];
    });
  };

  const bulkSelection = useMemo(() => {
    const selected = items.filter((item) => bulkHotelIds.includes(item.id));
    const groupKeys = new Set(
      selected.map((item) => item.roomGroupId || item.id),
    );
    return {
      selected,
      count: selected.length,
      people: selected.reduce((sum, item) => sum + (item.people || 0), 0),
      units: groupKeys.size,
    };
  }, [bulkHotelIds, items]);

  const onBulkMoveHotel = async () => {
    if (!bulkSelection.count) {
      setMessage("Select at least one guest to move.");
      return;
    }
    if (!bulkHotelId) {
      setMessage("Choose the destination hotel.");
      return;
    }
    const hotel = (inventory.hotels || []).find((row) => row.id === bulkHotelId);
    const names = bulkSelection.selected.map((item) => item.name).join(", ");
    if (
      !confirm(
        `Move these guests to ${hotel?.name || "the selected hotel"}?\n\n${names}\n\n• ${bulkSelection.count} guest(s) · ${bulkSelection.units} room assignment(s)\n• Shared rooms move together\n• Room numbers/notes will ${
          bulkClearRoomDetails ? "be cleared" : "be kept"
        }\n• Guests are not emailed by this move`,
      )
    ) {
      return;
    }

    setBulkBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/accommodation/bulk-hotel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: bulkHotelIds,
          hotelId: bulkHotelId,
          useBlockedRooms: bulkUseBlocked,
          clearRoomDetails: bulkClearRoomDetails,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        inventory?: RoomInventory;
        stays?: AccommodationRequest[];
      };
      if (!res.ok) {
        setMessage(data.error || "Could not move guests");
        return;
      }
      if (data.inventory) setInventory(data.inventory);
      if (data.stays?.length) {
        const byId = new Map(data.stays.map((stay) => [stay.id, stay]));
        setItems((prev) => prev.map((item) => byId.get(item.id) || item));
      } else {
        await refreshStays();
      }
      setBulkHotelIds([]);
      setBulkHotelId("");
      setMessage(data.message || "Guests moved to the new hotel.");
    } catch {
      setMessage("Could not move guests. Please try again.");
    } finally {
      setBulkBusy(false);
    }
  };

  const mergeSelection = useMemo(() => {
    const selected = items.filter((item) => mergeIds.includes(item.id));
    const people = selected.reduce((sum, item) => sum + (item.people || 0), 0);
    return { selected, people, count: selected.length };
  }, [items, mergeIds]);

  const onMergeSharedRoom = async () => {
    if (mergeIds.length < 2) {
      setMessage("Select at least 2 stay requests to put in one room.");
      return;
    }
    if (!mergeHotelId) {
      setMessage("Choose which hotel the shared room is from.");
      return;
    }
    const names = mergeSelection.selected.map((item) => item.name).join(", ");
    if (
      !confirm(
        `Assign ONE room to:\n${names}\n\nTotal people on these requests: ${mergeSelection.people}\n(You decide if that room fits — we don’t store a people limit.)\n\n• All ${mergeSelection.count} stay requests are kept (nothing deleted)\n• Only 1 room is taken from inventory\n• Prior solo rooms for these guests are released first\n• ${mergeSelection.count} emails go out (one per guest)`,
      )
    ) {
      return;
    }

    setMerging(true);
    setMessage("");
    try {
      const res = await fetch("/api/accommodation/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: mergeIds,
          hotelId: mergeHotelId,
          roomDetails: mergeRoomDetails.trim() || undefined,
          useBlockedRooms: mergeUseBlocked,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        stays?: AccommodationRequest[];
        inventory?: RoomInventory;
      };
      if (!res.ok) {
        setMessage(data.error || "Could not merge into one room");
        return;
      }
      if (data.stays?.length) {
        const byId = new Map(data.stays.map((stay) => [stay.id, stay]));
        setItems((prev) => prev.map((item) => byId.get(item.id) || item));
      }
      if (data.inventory) {
        setInventory({
          ...emptyInventory,
          ...data.inventory,
          hotels: data.inventory.hotels || [],
        });
      }
      setMergeIds([]);
      setMergeRoomDetails("");
      setMessage(
        data.message ||
          "Shared room saved. All stay requests kept; 1 room deducted.",
      );
      await refreshStays();
    } catch {
      setMessage("Could not merge into one room. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <BedDouble size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">Accommodation</h2>
        </div>
        <p className="mt-1 font-body text-sm text-muted">
          {tab === "requests"
            ? "Confirm stay requests, set dates, and email guests."
            : tab === "rooms"
              ? "See who is in which room — add people, share, swap, or release."
              : "Hotel room pools and free counts."}
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["requests", "Requests", ClipboardList, stats.pending],
            ["rooms", "Rooms", Users, occupancyHeld],
            ["hotels", "Hotels", Building2, inventory.available],
          ] as const
        ).map(([id, label, Icon, badge]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3.5 py-2 font-body text-[11px] uppercase tracking-[0.16em] transition",
              tab === id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            <Icon size={14} />
            {label}
            <span className="rounded-full bg-[#0d0b10] px-1.5 py-0.5 text-[10px] text-cream/80">
              {badge}
            </span>
          </button>
        ))}
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 font-body text-xs text-gold-soft">
          {message}
        </p>
      ) : null}

      {tab === "hotels" ? (
      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
        <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
          Hotels &amp; rooms
        </p>
        <p className="mt-1 font-body text-xs text-muted">
          Overall: {inventory.total} total · {inventory.assigned} assigned ·{" "}
          {inventory.blocked || 0} blocked · {inventory.available} free
        </p>

        <div className="mt-4 space-y-2">
          {(inventory.hotels || []).map((hotel) => (
            <div
              key={hotel.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gold/15 bg-[#0d0b10] px-3 py-3"
            >
              <div>
                <p className="font-display text-lg text-cream">{hotel.name}</p>
                <p className="font-body text-xs text-muted">
                  {hotel.totalRooms} rooms · {hotel.assigned} assigned ·{" "}
                  <span className="text-amber-200/90">
                    {hotel.blocked || 0} blocked
                  </span>{" "}
                  ·{" "}
                  <span
                    className={
                      hotel.available === 0 ? "text-rose-200" : "text-gold-soft"
                    }
                  >
                    {hotel.available} free
                  </span>
                  {hotel.address ? ` · ${hotel.address}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => editHotel(hotel)}
                  className="rounded-full border border-gold/25 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.14em] text-gold-soft hover:bg-gold/10"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => removeHotel(hotel.id, hotel.name)}
                  className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                  aria-label={`Delete ${hotel.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          {(inventory.hotels || []).length === 0 ? (
            <p className="rounded-xl border border-dashed border-gold/20 px-3 py-4 text-center font-body text-sm text-muted">
              No hotels yet. Add one below.
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 border-t border-gold/15 pt-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              {editingHotelId ? "Edit hotel" : "Add hotel"}
            </span>
            <input
              className={fieldClass}
              value={hotelForm.name}
              onChange={(e) =>
                setHotelForm((f) => ({ ...f, name: e.target.value }))
              }
              placeholder="Hotel / resort name"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Total rooms in pool
            </span>
            <input
              type="number"
              min={0}
              max={500}
              className={fieldClass}
              value={hotelForm.totalRooms}
              onChange={(e) =>
                setHotelForm((f) => ({ ...f, totalRooms: e.target.value }))
              }
              placeholder="e.g. 8"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Blocked / held back
            </span>
            <input
              type="number"
              min={0}
              max={500}
              className={fieldClass}
              value={hotelForm.blockedRooms}
              onChange={(e) =>
                setHotelForm((f) => ({ ...f, blockedRooms: e.target.value }))
              }
              placeholder="e.g. 2"
            />
            <span className="mt-1 block font-body text-[11px] text-muted">
              Still counted in total, but not free — you can draw from them when
              approving a guest if needed.
            </span>
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Address (optional)
            </span>
            <input
              className={fieldClass}
              value={hotelForm.address}
              onChange={(e) =>
                setHotelForm((f) => ({ ...f, address: e.target.value }))
              }
              placeholder="Address or map pin"
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              type="button"
              disabled={savingHotel}
              onClick={saveHotel}
            >
              <Plus size={14} />
              {savingHotel
                ? "Saving…"
                : editingHotelId
                  ? "Update hotel"
                  : "Add hotel"}
            </Button>
            {editingHotelId ? (
              <Button type="button" variant="outline" onClick={resetHotelForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      ) : null}

      {tab === "rooms" ? (
      <>
      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
              Booked rooms by hotel
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Each hotel shows who is booked there — add, remove, swap, or
              release from the room cards.
            </p>
          </div>
          <p className="font-body text-xs text-gold-soft">
            {occupancyByHotel.length} hotel
            {occupancyByHotel.length === 1 ? "" : "s"} · {occupancyHeld} room
            {occupancyHeld === 1 ? "" : "s"} assigned
          </p>
        </div>

        {occupancy.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gold/20 px-3 py-5 text-center font-body text-sm text-muted">
            No rooms assigned yet. Confirm a stay under Requests, or create a
            shared room below.
          </p>
        ) : (
          <div className="mt-4 space-y-5">
            {occupancyByHotel.map((group) => {
              const hotelInv = (inventory.hotels || []).find(
                (hotel) => hotel.id === group.hotelId,
              );
              return (
                <section
                  key={group.key}
                  className="overflow-hidden rounded-2xl border border-gold/25 bg-[#0d0b10]"
                >
                  <div className="border-b border-gold/15 bg-[#141018] px-4 py-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.22em] text-gold/70">
                          Hotel
                        </p>
                        <h3 className="font-display text-2xl text-cream">
                          {group.hotelName}
                        </h3>
                        {hotelInv?.address ? (
                          <p className="mt-0.5 font-body text-xs text-muted">
                            {hotelInv.address}
                          </p>
                        ) : null}
                      </div>
                      <p className="font-body text-xs text-gold-soft">
                        {group.roomsHeld} room
                        {group.roomsHeld === 1 ? "" : "s"} booked ·{" "}
                        {group.guests} guest
                        {group.guests === 1 ? "" : "s"} · {group.people} people
                        {hotelInv
                          ? ` · ${hotelInv.available} free${
                              hotelInv.blocked
                                ? ` · ${hotelInv.blocked} blocked`
                                : ""
                            }`
                          : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    {group.units.map((unit, unitIndex) => (
              <div
                key={unit.key}
                className="rounded-xl border border-gold/15 bg-[#141018] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-cream">
                      {unit.roomGroupId
                        ? `Shared room ${unitIndex + 1}`
                        : `Room ${unitIndex + 1}`}
                      {unit.roomDetails ? ` · ${unit.roomDetails}` : ""}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {unit.roomsHeld} room{unit.roomsHeld === 1 ? "" : "s"} ·{" "}
                      {unit.people} people ·{" "}
                      {unit.stays.length} guest
                      {unit.stays.length === 1 ? "" : "s"}
                      {unit.roomGroupId ? " · shared" : " · solo"}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {unit.stays.map((guest) => (
                    <li
                      key={guest.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/10 bg-[#0d0b10] px-2.5 py-2"
                    >
                      <div>
                        <p className="font-body text-sm text-cream">
                          {guest.name}
                          <span className="ml-2 text-[10px] uppercase tracking-[0.16em] text-muted">
                            {guest.role === "primary"
                              ? "holds inventory"
                              : guest.role === "solo"
                                ? "solo"
                                : "sharing"}
                          </span>
                        </p>
                        <p className="font-body text-[11px] text-muted">
                          {guest.people} people
                          {guest.email ? ` · ${guest.email}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {swapFromId === guest.id ? (
                          <button
                            type="button"
                            onClick={() => setSwapFromId(null)}
                            className="rounded-full border border-gold/40 bg-gold/15 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-gold-soft"
                          >
                            Cancel swap
                          </button>
                        ) : swapFromId ? (
                          <button
                            type="button"
                            disabled={roomBusyKey === `swap-${guest.id}`}
                            onClick={() => {
                              const from = assignedGuests.find(
                                (item) => item.id === swapFromId,
                              );
                              if (
                                !confirm(
                                  `Swap rooms and email both guests their new details?\n${from?.name || "Guest"} ↔ ${guest.name}`,
                                )
                              ) {
                                return;
                              }
                              void roomAction(`swap-${guest.id}`, {
                                action: "swap",
                                stayIdA: swapFromId,
                                stayIdB: guest.id,
                              }).then(() => setSwapFromId(null));
                            }}
                            className="rounded-full border border-sky-300/40 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-sky-100 hover:bg-sky-400/10 disabled:opacity-50"
                          >
                            <span className="inline-flex items-center gap-1">
                              <ArrowLeftRight size={10} /> Swap here
                            </span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSwapFromId(guest.id)}
                            className="rounded-full border border-gold/25 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-gold-soft hover:bg-gold/10"
                          >
                            Swap
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={roomBusyKey === `email-${guest.id}`}
                          onClick={() => void resendEmail(guest.id)}
                          className="rounded-full border border-gold/25 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-gold-soft hover:bg-gold/10 disabled:opacity-50"
                          title={
                            guest.email
                              ? `Resend room email to ${guest.email}`
                              : "Resend room email"
                          }
                        >
                          {roomBusyKey === `email-${guest.id}`
                            ? "Sending…"
                            : "Resend email"}
                        </button>
                        {unit.roomGroupId ? (
                          <button
                            type="button"
                            disabled={roomBusyKey === `leave-${guest.id}`}
                            onClick={() =>
                              void roomAction(`leave-${guest.id}`, {
                                action: "leave",
                                stayId: guest.id,
                              })
                            }
                            className="rounded-full border border-gold/25 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-gold-soft hover:bg-gold/10 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={roomBusyKey === `release-${guest.id}`}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Release ${guest.name}'s room assignment? Inventory will go back up.`,
                                )
                              ) {
                                return;
                              }
                              void roomAction(`release-${guest.id}`, {
                                action: "release",
                                stayId: guest.id,
                              });
                            }}
                            className="rounded-full border border-rose-400/30 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.12em] text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"
                          >
                            Release
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {unit.roomGroupId || unit.stays[0] ? (
                  <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gold/10 pt-3">
                    <label className="min-w-[12rem] flex-1">
                      <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                        {unit.roomGroupId
                          ? "Add / move another person into this room"
                          : "Add another person (makes this a shared room)"}
                      </span>
                      <select
                        className={fieldClass}
                        value={joinStayId[unit.key] || ""}
                        onChange={(e) =>
                          setJoinStayId((prev) => ({
                            ...prev,
                            [unit.key]: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select a guest…</option>
                        {joinCandidates
                          .filter(
                            (item) =>
                              !unit.stays.some((guest) => guest.id === item.id),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {guestRoomLabel(item)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        !joinStayId[unit.key] ||
                        roomBusyKey === `join-${unit.key}`
                      }
                      onClick={() => {
                        const stayId = joinStayId[unit.key];
                        if (!stayId) return;
                        const moving = items.find((item) => item.id === stayId);
                        if (
                          moving?.roomGroupId ||
                          (typeof moving?.roomsAssigned === "number" &&
                            moving.roomsAssigned > 0)
                        ) {
                          if (
                            !confirm(
                              `${moving.name} already has a room. Move them into this room? Their previous assignment will be released.`,
                            )
                          ) {
                            return;
                          }
                        }
                        void roomAction(`join-${unit.key}`, {
                          action: "join",
                          stayId,
                          ...(unit.roomGroupId
                            ? { roomGroupId: unit.roomGroupId }
                            : { primaryStayId: unit.stays[0]?.id }),
                        }).then(() =>
                          setJoinStayId((prev) => ({
                            ...prev,
                            [unit.key]: "",
                          })),
                        );
                      }}
                    >
                      <Users size={14} />
                      Add to room
                    </Button>
                  </div>
                ) : null}
              </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-gold/20 bg-[#141018]">
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-gold/15 px-4 py-3">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
              Assignment sheet
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Simple list of who is in which room. Existing room cards above
              are unchanged.
            </p>
          </div>
          <p className="font-body text-xs text-gold-soft">
            {assignmentSheetRows.length} guest
            {assignmentSheetRows.length === 1 ? "" : "s"} listed
          </p>
        </div>

        {assignmentSheetRows.length === 0 ? (
          <p className="px-4 py-6 text-center font-body text-sm text-muted">
            No room assignments yet — confirm stays or assign rooms first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-gold/15 bg-[#0d0b10]/80">
                  {(
                    [
                      "Hotel",
                      "Room",
                      "Guest",
                      "People",
                      "Phone",
                      "Email",
                    ] as const
                  ).map((heading) => (
                    <th
                      key={heading}
                      className="whitespace-nowrap px-3 py-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assignmentSheetRows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-gold/10 last:border-b-0"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 font-body text-sm text-cream/90">
                      {row.hotel}
                    </td>
                    <td className="px-3 py-2.5 font-body text-sm text-gold-soft">
                      {row.room}
                      {row.shared ? (
                        <span className="ml-2 font-body text-[10px] uppercase tracking-[0.14em] text-muted">
                          shared
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 font-display text-base text-cream">
                      {row.guest}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-body text-sm text-muted">
                      {row.people || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-body text-sm text-muted">
                      {row.phone || "—"}
                    </td>
                    <td className="px-3 py-2.5 font-body text-sm text-muted">
                      {row.email || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mb-6 rounded-2xl border border-gold/25 bg-[#141018] p-4">
        <div className="flex flex-wrap items-start gap-2">
          <Building2 size={16} className="mt-0.5 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-cream">
              Move guests to another hotel
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted">
              Select multiple people already in a room, pick the destination
              hotel, and move them at once. Shared-room groups travel together.
              Existing room cards and tools above stay the same.
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-gold/15 bg-[#0d0b10] p-2">
          {assignedGuests.length === 0 ? (
            <p className="px-2 py-3 font-body text-xs text-muted">
              No assigned guests yet — confirm stays and assign rooms first.
            </p>
          ) : (
            assignedGuests.map((item) => {
              const checked = bulkHotelIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                    checked ? "bg-gold/10" : "hover:bg-white/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBulkHotelId(item.id)}
                    className="h-4 w-4 accent-[#c4a35a]"
                  />
                  <span className="min-w-0 flex-1 font-body text-sm text-cream">
                    {item.name}
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {item.people} people
                      {item.hotelName ? ` · now at ${item.hotelName}` : ""}
                      {item.roomGroupId
                        ? " · shared (whole room moves)"
                        : " · solo"}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        {bulkSelection.count > 0 ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                  Destination hotel
                </span>
                <select
                  className={cn(fieldClass, "appearance-none")}
                  value={bulkHotelId}
                  onChange={(e) => setBulkHotelId(e.target.value)}
                >
                  <option value="">Select hotel…</option>
                  {(inventory.hotels || []).map((hotel) => (
                    <option key={hotel.id} value={hotel.id}>
                      {hotel.name} · {hotel.available} free
                      {hotel.blocked ? ` · ${hotel.blocked} blocked` : ""} /{" "}
                      {hotel.totalRooms}
                    </option>
                  ))}
                </select>
              </label>
              <p className="font-body text-xs text-gold-soft sm:pb-3">
                {bulkSelection.count} guest
                {bulkSelection.count === 1 ? "" : "s"} ·{" "}
                {bulkSelection.people} people · {bulkSelection.units} room
                {bulkSelection.units === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 font-body text-xs text-muted">
                <input
                  type="checkbox"
                  checked={bulkUseBlocked}
                  onChange={(e) => setBulkUseBlocked(e.target.checked)}
                  className="h-4 w-4 accent-[#c4a35a]"
                />
                Use blocked rooms if needed
              </label>
              <label className="inline-flex items-center gap-2 font-body text-xs text-muted">
                <input
                  type="checkbox"
                  checked={bulkClearRoomDetails}
                  onChange={(e) => setBulkClearRoomDetails(e.target.checked)}
                  className="h-4 w-4 accent-[#c4a35a]"
                />
                Clear old room number / notes
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={bulkBusy || !bulkHotelId}
                onClick={() => void onBulkMoveHotel()}
              >
                <ArrowLeftRight size={14} />
                {bulkBusy ? "Moving…" : "Move to hotel"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={bulkBusy}
                onClick={() => {
                  setBulkHotelIds([]);
                  setBulkHotelId("");
                }}
              >
                Clear selection
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {swapFromId ? (
        <p className="mb-4 rounded-xl border border-sky-300/30 bg-sky-400/10 px-3 py-2 font-body text-xs text-sky-100">
          Swap started — tap <span className="text-cream">Swap here</span> on
          the other guest’s room.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setSwapFromId(null)}
          >
            Cancel
          </button>
        </p>
      ) : null}

      <div className="mb-6 rounded-2xl border border-gold/25 bg-[#141018] p-4">
        <div className="flex flex-wrap items-start gap-2">
          <Users size={16} className="mt-0.5 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-cream">
              Put people in one shared room
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted">
              Tick 2+ guests below (not already sharing), pick a hotel, and
              assign one room. To add into an existing shared room, use{" "}
              <span className="text-cream">Add to room</span> on that room card
              above.
            </p>
          </div>
        </div>

        <div className="mt-4 max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-gold/15 bg-[#0d0b10] p-2">
          {shareCandidates.length === 0 ? (
            <p className="px-2 py-3 font-body text-xs text-muted">
              No unassigned / solo guests available to start a new share.
            </p>
          ) : (
            shareCandidates.map((item) => {
              const checked = mergeIds.includes(item.id);
              return (
                <label
                  key={item.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                    checked ? "bg-gold/10" : "hover:bg-white/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMergeId(item.id)}
                    className="h-4 w-4 accent-[#c4a35a]"
                  />
                  <span className="min-w-0 flex-1 font-body text-sm text-cream">
                    {item.name}
                    <span className="mt-0.5 block text-[11px] text-muted">
                      {item.people} people
                      {typeof item.roomsAssigned === "number" &&
                      item.roomsAssigned > 0
                        ? ` · currently solo at ${item.hotelName || "hotel"}`
                        : " · not in a room yet"}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        {mergeSelection.count > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                Hotel for this shared room
              </span>
              <select
                className={cn(fieldClass, "appearance-none")}
                value={mergeHotelId}
                onChange={(e) => setMergeHotelId(e.target.value)}
              >
                <option value="">Select hotel…</option>
                {(inventory.hotels || []).map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name} · {hotel.available} free
                    {hotel.blocked ? ` · ${hotel.blocked} blocked` : ""} /{" "}
                    {hotel.totalRooms}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                Room note (optional)
              </span>
              <input
                className={fieldClass}
                value={mergeRoomDetails}
                onChange={(e) => setMergeRoomDetails(e.target.value)}
                placeholder="e.g. Room 204 — family suite"
              />
            </label>
            <div className="flex flex-col gap-2">
              <p className="font-body text-xs text-gold-soft">
                {mergeSelection.count} guest
                {mergeSelection.count === 1 ? "" : "s"} ·{" "}
                {mergeSelection.people} people
              </p>
              {(inventory.hotels || []).find((h) => h.id === mergeHotelId)
                ?.blocked ? (
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[#c4a35a]"
                    checked={mergeUseBlocked}
                    onChange={(e) => setMergeUseBlocked(e.target.checked)}
                  />
                  <span className="font-body text-[11px] text-muted">
                    Use blocked room if none free
                  </span>
                </label>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    merging || mergeSelection.count < 2 || !mergeHotelId
                  }
                  onClick={() => void onMergeSharedRoom()}
                >
                  <BedDouble size={14} />
                  {merging ? "Working…" : "Assign 1 shared room"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={merging}
                  onClick={() => {
                    setMergeIds([]);
                    setMergeRoomDetails("");
                    setMergeUseBlocked(false);
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 font-body text-xs text-muted">
            Select at least 2 guests to share one room.
          </p>
        )}
      </div>
      </>
      ) : null}

      {tab === "requests" ? (
      <>
      <div className="mb-6 rounded-2xl border border-gold/25 bg-[#141018] p-5">
        <div className="mb-4 flex items-start gap-3">
          <BedDouble size={18} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <h3 className="font-display text-xl text-cream">
              Assign room directly
            </h3>
            <p className="mt-1 font-body text-sm text-muted">
              Create a stay and confirm rooms without a guest request — name,
              email, people, and rooms.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Guest name
            </span>
            <input
              className={fieldClass}
              value={assignForm.name}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Full name"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Email
            </span>
            <input
              type="email"
              className={fieldClass}
              value={assignForm.email}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="guest@email.com"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Phone (optional)
            </span>
            <input
              className={fieldClass}
              value={assignForm.phone}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, phone: e.target.value }))
              }
              placeholder="Mobile"
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              People
            </span>
            <input
              type="number"
              min={1}
              max={30}
              className={fieldClass}
              value={assignForm.people}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, people: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Rooms requested
            </span>
            <input
              type="number"
              min={1}
              max={15}
              className={fieldClass}
              value={assignForm.rooms}
              onChange={(e) => {
                const value = e.target.value;
                setAssignForm((prev) => ({
                  ...prev,
                  rooms: value,
                  roomsAssigned: prev.roomsAssigned || value,
                }));
              }}
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Rooms to assign
            </span>
            <input
              type="number"
              min={1}
              max={30}
              className={fieldClass}
              value={assignForm.roomsAssigned}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  roomsAssigned: e.target.value,
                }))
              }
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Hotel
            </span>
            <select
              className={fieldClass}
              value={assignForm.hotelId}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, hotelId: e.target.value }))
              }
            >
              <option value="">Select hotel</option>
              {(inventory.hotels || []).map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name} · free {hotel.available}
                  {hotel.blocked ? ` · blocked ${hotel.blocked}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Check-in
            </span>
            <input
              type="date"
              className={fieldClass}
              value={assignForm.checkIn}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, checkIn: e.target.value }))
              }
            />
          </label>
          <label className="block">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Check-out
            </span>
            <input
              type="date"
              className={fieldClass}
              value={assignForm.checkOut}
              onChange={(e) =>
                setAssignForm((prev) => ({ ...prev, checkOut: e.target.value }))
              }
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              Room details (optional)
            </span>
            <input
              className={fieldClass}
              value={assignForm.roomDetails}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  roomDetails: e.target.value,
                }))
              }
              placeholder="Room number, floor, notes for guest"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 font-body text-sm text-cream">
            <input
              type="checkbox"
              checked={assignForm.useBlockedRooms}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  useBlockedRooms: e.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#d4af37]"
            />
            Use blocked rooms if needed
          </label>
          <label className="inline-flex items-center gap-2 font-body text-sm text-cream">
            <input
              type="checkbox"
              checked={assignForm.sendEmail}
              onChange={(e) =>
                setAssignForm((prev) => ({
                  ...prev,
                  sendEmail: e.target.checked,
                }))
              }
              className="h-4 w-4 accent-[#d4af37]"
            />
            Email hotel details to guest
          </label>
          <Button
            type="button"
            disabled={
              assigning ||
              !assignForm.name.trim() ||
              !assignForm.email.trim() ||
              !assignForm.hotelId ||
              !(inventory.hotels || []).length
            }
            onClick={() => void assignDirect()}
            className="ml-auto"
          >
            {assigning ? "Assigning…" : "Assign & confirm"}
          </Button>
        </div>
        {!(inventory.hotels || []).length ? (
          <p className="mt-3 font-body text-xs text-amber-200">
            Add a hotel under the Hotels tab before assigning rooms.
          </p>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Requests", stats.requests],
            ["Pending", stats.pending],
            ["Confirmed", stats.confirmed],
            ["People", stats.people],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl text-cream">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["declined", "Declined"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] transition",
              filter === id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((item) => {
          const draft = draftFor(item);
          const open = openId === item.id;
          const status = (item.status || "pending") as AccommodationStatus;
          const askedIn = item.requestedCheckIn || item.checkIn;
          const askedOut = item.requestedCheckOut || item.checkOut;
          const draftIn = draft.checkIn || item.checkIn;
          const draftOut = draft.checkOut || item.checkOut;
          const offeredNights = stayNights(draftIn, draftOut);
          const askedNights = stayNights(askedIn, askedOut);
          const shorterOffer =
            draft.status === "confirmed" &&
            isShorterStayOffer({
              requestedCheckIn: askedIn,
              requestedCheckOut: askedOut,
              checkIn: draftIn,
              checkOut: draftOut,
            });
          const datesChanged =
            draftIn !== askedIn || draftOut !== askedOut;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setOpenId(open ? null : item.id)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-xl text-cream">
                        {item.name}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em]",
                          statusStyle[status],
                        )}
                      >
                        {status}
                      </span>
                      {item.roomGroupId ? (
                        <span className="rounded-full border border-sky-300/35 bg-sky-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-sky-100">
                          Shared room
                          {item.roomGroupRole === "primary"
                            ? " · holds inventory"
                            : ""}
                        </span>
                      ) : null}
                      {item.offerStatus === "pending" ? (
                        <span className="rounded-full border border-amber-300/40 bg-amber-400/15 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-amber-100">
                          Offer emailed — waiting
                        </span>
                      ) : null}
                      {item.offerStatus === "accepted" ? (
                        <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-emerald-100">
                          Guest accepted offer
                        </span>
                      ) : null}
                      {item.offerStatus === "declined" ? (
                        <span className="rounded-full border border-rose-300/35 bg-rose-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-rose-100">
                          Guest declined offer
                        </span>
                      ) : null}
                      {status === "confirmed" && item.roomsAssigned ? (
                        <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-gold-soft">
                          {item.roomsAssigned} room
                          {item.roomsAssigned === 1 ? "" : "s"}
                          {item.hotelName ? ` · ${item.hotelName}` : ""}
                        </span>
                      ) : null}
                    {item.inviteTier ? (
                      <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-rose-100">
                        Bride · {item.inviteTier}
                      </span>
                    ) : (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-gold-soft">
                        Main site
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-body text-sm text-gold-soft">
                    Asked: {item.people} people · {item.rooms} room
                    {item.rooms === 1 ? "" : "s"} · {formatDate(askedIn)} →{" "}
                    {formatDate(askedOut)}
                    {item.checkIn !== askedIn ||
                    item.checkOut !== askedOut ? (
                      <>
                        {" "}
                        · Offering: {formatDate(item.checkIn)} →{" "}
                        {formatDate(item.checkOut)}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted">
                    {item.inviteTier === "mehfil"
                      ? "Came from: Bride all-functions invite (mehfil)"
                      : item.inviteTier === "laavan"
                        ? "Came from: Bride wedding-only invite (laavan)"
                        : "Came from: Main wedding site (/)"}
                  </p>
                  <p className="mt-1 font-body text-sm text-muted">
                    {item.phone}
                    {(item.email || item.authEmail)
                      ? ` · ${item.email || item.authEmail}`
                      : ""}
                    {item.contactFamily ? ` · via ${item.contactFamily}` : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 font-body text-sm text-muted">
                      Guest note: “{item.notes}”
                    </p>
                  ) : null}
                  {item.roomShareWith && item.roomShareWith.length > 0 ? (
                    <p className="mt-2 font-body text-xs text-sky-100/90">
                      Sharing room with: {item.roomShareWith.join(", ")}
                    </p>
                  ) : null}
                </button>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                  aria-label={`Delete stay request from ${item.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {open ? (
                <div className="mt-5 space-y-3 border-t border-gold/15 pt-5">
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                    Family response
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Status
                      </span>
                      <select
                        className={cn(fieldClass, "appearance-none")}
                        value={draft.status}
                        onChange={(e) =>
                          setDraft(item.id, {
                            status: e.target.value as AccommodationStatus,
                          })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">
                          Confirm &amp; assign rooms (uses inventory)
                        </option>
                        <option value="declined">
                          Declined — cannot arrange
                        </option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Assign hotel
                      </span>
                      <select
                        className={cn(fieldClass, "appearance-none")}
                        value={draft.hotelId || ""}
                        onChange={(e) => {
                          const hotelId = e.target.value;
                          const hotel = (inventory.hotels || []).find(
                            (row) => row.id === hotelId,
                          );
                          setDraft(item.id, {
                            hotelId,
                            hotelName: hotel?.name || draft.hotelName,
                            hotelAddress:
                              hotel?.address || draft.hotelAddress || "",
                          });
                        }}
                        disabled={draft.status !== "confirmed"}
                      >
                        <option value="">Select hotel…</option>
                        {(inventory.hotels || []).map((hotel) => (
                          <option key={hotel.id} value={hotel.id}>
                            {hotel.name} ({hotel.available} free
                            {hotel.blocked
                              ? ` · ${hotel.blocked} blocked`
                              : ""}{" "}
                            / {hotel.totalRooms})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Rooms to assign
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        className={fieldClass}
                        value={
                          draft.roomsAssigned === "" ||
                          draft.roomsAssigned == null
                            ? ""
                            : draft.roomsAssigned
                        }
                        onChange={(e) =>
                          setDraft(item.id, {
                            roomsAssigned:
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                          })
                        }
                        placeholder={`Guest asked for ${item.rooms}`}
                        disabled={draft.status !== "confirmed"}
                      />
                      <span className="mt-1 block font-body text-[11px] text-muted">
                        Required when confirming — this subtracts from hotel
                        inventory
                        {(inventory.hotels || []).find(
                          (hotel) => hotel.id === draft.hotelId,
                        )
                          ? ` · free here: ${(inventory.hotels || []).find((hotel) => hotel.id === draft.hotelId)!.available}${
                              (inventory.hotels || []).find(
                                (hotel) => hotel.id === draft.hotelId,
                              )!.blocked
                                ? ` · blocked: ${(inventory.hotels || []).find((hotel) => hotel.id === draft.hotelId)!.blocked}`
                                : ""
                            }`
                          : ""}
                        {item.status === "confirmed" && item.roomsAssigned
                          ? ` · currently holding: ${item.roomsAssigned}`
                          : ""}
                        {item.roomGroupRole === "member"
                          ? " · shared member (inventory held by primary)"
                          : ""}
                        .
                      </span>
                    </label>
                    {draft.status === "confirmed" &&
                    (inventory.hotels || []).find(
                      (hotel) => hotel.id === draft.hotelId,
                    )?.blocked ? (
                      <label className="flex items-start gap-2 sm:col-span-2">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 accent-[#c4a35a]"
                          checked={Boolean(draft.useBlockedRooms)}
                          onChange={(e) =>
                            setDraft(item.id, {
                              useBlockedRooms: e.target.checked,
                            })
                          }
                        />
                        <span className="font-body text-xs text-muted">
                          <span className="text-cream">Use blocked rooms</span>{" "}
                          if free rooms aren’t enough — draws from the held-back
                          reserve for this hotel (
                          {
                            (inventory.hotels || []).find(
                              (hotel) => hotel.id === draft.hotelId,
                            )!.blocked
                          }{" "}
                          blocked).
                        </span>
                      </label>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-gold/20 bg-[#0d0b10]/70 p-4">
                    <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                      Stay dates
                    </p>
                    <p className="mt-1 font-body text-xs text-muted">
                      Guest asked{" "}
                      {formatDate(askedIn)} → {formatDate(askedOut)}
                      {askedNights > 0
                        ? ` (${askedNights} night${askedNights === 1 ? "" : "s"})`
                        : ""}
                      . Change dates below if you can add a night, or only offer
                      fewer nights.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Check-in (assign)
                        </span>
                        <input
                          type="date"
                          className={fieldClass}
                          value={draftIn}
                          onChange={(e) =>
                            setDraft(item.id, { checkIn: e.target.value })
                          }
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Check-out (assign)
                        </span>
                        <input
                          type="date"
                          className={fieldClass}
                          value={draftOut}
                          onChange={(e) =>
                            setDraft(item.id, { checkOut: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    {datesChanged ? (
                      <p className="mt-2 font-body text-xs text-gold-soft">
                        Offering {formatDate(draftIn)} → {formatDate(draftOut)}
                        {offeredNights > 0
                          ? ` · ${offeredNights} night${offeredNights === 1 ? "" : "s"}`
                          : ""}
                        {shorterOffer
                          ? " — shorter than asked; Approve will email an Accept / Decline link."
                          : offeredNights > askedNights
                            ? " — longer than asked; guest gets normal confirmation."
                            : "."}
                      </p>
                    ) : null}
                    {item.offerStatus === "pending" ? (
                      <p className="mt-2 font-body text-xs text-amber-100/90">
                        Waiting for guest to accept this shorter stay from their
                        email.
                      </p>
                    ) : null}
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Guest email
                    </span>
                    <input
                      type="email"
                      className={fieldClass}
                      value={draft.email || ""}
                      onChange={(e) =>
                        setDraft(item.id, { email: e.target.value })
                      }
                      placeholder="for confirmation email"
                    />
                  </label>

                  {draft.status === "confirmed" ? (
                    <div className="space-y-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 p-4">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.25em] text-emerald-200/80">
                          Hotel details for guest email
                        </p>
                        <p className="mt-1 font-body text-xs text-muted">
                          {shorterOffer
                            ? "Fill hotel details, then offer & email. Guest gets Accept / Decline for the shorter stay."
                            : "Fill this in, then tap Approve & email. Everything below is sent to the guest."}
                        </p>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Hotel / stay name
                        </span>
                        <input
                          className={fieldClass}
                          value={draft.hotelName || ""}
                          onChange={(e) =>
                            setDraft(item.id, { hotelName: e.target.value })
                          }
                          placeholder="e.g. Maple Garden / Sukhmani Resort"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Address / directions
                        </span>
                        <input
                          className={fieldClass}
                          value={draft.hotelAddress || ""}
                          onChange={(e) =>
                            setDraft(item.id, { hotelAddress: e.target.value })
                          }
                          placeholder="Full address or map link"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Hotel &amp; room details
                        </span>
                        <textarea
                          rows={5}
                          className={cn(fieldClass, "resize-none")}
                          value={draft.roomDetails || ""}
                          onChange={(e) =>
                            setDraft(item.id, { roomDetails: e.target.value })
                          }
                          placeholder={
                            "Room number / type, floor, check-in time, contact person, parking, how to find the room…"
                          }
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Extra message to guest
                        </span>
                        <textarea
                          rows={3}
                          className={cn(fieldClass, "resize-none")}
                          value={draft.adminNotes || ""}
                          onChange={(e) =>
                            setDraft(item.id, { adminNotes: e.target.value })
                          }
                          placeholder="Anything else you want them to know"
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Message to guest
                      </span>
                      <textarea
                        rows={3}
                        className={cn(fieldClass, "resize-none")}
                        value={draft.adminNotes || ""}
                        onChange={(e) =>
                          setDraft(item.id, { adminNotes: e.target.value })
                        }
                        placeholder="Optional note if declining or updating"
                      />
                    </label>
                  )}

                  {item.emailSentAt ? (
                    <p className="font-body text-[11px] text-muted">
                      Last email sent{" "}
                      {new Date(item.emailSentAt).toLocaleString()}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingId === item.id}
                      onClick={() => save(item.id, false)}
                    >
                      <Save size={14} />
                      {savingId === item.id ? "Saving…" : "Save only"}
                    </Button>
                    <Button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => save(item.id, true)}
                    >
                      <Mail size={14} />
                      {draft.status === "confirmed"
                        ? shorterOffer
                          ? offeredNights === 1
                            ? "Offer 1 night & email accept link"
                            : `Offer ${offeredNights} nights & email accept link`
                          : "Approve & email hotel details"
                        : "Save & email guest"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        roomBusyKey === `email-${item.id}` ||
                        savingId === item.id ||
                        !(draft.email || item.email || item.authEmail)
                      }
                      onClick={() => void resendEmail(item.id)}
                      title="Send the current room/offer email again without changing assignment"
                    >
                      <Mail size={14} />
                      {roomBusyKey === `email-${item.id}`
                        ? "Sending…"
                        : item.offerStatus === "pending"
                          ? "Resend offer email"
                          : "Resend email"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
            No accommodation requests in this filter.
          </p>
        ) : null}
      </div>
      </>
      ) : null}
    </div>
  );
}
