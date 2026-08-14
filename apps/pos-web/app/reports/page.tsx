"use client";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@zerosky/ui";
import { Calendar, Download } from "lucide-react";
import { useState } from "react";
import { objectArrayToCsv, downloadCsv } from "@/lib/csv";

export default function ReportsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState(() => ({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  }));
  const [activeTab, setActiveTab] = useState<'sales' | 'items' | 'gst' | 'hourly'>('sales');
  
  const { data: summary, isLoading: summaryLoading } = trpc.reports.salesSummary.useQuery({
    tenantId: user?.tenantId || "",
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  
  const { data: topItems } = trpc.reports.topItems.useQuery({
    tenantId: user?.tenantId || "",
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    limit: 10,
  });
  
  const { data: dailySales } = trpc.reports.dailySales.useQuery({
    tenantId: user?.tenantId || "",
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const { data: gstReport } = trpc.reports.gstReport.useQuery({
    tenantId: user?.tenantId || "",
    month: currentMonth,
    year: currentYear,
  }, { enabled: activeTab === 'gst' });
  
  const { data: hourlySales } = trpc.reports.hourlySales.useQuery({
    tenantId: user?.tenantId || "",
    date: new Date().toISOString().split('T')[0],
  }, { enabled: activeTab === 'hourly' });
  
  const { data: inventoryValuation } = trpc.reports.inventoryValuation.useQuery({
    tenantId: user?.tenantId || "",
  }, { enabled: activeTab === 'sales' });
  
  const handleExport = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    
    if (activeTab === 'sales' && dailySales) {
      const csvData = dailySales.map((day) => ({
        Date: new Date(day.date).toLocaleDateString(),
        Orders: day.orders,
        Revenue: `₹${day.revenue.toFixed(2)}`,
        Tax: `₹${day.tax.toFixed(2)}`,
        Discount: `₹${day.discount.toFixed(2)}`,
      }));
      const csv = objectArrayToCsv(csvData);
      downloadCsv(csv, `zerosky-sales-${timestamp}.csv`);
    } else if (activeTab === 'items' && topItems) {
      const csvData = topItems.map((item, idx) => ({
        Rank: idx + 1,
        Item: item.item?.name || 'Unknown',
        Category: item.item?.category.name || 'Unknown',
        Quantity: item.totalQuantity,
        Revenue: `₹${item.totalRevenue.toFixed(2)}`,
        Orders: item.orderCount,
      }));
      const csv = objectArrayToCsv(csvData);
      downloadCsv(csv, `zerosky-top-items-${timestamp}.csv`);
    } else if (activeTab === 'gst' && gstReport) {
      const csvData = gstReport.breakdown.map((item) => ({
        'Tax Rate': `${item.rate}%`,
        'Taxable Value': `₹${item.taxableValue.toFixed(2)}`,
        'CGST': `₹${item.cgst.toFixed(2)}`,
        'SGST': `₹${item.sgst.toFixed(2)}`,
        'IGST': `₹${item.igst.toFixed(2)}`,
        'Total Tax': `₹${(item.cgst + item.sgst + item.igst).toFixed(2)}`,
      }));
      const csv = objectArrayToCsv(csvData);
      downloadCsv(csv, `zerosky-gst-${timestamp}.csv`);
    } else if (activeTab === 'hourly' && hourlySales) {
      const csvData = hourlySales.map((hour) => ({
        Hour: `${hour.hour}:00`,
        Orders: hour.orders,
        Revenue: `₹${hour.revenue.toFixed(2)}`,
      }));
      const csv = objectArrayToCsv(csvData);
      downloadCsv(csv, `zerosky-hourly-${timestamp}.csv`);
    }
  };

  if (summaryLoading) return <div className="bento-canvas min-h-[100dvh] p-6"><div className="mx-auto max-w-[1400px] space-y-4"><div className="h-8 w-40 shimmer rounded-xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bento-card h-24" />)}</div></div></div>;
  return (
    <div className="bento-canvas min-h-[100dvh] p-4 sm:p-6">
      <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-4xl font-semibold tracking-tighter leading-none text-foreground md:text-5xl">Reports</h1><p className="mt-2 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">Business insights · performance metrics</p></div>
        <Button onClick={handleExport} className="rounded-full min-h-[44px] w-full sm:w-auto active:scale-[0.98] transition"><Download strokeWidth={1.5} className="mr-2 h-4 w-4" /> Export CSV</Button>
      </div>
      
      <div className="bento-card mt-6 p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Range</span>
          </div>
          <div className="flex gap-3 flex-1">
            <div className="flex-1">
              <label className="text-xs sm:text-sm text-muted-foreground">From</label>
              <input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} className="mt-1 block w-full min-h-[44px] px-3 py-2 border border-input rounded-md bg-background text-foreground text-base sm:text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs sm:text-sm text-muted-foreground">To</label>
              <input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} className="mt-1 block w-full min-h-[44px] px-3 py-2 border border-input rounded-md bg-background text-foreground text-base sm:text-sm" />
            </div>
          </div>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <Button variant="outline" className="shrink-0 min-h-[36px]" onClick={() => setDateRange({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] })}>Today</Button>
            <Button variant="outline" className="shrink-0 min-h-[36px]" onClick={() => setDateRange({ startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] })}>Last 7 Days</Button>
            <Button variant="outline" className="shrink-0 min-h-[36px]" onClick={() => setDateRange({ startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] })}>Last 30 Days</Button>
          </div>
        </div>
      </div>
      
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TOTAL REVENUE</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">₹{summary?.totalRevenue.toFixed(2)}</p></div>
        <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">TOTAL ORDERS</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">{summary?.totalOrders}</p></div>
        <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">AVG ORDER</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">₹{summary?.avgOrderValue.toFixed(2)}</p></div>
        <div className="bento-card p-5"><p className="text-xs font-medium tracking-[0.14em] text-muted-foreground">INVENTORY VALUE</p><p className="mt-2 font-mono text-2xl font-semibold tracking-tight text-foreground">₹{inventoryValuation?.totalValue.toFixed(2)}</p></div>
      </div>
      
      <div className="bento-card mt-6 overflow-hidden p-0">
        <div className="border-b border-border overflow-x-auto"><div className="flex min-w-max gap-1 p-2">{(['sales','items','gst','hourly'] as const).map((t) => <button key={t} onClick={() => setActiveTab(t)} className={activeTab===t ? 'rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background' : 'rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground'}>{t==='sales'?'Sales':t==='items'?'Top Items':t==='gst'?'GST':'Hourly'}</button>)}</div></div>
        
        <div className="p-6">
          {/* Sales Report Tab */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {/* Payment Method Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">Payment Method Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summary?.paymentBreakdown || {}).map(([method, amount]) => (
                    <div key={method} className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">{method}</p>
                      <p className="text-xl font-bold text-foreground">₹{amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Order Type Breakdown */}
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">Order Type Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summary?.orderTypeBreakdown || {}).map(([type, count]) => (
                    <div key={type} className="bg-muted rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">{type}</p>
                      <p className="text-xl font-bold text-foreground">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Daily Sales Trend */}
              {dailySales && dailySales.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-card-foreground mb-3">Daily Sales Trend</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left text-muted-foreground">Date</th>
                          <th className="px-4 py-2 text-right text-muted-foreground">Orders</th>
                          <th className="px-4 py-2 text-right text-muted-foreground">Revenue</th>
                          <th className="px-4 py-2 text-right text-muted-foreground">Tax</th>
                          <th className="px-4 py-2 text-right text-muted-foreground">Discount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailySales.map((day) => (
                          <tr key={day.date} className="border-b border-border">
                            <td className="px-4 py-2 text-foreground">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right text-foreground">{day.orders}</td>
                            <td className="px-4 py-2 text-right font-semibold text-foreground">₹{day.revenue.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-foreground">₹{day.tax.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-foreground">₹{day.discount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Top Items Tab */}
          {activeTab === 'items' && (
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Top Selling Items</h3>
              <div className="space-y-3">
                {topItems?.map((item, idx) => (
                  <div key={item.itemId} className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-100 text-primary-800 font-bold rounded-full h-8 w-8 flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-card-foreground">{item.item?.name}</p>
                        <p className="text-sm text-muted-foreground">{item.item?.category.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg text-card-foreground">{item.totalQuantity} sold</div>
                      <div className="text-sm text-muted-foreground">₹{item.totalRevenue.toFixed(2)} revenue</div>
                      <div className="text-xs text-muted-foreground">{item.orderCount} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* GST Report Tab */}
          {activeTab === 'gst' && gstReport && (
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-4">
                GST Report - {new Date(gstReport.year, gstReport.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">Taxable Value</p>
                  <p className="text-xl font-bold text-foreground">₹{gstReport.totalTaxableValue.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">CGST</p>
                  <p className="text-xl font-bold text-foreground">₹{gstReport.totalCGST.toFixed(2)}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">SGST</p>
                  <p className="text-xl font-bold text-foreground">₹{gstReport.totalSGST.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                  <p className="text-sm text-green-600 dark:text-green-400">Total GST</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">₹{gstReport.totalGST.toFixed(2)}</p>
                </div>
              </div>
              
              <h4 className="font-semibold text-card-foreground mb-3">Tax Rate Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-muted-foreground">Tax Rate</th>
                      <th className="px-4 py-2 text-right text-muted-foreground">Taxable Value</th>
                      <th className="px-4 py-2 text-right text-muted-foreground">CGST</th>
                      <th className="px-4 py-2 text-right text-muted-foreground">SGST</th>
                      <th className="px-4 py-2 text-right text-muted-foreground">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstReport.breakdown.map((item) => (
                      <tr key={item.rate} className="border-b border-border">
                        <td className="px-4 py-2 text-foreground">{item.rate}%</td>
                        <td className="px-4 py-2 text-right text-foreground">₹{item.taxableValue.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-foreground">₹{item.cgst.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-foreground">₹{item.sgst.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold text-foreground">
                          ₹{(item.cgst + item.sgst + item.igst).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Hourly Sales Tab */}
          {activeTab === 'hourly' && hourlySales && (
            <div>
              <h3 className="text-lg font-semibold text-card-foreground mb-4">Today&apos;s Hourly Sales Pattern</h3>
              <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {hourlySales.map((hour) => {
                  const maxRevenue = Math.max(...hourlySales.map(h => h.revenue));
                  const height = maxRevenue > 0 ? (hour.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={hour.hour} className="flex flex-col items-center">
                      <div className="w-full bg-muted h-32 rounded-t flex items-end">
                        <div 
                          className="w-full bg-primary rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${hour.hour}:00 - ₹${hour.revenue.toFixed(2)}`}
                        />
                      </div>
                      <div className="text-xs mt-1 text-center text-foreground">
                        {hour.hour}:00
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {hour.orders}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-sm text-muted-foreground">
                Peak hour: {hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max).hour}:00 
                with ₹{hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max).revenue.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
