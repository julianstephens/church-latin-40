import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';
import { pocketbaseService } from '../services/pocketbase';

export function useProgressSync() {
    const { user, isAuthenticated } = useAuth0();
    const [isUserIdSet, setIsUserIdSet] = useState(false);

    useEffect(() => {
        if (isAuthenticated && user?.sub) {
            pocketbaseService.setUserId(user.sub);
            setIsUserIdSet(true);
        }
    }, [isAuthenticated, user?.sub]);

    return { isUserIdSet };
}
