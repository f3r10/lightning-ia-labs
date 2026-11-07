// moneydevkit calls this when a checkout is paid. This is where you fulfill the order.
// The signature check proves that the message comes from moneydevkit.
import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";

export async function POST(request: Request) {
  const secret = process.env.MDK_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "MDK_WEBHOOK_SECRET is not set" }, { status: 500 });

  const body = await request.text();
  let payload: { type: string; data: { amountSats?: number; metadata?: Record<string, unknown> } };
  try {
    payload = new Webhook(secret).verify(body, {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    }) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (payload.type === "checkout.completed") {
    // Fulfill here: send the product, unlock content, email the buyer.
    console.log(`Order paid: ${JSON.stringify(payload.data.metadata ?? {})}, ${payload.data.amountSats} sats`);
  }
  return NextResponse.json({ received: true });
}
