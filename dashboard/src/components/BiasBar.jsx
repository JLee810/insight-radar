/**
 * BiasBar — visual political lean + factual/tone badges.
 * Used on both ArticleCard and SocialPostCard.
 *
 * @param {{ lean, factual_reporting, emotional_language, framing, confidence }} bias
 */
export default function BiasBar({ bias }) {
  const leanMap = {
    'far-left':     { pos: 0,     label: 'Far Left',     dotColor: 'bg-blue-700' },
    'left':         { pos: 1 / 6, label: 'Left',         dotColor: 'bg-blue-500' },
    'center-left':  { pos: 2 / 6, label: 'Center-Left',  dotColor: 'bg-sky-400'  },
    'center':       { pos: 3 / 6, label: 'Center',       dotColor: 'bg-gray-400' },
    'center-right': { pos: 4 / 6, label: 'Center-Right', dotColor: 'bg-orange-400' },
    'right':        { pos: 5 / 6, label: 'Right',        dotColor: 'bg-red-500'  },
    'far-right':    { pos: 1,     label: 'Far Right',    dotColor: 'bg-red-700'  },
    'unknown':      { pos: null,  label: 'Unknown',      dotColor: 'bg-gray-500' },
  };

  const info = leanMap[bias.lean] || leanMap['unknown'];

  const factualClass =
    bias.factual_reporting === 'high'  ? 'bg-green-900/40 text-green-400' :
    bias.factual_reporting === 'mixed' ? 'bg-yellow-900/40 text-yellow-400' :
                                         'bg-red-900/40 text-red-400';

  const toneClass =
    bias.emotional_language === 'low'    ? 'bg-green-900/40 text-green-400' :
    bias.emotional_language === 'medium' ? 'bg-yellow-900/40 text-yellow-400' :
                                           'bg-red-900/40 text-red-400';

  return (
    <div
      className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5"
      title={bias.framing || ''}
    >
      {/* Spectrum: blue → gray → red */}
      <div
        className="relative h-1.5 rounded-full bg-gradient-to-r from-blue-600 via-gray-500 to-red-600 shrink-0"
        style={{ width: 72 }}
      >
        {info.pos !== null && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-gray-900 shadow ${info.dotColor}`}
            style={{ left: `calc(${info.pos * 100}% - 6px)` }}
          />
        )}
      </div>

      {/* Lean label */}
      <span className="text-[11px] text-gray-300 font-medium shrink-0" style={{ minWidth: 72 }}>
        {info.label}
      </span>

      {/* Badges */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${factualClass}`}>
          Facts: {bias.factual_reporting}
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${toneClass}`}>
          Tone: {bias.emotional_language}
        </span>
      </div>
    </div>
  );
}
