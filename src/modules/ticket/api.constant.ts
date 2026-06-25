export const CHANNELS = ["app", "sms", "call_center", "merchant_portal"] as const;
export const LOCALES = ["bn", "en", "mixed"] as const;

export const CASE_TYPES = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "phishing_or_social_engineering",
  "other",
] as const;

export const SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const DEPARTMENTS = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "fraud_risk",
] as const;

export const CLASSIFICATION_CONFIDENCE = 0.85;
