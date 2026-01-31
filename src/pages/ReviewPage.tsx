import { useNavigate } from "react-router-dom";
import { ReviewSession } from "../components/ReviewSession";

export function ReviewPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <ReviewSession
        sessionSize={10}
        onBack={() => navigate("/")}
        onComplete={(stats) => {
          console.log("[ReviewPage] Session completed with stats:", stats);
        }}
      />
    </div>
  );
}
