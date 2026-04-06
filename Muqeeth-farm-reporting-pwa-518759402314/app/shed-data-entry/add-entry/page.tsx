import { AddShedDataEntryClient } from "./add-shed-data-entry-client";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const date =
    (typeof params.date === "string" ? params.date : undefined) ||
    new Date().toISOString().split("T")[0];
  const shedId = typeof params.shedId === "string" ? params.shedId : null;

  return <AddShedDataEntryClient date={date} shedId={shedId} />;
}
