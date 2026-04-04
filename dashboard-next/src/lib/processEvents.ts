import { RawEvent, PipelineState, ApproachState, TuningIteration } from "../types";

export function processEvents(events: RawEvent[]): PipelineState | null {
  if (!events.length) return null;

  const state: PipelineState = {
    runId: "",
    taskDescription: "",
    datasetPath: "",
    maxApproaches: 5,
    maxTuningIterations: 3,
    startedAt: "",
    phase: "not_started",
    approaches: [],
  };

  const approachMap = new Map<string, ApproachState>();

  for (const ev of events) {
    switch (ev.event) {
      case "pipeline_started":
        state.runId = ev.run_id ?? "";
        state.startedAt = ev.ts;
        state.taskDescription = ev.task_description ?? "";
        state.datasetPath = ev.dataset_path ?? "";
        state.maxApproaches = ev.max_approaches ?? 5;
        state.maxTuningIterations = ev.max_tuning_iterations ?? 3;
        state.phase = "planning";
        break;

      case "plan_complete":
        state.planCompletedAt = ev.ts;
        state.estimatedCostUsd = ev.cost_estimate?.estimated_cost_usd;
        state.runBudgetUsd = ev.cost_estimate?.assumptions?.run_budget_usd;
        if (Array.isArray(ev.approaches)) {
          for (const a of ev.approaches) {
            if (!approachMap.has(a.name)) {
              approachMap.set(a.name, {
                name: a.name,
                framework: a.framework ?? "unknown",
                rationale: a.rationale,
                hyperparameters: a.hyperparameters,
                tuningIterations: [],
              });
            }
          }
          state.approaches = Array.from(approachMap.values());
        }
        break;

      case "codegen_phase_started":
        state.phase = "codegen";
        state.codegenStartedAt = ev.ts;
        break;

      case "code_generation_started": {
        const a = approachMap.get(ev.approach);
        if (a) a.codegenStartedAt = ev.ts;
        break;
      }

      case "code_generated": {
        const a = approachMap.get(ev.approach);
        if (a) {
          a.codegenCompletedAt = ev.ts;
          a.code = ev.code_preview ?? "";
        }
        break;
      }

      case "implementation_phase_started":
        state.phase = "training";
        state.trainingStartedAt = ev.ts;
        state.codegenCompletedAt = state.codegenCompletedAt ?? ev.ts;
        break;

      case "training_started": {
        const a = approachMap.get(ev.approach);
        if (!a) break;
        if (ev.phase === "initial") {
          a.trainingStartedAt = ev.ts;
        } else if (ev.phase === "tuning") {
          const iterIdx = (ev.iteration ?? 1) - 1;
          if (a.tuningIterations[iterIdx]) {
            a.tuningIterations[iterIdx].startedAt = ev.ts;
          }
        }
        break;
      }

      case "train_result": {
        const a = approachMap.get(ev.approach);
        if (!a) break;
        if (ev.phase === "initial") {
          a.trainingCompletedAt = ev.ts;
          a.initialMetrics = ev.metrics ?? {};
          a.initialError = ev.error ?? null;
        } else {
          const pending = [...a.tuningIterations]
            .reverse()
            .find((it) => !it.completedAt);
          if (pending) {
            pending.completedAt = ev.ts;
            pending.metrics = ev.metrics ?? {};
            pending.error = ev.error ?? null;
          }
        }
        state.approaches = Array.from(approachMap.values());
        break;
      }

      case "tuning_phase_started":
        state.phase = "tuning";
        state.tuningStartedAt = ev.ts;
        state.trainingCompletedAt = state.trainingCompletedAt ?? ev.ts;
        break;

      case "tuning_suggestion": {
        const a = approachMap.get(ev.approach);
        if (a) {
          const iter: TuningIteration = {
            iteration: ev.iteration ?? a.tuningIterations.length + 1,
            hyperparameters: ev.hyperparameters,
          };
          a.tuningIterations.push(iter);
        }
        break;
      }

      case "report_phase_started":
        state.phase = "reporting";
        state.reportStartedAt = ev.ts;
        state.tuningCompletedAt = state.tuningCompletedAt ?? ev.ts;
        break;

      case "report_complete":
        state.reportCompletedAt = ev.ts;
        state.report = ev.report_preview ?? "";
        break;

      case "pipeline_complete":
        state.phase = "complete";
        state.completedAt = ev.ts;
        state.recommendation = ev.recommendation ?? "";
        break;
    }
  }

  state.approaches = Array.from(approachMap.values());
  return state;
}
