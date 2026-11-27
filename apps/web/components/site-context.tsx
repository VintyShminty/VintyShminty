"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { ConditionNames } from "@/lib/reference";
import type { Viewer } from "@/lib/viewer";

type Site = { viewer: Viewer | null; conditions: ConditionNames };

const SiteContext = createContext<Site>({
  viewer: null,
  conditions: { names: {}, forBooks: {}, forObjects: {}, readingCategoryIds: [], wornCategoryIds: [] },
});

/** Mounted once in the language layout. `conditions` holds the condition names in the page language. */
export function SiteProvider({ viewer, conditions, children }: Site & { children: ReactNode }) {
  return <SiteContext.Provider value={{ viewer, conditions }}>{children}</SiteContext.Provider>;
}

/** The logged in person, or null for a visitor. */
export function useViewer(): Viewer | null {
  return useContext(SiteContext).viewer;
}

/** "Like new", "Well loved"... for a condition slug, in the page language: wearing words for clothes, reading words for books, use words for everything else. Empty when unknown. */
export function useConditionName(): (slug: string | null | undefined, categoryId?: string | null) => string {
  const { conditions } = useContext(SiteContext);
  return (slug, categoryId) => {
    if (!slug) return "";
    if (categoryId && conditions.readingCategoryIds.includes(categoryId))
      return conditions.forBooks[slug] ?? "";
    if (categoryId && conditions.wornCategoryIds.includes(categoryId)) return conditions.names[slug] ?? "";
    return conditions.forObjects[slug] ?? conditions.names[slug] ?? "";
  };
}
