import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useMe } from "./lib/api";
import LoginPage from "./pages/LoginPage";
import TripsPage from "./pages/TripsPage";
import TripPage from "./pages/TripPage";
import SharePage from "./pages/SharePage";
import SettingsPage from "./pages/SettingsPage";

function Guard({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.isLoading) return <div className="h-full grid place-items-center text-ink-3">Loading…</div>;
  if (me.isError) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/s/:token" element={<SharePage />} />
      <Route path="/" element={<Guard><TripsPage /></Guard>} />
      <Route path="/t/:slug" element={<Guard><TripPage /></Guard>} />
      <Route path="/settings" element={<Guard><SettingsPage /></Guard>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
