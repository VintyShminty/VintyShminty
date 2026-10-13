import type { LocalisedName, ReferenceData } from "@vinty/shared";
import type { Option } from "@/components/sell/option-list-sheet";

/** Every size of every group, with the group name as the heading (Clothing, Shoes and so on). Used by My sizes and the sign up question. */
export function buildSizeOptions(
  groups: ReferenceData["sizeGroups"],
  name: (value: LocalisedName | null | undefined) => string,
): Option[] {
  return groups.flatMap((group) =>
    group.sizes.map((size, i) => ({
      id: size.id,
      label: name(size.name),
      section: i === 0 ? name(group.name) : undefined,
    })),
  );
}

/** "M, L" for up to three sizes, "4 sizes picked" for more, `none` for nothing. */
export function summariseSizes(
  sizeIds: string[],
  options: Option[],
  text: { none: string; count: (n: number) => string },
): string {
  if (sizeIds.length === 0) return text.none;
  if (sizeIds.length > 3) return text.count(sizeIds.length);
  return sizeIds
    .map((id) => options.find((o) => o.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}
