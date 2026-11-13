/*!
 * Reads a YouTube live chat with the YouTube Data API (API key, public broadcasts).
 * Quota: liveChatMessages.list costs 5 units per call; the default daily quota is 10,000 units,
 * so polling every 5 s allows roughly 2.7 hours of chat per day. Raise CHAT_POLL_MS to stretch it.
 */
'use strict';

const API = 'https://www.googleapis.com/youtube/v3';

function videoIdFrom(input) {
  const s = String(input || '').trim();
  const m = s.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/|\/embed\/)([A-Za-z0-9_-]{11})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  return null;
}

class YouTubeChat {
  constructor(opts) {
    this.apiKey = opts.apiKey; this.minPollMs = Math.max(2000, opts.minPollMs || 5000);
    this.onMessages = opts.onMessages; this.onStatus = opts.onStatus || (() => {});
    this.state = 'off'; this.error = null; this.units = 0; this.timer = null; this.videoId = null; this.count = 0;
  }

  status() {
    return { enabled: !!this.apiKey, state: this.state, error: this.error, unitsToday: this.units, videoId: this.videoId, messages: this.count };
  }

  async get(path) {
    const res = await fetch(API + path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(this.apiKey));
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason;
      const msg = (body.error && body.error.message) || ('HTTP ' + res.status);
      const e = new Error(reason === 'quotaExceeded' ? 'YouTube API quota used up for today' : msg);
      e.reason = reason;
      throw e;
    }
    return body;
  }

  async connect(input) {
    if (!this.apiKey) throw new Error('Chat needs YT_API_KEY set on the server');
    const id = videoIdFrom(input);
    if (!id) throw new Error('Paste your live video link or its 11-character ID');
    this.disconnect();
    this.videoId = id; this.state = 'connecting'; this.error = null; this.onStatus();
    const v = await this.get('/videos?part=liveStreamingDetails&id=' + id);
    this.units += 1;
    const d = v.items && v.items[0] && v.items[0].liveStreamingDetails;
    if (!d || !d.activeLiveChatId) { this.state = 'off'; this.error = 'That video has no active live chat yet (go live first)'; this.onStatus(); throw new Error(this.error); }
    this.chatId = d.activeLiveChatId;
    this.pageToken = null;
    this.first = true;
    this.state = 'connected';
    this.onStatus();
    this.poll();
  }

  async poll() {
    if (this.state !== 'connected') return;
    let wait = this.minPollMs;
    try {
      const q = '/liveChat/messages?part=snippet,authorDetails&maxResults=200&liveChatId=' + encodeURIComponent(this.chatId) + (this.pageToken ? '&pageToken=' + this.pageToken : '');
      const r = await this.get(q);
      this.units += 5;
      this.pageToken = r.nextPageToken;
      wait = Math.max(this.minPollMs, r.pollingIntervalMillis || 0);
      const items = (r.items || []).filter((it) => it.snippet && it.snippet.type === 'textMessageEvent').map((it) => ({
        id: it.id, author: (it.authorDetails && it.authorDetails.displayName) || 'viewer',
        text: (it.snippet.textMessageDetails && it.snippet.textMessageDetails.messageText) || it.snippet.displayMessage || ''
      }));
      // The first page is recent history: skip it so old messages don't count as votes.
      if (!this.first && items.length) { this.count += items.length; this.onMessages(items); }
      this.first = false;
      this.error = null;
      if (r.offlineAt) { this.state = 'off'; this.error = 'The live stream has ended'; this.onStatus(); return; }
    } catch (e) {
      this.error = e.message;
      if (e.reason === 'quotaExceeded' || e.reason === 'liveChatEnded' || e.reason === 'liveChatNotFound') { this.state = 'off'; this.onStatus(); return; }
      wait = 10000;
    }
    this.onStatus();
    this.timer = setTimeout(() => this.poll(), wait);
  }

  disconnect() {
    clearTimeout(this.timer);
    this.state = 'off';
  }
}

YouTubeChat.videoIdFrom = videoIdFrom;
module.exports = YouTubeChat;
