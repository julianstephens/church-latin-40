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
    logger.debug(`[PocketBase] saveProgress() called with:`, {
      anonymousMode: this.anonymousMode,
      pbUserId: this.pbUserId,
      completedLessons: progress.completedLessons,
      currentLesson: progress.currentLesson,
      theme: progress.theme,
    });

    // In anonymous mode, always use localStorage
    if (this.anonymousMode || isAnonymousMode()) {
      logger.debug(
        `[PocketBase] In anonymous mode, saving to localStorage only`,
      );
      return this.saveProgressToLocalStorage(progress);
    }

    if (!this.pbUserId) {
      logger.error(`[PocketBase] User ID not set in saveProgress`);
      throw new Error("User ID not set");
    }

    try {
      // Calculate total progress
      const totalProgress = Math.round(
        (progress.completedLessons.length / 40) * 100,
      );

      logger.debug(`[PocketBase] Calculated totalProgress: ${totalProgress}%`);

      // Format data for PocketBase - only include fields that exist in schema
      const pbData = {
        userId: this.pbUserId,
        completedLessons: progress.completedLessons,
        quizScores: progress.quizScores,
        currentLesson: progress.currentLesson,
        theme: progress.theme,
        lastAccessedAt: new Date().toISOString().split("T")[0], // PocketBase date format (YYYY-MM-DD)
        lastLessonAccessedId: progress.lastLessonAccessedId,
        totalProgress: totalProgress,
      };

      logger.debug(`[PocketBase] Formatted pbData:`, {
        userId: pbData.userId,
        completedLessons: pbData.completedLessons,
        currentLesson: pbData.currentLesson,
        theme: pbData.theme,
        lastAccessedAt: pbData.lastAccessedAt,
        totalProgress: pbData.totalProgress,
      });

      // Find existing record
      logger.debug(
        `[PocketBase] Looking for existing record with userId: ${this.pbUserId}`,
      );
      const records = await this.pb
        .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
        .getList(1, 1, {
          filter: `userId = "${this.pbUserId}"`,
        });

      logger.debug(
        `[PocketBase] Found ${records.items?.length || 0} existing record(s)`,
      );

      if (records.items && records.items.length > 0) {
        // Update existing record - don't include resourceId or userId as they're immutable
        const recordId = records.items[0].id;
        const updateData = {
          completedLessons: pbData.completedLessons,
          quizScores: pbData.quizScores,
          currentLesson: pbData.currentLesson,
          theme: pbData.theme,
          lastAccessedAt: pbData.lastAccessedAt,
          lastLessonAccessedId: pbData.lastLessonAccessedId,
          totalProgress: pbData.totalProgress,
        };
        logger.debug(
          `[PocketBase] Updating existing record ${recordId}:`,
          updateData,
        );
        await this.pb
          .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
          .update(recordId, updateData);
        logger.debug(`[PocketBase] Successfully updated record ${recordId}`);
      } else {
        // Create new record with resourceId (required field)
        const resourceId = `progress_${this.pbUserId}`;
        logger.debug(
          `[PocketBase] No existing record found, creating new one with resourceId: ${resourceId}`,
        );

        const createData = {
          userId: this.pbUserId,
          resourceId: resourceId,
          completedLessons: pbData.completedLessons,
          quizScores: pbData.quizScores,
          currentLesson: pbData.currentLesson,
          theme: pbData.theme,
          lastAccessedAt: pbData.lastAccessedAt,
          lastLessonAccessedId: pbData.lastLessonAccessedId,
          totalProgress: pbData.totalProgress,
        };

        logger.debug(`[PocketBase] Creating new record with data:`, {
          userId: createData.userId,
          resourceId: createData.resourceId,
          completedLessons: createData.completedLessons,
          currentLesson: createData.currentLesson,
          theme: createData.theme,
          lastAccessedAt: createData.lastAccessedAt,
          totalProgress: createData.totalProgress,
        });

        await this.pb
          .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
          .create(createData);
        logger.debug(`[PocketBase] Successfully created new progress record`);
      }

      logger.debug(`[PocketBase] saveProgress() completed successfully`);
    } catch (error) {
      // Log detailed error information
      let errorMessage = "Unknown error";
      let errorData = {};

      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if it's a PocketBase error with response data
        if ("data" in error && typeof error.data === "object") {
          errorData = error.data;
        }
        if ("response" in error && typeof error.response === "object") {
          errorData = error.response;
        }
      } else if (typeof error === "object" && error !== null) {
        errorData = error;
      }

      logger.error(`[PocketBase] Failed to save progress to PocketBase:`, {
        error: errorMessage,
        errorData: errorData,
        userId: this.pbUserId,
        completedLessons: progress.completedLessons,
      });
      logger.warn(`[PocketBase] Falling back to localStorage`);
      this.saveProgressToLocalStorage(progress);
    }
  }

  async initializeUserProgress(): Promise<void> {
    if (this.anonymousMode || isAnonymousMode() || !this.pbUserId) {
      return;
    }

    try {
      const records = await this.pb
        .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
        .getList(1, 1, {
          filter: `userId = "${this.pbUserId}"`,
        });

      const recordExists = records.items && records.items.length > 0;

      if (!recordExists) {
        // Create a new record with default progress
        const defaultProgress = this.getDefaultProgress();
        const resourceId = `progress_${this.pbUserId}`;

        // Format data for PocketBase
        const pbData = {
          userId: this.pbUserId,
          resourceId: resourceId,
          completedLessons: defaultProgress.completedLessons,
          quizScores: defaultProgress.quizScores,
          currentLesson: defaultProgress.currentLesson,
          theme: defaultProgress.theme,
          lastAccessedAt: new Date().toISOString().split("T")[0], // PocketBase date format (YYYY-MM-DD)
          lastLessonAccessedId: defaultProgress.lastLessonAccessedId,
          totalProgress: defaultProgress.totalProgress,
        };

        await this.pb
          .collection(POCKETBASE_COLLECTIONS.USER_PROGRESS)
          .create(pbData);
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

  /**
   * Get default progress object for new users
   */
  private getDefaultProgress(): UserProgress {
    return {
      completedLessons: [],
      quizScores: {},
      currentLesson: 1,
      theme: "light",
      lastAccessedAt: new Date().toISOString().split("T")[0],
      lastLessonAccessedId: 1,
      totalProgress: 0,
    };
  }

  /**
   * Load progress from localStorage
   */
  private loadProgressFromLocalStorage(): UserProgress {
    try {
      const saved = localStorage.getItem("church_latin_progress");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure completedLessons is an array
        return {
          ...this.getDefaultProgress(),
          ...parsed,
          completedLessons: Array.isArray(parsed.completedLessons)
            ? parsed.completedLessons
            : [],
          quizScores:
            typeof parsed.quizScores === "object" ? parsed.quizScores : {},
        };
      }
    } catch (error) {
      console.error("Error loading progress from localStorage:", error);
    }
    return this.getDefaultProgress();
  }

  /**
   * Save progress to localStorage
   */
  private saveProgressToLocalStorage(progress: UserProgress): void {
    try {
      localStorage.setItem("church_latin_progress", JSON.stringify(progress));
    } catch (error) {
      console.error("Error saving progress to localStorage:", error);
    }
  }
}

export const pocketbaseService = new PocketBaseService();
