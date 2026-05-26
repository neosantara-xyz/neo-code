import NotFound2 from "@/components/ui/8bit/blocks/not-found2";

export default function NotFound() {
  return (
    <NotFound2
      title="404 — Page Not Found"
      description="This path does not exist. Maybe it was compacted away."
      cta="Back to Home"
      href="/"
      imageSrc="/neo-code-mark.svg"
    />
  );
}
