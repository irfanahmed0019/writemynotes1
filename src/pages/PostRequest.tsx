import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SUBJECTS = ['Physics', 'Chemistry', 'Maths', 'Biology', 'English', 'CS', 'Other'];

export default function PostRequest() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [budget, setBudget] = useState('');
  const [pages, setPages] = useState('');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !subject || !budget || !deadline) {
      toast.error('Fill in all required fields');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('requests').insert({
      user_id: user.id,
      title,
      subject,
      budget: parseInt(budget),
      pages: pages ? parseInt(pages) : 1,
      deadline: new Date(deadline).toISOString(),
      description: description || null,
    });

    if (error) {
      toast.error('Failed to post. Try again.');
      setSubmitting(false);
    } else {
      toast.success('Request posted! 🚀');
      navigate('/marketplace');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 active:scale-[0.95] transition-transform">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">Post Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Physics lab record — Unit 3"
            className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Subject *</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  subject === s
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Budget (₹) *</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 150"
              className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Pages</label>
            <input
              type="number"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 10"
              className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Deadline *</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Description <span className="text-muted-foreground">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any specific instructions..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-semibold text-base active:scale-[0.97] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Request 🚀'}
        </button>
      </form>
    </div>
  );
}
