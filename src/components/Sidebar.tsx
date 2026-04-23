import { Home, FileText, History, User, LogOut, MessageSquare, BarChart3, ChevronRight, ChevronLeft, CreditCard, Users, ShieldCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { profileStorage } from '@/lib/profileStorage';

const Sidebar = () => {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const displayAvatarUrl = profileStorage.getAvatarUrl(profile?.avatarUrl || null, profile?.firstName);

  const studentNavItems = [
    { to: '/student/dashboard',        icon: Home,        label: 'Dashboard' },
    { to: '/student/document-request', icon: FileText,    label: 'Document Request' },
    { to: '/student/request-history',  icon: History,     label: 'Request History' },
    { to: '/student/account',          icon: User,        label: 'Account' },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard',          icon: Home,        label: 'Dashboard' },
    { to: '/admin/request-documents',  icon: FileText,    label: 'Request Documents' },
    { to: '/admin/payments',           icon: CreditCard,  label: 'Payments' },
    { to: '/admin/messages',           icon: MessageSquare, label: 'Messages' },
    { to: '/admin/analytics',          icon: BarChart3,   label: 'Analytics' },
    { to: '/admin/students',           icon: Users,       label: 'Students' },
    { to: '/admin/admins',             icon: ShieldCheck, label: 'Admin Management' },
    { to: '/admin/account',            icon: User,        label: 'Account' },
  ];

  // Cashier: Payments only
  const cashierNavItems = [
    { to: '/admin/payments', icon: CreditCard, label: 'Payments' },
  ];

  // Program Head: Students only
  const programheadNavItems = [
    { to: '/admin/students', icon: Users, label: 'Students' },
  ];

  const getNavItems = () => {
    switch (profile?.role) {
      case 'admin':       return adminNavItems;
      case 'cashier':     return cashierNavItems;
      case 'programhead': return programheadNavItems;
      default:            return studentNavItems;
    }
  };

  const navItems = getNavItems();

  // Role label displayed under the name
  const getRoleLabel = () => {
    switch (profile?.role) {
      case 'admin':       return 'Admin';
      case 'cashier':     return 'Cashier';
      case 'programhead': return 'Program Head';
      case 'student':     return 'Student';
      default:            return profile?.role ?? '';
    }
  };

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-4">
          <img
            src={displayAvatarUrl}
            alt={profile?.firstName}
            className="w-16 h-16 rounded-full border-2 border-sidebar-primary object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sidebar-foreground truncate">
              {profile?.firstName} {profile?.lastName}
            </h3>
            <p className="text-sm text-sidebar-foreground/70">{getRoleLabel()}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/80 hover:bg-sidebar-accent transition-colors"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
            onClick={() => setIsOpen(false)}
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Arrow Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'lg:hidden fixed top-4 z-50 bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300',
          isOpen ? 'left-[17rem]' : 'left-4'
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </Button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-foreground/50 z-40 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 h-screen bg-sidebar flex flex-col z-40 transition-transform duration-300',
          'w-72',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;