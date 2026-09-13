import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import VerifyOtp from "./pages/VerifyOtp";
import ClientPortal from "./pages/ClientPortal";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectBoard from "./pages/ProjectBoard";
import Clients from "./pages/Clients";
import Attendance from "./pages/Attendance";
import Users from "./pages/Users";
import UserProfile from "./pages/UserProfile";
import Chat from "./pages/Chat";
import Complaints from "./pages/Complaints";
import Calendar from "./pages/Calendar";
import ActivityLog from "./pages/ActivityLog";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/verify-email/:token" element={<VerifyEmail />} />
      <Route path="/verify-otp" element={<VerifyOtp />} />
      <Route path="/portal/:token" element={<ClientPortal />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/projects"
          element={
            <ProtectedRoute permission={["projects.view", "projects.manage"]}>
              <Projects />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute permission={["projects.view", "projects.manage"]}>
              <ProjectBoard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <ProtectedRoute permission={["clients.view", "clients.manage"]}>
              <Clients />
            </ProtectedRoute>
          }
        />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/complaints" element={<Complaints />} />
        <Route
          path="/activity-log"
          element={
            <ProtectedRoute permission={["users.manage", "projects.manage", "clients.manage"]}>
              <ActivityLog />
            </ProtectedRoute>
          }
        />
        <Route path="/settings" element={<Settings />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission="users.manage">
              <Users />
            </ProtectedRoute>
          }
        />
        <Route path="/users/:id" element={<UserProfile />} />
      </Route>
    </Routes>
  );
}
