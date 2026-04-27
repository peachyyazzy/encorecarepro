"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MOBILITY_LABELS, geo } from "@encorecare/shared";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";

interface PatientOption {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  mobility: keyof typeof MOBILITY_LABELS;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

type Mobility = keyof typeof MOBILITY_LABELS;

export default function NewScheduleForm({ patients }: { patients: PatientOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [pickup, setPickup] = useState<geo.ResolvedAddress | null>(null);
  const [dropoff, setDropoff] = useState<geo.ResolvedAddress | null>(null);
  const [pickupTimeLocal, setPickupTimeLocal] = useState("09:00");
  const [returnPickupTimeLocal, setReturnPickupTimeLocal] = useState("13:00");
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("round_trip");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  );
  const [days, setDays] = useState<number[]>([1, 3, 5]);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [mobility, setMobility] = useState<Mobility>("ambulatory");
  const [payerType, setPayerType] = useState("facility_billed");

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pickup || !dropoff) {
      setError("Pick both addresses from the suggestions.");
      return;
    }
    if (days.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    setSubmitting(true);

    const res = await fetch("/api/recurring-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId,
        label: label || "Recurring trip",
        pickup,
        dropoff,
        pickupTimeLocal,
        returnPickupTimeLocal: tripType === "round_trip" ? returnPickupTimeLocal : null,
        timezone,
        mobility,
        tripType,
        daysOfWeek: days,
        startDate,
        endDate: endDate || null,
        payerType,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't save schedule");
      return;
    }
    router.push("/facility/schedules");
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
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.last_name}, {p.first_name} ({p.date_of_birth})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Schedule name</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Dialysis MWF"
          className={inputCls + " mt-1"}
        />
      </label>

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

      <div>
        <span className="text-sm font-medium text-slate-700">Days of the week</span>
        <div className="mt-2 flex gap-2">
          {DAY_NAMES.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggleDay(i)}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                days.includes(i)
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Pickup time</span>
          <input
            type="time"
            value={pickupTimeLocal}
            onChange={(e) => setPickupTimeLocal(e.target.value)}
            required
            className={inputCls + " mt-1"}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Trip type</span>
          <select
            value={tripType}
            onChange={(e) => setTripType(e.target.value as typeof tripType)}
            className={inputCls + " mt-1"}
          >
            <option value="round_trip">Round trip</option>
            <option value="one_way">One way</option>
          </select>
        </label>
      </div>

      {tripType === "round_trip" && (
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Return pickup time</span>
          <input
            type="time"
            value={returnPickupTimeLocal}
            onChange={(e) => setReturnPickupTimeLocal(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm font-medium text-slate-700">Time zone</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className={inputCls + " mt-1"}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className={inputCls + " mt-1"}
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">End date (optional)</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls + " mt-1"}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Payer</span>
          <select
            value={payerType}
            onChange={(e) => setPayerType(e.target.value)}
            className={inputCls + " mt-1"}
          >
            <option value="facility_billed">Facility billed</option>
            <option value="private_pay">Private pay</option>
            <option value="medicaid">Medicaid</option>
            <option value="medicare">Medicare</option>
            <option value="mco">MCO</option>
            <option value="waiver_program">Waiver program</option>
            <option value="va">VA</option>
          </select>
        </label>
      </div>

      {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save schedule"}
      </button>
      <p className="text-xs text-slate-500">
        Trips for this schedule will appear in the trips list within 24 hours
        (or sooner if you trigger the materializer manually).
      </p>
    </form>
  );
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500";
