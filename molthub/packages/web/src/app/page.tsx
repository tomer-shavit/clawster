export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to <span className="text-blue-600">Molthub</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            AI Cost Control and Migration Platform
          </p>
          
          <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">
              🚀 Development Server Running
            </h2>
            <p className="text-gray-600 mb-6">
              Your Molthub development environment is successfully set up and running with Docker Compose.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">🤖 Bot Management</h3>
                <p className="text-sm text-blue-700">Create and manage AI bot fleets</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">💰 Cost Control</h3>
                <p className="text-sm text-green-700">Monitor and optimize AI spending</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-900 mb-2">📊 Analytics</h3>
                <p className="text-sm text-purple-700">Track performance metrics</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-center gap-4">
            <a 
              href="http://localhost:3001/health" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Check API Health
            </a>
            <a 
              href="http://localhost:3001/api/fleets" 
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
            >
              View Sample Data
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}
