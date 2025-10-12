"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import InvoiceForm from "@/components/invoice-form-fixed";
import PrintButton from "@/components/print-button";

export default function InvoicePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  // @ts-expect-error custom role on session
  const role: string | undefined = session?.user?.role;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login?role=representative");
    } else if (status === "authenticated" && role && !["EMPLOYEE", "MANAGER", "ADMIN"].includes(role)) {
      router.push("/");
    }
  }, [status, role, router]);

  if (status === "loading" || !isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">فاتورة بيع</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          قم بإنشاء فاتورة جديدة وإضافة المنتجات والعملاء
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 sm:p-6">
          <InvoiceForm />
        </div>
      </div>
    </div>
  );
}
