/**
 * ProfilePage — public user profile showing their opinions and debate activity.
 * Route: /profile/:username
 */
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, PenLine, MessageSquare, Calendar, Award } from 'lucide-react';
import { api } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Header from '../components/Header.jsx';

export default function ProfilePage() {
  const { username } = useParams();
  const { user: currentUser } = useAuth();
  const isOwnProfile = currentUser?.username === username;

  const { data: opinions, isLoading: loadingOpinions } = useQuery({
    queryKey: ['opinions', 'by', username],
    queryFn: async () => {
      const result = await api.opinions.list({ limit: 50 });
      return result.opinions.filter(o => o.author === username);
    },
  });

  return (
    <div className="min-h-screen bg-navy-900">
      <Header />
      <div className="bg-navy-900/60 border-b border-white/5 px-6 py-2">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors w-fit">
            <ArrowLeft size={16} /> Back
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Profile header */}
        <div className="card flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-navy-900">
              {username?.[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-white">{username}</h1>
              {isOwnProfile && (
                <span className="text-xs bg-cyan-400/10 text-cyan-400 px-2 py-0.5 rounded-full">You</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <PenLine size={11} /> {opinions?.length ?? '—'} opinions
              </span>
            </div>
          </div>
          {isOwnProfile && (
            <Link to="/settings" className="btn-ghost text-sm flex items-center gap-1.5">
              Edit Profile
            </Link>
          )}
        </div>

        {/* Opinions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <PenLine size={14} className="text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Published Opinions</h2>
          </div>

          {loadingOpinions && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card h-20 animate-pulse bg-white/5" />
              ))}
            </div>
          )}

          {opinions?.length === 0 && (
            <div className="card text-center py-10 text-gray-500">
              <PenLine size={28} className="mx-auto mb-2 opacity-30" />
              <p>No opinions published yet.</p>
              {isOwnProfile && (
                <Link to="/opinions" className="text-cyan-400 text-sm hover:underline mt-2 inline-block">
                  Write your first opinion →
                </Link>
              )}
            </div>
          )}

          {opinions?.map(opinion => {
            const date = new Date(opinion.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            });
            return (
              <article key={opinion.id} className="card space-y-2 hover:border-white/15 transition-colors">
                <h3 className="font-semibold text-white">{opinion.title}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{opinion.excerpt}</p>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1"><Calendar size={11} /> {date}</span>
                  <div className="flex gap-1 flex-wrap">
                    {opinion.tags.slice(0, 4).map(t => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
