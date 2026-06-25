import { chatWithAI } from "../../lib/openrouter.js";
import { prisma } from "../../lib/prisma.js";
import {
  CASE_TYPES,
  DEPARTMENTS,
  SEVERITIES,
} from "./api.constant.js";
import type { SortTicketRequest, SortTicketResponse } from "./api.type.js";

// ─── Decision Matrix Prompt ───────────────────────────────────────────────────

const buildPrompt = (payload: SortTicketRequest): string => `
You are a financial support ticket classifier for a mobile banking system.

Classify the customer complaint below using the DECISION MATRIX and return ONLY a valid JSON object. No explanation, no markdown, no code blocks — raw JSON only.

## DECISION MATRIX

| case_type                       | When to use                                                                 | severity       | department          |
|---------------------------------|-----------------------------------------------------------------------------|----------------|---------------------|
| wrong_transfer                  | Money sent to wrong number/recipient. Keywords: wrong number, wrong recipient, ভুল নম্বর, ভুলে পাঠিয়েছি, mistakenly sent | high           | dispute_resolution  |
| payment_failed                  | Payment/transaction failed but balance may be deducted. Keywords: failed, deducted, টাকা কেটে গেছে, পেমেন্ট হয়নি | high           | payments_ops        |
| refund_request                  | Customer wants money back. If only mind changed → low. If contested/serious → medium/high | low or medium  | customer_support or dispute_resolution |
| phishing_or_social_engineering  | OTP, PIN, password, CVV, suspicious call/SMS, scammer, phishing, fake sms  | critical       | fraud_risk          |
| other                           | General issues: app crash, slow app, login problem, unclear complaint        | low            | customer_support    |

## STRICT RULES

1. human_review_required = true ONLY if case_type is "phishing_or_social_engineering" OR severity is "critical".
2. confidence must be a float between 0.0 and 1.0 representing your certainty.
3. agent_summary must be 1–2 neutral sentences describing what the customer reported.
   - NEVER ask the customer to share OTP, PIN, password, CVV, or full card number.
   - NEVER include instructions — only factual description of the issue.
   - BAD: "Customer should provide OTP to verify account."
   - GOOD: "Customer reports receiving a suspicious call asking for OTP."
4. ticket_id must exactly match the input ticket_id: "${payload.ticket_id}".
5. All field values must come strictly from these allowed sets:
   - case_type: wrong_transfer | payment_failed | refund_request | phishing_or_social_engineering | other
   - severity: low | medium | high | critical
   - department: customer_support | dispute_resolution | payments_ops | fraud_risk
   - human_review_required: true | false
6. Input may be in Bengali (bn), English (en), or mixed. Handle all three.

## INPUT

ticket_id: ${payload.ticket_id}
channel: ${payload.channel ?? "not specified"}
locale: ${payload.locale ?? "not specified"}
message: ${payload.message}

## OUTPUT FORMAT (raw JSON, nothing else)

{
  "ticket_id": "${payload.ticket_id}",
  "case_type": "<one of the allowed values>",
  "severity": "<one of the allowed values>",
  "department": "<one of the allowed values>",
  "agent_summary": "<neutral 1-2 sentence description>",
  "human_review_required": <true or false>,
  "confidence": <0.0 to 1.0>
}
`.trim();

// ─── Response Parser & Validator ─────────────────────────────────────────────

/**
 * Extracts and validates the JSON from the AI response.
 * The model sometimes wraps output in markdown code blocks — we strip those.
 */
const parseAIResponse = (
  raw: string,
  ticketId: string,
): SortTicketResponse => {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`);
  }

  // Validate and coerce each field
  const ticket_id =
    typeof parsed["ticket_id"] === "string" ? parsed["ticket_id"] : ticketId;

  const case_type = CASE_TYPES.includes(parsed["case_type"] as never)
    ? (parsed["case_type"] as SortTicketResponse["case_type"])
    : "other";

  const severity = SEVERITIES.includes(parsed["severity"] as never)
    ? (parsed["severity"] as SortTicketResponse["severity"])
    : "low";

  const department = DEPARTMENTS.includes(parsed["department"] as never)
    ? (parsed["department"] as SortTicketResponse["department"])
    : "customer_support";

  const agent_summary =
    typeof parsed["agent_summary"] === "string" && parsed["agent_summary"].length > 0
      ? parsed["agent_summary"]
      : "Customer submitted a support request that requires review.";

  // Enforce human_review_required rule: must be true for phishing or critical
  const aiHumanReview = parsed["human_review_required"] === true;
  const human_review_required =
    case_type === "phishing_or_social_engineering" ||
    severity === "critical" ||
    aiHumanReview;

  const rawConfidence = Number(parsed["confidence"]);
  const confidence =
    isFinite(rawConfidence) && rawConfidence >= 0 && rawConfidence <= 1
      ? rawConfidence
      : 0.7;

  return {
    ticket_id,
    case_type,
    severity,
    department,
    agent_summary,
    human_review_required,
    confidence,
  };
};

// ─── DB Logging ───────────────────────────────────────────────────────────────

const logClassification = async (
  payload: SortTicketRequest,
  result: SortTicketResponse,
): Promise<void> => {
  try {
    await prisma.ticketLog.create({
      data: {
        ticketId: payload.ticket_id,
        channel: payload.channel ?? null,
        locale: payload.locale ?? null,
        message: payload.message,
        caseType: result.case_type,
        severity: result.severity,
        department: result.department,
        agentSummary: result.agent_summary,
        humanReviewRequired: result.human_review_required,
        confidence: result.confidence,
      },
    });
  } catch (error) {
    // Non-fatal — log but don't fail the response
    console.error("Ticket classification logging failed:", error);
  }
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const sortTicket = async (
  payload: SortTicketRequest,
): Promise<SortTicketResponse> => {
  const prompt = buildPrompt(payload);
  const rawAIResponse = await chatWithAI(prompt);

  console.log("AI raw response:", rawAIResponse);

  const result = parseAIResponse(rawAIResponse, payload.ticket_id);

  await logClassification(payload, result);

  return result;
};
