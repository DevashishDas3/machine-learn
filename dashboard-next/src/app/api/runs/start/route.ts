import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface LauncherPayload {
  ok: boolean;
  swarmRunId?: string;
  error?: string;
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
  const datasetZip = formData.get("datasetZip");

  if (!taskDescription) {
    return NextResponse.json({ error: "Task prompt is required." }, { status: 400 });
  }
  if (!(datasetZip instanceof File)) {
    return NextResponse.json({ error: "Dataset zip file is required." }, { status: 400 });
  }

  const launcherUrl = process.env.DASHBOARD_LAUNCHER_URL || "http://127.0.0.1:8001/start-run";

  try {
    const forward = new FormData();
    forward.append("user_id", user.id);
    forward.append("task_description", taskDescription);
    if (runName) {
      forward.append("run_name", runName);
    }
    forward.append("dataset_zip", datasetZip);

    const upstream = await fetch(launcherUrl, {
      method: "POST",
      body: forward,
    });

    const text = await upstream.text();
    let payload: LauncherPayload | { detail?: string } | null = null;
    try {
      payload = text ? (JSON.parse(text) as LauncherPayload | { detail?: string }) : null;
    } catch {
      payload = null;
    }

    if (!upstream.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? payload.detail
          : text || "Launcher service request failed.";
      return NextResponse.json(
        {
          error: "Launcher service failed to start run.",
          details: detail,
          launcherUrl,
        },
        { status: upstream.status || 500 }
      );
    }

    const result = payload as LauncherPayload | null;
    if (!result || !result.ok || !result.swarmRunId) {
      return NextResponse.json(
        {
          error: "Launcher response invalid.",
          details: result?.error || "Failed to start run.",
          launcherUrl,
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
        launcherUrl,
      },
      { status: 500 }
    );
  }
}
