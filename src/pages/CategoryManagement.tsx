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
import { MoreHorizontal, Plus, Search, Edit2, Trash2, LayoutGrid, Upload, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Label } from "@/components/ui/label";

interface CategoryData {
  id: string;
  name: string;
  spanishName?: string;
  description?: string;
  color: string;
  icon?: string;
  isActive: boolean;
  eventCount: number;
}

const CategoryManagement = () => {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    spanishName: '',
    description: '',
    color: '#7C3AED',
    icon: '',
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
        setFormData(prev => ({ ...prev, icon: response.data.data.url }));
        toast({ title: "Image uploaded successfully" });
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

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/categories');
      // The backend returns { success: true, data: { categories: [], count: 0 } }
      const normalizedCategories = (response.data.data?.categories || []).map((c: any) => ({
        ...c,
        id: c.id || c._id || Math.random().toString()
      }));
      setCategories(normalizedCategories);
    } catch (error) {
      console.error("Failed to fetch categories", error);
      // Demo Data
      setCategories([
        { id: '1', name: 'Electronics', spanishName: 'Electrónica', description: 'Gadgets and tech', color: '#3B82F6', isActive: true, eventCount: 12 },
        { id: '2', name: 'Fashion', spanishName: 'Moda', description: 'Clothing and accessories', color: '#EC4899', isActive: true, eventCount: 45 },
        { id: '3', name: 'Home', spanishName: 'Hogar', description: 'Home decor and furniture', color: '#10B981', isActive: false, eventCount: 8 },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenDialog = (category: CategoryData | null = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({
        name: category.name,
        spanishName: category.spanishName || '',
        description: category.description || '',
        color: category.color,
        icon: category.icon || '',
        isActive: category.isActive
      });
    } else {
      setEditingCategory(null);
      setFormData({
        name: '',
        spanishName: '',
        description: '',
        color: '#7C3AED',
        icon: '',
        isActive: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
        toast({ title: "Category updated successfully" });
      } else {
        await api.post('/categories', formData);
        toast({ title: "Category created successfully" });
      }
      fetchCategories();
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ 
        title: "Action failed", 
        description: error.response?.data?.message || "Something went wrong",
        variant: "destructive" 
      });
      // Mock for demo
      if (editingCategory) {
        setCategories(categories.map(c => c.id === editingCategory.id ? { ...c, ...formData } : c));
      } else {
        setCategories([...categories, { ...formData, id: Math.random().toString(), eventCount: 0 } as any]);
      }
      setIsDialogOpen(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await api.delete(`/categories/${id}`);
      toast({ title: "Category deleted successfully" });
      fetchCategories();
    } catch (error) {
      toast({ title: "Deletion failed", variant: "destructive" });
      setCategories(categories.filter(c => c.id !== id));
    }
  };

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.spanishName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
          <p className="text-muted-foreground">Manage product/event categories and their multilingual properties.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-primary hover:bg-primary/90 gap-2">
          <Plus className="w-4 h-4" />
          Add Category
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search categories..." 
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
              <TableHead className="w-[100px]">Color</TableHead>
              <TableHead>Category Name</TableHead>
              <TableHead>Spanish Name</TableHead>
              <TableHead>Items Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading categories...</TableCell>
              </TableRow>
            ) : filteredCategories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No categories found.</TableCell>
              </TableRow>
            ) : filteredCategories.map((category) => (
              <TableRow key={category.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div 
                    className="w-10 h-10 rounded-lg border shadow-sm flex items-center justify-center overflow-hidden bg-muted"
                    style={{ borderLeft: `4px solid ${category.color}` }}
                  >
                    {category.icon && category.icon.startsWith('http') ? (
                      <img src={category.icon} alt={category.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">{category.icon || '📁'}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="font-semibold">{category.name}</TableCell>
                <TableCell className="text-muted-foreground italic">{category.spanishName || 'N/A'}</TableCell>
                <TableCell>
                   <Badge variant="outline" className="font-mono">{category.eventCount}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={category.isActive ? "success" as any : "destructive"}>
                    {category.isActive ? 'Active' : 'Inactive'}
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
                      <DropdownMenuItem onClick={() => handleOpenDialog(category)}>
                        <Edit2 className="mr-2 h-4 w-4 text-primary" />
                        Edit Category
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(category.id)} className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Category
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <LayoutGrid className="w-6 h-6 text-primary" />
              {editingCategory ? 'Update Category' : 'Create Category'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">English Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g. Electronics"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spanishName">Spanish Name</Label>
                <Input 
                  id="spanishName" 
                  value={formData.spanishName} 
                  onChange={(e) => setFormData({...formData, spanishName: e.target.value})}
                  placeholder="e.g. Electrónica"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="icon">Category Icon / Image</Label>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input 
                      id="icon" 
                      value={formData.icon} 
                      onChange={(e) => setFormData({...formData, icon: e.target.value})}
                      placeholder="Icon URL or emoji"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        id="icon-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => document.getElementById('icon-upload')?.click()}
                        disabled={isUploading}
                      >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Upload an image or enter an emoji directly.</p>
                </div>
                <div className="w-12 h-12 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
                  {formData.icon && formData.icon.startsWith('http') ? (
                    <img src={formData.icon} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{formData.icon || '📁'}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input 
                id="description" 
                value={formData.description} 
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Brief description of category"
              />
            </div>
            <div className="flex items-center gap-4">
               <div className="flex-1 space-y-2">
                  <Label htmlFor="color">Brand Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="color" 
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
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="w-4 h-4 accent-primary"
                    />
                    <span className="text-sm font-medium">Is Active</span>
                  </label>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90 px-8">
              {editingCategory ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoryManagement;
