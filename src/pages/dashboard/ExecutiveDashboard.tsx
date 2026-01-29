
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DollarSign, Activity, TrendingUp, AlertCircle, CreditCard } from "lucide-react";
import { getExecutiveStats, type DashboardStats } from "@/lib/dashboard-api";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from "date-fns";

const ExecutiveDashboard = () => {
  const [period, setPeriod] = useState("7d");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const data = await getExecutiveStats(period);
        setStats(data);
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadStats();
  }, [period]);

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (!stats && !isLoading) return <div>Failed to load data</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            Executive Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Real-time overview of your platform's performance.</p>
        </div>
        
        <div className="flex items-center gap-2">
           <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg hover:shadow-xl transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">Total GMV</CardTitle>
            <DollarSign className="h-4 w-4 text-indigo-100" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? formatCurrency(stats.gmv) : "..."}</div>
            <p className="text-xs text-indigo-200 mt-1 flex items-center">
               collected amount
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card hover:bg-muted/50 transition-all border-l-4 border-l-green-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? formatCurrency(stats.revenue) : "..."}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats ? `${stats.effectiveTakeRate.toFixed(2)}% effective take rate` : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card hover:bg-muted/50 transition-all border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Events</CardTitle>
            <Activity className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{stats ? stats.activeEvents : "..."}</div>
             <p className="text-xs text-muted-foreground mt-1">
              {stats ? `${stats.totalCompletedEvents} completed events` : ""}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card hover:bg-muted/50 transition-all border-l-4 border-l-orange-500 shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payouts</CardTitle>
            <CreditCard className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats ? formatCurrency(stats.pendingPayoutAmount) : "..."}</div>
            <p className="text-xs text-muted-foreground mt-1">
              waiting for dispersement
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Main Chart */}
        <Card className="col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>GMV & Transactions Trend</CardTitle>
            <CardDescription>Overview of collected amounts ({period})</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              {stats && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.chartData}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tickFormatter={(str) => format(new Date(str), 'MMM dd')} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: any, name: any) => [name === "gmv" ? formatCurrency(value) : value, name === "gmv" ? "GMV" : "Transactions"]}
                        labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                    />
                    <Area type="monotone" dataKey="gmv" yAxisId="left" stroke="#8884d8" fillOpacity={1} fill="url(#colorGmv)" strokeWidth={2} />
                    <Area type="monotone" dataKey="transactions" yAxisId="right" stroke="#82ca9d" fillOpacity={0} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Secondary Stats */}
        <Card className="col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>Core metrics breakdown</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center">
               <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 mr-4">
                  <Activity className="h-6 w-6 text-blue-600 dark:text-blue-300" />
               </div>
               <div className="space-y-1">
                 <p className="text-sm font-medium leading-none">Transactions</p>
                 <p className="text-2xl font-bold">{stats?.transactionCount}</p>
                 <p className="text-xs text-muted-foreground">Total contributions processed</p>
               </div>
            </div>

             <div className="flex items-center">
               <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 mr-4">
                  <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-300" />
               </div>
               <div className="space-y-1">
                 <p className="text-sm font-medium leading-none">Refunds / Chargebacks</p>
                 <p className="text-2xl font-bold">{formatCurrency(stats?.refunds.amount || 0)}</p>
                 <p className="text-xs text-muted-foreground">{stats?.refunds.count} transactions ({stats?.refunds.rate.toFixed(2)}% rate)</p>
               </div>
            </div>
            
            <div className="pt-4 border-t">
                <Button className="w-full bg-slate-900 text-white hover:bg-slate-800" asChild>
                    <a href="/transactions">View Full Ledger</a>
                </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;
