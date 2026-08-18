import { describe, expect, it } from "vitest";
import { readNdjson } from "./ndjson";

/**
 * The reader, fed the chunk boundaries a network actually produces.
 *
 * Every one of these passes with a naive implementation that splits each
 * chunk on newlines — except the ones where a record or a character is cut in
 * half, which is exactly the failure that only happens to other people on
 * slower connections. So those are the point of this file.
 */

/** A body that hands over exactly these byte slices, in this order. */
function bodyOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
}

function bytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

async function collect(chunks: Uint8Array[]): Promise<unknown[]> {
  const records: unknown[] = [];
  for await (const record of readNdjson(bodyOf(chunks))) {
    records.push(record);
  }
  return records;
}

describe("reading newline-delimited JSON", () => {
  it("reads whole lines from one chunk", async () => {
    expect(await collect([bytes('{"a":1}\n{"a":2}\n')])).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  /* The one that matters: a record split across two reads. */
  it("joins a record that arrives in two pieces", async () => {
    expect(await collect([bytes('{"title":"Low '), bytes('tide"}\n')])).toEqual(
      [{ title: "Low tide" }],
    );
  });

  it("holds a line with no newline yet until one arrives", async () => {
    const records = await collect([
      bytes('{"a":1}\n{"a":2'),
      bytes('}\n{"a":3}\n'),
    ]);

    expect(records).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  /*
   * A multi-byte character cut in half. Without `stream: true` on the
   * decoder this comes back as "Bo?blingen" with a replacement character —
   * in somebody's location field, in production, on a slow connection.
   */
  it("joins a character that arrives in two pieces", async () => {
    const place = "Böblingen";
    const whole = bytes(`{"location":"${place}"}\n`);
    const split = whole.indexOf(0xc3); // the first byte of "ö"

    const records = await collect([
      whole.slice(0, split + 1),
      whole.slice(split + 1),
    ]);

    expect(records).toEqual([{ location: "Böblingen" }]);
  });

  it("reads a last record that has no trailing newline", async () => {
    expect(await collect([bytes('{"a":1}\n{"a":2}')])).toEqual([
      { a: 1 },
      { a: 2 },
    ]);
  });

  /* A connection that stopped mid-record says nothing rather than throwing. */
  it("drops a truncated last record", async () => {
    expect(await collect([bytes('{"a":1}\n{"a":')])).toEqual([{ a: 1 }]);
  });

  it("ignores blank lines", async () => {
    expect(await collect([bytes('\n{"a":1}\n\n')])).toEqual([{ a: 1 }]);
  });

  it("reads nothing from an empty body", async () => {
    expect(await collect([])).toEqual([]);
  });
});
