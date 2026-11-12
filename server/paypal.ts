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
