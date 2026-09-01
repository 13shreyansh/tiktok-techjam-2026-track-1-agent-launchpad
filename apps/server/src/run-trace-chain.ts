import { createHash } from "node:crypto";
import type { RunTraceEvent } from "./types.js";

export const RUN_TRACE_GENESIS = "GENESIS";

function tracePayload(event: Omit<RunTraceEvent, "previousHash" | "eventHash">): string {
  return JSON.stringify({
    id: event.id,
    sequence: event.sequence,
    kind: event.kind,
    phase: event.phase,
    title: event.title,
    summary: event.summary,
    detail: event.detail,
    exitCode: event.exitCode,
    at: event.at,
    updatedAt: event.updatedAt,
  });
}

export function linkRunTraceEvent(
  event: Omit<RunTraceEvent, "previousHash" | "eventHash">,
  previousHash: string,
): RunTraceEvent {
  return {
    ...event,
    previousHash,
    eventHash: createHash("sha256")
      .update(previousHash)
      .update("\n")
      .update(tracePayload(event))
      .digest("hex"),
  };
}

export function verifyRunTraceChain(events: RunTraceEvent[]): {
  verified: boolean;
  hashedEvents: number;
  totalEvents: number;
  head: string | null;
  firstInvalidSequence: number | null;
} {
  let previousHash = RUN_TRACE_GENESIS;
  let hashedEvents = 0;
  for (const event of events) {
    if (!event.previousHash || !event.eventHash) {
      return {
        verified: false,
        hashedEvents,
        totalEvents: events.length,
        head: hashedEvents ? events[hashedEvents - 1]?.eventHash ?? null : null,
        firstInvalidSequence: event.sequence,
      };
    }
    const { previousHash: recordedPrevious, eventHash, ...payload } = event;
    const linked = linkRunTraceEvent(payload, previousHash);
    if (recordedPrevious !== previousHash || eventHash !== linked.eventHash) {
      return {
        verified: false,
        hashedEvents,
        totalEvents: events.length,
        head: hashedEvents ? events[hashedEvents - 1]?.eventHash ?? null : null,
        firstInvalidSequence: event.sequence,
      };
    }
    previousHash = eventHash;
    hashedEvents += 1;
  }
  return {
    verified: true,
    hashedEvents,
    totalEvents: events.length,
    head: events.at(-1)?.eventHash ?? null,
    firstInvalidSequence: null,
  };
}
