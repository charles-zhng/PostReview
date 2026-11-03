import { Suspense } from "react";
import { ForumLoader } from "@/components/ForumLoader";

export default function ForumPage() {
  return (
    <Suspense>
      <ForumLoader />
    </Suspense>
  );
}
