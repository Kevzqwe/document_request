import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationButton from './NotificationButton';
import Footer from './Footer';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import pcsLogo from '@/assets/PCSlogo.png';

const Layout = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-30 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="lg:ml-0 ml-14 flex items-center gap-3">
              <img src={pcsLogo} alt="PCS Logo" className="w-12 h-12 object-contain" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Pateros Catholic School Document Request System
                </h2>
                <p className="text-sm text-muted-foreground">
                  {profile?.role === 'student' ? 'Student Portal' : 'Admin Portal'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {profile?.role === 'admin' && (
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => navigate('/admin/messages')}
                  title="Messages"
                >
                  <Mail className="w-5 h-5" />
                </Button>
              )}
              <NotificationButton />
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
