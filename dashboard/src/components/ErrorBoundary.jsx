/**
 * ErrorBoundary — catches runtime errors and shows a fallback UI.
 */
import { Component } from 'react';
import { Radar } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
          <div className="text-center space-y-6 max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-red-400/10 border border-red-400/20 flex items-center justify-center mx-auto">
              <Radar size={24} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Something went wrong</h1>
              <p className="text-gray-500 mt-2 text-sm">An unexpected error occurred. Refreshing the page usually fixes it.</p>
              {this.state.error?.message && (
                <p className="mt-3 text-xs text-red-400 bg-red-400/5 border border-red-400/10 rounded-lg px-3 py-2 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                className="btn-primary"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </button>
              <a href="/" className="btn-ghost">Go home</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
