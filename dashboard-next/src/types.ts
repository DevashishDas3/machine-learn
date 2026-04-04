export type EventName =
  | "pipeline_started"
  | "plan_complete"
  | "budget_ok"
  | "codegen_phase_started"
  | "code_generation_started"
  | "code_generated"
  | "implementation_phase_started"
  | "training_started"
  | "train_result"
  | "tuning_phase_started"
  | "tuning_suggestion"
  | "report_phase_started"
  | "report_complete"
  | "pipeline_complete";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RawEvent = Record<string, any> & {
  ts: string;
  run_id: string;
  event: EventName;
};

export type NodeStatus = "pending" | "running" | "success" | "error" | "partial";

export interface TuningIteration {
  iteration: number;
  hyperparameters?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  metrics?: Record<string, number>;
  error?: string | null;
}

export interface ApproachState {
  name: string;
  framework: string;
  rationale?: string;
  hyperparameters?: Record<string, unknown>;
  // Codegen
  codegenStartedAt?: string;
  codegenCompletedAt?: string;
  code?: string;
  // Initial training
  trainingStartedAt?: string;
  trainingCompletedAt?: string;
  initialMetrics?: Record<string, number>;
  initialError?: string | null;
  // Tuning
  tuningIterations: TuningIteration[];
}

export type PipelinePhase =
  | "not_started"
  | "planning"
  | "codegen"
  | "training"
  | "tuning"
  | "reporting"
  | "complete";

export interface PipelineState {
  runId: string;
  taskDescription: string;
  datasetPath: string;
  maxApproaches: number;
  maxTuningIterations: number;
  startedAt: string;
  completedAt?: string;
  phase: PipelinePhase;
  // Phase timestamps
  planCompletedAt?: string;
  codegenStartedAt?: string;
  codegenCompletedAt?: string;
  trainingStartedAt?: string;
  trainingCompletedAt?: string;
  tuningStartedAt?: string;
  tuningCompletedAt?: string;
  reportStartedAt?: string;
  reportCompletedAt?: string;
  // Approaches
  approaches: ApproachState[];
  // Final
  recommendation?: string;
  report?: string;
  estimatedCostUsd?: number;
  runBudgetUsd?: number;
}
