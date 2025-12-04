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
import { UserHistory } from './pages/user/History'; // Import UserHistory
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
import { DebugAddGroup } from './pages/DebugAddGroup';
import { ProtectedAdminRoute } from './components/ProtectedAdminRoute';

function App() {
  return (
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
      <Route path="/user/groups/search" element={<GroupSearch />} /> {/* New Route */}
      <Route path="/user/profile" element={<ProfileEdit />} />
      
      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={<ProtectedAdminRoute><AdminDashboard /></ProtectedAdminRoute>} />
      <Route path="/admin/scan" element={<ProtectedAdminRoute><Scanner /></ProtectedAdminRoute>} />
      <Route path="/admin/sync" element={<ProtectedAdminRoute><Sync /></ProtectedAdminRoute>} />
      <Route path="/admin/gifts" element={<ProtectedAdminRoute><ManageGifts /></ProtectedAdminRoute>} />
      <Route path="/admin/ranks" element={<ProtectedAdminRoute><RankConfigPage /></ProtectedAdminRoute>} />
      <Route path="/admin/designs" element={<ProtectedAdminRoute><ManageDesigns /></ProtectedAdminRoute>} />
      <Route path="/admin/groups" element={<ProtectedAdminRoute><GroupManagement /></ProtectedAdminRoute>} />
    </Routes>
  );
}

export default App;
