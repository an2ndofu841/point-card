import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { AdminLogin } from './pages/admin/Login';
import { AdminRegister } from './pages/admin/Register';
import { UserHome } from './pages/user/Home';
import { GiftExchange } from './pages/user/GiftExchange';
import { UserTickets } from './pages/user/Tickets';
import { UserSettings } from './pages/user/Settings';
import { UserDesigns } from './pages/user/UserDesigns';
import { UserHistory } from './pages/user/UserHistory'; // Updated import path
import { UserLiveSchedule } from './pages/user/LiveSchedule';
import { UserLiveAttendance } from './pages/user/LiveAttendance';
import { UserTrophies } from './pages/user/Trophies';
import { GroupSearch } from './pages/user/GroupSearch'; // Import GroupSearch
import { ProfileEdit } from './pages/user/ProfileEdit';
import { JoinGroup } from './pages/JoinGroup';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Scanner } from './pages/admin/Scanner';
import { Sync } from './pages/admin/Sync';
import { ManageGifts } from './pages/admin/Gifts';
import { RankConfigPage } from './pages/admin/RankConfig';
import { ManageDesigns } from './pages/admin/DesignConfig';
import { GroupManagement } from './pages/admin/GroupManagement';
import { AdminLiveSchedule } from './pages/admin/LiveSchedule';
import { ManageTrophies } from './pages/admin/Trophies';
import { DebugAddGroup } from './pages/DebugAddGroup';
import { ProtectedAdminRoute } from './components/ProtectedAdminRoute';
import { useSyncGroups } from './hooks/useSyncGroups';
import { DB_ERROR_EVENT } from './lib/db';
import { AlertTriangle } from 'lucide-react';

// Simple Error Banner Component
const DbErrorBanner = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener(DB_ERROR_EVENT, handler);
    return () => window.removeEventListener(DB_ERROR_EVENT, handler);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-4 z-[9999] flex items-center justify-between gap-3 shadow-lg animate-fade-in text-left">
      <div className="flex items-center gap-3">
        <AlertTriangle className="flex-shrink-0" />
        <div>
          <h3 className="font-bold text-sm">データの読み込みに失敗しました</h3>
          <p className="text-xs opacity-90">再読み込みするか、キャッシュを削除してください</p>
        </div>
      </div>
      <button 
          onClick={() => window.location.reload()} 
          className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded text-xs font-bold transition flex-shrink-0"
      >
          再読み込み
      </button>
    </div>
  );
};

function App() {
  useSyncGroups(); // Sync groups on app load

  return (
    <>
      <DbErrorBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/register" element={<AdminRegister />} />
        <Route path="/join/:groupId" element={<JoinGroup />} />
        <Route path="/debug/add-group" element={<DebugAddGroup />} />
        
        {/* User Routes */}
        <Route path="/user/home" element={<UserHome />} />
        <Route path="/home" element={<UserHome />} /> {/* Alias for backward compatibility */}
        <Route path="/user/gifts" element={<GiftExchange />} />
        <Route path="/user/tickets" element={<UserTickets />} />
        <Route path="/user/settings" element={<UserSettings />} />
        <Route path="/user/designs" element={<UserDesigns />} />
        <Route path="/user/history" element={<UserHistory />} /> {/* Added Route */}
        <Route path="/user/live-schedule" element={<UserLiveSchedule />} />
        <Route path="/user/live-attendance" element={<UserLiveAttendance />} />
        <Route path="/user/trophies" element={<UserTrophies />} />
        <Route path="/user/groups/search" element={<GroupSearch />} /> {/* New Route */}
        <Route path="/user/profile" element={<ProfileEdit />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
        <Route path="/admin/scan" element={<ProtectedAdminRoute><Scanner /></ProtectedAdminRoute>} />
        <Route path="/admin/sync" element={<ProtectedAdminRoute><Sync /></ProtectedAdminRoute>} />
        <Route path="/admin/gifts" element={<ProtectedAdminRoute><ManageGifts /></ProtectedAdminRoute>} />
        <Route path="/admin/ranks" element={<ProtectedAdminRoute><RankConfigPage /></ProtectedAdminRoute>} />
        <Route path="/admin/designs" element={<ProtectedAdminRoute><ManageDesigns /></ProtectedAdminRoute>} />
        <Route path="/admin/trophies" element={<ProtectedAdminRoute><ManageTrophies /></ProtectedAdminRoute>} />
        <Route path="/admin/groups" element={<ProtectedAdminRoute><GroupManagement /></ProtectedAdminRoute>} />
        <Route path="/admin/live-schedule" element={<ProtectedAdminRoute><AdminLiveSchedule /></ProtectedAdminRoute>} />
      </Routes>
    </>
  );
}

export default App;
