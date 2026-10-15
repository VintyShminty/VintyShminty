"use client";

import {
  PLACE_QUERY_MIN,
  type PlaceDetails,
  type PlaceKind,
  type PlaceSuggestion,
  placeDetailsSchema,
  placeSuggestionsSchema,
} from "@vinty/shared";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Field } from "@/components/auth/fields";
import { clientApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type FieldProps = Parameters<typeof Field>[0];

/**
 * A text field that suggests places while you type (Google Places through our server, so the key stays secret).
 * It stays a plain text field: no suggestions (key off, nothing found, offline) just means typing works as before.
 * `kind="city"` fills the field with the city name. `kind="address"` fills it with the street and calls `onPick`
 * with the city and postcode too, so the other fields of a delivery address fill themselves.
 */
export function PlaceField({
  kind,
  onPick,
  ...field
}: FieldProps & { kind: PlaceKind; onPick?: (details: PlaceDetails) => void }) {
  const { i18n, t } = useTranslation();
  const listId = useId();
  const [items, setItems] = useState<PlaceSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);
  const requestNo = useRef(0);
  const { value, onChange } = field;

  useEffect(() => {
    if (!typed.current || value.trim().length < PLACE_QUERY_MIN) {
      setItems([]);
      return;
    }
    const no = ++requestNo.current;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: value.trim(), kind, language: i18n.language });
      clientApi(`/v1/places/suggest?${params}`, { schema: placeSuggestionsSchema })
        .then((r) => {
          if (no === requestNo.current) {
            setItems(r.suggestions);
            setActive(-1);
          }
        })
        .catch(() => {
          if (no === requestNo.current) setItems([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, kind, i18n.language]);

  const close = () => {
    typed.current = false;
    requestNo.current++;
    setItems([]);
    setActive(-1);
  };

  const pick = async (item: PlaceSuggestion) => {
    close();
    if (kind === "city") {
      onChange(item.main);
      return;
    }
    onChange(item.main);
    try {
      const d = await clientApi(`/v1/places/${encodeURIComponent(item.id)}?language=${i18n.language}`, {
        schema: placeDetailsSchema,
      });
      if (d.line1) onChange(d.line1);
      onPick?.(d);
    } catch {
      // The street is already in the field, the person fills in the rest.
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      void pick(items[active] as PlaceSuggestion);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only forwards keys typed inside the input
    <div className="relative" onKeyDown={onKeyDown} onBlur={() => setTimeout(close, 150)}>
      <Field
        {...field}
        onChange={(v) => {
          typed.current = true;
          onChange(v);
        }}
        role="combobox"
        aria-expanded={items.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {items.length > 0 ? (
        <ul
          id={listId}
          aria-label={t("web.places.suggestions")}
          className="absolute inset-x-0 top-full z-20 mt-xs max-h-[280px] overflow-auto rounded-control border border-border bg-background py-xs shadow-lg"
        >
          {items.map((item, i) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={i === active ? "true" : undefined}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void pick(item)}
                className={cn(
                  "flex w-full flex-col items-start px-md py-sm text-start hover:bg-pressed",
                  i === active && "bg-pressed",
                )}
              >
                <span className="text-body text-text-1">{item.main}</span>
                {item.secondary ? <span className="text-body-sm text-text-3">{item.secondary}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
