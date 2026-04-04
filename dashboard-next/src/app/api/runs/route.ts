import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";

function runsLocalPath() {
  const env = process.env.RUNS_LOCAL_PATH;
  return env
    ? path.resolve(process.cwd(), env)
    : path.join(process.cwd(), "..", "runs_local");
}

export async function GET() {
  const root = runsLocalPath();
  try {
    const entries = await readdir(root);
    const dirs: string[] = [];
    for (const entry of entries) {
      try {
        const s = await stat(path.join(root, entry));
        if (s.isDirectory()) dirs.push(entry);
      } catch {}
    }
    dirs.sort().reverse();
    return NextResponse.json({ runs: dirs });
  } catch {
    return NextResponse.json({ runs: [] });
  }
}
