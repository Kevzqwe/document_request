import { Home, FileText, History, User, LogOut, MessageSquare, BarChart3, ChevronRight, ChevronLeft, CreditCard, Users, ShieldCheck } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { profileStorage } from '@/lib/profileStorage';

const Sidebar = () => {
  const { profile, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Local avatar state so it updates immediately without page refresh
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [localName, setLocalName] = useState({ firstName: '', lastName: '' });

  // ✅ Sync from profile on load
  useEffect(() => {
    if (!profile) return;
    const stored = profile.id ? profileStorage.getByUserId(profile.id) : null;
    setLocalAvatarUrl(profile.avatarUrl ?? stored?.avatarUrl ?? null);
    setLocalName({
      firstName: profile.firstName || '',
      lastName:  profile.lastName  || '',
    });
  }, [profile]);

  // ✅ Listen for avatar updates dispatched from Account page
  useEffect(() => {
    const handleAvatarUpdate = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.avatarUrl) {
        setLocalAvatarUrl(detail.avatarUrl);
      } else if (profile?.id) {
        const stored = profileStorage.getByUserId(profile.id);
        if (stored?.avatarUrl) setLocalAvatarUrl(stored.avatarUrl);
      }
    };

    const handleProfileUpdate = () => {
      if (!profile?.id) return;
      const stored = profileStorage.getByUserId(profile.id);
      if (stored) {
        if (stored.avatarUrl) setLocalAvatarUrl(stored.avatarUrl);
        setLocalName({
          firstName: stored.firstName || profile.firstName || '',
          lastName:  stored.lastName  || profile.lastName  || '',
        });
      }
    };

    window.addEventListener('avatarUpdated', handleAvatarUpdate);
    window.addEventListener('profileUpdated', handleProfileUpdate);
    return () => {
      window.removeEventListener('avatarUpdated', handleAvatarUpdate);
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [profile]);

  const displayAvatarUrl = profileStorage.getAvatarUrl(localAvatarUrl, localName.firstName || profile?.firstName);

  const studentNavItems = [
    { to: '/student/dashboard',        icon: Home,          label: 'Dashboard' },
    { to: '/student/document-request', icon: FileText,      label: 'Document Request' },
    { to: '/student/request-history',  icon: History,       label: 'Request History' },
    { to: '/student/account',          icon: User,          label: 'Account' },
  ];

  const adminNavItems = [
    { to: '/admin/dashboard',         icon: Home,          label: 'Dashboard' },
    { to: '/admin/request-documents', icon: FileText,      label: 'Request Documents' },
    { to: '/admin/payments',          icon: CreditCard,    label: 'Payments' },
    { to: '/admin/messages',          icon: MessageSquare, label: 'Messages' },
    { to: '/admin/analytics',         icon: BarChart3,     label: 'Analytics' },
    { to: '/admin/students',          icon: Users,         label: 'Students' },
    { to: '/admin/admins',            icon: ShieldCheck,   label: 'Admin Management' },
    { to: '/admin/account',           icon: User,          label: 'Account' },
  ];

  const cashierNavItems = [
    { to: '/admin/dashboard', icon: Home,       label: 'Dashboard' },
    { to: '/admin/payments',  icon: CreditCard, label: 'Payments' },
    { to: '/admin/account',   icon: User,       label: 'Account' },
  ];

  const programheadNavItems = [
    { to: '/admin/dashboard', icon: Home,  label: 'Dashboard' },
    { to: '/admin/students',  icon: Users, label: 'Students' },
    { to: '/admin/account',   icon: User,  label: 'Account' },
  ];

  const getNavItems = () => {
    switch (profile?.role) {
      case 'admin':       return adminNavItems;
      case 'cashier':     return cashierNavItems;
      case 'programhead': return programheadNavItems;
      default:            return studentNavItems;
    }
  };

  const getRoleLabel = () => {
    switch (profile?.role) {
      case 'admin':       return 'Admin';
      case 'cashier':     return 'Cashier';
      case 'programhead': return 'Program Head';
      case 'student':     return 'Student';
      default:            return profile?.role ?? '';
    }
  };

  const navItems = getNavItems();
  const displayFirstName = localName.firstName || profile?.firstName || '';
  const displayLastName  = localName.lastName  || profile?.lastName  || '';

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-4">
          <img
            src={displayAvatarUrl}
            alt={displayFirstName}
            className="w-16 h-16 rounded-full border-2 border-sidebar-primary object-cover"
            // ✅ Force re-render when avatar URL changes by using it as key
            key={localAvatarUrl || 'default'}
          />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sidebar-foreground truncate">
              {displayFirstName} {displayLastName}
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