"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { Viewer } from "@/lib/viewer";

type Site = { viewer: Viewer | null; conditions: Record<string, string> };

const SiteContext = createContext<Site>({ viewer: null, conditions: {} });

/** Mounted once in the language layout. `conditions` maps a condition slug to its name in the page language. */
export function SiteProvider({ viewer, conditions, children }: Site & { children: ReactNode }) {
  return <SiteContext.Provider value={{ viewer, conditions }}>{children}</SiteContext.Provider>;
}

/** The logged in person, or null for a visitor. */
export function useViewer(): Viewer | null {
  return useContext(SiteContext).viewer;
}

/** "Very good", "New with tags"... for a condition slug, in the page language. Empty when unknown. */
export function useConditionName(): (slug: string | null | undefined) => string {
  const { conditions } = useContext(SiteContext);
  return (slug) => (slug ? (conditions[slug] ?? "") : "");
}
