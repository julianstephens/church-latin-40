import { useAuth0 } from '@auth0/auth0-react';
import { Cross } from 'lucide-react';

const LoginPage = () => {
    const { loginWithRedirect, isAuthenticated, isLoading, error } = useAuth0();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-pulse">
                        <Cross className="h-12 w-12 text-red-900 dark:text-red-800 mx-auto mb-4" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full border-t-4 border-red-900">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-red-900 dark:text-red-700 mb-2">
                            Authentication Error
                        </h1>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            {error.message}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Please check your Auth0 configuration and try again.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
            <div className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
                {!isAuthenticated && (
                    // Unauthenticated view
                    <div className="max-w-2xl mx-auto">
                        <div className="text-center mb-12">
                            <div className="flex justify-center mb-6">
                                <div className="bg-red-100 dark:bg-red-900/30 rounded-full p-4">
                                    <Cross className="h-12 w-12 text-red-900 dark:text-red-400" />
                                </div>
                            </div>
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                Church Latin
                            </h1>
                            <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
                                40 Days to Sacred Language
                            </p>
                            <p className="text-gray-500 dark:text-gray-400">
                                Master Ecclesiastical Latin through this comprehensive course
                            </p>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border-t-4 border-red-900">
                            <div className="px-6 sm:px-8 py-12">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                                    Get Started
                                </h2>
                                <p className="text-center text-gray-600 dark:text-gray-300 mb-8">
                                    Sign in with your account to begin your Latin learning journey
                                </p>

                                <button
                                    onClick={() => loginWithRedirect()}
                                    className="block mx-auto mt-4 bg-red-900 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-400 text-white font-semibold py-2 px-4 rounded"
                                >
                                    Log In
                                </button>

                                <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 text-center">
                                        What you'll learn
                                    </h3>
                                    <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                                        <li className="flex items-start">
                                            <span className="text-red-900 dark:text-red-400 mr-3 mt-1">✓</span>
                                            <span>Ecclesiastical Latin pronunciation and grammar</span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-red-900 dark:text-red-400 mr-3 mt-1">✓</span>
                                            <span>Common liturgical prayers and responses</span>
                                        </li>
                                        <li className="flex items-start">
                                            <span className="text-red-900 dark:text-red-400 mr-3 mt-1">✓</span>
                                            <span>Deep understanding of Catholic traditions</span>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-8">
                            Oremus pro invicem — Let us pray for one another
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LoginPage;
