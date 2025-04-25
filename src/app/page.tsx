"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/spinner";

export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    router.push("/bb");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <Spinner size="lg" />
    </div>
  );
}
