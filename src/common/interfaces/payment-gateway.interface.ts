export interface PaymentGateway {
  initializePayment(data: PaymentInitializationData): Promise<PaymentGatewayResponse>;
  verifyPayment(reference: string): Promise<PaymentVerificationResponse>;
  processWebhook(payload: any, signature: string): Promise<WebhookProcessingResult>;
}

export interface PaymentInitializationData {
  email: string;
  amount: number; // Amount in kobo (for Paystack)
  currency?: string;
  reference?: string;
  callbackUrl?: string;
  metadata?: Record<string, any>;
  channels?: string[];
  customFields?: CustomField[];
}

export interface PaymentVerificationResponse {
  status: boolean;
  message: string;
  data: {
    reference: string;
    amount: number;
    currency: string;
    status: 'success' | 'failed' | 'abandoned';
    gateway_response: string;
    paid_at?: string;
    created_at: string;
    channel: string;
    authorization: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
    customer: {
      id: number;
      first_name?: string;
      last_name?: string;
      email: string;
      customer_code: string;
      phone?: string;
      metadata?: Record<string, any>;
    };
  };
}

export interface WebhookProcessingResult {
  isValid: boolean;
  event: string;
  data: any;
}

export interface CustomField {
  display_name: string;
  variable_name: string;
  value: string;
}

export interface PaymentGatewayResponse {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}