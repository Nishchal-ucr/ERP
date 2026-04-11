import { notFound } from "next/navigation";
import { OtherOptionDetailClient } from "./other-option-detail-client";

const VALID_STEPS = new Set([
  "view-flock-data",
  "new-batch",
  "shed-transfer",
  "cull-bird-sales",
  "manage-parties",
  "overwrite-feed-closing",
  "overwrite-shed-closing",
  "manage-feed-items",
  "manage-feed-formulations",
]);

export default async function OtherOptionDetailPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!VALID_STEPS.has(step)) {
    notFound();
  }

  return <OtherOptionDetailClient step={step} />;
}
