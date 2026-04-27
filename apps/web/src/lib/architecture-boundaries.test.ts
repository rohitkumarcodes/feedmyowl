import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(
  new URL("../../../../scripts/check-architecture-boundaries.mjs", import.meta.url),
);

let tempRoots: string[] = [];

function createFixtureProject(files: Record<string, string>) {
  const root = mkdtempSync(path.join(os.tmpdir(), "feedmyowl-boundaries-"));
  tempRoots.push(root);

  for (const [repoPath, contents] of Object.entries(files)) {
    const filePath = path.join(root, repoPath);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents, "utf8");
  }

  return root;
}

function runBoundaryCheck(projectRoot: string) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ARCHITECTURE_BOUNDARY_PROJECT_ROOT: projectRoot,
    },
    encoding: "utf8",
  });
}

describe("architecture boundary check", () => {
  afterEach(() => {
    for (const root of tempRoots) {
      rmSync(root, { force: true, recursive: true });
    }
    tempRoots = [];
  });

  it("allows service SDK imports from the boundary file", () => {
    const root = createFixtureProject({
      "apps/web/src/lib/server/auth.ts":
        'import { auth } from "@clerk/nextjs/server";\nexport { auth };\n',
    });

    const result = runBoundaryCheck(root);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Architecture boundary check passed.");
  });

  it("rejects service SDK imports outside the boundary file", () => {
    const root = createFixtureProject({
      "apps/web/src/features/auth/bad.ts":
        'import { auth } from "@clerk/nextjs/server";\nexport { auth };\n',
    });

    const result = runBoundaryCheck(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Architecture boundary check failed.");
    expect(result.stderr).toContain("apps/web/src/features/auth/bad.ts");
    expect(result.stderr).toContain("apps/web/src/lib/server/auth.ts");
  });
});
