import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export default function BlockedPage() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 border border-red-400/30 text-red-300">
          <ShieldAlert size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Account restricted</h1>
          <p className="mt-2 text-sm text-white/70 max-w-xs">
            This Apron account has been banned due to a violation of our terms.
            If you believe this is an error, please contact support.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Link href="/login">
            <Button variant="primary">Back to Sign in</Button>
          </Link>
          <a href="mailto:support@apron.example">
            <Button>Contact Support</Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
