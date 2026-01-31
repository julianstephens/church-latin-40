import { useAuth0 } from '@auth0/auth0-react';
import { Loader } from 'lucide-react';
import { useEffect, useState } from 'react';
import LoginPage from './LoginPage';
import { isAnonymousMode } from './services/anonymousSession';
import { pocketbaseService } from './services/pocketbase';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth0();
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [routeReady, setRouteReady] = useState(false);

    useEffect(() => {
        const initializeAuth = async () => {
            // Check if anonymous mode is enabled
            const anonMode = isAnonymousMode();
            setIsAnonymous(anonMode);

            if (isAuthenticated && user?.email) {
                // Authenticated user path
                console.log('[Protected Route] Authenticating with PocketBase');
                try {
                    await pocketbaseService.authenticateUser(user.email);
                    await pocketbaseService.initializeUserProgress();
                } catch (error) {
                    console.error('Error authenticating with PocketBase:', error);
                }
            } else if (anonMode) {
                // Anonymous mode path
                console.log('[Protected Route] Anonymous mode enabled, skipping PocketBase auth');
                pocketbaseService.setAnonymousMode(true);
            }

            setRouteReady(true);
        };

        initializeAuth();
    }, [isAuthenticated, user?.email]);

    // Loading state during Auth0 initialization
    if (isLoading || !routeReady) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader className="h-12 w-12 text-red-900 dark:text-red-600 animate-spin" />
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Loading your session...</p>
                </div>
            </div>
        );
    }

    // Not authenticated and not in anonymous mode - show login
    if (!isAuthenticated && !isAnonymous) {
        return <LoginPage />;
    }

    // Authenticated or in anonymous mode - render app
    return <>{children}</>;
};

export default ProtectedRoute;


