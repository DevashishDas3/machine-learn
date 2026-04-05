import { createServerSupabaseClient } from "@/lib/supabase-server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LauncherPayload {
  ok: boolean;
  swarmRunId?: string;
  error?: string;
}

interface LaunchStrategy {
  label: string;
  command: string;
  args: string[];
}

function getPythonCandidates(backendDir: string): string[] {
  const envOverride = process.env.PYTHON_BIN?.trim();
  const candidates = [
    envOverride,
    path.join(backendDir, ".venv", "Scripts", "python.exe"),
    path.join(backendDir, ".venv", "bin", "python"),
    "python",
    "python3",
    "py",
  ].filter((v): v is string => Boolean(v));

  const unique: string[] = [];
  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      if (!existsSync(candidate)) continue;
    }
    if (!unique.includes(candidate)) unique.push(candidate);
  }
  return unique;
}

function runLauncher(command: string, args: string[], cwd: string): Promise<LauncherPayload> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      const raw = stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
      if (!raw) {
        reject(new Error(stderr || `Launcher exited with code ${code ?? "unknown"}`));
        return;
      }
      try {
        const parsed = JSON.parse(raw) as LauncherPayload;
        resolve(parsed);
      } catch {
        reject(new Error(stderr || raw));
      }
    });
  });
}

function buildLaunchStrategies(
  backendDir: string,
  launcherArgs: string[],
  pythonCandidates: string[]
): LaunchStrategy[] {
  const strategies: LaunchStrategy[] = pythonCandidates.map((pythonBin) => ({
    label: pythonBin,
    command: pythonBin,
    args: launcherArgs,
  }));

  strategies.push({
    label: "uv run --project <backend> python",
    command: "uv",
    args: ["run", "--project", backendDir, "python", ...launcherArgs],
  });

  return strategies;
}

async function saveUpload(file: File, dir: string, prefix: string): Promise<string> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const cleanName = (file.name || `${prefix}.bin`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = path.join(dir, `${prefix}_${cleanName}`);
  await fs.writeFile(filePath, bytes);
  return filePath;
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const runName = String(formData.get("runName") ?? "").trim();
  const taskDescription = String(formData.get("taskDescription") ?? "").trim();
  const dataset = formData.get("dataset");
  const labels = formData.get("labels");

  if (!taskDescription) {
    return NextResponse.json({ error: "Task prompt is required." }, { status: 400 });
  }
  if (!(dataset instanceof File)) {
    return NextResponse.json({ error: "Dataset file is required." }, { status: 400 });
  }
  if (!(labels instanceof File)) {
    return NextResponse.json({ error: "Labels file is required." }, { status: 400 });
  }

  const repoRoot = path.resolve(process.cwd(), "..");
  const backendDir = process.env.DASHBOARD_BACKEND_DIR || path.join(repoRoot, "modal-agent-swarm");
  const launcherPath = path.join(backendDir, "start_dashboard_run.py");
  if (!existsSync(backendDir)) {
    return NextResponse.json(
      {
        error: "Backend directory not found for dashboard launcher.",
        details: `Checked: ${backendDir}`,
      },
      { status: 500 }
    );
  }
  if (!existsSync(launcherPath)) {
    return NextResponse.json(
      {
        error: "Python launcher script not found.",
        details: `Expected: ${launcherPath}`,
      },
      { status: 500 }
    );
  }

  const pythonCandidates = getPythonCandidates(backendDir);
  if (pythonCandidates.length === 0) {
    return NextResponse.json(
      {
        error: "No Python executable found.",
        details:
          "Set PYTHON_BIN or create modal-agent-swarm/.venv. Tried checking common Python locations.",
        backendDir,
        launcherPath,
      },
      { status: 500 }
    );
  }

  const tempDir = path.join(os.tmpdir(), `dashboard-run-${randomUUID()}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    const datasetPath = await saveUpload(dataset, tempDir, "dataset");
    const labelsPath = await saveUpload(labels, tempDir, "labels");

    const launcherArgs = [
      launcherPath,
      "--user-id",
      user.id,
      "--task-description",
      taskDescription,
      "--dataset-local-path",
      datasetPath,
      "--labels-local-path",
      labelsPath,
    ];

    if (runName) {
      launcherArgs.push("--run-name", runName);
    }

    const launchStrategies = buildLaunchStrategies(
      backendDir,
      launcherArgs,
      pythonCandidates
    );

    let result: LauncherPayload | null = null;
    let lastError: Error | null = null;
    const attemptedStrategies: string[] = [];

    for (const strategy of launchStrategies) {
      attemptedStrategies.push(strategy.label);
      try {
        result = await runLauncher(strategy.command, strategy.args, backendDir);
        break;
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err?.code === "ENOENT") {
          lastError = new Error(
            `${strategy.label} not available: ${err.message || "executable not found"}`
          );
          continue;
        }
        throw error;
      }
    }

    if (!result) {
      const details =
        lastError?.message ||
        "Could not find a usable Python executable (tried python, python3, py, and .venv).";
      return NextResponse.json(
        {
          error: "Unable to launch Python subprocess.",
          details,
          triedPython: attemptedStrategies,
          backendDir,
          launcherPath,
        },
        { status: 500 }
      );
    }

    if (!result.ok || !result.swarmRunId) {
      return NextResponse.json(
        {
          error: "Launcher failed to start the run.",
          details: result.error || "Failed to start run.",
          triedPython: attemptedStrategies,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, swarmRunId: result.swarmRunId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start run.";
    return NextResponse.json(
      {
        error: "Unexpected error while starting run.",
        details: message,
        triedPython: [...pythonCandidates, "uv run --project <backend> python"],
        backendDir,
        launcherPath,
      },
      { status: 500 }
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}
