import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Bell, Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ChatbaseWidget from '@/components/ChatbaseWidget';
import { supabase } from '@/integrations/supabase/client';

const CHATBASE_ID = 'qLBNkxXcRUo19x8-TuiJQ';

interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

const AdminDashboard = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [isEditingWelcome, setIsEditingWelcome] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('Welcome back');
  const [isCreatingAnnouncement, setIsCreatingAnnouncement] = useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setAnnouncements(data.map(a => ({
        id: a.id,
        title: a.title,
        content: a.content,
        date: a.created_at,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleSaveWelcome = () => {
    toast({ title: 'Welcome Message Updated', description: 'The welcome message has been successfully updated.' });
    setIsEditingWelcome(false);
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.content) {
      toast({ title: 'Error', description: 'Please fill in all fields.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('announcements')
      .insert({
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        created_by: user?.id || null,
      });

    if (error) {
      console.error('Error creating announcement:', error);
      toast({ title: 'Error', description: 'Failed to create announcement.', variant: 'destructive' });
      return;
    }

    setNewAnnouncement({ title: '', content: '' });
    setIsCreatingAnnouncement(false);
    await fetchAnnouncements();
    toast({ title: 'Announcement Created', description: 'New announcement has been added.' });
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) {
      console.error('Error deleting announcement:', error);
      return;
    }
    await fetchAnnouncements();
    toast({ title: 'Announcement Deleted', description: 'The announcement has been removed.' });
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-primary to-primary-light rounded-2xl p-8 text-primary-foreground shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {isEditingWelcome ? (
              <Input value={welcomeMessage} onChange={(e) => setWelcomeMessage(e.target.value)} className="text-3xl font-bold mb-2 bg-background/10 border-primary-foreground/30 text-primary-foreground" />
            ) : (
              <h1 className="text-3xl font-bold mb-2">{welcomeMessage}, {profile?.firstName}!</h1>
            )}
            <div className="flex items-center gap-2 text-primary-foreground/90">
              <Calendar className="w-5 h-5" />
              <p className="text-lg">{currentDate}</p>
            </div>
          </div>
          {!isEditingWelcome ? (
            <Button onClick={() => setIsEditingWelcome(true)} variant="secondary" size="sm">
              <Edit2 className="w-4 h-4 mr-2" />Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button onClick={handleSaveWelcome} size="sm" variant="secondary"><Save className="w-4 h-4 mr-2" />Save</Button>
              <Button onClick={() => setIsEditingWelcome(false)} size="sm" variant="outline"><X className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <CardTitle>Announcements</CardTitle>
            </div>
            <Button onClick={() => setIsCreatingAnnouncement(true)} size="sm">
              <Plus className="w-4 h-4 mr-2" />Create Announcement
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isCreatingAnnouncement && (
            <div className="p-4 bg-muted rounded-lg border-2 space-y-4">
              <div>
                <Label>Title</Label>
                <Input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Announcement title" />
              </div>
              <div>
                <Label>Content</Label>
                <Textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} placeholder="Announcement content" rows={3} />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreateAnnouncement}><Save className="w-4 h-4 mr-2" />Create</Button>
                <Button variant="outline" onClick={() => setIsCreatingAnnouncement(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : announcements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No announcements yet. Create one to get started.</div>
          ) : (
            announcements.map((announcement) => (
              <div key={announcement.id} className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-foreground flex-1">{announcement.title}</h3>
                  <div className="flex gap-2 ml-4">
                    <span className="text-xs text-muted-foreground">{new Date(announcement.date).toLocaleDateString()}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleDeleteAnnouncement(announcement.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground/80">{announcement.content}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ChatbaseWidget chatbotId={CHATBASE_ID} />
    </div>
  );
};

export default AdminDashboard;
