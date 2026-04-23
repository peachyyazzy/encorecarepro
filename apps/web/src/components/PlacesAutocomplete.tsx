"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { geo } from "@encorecare/shared";

type ResolvedAddress = geo.ResolvedAddress;

interface Props {
  label: string;
  placeholder?: string;
  value: ResolvedAddress | null;
  onChange: (address: ResolvedAddress | null) => void;
  required?: boolean;
}

let loader: Loader | null = null;
function getLoader(): Loader {
  if (!loader) {
    loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      version: "weekly",
      libraries: ["places"],
    });
  }
  return loader;
}

/**
 * Google Places autocomplete input. Resolves a selection into a fully-parsed
 * ResolvedAddress (including lat/lng) and calls onChange.
 *
 * HIPAA: only the typed address goes to Google. No patient name, DOB, or
 * member ID should ever be concatenated into this input.
 */
export default function PlacesAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  required,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [ready, setReady] = useState(false);
  const [display, setDisplay] = useState(value?.formattedAddress ?? "");

  useEffect(() => {
    let cancelled = false;
    getLoader()
      .importLibrary("places")
      .then(() => {
        if (cancelled || !inputRef.current) return;
        const ac = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ["place_id", "formatted_address", "geometry", "address_components"],
          types: ["address"],
          componentRestrictions: { country: ["us"] },
        });
        ac.addListener("place_changed", () => {
          const place = ac.getPlace();
          if (!place.geometry?.location || !place.place_id) {
            onChange(null);
            return;
          }
          const parts = geo.parseAddressComponents(
            (place.address_components ?? []).map((c) => ({
              types: c.types,
              short_name: c.short_name,
              long_name: c.long_name,
            })),
          );
          const resolved: ResolvedAddress = {
            placeId: place.place_id,
            formattedAddress: place.formatted_address ?? "",
            ...parts,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng(),
          };
          setDisplay(resolved.formattedAddress);
          onChange(resolved);
        });
        autocompleteRef.current = ac;
        setReady(true);
      })
      .catch((err) => {
        console.error("Google Maps failed to load", err);
      });

    return () => {
      cancelled = true;
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        ref={inputRef}
        type="text"
        value={display}
        required={required}
        placeholder={placeholder ?? "Start typing an address…"}
        onChange={(e) => {
          setDisplay(e.target.value);
          if (value) onChange(null); // clear when user edits
        }}
        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      />
      {!ready && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <span className="mt-1 block text-xs text-slate-500">Loading address lookup…</span>
      )}
      {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
        <span className="mt-1 block text-xs text-amber-700">
          Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable autocomplete.
        </span>
      )}
    </label>
  );
}
