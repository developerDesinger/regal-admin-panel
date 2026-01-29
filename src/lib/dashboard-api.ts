
import api from "./api";

export interface DashboardStats {
  gmv: number;
  revenue: number;
  transactionCount: number;
  effectiveTakeRate: number;
  refunds: {
    amount: number;
    count: number;
    rate: number;
  };
  pendingPayoutAmount: number;
  activeEvents: number;
  totalCompletedEvents: number;
  chartData: { date: string; gmv: number; transactions: number }[];
}

export const getExecutiveStats = async (period: string, from?: string, to?: string) => {
  const response = await api.get('/admin/dashboard/stats', { params: { period, from, to } });
  return response.data.data;
};

export const getEvents = async (params: any) => {
  const response = await api.get('/admin/dashboard/events', { params });
  return response.data;
};

export const getTransactions = async (params: any) => {
  const response = await api.get('/admin/dashboard/transactions', { params });
  return response.data;
};

export const getAlerts = async () => {
    const response = await api.get('/admin/dashboard/alerts');
    return response.data.data;
};

export const getReportUrl = (type: string, from?: string, to?: string) => {
    // Construct URL for direct download if needed, or fetch data. 
    // If backend returns JSON, we parse and save. 
    // Ideally backend streams CSV. But simpler to return JSON and convert in frontend for now as per my service implementation.
    return `/admin/dashboard/reports?type=${type}&from=${from || ''}&to=${to || ''}`;
};

export const fetchReportData = async (type: string, from?: string, to?: string) => {
    const response = await api.get('/admin/dashboard/reports', { params: { type, from, to } });
    return response.data.data;
}
