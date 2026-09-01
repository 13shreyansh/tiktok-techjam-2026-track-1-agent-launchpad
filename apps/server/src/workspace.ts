import { cp, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Agent } from "./types.js";

export class WorkspaceManager {
  constructor(private readonly root: string) {}

  workspacePath(agentId: string): string {
    return path.join(this.root, agentId);
  }

  async initialize(): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await mkdir(path.join(this.root, ".deleted"), { recursive: true });
    await mkdir(path.join(this.root, ".transactions"), { recursive: true });
  }

  transactionPath(runId: string): string {
    if (!/^[a-zA-Z0-9-]+$/.test(runId)) throw new Error("Invalid workspace transaction id");
    return path.join(this.root, ".transactions", runId);
  }

  async beginTransaction(runId: string, sourceWorkspace: string): Promise<string> {
    const scratch = this.transactionPath(runId);
    await rm(scratch, { recursive: true, force: true });
    await cp(sourceWorkspace, scratch, {
      recursive: true,
      preserveTimestamps: true,
      errorOnExist: true,
      force: false,
    });
    return scratch;
  }

  async commitTransaction(runId: string, destinationWorkspace: string): Promise<void> {
    const scratch = this.transactionPath(runId);
    await stat(scratch);
    const backup = this.transactionPath(`${runId}-backup`);
    await rm(backup, { recursive: true, force: true });
    await rename(destinationWorkspace, backup);
    try {
      await rename(scratch, destinationWorkspace);
      await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rename(backup, destinationWorkspace).catch(() => undefined);
      throw error;
    }
  }

  async discardTransaction(runId: string): Promise<void> {
    await rm(this.transactionPath(runId), { recursive: true, force: true });
  }

  async create(agent: Agent): Promise<void> {
    await mkdir(agent.workspacePath, { recursive: false });
    await this.writeInstructions(agent);
    await writeFile(
      path.join(agent.workspacePath, ".gitignore"),
      [".codex/", "node_modules/", "dist/", ".env", "*.log", ""].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(agent.workspacePath, "README.md"),
      [
        "# " + agent.name + " workspace",
        "",
        "Files created or edited by the Agent live here.",
        "The platform-generated AGENTS.md contains the current Agent instructions.",
        "",
      ].join("\n"),
      "utf8",
    );
  }

  async writeInstructions(agent: Agent): Promise<void> {
    const content = [
      "# Platform-managed Agent instructions",
      "",
      "You are the coding Agent named " + agent.name + ".",
      agent.description ? "Purpose: " + agent.description : "",
      "",
      "## Instructions",
      "",
      agent.instructions ||
        "Help the user complete coding tasks in this workspace. Explain material results concisely.",
      "",
      "## Workspace rules",
      "",
      "- Work only inside this workspace unless the user explicitly requests otherwise.",
      "- Preserve existing user files and avoid destructive operations.",
      "- Build and test changes when practical.",
      "- Never print environment variables or credentials.",
      "",
      "This file is regenerated when the Agent configuration is updated.",
      "",
    ]
      .filter((line, index, lines) => !(line === "" && lines[index - 1] === ""))
      .join("\n");
    await writeFile(path.join(agent.workspacePath, "AGENTS.md"), content, "utf8");
  }

  async archive(agent: Agent): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const destination = path.join(
      this.root,
      ".deleted",
      agent.id + "-" + timestamp,
    );
    await rename(agent.workspacePath, destination);
    return destination;
  }
}
