import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DataProvider } from "@/hooks/useData";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { BottomNav } from "@/components/layout/BottomNav";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import CheckIn from "./pages/CheckIn";
import Workout from "./pages/Workout";
import Week from "./pages/Week";
import Calendar from "./pages/Calendar";
import History from "./pages/History";
import Settings from "./pages/Settings";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DataProvider>
            <UserSettingsProvider>
              <div className="min-h-screen bg-background">
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/checkin" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
                  <Route path="/workout" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
                  <Route path="/week" element={<ProtectedRoute><Week /></ProtectedRoute>} />
                  <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                  <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                  <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                  <Route path="/install" element={<Install />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <BottomNav />
              </div>
            </UserSettingsProvider>
          </DataProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
