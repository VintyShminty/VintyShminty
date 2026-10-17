"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { createContext, type ReactNode, useContext } from "react";
import { cn } from "@/lib/utils";

type Expand = { expanded: boolean; toggle: () => void };

const ExpandContext = createContext<Expand | null>(null);

/** Set by the Browse panel: whether its More part is open (D-054). */
export function BrowseExpandProvider({ expanded, toggle, children }: Expand & { children: ReactNode }) {
  return <ExpandContext.Provider value={{ expanded, toggle }}>{children}</ExpandContext.Provider>;
}

/**
 * The "More" tile (D-054): four small pictures of the categories behind it and how many there are, so it reads as
 * "more categories inside". Inside the Browse panel it opens the rest of the categories in place and turns into
 * "Show less". Anywhere else, or before the page is interactive, it is a plain link to the Browse page.
 */
export function BrowseMoreTile({
  href,
  label,
  lessLabel,
  countLabel,
  accessibleName,
  previews,
  className,
}: {
  href: string;
  label: string;
  lessLabel: string;
  countLabel: string;
  accessibleName: string;
  previews: StaticImageData[];
  className?: string;
}) {
  const panel = useContext(ExpandContext);
  const expanded = panel?.expanded ?? false;
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (!panel) return;
        e.preventDefault();
        panel.toggle();
      }}
      aria-label={expanded ? lessLabel : accessibleName}
      aria-expanded={panel ? expanded : undefined}
      className={cn("group relative block overflow-hidden rounded-control bg-pressed", className)}
    >
      <span aria-hidden className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-[2px]">
        {previews.slice(0, 4).map((image) => (
          <span key={image.src} className="relative overflow-hidden">
            <Image
              src={image}
              alt=""
              fill
              sizes="90px"
              placeholder="blur"
              className="object-cover transition-transform duration-200 group-hover:scale-[1.05]"
            />
          </span>
        ))}
      </span>
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-3/4 bg-text-1 opacity-[0.82] [mask-image:linear-gradient(to_bottom,transparent,black)]"
      />
      <span className="absolute inset-x-0 bottom-0 flex flex-col p-md text-primary-foreground">
        <span className="text-body-sm font-bold">{expanded ? lessLabel : label}</span>
        {expanded ? null : <span className="text-card-meta opacity-80">{countLabel}</span>}
      </span>
    </Link>
  );
}

/**
 * The categories behind More inside the Browse panel. They slide open under the ten tiles when More is clicked and
 * close again with "Show less". Closed, they stay in the page (links for Google) but cannot be reached or read.
 */
export function BrowseRest({ title, children }: { title: string; children: ReactNode }) {
  const panel = useContext(ExpandContext);
  const expanded = panel?.expanded ?? false;
  return (
    <div
      className={cn(
        "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
        expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
      )}
      aria-hidden={!expanded}
      inert={!expanded}
    >
      <div className="overflow-hidden">
        <p className="mt-lg border-t border-border-subtle pt-md text-section-label text-text-3">{title}</p>
        {children}
      </div>
    </div>
  );
}
