import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AuthProvider, useAuth } from "./contexts/AuthContext";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Index from "./pages/Index";
import Project from "./pages/Project";
import ProductInfo from "./pages/ProductInfo";
import Uploading from "./pages/Uploading";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";


const queryClient = new QueryClient();

/* =========================
   Protected Route
   ========================= */
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  // ⛔ Prevent redirect until auth is resolved
  if (isLoading) {
    return null; // or spinner
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && user?.role !== "admin") {
    return <Navigate to="/search" replace />;
  }

  return <>{children}</>;
};

/* =========================
   App
   ========================= */
const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />

          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Solution routes */}
              <Route
                path="/solution"
                element={
                  <ProtectedRoute>
                    <Project />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution/search"
                element={
                  <ProtectedRoute>
                    <Project />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution/search/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <Uploading />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution/search/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <Uploading />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/solution/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Search routes */}
              <Route
                path="/search"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <Uploading />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/search/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Product Info routes */}
              <Route
                path="/product-info"
                element={
                  <ProtectedRoute>
                    <ProductInfo />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/product-info/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <Uploading />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/product-info/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Legacy routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requireAdmin>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/upload"
                element={
                  <ProtectedRoute requireAdmin>
                    <Uploading />
                  </ProtectedRoute>
                }
              />


              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
