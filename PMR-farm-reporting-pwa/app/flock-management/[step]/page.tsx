import { notFound } from "next/navigation";
import { FlockOptionDetailClient } from "./flock-option-detail-client";

const VALID_STEPS = new Set([
  "view-flock-data",
  "new-batch",
  "shed-transfer",
  "cull-bird-sales",
]);

export default async function FlockOptionDetailPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!VALID_STEPS.has(step)) {
    notFound();
  }

  return <FlockOptionDetailClient step={step} />;
}
