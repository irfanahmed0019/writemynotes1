import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "./pages/Login";
import ModeSelect from "./pages/ModeSelect";
import Marketplace from "./pages/Marketplace";
import PostRequest from "./pages/PostRequest";
import PostDetail from "./pages/PostDetail";
import ChatList from "./pages/ChatList";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import WriterProfile from "./pages/WriterProfile";
import Activity from "./pages/Activity";
import Install from "./pages/Install";
import AdminDashboard from "./pages/AdminDashboard";
import Study from "./pages/Study";
import NotFound from "./pages/NotFound";
import MessagePopup from "./components/MessagePopup";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  return <Navigate to={user ? "/marketplace" : "/login"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <BrowserRouter>
          <MessagePopup />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/mode" element={<ModeSelect />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/post" element={<PostRequest />} />
            <Route path="/post/:id" element={<PostDetail />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/chats" element={<ChatList />} />
            <Route path="/chat/:id" element={<Chat />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/writer/:userId" element={<WriterProfile />} />
            <Route path="/install" element={<Install />} />
            <Route path="/study" element={<Study />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
