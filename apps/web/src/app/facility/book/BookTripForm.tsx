"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MOBILITY_LABELS, billing, geo } from "@encorecare/shared";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";

interface PatientOption {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  mobility: keyof typeof MOBILITY_LABELS;
}

type Mobility = keyof typeof MOBILITY_LABELS;

export default function BookTripForm({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [pickup, setPickup] = useState<geo.ResolvedAddress | null>(null);
  const [dropoff, setDropoff] = useState<geo.ResolvedAddress | null>(null);
  const [scheduledPickupAt, setScheduledPickupAt] = useState("");
  const [appointmentAt, setAppointmentAt] = useState("");
  const [tripType, setTripType] = useState<"one_way" | "round_trip" | "will_call_return">("one_way");
  const [mobility, setMobility] = useState<Mobility>("ambulatory");
  const [needsAttendant, setNeedsAttendant] = useState(false);
  const [needsOxygen, setNeedsOxygen] = useState(false);
  const [payerType, setPayerType] = useState("facility_billed");
  const [specialInstructions, setSpecialInstructions] = useState("");

  const [distance, setDistance] = useState<geo.DistanceResult | null>(null);
  const [distanceLoading, setDistanceLoading] = useState(false);

  // Fetch real distance whenever pickup + dropoff resolve
  useEffect(() => {
    if (!pickup || !dropoff) {
      setDistance(null);
      return;
    }
    let cancelled = false;
    setDistanceLoading(true);
    fetch("/api/geo/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: { latitude: pickup.latitude, longitude: pickup.longitude },
        destination: { latitude: dropoff.latitude, longitude: dropoff.longitude },
        departAt: scheduledPickupAt || undefined,
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setDistance(json as geo.DistanceResult);
      })
      .catch(() => {
        if (!cancelled) setDistance(null);
      })
      .finally(() => {
        if (!cancelled) setDistanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, dropoff, scheduledPickupAt]);

  const quote =
    distance && payerType === "private_pay"
      ? billing.quotePrivatePay({
          mobility,
          loadedMiles: distance.distanceMiles,
          needsAttendant,
          needsOxygen,
          scheduledPickupAt: scheduledPickupAt ? new Date(scheduledPickupAt) : new Date(),
          roundTrip: tripType === "round_trip",
        })
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!pickup || !dropoff) {
      setError("Pick both addresses from the suggestion list.");
      return;
    }

    setSubmitting(true);

    const payload = {
      patientId,
      scheduledPickupAt,
      appointmentAt: appointmentAt || null,
      pickup,
      dropoff,
      tripType,
      mobility,
      needsAttendant,
      needsOxygen,
      payerType,
      loadedMiles: distance?.distanceMiles ?? null,
      specialInstructions: specialInstructions || null,
    };

    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      return;
    }
    const { tripId } = await res.json();
    router.push(`/facility/trips/${tripId}`);
  }

  if (patients.length === 0) {
    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Add a patient first.{" "}
        <a href="/facility/patients/new" className="text-brand-700 hover:underline">
          Add a patient →
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Patient</span>
        <select
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          required
          className={inputCls + " mt-1"}
        >
          <option value="">Select patient…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name}, {p.first_name} ({p.date_of_birth})
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Pickup date &amp; time</span>
          <input
            type="datetime-local"
            value={scheduledPickupAt}
            onChange={(e) => setScheduledPickupAt(e.target.value)}
            required
            className={inputCls + " mt-1"}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Appointment time (optional)</span>
          <input
            type="datetime-local"
            value={appointmentAt}
            onChange={(e) => setAppointmentAt(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </label>
      </div>

      <PlacesAutocomplete
        label="Pickup address"
        value={pickup}
        onChange={setPickup}
        required
      />
      <PlacesAutocomplete
        label="Drop-off address"
        value={dropoff}
        onChange={setDropoff}
        required
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Trip type</span>
          <select
            value={tripType}
            onChange={(e) => setTripType(e.target.value as typeof tripType)}
            className={inputCls + " mt-1"}
          >
            <option value="one_way">One way</option>
            <option value="round_trip">Round trip</option>
            <option value="will_call_return">Will-call return</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Mobility</span>
          <select
            value={mobility}
            onChange={(e) => setMobility(e.target.value as Mobility)}
            className={inputCls + " mt-1"}
          >
            {Object.entries(MOBILITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={needsAttendant}
            onChange={(e) => setNeedsAttendant(e.target.checked)}
          />{" "}
          Needs attendant
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={needsOxygen}
            onChange={(e) => setNeedsOxygen(e.target.checked)}
          />{" "}
          Needs oxygen
        </label>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">How will this trip be paid?</span>
        <select
          value={payerType}
          onChange={(e) => setPayerType(e.target.value)}
          className={inputCls + " mt-1"}
        >
          <option value="facility_billed">Facility billed</option>
          <option value="private_pay">Private pay / self-pay</option>
          <option value="medicaid">Medicaid</option>
          <option value="medicare">Medicare</option>
          <option value="mco">Managed Care Org (MCO)</option>
          <option value="waiver_program">Waiver program</option>
          <option value="va">VA</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Special instructions</span>
        <textarea
          value={specialInstructions}
          onChange={(e) => setSpecialInstructions(e.target.value)}
          rows={3}
          placeholder="Use the east entrance, patient is non-verbal, etc."
          className={inputCls + " mt-1"}
        />
      </label>

      <DistanceQuoteBlock
        distance={distance}
        loading={distanceLoading}
        quote={quote}
        payerType={payerType}
      />

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Booking…" : "Book trip"}
      </button>
    </form>
  );
}

function DistanceQuoteBlock({
  distance,
  loading,
  quote,
  payerType,
}: {
  distance: geo.DistanceResult | null;
  loading: boolean;
  quote: ReturnType<typeof billing.quotePrivatePay> | null;
  payerType: string;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        Calculating route…
      </div>
    );
  }
  if (!distance) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Pick both addresses to see distance and a fare estimate.
      </div>
    );
  }
  const miles = distance.distanceMiles.toFixed(1);
  const minutes = Math.round(distance.durationSeconds / 60);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route</div>
          <div className="text-base font-semibold text-slate-900">
            {miles} mi · {minutes} min
          </div>
          {distance.source === "haversine" && (
            <div className="text-xs text-amber-700">
              Estimated straight-line distance (road data unavailable).
            </div>
          )}
        </div>
        {quote && (
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Private-pay fare</div>
            <div className="text-xl font-semibold text-slate-900">
              {billing.formatCents(quote.totalCents)}
            </div>
          </div>
        )}
      </div>
      {quote && (
        <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
          {quote.breakdown.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      {!quote && payerType !== "private_pay" && (
        <div className="mt-2 text-xs italic text-brand-700">
          Care-plan trip — billed to payer, $0 to the patient if covered.
        </div>
      )}
    </div>
  );
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
