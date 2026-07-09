# BUFFER API INTEGRATION FOR DAILY SHOW DISTRIBUTION

**Owner Decision:** Use Buffer to distribute daily show to YouTube Shorts, TikTok, LinkedIn  
**Updated:** 2026-07-08

---

## OVERVIEW

Buffer will handle cross-platform distribution from a single API call. Episode workflow:
1. Jason produces daily video
2. Upload video to hosting (YouTube, then share to Buffer)
3. Buffer API posts to: YouTube Shorts, TikTok, LinkedIn
4. Store Buffer post IDs in episodes table for tracking

---

## BUFFER API SETUP

### 1. Create Buffer Account & Get API Token
- Sign up at https://buffer.com
- Go to https://buffer.com/developers/apps
- Create app: "Use Case Arms Race Daily Show"
- Get access token (OAuth 2.0)
- Store in Supabase secrets: `BUFFER_ACCESS_TOKEN`

### 2. Connect Social Accounts
Connect in Buffer dashboard:
- YouTube channel (for Shorts)
- TikTok account
- LinkedIn profile/page

---

## SCHEMA UPDATES

### Migration 013_episodes.sql (extend)
```sql
CREATE TABLE episodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INT UNIQUE NOT NULL,
  air_date DATE NOT NULL,
  featured_case_id UUID NOT NULL,
  ticker_case_ids UUID[] NOT NULL DEFAULT '{}',
  battle_replay_id UUID,
  
  -- Video hosting
  video_url TEXT,                          -- Primary video URL (YouTube)
  video_duration_seconds INT,              -- For Buffer API
  thumbnail_url TEXT,                      -- For social preview
  
  -- Buffer integration
  buffer_post_ids JSONB DEFAULT '{}',      -- {"youtube": "id1", "tiktok": "id2", "linkedin": "id3"}
  buffer_scheduled_at TIMESTAMPTZ,         -- When Buffer will post
  buffer_posted_at TIMESTAMPTZ,            -- When Buffer confirmed post
  
  -- Publishing
  published_at TIMESTAMPTZ,                -- Episode goes live on UCAR
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## EDGE FUNCTION: publish-episode

**File:** `supabase/functions/publish-episode/index.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const BUFFER_API = 'https://api.bufferapp.com/1';
const BUFFER_TOKEN = Deno.env.get('BUFFER_ACCESS_TOKEN');

interface BufferProfile {
  id: string;
  service: 'youtube' | 'tiktok' | 'linkedin';
}

async function getBufferProfiles(): Promise<BufferProfile[]> {
  const res = await fetch(`${BUFFER_API}/profiles.json?access_token=${BUFFER_TOKEN}`);
  return res.json();
}

async function createBufferPost(
  profileId: string,
  text: string,
  videoUrl: string,
  thumbnailUrl: string,
  scheduledAt?: Date
): Promise<string> {
  const body = {
    profile_ids: [profileId],
    text,
    media: {
      video: videoUrl,
      thumbnail: thumbnailUrl,
    },
    ...(scheduledAt && { scheduled_at: scheduledAt.toISOString() }),
  };

  const res = await fetch(`${BUFFER_API}/updates/create.json?access_token=${BUFFER_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return data.updates[0].id; // Buffer post ID
}

Deno.serve(async (req) => {
  const { episode_id, schedule_at } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get episode details
  const { data: episode, error: fetchError } = await supabase
    .from('episodes')
    .select('*, featured_case:use_cases(title, summary)')
    .eq('id', episode_id)
    .single();

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 404 });
  }

  // Pre-publish checklist (SHOW_LAUNCH_RUNBOOK section 3)
  const checks = {
    featured_case_verified: episode.featured_case?.status === 'machine_verified',
    source_live: await checkSourceLive(episode.featured_case?.source_url),
    card_art_current: await checkCardArt(episode.featured_case_id),
    no_copy_placeholders: !episode.featured_case?.title?.includes('[COPY'),
    video_url_present: !!episode.video_url,
  };

  if (Object.values(checks).some((check) => !check)) {
    return new Response(JSON.stringify({ error: 'Pre-publish checklist failed', checks }), {
      status: 400,
    });
  }

  // Get Buffer profiles
  const profiles = await getBufferProfiles();
  const youtube = profiles.find((p) => p.service === 'youtube');
  const tiktok = profiles.find((p) => p.service === 'tiktok');
  const linkedin = profiles.find((p) => p.service === 'linkedin');

  // Generate post text
  const postText = `USE CASE ARMS RACE Episode ${episode.number}

${episode.featured_case.title}

${episode.featured_case.summary}

#AI #Ethics #TechComedy #UseCaseArmsRace`;

  // Create Buffer posts for each platform
  const bufferPostIds: Record<string, string> = {};

  if (youtube) {
    bufferPostIds.youtube = await createBufferPost(
      youtube.id,
      postText,
      episode.video_url,
      episode.thumbnail_url,
      schedule_at ? new Date(schedule_at) : undefined
    );
  }

  if (tiktok) {
    bufferPostIds.tiktok = await createBufferPost(
      tiktok.id,
      postText,
      episode.video_url,
      episode.thumbnail_url,
      schedule_at ? new Date(schedule_at) : undefined
    );
  }

  if (linkedin) {
    bufferPostIds.linkedin = await createBufferPost(
      linkedin.id,
      postText,
      episode.video_url,
      episode.thumbnail_url,
      schedule_at ? new Date(schedule_at) : undefined
    );
  }

  // Update episode with Buffer post IDs
  const { error: updateError } = await supabase
    .from('episodes')
    .update({
      buffer_post_ids: bufferPostIds,
      buffer_scheduled_at: schedule_at || new Date().toISOString(),
      published_at: schedule_at ? null : new Date().toISOString(), // Publish now or wait
    })
    .eq('id', episode_id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  // Trigger Card of the Day (if publishing now)
  if (!schedule_at) {
    await triggerCardOfDay(supabase, episode.featured_case_id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      episode_id,
      buffer_post_ids: bufferPostIds,
      scheduled_at: schedule_at || new Date().toISOString(),
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

async function checkSourceLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkCardArt(caseId: string): Promise<boolean> {
  // Check if card exists and has art_url
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data } = await supabase.from('cards').select('art_url').eq('case_id', caseId).single();
  return !!data?.art_url;
}

async function triggerCardOfDay(supabase: any, caseId: string): Promise<void> {
  // Set Card of the Day flag (24h free-to-play)
  const until = new Date();
  until.setHours(until.getHours() + 24);

  await supabase
    .from('use_cases')
    .update({
      is_card_of_day: true,
      card_of_day_until: until.toISOString(),
    })
    .eq('id', caseId);

  // TODO: Notify watchers, pin to feed, set EBL free-to-play flag
}
```

---

## ADMIN UI UPDATES

### admin.html - Episode Editor

Add Buffer scheduling section:
```html
<div class="episode-editor">
  <h2>Episode ${number} - Buffer Distribution</h2>
  
  <!-- Video Upload -->
  <label>Video URL (YouTube):</label>
  <input type="url" id="video_url" placeholder="https://youtube.com/shorts/...">
  
  <label>Thumbnail URL:</label>
  <input type="url" id="thumbnail_url">
  
  <!-- Buffer Scheduling -->
  <label>
    <input type="radio" name="publish_timing" value="now" checked> Publish Now
  </label>
  <label>
    <input type="radio" name="publish_timing" value="schedule"> Schedule for:
    <input type="datetime-local" id="schedule_at">
  </label>
  
  <!-- Pre-publish Checklist -->
  <h3>Pre-Publish Checklist</h3>
  <ul>
    <li id="check_verified">✓ Featured case is machine_verified</li>
    <li id="check_source">✓ Source URL live</li>
    <li id="check_art">✓ Card art current</li>
    <li id="check_copy">✓ No [COPY] placeholders</li>
    <li id="check_video">✓ Video URL present</li>
  </ul>
  
  <button onclick="publishToBuffer()">Publish & Distribute via Buffer</button>
  
  <!-- Status Display -->
  <div id="buffer_status" style="display:none">
    <h3>Buffer Distribution Status</h3>
    <ul>
      <li>YouTube Shorts: <span id="yt_status">⏳ Pending</span></li>
      <li>TikTok: <span id="tt_status">⏳ Pending</span></li>
      <li>LinkedIn: <span id="li_status">⏳ Pending</span></li>
    </ul>
  </div>
</div>

<script>
async function publishToBuffer() {
  const episodeId = /* current episode ID */;
  const scheduleAt = document.querySelector('[name="publish_timing"]:checked').value === 'schedule'
    ? document.getElementById('schedule_at').value
    : null;
  
  const res = await fetch('/functions/v1/publish-episode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episode_id: episodeId, schedule_at: scheduleAt })
  });
  
  const data = await res.json();
  
  if (data.success) {
    document.getElementById('buffer_status').style.display = 'block';
    // Poll Buffer API for post status
    pollBufferStatus(data.buffer_post_ids);
  } else {
    alert('Error: ' + data.error);
  }
}
</script>
```

---

## BUFFER WEBHOOK (Optional - for real-time status)

Buffer can send webhooks when posts are published. Configure in Buffer dashboard:
- Webhook URL: `https://your-project.supabase.co/functions/v1/buffer-webhook`
- Events: `update.sent`, `update.failed`

**File:** `supabase/functions/buffer-webhook/index.ts`
```typescript
Deno.serve(async (req) => {
  const { update_id, status, profile } = await req.json();
  
  // Find episode with this Buffer post ID
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  const { data: episodes } = await supabase
    .from('episodes')
    .select('*')
    .contains('buffer_post_ids', { [profile.service]: update_id });
  
  if (episodes?.length) {
    // Update status
    await supabase
      .from('episodes')
      .update({ buffer_posted_at: new Date().toISOString() })
      .eq('id', episodes[0].id);
  }
  
  return new Response('OK', { status: 200 });
});
```

---

## BUFFER API RATE LIMITS

- **Free tier:** 10 scheduled posts per profile
- **Pro tier:** 100 scheduled posts per profile
- **Recommendation:** Start with free tier, upgrade if scheduling > 10 episodes in advance

---

## TESTING WORKFLOW

1. **Staging:** Use Buffer test account with private profiles
2. **Test post:** Schedule 1 minute in future, verify all 3 platforms receive
3. **Verify episode record:** Check `buffer_post_ids` populated
4. **Check Card of the Day:** Verify featured case gets flag
5. **Webhook test:** Trigger webhook manually, verify status update

---

## ALTERNATIVE: DIRECT API POSTING (No Buffer)

If Buffer doesn't fit workflow, post directly to each platform:
- **YouTube Shorts:** YouTube Data API v3 (`videos.insert`)
- **TikTok:** TikTok API for Developers (requires app approval)
- **LinkedIn:** LinkedIn Marketing API (`ugcPosts`)

**Trade-off:** More complexity, 3 separate API integrations, no unified scheduling

**Recommendation:** Start with Buffer (simpler), migrate to direct APIs if needed

---

## TASKS.md UPDATE

Add to Phase SHOW:
- **Task SHOW.10: Buffer API Integration**
  - Set up Buffer account & API token
  - Create publish-episode function
  - Update episodes schema with Buffer fields
  - Build Buffer section in admin UI
  - Test distribution to all 3 platforms

---

## NEXT STEPS

1. ✅ Documentation updated (this file)
2. ⬜ Sign up for Buffer account
3. ⬜ Connect YouTube, TikTok, LinkedIn profiles
4. ⬜ Get Buffer API access token
5. ⬜ Add BUFFER_ACCESS_TOKEN to Supabase secrets
6. ⬜ Implement publish-episode function
7. ⬜ Update admin.html with Buffer UI
8. ⬜ Test end-to-end with sample episode

**Timeline:** 1-2 days to implement and test (after Phase SHOW dependencies complete)
