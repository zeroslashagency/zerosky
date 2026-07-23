"use client";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Calendar,
  Download,
  FileText,
  BarChart3,
  PieChart,
} from "lucide-react";
import { useState } from "react";

export default function ReportsPage() {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [activeTab, setActiveTab] = useState<'sales' | 'items' | 'gst' | 'hourly'>('sales');
  
  const { data: summary, isLoading: summaryLoading } = trpc.reports.salesSummary.useQuery({
    tenantId: user?.tenantId || "",
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });
  
  const { data: topItems, isLoading: itemsLoading } = trpc.reports.topItems.useQuery({
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
  });
  
  const { data: hourlySales } = trpc.reports.hourlySales.useQuery({
    tenantId: user?.tenantId || "",
    date: new Date().toISOString().split('T')[0],
  });
  
  const { data: inventoryValuation } = trpc.reports.inventoryValuation.useQuery({
    tenantId: user?.tenantId || "",
  });
  
  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading reports...</div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Business insights and performance metrics</p>
        </div>
        <Button className="bg-green-600 hover:bg-green-700">
          <Download className="mr-2 h-4 w-4" />
          Export Report
        </Button>
      </div>
      
      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow p-4 mb-6 border">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-600" />
          <div className="flex gap-4 flex-1">
            <div>
              <label className="text-sm text-gray-600">From</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="block w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">To</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="block w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDateRange({
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
              })}
            >
              Today
            </Button>
            <Button 
              variant="outline"
              onClick={() => setDateRange({
                startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
              })}
            >
              Last 7 Days
            </Button>
            <Button 
              variant="outline"
              onClick={() => setDateRange({
                startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
              })}
            >
              Last 30 Days
            </Button>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold">₹{summary?.totalRevenue.toFixed(2)}</p>
            </div>
            <DollarSign className="h-10 w-10 text-green-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Orders</p>
              <p className="text-2xl font-bold">{summary?.totalOrders}</p>
            </div>
            <ShoppingCart className="h-10 w-10 text-blue-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold">₹{summary?.avgOrderValue.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-10 w-10 text-purple-600 opacity-50" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Inventory Value</p>
              <p className="text-2xl font-bold">₹{inventoryValuation?.totalValue.toFixed(2)}</p>
            </div>
            <BarChart3 className="h-10 w-10 text-orange-600 opacity-50" />
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border mb-6">
        <div className="border-b">
          <div className="flex">
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === 'sales' 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('sales')}
            >
              <FileText className="inline h-4 w-4 mr-2" />
              Sales Report
            </button>
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === 'items' 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('items')}
            >
              <BarChart3 className="inline h-4 w-4 mr-2" />
              Top Items
            </button>
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === 'gst' 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('gst')}
            >
              <FileText className="inline h-4 w-4 mr-2" />
              GST Report
            </button>
            <button
              className={`px-6 py-3 font-medium ${
                activeTab === 'hourly' 
                  ? 'border-b-2 border-blue-600 text-blue-600' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              onClick={() => setActiveTab('hourly')}
            >
              <PieChart className="inline h-4 w-4 mr-2" />
              Hourly Sales
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {/* Sales Report Tab */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              {/* Payment Method Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Payment Method Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summary?.paymentBreakdown || {}).map(([method, amount]) => (
                    <div key={method} className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">{method}</p>
                      <p className="text-xl font-bold">₹{amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Order Type Breakdown */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Order Type Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(summary?.orderTypeBreakdown || {}).map(([type, count]) => (
                    <div key={type} className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">{type}</p>
                      <p className="text-xl font-bold">{count}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Daily Sales Trend */}
              {dailySales && dailySales.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Daily Sales Trend</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Date</th>
                          <th className="px-4 py-2 text-right">Orders</th>
                          <th className="px-4 py-2 text-right">Revenue</th>
                          <th className="px-4 py-2 text-right">Tax</th>
                          <th className="px-4 py-2 text-right">Discount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dailySales.map((day) => (
                          <tr key={day.date} className="border-b">
                            <td className="px-4 py-2">{new Date(day.date).toLocaleDateString()}</td>
                            <td className="px-4 py-2 text-right">{day.orders}</td>
                            <td className="px-4 py-2 text-right font-semibold">₹{day.revenue.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{day.tax.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right">₹{day.discount.toFixed(2)}</td>
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
              <h3 className="text-lg font-semibold mb-4">Top Selling Items</h3>
              <div className="space-y-3">
                {topItems?.map((item, idx) => (
                  <div key={item.itemId} className="flex items-center justify-between border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-100 text-blue-600 font-bold rounded-full h-8 w-8 flex items-center justify-center">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{item.item?.name}</p>
                        <p className="text-sm text-gray-600">{item.item?.category.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">{item.totalQuantity} sold</div>
                      <div className="text-sm text-gray-600">₹{item.totalRevenue.toFixed(2)} revenue</div>
                      <div className="text-xs text-gray-500">{item.orderCount} orders</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* GST Report Tab */}
          {activeTab === 'gst' && gstReport && (
            <div>
              <h3 className="text-lg font-semibold mb-4">
                GST Report - {new Date(gstReport.year, gstReport.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Taxable Value</p>
                  <p className="text-xl font-bold">₹{gstReport.totalTaxableValue.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">CGST</p>
                  <p className="text-xl font-bold">₹{gstReport.totalCGST.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">SGST</p>
                  <p className="text-xl font-bold">₹{gstReport.totalSGST.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600">Total GST</p>
                  <p className="text-xl font-bold text-green-600">₹{gstReport.totalGST.toFixed(2)}</p>
                </div>
              </div>
              
              <h4 className="font-semibold mb-3">Tax Rate Breakdown</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left">Tax Rate</th>
                      <th className="px-4 py-2 text-right">Taxable Value</th>
                      <th className="px-4 py-2 text-right">CGST</th>
                      <th className="px-4 py-2 text-right">SGST</th>
                      <th className="px-4 py-2 text-right">Total Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstReport.breakdown.map((item) => (
                      <tr key={item.rate} className="border-b">
                        <td className="px-4 py-2">{item.rate}%</td>
                        <td className="px-4 py-2 text-right">₹{item.taxableValue.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{item.cgst.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">₹{item.sgst.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right font-semibold">
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
              <h3 className="text-lg font-semibold mb-4">Today's Hourly Sales Pattern</h3>
              <div className="grid grid-cols-6 md:grid-cols-12 gap-2">
                {hourlySales.map((hour) => {
                  const maxRevenue = Math.max(...hourlySales.map(h => h.revenue));
                  const height = maxRevenue > 0 ? (hour.revenue / maxRevenue) * 100 : 0;
                  
                  return (
                    <div key={hour.hour} className="flex flex-col items-center">
                      <div className="w-full bg-gray-200 h-32 rounded-t flex items-end">
                        <div 
                          className="w-full bg-blue-600 rounded-t"
                          style={{ height: `${height}%` }}
                          title={`${hour.hour}:00 - ₹${hour.revenue.toFixed(2)}`}
                        />
                      </div>
                      <div className="text-xs mt-1 text-center">
                        {hour.hour}:00
                      </div>
                      <div className="text-xs text-gray-600">
                        {hour.orders}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-sm text-gray-600">
                Peak hour: {hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max).hour}:00 
                with ₹{hourlySales.reduce((max, h) => h.revenue > max.revenue ? h : max).revenue.toFixed(2)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
