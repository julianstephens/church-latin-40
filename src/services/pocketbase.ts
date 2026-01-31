import PocketBase from 'pocketbase';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL;
const POCKETBASE_COLLECTION = import.meta.env.VITE_POCKETBASE_COLLECTION || 'user_progress';

export interface UserProgress {
    completedLessons: number[];
    quizScores: { [lessonId: number]: number; };
    currentLesson: number;
    theme: 'light' | 'dark';
}

class PocketBaseService {
    private pb: PocketBase;
    private pbUserId: string | null = null;
    private userIdPromise: Promise<string> | null = null;
    private resolveUserId: ((userId: string) => void) | null = null;

    constructor() {
        this.pb = new PocketBase(POCKETBASE_URL);
        this.userIdPromise = new Promise((resolve) => {
            this.resolveUserId = resolve;
        });
    }

    /**
     * Authenticate to PocketBase using Auth0 email
     * Creates a PocketBase user if they don't exist
     */
    async authenticateUser(email: string): Promise<string> {
        try {
            // Generate a password from the email (hash-like)
            // This is not used for login, just for PocketBase user creation
            const password = this.generatePasswordFromEmail(email);

            try {
                // Try to authenticate existing user
                const authRecord = await this.pb.collection('users').authWithPassword(email, password);
                this.pbUserId = authRecord.record.id;
                if (this.resolveUserId) {
                    this.resolveUserId(this.pbUserId);
                }
                return this.pbUserId;
            } catch (authError: any) {
                // User doesn't exist, create them
                if (authError.status === 400 || authError.message?.includes('Invalid credentials')) {
                    try {
                        // const newRecord = await this.pb.collection('users').create({
                        //     email,
                        //     password,
                        //     passwordConfirm: password,
                        // });

                        // Authenticate the newly created user
                        const authRecord = await this.pb.collection('users').authWithPassword(email, password);
                        this.pbUserId = authRecord.record.id;
                        if (this.resolveUserId) {
                            this.resolveUserId(this.pbUserId);
                        }
                        return this.pbUserId;
                    } catch (createError) {
                        console.error('Failed to create PocketBase user:', createError);
                        throw createError;
                    }
                } else {
                    throw authError;
                }
            }
        } catch (error) {
            console.error('Failed to authenticate with PocketBase:', error);
            throw error;
        }
    }

    /**
     * Generate a deterministic password from email
     * This ensures the same email always gets the same password
     */
    private generatePasswordFromEmail(email: string): string {
        // Use email + a fixed salt to generate a consistent password
        // This is deterministic so we can recreate it if needed
        const base = email.toLowerCase().split('@')[0];
        return `${base}!PocketBase2024`;
    }

    setUserId(userId: string) {
        // Deprecated - use authenticateUser instead
        this.pbUserId = userId;
        if (this.resolveUserId) {
            this.resolveUserId(userId);
        }
    }

    async waitForUserId(timeoutMs: number = 5000): Promise<string> {
        if (this.pbUserId) {
            return this.pbUserId;
        }

        if (!this.userIdPromise) {
            throw new Error('User ID promise not initialized');
        }

        return Promise.race([
            this.userIdPromise,
            new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('User ID not set within timeout')), timeoutMs)
            ),
        ]);
    }

    async loadProgress(): Promise<UserProgress> {
        if (!this.pbUserId) {
            throw new Error('User ID not set');
        }

        try {
            const records = await this.pb.collection(POCKETBASE_COLLECTION).getList(1, 1, {
                filter: `userId = "${this.pbUserId}"`,
            });

            if (records.items && records.items.length > 0) {
                const record = records.items[0];
                return {
                    completedLessons: record.completedLessons || [],
                    quizScores: record.quizScores || {},
                    currentLesson: record.currentLesson || 1,
                    theme: record.theme || 'light',
                };
            }

            return this.getDefaultProgress();
        } catch (error) {
            console.error('Failed to load progress from PocketBase:', error);
            console.warn('Falling back to localStorage');
            return this.loadProgressFromLocalStorage();
        }
    }

    async saveProgress(progress: UserProgress): Promise<void> {
        if (!this.pbUserId) {
            throw new Error('User ID not set');
        }

        try {
            // Find existing record
            const records = await this.pb.collection(POCKETBASE_COLLECTION).getList(1, 1, {
                filter: `userId = "${this.pbUserId}"`,
            });

            if (records.items && records.items.length > 0) {
                // Update existing record
                const recordId = records.items[0].id;
                await this.pb.collection(POCKETBASE_COLLECTION).update(recordId, progress);
            } else {
                // Create new record
                await this.pb.collection(POCKETBASE_COLLECTION).create({
                    ...progress,
                    userId: this.pbUserId,
                });
            }
        } catch (error) {
            console.error('Failed to save progress to PocketBase:', error);
            console.warn('Falling back to localStorage');
            this.saveProgressToLocalStorage(progress);
        }
    }

    private loadProgressFromLocalStorage(): UserProgress {
        try {
            const storageKey = `church-latin-progress-${this.pbUserId}`;
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
        return this.getDefaultProgress();
    }

    private saveProgressToLocalStorage(progress: UserProgress): void {
        try {
            const storageKey = `church-latin-progress-${this.pbUserId}`;
            localStorage.setItem(storageKey, JSON.stringify(progress));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    private getDefaultProgress(): UserProgress {
        return {
            completedLessons: [],
            quizScores: {},
            currentLesson: 1,
            theme: 'light',
        };
    }

    async initializeUserProgress(): Promise<void> {
        if (!this.pbUserId) {
            throw new Error('User ID not set');
        }

        try {
            // Check if user already has a record
            const records = await this.pb.collection(POCKETBASE_COLLECTION).getList(1, 1, {
                filter: `userId = "${this.pbUserId}"`,
            });

            const recordExists = records.items && records.items.length > 0;

            if (!recordExists) {
                // Create a new record with default progress
                const defaultProgress = this.getDefaultProgress();
                await this.pb.collection(POCKETBASE_COLLECTION).create({
                    ...defaultProgress,
                    userId: this.pbUserId,
                });
            }
        } catch (error) {
            console.error('Failed to initialize user progress:', error);
        }
    }
}

export const pocketbaseService = new PocketBaseService();