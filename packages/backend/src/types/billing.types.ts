export interface PaymentHistory {
  id: string;
  user_id: string;
  membership_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_invoice_id: string | null;
  stripe_charge_id: string | null;
  stripe_subscription_id: string | null;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  invoice_url: string | null;
  receipt_url: string | null;
  invoice_pdf: string | null;
  description: string;
  metadata: Record<string, string>;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface StripeWebhookEvent {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}
