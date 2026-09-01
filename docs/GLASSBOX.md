# Glassbox

Glassbox answers four questions while an Agent job is running:

1. Which Agent is working?
2. What observable action is it taking?
3. Did that action finish or fail?
4. If a worker or coordinator stopped, what was preserved and reassigned?

The browser does not invent this activity. `CodexRunner` parses the Runtime's
JSONL stream and persists progress messages, commands and exit codes, file
changes, tool calls, web searches, and lifecycle events on the `AgentRun`.
JetStream separately stores the authoritative assignment, checkpoint, stop,
retry, duplicate-rejection, and coordinator-recovery events. The UI merges the
two sources by timestamp, attributes them to Agent and Run IDs, and retains the
full scrollable sequence after completion. Evidence exports include both the
durable Relay session and every available Run trace.

## Interaction model

Glassbox stays compact during ordinary work. The always-visible surface names
the current Agent and action, reports whether the evidence is live or recorded,
shows event and recovery totals, and lists the three newest updates. This keeps
the conversation, controls, and workspace preview visible.

**View full activity** expands Glassbox inline rather than opening a cover or
modal. Its seven receipts summarize Glassbox, Coordinator, Recovery, Kill Switch,
Bouncer, the Flight Recorder, and the Proof Gate before the complete chronological record.
Each entry shows its Runtime or Middleware source, Agent, time, summary, full
Run ID, and raw recorded evidence. No event is hidden by a display cap; closing
the detail view returns to the compact live surface.

The Proof Gate receipt is independent of the worker's prose. It displays the
latest trusted-host mobile and desktop screenshots beside viewport size,
browser-error count, overflow measurement, and screenshot SHA-256. The
underlying `preview.attested` or `preview.attestation-failed` event stays in the
same raw chronology. A failed load remains failed evidence; it is never replaced
with a success animation.

Glassbox deliberately does not expose hidden model reasoning. It redacts common
credential shapes and the local username before trace storage, but this is not
a complete data-loss-prevention system. The Bouncer now records its policy
attachment plus every observed allow/deny decision in the same activity stream;
the compact view reports **Bouncer on** or the number of blocked actions, and
the full view retains the exact redacted action and reason. Glassbox itself
remains an observer. Bouncer enforces only its documented deletion patterns,
and neither feature undoes external network side effects. Coordinated file
changes are separately isolated in per-Run transactions until acceptance.

Kill Switch uses a distinct control event. Compact Glassbox reports the number
of unique stopped Run IDs. Full Glassbox retains the request, termination
result, rejected-output statement, Agent, time, and Run ID alongside any
durable interruption/retry events. A control event is evidence from the
backend cancellation path, not a browser-only status change.

The clearest live demonstration is: enter an ordinary build request, watch the
compact current-Agent feed while the preview remains visible, open the grouped
full record to inspect real commands and evidence, stop the active worker,
observe the exact Run cancellation and reassignment, then return to the live
preview and its independent Proof Gate receipts. No fault injection is needed
for that path.
