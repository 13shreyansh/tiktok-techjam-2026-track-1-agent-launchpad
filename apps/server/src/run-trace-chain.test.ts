import { describe, expect, it } from "vitest";
import { linkRunTraceEvent, RUN_TRACE_GENESIS, verifyRunTraceChain } from "./run-trace-chain.js";
import type { RunTraceEvent } from "./types.js";

function trace(sequence: number, previousHash: string): RunTraceEvent {
  return linkRunTraceEvent(
    {
      id: `command-${sequence}:completed`,
      sequence,
      kind: "command",
      phase: "completed",
      title: "Command completed",
      summary: `command ${sequence}`,
      detail: "exit 0",
      exitCode: 0,
      at: `2026-08-31T00:00:0${sequence}.000Z`,
      updatedAt: `2026-08-31T00:00:0${sequence}.000Z`,
    },
    previousHash,
  );
}

describe("Runtime trace hash chain", () => {
  it("verifies immutable Runtime evidence", () => {
    const first = trace(1, RUN_TRACE_GENESIS);
    const second = trace(2, first.eventHash!);
    expect(verifyRunTraceChain([first, second])).toMatchObject({
      verified: true,
      hashedEvents: 2,
      head: second.eventHash,
    });
  });

  it("detects a rewritten command record", () => {
    const first = trace(1, RUN_TRACE_GENESIS);
    first.summary = "different command";
    expect(verifyRunTraceChain([first])).toMatchObject({
      verified: false,
      firstInvalidSequence: 1,
    });
  });
});
