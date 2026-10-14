import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Five stars, filled for the rating (rounded to the nearest whole star), like the app. `label` is the spoken rating. */
export function StarRating({
  rating,
  label,
  size = 14,
  className,
}: {
  rating: number | null;
  label: string;
  size?: number;
  className?: string;
}) {
  const filled = rating === null ? 0 : Math.round(rating);
  return (
    <span role="img" aria-label={label} className={cn("inline-flex gap-px", className)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.5}
          aria-hidden
          className={n <= filled ? "fill-current text-primary" : "text-text-4"}
        />
      ))}
    </span>
  );
}
