import { createBrowserRouter, RouterProvider, Navigate, Outlet } from "react-router";
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import CourseDetails from './pages/CourseDetails';
import Signup from './pages/Signup';
import './index.css';

// Protected Route wrapper
function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-blue-400 font-semibold tracking-wide">Loading LogicBox LMS...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

// Ensure AuthContext is provided to the app and its nested routes
function AuthWrapper() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <AuthWrapper />,
    children: [
      {
        path: "/login",
        element: <Login />,
      },
      {
        path: "/signup",
        element: <Signup />,
      },
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/",
            element: <Dashboard />,
          },
          {
            path: "/courses",
            element: <Courses />,
          },
          {
            path: "/courses/:batchId",
            element: <CourseDetails />,
          }
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
