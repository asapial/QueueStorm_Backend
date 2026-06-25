import type { CASE_TYPES, CHANNELS, DEPARTMENTS, LOCALES, SEVERITIES } from "./api.constant.js";

export type Channel = (typeof CHANNELS)[number];
export type Locale = (typeof LOCALES)[number];
export type CaseType = (typeof CASE_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type Department = (typeof DEPARTMENTS)[number];

export type SortTicketRequest = {
  ticket_id: string;
  channel?: Channel | undefined;
  locale?: Locale | undefined;
  message: string;
};

export type SortTicketResponse = {
  ticket_id: string;
  case_type: CaseType;
  severity: Severity;
  department: Department;
  agent_summary: string;
  human_review_required: boolean;
  confidence: number;
};
