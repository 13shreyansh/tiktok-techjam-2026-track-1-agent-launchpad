import { describe, expect, it } from "vitest";
import { parseTaskPlan, taskPlanningPrompt } from "./task-planner.js";

describe("adaptive task planning boundary", () => {
  it("does not ask isolated transaction workers for unavailable Git evidence", () => {
    const prompt = taskPlanningPrompt("Audit the existing app and report observed evidence.");

    expect(prompt).toContain("isolated transactional workspace copies");
    expect(prompt).toContain("intentionally omit Git metadata");
    expect(prompt).toContain("Never require git status");
    expect(prompt).toContain("middleware receipts");
    expect(prompt).toContain("cannot open listening ports");
    expect(prompt).toContain("Never make localhost binding");
  });

  it("accepts detailed observable evidence produced by the planning contract", () => {
    const successEvidence = "Trusted-host evidence: " + "observable interaction; ".repeat(14);
    const plan = parseTaskPlan(
      "Build a Snake game.",
      JSON.stringify({
        summary: "Build a playable Snake game in the current workspace.",
        needsClarification: false,
        questions: [],
        rationale: "One builder can complete this cohesive feature without handoff overhead.",
        riskLevel: "low",
        workers: [
          {
            role: "builder",
            name: "Snake Game Builder",
            purpose: "Build and validate the complete playable game.",
            skills: ["frontend development"],
          },
        ],
        steps: [
          {
            id: "build",
            title: "Build the game",
            description: "Implement the complete playable Snake experience.",
            ownerRole: "builder",
            dependsOn: [],
            parallelSafe: false,
            successEvidence,
          },
        ],
      }),
    );

    expect(plan.steps[0]?.successEvidence).toBe(successEvidence.trim());
  });

  it("normalizes overlong planning prose instead of crashing a real task", () => {
    const plan = parseTaskPlan(
      "Build a creator launch tool.",
      JSON.stringify({
        summary: "Build a polished creator launch tool in the current workspace.",
        needsClarification: false,
        questions: [],
        rationale: "Four distinct outcomes justify separate task-specific responsibilities.",
        riskLevel: "low",
        workers: [
          {
            role: "builder",
            name: "Creator Tool Builder",
            purpose: "Build and validate the complete creator launch experience.",
            skills: ["frontend development"],
          },
        ],
        steps: [
          {
            id: "build",
            title: "Build the creator tool",
            description: "Implement the requested creator experience. ".repeat(20),
            ownerRole: "builder",
            dependsOn: [],
            parallelSafe: false,
            successEvidence: "Inspect the finished interactive experience. ".repeat(20),
          },
        ],
      }),
    );

    expect(plan.steps[0]?.description.length).toBeLessThanOrEqual(500);
    expect(plan.steps[0]?.successEvidence.length).toBeLessThanOrEqual(600);
  });
});
