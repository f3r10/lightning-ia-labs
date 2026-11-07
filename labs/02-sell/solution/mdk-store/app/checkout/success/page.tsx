"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function Status() {
  const id = useSearchParams().get("checkout-id");
  const [status, setStatus] = useState("checking");

  // Ask our server, which asks moneydevkit. The page never decides "paid" by itself.
  useEffect(() => {
    if (!id) return;
    const timer = setInterval(async () => {
      const order = await (await fetch(`/api/orders/${id}`)).json();
      setStatus(order.status);
      if (order.status === "paid") clearInterval(timer);
    }, 2000);
    return () => clearInterval(timer);
  }, [id]);

  return (
    <main style={{ fontFamily: "system-ui", maxWidth: 520, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Your order</h1>
      <p>Status: <strong>{status}</strong></p>
    </main>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <Status />
    </Suspense>
  );
}
