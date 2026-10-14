import { ItemGridSkeleton } from "@/components/item-grid";

/** Shown at once when a seller page opens: the header block, then the grid. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto max-w-[1280px] px-lg pb-2xl pt-xl md:px-xl lg:px-[48px] xl:px-[80px]"
    >
      <div aria-hidden className="flex items-center gap-lg">
        <div className="h-20 w-20 shrink-0 rounded-full bg-pressed" />
        <div className="flex flex-1 flex-col gap-sm">
          <div className="h-6 w-48 rounded-full bg-pressed" />
          <div className="h-4 w-72 max-w-full rounded-full bg-surface" />
        </div>
      </div>
      <div className="mt-xl">
        <ItemGridSkeleton count={10} />
      </div>
    </main>
  );
}
