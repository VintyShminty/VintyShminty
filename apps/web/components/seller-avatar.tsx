/** A round avatar with the first letter of the name when there is no photo. */
export function SellerAvatar({
  url,
  name,
  size,
  className = "",
}: {
  url: string | null;
  name: string;
  size: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pressed text-body font-bold text-primary ${className}`}
    >
      {url ? (
        // biome-ignore lint/performance/noImgElement: a small avatar, no image optimisation on purpose
        <img src={url} alt="" width={size} height={size} className="h-full w-full object-cover" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}
