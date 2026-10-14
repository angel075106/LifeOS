"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

/** Sign-out for screens rendered outside the app providers (e.g. setup errors). */
export function PlainSignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        loading={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          const { error } = await createClient().auth.signOut({ scope: "local" });
          setPending(false);
          if (error) {
            setFailed(true);
            return;
          }
          router.replace("/auth/login");
          router.refresh();
        }}
      >
        Sign out
      </Button>
      {failed ? (
        <span role="alert" className="text-xs text-expense">
          Couldn&apos;t sign out. Check your connection.
        </span>
      ) : null}
    </div>
  );
}
