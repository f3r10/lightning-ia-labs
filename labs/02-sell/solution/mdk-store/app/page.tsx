"use client";
import { useCheckout } from "@moneydevkit/nextjs";
import { useState } from "react";

export default function Home() {
  const { createCheckout, isLoading } = useCheckout();
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setError(null);
    const result = await createCheckout({
      type: "AMOUNT",
      title: "Coffee",
      description: "One coffee",
      amount: 500,
      currency: "SAT",
      successUrl: "/checkout/success",
      metadata: { item: "coffee" },
    });
    if (result.error) return setError(result.error.message);
    window.location.href = result.data.checkoutUrl;
  }

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 520, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Lab Store (moneydevkit)</h1>
      <p>Coffee: 500 sats</p>
      <button onClick={buy} disabled={isLoading}>{isLoading ? "Creating checkout..." : "Buy coffee"}</button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </main>
  );
}
