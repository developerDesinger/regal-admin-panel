import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Save } from "lucide-react";

const PlatformFeeManagement = () => {
  const [fee, setFee] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/admin/settings');
      if (response.data.success) {
        setFee(response.data.data.platformFee);
      }
    } catch (error) {
      console.error("Failed to fetch settings", error);
      toast({
        title: "Error",
        description: "Failed to fetch platform fee settings",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await api.put('/admin/settings', { platformFee: Number(fee) });
      if (response.data.success) {
        toast({ title: "Success", description: "Platform fee updated successfully" });
        setFee(response.data.data.platformFee);
      }
    } catch (error: any) {
      toast({
        title: "Action failed",
        description: error.response?.data?.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Fee Management</h1>
          <p className="text-muted-foreground">Manage the platform fee percentage for transfers.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5 text-purple-600" />
              Transfer Fee
            </CardTitle>
            <CardDescription>
              Set the percentage fee taken from each transfer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-20 flex items-center justify-center text-muted-foreground">
                Loading...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fee">Fee Percentage (%)</Label>
                  <Input
                    id="fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={fee}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setFee(isNaN(val) ? 0 : Math.max(0, val));
                    }}
                    placeholder="0.0"
                  />
                  <p className="text-xs text-muted-foreground">
                    This percentage will be deducted from the transfer amount.
                  </p>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" /> Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlatformFeeManagement;
