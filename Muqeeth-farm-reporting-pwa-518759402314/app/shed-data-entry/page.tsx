import { ShedDataEntryClient } from "./shed-data-entry-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const date =
    (typeof params.date === "string" ? params.date : undefined) ||
    new Date().toISOString().split("T")[0];

  return <ShedDataEntryClient date={date} />;
}
