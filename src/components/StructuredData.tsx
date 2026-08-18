/**
 * `</script>` inside a JSON string value would close the tag early and turn
 * whatever follows into markup. Escaping every `<` is the mitigation Next's
 * own guidance prescribes, and doing it here means no page has to remember.
 */
const OPENING_ANGLE = /</g;

/**
 * Emits one JSON-LD block.
 *
 * A native `<script>` rather than `next/script`: this is data, not code, and
 * nothing should be optimising when it executes.
 */
export function StructuredData({ data }: { data: object }) {
  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: the only way to emit JSON-LD; the payload is server-built and escaped
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(OPENING_ANGLE, "\\u003c"),
      }}
      type="application/ld+json"
    />
  );
}
