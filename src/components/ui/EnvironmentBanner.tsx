import { AlertTriangle } from "lucide-react";
import { deploymentEnv } from "@/lib/deployment";

/**
 * Says out loud when a deployment is not production but writes as if it were.
 *
 * Preview, development and production all point at the same Neon database.
 * That is convenient and it is also a trap: a preview URL looks like a safe
 * place to press things, and publishing, unpublishing or deleting on one
 * changes the live gallery. This cost me two real photographs tonight while
 * testing bulk unpublish — I put them back, but the next person poking at a
 * preview link will not know they need to.
 *
 * The proper fix is a separate database branch for preview, which is a
 * dashboard action rather than a code one. Until then the least this can do
 * is stop the surprise being silent.
 *
 * Only on the contributor pages. The gallery is a full-bleed viewer whose
 * whole job is to show a photograph without furniture, and reading it does
 * not change anything — the risk lives entirely where the buttons are.
 */
export function EnvironmentBanner() {
  const env = deploymentEnv();
  if (env === "production") {
    return null;
  }

  /* The whole phrase, because "on a local development" does not read. */
  const where =
    env === "preview" ? "on a preview deployment" : "in local development";

  return (
    <div className="flex items-start gap-2.5 border-caution-edge border-b bg-caution-fill/[0.07] px-4 py-2.5 text-[0.8125rem] text-caution">
      <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={14} />
      <p>
        <span className="sr-only">Warning: </span>
        You are <strong className="font-semibold">{where}</strong>, sharing the
        live database. Publishing, unpublishing or deleting here changes the
        real gallery.
      </p>
    </div>
  );
}
