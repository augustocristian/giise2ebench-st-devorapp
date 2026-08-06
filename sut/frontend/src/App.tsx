import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './views/LoginPage';
import RegisterPage from './views/RegisterPage';
import HomePage from './views/HomePage';
import RestaurantRecommendationPage from './views/RestaurantRecommendationPage';
import HistoryPage from './views/HistoryPage';
import FavoritesPage from './views/FavoritesPage';
import SavedForLaterPage from './views/SavedForLaterPage';
import ValoracionesPage from './views/ValoracionesPage';
import ProfilePage from './views/ProfilePage';
import ProtectedRoute from './components/ProtectedRoute';
import { NotificationProvider } from './components/NotificationSystem';
import './App.css';

function App() {
  return (
    <NotificationProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/home" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/recommend-restaurants" element={
            <ProtectedRoute>
              <RestaurantRecommendationPage />
            </ProtectedRoute>
          } />
          <Route path="/history" element={
            <ProtectedRoute>
              <HistoryPage />
            </ProtectedRoute>
          } />
          <Route path="/favorites" element={
            <ProtectedRoute>
              <FavoritesPage />
            </ProtectedRoute>
          } />
          <Route path="/saved-for-later" element={
            <ProtectedRoute>
              <SavedForLaterPage />
            </ProtectedRoute>
          } />
          <Route path="/mis-valoraciones" element={
            <ProtectedRoute>
              <ValoracionesPage />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </NotificationProvider>
  );
}

export default App;
