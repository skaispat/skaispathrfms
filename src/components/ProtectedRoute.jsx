import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  // Check if user exists in localStorage
  const user = JSON.parse(localStorage.getItem('user'));
  const location = window.location.pathname;

  if (!user) {
    return <Navigate to="/user-login" replace />;
  }

  // Admin Bypass: Admins usually have full access. 
  // 'page_access' check for non-admins
  if (user.role !== 'admin' && user.role !== 'Admin' && user.Admin !== 'Yes') {
    const allowedPages = user.page_access || [];
    // Normalize location to match page IDs (remove leading slash)
    let currentPath = location.substring(1) || '/';
    // Handle the root path explicitly if it maps to Dashboard
    if (currentPath === '/') currentPath = '/';

    // Simple check: if path is in allowed list or it's a sub-route (basic checking)
    // Note: This matches the IDs defined in Settings.jsx (e.g., 'indent', 'my-profile')

    // Allow root/dashboard by default if it's in the list as '/'
    // Also allow exact matches

    // Known bypasses for layout components or API calls if any
    // But for main pages:

    const isAllowed = allowedPages.includes(currentPath) ||
      (currentPath === '' && allowedPages.includes('/')) ||
      // Check if it's one of the allowed paths
      allowedPages.some(page => currentPath.startsWith(page)) ||
      // Allow access to 'Access Denied' or similar if we had it
      // For now, if not allowed, redirect to first allowed page or profile
      false;

    // Note: This is a strict check. You might need to refine it if you have complex routes.
    // E.g., 'employee/details/1' might fail if ID is just 'employee'.
    // For this system, routes seem flat mostly.

    if (!isAllowed && location !== '/') {
      // If they have access to some pages, send them to the first one, or Dashboard if allowed.
      const fallback = allowedPages.length > 0 ? allowedPages[0] : '/user-login';
      const redirectPath = fallback === '/' ? '/' : `/${fallback}`;
      // Prevent infinite loop if they are already there or if fallback invalid
      if (location !== redirectPath && !location.startsWith(redirectPath)) {
        // return <Navigate to={redirectPath} replace />;
      }
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;