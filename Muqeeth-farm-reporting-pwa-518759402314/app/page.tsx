import PageClient from "./page-client";

type PageProps = {
  date: string | undefined;
};

const today = new Date().toISOString().split("T")[0];

const isValidDate = (value: string) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageProps>;
}) {
  const params = await searchParams;
  const requestedDate = params?.date;
  const initialDate =
    requestedDate && isValidDate(requestedDate) ? requestedDate : today;

  return <PageClient initialDate={initialDate} />;
}
