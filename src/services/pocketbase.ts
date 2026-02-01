import PocketBase from "pocketbase";
import POCKETBASE_COLLECTIONS from "../utils/collections";
import { logger } from "../utils/logger";
import { isAnonymousMode } from "./anonymousSession";
import { getEnvironmentConfig } from "./envValidation";

const config = getEnvironmentConfig();
const POCKETBASE_URL = config.pocketbaseUrl;

export interface UserProgress {
  completedLessons: number[];
  quizScores: { [lessonId: number]: number };
  currentLesson: number;
  theme: "light" | "dark";
  // New fields for better progress tracking
  lastAccessedAt?: string; // ISO timestamp
  lastLessonAccessedId?: number; // Last lesson the user viewed
  totalProgress?: number; // Cached percentage (0-100)
}

class PocketBaseService {
  private pb: PocketBase;
  private pbUserId: string | null = null;
  private userIdPromise: Promise<string> | null = null;
  private resolveUserId: ((userId: string) => void) | null = null;
  private anonymousMode: boolean = false;

  constructor() {
    this.pb = new PocketBase(POCKETBASE_URL);
    this.userIdPromise = new Promise((resolve) => {
      this.resolveUserId = resolve;
    });
  }

  /**
   * Get the PocketBase instance for direct access
   */
  getPocketBase(): PocketBase {
    return this.pb;
  }

  /**
   * Set anonymous mode - skip PocketBase, use localStorage only
   */
  setAnonymousMode(enabled: boolean): void {
    this.anonymousMode = enabled;
    if (enabled) {
      this.pbUserId = "anonymous";
      if (this.resolveUserId) {
        this.resolveUserId("anonymous");
      }
      logger.debug("[PocketBase Service] Anonymous mode enabled");
    }
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
        const authRecord = await this.pb
          .collection("users")
          .authWithPassword(email, password);
        this.pbUserId = authRecord.record.id;
        if (this.resolveUserId) {
          this.resolveUserId(this.pbUserId);
        }
        logger.debug(
          `[PocketBase Service] Successfully authenticated user: ${this.pbUserId}`,
        );
        return this.pbUserId;
      } catch (authError: unknown) {
        // User doesn't exist, create them
        const error = authError as Record<string, unknown>;
        if (
          error.status === 400 ||
          (error.message as string)?.includes("Invalid credentials")
        ) {
          try {
            logger.debug(
              `[PocketBase Service] User does not exist, creating new user for: ${email}`,
            );
            // Create new user using the unauthenticated API
            const newRecord = await this.pb.collection("users").create({
              email,
              password,
              passwordConfirm: password,
            });
            logger.debug(
              `[PocketBase Service] User created successfully: ${newRecord.id}`,
            );

            // Authenticate the newly created user
            const authRecord = await this.pb
              .collection("users")
              .authWithPassword(email, password);
            this.pbUserId = authRecord.record.id;
            if (this.resolveUserId) {
              this.resolveUserId(this.pbUserId);
            }
            logger.debug(
              `[PocketBase Service] Successfully authenticated new user: ${this.pbUserId}`,
            );
            return this.pbUserId;
          } catch (createError: unknown) {
            // If user creation fails due to API rules, log detailed error
            const createErr = createError as Record<string, unknown>;
            logger.error(
              "[PocketBase Service] Failed to create user. Ensure 'users' collection has 'Create' rule set to allow unauthenticated creation:",
              createErr,
            );
            console.error("Failed to create PocketBase user:", createError);
            throw createError;
          }
        } else {
          throw authError;
        }
      }
    } catch (error) {
      console.error("Failed to authenticate with PocketBase:", error);
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
    const base = email.toLowerCase().split("@")[0];
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
      throw new Error("User ID promise not initialized");
    }

    return Promise.race([
      this.userIdPromise,
      new Promise<string>((_, reject) =>
        setTimeout(
          () => reject(new Error("User ID not set within timeout")),
          timeoutMs,
        ),
      ),
    ]);
  }

  async loadProgress(): Promise<UserProgress> {
    // In anonymous mode, always use localStorage
    if (this.anonymousMode || isAnonymousMode()) {
      return this.loadProgressFromLocalStorage();
    }

    if (!this.pbUserId) {
      throw new Error("User ID not set");
    }

    try {
      const records = await this.pb
        .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
        .getList(1, 1, {
          filter: `userId = "${this.pbUserId}"`,
        });

      if (records.items && records.items.length > 0) {
        const record = records.items[0];
        const theme =
          record.theme === "dark" || record.theme === "light"
            ? record.theme
            : "light";

        // Ensure completedLessons is an array
        const completedLessons = Array.isArray(record.completedLessons)
          ? record.completedLessons
          : [];

        const progress = {
          completedLessons: completedLessons,
          quizScores: record.quizScores || {},
          currentLesson: record.currentLesson || 1,
          theme: theme,
          lastAccessedAt: record.lastAccessedAt,
          lastLessonAccessedId: record.lastLessonAccessedId,
          totalProgress: record.totalProgress,
        };

        logger.debug(
          `[PB Service] Loaded progress with theme: ${progress.theme}, completed lessons: ${progress.completedLessons.length}`,
        );
        return progress;
      }

      return this.getDefaultProgress();
    } catch (error) {
      console.error("Failed to load progress from PocketBase:", error);
      logger.warn("Falling back to localStorage");
      return this.loadProgressFromLocalStorage();
    }
  }

  async saveProgress(progress: UserProgress): Promise<void> {
    // In anonymous mode, always use localStorage
    if (this.anonymousMode || isAnonymousMode()) {
      return this.saveProgressToLocalStorage(progress);
    }

    if (!this.pbUserId) {
      throw new Error("User ID not set");
    }

    try {
      // Add/update timestamp and calculate total progress
      const progressWithMetadata: UserProgress = {
        ...progress,
        lastAccessedAt: new Date().toISOString(),
        totalProgress: Math.round(
          (progress.completedLessons.length / 40) * 100,
        ),
      };

      // Find existing record
      const records = await this.pb
        .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
        .getList(1, 1, {
          filter: `userId = "${this.pbUserId}"`,
        });

      if (records.items && records.items.length > 0) {
        // Update existing record
        const recordId = records.items[0].id;
        await this.pb
          .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
          .update(recordId, progressWithMetadata);
      } else {
        // Create new record
        await this.pb.collection(POCKETBASE_COLLECTIONS.USER_PROGRESS).create({
          ...progressWithMetadata,
          userId: this.pbUserId,
        });
      }
    } catch (error) {
      console.error("Failed to save progress to PocketBase:", error);
      logger.warn("Falling back to localStorage");
      this.saveProgressToLocalStorage(progress);
    }
  }

  private loadProgressFromLocalStorage(): UserProgress {
    try {
      // Try multiple localStorage keys for backward compatibility
      const keys = [
        `church-latin-progress-${this.pbUserId}`, // Newer key with user ID
        "church-latin-progress", // Legacy key without user ID
      ];

      for (const key of keys) {
        if (key.includes("null") || key.includes("undefined")) continue;
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          logger.debug(`Loaded progress from localStorage key: ${key}`);
          return parsed;
        }
      }
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
    return this.getDefaultProgress();
  }

  private saveProgressToLocalStorage(progress: UserProgress): void {
    try {
      // Save with both legacy and new keys for compatibility
      const modernKey = `church-latin-progress-${this.pbUserId}`;
      const legacyKey = "church-latin-progress";

      if (!modernKey.includes("null") && !modernKey.includes("undefined")) {
        localStorage.setItem(modernKey, JSON.stringify(progress));
      }
      // Always save to legacy key as fallback
      localStorage.setItem(legacyKey, JSON.stringify(progress));
    } catch (error) {
      console.error("Failed to save to localStorage:", error);
    }
  }

  private getDefaultProgress(): UserProgress {
    return {
      completedLessons: [],
      quizScores: {},
      currentLesson: 1,
      theme: "light",
      lastAccessedAt: new Date().toISOString(),
      lastLessonAccessedId: undefined,
      totalProgress: 0,
    };
  }

  async initializeUserProgress(): Promise<void> {
    if (!this.pbUserId) {
      throw new Error("User ID not set");
    }

    try {
      // Check if user already has a record
      const records = await this.pb
        .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
        .getList(1, 1, {
          filter: `userId = "${this.pbUserId}"`,
        });

      const recordExists = records.items && records.items.length > 0;

      if (!recordExists) {
        // Create a new record with default progress
        const defaultProgress = this.getDefaultProgress();
        await this.pb.collection(POCKETBASE_COLLECTIONS.USER_PROGRESS).create({
          ...defaultProgress,
          userId: this.pbUserId,
        });
      }
    } catch (error) {
      console.error("Failed to initialize user progress:", error);
    }
  }

  /**
   * Track when a user accesses a specific lesson
   */
  async trackLessonAccess(lessonId: number): Promise<void> {
    try {
      const progress = await this.loadProgress();
      progress.lastLessonAccessedId = lessonId;
      await this.saveProgress(progress);
    } catch (error) {
      console.error("Failed to track lesson access:", error);
    }
  }
}

export const pocketbaseService = new PocketBaseService();
