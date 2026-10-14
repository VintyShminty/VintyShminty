import { ItemGridSkeleton } from "@/components/item-grid";

/** Shown at once when a search starts, while the server builds the results. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]"
    >
      <div aria-hidden>
        <div className="h-9 w-72 rounded-control bg-pressed" />
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
