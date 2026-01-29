
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import { ArrowUp, ArrowDown } from "lucide-react";
import { getTransactions } from "@/lib/dashboard-api";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TransactionsLedger = () => {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        page: 1,
        limit: 20,
        status: "all",
        type: "all"
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_pagination, setPagination] = useState({ total: 0, pages: 1 });

    const loadData = async () => {
        setLoading(true);
        try {
            const apiFilters = { ...filters };
            if (apiFilters.status === 'all') delete (apiFilters as any).status;
            if (apiFilters.type === 'all') delete (apiFilters as any).type;
            
            const res = await getTransactions(apiFilters);
            setTransactions(res.data);
            setPagination(res.pagination);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [filters]);

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'failed': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transactions Ledger</h1>
                    <p className="text-muted-foreground">Full history of platform transactions and payments.</p>
                </div>
            </div>

             <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
                 <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val, page: 1})}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="completed">Succeeded</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={filters.type} onValueChange={(val) => setFilters({...filters, type: val, page: 1})}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="p2p">Transfer</SelectItem>
                        <SelectItem value="refund">Refund</SelectItem>
                        <SelectItem value="gift">Gift</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Sender</TableHead>
                            <TableHead>Recipient</TableHead>
                            <TableHead>Event</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                     <TableBody>
                        {loading ? (
                             <TableRow><TableCell colSpan={7} className="text-center h-24">Loading...</TableCell></TableRow>
                        ) : transactions.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No transactions found.</TableCell></TableRow>
                        ) : (
                            transactions.map((tx) => (
                                <TableRow key={tx._id} className="hover:bg-muted/30">
                                    <TableCell className="font-mono text-sm text-muted-foreground">
                                        {format(new Date(tx.createdAt), 'MMM dd HH:mm')}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center capitalize gap-2">
                                            {tx.transferType === 'refund' ? <ArrowDown className="h-3 w-3 text-red-500" /> : <ArrowUp className="h-3 w-3 text-green-500" />}
                                            {tx.transferType}
                                        </div>
                                    </TableCell>
                                    <TableCell>{tx.senderId?.name || 'Unknown'}</TableCell>
                                    <TableCell>{tx.recipientId?.name || 'Unknown'}</TableCell>
                                    <TableCell className="text-sm">{tx.eventId?.eventName || '-'}</TableCell>
                                    <TableCell className="font-semibold">
                                        {tx.transferType === 'refund' ? '-' : ''}${tx.amount.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={getStatusColor(tx.status)}>
                                            {tx.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

export default TransactionsLedger;
