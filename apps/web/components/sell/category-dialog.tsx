"use client";

import {
  type CategoryGuess,
  type CategoryNode,
  findCategory,
  SELL_HIDDEN_ROOTS,
  searchLeafCategories,
} from "@vinty/shared";
import { ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PickerDialog, RadioRow } from "@/components/sell/picker-dialog";
import { cn } from "@/lib/utils";

/**
 * The category picker (D-010 on the web): a large dialog with the category tree. The first level has a search and the
 * photo helper's "Looks like" guesses. Deeper levels have a back button. Choosing a leaf closes it and the form grows.
 */
export function CategoryDialog({
  open,
  categories,
  selectedId,
  guesses,
  name,
  onChoose,
  onClose,
}: {
  open: boolean;
  categories: CategoryNode[];
  selectedId: string | null;
  /** What the photo helper saw, taken when the dialog opened. Listed first, never picked for the seller. */
  guesses: CategoryGuess[];
  name: (value: CategoryNode["name"] | null | undefined) => string;
  onChoose: (leaf: CategoryNode) => void;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [path, setPath] = useState<string[]>([]);
  const [query, setQuery] = useState("");

  // Every opening starts at the top.
  useEffect(() => {
    if (open) {
      setPath([]);
      setQuery("");
    }
  }, [open]);

  const tree = useMemo(() => categories.filter((c) => !SELL_HIDDEN_ROOTS.includes(c.slug)), [categories]);
  const parentId = path.at(-1);
  const parent = parentId ? findCategory(categories, parentId) : null;
  const rows = parent ? parent.children : tree;
  const hits = useMemo(() => searchLeafCategories(tree, query, name), [tree, query, name]);
  const searching = !parent && query.trim().length >= 2;

  // A short line under rows people tend to mix up ("Blouses" or "Button-up shirts"). Only a few rows have one.
  const hintFor = (slug: string) => {
    const key = `sell.categoryHints.${slug}`;
    return i18n.exists(key) ? t(key) : undefined;
  };

  return (
    <PickerDialog
      open={open}
      large
      title={parent ? name(parent.name) : t("sell.category")}
      onClose={onClose}
      onBack={parent ? () => setPath((p) => p.slice(0, -1)) : undefined}
    >
      {!parent ? (
        <div className="px-lg pb-sm pt-md">
          <label className="flex h-11 items-center gap-sm rounded-bar border border-border bg-surface px-md focus-within:border-primary">
            <Search size={18} aria-hidden className="shrink-0 text-text-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("sell.findCategory")}
              aria-label={t("sell.findCategory")}
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent text-body text-text-1 outline-none placeholder:text-text-4"
            />
          </label>
        </div>
      ) : null}
      <div role="radiogroup" aria-label={t("sell.category")}>
        {searching ? (
          hits.length === 0 ? (
            <p className="px-lg py-xl text-center text-subtitle text-text-3">{t("sell.noCategories")}</p>
          ) : (
            hits.map((hit) => (
              <RadioRow
                key={hit.node.id}
                label={name(hit.node.name)}
                detail={hit.trail.map((p) => name(p.name)).join(", ")}
                on={hit.node.id === selectedId}
                onClick={() => onChoose(hit.node)}
              />
            ))
          )
        ) : (
          <>
            {!parent && guesses.length > 0 ? (
              <>
                <h3 className="px-lg pb-sm pt-sm text-section-label font-bold uppercase text-text-3">
                  {t("sell.assist.looksLike")}
                </h3>
                {guesses.map((guess) => (
                  <RadioRow
                    key={guess.node.id}
                    label={name(guess.node.name)}
                    detail={guess.parents.map((p) => name(p.name)).join(" · ")}
                    on={guess.node.id === selectedId}
                    onClick={() => onChoose(guess.node)}
                  />
                ))}
                <h3 className="px-lg pb-sm pt-lg text-section-label font-bold uppercase text-text-3">
                  {t("sell.assist.allOptions")}
                </h3>
              </>
            ) : null}
            {rows.map((row) =>
              row.isLeaf ? (
                <RadioRow
                  key={row.id}
                  label={name(row.name)}
                  detail={hintFor(row.slug)}
                  on={row.id === selectedId}
                  onClick={() => onChoose(row)}
                />
              ) : (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setPath((p) => [...p, row.id])}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-md border-b border-border-subtle px-lg py-sm text-start text-text-1 hover:text-primary focus-visible:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-body">{name(row.name)}</span>
                    {hintFor(row.slug) ? (
                      <span className="text-card-desc text-text-3">{hintFor(row.slug)}</span>
                    ) : null}
                  </span>
                  <ChevronRight size={18} aria-hidden className="shrink-0 text-text-3 rtl:rotate-180" />
                </button>
              ),
            )}
          </>
        )}
      </div>
    </PickerDialog>
  );
}
