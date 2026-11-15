import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// All Pages
import Home from "./pages/Home";
import Login from "./pages/login"; // Aapke folder me small 'login.jsx' hai
import Register from "./pages/Register";
import CreateProfile from "./pages/CreateProfile";
import Dashboard from "./pages/Dashboard";
import Messages from "./pages/Messages";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 1. Public Home */}
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />

          {/* 2. Authentication Pages */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* 3. Protected Pages (Login zaroori hai) */}
          <Route
            path="/create-profile"
            element={
              <ProtectedRoute>
                <CreateProfile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* Messages ko bhi Protected banaya */}
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <Messages />
              </ProtectedRoute>
            }
          />

          {/* 4. Fallback (Hamesha sabse aakhri me hona chahiye) */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}