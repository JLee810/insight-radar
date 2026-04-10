/**
 * Send a standardized success response.
 * @param {import('express').Response} res
 * @param {*} data
 * @param {number} [status=200]
 */
export function sendSuccess(res, data, status = 200) {
  res.status(status).json({ success: true, data });
}

/**
 * Send a standardized error response.
 * @param {import('express').Response} res
 * @param {string} message
 * @param {number} [status=500]
 */
export function sendError(res, message, status = 500) {
  res.status(status).json({ success: false, error: message });
}

/**
 * Parse a JSON string safely, returning a fallback on failure.
 * @param {string} str
 * @param {*} fallback
 * @returns {*}
 */
export function safeJsonParse(str, fallback = null) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Convert an article row from the DB into a clean API-friendly object.
 * @param {object} row
 * @returns {object}
 */
export function formatArticle(row) {
  return {
    ...row,
    ai_tags: safeJsonParse(row.ai_tags, []),
    is_read: Boolean(row.is_read),
    is_bookmarked: Boolean(row.is_bookmarked),
  };
}

/**
 * Convert a website row from the DB into a clean API-friendly object.
 * @param {object} row
 * @returns {object}
 */
export function formatWebsite(row) {
  return {
    ...row,
    is_active: Boolean(row.is_active),
  };
}
