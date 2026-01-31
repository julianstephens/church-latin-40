import { Home, Map } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors flex items-center justify-center px-4">
            <div className="max-w-2xl w-full">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 border-t-4 border-red-900">
                    <div className="flex items-center justify-center mb-6">
                        <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4">
                            <Map className="h-12 w-12 text-red-900 dark:text-red-400" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-2">
                        404
                    </h1>

                    <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 text-center mb-4">
                        Page Not Found
                    </h2>

                    <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
                        The page you're looking for doesn't exist. Perhaps you took a wrong turn on your Latin learning journey?
                    </p>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full flex items-center justify-center gap-2 bg-red-900 hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                        <Home className="h-5 w-5" />
                        Return to Course Overview
                    </button>

                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-8">
                        In Nomine Patris, et Filii, et Spiritus Sancti
                    </p>
                </div>
            </div>
        </div>
    );
}
