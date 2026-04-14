/**
 * Social media scraper.
 * Supported platforms: Reddit (public JSON API), Bluesky (public AT Protocol API)
 */

/**
 * Fetch recent posts from a Reddit subreddit or user.
 * @param {string} handle  'r/worldnews'  or  'u/username'
 * @returns {Promise<Array>}
 */
async function fetchReddit(handle) {
  const isUser = handle.toLowerCase().startsWith('u/');
  const slug   = handle.slice(2); // strip 'r/' or 'u/'
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
    likes:       p.score    || 0,
    shares:      0,
    comments:    p.num_comments || 0,
    media_url:   p.thumbnail?.startsWith('http') ? p.thumbnail : null,
    posted_at:   new Date(p.created_utc * 1000).toISOString(),
  }));
}

/**
 * Fetch recent posts from a Bluesky account.
 * @param {string} handle  'user.bsky.social'  or  '@user.bsky.social'
 * @returns {Promise<Array>}
 */
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
      const record  = post.record  || {};
      const postId  = post.uri?.split('/').pop() || post.cid;
      const profile = post.author  || {};
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

/**
 * Dispatch to the correct platform fetcher.
 * @param {{ platform: string, handle: string }} source
 * @returns {Promise<Array>}
 */
export async function fetchSocialPosts(source) {
  switch (source.platform) {
    case 'reddit':  return fetchReddit(source.handle);
    case 'bluesky': return fetchBluesky(source.handle);
    default: throw new Error(`Unsupported platform: ${source.platform}`);
  }
}
