"use client";

import { BedDouble, Mail, Plus, Save, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type {
  AccommodationRequest,
  AccommodationStatus,
  RoomInventory,
  RoomOccupancyUnit,
  StayHotel,
} from "@/lib/types";
import { buildRoomOccupancy } from "@/lib/room-occupancy";
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
};

const emptyInventory: RoomInventory = {
  total: 0,
  assigned: 0,
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
  /** "" = create new shared room; otherwise existing roomGroupId */
  const [mergeTargetGroupId, setMergeTargetGroupId] = useState("");
  const [joinStayId, setJoinStayId] = useState<Record<string, string>>({});
  const [roomBusyKey, setRoomBusyKey] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

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
    setHotelForm({ name: "", address: "", totalRooms: "", notes: "" });
  };

  const saveHotel = async () => {
    const totalRooms = Number(hotelForm.totalRooms);
    if (!hotelForm.name.trim()) {
      setMessage("Enter a hotel name");
      return;
    }
    if (!Number.isFinite(totalRooms) || totalRooms < 0) {
      setMessage("Enter how many rooms this hotel has");
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
    notes?: string;
  }) => {
    setEditingHotelId(hotel.id);
    setHotelForm({
      name: hotel.name,
      address: hotel.address || "",
      totalRooms: String(hotel.totalRooms),
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

  /** Eligible to tick for share / add-to-shared: anyone not already in a group */
  const canMergeStay = (item: AccommodationRequest) => {
    if (item.status === "declined") return false;
    if (item.roomGroupId) return false;
    return true;
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

  const sharedRooms = useMemo(
    () => occupancy.filter((unit) => Boolean(unit.roomGroupId)),
    [occupancy],
  );

  const joinCandidates = useMemo(
    () =>
      items.filter(
        (item) => item.status !== "declined" && !item.roomGroupId,
      ),
    [items],
  );

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

  const mergeSelection = useMemo(() => {
    const selected = items.filter((item) => mergeIds.includes(item.id));
    const people = selected.reduce((sum, item) => sum + (item.people || 0), 0);
    return { selected, people, count: selected.length };
  }, [items, mergeIds]);

  const onMergeSharedRoom = async () => {
    // Add selected people into an existing shared room
    if (mergeTargetGroupId) {
      if (mergeIds.length < 1) {
        setMessage("Select at least 1 stay request to add to the shared room.");
        return;
      }
      const target = sharedRooms.find(
        (unit) => unit.roomGroupId === mergeTargetGroupId,
      );
      const names = mergeSelection.selected.map((item) => item.name).join(", ");
      const already = target?.stays.map((guest) => guest.name).join(", ") || "";
      if (
        !confirm(
          `Add to shared room${already ? ` (with ${already})` : ""}:\n${names}\n\nInventory stays the same (room already held). Anyone who had a solo room will release it first.`,
        )
      ) {
        return;
      }

      setMerging(true);
      setMessage("");
      try {
        let lastInventory: RoomInventory | undefined;
        const updatedStays: AccommodationRequest[] = [];
        for (const stayId of mergeIds) {
          const res = await fetch("/api/accommodation/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "join",
              roomGroupId: mergeTargetGroupId,
              stayId,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            inventory?: RoomInventory;
            stays?: AccommodationRequest[];
          };
          if (!res.ok) {
            setMessage(data.error || "Could not add guest to shared room");
            await refreshStays();
            return;
          }
          if (data.inventory) lastInventory = data.inventory;
          if (data.stays?.length) updatedStays.push(...data.stays);
        }
        applyInventoryAndStays(lastInventory, updatedStays);
        await refreshStays();
        setMergeIds([]);
        setMergeRoomDetails("");
        setMessage(
          `Added ${mergeSelection.count} guest${mergeSelection.count === 1 ? "" : "s"} to the shared room.`,
        );
      } catch {
        setMessage("Could not add to shared room. Please try again.");
      } finally {
        setMerging(false);
      }
      return;
    }

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
      setMergeTargetGroupId("");
      setMessage(
        data.message ||
          "Shared room saved. All stay requests kept; 1 room deducted.",
      );
    } catch {
      setMessage("Could not merge into one room. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BedDouble size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">Accommodation</h2>
        </div>
        <p className="mt-1 font-body text-sm text-muted">
          Inventory only drops when you assign rooms (hotel + room count) or a
          shared room. Use Assigned rooms below to see who is in which room.
        </p>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 font-body text-xs text-gold-soft">
          {message}
        </p>
      ) : null}

      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
        <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
          Hotels &amp; rooms
        </p>
        <p className="mt-1 font-body text-xs text-muted">
          Overall: {inventory.total} total · {inventory.assigned} assigned ·{" "}
          {inventory.available} available
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

      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
              Assigned rooms
            </p>
            <p className="mt-1 font-body text-xs text-muted">
              Who has which room — add someone, remove them, or release the
              assignment (inventory updates).
            </p>
          </div>
          <p className="font-body text-xs text-gold-soft">
            {occupancy.length} room unit{occupancy.length === 1 ? "" : "s"}
          </p>
        </div>

        {occupancy.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-gold/20 px-3 py-5 text-center font-body text-sm text-muted">
            No rooms assigned yet. Confirm a stay with a hotel + rooms, or use
            Share one room below.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {occupancy.map((unit) => (
              <div
                key={unit.key}
                className="rounded-xl border border-gold/15 bg-[#0d0b10] px-3 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg text-cream">
                      {unit.hotelName}
                    </p>
                    <p className="font-body text-xs text-muted">
                      {unit.roomsHeld} room{unit.roomsHeld === 1 ? "" : "s"} ·{" "}
                      {unit.people} people
                      {unit.roomGroupId ? " · shared" : " · solo"}
                      {unit.roomDetails ? ` · ${unit.roomDetails}` : ""}
                    </p>
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {unit.stays.map((guest) => (
                    <li
                      key={guest.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gold/10 bg-[#141018] px-2.5 py-2"
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
                          ? "Add another person to this shared room"
                          : "Add another person (converts to shared)"}
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
                        <option value="">Select a stay request…</option>
                        {joinCandidates
                          .filter(
                            (item) =>
                              !unit.stays.some((guest) => guest.id === item.id),
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} · {item.people} people
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
        )}
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

      <div className="mb-5 rounded-2xl border border-gold/25 bg-[#141018] p-4">
        <div className="flex flex-wrap items-start gap-2">
          <Users size={16} className="mt-0.5 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-cream">
              Share one room / add to shared room
            </p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted">
              Tick stay requests below, then either create a new shared room or
              add them into an existing shared room. Inventory stays the same
              when adding to a room that already exists.
            </p>
          </div>
        </div>

        <label className="mt-4 block max-w-xl">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Action
          </span>
          <select
            className={cn(fieldClass, "appearance-none")}
            value={mergeTargetGroupId}
            onChange={(e) => setMergeTargetGroupId(e.target.value)}
          >
            <option value="">Create a new shared room</option>
            {sharedRooms.map((unit) => (
              <option key={unit.key} value={unit.roomGroupId}>
                Add to existing · {unit.hotelName}
                {unit.roomDetails ? ` · ${unit.roomDetails}` : ""} ·{" "}
                {unit.stays.map((guest) => guest.name).join(", ")}
              </option>
            ))}
          </select>
          {sharedRooms.length === 0 ? (
            <span className="mt-1 block font-body text-[11px] text-muted">
              No shared rooms yet — create one first, or use Assigned rooms → Add
              another person.
            </span>
          ) : null}
        </label>

        {mergeSelection.count > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            {!mergeTargetGroupId ? (
              <>
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
                        {hotel.name} · {hotel.available} free / {hotel.totalRooms}
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
              </>
            ) : (
              <p className="font-body text-sm text-muted sm:col-span-2">
                Adding into:{" "}
                <span className="text-cream">
                  {sharedRooms.find((u) => u.roomGroupId === mergeTargetGroupId)
                    ?.stays.map((g) => g.name)
                    .join(", ") || "shared room"}
                </span>
                . No extra inventory used.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <p className="font-body text-xs text-gold-soft">
                {mergeSelection.count} request
                {mergeSelection.count === 1 ? "" : "s"} ·{" "}
                {mergeSelection.people} people total
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    merging ||
                    (mergeTargetGroupId
                      ? mergeSelection.count < 1
                      : mergeSelection.count < 2 || !mergeHotelId)
                  }
                  onClick={onMergeSharedRoom}
                >
                  <BedDouble size={14} />
                  {merging
                    ? "Working…"
                    : mergeTargetGroupId
                      ? "Add to shared room"
                      : "Assign 1 shared room"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={merging}
                  onClick={() => {
                    setMergeIds([]);
                    setMergeRoomDetails("");
                    setMergeTargetGroupId("");
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 font-body text-xs text-muted">
            Use the checkboxes on stay requests below
            {mergeTargetGroupId
              ? " (1 or more) to add them into the shared room."
              : " (2 or more) to create a new shared room."}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {filtered.map((item) => {
          const draft = draftFor(item);
          const open = openId === item.id;
          const status = (item.status || "pending") as AccommodationStatus;
          const mergeable = canMergeStay(item);
          const mergeChecked = mergeIds.includes(item.id);
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
                  {mergeable ? (
                    <label
                      className="mt-1.5 flex shrink-0 cursor-pointer items-center"
                      title="Include in shared room"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={mergeChecked}
                        onChange={() => toggleMergeId(item.id)}
                        className="h-4 w-4 accent-[#c4a35a]"
                      />
                      <span className="sr-only">Share room with others</span>
                    </label>
                  ) : (
                    <span
                      className="mt-1.5 h-4 w-4 shrink-0"
                      aria-hidden
                      title={
                        item.roomGroupId
                          ? "Already in a shared room — remove them first to move"
                          : typeof item.roomsAssigned === "number" &&
                              item.roomsAssigned > 0
                            ? "Has a solo room — tick to move into a share (releases solo)"
                            : undefined
                      }
                    />
                  )}
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
                            {hotel.name} ({hotel.available} free /{" "}
                            {hotel.totalRooms})
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
                          ? ` · free here: ${(inventory.hotels || []).find((hotel) => hotel.id === draft.hotelId)!.available}`
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
    </div>
  );
}
