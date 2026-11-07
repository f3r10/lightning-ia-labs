"use client";
import { Checkout } from "@moneydevkit/nextjs";
import { use } from "react";

export default function CheckoutView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Checkout id={id} />;
}
