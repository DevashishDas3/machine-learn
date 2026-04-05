export interface FlowchartData {
  stages: StageData[];
  connections: ConnectionData[];
}

export interface StageData {
  id: string;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  startedAt?: string;
  completedAt?: string;
  metrics?: Record<string, number>;
  details?: string;
}

export interface ConnectionData {
  from: string;
  to: string;
  active: boolean;
}

export interface FinalReport {
  accuracy?: number;
  loss?: number;
  totalTimeGpu?: number;
  bestHyperparameters?: Record<string, unknown>;
  recommendation?: string;
  report?: string;
}

export interface ChatMessage {
  id: string;
  role: "system" | "agent" | "user";
  content: string;
  timestamp: string;
  stage?: string;
}

export interface SwarmRun {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  status: "pending" | "running" | "complete" | "error";
  current_phase: string;
  flowchart_data: FlowchartData | null;
  final_report: FinalReport | null;
  chat_messages: ChatMessage[];
}
