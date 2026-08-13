"use client";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Users, 
  Building2, 
  TrendingUp,
  Edit,
  Trash2,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { PartnerDialog } from "@/components/partners/partner-dialog";

export default function PartnersPage() {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<string>();
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any>(null);
  
  const { data: partners, isLoading, refetch } = trpc.partner.list.useQuery({
    isActive: showInactive ? undefined : true,
    type: filterType as any,
  });
  
  const deletePartner = trpc.partner.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  const updatePartner = trpc.partner.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleAddPartner = () => {
    setEditingPartner(null);
    setDialogOpen(true);
  };

  const handleEditPartner = (partner: any) => {
    setEditingPartner(partner);
    setDialogOpen(true);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading partners...</div>
      </div>
    );
  }
  
  const totalPartners = partners?.length || 0;
  const activePartners = partners?.filter(p => p.isActive).length || 0;
  const totalBranches = partners?.reduce((sum, p) => sum + p._count.branches, 0) || 0;
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Partnership Management</h1>
          <p className="text-muted-foreground mt-1">Manage franchise partners and revenue sharing</p>
        </div>
        <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleAddPartner}>
          <Plus className="mr-2 h-4 w-4" />
          Add Partner
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Partners</p>
              <p className="text-2xl font-bold text-card-foreground">{totalPartners}</p>
            </div>
            <Users className="h-10 w-10 text-primary opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Partners</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activePartners}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400 opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Branches</p>
              <p className="text-2xl font-bold text-card-foreground">{totalBranches}</p>
            </div>
            <Building2 className="h-10 w-10 text-purple-600 dark:text-purple-400 opacity-50" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg shadow p-4 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Avg Revenue Share</p>
              <p className="text-2xl font-bold text-card-foreground">
                {partners && partners.length > 0 
                  ? (partners.reduce((sum, p) => sum + p.revenueSharePercent, 0) / partners.length).toFixed(1)
                  : 0}%
              </p>
            </div>
            <TrendingUp className="h-10 w-10 text-orange-600 dark:text-orange-400 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-card rounded-lg shadow p-4 mb-6 border border-border">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!filterType ? "default" : "outline"}
            onClick={() => setFilterType(undefined)}
          >
            All Types
          </Button>
          
          <Button
            variant={filterType === 'FRANCHISE' ? "default" : "outline"}
            onClick={() => setFilterType('FRANCHISE')}
          >
            Franchise
          </Button>
          
          <Button
            variant={filterType === 'PARTNER' ? "default" : "outline"}
            onClick={() => setFilterType('PARTNER')}
          >
            Partner
          </Button>
          
          <Button
            variant={filterType === 'INVESTOR' ? "default" : "outline"}
            onClick={() => setFilterType('INVESTOR')}
          >
            Investor
          </Button>
          
          <div className="ml-auto">
            <Button
              variant={showInactive ? "default" : "outline"}
              onClick={() => setShowInactive(!showInactive)}
            >
              {showInactive ? "Show Active Only" : "Show All"}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Partners Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {partners?.map((partner) => (
          <div 
            key={partner.id} 
            className={`bg-card rounded-lg shadow border border-border p-5 hover:shadow-md transition-shadow ${
              !partner.isActive ? 'opacity-75' : ''
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg text-card-foreground">{partner.name}</h3>
                  {partner.isActive ? (
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                  partner.type === 'FRANCHISE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-100' :
                  partner.type === 'PARTNER' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-100' :
                  'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-100'
                }`}>
                  {partner.type}
                </span>
              </div>
              <div className="flex gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0"
                  onClick={() => handleEditPartner(partner)}
                  title="Edit partner"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  onClick={() => {
                    if (confirm(`Delete partner ${partner.name}?`)) {
                      deletePartner.mutate({ id: partner.id });
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-card-foreground">{partner.email}</span>
              </div>
              {partner.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium text-card-foreground">{partner.phone}</span>
                </div>
              )}
            </div>
            
            {/* Revenue Share */}
            <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Revenue Share</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {partner.revenueSharePercent}%
                </span>
              </div>
            </div>
            
            {/* Branch Info */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {partner._count.branches} {partner._count.branches === 1 ? 'Branch' : 'Branches'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Joined {new Date(partner.joinedDate).toLocaleDateString()}
              </span>
            </div>
            
            {/* Branch List */}
            {partner.branches.length > 0 && (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Associated Branches:</p>
                <div className="space-y-1">
                  {partner.branches.map((bp) => (
                    <div key={bp.id} className="text-xs bg-muted rounded px-2 py-1 text-card-foreground">
                      {bp.branch.name} ({bp.branch.code})
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <Button 
                size="sm" 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  updatePartner.mutate({
                    id: partner.id,
                    isActive: !partner.isActive,
                  });
                }}
              >
                {partner.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          </div>
        ))}
      </div>
      
      {partners?.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <p className="text-foreground text-lg">No partners found</p>
          <p className="text-muted-foreground text-sm mt-2">Add your first partner to get started</p>
        </div>
      )}
      
      {/* Partner Performance Section */}
      {partners && partners.length > 0 && (
        <div className="mt-8 bg-card rounded-lg shadow p-6 border border-border">
          <h2 className="text-xl font-bold text-card-foreground mb-4">Partner Performance Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-2 text-left text-muted-foreground">Partner</th>
                  <th className="px-4 py-2 text-left text-muted-foreground">Type</th>
                  <th className="px-4 py-2 text-center text-muted-foreground">Branches</th>
                  <th className="px-4 py-2 text-right text-muted-foreground">Revenue Share %</th>
                  <th className="px-4 py-2 text-center text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-center text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-semibold text-card-foreground">{partner.name}</div>
                        <div className="text-xs text-muted-foreground">{partner.email}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                        partner.type === 'FRANCHISE' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-100' :
                        partner.type === 'PARTNER' ? 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-100' :
                        'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-100'
                      }`}>
                        {partner.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-card-foreground">{partner._count.branches}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {partner.revenueSharePercent}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {partner.isActive ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-4 w-4" />
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button size="sm" variant="outline">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PartnerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        partner={editingPartner}
        onSuccess={refetch}
      />
    </div>
  );
}
