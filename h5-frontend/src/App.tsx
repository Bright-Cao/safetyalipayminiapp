import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthParamsProvider from './providers/AuthParamsProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Training from './pages/Training';
import Exam from './pages/Exam';
import ExamResult from './pages/ExamResult';
import Apply from './pages/Apply';
import Certificate from './pages/Certificate';
import Admin from './pages/Admin';
import WorkshopAdmin from './pages/WorkshopAdmin';
import SafetyAdmin from './pages/SafetyAdmin';
import Practice from './pages/Practice';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));

  // Simplistic auth check
  const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
    return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
  };

  return (
    <Router>
      <AuthParamsProvider>
        <Routes>
          <Route path="/login" element={<Login setAuth={setIsAuthenticated} />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard onLogout={() => setIsAuthenticated(false)} /></PrivateRoute>} />
          <Route path="/training" element={<PrivateRoute><Training /></PrivateRoute>} />
          <Route path="/exam" element={<PrivateRoute><Exam /></PrivateRoute>} />
          <Route path="/exam-result" element={<PrivateRoute><ExamResult /></PrivateRoute>} />
          <Route path="/apply" element={<PrivateRoute><Apply /></PrivateRoute>} />
          <Route path="/certificate" element={<PrivateRoute><Certificate /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/workshop-admin" element={<PrivateRoute><WorkshopAdmin /></PrivateRoute>} />
          <Route path="/safety-admin" element={<PrivateRoute><SafetyAdmin /></PrivateRoute>} />
          <Route path="/practice" element={<PrivateRoute><Practice /></PrivateRoute>} />
          <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
        </Routes>
      </AuthParamsProvider>
    </Router>
  );
}

export default App;

