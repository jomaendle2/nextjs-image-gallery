import type { Metadata } from "next";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = {
  title: "Not found — the beauty of earth.",
  /*
   * A 404 that gets indexed competes with the pages that should be. Next
   * already answers with a 404 status; this keeps the page out of the index
   * even where a crawler reached it by a route that returned 200.
   */
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <StatusPage
      detail="The page you were after has moved, or the photographer is no longer showing their work here."
      title="There's nothing at this address"
    />
  );
}
