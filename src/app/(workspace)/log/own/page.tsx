import type { Metadata } from "next";
import { Suspense } from "react";
import { OwnTimeView } from "./own-view";

export const metadata: Metadata = { title: "Log time" };

type Search = { from?: string; to?: string };

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

export default function OwnTimePage({ searchParams }: PageProps<"/log/own">) {
  return (
    <Suspense fallback={null}>
      <OwnTime searchParams={searchParams} />
    </Suspense>
  );
}

async function OwnTime({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const range = {
    from: search.from && dateOnly.test(search.from) ? search.from : undefined,
    to: search.to && dateOnly.test(search.to) ? search.to : undefined,
  };
  return <OwnTimeView range={range} />;
}
