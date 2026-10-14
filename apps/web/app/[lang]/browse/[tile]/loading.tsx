import { ItemGridSkeleton } from "@/components/item-grid";

/** Shown at once when a Browse tile is clicked, while the server builds the results (breadcrumb, title, types, grid). */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]"
    >
      <div aria-hidden>
        <div className="h-4 w-40 rounded-full bg-pressed" />
        <div className="mt-sm h-9 w-64 rounded-control bg-pressed" />
        <div className="-mx-lg mt-lg flex gap-md overflow-hidden px-lg md:mx-0 md:px-0">
          {Array.from({ length: 6 }, (_, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <div key={n} className="h-[100px] w-[150px] shrink-0 rounded-control bg-pressed" />
          ))}
        </div>
        <div className="mb-xl mt-lg flex gap-sm">
          {Array.from({ length: 5 }, (_, n) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholders have no identity
            <div key={n} className="h-[29px] w-20 shrink-0 rounded-full bg-surface" />
          ))}
        </div>
      </div>
      <ItemGridSkeleton count={10} />
    </main>
  );
}
