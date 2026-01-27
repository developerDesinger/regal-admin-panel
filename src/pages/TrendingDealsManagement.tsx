import { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from "@/components/ui/dialog";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Plus, Search, Edit2, Trash2, Flame, DollarSign, Eye, ImageIcon, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Label } from "@/components/ui/label";

interface TrendingDealData {
  id: string;
  name: string;
  spanishName?: string;
  image?: string;
  color: string;
  amount: number;
  currency: string;
  isActive: boolean;
  viewCount: number;
}

const TrendingDealsManagement = () => {
  const [deals, setDeals] = useState<TrendingDealData[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<TrendingDealData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    spanishName: '',
    image: '',
    color: '#FF6B6B',
    amount: 0,
    currency: 'USD',
    isActive: true
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (response.data.success) {
        setFormData(prev => ({ ...prev, image: response.data.data.url }));
        toast({ title: "Deal image uploaded successfully" });
      }
    } catch (error) {
      console.error("Upload failed", error);
      toast({ 
        title: "Upload failed", 
        description: "Please check your internet connection and try again.",
        variant: "destructive" 
      });
    } finally {
      setIsUploading(false);
    }
  };

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/trending-deals');
      // The backend returns { success: true, data: { deals: [], count: 0 } }
      const normalizedDeals = (response.data.data?.deals || []).map((d: any) => ({
        ...d,
        id: d.id || d._id || Math.random().toString()
      }));
      setDeals(normalizedDeals);
    } catch (error) {
      console.error("Failed to fetch deals", error);
      // Demo Data
      setDeals([
        { id: '1', name: 'Summer Sale Special', spanishName: 'Especial Rebajas de Verano', image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30', color: '#FF6B6B', amount: 29.99, currency: 'USD', isActive: true, viewCount: 1250 },
        { id: '2', name: 'Holiday Bundle', spanishName: 'Paquete de Vacaciones', image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', color: '#4ECDC4', amount: 49.00, currency: 'USD', isActive: true, viewCount: 890 },
        { id: '3', name: 'Flash Deal: Tech Gear', spanishName: 'Oferta Relámpago: Equipos Tech', image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e', color: '#F7B731', amount: 199.99, currency: 'USD', isActive: false, viewCount: 450 },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleOpenDialog = (deal: TrendingDealData | null = null) => {
    if (deal) {
      setEditingDeal(deal);
      setFormData({
        name: deal.name,
        spanishName: deal.spanishName || '',
        image: deal.image || '',
        color: deal.color,
        amount: deal.amount,
        currency: deal.currency,
        isActive: deal.isActive
      });
    } else {
      setEditingDeal(null);
      setFormData({
        name: '',
        spanishName: '',
        image: '',
        color: '#FF6B6B',
        amount: 0,
        currency: 'USD',
        isActive: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingDeal) {
        await api.put(`/trending-deals/${editingDeal.id}`, formData);
        toast({ title: "Deal updated successfully" });
      } else {
        await api.post('/trending-deals', formData);
        toast({ title: "Deal created successfully" });
      }
      fetchDeals();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ 
        title: "Action failed", 
        description: error.response?.data?.message || "Something went wrong",
        variant: "destructive" 
      });
      // Mock for demo
      if (editingDeal) {
        setDeals(deals.map(d => d.id === editingDeal.id ? { ...d, ...formData } : d));
      } else {
        setDeals([...deals, { ...formData, id: Math.random().toString(), viewCount: 0 } as any]);
      }
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this deal?")) return;
    try {
      await api.delete(`/trending-deals/${id}`);
      toast({ title: "Deal deleted successfully" });
      fetchDeals();
    } catch (error) {
      toast({ title: "Deletion failed", variant: "destructive" });
      setDeals(deals.filter(d => d.id !== id));
    }
  };

  const filteredDeals = deals.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.spanishName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500" />
            Trending Deals
          </h1>
          <p className="text-muted-foreground">Monitor and manage high-performing promotional deals.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Create New Deal
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search deals..." 
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="w-[100px]">Image</TableHead>
              <TableHead>Deal Info</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading deals...</TableCell>
              </TableRow>
            ) : filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No deals found.</TableCell>
              </TableRow>
            ) : filteredDeals.map((deal) => (
              <TableRow key={deal.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  {deal.image ? (
                    <img src={deal.image} alt={deal.name} className="w-12 h-12 rounded-lg object-cover border bg-muted" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border">
                      <ImageIcon className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold">{deal.name}</span>
                    <span className="text-xs text-muted-foreground italic">{deal.spanishName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center font-bold text-success font-mono">
                    {deal.currency === 'USD' ? '$' : deal.currency}{deal.amount.toFixed(2)}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="w-3.5 h-3.5" />
                    <span className="text-sm">{deal.viewCount.toLocaleString()}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={deal.isActive ? "success" as any : "destructive"}>
                    {deal.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleOpenDialog(deal)}>
                        <Edit2 className="mr-2 h-4 w-4 text-primary" />
                        Edit Deal
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(deal.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Deal
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Flame className="w-6 h-6 text-orange-500" />
              {editingDeal ? 'Update Trending Deal' : 'New Trending Deal'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Deal Title (EN)</Label>
                <Input 
                  id="title" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Summer Blowout"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spTitle">Deal Title (ES)</Label>
                <Input 
                  id="spTitle" 
                  value={formData.spanishName} 
                  onChange={(e) => setFormData({...formData, spanishName: e.target.value})}
                  placeholder="e.g. Explosión de Verano"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Offer Price</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    id="price" 
                    type="number"
                    min="0"
                    value={formData.amount} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFormData({...formData, amount: isNaN(val) ? 0 : Math.max(0, val)});
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input 
                  id="currency" 
                  value={formData.currency} 
                  onChange={(e) => setFormData({...formData, currency: e.target.value})}
                  placeholder="USD"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageFile">Deal Banner Image</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      id="imageFile" 
                      value={formData.image} 
                      onChange={(e) => setFormData({...formData, image: e.target.value})}
                      placeholder="Paste image URL here..."
                    />
                    <div className="relative">
                      <input
                        type="file"
                        id="deal-image-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => document.getElementById('deal-image-upload')?.click()}
                        disabled={isUploading}
                        className="shrink-0"
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Upload a high-quality JPG/PNG for the deal banner.</p>
                </div>
                {formData.image && (
                  <div className="w-16 h-12 rounded border bg-muted overflow-hidden flex-shrink-0">
                    <img src={formData.image} className="w-full h-full object-cover" alt="Preview" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6">
               <div className="flex-1 space-y-2">
                  <Label htmlFor="dealColor">Theme Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="dealColor" 
                      type="color"
                      value={formData.color} 
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="w-12 h-10 p-1 bg-transparent border-none"
                    />
                    <Input 
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="flex-1"
                    />
                  </div>
               </div>
               <div className="flex items-end h-full pt-8">
                  <label className="flex items-center gap-2 cursor-pointer shadow-sm p-2 px-3 rounded-md bg-muted/50 border">
                    <input 
                      type="checkbox" 
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm font-semibold">Live on Store</span>
                  </label>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 px-8">
              {editingDeal ? 'Save Deal' : 'Launch Deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TrendingDealsManagement;
