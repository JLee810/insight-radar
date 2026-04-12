/**
 * 404 Not Found page.
 */
import { Link } from 'react-router-dom';
import { Radar, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center px-4">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center mx-auto">
          <Radar size={32} className="text-navy-900" />
        </div>
        <div>
          <p className="text-8xl font-black text-white/10 leading-none">404</p>
          <h1 className="text-2xl font-bold text-white -mt-4">Page not found</h1>
          <p className="text-gray-500 mt-2 text-sm">This page doesn't exist or was moved.</p>
        </div>
        <Link to="/" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to feed
        </Link>
      </div>
    </div>
  );
}
