import { NavLink } from 'react-router-dom';
import { Users, LayoutGrid, Flame, LogOut, ShieldCheck, Coins, LayoutDashboard, Calendar, Receipt, FileBarChart, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: Users, label: 'User Management', path: '/users' },
  { icon: LayoutGrid, label: 'Categories', path: '/categories' },
  { icon: Flame, label: 'Trending Deals', path: '/trending-deals' },
  { icon: Calendar, label: 'Events', path: '/events' },
  { icon: Receipt, label: 'Transactions', path: '/transactions' },
  { icon: FileBarChart, label: 'Reports', path: '/reports' },
  { icon: AlertTriangle, label: 'Risk Alerts', path: '/alerts' },
  { icon: Coins, label: 'Platform Fee', path: '/platform-fee' },
];

const Sidebar = ({ onClose }: { onClose?: () => void }) => {
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
  };

  return (
    <div className="flex flex-col w-64 bg-card border-r h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 h-16 border-b">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-xl tracking-tight">Regal Admin</span>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:bg-muted"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="p-4 border-t">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </div>
  );
};

export default Sidebar;
