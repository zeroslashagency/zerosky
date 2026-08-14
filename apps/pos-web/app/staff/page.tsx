'use client';

import { Users, ShieldCheck, AlertCircle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-100',
  MANAGER: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100',
  CASHIER: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-100',
  WAITER: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100',
  KITCHEN: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-100',
};

export default function StaffPage() {
  const staffQuery = trpc.staff.list.useQuery(undefined, { retry: 1 });

  if (staffQuery.error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>{staffQuery.error.message}</span>
        </div>
      </div>
    );
  }

  const staff = staffQuery.data ?? [];

  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
      <div className="flex items-end justify-between">
        <div><h1 className="flex items-center gap-2 text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl"><Users strokeWidth={1.5} className="h-7 w-7" /> Staff</h1><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{staff.length} team member{staff.length === 1 ? '' : 's'}</p></div>
      </div>
      {staffQuery.isLoading ? <div className="mt-6 space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 shimmer rounded-2xl" />)}</div> : staff.length === 0 ? <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center"><Users strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium tracking-tight text-foreground">No staff found</p></div> : (
        <div className="mt-6">
          <div className="grid gap-3 sm:hidden">{staff.map((member) => <div key={member.id} className="bento-card p-4"><p className="font-medium tracking-tight text-foreground">{member.name}</p><p className="text-sm text-muted-foreground break-all">{member.email}</p><div className="mt-2 flex items-center gap-2"><span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', ROLE_STYLES[member.role] ?? 'bg-muted text-muted-foreground')}>{member.role}</span>{member.isActive ? <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><ShieldCheck strokeWidth={1.5} className="h-3 w-3" />Active</span> : <span className="text-xs text-muted-foreground">Inactive</span>}</div></div>)}</div>
          <div className="mt-6 hidden overflow-hidden rounded-[1.75rem] border border-border bg-card sm:block"><table className="w-full text-sm">
            <caption className="sr-only">Staff directory for this tenant</caption>
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{member.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-1 text-xs font-semibold',
                        ROLE_STYLES[member.role] ?? 'bg-muted text-muted-foreground',
                      )}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {member.isActive ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                        <ShieldCheck className="h-3 w-3" />
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
