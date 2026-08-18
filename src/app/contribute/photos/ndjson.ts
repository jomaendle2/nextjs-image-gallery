/**
 * A response body, read one JSON document per line as they arrive.
 *
 * Its own module because the interesting part is the boundary, not the
 * parsing: a chunk from the network is a slice of bytes with no respect for
 * line endings or for UTF-8 character boundaries, so a naive reader loses a
 * record every time one straddles two chunks — and it loses it rarely, on a
 * slow connection, in a way that never reproduces on a laptop next to the
 * server. That is a thing to test rather than to read carefully, and
 * `ndjson.test.ts` feeds it exactly those splits.
 *
 * `TextDecoder` with `stream: true` is what holds a half-arrived multi-byte
 * character between chunks. Written without it, an accented place name
 * arriving across a boundary becomes a replacement character in somebody's
 * form.
 */
export async function* readNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<unknown> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  try {
    while (true) {
      // biome-ignore lint/performance/noAwaitInLoops: the loop *is* the read — each chunk arrives when the network delivers it, and there is no set of promises to await together
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      pending += decoder.decode(value, { stream: true });

      /*
       * Everything up to the last newline is complete; whatever follows it is
       * the beginning of the next record and waits for more bytes.
       */
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim() !== "") {
          yield JSON.parse(line);
        }
      }
    }

    /*
     * A last record with no trailing newline. The route always writes one, so
     * this is the case where the connection ended mid-write — parsed if it
     * happens to be whole, dropped if it is not, because half a record is not
     * an error worth showing anybody who is already about to be told the
     * stream stopped.
     */
    const last = pending.trim();
    if (last !== "") {
      try {
        yield JSON.parse(last);
      } catch {
        /* Truncated. Nothing to say about it that the caller cannot see. */
      }
    }
  } finally {
    /*
     * Releasing the lock rather than cancelling. A consumer that stops early
     * — `break` in a `for await`, or a component unmounting — reaches here
     * through the generator's own return path, and cancelling a body the
     * caller may still be holding is not this function's decision to make.
     */
    reader.releaseLock();
  }
}
