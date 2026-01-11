import { Navigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useState, useEffect } from 'react';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const [isValid, setIsValid] = useState(null); // null = checking, true = valid, false = invalid

    // Check token synchronously on render
    const checkTokenValidity = (tokenToCheck) => {
        if (!tokenToCheck) return false;
        
        try {
            const decoded = jwtDecode(tokenToCheck);
            const currentTime = Date.now() / 1000;
            
            if (decoded.exp < currentTime) {
                localStorage.removeItem('token');
                localStorage.removeItem('userId');
                localStorage.removeItem('role');
                return false;
            }
            
            if (allowedRoles && !allowedRoles.includes(decoded.role)) {
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Token validation error:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('role');
            return false;
        }
    };

    useEffect(() => {
        // Check token validity on mount and when storage changes
        const checkToken = () => {
            const currentToken = localStorage.getItem('token');
            const currentRole = localStorage.getItem('role');
            
            console.log('[ProtectedRoute] Checking token...', {
                hasToken: !!currentToken,
                role: currentRole,
                allowedRoles: allowedRoles
            });
            
            const isValidToken = checkTokenValidity(currentToken);
            
            console.log('[ProtectedRoute] Token validation result:', isValidToken);
            
            setIsValid(isValidToken);
        };

        // Initial check - immediate
        checkToken();

        // Listen for storage changes (from other tabs)
        const handleStorageChange = (e) => {
            if (e.key === 'token' || e.key === 'role') {
                checkToken();
            }
        };

        // Also listen for custom events (same-tab storage changes)
        const handleCustomStorageChange = () => {
            checkToken();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('localStorageUpdate', handleCustomStorageChange);
        
        // Periodic token validation (every 30 seconds)
        const interval = setInterval(() => {
            checkToken();
        }, 30000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('localStorageUpdate', handleCustomStorageChange);
            clearInterval(interval);
        };
    }, [allowedRoles]);

    // Show loading while checking, or redirect if invalid
    if (isValid === null) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-gray-500">Loading...</div>
            </div>
        );
    }

    if (isValid === false) {
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
