
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { getAlerts } from "@/lib/dashboard-api";
import { format } from "date-fns";

const RiskAlerts = () => {
    const [alerts, setAlerts] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const data = await getAlerts();
                setAlerts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    return (
         <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Risk Monitoring</h1>
                <p className="text-muted-foreground">Automated alerts for potential issues and fraud detection.</p>
            </div>

            {loading ? <div>Checking system health...</div> : (
                <div className="grid gap-6">
                    {/* Failure Rate Alert */}
                    {alerts?.riskMetrics?.failureAlert ? (
                         <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-start gap-3 border border-destructive/20">
                            <AlertCircle className="h-5 w-5 mt-0.5" />
                            <div>
                                <h5 className="font-semibold mb-1">High Transaction Failure Rate Detected</h5>
                                <p className="text-sm opacity-90">
                                    The transaction failure rate is currently {(alerts.riskMetrics.failureRate * 100).toFixed(1)}%. This is above the 10% threshold. Please investigate payment gateways.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-green-50 text-green-800 p-4 rounded-md flex items-start gap-3 border border-green-200">
                             <CheckCircle2 className="h-5 w-5 mt-0.5" />
                             <div>
                                 <h5 className="font-semibold mb-1">System Healthy</h5>
                                 <p className="text-sm opacity-90">
                                     Transaction success rates are within normal range.
                                 </p>
                             </div>
                        </div>
                    )}

                    {/* Stalled Events */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                Stalled Events
                            </CardTitle>
                            <CardDescription>
                                Events created over 48 hours ago with 0 contributions. May indicate user drop-off or technical issues.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-4">
                                {alerts?.stalledEvents?.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">No risk patterns detected.</div>
                                ) : (
                                    alerts?.stalledEvents?.map((event: any) => (
                                        <div key={event._id} className="flex items-center justify-between p-4 border rounded-lg">
                                            <div>
                                                <p className="font-medium">{event.eventName}</p>
                                                <p className="text-sm text-muted-foreground">Created {format(new Date(event.createdAt), 'PP p')}</p>
                                            </div>
                                            <div className="text-sm font-medium text-orange-600">
                                                Zero Activity
                                            </div>
                                        </div>
                                    ))
                                )}
                             </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default RiskAlerts;
