import { useAuth } from '@/lib/auth';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Send, Plus, Camera, Image as ImageIcon, FileText, X, Download, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import TypingIndicator from '@/components/TypingIndicator';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress';

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
};

export default function Chat() {
  const { user, loading } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherName, setOtherName] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [attachMenu, setAttachMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const markAsRead = useCallback(async () => {
    if (!user || !id) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .is('read_at', null);
  }, [user, id]);

  useEffect(() => {
    if (!user || !id) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data as any);
      markAsRead();
    };

    const fetchConvo = async () => {
      const { data: convo } = await supabase
        .from('conversations')
        .select('buyer_id, seller_id')
        .eq('id', id)
        .single();
      if (convo) {
        const otherId = convo.buyer_id === user.id ? convo.seller_id : convo.buyer_id;
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('user_id', otherId).single();
        setOtherName(profile?.full_name || 'Unknown');
      }
    };

    fetchMessages();
    fetchConvo();

    const msgChannel = supabase
      .channel(`chat-${id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const msg = payload.new as Message;
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
          if (msg.sender_id !== user.id) markAsRead();
        } else if (payload.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? payload.new as Message : m));
        }
      })
      .subscribe();

    const presenceChannel = supabase.channel(`typing-${id}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const others = Object.keys(state).filter(k => k !== user.id);
        setOtherTyping(others.some(k => {
          const presences = state[k] as any[];
          return presences?.some(p => p.typing);
        }));
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') presenceChannel.track({ typing: false });
      });

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(presenceChannel);
      presenceChannelRef.current = null;
    };
  }, [user, id, markAsRead]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, otherTyping]);

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const broadcastTyping = () => {
    presenceChannelRef.current?.track({ typing: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      presenceChannelRef.current?.track({ typing: false });
    }, 1800);
  };

  const sendMessage = async (content: string, attachment_url?: string, attachment_type?: string) => {
    await supabase.from('messages').insert({
      conversation_id: id!,
      sender_id: user!.id,
      content,
      attachment_url: attachment_url ?? null,
      attachment_type: attachment_type ?? null,
    } as any);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    presenceChannelRef.current?.track({ typing: false });
    await sendMessage(content);
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const uploadAndSend = async (file: File, kind: 'image' | 'file') => {
    setAttachMenu(false);
    setUploading(true);
    try {
      let blob: Blob = file;
      if (kind === 'image' && file.type.startsWith('image/')) {
        try { blob = await compressImage(file); } catch { /* keep original */ }
      }
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      const path = `${user!.id}/${id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('chat-attachments').upload(path, blob, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(path);
      const type = kind === 'image' ? 'image' : (file.type === 'application/pdf' ? 'pdf' : 'file');
      await sendMessage(kind === 'image' ? '' : file.name, publicUrl, type);
    } catch (e: any) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>, kind: 'image' | 'file') => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) uploadAndSend(f, kind);
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Header — WhatsApp style */}
      <div className="shrink-0 bg-card border-b border-border px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2.5 flex items-center gap-2">
        <button onClick={() => navigate('/chats')} className="p-2 rounded-full active:bg-secondary">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
          {otherName[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-[15px] truncate leading-tight">{otherName}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            {otherTyping ? <span className="text-foreground">typing…</span> : 'online'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {messages.map((m, i) => {
          const isMine = m.sender_id === user!.id;
          const isRead = !!m.read_at;
          const prev = messages[i - 1];
          const grouped = prev && prev.sender_id === m.sender_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 60_000);
          return (
            <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-2'}`}>
              <div
                className={`max-w-[78%] px-2.5 py-1.5 text-sm shadow-sm relative ${
                  isMine
                    ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-md'
                    : 'bg-card text-foreground rounded-2xl rounded-bl-md border border-border'
                }`}
              >
                {m.attachment_url && m.attachment_type === 'image' && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer" className="block mb-1">
                    <img src={m.attachment_url} alt="attachment" className="rounded-xl max-h-72 w-full object-cover" loading="lazy" />
                  </a>
                )}
                {m.attachment_url && m.attachment_type !== 'image' && (
                  <a href={m.attachment_url} target="_blank" rel="noreferrer"
                    className={`flex items-center gap-2 mb-1 px-3 py-2 rounded-xl ${isMine ? 'bg-primary-foreground/10' : 'bg-secondary'}`}>
                    <FileText className="w-5 h-5 shrink-0" />
                    <span className="text-xs truncate flex-1">{m.content || 'Document'}</span>
                    <Download className="w-4 h-4 shrink-0 opacity-70" />
                  </a>
                )}
                {m.content && (!m.attachment_url || m.attachment_type === 'image') && (
                  <p className="break-words whitespace-pre-wrap leading-snug" style={{ overflowWrap: 'break-word' }}>{m.content}</p>
                )}
                <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'justify-end' : ''}`}>
                  <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {format(new Date(m.created_at), 'HH:mm')}
                  </span>
                  {isMine && (
                    isRead
                      ? <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/80" />
                      : <Check className="w-3.5 h-3.5 text-primary-foreground/50" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {otherTyping && <TypingIndicator name={otherName} />}
        <div ref={scrollRef} />
      </div>

      {/* Attach menu */}
      {attachMenu && (
        <div className="absolute bottom-[80px] left-3 z-50 bg-card border border-border rounded-2xl shadow-2xl p-2 grid grid-cols-3 gap-1 animate-in fade-in slide-in-from-bottom-2">
          <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-xl active:bg-secondary">
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center"><Camera className="w-5 h-5 text-foreground" /></div>
            <span className="text-[11px] text-foreground">Camera</span>
          </button>
          <button onClick={() => imageInputRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-xl active:bg-secondary">
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center"><ImageIcon className="w-5 h-5 text-foreground" /></div>
            <span className="text-[11px] text-foreground">Photo</span>
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-1 p-3 rounded-xl active:bg-secondary">
            <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center"><FileText className="w-5 h-5 text-foreground" /></div>
            <span className="text-[11px] text-foreground">Document</span>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 bg-background border-t border-border px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {uploading && <p className="text-[11px] text-muted-foreground px-3 pb-1">Uploading…</p>}
        <div className="flex items-end gap-1.5">
          <button
            onClick={() => setAttachMenu(v => !v)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-secondary shrink-0"
          >
            {attachMenu ? <X className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
          <div className="flex-1 bg-card border border-border rounded-3xl px-4 py-2 flex items-center">
            <textarea
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); broadcastTyping(); }}
              onKeyDown={handleKeyDown}
              placeholder="Message"
              rows={1}
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none resize-none max-h-32 leading-snug"
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform disabled:opacity-40 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFilePicked(e, 'image')} />
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFilePicked(e, 'image')} />
        <input ref={fileInputRef} type="file" accept="application/pdf,.doc,.docx,.txt,.zip,image/*" className="hidden" onChange={(e) => onFilePicked(e, 'file')} />
      </div>
    </div>
  );
}
