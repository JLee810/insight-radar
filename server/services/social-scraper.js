/**
 * Social media scraper.
 *
 * Platform support:
 *  reddit  — public JSON API, no key needed
 *  bluesky — public AT Protocol API, no key needed
 *  x       — Twitter API v2, requires TWITTER_BEARER_TOKEN env var
 *  instagram — requires INSTAGRAM_ACCESS_TOKEN (Meta Basic Display API)
 *  facebook  — requires FACEBOOK_ACCESS_TOKEN (Meta Graph API)
 */

/* ── Reddit ──────────────────────────────────────────────────────────── */

async function fetchReddit(handle) {
  const isUser = handle.toLowerCase().startsWith('u/');
  const slug   = handle.slice(2);
  const path   = isUser ? `user/${slug}/submitted` : `r/${slug}`;
  const url    = `https://www.reddit.com/${path}/new.json?limit=25`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'InsightRadar/1.0 (news aggregator)' },
  });
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`);

  const data  = await res.json();
  const items = data?.data?.children || [];

  return items.map(({ data: p }) => ({
    platform:    'reddit',
    external_id: `reddit_${p.id}`,
    author:      p.author,
    handle:      isUser ? `u/${slug}` : `r/${p.subreddit}`,
    content:     p.selftext ? `${p.title}\n\n${p.selftext}` : p.title,
    title:       p.title,
    url:         `https://reddit.com${p.permalink}`,
    likes:       p.score        || 0,
    shares:      0,
    comments:    p.num_comments || 0,
    media_url:   p.thumbnail?.startsWith('http') ? p.thumbnail : null,
    posted_at:   new Date(p.created_utc * 1000).toISOString(),
  }));
}

/* ── Bluesky ─────────────────────────────────────────────────────────── */

async function fetchBluesky(handle) {
  const actor = handle.replace(/^@/, '');
  const url   = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=25`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bluesky fetch failed: ${res.status}`);

  const data  = await res.json();
  const items = data?.feed || [];

  return items
    .filter(item => item.post)
    .map(({ post }) => {
      const record  = post.record || {};
      const postId  = post.uri?.split('/').pop() || post.cid;
      const profile = post.author || {};
      return {
        platform:    'bluesky',
        external_id: `bsky_${post.uri || post.cid}`,
        author:      profile.displayName || profile.handle,
        handle:      profile.handle,
        content:     record.text || '',
        title:       (record.text || '').slice(0, 120),
        url:         `https://bsky.app/profile/${profile.handle}/post/${postId}`,
        likes:       post.likeCount   || 0,
        shares:      post.repostCount || 0,
        comments:    post.replyCount  || 0,
        media_url:   null,
        posted_at:   record.createdAt || new Date().toISOString(),
      };
    });
}

/* ── X / Twitter (API v2) ────────────────────────────────────────────── */

async function fetchX(handle) {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error(
      'TWITTER_BEARER_TOKEN is not set. Get a free Bearer Token at developer.twitter.com, ' +
      'then add it to your Railway environment variables.'
    );
  }

  const username = handle.replace(/^@/, '');

  // Step 1: resolve username → user ID
  const userRes = await fetch(
    `https://api.twitter.com/2/users/by/username/${username}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!userRes.ok) {
    const err = await userRes.json().catch(() => ({}));
    throw new Error(`X user lookup failed: ${err.detail || userRes.status}`);
  }
  const userId = (await userRes.json()).data?.id;
  if (!userId) throw new Error(`X user "${username}" not found`);

  // Step 2: fetch recent tweets
  const tweetsRes = await fetch(
    `https://api.twitter.com/2/users/${userId}/tweets` +
    `?max_results=25&tweet.fields=created_at,public_metrics&expansions=author_id&user.fields=name,username`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!tweetsRes.ok) {
    const err = await tweetsRes.json().catch(() => ({}));
    throw new Error(`X tweets fetch failed: ${err.detail || tweetsRes.status}`);
  }

  const { data: tweets = [], includes } = await tweetsRes.json();
  const authorMap = {};
  (includes?.users || []).forEach(u => { authorMap[u.id] = u; });

  return tweets.map(t => {
    const author = authorMap[t.author_id] || {};
    const metrics = t.public_metrics || {};
    return {
      platform:    'x',
      external_id: `x_${t.id}`,
      author:      author.name || username,
      handle:      author.username || username,
      content:     t.text || '',
      title:       (t.text || '').slice(0, 120),
      url:         `https://x.com/${author.username || username}/status/${t.id}`,
      likes:       metrics.like_count    || 0,
      shares:      metrics.retweet_count || 0,
      comments:    metrics.reply_count   || 0,
      media_url:   null,
      posted_at:   t.created_at || new Date().toISOString(),
    };
  });
}

/* ── Instagram (Meta Basic Display API) ─────────────────────────────── */

async function fetchInstagram(handle) {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'INSTAGRAM_ACCESS_TOKEN is not set. ' +
      'Create a Meta Developer app at developers.facebook.com, enable Instagram Basic Display API, ' +
      'generate a long-lived access token, then add INSTAGRAM_ACCESS_TOKEN to your Railway env vars.'
    );
  }

  // Instagram Basic Display API — fetches the authenticated user's media
  const res = await fetch(
    `https://graph.instagram.com/me/media` +
    `?fields=id,caption,media_type,timestamp,permalink,like_count,comments_count` +
    `&access_token=${token}&limit=25`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Instagram fetch failed: ${err.error?.message || res.status}`);
  }

  const { data: posts = [] } = await res.json();

  return posts
    .filter(p => p.media_type !== 'VIDEO') // skip reels
    .map(p => ({
      platform:    'instagram',
      external_id: `ig_${p.id}`,
      author:      handle,
      handle:      handle,
      content:     p.caption || '(image post)',
      title:       (p.caption || '').slice(0, 120),
      url:         p.permalink || `https://instagram.com/${handle}`,
      likes:       p.like_count     || 0,
      shares:      0,
      comments:    p.comments_count || 0,
      media_url:   null,
      posted_at:   p.timestamp || new Date().toISOString(),
    }));
}

/* ── Facebook (Meta Graph API) ───────────────────────────────────────── */

async function fetchFacebook(handle) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'FACEBOOK_ACCESS_TOKEN is not set. ' +
      'Create a Meta Developer app at developers.facebook.com, add the Pages API product, ' +
      'generate a Page Access Token for your Facebook Page, ' +
      'then add FACEBOOK_ACCESS_TOKEN to your Railway env vars.'
    );
  }

  // Requires the page to have a Page Access Token
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${handle}/posts` +
    `?fields=id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true)` +
    `&access_token=${token}&limit=25`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Facebook fetch failed: ${err.error?.message || res.status}`);
  }

  const { data: posts = [] } = await res.json();

  return posts.map(p => ({
    platform:    'facebook',
    external_id: `fb_${p.id}`,
    author:      handle,
    handle:      handle,
    content:     p.message || '(shared post)',
    title:       (p.message || '').slice(0, 120),
    url:         p.permalink_url || `https://facebook.com/${handle}`,
    likes:       p.reactions?.summary?.total_count || 0,
    shares:      0,
    comments:    p.comments?.summary?.total_count  || 0,
    media_url:   null,
    posted_at:   p.created_time || new Date().toISOString(),
  }));
}

/* ── Dispatcher ──────────────────────────────────────────────────────── */

/**
 * Fetch posts for a tracked social source.
 * @param {{ platform: string, handle: string }} source
 * @returns {Promise<Array>}
 */
export async function fetchSocialPosts(source) {
  switch (source.platform) {
    case 'reddit':    return fetchReddit(source.handle);
    case 'bluesky':   return fetchBluesky(source.handle);
    case 'x':         return fetchX(source.handle);
    case 'instagram': return fetchInstagram(source.handle);
    case 'facebook':  return fetchFacebook(source.handle);
    default: throw new Error(`Unsupported platform: ${source.platform}`);
  }
}

/**
 * Returns which platforms are currently configured (have API keys set).
 */
export function getPlatformStatus() {
  return {
    reddit:    { available: true,  note: 'Public API — no key needed' },
    bluesky:   { available: true,  note: 'Public API — no key needed' },
    x:         { available: !!process.env.TWITTER_BEARER_TOKEN,  note: 'Requires TWITTER_BEARER_TOKEN env var (free at developer.twitter.com)' },
    instagram: { available: !!process.env.INSTAGRAM_ACCESS_TOKEN, note: 'Requires INSTAGRAM_ACCESS_TOKEN env var (Meta Developer app)' },
    facebook:  { available: !!process.env.FACEBOOK_ACCESS_TOKEN,  note: 'Requires FACEBOOK_ACCESS_TOKEN env var (Meta Developer app)' },
  };
}
