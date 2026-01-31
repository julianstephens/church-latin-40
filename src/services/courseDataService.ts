import PocketBase from 'pocketbase';
import { lessons as fallbackLessons, modules as fallbackModules, Lesson, Module } from '../data/courseData';

const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL;

class CourseDataService {
    private pb: PocketBase;
    private modulesCache: Module[] | null = null;
    private lessonsCache: { [moduleId: number]: Lesson[]; } = {};
    private contentCache: { [lessonId: number]: any; } = {};

    constructor() {
        this.pb = new PocketBase(POCKETBASE_URL);
    }

    /**
     * Fetch all modules from PocketBase or fallback to courseData
     */
    async getModules(): Promise<Module[]> {
        if (this.modulesCache) {
            return this.modulesCache;
        }

        try {
            // Fetch from PocketBase
            const records = await this.pb.collection('church_latin_modules').getFullList({
                sort: '+displayOrder',
            });

            // Calculate days for each module (sequential across all modules)
            let dayCounter = 1;
            this.modulesCache = records.map((record: any) => {
                const startDay = dayCounter;
                const lessonCount = record.lessonCount || 8; // Default to 8 if not specified
                const days = Array.from({ length: lessonCount }, (_, i) => startDay + i);
                dayCounter += lessonCount;

                return {
                    id: record.moduleNumber,
                    title: record.name || record.title,
                    description: record.description,
                    days: days,
                };
            });

            return this.modulesCache;
        } catch (error) {
            console.warn('Failed to fetch modules from PocketBase, using fallback:', error);
            this.modulesCache = fallbackModules;
            return fallbackModules;
        }
    }

    /**
     * Fetch lessons for a specific module
     */
    async getLessonsByModule(moduleId: number): Promise<Lesson[]> {
        if (this.lessonsCache[moduleId]) {
            return this.lessonsCache[moduleId];
        }

        try {
            // First get the module to get its PocketBase ID
            const moduleRecord = await this.pb.collection('church_latin_modules').getFirstListItem(
                `moduleNumber = ${moduleId}`
            );

            // Then fetch lessons for this module
            const records = await this.pb.collection('church_latin_lessons').getFullList({
                filter: `moduleId = "${moduleRecord.id}"`,
                sort: '+displayOrder',
            });

            const lessons = records.map((record: any) => ({
                id: record.lessonNumber,
                title: record.name || record.title,
                module: moduleId,
                materials: [],
                content: [],
                vocabulary: [],
                practice: [],
                quiz: [],
            }));

            this.lessonsCache[moduleId] = lessons;
            return lessons;
        } catch (error) {
            console.warn(`Failed to fetch lessons for module ${moduleId} from PocketBase, using fallback:`, error);
            const fallbackLessonsForModule = fallbackLessons.filter(l => l.module === moduleId);
            this.lessonsCache[moduleId] = fallbackLessonsForModule;
            return fallbackLessonsForModule;
        }
    }

    /**
     * Fetch full lesson content (lazy loading)
     */
    async getLessonContent(lessonId: number): Promise<Lesson> {
        // First check if we have it in cache
        if (this.contentCache[lessonId]) {
            return this.contentCache[lessonId];
        }

        try {
            // Fetch the lesson record
            const lessonRecord = await this.pb.collection('church_latin_lessons').getFirstListItem(
                `lessonNumber = ${lessonId}`
            );

            // Fetch the content record
            const contentRecords = await this.pb.collection('church_latin_lesson_content').getFullList({
                filter: `lessonId = "${lessonRecord.id}"`,
            });

            if (contentRecords.length === 0) {
                // Content doesn't exist, use fallback
                throw new Error('Content not found');
            }

            const contentRecord = contentRecords[0];

            // Fetch quiz if it exists
            let quizQuestions = [];
            try {
                const quizRecords = await this.pb.collection('church_latin_quizzes').getFullList({
                    filter: `lessonId = "${lessonRecord.id}"`,
                });
                if (quizRecords.length > 0) {
                    quizQuestions = quizRecords[0].quizQuestions || [];
                }
            } catch (quizError) {
                console.warn(`No quiz found for lesson ${lessonId}`, quizError);
            }

            // Get the module
            const modules = await this.getModules();
            const lesson = await this.getLessonById(lessonId, modules);

            const fullLesson: Lesson = {
                id: lessonId,
                title: lessonRecord.name || lessonRecord.title,
                module: lesson?.module || 1,
                materials: contentRecord.englishTranslation ? [contentRecord.englishTranslation] : [],
                content: contentRecord.latinContent ? [contentRecord.latinContent] : [],
                vocabulary: contentRecord.vocabularyList || [],
                practice: [],
                quiz: quizQuestions,
            };

            this.contentCache[lessonId] = fullLesson;
            return fullLesson;
        } catch (error) {
            console.warn(`Failed to fetch lesson content for ${lessonId} from PocketBase, using fallback:`, error);
            const fallbackLesson = fallbackLessons.find(l => l.id === lessonId);
            if (fallbackLesson) {
                this.contentCache[lessonId] = fallbackLesson;
                return fallbackLesson;
            }
            throw new Error(`Lesson ${lessonId} not found`);
        }
    }

    /**
     * Get a lesson by ID with full details (used internally)
     */
    private async getLessonById(lessonId: number, modules: Module[]): Promise<Lesson | undefined> {
        // Find from fallback data first
        const fallbackLesson = fallbackLessons.find(l => l.id === lessonId);
        if (fallbackLesson) {
            return fallbackLesson;
        }

        // Try to fetch from PocketBase
        try {
            const lessonRecord = await this.pb.collection('church_latin_lessons').getFirstListItem(
                `lessonNumber = ${lessonId}`
            );

            // Find the module this lesson belongs to
            const moduleRecord = await this.pb.collection('church_latin_modules').getOne(lessonRecord.moduleId);
            const module = modules.find(m => m.id === moduleRecord.moduleNumber);

            return {
                id: lessonId,
                title: lessonRecord.name || lessonRecord.title,
                module: module?.id || 1,
                materials: [],
                content: [],
                vocabulary: [],
                practice: [],
                quiz: [],
            };
        } catch (error) {
            console.warn(`Could not find lesson ${lessonId}`, error);
            return undefined;
        }
    }

    /**
     * Get quiz for a lesson
     */
    async getQuiz(lessonId: number): Promise<any[]> {
        try {
            const lessonRecord = await this.pb.collection('church_latin_lessons').getFirstListItem(
                `lessonNumber = ${lessonId}`
            );

            const quizRecords = await this.pb.collection('church_latin_quizzes').getFullList({
                filter: `lessonId = "${lessonRecord.id}"`,
            });

            if (quizRecords.length === 0) {
                return [];
            }

            return quizRecords[0].quizQuestions || [];
        } catch (error) {
            console.warn(`Failed to fetch quiz for lesson ${lessonId}:`, error);
            // Return fallback quiz from courseData
            const fallbackLesson = fallbackLessons.find(l => l.id === lessonId);
            return fallbackLesson?.quiz || [];
        }
    }

    /**
     * Clear caches (useful when data is updated)
     */
    clearCache() {
        this.modulesCache = null;
        this.lessonsCache = {};
        this.contentCache = {};
    }
}

export const courseDataService = new CourseDataService();
