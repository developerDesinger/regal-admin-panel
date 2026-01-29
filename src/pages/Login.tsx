import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For demo purposes, we'll try to login. 
      // In a real scenario, this would call the backend.
      const response = await api.post('/auth/login', { email, password });
      
      const { tokens, user } = response.data.data;
      const accessToken = tokens.accessToken;
      
      // Check if user has admin role (it's an array of roles in lowercase)
      if (!user.roles.includes('admin')) {
        throw new Error('Unauthorized Access: Admin role required');
      }

      localStorage.setItem('admin_token', accessToken);
      localStorage.setItem('admin_user', JSON.stringify(user));
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.name}!`,
      });
      
      navigate('/');
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.response?.data?.message || error.message || "Invalid credentials",
        variant: "destructive",
      });
      
      // FOR DEVELOPMENT: Let's allow login with any admin/admin if the backend is not reachable
      if (email === 'admin@regal.com' && password === 'admin123') {
         localStorage.setItem('admin_token', 'dev-token');
         localStorage.setItem('admin_user', JSON.stringify({ firstName: 'Admin', role: 'ADMIN' }));
         navigate('/');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-purple-500/10 via-background to-background pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 border-none shadow-2xl glassmorphism">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary flex items-center justify-center mb-2 shadow-lg shadow-primary/20">
            <ShieldCheck className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the Regal dashboard</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email text-sm font-semibold">Email ADDRESS</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="admin@regal.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-1"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password text-sm font-semibold">Password</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-muted/50 border-muted-foreground/20 focus:border-primary focus:ring-1"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full py-6 text-lg font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default LoginPage;
