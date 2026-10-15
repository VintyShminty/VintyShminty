import { ScrollToTop } from "@/components/scroll-to-top";

/** Shown at once when an item page opens: a photo block beside the buy card on a laptop, stacked on a phone. */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto max-w-[1280px] px-lg pb-2xl pt-lg md:px-xl lg:px-[48px] lg:pt-xl xl:px-[80px]"
    >
      <ScrollToTop />
      <div
        aria-hidden
        className="grid gap-x-2xl gap-y-lg lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_420px]"
      >
        <div className="flex">
          <div className="aspect-[3/4] flex-1 rounded-control bg-pressed max-md:-mx-lg max-md:rounded-none lg:h-[min(78vh,720px)] lg:flex-none" />
        </div>
        <div className="flex flex-col gap-lg lg:rounded-window lg:border lg:border-border lg:p-xl">
          <div className="h-7 w-3/4 rounded-full bg-pressed" />
          <div className="h-9 w-1/3 rounded-full bg-pressed" />
          <div className="h-4 w-1/2 rounded-full bg-surface" />
          <div className="h-12 w-full rounded-control bg-pressed" />
          <div className="h-12 w-full rounded-control bg-surface" />
        </div>
      </div>
    </main>
  );
}
