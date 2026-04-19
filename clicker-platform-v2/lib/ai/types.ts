// Platform-level AI types — shared across all AI modules

export interface OpenRouterRequest {
  model: string;
  messages: { role: string; content: string | any[] }[];
  max_tokens?: number;
  temperature?: number;
}

export interface OpenRouterCallOptions {
  siteId: string;
  moduleId: string;    // for credit deduction & logging
  skillId: string;     // for logging
  creditCost: number;  // pre-calculated credit cost for this skill
  uid: string;         // user performing the action
}

export interface CreditBalance {
  balance: number;
  lifetimeUsed: number;
}

export interface CreditLedgerEntry {
  type: 'topup' | 'debit' | 'refund';
  amount: number;          // positive for topup/refund, negative for debit
  balanceAfter: number;
  moduleId: string;
  skillId: string;
  description?: string;
  performedBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  metadata?: Record<string, any>;
}

export interface InsufficientCreditsError {
  code: 'insufficient_credits';
  balance: number;
  required: number;
}
