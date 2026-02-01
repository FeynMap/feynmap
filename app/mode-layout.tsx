import { Outlet, useLocation, useNavigate } from "react-router";

export default function ModeLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isGameMode = location.pathname.includes("/game");
  const isExpertMode = location.pathname.includes("/expert");

  const handleToggle = () => {
    if (isGameMode) {
      navigate("/expert");
    } else {
      navigate("/game");
    }
  };

  return (
    <div className="relative w-full h-screen">
      {/* Mode Toggle - positioned at top-right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={handleToggle}
          className="px-6 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-3 border border-gray-200 dark:border-gray-700"
        >
          <span className={`font-semibold ${isGameMode ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            Game Mode
          </span>
          <div className="relative w-10 h-5 bg-gray-200 dark:bg-gray-700 rounded-full transition-colors">
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-blue-600 rounded-full transition-transform duration-200 ${
                isExpertMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
          <span className={`font-semibold ${isExpertMode ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
            Expert Mode
          </span>
        </button>
      </div>
      
      {/* Child route content */}
      <Outlet />
    </div>
  );
}
