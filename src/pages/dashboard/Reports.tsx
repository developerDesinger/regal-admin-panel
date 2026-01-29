
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Download, FileText, PieChart, TrendingUp } from "lucide-react";
import { fetchReportData } from "@/lib/dashboard-api";

const Reports = () => {
    const [downloading, setDownloading] = useState<string | null>(null);

    const handleDownload = async (type: string) => {
        setDownloading(type);
        try {
            const data = await fetchReportData(type, '', '');
            // Convert to CSV
            const csvContent = "data:text/csv;charset=utf-8," 
                + data.map((e: any) => Object.values(e).join(",")).join("\n");
            
            // This is a rough CSV export. A library like papaparse or json2csv is better but keeping simple.
            // Ideally backend returns CSV.
            
            // Let's create a temporary link to download
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `${type}_report_${new Date().toISOString()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (e) {
            console.error("Download failed", e);
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Reports & Exports</h1>
                 <p className="text-muted-foreground">Download detailed reports for reconciliation and analysis.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-2">
                            <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <CardTitle>Events Report</CardTitle>
                        <CardDescription>Comprehensive list of all events, statuses, and collected totals.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => handleDownload('events')}
                            disabled={downloading === 'events'}
                        >
                            <Download className="mr-2 h-4 w-4" /> 
                            {downloading === 'events' ? 'Generating...' : 'Download CSV'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                         <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center mb-2">
                            <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <CardTitle>Transactions Query</CardTitle>
                        <CardDescription>Full transaction ledger for accounting and reconciliation.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => handleDownload('transactions')}
                            disabled={downloading === 'transactions'}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {downloading === 'transactions' ? 'Generating...' : 'Download CSV'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="hover:border-primary/50 transition-colors">
                    <CardHeader>
                         <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-2">
                            <PieChart className="h-5 w-5 text-purple-600" />
                        </div>
                        <CardTitle>Category Performance</CardTitle>
                        <CardDescription>Analyze which categories are driving the most volume.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <Button 
                            className="w-full" 
                            variant="outline"
                            onClick={() => handleDownload('categories')}
                            disabled={downloading === 'categories'}
                        >
                            <Download className="mr-2 h-4 w-4" />
                            {downloading === 'categories' ? 'Generating...' : 'Download CSV'}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Reports;
