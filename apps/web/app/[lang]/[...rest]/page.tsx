import { notFound } from "next/navigation";

/** Any address under /en or /he that has no page: show the same friendly not-found page, inside the top bar and footer. */
export default function UnknownPage() {
  notFound();
}
