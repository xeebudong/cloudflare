/**
 * BT Downloader - Cloudflare Worker
 *
 * Serves the static BT downloader page. All P2P happens client-side via WebTorrent.
 *
 * Deploy: npx wrangler deploy
 * Dev:    npx wrangler dev
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve static assets (handled by CF Workers assets binding)
    // The index.html and any other files in /public are auto-served.
    // This fetch handler runs for any request NOT matching a static asset.
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      // Fallback if assets binding isn't available
    }

    // Fallback response
    return new Response('BT Downloader - deploy with: npx wrangler deploy', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  },
};
