import { Routes, Route } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UserHome } from './pages/user/Home';
import { GiftExchange } from './pages/user/GiftExchange';
import { UserTickets } from './pages/user/Tickets';
import { UserSettings } from './pages/user/Settings';
import { UserDesigns } from './pages/user/UserDesigns';
import { UserHistory } from './pages/user/History'; // Import UserHistory
import { ProfileEdit } from './pages/user/ProfileEdit';
import { JoinGroup } from './pages/JoinGroup';
import { AdminDashboard } from './pages/admin/Dashboard';
import { Scanner } from './pages/admin/Scanner';
import { Sync } from './pages/admin/Sync';
import { ManageGifts } from './pages/admin/Gifts';
import { RankConfigPage } from './pages/admin/RankConfig';
import { ManageDesigns } from './pages/admin/DesignConfig';
import { GroupManagement } from './pages/admin/GroupManagement';
import { DebugAddGroup } from './pages/DebugAddGroup';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
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
      <Route path="/user/profile" element={<ProfileEdit />} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/scan" element={<Scanner />} />
      <Route path="/admin/sync" element={<Sync />} />
      <Route path="/admin/gifts" element={<ManageGifts />} />
      <Route path="/admin/ranks" element={<RankConfigPage />} />
      <Route path="/admin/designs" element={<ManageDesigns />} />
      <Route path="/admin/groups" element={<GroupManagement />} />
    </Routes>
  );
}

export default App;
