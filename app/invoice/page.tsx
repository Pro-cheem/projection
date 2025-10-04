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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">فاتورة بيع</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            قم بإنشاء فاتورة جديدة وإضافة المنتجات والعملاء
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a 
            href="/journal" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            اليومية
          </a>
          <a 
            href="/customers" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            العملاء
          </a>
          <a 
            href="/products" 
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            المنتجات
          </a>
          <PrintButton className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500" />
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-xl overflow-hidden">
        <div className="p-6">
          <InvoiceForm />
        </div>
      </div>
    </div>
  );
}
