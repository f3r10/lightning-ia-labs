import { Suspense } from "react";
import CheckoutView from "./view";

// The checkout id is only known at request time, so the page renders inside Suspense.
export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p>Loading checkout...</p>}>
      <CheckoutView params={params} />
    </Suspense>
  );
}
