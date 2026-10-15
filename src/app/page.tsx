import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Clocked In</h1>
      <Button>Get started</Button>
    </main>
  );
}
