import { describe, expect, it } from "vitest";
import { hashRelayEvent, RELAY_EVENT_GENESIS, verifyRelayEventChain } from "./event-chain.js";
import type { RelayEvent } from "./relay-types.js";

function linkedEvent(sequence: number, previousHash: string): RelayEvent {
  const payload: Omit<RelayEvent, "previousHash" | "eventHash"> = {
    id: `session:event:${sequence}`,
    sessionId: "session",
    sequence,
    type: sequence === 1 ? "session.started" : "turn.assigned",
    at: `2026-08-31T00:00:0${sequence}.000Z`,
    turnId: sequence === 1 ? null : "session:turn:1",
    agentId: null,
    runId: null,
    attempt: null,
    detail: sequence === 1 ? "Started" : "Assigned",
    fromAgentId: null,
    toAgentId: null,
  };
  return {
    ...payload,
    previousHash,
    eventHash: hashRelayEvent(payload, previousHash),
  };
}

describe("Agent Flight Recorder hash chain", () => {
  it("verifies an unmodified chain from genesis", () => {
    const first = linkedEvent(1, RELAY_EVENT_GENESIS);
    const second = linkedEvent(2, first.eventHash!);
    expect(verifyRelayEventChain([first, second])).toMatchObject({
      verified: true,
      completeFromGenesis: true,
      hashedEvents: 2,
      firstInvalidSequence: null,
      head: second.eventHash,
    });
  });

  it("identifies the first rewritten event", () => {
    const first = linkedEvent(1, RELAY_EVENT_GENESIS);
    const second = linkedEvent(2, first.eventHash!);
    second.detail = "Rewritten after the fact";
    expect(verifyRelayEventChain([first, second])).toMatchObject({
      verified: false,
      hashedEvents: 1,
      firstInvalidSequence: 2,
    });
  });
});
