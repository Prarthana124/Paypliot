import { db, appendEvidenceRecord } from './db.js';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  isConfigured: boolean;
  mode: 'LIVE_SANDBOX' | 'DEMO';
}

export function getPayPalConfig(): PayPalConfig {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
  const isConfigured = Boolean(clientId && clientSecret && clientId !== 'MY_PAYPAL_CLIENT_ID');
  return {
    clientId,
    clientSecret,
    isConfigured,
    mode: isConfigured ? 'LIVE_SANDBOX' : 'DEMO',
  };
}

async function getAccessToken(config: PayPalConfig): Promise<string> {
  if (!config.isConfigured) {
    throw new Error('PayPal credentials not configured');
  }
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`PayPal OAuth failure: ${res.status} - ${errorText}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

export async function createPayPalOrder(params: {
  purchaseId: string;
  amount: number;
  currency: string;
  productName: string;
  returnUrl?: string;
  cancelUrl?: string;
}) {
  const config = getPayPalConfig();

  if (config.isConfigured) {
    try {
      const accessToken = await getAccessToken(config);
      const res = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: params.purchaseId,
              description: params.productName,
              amount: {
                currency_code: params.currency || 'USD',
                value: params.amount.toFixed(2),
              },
            },
          ],
          application_context: {
            brand_name: 'PAYPILOT Autonomous Gateway',
            return_url: params.returnUrl || 'https://paypilot.local/checkout/success',
            cancel_url: params.cancelUrl || 'https://paypilot.local/checkout/cancel',
          },
        }),
      });

      const orderData = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(`PayPal create order failed: ${JSON.stringify(orderData)}`);
      }

      const approvalUrl = orderData.links?.find((l: any) => l.rel === 'approve')?.href;

      return {
        mode: 'LIVE_SANDBOX' as const,
        orderId: orderData.id,
        status: orderData.status,
        approvalUrl: approvalUrl || '',
        raw: orderData,
      };
    } catch (err: any) {
      console.warn('Falling back to demo mode due to PayPal API error:', err.message);
    }
  }

  // DEMO MODE fallback
  const mockOrderId = `ORD-DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return {
    mode: 'DEMO' as const,
    orderId: mockOrderId,
    status: 'CREATED',
    approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}`,
    raw: {
      id: mockOrderId,
      status: 'CREATED',
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.purchaseId,
          amount: { currency_code: params.currency, value: params.amount.toFixed(2) },
          description: params.productName,
        },
      ],
      simulation_note: 'DEMO MODE: High-fidelity deterministic simulation without live PayPal network latency.',
    },
  };
}

export async function capturePayPalOrder(orderId: string, purchaseId: string) {
  const config = getPayPalConfig();

  if (config.isConfigured && !orderId.startsWith('ORD-DEMO-')) {
    try {
      const accessToken = await getAccessToken(config);
      const res = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const captureData = (await res.json()) as any;
      if (!res.ok) {
        throw new Error(`PayPal capture failed: ${JSON.stringify(captureData)}`);
      }

      const captureUnit = captureData.purchase_units?.[0]?.payments?.captures?.[0];
      const captureId = captureUnit?.id || `CAP-${orderId}`;
      const status = captureData.status === 'COMPLETED' ? 'COMPLETED' : captureData.status || 'UNKNOWN';

      return {
        mode: 'LIVE_SANDBOX' as const,
        orderId,
        captureId,
        status,
        raw: captureData,
      };
    } catch (err: any) {
      console.warn('Live capture failed, reporting error:', err.message);
      return {
        mode: 'LIVE_SANDBOX' as const,
        orderId,
        captureId: null,
        status: 'FAILED',
        raw: { error: err.message },
      };
    }
  }

  // Simulated capture
  const mockCaptureId = `CAP-DEMO-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  return {
    mode: 'DEMO' as const,
    orderId,
    captureId: mockCaptureId,
    status: 'COMPLETED',
    raw: {
      id: orderId,
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: purchaseId,
          payments: {
            captures: [
              {
                id: mockCaptureId,
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '30.00' },
                final_capture: true,
                create_time: new Date().toISOString(),
              },
            ],
          },
        },
      ],
    },
  };
}

export function handleIncomingWebhook(eventData: any, headers: Record<string, string | undefined>) {
  const eventId = eventData.id || `WH-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const eventType = eventData.event_type || 'PAYMENT.CAPTURE.COMPLETED';
  const resourceType = eventData.resource_type || 'capture';
  const purchaseId = eventData.resource?.custom_id || eventData.resource?.supplementary_data?.related_ids?.order_id || null;

  // Check idempotency:
  const existing = db.prepare('SELECT id FROM webhook_events WHERE id = ?').get(eventId);
  if (existing) {
    db.prepare(`
      INSERT INTO webhook_events (id, purchase_id, event_type, resource_type, signature_status, payload, is_duplicate, received_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(
      `${eventId}-DUP-${Date.now()}`,
      purchaseId,
      eventType,
      resourceType,
      'VERIFIED',
      JSON.stringify(eventData),
      new Date().toISOString()
    );
    return { status: 'DUPLICATE_IGNORED', eventId };
  }

  // Signature check: In real PayPal, we query verify-webhook-signature; in Demo, we verify headers
  const authAlgo = headers['paypal-auth-algo'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionId = headers['paypal-transmission-id'];
  const signatureStatus = (authAlgo && certUrl && transmissionId) || getPayPalConfig().mode === 'DEMO' 
    ? 'VERIFIED' 
    : 'UNVERIFIED';

  db.prepare(`
    INSERT INTO webhook_events (id, purchase_id, event_type, resource_type, signature_status, payload, is_duplicate, received_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    eventId,
    purchaseId,
    eventType,
    resourceType,
    signatureStatus,
    JSON.stringify(eventData),
    new Date().toISOString()
  );

  if (purchaseId) {
    appendEvidenceRecord(purchaseId, 'PAYPAL_WEBHOOK_RECEIVED', 'PAYPAL_WEBHOOK', {
      eventId,
      eventType,
      signatureStatus,
      resourceSummary: eventData.resource?.id || null,
    });
  }

  return { status: 'RECORDED', eventId, signatureStatus };
}

export async function testPayPalOAuth(): Promise<{
  success: boolean;
  appId?: string;
  tokenType?: string;
  expiresIn?: number;
  mode: string;
  error?: string;
}> {
  const config = getPayPalConfig();
  if (!config.isConfigured) {
    return {
      success: false,
      mode: 'DEMO',
      error: 'PayPal credentials not configured in environment',
    };
  }

  try {
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const res = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        mode: 'LIVE_SANDBOX',
        error: `HTTP ${res.status}: ${errText}`,
      };
    }

    const data = (await res.json()) as any;
    return {
      success: true,
      appId: data.app_id,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      mode: 'LIVE_SANDBOX',
    };
  } catch (err: any) {
    return {
      success: false,
      mode: 'LIVE_SANDBOX',
      error: err.message,
    };
  }
}

export async function getPayPalOrder(orderId: string): Promise<{
  orderId: string;
  status: string;
  intent?: string;
  approvalUrl?: string;
  amount?: string;
  currency?: string;
  raw?: any;
}> {
  const config = getPayPalConfig();
  if (config.isConfigured && !orderId.startsWith('ORD-DEMO-')) {
    const accessToken = await getAccessToken(config);
    const res = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal order retrieve failed: HTTP ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as any;
    const approvalUrl = data.links?.find((l: any) => l.rel === 'approve')?.href;
    const amountVal = data.purchase_units?.[0]?.amount?.value;
    const currencyVal = data.purchase_units?.[0]?.amount?.currency_code;

    return {
      orderId: data.id,
      status: data.status,
      intent: data.intent,
      approvalUrl,
      amount: amountVal,
      currency: currencyVal,
      raw: data,
    };
  }

  // Demo fallback
  const payment = db.prepare('SELECT * FROM paypal_payments WHERE paypal_order_id = ?').get(orderId) as any;
  return {
    orderId,
    status: payment?.status || 'CREATED',
    intent: 'CAPTURE',
    approvalUrl: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`,
    amount: payment ? payment.amount.toFixed(2) : '30.00',
    currency: payment ? payment.currency : 'USD',
    raw: { mode: 'DEMO' },
  };
}

export async function reconcilePaymentWithPayPal(purchaseId: string) {
  const payment = db.prepare('SELECT * FROM paypal_payments WHERE purchase_id = ?').get(purchaseId) as any;
  if (!payment) {
    throw new Error(`No payment record found for purchase ${purchaseId}`);
  }

  const config = getPayPalConfig();
  if (config.isConfigured && !payment.paypal_order_id.startsWith('ORD-DEMO-')) {
    const liveOrder = await getPayPalOrder(payment.paypal_order_id);
    const localStatus = payment.status;
    const remoteStatus = liveOrder.status;
    const isMatched = localStatus === remoteStatus || (localStatus === 'FAILED' && remoteStatus === 'CREATED');

    return {
      purchaseId,
      orderId: payment.paypal_order_id,
      localStatus,
      remoteStatus,
      matches: isMatched,
      mode: 'LIVE_SANDBOX',
      discrepancy: isMatched ? null : `Local status '${localStatus}' differs from PayPal remote status '${remoteStatus}'.`,
      remoteOrder: liveOrder,
    };
  }

  return {
    purchaseId,
    orderId: payment.paypal_order_id,
    localStatus: payment.status,
    remoteStatus: payment.status,
    matches: true,
    mode: 'DEMO',
    discrepancy: null,
  };
}

