import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DataProvider } from "@/hooks/useData";
import { UserSettingsProvider } from "@/hooks/useUserSettings";
import { EquipmentProvider } from "@/hooks/useEquipment";
import { UserRoleProvider } from "@/hooks/useUserRole";
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
import WorkoutReview from "./pages/WorkoutReview";
import Equipment from "./pages/Equipment";
import BodyComposition from "./pages/BodyComposition";
import AlcoholIntake from "./pages/AlcoholIntake";
import ResetPassword from "./pages/ResetPassword";
import PerformanceCoach from "./pages/PerformanceCoach";
import SelectRole from "./pages/SelectRole";
import CoachDashboard from "./pages/CoachDashboard";
import CoachAthleteProfile from "./pages/CoachAthleteProfile";
import CoachAthleteCalendar from "./pages/CoachAthleteCalendar";
import PrescribeWorkout from "./pages/PrescribeWorkout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UserRoleProvider>
            <DataProvider>
              <UserSettingsProvider>
                <EquipmentProvider>
                  <div className="min-h-screen bg-background">
                    <Routes>
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/select-role" element={<SelectRole />} />
                      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                      <Route path="/checkin" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
                      <Route path="/workout" element={<ProtectedRoute><Workout /></ProtectedRoute>} />
                      <Route path="/week" element={<ProtectedRoute><Week /></ProtectedRoute>} />
                      <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
                      <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                      <Route path="/workout-review" element={<ProtectedRoute><WorkoutReview /></ProtectedRoute>} />
                      <Route path="/equipment" element={<ProtectedRoute><Equipment /></ProtectedRoute>} />
                      <Route path="/body-composition" element={<ProtectedRoute><BodyComposition /></ProtectedRoute>} />
                      <Route path="/alcohol-intake" element={<ProtectedRoute><AlcoholIntake /></ProtectedRoute>} />
                      <Route path="/performance-coach" element={<ProtectedRoute><PerformanceCoach /></ProtectedRoute>} />
                      {/* Coach routes */}
                      <Route path="/coach" element={<ProtectedRoute requiredRole="coach"><CoachDashboard /></ProtectedRoute>} />
                      <Route path="/coach/athlete/:id" element={<ProtectedRoute requiredRole="coach"><CoachAthleteProfile /></ProtectedRoute>} />
                      <Route path="/coach/athlete/:id/calendar" element={<ProtectedRoute requiredRole="coach"><CoachAthleteCalendar /></ProtectedRoute>} />
                      <Route path="/coach/prescribe" element={<ProtectedRoute requiredRole="coach"><PrescribeWorkout /></ProtectedRoute>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    <BottomNav />
                  </div>
                </EquipmentProvider>
              </UserSettingsProvider>
            </DataProvider>
          </UserRoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
