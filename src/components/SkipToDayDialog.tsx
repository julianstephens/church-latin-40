import { X } from "lucide-react";

interface SkipToDayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (day: number) => void;
  day: number;
}

export function SkipToDayDialog({
  isOpen,
  onClose,
  onConfirm,
  day,
}: SkipToDayDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Skip to Day {day}?
        </h3>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          This course is designed to be taken in order to build your Latin
          knowledge progressively. Are you sure you want to skip ahead to Day{" "}
          {day}?
        </p>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(day)}
            className="px-4 py-2 bg-red-900 hover:bg-red-800 text-white rounded-lg transition-colors"
          >
            Skip to Day {day}
          </button>
        </div>
      </div>
    </div>
  );
}
