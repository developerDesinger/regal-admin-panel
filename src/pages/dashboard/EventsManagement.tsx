
import { useState, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, MoreHorizontal, Eye } from "lucide-react";
import { getEvents } from "@/lib/dashboard-api";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EventsManagement = () => {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        page: 1,
        limit: 20,
        status: "active",
        search: "",
        category: ""
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_pagination, setPagination] = useState({ total: 0, pages: 1 });

    const loadEvents = async () => {
        setLoading(true);
        try {
            const res = await getEvents(filters);
            setEvents(res.data);
            setPagination(res.pagination);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEvents();
    }, [filters]);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Events Management</h1>
                    <p className="text-muted-foreground">Monitor and manage all collections and events.</p>
                </div>
                <Button variant="outline">
                    <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-lg border shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search events..." 
                        className="pl-10"
                        value={filters.search}
                        onChange={(e) => setFilters({...filters, search: e.target.value, page: 1})}
                    />
                </div>
                <Select value={filters.status} onValueChange={(val) => setFilters({...filters, status: val, page: 1})}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="all">All Status</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead>Event</TableHead>
                            <TableHead>Organizer</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Collected</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                             <TableRow><TableCell colSpan={7} className="text-center h-24">Loading...</TableCell></TableRow>
                        ) : events.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No events found.</TableCell></TableRow>
                        ) : (
                            events.map((event) => (
                                <TableRow key={event._id} className="hover:bg-muted/30">
                                    <TableCell>
                                        <div className="font-medium">{event.eventName}</div>
                                        <div className="text-xs text-muted-foreground">{event.contributionsCount} contributions</div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {/* Avatar would go here */}
                                            <span>{event.organizer?.name || 'Unknown'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">{event.category?.name || 'Uncategorized'}</Badge>
                                    </TableCell>
                                    <TableCell className="font-semibold text-green-600">
                                        ${event.collectedAmount.toFixed(2)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={event.isActive ? "default" : "secondary"} className={event.isActive ? "bg-green-100 text-green-800 hover:bg-green-200" : ""}>
                                            {event.isActive ? 'Active' : 'Completed'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {format(new Date(event.date), 'MMM dd, yyyy')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem><Eye className="mr-2 h-4 w-4" /> View Details</DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive">Stop Collection</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
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

export default EventsManagement;
