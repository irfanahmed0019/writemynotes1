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
    <div className="min-h-screen bg-black">
      <div className="sticky top-0 z-10 bg-black border-b border-[#1a1a1a] px-5 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl bg-[#111] active:scale-95">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">Post Request</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-6 space-y-5 max-w-lg mx-auto">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#888]">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Physics lab record — Unit 3"
            className="w-full h-12 px-4 rounded-xl bg-[#111] text-white placeholder:text-[#444] text-sm border-none outline-none focus:ring-1 focus:ring-[#333]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#888]">Subject *</label>
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setSubject(s)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  subject === s ? 'bg-white text-black' : 'bg-[#1a1a1a] text-[#888]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#888]">Budget (₹) *</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 150"
              className="w-full h-12 px-4 rounded-xl bg-[#111] text-white placeholder:text-[#444] text-sm border-none outline-none focus:ring-1 focus:ring-[#333]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-[#888]">Pages</label>
            <input
              type="number"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="e.g. 10"
              className="w-full h-12 px-4 rounded-xl bg-[#111] text-white placeholder:text-[#444] text-sm border-none outline-none focus:ring-1 focus:ring-[#333]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#888]">Deadline *</label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="w-full h-12 px-4 rounded-xl bg-[#111] text-white text-sm border-none outline-none focus:ring-1 focus:ring-[#333]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-[#888]">Description <span className="text-[#444]">(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any specific instructions..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-[#111] text-white placeholder:text-[#444] text-sm resize-none border-none outline-none focus:ring-1 focus:ring-[#333]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Post Request 🚀'}
        </button>
      </form>
    </div>
  );
}
