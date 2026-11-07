// Reads an order's status from moneydevkit, on the server.
// The browser cannot change it: only a settled payment makes moneydevkit report PAYMENT_RECEIVED.
import { NextResponse } from "next/server";
import { getCheckout } from "@moneydevkit/core";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const checkout = await getCheckout((await params).id);
    const status = checkout.status === "PAYMENT_RECEIVED" ? "paid" : checkout.status === "EXPIRED" ? "expired" : "pending";
    return NextResponse.json({ id: checkout.id, status });
  } catch {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }
}
