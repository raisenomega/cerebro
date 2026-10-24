/**
 * Datos de prueba de NÚCLEO con las formas REALES (doc de alineación §1):
 *   - customer.created  -> customer_profiles        (-> internal)
 *   - order.created     -> tenant_landing_orders     (status de los 8; -> internal)
 *   - payment.received  -> invoice_payments ⋈ invoices (-> financial)
 * Identidad = email, la clave real de NÚCLEO: (tenant_id, lower(trim(email))).
 * NÚCLEO no tiene outbox: el v1 usa este seed para alimentar CEREBRO.
 */
import type { CerebroEvent, IdentityRef } from "@raisenomega/cerebro-contracts";

const NUCLEO = "nucleo";

export interface NucleoSeedCustomer {
  /** tenants.id de NÚCLEO (uuid). Debe estar mapeado en owner_platform_tenant. */
  readonly tenantId: string;
  readonly email: string;
  readonly fullName: string;
  /** Teléfono laxo (NÚCLEO no normaliza); CEREBRO lo llevaría a E.164 si se usa como identidad. */
  readonly phone?: string;
}

interface OrderSpec {
  readonly order_number: string;
  readonly status: string; // uno de los 8: pending|awaiting_payment|paid|processing|shipped|delivered|canceled|refunded
  readonly total: number;
  readonly paid_at: string | null;
  readonly occurred_at: string;
  readonly items: ReadonlyArray<{ readonly sku: string; readonly qty: number }>;
}

export function buildNucleoSeedEvents(c: NucleoSeedCustomer): CerebroEvent[] {
  const identity: IdentityRef = { id_type: "email", id_value: c.email };

  const customerCreated: CerebroEvent = {
    event: "customer.created",
    source_platform: NUCLEO,
    tenant_id: c.tenantId,
    occurred_at: "2026-01-10T15:00:00Z",
    identity,
    payload: {
      id: "cust_0001",
      tenant_id: c.tenantId,
      email: c.email,
      phone: c.phone ?? null,
      full_name: c.fullName,
      source: "landing_order", // enum real: manual/portal/landing_order/lead/import
      user_id: null,
    },
  };

  const orders = [
    makeOrder(c, identity, {
      order_number: "ORD-1001",
      status: "delivered",
      total: 150.0,
      paid_at: "2026-02-01T18:00:00Z",
      occurred_at: "2026-01-20T16:00:00Z",
      items: [{ sku: "BOX-M", qty: 2 }],
    }),
    makeOrder(c, identity, {
      order_number: "ORD-1002",
      status: "shipped",
      total: 89.5,
      paid_at: "2026-03-05T12:00:00Z",
      occurred_at: "2026-03-01T10:00:00Z",
      items: [{ sku: "BOX-S", qty: 1 }],
    }),
    makeOrder(c, identity, {
      order_number: "ORD-1003",
      status: "pending",
      total: 42.0,
      paid_at: null,
      occurred_at: "2026-04-02T09:00:00Z",
      items: [{ sku: "TAPE", qty: 3 }],
    }),
  ];

  const paymentReceived: CerebroEvent = {
    event: "payment.received",
    source_platform: NUCLEO,
    tenant_id: c.tenantId,
    occurred_at: "2026-02-01T18:05:00Z",
    identity, // el pago alcanza al cliente por invoices.customer_id; aquí resolvemos por email
    payload: {
      invoice_id: "inv_5001",
      customer_id: "cust_0001",
      amount: 150.0,
      payment_date: "2026-02-01",
      method: "card",
    },
  };

  return [customerCreated, ...orders, paymentReceived];
}

function makeOrder(c: NucleoSeedCustomer, identity: IdentityRef, o: OrderSpec): CerebroEvent {
  return {
    event: "order.created",
    source_platform: NUCLEO,
    tenant_id: c.tenantId,
    occurred_at: o.occurred_at,
    identity,
    payload: {
      id: `ord_${o.order_number}`,
      tenant_id: c.tenantId,
      order_number: o.order_number,
      customer_id: "cust_0001",
      customer_email: c.email,
      customer_name: c.fullName,
      customer_phone: c.phone ?? null,
      items: o.items,
      total: o.total,
      status: o.status,
      paid_at: o.paid_at,
    },
  };
}
