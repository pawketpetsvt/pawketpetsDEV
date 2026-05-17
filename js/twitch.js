// twitch.js — Twitch integration
// Handles OAuth login, follow checking, and PP rewards

// ══════════════════════════════════════════════════
// CONFIGURATION — Fill these in after setup!
// ══════════════════════════════════════════════════
var TWITCH_CLIENT_ID = 'moqd3war5e7fleif8yte1d8n6kl25u';
var TWITCH_REDIRECT_URI = 'https://pawketpetsvt.github.io/twitch.html';

// Twitch user IDs for your streamers (find these at https://www.streamweasels.com/tools/convert-twitch-username-to-user-id/)
var STREAMER_IDS = {
  embertail: '91821604',
  pyxshuul:  '1459912293'
};

// PP reward for following each streamer (one time only)
var FOLLOW_REWARD_PP = 50;

// ══════════════════════════════════════════════════
// OAUTH — Redirect to Twitch login
// ══════════════════════════════════════════════════
function linkTwitch() {
  var scopes = 'user:read:follows';
  var state = Math.random().toString(36).substring(2);
  sessionStorage.setItem('twitch_state', state);

  var url = 'https://id.twitch.tv/oauth2/authorize' +
    '?client_id=' + TWITCH_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(TWITCH_REDIRECT_URI) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(scopes) +
    '&state=' + state;

  window.location.href = url;
}

// ══════════════════════════════════════════════════
// CALLBACK — Handle return from Twitch
// ══════════════════════════════════════════════════
async function handleTwitchCallback(hash) {
  var params = {};
  hash.substring(1).split('&').forEach(function(part) {
    var pair = part.split('=');
    params[pair[0]] = decodeURIComponent(pair[1] || '');
  });

  var token = params['access_token'];
  if (!token) return;

  // Get Twitch user info
  var resp = await fetch('https://api.twitch.tv/helix/users', {
    headers: { 'Client-Id': TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + token }
  });
  var data = await resp.json();
  if (!data.data || !data.data[0]) { showToast('Could not get Twitch user info.'); return; }

  var twitchUser = data.data[0];
  var twitchId = twitchUser.id;
  var twitchName = twitchUser.login;
  var twitchDisplayName = twitchUser.display_name;

  // Save to Supabase players table
  var user = await getCurrentUser();
  if (!user) return;

  var res = await supabaseClient.from('players')
    .update({ twitch_id: twitchId, twitch_username: twitchName, twitch_token: token })
    .eq('id', user.id);

  if (res.error) { showToast('Error saving Twitch link: ' + res.error.message); return; }

  // Clear hash from URL
  window.history.replaceState({}, document.title, window.location.pathname);
  showToast('✅ Twitch account linked as ' + twitchDisplayName + '!');
}

// ══════════════════════════════════════════════════
// CHECK — Is Twitch already linked?
// ══════════════════════════════════════════════════
async function checkTwitchLinked() {
  var user = await getCurrentUser(); if (!user) return;
  var res = await supabaseClient.from('players')
    .select('twitch_username, twitch_id, twitch_token, twitch_follow_rewards')
    .eq('id', user.id).single();

  if (res.data && res.data.twitch_username) {
    document.getElementById('twitch-not-linked').style.display = 'none';
    document.getElementById('twitch-linked').style.display = 'block';
    document.getElementById('twitch-username').textContent = res.data.twitch_username;

    // Show which rewards were already claimed
    var rewards = res.data.twitch_follow_rewards || {};
    if (rewards.embertail) {
      var b = document.getElementById('follow-ember-badge');
      b.textContent = '✅ Claimed'; b.className = 'status-badge status-done'; b.style.display = 'inline-block';
    }
    if (rewards.pyxshuul) {
      var b2 = document.getElementById('follow-pyxs-badge');
      b2.textContent = '✅ Claimed'; b2.className = 'status-badge status-done'; b2.style.display = 'inline-block';
    }
  }
}

// ══════════════════════════════════════════════════
// CHECK FOLLOWS — Award PP for following streamers
// ══════════════════════════════════════════════════
async function checkFollows() {
  var btn = document.getElementById('check-follows-btn');
  btn.disabled = true; btn.textContent = 'Checking...';

  var user = await getCurrentUser(); if (!user) return;
  var playerRes = await supabaseClient.from('players')
    .select('twitch_id, twitch_token, pawketpoints, twitch_follow_rewards')
    .eq('id', user.id).single();

  if (!playerRes.data || !playerRes.data.twitch_token) {
    showToast('Twitch not linked!'); btn.disabled = false; btn.textContent = '🔍 Check Follows & Claim Rewards'; return;
  }

  var twitchId = playerRes.data.twitch_id;
  var token = playerRes.data.twitch_token;
  var currentPoints = playerRes.data.pawketpoints;
  var rewards = playerRes.data.twitch_follow_rewards || {};
  var pointsEarned = 0;

  // Check each streamer
  for (var key in STREAMER_IDS) {
    if (rewards[key]) continue; // already claimed
    var streamerId = STREAMER_IDS[key];
    if (streamerId === 'EMBERTAIL_TWITCH_USER_ID' || streamerId === 'PYXSHUUL_TWITCH_USER_ID') continue; // not configured yet

    try {
      var followRes = await fetch(
        'https://api.twitch.tv/helix/channels/followed?user_id=' + twitchId + '&broadcaster_id=' + streamerId,
        { headers: { 'Client-Id': TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + token } }
      );
      var followData = await followRes.json();
      if (followData.data && followData.data.length > 0) {
        // They follow this streamer — award PP!
        rewards[key] = true;
        pointsEarned += FOLLOW_REWARD_PP;

        var badge = document.getElementById('follow-' + key + '-badge');
        if (badge) { badge.textContent = '✅ Claimed'; badge.className = 'status-badge status-done'; badge.style.display = 'inline-block'; }
      } else {
        var badge2 = document.getElementById('follow-' + key + '-badge');
        if (badge2) { badge2.textContent = 'Not following'; badge2.className = 'status-badge status-pending'; badge2.style.display = 'inline-block'; }
      }
    } catch(e) {
      console.warn('Follow check failed for ' + key, e);
    }
  }

  if (pointsEarned > 0) {
    var newPoints = currentPoints + pointsEarned;
    await supabaseClient.from('players').update({ pawketpoints: newPoints, twitch_follow_rewards: rewards }).eq('id', user.id);
    showToast('🎉 You earned ' + pointsEarned + ' PP for following!');
  } else {
    await supabaseClient.from('players').update({ twitch_follow_rewards: rewards }).eq('id', user.id);
    showToast('No new follow rewards available. Follow our streamers on Twitch!');
  }

  btn.disabled = false; btn.textContent = '🔍 Check Follows & Claim Rewards';
}

// ══════════════════════════════════════════════════
// UNLINK
// ══════════════════════════════════════════════════
async function unlinkTwitch() {
  var user = await getCurrentUser(); if (!user) return;
  await supabaseClient.from('players').update({ twitch_id: null, twitch_username: null, twitch_token: null }).eq('id', user.id);
  document.getElementById('twitch-not-linked').style.display = 'block';
  document.getElementById('twitch-linked').style.display = 'none';
  showToast('Twitch account unlinked.');
}


async function checkLiveStatus(username) {
  try {
    // Get a valid token - try to use the logged-in user's token first
    var user = await getCurrentUser();
    var token = null;
    
    if (user) {
      var playerRes = await supabaseClient
        .from('players')
        .select('twitch_token')
        .eq('id', user.id)
        .single();
      
      if (playerRes.data && playerRes.data.twitch_token) {
        token = playerRes.data.twitch_token;
      }
    }
    
    // If no user token, we can't check (Twitch API requires auth)
    if (!token) {
      console.log('No Twitch token available for live status check');
      return false;
    }
    
    // Call Twitch API to check if user is streaming
    var response = await fetch(
      'https://api.twitch.tv/helix/streams?user_login=' + username,
      {
        headers: {
          'Client-Id': TWITCH_CLIENT_ID,
          'Authorization': 'Bearer ' + token
        }
      }
    );
    
    if (!response.ok) {
      console.warn('Twitch API error for ' + username + ':', response.status);
      return false;
    }
    
    var data = await response.json();
    
    // If data.data array has items, the streamer is live
    return data.data && data.data.length > 0;
    
  } catch (error) {
    console.error('Error checking live status for ' + username + ':', error);
    return false;
  }
}

/**
 * Update the UI to show/hide live status for a streamer
 * @param {string} username - Twitch username ('embertail' or 'pyxshuul')
 * @param {boolean} isLive - Whether the streamer is currently live
 */
function updateStreamerUI(username, isLive) {
  var prefix = username === 'embertail' ? 'ember' : 'pyxs';
  
  var statusEl = document.getElementById(prefix + '-status');
  var liveBadge = document.getElementById(prefix + '-live-badge');
  var watchBtn = document.getElementById(prefix + '-watch-btn');
  
  if (isLive) {
    // Show LIVE indicator
    if (liveBadge) liveBadge.style.display = 'inline-block';
    if (watchBtn) watchBtn.style.display = 'inline-block';
    if (statusEl) {
      statusEl.textContent = 'Streaming now!';
      statusEl.style.color = '#ff0000';
      statusEl.style.fontWeight = '600';
    }
  } else {
    // Show OFFLINE
    if (liveBadge) liveBadge.style.display = 'none';
    if (watchBtn) watchBtn.style.display = 'none';
    if (statusEl) {
      statusEl.textContent = 'OFFLINE';
      statusEl.style.color = '';
      statusEl.style.fontWeight = '';
    }
  }
}

/**
 * Check all streamers' live status and update UI
 */
async function checkAllStreamersLiveStatus() {
  // Check Embertail
  var emberLive = await checkLiveStatus('embertail');
  updateStreamerUI('embertail', emberLive);
  
  // Check Pyxshuul
  var pyxsLive = await checkLiveStatus('pyxshuul');
  updateStreamerUI('pyxshuul', pyxsLive);
}
// Check immediately when page loads (after a small delay to ensure user is loaded)
setTimeout(function() {
  checkAllStreamersLiveStatus();
}, 2000);

// Check every 60 seconds
setInterval(function() {
  checkAllStreamersLiveStatus();
}, 60000);
