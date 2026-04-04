import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

function runsLocalPath() {
  const env = process.env.RUNS_LOCAL_PATH;
  return env
    ? path.resolve(process.cwd(), env)
    : path.join(process.cwd(), "..", "runs_local");
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const eventsPath = path.join(runsLocalPath(), runId, "events.jsonl");
  try {
    const text = await readFile(eventsPath, "utf-8");
    const events = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    return NextResponse.json({ events });
  } catch {
    return NextResponse.json({ events: [] });
  }
}
