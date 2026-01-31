import { useAuth0 } from '@auth0/auth0-react';
import { useEffect } from 'react';
import LoginPage from './LoginPage';
import { pocketbaseService } from './services/pocketbase';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading, user } = useAuth0();

    // Authenticate to PocketBase when Auth0 authenticates
    useEffect(() => {
        if (isAuthenticated && user?.email) {
            pocketbaseService.authenticateUser(user.email).catch(error => {
                console.error('Error authenticating with PocketBase:', error);
            });
            // Initialize user progress record if it doesn't exist
            pocketbaseService.initializeUserProgress().catch(error => {
                console.error('Error initializing user progress:', error);
            });
        }
    }, [isAuthenticated, user?.email]);

    if (isLoading) {
        return (
            <div className="app-container">
                <div className="loading-state">
                    <div className="loading-text">Loading...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <LoginPage />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;


