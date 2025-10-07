import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminUsersTable from "@/components/admin-users-table";
import AdminNewUserToggle from "@/components/admin-new-user-toggle";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  // @ts-expect-error custom
  const role: string | undefined = session?.user?.role;
  if (!session) redirect("/login?role=manager");
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const [requesters, employees, managers] = await Promise.all([
    prisma.user.findMany({
      where: { role: "REQUESTER" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, username: true, email: true, phone: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: "EMPLOYEE" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, username: true, email: true, phone: true, createdAt: true },
    }),
    prisma.user.findMany({
      where: { role: "MANAGER" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, username: true, email: true, phone: true, createdAt: true },
    }),
  ]);

  // Aggregates: organization-wide and managers-only
  const managerIds = managers.map(m => m.id);
  const [orgAgg, mgrAgg] = await Promise.all([
    prisma.invoice.aggregate({ _count: { _all: true }, _sum: { total: true, collection: true, balance: true } }),
    prisma.invoice.aggregate({ where: { userId: { in: managerIds } }, _count: { _all: true }, _sum: { total: true, collection: true, balance: true } }),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-semibold mb-2">Users</h1>
      <p className="text-sm text-muted-foreground mb-6">Approve customers as Representatives (employees) or keep them as customers.</p>

      {/* Create new user: available to MANAGER and ADMIN */}
      {(role === "MANAGER" || role === "ADMIN") && <AdminNewUserToggle />}

      {(() => { const egp = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP" }); return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-muted-foreground">إجمالي معاملات المؤسسة</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted-foreground">عدد الفواتير</div><div className="font-semibold">{orgAgg._count?._all || 0}</div></div>
            <div><div className="text-muted-foreground">إجمالي المبيعات</div><div className="font-semibold">{egp.format(Number(orgAgg._sum.total || 0))}</div></div>
            <div><div className="text-muted-foreground">إجمالي التحصيل</div><div className="font-semibold">{egp.format(Number(orgAgg._sum.collection || 0))}</div></div>
            <div><div className="text-muted-foreground">إجمالي المديونيات</div><div className="font-semibold">{egp.format(Number(orgAgg._sum.balance || 0))}</div></div>
          </div>
        </div>
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-4">
          <div className="text-sm text-muted-foreground">إجمالي معاملات المدير</div>
          <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
            <div><div className="text-muted-foreground">عدد الفواتير</div><div className="font-semibold">{mgrAgg._count?._all || 0}</div></div>
            <div><div className="text-muted-foreground">إجمالي المبيعات</div><div className="font-semibold">{egp.format(Number(mgrAgg._sum.total || 0))}</div></div>
            <div><div className="text-muted-foreground">إجمالي التحصيل</div><div className="font-semibold">{egp.format(Number(mgrAgg._sum.collection || 0))}</div></div>
            <div><div className="text-muted-foreground">إجمالي المديونيات</div><div className="font-semibold">{egp.format(Number(mgrAgg._sum.balance || 0))}</div></div>
          </div>
        </div>
      </div>
      ); })()}

      <AdminUsersTable requesters={requesters} employees={employees} managers={managers} />
    </div>
  );
}
