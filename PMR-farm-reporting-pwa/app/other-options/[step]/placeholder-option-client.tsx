"use client";

type PlaceholderOptionClientProps = {
  description: string;
};

export function PlaceholderOptionClient({
  description,
}: PlaceholderOptionClientProps) {
  return (
    <div className="space-y-3 px-4 py-6 text-center text-sm text-muted-foreground">
      <p>{description}</p>
      <p className="text-xs">Details coming soon.</p>
    </div>
  );
}
