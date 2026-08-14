'use client';

import { trpc } from '@/lib/trpc';
import { Button } from '@zerosky/ui';
import { Plus, Users, Building2, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { useState } from 'react';
import { PartnerDialog } from '@/components/partners/partner-dialog';

export default function PartnersPage() {
  const [filterType, setFilterType] = useState<string>();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- PartnerDialog typed per router schema
  const [editingPartner, setEditingPartner] = useState<any>(null);
  const { data: partners, isLoading, refetch } = trpc.partner.list.useQuery({ isActive: showInactive ? undefined : true, type: filterType as 'FRANCHISE' | 'PARTNER' | 'INVESTOR' | undefined });
  const deletePartner = trpc.partner.delete.useMutation({ onSuccess: () => refetch() });
  const updatePartner = trpc.partner.update.useMutation({ onSuccess: () => refetch() });
  const handleAddPartner = () => { setEditingPartner(null); setDialogOpen(true); };
  const handleEditPartner = (partner: typeof editingPartner) => { setEditingPartner(partner); setDialogOpen(true); };
  if (isLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bento-card h-24" />)}</div></div></div>;
  const totalPartners = partners?.length || 0;
  const activePartners = partners?.filter((p) => p.isActive).length || 0;
  const totalBranches = partners?.reduce((sum, p) => sum + p._count.branches, 0) || 0;
  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Partners</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">Franchise · partner · investor · revenue share</p></div>
          <Button onClick={handleAddPartner} className="rounded-full min-h-[44px] w-full sm:w-auto active:scale-[0.98] transition"><Plus strokeWidth={1.5} className="mr-2 h-4 w-4" /> Add Partner</Button>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TOTAL</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{totalPartners}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">ACTIVE</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">{activePartners}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">BRANCHES</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{totalBranches}</p></div>
          <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">AVG SHARE</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{partners && partners.length > 0 ? (partners.reduce((sum, p) => sum + p.revenueSharePercent, 0) / partners.length).toFixed(1) : 0}%</p></div>
        </div>
        <div className="bento-card mt-6 p-3">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Button variant={!filterType ? 'default' : 'outline'} onClick={() => setFilterType(undefined)} size="sm" className="rounded-full">All</Button>
            <Button variant={filterType === 'FRANCHISE' ? 'default' : 'outline'} onClick={() => setFilterType('FRANCHISE')} size="sm" className="rounded-full">Franchise</Button>
            <Button variant={filterType === 'PARTNER' ? 'default' : 'outline'} onClick={() => setFilterType('PARTNER')} size="sm" className="rounded-full">Partner</Button>
            <Button variant={filterType === 'INVESTOR' ? 'default' : 'outline'} onClick={() => setFilterType('INVESTOR')} size="sm" className="rounded-full">Investor</Button>
            <div className="ml-auto"><Button variant={showInactive ? 'default' : 'outline'} onClick={() => setShowInactive(!showInactive)} size="sm" className="rounded-full">{showInactive ? 'Active only' : 'Show all'}</Button></div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {partners?.map((partner) => (
            <div key={partner.id} className={`bento-card p-5 ${!partner.isActive ? 'opacity-75' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="font-semibold tracking-tight text-foreground">{partner.name}</h3>{partner.isActive ? <CheckCircle strokeWidth={1.5} className="h-4 w-4 text-emerald-500" /> : <XCircle strokeWidth={1.5} className="h-4 w-4 text-muted-foreground" />}</div><span className="mt-1 inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium tracking-wide text-muted-foreground">{partner.type}</span></div>
                <div className="flex gap-1 shrink-0"><Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => handleEditPartner(partner)} aria-label="Edit"><Edit strokeWidth={1.5} className="h-4 w-4" /></Button><Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full text-destructive" onClick={() => { if (confirm(`Delete partner ${partner.name}?`)) deletePartner.mutate({ id: partner.id }); }} aria-label="Delete"><Trash2 strokeWidth={1.5} className="h-4 w-4" /></Button></div>
              </div>
              <dl className="mt-4 space-y-1.5 text-sm">
                <div className="flex gap-2"><dt className="text-muted-foreground">Email</dt><dd className="ml-auto truncate font-medium text-foreground">{partner.email}</dd></div>
                {partner.phone && <div className="flex gap-2"><dt className="text-muted-foreground">Phone</dt><dd className="ml-auto font-medium text-foreground">{partner.phone}</dd></div>}
              </dl>
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-800 dark:bg-emerald-950"><div className="flex items-center justify-between"><span className="text-xs font-medium tracking-wide text-muted-foreground">Revenue share</span><span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">{partner.revenueSharePercent}%</span></div></div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Building2 strokeWidth={1.5} className="h-3 w-3" />{partner._count.branches} branch{partner._count.branches === 1 ? '' : 'es'}</span><span>Joined {new Date(partner.joinedDate).toLocaleDateString()}</span></div>
              {partner.branches.length > 0 && <div className="mt-3 border-t border-border pt-3"><p className="text-xs font-medium tracking-wide text-muted-foreground">Branches</p><div className="mt-2 flex flex-wrap gap-1.5">{partner.branches.map((bp) => <span key={bp.id} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">{bp.branch.name} · {bp.branch.code}</span>)}</div></div>}
              <Button size="sm" variant="outline" className="mt-4 w-full rounded-full" onClick={() => updatePartner.mutate({ id: partner.id, isActive: !partner.isActive })}>{partner.isActive ? 'Deactivate' : 'Activate'}</Button>
            </div>
          ))}
        </div>
        {partners?.length === 0 && <div className="mx-auto mt-10 max-w-md rounded-[2.5rem] border border-dashed border-border bg-card/50 p-10 text-center"><Users strokeWidth={1.5} className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium tracking-tight text-foreground">No partners</p><p className="mt-1 text-sm text-muted-foreground">Add your first partner to get started.</p></div>}
        {partners && partners.length > 0 && <div className="bento-card mt-8 overflow-hidden p-0"><div className="border-b border-border px-5 py-4"><h2 className="font-semibold tracking-tight text-foreground">Performance overview</h2></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Partner</th><th className="px-4 py-3">Type</th><th className="px-4 py-3 text-center">Branches</th><th className="px-4 py-3 text-right">Share</th><th className="px-4 py-3 text-center">Status</th></tr></thead><tbody className="divide-y divide-border">{partners.map((partner) => <tr key={partner.id} className="hover:bg-muted/50"><td className="px-4 py-3"><span className="font-medium text-foreground">{partner.name}</span><span className="block text-xs text-muted-foreground">{partner.email}</span></td><td className="px-4 py-3"><span className="rounded-full border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{partner.type}</span></td><td className="px-4 py-3 text-center font-mono text-foreground">{partner._count.branches}</td><td className="px-4 py-3 text-right font-mono font-medium text-emerald-700 dark:text-emerald-300">{partner.revenueSharePercent}%</td><td className="px-4 py-3 text-center">{partner.isActive ? <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle strokeWidth={1.5} className="h-3 w-3" />Active</span> : <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle strokeWidth={1.5} className="h-3 w-3" />Inactive</span>}</td></tr>)}</tbody></table></div></div>}
        <PartnerDialog open={dialogOpen} onOpenChange={setDialogOpen} partner={editingPartner} onSuccess={refetch} />
      </div>
    </div>
  );
}
