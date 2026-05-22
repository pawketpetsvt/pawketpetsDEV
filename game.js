'use strict';

// ══════════════════════════════════════════════════════════════════════════
// SUPABASE INITIALIZATION
// ══════════════════════════════════════════════════════════════════════════
var SUPABASE_URL = 'https://hqzugbxutgefjilgmxqu.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxenVnYnh1dGdlZmppbGdteHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MTE5NjEsImV4cCI6MjA5MDQ4Nzk2MX0.A3bQMriwY8j9GasUywq_8hKlnkEQQNMyB2ykSaQR68c';

// Initialize supabaseClient - wait for library to load
/* ═══════════════════════════════════════════════════════════════════════
   BATTLE SOUND EFFECTS SYSTEM
   ═══════════════════════════════════════════════════════════════════════ */

var battleSounds = {
  playerLight: '/sounds/hit-light.mp3',
  playerNormal: '/sounds/hit-normal.mp3',
  playerCrit: '/sounds/hit-crit.mp3',
  enemyLight: '/sounds/enemy-hit-light.mp3',
  enemyNormal: '/sounds/enemy-hit-normal.mp3',
  enemyCrit: '/sounds/enemy-hit-crit.mp3',
  
  // Boss attack sounds with variance (creepy flute variants)
  bossLight: '/sounds/piper-flute-light.mp3',    // Soft, eerie flute
  bossNormal: '/sounds/piper-flute-normal.mp3',  // Main creepy flute
  bossCrit: '/sounds/piper-flute-crit.mp3',      // Intense/distorted flute
  
  victory: '/sounds/victory.mp3',
  defeat: '/sounds/defeat.mp3'
};

var audioCache = {};
var lastSoundTime = 0;
var soundCooldown = 300; // Minimum 300ms between sounds to avoid spam

// ═══════════════════════════════════════════════════════════════════════
// AUDIO PRELOADING - Lazy load strategy for better performance
// ═══════════════════════════════════════════════════════════════════════

// FIX 3: Priority sounds preloaded immediately, others loaded on-demand
var prioritySounds = ['playerNormal', 'enemyNormal', 'playerCrit'];

function preloadPrioritySounds() {
  prioritySounds.forEach(function(key) {
    if (battleSounds[key] && !audioCache[key]) {
      var audio = new Audio(battleSounds[key]);
      audio.volume = 0.35;
      audio.preload = 'auto';
      audio.onerror = function() {
        console.log('Sound file not available:', battleSounds[key]);
        audioCache[key] = null;
      };
      audioCache[key] = audio;
    }
  });
  console.log('✅ Priority audio preloaded:', prioritySounds.join(', '));
}

function loadSoundOnDemand(soundKey) {
  if (!battleSounds[soundKey]) return null;
  if (audioCache[soundKey]) return audioCache[soundKey];
  
  // Load on demand and cache
  var audio = new Audio(battleSounds[soundKey]);
  audio.volume = 0.35;
  audio.preload = 'auto';
  audio.onerror = function() {
    console.log('Sound file not available:', battleSounds[soundKey]);
    audioCache[soundKey] = null;
  };
  audioCache[soundKey] = audio;
  console.log('🔊 Loaded sound on demand:', soundKey);
  return audio;
}

// Preload priority sounds on first user interaction
var audioPreloaded = false;
document.addEventListener('click', function preloadOnClick() {
  if (!audioPreloaded) {
    preloadPrioritySounds();
    audioPreloaded = true;
  }
}, { once: true });

// ═══════════════════════════════════════════════════════════════════════
// TIMER CLEANUP SYSTEM - Prevents memory leaks
// ═══════════════════════════════════════════════════════════════════════
var activeTimers = {
  intervals: [],
  timeouts: []
};

function safeSetInterval(fn, delay) {
  var id = setInterval(fn, delay);
  activeTimers.intervals.push(id);
  return id;
}

function safeSetTimeout(fn, delay) {
  var id = setTimeout(fn, delay);
  activeTimers.timeouts.push(id);
  return id;
}

function safeClearInterval(id) {
  clearInterval(id);
  var index = activeTimers.intervals.indexOf(id);
  if (index > -1) {
    activeTimers.intervals.splice(index, 1);
  }
}

function safeClearTimeout(id) {
  clearTimeout(id);
  var index = activeTimers.timeouts.indexOf(id);
  if (index > -1) {
    activeTimers.timeouts.splice(index, 1);
  }
}

function cleanupAllTimers() {
  // Clear all tracked intervals
  activeTimers.intervals.forEach(function(id) {
    clearInterval(id);
  });
  
  // Clear all tracked timeouts
  activeTimers.timeouts.forEach(function(id) {
    clearTimeout(id);
  });
  
  // Reset arrays
  activeTimers.intervals = [];
  activeTimers.timeouts = [];
  
  console.log('✅ All timers cleaned up');
}

function playBattleSound(soundKey, volume, forceBoss) {
  // Rate limiting - prevent sound spam
  var now = Date.now();
  if (!forceBoss && now - lastSoundTime < soundCooldown) {
    return; // Skip this sound
  }
  lastSoundTime = now;
  
  // FIX 3: Get audio from cache or load on-demand
  var audio = audioCache[soundKey];
  
  // If not cached, try to load on-demand
  if (!audio) {
    audio = loadSoundOnDemand(soundKey);
  }
  
  // If still null (missing file), skip
  if (!audio) {
    return;
  }
  
  // Clone audio node to allow overlapping sounds
  var sound = audio.cloneNode();
  sound.volume = volume || 0.35;
  
  sound.play().catch(function(err) {
    // Silently fail if sound can't play
  });
}

function getBattleSoundKey(attacker, variance) {
  var prefix = attacker === 'player' ? 'player' : 'enemy';
  
  if (variance === -1) {
    return prefix + 'Light';
  } else if (variance === 0) {
    return prefix + 'Normal';
  } else {
    return prefix + 'Crit';
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN GAME CODE
   ═══════════════════════════════════════════════════════════════════════ */

var supabaseClient;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce'
    }
  });
} else {
  // Wait for Supabase library to load
  console.log('Waiting for Supabase library...');
  var checkSupabase = setInterval(function() {
    if (typeof supabase !== 'undefined') {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce'
        }
      });
      console.log('Supabase initialized!');
      clearInterval(checkSupabase);
    }
  }, 50);
}

// ── CONFIG ──────────────────────────────
var TWITCH_CLIENT_ID = 'moqd3war5e7fleif8yte1d8n6kl25u';
var TWITCH_REDIRECT_URI = 'https://pawketpetsvt.github.io/';
var STREAMER_IDS = {
  embertail: '91821604',
  pyxshuul:  '1459912293'
};

// ── GLOBALS ──────────────────────────────
var currentUser = null;
var currentPoints = 0;
var tabsLoaded = {};

// ── TUTORIAL & SETTINGS ──────────────────
var playerSettings = {
  spooky_enabled: false,
  music_enabled: true,
  music_volume: 70,
  sfx_volume: 80,
  daynight_enabled: true,
  weather_enabled: true,
  tutorial_completed: false
};

// Daily tips array for home page
var dailyTips = [
  "Pets with higher happiness perform better in battles!",
  "Play minigames daily to earn PawketPoints!",
  "Your pet's level increases their battle stats!",
  "Boss battles drop exclusive items!",
  "Equipment boosts your pet's combat stats!",
  "Ember's Flametail Strike deals 1.5x damage!",
  "Pyxie's Raspberry Soda Stream heals while attacking!",
  "Login daily to build your streak for bonus rewards!",
  "Feed your pets to keep them happy and healthy!",
  "Check the leaderboard to see top players!",
  "Friend other players to see their activity!",
  "Leave guestbook messages on profiles!",
  "Evolving your pet changes their appearance!",
  "Pets have 3 evolution stages: Baby, Teen, and Adult!",
  "Win battles to earn XP and level up your pet!",
  "The shop has items in different tiers - higher tiers cost more!",
  "Boss battles are the ultimate challenge!",
  "Skills have a 30% chance to activate each turn!",
  "You can earn badges by completing achievements!",
  "Visit Melon's shop to buy treats and equipment!",
  "Battle in different forest zones for varying rewards!",
  "Your day streak is displayed in the sidebar!",
  "Blocked users cannot view your profile!",
  "Notifications appear when friends interact with you!",
  "Check your activity feed to see what friends are up to!"
];

// ══════════════════════════════════════════════════════════════════════════
// PET BACKSTORIES / BIOS
// ══════════════════════════════════════════════════════════════════════════

/**
 * Pet backstories - easily editable!
 * Format: petName: "Bio text here"
 */
var petBackstories = {
  'Ember': 'Co-founder of PawketPets! 🦊',
  'Pyxie': 'Co-founder of PawketPets! 🐰',
  // Add more as team members join!
  // 'NewPet': 'Their backstory here...',
};

/**
 * Get pet backstory
 */
function getPetBackstory(petName) {
  return petBackstories[petName] || 'Coming soon... 🌟';
}

// ══════════════════════════════════════════════════════════════════════════
// EVOLUTION SYSTEM
// ══════════════════════════════════════════════════════════════════════════

function getEvolutionStage(level) {
  if (level >= 10) return 'adult';
  if (level >= 5) return 'teen';
  return 'baby';
}

function getEvolutionEmoji(stage) {
  if (stage === 'adult') return '🐺';
  if (stage === 'teen') return '🦊';
  return '🐣';
}

function getEvolutionBonuses(stage) {
  // Cumulative bonuses based on stage
  if (stage === 'adult') {
    return { hp: 5, attack: 3, defense: 2, speed: 1 }; // Total bonuses at adult
  }
  if (stage === 'teen') {
    return { hp: 2, attack: 1, defense: 1, speed: 0 }; // Bonuses at teen
  }
  return { hp: 0, attack: 0, defense: 0, speed: 0 }; // No bonuses as baby
}
var selectedPet = null;
var ownedPetIds = [];
var totalOwnedCount = 0;
var petState = {};
var inventoryItems = [];
var selectedInvItem = null;
var secretNumber = 0;
var guessesLeft = 3;
var memoryCards = [];
var flippedCards = [];
var matchedPairs = 0;
var triesLeft = 15;
var memoryEarned = 0;
var memoryLocked = false;
var memoryEmojis = ['&#128062;','&#127775;','&#128150;','&#9889;','&#127830;','&#127934;'];
var today = new Date().toISOString().split('T')[0];

// ── MUSIC ────────────────────────────────
var bgMusic = document.getElementById('bg-music');
bgMusic.volume = 0.4;

document.addEventListener('click', function startM() {
  bgMusic.play().catch(function(){});
  document.getElementById('music-play-btn').textContent = '\u23F8';
  document.removeEventListener('click', startM);
}, { once: true });

function toggleMusic() {
  if (bgMusic.paused) { bgMusic.play().catch(function(){}); document.getElementById('music-play-btn').textContent = '\u23F8'; }
  else { bgMusic.pause(); document.getElementById('music-play-btn').textContent = '\u25B6'; }
}
function stopMusic() { bgMusic.pause(); bgMusic.currentTime = 0; document.getElementById('music-play-btn').textContent = '\u25B6'; }
function setVolume(v) { bgMusic.volume = parseFloat(v); }

// ── TOAST ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
// PIXEL-ART TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var toastQueue = [];
var isShowingToast = false;

function showToast(msg, type) {
  showPixelToast(msg, type || 'info');
}

function showPixelToast(message, type) {
  // Add to queue
  toastQueue.push({ message: message, type: type || 'info' });
  
  // If not already showing, start queue
  if (!isShowingToast) {
    showNextToast();
  }
}

function showNextToast() {
  if (toastQueue.length === 0) {
    isShowingToast = false;
    return;
  }
  
  isShowingToast = true;
  var toast = toastQueue.shift();
  
  // Create toast element
  var toastEl = makeEl('div', { class: 'pixel-toast pixel-toast-' + toast.type });
  
  // Add icon based on type
  var icon = '';
  switch(toast.type) {
    case 'success': icon = '✓'; break;
    case 'error': icon = '✗'; break;
    case 'warning': icon = '⚠'; break;
    case 'info': 
    default: icon = 'ⓘ'; break;
  }
  
  toastEl.innerHTML = '<span class="pixel-toast-icon">' + icon + '</span><span class="pixel-toast-message">' + escapeHtml(toast.message) + '</span>';
  
  document.body.appendChild(toastEl);
  
  // Animate in
  setTimeout(function() {
    toastEl.classList.add('show');
  }, 10);
  
  // Remove after 3 seconds
  setTimeout(function() {
    toastEl.classList.remove('show');
    setTimeout(function() {
      toastEl.remove();
      showNextToast(); // Show next in queue
    }, 300);
  }, 3000);
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ── UTILS ────────────────────────────────
function el(id) { return document.getElementById(id); }

// ══════════════════════════════════════════════════════════════════════════
// RATE LIMITING - Client-side cooldowns to prevent spam
// ══════════════════════════════════════════════════════════════════════════

var actionCooldowns = {};

function canPerformAction(actionKey, cooldownMs) {
  var now = Date.now();
  if (actionCooldowns[actionKey] && now - actionCooldowns[actionKey] < cooldownMs) {
    return false;
  }
  actionCooldowns[actionKey] = now;
  return true;
}

function makeEl(tag, attrs, text) {
  var e = document.createElement(tag);
  if (attrs) Object.keys(attrs).forEach(function(k){ e.setAttribute(k, attrs[k]); });
  if (text !== undefined) e.textContent = text;
  return e;
}

// ══════════════════════════════════════════════════════════════════════════
// MODAL HELPER FUNCTIONS - Required for variant gallery & nickname editing
// ══════════════════════════════════════════════════════════════════════════

function makeModal() {
  var overlay = makeEl('div');
  overlay.className = 'modal-overlay-custom';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;';
  
  var modal = makeEl('div');
  modal.className = 'modal-content-custom';
  modal.style.cssText = 'background:white;border-radius:20px;padding:30px;max-width:90%;max-height:90vh;overflow-y:auto;position:relative;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
  
  overlay.appendChild(modal);
  
  // Click overlay to close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeModal();
    }
  });
  
  return modal;
}

function openModal(modalElement) {
  var overlay = modalElement.parentElement;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden'; // Prevent background scroll
}

function closeModal() {
  var overlays = document.querySelectorAll('.modal-overlay-custom');
  overlays.forEach(function(overlay) {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  });
  document.body.style.overflow = ''; // Restore scroll
}

function updateAllPoints(pts) {
  // Handle null/undefined/non-number points
  if (pts === null || pts === undefined || typeof pts !== 'number') {
    console.warn('updateAllPoints received invalid value:', pts);
    pts = 0;
  }
  
  currentPoints = pts;
  var str = pts + ' PP';
  ['adopt-points','mypets-points','shop-points','games-points','redeem-points'].forEach(function(id){
    var e = el(id); if (e) e.textContent = str;
  });
  
  var navPoints = el('nav-points');
  if (navPoints) navPoints.innerHTML = '&#129689; ' + pts + ' PP';
  
  // Update sidebar points
  var sidebarPoints = document.getElementById('sidebar-points');
  if (sidebarPoints) sidebarPoints.textContent = pts.toLocaleString() + ' PP';
}

// ── LEADERBOARD INITIALIZATION ────────────────────────────
function initLeaderboardTab() {
  // Set initial state
  currentLeaderboard = 'points';
  // Activate the Most Points button
  document.querySelectorAll('.leaderboard-tab').forEach(function(t) {
    t.classList.remove('active');
  });
  var firstTab = document.querySelectorAll('.leaderboard-tab')[0];
  if (firstTab) firstTab.classList.add('active');
  // Show points list, hide others
  document.querySelectorAll('.leaderboard-list').forEach(function(list) {
    list.classList.remove('active');
  });
  el('leaderboard-points').classList.add('active');
  // Load data if not cached
  if (!leaderboardCache.points) {
    loadLeaderboard('points');
  }
}

// ── TAB NAVIGATION ───────────────────────
function showTab(tab) {
  // CRITICAL: Clean up all timers when switching tabs to prevent memory leaks
  cleanupAllTimers();
  
  document.querySelectorAll('#app-content .page-section').forEach(function(s){ s.classList.remove('active'); });
  var sec = el('section-' + tab); if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(function(b){ b.classList.remove('active'); });
  var btn = el('tab-btn-' + tab); if (btn) btn.classList.add('active');
  
  // Update sidebar buttons
  document.querySelectorAll('.sidebar-nav-btn').forEach(function(b){ b.classList.remove('active'); });
  var sidebarBtn = el('sidebar-btn-' + tab); 
  if (sidebarBtn) sidebarBtn.classList.add('active');
  
  // FIX 4: Particle system cleanup - stop when leaving home, start when entering
  if (tab !== 'home' && window.particleInterval) {
    // Leaving home tab - clean up particles
    safeClearInterval(window.particleInterval);
    window.particleInterval = null;
    // Remove all existing sparkle particles
    document.querySelectorAll('.sparkle-particle').forEach(function(el) {
      el.remove();
    });
  } else if (tab === 'home' && !window.particleInterval) {
    // Entering home tab - start particles if not already running
    createFloatingSparkles();
  }
  
  // Special cases: some tabs need to initialize every time
  if (tab === 'leaderboard') {
    initLeaderboardTab();
  } else if (tab === 'forum') {
    // Ensure forum initializes properly
    safeSetTimeout(function() {
      initForum();
    }, 100);
  } else if (tab === 'settings') {
    loadSettings();
  } else if (tab === 'myprofile') {
    loadMyProfile();
  } else if (tab === 'profile' && window.currentProfileUsername) {
    loadProfile(window.currentProfileUsername);
  } else if (!tabsLoaded[tab]) { 
    tabsLoaded[tab] = true; 
    loadTab(tab); 
  }
  
  // Load daily tip when home tab is shown
  if (tab === 'home') {
    loadDailyTip();
  }
  
  window.scrollTo(0, 0);
  
  // Update URL hash to persist tab (without triggering reload)
  if (window.location.hash !== '#tab-' + tab) {
    history.replaceState(null, null, '#tab-' + tab);
  }
}


function loadTab(tab) {
  if (tab === 'adopt') loadAdopt();
  else if (tab === 'mypets') loadMyPets();
  else if (tab === 'journal') initJournalTab();
  else if (tab === 'shop') { loadShop(); loadInventory(); }
  else if (tab === 'minigames') initMinigames();
  else if (tab === 'battle') loadBattlePets();
  else if (tab === 'news') loadNews();
  else if (tab === 'twitch') initTwitchTab();
  else if (tab === 'redeem') { loadRedeemHistory(); }
  else if (tab === 'stats') loadStatistics();
  // Note: leaderboard and myprofile handled in showTab()
}

// ── AUTH GATE ────────────────────────────
function showAuthSection(which) {
  document.querySelectorAll('#auth-gate .page-section').forEach(function(s){ s.classList.remove('active'); });
  el('section-' + which).classList.add('active');
  return false;
}

function showForgotPassword() {
  showAuthSection('forgot');
  return false;
}

async function initApp() {
  // Check if user is coming from password reset email
  var hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    console.log('Password recovery mode detected');
    el('auth-gate').style.display = 'none';
    el('reset-password-gate').style.display = 'block';
    el('app-content').style.display = 'none';
    return; // Stop here, show reset form
  }
  
  var session = await requireLogin();
  if (session) {
    await showApp(session.user);
  } else {
    showAuth();
  }
  supabaseClient.auth.onAuthStateChange(function(event, session) {
    if (event === 'PASSWORD_RECOVERY') {
      // Show reset password form
      el('auth-gate').style.display = 'none';
      el('reset-password-gate').style.display = 'block';
      el('app-content').style.display = 'none';
    } else if (event === 'SIGNED_IN' && session) {
      showApp(session.user);
    } else if (event === 'SIGNED_OUT') {
      showAuth();
    }
  });
}

async function showApp(user) {
  currentUser = user;
  el('auth-gate').style.display = 'none';
  el('app-content').style.display = 'block';
  el('nav-logout').style.display = 'inline-block';
  el('nav-profile').style.display = 'inline-block';
  
  // Show Pass and Bingo buttons
  var passBtn = el('pass-button');
  var bingoBtn = el('bingo-button');
  if (passBtn) passBtn.style.display = 'flex';
  if (bingoBtn) bingoBtn.style.display = 'inline-block';
  
  // Clean up any leftover spooky effects
  cleanupSpookyEffects();

  // Check if player exists, create if missing (auto-recovery from database issues)
  var pr = await supabaseClient.from('players').select('username, pawketpoints').eq('id', user.id).maybeSingle();
  
  if (!pr.data) {
    console.log('🚨 Player not found! Auto-creating fresh player account...');
    
    // Generate a safe temporary username (NOT from email for privacy!)
    var tempUsername = 'Player' + Math.floor(Math.random() * 100000);
    
    // Create new player
    var createResult = await supabaseClient
      .from('players')
      .insert([{
        id: user.id,
        username: tempUsername,
        pawketpoints: 0,
        created_at: new Date().toISOString()
      }])
      .select('username, pawketpoints')
      .single();
    
    if (createResult.data) {
      console.log('✅ Fresh player account created:', createResult.data);
      pr = createResult;
      
      // Show welcome notification with prompt to set username
      setTimeout(function() {
        showToast('🌟 Welcome! Please set your username in your Profile!', 10000, 'var(--orange)');
      }, 1000);
    } else {
      console.error('❌ Failed to create player:', createResult.error);
      showToast('⚠️ Error creating account. Please refresh the page.', 5000, 'var(--red)');
      return;
    }
  }
  
  if (pr.data) {
    el('nav-user').textContent = '\u2B50 ' + pr.data.username;
    updateAllPoints(pr.data.pawketpoints || 0);
  }
  
  // Update sidebar stats
  await updateSidebarStats();
  
  // Load user's badges
  await loadUserBadges();
  
  // Load pet title library
  await loadAllPetTitles();
  
  // Load player title system
  await loadAllPlayerTitles();
  await loadPlayerTitles();
  await loadActivePlayerTitle();
  
  // Check for 3am login (Sleep Deprived title)
  // Note: Player titles not yet implemented, this is for future use
  // checkMidnightLogin();
  
  // Check player title unlocks
  await checkPlayerTitleUnlocks();
  
  // Award welcome badge if new user
  await awardBadge('welcome');
  
  // Load daily tip on home page (delay to ensure DOM is ready)
  setTimeout(loadDailyTip, 100);
  
  // Initialize referral system
  await initReferralSystem(user.id);
  
  // Check tutorial status and start if needed
  await checkTutorialStatus();
  
  // Initialize daily fortune AFTER tutorial (only for logged-in users)
  if (typeof dailyFortune !== 'undefined' && dailyFortune.init) {
    // Check if tutorial is completed before showing fortune
    var tutorialDone = playerSettings.tutorial_completed;
    if (tutorialDone) {
      dailyFortune.init();
    }
  }
  
  // Check sidebar stream status
  await checkSidebarStreamStatus();
  
  // FIX 2: Refresh stream status every 2 minutes (throttled, using safe timer)
  safeSetInterval(checkSidebarStreamStatus, 120000);
  
  // PHASE 8 - Growth Features Initialization
  await checkDailyLogin(); // Daily rewards and buffs
  checkReferralCode(); // Check for referral code in URL
  await updateNotificationBadge(); // Update notification count
  
  // Refresh notifications every 60 seconds
  setInterval(updateNotificationBadge, 60000);

  var bonus = await checkDailyBonus(user.id);
  if (bonus.awarded) {
    el('bonus-amount').textContent = bonus.amount + ' PP';
    el('bonus-modal').classList.add('show');
    updateAllPoints(bonus.newTotal);
  }

  el('home-cta').innerHTML = '<button class="btn btn-primary btn-lg" onclick="showTab(\'mypets\')" style="margin-right:10px;">My Pets</button><button class="btn btn-secondary btn-lg" onclick="showTab(\'adopt\')">Adopt More</button>';

  // Restore last active tab from URL hash
  var hash = window.location.hash;
  console.log('Page loaded with hash:', hash);
  if (hash && hash.startsWith('#tab-')) {
    var savedTab = hash.replace('#tab-', '');
    console.log('Restoring saved tab:', savedTab);
    showTab(savedTab);
  } else if (hash && hash.includes('access_token')) {
    // Twitch auth callback
    showTab('twitch');
  } else {
    // Only show home if no tab is currently active and no hash
    var currentTab = document.querySelector('.page-content.active');
    if (!currentTab) {
      console.log('No saved tab, showing home');
      showTab('home');
    }
  }
  
  // Load sidebar news widget
  loadSidebarNews();
  
  // PAWKETPASS & BINGO: Initialize systems
  await loadPassProgress();
  loadDailyBingo();
  updateBingoUI();
  
  // SCRAPBOOK & COMMUNITY GOALS: Initialize systems
  scrapbook_init();
  community_init();
}

function showAuth() {
  currentUser = null;
  el('auth-gate').style.display = 'block';
  el('app-content').style.display = 'none';
  el('nav-logout').style.display = 'none';
  el('nav-profile').style.display = 'none';
  el('nav-user').textContent = '';
  el('nav-points').textContent = '';
  tabsLoaded = {};
}

// ══════════════════════════════════════════════════════════════════════════
// UPDATE SIDEBAR STATS
// ══════════════════════════════════════════════════════════════════════════

async function updateSidebarStats() {
  if (!currentUser) return;
  
  try {
    // Get player data (use maybeSingle to avoid errors if missing)
    var { data: player, error: playerError } = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .eq('id', currentUser.id)
      .maybeSingle();
    
    // If player doesn't exist, they're being auto-created - skip stats for now
    if (!player) {
      console.log('⏳ Player not yet created, skipping sidebar stats...');
      return;
    }
    
    if (playerError) throw playerError;
    
    // Get pet count
    var { data: pets, error: petsError } = await supabaseClient
      .from('user_pets')
      .select('id')
      .eq('user_id', currentUser.id);
    
    if (petsError) throw petsError;
    
    // Get item count
    var { data: items, error: itemsError } = await supabaseClient
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', currentUser.id);
    
    if (itemsError) throw itemsError;
    
    var totalItems = 0;
    if (items) {
      items.forEach(function(item) {
        totalItems += item.quantity || 0;
      });
    }
    
    // Calculate day streak
    var streak = calculateDayStreak();
    
    // Update sidebar display
    var petCountEl = document.getElementById('sidebar-pet-count');
    var pointsEl = document.getElementById('sidebar-points');
    var itemsEl = document.getElementById('sidebar-items');
    var streakEl = document.getElementById('sidebar-streak');
    
    if (petCountEl) petCountEl.textContent = (pets ? pets.length : 0);
    if (pointsEl) {
      var ppValue = player && typeof player.pawketpoints === 'number' ? player.pawketpoints : 0;
      pointsEl.textContent = ppValue.toLocaleString() + ' PP';
    }
    if (itemsEl) itemsEl.textContent = totalItems;
    if (streakEl) streakEl.textContent = streak;
    
  } catch (err) {
    console.error('Error updating sidebar stats:', err);
  }
}

// Calculate day streak from localStorage
function calculateDayStreak() {
  try {
    var today = new Date().toDateString();
    var yesterday = new Date(Date.now() - 86400000).toDateString();
    
    var lastLogin = localStorage.getItem('lastLoginDate');
    var currentStreak = parseInt(localStorage.getItem('loginStreak') || '0');
    var lastRewardDay = parseInt(localStorage.getItem('lastStreakRewardDay') || '0');
    
    if (!lastLogin) {
      // First login
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', '1');
      return 1;
    }
    
    if (lastLogin === today) {
      // Already logged in today
      return currentStreak;
    } else if (lastLogin === yesterday) {
      // Consecutive day
      currentStreak++;
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', currentStreak.toString());
      
      // Check for streak rewards (only award once per milestone)
      if (currentStreak > lastRewardDay) {
        awardStreakReward(currentStreak);
        localStorage.setItem('lastStreakRewardDay', currentStreak.toString());
      }
      
      return currentStreak;
    } else {
      // Streak broken
      localStorage.setItem('lastLoginDate', today);
      localStorage.setItem('loginStreak', '1');
      localStorage.setItem('lastStreakRewardDay', '0'); // Reset reward tracking
      return 1;
    }
  } catch (err) {
    console.error('Error calculating streak:', err);
    return 0;
  }
}

// Award streak milestone rewards
async function awardStreakReward(streak) {
  var reward = null;
  
  if (streak === 3) {
    reward = { pp: 50, message: '3-Day Streak! +50 PP! 🎉' };
  } else if (streak === 7) {
    reward = { pp: 150, message: '7-Day Streak! +150 PP! ⭐' };
  } else if (streak === 14) {
    reward = { pp: 300, message: '14-Day Streak! +300 PP! 💎' };
  } else if (streak === 30) {
    reward = { pp: 1000, message: '30-Day Streak! +1000 PP! 🏆' };
  } else if (streak === 60) {
    reward = { pp: 2500, message: '60-Day Streak! +2500 PP! 👑' };
  } else if (streak === 100) {
    reward = { pp: 5000, message: '100-Day Streak! +5000 PP! 🌟' };
  }
  
  if (reward) {
    await awardPP(reward.pp, 'streak_bonus');
    showPixelToast(reward.message, 'success');
  }
}

async function handleLogout() { 
  await supabaseClient.auth.signOut(); 
  location.reload();
}
function closeBonusModal() { el('bonus-modal').classList.remove('show'); }

// ── LOGIN / REGISTER ─────────────────────
// ══════════════════════════════════════════════════════════════════════════
// AUTH HELPER FUNCTIONS
// ══════════════════════════════════════════════════════════════════════════

async function loginUser(email, password) {
  var { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) throw error;
  return data;
}

async function registerUser(email, password, username) {
  // Step 1: Create auth user with Supabase
  var { data: authData, error: authError } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        username: username
      }
    }
  });
  
  if (authError) throw authError;
  
  // Step 2: Create player profile in database
  var userId = authData.user.id;
  
  var { error: profileError } = await supabaseClient
    .from('players')
    .insert([{
      id: userId,
      username: username,
      pawketpoints: 0,
      created_at: new Date().toISOString()
    }]);
  
  if (profileError) {
    console.error('Error creating player profile:', profileError);
    // Don't throw here - auth account was created, they can still log in
  }
  
  return authData;
}

async function requireLogin() {
  // Check if user is already logged in
  var { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Error checking session:', error);
    return null;
  }
  return data.session;
}

// ══════════════════════════════════════════════════════════════════════════
// AUTH UI HANDLERS
// ══════════════════════════════════════════════════════════════════════════

async function handleLogin() {
  var email = el('login-email').value.trim();
  var password = el('login-password').value;
  var btn = el('login-btn');
  var err = el('login-error');
  var suc = el('login-success');
  err.classList.remove('show');
  suc.classList.remove('show');
  if (!email || !password) { err.textContent = 'Please fill in all fields!'; err.classList.add('show'); return; }
  btn.textContent = 'Logging in...';
  btn.disabled = true;
  try {
    var result = await loginUser(email, password);
    suc.textContent = 'Logged in! Loading...';
    suc.classList.add('show');
    // Wait a moment for the auth state to update, then manually trigger app load
    setTimeout(async function() {
      if (result && result.user) {
        await showApp(result.user);
      }
    }, 500);
  } catch(e) {
    err.textContent = e.message || 'Login failed.';
    err.classList.add('show');
    btn.textContent = 'Login';
    btn.disabled = false;
  }
}

// ── USERNAME PROFANITY FILTER ─────────────────────────────
var PROFANITY_LIST = [
  'fuck', 'shit', 'bitch', 'ass', 'damn', 'hell', 'crap', 'piss',
  'dick', 'cock', 'pussy', 'cunt', 'fag', 'whore', 'slut', 'bastard',
  'nigger', 'nigga', 'chink', 'spic', 'kike', 'retard', 'rape',
  'sex', 'porn', 'nude', 'xxx', 'anal', 'penis', 'vagina', 'testicle',
  'nazi', 'hitler', 'kkk', 'isis', 'kill', 'death', 'murder', 'suicide'
];

function containsProfanity(text) {
  if (!text) return false;
  
  var lowerText = text.toLowerCase();
  
  // Check for exact matches and common variations
  for (var i = 0; i < PROFANITY_LIST.length; i++) {
    var word = PROFANITY_LIST[i];
    
    // Check exact word (with word boundaries)
    var regex = new RegExp('\\b' + word + '\\b', 'i');
    if (regex.test(lowerText)) {
      return true;
    }
    
    // Check for leetspeak and common substitutions
    var variations = word
      .replace(/a/g, '[a@4]')
      .replace(/e/g, '[e3]')
      .replace(/i/g, '[i1!]')
      .replace(/o/g, '[o0]')
      .replace(/s/g, '[s5$]')
      .replace(/t/g, '[t7]');
    
    var variationRegex = new RegExp(variations, 'i');
    if (variationRegex.test(lowerText)) {
      return true;
    }
    
    // Check for word with extra characters (f.u.c.k, f-u-c-k, etc)
    var spacedWord = word.split('').join('[^a-z]*');
    var spacedRegex = new RegExp(spacedWord, 'i');
    if (spacedRegex.test(lowerText)) {
      return true;
    }
  }
  
  return false;
}

async function handleRegister() {
  var username = el('reg-username').value.trim();
  var email = el('reg-email').value.trim();
  var password = el('reg-password').value;
  var confirm = el('reg-confirm').value;
  var btn = el('reg-btn');
  var err = el('reg-error');
  var suc = el('reg-success');
  err.classList.remove('show');
  suc.classList.remove('show');
  if (!username||!email||!password||!confirm) { err.textContent='Fill in all fields!'; err.classList.add('show'); return; }
  if (username.length < 3) { err.textContent='Username must be 3+ chars!'; err.classList.add('show'); return; }
  
  // Check for profanity
  if (containsProfanity(username)) {
    err.textContent='Name cannot contain offensive language';
    err.classList.add('show');
    return;
  }
  
  if (password.length < 6) { err.textContent='Password must be 6+ chars!'; err.classList.add('show'); return; }
  if (password !== confirm) { err.textContent='Passwords do not match!'; err.classList.add('show'); return; }
  btn.textContent='Creating...'; btn.disabled=true;
  try {
    await registerUser(email, password, username);
    suc.textContent='Account created! Now login.';
    suc.classList.add('show');
    btn.textContent='Done!';
    setTimeout(function(){ showAuthSection('login'); }, 2000);
  } catch(e) {
    err.textContent=e.message||'Registration failed.';
    err.classList.add('show');
    btn.textContent='Create Account';
    btn.disabled=false;
  }
}

async function handleForgotPassword() {
  var email = el('forgot-email').value.trim();
  var err = el('forgot-error');
  var suc = el('forgot-success');
  err.classList.remove('show');
  suc.classList.remove('show');
  
  if (!email) {
    err.textContent = 'Please enter your email address!';
    err.classList.add('show');
    return;
  }
  
  var btn = event.target;
  btn.textContent = 'Sending...';
  btn.disabled = true;
  
  try {
    // Don't specify redirectTo - let Supabase use the Site URL from settings
    var res = await supabaseClient.auth.resetPasswordForEmail(email);
    
    if (res.error) throw res.error;
    
    suc.textContent = 'Password reset email sent! Check your inbox.';
    suc.classList.add('show');
    el('forgot-email').value = '';
    btn.textContent = '✉️ Send Reset Email';
    btn.disabled = false;
    setTimeout(function(){ showAuthSection('login'); }, 3000);
  } catch(e) {
    err.textContent = e.message || 'Failed to send reset email. Please try again.';
    err.classList.add('show');
    btn.textContent = '✉️ Send Reset Email';
    btn.disabled = false;
  }
}

async function handleResetPassword() {
  var newPassword = el('reset-new-password').value;
  var confirmPassword = el('reset-confirm-password').value;
  var err = el('reset-error');
  var suc = el('reset-success');
  
  err.classList.remove('show');
  suc.classList.remove('show');
  
  if (!newPassword || !confirmPassword) {
    err.textContent = 'Please fill in both password fields!';
    err.classList.add('show');
    return;
  }
  
  if (newPassword.length < 6) {
    err.textContent = 'Password must be at least 6 characters!';
    err.classList.add('show');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    err.textContent = 'Passwords do not match!';
    err.classList.add('show');
    return;
  }
  
  var btn = event.target;
  btn.textContent = 'Updating...';
  btn.disabled = true;
  
  try {
    var res = await supabaseClient.auth.updateUser({
      password: newPassword
    });
    
    if (res.error) throw res.error;
    
    suc.textContent = 'Password updated successfully! Redirecting...';
    suc.classList.add('show');
    
    // Hide reset form, show app
    setTimeout(function() {
      el('reset-password-gate').style.display = 'none';
      el('auth-gate').style.display = 'none';
      initApp();
    }, 2000);
    
  } catch(e) {
    err.textContent = e.message || 'Failed to update password. Please try again.';
    err.classList.add('show');
    btn.textContent = '🔐 Update Password';
    btn.disabled = false;
  }
}

document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter') return;
  var a = document.querySelector('#auth-gate .page-section.active');
  if (!a) return;
  if (a.id === 'section-login') handleLogin();
  else if (a.id === 'section-register') handleRegister();
});

// ── ADOPT TAB ────────────────────────────
async function loadAdopt() {
  var grid = el('pets-grid');
  if (!currentUser) return;
  grid.innerHTML = '<div class="spinner"></div>';

  var owned = await supabaseClient.from('user_pets').select('pet_id').eq('user_id', currentUser.id);
  if (owned.data) { ownedPetIds = owned.data.map(function(p){ return p.pet_id; }); totalOwnedCount = owned.data.length; }

  var res = await supabaseClient.from('pets').select('*').order('created_at', {ascending:true});
  if (res.error || !res.data) { grid.textContent = 'Could not load pets.'; return; }
  grid.innerHTML = '';
  res.data.forEach(function(pet) { grid.appendChild(makePetCard(pet)); });
}

function makePetCard(pet) {
  var isPlaceholder = pet.name === '???';
  var isOwned = ownedPetIds.indexOf(pet.id) !== -1;
  
  // DYNAMIC PRICING: Calculate price based on how many pets player already owns
  // 1st pet = 0, 2nd = 100, 3rd = 150, 4th = 200, etc. (+50 each time)
  var price = 0;
  if (totalOwnedCount === 0) {
    price = 0; // First pet is always free
  } else if (totalOwnedCount === 1) {
    price = 100; // Second pet costs 100
  } else {
    // 3rd pet onwards: 150, 200, 250, 300, etc.
    price = 100 + ((totalOwnedCount - 1) * 50);
  }
  
  var canAfford = currentPoints >= price;

  var card = document.createElement('div');
  card.className = 'pet-card' + (isPlaceholder ? ' placeholder' : '') + (isOwned ? ' already-owned' : '');

  var imgWrap = makeEl('div', {class:'pet-image-wrap'});
  if (pet.image_file && !isPlaceholder) {
    var img = makeEl('img', {src:'images/'+pet.image_file, alt:pet.name});
    img.onerror = function(){ this.parentElement.innerHTML = '&#128062;'; };
    imgWrap.appendChild(img);
  } else {
    imgWrap.innerHTML = isPlaceholder ? '&#10067;' : '&#128062;';
  }
  card.appendChild(imgWrap);
  card.appendChild(makeEl('div', {class:'pet-name'}, isPlaceholder ? '???' : pet.name));
  if (pet.vtuber_name && !isPlaceholder) card.appendChild(makeEl('div', {class:'pet-vtuber'}, pet.vtuber_name));
  card.appendChild(makeEl('div', {class:'pet-description'}, isPlaceholder ? 'A mystery pet...' : (pet.description || '')));

  if (!isPlaceholder) {
    var priceEl = makeEl('span', {class: price === 0 ? 'pet-price free' : 'pet-price'}, price === 0 ? 'FREE' : '\uD83E\uDE99 ' + price + ' PP');
    card.appendChild(priceEl);
  }

  var btn = document.createElement('button');
  if (isPlaceholder) { btn.className='btn-locked'; btn.textContent='Coming Soon'; }
  else if (isOwned) { btn.className='btn-owned'; btn.textContent='Already Adopted!'; }
  else if (!canAfford) { btn.className='btn-locked'; btn.textContent='Need '+price+' PP'; }
  else {
    btn.className='btn btn-primary btn-adopt';
    btn.textContent='Adopt!';
    btn.addEventListener('click', function() {
      selectedPet = {id:pet.id, name:pet.name, description:pet.description||'', image_file:pet.image_file||'', price:price};
      openAdoptModal();
    });
  }
  card.appendChild(btn);
  return card;
}

function openAdoptModal() {
  var mi = el('modal-image');
  if (selectedPet.image_file) {
    var img = makeEl('img', {src:'images/'+selectedPet.image_file, alt:selectedPet.name});
    img.onerror = function(){ mi.innerHTML='&#128062;'; };
    mi.innerHTML=''; mi.appendChild(img);
  } else { mi.innerHTML='&#128062;'; }
  el('modal-title').textContent = 'Adopt ' + selectedPet.name + '?';
  el('modal-desc').textContent = selectedPet.price === 0 ? 'Your first pet is free!' : 'This will cost ' + selectedPet.price + ' PawketPoints.';
  el('nickname-input').value = '';
  el('adopt-modal').classList.add('show');
}

function closeAdoptModal() { el('adopt-modal').classList.remove('show'); selectedPet = null; }
function closeSuccessModal() { el('success-modal').classList.remove('show'); tabsLoaded['adopt'] = false; loadAdopt(); lastAdoptedPet = null; }

// Store last adopted pet for sharing
var lastAdoptedPet = null;

async function confirmAdopt() {
  if (!selectedPet || !currentUser) return;
  
  // Rate limiting
  if (!canPerformAction('adopt_pet', 1000)) {
    showToast('Please wait before adopting again!');
    return;
  }
  
  var btn = el('confirm-adopt-btn');
  var nickname = el('nickname-input').value.trim();
  
  // Validation
  if (!nickname || nickname === '') {
    showToast('Please enter a nickname! ❌');
    return;
  }
  
  if (nickname.length > 50) {
    showToast('Nickname must be 50 characters or less! ❌');
    return;
  }
  
  if (/<\/?[a-z][\s\S]*>/i.test(nickname)) {
    showToast('Nickname cannot contain HTML tags! ❌');
    return;
  }
  
  if (containsProfanity(nickname)) {
    showToast('Please choose a family-friendly nickname! ❌');
    return;
  }
  
  // Use provided nickname or fallback to pet name
  if (nickname === '') {
    nickname = selectedPet.name;
  }
  
  btn.textContent = 'Adopting...'; 
  btn.disabled = true;
  
  // Call secure database function
  var { data: result, error } = await supabaseClient.rpc('adopt_pet_secure', {
    p_pet_type: selectedPet.name,
    p_nickname: nickname,
    p_price: selectedPet.price
  });
  
  if (error) {
    showToast('Adoption failed: ' + error.message);
    btn.textContent = 'Adopt!'; 
    btn.disabled = false; 
    return;
  }
  
  // Update display
  updateAllPoints(currentPoints - (result.price_paid || 0));
  
  // SCRAPBOOK: Add adoption memory
  if (result.pet_id) {
    scrapbook_addMemory(result.pet_id, 'adopted', {});
  }
  
  // Store for social sharing
  lastAdoptedPet = {
    name: selectedPet.name,
    nickname: nickname,
    emoji: getPetEmoji(selectedPet.name)
  };
  
  // Award first pet badge
  await awardBadge('first_pet');
  
  // PHASE 8 - Process referral on first adoption
  await processReferral();
  
  // Track adoption in analytics
  trackPetAdoption(selectedPet.name);
  
  closeAdoptModal();
  el('success-message').textContent = nickname + ' has joined your collection!';
  el('success-modal').classList.add('show');
  
  // 🎉 CONFETTI BURST!
  setTimeout(function() {
    createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);
  }, 100);
  
  // Notify tutorial if active
  if (typeof Tutorial !== 'undefined' && Tutorial.active) {
    Tutorial.onPetAdopted();
  }
  
  ownedPetIds.push(selectedPet.id); 
  totalOwnedCount++;
  tabsLoaded['mypets'] = false;
  btn.textContent = 'Adopt!'; 
  btn.disabled = false;
}

// ── MY PETS TAB ──────────────────────────
async function loadInventoryData() {
  inventoryItems = [];
  if (!currentUser) return;
  var invRes = await supabaseClient.from('user_inventory').select('id,item_id,quantity').eq('user_id',currentUser.id).gt('quantity',0);
  if (invRes.error || !invRes.data || !invRes.data.length) return;
  var itemIds = invRes.data.map(function(r){ return r.item_id; });
  var itemsRes = await supabaseClient.from('items').select('id,name,effect,value,effect_value,hunger_effect,energy_effect,happiness_effect,xp_effect').in('id',itemIds);
  var itemMap = {};
  if (itemsRes.data) itemsRes.data.forEach(function(i){ itemMap[i.id]=i; });
  invRes.data.forEach(function(row) {
    var item = itemMap[row.item_id] || {};
    inventoryItems.push({
      invId: row.id, 
      itemId: row.item_id, 
      name: item.name || 'Item', 
      qty: row.quantity, 
      effect: item.effect,
      value: item.value,
      effect_value: item.effect_value,
      h: item.hunger_effect || 0, 
      e: item.energy_effect || 0, 
      hap: item.happiness_effect || 0, 
      xp: item.xp_effect || 0
    });
  });
}

function getEffectText(item) {
  var p = [];
  if (item.h > 0) p.push('+'+item.h+' Hunger');
  if (item.e > 0) p.push('+'+item.e+' Energy');
  if (item.hap > 0) p.push('+'+item.hap+' Happiness');
  if (item.xp > 0) p.push('+'+item.xp+' XP');
  return p.join('  ');
}

async function loadMyPets() {
  var container = el('mypets-container');
  if (!currentUser) return;
  container.innerHTML = '<div class="spinner"></div>';
  await loadInventoryData();
  
  // OPTIMIZATION 2: Single JOIN query instead of N+1 queries
  // Fetch pets WITH titles in one query instead of 1 + N queries
  var res = await supabaseClient
    .from('user_pets')
    .select(`
      *,
      pets(name, image_file, vtuber_name, twitch_url),
      user_pet_titles(
        pet_title_id,
        pet_titles(*)
      )
    `)
    .eq('user_id', currentUser.id)
    .order('adopted_at', {ascending: true});
  
  if (res.error) { 
    console.error('Error loading pets:', res.error);
    container.textContent='Could not load pets.'; 
    return; 
  }
  
  if (!res.data || !res.data.length) {
    container.innerHTML='<div class="empty-state"><div style="font-size:3rem;margin-bottom:14px;">&#128062;</div><h2 style="color:var(--purple-dark);margin-bottom:10px;">No pets yet!</h2><p style="color:var(--text-light);margin-bottom:18px;">Head to the adoption centre!</p><button class="btn btn-primary btn-lg" onclick="showTab(\'adopt\')">Adopt a Pet</button></div>';
    return;
  }
  
  // Process pets and calculate decay for DISPLAY ONLY (don't save back to DB!)
  res.data.forEach(function(pet) {
    var decayedEnergy = calculateEnergyRegen(pet.energy, pet.max_energy, pet.last_played);
    var decayedHunger = calculateHungerDecay(pet.hunger, pet.last_fed);
    var decayedHappiness = calculateHappinessDecay(pet.happiness, pet.last_fed, pet.last_played);
    
    // HP regenerates over time (3 HP per hour) - BUT respect 0 HP (fainted)!
    // Use updated_at as the "last activity" timestamp for HP regen
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 25);
    var maxHP = pet.max_hp || pet.base_hp || 25;
    
    // Only regenerate if HP > 0 (don't auto-revive fainted pets!)
    var regenedHP = currentHP > 0 ? calculateHPRegen(currentHP, maxHP, pet.updated_at) : 0;
    
    console.log('🐾 Loading pet:', pet.nickname, 'DB HP:', pet.current_hp, 'Displayed HP:', regenedHP);
    
    petState[pet.id] = Object.assign({}, pet, {
      energy: decayedEnergy,
      hunger: decayedHunger,
      happiness: decayedHappiness,
      current_hp: regenedHP
    });
    
    // OPTIMIZATION 2: Cache titles from joined query (already loaded above)
    if (pet.user_pet_titles && pet.user_pet_titles.length > 0) {
      petTitlesCache[pet.id] = pet.user_pet_titles.map(function(upt) {
        return upt.pet_titles;
      });
    } else {
      petTitlesCache[pet.id] = [];
    }
  });
  
  // OPTIMIZATION 1: Use DocumentFragment for batch DOM operations
  // Build all cards in memory, then append once (1 reflow instead of N reflows)
  var grid = document.createElement('div');
  grid.className = 'mypets-grid';
  
  var fragment = document.createDocumentFragment();
  Object.values(petState).forEach(function(pet) { 
    fragment.appendChild(makeMyPetCard(pet)); 
  });
  grid.appendChild(fragment);
  
  container.innerHTML = '';
  container.appendChild(grid);
  
  // FIX 5: Set up event delegation for feed/play buttons (only once)
  if (!container.hasAttribute('data-delegation-setup')) {
    container.setAttribute('data-delegation-setup', 'true');
    container.addEventListener('click', function(e) {
      // Check for feed button click
      var feedBtn = e.target.closest('.btn-feed');
      if (feedBtn) {
        var petId = feedBtn.getAttribute('data-pet-id');
        if (petId && typeof feed === 'function') {
          feed(parseInt(petId));
        }
        return;
      }
      
      // Check for play button click
      var playBtn = e.target.closest('.btn-play');
      if (playBtn) {
        var petId = playBtn.getAttribute('data-pet-id');
        if (petId && typeof play === 'function') {
          play(parseInt(petId));
        }
        return;
      }
    });
  }
}

function makeDropdown(petId) {
  var section = makeEl('div', {class:'use-item-section'});
  var label = makeEl('div', {class:'use-item-label'}, 'Use an Item');
  section.appendChild(label);
  if (!inventoryItems.length) {
    var p = makeEl('p', {style:'font-size:0.8rem;color:var(--text-light)'}, 'No items. ');
    var a = makeEl('a', {href:'#'}, 'Visit the shop!');
    a.onclick = function(){ showTab('shop'); return false; };
    p.appendChild(a);
    section.appendChild(p);
    return section;
  }
  var row = makeEl('div', {class:'use-item-row'});
  var sel = makeEl('select', {class:'item-select', id:'sel-'+petId});
  sel.appendChild(makeEl('option', {value:''}, '— Select an item —'));
  inventoryItems.forEach(function(item) {
    sel.appendChild(makeEl('option', {value:item.invId}, item.name + ' (x'+item.qty+')'));
  });
  sel.onchange = function(){ previewItem(petId); };
  var useBtn = makeEl('button', {class:'btn-use-item', id:'usebtn-'+petId}, 'Use Item');
  useBtn.disabled = true;
  useBtn.onclick = function(){ useItem(petId); };
  row.appendChild(sel);
  row.appendChild(useBtn);
  section.appendChild(row);
  var preview = makeEl('div', {class:'item-effect-preview', id:'preview-'+petId});
  preview.textContent = 'Choose an item to see effects';
  section.appendChild(preview);
  return section;
}

function previewItem(petId) {
  var sel = el('sel-'+petId);
  var preview = el('preview-'+petId);
  var btn = el('usebtn-'+petId);
  if (!sel || !sel.value) { if(preview) preview.textContent=''; if(btn) btn.disabled=true; return; }
  var item = inventoryItems.find(function(i){ return i.invId === sel.value; });
  if (!item) { if(preview) preview.textContent=''; if(btn) btn.disabled=true; return; }
  preview.textContent = 'Will give: ' + getEffectText(item);
  btn.disabled = false;
}

// ── EDIT PET NICKNAME ─────────────────────────────
function openEditNicknameModal(petId, currentNickname) {
  // Create modal overlay
  var overlay = makeEl('div', {class:'modal-overlay', id:'edit-nickname-overlay'});
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';
  
  // Create modal
  var modal = makeEl('div', {class:'modal-content'});
  modal.style.cssText = 'background:var(--cream);border:4px solid var(--purple);border-radius:24px;padding:30px;max-width:400px;width:90%;box-shadow:0 8px 32px rgba(153,102,255,0.4);';
  
  // Title
  var title = makeEl('h2', {style:'font-family:Chewy,cursive;color:var(--purple);margin:0 0 20px 0;text-align:center;'});
  title.textContent = 'Edit Nickname';
  modal.appendChild(title);
  
  // Input
  var input = makeEl('input', {type:'text', id:'nickname-input', maxlength:'30', value:currentNickname});
  input.style.cssText = 'width:100%;padding:12px;font-size:1.1rem;border:3px solid var(--purple-light);border-radius:12px;font-family:Fredoka One,cursive;margin-bottom:20px;box-sizing:border-box;';
  input.placeholder = 'Enter new nickname...';
  modal.appendChild(input);
  
  // Character count
  var charCount = makeEl('div', {id:'char-count', style:'text-align:right;color:var(--text-light);font-size:0.9rem;margin:-10px 0 15px 0;'});
  charCount.textContent = currentNickname.length + '/30';
  modal.appendChild(charCount);
  
  input.oninput = function() {
    var count = this.value.length;
    charCount.textContent = count + '/30';
    if (count > 25) {
      charCount.style.color = 'var(--pink)';
    } else {
      charCount.style.color = 'var(--text-light)';
    }
  };
  
  // Buttons
  var btnRow = makeEl('div', {style:'display:flex;gap:10px;justify-content:center;'});
  
  var cancelBtn = makeEl('button', {class:'btn btn-outline'});
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = function() { closeEditNicknameModal(); };
  
  var saveBtn = makeEl('button', {class:'btn btn-primary'});
  saveBtn.textContent = 'Save';
  saveBtn.onclick = function() { saveNickname(petId); };
  
  btnRow.appendChild(cancelBtn);
  btnRow.appendChild(saveBtn);
  modal.appendChild(btnRow);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Focus input and select all
  setTimeout(function() {
    input.focus();
    input.select();
  }, 100);
  
  // Enter key to save
  input.onkeypress = function(e) {
    if (e.key === 'Enter') {
      saveNickname(petId);
    }
  };
}

function closeEditNicknameModal() {
  var overlay = el('edit-nickname-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
}

async function saveNickname(petId) {
  var input = el('nickname-input');
  if (!input) return;
  
  var newNickname = input.value.trim();
  
  // Validation
  if (!newNickname) {
    showToast('Please enter a nickname! ❌');
    return;
  }
  
  if (newNickname.length > 30) {
    showToast('Nickname too long! (Max 30 characters) ❌');
    return;
  }
  
  if (/<\/?[a-z][\s\S]*>/i.test(newNickname)) {
    showToast('Nickname cannot contain HTML tags! ❌');
    return;
  }
  
  if (containsProfanity(newNickname)) {
    showToast('Please choose a family-friendly nickname! ❌');
    return;
  }
  
  try {
    // Update in database
    var res = await supabaseClient
      .from('user_pets')
      .update({ nickname: newNickname })
      .eq('id', petId)
      .eq('user_id', currentUser.id);
    
    if (res.error) {
      console.error('Error updating nickname:', res.error);
      showToast('Failed to update nickname ❌');
      return;
    }
    
    // Update local state
    if (petState[petId]) {
      petState[petId].nickname = newNickname;
    }
    
    // Close modal
    closeEditNicknameModal();
    
    // Reload pets page to show new nickname
    loadMyPets();
    
    showToast('Nickname updated! ✨');
    
  } catch (err) {
    console.error('Error saving nickname:', err);
    showToast('Failed to update nickname ❌');
  }
}

async function useItem(petId) {
  var sel = el('sel-'+petId); 
  if (!sel || !sel.value) return;
  
  var idx = inventoryItems.findIndex(function(i){ return i.invId === sel.value; }); 
  if (idx === -1) return;
  
  var item = inventoryItems[idx]; 
  var pet = petState[petId]; 
  if (!pet) return;
  
  var btn = el('usebtn-'+petId); 
  btn.disabled = true; 
  btn.textContent = '...';
  
  var updates = {};
  
  console.log('=== USE ITEM DEBUG ===');
  console.log('Item:', item);
  console.log('Item effect:', item.effect);
  console.log('Item value:', item.value);
  console.log('Item effect_value:', item.effect_value);
  
  // Handle healing items (HP restoration)
  var healValue = item.value || item.effect_value || 0;
  console.log('Heal value calculated:', healValue);
  console.log('Is healing item?', item.effect === 'healing', healValue > 0);
  
  if (item.effect === 'healing' && healValue > 0) {
    // Get current HP and max HP from database
    var petRes = await supabaseClient
      .from('user_pets')
      .select('current_hp, max_hp, base_hp')
      .eq('id', petId)
      .single();
    
    if (petRes.error) {
      showToast('Error: ' + petRes.error.message);
      btn.disabled = false;
      btn.textContent = 'Use';
      return;
    }
    
    // FIX: Respect 0 HP! Don't use base_hp as fallback for 0
    var currentHP = (petRes.data.current_hp !== null && petRes.data.current_hp !== undefined) ? petRes.data.current_hp : (petRes.data.base_hp || 30);
    var maxHP = petRes.data.max_hp || petRes.data.base_hp || 30;
    
    console.log('🩹 Healing - Current HP:', currentHP, 'Max HP:', maxHP, 'Heal amount:', healValue);
    
    // Check if already at full HP
    if (currentHP >= maxHP) {
      showToast('❤️ Pet is already at full HP!');
      btn.disabled = false;
      btn.textContent = 'Use';
      return;
    }
    
    // Calculate new HP (can't exceed max)
    var newHP = Math.min(currentHP + healValue, maxHP);
    var healedAmount = newHP - currentHP;
    
    updates.current_hp = newHP;
    showToast('💚 Healed ' + healedAmount + ' HP! (' + newHP + '/' + maxHP + ')');
  }
  
  // Handle other item effects
  if (item.h > 0) updates.hunger = Math.min(pet.hunger + item.h, pet.max_hunger);
  if (item.e > 0) updates.energy = Math.min(pet.energy + item.e, pet.max_energy);
  if (item.hap > 0) updates.happiness = Math.min(pet.happiness + item.hap, pet.max_happiness);
  if (item.xp > 0) updates.xp = pet.xp + item.xp;
  
  // Make sure we have some effect to apply
  if (!Object.keys(updates).length) { 
    showToast('No effects configured.'); 
    btn.disabled = false; 
    btn.textContent = 'Use'; 
    return; 
  }
  
  // Apply the updates
  var res = await supabaseClient.from('user_pets').update(updates).eq('id', petId);
  if (res.error) { 
    showToast('Error: ' + res.error.message); 
    btn.disabled = false; 
    btn.textContent = 'Use'; 
    return; 
  }
  
  // Remove item from inventory
  if (item.qty <= 1) { 
    await supabaseClient.from('user_inventory').delete().eq('id', item.invId); 
    inventoryItems.splice(idx, 1); 
  } else { 
    await supabaseClient.from('user_inventory').update({quantity: item.qty - 1}).eq('id', item.invId); 
    inventoryItems[idx].qty = item.qty - 1; 
  }
  
  // Update UI for non-healing effects
  if (updates.hunger !== undefined) { 
    petState[petId].hunger = updates.hunger; 
    updateBar(petId, 'hunger', updates.hunger, pet.max_hunger); 
  }
  if (updates.energy !== undefined) { 
    petState[petId].energy = updates.energy; 
    updateBar(petId, 'energy', updates.energy, pet.max_energy); 
  }
  if (updates.happiness !== undefined) { 
    petState[petId].happiness = updates.happiness; 
    updateBar(petId, 'happiness', updates.happiness, pet.max_happiness); 
  }
  if (updates.xp !== undefined) { 
    petState[petId].xp = updates.xp; 
    updateXpBar(petId, updates.xp, pet.level); 
  }
  if (updates.current_hp !== undefined) {
    // Update petState and reload the entire card to show new HP
    petState[petId].current_hp = updates.current_hp;
    tabsLoaded['mypets'] = false;
    loadMyPets();
  }
  
  // Show effect flash (skip for healing items since we already showed toast)
  if (!updates.current_hp) {
    showFlash(petId, item.name + ': ' + getEffectText(item), '#b06aff');
    showToast('Used ' + item.name + '!');
  }
  
  // Refresh the dropdown
  var card = el('petcard-' + petId);
  if (card) { 
    var old = card.querySelector('.use-item-section'); 
    if (old) old.replaceWith(makeDropdown(petId)); 
  }
  
  btn.disabled = false; 
  btn.textContent = 'Use';
}

function getMoodEmoji(happiness, hunger, energy, maxHappiness, maxHunger, maxEnergy) {
  // Use the comprehensive mood calculator if max values provided
  if (maxHappiness && maxHunger && maxEnergy) {
    var mood = getPetMood(hunger, energy, happiness, maxHunger, maxEnergy, maxHappiness);
    return mood.emoji;
  }
  
  // Fallback to simple mood
  if (happiness >= 80 && hunger >= 60) return '😊';
  if (happiness >= 60) return '🙂';
  if (happiness >= 40) return '😐';
  if (happiness >= 20) return '😟';
  return '😭';
}

function getHabitatStyle(vtuberName) {
  var habitats = {
    'Embertail': 'background: linear-gradient(180deg, #ff9f43 0%, #ffcc70 60%, #fffaf6 100%)',
    'Pyxshuul':  'background: linear-gradient(180deg, #b06aff 0%, #e8d5ff 60%, #fffaf6 100%)',
  };
  return habitats[vtuberName] || 'background: linear-gradient(180deg, var(--purple) 0%, var(--purple-light) 60%, #fffaf6 100%)';
}

function getAchievements(pet) {
  var badges = [];
  if (pet.level >= 2) badges.push({icon:'&#11088;', label:'Lv.'+pet.level, cls:'gold'});
  if (pet.level >= 5) badges.push({icon:'&#127775;', label:'Veteran', cls:'purple'});
  if (pet.level >= 10) badges.push({icon:'&#128081;', label:'Legend', cls:'gold'});
  if (pet.xp >= 50) badges.push({icon:'&#127941;', label:'Trained', cls:'bronze'});
  if (pet.happiness >= 80) badges.push({icon:'&#128150;', label:'Happy', cls:'silver'});
  if (pet.max_hunger > 100) badges.push({icon:'&#128200;', label:'Growing', cls:'purple'});
  return badges;
}

function getLastSeenText(lastFed, lastPlayed) {
  var lastTime = null;
  if (lastFed && lastPlayed) {
    lastTime = new Date(lastFed) > new Date(lastPlayed) ? new Date(lastFed) : new Date(lastPlayed);
  } else if (lastFed) { lastTime = new Date(lastFed); }
  else if (lastPlayed) { lastTime = new Date(lastPlayed); }
  else return 'Never interacted yet';

  var mins = Math.floor((new Date() - lastTime) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' minute' + (mins===1?'':'s') + ' ago';
  var hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + ' hour' + (hrs===1?'':'s') + ' ago';
  var days = Math.floor(hrs / 24);
  return days + ' day' + (days===1?'':'s') + ' ago';
}

function makeMyPetCard(pet) {
  var info = pet.pets || {};
  var xpNext = pet.level * 120;
  var hPct = Math.round(pet.hunger/pet.max_hunger*100);
  var hapPct = Math.round(pet.happiness/pet.max_happiness*100);
  var ePct = Math.round(pet.energy/pet.max_energy*100);
  var xpPct = Math.min(pet.xp/xpNext*100, 100);
  var mood = getPetMood(pet.hunger, pet.energy, pet.happiness, pet.max_hunger, pet.max_energy, pet.max_happiness);
  var moodEmoji = mood.emoji;
  var achievements = getAchievements(pet);
  var lastSeen = getLastSeenText(pet.last_fed, pet.last_played);

  var card = makeEl('div', {class:'my-pet-card', id:'petcard-'+pet.id});

  // Habitat banner
  var habitat = makeEl('div', {class:'pet-habitat'});
  habitat.setAttribute('style', getHabitatStyle(info.vtuber_name));

  // Floating avatar with mood badge
  var avatarWrap = makeEl('div', {class:'pet-avatar-wrap'});
  var avatar = makeEl('div', {class:'pet-avatar'});
  if (info.image_file) {
    var img = makeEl('img', {src:'images/'+info.image_file, alt:pet.nickname});
    img.onerror = function(){ this.parentElement.innerHTML='&#128062;'; };
    avatar.appendChild(img);
  } else { avatar.innerHTML='&#128062;'; }
  var moodBadge = makeEl('div', {class:'mood-badge'});
  moodBadge.innerHTML = moodEmoji;
  avatarWrap.appendChild(avatar);
  avatarWrap.appendChild(moodBadge);
  habitat.appendChild(avatarWrap);
  card.appendChild(habitat);

  // Card body
  var body = makeEl('div', {class:'pet-card-body'});

  // Name and info
  var headerInfo = makeEl('div', {class:'pet-card-header-info'});
  
  // Add evolution stage emoji
  var evolutionStage = getEvolutionStage(pet.level);
  var evolutionEmoji = getEvolutionEmoji(evolutionStage);
  var stageName = evolutionStage.charAt(0).toUpperCase() + evolutionStage.slice(1);
  
  // Add edit nickname button
  var editNicknameBtn = makeEl('button', {class:'btn-edit-nickname', title:'Edit nickname'});
  editNicknameBtn.innerHTML = '✏️';
  editNicknameBtn.style.cssText = 'margin-left:8px;padding:4px 8px;font-size:1rem;cursor:pointer;background:var(--cream);border:2px solid var(--purple-light);border-radius:8px;transition:all 0.2s;';
  editNicknameBtn.onmouseover = function() { this.style.borderColor = 'var(--purple)'; this.style.background = 'var(--purple-light)'; };
  editNicknameBtn.onmouseout = function() { this.style.borderColor = 'var(--purple-light)'; this.style.background = 'var(--cream)'; };
  editNicknameBtn.onclick = function() { openEditNicknameModal(pet.id, pet.nickname); };
  
  var nicknameRow = makeEl('div', {style:'display:flex;align-items:center;justify-content:space-between;'});
  var nicknameText = makeEl('div', {class:'pet-card-nickname'}, evolutionEmoji + ' ' + pet.nickname + ' (' + stageName + ')');
  nicknameRow.appendChild(nicknameText);
  nicknameRow.appendChild(editNicknameBtn);
  headerInfo.appendChild(nicknameRow);
  
  // Add variant badge if pet has variant
  if (pet.variant) {
    var variantBadgeDiv = makeEl('div');
    variantBadgeDiv.innerHTML = getPetVariantBadge(pet.variant);
    variantBadgeDiv.style.cssText = 'margin:5px 0;';
    headerInfo.appendChild(variantBadgeDiv);
  }
  
  // Add pet title display if active
  if (pet.active_pet_title_id) {
    var titleDiv = makeEl('div');
    titleDiv.innerHTML = getPetTitleDisplay(pet.id);
    titleDiv.style.cssText = 'margin:5px 0;';
    headerInfo.appendChild(titleDiv);
  }
  
  var speciesEl = makeEl('div', {class:'pet-card-species'});
  if (info.vtuber_name) speciesEl.textContent = info.vtuber_name;
  if (info.twitch_url) {
    var tLink = makeEl('a', {href:info.twitch_url, target:'_blank'});
    tLink.style.cssText = 'font-size:0.72rem;background:#9146ff;color:white;padding:2px 7px;border-radius:10px;font-family:Fredoka One,cursive;text-decoration:none;margin-left:6px;';
    tLink.textContent = 'Watch Live';
    speciesEl.appendChild(tLink);
  }
  headerInfo.appendChild(speciesEl);
  
  // Pet backstory/bio
  var backstory = getPetBackstory(info.name);
  var bioEl = makeEl('div', {class:'pet-card-bio'});
  bioEl.textContent = backstory;
  bioEl.style.cssText = 'font-size:0.85rem;color:var(--text-light);margin:8px 0;font-style:italic;line-height:1.4;';
  headerInfo.appendChild(bioEl);
  
  headerInfo.appendChild(makeEl('div', {class:'pet-card-level', id:'lvl-'+pet.id}, 'Lv. '+pet.level+' | Max Stats: '+pet.max_hunger));
  body.appendChild(headerInfo);

  // Last interaction
  body.appendChild(makeEl('div', {class:'pet-last-seen'}, 'Last interaction: ' + lastSeen));

  // Achievements
  if (achievements.length > 0) {
    var achRow = makeEl('div', {class:'achievements-row'});
    achievements.forEach(function(ach) {
      var badge = makeEl('span', {class:'ach-badge '+ach.cls});
      badge.innerHTML = ach.icon + ' ' + ach.label;
      achRow.appendChild(badge);
    });
    body.appendChild(achRow);
  }

  // Mood status display
  var moodDisplay = makeEl('div', {class:'pet-mood-display'});
  moodDisplay.style.cssText = 'text-align:center;padding:8px;margin:10px 0;background:' + mood.color + '20;border:2px solid ' + mood.color + ';border-radius:12px;font-weight:bold;color:' + mood.color + ';';
  moodDisplay.innerHTML = mood.emoji + ' Mood: ' + mood.mood;
  body.appendChild(moodDisplay);

  // Battle Stats (if they exist)
  if (pet.base_hp || pet.base_attack || pet.base_defense || pet.base_speed) {
    var battleStats = makeEl('div', {class:'pet-battle-stats'});
    battleStats.style.cssText = 'display:flex;justify-content:space-around;padding:12px;margin:10px 0;background:rgba(176,106,255,0.1);border:2px solid var(--purple-light);border-radius:12px;';
    
    // HP with current/max display - FIX: Respect 0 HP!
    var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : (pet.base_hp || 30);
    var maxHP = pet.max_hp || pet.base_hp || 30;
    var hpPercent = Math.round((currentHP / maxHP) * 100);
    var hpColor = hpPercent > 50 ? '#5dde7a' : hpPercent > 25 ? '#ffaa00' : '#ff6b6b';
    
    var hpStat = makeEl('div', {class:'battle-stat-mini'});
    hpStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">HP</div>' +
      '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + currentHP + '/' + maxHP + '</div>' +
      '<div style="width:60px;height:4px;background:#e0e0e0;border-radius:2px;margin-top:4px;overflow:hidden;">' +
      '<div style="width:' + hpPercent + '%;height:100%;background:' + hpColor + ';transition:width 0.3s;"></div></div>';
    battleStats.appendChild(hpStat);
    
    var atkStat = makeEl('div', {class:'battle-stat-mini', id:'atk-stat-'+pet.id});
    atkStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">ATK</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_attack || 5) + '</div>';
    battleStats.appendChild(atkStat);
    
    var defStat = makeEl('div', {class:'battle-stat-mini', id:'def-stat-'+pet.id});
    defStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">DEF</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_defense || 3) + '</div>';
    battleStats.appendChild(defStat);
    
    var spdStat = makeEl('div', {class:'battle-stat-mini', id:'spd-stat-'+pet.id});
    spdStat.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPD</div><div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + (pet.base_speed || 4) + '</div>';
    battleStats.appendChild(spdStat);
    
    body.appendChild(battleStats);
    
    // Update stats with equipment bonuses (async)
    updatePetStatsDisplay(pet.id, pet.base_attack || 5, pet.base_defense || 3, pet.base_speed || 4);
  }

  // Equipped Items Display (NEW!)
  var equipSection = makeEl('div', {class:'equipped-items-section'});
  equipSection.style.cssText = 'margin:10px 0;padding:10px;background:rgba(93,222,122,0.1);border:2px solid #5dde7a;border-radius:12px;';
  
  var equipTitle = makeEl('div', {style:'font-weight:bold;color:var(--purple);margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;'});
  equipTitle.innerHTML = '<span>⚔️ Equipment</span>';
  
  var manageBtn = makeEl('button', {class:'btn-sm', style:'font-size:0.7rem;padding:4px 8px;'});
  manageBtn.textContent = 'Manage';
  manageBtn.onclick = function() { showEquipmentModal(pet.id); };
  equipTitle.appendChild(manageBtn);
  
  equipSection.appendChild(equipTitle);
  
  // Show equipped weapon and armor (we'll load this async)
  var equipDisplay = makeEl('div', {id:'equip-display-'+pet.id, style:'font-size:0.85rem;color:var(--text);'});
  equipDisplay.innerHTML = '<div style="opacity:0.6;">Loading equipment...</div>';
  equipSection.appendChild(equipDisplay);
  
  body.appendChild(equipSection);
  
  // Load equipped items for this pet (async)
  loadEquippedItems(pet.id);

  // Warning if neglected
  if (pet.happiness <= 20 || pet.hunger <= 10) {
    body.appendChild(makeEl('div', {class:'sadness-warning'}, moodEmoji + ' Your pet needs attention!'));
  }

  // Stat bars
  var bars = makeEl('div', {class:'stat-bars'});
  bars.appendChild(makeStatRow('hunger', pet.id, pet.hunger, pet.max_hunger, hPct, 'Hunger'));
  bars.appendChild(makeStatRow('happiness', pet.id, pet.happiness, pet.max_happiness, hapPct, 'Happiness'));
  bars.appendChild(makeStatRow('energy', pet.id, pet.energy, pet.max_energy, ePct, 'Energy'));
  var xpRow = makeEl('div', {class:'xp-row'});
  xpRow.appendChild(makeEl('span', {class:'xp-label'}, 'XP'));
  var xpWrap = makeEl('div', {class:'xp-bar-wrap'});
  var xpFill = makeEl('div', {class:'xp-bar-fill', id:'xp-bar-'+pet.id});
  xpFill.style.width = xpPct+'%';
  xpWrap.appendChild(xpFill);
  xpRow.appendChild(xpWrap);
  xpRow.appendChild(makeEl('span', {class:'xp-value', id:'xp-val-'+pet.id}, pet.xp+'/'+xpNext));
  bars.appendChild(xpRow);
  body.appendChild(bars);

  // Action buttons
  var actions = makeEl('div', {class:'pet-actions'});
  
  // FIX 5: Event delegation - add data-pet-id attribute instead of onclick
  var feedBtn = makeEl('button', {class:'btn-action btn-feed', id:'feed-'+pet.id}, pet.hunger<pet.max_hunger?'Feed':'Full!');
  feedBtn.setAttribute('data-pet-id', pet.id);
  if (pet.hunger >= pet.max_hunger) feedBtn.disabled=true;
  
  var playBtn = makeEl('button', {class:'btn-action btn-play', id:'play-'+pet.id}, pet.energy>=10?'Play':'Tired!');
  playBtn.setAttribute('data-pet-id', pet.id);
  if (pet.energy < 10) playBtn.disabled=true;
  
  // REMOVED daily limit - buttons always enabled for item-based feeding/playing
  // Users can feed/play unlimited times using items from inventory
  // The free daily option is still shown in the modal as a bonus
  feedBtn.textContent = 'Feed';
  feedBtn.disabled = false;
  feedBtn.style.opacity = '1';
  
  playBtn.textContent = pet.energy >= 10 ? 'Play' : 'Tired!';
  playBtn.disabled = pet.energy < 10;
  playBtn.style.opacity = pet.energy >= 10 ? '1' : '0.6';
  
  actions.appendChild(feedBtn); actions.appendChild(playBtn);
  
  // COMPANION SELECTOR BUTTON
  var companionBtn = makeEl('button', {class: 'btn-companion'});
  companionBtn.textContent = '🐾 Set as Companion';
  companionBtn.style.cssText = 'margin-top:8px;width:100%;padding:10px;background:linear-gradient(135deg,#9966ff 0%,#ff66cc 100%);color:white;border:none;border-radius:12px;font-weight:600;cursor:pointer;transition:transform 0.2s;';
  companionBtn.onmouseover = function() { this.style.transform = 'scale(1.02)'; };
  companionBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
  companionBtn.onclick = function() {
    CompanionBuddy.setCompanion(pet.id);
  };
  actions.appendChild(companionBtn);
  
  body.appendChild(actions);

  body.appendChild(makeDropdown(pet.id));
  body.appendChild(makeEl('div', {class:'stat-flash', id:'flash-'+pet.id}));
  
  // Add pet title selector dropdown
  var titleSelectorDiv = makeEl('div', {
    id: 'pet-title-selector-' + pet.id, 
    class: 'pet-title-selector-container'
  });
  titleSelectorDiv.innerHTML = renderPetTitleSelector(pet.id);
  body.appendChild(titleSelectorDiv);
  
  card.appendChild(body);
  
  // Apply variant CSS class to card if pet has variant
  if (pet.variant) {
    card.className += ' ' + getPetVariantClass(pet.variant);
  }
  
  return card;
}

function makeStatRow(stat, petId, val, max, pct, label) {
  var row = makeEl('div', {class:'stat-row'});
  row.appendChild(makeEl('span', {class:'stat-label'}, label));
  var wrap = makeEl('div', {class:'stat-bar-wrap'});
  var fill = makeEl('div', {class:'stat-bar-fill '+stat, id:stat+'-bar-'+petId});
  fill.style.width = pct+'%';
  wrap.appendChild(fill);
  row.appendChild(wrap);
  row.appendChild(makeEl('span', {class:'stat-value', id:stat+'-val-'+petId}, val+'/'+max));
  return row;
}

async function loadEquippedItems(petId) {
  // Wait a bit for the DOM to be ready
  setTimeout(async function() {
    var display = el('equip-display-' + petId);
    if (!display) {
      console.error('Equipment display element not found for pet:', petId);
      return;
    }
    
    try {
      // Get equipped items for this pet
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*), equipped_slot')
        .eq('user_id', currentUser.id)
        .eq('is_equipped', true);
      
      console.log('Equipment query result:', equipRes);
      
      if (equipRes.error) {
        console.error('Equipment query error:', equipRes.error);
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">Error loading equipment</div>';
        return;
      }
      
      if (!equipRes.data || equipRes.data.length === 0) {
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">No equipment equipped</div>';
        return;
      }
      
      var weapon = equipRes.data.find(function(e) { return e.equipped_slot === 'weapon'; });
      var armor = equipRes.data.find(function(e) { return e.equipped_slot === 'armor'; });
      
      var html = '<div style="display:flex;gap:10px;flex-wrap:wrap;">';
      
      if (weapon && weapon.equipment) {
        var w = weapon.equipment;
        var bonuses = [];
        if (w.attack_bonus) bonuses.push('+' + w.attack_bonus + ' ATK');
        if (w.defense_bonus) bonuses.push('+' + w.defense_bonus + ' DEF');
        if (w.speed_bonus) bonuses.push('+' + w.speed_bonus + ' SPD');
        if (w.hp_bonus) bonuses.push('+' + w.hp_bonus + ' HP');
        
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.5);border-radius:8px;">';
        html += '<div style="font-weight:bold;color:#ff6b6b;">⚔️ ' + w.name + '</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-light);">' + bonuses.join(', ') + '</div>';
        html += '</div>';
      } else {
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.3);border-radius:8px;opacity:0.6;">';
        html += '<div style="font-size:0.8rem;">⚔️ No weapon</div>';
        html += '</div>';
      }
      
      if (armor && armor.equipment) {
        var a = armor.equipment;
        var bonuses = [];
        if (a.attack_bonus) bonuses.push('+' + a.attack_bonus + ' ATK');
        if (a.defense_bonus) bonuses.push('+' + a.defense_bonus + ' DEF');
        if (a.speed_bonus) bonuses.push('+' + a.speed_bonus + ' SPD');
        if (a.hp_bonus) bonuses.push('+' + a.hp_bonus + ' HP');
        
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.5);border-radius:8px;">';
        html += '<div style="font-weight:bold;color:#5dde7a;">🛡️ ' + a.name + '</div>';
        html += '<div style="font-size:0.75rem;color:var(--text-light);">' + bonuses.join(', ') + '</div>';
        html += '</div>';
      } else {
        html += '<div style="flex:1;min-width:120px;padding:6px;background:rgba(255,255,255,0.3);border-radius:8px;opacity:0.6;">';
        html += '<div style="font-size:0.8rem;">🛡️ No armor</div>';
        html += '</div>';
      }
      
      html += '</div>';
      display.innerHTML = html;
    } catch (error) {
      console.error('Error in loadEquippedItems:', error);
      if (display) {
        display.innerHTML = '<div style="opacity:0.6;font-size:0.8rem;">Error loading equipment</div>';
      }
    }
  }, 100);
}

async function updatePetStatsDisplay(petId, baseAtk, baseDef, baseSpd) {
  // Fetch equipment and update stat display
  setTimeout(async function() {
    try {
      var equipRes = await supabaseClient
        .from('player_equipment')
        .select('equipment(*)')
        .eq('user_id', currentUser.id)
        .eq('is_equipped', true);
      
      if (equipRes.error || !equipRes.data) return;
      
      var totalAtk = baseAtk;
      var totalDef = baseDef;
      var totalSpd = baseSpd;
      
      equipRes.data.forEach(function(item) {
        var equip = item.equipment;
        totalAtk += equip.attack_bonus || 0;
        totalDef += equip.defense_bonus || 0;
        totalSpd += equip.speed_bonus || 0;
      });
      
      // Update the display
      var atkEl = el('atk-stat-' + petId);
      var defEl = el('def-stat-' + petId);
      var spdEl = el('spd-stat-' + petId);
      
      if (atkEl) {
        var atkBonus = totalAtk - baseAtk;
        atkEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">ATK</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalAtk + 
          (atkBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + atkBonus + ')</span>' : '') + '</div>';
      }
      
      if (defEl) {
        var defBonus = totalDef - baseDef;
        defEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">DEF</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalDef + 
          (defBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + defBonus + ')</span>' : '') + '</div>';
      }
      
      if (spdEl) {
        var spdBonus = totalSpd - baseSpd;
        spdEl.innerHTML = '<div style="font-size:0.7rem;color:var(--text-light);text-transform:uppercase;">SPD</div>' +
          '<div style="font-weight:bold;color:var(--purple);font-size:1.1rem;">' + totalSpd + 
          (spdBonus > 0 ? ' <span style="color:#5dde7a;font-size:0.8rem;">(+' + spdBonus + ')</span>' : '') + '</div>';
      }
    } catch (error) {
      console.error('Error updating pet stats display:', error);
    }
  }, 100);
}

// ══════════════════════════════════════════════════════════════════════════
// PET STAT DECAY & REGENERATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════

function calculateEnergyRegen(currentEnergy, maxEnergy, lastPlayedTimestamp) {
  if (!lastPlayedTimestamp) return currentEnergy;
  
  var now = new Date();
  var lastPlayed = new Date(lastPlayedTimestamp);
  var hoursPassed = (now - lastPlayed) / (1000 * 60 * 60);
  
  // Regenerate 5% per hour (base rate)
  var regenRate = 5; // 5% per hour
  
  // Apply event bonus if active
  var eventMultiplier = worldEvents.getActiveBonus('energyRegen');
  regenRate = regenRate * eventMultiplier;
  
  var regenAmount = Math.floor((maxEnergy * (regenRate / 100)) * hoursPassed);
  
  var newEnergy = Math.min(currentEnergy + regenAmount, maxEnergy);
  return newEnergy;
}

function calculateHPRegen(currentHP, maxHP, lastBattleTimestamp) {
  if (!lastBattleTimestamp) return currentHP;
  
  var now = new Date();
  var lastBattle = new Date(lastBattleTimestamp);
  var hoursPassed = (now - lastBattle) / (1000 * 60 * 60);
  
  // Regenerate 3 HP per hour while resting
  var regenRate = 3; // HP per hour
  var regenAmount = Math.floor(regenRate * hoursPassed);
  
  var newHP = Math.min(currentHP + regenAmount, maxHP);
  return newHP;
}

function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger;
  
  var now = new Date();
  var lastFed = new Date(lastFedTimestamp);
  var hoursPassed = (now - lastFed) / (1000 * 60 * 60);
  
  // Hunger decreases 2.5 points per hour (60 points per day)
  var decayRate = 2.5; // points per hour
  var decayAmount = Math.floor(decayRate * hoursPassed);
  
  var newHunger = Math.max(currentHunger - decayAmount, 0);
  return newHunger;
}

function calculateHappinessDecay(currentHappiness, lastFedTimestamp, lastPlayedTimestamp) {
  if (!lastFedTimestamp && !lastPlayedTimestamp) return currentHappiness;
  
  var now = new Date();
  
  // Use the most recent interaction timestamp
  var lastInteraction = lastFedTimestamp;
  if (lastPlayedTimestamp) {
    var fedTime = new Date(lastFedTimestamp || 0);
    var playedTime = new Date(lastPlayedTimestamp);
    lastInteraction = playedTime > fedTime ? lastPlayedTimestamp : lastFedTimestamp;
  }
  
  var lastTime = new Date(lastInteraction);
  var hoursPassed = (now - lastTime) / (1000 * 60 * 60);
  
  // Happiness decreases 2 points per hour (48 points per day)
  var decayRate = 2; // points per hour
  var decayAmount = Math.floor(decayRate * hoursPassed);
  
  var newHappiness = Math.max(currentHappiness - decayAmount, 0);
  return newHappiness;
}

function getPetMood(hunger, energy, happiness, maxHunger, maxEnergy, maxHappiness) {
  // Calculate percentages
  var hungerPercent = (hunger / maxHunger) * 100;
  var energyPercent = (energy / maxEnergy) * 100;
  var happinessPercent = (happiness / maxHappiness) * 100;
  
  // Average overall wellness
  var overall = (hungerPercent + energyPercent + happinessPercent) / 3;
  
  if (overall >= 90) return { mood: 'Ecstatic', emoji: '😍', color: '#5dde7a' };
  if (overall >= 75) return { mood: 'Happy', emoji: '😊', color: '#8de6a1' };
  if (overall >= 60) return { mood: 'Content', emoji: '🙂', color: '#ffdd00' };
  if (overall >= 40) return { mood: 'Okay', emoji: '😐', color: '#ff9f43' };
  if (overall >= 25) return { mood: 'Unhappy', emoji: '😟', color: '#ff9933' };
  if (overall >= 10) return { mood: 'Sad', emoji: '😢', color: '#ff6b6b' };
  return { mood: 'Miserable', emoji: '😭', color: '#ff3838' };
}

// ══════════════════════════════════════════════════════════════════════════
// PET ACTIONS (Feed, Play)
// ══════════════════════════════════════════════════════════════════════════

function calculateLevelUp(newXp, currentLevel, currentMaxHunger, currentMaxEnergy, currentMaxHappiness, currentHP, currentAtk, currentDef, currentSpd) {
  var xpNeeded = currentLevel * 120; // Increased from 100 to 120 for slower leveling
  
  if (newXp >= xpNeeded) {
    // Level up! Calculate stat increases
    var statIncreases = {
      hp: 6, // Always get +6 HP minimum (doubled from +3 for longer battles)
      atk: 0,
      def: 0,
      spd: 0
    };
    
    // Pick ONE random stat to increase by +1 (guaranteed)
    var stats = ['atk', 'def', 'spd'];
    var primaryStat = stats[Math.floor(Math.random() * stats.length)];
    statIncreases[primaryStat] = 1;
    
    // 40% chance for a second +1 to a DIFFERENT stat
    if (Math.random() < 0.4) {
      var remainingStats = stats.filter(function(s) { return s !== primaryStat; });
      var secondaryStat = remainingStats[Math.floor(Math.random() * remainingStats.length)];
      statIncreases[secondaryStat] = 1;
    }
    
    return {
      xp: newXp - xpNeeded, // Carry over excess XP
      level: currentLevel + 1,
      maxHunger: currentMaxHunger + 5,
      maxEnergy: currentMaxEnergy + 5,
      maxHappiness: currentMaxHappiness + 5,
      // Combat stat increases
      base_hp: currentHP + statIncreases.hp,
      base_attack: currentAtk + statIncreases.atk,
      base_defense: currentDef + statIncreases.def,
      base_speed: currentSpd + statIncreases.spd,
      statIncreases: statIncreases, // Return what increased for display
      leveled: true
    };
  } else {
    // No level up
    return {
      xp: newXp,
      level: currentLevel,
      maxHunger: currentMaxHunger,
      maxEnergy: currentMaxEnergy,
      maxHappiness: currentMaxHappiness,
      leveled: false
    };
  }
}

async function feed(petId) {
  // Rate limiting
  if (!canPerformAction('feed_' + petId, 500)) {
    return; // Silently reject if too fast
  }
  
  var pet = petState[petId]; 
  if (!pet) return;
  
  // REMOVED: Daily limit check - free option always available
  // var today = new Date().toISOString().split('T')[0];
  // var alreadyFedToday = localStorage.getItem('feed_' + petId + '_' + today) === 'done';
  
  // Get user's food inventory
  var { data: inventory, error: invError } = await supabaseClient
    .from('user_inventory')
    .select('item_id, quantity, items(id, name, hunger_effect, happiness_effect, xp_effect, image_url, food_category)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);
  
  if (invError) {
    showToast('Error loading inventory', 3000);
    return;
  }
  
  // Filter to food items (items with hunger_effect > 0 or food_category)
  var foodItems = inventory ? inventory.filter(function(inv) {
    return inv.items && (
      (inv.items.hunger_effect && inv.items.hunger_effect > 0) ||
      inv.items.food_category ||
      inv.items.name.toLowerCase().includes('food') ||
      inv.items.name.toLowerCase().includes('ramen') ||
      inv.items.name.toLowerCase().includes('cake') ||
      inv.items.name.toLowerCase().includes('steak') ||
      inv.items.name.toLowerCase().includes('burger') ||
      inv.items.name.toLowerCase().includes('pie') ||
      inv.items.name.toLowerCase().includes('cookie') ||
      inv.items.name.toLowerCase().includes('juice') ||
      inv.items.name.toLowerCase().includes('smoothie')
    );
  }) : [];
  
  // Show picker modal with free option + food items
  var modal = makeModal();
  modal.innerHTML = '<h2 style="text-align:center;margin-bottom:20px;">🍽️ Feed Your Pet</h2>';
  
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;max-height:400px;overflow-y:auto;';
  
  // FREE DAILY OPTION (Check if already used today)
  var today = new Date().toISOString().split('T')[0];
  var freeFeedKey = 'free_feed_' + petId + '_' + today;
  var freeUsed = localStorage.getItem(freeFeedKey) === 'done';
  
  var freeBtn = document.createElement('button');
  freeBtn.style.cssText = freeUsed ?
    'padding:15px;border:3px solid #ccc;background:#f0f0f0;border-radius:12px;cursor:not-allowed;opacity:0.6;' :
    'padding:15px;border:3px solid #5dde7a;background:linear-gradient(135deg, #5dde7a 0%, #4caf50 100%);border-radius:12px;cursor:pointer;transition:transform 0.2s;';
  
  freeBtn.innerHTML = freeUsed ?
    '<div style="font-size:2rem;">✅</div>' +
    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Daily Treat</div>' +
    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Used Today!</div>' :
    '<div style="font-size:2rem;">✨</div>' +
    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#fff;">Free Daily Treat</div>' +
    '<div style="font-size:0.75rem;color:#fff;margin-top:3px;">+30 Hunger +10 XP</div>';
  
  if (!freeUsed) {
    freeBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    freeBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    freeBtn.onclick = function() {
      closeModal();
      feedFree(petId);
    };
  }
  
  grid.appendChild(freeBtn);
  
  // FOOD ITEMS FROM INVENTORY
  foodItems.forEach(function(inv) {
    var item = inv.items;
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:15px;border:3px solid #9966ff;background:white;border-radius:12px;cursor:pointer;transition:transform 0.2s;';
    
    // Try to show image or fallback to emoji
    var iconHtml = '🍕';
    if (item.image_url) {
      iconHtml = '<img src="' + item.image_url + '" style="width:48px;height:48px;object-fit:contain;" onerror="this.outerHTML=\'🍕\';">';
    }
    
    btn.innerHTML = '<div style="font-size:2rem;">' + iconHtml + '</div>' +
                    '<div style="font-size:0.8rem;font-weight:600;margin-top:5px;">' + item.name + '</div>' +
                    '<div style="font-size:0.7rem;color:#666;">x' + inv.quantity + '</div>';
    
    btn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    btn.onclick = function() {
      closeModal();
      feedWithItem(petId, item.id, item.name);
    };
    
    grid.appendChild(btn);
  });
  
  modal.appendChild(grid);
  
  // Show helpful message if no food items
  if (foodItems.length === 0) {
    var noItemsMsg = document.createElement('div');
    noItemsMsg.style.cssText = 'text-align:center;padding:20px;color:#666;font-size:0.9rem;';
    noItemsMsg.textContent = '💡 No food items in inventory. Buy some from the shop or use the free daily treat!';
    modal.appendChild(noItemsMsg);
  }
  
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:20px;padding:10px 20px;background:#ccc;border:none;border-radius:8px;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';
  cancelBtn.onclick = closeModal;
  modal.appendChild(cancelBtn);
  
  openModal(modal);
}

// FREE DAILY FEED - Called when clicking free option
async function feedFree(petId) {
  var pet = petState[petId];
  if (!pet) return;
  
  // FREE OPTION - Check daily limit
  var today = new Date().toISOString().split('T')[0];
  var freeFeedKey = 'free_feed_' + petId + '_' + today;
  
  if (localStorage.getItem(freeFeedKey) === 'done') {
    showFlash(petId, 'Free daily treat already used today!', '#ff9f43');
    return;
  }
  
  var btn = el('feed-'+petId); 
  if (btn) {
    btn.disabled = true; 
    btn.textContent = '...';
  }
  
  // Call RPC with null item_id for free feed
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: null
  });
  
  if (error) {
    console.error('Feed RPC error:', error);
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    if (btn) {
      btn.disabled = false; 
      btn.textContent = 'Feed';
    }
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Feed error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Feed';
    }
    return;
  }
  
  // JSONB response - direct object (not array)
  var feedResult = result;
  
  // MARK FREE OPTION AS USED FOR TODAY (after successful feed)
  localStorage.setItem(freeFeedKey, 'done');
  
  // PAWKETPASS: Update bingo progress for feeding
  updateBingoProgress('feed_pet', 1);
  await addPassXP(2, 'feed');
  
  // COMMUNITY GOALS: Track feeding
  community_increment('feed_pets_week1', 1);
  
  // Update local state
  petState[petId].hunger = feedResult.hunger;
  petState[petId].happiness = feedResult.happiness;
  petState[petId].xp = feedResult.xp;
  
  updateBar(petId, 'hunger', feedResult.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', feedResult.happiness, pet.max_happiness);
  updateXpBar(petId, feedResult.xp, pet.level);
  
  if (feedResult.leveled_up) {
    petState[petId].level = feedResult.new_level;
    showFlash(petId, 'Level ' + feedResult.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, feedResult.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
    
    if (feedResult.new_level === 5) await awardBadge('level_5');
    if (feedResult.new_level === 10) await awardBadge('level_10');
    if (feedResult.new_level === 20) await awardBadge('level_20');
  } else {
    showFlash(petId, '✨ +' + feedResult.hunger_gained + ' Hunger +' + feedResult.xp_gained + ' XP', '#5dde7a');
  }
  
  // Re-enable button for next use
  if (btn) {
    btn.textContent = 'Feed';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

// FEED WITH SPECIFIC FOOD ITEM - Called when clicking a food item
async function feedWithItem(petId, itemId, itemName) {
  var pet = petState[petId];
  if (!pet) return;
  
  // Call RPC with the item_id
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: itemId
  });
  
  if (error) {
    console.error('Feed with item error:', error);
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Feed error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    return;
  }
  
  // JSONB response - direct object (not array)
  var feedResult = result;
  
  // PAWKETPASS: Update bingo and Pass XP
  updateBingoProgress('feed_pet', 1);
  await addPassXP(2, 'feed');
  
  // COMMUNITY GOALS: Track feeding
  community_increment('feed_pets_week1', 1);
  
  // Check if using treat for bingo and community
  if (itemId === 'treat' || itemId === 'premium_treat') {
    updateBingoProgress('use_treat', 1);
    community_increment('use_treats_week1', 1);
  }
  
  // Update local state
  petState[petId].hunger = feedResult.hunger;
  petState[petId].happiness = feedResult.happiness;
  petState[petId].xp = feedResult.xp;
  
  updateBar(petId, 'hunger', feedResult.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', feedResult.happiness, pet.max_happiness);
  updateXpBar(petId, feedResult.xp, pet.level);
  
  if (feedResult.leveled_up) {
    petState[petId].level = feedResult.new_level;
    showFlash(petId, 'Level ' + feedResult.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, feedResult.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  }
  
  // Show reaction based on food preference
  var reactionType = feedResult.reaction_type || 'normal';
  var reactionMsg = '';
  
  if (reactionType === 'loved') {
    reactionMsg = '💖 ' + itemName + '! (1.75x bonus!)';
    // SCRAPBOOK: Favorite food discovered
    scrapbook_addMemory(petId, 'favorite_food', { food: itemName });
  } else if (reactionType === 'liked') {
    reactionMsg = '😊 ' + itemName + '! (1.25x bonus)';
  } else if (reactionType === 'disliked') {
    reactionMsg = '😐 ' + itemName + '... (0.75x effect)';
  } else if (reactionType === 'hated') {
    reactionMsg = '😖 Ew, ' + itemName + '! (0.5x effect)';
  } else {
    reactionMsg = '🍽️ Ate ' + itemName + '!';
  }
  
  if (feedResult.hunger_gained || feedResult.happiness_gained || feedResult.xp_gained) {
    var effects = [];
    if (feedResult.hunger_gained) effects.push('+' + feedResult.hunger_gained + ' Hunger');
    if (feedResult.happiness_gained) effects.push('+' + feedResult.happiness_gained + ' Happiness');
    if (feedResult.xp_gained) effects.push('+' + feedResult.xp_gained + ' XP');
    reactionMsg += ' ' + effects.join(', ');
  }
  
  showFlash(petId, reactionMsg, reactionType === 'loved' ? '#ff66cc' : reactionType === 'hated' ? '#999' : '#5dde7a');
  
  // Reload inventory and pets to reflect item usage
  tabsLoaded['mypets'] = false;
  loadInventory();
}

// FREE DAILY FEED
async function feedFree(petId) {
  var pet = petState[petId];
  if (!pet) return;
  
  var today = new Date().toISOString().split('T')[0];
  
  // Call RPC with null item_id for free feed
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: null
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Mark as used today
  localStorage.setItem('feed_' + petId + '_' + today, 'done');
  
  // Update local state
  petState[petId].hunger = result.hunger;
  petState[petId].xp = result.xp;
  
  updateBar(petId, 'hunger', result.hunger, pet.max_hunger);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  } else {
    showFlash(petId, '✨ +30 Hunger +10 XP', '#5dde7a');
  }
}

// SEPARATE FUNCTION: Feed with specific item (called from dropdown menu)
async function showFeedItemPicker(petId) {
  // Just call the main feed function - it now handles both!
  feed(petId);
}

async function feedWithItem(petId, itemId, itemName) {
  var pet = petState[petId];
  if (!pet) return;
  
  // Call secure database function with item_id
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: itemId
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Update local state
  petState[petId].hunger = result.hunger;
  petState[petId].happiness = result.happiness;
  petState[petId].xp = result.xp;
  
  updateBar(petId, 'hunger', result.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  }
  
  // Check for food preference reactions
  var reactionType = result.reaction_type || 'normal';
  var reactionMsg = '';
  
  if (reactionType === 'loved') {
    reactionMsg = '💖 ' + itemName + '! (1.75x bonus!)';
  } else if (reactionType === 'liked') {
    reactionMsg = '😊 ' + itemName + '! (1.25x bonus)';
  } else if (reactionType === 'disliked') {
    reactionMsg = '😐 ' + itemName + '... (0.75x effect)';
  } else if (reactionType === 'hated') {
    reactionMsg = '😖 Ew, ' + itemName + '! (0.5x effect)';
  } else {
    reactionMsg = '🍽️ Ate ' + itemName + '!';
  }
  
  if (result.hunger_gained || result.happiness_gained || result.xp_gained) {
    var effects = [];
    if (result.hunger_gained) effects.push('+' + result.hunger_gained + ' Hunger');
    if (result.happiness_gained) effects.push('+' + result.happiness_gained + ' Happiness');
    if (result.xp_gained) effects.push('+' + result.xp_gained + ' XP');
    reactionMsg += '\n' + effects.join(', ');
  }
  
  showFlash(petId, reactionMsg, reactionType === 'loved' ? '#ff66cc' : reactionType === 'hated' ? '#999' : '#5dde7a');
  
  // 🐾 COMPANION REACTION - Feeding!
  if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.currentCompanionId) {
    setTimeout(function() {
      var feedMessages = {
        loved: ["They LOVE it! 💖", "Best food ever! ✨"],
        liked: ["Yummy! 😋", "Tasty treat! 🍕"],
        disliked: ["Hmm, not their favorite... 😐"],
        hated: ["Ew, they hate that! 😖"],
        normal: ["Nom nom! 🍪", "Snack time! 🍕"]
      };
      var msgPool = feedMessages[reactionType] || feedMessages.normal;
      CompanionBuddy.showMessage(msgPool[Math.floor(Math.random() * msgPool.length)]);
    }, 1000);
  }
}

async function feedWithItem(petId, itemId, itemName) {
  var pet = petState[petId];
  if (!pet) return;
  
  var btn = el('feed-'+petId); 
  if (btn) {
    btn.disabled = true; 
    btn.textContent = '...';
  }
  
  // Call secure database function with item_id
  var { data: result, error } = await supabaseClient.rpc('feed_pet_secure', {
    p_pet_id: petId,
    p_item_id: itemId
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    if (btn) {
      btn.disabled = false; 
      btn.textContent = 'Feed';
    }
    return;
  }
  
  // Mark as used today
  var today = new Date().toISOString().split('T')[0];
  localStorage.setItem('feed_' + petId + '_' + today, 'done');
  
  // Update local state
  petState[petId].hunger = result.hunger;
  petState[petId].happiness = result.happiness;
  petState[petId].xp = result.xp;
  
  updateBar(petId, 'hunger', result.hunger, pet.max_hunger);
  updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '!', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
    
    if (result.new_level === 5) await awardBadge('level_5');
    if (result.new_level === 10) await awardBadge('level_10');
    if (result.new_level === 20) await awardBadge('level_20');
  }
  
  // FOOD REACTION SYSTEM - Check pet preferences
  var petType = pet.pet_type || pet.petType;
  var prefs = getPetPreferences(petType);
  
  if (prefs) {
    var reactionType = 'normal';
    var reactionMsg = pet.nickname + ' ate ' + itemName + '!';
    
    if (itemName === prefs.loved_item) {
      reactionType = 'loved';
      reactionMsg = '💖 ' + pet.nickname + "'s eyes light up! This is their FAVORITE!";
      logJournalDiscovery(petType, 'loved', itemName);
    } else if (itemName === prefs.liked_item) {
      reactionType = 'liked';
      reactionMsg = '😊 ' + pet.nickname + ' really enjoys this!';
      logJournalDiscovery(petType, 'liked', itemName);
    } else if (itemName === prefs.disliked_item) {
      reactionType = 'disliked';
      reactionMsg = '😐 ' + pet.nickname + ' eats it reluctantly...';
      logJournalDiscovery(petType, 'disliked', itemName);
    } else if (itemName === prefs.hated_item) {
      reactionType = 'hated';
      reactionMsg = '😠 ' + pet.nickname + ' picks at it with disgust!';
      logJournalDiscovery(petType, 'hated', itemName);
    }
    
    showFlash(petId, reactionMsg, reactionType === 'loved' ? '#ff66cc' : reactionType === 'hated' ? '#999' : '#5dde7a');
    
    // 🐾 COMPANION REACTION - Feeding!
    if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.currentCompanionId) {
      setTimeout(function() {
        var feedMessages = {
          loved: ["They LOVE it! 💖", "Best food ever! ✨"],
          liked: ["Yummy! 😋", "Tasty treat! 🍕"],
          disliked: ["Hmm, not their favorite... 😐"],
          hated: ["Ew, they hate that! 😖"],
          normal: ["Nom nom! 🍪", "Snack time! 🍕"]
        };
        var msgPool = feedMessages[reactionType] || feedMessages.normal;
        CompanionBuddy.showMessage(msgPool[Math.floor(Math.random() * msgPool.length)]);
      }, 1000);
    }
  } else {
    showFlash(petId, '+20 Hunger +5 Happiness +10 XP', '#5dde7a');
  }
  
  if (btn) {
    btn.textContent = 'Fed Today!';
    btn.disabled = true;
    btn.style.opacity = '0.6';
  }
}

async function play(petId) {
  // Rate limiting
  if (!canPerformAction('play_' + petId, 500)) {
    return; // Silently reject if too fast
  }
  
  var pet = petState[petId]; 
  if (!pet) return;
  
  // REMOVED: Daily limit check - free option always available
  // var today = new Date().toISOString().split('T')[0];
  // var alreadyPlayedToday = localStorage.getItem('play_' + petId + '_' + today) === 'done';
  
  // Get user's toy inventory
  var { data: inventory, error: invError } = await supabaseClient
    .from('user_inventory')
    .select('item_id, quantity, items(id, name, item_type, image_url)')
    .eq('user_id', currentUser.id)
    .gt('quantity', 0);
  
  if (invError) {
    showToast('Error loading inventory', 3000);
    return;
  }
  
  // Filter to toy/fun items
  var toyItems = inventory ? inventory.filter(function(inv) {
    return inv.items && inv.items.item_type && 
           (inv.items.item_type.toLowerCase() === 'toy' ||
            inv.items.item_type.toLowerCase() === 'fun' ||
            inv.items.name.toLowerCase().includes('toy') ||
            inv.items.name.toLowerCase().includes('ball') ||
            inv.items.name.toLowerCase().includes('frisbee') ||
            inv.items.name.toLowerCase().includes('game'));
  }) : [];
  
  // Show picker modal with free option + toy items
  var modal = makeModal();
  modal.innerHTML = '<h2 style="text-align:center;margin-bottom:20px;">🎮 Play With Your Pet</h2>';
  
  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;max-height:400px;overflow-y:auto;';
  
  // FREE DAILY OPTION (Check if already used today AND has energy)
  var today = new Date().toISOString().split('T')[0];
  var freePlayKey = 'free_play_' + petId + '_' + today;
  var freeUsed = localStorage.getItem(freePlayKey) === 'done';
  var hasEnergy = pet.energy >= 10;
  
  var freeBtn = document.createElement('button');
  
  // Determine button style based on status
  if (freeUsed) {
    // Already used today
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ccc;background:#f0f0f0;border-radius:12px;cursor:not-allowed;opacity:0.6;';
  } else if (!hasEnergy) {
    // Not enough energy
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ccc;background:#f5f5f5;border-radius:12px;cursor:not-allowed;opacity:0.6;';
  } else {
    // Available!
    freeBtn.style.cssText = 'padding:15px;border:3px solid #ff9f43;background:linear-gradient(135deg, #ff9f43 0%, #ffa726 100%);border-radius:12px;cursor:pointer;transition:transform 0.2s;';
  }
  
  // Set button content
  if (freeUsed) {
    freeBtn.innerHTML = '<div style="font-size:2rem;">✅</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Used Today!</div>';
  } else if (!hasEnergy) {
    freeBtn.innerHTML = '<div style="font-size:2rem;">🎾</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#999;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#999;margin-top:3px;">Need 10 Energy</div>';
  } else {
    freeBtn.innerHTML = '<div style="font-size:2rem;">🎾</div>' +
                    '<div style="font-size:0.9rem;font-weight:700;margin-top:5px;color:#fff;">Free Playtime</div>' +
                    '<div style="font-size:0.75rem;color:#fff;margin-top:3px;">+15 Happiness +15 XP</div>';
  }
  
  // Only enable if not used and has energy
  if (!freeUsed && hasEnergy) {
    freeBtn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    freeBtn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    freeBtn.onclick = function() {
      closeModal();
      playFree(petId);
    };
  }
  
  grid.appendChild(freeBtn);
  
  // TOY ITEMS FROM INVENTORY
  toyItems.forEach(function(inv) {
    var item = inv.items;
    var btn = document.createElement('button');
    btn.style.cssText = 'padding:15px;border:3px solid #9966ff;background:white;border-radius:12px;cursor:pointer;transition:transform 0.2s;';
    
    // Try to show image or fallback to emoji
    var iconHtml = '🎮';
    if (item.image_url) {
      iconHtml = '<img src="' + item.image_url + '" style="width:48px;height:48px;object-fit:contain;" onerror="this.outerHTML=\'🎮\';">';
    }
    
    btn.innerHTML = '<div style="font-size:2rem;">' + iconHtml + '</div>' +
                    '<div style="font-size:0.8rem;font-weight:600;margin-top:5px;">' + item.name + '</div>' +
                    '<div style="font-size:0.7rem;color:#666;">x' + inv.quantity + '</div>';
    
    btn.onmouseover = function() { this.style.transform = 'scale(1.05)'; };
    btn.onmouseout = function() { this.style.transform = 'scale(1)'; };
    
    btn.onclick = function() {
      closeModal();
      playWithToy(petId, item.id, item.name);
    };
    
    grid.appendChild(btn);
  });
  
  modal.appendChild(grid);
  
  // Show helpful message if no toy items
  if (toyItems.length === 0) {
    var noItemsMsg = document.createElement('div');
    noItemsMsg.style.cssText = 'text-align:center;padding:20px;color:#666;font-size:0.9rem;';
    noItemsMsg.textContent = '💡 No toys in inventory. Buy some from the shop or use free playtime!';
    modal.appendChild(noItemsMsg);
  }
  
  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'margin-top:20px;padding:10px 20px;background:#ccc;border:none;border-radius:8px;cursor:pointer;display:block;margin-left:auto;margin-right:auto;';
  cancelBtn.onclick = closeModal;
  modal.appendChild(cancelBtn);
  
  openModal(modal);
}

// FREE DAILY PLAY
async function playFree(petId) {
  var pet = petState[petId];
  if (!pet || pet.energy < 10) return;
  
  // FREE OPTION - Check daily limit
  var today = new Date().toISOString().split('T')[0];
  var freePlayKey = 'free_play_' + petId + '_' + today;
  
  if (localStorage.getItem(freePlayKey) === 'done') {
    showFlash(petId, 'Free playtime already used today!', '#ff9f43');
    return;
  }
  
  // Call RPC for free play
  var { data: result, error } = await supabaseClient.rpc('play_with_pet_secure', {
    p_pet_id: petId
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Play error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    return;
  }
  
  // MARK FREE OPTION AS USED FOR TODAY (after successful play)
  localStorage.setItem(freePlayKey, 'done');
  
  // PAWKETPASS: Update bingo and Pass XP
  updateBingoProgress('play_pet', 1);
  await addPassXP(2, 'play');
  
  // Update local state (JSONB returns direct object)
  petState[petId].energy = result.energy;
  petState[petId].happiness = result.happiness;
  petState[petId].xp = result.xp;
  
  updateBar(petId, 'energy', result.energy, pet.max_energy);
  updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
    
    if (result.new_level === 5) await awardBadge('level_5');
    if (result.new_level === 10) await awardBadge('level_10');
    if (result.new_level === 20) await awardBadge('level_20');
  } else {
    showFlash(petId, '🎾 -10 Energy +15 Happiness +15 XP', '#5dde7a');
  }
}

// PLAY WITH TOY ITEM
async function playWithToy(petId, toyId, toyName) {
  var pet = petState[petId];
  if (!pet || pet.energy < 5) {
    showFlash(petId, 'Not enough energy!', '#ff6eb4');
    return;
  }
  
  // Call RPC to play with toy (if you have a function for it)
  // For now, use the same play function
  var { data: result, error } = await supabaseClient.rpc('play_with_pet_secure', {
    p_pet_id: petId
  });
  
  if (error) {
    showFlash(petId, 'Error: ' + error.message, '#ff6eb4');
    return;
  }
  
  // Check for error in response
  if (result && result.error) {
    console.error('Play with toy error:', result.error);
    showFlash(petId, result.error, '#ff6eb4');
    return;
  }
  
  // Update local state (JSONB returns direct object)
  petState[petId].energy = result.energy;
  petState[petId].happiness = result.happiness;
  petState[petId].xp = result.xp;
  
  // PAWKETPASS: Update bingo and Pass XP
  updateBingoProgress('play_pet', 1);
  updateBingoProgress('use_toy', 1);
  await addPassXP(2, 'play');
  
  updateBar(petId, 'energy', result.energy, pet.max_energy);
  updateBar(petId, 'happiness', result.happiness, pet.max_happiness);
  updateXpBar(petId, result.xp, pet.level);
  
  if (result.leveled_up) {
    petState[petId].level = result.new_level;
    showFlash(petId, 'Level ' + result.new_level + '! 🎉', '#b06aff');
    updateLvl(petId, result.new_level, pet.max_hunger);
    tabsLoaded['mypets'] = false;
  } else {
    showFlash(petId, '🎮 Played with ' + toyName + '! +20 Happiness +10 XP', '#5dde7a');
  }
}

function updateBar(petId,stat,val,max) {
  var pct=Math.round(val/max*100);
  var b=el(stat+'-bar-'+petId); if(b)b.style.width=pct+'%';
  var v=el(stat+'-val-'+petId); if(v)v.textContent=val+'/'+max;
}
function updateXpBar(petId,xp,level) {
  var next=level*120; var pct=Math.min(xp/next*100,100);
  var b=el('xp-bar-'+petId); if(b)b.style.width=pct+'%';
  var v=el('xp-val-'+petId); if(v)v.textContent=xp+'/'+next;
}
function updateLvl(petId,level,maxH) {
  var e=el('lvl-'+petId); if(e)e.textContent='Lv. '+level+' | Max: '+maxH;
}
function showFlash(petId,msg,color) {
  var e=el('flash-'+petId); if(!e)return;
  e.textContent=msg; e.style.color=color||'var(--green)'; e.style.opacity='1';
  setTimeout(function(){e.style.opacity='0';},2800);
}

// ── SHOP TAB ─────────────────────────────
function showShopTab(tab) {
  // Update tab buttons
  el('shop-tab-btn').classList.remove('active');
  el('equip-tab-btn').classList.remove('active');
  el('inv-tab-btn').classList.remove('active');
  
  // Hide all panels
  el('shop-items-panel').style.display = 'none';
  el('shop-equipment-panel').style.display = 'none';
  el('shop-inv-panel').style.display = 'none';
  
  if (tab === 'items') {
    el('shop-tab-btn').classList.add('active');
    el('shop-items-panel').style.display = 'block';
  } else if (tab === 'equipment') {
    el('equip-tab-btn').classList.add('active');
    el('shop-equipment-panel').style.display = 'block';
    loadEquipmentShop();
  } else if (tab === 'inventory') {
    el('inv-tab-btn').classList.add('active');
    el('shop-inv-panel').style.display = 'block';
  }
}

function itemEmoji(type) { 
  return {
    food:'🍖',      // Meat
    toy:'🧸',       // Teddy bear
    potion:'⚡',    // Lightning/energy
    special:'✨',   // Sparkles
    drink:'🥤',     // Cup with straw
    pillow:'🛏️',   // Bed/pillow
    snack:'🍪'      // Cookie/treat
  }[type]||'🎁';     // Gift box default
}

// ══════════════════════════════════════════════════════════════════════════
// FOOD ROTATION SYSTEM - Weekly rotating food categories
// ══════════════════════════════════════════════════════════════════════════

var foodCategoryData = {
  spicy: { name: 'Spicy', icon: '🌶️', color: '#ff4444' },
  sweet: { name: 'Sweet', icon: '🍰', color: '#ff66cc' },
  savory: { name: 'Savory', icon: '🍖', color: '#8B4513' },
  fish: { name: 'Fish', icon: '🐟', color: '#4488ff' },
  fruit: { name: 'Fruit', icon: '🍎', color: '#ff6666' },
  basic: { name: 'Basic', icon: '🍞', color: '#d4a76a' }
};

// 3-week rotation (like equipment)
function getFoodRotation() {
  var weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  var weekInCycle = weeksSinceEpoch % 3;
  
  var rotations = [
    ['spicy', 'savory'],    // Week A: Hearty foods
    ['sweet', 'fruit'],     // Week B: Treats
    ['fish', 'basic']       // Week C: Essentials
  ];
  
  return rotations[weekInCycle];
}

function isFoodFeatured(foodCategory) {
  if (!foodCategory) return false;
  var featured = getFoodRotation();
  return featured.includes(foodCategory);
}

function getFoodCategoryLabel(category) {
  if (!category) return '';
  var data = foodCategoryData[category];
  if (!data) return '';
  return data.icon + ' ' + data.name;
}

// Get current rotation week (A, B, or C)
function getCurrentRotationWeek() {
  var weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
  var weekInCycle = weeksSinceEpoch % 3;
  return ['A', 'B', 'C'][weekInCycle];
}


async function loadShop() {
  var grid = el('shop-grid');
  
  // PAWKETPASS: Mark shop visit for bingo
  updateBingoProgress('visit_shop', 1);
  
  // Exclude boss drops from shop! Boss items can only be obtained by defeating bosses
  var res = await supabaseClient
    .from('items')
    .select('*')
    .or('is_boss_drop.is.null,is_boss_drop.eq.false')
    .order('price', {ascending: true});
  
  if (res.error||!res.data||!res.data.length) { 
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">No items yet!</div>'; 
    return; 
  }
  
  // Dedupe items
  var seen={}, deduped=[];
  res.data.forEach(function(item){ var k=item.name.toLowerCase().trim(); if(!seen[k]||item.price<seen[k].price)seen[k]=item; });
  Object.values(seen).forEach(function(i){deduped.push(i);});
  
  // Categorize items
  var categories = {
    food: [],
    toys: [],
    energy: [],
    healing: [],
    equipment: [],
    other: []
  };
  
  var currentWeek = getCurrentRotationWeek();
  
  deduped.forEach(function(item) {
    // Categorize based on primary effect
    if (item.effect === 'healing' || item.name.toLowerCase().includes('heal') || item.name.toLowerCase().includes('ointment') || item.name.toLowerCase().includes('potion')) {
      categories.healing.push(item);
    } else if (item.item_type === 'equipment') {
      categories.equipment.push(item);
    } else if (item.energy_effect > 0 && (item.hunger_effect === 0 || item.energy_effect > item.hunger_effect)) {
      categories.energy.push(item);
    } else if (item.happiness_effect > 0 && (item.hunger_effect === 0 || item.happiness_effect > item.hunger_effect)) {
      categories.toys.push(item);
    } else if (item.hunger_effect > 0) {
      // FOOD ROTATION FILTER: Only show food for current week
      if (!item.rotation_week || item.rotation_week === currentWeek) {
        categories.food.push(item);
      }
    } else {
      categories.other.push(item);
    }
  });
  
  // Sort each category by price
  Object.keys(categories).forEach(function(cat) {
    categories[cat].sort(function(a,b){return a.price-b.price;});
  });
  
  grid.innerHTML='';
  
  // Render categories with headers
  var categoryConfig = [
    { key: 'food', title: '🍕 Food', desc: 'Keep your pet well-fed and happy!' },
    { key: 'toys', title: '🎾 Toys', desc: 'Fun items to boost happiness!' },
    { key: 'energy', title: '⚡ Energy', desc: 'Restore energy for more activities!' },
    { key: 'healing', title: '💚 Healing', desc: 'Restore HP after battles!' },
    { key: 'equipment', title: '⚔️ Equipment', desc: 'Battle gear to make your pet stronger!' }
  ];
  
  categoryConfig.forEach(function(config) {
    var items = categories[config.key];
    if (items.length === 0) return; // Skip empty categories
    
    // Category header
    var header = makeEl('div', {class: 'shop-category-header'});
    header.style.cssText = 'grid-column: 1 / -1; padding: 20px 10px 10px; border-bottom: 3px solid var(--purple-light); margin-bottom: 10px;';
    
    var title = makeEl('div', {style: 'font-size: 1.4rem; font-weight: bold; color: var(--purple); margin-bottom: 5px;'});
    title.textContent = config.title;
    
    var desc = makeEl('div', {style: 'font-size: 0.9rem; color: var(--text-light);'});
    desc.textContent = config.desc;
    
    header.appendChild(title);
    header.appendChild(desc);
    grid.appendChild(header);
    
    // OPTIMIZATION 1: Use DocumentFragment for batch append
    var fragment = document.createDocumentFragment();
    
    // Render items in this category
    items.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};iconDiv.appendChild(img);}
      else iconDiv.innerHTML=itemEmoji(item.item_type);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      
      // FOOD CATEGORY LABEL (for food items only)
      if (config.key === 'food' && item.food_category) {
        var categoryLabel = makeEl('div', {class: 'food-category-label'});
        var featured = isFoodFeatured(item.food_category);
        categoryLabel.textContent = getFoodCategoryLabel(item.food_category) + (featured ? ' ⭐ Featured' : '');
        categoryLabel.style.cssText = 'font-size: 0.85rem; color: ' + (featured ? '#ff6600' : '#888') + '; margin: 4px 0; font-weight: ' + (featured ? 'bold' : 'normal');
        card.appendChild(categoryLabel);
      }
      
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      var tags=makeEl('div',{class:'shop-effects'});
      if(item.hunger_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hunger_effect+' Hunger'));
      if(item.energy_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.energy_effect+' Energy'));
      if(item.happiness_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.happiness_effect+' Happiness'));
      if(item.xp_effect>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.xp_effect+' XP'));
      if(item.effect === 'healing' && item.effect_value > 0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.effect_value+' HP'));
      if(item.attack_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.attack_bonus+' ATK'));
      if(item.defense_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.defense_bonus+' DEF'));
      if(item.hp_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.hp_bonus+' HP'));
      if(item.speed_bonus>0)tags.appendChild(makeEl('span',{class:'effect-tag'},'+'+item.speed_bonus+' SPD'));
      if(tags.children.length)card.appendChild(tags);
      
      // Apply event discount to displayed price
      var displayPrice = worldEvents.applyEventModifier(item.price, 'shopDiscount');
      var priceText = '🪙 ' + displayPrice + ' PP';
      if (displayPrice < item.price) {
        priceText += ' <span style="text-decoration:line-through;color:#999;font-size:0.85em;">' + item.price + '</span>';
      }
      var priceDiv = makeEl('div',{class:'shop-item-price'});
      priceDiv.innerHTML = priceText;
      card.appendChild(priceDiv);
      
      var canAfford=currentPoints>=displayPrice;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+displayPrice+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,displayPrice);};
      card.appendChild(buyBtn);
      fragment.appendChild(card);
    });
    
    // Append all items at once
    grid.appendChild(fragment);
  });
  
  // Add any uncategorized items at the end
  if (categories.other.length > 0) {
    var header = makeEl('div', {class: 'shop-category-header'});
    header.style.cssText = 'grid-column: 1 / -1; padding: 20px 10px 10px; border-bottom: 3px solid var(--purple-light); margin-bottom: 10px;';
    header.innerHTML = '<div style="font-size: 1.4rem; font-weight: bold; color: var(--purple);">📦 Other Items</div>';
    grid.appendChild(header);
    
    // OPTIMIZATION 1: Use DocumentFragment for batch append
    var fragment = document.createDocumentFragment();
    
    categories.other.forEach(function(item) {
      var card=makeEl('div',{class:'shop-card'});
      var iconDiv=makeEl('div',{class:'shop-item-icon'});
      if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};iconDiv.appendChild(img);}
      else iconDiv.innerHTML=itemEmoji(item.item_type);
      card.appendChild(iconDiv);
      card.appendChild(makeEl('div',{class:'shop-item-name'},item.name));
      card.appendChild(makeEl('div',{class:'shop-item-desc'},item.description||''));
      
      // Apply event discount to displayed price
      var displayPrice = worldEvents.applyEventModifier(item.price, 'shopDiscount');
      var priceText = '🪙 ' + displayPrice + ' PP';
      if (displayPrice < item.price) {
        priceText += ' <span style="text-decoration:line-through;color:#999;font-size:0.85em;">' + item.price + '</span>';
      }
      var priceDiv = makeEl('div',{class:'shop-item-price'});
      priceDiv.innerHTML = priceText;
      card.appendChild(priceDiv);
      
      var canAfford=currentPoints>=displayPrice;
      var buyBtn=makeEl('button',{class:'btn-buy'},canAfford?'Buy':'Need '+displayPrice+' PP');
      if(!canAfford)buyBtn.disabled=true;
      buyBtn.onclick=function(){buyItem(item.id,item.name,displayPrice);};
      card.appendChild(buyBtn);
      fragment.appendChild(card);
    });
    
    // Append all at once
    grid.appendChild(fragment);
  }
}

async function buyItem(itemId, itemName, price) {
  if (!currentUser) return;
  
  // Rate limiting
  if (!canPerformAction('buy_item', 500)) {
    showToast('Please wait before purchasing again!');
    return;
  }
  
  // Call secure database function
  var { data: result, error } = await supabaseClient.rpc('buy_item_secure', {
    p_item_id: itemId,
    p_item_price: price,
    p_item_name: itemName
  });
  
  if (error) {
    showToast('Purchase failed: ' + error.message);
    return;
  }
  
  if (!result || !result.success) {
    showToast('Purchase failed!');
    return;
  }
  
  // Check spending badges
  if (currentPoints >= 500) {
    await awardBadge('mega_spender');
  } else if (currentPoints >= 100) {
    await awardBadge('big_spender');
  }
  
  // Update display with correct field name from RPC
  updateAllPoints(result.new_pp);
  showToast('Bought ' + result.item_name + '!');
  tabsLoaded['shop'] = false; 
  loadShop(); 
  loadInventory();
  tabsLoaded['mypets'] = false;
}

async function loadInventory() {
  var grid=el('inventory-grid'); if(!currentUser)return;
  var invRes=await supabaseClient.from('user_inventory').select('id,item_id,quantity').eq('user_id',currentUser.id).gt('quantity',0);
  if(invRes.error||!invRes.data||!invRes.data.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-light)">Inventory empty!</div>';return;}
  var itemIds=invRes.data.map(function(r){return r.item_id;});
  var itemsRes=await supabaseClient.from('items').select('id,name,item_type,image_url,hunger_effect,happiness_effect,energy_effect,xp_effect').in('id',itemIds);
  var itemMap={};
  if(itemsRes.data)itemsRes.data.forEach(function(i){itemMap[i.id]=i;});
  grid.innerHTML='';
  invRes.data.forEach(function(row){
    var item=itemMap[row.item_id]||{};
    var card=makeEl('div',{class:'inv-card'});
    var icon=makeEl('div',{class:'inv-icon'});
    if(item.image_url){var img=makeEl('img',{src:item.image_url,alt:item.name||'',style:'width:100%;height:100%;object-fit:cover;'});img.onerror=function(){this.parentElement.innerHTML=itemEmoji(item.item_type);};icon.appendChild(img);}
    else icon.innerHTML=itemEmoji(item.item_type);
    card.appendChild(icon);
    card.appendChild(makeEl('div',{class:'inv-name'},item.name||'Item'));
    
    // Show item effects
    var effects = [];
    if (item.hunger_effect) effects.push('Hunger +' + item.hunger_effect);
    if (item.happiness_effect) effects.push('Happiness +' + item.happiness_effect);
    if (item.energy_effect) effects.push('Energy +' + item.energy_effect);
    if (item.xp_effect) effects.push('XP +' + item.xp_effect);
    if (effects.length > 0) {
      var effectDiv = makeEl('div', {class:'inv-effect'}, effects.join(', '));
      effectDiv.style.cssText = 'font-size:0.85rem;color:var(--green);margin-top:4px;';
      card.appendChild(effectDiv);
    }
    
    card.appendChild(makeEl('div',{class:'inv-qty'},'x'+row.quantity));
    var useBtn=makeEl('button',{class:'btn btn-sm btn-primary'},'Use');
    useBtn.onclick=(function(rId,iName){return function(){openUseModal(rId,iName);};})(row.id, item.name||'Item');
    card.appendChild(useBtn);
    grid.appendChild(card);
  });
}

function openUseModal(invId,itemName) {
  selectedInvItem={invId:invId,itemName:itemName};
  el('use-modal-title').textContent='Use '+itemName;
  el('use-modal-desc').textContent='Which pet?';
  var list=el('pet-select-list'); list.innerHTML='';
  var pets=Object.values(petState);
  if(!pets.length){list.innerHTML='<p style="color:var(--text-light)">No pets yet!</p>';}
  else{
    pets.forEach(function(p){
      var btn=makeEl('button',{class:'pet-select-btn'},p.nickname);
      btn.onclick=(function(pid,pname){return function(){useOnPet(pid,pname);};})(p.id,p.nickname);
      list.appendChild(btn);
    });
  }
  el('use-modal').classList.add('show');
}
function closeUseModal(){el('use-modal').classList.remove('show');selectedInvItem=null;}

// ── CONTACT MODAL ──────────────────────────────────────
function openContactModal() {
  el('contact-modal').classList.add('show');
}

function closeContactModal() {
  el('contact-modal').classList.remove('show');
}

// ── SIDEBAR TWITCH LIVE STATUS CHECK ──────────────────
// Track if we've already logged about missing Twitch token
var twitchTokenLoggedOnce = false;
function sortStreamerList() {
  var streamersWidget = document.querySelector('.streamers-widget');
  if (!streamersWidget) return;
  
  var streamerItems = streamersWidget.querySelectorAll('.streamer-item');
  if (!streamerItems.length) return;
  
  var itemsArray = Array.prototype.slice.call(streamerItems);
  
  itemsArray.sort(function(a, b) {
    var aLive = a.querySelector('.live-indicator') && 
                a.querySelector('.live-indicator').style.display !== 'none';
    var bLive = b.querySelector('.live-indicator') && 
                b.querySelector('.live-indicator').style.display !== 'none';
    
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    
    var aName = a.querySelector('.streamer-name').textContent.trim();
    var bName = b.querySelector('.streamer-name').textContent.trim();
    return aName.localeCompare(bName);
  });
  
  itemsArray.forEach(function(item) {
    streamersWidget.appendChild(item);
  });
}

async function checkSidebarStreamStatus() {
  // ... rest of the existing function ...
  // Check if Embertail and Pyxshuul are live using public Twitch API
  try {
    // We need to use a token to check streams - try to get from user if linked
    var token = null;
    if (currentUser) {
      var pr = await supabaseClient.from('players').select('twitch_token').eq('id', currentUser.id).single();
      if (pr.data && pr.data.twitch_token) {
        token = pr.data.twitch_token;
      }
    }
    
    // If no token, can't check - this is a Twitch API limitation
    if (!token) {
      // Only log once per session to avoid spam
      if (!twitchTokenLoggedOnce) {
        console.log('No Twitch token available - cannot check live status');
        twitchTokenLoggedOnce = true;
      }
      return;
    }
    
    // Check both streamers
        var logins = TEAM_MEMBERS.map(function(m) { return 'user_login=' + m.login; }).join('&');
        var resp = await fetch('https://api.twitch.tv/helix/streams?' + logins, {
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': 'Bearer ' + token
      }
    });
    
    var data = await resp.json();
    
       // Reset all to offline first
    var streamerIds = ['ember', 'pyxs', 'aria', 'blushimia', 'cowbee', 'kelta', 'jess', 'gnarly'];
    streamerIds.forEach(function(id) {
      var statusEl = el(id + '-status');
      var badgeEl = el(id + '-live-badge');
      var watchBtn = el(id + '-watch-btn');
      if (statusEl) statusEl.textContent = 'OFFLINE';
      if (badgeEl) badgeEl.style.display = 'none';
      if (watchBtn) watchBtn.style.display = 'none';
    });
    
    // Update live streamers
    if (data.data && data.data.length > 0) {
      data.data.forEach(function(stream) {
        var login = stream.user_login.toLowerCase();
        var loginMap = {
          'embertail': 'ember',
          'pyxshuul': 'pyxs',
          'ariadoestwitch': 'aria',
          'realblushimia': 'blushimia',
          'cowbeevt': 'cowbee',
          'keltathepomeranian': 'kelta',
          'teatimejess': 'jess',
          'gnarly_neon_smilodon': 'gnarly'
        };
        var prefix = loginMap[login];
        if (!prefix) return;
        var statusEl = el(prefix + '-status');
        var badgeEl = el(prefix + '-live-badge');
        var watchBtn = el(prefix + '-watch-btn');
        if (statusEl) statusEl.textContent = stream.game_name || 'LIVE';
        if (badgeEl) badgeEl.style.display = 'inline-block';
        if (watchBtn) watchBtn.style.display = 'inline-block';
      });
    }
    
    console.log('✅ Sidebar stream status checked');
    sortStreamerList();
  } catch (err) {
    console.error('❌ Error checking sidebar stream status:', err);
  }
}



async function useOnPet(petId,petNickname) {
  if(!selectedInvItem)return;
  var invId=selectedInvItem.invId; var itemName=selectedInvItem.itemName;
  closeUseModal();
  var invRow=await supabaseClient.from('user_inventory').select('item_id,quantity').eq('id',invId).single();
  if(invRow.error||!invRow.data){showToast('Could not find item.');return;}
  var itemRes=await supabaseClient.from('items').select('hunger_effect,energy_effect,happiness_effect,xp_effect').eq('id',invRow.data.item_id).single();
  if(itemRes.error||!itemRes.data){showToast('Could not find effects.');return;}
  var ef=itemRes.data;
  var petRes=await supabaseClient.from('user_pets').select('hunger,max_hunger,energy,max_energy,happiness,max_happiness,xp,level').eq('id',petId).single();
  if(petRes.error||!petRes.data){showToast('Could not find pet.');return;}
  var pet=petRes.data; var updates={};
  if(ef.hunger_effect>0)updates.hunger=Math.min(pet.hunger+ef.hunger_effect,pet.max_hunger);
  if(ef.energy_effect>0)updates.energy=Math.min(pet.energy+ef.energy_effect,pet.max_energy);
  if(ef.happiness_effect>0)updates.happiness=Math.min(pet.happiness+ef.happiness_effect,pet.max_happiness);
  if(ef.xp_effect>0)updates.xp=pet.xp+ef.xp_effect;
  if(!Object.keys(updates).length){showToast('No effects configured.');return;}
  await supabaseClient.from('user_pets').update(updates).eq('id',petId);
  var qty=invRow.data.quantity;
  if(qty<=1)await supabaseClient.from('user_inventory').delete().eq('id',invId);
  else await supabaseClient.from('user_inventory').update({quantity:qty-1}).eq('id',invId);
  showToast('Used '+itemName+' on '+petNickname+'!');
  await loadInventory(); tabsLoaded['mypets']=false;
}

// ══════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
// PET FOOD PREFERENCES & PERSONALITIES
// PLACEHOLDER_PET_DATA - Replace these with real streamer pet preferences!
// Search for "PLACEHOLDER_PET_DATA" to find all placeholder data
// ══════════════════════════════════════════════════════════════════════════

var petFoodPreferences = {
  // PLACEHOLDER_PET_DATA - Replace these with real streamer pet data!
  // Format: loved (1.75x), liked (1.25x), disliked (0.75x), hated (0.5x)
  
  'Ember': {
    loved_item: 'Spicy Ramen',
    liked_item: 'Hot Wings',
    disliked_item: 'Rainbow Cake',
    hated_item: 'Sushi Roll',
    hobby: 'Competitive dueling',
    fun_fact: 'Once won a spoon dueling championship!'
  },
  
  'Pyxie': {
    loved_item: 'Rainbow Cake',
    liked_item: 'Honey Cookies',
    disliked_item: 'Grilled Salmon',
    hated_item: 'Spicy Burrito',
    hobby: 'Professional napping',
    fun_fact: 'Can sleep for 16 hours straight!'
  },
  
  'Cowbee': {
    loved_item: 'Fresh Bread',
    liked_item: 'Garden Salad',
    disliked_item: 'Hot Wings',
    hated_item: 'Curry Feast',
    hobby: 'Organic gardening',
    fun_fact: 'Grows all their own vegetables!'
  },
  
  'Kelta': {
    loved_item: 'Garden Salad',
    liked_item: 'Fresh Bread',
    disliked_item: 'Shrimp Tempura',
    hated_item: 'Grilled Steak',
    hobby: 'Flower arranging',
    fun_fact: 'Knows 37 different wildflowers by scent!'
  },
  
  'Blushimia': {
    loved_item: 'Sushi Roll',
    liked_item: 'Grilled Salmon',
    disliked_item: 'Banana Bread',
    hated_item: 'Honey Cookies',
    hobby: 'Treasure hunting',
    fun_fact: 'Found a legendary golden acorn once!'
  },
  
  'Aria': {
    loved_item: 'Grilled Steak',
    liked_item: 'Beef Jerky',
    disliked_item: 'Apple Pie',
    hated_item: 'Grape Juice',
    hobby: 'Moonlight howling',
    fun_fact: 'Can howl in perfect harmony with music!'
  },
  
  'Gnarly': {
    loved_item: 'Apple Pie',
    liked_item: 'Mango Delight',
    disliked_item: 'Roasted Chicken',
    hated_item: 'Seafood Soup',
    hobby: 'Forest meditation',
    fun_fact: 'Can sense weather changes 24 hours early!'
  },
  
  'Jess': {
    loved_item: 'Mango Delight',
    liked_item: 'Strawberry Parfait',
    disliked_item: 'Cheese Platter',
    hated_item: 'Veggie Noodles',
    hobby: 'Sky acrobatics',
    fun_fact: 'Performed in a famous aerial circus!'
  }
};

function getPetPreferences(petType) {
  return petFoodPreferences[petType] || null;
}

// BADGES SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var earnedBadges = []; // Cache of user's earned badge keys

async function loadUserBadges() {
  if (!currentUser) return;
  
  var res = await supabaseClient
    .from('user_badges')
    .select('badge_id, badges(badge_key, name, icon)')
    .eq('user_id', currentUser.id);
  
  if (res.error) {
    console.error('[Badges] Error loading badges:', res.error);
    return;
  }
  
  earnedBadges = res.data.map(b => b.badges.badge_key);
  console.log('[Badges] User has earned:', earnedBadges);
}
async function awardBadge(badgeKey) {
  if (!currentUser) return;
  
  // Check if already earned
  if (earnedBadges.includes(badgeKey)) {
    return;
  }
  
  try {
    // Get badge info
    var { data: badge, error: badgeError } = await supabaseClient
      .from('badges')
      .select('*')
      .eq('badge_key', badgeKey)
      .single();
    
    if (badgeError || !badge) {
      console.log('[Badges] Badge not found in database:', badgeKey);
      return;
    }
    
    // Award badge to user
    var { error: insertError } = await supabaseClient
      .from('user_badges')
      .insert([{
        user_id: currentUser.id,
        badge_id: badge.id
      }]);
    
    if (insertError) {
      if (insertError.code === '23505') {
        console.log('[Badges] User already has badge:', badgeKey);
        return;
      }
      console.error('[Badges] Error awarding badge:', insertError);
      return;
    }
    
    // Add to local cache
    earnedBadges.push(badgeKey);
    
    // Show notification
    if (typeof showBadgeNotification === 'function') {
      showBadgeNotification(badge);
    }
    
    // Log activity
    if (typeof logActivity === 'function') {
      await logActivity('badge_earned', {
        badge_name: badge.name,
        badge_icon: badge.icon
      });
    }
    
    console.log('[Badges] Awarded:', badgeKey, '-', badge.name);
    
  } catch (err) {
    console.error('[Badges] Error in awardBadge:', err);
  }
}

function showBadgeNotification(badge) {
  // Store for potential sharing
  lastUnlockedBadge = badge;
  
  var notification = makeEl('div', {class: 'badge-notification'});
  notification.innerHTML = `
    <div class="badge-notif-icon">${badge.icon}</div>
    <div class="badge-notif-content">
      <div class="badge-notif-title">Badge Earned!</div>
      <div class="badge-notif-name">${badge.name}</div>
      <div class="badge-notif-desc">${badge.description || ''}</div>
      <div class="badge-notif-share">
        <button class="btn-social-mini btn-twitter" onclick="shareBadgeToTwitter('${badge.name}', '${badge.icon}')">
          🐦 Tweet
        </button>
        <button class="btn-social-mini btn-bluesky" onclick="shareBadgeToBluesky('${badge.name}', '${badge.icon}')">
          🦋 Post
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => notification.classList.add('show'), 10);
  
  // Remove after 7 seconds (longer because of share buttons)
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 7000);
}

// ── MINIGAMES ────────────────────────────
function gck(game){return 'game_'+game+'_'+(currentUser?currentUser.id:'')+'_'+today;}
function isCD(game){return localStorage.getItem(gck(game))==='done';}
function setCD(game){localStorage.setItem(gck(game),'done');}

function initMinigames() {
  if(isCD('dice')){el('roll-btn').style.display='none';el('dice-cooldown').style.display='block';}
  if(isCD('guess')){el('guess-play').style.display='none';el('guess-cooldown').style.display='block';}
  else initGuess();
  if(isCD('memory')){el('memory-play').style.display='none';el('memory-cooldown').style.display='block';}
  else initMemory();
}

async function awardPP(amount, reason) {
  if(!currentUser) return;
  if (!reason) reason = 'unknown';
  
  var { data, error } = await supabaseClient.rpc('award_pp_secure', {
    p_amount: amount,
    p_reason: reason
  });
  
  if (error) {
    console.error('PP award error:', error.message);
    showPixelToast('Error awarding points!', 'error');
    return;
  }
  
  currentPoints = data;
  updateAllPoints(data);
  await checkTop10Badge();
}

async function checkTop10Badge() {
  if (!currentUser) return;
  // ... rest of function
}

async function checkTop10Badge() {
  if (!currentUser) return;
  
  var rankRes = await supabaseClient
    .from('players')
    .select('id')
    .order('pawketpoints', { ascending: false })
    .limit(10);
  
  if (rankRes.data) {
    var top10Ids = rankRes.data.map(function(p) { return p.id; });
    if (top10Ids.includes(currentUser.id)) {
      await awardBadge('top_10');
    }
  }
}

var diceFaces=['&#9856;','&#9857;','&#9858;','&#9859;','&#9860;','&#9861;'];
async function rollDice() {
  if(isCD('dice'))return;
  var btn=el('roll-btn'); btn.disabled=true;
  var d1=el('die1'); var d2=el('die2');
  var res=el('dice-result'); res.textContent=''; res.style.opacity='0';
  d1.classList.add('rolling'); d2.classList.add('rolling');
  var ri=setInterval(function(){d1.innerHTML=diceFaces[Math.floor(Math.random()*6)];d2.innerHTML=diceFaces[Math.floor(Math.random()*6)];},100);
  setTimeout(async function(){
    clearInterval(ri); d1.classList.remove('rolling'); d2.classList.remove('rolling');
    var v1=Math.floor(Math.random()*6)+1; var v2=Math.floor(Math.random()*6)+1;
    d1.innerHTML=diceFaces[v1-1]; d2.innerHTML=diceFaces[v2-1];
    var total=v1+v2; var isDouble=v1===v2; var earned=isDouble?total*3:total;
    await awardPP(earned, 'dice_roll'); setCD('dice');
    
    // Award badges
    await awardBadge('dice_first_play'); // First time playing
    if (isDouble) {
      await awardBadge('lucky_doubles'); // Any doubles
      if (v1 === 1) await awardBadge('snake_eyes'); // Double 1s
      if (v1 === 6) await awardBadge('boxcars'); // Double 6s
    }
    
    res.style.opacity='1';
    res.textContent=isDouble?'DOUBLE '+v1+'s! +'+earned+' PP!':'Rolled '+v1+'+'+v2+'='+total+'! +'+earned+' PP!';
    res.style.color=isDouble?'#b06aff':'#5dde7a';
    btn.style.display='none'; el('dice-cooldown').style.display='block';
  },1200);
}

var guessAttempts = 0; // Track attempts for badge

function initGuess(){
  secretNumber=Math.floor(Math.random()*10)+1;
  guessesLeft=3;
  guessAttempts=0;
  el('guess-input').value='';
  el('guess-result').textContent='';
  el('attempts-left').textContent='3 guesses remaining';
}

async function makeGuess() {
  if(isCD('guess'))return;
  var input=el('guess-input'); var guess=parseInt(input.value);
  var result=el('guess-result'); var attEl=el('attempts-left');
  if(!guess||guess<1||guess>10){result.textContent='Enter a number 1-10!';result.style.color='#ff6eb4';return;}
  
  guessesLeft--;
  guessAttempts++;
  
  if(guess===secretNumber){
    await awardPP(25, 'guess_game'); setCD('guess');
    
    // Award badges
    await awardBadge('guess_first_play'); // First time playing
    if (guessAttempts === 1) {
      await awardBadge('first_try'); // Got it on first try!
      
      // Track first-try wins for Mind Reader badge
      var playerRes = await supabaseClient.from('players').select('first_try_wins').eq('id',currentUser.id).single();
      var newCount = (playerRes.data?.first_try_wins || 0) + 1;
      await supabaseClient.from('players').update({first_try_wins: newCount}).eq('id',currentUser.id);
      
      if (newCount >= 5) {
        await awardBadge('mind_reader'); // 5 first-try wins!
      }
    }
    
    result.textContent='Correct! +25 PP!'; result.style.color='#5dde7a';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
    
    // 🐾 COMPANION REACTION - Minigame win!
    if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.currentCompanionId) {
      setTimeout(function() {
        var winMessages = ["You got it! 🌟", "Amazing guess! 🎯", "You're so smart! 💡", "Perfect! ✨"];
        CompanionBuddy.showMessage(winMessages[Math.floor(Math.random() * winMessages.length)]);
      }, 500);
    }
  } else if(guessesLeft===0){
    setCD('guess');
    await awardBadge('guess_first_play'); // Award badge even if lost
    result.textContent='The number was '+secretNumber+'. Better luck tomorrow!'; result.style.color='#ff6eb4';
    el('guess-play').style.display='none'; el('guess-cooldown').style.display='block';
  } else {
    result.textContent=(guess<secretNumber?'Too low!':'Too high!')+' '+guessesLeft+' left.'; result.style.color='#ff9f43';
    attEl.textContent=guessesLeft+' guess'+(guessesLeft===1?'':'es')+' remaining';
    input.value=''; input.focus();
  }
}

function shuffle(arr){var a=arr.slice();for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function initMemory() {
  if(isCD('memory'))return;
  memoryCards=shuffle(memoryEmojis.concat(memoryEmojis));
  flippedCards=[]; matchedPairs=0; triesLeft=15; memoryEarned=0; memoryLocked=false;
  el('match-count').textContent='0'; el('tries-left').textContent='15'; el('memory-earned').textContent='0'; el('memory-result').textContent='';
  var grid=el('memory-grid'); grid.innerHTML='';
  memoryCards.forEach(function(em,idx){
    var btn=document.createElement('button'); btn.className='memory-card';
    btn.dataset.idx=idx; btn.dataset.emoji=em; btn.innerHTML='';
    btn.onclick=function(){flipCard(this);}; grid.appendChild(btn);
  });
}
function flipCard(btn) {
  if(memoryLocked||btn.classList.contains('flipped')||btn.classList.contains('matched')||flippedCards.length>=2)return;
  btn.innerHTML=btn.dataset.emoji; btn.classList.add('flipped'); flippedCards.push(btn);
  if(flippedCards.length===2){
    memoryLocked=true; triesLeft--; el('tries-left').textContent=triesLeft;
    if(flippedCards[0].dataset.emoji===flippedCards[1].dataset.emoji){
      flippedCards[0].classList.add('matched'); flippedCards[1].classList.add('matched');
      flippedCards[0].classList.remove('flipped'); flippedCards[1].classList.remove('flipped');
      matchedPairs++; memoryEarned+=5;
      el('match-count').textContent=matchedPairs; el('memory-earned').textContent=memoryEarned;
      flippedCards=[]; memoryLocked=false;
      
      if(matchedPairs===6){
        // Game complete!
        awardPP(memoryEarned, 'memory_match');setCD('memory');
        
        // Award badges
        awardBadge('memory_first_play'); // First time playing
        var usedTries = 15 - triesLeft;
        if (usedTries === 6) {
          awardBadge('perfect_memory'); // Perfect game (no mistakes)
        }
        if (usedTries <= 10) {
          awardBadge('speed_matcher'); // Completed in 10 tries or less
        }
        
        var r=el('memory-result');r.textContent='All matched! +'+memoryEarned+' PP!';r.style.color='#5dde7a';el('memory-cooldown').style.display='block';
      }
    } else {
      setTimeout(function(){
        flippedCards[0].innerHTML=''; flippedCards[0].classList.remove('flipped');
        flippedCards[1].innerHTML=''; flippedCards[1].classList.remove('flipped');
        flippedCards=[]; memoryLocked=false;
        if(triesLeft===0&&matchedPairs<6){
          awardPP(memoryEarned, 'memory_match');setCD('memory');
          awardBadge('memory_first_play'); // Award badge even if lost
          var r=el('memory-result');r.textContent='Out of tries! Earned '+memoryEarned+' PP.';r.style.color='#ff9f43';el('memory-cooldown').style.display='block';document.querySelectorAll('.memory-card:not(.matched)').forEach(function(c){c.innerHTML=c.dataset.emoji;c.disabled=true;});
        }
      },900);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// NEW MINIGAMES
// ══════════════════════════════════════════════════════════════════════════

// ── TREASURE WHEEL ──────────────────────────────
var wheelSpinning = false;
var wheelPrizes = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function drawWheel() {
  var canvas = el('wheel-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var centerX = 150, centerY = 150, radius = 140;
  var sliceAngle = (2 * Math.PI) / wheelPrizes.length;
  
  wheelPrizes.forEach(function(prize, i) {
    var startAngle = i * sliceAngle;
    var endAngle = startAngle + sliceAngle;
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#9966ff' : '#ff66cc';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw text
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(startAngle + sliceAngle / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Fredoka';
    ctx.fillText(prize + ' PP', radius - 40, 5);
    ctx.restore();
  });
  
  // Draw pointer
  ctx.beginPath();
  ctx.moveTo(centerX, 10);
  ctx.lineTo(centerX - 10, 30);
  ctx.lineTo(centerX + 10, 30);
  ctx.closePath();
  ctx.fillStyle = '#ffdd00';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function spinWheel() {
  if (wheelSpinning || isCD('wheel')) return;
  wheelSpinning = true;
  
  var btn = el('wheel-btn');
  btn.disabled = true;
  btn.textContent = 'Spinning...';
  
  var canvas = el('wheel-canvas');
  var winningIndex = Math.floor(Math.random() * wheelPrizes.length);
  var winningPrize = wheelPrizes[winningIndex];
  var rotations = 5 + Math.random() * 3;
  
  // Calculate angle so the winning slice ends up at the TOP (12 o'clock position where pointer is)
  // Each slice is (360 / wheelPrizes.length) degrees
  var degreesPerSlice = 360 / wheelPrizes.length;
  var targetAngle = (degreesPerSlice * winningIndex) + (degreesPerSlice / 2);
  
  // We want to rotate so this angle ends up at the top (0 degrees)
  // So we rotate to (360 - targetAngle) to position it correctly
  var finalPosition = 360 - targetAngle;
  var totalRotation = (rotations * 360) + finalPosition;
  
  var startTime = Date.now();
  var duration = 4000;
  
  function animate() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    var easeOut = 1 - Math.pow(1 - progress, 3);
    var currentRotation = totalRotation * easeOut;
    
    // Only rotate the canvas (wheel), NOT the pointer
    canvas.style.transform = 'rotate(' + currentRotation + 'deg)';
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      wheelSpinning = false;
      awardPP(winningPrize, 'treasure_wheel');
      setCD('wheel');
      var r = el('wheel-result');
      r.textContent = 'You won ' + winningPrize + ' PP!';
      r.style.color = '#5dde7a';
      el('wheel-cooldown').style.display = 'block';
      btn.textContent = 'Spin the Wheel!';
    }
  }
  animate();
}

// ── WHACK-A-MOLE ──────────────────────────────
var whackScore = 0;
var whackTimer = null;
var whackInterval = null;

function startWhack() {
  if (isCD('whack')) return;
  whackScore = 0;
  var timeLeft = 30;
  
  el('whack-score').textContent = '0';
  el('whack-earned').textContent = '0';
  el('whack-time').textContent = timeLeft;
  el('whack-btn').disabled = true;
  el('whack-result').textContent = '';
  
  // Pop moles randomly
  whackInterval = setInterval(function() {
    var moleId = Math.floor(Math.random() * 6);
    var mole = el('mole-' + moleId);
    if (!mole.classList.contains('active')) {
      mole.classList.add('active');
      setTimeout(function() {
        mole.classList.remove('active');
      }, 800);
    }
  }, 600);
  
  // Timer countdown
  whackTimer = setInterval(function() {
    timeLeft--;
    el('whack-time').textContent = timeLeft;
    if (timeLeft <= 0) {
      endWhack();
    }
  }, 1000);
}

function whackMole(id) {
  var mole = el('mole-' + id);
  if (mole.classList.contains('active')) {
    mole.classList.add('hit');
    mole.classList.remove('active');
    whackScore++;
    var earned = whackScore * 5;
    el('whack-score').textContent = whackScore;
    el('whack-earned').textContent = earned;
    setTimeout(function() {
      mole.classList.remove('hit');
      mole.style.bottom = '-60px';
    }, 300);
  }
}

function endWhack() {
  clearInterval(whackTimer);
  clearInterval(whackInterval);
  var earned = Math.min(whackScore * 5, 50);
  awardPP(earned, 'whack_a_mole');
  setCD('whack');
  var r = el('whack-result');
  r.textContent = 'Game over! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('whack-cooldown').style.display = 'block';
  el('whack-btn').disabled = true;
  document.querySelectorAll('.mole').forEach(function(m) {
    m.classList.remove('active');
  });
}

// ── SHELL GAME ──────────────────────────────
var shellRound = 0;
var shellCorrect = 0;
var shellWinningPos = 0;
var shellShuffling = false;

function startShellGame() {
  if (isCD('shell')) return;
  shellRound = 1;
  shellCorrect = 0;
  el('shell-round').textContent = '1';
  el('shell-result').textContent = '';
  el('shell-btn').style.display = 'none';
  shuffleShells();
}

function shuffleShells() {
  if (shellShuffling) return;
  shellShuffling = true;
  shellWinningPos = Math.floor(Math.random() * 3);
  
  // Show egg under winning shell briefly
  for (var i = 0; i < 3; i++) {
    el('shell-' + i).textContent = i === shellWinningPos ? '🥚✨' : '🥚';
  }
  
  setTimeout(function() {
    // Hide all eggs
    for (var i = 0; i < 3; i++) {
      el('shell-' + i).textContent = '🥚';
    }
    
    // Now perform actual visual swaps
    var shells = [el('shell-0'), el('shell-1'), el('shell-2')];
    var positions = [0, 1, 2]; // Track logical positions
    var swapCount = 8; // Number of swaps to perform
    var swapDelay = 400; // Time between swaps
    var currentSwap = 0;
    
    function performSwap() {
      if (currentSwap >= swapCount) {
        shellShuffling = false;
        return;
      }
      
      // Pick two random positions to swap
      var pos1 = Math.floor(Math.random() * 3);
      var pos2 = Math.floor(Math.random() * 3);
      while (pos1 === pos2) {
        pos2 = Math.floor(Math.random() * 3);
      }
      
      // Animate the swap visually
      var shell1 = shells[pos1];
      var shell2 = shells[pos2];
      
      // Get current positions
      var rect1 = shell1.getBoundingClientRect();
      var rect2 = shell2.getBoundingClientRect();
      var deltaX = rect2.left - rect1.left;
      
      // Apply transform to swap
      shell1.style.transition = 'transform 0.4s ease';
      shell2.style.transition = 'transform 0.4s ease';
      shell1.style.transform = 'translateX(' + deltaX + 'px)';
      shell2.style.transform = 'translateX(' + (-deltaX) + 'px)';
      
      setTimeout(function() {
        // Reset transforms
        shell1.style.transition = 'none';
        shell2.style.transition = 'none';
        shell1.style.transform = '';
        shell2.style.transform = '';
        
        // Actually swap in DOM (so they stay in new positions)
        var parent = shell1.parentNode;
        var shell1Next = shell1.nextSibling;
        var shell2Next = shell2.nextSibling;
        
        if (shell1Next === shell2) {
          parent.insertBefore(shell2, shell1);
        } else if (shell2Next === shell1) {
          parent.insertBefore(shell1, shell2);
        } else {
          parent.insertBefore(shell2, shell1Next);
          parent.insertBefore(shell1, shell2Next);
        }
        
        // Swap in arrays
        var temp = shells[pos1];
        shells[pos1] = shells[pos2];
        shells[pos2] = temp;
        
        var tempPos = positions[pos1];
        positions[pos1] = positions[pos2];
        positions[pos2] = tempPos;
        
        // Track where winning position moved to
        if (positions[pos1] === shellWinningPos) {
          shellWinningPos = pos1;
        } else if (positions[pos2] === shellWinningPos) {
          shellWinningPos = pos2;
        }
        
        currentSwap++;
        setTimeout(performSwap, 100);
      }, swapDelay);
    }
    
    performSwap();
  }, 1000);
}

function guessShell(pos) {
  if (shellShuffling) return;
  
  // Reveal
  el('shell-' + pos).textContent = pos === shellWinningPos ? '🥚✨' : '❌';
  
  if (pos === shellWinningPos) {
    shellCorrect++;
    setTimeout(function() {
      if (shellRound < 3) {
        shellRound++;
        el('shell-round').textContent = shellRound;
        shuffleShells();
      } else {
        // Won all 3 rounds!
        awardPP(30, 'shell_game');
        setCD('shell');
        var r = el('shell-result');
        r.textContent = 'Perfect! +30 PP!';
        r.style.color = '#5dde7a';
        el('shell-cooldown').style.display = 'block';
      }
    }, 1500);
  } else {
    // Lost
    setTimeout(function() {
      setCD('shell');
      var r = el('shell-result');
      r.textContent = 'Wrong! Better luck tomorrow!';
      r.style.color = '#ff6eb4';
      el('shell-cooldown').style.display = 'block';
    }, 1500);
  }
}

// ── SLOT MACHINE ──────────────────────────────────
var slotSpinning = false;
var slotSymbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🎰'];
var slotReels = [0, 0, 0]; // Current symbol index for each reel
var selectedSlotBet = 50; // Default bet amount

function selectSlotBet(amount) {
  if (slotSpinning) return;
  selectedSlotBet = amount;
  
  // Update button states
  var buttons = document.querySelectorAll('.bet-btn');
  buttons.forEach(function(btn) {
    btn.classList.remove('active');
    if (parseInt(btn.getAttribute('data-bet')) === amount) {
      btn.classList.add('active');
    }
  });
  
  // Update spin button text
  var spinBtn = el('slot-spin-btn');
  if (spinBtn) {
    spinBtn.textContent = '🎰 Spin! (' + amount + ' PP)';
  }
}

function spinSlots() {
  if (slotSpinning) return;
  
  // Check if user has enough PP
  if (currentPoints < selectedSlotBet) {
    var result = el('slot-result');
    if (result) {
      result.textContent = 'Not enough PP! Need ' + selectedSlotBet + ' PP to play.';
      result.style.color = '#ff6eb4';
    }
    return;
  }
  
  // Deduct bet amount to play
  deductPP(selectedSlotBet);
  
  slotSpinning = true;
  
  var btn = el('slot-spin-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Spinning...';
  }
  
  // Clear previous result
  var result = el('slot-result');
  if (result) {
    result.textContent = '';
  }
  
  var reel1 = el('slot-reel-1');
  var reel2 = el('slot-reel-2');
  var reel3 = el('slot-reel-3');
  
  // Random final positions
  var final = [
    Math.floor(Math.random() * slotSymbols.length),
    Math.floor(Math.random() * slotSymbols.length),
    Math.floor(Math.random() * slotSymbols.length)
  ];
  
  var spins = 0;
  var maxSpins = 20;
  var spinInterval = setInterval(function() {
    // Spin all reels rapidly
    slotReels[0] = Math.floor(Math.random() * slotSymbols.length);
    slotReels[1] = Math.floor(Math.random() * slotSymbols.length);
    slotReels[2] = Math.floor(Math.random() * slotSymbols.length);
    
    if (reel1) reel1.textContent = slotSymbols[slotReels[0]];
    if (reel2) reel2.textContent = slotSymbols[slotReels[1]];
    if (reel3) reel3.textContent = slotSymbols[slotReels[2]];
    
    spins++;
    
    // Stop reels one by one
    if (spins === 15 && reel1) {
      slotReels[0] = final[0];
      reel1.textContent = slotSymbols[final[0]];
    }
    if (spins === 18 && reel2) {
      slotReels[1] = final[1];
      reel2.textContent = slotSymbols[final[1]];
    }
    if (spins >= maxSpins) {
      clearInterval(spinInterval);
      slotReels[2] = final[2];
      if (reel3) reel3.textContent = slotSymbols[final[2]];
      
      // Calculate prizes based on bet amount
      // Match 2 = get bet back (break even)
      // Match 3 = 4x bet (3x profit)
      var grossPrize = 0;
      var netProfit = 0;
      
      if (final[0] === final[1] && final[1] === final[2]) {
        // All three match! 4x payout
        grossPrize = selectedSlotBet * 4;
        netProfit = selectedSlotBet * 3; // 3x profit after cost
      } else if (final[0] === final[1] || final[1] === final[2] || final[0] === final[2]) {
        // Two match - break even
        grossPrize = selectedSlotBet;
        netProfit = 0; // Got bet back
      }
      
      slotSpinning = false;
      
      var result = el('slot-result');
      if (result) {
        if (grossPrize > 0) {
          // Award the gross prize
          awardPP(grossPrize, 'slot_machine');
          
          if (netProfit > 0) {
            result.textContent = '🎉 Triple Match! Won ' + netProfit + ' PP profit! (Paid ' + grossPrize + ' PP total)';
            result.style.color = '#5dde7a';
          } else {
            result.textContent = '🎯 Two Match! Break even - got your ' + selectedSlotBet + ' PP back!';
            result.style.color = '#ffdd57';
          }
        } else {
          // Already deducted bet - show loss
          result.textContent = '❌ No match! Lost ' + selectedSlotBet + ' PP. Try again!';
          result.style.color = '#ff6eb4';
        }
      }
      
      if (btn) {
        btn.textContent = '🎰 Spin! (' + selectedSlotBet + ' PP)';
        btn.disabled = false;
      }
    }
  }, 100);
}

// Helper function to deduct PP
async function deductPP(amount) {
  if (!currentUser) return;
  
  var { data: newPoints, error } = await supabaseClient.rpc('deduct_pp_secure', {
    p_amount: amount,
    p_reason: 'slot_machine'
  });
  
  if (error) {
    console.error('Deduct PP error:', error.message);
    showToast('Error processing bet!', 'error');
    return;
  }
  
  currentPoints = newPoints;
  updateAllPoints(currentPoints);
}

// ── TYPING CHALLENGE ──────────────────────────────
var typingWords = ['Ember', 'Pyxie', 'Embertail', 'Pyxshuul', 'Firefox', 'Sparkle', 'Panda', 'Koala', 'Dragon', 'Phoenix', 'Tiger', 'Leopard', 'Cheetah', 'Panther', 'Wolf', 'Bear', 'Raccoon', 'Otter', 'Seal'];
var typingScore = 0;
var typingTimer = null;
var currentWord = '';

function startTyping() {
  if (isCD('typing')) return;
  typingScore = 0;
  var timeLeft = 60;
  
  el('typing-score').textContent = '0';
  el('typing-earned').textContent = '0';
  el('typing-time').textContent = timeLeft;
  el('typing-input').disabled = false;
  el('typing-input').value = '';
  el('typing-input').focus();
  el('typing-btn').disabled = true;
  el('typing-result').textContent = '';
  
  nextWord();
  
  typingTimer = setInterval(function() {
    timeLeft--;
    el('typing-time').textContent = timeLeft;
    if (timeLeft <= 0) {
      endTyping();
    }
  }, 1000);
}

function nextWord() {
  currentWord = typingWords[Math.floor(Math.random() * typingWords.length)];
  el('typing-target').textContent = currentWord;
}

el('typing-input').addEventListener('input', function() {
  if (el('typing-input').value === currentWord) {
    typingScore++;
    var earned = typingScore * 3;
    el('typing-score').textContent = typingScore;
    el('typing-earned').textContent = earned;
    el('typing-input').value = '';
    nextWord();
  }
});

function endTyping() {
  clearInterval(typingTimer);
  var earned = Math.min(typingScore * 3, 60);
  awardPP(earned, 'typing_challenge');
  setCD('typing');
  var r = el('typing-result');
  r.textContent = 'Time\'s up! +' + earned + ' PP!';
  r.style.color = '#5dde7a';
  el('typing-cooldown').style.display = 'block';
  el('typing-input').disabled = true;
  el('typing-btn').disabled = true;
}

// ── FISHING GAME ──────────────────────────────
var fishingCasts = 10;
var fishingTotal = 0;

function castLine() {
  if (isCD('fishing') || fishingCasts <= 0) return;
  
  var btn = el('fishing-btn');
  btn.disabled = true;
  btn.textContent = 'Casting...';
  
  var line = el('fishing-line');
  line.style.display = 'block';
  
  setTimeout(function() {
    line.style.display = 'none';
    
    // Random catch
    var catches = [
      { name: 'Old Boot', pp: 0, emoji: '👢' },
      { name: 'Seaweed', pp: 1, emoji: '🌿' },
      { name: 'Small Fish', pp: 3, emoji: '🐟' },
      { name: 'Medium Fish', pp: 5, emoji: '🐠' },
      { name: 'Big Fish', pp: 8, emoji: '🐡' },
      { name: 'Rare Fish', pp: 12, emoji: '🦈' }
    ];
    
    var rand = Math.random();
    var caught;
    if (rand < 0.2) caught = catches[0]; // Boot
    else if (rand < 0.4) caught = catches[1]; // Seaweed
    else if (rand < 0.65) caught = catches[2]; // Small
    else if (rand < 0.85) caught = catches[3]; // Medium
    else if (rand < 0.95) caught = catches[4]; // Big
    else caught = catches[5]; // Rare
    
    fishingCasts--;
    fishingTotal += caught.pp;
    
    el('fishing-casts').textContent = fishingCasts;
    el('fishing-earned').textContent = fishingTotal;
    
    document.querySelector('.pond-text').textContent = caught.emoji + ' Caught: ' + caught.name + ' (+' + caught.pp + ' PP)';
    
    if (fishingCasts <= 0) {
      awardPP(fishingTotal, 'fishing');
      setCD('fishing');
      setTimeout(function() {
        var r = el('fishing-result');
        r.textContent = 'All casts used! +' + fishingTotal + ' PP total!';
        r.style.color = '#5dde7a';
        el('fishing-cooldown').style.display = 'block';
      }, 2000);
    } else {
      btn.disabled = false;
      btn.textContent = 'Cast Again!';
    }
  }, 1500);
}

// ── DAILY BONUS ──────────────────────────────
async function checkDailyBonus(userId) {
  // Check if daily bonus was already claimed today
  var lastClaim = localStorage.getItem('daily_bonus_' + userId + '_' + today);
  
  if (lastClaim === 'claimed') {
    // Update sidebar button to show claimed status
    var btn = document.querySelector('.daily-bonus-btn');
    if (btn) {
      btn.textContent = '✅ Claimed Today!';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      btn.style.cursor = 'not-allowed';
    }
    return { awarded: false };
  }
  
  // Award daily bonus
  var bonusAmount = 50;
  var pr = await supabaseClient.from('players').select('pawketpoints').eq('id', userId).single();
  if (!pr.data) return { awarded: false };
  
  var newTotal = pr.data.pawketpoints + bonusAmount;
  await supabaseClient.from('players').update({ pawketpoints: newTotal }).eq('id', userId);
  
  // Mark as claimed
  localStorage.setItem('daily_bonus_' + userId + '_' + today, 'claimed');
  
  // Update sidebar button
  var btn = document.querySelector('.daily-bonus-btn');
  if (btn) {
    btn.textContent = '✅ Claimed Today!';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';
  }
  
  return { awarded: true, amount: bonusAmount, newTotal: newTotal };
}

async function claimDailyBonus() {
  if (!currentUser) {
    showToast('Please log in to claim daily bonus!');
    return;
  }
  
  var result = await checkDailyBonus(currentUser.id);
  if (result.awarded) {
    showToast('🎉 Daily Bonus! +' + result.amount + ' PP!');
    updateAllPoints(result.newTotal);
  } else {
    showToast('Daily bonus already claimed today!');
  }
}

// ── NEWS ─────────────────────────────────
async function loadSidebarNews() {
  var widget = el('sidebar-news-container');
  if (!widget) {
    console.error('[loadSidebarNews] Widget not found!');
    return;
  }
  
  console.log('[loadSidebarNews] Loading news...');
  var res = await supabaseClient.from('news').select('*').eq('is_published',true).order('published_at',{ascending:false}).limit(3);
  
  console.log('[loadSidebarNews] Result:', res);
  
  if (res.error || !res.data || !res.data.length) {
    widget.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);">No news yet!</div>';
    return;
  }
  
  widget.innerHTML = '';
  res.data.forEach(function(post){
    var date = new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {month:'short',day:'numeric'});
    var item = makeEl('div', {class:'news-item'});
    item.innerHTML = '<div class="news-date">' + date + '</div><div class="news-title">' + (post.content || 'No content') + '</div>';
    widget.appendChild(item);
  });
}

async function loadNews() {
  var container=el('news-container');
  var res=await supabaseClient.from('news').select('*').eq('is_published',true).order('published_at',{ascending:false});
  if(res.error||!res.data||!res.data.length){container.innerHTML='<div class="card" style="text-align:center;padding:56px 36px;"><div style="font-size:2.8rem;margin-bottom:14px;">&#128235;</div><h2 style="color:var(--purple-dark);margin-bottom:10px;">No news yet!</h2><p style="color:var(--text-light)">Check back soon!</p></div>';return;}
  container.innerHTML='';
  res.data.forEach(function(post){
    var date=new Date(post.published_at||post.created_at).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
    var div=makeEl('div',{class:'news-post news-card'});
    div.appendChild(makeEl('div',{class:'news-post-date news-date'},date));
    div.appendChild(makeEl('h3',{},post.title||'Untitled'));
    div.appendChild(makeEl('p',{},post.content||''));
    if(post.author)div.appendChild(makeEl('div',{class:'news-author'},'- '+post.author));
    container.appendChild(div);
  });
}

// ── TWITCH ───────────────────────────────

function linkTwitch() {
  var scope = 'user:read:email user:read:follows';
  var authUrl = 'https://id.twitch.tv/oauth2/authorize' +
    '?client_id=' + TWITCH_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(TWITCH_REDIRECT_URI) +
    '&response_type=token' +
    '&scope=' + encodeURIComponent(scope);
  window.location.href = authUrl;
}

async function handleTwitchCallback(token) {
  try {
    // Get Twitch user info
    var userResp = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Client-Id': TWITCH_CLIENT_ID,
        'Authorization': 'Bearer ' + token
      }
    });
    var userData = await userResp.json();
    
    if (!userData.data || userData.data.length === 0) {
      showPixelToast('Failed to get Twitch user info', 'error');
      return;
    }
    
    var twitchUser = userData.data[0];
    
    // Save to database
    await supabaseClient
      .from('players')
      .update({
        twitch_id: twitchUser.id,
        twitch_username: twitchUser.login,
        twitch_token: token
      })
      .eq('id', currentUser.id);
    
    showPixelToast('✅ Twitch account linked successfully!', 'success');
    
    // Track in analytics
    trackTwitchLink();
    
    // Reload the page to show linked status
    await checkTwitchLinked();
    await loadTeamShowcase();
    
  } catch(e) {
    console.error('Twitch callback error:', e);
    showPixelToast('Error linking Twitch account', 'error');
  }
}

async function initTwitchTab() {
  var hash=window.location.hash;
  if(hash&&hash.includes('access_token')){
    var params={};
    hash.substring(1).split('&').forEach(function(part){var pair=part.split('=');params[pair[0]]=decodeURIComponent(pair[1]||'');});
    var token=params['access_token'];
    if(token){
      var td = document.getElementById('token-display');
      if(td) td.value=token;
      var tb = document.getElementById('token-box');
      if(tb) tb.style.display='block';
      await handleTwitchCallback(token);
    }
    window.history.replaceState({},'',window.location.pathname);
  }
  await checkTwitchLinked();
  // Team showcase removed - loadTeamShowcase() function still exists for other uses
}

// Team members config — add new members here as they join
var TEAM_MEMBERS = [
  { name: 'Embertail', login: 'embertail', twitchUrl: 'https://twitch.tv/Embertail', petName: 'Ember' },
  { name: 'Pyxshuul',  login: 'pyxshuul',  twitchUrl: 'https://twitch.tv/Pyxshuul',  petName: 'Pyxie' },
  { name: 'Aria',      login: 'ariadoestwitch', twitchUrl: 'https://twitch.tv/ariadoestwitch', petName: 'Aria' },
  { name: 'Blushimia', login: 'realblushimia',  twitchUrl: 'https://twitch.tv/realblushimia',  petName: 'Blushimia' },
  { name: 'Cowbee',    login: 'cowbeevt',       twitchUrl: 'https://twitch.tv/cowbeevt',       petName: 'Cowbee' },
  { name: 'Kelta',     login: 'keltathepomeranian', twitchUrl: 'https://twitch.tv/keltathepomeranian', petName: 'Kelta' },
  { name: 'Jess',      login: 'teatimejess',    twitchUrl: 'https://twitch.tv/teatimejess',    petName: 'Jess' },
  { name: 'Gnarly',    login: 'gnarly_neon_smilodon', twitchUrl: 'https://twitch.tv/gnarly_neon_smilodon', petName: 'Gnarly' }
];

async function loadTeamShowcase() {
  var showcase = document.getElementById('team-showcase');
  if (!showcase) return;
  showcase.innerHTML = '';

  // Check live status for each member using Twitch API if user has linked their account
  // Falls back to showing static cards if not linked
  var liveData = {};
  try {
    var user = currentUser;
    if (user) {
      var pr = await supabaseClient.from('players').select('twitch_token').eq('id', user.id).single();
      if (pr.data && pr.data.twitch_token) {
        var logins = TEAM_MEMBERS.map(function(m){ return 'user_login='+m.login; }).join('&');
        var resp = await fetch('https://api.twitch.tv/helix/streams?' + logins, {
          headers: { 'Client-Id': TWITCH_CLIENT_ID, 'Authorization': 'Bearer ' + pr.data.twitch_token }
        });
        var data = await resp.json();
        if (data.data) {
          data.data.forEach(function(stream) {
            liveData[stream.user_login.toLowerCase()] = {
              live: true,
              viewers: stream.viewer_count,
              title: stream.title
            };
          });
        }
      }
    }
  } catch(e) { console.log('Could not check live status:', e); }

  TEAM_MEMBERS.forEach(function(member) {
    var card = document.createElement('div');
    card.className = 'team-member-card';

    // Avatar with pet image (lowercase filenames)
    var avatarDiv = document.createElement('div');
    avatarDiv.className = 'team-avatar';
    
    // Map pet names to lowercase image filenames
    var petImageMap = {
      'Ember': 'ember.png',
      'Pyxie': 'pyxie.png',
      'Aria': 'aria.png',
      'Blushimia': 'blushimia.png',
      'Cowbee': 'cowbee.png',
      'Kelta': 'kelta.png',
      'Jess': 'jess.png',
      'Gnarly': 'gnarly.png'
    };
    
    var imageName = petImageMap[member.petName] || member.petName.toLowerCase() + '.png';
    var imgSrc = 'images/pets/' + imageName;
    
    var img = document.createElement('img');
    img.src = imgSrc;
    img.alt = member.name;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
    img.onerror = function() {
      // Fallback to letter if image fails
      this.style.display = 'none';
      avatarDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;font-family:Fredoka One,cursive;font-size:2rem;color:var(--purple-dark);background:var(--purple-light);';
      avatarDiv.textContent = member.name.charAt(0);
    };
    
    avatarDiv.appendChild(img);
    card.appendChild(avatarDiv);

    card.appendChild(makeEl('div', {class:'team-name'}, member.name));

    var liveStatus = liveData[member.login.toLowerCase()];
    var badge = makeEl('span', {class: liveStatus ? 'team-live-badge live' : 'team-live-badge offline'});
    badge.textContent = liveStatus ? '&#128308; LIVE' : 'Offline';
    badge.innerHTML = liveStatus ? '&#128308; LIVE' : 'Offline';
    card.appendChild(badge);

    if (liveStatus && liveStatus.viewers) {
      card.appendChild(makeEl('div', {class:'team-viewers'}, liveStatus.viewers.toLocaleString() + ' viewers'));
    }

    if (liveStatus && liveStatus.title) {
      var title = makeEl('div', {style:'font-size:0.78rem;color:var(--text-light);line-height:1.3;max-height:36px;overflow:hidden;'});
      title.textContent = liveStatus.title;
      card.appendChild(title);
    }

    var watchBtn = makeEl('a', {href:member.twitchUrl, target:'_blank', class:'btn-watch'}, 'Watch on Twitch');
    card.appendChild(watchBtn);

    showcase.appendChild(card);
  });
}
async function checkTwitchLinked() {
  if(!currentUser)return;
  var res=await supabaseClient.from('players').select('twitch_username,twitch_id,twitch_token,twitch_follow_rewards').eq('id',currentUser.id).single();
  if(res.data&&res.data.twitch_username){
    el('twitch-not-linked').style.display='none';
    el('twitch-linked').style.display='block';
    el('twitch-username').textContent=res.data.twitch_username;
    var rewards=res.data.twitch_follow_rewards||{};
    if(rewards.embertail){var b=el('follow-ember-badge');b.textContent='Claimed';b.className='status-badge status-done';b.style.display='inline-block';}
    if(rewards.pyxshuul){var b2=el('follow-pyxs-badge');b2.textContent='Claimed';b2.className='status-badge status-done';b2.style.display='inline-block';}
  }
}

async function checkFollows() {
  var btn=el('check-follows-btn'); btn.disabled=true; btn.textContent='Checking...';
  if(!currentUser)return;
  var pr=await supabaseClient.from('players').select('twitch_id,twitch_token,pawketpoints,twitch_follow_rewards').eq('id',currentUser.id).single();
  if(!pr.data||!pr.data.twitch_token){showToast('Twitch not linked!');btn.disabled=false;btn.textContent='Check Follows';return;}
  var twitchId=pr.data.twitch_id; var token=pr.data.twitch_token;
  var rewards=pr.data.twitch_follow_rewards||{}; var earned=0;
  for(var key in STREAMER_IDS){
    if(rewards[key])continue;
    var sid=STREAMER_IDS[key]; if(sid.indexOf('TWITCH_USER_ID')!==-1)continue;
    try{
      var fr=await fetch('https://api.twitch.tv/helix/channels/followed?user_id='+twitchId+'&broadcaster_id='+sid,{headers:{'Client-Id':TWITCH_CLIENT_ID,'Authorization':'Bearer '+token}});
      var fd=await fr.json();
      if(fd.data&&fd.data.length>0){
        rewards[key]=true; earned+=50;
        var b=el('follow-'+key+'-badge');
        if(b){b.textContent='Claimed';b.className='status-badge status-done';b.style.display='inline-block';}
      } else {
        var b2=el('follow-'+key+'-badge');
        if(b2){b2.textContent='Not following';b2.className='status-badge status-pending';b2.style.display='inline-block';}
      }
    }catch(e){console.warn('Follow check error',key,e);}
  }
  var np=(pr.data.pawketpoints||0)+earned;
  await supabaseClient.from('players').update({pawketpoints:np,twitch_follow_rewards:rewards}).eq('id',currentUser.id);
  if(earned>0){updateAllPoints(np);showToast('You earned '+earned+' PP!');}
  else showToast('No new rewards. Follow our streamers!');
  btn.disabled=false; btn.textContent='Check Follows & Claim Rewards';
}

async function unlinkTwitch(){
  if(!currentUser)return;
  await supabaseClient.from('players').update({twitch_id:null,twitch_username:null,twitch_token:null}).eq('id',currentUser.id);
  el('twitch-not-linked').style.display='block';
  el('twitch-linked').style.display='none';
  showToast('Twitch unlinked.');
}
// ── REDEEM CODES ─────────────────────────────

// Clean up any leftover spooky effects on page load
function cleanupSpookyEffects() {
  var overlay = document.getElementById('spooky-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  
  // Remove any CRT scanline divs
  var allDivs = document.querySelectorAll('div');
  for (var i = 0; i < allDivs.length; i++) {
    var div = allDivs[i];
    if (div.style.animation && div.style.animation.includes('crt-flicker')) {
      if (div.parentNode) div.parentNode.removeChild(div);
    }
  }
  
  console.log('✨ Cleaned up spooky effects');
}

// Spooky effect for THEYWENTMISSING code
function triggerSpookyEffect() {
  // Add dark overlay with CRT effect
  var overlay = document.createElement('div');
  overlay.id = 'spooky-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9998;
    pointer-events: none;
    animation: spooky-fade-in 1s ease-in;
  `;
  
  // Add CRT scanlines effect
  var crtLines = document.createElement('div');
  crtLines.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.15),
      rgba(0, 0, 0, 0.15) 1px,
      transparent 1px,
      transparent 2px
    );
    z-index: 9999;
    pointer-events: none;
    animation: crt-flicker 0.1s infinite;
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(crtLines);
  
  // Play spooky audio (Piper's flute)
  try {
    // Reuse cached Piper audio instead of creating new Audio() each time
    var piperKey = 'bossNormal'; // Already in battleSounds
    if (audioCache[piperKey]) {
      var spookyAudio = audioCache[piperKey].cloneNode();
      spookyAudio.volume = 0.3;
      spookyAudio.play().catch(function(err) {
        console.log('Spooky audio failed to play:', err);
      });
    }
  } catch (err) {
    console.log('Could not load spooky audio');
  }
  
  // Remove effects after 3 seconds
  safeSetTimeout(function() {
    overlay.style.animation = 'spooky-fade-out 1s ease-out';
    crtLines.style.animation = 'spooky-fade-out 1s ease-out';
    safeSetTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (crtLines.parentNode) crtLines.parentNode.removeChild(crtLines);
    }, 1000);
  }, 3000);
  
  // Trigger Melon's spooky dialogue if on shop page (check safely)
  var shopSection = document.getElementById('section-shop');
  if (shopSection && shopSection.classList.contains('active')) {
    setTimeout(function() {
      if (typeof showSpookyDialogue === 'function') {
        showSpookyDialogue();
      }
    }, 1000);
  }
}

// Update the points counter in the redeem tab too
// We need to patch updateAllPoints to include redeem-points.
// Find your updateAllPoints function and add 'redeem-points' to the forEach array like this:
//   ['adopt-points','mypets-points','shop-points','games-points','redeem-points']

async function redeemCode() {
  if (!currentUser) return;
  var input = el('redeem-code-input');
  var btn   = el('redeem-btn');
  var errEl = el('redeem-error');
  var successPanel = el('redeem-success-panel');
  var code  = input.value.trim().toUpperCase();

  // Reset state
  errEl.classList.remove('show');
  errEl.textContent = '';
  successPanel.style.display = 'none';

  if (!code) {
    errEl.textContent = 'Please enter a code!';
    errEl.classList.add('show');
    return;
  }

  btn.textContent = 'Checking...';
  btn.disabled = true;

  try {
    // 1. Look up the promo code (case-insensitive via upper())
    var codeRes = await supabaseClient
      .from('promo_codes')
      .select('id, code, pp_reward, lore_page, description, max_uses, times_used, is_active')
      .eq('code', code)
      .eq('is_active', true)
      .single();

    if (codeRes.error || !codeRes.data) {
      errEl.textContent = 'That code doesn\'t exist or is no longer active. Check for typos!';
      errEl.classList.add('show');
      btn.textContent = '✨ Redeem!';
      btn.disabled = false;
      return;
    }

    var promo = codeRes.data;

    // CHECK: Block spooky codes if setting is OFF
    if (code === 'THEYWENTMISSING' && !playerSettings.spooky_enabled) {
      errEl.textContent = '👻 Your in-game settings prevent you from seeing this content.';
      errEl.classList.add('show');
      btn.textContent = '✨ Redeem!';
      btn.disabled = false;
      return;
    }

    // 2. Check max uses
    if (promo.max_uses !== null && promo.times_used >= promo.max_uses) {
      errEl.textContent = 'This code has been fully claimed — sorry!';
      errEl.classList.add('show');
      btn.textContent = '✨ Redeem!';
      btn.disabled = false;
      return;
    }

    // 3. Check if THIS player already redeemed it (skip for unlimited codes)
    if (promo.max_uses !== null) {
      var alreadyRes = await supabaseClient
        .from('redeemed_codes')
        .select('id')
        .eq('player_id', currentUser.id)
        .eq('code_id', promo.id)
        .maybeSingle();

      if (alreadyRes.data) {
        errEl.textContent = 'You\'ve already redeemed this code! Each code is one per account.';
        errEl.classList.add('show');
        btn.textContent = '✨ Redeem!';
        btn.disabled = false;
        return;
      }
    }

    // 4. All good — award the PP
    if (promo.pp_reward && promo.pp_reward > 0) {
      var newPoints = currentPoints + promo.pp_reward;
      var ppRes = await supabaseClient
        .from('players')
        .update({ pawketpoints: newPoints })
        .eq('id', currentUser.id);
      if (ppRes.error) throw new Error(ppRes.error.message);
      updateAllPoints(newPoints);
    }

    // 5. Log the redemption in redeemed_codes (only if max_uses is set)
    if (promo.max_uses !== null) {
      await supabaseClient.from('redeemed_codes').insert([{
        player_id: currentUser.id,
        code_id: promo.id,
        redeemed_at: new Date().toISOString()
      }]);
    }

    // 6. Increment times_used on promo_codes
    await supabaseClient
      .from('promo_codes')
      .update({ times_used: (promo.times_used || 0) + 1 })
      .eq('id', promo.id);

    // 6.5. SPOOKY EFFECT for THEYWENTMISSING code - BEFORE showing success panel
    if (code === 'THEYWENTMISSING') {
      triggerSpookyEffect();
      // Wait for spooky effect to complete before showing success
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // 7. Show success panel
    input.value = '';
    successPanel.style.display = 'block';

    var titleEl = el('redeem-success-title');
    var msgEl   = el('redeem-success-msg');
    var loreBtn = el('redeem-lore-btn');

    // 8. If it's a lore code (spooky easter egg), show the lore button
    if (promo.lore_page) {
      titleEl.textContent = '...';
      msgEl.textContent = ''; // No description shown
      loreBtn.style.display = 'inline-block';
      loreBtn.href = promo.lore_page;
      loreBtn.textContent = '🔍 Something feels... off. Click here.';
    } else {
      // Normal reward codes
      if (promo.pp_reward && promo.pp_reward > 0) {
        titleEl.textContent = '+' + promo.pp_reward + ' PawketPoints!';
        msgEl.textContent = promo.description || 'Code redeemed successfully!';
      } else {
        titleEl.textContent = 'Code Accepted.';
        msgEl.textContent = promo.description || 'Something has been unlocked...';
      }
      loreBtn.style.display = 'none';
    }

    // Reload history
    loadRedeemHistory();
    showToast('Code redeemed! 🎉');

  } catch(err) {
    errEl.textContent = 'Something went wrong: ' + err.message;
    errEl.classList.add('show');
  }

  btn.textContent = '✨ Redeem!';
  btn.disabled = false;
}

async function loadRedeemHistory() {
  var container = el('redeem-history');
  if (!currentUser) return;
  container.innerHTML = '<div class="spinner"></div>';

  var res = await supabaseClient
    .from('redeemed_codes')
    .select('redeemed_at, code_id, promo_codes(code, pp_reward, description)')
    .eq('player_id', currentUser.id)
    .order('redeemed_at', { ascending: false })
    .limit(10);

  if (res.error || !res.data || !res.data.length) {
    container.innerHTML = '<div class="redeem-empty">No codes redeemed yet!<br>Check streams and socials for codes. 🎟</div>';
    return;
  }

  container.innerHTML = '';
  res.data.forEach(function(row) {
    var promo = row.promo_codes || {};
    var date  = new Date(row.redeemed_at).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
    var item  = document.createElement('div');
    item.className = 'redeem-history-item';
    item.innerHTML =
      '<span class="rhi-code">🎟 ' + (promo.code || '???') + '</span>' +
      '<span style="flex:1;padding:0 12px;font-size:0.82rem;color:var(--text-light);">' + (promo.description || '') + '</span>' +
      (promo.pp_reward ? '<span class="rhi-pp">+' + promo.pp_reward + ' PP</span>' : '<span class="rhi-pp" style="color:var(--purple)">🔍 Lore</span>') +
      '<span class="rhi-date" style="margin-left:12px;">' + date + '</span>';
    container.appendChild(item);
  });
}


// ── BOOT ─────────────────────────────────
// Initialize new minigames
setTimeout(function() {
  drawWheel();
  
  // Check cooldowns for new games
  if (isCD('wheel')) {
    el('wheel-cooldown').style.display = 'block';
    el('wheel-btn').disabled = true;
  }
  if (isCD('whack')) {
    el('whack-cooldown').style.display = 'block';
    el('whack-btn').disabled = true;
  }
  if (isCD('shell')) {
    el('shell-cooldown').style.display = 'block';
    el('shell-btn').disabled = true;
  }
  if (isCD('typing')) {
    el('typing-cooldown').style.display = 'block';
    el('typing-btn').disabled = true;
  }
  if (isCD('fishing')) {
    el('fishing-cooldown').style.display = 'block';
    el('fishing-btn').disabled = true;
  }
}, 1000);

// ══════════════════════════════════════════════════════════════════════════
// LEADERBOARDS
// ══════════════════════════════════════════════════════════════════════════

var currentLeaderboard = 'points';
var leaderboardCache = {
  points: null,
  pets: null,
  levels: null
};

function switchLeaderboard(type) {
  currentLeaderboard = type;
  
  // Update tab styles
  var tabs = document.querySelectorAll('.leaderboard-tab');
  tabs.forEach(function(tab) {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Show correct list
  document.querySelectorAll('.leaderboard-list').forEach(function(list) {
    list.classList.remove('active');
  });
  el('leaderboard-' + type).classList.add('active');
  
  // Load data if not cached
  if (!leaderboardCache[type]) {
    loadLeaderboard(type);
  }
}

async function loadLeaderboard(type) {
  var container = el('leaderboard-' + type);
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var data;
    
    if (type === 'points') {
      // Top players by PawketPoints (top 10)
      var res = await supabaseClient
        .from('players')
        .select('id, username, pawketpoints')
        .order('pawketpoints', { ascending: false })
        .limit(10);
      
      console.log('Leaderboard points query result:', res);
      
      if (res.error) throw res.error;
      
      // Filter out players with null usernames
      data = res.data
        .filter(function(p) { return p.username != null; })
        .map(function(p) {
          return {
            username: p.username,
            value: p.pawketpoints + ' PP',
            stat: p.pawketpoints + ' PawketPoints'
          };
        });
      
        } else if (type === 'pets') {
      // Top players by pet count - query user_pets directly and group
      var petsRes = await supabaseClient
        .from('user_pets')
        .select('user_id');
      
      if (petsRes.error) throw petsRes.error;
      
      // Count pets per user
      var petCounts = {};
      petsRes.data.forEach(function(pet) {
        petCounts[pet.user_id] = (petCounts[pet.user_id] || 0) + 1;
      });
      
      // Get usernames for all users with pets
      var userIds = Object.keys(petCounts);
      
      if (userIds.length === 0) {
        data = [];
      } else {
        var usersRes = await supabaseClient
          .from('players')
          .select('id, username')
          .in('id', userIds);
        
        if (usersRes.error) throw usersRes.error;
        
        // Match usernames to pet counts and sort
        var playersWithCounts = usersRes.data.map(function(player) {
          return {
            username: player.username,
            count: petCounts[player.id] || 0,
            value: (petCounts[player.id] || 0) + ' pets',
            stat: (petCounts[player.id] || 0) + ' pets owned'
          };
        });
        
        // Sort by pet count (highest first)
        playersWithCounts.sort(function(a, b) { return b.count - a.count; });
        
        data = playersWithCounts;
      }
      
    } else if (type === 'levels') {
      // Top players by total pet levels
      var res = await supabaseClient.rpc('get_leaderboard_levels');
      
      if (res.error) {
        // Fallback if RPC doesn't exist
        var levelsRes = await supabaseClient
          .from('user_pets')
          .select('user_id, level, players(username)');
        
        if (levelsRes.error) throw levelsRes.error;
        
        var totals = {};
        levelsRes.data.forEach(function(pet) {
          var username = pet.players.username;
          totals[username] = (totals[username] || 0) + pet.level;
        });
        
        data = Object.entries(totals)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 10)
          .map(function(entry) {
            return {
              username: entry[0],
              value: 'Lvl ' + entry[1],
              stat: 'Total level: ' + entry[1]
            };
          });
      } else {
        data = res.data.map(function(p) {
          return {
            username: p.username,
            value: 'Lvl ' + p.total_level,
            stat: 'Total level: ' + p.total_level
          };
        });
      }
    }
    
    else if (type === 'badges') {
      // Top players by badge count
      // Query both tables separately to avoid foreign key issues
      var badgesRes = await supabaseClient
        .from('user_badges')
        .select('user_id');
      
      if (badgesRes.error) throw badgesRes.error;
      
      // Count badges per user
      var badgeCounts = {};
      badgesRes.data.forEach(function(badge) {
        badgeCounts[badge.user_id] = (badgeCounts[badge.user_id] || 0) + 1;
      });
      
      // Get usernames for users with badges
      var userIds = Object.keys(badgeCounts);
      var usersRes = await supabaseClient
        .from('players')
        .select('id, username')
        .in('id', userIds);
      
      if (usersRes.error) throw usersRes.error;
      
      // Build leaderboard data
      data = usersRes.data
        .map(function(user) {
          return {
            username: user.username,
            count: badgeCounts[user.id],
            value: badgeCounts[user.id] + ' badges',
            stat: badgeCounts[user.id] + ' badges earned'
          };
        })
        .sort(function(a, b) { return b.count - a.count; })
        .slice(0, 10);
    }
    
    // Cache the data
    leaderboardCache[type] = data;
    
    // Render leaderboard
    if (data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No data yet! Be the first! 🌟</p></div>';
      return;
    }
    
    var html = '';
    data.forEach(function(player, index) {
      // Skip players with null/undefined username
      if (!player.username) {
        console.warn('Skipping player with null username:', player);
        return;
      }
      
      var rank = index + 1;
      var rankClass = '';
      var rankEmoji = rank + '.';
      
      if (rank === 1) {
        rankClass = 'top1';
        rankEmoji = '🥇';
      } else if (rank === 2) {
        rankClass = 'top2';
        rankEmoji = '🥈';
      } else if (rank === 3) {
        rankClass = 'top3';
        rankEmoji = '🥉';
      }
      
      html += '<div class="leaderboard-item" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">';
      html += '  <div class="leaderboard-rank ' + rankClass + '">' + rankEmoji + '</div>';
      html += '  <div class="leaderboard-avatar">' + player.username.charAt(0).toUpperCase() + '</div>';
      html += '  <div class="leaderboard-info">';
      html += '    <div class="leaderboard-username">' + escapeHtml(player.username) + '</div>';
      html += '    <div class="leaderboard-stats">' + player.stat + '</div>';
      html += '  </div>';
      html += '  <div class="leaderboard-value">' + player.value + '</div>';
      html += '</div>';
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Failed to load leaderboard: ' + err.message + '</p></div>';
  }
}

function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Load points leaderboard when tab is opened
tabsLoaded.leaderboard = function() {
  if (!leaderboardCache.points) {
    loadLeaderboard('points');
  }
};

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC PROFILES
// ══════════════════════════════════════════════════════════════════════════

function viewProfile(username) {
  // Store the username and show profile tab
  window.currentProfileUsername = username;
  showTab('profile');
}

async function loadProfile(username) {
  console.log('[loadProfile] Starting for username:', username);
  
  // Set loading states immediately
  el('profile-username').textContent = 'Loading...';
  el('profile-pet-count').textContent = '...';
  el('profile-total-level').textContent = '...';
  el('profile-rank').textContent = '...';
  el('profile-badge-count').textContent = '...';
  el('profile-pets-grid').innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get profile data
    console.log('[loadProfile] Calling RPC get_player_profile...');
    var profileRes = await supabaseClient.rpc('get_player_profile', { p_username: username });
    
    console.log('[loadProfile] RPC result:', profileRes);
    
    if (profileRes.error || !profileRes.data || profileRes.data.length === 0) {
      console.log('Using fallback query, RPC error:', profileRes.error);
      // Fallback if RPC doesn't exist
      var playerRes = await supabaseClient
        .from('players')
        .select('id, username, pawketpoints, created_at, bio')
        .ilike('username', username)
        .single();
      
      console.log('Player query result:', playerRes);
      
      if (playerRes.error) {
        console.error('Player query failed:', playerRes.error);
        throw new Error('Player "' + username + '" not found. Error: ' + playerRes.error.message);
      }
      
      if (!playerRes.data) {
        throw new Error('Player "' + username + '" does not exist in the database.');
      }
      
      var player = playerRes.data;
      
      // Get pet stats separately
      var petsRes = await supabaseClient
        .from('user_pets')
        .select('level')
        .eq('user_id', player.id);
      
      console.log('Pets query result:', petsRes);
      
      var totalPets = petsRes.data ? petsRes.data.length : 0;
      var totalLevels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + p.level; }, 0) : 0;
      var highestLevel = petsRes.data && petsRes.data.length > 0 ? Math.max(...petsRes.data.map(function(p) { return p.level; })) : 0;
      
      profileRes.data = [{
        id: player.id,
        username: player.username,
        pawketpoints: player.pawketpoints,
        created_at: player.created_at,
        bio: player.bio,
        total_pets: totalPets,
        total_levels: totalLevels,
        highest_level: highestLevel
      }];
    }
    
    var profile = profileRes.data[0];
    console.log('Final profile data:', profile);
    
    // If RPC didn't include pet stats, calculate them
    if (profile.total_pets === undefined || profile.total_pets === null) {
      console.log('Pet stats missing, calculating manually...');
      var petsRes = await supabaseClient
        .from('user_pets')
        .select('level')
        .eq('user_id', profile.id);
      
      console.log('Manual pets query:', petsRes);
      
      profile.total_pets = petsRes.data ? petsRes.data.length : 0;
      profile.total_levels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + (p.level || 0); }, 0) : 0;
    }
    
    // Update UI
    console.log('[loadProfile] Updating UI with profile data:', profile);
    el('profile-avatar').textContent = profile.username.charAt(0).toUpperCase();
    el('profile-username').textContent = profile.username;
    el('profile-bio').textContent = profile.bio || 'No bio yet';
    
    // Load and display player title if they have one
    try {
      var titleRes = await supabaseClient
        .from('players')
        .select('active_player_title_id, player_titles(*)')
        .eq('id', profile.id)
        .single();
      
      if (titleRes.data && titleRes.data.active_player_title_id && titleRes.data.player_titles) {
        var title = titleRes.data.player_titles;
        var rarityColors = {
          'Common': '#8e8e8e',
          'Uncommon': '#5cb85c',
          'Rare': '#5bc0de',
          'Epic': '#9c27b0',
          'Legendary': '#ff9800'
        };
        var color = title.color || rarityColors[title.rarity] || '#8e8e8e';
        var titleBadge = '<div class="player-title-badge" style="color: ' + color + '; font-size: 1.1rem; margin-top: 8px; font-weight: 600;">' +
          title.icon + ' ' + title.display_name +
          '</div>';
        el('profile-username').innerHTML = profile.username + titleBadge;
      }
    } catch (titleErr) {
      console.log('[loadProfile] Could not load player title:', titleErr);
    }
    
    var joinDate = new Date(profile.created_at);
    el('profile-joined').textContent = 'Joined: ' + joinDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    console.log('[loadProfile] Setting stats - Points:', profile.pawketpoints, 'Pets:', profile.total_pets, 'Levels:', profile.total_levels);
    el('profile-points').textContent = (profile.pawketpoints || 0).toLocaleString();
    el('profile-pet-count').textContent = profile.total_pets || 0;
    el('profile-total-level').textContent = profile.total_levels || 0;
    
    // Get their rank
    var rankRes = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .order('pawketpoints', { ascending: false });
    
    if (!rankRes.error && rankRes.data) {
      var rank = rankRes.data.findIndex(function(p) { return p.pawketpoints <= profile.pawketpoints; }) + 1;
      el('profile-rank').textContent = '#' + rank;
    } else {
      el('profile-rank').textContent = '-';
    }
    
    // Load their pets
    var petsGrid = el('profile-pets-grid');
    petsGrid.innerHTML = '<div class="spinner"></div>';
    
    console.log('[loadProfile] Loading pets for user_id:', profile.id);
    
    var petsRes = await supabaseClient
      .from('user_pets')
      .select('*, pets(name, image_file, vtuber_name)')
      .eq('user_id', profile.id)
      .order('adopted_at', { ascending: true });
    
    console.log('[loadProfile] Pets query result:', petsRes);
    
    if (petsRes.error) throw petsRes.error;
    
    if (petsRes.data.length === 0) {
      petsGrid.innerHTML = '<div class="empty-state"><p>No pets yet! 🐾</p></div>';
      return;
    }
    
    // Render pets
    var html = '';
    petsRes.data.forEach(function(userPet) {
      var pet = userPet.pets;
      var mood = getPetMood(userPet.hunger, userPet.energy, userPet.happiness);
      var displayName = userPet.nickname || pet.name;
      
      html += '<div class="pet-card">';
      html += '  <div class="pet-card-image">';
      html += '    <img src="images/pets/' + pet.image_file + '" alt="' + pet.name + '" />';
      html += '  </div>';
      html += '  <div class="pet-card-body">';
      html += '    <div class="pet-card-header">';
      html += '      <h3>' + escapeHtml(displayName) + '</h3>';
      html += '      <span class="pet-level">Lv ' + userPet.level + '</span>';
      html += '    </div>';
      html += '    <div class="pet-mood-display" style="border-color: ' + mood.color + '; background: ' + mood.color + '22;">';
      html += '      <span style="font-size: 1.2rem;">' + mood.emoji + '</span>';
      html += '      <span>Mood: ' + mood.mood + '</span>';
      html += '    </div>';
      html += '  </div>';
      html += '</div>';
    });
    
    petsGrid.innerHTML = html;
    
    // Load badges
    await loadProfileBadges(profile.id);
    
  } catch (err) {
    el('profile-username').textContent = 'Error loading profile';
    el('profile-pets-grid').innerHTML = '<div class="empty-state"><p>' + err.message + '</p></div>';
  }
}

// Load profile when tab is opened
tabsLoaded.profile = function() {
  if (window.currentProfileUsername) {
    loadProfile(window.currentProfileUsername);
  }
};

// ══════════════════════════════════════════════════════════════
// MY PROFILE (Edit Own Profile)
// ══════════════════════════════════════════════════════════════

async function loadMyProfile() {
  console.log('[loadMyProfile] Starting...');
  if (!currentUser) {
    console.error('[loadMyProfile] No currentUser!');
    return;
  }
  
  try {
    console.log('[loadMyProfile] Fetching player data for user:', currentUser.id);
    // Get player data
    var res = await supabaseClient
      .from('players')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    
    console.log('[loadMyProfile] Player data result:', res);
    
    if (res.error) throw res.error;
    var player = res.data;
    
    // Get pet count and levels
    var petsRes = await supabaseClient
      .from('user_pets')
      .select('level')
      .eq('user_id', currentUser.id);
    
    var totalPets = petsRes.data ? petsRes.data.length : 0;
    var totalLevels = petsRes.data ? petsRes.data.reduce(function(sum, p) { return sum + p.level; }, 0) : 0;
    
    // Update preview
    var username = player.username || 'User';
    el('myprofile-avatar-preview').textContent = username.charAt(0).toUpperCase();
    el('myprofile-username-preview').textContent = username;
    el('myprofile-bio-preview').textContent = player.bio || 'No bio yet';
    
    // Add player title to preview if active
    var titleDisplay = getPlayerTitleDisplay(currentUser.id);
    if (titleDisplay) {
      var usernameEl = el('myprofile-username-preview');
      usernameEl.innerHTML = username + titleDisplay;
    }
    
    var joinDate = new Date(player.created_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    el('myprofile-joined-preview').textContent = 'Joined: ' + joinDate;
    
    // Update form
    el('edit-username').value = username;
    el('edit-bio').value = player.bio || '';
    
    // Render player title selector
    renderPlayerTitleSelector('player-title-selector-container');
    
    // Update stats
    el('myprofile-points').textContent = player.pawketpoints || 0;
    el('myprofile-pets').textContent = totalPets;
    el('myprofile-levels').textContent = totalLevels;
    
    // Get rank from leaderboard
    var rankRes = await supabaseClient
      .from('players')
      .select('id, pawketpoints')
      .order('pawketpoints', { ascending: false });
    
    if (rankRes.data) {
      var rank = rankRes.data.findIndex(function(p) { return p.id === currentUser.id; }) + 1;
      el('myprofile-rank').textContent = rank > 0 ? '#' + rank : '-';
    }
    
    // Load badges
    console.log('[loadMyProfile] About to load badges...');
    try {
      await loadMyProfileBadges();
      console.log('[loadMyProfile] Badges loaded successfully');
    } catch (badgeErr) {
      console.error('[loadMyProfile] Error loading badges:', badgeErr);
    }
    
  } catch (err) {
    console.error('Error loading profile:', err);
    el('myprofile-username-preview').textContent = 'Error loading profile';
    el('myprofile-joined-preview').textContent = 'Please refresh the page';
  }
}

async function loadMyProfileBadges() {
  console.log('[loadMyProfileBadges] Function called!');
  var badgesGrid = el('myprofile-badges-grid');
  console.log('[loadMyProfileBadges] Badge grid element:', badgesGrid);
  
  if (!badgesGrid) {
    console.error('[loadMyProfileBadges] Grid element not found!');
    return;
  }
  
  badgesGrid.innerHTML = '<div class="spinner"></div>';
  
  // Get all badges
  var allBadgesRes = await supabaseClient
    .from('badges')
    .select('*')
    .order('sort_order', { ascending: true });
  
  // Get user's earned badges
  var earnedRes = await supabaseClient
    .from('user_badges')
    .select('badge_id, earned_at, badges(*)')
    .eq('user_id', currentUser.id);
  
  if (allBadgesRes.error || earnedRes.error) {
    badgesGrid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Error loading badges</p>';
    return;
  }
  
  var allBadges = allBadgesRes.data;
  var earnedBadgeIds = earnedRes.data.map(b => b.badge_id);
  var earnedBadgesMap = {};
  earnedRes.data.forEach(b => {
    earnedBadgesMap[b.badge_id] = b.earned_at;
  });
  
  // Update badge count
  el('myprofile-badges').textContent = earnedBadgeIds.length;
  
  badgesGrid.innerHTML = '';
  
  allBadges.forEach(function(badge) {
    var isEarned = earnedBadgeIds.includes(badge.id);
    var card = makeEl('div', { class: 'badge-card' + (isEarned ? '' : ' locked') });
    
    if (badge.rarity && badge.rarity !== 'common') {
      var rarityBadge = makeEl('div', { class: 'badge-rarity ' + badge.rarity });
      rarityBadge.textContent = badge.rarity;
      card.appendChild(rarityBadge);
    }
    
    var icon = makeEl('div', { class: 'badge-icon' });
    icon.textContent = badge.icon;
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'badge-name' });
    name.textContent = isEarned ? badge.name : '???';
    card.appendChild(name);
    
    var desc = makeEl('div', { class: 'badge-description' });
    desc.textContent = isEarned ? badge.description : 'Not yet earned';
    card.appendChild(desc);
    
    if (isEarned && earnedBadgesMap[badge.id]) {
      var earnedDate = new Date(earnedBadgesMap[badge.id]);
      var dateStr = earnedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var dateEl = makeEl('div', { class: 'badge-earned-date' });
      dateEl.textContent = 'Earned ' + dateStr;
      card.appendChild(dateEl);
    }
    
    badgesGrid.appendChild(card);
  });
}

async function saveProfile() {
  if (!currentUser) return;
  
  var errorEl = el('profile-edit-error');
  var successEl = el('profile-edit-success');
  var saveBtn = el('save-profile-btn');
  
  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  
  // Show loading state
  var originalBtnText = saveBtn.innerHTML;
  saveBtn.innerHTML = '⏳ Saving...';
  saveBtn.disabled = true;
  saveBtn.style.opacity = '0.6';
  
  var newUsername = el('edit-username').value.trim();
  var newBio = el('edit-bio').value.trim();
  
  // Validation
  if (!newUsername) {
    errorEl.textContent = 'Username cannot be empty!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (newUsername.length > 20) {
    errorEl.textContent = 'Username must be 20 characters or less!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(newUsername)) {
    errorEl.textContent = 'Username can only contain letters, numbers, and underscores!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  if (newBio.length > 200) {
    errorEl.textContent = 'Bio must be 200 characters or less!';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  // Check for profanity in username
  if (containsProfanity(newUsername)) {
    errorEl.textContent = 'Name cannot contain offensive language';
    errorEl.style.display = 'block';
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    return;
  }
  
  try {
    // Check if username is taken (if changed)
    var currentUsername = el('myprofile-username-preview').textContent;
    if (newUsername !== currentUsername) {
      var checkRes = await supabaseClient
        .from('players')
        .select('id')
        .ilike('username', newUsername)
        .neq('id', currentUser.id);
      
      if (checkRes.data && checkRes.data.length > 0) {
        errorEl.textContent = 'Username "' + newUsername + '" is already taken!';
        errorEl.style.display = 'block';
        saveBtn.innerHTML = originalBtnText;
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
        return;
      }
    }
    
    // Update username and bio
    var updateRes = await supabaseClient
      .from('players')
      .update({ username: newUsername, bio: newBio })
      .eq('id', currentUser.id);
    
    if (updateRes.error) throw updateRes.error;
    
    // Update preview
    el('myprofile-username-preview').textContent = newUsername;
    el('myprofile-avatar-preview').textContent = newUsername.charAt(0).toUpperCase();
    el('myprofile-bio-preview').textContent = newBio || 'No bio yet';
    
    // Update header
    el('nav-user').textContent = newUsername;
    
    // Restore button state
    saveBtn.innerHTML = '✅ Saved!';
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    
    // Reset button after 2 seconds
    setTimeout(function() {
      saveBtn.innerHTML = originalBtnText;
    }, 2000);
    
    // Show success message with animation
    successEl.innerHTML = '✅ <strong>Profile saved successfully!</strong> Your changes are now visible.';
    successEl.style.display = 'block';
    successEl.style.animation = 'none';
    setTimeout(function() {
      successEl.style.animation = 'slideInDown 0.3s ease-out';
    }, 10);
    
    // Scroll to success message
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Hide success message after 5 seconds
    setTimeout(function() {
      successEl.style.opacity = '0';
      successEl.style.transition = 'opacity 0.3s ease-out';
      setTimeout(function() {
        successEl.style.display = 'none';
        successEl.style.opacity = '1';
      }, 300);
    }, 5000);
    
  } catch (err) {
    console.error('Error saving profile:', err);
    errorEl.textContent = 'Failed to save profile: ' + err.message;
    errorEl.style.display = 'block';
    
    // Restore button state
    saveBtn.innerHTML = originalBtnText;
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
  }
}

async function viewMyPublicProfile() {
  if (!currentUser) return;
  
  // Get username from database instead of preview element
  var res = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  if (res.data && res.data.username) {
    viewProfile(res.data.username);
  }
}

// Load profile data when tab is shown
tabsLoaded.myprofile = function() {
  loadMyProfile();
};

initApp();

async function loadProfileBadges(userId) {
  var badgesGrid = el('profile-badges-grid');
  badgesGrid.innerHTML = '<div class="spinner"></div>';
  
  var earnedRes = await supabaseClient
    .from('user_badges')
    .select('badge_id, earned_at, badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false});
  
  if (earnedRes.error) {
    badgesGrid.innerHTML = '<p style="text-align:center;color:var(--text-light);">Error loading badges</p>';
    return;
  }
  
  console.log('[loadProfileBadges] Loading badges for userId:', userId);
  console.log('[loadProfileBadges] Found', earnedRes.data.length, 'badges');
  
  el('profile-badge-count').textContent = earnedRes.data.length;
  
  if (earnedRes.data.length === 0) {
    badgesGrid.innerHTML = '<div class="empty-state"><p>No badges earned yet! 🎖️</p></div>';
    return;
  }
  
  badgesGrid.innerHTML = '';
  
  earnedRes.data.forEach(function(userBadge) {
    var badge = userBadge.badges;
    var card = makeEl('div', { class: 'badge-card' });
    
    if (badge.rarity && badge.rarity !== 'common') {
      var rarityBadge = makeEl('div', { class: 'badge-rarity ' + badge.rarity });
      rarityBadge.textContent = badge.rarity;
      card.appendChild(rarityBadge);
    }
    
    var icon = makeEl('div', { class: 'badge-icon' });
    icon.textContent = badge.icon;
    card.appendChild(icon);
    
    var name = makeEl('div', { class: 'badge-name' });
    name.textContent = badge.name;
    card.appendChild(name);
    
    var desc = makeEl('div', { class: 'badge-description' });
    desc.textContent = badge.description;
    card.appendChild(desc);
    
    var earnedDate = new Date(userBadge.earned_at);
    var dateStr = earnedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var dateEl = makeEl('div', { class: 'badge-earned-date' });
    dateEl.textContent = 'Earned ' + dateStr;
    card.appendChild(dateEl);
    
    badgesGrid.appendChild(card);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// EQUIPMENT SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var currentEquipmentFilter = 'all';


async function buyEquipment(equipmentId, equipmentName, price) {
  if (!currentUser) return;
  if (currentPoints < price) {
    showToast('Not enough PawketPoints!');
    return;
  }
  
  // Deduct points
  var newPoints = currentPoints - price;
  
  // Get current total_spent
  var playerRes = await supabaseClient.from('players').select('total_spent').eq('id', currentUser.id).single();
  var newTotalSpent = (playerRes.data?.total_spent || 0) + price;
  
  var updateRes = await supabaseClient
    .from('players')
    .update({ 
      pawketpoints: newPoints,
      total_spent: newTotalSpent
    })
    .eq('id', currentUser.id);
  
  if (updateRes.error) {
    showToast('Error deducting points!');
    return;
  }
  
  // Check spending badges
  if (newTotalSpent >= 500) {
    await awardBadge('mega_spender');
  } else if (newTotalSpent >= 100) {
    await awardBadge('big_spender');
  }
  
  // Add to player equipment
  var existingRes = await supabaseClient
    .from('player_equipment')
    .select('id, quantity')
    .eq('user_id', currentUser.id)
    .eq('equipment_id', equipmentId)
    .limit(1);
  
  if (existingRes.data && existingRes.data.length > 0) {
    // Already owns - increase quantity
    await supabaseClient
      .from('player_equipment')
      .update({ quantity: existingRes.data[0].quantity + 1 })
      .eq('id', existingRes.data[0].id);
  } else {
    // New purchase
    var insertRes = await supabaseClient
      .from('player_equipment')
      .insert([{ 
        user_id: currentUser.id, 
        equipment_id: equipmentId,
        quantity: 1
      }]);
    
    if (insertRes.error) {
      showToast('Purchase failed!');
      return;
    }
  }
  
  // Track stats (for new stats system)
  trackStat('items_purchased', 1);
  trackStat('pp_spent', price);
  trackStat('total_items_purchased', 1, true);
  
  updateAllPoints(newPoints);
  showToast('Bought ' + equipmentName + '!');
  loadEquipmentShop();
}

function filterEquipment(type, evt) {
  currentEquipmentFilter = type;
  
  // Update active tab
  var tabs = document.querySelectorAll('.filter-tab');
  tabs.forEach(function(tab) {
    tab.classList.remove('active');
  });
  if (evt && evt.target) evt.target.classList.add('active');
  
  loadEquipmentShop();
}

async function loadPetEquipment(petId) {
  // Get equipped items for this pet
  var res = await supabaseClient
    .from('player_equipment')
    .select('equipment_id, equipped_slot, equipment(*)')
    .eq('user_id', currentUser.id)
    .eq('is_equipped', true);
  
  if (res.error) return { weapon: null, armor: null };
  
  var weapon = null;
  var armor = null;
  
  res.data.forEach(function(item) {
    if (item.equipped_slot === 'weapon') {
      weapon = item.equipment;
    } else if (item.equipped_slot === 'armor') {
      armor = item.equipment;
    }
  });
  
  return { weapon: weapon, armor: armor };
}

async function showEquipmentModal(petId) {
  console.log('=== EQUIPMENT MODAL DEBUG ===');
  console.log('Opening equipment modal for pet:', petId);
  
  try {
    // Get pet's current equipment
    var equipped = await loadPetEquipment(petId);
    console.log('Currently equipped:', equipped);
    
    // Get all owned equipment
    var allEquipRes = await supabaseClient
      .from('player_equipment')
      .select('*, equipment(*)')
      .eq('user_id', currentUser.id)
      .gt('quantity', 0);
    
    console.log('All owned equipment:', allEquipRes);
    
    if (allEquipRes.error) {
      console.error('Error loading equipment:', allEquipRes.error);
      showToast('Error loading equipment!');
      return;
    }
    
    var ownedEquipment = allEquipRes.data || [];
  
  console.log('Creating modal...');
  
  // Create modal with !important inline styles to override any CSS
  var modal = makeEl('div', { class: 'equipment-modal-dynamic' });
  modal.style.cssText = 'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;bottom:0 !important;width:100vw !important;height:100vh !important;background:rgba(0,0,0,0.8) !important;display:flex !important;align-items:center !important;justify-content:center !important;z-index:999999 !important;';
  modal.id = 'equipment-modal-' + Date.now();
  console.log('Modal overlay created:', modal);
  console.log('Modal styles:', modal.style.cssText);
  
  modal.onclick = function(e) { 
    if (e.target === modal) {
      document.body.removeChild(modal); 
    }
  };
  
  var modalContent = makeEl('div', { class: 'equipment-modal-content' });
  modalContent.style.cssText = 'background:var(--cream) !important;color:var(--text) !important;border-radius:16px !important;padding:30px !important;max-width:600px !important;width:90% !important;max-height:80vh !important;overflow-y:auto !important;box-shadow:0 8px 32px rgba(0,0,0,0.3) !important;position:relative !important;z-index:1000000 !important;display:block !important;border:3px solid var(--purple) !important;';
  modalContent.onclick = function(e) { e.stopPropagation(); };
  
  var title = makeEl('h2');
  title.textContent = 'Manage Equipment';
  title.style.cssText = 'color:var(--purple);margin:0 0 20px 0;font-family:Chewy,cursive;';
  modalContent.appendChild(title);
  
  console.log('Modal content created');
  
  // Equipment slots display
  var slotsDiv = makeEl('div', { class: 'equipment-slots' });
  
  // Weapon slot
  var weaponSlot = makeEl('div', { class: 'equipment-slot' + (equipped.weapon ? ' equipped' : '') });
  var weaponLabel = makeEl('div', { class: 'equipment-slot-label' });
  weaponLabel.textContent = '⚔️ Weapon';
  weaponSlot.appendChild(weaponLabel);
  
  if (equipped.weapon) {
    var weaponIcon = makeEl('div', { class: 'equipment-slot-icon' });
    weaponIcon.textContent = '⚔️';
    weaponSlot.appendChild(weaponIcon);
    
    var weaponName = makeEl('div', { class: 'equipment-slot-name' });
    weaponName.textContent = equipped.weapon.name;
    weaponSlot.appendChild(weaponName);
    
    // Show stat bonuses
    var bonuses = [];
    if (equipped.weapon.attack_bonus) bonuses.push('+' + equipped.weapon.attack_bonus + ' ATK');
    if (equipped.weapon.defense_bonus) bonuses.push('+' + equipped.weapon.defense_bonus + ' DEF');
    if (equipped.weapon.speed_bonus) bonuses.push('+' + equipped.weapon.speed_bonus + ' SPD');
    if (equipped.weapon.hp_bonus) bonuses.push('+' + equipped.weapon.hp_bonus + ' HP');
    if (bonuses.length > 0) {
      var bonusText = makeEl('div', { class: 'equipment-slot-bonus' });
      bonusText.style.cssText = 'font-size:0.75rem;color:var(--text-light);margin-top:4px;';
      bonusText.textContent = bonuses.join(', ');
      weaponSlot.appendChild(bonusText);
    }
    
    var unequipBtn = makeEl('button', { class: 'btn btn-sm btn-unequip' });
    unequipBtn.textContent = 'Unequip';
    unequipBtn.onclick = function() { 
      unequipItem('weapon');
      document.body.removeChild(modal);
    };
    weaponSlot.appendChild(unequipBtn);
  } else {
    var emptyText = makeEl('div', { class: 'equipment-slot-empty' });
    emptyText.textContent = 'No weapon equipped';
    weaponSlot.appendChild(emptyText);
  }
  slotsDiv.appendChild(weaponSlot);
  
  // Armor slot
  var armorSlot = makeEl('div', { class: 'equipment-slot' + (equipped.armor ? ' equipped' : '') });
  var armorLabel = makeEl('div', { class: 'equipment-slot-label' });
  armorLabel.textContent = '🛡️ Armor';
  armorSlot.appendChild(armorLabel);
  
  if (equipped.armor) {
    var armorIcon = makeEl('div', { class: 'equipment-slot-icon' });
    armorIcon.textContent = '🛡️';
    armorSlot.appendChild(armorIcon);
    
    var armorName = makeEl('div', { class: 'equipment-slot-name' });
    armorName.textContent = equipped.armor.name;
    armorSlot.appendChild(armorName);
    
    // Show stat bonuses
    var bonuses = [];
    if (equipped.armor.attack_bonus) bonuses.push('+' + equipped.armor.attack_bonus + ' ATK');
    if (equipped.armor.defense_bonus) bonuses.push('+' + equipped.armor.defense_bonus + ' DEF');
    if (equipped.armor.speed_bonus) bonuses.push('+' + equipped.armor.speed_bonus + ' SPD');
    if (equipped.armor.hp_bonus) bonuses.push('+' + equipped.armor.hp_bonus + ' HP');
    if (bonuses.length > 0) {
      var bonusText = makeEl('div', { class: 'equipment-slot-bonus' });
      bonusText.style.cssText = 'font-size:0.75rem;color:var(--text-light);margin-top:4px;';
      bonusText.textContent = bonuses.join(', ');
      armorSlot.appendChild(bonusText);
    }
    
    var unequipBtn2 = makeEl('button', { class: 'btn btn-sm btn-unequip' });
    unequipBtn2.textContent = 'Unequip';
    unequipBtn2.onclick = function() { 
      unequipItem('armor');
      document.body.removeChild(modal);
    };
    armorSlot.appendChild(unequipBtn2);
  } else {
    var emptyText2 = makeEl('div', { class: 'equipment-slot-empty' });
    emptyText2.textContent = 'No armor equipped';
    armorSlot.appendChild(emptyText2);
  }
  slotsDiv.appendChild(armorSlot);
  
  modalContent.appendChild(slotsDiv);
  
  // List available equipment to equip
  var availableTitle = makeEl('h3');
  availableTitle.textContent = 'Available Equipment';
  availableTitle.style.cssText = 'margin-top:20px;color:var(--purple);font-family:Chewy,cursive;';
  modalContent.appendChild(availableTitle);
  
  var equipGrid = makeEl('div', { class: 'shop-grid' });
  
  if (ownedEquipment.length === 0) {
    // No equipment owned - show helpful message
    var emptyState = makeEl('div');
    emptyState.style.cssText = 'text-align:center;padding:40px 20px;background:rgba(153,102,255,0.1);border-radius:12px;margin:20px 0;';
    
    var emptyIcon = makeEl('div');
    emptyIcon.style.fontSize = '4rem';
    emptyIcon.textContent = '🛡️';
    emptyState.appendChild(emptyIcon);
    
    var emptyText = makeEl('p');
    emptyText.style.cssText = 'color:var(--purple);font-size:1.1rem;margin:16px 0 8px 0;';
    emptyText.textContent = 'You don\'t own any equipment yet!';
    emptyState.appendChild(emptyText);
    
    var emptySubtext = makeEl('p');
    emptySubtext.style.cssText = 'color:var(--text-light);font-size:0.9rem;margin-bottom:20px;';
    emptySubtext.textContent = 'Visit the Equipment Shop to buy weapons and armor for your pets.';
    emptyState.appendChild(emptySubtext);
    
    var shopBtn = makeEl('button', { class: 'btn btn-primary' });
    shopBtn.textContent = '🛒 Go to Equipment Shop';
    shopBtn.onclick = function() {
      document.body.removeChild(modal);
      showTab('shop');
      showShopTab('equipment');
    };
    emptyState.appendChild(shopBtn);
    
    equipGrid.appendChild(emptyState);
  } else {
    // Has equipment - show list
    ownedEquipment.forEach(function(playerEquip) {
      var item = playerEquip.equipment;
      var card = makeEl('div', { class: 'equipment-card' });
      card.style.cssText = 'font-size:0.85rem;padding:15px;border:2px solid var(--purple-light);border-radius:12px;text-align:center;';
      
      var icon = makeEl('div', { class: 'equipment-icon' });
      icon.style.fontSize = '2.5rem';
      icon.textContent = item.equipment_type === 'weapon' ? '⚔️' : '🛡️';
      card.appendChild(icon);
      
      var name = makeEl('div', { class: 'equipment-name' });
      name.style.cssText = 'font-weight:bold;color:var(--purple);margin:8px 0;';
      name.textContent = item.name;
      card.appendChild(name);
      
      // Show stat bonuses
      var bonuses = [];
      if (item.attack_bonus) bonuses.push('+' + item.attack_bonus + ' ATK');
      if (item.defense_bonus) bonuses.push('+' + item.defense_bonus + ' DEF');
      if (item.speed_bonus) bonuses.push('+' + item.speed_bonus + ' SPD');
      if (item.hp_bonus) bonuses.push('+' + item.hp_bonus + ' HP');
      if (bonuses.length > 0) {
        var bonusDiv = makeEl('div', { class: 'equipment-bonuses' });
        bonusDiv.style.cssText = 'font-size:0.75rem;color:#5dde7a;margin:8px 0;';
        bonusDiv.textContent = bonuses.join(', ');
        card.appendChild(bonusDiv);
      }
      
      var equipBtn = makeEl('button', { class: 'btn btn-sm btn-primary' });
      equipBtn.textContent = 'Equip';
      equipBtn.style.marginTop = '10px';
      equipBtn.onclick = function() { 
        equipItem(playerEquip.id, item.equipment_type);
        document.body.removeChild(modal);
      };
      card.appendChild(equipBtn);
      
      equipGrid.appendChild(card);
    });
  }
  
  modalContent.appendChild(equipGrid);
  
  var closeBtn = makeEl('button', { class: 'btn btn-outline' });
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '20px';
  closeBtn.onclick = function() { document.body.removeChild(modal); };
  modalContent.appendChild(closeBtn);
  
  console.log('About to append modal to body...');
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  console.log('Modal appended! Should be visible now.');
  console.log('Modal element in DOM:', document.getElementById(modal.id));
  console.log('Modal computed style display:', window.getComputedStyle(modal).display);
  console.log('Modal computed style z-index:', window.getComputedStyle(modal).zIndex);
  } catch (error) {
    console.error('Error in showEquipmentModal:', error);
    showToast('Error opening equipment manager!');
  }
}

async function equipItem(playerEquipmentId, equipmentType) {
  // Unequip any existing item in that slot
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: false, equipped_slot: null })
    .eq('user_id', currentUser.id)
    .eq('equipped_slot', equipmentType);
  
  // Equip new item
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: true, equipped_slot: equipmentType })
    .eq('id', playerEquipmentId);
  
  showToast('Equipment equipped!');
  tabsLoaded['mypets'] = false;
  loadMyPets();
}

async function unequipItem(slot) {
  await supabaseClient
    .from('player_equipment')
    .update({ is_equipped: false, equipped_slot: null })
    .eq('user_id', currentUser.id)
    .eq('equipped_slot', slot);
  
  showToast('Equipment unequipped!');
  tabsLoaded['mypets'] = false;
  loadMyPets();
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM - Auto-Battle Engine
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate pet's total stats including equipment bonuses
 */
async function calculatePetStats(petId) {
  // Get pet base stats including special skill
  var petRes = await supabaseClient
    .from('user_pets')
    .select('*, pets!inner(name, image_file, special_skill)')
    .eq('id', petId)
    .single();
  
  if (petRes.error) return null;
  
  var pet = petRes.data;
  
  // Determine evolution stage based on level
  var evolutionStage = getEvolutionStage(pet.level);
  var evolutionBonuses = getEvolutionBonuses(evolutionStage);
  
  // Calculate max HP from base + evolution + equipment
  var maxHP = (pet.base_hp || 30) + evolutionBonuses.hp;
  
  // Get equipped items
  var equipRes = await supabaseClient
    .from('player_equipment')
    .select('equipment(*)')
    .eq('user_id', currentUser.id)
    .eq('is_equipped', true);
  
  if (!equipRes.error && equipRes.data) {
    equipRes.data.forEach(function(item) {
      var equip = item.equipment;
      maxHP += equip.hp_bonus || 0;
    });
  }
  
  // Update max_hp in database if changed
  if (pet.max_hp !== maxHP) {
    await supabaseClient
      .from('user_pets')
      .update({ max_hp: maxHP })
      .eq('id', petId);
  }
  
  // Use current_hp if available (even if 0!), otherwise use maxHP for new pets
  var currentHP = (pet.current_hp !== null && pet.current_hp !== undefined) ? pet.current_hp : maxHP;
  
  console.log('📊 Pet HP loaded:', {
    petId: petId,
    current_hp_from_db: pet.current_hp,
    maxHP: maxHP,
    currentHP_calculated: currentHP
  });
  
  // Make sure current_hp doesn't exceed max_hp
  if (currentHP > maxHP) {
    currentHP = maxHP;
    await supabaseClient
      .from('user_pets')
      .update({ current_hp: maxHP })
      .eq('id', petId);
  }
  
  var stats = {
    hp: currentHP,  // Start battle with current HP, not full HP!
    maxHP: maxHP,
    attack: (pet.base_attack || 5) + evolutionBonuses.attack,
    defense: (pet.base_defense || 3) + evolutionBonuses.defense,
    speed: (pet.base_speed || 4) + evolutionBonuses.speed
  };
  
  // Apply equipment bonuses
  if (!equipRes.error && equipRes.data) {
    equipRes.data.forEach(function(item) {
      var equip = item.equipment;
      stats.attack += equip.attack_bonus || 0;
      stats.defense += equip.defense_bonus || 0;
      stats.speed += equip.speed_bonus || 0;
    });
  }
  
  return {
    id: pet.id,
    name: pet.nickname || pet.pets.name || 'Your Pet',
    imageFile: pet.pets.image_file,
    stats: stats,
    currentHP: currentHP,
    maxHP: maxHP,
    energy: pet.energy || 50,
    maxEnergy: pet.max_energy || 100,
    specialSkill: pet.pets.special_skill || null
  };
}

/**
 * Simulate an entire battle and return the log
 * Returns: { victory: boolean, log: [...], playerFinalHP: number, enemyFinalHP: number }
 */
function simulateBattle(playerStats, enemyStats) {
  var log = [];
  var playerHP = playerStats.currentHP;
  var enemyHP = enemyStats.hp;
  var turn = 0;
  var maxTurns = 50; // prevent infinite loops
  
  // Determine who goes first based on speed
  var playerFirst = playerStats.stats.speed >= enemyStats.speed;
  
  log.push({
    type: 'start',
    text: 'Battle begins! ' + playerStats.name + ' vs ' + enemyStats.name + '!',
    playerHP: playerHP,
    enemyHP: enemyHP
  });
  
  while (playerHP > 0 && enemyHP > 0 && turn < maxTurns) {
    turn++;
    
    // Player's turn
    if (playerFirst || turn > 1) {
      // Check if player uses a special skill
      var usedSkill = false;
      var skillResult = null;
      
      if (playerStats.specialSkill && Math.random() < playerStats.specialSkill.trigger_chance) {
        // Player uses special skill!
        usedSkill = true;
        var baseDamage = playerStats.stats.attack - enemyStats.defense;
        var skillDamage = Math.max(1, Math.floor(baseDamage * playerStats.specialSkill.damage_multiplier));
        
        enemyHP -= skillDamage;
        
        // Calculate heal if skill has healing
        var healAmount = 0;
        if (playerStats.specialSkill.heal_percent > 0) {
          healAmount = Math.floor(skillDamage * playerStats.specialSkill.heal_percent);
          playerHP = Math.min(playerStats.maxHP, playerHP + healAmount);
        }
        
        skillResult = {
          damage: skillDamage,
          heal: healAmount,
          skillName: playerStats.specialSkill.name,
          skillIcon: playerStats.specialSkill.icon
        };
        
        var skillText = playerStats.name + ' uses ' + playerStats.specialSkill.name + '! ' + playerStats.specialSkill.icon + ' ' + skillDamage + ' damage!';
        if (healAmount > 0) {
          skillText += ' (Healed ' + healAmount + ' HP!)';
        }
        
        log.push({
          type: 'player_attack',
          attacker: 'player',
          damage: skillDamage,
          variance: 1, // Skills count as crits for sound effects
          isSkill: true,
          skillData: skillResult,
          text: skillText,
          playerHP: playerHP,
          enemyHP: Math.max(0, enemyHP)
        });
      } else {
        // Normal attack
        var playerDamageResult = calculateDamage(playerStats.stats.attack, enemyStats.defense, false);
        enemyHP -= playerDamageResult.damage;
        
        log.push({
          type: 'player_attack',
          attacker: 'player',
          damage: playerDamageResult.damage,
          variance: playerDamageResult.variance,
          isSkill: false,
          text: playerStats.name + ' attacks for ' + playerDamageResult.damage + ' damage! ' + playerDamageResult.flavor,
          playerHP: playerHP,
          enemyHP: Math.max(0, enemyHP)
        });
      }
      
      if (enemyHP <= 0) break;
    }
    
    // Enemy's turn
    var isBossAttack = enemyStats.is_boss || false;
    var enemyDamageResult = calculateDamage(enemyStats.attack, playerStats.stats.defense, isBossAttack);
    playerHP -= enemyDamageResult.damage;
    
    log.push({
      type: 'enemy_attack',
      attacker: 'enemy',
      damage: enemyDamageResult.damage,
      variance: enemyDamageResult.variance,
      text: enemyStats.name + ' attacks for ' + enemyDamageResult.damage + ' damage! ' + enemyDamageResult.flavor,
      playerHP: Math.max(0, playerHP),
      enemyHP: Math.max(0, enemyHP)
    });
    
    if (playerHP <= 0) break;
  }
  
  var victory = playerHP > 0;
  
  log.push({
    type: 'end',
    text: victory ? 'Victory! ' + playerStats.name + ' wins!' : 'Defeat! ' + playerStats.name + ' fainted!',
    playerHP: Math.max(0, playerHP),
    enemyHP: Math.max(0, enemyHP)
  });
  
  return {
    victory: victory,
    log: log,
    turns: turn,
    playerFinalHP: Math.max(0, playerHP),
    enemyFinalHP: Math.max(0, enemyHP)
  };
}

/**
 * Calculate damage with variance
 */
function calculateDamage(attack, defense, isBossAttack) {
  var baseDamage = attack - defense;
  var variance = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
  var damage = Math.max(1, baseDamage + variance);
  
  // Flavor text based on variance
  var flavor = '';
  
  // Special boss flavor text!
  if (isBossAttack) {
    if (variance === -1) {
      var bosLowFlavors = [
        'Piper\'s flute makes your head spin...',
        'The haunting melody disorients you!',
        'A distant note echoes in your mind...',
        'The sound barely reaches you...',
        'A faint whistle brushes past you...'
      ];
      flavor = bosLowFlavors[Math.floor(Math.random() * bosLowFlavors.length)];
    } else if (variance === 0) {
      var bossNormalFlavors = [
        'Piper\'s flute makes you feel sick!',
        'The melody pierces through you!',
        'Reality wavers to the tune!',
        'The haunting song grips your mind!',
        'The flute\'s cry echoes in your bones!'
      ];
      flavor = bossNormalFlavors[Math.floor(Math.random() * bossNormalFlavors.length)];
    } else { // variance === +1
      var bossCritFlavors = [
        'Piper\'s flute distorts reality itself!',
        'The melody SHATTERS your senses!',
        'Reality BREAKS under the song!',
        'The flute\'s scream tears through existence!',
        'The haunting tune OVERWHELMS everything!'
      ];
      flavor = bossCritFlavors[Math.floor(Math.random() * bossCritFlavors.length)];
    }
  } else {
    // Normal flavor text
    if (variance === -1) {
      var lowHitFlavors = [
        'Barely scratched them!',
        'A glancing blow!',
        'Just grazed them!',
        'Wasn\'t very effective...',
        'A weak hit!'
      ];
      flavor = lowHitFlavors[Math.floor(Math.random() * lowHitFlavors.length)];
    } else if (variance === 0) {
      var normalHitFlavors = [
        'A solid hit!',
        'Good wallop!',
        'Nice strike!',
        'Connected cleanly!',
        'That hurt!'
      ];
      flavor = normalHitFlavors[Math.floor(Math.random() * normalHitFlavors.length)];
    } else { // variance === +1
      var critHitFlavors = [
        'Critical hit!',
        'A devastating blow!',
        'Super effective!',
        'Absolutely crushed them!',
        'WHAM! Direct hit!'
      ];
      flavor = critHitFlavors[Math.floor(Math.random() * critHitFlavors.length)];
    }
  }
  
  return { damage: damage, flavor: flavor, variance: variance };
}

/**
 * Start a battle against an enemy
 */
async function startBattle(petId, enemyId) {
  if (!currentUser) return;
  
  // Get player pet stats (includes current HP and energy)
  var playerStats = await calculatePetStats(petId);
  if (!playerStats) {
    showToast('Error loading pet stats!');
    return;
  }
  
  // Check if pet has enough energy (need at least 5)
  if (playerStats.energy < 5) {
    showToast('🥱 Your pet is too tired! Feed them to restore energy.');
    return;
  }
  
  // Check if pet has HP left
  if (playerStats.currentHP <= 0) {
    showToast('💔 Your pet is fainted! Use a healing item first!');
    return;
  }
  
  // Get enemy stats
  var enemyRes = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('id', enemyId)
    .single();
  
  if (enemyRes.error) {
    showToast('Error loading enemy!');
    return;
  }
  
  var enemy = enemyRes.data;
  var enemyStats = {
    id: enemy.id,
    name: enemy.name,
    species: enemy.species,
    hp: enemy.base_hp,
    attack: enemy.base_attack,
    defense: enemy.base_defense,
    speed: enemy.base_speed,
    exp_reward: enemy.exp_reward,
    pp_reward: enemy.pp_reward,
    sprite_sheet: enemy.sprite_sheet,
    sprite_frames: enemy.sprite_frames
  };
  
  // Continue with battle logic...
  await executeBattle(playerStats, enemyStats, petId);
}

/**
 * Start battle with pre-generated enemy (for level-scaled enemies)
 */
async function startBattleWithEnemy(petId, enemy) {
  if (!currentUser) return;
  
  console.log('⚔️ BATTLE START - Pet ID:', petId, 'Enemy:', enemy.name);
  
  // Get player pet stats (includes current HP and energy)
  var playerStats = await calculatePetStats(petId);
  if (!playerStats) {
    showToast('Error loading pet stats!');
    return;
  }
  
  console.log('👤 Player HP at battle start:', playerStats.currentHP);
  
  // Check if pet has enough energy (need at least 5)
  if (playerStats.energy < 5) {
    showToast('🥱 Your pet is too tired! Feed them to restore energy.');
    return;
  }
  
  // Check if pet has HP left
  if (playerStats.currentHP <= 0) {
    showToast('💔 Your pet is fainted! Use a healing item first!');
    return;
  }
  
  // Use the pre-scaled enemy stats
  var enemyStats = {
    id: enemy.id,
    name: enemy.name + ' (Lv.' + enemy.level + ')',
    species: enemy.species,
    level: enemy.level,
    hp: enemy.base_hp,
    attack: enemy.base_attack,
    defense: enemy.base_defense,
    speed: enemy.base_speed,
    exp_reward: enemy.exp_reward || calculateReward(enemy.level, enemy.forest_zone, 'xp'),
    pp_reward: enemy.pp_reward || calculateReward(enemy.level, enemy.forest_zone, 'pp'),
    sprite_sheet: enemy.sprite_sheet || null,
    sprite_frames: enemy.sprite_frames || null,
    is_boss: enemy.is_boss || false
  };
  
  // BOSS ENTRANCE SEQUENCE!
  if (enemy.is_boss) {
    triggerBossEntrance();
  }
  
  // Continue with battle logic...
  await executeBattle(playerStats, enemyStats, petId);
}

/**
 * Calculate rewards with zone multipliers
 */
function calculateReward(enemyLevel, zone, type) {
  var baseAmount = type === 'xp' ? 8 : 10; // Reduced XP from 15 to 8 for slower leveling
  
  // Zone multipliers - harder zones give MORE rewards
  var zoneMultiplier = 1.0;
  if (zone === 'glade') {
    zoneMultiplier = 1.5; // Forest Glade: 50% more rewards
  } else if (zone === 'deepwoods') {
    zoneMultiplier = 2.0; // Deep Woods: 2x rewards
  }
  // outskirts stays at 1.0x
  
  var reward = Math.floor(enemyLevel * baseAmount * zoneMultiplier);
  return reward;
}

/**
 * Common battle execution logic (extracted to avoid duplication)
 */
async function executeBattle(playerStats, enemyStats, petId) {
  // Deduct 5 energy from pet BEFORE battle
  // Get fresh energy value from database to be sure
  var freshPet = await supabaseClient
    .from('user_pets')
    .select('energy')
    .eq('id', petId)
    .single();
  
  console.log('=== ENERGY DEDUCTION DEBUG ===');
  console.log('Pet ID:', petId);
  console.log('Fresh pet query result:', freshPet);
  
  if (freshPet.data) {
    var currentEnergy = freshPet.data.energy || 100;
    var newEnergy = Math.max(0, currentEnergy - 5);
    
    console.log('Energy deduction: ' + currentEnergy + ' -> ' + newEnergy);
    showToast('⚡ Energy: ' + currentEnergy + ' → ' + newEnergy);
    
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ energy: newEnergy })
      .eq('id', petId);
    
    console.log('Energy update result:', updateRes);
    
    if (updateRes.error) {
      console.error('Energy update error:', updateRes.error);
      showToast('❌ Energy update failed!');
    } else {
      console.log('Energy updated successfully!');
      showToast('✅ Energy updated to ' + newEnergy);
    }
  } else {
    console.error('Failed to fetch pet energy!');
  }
  console.log('=== END ENERGY DEBUG ===');
  
  // Simulate the battle
  var battleResult = simulateBattle(playerStats, enemyStats);
  
  console.log('🎲 BATTLE RESULT:', {
    victory: battleResult.victory,
    playerFinalHP: battleResult.playerFinalHP,
    enemyFinalHP: battleResult.enemyFinalHP,
    turns: battleResult.turns
  });
  
  // Show battle UI and play it back
  isBossBattle = enemyStats.is_boss || false;  // Track if this is a boss battle
  showBattleUI(playerStats, enemyStats, battleResult);
  
  // Save battle to history and get rewards
  // For dynamically scaled enemies, use the base enemy ID
  console.log('💾 About to save battle - Victory:', battleResult.victory, 'Final HP:', battleResult.playerFinalHP);
  battleRewards = await saveBattleHistory(petId, enemyStats.id, battleResult, enemyStats);
  
  console.log('✅ saveBattleHistory completed. Rewards:', battleRewards);
  
  // CRITICAL: Force reload pet data AFTER HP is saved
  console.log('🔄 Forcing pet data reload after battle...');
  await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure DB write completes
  tabsLoaded['mypets'] = false;
  tabsLoaded['battle'] = false;
}

/**
 * Save battle to database
 */
async function saveBattleHistory(petId, enemyId, battleResult, enemyStats) {
  console.log('💾 saveBattleHistory called - Victory:', battleResult.victory, 'Final HP:', battleResult.playerFinalHP);
  
  // FIX: Handle integer enemy IDs correctly
  var actualEnemyId = enemyId;
  
  // If enemyId is a number or string number, keep it as number (don't try to convert to UUID)
  if (typeof enemyId === 'number' || (typeof enemyId === 'string' && !isNaN(parseInt(enemyId)))) {
    console.log('Enemy ID is numeric:', enemyId, '- using as integer');
    actualEnemyId = parseInt(enemyId);
  }
  
  console.log('Saving battle with enemy ID:', actualEnemyId, 'type:', typeof actualEnemyId);
  
  // ⚠️ IMPORTANT: Your RPC needs to accept INTEGER for p_enemy_id
  // See SQL file: create_save_battle_result_integer.sql
  
  // ═══════════════════════════════════════════════════════════
  // CALL SECURE SERVER-SIDE FUNCTION for rewards & point awarding
  // ═══════════════════════════════════════════════════════════
  var { data: result, error: rpcError } = await supabaseClient.rpc('save_battle_result', {
    p_pet_id: petId,
    p_enemy_id: actualEnemyId,  // Now passes as integer
    p_victory: battleResult.victory,
    p_turns_taken: battleResult.turns,
    p_player_final_hp: battleResult.playerFinalHP,
    p_battle_log: battleResult.log
  });
  
  var expGained = 0;
  var ppGained = 0;
  
  if (rpcError) {
    console.error('❌ Battle save error:', rpcError);
    // Fall back to client-side if server function fails
    expGained = battleResult.victory ? (enemyStats.exp_reward || 10) : 0;
    ppGained = battleResult.victory ? (enemyStats.pp_reward || 10) : 0;
  } else {
    expGained = result.exp_gained || 0;
    ppGained = result.pp_gained || 0;
    console.log('✅ Battle saved securely. XP:', expGained, 'PP:', ppGained);
  }
  
  // CRITICAL: Ensure HP is properly updated after battle
  if (battleResult.victory || battleResult.playerFinalHP > 0) {
    var hpUpdate = await supabaseClient
      .from('user_pets')
      .update({ current_hp: battleResult.playerFinalHP })
      .eq('id', petId);
    
    if (hpUpdate.error) {
      console.error('Failed to update pet HP directly:', hpUpdate.error);
    } else {
      console.log('✅ Pet HP updated to:', battleResult.playerFinalHP);
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // ITEM DROPS - Still handled here (cosmetic/reward, not economy-critical)
  // ═══════════════════════════════════════════════════════════
  var itemDropped = null;
  
  // BOSS DROP - Guaranteed item if you beat a boss!
  if (battleResult.victory && enemyStats.is_boss) {
    console.log('🎁 Boss defeated! Rolling for exclusive drop...');
    
    // Log boss defeat activity
    await logActivity('boss_defeated', {
      boss_name: enemyStats.name
    });
    
    // Get boss drops for this specific boss zone
    var bossDropRes = await supabaseClient
      .from('items')
      .select('*')
      .eq('is_boss_drop', true)
      .ilike('boss_source', '%' + enemyStats.forest_zone + '%');
    
    if (!bossDropRes.error && bossDropRes.data && bossDropRes.data.length > 0) {
      // Random drop from this boss's loot table
      itemDropped = bossDropRes.data[Math.floor(Math.random() * bossDropRes.data.length)];
      
      console.log('🎉 Boss dropped:', itemDropped.name);
      
      // Check if player already has this item
      var existingItem = await supabaseClient
        .from('user_inventory')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('item_id', itemDropped.id)
        .single();
      
      if (existingItem.data) {
        await supabaseClient
          .from('user_inventory')
          .update({ quantity: existingItem.data.quantity + 1 })
          .eq('id', existingItem.data.id);
      } else {
        await supabaseClient
          .from('user_inventory')
          .insert([{
            user_id: currentUser.id,
            item_id: itemDropped.id,
            quantity: 1
          }]);
      }
    }
  }
  
  // Normal 10% chance for item drop on victory (only if not boss)
  if (battleResult.victory && !enemyStats.is_boss) {
    var dropChance = 0.1;
    dropChance = dropChance * worldEvents.getActiveBonus('rareFindChance');
    
    if (Math.random() < dropChance) {
      var itemsRes = await supabaseClient
        .from('items')
        .select('*')
        .lte('price', 100)
        .limit(20);
      
      if (!itemsRes.error && itemsRes.data && itemsRes.data.length > 0) {
        itemDropped = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
        
        await supabaseClient
          .from('user_inventory')
          .insert([{
            user_id: currentUser.id,
            item_id: itemDropped.id,
            quantity: 1
          }]);
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // FETCH UPDATED PET DATA for level-up display
  // ═══════════════════════════════════════════════════════════
  if (battleResult.victory) {
    // COMMUNITY GOALS: Track battle wins
    community_increment('battle_wins_week1', 1);
    
    // COMMUNITY GOALS: Track mushroom defeats
    if (enemyStats.name && enemyStats.name.toLowerCase().indexOf('mushroom') !== -1) {
      community_increment('defeat_mushrooms_week1', 1);
    }
    
    // SCRAPBOOK: Add first battle win memory
    var hasWinMemory = await scrapbook_hasMemory(petId, 'first_battle_win');
    if (!hasWinMemory) {
      scrapbook_addMemory(petId, 'first_battle_win', { enemy: enemyStats.name || 'an enemy' });
    }
    
    // SCRAPBOOK: Low HP victory (if HP < 10%)
    var petStats = window.petState && window.petState[petId];
    var maxHp = (petStats && petStats.base_hp) || 100;
    if (battleResult.playerFinalHP < maxHp * 0.1 && battleResult.playerFinalHP > 0) {
      scrapbook_addMemory(petId, 'low_hp_victory', { hp: battleResult.playerFinalHP });
    }
    
    var petData = await supabaseClient
      .from('user_pets')
      .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed, total_battles, battles_won, energy')
      .eq('id', petId)
      .single();
    
    if (petData.data) {
      var pet = petData.data;
      
      // Check for level up for display purposes
      var lu = calculateLevelUp(
        pet.xp || 0,
        pet.level,
        pet.max_hunger,
        pet.max_energy,
        pet.max_happiness,
        pet.base_hp || 25,
        pet.base_attack || 4,
        pet.base_defense || 2,
        pet.base_speed || 3
      );
      
      // Store level up info for the rewards modal
      if (lu.leveled) {
        var oldStage = getEvolutionStage(pet.level);
        var newStage = getEvolutionStage(lu.level);
        
        battleRewards.leveledUp = true;
        battleRewards.newLevel = lu.level;
        battleRewards.statIncreases = lu.statIncreases;
        
        // Log level up activity
        var petInfo = await supabaseClient
          .from('user_pets')
          .select('nickname, pets(name)')
          .eq('id', petId)
          .single();
        
        var petName = petInfo.data ? (petInfo.data.nickname || petInfo.data.pets.name) : 'Pet';
        
        await logActivity('level_up', {
          pet_name: petName,
          level: lu.level
        });
        
        // SCRAPBOOK: Level milestones at 5, 10, 15, 20
        if (lu.level === 5 || lu.level === 10 || lu.level === 15 || lu.level === 20) {
          scrapbook_addMemory(petId, 'level_milestone', { level: lu.level });
        }
        
        // Check if pet evolved to a new stage
        if (oldStage !== newStage) {
          battleRewards.evolved = true;
          battleRewards.evolutionStage = newStage;
          battleRewards.evolutionEmoji = getEvolutionEmoji(newStage);
        }
      }
    }
  }
  
  // SCRAPBOOK: First battle loss
  if (!battleResult.victory && battleResult.playerFinalHP <= 0) {
    var hasLossMemory = await scrapbook_hasMemory(petId, 'first_battle_loss');
    if (!hasLossMemory) {
      scrapbook_addMemory(petId, 'first_battle_loss', { enemy: enemyStats.name || 'an enemy' });
    }
  }
  
  // ═══════════════════════════════════════════════════════════
  // RETURN REWARDS for the battle rewards modal
  // ═══════════════════════════════════════════════════════════
  return {
    victory: battleResult.victory,
    expGained: expGained,
    ppGained: ppGained,
    itemDropped: itemDropped
  };
}

/**
 * Show battle UI (will be expanded in Chunk 3)
 */
var currentBattleLog = [];
var currentBattleIndex = 0;
var battlePlaybackInterval = null;
var isBossBattle = false;  // Track if current battle is against a boss
var selectedBattlePetId = null;
var selectedBattleZone = 'outskirts'; // Default to easy zone

function selectZone(zone) {
  selectedBattleZone = zone;
  
  // Update UI - remove selected class from all
  var allZones = document.querySelectorAll('.zone-btn');
  allZones.forEach(function(btn) {
    btn.classList.remove('zone-selected');
    btn.style.border = '3px solid var(--purple-light)';
    btn.style.transform = 'scale(1)';
  });
  
  // Add selected class to clicked zone
  var selectedBtn = document.getElementById('zone-' + zone);
  if (selectedBtn && !selectedBtn.classList.contains('zone-locked')) {
    selectedBtn.classList.add('zone-selected');
    selectedBtn.style.border = '3px solid var(--green)';
    selectedBtn.style.transform = 'scale(1.02)';
    
    var helperText = document.getElementById('battle-helper-text');
    var findBtn = document.getElementById('find-battle-btn');
    
    if (zone === 'dungeon') {
      // Dungeon mode
      if (helperText && selectedBattlePetId) {
        helperText.textContent = 'Ready to challenge the Shallow Cave!';
      }
      if (findBtn) {
        findBtn.textContent = '⛰️ Enter Dungeon';
        findBtn.onclick = startDungeon;
      }
    } else {
      // Normal exploration
      if (helperText && selectedBattlePetId) {
        var zoneName = zone === 'outskirts' ? 'City Outskirts' : 
                       zone === 'glade' ? 'Forest Glade' : 
                       zone === 'deepwoods' ? 'Deep Woods' : 
                       zone === 'ruins' ? 'Outside The Ruins' : 'this zone';
        helperText.textContent = 'Ready to explore ' + zoneName + '!';
      }
      if (findBtn) {
        findBtn.textContent = '🌲 Go Exploring';
        findBtn.onclick = goExploring;
      }
    }
  }
}
var battleRewards = null;  // Store rewards globally

function showBattleUI(playerStats, enemyStats, battleResult) {
  // Store battle data
  currentBattleLog = battleResult.log;
  currentBattleIndex = 0;
  
  // Hide forest, show battle
  el('forest-exploration').style.display = 'none';
  el('battle-screen').style.display = 'block';
  
  // Set up player side
  el('player-battle-name').textContent = playerStats.name;
  el('player-hp-text').textContent = playerStats.currentHP + '/' + playerStats.maxHP;
  var playerHPPercent = (playerStats.currentHP / playerStats.maxHP) * 100;
  el('player-hp-fill').style.width = playerHPPercent + '%';
  
  // Set player sprite (pet image)
  var playerSprite = el('player-battle-sprite');
  if (playerStats.imageFile) {
    // Use the pet's actual image
    playerSprite.style.backgroundImage = 'url(images/' + playerStats.imageFile + ')';
    playerSprite.style.backgroundSize = 'cover';
    playerSprite.style.backgroundPosition = 'center';
    playerSprite.textContent = ''; // Remove emoji fallback
  } else {
    // Fallback to paw prints if no image
    playerSprite.textContent = '🐾';
  }
  
  // Set HP bar color based on percentage
  var playerHPFill = el('player-hp-fill');
  playerHPFill.classList.remove('low', 'critical');
  if (playerHPPercent <= 25) {
    playerHPFill.classList.add('critical');
  } else if (playerHPPercent <= 50) {
    playerHPFill.classList.add('low');
  }
  
  // Set up enemy side with sprite
  var enemyNameEl = el('enemy-battle-name');
  enemyNameEl.textContent = enemyStats.name;
  
  // Boss name gets glitch effect
  if (enemyStats.is_boss) {
    enemyNameEl.classList.add('boss-name-glitch');
  } else {
    enemyNameEl.classList.remove('boss-name-glitch');
  }
  
  // Set enemy HP display - BOSSES SHOW ???
  if (enemyStats.is_boss) {
    el('enemy-hp-text').textContent = '???/???';
  } else {
    el('enemy-hp-text').textContent = enemyStats.hp + '/' + enemyStats.hp;
  }
  el('enemy-hp-fill').style.width = '100%';
  
  // Boss HP bar gets special styling
  var enemyHPBar = el('enemy-hp-fill');
  if (enemyStats.is_boss) {
    enemyHPBar.classList.add('boss-hp-bar');
  } else {
    enemyHPBar.classList.remove('boss-hp-bar');
  }
  
  // Set enemy sprite based on species
  var enemySprite = el('enemy-battle-sprite');
  
  // Clear any existing content and classes
  enemySprite.innerHTML = '';
  enemySprite.className = 'battle-sprite enemy-sprite';
  
  // BOSS SPRITE - Show glitchy question mark
  if (enemyStats.is_boss) {
    enemySprite.style.backgroundImage = 'none';
    enemySprite.innerHTML = '<div class="boss-sprite">?</div>';
  } else {
    // Get sprite configuration
    var config = getSpriteConfig(enemyStats.species);
    
    // Calculate full sheet dimensions
    var sheetWidth = config.frameWidth * config.framesPerRow;
    var sheetHeight = config.frameHeight;
    
    // CRITICAL: Show ONLY the FIRST frame (col 0, row 0)
    enemySprite.style.backgroundImage = 'url(images/' + config.file + ')';
    enemySprite.style.backgroundSize = sheetWidth + 'px ' + sheetHeight + 'px';
    enemySprite.style.backgroundRepeat = 'no-repeat';
    enemySprite.style.backgroundPosition = '0 0';  // First frame only
    enemySprite.style.width = config.frameWidth + 'px';
    enemySprite.style.height = config.frameHeight + 'px';
    
    // SCALE UP the sprite to make it more visible
    enemySprite.style.transform = 'scale(1.5)';
    enemySprite.style.imageRendering = 'pixelated';
    
    console.log('Sprite set to first frame only - width:', config.frameWidth, 'height:', config.frameHeight);
    
    // Apply special variant visual effect (if any)
    if (enemyStats.specialVariant) {
      enemySprite.classList.add('variant-' + enemyStats.specialVariant);
    }
  }
  
  // Clear battle log
  el('battle-log').innerHTML = '';
  
  // Start playback
  el('battle-skip-btn').style.display = 'inline-block';
  el('battle-continue-btn').style.display = 'none';
  
  playBattleTurn();
}

// ══════════════════════════════════════════════════════════════════════════
// SPRITE ANIMATION SYSTEM - Dynamic configuration for varying sprite sheets
// ══════════════════════════════════════════════════════════════════════════

var enemySpriteConfig = {
  'bird': {
    file: 'MiniBird.png',
    frameWidth: 64,
    frameHeight: 48,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'bunny': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'rabbit': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'squirrel': {
    file: 'MiniBunny.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'fox': {
    file: 'MiniFox.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'boar': {
    file: 'MiniBoar.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'wolf': {
    file: 'MiniWolf.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'bear': {
    file: 'MiniBear.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'deer': {
    file: 'MiniDeer1.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'mushroom': {
    file: 'MonsterMushroom.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  },
  'slime': {
    file: 'MonsterSlime.png',
    frameWidth: 64,
    frameHeight: 64,
    framesPerRow: 4,
    totalFrames: 4,
    rows: 1
  }
};

function getSpriteConfig(species) {
  return enemySpriteConfig[species] || enemySpriteConfig['bird'];
}

function getSpriteFile(species) {
  var config = getSpriteConfig(species);
  return config.file;
}

function startSpriteAnimation(spriteElement, species) {
  // No animation needed - static images only
  console.log('Static sprite for:', species);
  return;
}

function stopSpriteAnimation(spriteElement) {
  if (!spriteElement) return;
  
  if (spriteElement._spriteInterval) {
    clearInterval(spriteElement._spriteInterval);
    spriteElement._spriteInterval = null;
  }
}

function playBattleTurn() {
  if (currentBattleIndex >= currentBattleLog.length) {
    // Battle finished
    endBattlePlayback();
    return;
  }
  
  var entry = currentBattleLog[currentBattleIndex];
  
  // Add log entry
  var logEntry = makeEl('div', { class: 'battle-log-entry' });
  if (entry.type === 'player_attack') {
    logEntry.classList.add('player-attack');
    // Add special styling for skill attacks
    if (entry.isSkill) {
      logEntry.classList.add('skill-attack');
    }
  } else if (entry.type === 'enemy_attack') {
    logEntry.classList.add('enemy-attack');
  } else if (entry.type === 'end') {
    logEntry.classList.add(entry.text.includes('Victory') ? 'victory' : 'defeat');
  }
  logEntry.textContent = entry.text;
  var battleLog = el('battle-log');
  battleLog.appendChild(logEntry);
  
  // COMPLETELY NEW APPROACH - Use scrollIntoView which forces the element into view
  // This is MORE RELIABLE than scrollTop in many browsers
  try {
    logEntry.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
  } catch (e) {
    // Fallback for older browsers
    battleLog.scrollTop = battleLog.scrollHeight;
  }
  
  // Double-check with a slight delay
  setTimeout(function() {
    try {
      logEntry.scrollIntoView({ behavior: 'instant', block: 'end', inline: 'nearest' });
    } catch (e) {
      battleLog.scrollTop = battleLog.scrollHeight;
    }
  }, 10);
  
  // Update HP bars
  updateHPBar('player', entry.playerHP, currentBattleLog[0].playerHP);
  updateHPBar('enemy', entry.enemyHP, currentBattleLog[0].enemyHP);
  
  // Animate hit
  if (entry.type === 'player_attack') {
    animateHit('enemy');
    
    // Play player attack sound with volume based on variance
    if (entry.variance !== undefined) {
      var soundKey = getBattleSoundKey('player', entry.variance);
      var playerVolume = 0.21; // Reduced 40% (was 0.35)
      
      if (entry.variance === 1) { // Crit
        playerVolume = 0.08; // Reduced 40% (was 0.14)
      }
      
      playBattleSound(soundKey, playerVolume);
    }
  } else if (entry.type === 'enemy_attack') {
    animateHit('player');
    
    // Play enemy attack sound - special sounds for boss with variance!
    if (isBossBattle && entry.variance !== undefined) {
      // Boss uses different flute sounds based on hit strength
      var bossSoundKey = 'boss' + (entry.variance === -1 ? 'Light' : entry.variance === 0 ? 'Normal' : 'Crit');
      
      // Volume adjustments: Light/Normal +20% louder, Crit 25% quieter
      var bossVolume = 0.42; // Default for light/normal (was 0.35, now +20%)
      if (entry.variance === 1) { // Crit
        bossVolume = 0.26; // Crit quieter (was 0.35, now -25%)
      }
      
      playBattleSound(bossSoundKey, bossVolume, true); // Allow boss sounds to overlap
    } else if (entry.variance !== undefined) {
      var soundKey = getBattleSoundKey('enemy', entry.variance);
      
      // Reduced 40% from original volumes
      var enemyVolume = 0.18; // Reduced 40% (was 0.30)
      if (entry.variance === 1) { // Crit
        enemyVolume = 0.08; // Reduced 40% (was 0.14)
      }
      
      playBattleSound(soundKey, enemyVolume);
    }
  } else if (entry.type === 'end') {
    // Victory/defeat sounds temporarily disabled (missing MP3 files)
    if (entry.text.includes('Victory')) {
      // playBattleSound('victory', 0.40);  // Disabled - file missing
      console.log('🎉 Victory! (sound disabled until MP3 added)');
    } else {
      // playBattleSound('defeat', 0.35);  // Disabled - file missing
      console.log('💀 Defeat! (sound disabled until MP3 added)');
    }
  }
  
  currentBattleIndex++;
  
  // Dynamic turn speed - give boss attacks more time for long sound effects
  var turnDelay = 1200; // Default 1.2 seconds
  
  if (isBossBattle && entry.type === 'enemy_attack') {
    turnDelay = 4500; // 4.5 seconds for boss attacks (allows 4s sound to finish)
  }
  
  // Continue to next turn
  battlePlaybackInterval = setTimeout(playBattleTurn, turnDelay);
}

function updateHPBar(side, currentHP, maxHP) {
  var hpFill = el(side + '-hp-fill');
  var hpText = el(side + '-hp-text');
  
  var percentage = Math.max(0, (currentHP / maxHP) * 100);
  hpFill.style.width = percentage + '%';
  
  // Boss HP stays as ??? throughout battle
  if (side === 'enemy' && isBossBattle) {
    hpText.textContent = '???/???';
  } else {
    hpText.textContent = Math.max(0, currentHP) + '/' + maxHP;
  }
  
  // Color based on HP percentage
  hpFill.classList.remove('low', 'critical');
  if (percentage <= 25) {
    hpFill.classList.add('critical');
  } else if (percentage <= 50) {
    hpFill.classList.add('low');
  }
}

function animateHit(side) {
  var sprite = el(side + '-battle-sprite');
  sprite.classList.add('hit');
  setTimeout(function() {
    sprite.classList.remove('hit');
  }, 300);
}

function skipBattle() {
  if (battlePlaybackInterval) {
    clearTimeout(battlePlaybackInterval);
  }
  
  // Jump to end
  currentBattleIndex = currentBattleLog.length - 1;
  var lastEntry = currentBattleLog[currentBattleIndex];
  
  // Update final HP
  updateHPBar('player', lastEntry.playerHP, currentBattleLog[0].playerHP);
  updateHPBar('enemy', lastEntry.enemyHP, currentBattleLog[0].enemyHP);
  
  // Show final message
  var logEntry = makeEl('div', { class: 'battle-log-entry' });
  logEntry.classList.add(lastEntry.text.includes('Victory') ? 'victory' : 'defeat');
  logEntry.textContent = lastEntry.text;
  el('battle-log').appendChild(logEntry);
  
  endBattlePlayback();
}

function endBattlePlayback() {
  el('battle-skip-btn').style.display = 'none';
  el('battle-continue-btn').style.display = 'none';
  
  // Check if player lost to a boss - trigger special death screen!
  if (isBossBattle && battleRewards && !battleRewards.victory) {
    triggerBossDeathScreen();
    return; // Don't show normal rewards modal
  }
  
  // Clean up boss effects
  clearBossEffects();
  
  // Show rewards modal
  showBattleRewardsModal();
}

function showBattleRewardsModal() {
  if (!battleRewards) return;
  
  var modal = el('battle-rewards-modal');
  if (!modal) {
    console.error('Battle rewards modal not found in HTML!');
    // Fallback to toast
    if (battleRewards.victory) {
      showToast('Victory! +' + battleRewards.expGained + ' EXP, +' + battleRewards.ppGained + ' PP!');
    } else {
      showToast('Defeat! Better luck next time!');
    }
    return;
  }
  
  // Update modal content
  var title = el('rewards-title');
  var expText = el('rewards-exp');
  var ppText = el('rewards-pp');
  var itemText = el('rewards-item');
  
  if (battleRewards.victory) {
    title.textContent = '🎉 Victory!';
    title.style.color = 'var(--green)';
    expText.textContent = '+' + battleRewards.expGained + ' EXP';
    ppText.textContent = '+' + battleRewards.ppGained + ' PP';
    
    // 🐾 COMPANION REACTION - Battle victory!
    if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.currentCompanionId) {
      var victoryMessages = [
        "That was incredible! ⚔️✨",
        "You're so strong! 💪",
        "Amazing battle! 🌟",
        "We won! 🎉",
        "Victory is ours! ⭐"
      ];
      CompanionBuddy.showMessage(victoryMessages[Math.floor(Math.random() * victoryMessages.length)]);
    }
    
    // ⭐ STAR BURST!
    setTimeout(function() {
      createStarBurst(window.innerWidth / 2, window.innerHeight / 3);
    }, 200);
    
    // Check for level up
    if (battleRewards.leveledUp) {
      var levelUpText = '⭐ LEVEL UP! Now Level ' + battleRewards.newLevel + '!\n';
      
      // 🐾 COMPANION REACTION - Level up!
      if (typeof CompanionBuddy !== 'undefined' && CompanionBuddy.currentCompanionId) {
        setTimeout(function() {
          CompanionBuddy.showMessage("You're getting stronger! 💪⭐");
        }, 3000);
      }
      
      // Check for evolution!
      if (battleRewards.evolved) {
        levelUpText = battleRewards.evolutionEmoji + ' EVOLUTION! ' + battleRewards.evolutionStage.toUpperCase() + ' STAGE!\n';
        levelUpText += 'Your pet is now Level ' + battleRewards.newLevel + '!\n';
      }
      
      var stats = battleRewards.statIncreases;
      if (stats.hp) levelUpText += '+' + stats.hp + ' HP ';
      if (stats.atk) levelUpText += '+' + stats.atk + ' ATK ';
      if (stats.def) levelUpText += '+' + stats.def + ' DEF ';
      if (stats.spd) levelUpText += '+' + stats.spd + ' SPD';
      
      expText.textContent = levelUpText;
      expText.style.color = battleRewards.evolved ? 'var(--pink)' : 'var(--purple)';
      expText.style.fontWeight = 'bold';
      expText.style.fontSize = battleRewards.evolved ? '1.2rem' : '1.1rem';
    } else {
      expText.style.color = '';
      expText.style.fontWeight = '';
      expText.style.fontSize = '';
    }
    
    if (battleRewards.itemDropped) {
      itemText.textContent = '🎁 Bonus: Found ' + battleRewards.itemDropped.name + '!';
      itemText.style.display = 'block';
    } else {
      itemText.style.display = 'none';
    }
  } else {
    title.textContent = '💀 Defeat!';
    title.style.color = 'var(--red)';
    expText.textContent = 'No EXP gained';
    ppText.textContent = 'No PP gained';
    itemText.style.display = 'none';
  }
  
  modal.classList.add('show');
}

function closeBattleRewardsModal() {
  var modal = el('battle-rewards-modal');
  if (modal) modal.classList.remove('show');
  
  // Always reload My Pets tab to show updated HP and stats
  tabsLoaded['mypets'] = false;
  
  // Reset battle state
  battleRewards = null;
  closeBattle();
}

async function closeBattle() {
  // Stop sprite animation
  var enemySprite = el('enemy-battle-sprite');
  if (enemySprite) {
    stopSpriteAnimation(enemySprite);
  }
  
  // Wait longer for database updates to fully complete and propagate
  await new Promise(resolve => setTimeout(resolve, 500));
  
  el('battle-screen').style.display = 'none';
  el('forest-exploration').style.display = 'block';
  
  // Force clear battle tab cache and reload pet selector with fresh data
  tabsLoaded['battle'] = false;
  await loadBattlePets();
}

// Load pets for battle selection
async function loadBattlePets() {
  var grid = el('battle-pet-select');
  grid.innerHTML = '<div class="spinner"></div>';
  
  if (!currentUser) {
    grid.innerHTML = '<div class="empty-state"><p>Please log in first! 🐾</p></div>';
    return;
  }
  
  var res = await supabaseClient
    .from('user_pets')
    .select('id, nickname, level, base_hp, base_attack, base_defense, base_speed, current_hp, max_hp, energy, max_energy, pet_id, pets!inner(name, image_file)')
    .eq('user_id', currentUser.id);
  
  if (res.error) {
    console.error('Battle pets query error:', res.error);
    grid.innerHTML = '<div class="empty-state"><p>Error loading pets: ' + res.error.message + '</p></div>';
    return;
  }
  
  if (!res.data || res.data.length === 0) {
    grid.innerHTML = '<div class="empty-state"><p>You need a pet to battle! Adopt one first. 🐾</p></div>';
    return;
  }
  
  grid.innerHTML = '';
  
  res.data.forEach(function(userPet) {
    var pet = userPet.pets;
    var card = makeEl('div', { class: 'battle-pet-card' });
    card.onclick = function() { selectBattlePet(userPet.id, card); };
    
    var img = makeEl('img');
    img.src = 'images/pets/' + pet.image_file;
    img.alt = pet.name;
    card.appendChild(img);
    
    var name = makeEl('div', { class: 'battle-pet-card-name' });
    name.textContent = userPet.nickname || pet.name;
    card.appendChild(name);
    
    var level = makeEl('div', { class: 'battle-pet-card-level' });
    level.textContent = 'Level ' + userPet.level;
    card.appendChild(level);
    
    var stats = makeEl('div', { class: 'battle-pet-card-stats' });
    
    var hpStat = makeEl('div', { class: 'battle-pet-stat' });
    var currentHP = (userPet.current_hp !== null && userPet.current_hp !== undefined) ? userPet.current_hp : (userPet.base_hp || 30);
    var maxHP = userPet.max_hp || userPet.base_hp || 30;
    hpStat.innerHTML = '<div class="battle-pet-stat-label">HP</div><div class="battle-pet-stat-value">' + currentHP + '/' + maxHP + '</div>';
    stats.appendChild(hpStat);
    
    var atkStat = makeEl('div', { class: 'battle-pet-stat' });
    atkStat.innerHTML = '<div class="battle-pet-stat-label">ATK</div><div class="battle-pet-stat-value">' + userPet.base_attack + '</div>';
    stats.appendChild(atkStat);
    
    var defStat = makeEl('div', { class: 'battle-pet-stat' });
    defStat.innerHTML = '<div class="battle-pet-stat-label">DEF</div><div class="battle-pet-stat-value">' + userPet.base_defense + '</div>';
    stats.appendChild(defStat);
    
    var spdStat = makeEl('div', { class: 'battle-pet-stat' });
    spdStat.innerHTML = '<div class="battle-pet-stat-label">SPD</div><div class="battle-pet-stat-value">' + userPet.base_speed + '</div>';
    stats.appendChild(spdStat);
    
    card.appendChild(stats);
    
    grid.appendChild(card);
  });
}

function selectBattlePet(petId, cardElement) {
  selectedBattlePetId = petId;
  
  // Update visual selection
  var cards = document.querySelectorAll('.battle-pet-card');
  cards.forEach(function(card) {
    card.classList.remove('selected');
  });
  cardElement.classList.add('selected');
  
  // Enable battle button
  el('find-battle-btn').disabled = false;
}

// ═══════════════════════════════════════════════════════════════════════════
// RANDOM ENCOUNTERS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var pendingBattleEnemy = null;

async function goExploring() {
  if (!selectedBattlePetId) {
    showPixelToast('Select a pet first!', 'warning');
    return;
  }
  
  // Check daily energy cap
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  if (energyUsedToday >= 250) {
    showPixelToast('⚡ Daily battle limit reached! Come back tomorrow!', 'warning');
    return;
  }
  
  // Track energy used
  localStorage.setItem(energyKey, energyUsedToday + 5);
  
  // Roll for encounter type
  var roll = Math.random();
  
  if (roll < 0.70) {
    // 70% - Normal Battle
    await handleBattleEncounter();
  } else if (roll < 0.85) {
    // 15% - Found Item
    await handleItemEncounter();
  } else if (roll < 0.95) {
    // 10% - Found Treasure
    await handleTreasureEncounter();
  } else {
    // 5% - Flavor Event
    await handleFlavorEncounter();
  }
}

async function handleBattleEncounter() {
  // Get player level
  var playerPetRes = await supabaseClient
    .from('user_pets')
    .select('level')
    .eq('id', selectedBattlePetId)
    .single();
  
  if (playerPetRes.error || !playerPetRes.data) {
    showPixelToast('Error loading your pet!', 'error');
    return;
  }
  
  var playerLevel = playerPetRes.data.level || 1;
  
  // Get random enemy
  var enemy = await getRandomEnemy(selectedBattleZone, playerLevel);
  
  if (!enemy) {
    showPixelToast('No enemies found in this zone!', 'error');
    return;
  }
  
  // Go directly to battle - no modal
  await startBattleWithEnemy(selectedBattlePetId, enemy);
}

async function handleItemEncounter() {
  // Get random common item
  var itemsRes = await supabaseClient
    .from('items')
    .select('*')
    .eq('tier', 1)
    .limit(20);
  
  if (itemsRes.error || !itemsRes.data || itemsRes.data.length === 0) {
    // Fallback to battle if no items found
    await handleBattleEncounter();
    return;
  }
  
  var randomItem = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
  var ppReward = 10 + Math.floor(Math.random() * 11); // 10-20 PP
  
  // Add item to inventory
  var existingItem = await supabaseClient
    .from('user_inventory')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('item_id', randomItem.id)
    .single();
  
  if (existingItem.data) {
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: existingItem.data.quantity + 1 })
      .eq('id', existingItem.data.id);
  } else {
    await supabaseClient
      .from('user_inventory')
      .insert([{
        user_id: currentUser.id,
        item_id: randomItem.id,
        quantity: 1
      }]);
  }
  
  // Award PP
  await awardPP(ppReward, 'item_found');
  
  // Show in battle screen
  showExplorationResult(
    '🎁 Item Found!',
    'You found a <strong style="color: var(--purple);">' + randomItem.name + '</strong> while exploring!',
    '+' + ppReward + ' PP',
    'Continue'
  );
}

async function handleTreasureEncounter() {
  // Get random rare item (tier 2 or 3)
  var tier = Math.random() < 0.7 ? 2 : 3; // 70% tier 2, 30% tier 3
  
  var itemsRes = await supabaseClient
    .from('items')
    .select('*')
    .eq('tier', tier)
    .limit(15);
  
  if (itemsRes.error || !itemsRes.data || itemsRes.data.length === 0) {
    // Fallback to item encounter
    await handleItemEncounter();
    return;
  }
  
  var randomItem = itemsRes.data[Math.floor(Math.random() * itemsRes.data.length)];
  var ppReward = 30 + Math.floor(Math.random() * 21); // 30-50 PP
  
  // Add item to inventory
  var existingItem = await supabaseClient
    .from('user_inventory')
    .select('*')
    .eq('user_id', currentUser.id)
    .eq('item_id', randomItem.id)
    .single();
  
  if (existingItem.data) {
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: existingItem.data.quantity + 1 })
      .eq('id', existingItem.data.id);
  } else {
    await supabaseClient
      .from('user_inventory')
      .insert([{
        user_id: currentUser.id,
        item_id: randomItem.id,
        quantity: 1
      }]);
  }
  
  // Award PP
  await awardPP(ppReward, 'treasure_discovered');
  
  // Show in battle screen
  showExplorationResult(
    '💎 Treasure Discovered!',
    'You discovered a hidden treasure chest!<br>Inside you found: <strong style="color: var(--purple);">' + randomItem.name + '</strong>!',
    '+' + ppReward + ' PP (Rare item!)',
    'Amazing!'
  );
}

async function handleFlavorEncounter() {
  var flavorEvents = [
    { text: "Your pet chased a butterfly and got distracted!", pp: 5, emoji: "🦋" },
    { text: "You found a cozy spot to rest. Your pet feels refreshed!", pp: 10, emoji: "🌸" },
    { text: "A friendly traveler shared some snacks with you!", pp: 15, emoji: "🍞" },
    { text: "You discovered some ancient markings on a tree... strange.", pp: 10, emoji: "🌳" },
    { text: "A cool breeze blows through. Your pet seems energized!", pp: 8, emoji: "💨" },
    { text: "You found some shiny pebbles along the path!", pp: 12, emoji: "✨" },
    { text: "Your pet rolled in some flowers. They smell lovely now!", pp: 7, emoji: "🌺" },
    { text: "You spotted a rainbow in the distance. How lucky!", pp: 15, emoji: "🌈" },
    { text: "A small bird dropped a berry in front of you!", pp: 9, emoji: "🫐" },
    { text: "You heard a mysterious melody in the wind...", pp: 11, emoji: "🎵" },
    { text: "Your pet found a comfortable sunny spot and napped!", pp: 8, emoji: "☀️" },
    { text: "You discovered a patch of four-leaf clovers!", pp: 13, emoji: "🍀" },
    { text: "A firefly landed on your pet's nose. How magical!", pp: 10, emoji: "✨" },
    { text: "You found an old coin half-buried in the dirt!", pp: 14, emoji: "🪙" }
  ];
  
  var event = flavorEvents[Math.floor(Math.random() * flavorEvents.length)];
  
  // Award PP
  await awardPP(event.pp, 'flavor_event');
  
  // Show in battle screen
  showExplorationResult(
    event.emoji + ' Peaceful Moment',
    event.text,
    '+' + event.pp + ' PP',
    'Nice!'
  );
}

// Show exploration result in battle screen area
function showExplorationResult(title, message, reward, buttonText) {
  // Hide exploration UI, show battle screen
  document.getElementById('forest-exploration').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  
  // Hide battle sprites and HP bars
  document.querySelector('.battle-container').style.display = 'none';
  
  // Show battle log with result
  var battleLog = document.getElementById('battle-log');
  battleLog.innerHTML = 
    '<div class="battle-log-entry" style="font-size: 1.3rem; font-weight: bold; color: var(--purple); margin-bottom: 15px;">' + title + '</div>' +
    '<div class="battle-log-entry" style="font-size: 1.1rem; line-height: 1.6; margin-bottom: 20px;">' + message + '</div>' +
    '<div class="battle-log-entry" style="font-size: 1.2rem; font-weight: bold; color: var(--green); margin-top: 20px;">' + reward + '</div>';
  
  // Set up controls
  document.getElementById('battle-skip-btn').style.display = 'none';
  var continueBtn = document.getElementById('battle-continue-btn');
  continueBtn.style.display = 'inline-block';
  continueBtn.textContent = buttonText;
  continueBtn.onclick = function() {
    // Show battle container again
    document.querySelector('.battle-container').style.display = 'flex';
    // Return to exploration
    closeBattle();
  };
}

function closeExplorationModal() {
  document.getElementById('exploration-modal').classList.remove('show');
  pendingBattleEnemy = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BATTLE SYSTEM (Original findBattle function)
// ═══════════════════════════════════════════════════════════════════════════

async function findBattle() {
  if (!selectedBattlePetId) {
    showToast('Select a pet first!');
    return;
  }
  
  // Check daily energy cap (250 energy = 50 battles per day)
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  if (energyUsedToday >= 250) {
    showToast('⚡ Daily battle limit reached! Your pet needs rest. Come back tomorrow!');
    return;
  }
  
  // Get player pet level
  var playerPetRes = await supabaseClient
    .from('user_pets')
    .select('level')
    .eq('id', selectedBattlePetId)
    .single();
  
  if (playerPetRes.error || !playerPetRes.data) {
    showToast('Error loading your pet!');
    return;
  }
  
  var playerLevel = playerPetRes.data.level || 1;
  
  // Get random enemy from selected zone with level variance
  var enemy = await getRandomEnemy(selectedBattleZone, playerLevel);
  
  if (!enemy) {
    showToast('No enemies found in this zone!');
    return;
  }
  
  // Track energy used today
  localStorage.setItem(energyKey, energyUsedToday + 5);
  
  // Start battle with the scaled enemy (pass the enemy object directly, not ID)
  await startBattleWithEnemy(selectedBattlePetId, enemy);
}

// Load battle pets when tab is opened
/**
 * Get random enemy from zone with level scaling
 */
async function getRandomEnemy(zone, playerLevel) {
  // ═══════════════════════════════════════════════════════════════════════
  // BOSS ENCOUNTER CHECK - 3% chance to encounter Shadow of Piper
  // ═══════════════════════════════════════════════════════════════════════
  var bossRoll = Math.random();
  if (bossRoll < 0.03 && playerSettings.spooky_enabled) {  // 3% chance (~1 in 33 battles) + spooky enabled
    console.log('🔥 BOSS ENCOUNTER! Shadow of Piper appears!');
    return await getBossEnemy(zone, playerLevel);
  }
  
  // Determine level range based on zone
  var minLevel, maxLevel;
  
  if (zone === 'outskirts') {
    // City Outskirts: -1 to +1 of player level (easier, more forgiving)
    minLevel = Math.max(1, playerLevel - 1);
    maxLevel = playerLevel + 1;
  } else if (zone === 'glade') {
    // Forest Glade: +0 to +2 of player level (harder)
    minLevel = playerLevel;
    maxLevel = playerLevel + 2;
  } else if (zone === 'deepwoods') {
    // Deep Woods: +1 to +3 of player level (very hard)
    minLevel = playerLevel + 1;
    maxLevel = playerLevel + 3;
  } else if (zone === 'ruins') {
    // Outside The Ruins: +2 to +5 of player level (extreme)
    minLevel = playerLevel + 2;
    maxLevel = playerLevel + 5;
  } else {
    // Default
    minLevel = playerLevel;
    maxLevel = playerLevel;
  }
  
  // Get base enemies for this zone
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('forest_zone', zone || 'outskirts');
  
  if (res.error || !res.data || res.data.length === 0) {
    console.error('No enemies found for zone:', zone, res.error);
    return null;
  }
  
  // CRITICAL: Filter out raccoons completely
  var filteredEnemies = res.data.filter(function(enemy) {
    return enemy.species !== 'raccoon' && 
           enemy.name.toLowerCase().indexOf('raccoon') === -1;
  });
  
  if (filteredEnemies.length === 0) {
    console.error('No enemies found after filtering raccoons');
    return null;
  }
  
  // Pick random base enemy
  var randomIndex = Math.floor(Math.random() * filteredEnemies.length);
  var baseEnemy = filteredEnemies[randomIndex];
  
  // Pick random level within range
  var enemyLevel = minLevel + Math.floor(Math.random() * (maxLevel - minLevel + 1));
  
  // ═══════════════════════════════════════════════════════════════════════
  // VARIANT SYSTEM - Baby/Adult/Elder + Elemental
  // ═══════════════════════════════════════════════════════════════════════
  
  var variant = 'baby';
  var elementalType = null;
  var statMultiplier = 1.0;
  
  if (zone === 'outskirts') {
    // City Outskirts: 100% Baby, no elementals
    variant = 'baby';
    statMultiplier = 0.8;
    
  } else if (zone === 'glade') {
    // Forest Glade: 50% Baby, 50% Adult, 10% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'baby';
      statMultiplier = 0.8;
    } else {
      variant = 'adult';
      statMultiplier = 1.5;
    }
    
    // 10% chance for elemental variant
    if (Math.random() < 0.10) {
      var elementals = ['shadow', 'flame', 'frost'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
    
  } else if (zone === 'deepwoods') {
    // Deep Woods: 50% Adult, 50% Elder, 25% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'adult';
      statMultiplier = 1.5;
    } else {
      variant = 'elder';
      statMultiplier = 2.2;
    }
    
    // 25% chance for elemental variant
    if (Math.random() < 0.25) {
      var elementals = ['shadow', 'flame', 'frost', 'storm'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
    
  } else if (zone === 'ruins') {
    // Outside The Ruins: 50% Adult, 50% Elder, 35% chance of elemental
    var roll = Math.random();
    if (roll < 0.50) {
      variant = 'adult';
      statMultiplier = 1.5;
    } else {
      variant = 'elder';
      statMultiplier = 2.2;
    }
    
    // 35% chance for elemental variant (higher than Deep Woods)
    if (Math.random() < 0.35) {
      var elementals = ['shadow', 'flame', 'frost', 'storm', 'void'];
      elementalType = elementals[Math.floor(Math.random() * elementals.length)];
      statMultiplier *= 1.3; // Elementals are 30% stronger
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // SPECIAL VARIANT SYSTEM - Shiny/Golden/Rare/Corrupted/Glitched
  // ═══════════════════════════════════════════════════════════════════════
  
  var specialVariant = null;
  var specialMultiplier = 1.0;
  var rewardMultiplier = 1.0;
  
  // Roll for special variants (independent of age/elemental)
  var specialRoll = Math.random();
  
  if (specialRoll < 0.005) {
    // 0.5% - GOLDEN (Ultra Rare)
    specialVariant = 'golden';
    specialMultiplier = 1.8;
    rewardMultiplier = 2.5;
  } else if (specialRoll < 0.015) {
    // 1% - SHINY (Very Rare)
    specialVariant = 'shiny';
    specialMultiplier = 1.4;
    rewardMultiplier = 1.8;
  } else if (specialRoll < 0.025) {
    // 1% - GLITCHED (Very Rare, random stats)
    specialVariant = 'glitched';
    specialMultiplier = 0.8 + (Math.random() * 1.0); // 0.8-1.8x random
    rewardMultiplier = 1.6;
  } else if (specialRoll < 0.055) {
    // 3% - CORRUPTED (Rare, harder)
    specialVariant = 'corrupted';
    specialMultiplier = 1.5;
    rewardMultiplier = 1.5;
  } else if (specialRoll < 0.105) {
    // 5% - RARE (Uncommon)
    specialVariant = 'rare';
    specialMultiplier = 1.2;
    rewardMultiplier = 1.25;
  }
  
  // Apply special variant multiplier on top of existing multipliers
  if (specialVariant) {
    statMultiplier *= specialMultiplier;
  }
  
  // Build variant name
  var variantName = '';
  
  // Special variant prefix (overrides other prefixes visually)
  if (specialVariant) {
    var specialPrefix = {
      'golden': '👑 Golden',
      'shiny': '✨ Shiny',
      'rare': '💎 Rare',
      'corrupted': '🔥 Corrupted',
      'glitched': '🌀 Glitched'
    };
    
    // Build compound name: "Golden Shadow Elder Slime" or "Shiny Baby Rabbit"
    if (elementalType) {
      var elementalPrefix = {
        'shadow': 'Shadow',
        'flame': 'Flame',
        'frost': 'Frost',
        'storm': 'Storm',
        'void': 'Void'
      };
      variantName = specialPrefix[specialVariant] + ' ' + elementalPrefix[elementalType] + ' ' + baseEnemy.name;
    } else {
      var agePrefix = {
        'baby': 'Baby',
        'adult': 'Adult',
        'elder': 'Elder'
      };
      variantName = specialPrefix[specialVariant] + ' ' + agePrefix[variant] + ' ' + baseEnemy.name;
    }
  } else {
    // No special variant - use normal naming
    if (elementalType) {
      var elementalPrefix = {
        'shadow': 'Shadow',
        'flame': 'Flame',
        'frost': 'Frost',
        'storm': 'Storm',
        'void': 'Void'
      };
      variantName = elementalPrefix[elementalType] + ' ' + baseEnemy.name;
    } else {
      var variantPrefix = {
        'baby': 'Baby',
        'adult': 'Adult',
        'elder': 'Elder'
      };
      variantName = variantPrefix[variant] + ' ' + baseEnemy.name;
    }
  }
  
  // Scale stats based on level (base stats + scaling per level)
  var levelBonus = enemyLevel - 1;
  var baseHP = Math.floor((baseEnemy.base_hp + (levelBonus * 8)) * statMultiplier);
  var baseATK = Math.floor((baseEnemy.base_attack + levelBonus) * statMultiplier);
  var baseDEF = Math.floor((baseEnemy.base_defense + Math.floor(levelBonus * 0.5)) * statMultiplier);
  var baseSPD = Math.floor((baseEnemy.base_speed + Math.floor(levelBonus * 0.5)) * statMultiplier);
  
  var scaledEnemy = {
    id: baseEnemy.id,
    species: baseEnemy.species,
    name: variantName,
    level: enemyLevel,
    base_hp: baseHP,
    base_attack: baseATK,
    base_defense: baseDEF,
    base_speed: baseSPD,
    sprite_sheet: baseEnemy.sprite_sheet,
    forest_zone: baseEnemy.forest_zone,
    difficulty_tier: baseEnemy.difficulty_tier,
    variant: variant,
    elementalType: elementalType,
    specialVariant: specialVariant,
    rewardMultiplier: rewardMultiplier
  };
  
  console.log('Generated enemy:', scaledEnemy.name, 'Level', enemyLevel, 'Variant:', variant, 'Elemental:', elementalType, 'Special:', specialVariant, 'Stats:', {
    hp: scaledEnemy.base_hp,
    atk: scaledEnemy.base_attack,
    def: scaledEnemy.base_defense,
    spd: scaledEnemy.base_speed
  });
  
  return scaledEnemy;
}

// ═══════════════════════════════════════════════════════════════════════
// BOSS ENCOUNTER SYSTEM - Shadow of Piper
// ═══════════════════════════════════════════════════════════════════════

async function getBossEnemy(zone, playerLevel) {
  // Convert zone shorthand to full name for database lookup
  var zoneNameMap = {
    'outskirts': 'City Outskirts',
    'glade': 'Forest Glade',
    'deepwoods': 'Deep Woods'
  };
  
  var fullZoneName = zoneNameMap[zone] || zone;
  
  // Fetch the boss from database
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('is_boss', true)
    .eq('forest_zone', fullZoneName)
    .single();
  
  if (res.error || !res.data) {
    console.error('Boss not found, falling back to normal enemy');
    return null;
  }
  
  var boss = res.data;
  
  // Scale boss level to player (+2 levels to make it scary)
  var bossLevel = playerLevel + 2;
  
  // Boss already has massive HP, just add level scaling
  var levelBonus = bossLevel - 1;
  
  return {
    id: boss.id,
    species: boss.species,
    name: boss.name,
    level: bossLevel,
    base_hp: boss.base_hp + (levelBonus * 15),  // Bosses scale faster!
    base_attack: boss.base_attack + levelBonus,
    base_defense: boss.base_defense + Math.floor(levelBonus * 0.5),
    base_speed: boss.base_speed + Math.floor(levelBonus * 0.5),
    image_file: boss.image_file,
    forest_zone: boss.forest_zone,
    difficulty_tier: boss.difficulty_tier,
    is_boss: true,
    exp_reward: boss.exp_reward,
    pp_reward: boss.pp_reward
  };
}

function triggerBossEntrance() {
  console.log('🔥 Triggering boss entrance sequence...');
  
  // Add UI fragmentation effect to entire page
  document.body.classList.add('boss-ui-glitch');
  
  // Stop ALL audio on the page (normal music, any other sounds)
  document.querySelectorAll('audio').forEach(function(audio) {
    audio.pause();
    audio.volume = 0;
  });
  
  // Play boss theme at lower volume
  if (!window.bossThemeAudio) {
    window.bossThemeAudio = new Audio('/boss-theme.mp3');
    window.bossThemeAudio.loop = true;
    window.bossThemeAudio.volume = 0.16;  // Reduced 20% (was 0.20)
    window.bossThemeAudio.onerror = function() {
      console.log('⚠️ Boss music file not found: /boss-theme.mp3');
      console.log('💡 Upload boss-theme.mp3 to your repo root to enable boss music!');
    };
  }
  window.bossThemeAudio.currentTime = 0;
  window.bossThemeAudio.volume = 0.16;  // Reduced 20% (was 0.20)
  
  window.bossThemeAudio.play().then(function() {
    console.log('🎵 Boss music playing!');
  }).catch(function(err) {
    console.log('⚠️ Boss music failed to play:', err.message);
  });
  
  // Add screen glitch effect - STAYS FOR ENTIRE FIGHT!
  var glitchOverlay = document.createElement('div');
  glitchOverlay.className = 'screen-glitch';
  glitchOverlay.id = 'boss-glitch-overlay';
  document.body.appendChild(glitchOverlay);
  
  // DON'T remove the glitch - it stays until battle ends!
  
  // Add boss entrance class to battle screen
  var battleScreen = el('battle-tab');
  if (battleScreen) {
    battleScreen.classList.add('boss-entrance', 'boss-battle-bg');
  }
  
  // Add BOSS BATTLE indicator
  var battleArea = el('battle-area');
  if (battleArea && !document.getElementById('boss-indicator')) {
    var indicator = document.createElement('div');
    indicator.id = 'boss-indicator';
    indicator.className = 'boss-battle-indicator';
    indicator.innerHTML = '⚠️ BOSS BATTLE ⚠️';
    battleArea.insertBefore(indicator, battleArea.firstChild);
  }
  
  // Start spawning creepy warning text
  startBossWarningText();
}

// Spawn creepy "YOU SHOULDN'T BE HERE" text that scrolls across screen
var bossWarningInterval = null;
var activeWarnings = []; // Track active warning positions to prevent overlap

function startBossWarningText() {
  // Clear any existing interval
  if (bossWarningInterval) clearInterval(bossWarningInterval);
  
  // Spawn 3-4 warnings immediately
  for (var i = 0; i < Math.floor(Math.random() * 2) + 3; i++) { // 3-4 texts
    setTimeout(function() {
      spawnWarningText();
    }, i * 800); // Stagger by 0.8 seconds
  }
  
  // Keep spawning 3-4 warnings every 4 seconds during boss fight
  bossWarningInterval = setInterval(function() {
    var count = Math.floor(Math.random() * 2) + 3; // 3-4 texts
    for (var i = 0; i < count; i++) {
      setTimeout(function() {
        spawnWarningText();
      }, i * 800);
    }
  }, 4000);
}

function spawnWarningText() {
  var warning = document.createElement('div');
  warning.className = 'boss-warning-text';
  warning.textContent = 'YOU SHOULDN\'T BE HERE';
  
  // Random direction: left-to-right or right-to-left
  var scrollRight = Math.random() > 0.5;
  
  // Find a Y position that doesn't overlap with existing warnings
  var y = findNonOverlappingY();
  
  warning.style.top = y + 'px';
  
  if (scrollRight) {
    warning.classList.add('boss-warning-scroll-right');
    warning.style.right = '-100%';
  } else {
    warning.classList.add('boss-warning-scroll-left');
    warning.style.left = '-100%';
  }
  
  // Track this warning's position
  var warningData = { element: warning, y: y, height: 100 }; // Approximate height
  activeWarnings.push(warningData);
  
  document.body.appendChild(warning);
  
  // Remove after animation completes (6 seconds)
  setTimeout(function() {
    if (warning && warning.parentNode) {
      warning.remove();
    }
    // Remove from active warnings array
    var idx = activeWarnings.indexOf(warningData);
    if (idx > -1) activeWarnings.splice(idx, 1);
  }, 6000);
}

function findNonOverlappingY() {
  var maxAttempts = 30; // Increased from 20 to handle more warnings
  var minGap = 140; // Increased gap for better spacing
  
  for (var attempt = 0; attempt < maxAttempts; attempt++) {
    // Random Y position (leaving margins)
    var y = Math.random() * (window.innerHeight - 200) + 50;
    
    // Check if this Y overlaps with any active warnings
    var overlaps = false;
    for (var i = 0; i < activeWarnings.length; i++) {
      var existing = activeWarnings[i];
      if (Math.abs(y - existing.y) < minGap) {
        overlaps = true;
        break;
      }
    }
    
    if (!overlaps) {
      return y;
    }
  }
  
  // If we can't find a spot, try splitting the screen into zones
  var zones = 5;
  var zoneHeight = (window.innerHeight - 200) / zones;
  var leastUsedZone = 0;
  var leastUsedCount = 999;
  
  for (var z = 0; z < zones; z++) {
    var zoneStart = 50 + (z * zoneHeight);
    var zoneEnd = zoneStart + zoneHeight;
    var count = 0;
    
    for (var i = 0; i < activeWarnings.length; i++) {
      if (activeWarnings[i].y >= zoneStart && activeWarnings[i].y < zoneEnd) {
        count++;
      }
    }
    
    if (count < leastUsedCount) {
      leastUsedCount = count;
      leastUsedZone = z;
    }
  }
  
  // Return a position in the least-used zone
  return 50 + (leastUsedZone * zoneHeight) + Math.random() * (zoneHeight * 0.8);
}

function stopBossWarningText() {
  if (bossWarningInterval) {
    clearInterval(bossWarningInterval);
    bossWarningInterval = null;
  }
  
  // Remove all existing warning texts
  document.querySelectorAll('.boss-warning-text').forEach(function(warning) {
    warning.remove();
  });
  
  // Clear active warnings array
  activeWarnings = [];
}

function triggerBossDeathScreen() {
  console.log('💀 Boss death screen triggered...');
  
  // Stop scrolling warnings
  stopBossWarningText();
  
  // Start glitchy music fade-out effect (now 6 seconds)
  startBossMusicGlitchFade();
  
  // Create fade to black overlay
  var fadeOverlay = document.createElement('div');
  fadeOverlay.id = 'boss-death-fade';
  fadeOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: black; opacity: 0; z-index: 99999; pointer-events: none; transition: opacity 5s ease-in;';
  document.body.appendChild(fadeOverlay);
  
  // Wave 1: Initial warnings (0.5s) - 3-4 warnings
  setTimeout(function() {
    var count1 = Math.floor(Math.random() * 2) + 3; // 3-4
    for (var i = 0; i < count1; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 400);
    }
  }, 500);
  
  // Wave 2: More warnings (1.5s) - 2-3 warnings
  setTimeout(function() {
    var count2 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count2; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 350);
    }
  }, 1500);
  
  // Wave 3: Even more (2.5s) - 3-4 warnings
  setTimeout(function() {
    var count3 = Math.floor(Math.random() * 2) + 3; // 3-4
    for (var i = 0; i < count3; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 450);
    }
  }, 2500);
  
  // Wave 4: Keep them coming (3.5s) - 2-3 warnings
  setTimeout(function() {
    var count4 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count4; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 400);
    }
  }, 3500);
  
  // Wave 5: Final wave (4.5s) - 2-3 warnings
  setTimeout(function() {
    var count5 = Math.floor(Math.random() * 2) + 2; // 2-3
    for (var i = 0; i < count5; i++) {
      setTimeout(function() {
        spawnDeathWarning();
      }, i * 500);
    }
  }, 4500);
  
  // Start fade to black
  setTimeout(function() {
    fadeOverlay.style.opacity = '1';
  }, 100);
  
  // After fade completes, clean up and go home (now 6 seconds total)
  setTimeout(function() {
    // Remove all boss effects
    clearBossEffects();
    
    // Remove death warnings
    document.querySelectorAll('.boss-death-warning').forEach(function(w) {
      w.remove();
    });
    
    // Remove fade overlay
    fadeOverlay.remove();
    
    // Stop boss music and resume normal
    resumeNormalMusic();
    
    // Go to home tab
    showTab('home');
    
    // Show defeat toast
    showToast('💀 You were defeated by Shadow of Piper...');
  }, 6000); // Extended from 3500ms to 6000ms (6 seconds)
}

function startBossMusicGlitchFade() {
  if (!window.bossThemeAudio) return;
  
  var audio = window.bossThemeAudio;
  var startTime = Date.now();
  var fadeDuration = 6000; // Extended to 6 seconds (was 3500)
  var startVolume = audio.volume;
  
  // Create audio context for pitch/distortion effects
  if (!window.audioContext) {
    try {
      window.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.log('Web Audio API not supported, falling back to simple fade');
      simpleMusicFade(audio, startVolume, fadeDuration);
      return;
    }
  }
  
  var ctx = window.audioContext;
  
  // Only create source once
  if (!window.bossAudioSource) {
    var source = ctx.createMediaElementSource(audio);
    var gainNode = ctx.createGain();
    var filter = ctx.createBiquadFilter();
    
    // Set up filter for distortion effect
    filter.type = 'lowpass';
    filter.frequency.value = 1000;
    
    // Connect: source -> filter -> gain -> destination
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    window.bossAudioSource = source;
    window.bossGainNode = gainNode;
    window.bossFilterNode = filter;
  }
  
  var gainNode = window.bossGainNode;
  var filter = window.bossFilterNode;
  
  // Glitchy fade-out animation
  var glitchInterval = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / fadeDuration, 1);
    
    if (progress >= 1) {
      clearInterval(glitchInterval);
      audio.pause();
      return;
    }
    
    // Volume fade (smooth exponential curve)
    var volumeFade = Math.pow(1 - progress, 2);
    gainNode.gain.value = volumeFade;
    
    // Pitch distortion (slow down playback)
    audio.playbackRate = 1 - (progress * 0.5); // Slow down to 0.5x speed
    
    // Filter sweep (muffle the sound)
    filter.frequency.value = 1000 - (progress * 900); // 1000Hz -> 100Hz
    
    // Random glitch stutters
    if (Math.random() < 0.15) {
      audio.playbackRate = 0.3 + Math.random() * 0.4; // Random slow stutters
      setTimeout(function() {
        audio.playbackRate = Math.max(0.5, 1 - (progress * 0.5));
      }, 100);
    }
  }, 50); // Update every 50ms
}

function simpleMusicFade(audio, startVolume, duration) {
  // Fallback for browsers without Web Audio API
  var startTime = Date.now();
  var fadeInterval = setInterval(function() {
    var elapsed = Date.now() - startTime;
    var progress = Math.min(elapsed / duration, 1);
    
    if (progress >= 1) {
      clearInterval(fadeInterval);
      audio.pause();
      return;
    }
    
    // Simple volume fade
    audio.volume = startVolume * (1 - progress);
    
    // Slow down playback
    audio.playbackRate = 1 - (progress * 0.5);
  }, 50);
}

function spawnDeathWarning() {
  var warning = document.createElement('div');
  warning.className = 'boss-death-warning';
  warning.textContent = 'WE WARNED YOU';
  
  // Random position
  var x = Math.random() * (window.innerWidth - 500) + 100;
  var y = Math.random() * (window.innerHeight - 200) + 100;
  
  warning.style.position = 'fixed';
  warning.style.left = x + 'px';
  warning.style.top = y + 'px';
  warning.style.fontSize = '4rem';
  warning.style.fontWeight = '900';
  warning.style.color = '#FF0000';
  warning.style.textShadow = '0 0 20px #FF0000, 0 0 40px #FF0000, 5px 5px 0 #000';
  warning.style.zIndex = '100000';
  warning.style.fontFamily = 'Arial Black, sans-serif';
  warning.style.opacity = '0';
  warning.style.animation = 'death-warning-shake 0.15s infinite, death-warning-fade 5s ease-in-out forwards';
  
  document.body.appendChild(warning);
}

function resumeNormalMusic() {
  // Stop boss music
  if (window.bossThemeAudio) {
    window.bossThemeAudio.pause();
    window.bossThemeAudio.currentTime = 0;
    window.bossThemeAudio.playbackRate = 1.0; // Reset playback rate
    window.bossThemeAudio.volume = 0.20; // Reset volume
  }
  
  // Clean up audio nodes
  window.bossAudioSource = null;
  window.bossGainNode = null;
  window.bossFilterNode = null;
  
  // Resume normal background music if it exists
  var bgMusic = document.querySelector('audio[loop]');
  if (bgMusic) {
    bgMusic.volume = 0.3; // Reset to normal volume
    bgMusic.playbackRate = 1.0; // Ensure normal speed
    bgMusic.play();
  }
}

function clearBossEffects() {
  // Remove boss effects after battle
  var battleScreen = el('battle-tab');
  if (battleScreen) {
    battleScreen.classList.remove('boss-entrance', 'boss-battle-bg');
  }
  
  // Remove UI fragmentation effect
  document.body.classList.remove('boss-ui-glitch');
  
  var indicator = document.getElementById('boss-indicator');
  if (indicator) indicator.remove();
  
  var glitch = document.getElementById('boss-glitch-overlay');
  if (glitch) glitch.remove();
  
  // Reset boss battle flag
  isBossBattle = false;
  
  // Stop creepy warning text
  stopBossWarningText();
  
  // Stop boss music
  if (window.bossThemeAudio) {
    window.bossThemeAudio.pause();
    window.bossThemeAudio.currentTime = 0;
  }
  
  // Resume ALL audio on page (restore normal music)
  document.querySelectorAll('audio').forEach(function(audio) {
    if (audio !== window.bossThemeAudio) {
      audio.volume = 0.5;  // Set to normal volume
      audio.play().catch(function() {}); // Silently fail if can't autoplay
    }
  });
}

// ========================================
// MELON MASCOT SPOOKY DIALOGUE SYSTEM
// ========================================

var melonDialogueTimeout = null;

function initMelonDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  // 3% chance for spooky dialogue (was 10%, now much rarer!)
  var isSpooky = Math.random() < 0.03;
  
  if (isSpooky && playerSettings.spooky_enabled) {
    showSpookyDialogue();
  } else {
    showNormalDialogue();
  }
}

function showNormalDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  dialogueEl.innerHTML = "Welcome to the Shop! I'm Melon! Buy whatever you need!";
  dialogueEl.style.animation = 'bubble-float 3s ease-in-out infinite';
}

function showSpookyDialogue() {
  var dialogueEl = document.getElementById('melon-dialogue');
  if (!dialogueEl) return;
  
  // TRIGGER DIALOGUE BOX GLITCH EFFECT ONLY!
  dialogueEl.classList.add('page-glitch');
  // Remove glitch class after animation completes
  setTimeout(function() {
    dialogueEl.classList.remove('page-glitch');
  }, 800);
  
  // Spooky message with glitchy "Piper"
  dialogueEl.innerHTML = 'I have to run the shop now that <span class="glitch-text">Piper</span> has gone missing';
  dialogueEl.style.animation = 'bubble-float 3s ease-in-out infinite';
  
  // Revert back to normal dialogue after 5-6 seconds
  var revertTime = 5000 + Math.random() * 1000; // 5-6 seconds
  
  clearTimeout(melonDialogueTimeout);
  melonDialogueTimeout = setTimeout(function() {
    showNormalDialogue();
  }, revertTime);
}

// Initialize Melon dialogue when shop tab is shown
// Use MutationObserver to detect when shop section becomes active
function setupMelonDialogueWatcher() {
  var shopSection = document.getElementById('section-shop');
  if (!shopSection) return;
  
  // Check if shop is already active on load
  if (shopSection.classList.contains('active')) {
    setTimeout(initMelonDialogue, 100);
  }
  
  // Watch for class changes to detect when shop becomes active
  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (shopSection.classList.contains('active')) {
          setTimeout(initMelonDialogue, 100);
        }
      }
    });
  });
  
  observer.observe(shopSection, { attributes: true });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMelonDialogueWatcher);
} else {
  setupMelonDialogueWatcher();
}


// ═══════════════════════════════════════════════════════════════════════════
// FRIENDS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var currentFriendTab = 'list';
var currentProfileUserId = null; // Track the profile being viewed
var currentFriendshipId = null; // Track friendship ID for current profile

// Update friend request notification badge
async function updateFriendRequestBadge() {
  if (!currentUser) return;
  
  try {
    var { data, error } = await supabaseClient
      .from('friendships')
      .select('id')
      .eq('addressee_id', currentUser.id)
      .eq('status', 'pending');
    
    if (error) throw error;
    
    var count = data ? data.length : 0;
    var badge = document.getElementById('friend-request-badge');
    
    if (badge) {
      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    
    // Also update the requests tab badge
    var requestsBadge = document.getElementById('requests-count-badge');
    if (requestsBadge) {
      if (count > 0) {
        requestsBadge.textContent = count;
        requestsBadge.style.display = 'inline';
      } else {
        requestsBadge.style.display = 'none';
      }
    }
  } catch (err) {
    console.error('Error updating friend request badge:', err);
  }
}

// Switch between friends tabs
function switchFriendsTab(tab) {
  currentFriendTab = tab;
  
  // Update tab buttons
  document.getElementById('tab-friends-list').classList.toggle('active', tab === 'list');
  document.getElementById('tab-friend-requests').classList.toggle('active', tab === 'requests');
  document.getElementById('tab-blocked-users').classList.toggle('active', tab === 'blocked');
  
  // Show/hide containers
  document.getElementById('friends-list-container').style.display = tab === 'list' ? 'block' : 'none';
  document.getElementById('friend-requests-container').style.display = tab === 'requests' ? 'block' : 'none';
  document.getElementById('blocked-users-container').style.display = tab === 'blocked' ? 'block' : 'none';
  
  // Load appropriate data
  if (tab === 'list') {
    loadFriendsList();
  } else if (tab === 'requests') {
    loadFriendRequests();
  } else if (tab === 'blocked') {
    loadBlockedUsers();
  }
}

// Load friends list
async function loadFriendsList() {
  if (!currentUser) return;
  
  var container = document.getElementById('friends-list-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get friendships where current user is either requester or addressee and status is accepted
    var { data: friendships, error } = await supabaseClient
      .from('friendships')
      .select('id, requester_id, addressee_id, created_at')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id);
    
    if (error) throw error;
    
    if (!friendships || friendships.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">👥</div><p>No friends yet!</p><p style="color:var(--text-light);font-size:0.9rem;">Search for players above to send friend requests.</p></div>';
      document.getElementById('friends-count-badge').textContent = '0';
      return;
    }
    
    // Get the friend user IDs (the other person in each friendship)
    var friendIds = friendships.map(function(f) {
      return f.requester_id === currentUser.id ? f.addressee_id : f.requester_id;
    });
    
    // Fetch friend data
    var { data: friends, error: friendError } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .in('id', friendIds);
    
    if (friendError) throw friendError;
    
    // Get pet counts and levels for each friend
    var { data: petData, error: petError } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', friendIds);
    
    if (petError) throw petError;
    
    // Get badge counts for each friend
    var { data: badgeData, error: badgeError } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', friendIds);
    
    if (badgeError) throw badgeError;
    
    // Calculate stats for each friend
    friends.forEach(function(friend) {
      var pets = petData.filter(function(p) { return p.user_id === friend.id; });
      friend.petCount = pets.length;
      friend.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      friend.badgeCount = badgeData.filter(function(b) { return b.user_id === friend.id; }).length;
      friend.friendshipId = friendships.find(function(f) {
        return f.requester_id === friend.id || f.addressee_id === friend.id;
      }).id;
    });
    
    // Sort by points
    friends.sort(function(a, b) { return (b.pawketpoints || 0) - (a.pawketpoints || 0); });
    
    // Render friend cards
    var html = '';
    friends.forEach(function(friend) {
      html += renderFriendCard(friend, 'friend');
    });
    
    container.innerHTML = html;
    document.getElementById('friends-count-badge').textContent = friends.length;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading friends: ' + err.message + '</p></div>';
    console.error('Error loading friends:', err);
  }
}

// Load friend requests
async function loadFriendRequests() {
  if (!currentUser) return;
  
  var container = document.getElementById('friend-requests-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get pending requests where current user is the addressee
    var { data: requests, error } = await supabaseClient
      .from('friendships')
      .select('id, requester_id, created_at')
      .eq('addressee_id', currentUser.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!requests || requests.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">📬</div><p>No pending friend requests</p></div>';
      return;
    }
    
    // Get requester user data
    var requesterIds = requests.map(function(r) { return r.requester_id; });
    var { data: requesters, error: requesterError } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .in('id', requesterIds);
    
    if (requesterError) throw requesterError;
    
    // Get stats for each requester
    var { data: petData, error: petError } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', requesterIds);
    
    if (petError) throw petError;
    
    var { data: badgeData, error: badgeError } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', requesterIds);
    
    if (badgeError) throw badgeError;
    
    // Match up data
    requesters.forEach(function(requester) {
      var pets = petData.filter(function(p) { return p.user_id === requester.id; });
      requester.petCount = pets.length;
      requester.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      requester.badgeCount = badgeData.filter(function(b) { return b.user_id === requester.id; }).length;
      requester.friendshipId = requests.find(function(r) { return r.requester_id === requester.id; }).id;
    });
    
    // Render request cards
    var html = '';
    requesters.forEach(function(requester) {
      html += renderFriendCard(requester, 'request');
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading requests: ' + err.message + '</p></div>';
    console.error('Error loading friend requests:', err);
  }
}

// Load blocked users
async function loadBlockedUsers() {
  if (!currentUser) return;
  
  var container = document.getElementById('blocked-users-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: blocks, error } = await supabaseClient
      .from('blocked_users')
      .select('id, blocked_user_id, created_at')
      .eq('blocker_id', currentUser.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    if (!blocks || blocks.length === 0) {
      container.innerHTML = '<div class="empty-state"><div style="font-size:3rem;margin-bottom:12px;">✅</div><p>No blocked users</p></div>';
      document.getElementById('blocked-count-badge').style.display = 'none';
      return;
    }
    
    // Get blocked user data
    var blockedIds = blocks.map(function(b) { return b.blocked_user_id; });
    var { data: blockedUsers, error: userError } = await supabaseClient
      .from('players')
      .select('id, username, created_at')
      .in('id', blockedIds);
    
    if (userError) throw userError;
    
    // Match up block IDs
    blockedUsers.forEach(function(user) {
      user.blockId = blocks.find(function(b) { return b.blocked_user_id === user.id; }).id;
    });
    
    // Render blocked user cards
    var html = '';
    blockedUsers.forEach(function(user) {
      html += renderFriendCard(user, 'blocked');
    });
    
    container.innerHTML = html;
    document.getElementById('blocked-count-badge').textContent = blockedUsers.length;
    document.getElementById('blocked-count-badge').style.display = 'inline';
    
  } catch (err) {
    container.innerHTML = '<div class="empty-state"><p>Error loading blocked users: ' + err.message + '</p></div>';
    console.error('Error loading blocked users:', err);
  }
}

// Render friend card (used for friends, requests, and blocked users)
function renderFriendCard(user, type) {
  var cardClass = type === 'request' ? 'friend-request-card' : type === 'blocked' ? 'blocked-user-card' : '';
  
  var html = '<div class="friend-card ' + cardClass + '">';
  html += '  <div class="friend-avatar">' + user.username.charAt(0).toUpperCase() + '</div>';
  html += '  <div class="friend-info">';
  html += '    <div class="friend-username" onclick="viewProfile(\'' + escapeHtml(user.username) + '\')">' + escapeHtml(user.username) + '</div>';
  
  if (type !== 'blocked') {
    html += '    <div class="friend-stats">';
    html += '      <span class="friend-stat">🪙 ' + (user.pawketpoints || 0).toLocaleString() + ' PP</span>';
    html += '      <span class="friend-stat">🐾 ' + (user.petCount || 0) + ' Pets</span>';
    html += '      <span class="friend-stat">⭐ Level ' + (user.totalLevel || 0) + '</span>';
    html += '      <span class="friend-stat">🎖️ ' + (user.badgeCount || 0) + ' Badges</span>';
    html += '    </div>';
  }
  
  html += '  </div>';
  html += '  <div class="friend-actions">';
  
  if (type === 'friend') {
    html += '<button class="btn btn-outline btn-sm" onclick="viewProfile(\'' + escapeHtml(user.username) + '\')">View Profile</button>';
    html += '<button class="btn btn-outline btn-sm btn-danger" onclick="confirmRemoveFriend(\'' + user.friendshipId + '\', \'' + escapeHtml(user.username) + '\')">Remove Friend</button>';
  } else if (type === 'request') {
    html += '<button class="btn btn-primary btn-sm" onclick="acceptFriendRequest(\'' + user.friendshipId + '\')">Accept</button>';
    html += '<button class="btn btn-outline btn-sm" onclick="declineFriendRequest(\'' + user.friendshipId + '\')">Decline</button>';
  } else if (type === 'blocked') {
    html += '<button class="btn btn-outline btn-sm" onclick="confirmUnblock(\'' + user.blockId + '\', \'' + escapeHtml(user.username) + '\')">Unblock</button>';
  }
  
  html += '  </div>';
  html += '</div>';
  
  return html;
}

// Search for players
async function searchPlayers() {
  var searchInput = document.getElementById('friend-search-input');
  var query = searchInput.value.trim();
  var resultsContainer = document.getElementById('friend-search-results');
  
  if (!query) {
    resultsContainer.innerHTML = '';
    return;
  }
  
  resultsContainer.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: players, error } = await supabaseClient
      .from('players')
      .select('id, username, pawketpoints, created_at')
      .ilike('username', '%' + query + '%')
      .limit(5);
    
    if (error) throw error;
    
    if (!players || players.length === 0) {
      resultsContainer.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:16px;">No players found matching "' + escapeHtml(query) + '"</p>';
      return;
    }
    
    // Get stats for each player
    var playerIds = players.map(function(p) { return p.id; });
    
    var { data: petData } = await supabaseClient
      .from('user_pets')
      .select('user_id, level')
      .in('user_id', playerIds);
    
    var { data: badgeData } = await supabaseClient
      .from('user_badges')
      .select('user_id')
      .in('user_id', playerIds);
    
    // Check friendship status for each
    var { data: friendships } = await supabaseClient
      .from('friendships')
      .select('requester_id, addressee_id, status')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id)
      .in('requester_id', playerIds.concat([currentUser.id]))
      .in('addressee_id', playerIds.concat([currentUser.id]));
    
    players.forEach(function(player) {
      var pets = petData ? petData.filter(function(p) { return p.user_id === player.id; }) : [];
      player.petCount = pets.length;
      player.totalLevel = pets.reduce(function(sum, p) { return sum + (p.level || 0); }, 0);
      player.badgeCount = badgeData ? badgeData.filter(function(b) { return b.user_id === player.id; }).length : 0;
      
      // Check friendship status
      var friendship = friendships ? friendships.find(function(f) {
        return (f.requester_id === currentUser.id && f.addressee_id === player.id) ||
               (f.addressee_id === currentUser.id && f.requester_id === player.id);
      }) : null;
      
      player.friendshipStatus = friendship ? friendship.status : null;
      player.isSelf = player.id === currentUser.id;
    });
    
    // Render search results
    var html = '';
    players.forEach(function(player) {
      html += '<div class="friend-card search-result-card">';
      html += '  <div class="friend-avatar">' + player.username.charAt(0).toUpperCase() + '</div>';
      html += '  <div class="friend-info">';
      html += '    <div class="friend-username" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">' + escapeHtml(player.username) + '</div>';
      html += '    <div class="friend-stats">';
      html += '      <span class="friend-stat">🪙 ' + (player.pawketpoints || 0).toLocaleString() + ' PP</span>';
      html += '      <span class="friend-stat">🐾 ' + player.petCount + ' Pets</span>';
      html += '      <span class="friend-stat">⭐ Level ' + player.totalLevel + '</span>';
      html += '      <span class="friend-stat">🎖️ ' + player.badgeCount + ' Badges</span>';
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="friend-actions">';
      
      if (player.isSelf) {
        html += '<span style="color:var(--text-light);font-size:0.9rem;">This is you!</span>';
      } else if (player.friendshipStatus === 'accepted') {
        html += '<button class="btn btn-success btn-sm" disabled>✅ Friends</button>';
      } else if (player.friendshipStatus === 'pending') {
        html += '<button class="btn btn-outline btn-sm" disabled>⏳ Request Pending</button>';
      } else {
        html += '<button class="btn btn-primary btn-sm" onclick="sendFriendRequestToUser(\'' + player.id + '\', \'' + escapeHtml(player.username) + '\')">➕ Add Friend</button>';
      }
      
      html += '<button class="btn btn-outline btn-sm" onclick="viewProfile(\'' + escapeHtml(player.username) + '\')">View Profile</button>';
      html += '  </div>';
      html += '</div>';
    });
    
    resultsContainer.innerHTML = html;
    
  } catch (err) {
    resultsContainer.innerHTML = '<p style="text-align:center;color:var(--red);padding:16px;">Error: ' + err.message + '</p>';
    console.error('Error searching players:', err);
  }
}

// Send friend request from search results
async function sendFriendRequestToUser(userId, username) {
  if (!currentUser) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: userId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent to ' + username + '! 🎉');
    searchPlayers(); // Refresh search results
    
  } catch (err) {
    showToast('Error sending friend request: ' + err.message);
    console.error('Error sending friend request:', err);
  }
}

// Send friend request from profile page
async function sendFriendRequest() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: currentProfileUserId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    showToast('Friend request sent! 🎉');
    updateProfileButtons(); // Refresh button state
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error sending friend request:', err);
  }
}

// Accept friend request
async function acceptFriendRequest(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request accepted! 🎉');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error accepting friend request:', err);
  }
}

// Decline friend request
async function declineFriendRequest(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend request declined');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error declining friend request:', err);
  }
}

// Confirm and remove friend
function confirmRemoveFriend(friendshipId, username) {
  if (confirm('Remove ' + username + ' from your friends list?')) {
    removeFriendById(friendshipId);
  }
}

async function removeFriendById(friendshipId) {
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .delete()
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    showToast('Friend removed');
    loadFriendsList();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error removing friend:', err);
  }
}

// Remove friend from profile page
async function removeFriend() {
  if (!currentFriendshipId) return;
  
  var username = document.getElementById('profile-username').textContent;
  if (confirm('Remove ' + username + ' from your friends list?')) {
    removeFriendById(currentFriendshipId);
    updateProfileButtons();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLOCKING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Block user from profile
async function blockUser() {
  if (!currentUser || !currentProfileUserId) return;
  
  var username = document.getElementById('profile-username').textContent;
  if (!confirm('Block ' + username + '? They will not be able to view your profile or send you messages.')) {
    return;
  }
  
  try {
    // Remove friendship if exists
    await supabaseClient
      .from('friendships')
      .delete()
      .or('and(requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentProfileUserId + '),and(requester_id.eq.' + currentProfileUserId + ',addressee_id.eq.' + currentUser.id + ')');
    
    // Add to blocked users
    var { error } = await supabaseClient
      .from('blocked_users')
      .insert([{
        blocker_id: currentUser.id,
        blocked_user_id: currentProfileUserId
      }]);
    
    if (error) throw error;
    
    showToast('User blocked');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error blocking user:', err);
  }
}

// Unblock user from profile
async function unblockUser() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('blocked_users')
      .delete()
      .eq('blocker_id', currentUser.id)
      .eq('blocked_user_id', currentProfileUserId);
    
    if (error) throw error;
    
    showToast('User unblocked');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error unblocking user:', err);
  }
}

// Confirm and unblock from blocked users list
function confirmUnblock(blockId, username) {
  if (confirm('Unblock ' + username + '?')) {
    unblockById(blockId);
  }
}

async function unblockById(blockId) {
  try {
    var { error } = await supabaseClient
      .from('blocked_users')
      .delete()
      .eq('id', blockId);
    
    if (error) throw error;
    
    showToast('User unblocked');
    loadBlockedUsers();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error unblocking user:', err);
  }
}

// Update profile action buttons based on relationship status
async function updateProfileButtons() {
  if (!currentUser || !currentProfileUserId) return;
  
  var actionsDiv = document.getElementById('profile-actions');
  var addFriendBtn = document.getElementById('add-friend-btn');
  var pendingBtn = document.getElementById('pending-friend-btn');
  var alreadyFriendsBtn = document.getElementById('already-friends-btn');
  var removeFriendBtn = document.getElementById('remove-friend-btn');
  var blockBtn = document.getElementById('block-user-btn');
  var unblockBtn = document.getElementById('unblock-user-btn');
  var guestbookForm = document.getElementById('guestbook-post-form');
  
  // Hide all buttons initially
  [addFriendBtn, pendingBtn, alreadyFriendsBtn, removeFriendBtn, blockBtn, unblockBtn].forEach(function(btn) {
    if (btn) btn.style.display = 'none';
  });
  
  // Check if viewing own profile
  if (currentProfileUserId === currentUser.id) {
    actionsDiv.style.display = 'none';
    if (guestbookForm) guestbookForm.style.display = 'none';
    return;
  }
  
  actionsDiv.style.display = 'flex';
  
  try {
    // Check if blocked
    var { data: blockCheck } = await supabaseClient
      .from('blocked_users')
      .select('id')
      .eq('blocker_id', currentUser.id)
      .eq('blocked_user_id', currentProfileUserId)
      .single();
    
    if (blockCheck) {
      // User is blocked
      if (unblockBtn) unblockBtn.style.display = 'inline-block';
      if (guestbookForm) guestbookForm.style.display = 'none';
      return;
    }
    
    // Show block button
    if (blockBtn) blockBtn.style.display = 'inline-block';
    
    // Check friendship status
    var { data: friendship } = await supabaseClient
      .from('friendships')
      .select('id, status, requester_id, addressee_id')
      .or('and(requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentProfileUserId + '),and(requester_id.eq.' + currentProfileUserId + ',addressee_id.eq.' + currentUser.id + ')')
      .single();
    
    if (friendship) {
      currentFriendshipId = friendship.id;
      
      if (friendship.status === 'accepted') {
        // Already friends
        if (alreadyFriendsBtn) alreadyFriendsBtn.style.display = 'inline-block';
        if (removeFriendBtn) removeFriendBtn.style.display = 'inline-block';
      } else if (friendship.status === 'pending') {
        // Request pending
        if (pendingBtn) pendingBtn.style.display = 'inline-block';
      }
    } else {
      // No friendship - show add friend button
      currentFriendshipId = null;
      if (addFriendBtn) addFriendBtn.style.display = 'inline-block';
    }
    
    // Show guestbook form if not blocked
    if (guestbookForm) guestbookForm.style.display = 'block';
    
  } catch (err) {
    console.error('Error updating profile buttons:', err);
    // If error, show add friend button as default
    if (addFriendBtn) addFriendBtn.style.display = 'inline-block';
    if (blockBtn) blockBtn.style.display = 'inline-block';
    if (guestbookForm) guestbookForm.style.display = 'block';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GUESTBOOK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Character counter for guestbook
/* ═══════════════════════════════════════════════════════════════════════
   EVENT ANNOUNCEMENT TICKER
   ═══════════════════════════════════════════════════════════════════════ */

function getEventAnnouncement() {
  if (!worldEvents || !worldEvents.currentEvent) return '';
  
  var event = worldEvents.currentEvent;
  var announcements = {
    'mushroom_migration': '🍄 Mushroom Migration Day! +25% Battle XP & 50% more encounters!',
    'spoon_week': '🥄 Spoon Appreciation Week! Spoon weapons deal 50% more damage & 25% off spoons!',
    'pyxie_chaos': '✨ Pyxie Chaos Festival! 30% chance of random bonuses & 50% more PP from everything!',
    'golden_bunny': '🐰 Golden Bunny Sighting! 2x rare item drops & 50% more critical hits!',
    'strange_fog': '🌫️ Strange Fog in the Deep Woods! Happiness decays 50% slower & 25% more exploration rewards!',
    'pet_parade': '🎉 Grand Pet Parade! 2x happiness from interactions & 25% more pet XP!',
    'marketplace_madness': '🛒 Marketplace Madness! 30% off all shop items!',
    'void_watching': '👁️ The Void is Watching! 15% bonus to all stats & 20% mystery reward chance!',
    'arena_championship': '⚔️ Arena Championship! Double PP from battles & 50% more battle XP!',
    'snack_shortage': '🍪 Great Snack Shortage! Snacks 25% less effective but 50% cheaper!',
    'full_moon': '🌕 Full Moon Night! 40% stronger at night & 50% faster energy regen!',
    'butterfly_swarm': '🦋 Suspicious Butterfly Swarm! 2x discovery chance & 50% more exploration rewards!',
    'napping_day': '😴 Tactical Napping Day! 2.5x faster energy regen!',
    'ruins_rumbling': '🏛️ The Ruins are Rumbling! DOUBLE all rewards & 3x legendary drop chance!',
    'friendship_festival': '💖 Friendship Festival! Double friendship XP & 50% more happiness!'
  };
  
  return announcements[event.id] || '';
}

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2A: NEWS TICKER SYSTEM - Rotating Flavor Messages
   ═══════════════════════════════════════════════════════════════════════ */

var newsTicker = {
  messages: [
    "BREAKING: Local Pyxie banned from spoon dueling tournament for 'excessive enthusiasm'.",
    "Deep Woods mushrooms behaving strangely tonight... locals advised to avoid eye contact.",
    "Market alert: Wooden spoon prices surge 400% after celebrity endorsement.",
    "WARNING: Do NOT feed glitter to your pets. We repeat: DO NOT FEED GLITTER.",
    "EXCLUSIVE: Golden Bunny spotted near ruins, still refuses to comment on allegations.",
    "Weather report: 60% chance of cursed fog tomorrow. Bring your emotional support spoon.",
    "Community notice: If you see a mushroom wearing a tiny hat, please report immediately.",
    "Breaking news: Scientists confirm pets DO judge you when you snack without sharing.",
    "SCANDAL: Embertail caught hoarding all the good snacks. Investigation pending.",
    "Public service: The void is watching. Not judgmentally, just... watching. Respectfully.",
    "URGENT: Please stop asking pets about cryptocurrency. They don't know. They're pets.",
    "Local Embertail (the Protogen) spotted teaching battle tactics to confused woodland creatures.",
    "ALERT: Suspicious activity in Deep Woods. Mushrooms organizing into 'battle formations.'",
    "Breaking: Pyxshuul the Sparkledog denies starting underground spoon fighting ring. Evidence suggests otherwise.",
    "Weather update: Today's chaos energy levels at 87%. Stay hydrated.",
    "REMINDER: Pets cannot sign legal documents. Please stop trying.",
    "Community bulletin: The ruins are NOT a good first date location. Trust us on this.",
    "Breaking news: Local pet achieves enlightenment, immediately forgets and chases butterfly.",
    "SCANDAL: Someone taught the mushrooms to dance. Investigations ongoing.",
    "Public notice: If your pet starts whispering in ancient languages, that's probably fine.",
    "Market report: Snack futures looking strong. Invest in cuddles while you can.",
    "Breaking: Witnesses report Embertail the Protogen performing 'sick flips' near the marketplace.",
    "URGENT: Do not challenge random forest creatures to duels. This should be obvious.",
    "Weather advisory: Emotionally unstable mushrooms detected in sector 7.",
    "Community update: The Deep Woods are NOT 'just vibes.' There are actual monsters.",
    "BREAKING: Pyxshuul's latest scheme involves 'tactical napping.' Details at 11.",
    "Alert: If you hear ominous flute music, that's just the Pied Piper. Probably fine.",
    "Public service: Wooden spoons make terrible weapons. Golden spoons make EXCELLENT weapons.",
    "Breaking news: Local pet discovers mirror, has existential crisis, recovers.",
    "SCANDAL: Someone's been stealing everyone's left socks. Pet involvement suspected.",
    "Market alert: Friendship prices at all-time high. Wholesome vibes surging.",
    "Community notice: Please stop trying to adopt the battle arena mushrooms.",
    "BREAKING: Embertail rated 'Most Likely to Start Chaos' for third year running.",
    "Weather report: Today's aesthetic is 'cozy apocalypse.' Dress accordingly.",
    "Alert: The golden bunny is NOT your friend. The golden bunny is NOBODY'S friend.",
    "Public notice: Stop feeding the void. It doesn't need snacks. It IS the snack.",
    "Breaking: Scientists discover pets can sense when you're about to leave. Technology stolen.",
    "URGENT: The mushrooms are plotting something. Keep your spoons close.",
    "Community update: Battle Arena now serving emotional support tea. Still violent though.",
    "Market report: Cuddle economy booming. Invest in soft things immediately.",
    "BREAKING: Pyxshuul caught napping in public fountain. Claims it was 'tactical research.'",
    "Alert: If your pet starts glowing, that's either very good or very bad. Hard to say.",
    "Weather advisory: Today's mood is 'slightly cursed but manageable.' Stay safe out there.",
    "Public service: Remember to tell your pets they're doing a great job. They work hard.",
    "Breaking news: Local Ember achieves 'maximum cuteness,' scientists baffled.",
    "SCANDAL: Underground pet cuddle syndicate discovered. All participants suspiciously happy.",
    "Community notice: The ruins are having a 'bad vibe day.' Visit at your own risk.",
    "ALERT: Suspicious butterfly activity near the marketplace. Remain vigilant.",
    "Breaking: Embertail's new hobby is 'aggressive wholesomeness.' Casualties: zero. Smiles: many.",
    // NEW MEMBER JOKES
    "BREAKING: Aria the Rosy Maple Moth spotted hovering suspiciously near all the lamps. Again.",
    "Alert: Aria insists the lamps are 'just friends.' Community remains skeptical.",
    "EXCLUSIVE: Blushimia the puppy's tail-wagging energy could power entire city. Scientists investigating.",
    "Public notice: Blushimia rated '12/10 good dog' by independent review board.",
    "Breaking: Cowbee produces both milk AND honey. Economists baffled by implications.",
    "SCANDAL: Cowbee's buzz-moo hybrid sound breaks international classification system.",
    "Market alert: Kelta the Pomeranian's floof levels exceed safety recommendations.",
    "URGENT: Kelta's cuteness has reached critical mass. Protective eyewear advised.",
    "Breaking: Jess the Parasaur claims dinosaurs 'never went extinct, just got cuter.'",
    "EXCLUSIVE: Jess spotted doing the stanky leg. Paleontologists refuse to comment.",
    "ALERT: Gnarly the Smilodon banned from arcade for 'dominating every high score.'",
    "Breaking: Gnarly's gaming skills described as 'prehistorically good.' Witnesses intimidated.",
    "Community update: Please stop asking Cowbee if they identify as 'bee-vegan.' It's complicated.",
    "Weather report: Aria's moth senses predict incoming lamp sales. Invest accordingly.",
    "SCANDAL: Kelta's pomeranian poof used as emergency cushion. No injuries reported.",
    "Public service: Jess confirms dinosaurs DID have feathers. Fashion historians vindicated.",
    "Breaking: Gnarly achieves perfect Pac-Man run. Arcade ghosts file complaint.",
    "Market update: Blushimia-brand enthusiasm stocks soaring. Buy while wagging is good."
  ],
  
  currentIndex: 0,
  rotationInterval: null,
  isScrolling: false,
  usedIndices: [],
  
  init: function() {
    this.shuffle();
    this.updateTicker();
    this.startScrollDetection();
  },
  
  shuffle: function() {
    // Fisher-Yates shuffle
    for (var i = this.messages.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = this.messages[i];
      this.messages[i] = this.messages[j];
      this.messages[j] = temp;
    }
    this.usedIndices = [];
  },
  
  getRandomUnusedIndex: function() {
    // If we've used all messages, reset
    if (this.usedIndices.length >= this.messages.length) {
      this.usedIndices = [];
      this.shuffle();
    }
    
    // Find unused index
    var availableIndices = [];
    for (var i = 0; i < this.messages.length; i++) {
      if (this.usedIndices.indexOf(i) === -1) {
        availableIndices.push(i);
      }
    }
    
    // Pick random from available
    var randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedIndices.push(randomIndex);
    return randomIndex;
  },
  
  startScrollDetection: function() {
    var tickerElement = document.querySelector('.news-ticker-inner');
    if (!tickerElement) return;
    
    // Check every 100ms if message has scrolled off-screen
    this.rotationInterval = setInterval(function() {
      if (newsTicker.isScrolling) return;
      
      var rect = tickerElement.getBoundingClientRect();
      var parent = tickerElement.parentElement.getBoundingClientRect();
      
      // If the right edge of the message is past the left edge of the container
      // (fully scrolled off screen to the left)
      if (rect.right < parent.left) {
        newsTicker.updateTicker();
      }
    }, 100);
  },
  
  updateTicker: function() {
    var tickerElement = document.querySelector('.news-ticker-inner');
    if (tickerElement) {
      this.isScrolling = true;
      
      // Get random unused message
      this.currentIndex = this.getRandomUnusedIndex();
      var message = this.messages[this.currentIndex];
      
      // Get event announcement if active
      var eventAnnouncement = getEventAnnouncement();
      
      // Build final message
      var finalMessage = '';
      if (eventAnnouncement) {
        finalMessage = '<span class="event-announcement">' + eventAnnouncement + '</span> | ';
      }
      finalMessage += '📰 ' + message + ' ✨';
      
      // Update message with HTML
      tickerElement.innerHTML = finalMessage;
      
      // Reset animation by removing and re-adding the element
      var parent = tickerElement.parentElement;
      var clone = tickerElement.cloneNode(true);
      parent.removeChild(tickerElement);
      parent.appendChild(clone);
      
      // Mark as not scrolling after animation restarts
      setTimeout(function() {
        newsTicker.isScrolling = false;
      }, 100);
    }
  },
  
  stop: function() {
    if (this.rotationInterval) {
      clearInterval(this.rotationInterval);
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2B: DAILY FORTUNE SYSTEM - One Fortune Per Day
   ═══════════════════════════════════════════════════════════════════════ */

var dailyFortune = {
  fortunes: {
    wholesome: [
      "Today is ideal for pet cuddles. Maximum coziness energy detected.",
      "A friendly encounter awaits you in the Deep Woods today.",
      "Your pets will be extra adorable today. Prepare your heart.",
      "Fortune favors the kind today. Share snacks, receive blessings.",
      "Today brings unexpected friendship. Keep your heart open.",
      "The stars align for peaceful adventures. Enjoy the calm.",
      "Your pets believe in you. You should too.",
      "Today is perfect for trying something new. The void approves.",
      "Kindness will be returned to you threefold today.",
      "A pleasant surprise awaits in the marketplace.",
      "Today your pets will teach you something important. Pay attention.",
      "The universe suggests: take it easy today. Rest is productive.",
      "Your collection grows stronger. Trust the journey.",
      "Today brings good news from an unexpected source.",
      "The Deep Woods whisper encouragement. You've got this."
    ],
    
    cursed: [
      "Beware emotionally unstable mushrooms today. They're having a day.",
      "The golden bunny is watching. Stay alert.",
      "Today the void feels... chatty. This is concerning.",
      "Strange energies in the ruins today. Maybe visit tomorrow instead.",
      "The mushrooms are plotting something. We don't know what.",
      "Mercury is in retrograde. Also there's no mercury. Still cursed though.",
      "Today's chaos levels: moderately concerning. Proceed with caution.",
      "The Deep Woods are feeling 'extra' today. Tread carefully.",
      "Warning: Today's aesthetic is 'mildly ominous.' Embrace it or hide.",
      "The spoons are restless today. Lock them up.",
      "A mysterious figure will judge your life choices today. It's you. You're the figure.",
      "Today the ruins are having 'bad vibes.' Recommend staying away.",
      "The butterflies know something you don't. This is fine. Probably.",
      "Beware of overconfidence today. The mushrooms are watching.",
      "Today's energy: 'what could possibly go wrong?' (Everything. Everything could.)"
    ],
    
    funny: [
      "A spoon shall guide your path today. Yes, really.",
      "Lucky numbers: 7, 13, and the number of snacks in your inventory.",
      "Today you will meet someone who REALLY likes mushrooms. Be polite.",
      "Your pet will do something incredibly stupid today. Love them anyway.",
      "Fortune says: 'lol good luck' - we don't know what this means either.",
      "Today's power move: aggressive napping. Channel your inner Pyxshuul.",
      "A wooden spoon brings unexpected fortune. We're as confused as you are.",
      "Today you will witness peak comedy. It will be your pet falling over.",
      "The prophecy states: 'snacks solve everything.' The prophecy is correct.",
      "Your destiny involves exactly three (3) silly shenanigans today.",
      "Today's quest: pet every single creature you meet. This is mandatory.",
      "The universe suggests: chaos, but make it cute.",
      "Fortune cookie says: 'pet the dog.' (There are no dogs here. Pet something else.)",
      "Today's mood: unhinged but supportive. Embrace it.",
      "A great adventure awaits! It's probably just finding your lost spoon."
    ],
    
    mysterious: [
      "The Deep Woods call to you today. Will you answer?",
      "Something ancient stirs in the ruins. Approach with respect.",
      "Today you will understand something you didn't yesterday.",
      "The boundary between worlds grows thin today. Stay curious.",
      "A secret will reveal itself when you least expect it.",
      "The void is watching respectfully. No need for concern.",
      "Today the forest remembers. Listen closely.",
      "An old friend returns. Or perhaps they never left.",
      "The stars align in ways we don't fully understand. Trust your instincts.",
      "Today you walk between destinies. Choose wisely.",
      "Something important is hidden in plain sight today.",
      "The mushrooms know more than they let on. As always.",
      "Today the world is softer than usual. Move gently through it.",
      "A choice you make today echoes further than you know.",
      "The ruins whisper secrets to those who listen."
    ],
    
    chaotic: [
      "Today's energy: GO ABSOLUTELY FERAL. (In a fun way.)",
      "The prophecy is unclear but VERY ENTHUSIASTIC.",
      "Today: maximum chaos, zero regrets. The void approves.",
      "Fortune says: 'yeet yourself into adventure.' We don't make the rules.",
      "Today you are unstoppable. Probably. We'll see.",
      "The stars spell out: 'DO IT.' We don't know what 'it' is. Neither do the stars.",
      "Today's vibe: unhinged but productive. Channel that energy.",
      "Chaos reigns today, but like, in a supportive way.",
      "The universe is in your corner today. Fight everything. (Or don't.)",
      "Today you have protagonist energy. Use it wisely. Or don't. Your call.",
      "Fortune favors the bold, the brave, and the slightly unhinged today.",
      "Today: be the chaos you wish to see in the world.",
      "The void says: 'send it.' This is either good advice or terrible advice.",
      "Today's forecast: 100% chance of shenanigans. Dress accordingly.",
      "The Deep Woods are EXTRA today. Match that energy."
    ]
  },
  
  init: function() {
    // Check if user should see fortune
    var lastFortune = localStorage.getItem('lastFortuneDate');
    var today = this.getTodayDate();
    
    if (lastFortune !== today) {
      // Show fortune popup after a brief delay
      setTimeout(function() {
        dailyFortune.showFortune();
      }, 2000);
    }
  },
  
  getTodayDate: function() {
    var date = new Date();
    return date.getFullYear() + '-' + 
           String(date.getMonth() + 1).padStart(2, '0') + '-' + 
           String(date.getDate()).padStart(2, '0');
  },
  
  getRandomFortune: function() {
    var categories = ['wholesome', 'cursed', 'funny', 'mysterious', 'chaotic'];
    var category = categories[Math.floor(Math.random() * categories.length)];
    var categoryFortunes = this.fortunes[category];
    var fortune = categoryFortunes[Math.floor(Math.random() * categoryFortunes.length)];
    
    return {
      text: fortune,
      category: category
    };
  },
  
  showFortune: function() {
    var fortune = this.getRandomFortune();
    
    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.className = 'fortune-overlay';
    overlay.innerHTML = `
      <div class="fortune-card">
        <div class="fortune-header">
          <h2>🔮 Daily Fortune 🔮</h2>
          <div class="fortune-category fortune-category-${fortune.category}">${fortune.category}</div>
        </div>
        <div class="fortune-content">
          <p class="fortune-text">"${fortune.text}"</p>
        </div>
        <button class="fortune-close-btn" onclick="dailyFortune.closeFortune()">Accept Destiny</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Save that we showed fortune today
    localStorage.setItem('lastFortuneDate', this.getTodayDate());
    
    // Add fade-in animation
    setTimeout(function() {
      overlay.classList.add('fortune-visible');
    }, 10);
  },
  
  closeFortune: function() {
    var overlay = document.querySelector('.fortune-overlay');
    if (overlay) {
      overlay.classList.remove('fortune-visible');
      setTimeout(function() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  },
  
  // Manual trigger for testing or UI button
  triggerFortune: function() {
    this.showFortune();
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2C: DAY/NIGHT CYCLE SYSTEM
   Auto-detects user's local time and applies appropriate theme
   ═══════════════════════════════════════════════════════════════════════ */

var dayNightCycle = {
  isNightMode: false,
  checkInterval: null,
  
  init: function() {
    this.checkTimeAndApplyTheme();
    
    // Check every 5 minutes if time period changed
    this.checkInterval = setInterval(function() {
      dayNightCycle.checkTimeAndApplyTheme();
    }, 300000); // 5 minutes
  },
  
  checkTimeAndApplyTheme: function() {
    var hour = new Date().getHours();
    var shouldBeNight = hour >= 18 || hour < 6; // 6 PM to 6 AM
    
    if (shouldBeNight && !this.isNightMode) {
      this.enableNightMode();
    } else if (!shouldBeNight && this.isNightMode) {
      this.enableDayMode();
    }
  },
  
  enableNightMode: function() {
    document.body.classList.add('night-mode');
    this.isNightMode = true;
    console.log('🌙 Night mode enabled');
  },
  
  enableDayMode: function() {
    document.body.classList.remove('night-mode');
    this.isNightMode = false;
    console.log('☀️ Day mode enabled');
  },
  
  // Manual toggle for testing
  toggle: function() {
    if (this.isNightMode) {
      this.enableDayMode();
    } else {
      this.enableNightMode();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   INITIALIZE ALL SYSTEMS ON PAGE LOAD
   ═══════════════════════════════════════════════════════════════════════ */

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    newsTicker.init();
    dayNightCycle.init();
    if (typeof weatherSystem !== 'undefined') weatherSystem.init();
    if (typeof worldEvents !== 'undefined') worldEvents.init();
  });
} else {
  newsTicker.init();
  dayNightCycle.init();
  if (typeof weatherSystem !== 'undefined') weatherSystem.init();
  if (typeof worldEvents !== 'undefined') worldEvents.init();
}

document.addEventListener('DOMContentLoaded', function() {
  var guestbookInput = document.getElementById('guestbook-message-input');
  var charCount = document.getElementById('guestbook-char-count');
  
  if (guestbookInput && charCount) {
    guestbookInput.addEventListener('input', function() {
      var length = this.value.length;
      charCount.textContent = length + ' / 500';
      
      if (length > 450) {
        charCount.style.color = 'var(--red)';
      } else if (length > 400) {
        charCount.style.color = 'var(--orange)';
      } else {
        charCount.style.color = 'var(--text-light)';
      }
    });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// MOBILE MENU FUNCTIONALITY
// ══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
  var hamburgerBtn = document.getElementById('hamburger-menu-btn');
  var mobileMenu = document.getElementById('mobile-nav-menu');
  var closeBtn = document.getElementById('mobile-menu-close');
  
  if (!hamburgerBtn || !mobileMenu || !closeBtn) return;
  
  // Create overlay
  var overlay = document.createElement('div');
  overlay.className = 'mobile-nav-overlay';
  document.body.appendChild(overlay);
  
  // Open menu
  hamburgerBtn.addEventListener('click', function() {
    mobileMenu.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  });
  
  // Close menu
  function closeMenu() {
    mobileMenu.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = ''; // Restore scroll
  }
  
  closeBtn.addEventListener('click', closeMenu);
  overlay.addEventListener('click', closeMenu);
  
  // Close menu when clicking any nav button
  var navButtons = mobileMenu.querySelectorAll('.sidebar-nav-btn');
  navButtons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      // Small delay so the tab change happens first
      setTimeout(closeMenu, 100);
    });
  });
  
  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      closeMenu();
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════
// COMPANION BUDDY SYSTEM - Pet in Corner
// PLACEHOLDER_COMPANION_MESSAGES - Customize these messages!
// ══════════════════════════════════════════════════════════════════════════

var CompanionBuddy = {
  currentCompanionId: null,
  messageInterval: null,
  bubbleTimeout: null,
  
  // PLACEHOLDER_COMPANION_MESSAGES - Message pools by context
  messages: {
    idle: [
      "You're doing great! 🐾",
      "I'm happy to be here! ✨",
      "Having fun today? 😊",
      "You're the best! 💖",
      "Let's go on an adventure! 🌟",
      "I love spending time with you! 🎉",
      "What should we do next? 🤔",
      "This is so cozy! 🛏️"
    ],
    shop: [
      "Ooh, that looks tasty! 🍕",
      "Can we get snacks? 🍪",
      "So many treats! 😋",
      "I want that one! ✨"
    ],
    minigames: [
      "You got this! 💪",
      "So close! 🎯",
      "Amazing! 🌟",
      "Let's try again! 🎮"
    ],
    battle: [
      "Be careful! ⚔️",
      "That was incredible! ✨",
      "You're so strong! 💪",
      "Watch out! 😮"
    ],
    adopt: [
      "A new friend?! 🎉",
      "They're so cute! 💖",
      "Can we keep them? 🥺",
      "Welcome to the family! 🐾"
    ],
    mypets: [
      "My friends! 💕",
      "Everyone looks happy! 😊",
      "We're all here! 🎉",
      "Let's play together! 🎾"
    ],
    home: [
      "Cozy day today! 🏠",
      "What should we do? 🤔",
      "Ready for anything! ⚡",
      "Home sweet home! 💖"
    ]
  },
  
  // PLACEHOLDER_PERSONALITY - Add personality-specific messages
  personalityMessages: {
    confident: ["I know we can do this!", "Piece of cake! 😎"],
    playful: ["Wheee! This is fun!", "Let's goooo! 🎉"],
    gentle: ["Take your time... 💕", "You're doing wonderfully..."],
    chaotic: ["CHAOS TIME! ✨", "Let's break something! 😈"]
  },
  
  init: function() {
    // Check if user has set a companion
    this.loadCompanion();
  },
  
  loadCompanion: async function() {
    if (!currentUser) return;
    
    // Get user's companion_pet_id from database
    var { data, error } = await supabaseClient
      .from('players')
      .select('companion_pet_id')
      .eq('id', currentUser.id)
      .single();
    
    if (error || !data || !data.companion_pet_id) {
      this.hide();
      return;
    }
    
    // Get companion pet details
    var { data: pet, error: petError } = await supabaseClient
      .from('user_pets')
      .select('*, pets(*)')
      .eq('id', data.companion_pet_id)
      .single();
    
    if (petError || !pet) {
      this.hide();
      return;
    }
    
    this.currentCompanionId = pet.id;
    this.show(pet);
    this.startMessageRotation();
  },
  
  show: function(pet) {
    var buddy = document.getElementById('companion-buddy');
    var sprite = document.getElementById('companion-sprite');
    
    if (!buddy || !sprite) return;
    
    // Set sprite image
    var petInfo = pet.pets || {};
    if (petInfo.image_file) {
      sprite.style.backgroundImage = 'url(images/' + petInfo.image_file + ')';
    } else {
      sprite.textContent = getPetEmoji(pet.pet_type) || '🐾';
      sprite.style.fontSize = '3rem';
      sprite.style.display = 'flex';
      sprite.style.alignItems = 'center';
      sprite.style.justifyContent = 'center';
    }
    
    buddy.style.display = 'block';
  },
  
  hide: function() {
    // CRITICAL: Clean up timers to prevent memory leaks
    this.stopMessageRotation();
    
    // Clear bubble timeout
    if (this.bubbleTimeout) {
      clearTimeout(this.bubbleTimeout);
      this.bubbleTimeout = null;
    }
    
    var buddy = document.getElementById('companion-buddy');
    if (buddy) buddy.style.display = 'none';
  },
  
  showMessage: function(message) {
    var bubble = document.getElementById('companion-bubble');
    var messageEl = document.getElementById('companion-message');
    
    if (!bubble || !messageEl) return;
    
    // Clear existing timeout
    if (this.bubbleTimeout) clearTimeout(this.bubbleTimeout);
    
    // Set message and show
    messageEl.textContent = message;
    bubble.classList.add('show');
    
    // Hide after 5 seconds
    this.bubbleTimeout = safeSetTimeout(function() {
      bubble.classList.remove('show');
    }, 5000);
  },
  
  getRandomMessage: function(context) {
    var pool = this.messages[context] || this.messages.idle;
    var randomMsg = pool[Math.floor(Math.random() * pool.length)];
    return randomMsg;
  },
  
  getCurrentContext: function() {
    // Detect which tab is active
    var activeSection = document.querySelector('.page-section:not([style*="display: none"])');
    if (!activeSection) return 'idle';
    
    var id = activeSection.id;
    if (id.includes('shop')) return 'shop';
    if (id.includes('minigame')) return 'minigames';
    if (id.includes('battle')) return 'battle';
    if (id.includes('adopt')) return 'adopt';
    if (id.includes('mypets')) return 'mypets';
    if (id.includes('home')) return 'home';
    
    return 'idle';
  },
  
  startMessageRotation: function() {
    var self = this;
    
    // Show first message after 3 seconds
    safeSetTimeout(function() {
      var context = self.getCurrentContext();
      var message = self.getRandomMessage(context);
      self.showMessage(message);
    }, 3000);
    
    // Then show messages every 60-90 seconds
    this.messageInterval = safeSetInterval(function() {
      var context = self.getCurrentContext();
      var message = self.getRandomMessage(context);
      self.showMessage(message);
    }, 75000); // 75 seconds average
  },
  
  stopMessageRotation: function() {
    if (this.messageInterval) {
      safeClearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  },
  
  setCompanion: async function(petId) {
    if (!currentUser) return;
    
    // Update database
    var { error } = await supabaseClient
      .from('players')
      .update({ companion_pet_id: petId })
      .eq('id', currentUser.id);
    
    if (error) {
      showToast('Failed to set companion');
      return;
    }
    
    showToast('Companion set! 🐾');
    
    // Reload companion
    await this.loadCompanion();
  }
};

// Initialize companion when page loads
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (currentUser) {
      CompanionBuddy.init();
    }
  }, 2000); // Wait 2 seconds after page load
});

// ══════════════════════════════════════════════════════════════════════════
// PET JOURNAL SYSTEM - Discovery tracking for food preferences
// ══════════════════════════════════════════════════════════════════════════

var currentJournalPage = 0;
var journalPetTypes = ['Ember', 'Pyxie', 'Cowbee', 'Kelta', 'Blushimia', 'Aria', 'Gnarly', 'Jess'];
var journalDiscoveries = {}; // { petType: { loved: true, liked: false, ... } }

async function loadJournalDiscoveries() {
  if (!currentUser) return;
  
  // Load from pet_journal table
  var { data, error } = await supabaseClient
    .from('pet_journal')
    .select('*')
    .eq('user_id', currentUser.id);
  
  if (error) {
    console.error('[Journal] Error loading:', error);
    return;
  }
  
  // Parse discoveries
  journalDiscoveries = {};
  if (data) {
    data.forEach(function(entry) {
      var petType = entry.entry_data && entry.entry_data.pet_type;
      if (!petType) return;
      
      if (!journalDiscoveries[petType]) {
        journalDiscoveries[petType] = {};
      }
      
      journalDiscoveries[petType][entry.entry_type] = true;
    });
  }
}

async function logJournalDiscovery(petType, discoveryType, itemName) {
  if (!currentUser || !petType) return;
  
  // Check if already discovered
  if (journalDiscoveries[petType] && journalDiscoveries[petType][discoveryType]) {
    return; // Already logged
  }
  
  try {
    await supabaseClient.from('pet_journal').insert({
      user_id: currentUser.id,
      entry_type: discoveryType,
      entry_data: {
        pet_type: petType,
        item_name: itemName,
        discovered_at: new Date().toISOString()
      }
    });
    
    // Update local cache
    if (!journalDiscoveries[petType]) journalDiscoveries[petType] = {};
    journalDiscoveries[petType][discoveryType] = true;
    
    showToast('📓 New journal entry! Check the Pet Journal!', 4000);
    
  } catch (err) {
    console.error('[Journal] Error logging:', err);
  }
}

function initJournalTab() {
  currentJournalPage = 0;
  loadJournalDiscoveries().then(function() {
    renderJournalPage();
  });
}

function renderJournalPage() {
  var petType = journalPetTypes[currentJournalPage];
  var prefs = getPetPreferences(petType);
  var discoveries = journalDiscoveries[petType] || {};
  
  var content = el('journal-page-content');
  if (!content) return;
  
  // Map pet types to their PNG filenames
  var petImageMap = {
    'Ember': 'ember.png',
    'Pyxie': 'pyxie.png',
    'Cowbee': 'cowbee.png',
    'Bunny': 'bunny.png',
    'Fox': 'fox.png',
    'Wolf': 'wolf.png',
    'Deer': 'deer.png',
    'Bird': 'bird.png'
  };
  
  var imageSrc = 'images/pets/' + (petImageMap[petType] || petType.toLowerCase() + '.png');
  
  var html = '';
  html += '<div class="journal-pet-header">';
  html += '  <div class="journal-pet-image" style="background-image:url(' + imageSrc + ');background-size:contain;background-repeat:no-repeat;background-position:center;"></div>';
  html += '  <div class="journal-pet-name">' + petType + '</div>';
  html += '</div>';
  
  if (!prefs) {
    html += '<div style="text-align:center;padding:40px;color:var(--text-light);">No data available for this pet.</div>';
  } else {
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">💖 LOVED Food:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.loved ? prefs.loved_item : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">😊 LIKED Food:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.liked ? prefs.liked_item : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">😐 DISLIKED Food:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.disliked ? prefs.disliked_item : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">😠 HATED Food:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.hated ? prefs.hated_item : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">🎨 Hobby:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.hobby ? prefs.hobby : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    html += '<div class="journal-entry">';
    html += '  <div class="journal-entry-label">✨ Fun Fact:</div>';
    html += '  <div class="journal-entry-value">' + (discoveries.fun_fact ? prefs.fun_fact : '<span class="journal-entry-unknown">???</span>') + '</div>';
    html += '</div>';
    
    var total = 6;
    var discovered = Object.keys(discoveries).length;
    html += '<div style="text-align:center;margin-top:30px;padding:15px;background:rgba(153,102,255,0.2);border-radius:12px;">';
    html += '  <strong>Discovery Progress:</strong> ' + discovered + ' / ' + total;
    html += '</div>';
  }
  
  content.innerHTML = html;
  
  // Update controls
  el('journal-page-indicator').textContent = 'Page ' + (currentJournalPage + 1) + ' of ' + journalPetTypes.length;
  el('journal-prev-btn').disabled = currentJournalPage === 0;
  el('journal-next-btn').disabled = currentJournalPage === journalPetTypes.length - 1;
}

function changeJournalPage(delta) {
  currentJournalPage += delta;
  if (currentJournalPage < 0) currentJournalPage = 0;
  if (currentJournalPage >= journalPetTypes.length) currentJournalPage = journalPetTypes.length - 1;
  renderJournalPage();
}

// Post guestbook message
async function postGuestbookMessage() {
  if (!currentUser || !currentProfileUserId) return;
  
  // Rate limiting
  if (!canPerformAction('guestbook_post', 2000)) {
    showToast('Please wait before posting again!');
    return;
  }
  
  var messageInput = document.getElementById('guestbook-message-input');
  var message = messageInput.value.trim();
  
  if (!message) {
    showToast('Please enter a message');
    return;
  }
  
  if (message.length > 500) {
    showToast('Message is too long (max 500 characters)');
    return;
  }
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .insert([{
        profile_user_id: currentProfileUserId,
        author_id: currentUser.id,
        message: message
      }]);
    
    if (error) throw error;
    
    showToast('Message posted! 💖');
    messageInput.value = '';
    document.getElementById('guestbook-char-count').textContent = '0 / 500';
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error posting message: ' + err.message);
    console.error('Error posting guestbook message:', err);
  }
}

// Load guestbook entries
async function loadGuestbookEntries(profileUserId) {
  var container = document.getElementById('guestbook-entries');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    // Get guestbook entries with author info
    var { data: entries, error } = await supabaseClient
      .from('guestbook_entries')
      .select('id, author_id, message, created_at, players!guestbook_entries_author_id_fkey(username)')
      .eq('profile_user_id', profileUserId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    if (!entries || entries.length === 0) {
      container.innerHTML = '<div class="guestbook-empty"><div class="guestbook-empty-icon">📖</div><p>No messages yet!</p><p style="font-size:0.9rem;color:var(--text-light);margin-top:8px;">Be the first to leave a message!</p></div>';
      return;
    }
    
    // Render entries
    var html = '';
    entries.forEach(function(entry) {
      var author = entry.players;
      var authorName = author ? author.username : 'Unknown User';
      var canDelete = currentUser && (entry.author_id === currentUser.id || profileUserId === currentUser.id);
      
      var timestamp = new Date(entry.created_at);
      var timeAgo = getTimeAgo(timestamp);
      
      html += '<div class="guestbook-entry">';
      html += '  <div class="guestbook-header">';
      html += '    <div class="guestbook-author">';
      html += '      <div class="guestbook-author-avatar">' + authorName.charAt(0).toUpperCase() + '</div>';
      html += '      <div class="guestbook-author-info">';
      html += '        <div class="guestbook-author-name" onclick="viewProfile(\'' + escapeHtml(authorName) + '\')">' + escapeHtml(authorName) + '</div>';
      html += '        <div class="guestbook-timestamp">' + timeAgo + '</div>';
      html += '      </div>';
      html += '    </div>';
      
      if (canDelete) {
        html += '    <div class="guestbook-actions">';
        html += '      <button class="btn btn-outline btn-sm btn-danger" onclick="deleteGuestbookEntry(\'' + entry.id + '\')">Delete</button>';
        html += '    </div>';
      }
      
      html += '  </div>';
      html += '  <div class="guestbook-message">' + escapeHtml(entry.message) + '</div>';
      html += '</div>';
    });
    
    container.innerHTML = html;
    
  } catch (err) {
    container.innerHTML = '<div class="guestbook-empty"><p>Error loading messages: ' + err.message + '</p></div>';
    console.error('Error loading guestbook entries:', err);
  }
}

// Delete guestbook entry
async function deleteGuestbookEntry(entryId) {
  if (!confirm('Delete this message?')) return;
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .delete()
      .eq('id', entryId);
    
    if (error) throw error;
    
    showToast('Message deleted');
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error deleting guestbook entry:', err);
  }
}

// Helper function to get "time ago" string
function getTimeAgo(date) {
  var now = new Date();
  var seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  
  var minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes + ' minute' + (minutes === 1 ? '' : 's') + ' ago';
  
  var hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
  
  var days = Math.floor(hours / 24);
  if (days < 30) return days + ' day' + (days === 1 ? '' : 's') + ' ago';
  
  var months = Math.floor(days / 30);
  if (months < 12) return months + ' month' + (months === 1 ? '' : 's') + ' ago';
  
  var years = Math.floor(months / 12);
  return years + ' year' + (years === 1 ? '' : 's') + ' ago';
}

// ═══════════════════════════════════════════════════════════════════════════
// UPDATE EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Modify the existing loadProfile function to integrate new features
var originalLoadProfile = loadProfile;
loadProfile = async function(username) {
  await originalLoadProfile(username);
  
  // Get the profile user ID
  var profileRes = await supabaseClient
    .from('players')
    .select('id')
    .ilike('username', username)
    .single();
  
  if (profileRes.data) {
    currentProfileUserId = profileRes.data.id;
    
    // Update action buttons
    await updateProfileButtons();
    
    // Load guestbook
    await loadGuestbookEntries(currentProfileUserId);
  }
};

// Add friends tab to tabsLoaded
tabsLoaded.friends = function() {
  updateFriendRequestBadge();
  switchFriendsTab('list');
};

// Poll for friend requests every 30 seconds
setInterval(updateFriendRequestBadge, 30000);


// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY FEED BOX (Sidebar)
// ═══════════════════════════════════════════════════════════════════════════

var activityFeedInterval = null;
var currentActivities = [];
var currentActivityIndex = 0;

// Start the activity feed rotation
async function startActivityFeed() {
  if (!currentUser) return;
  
  // Load activities initially
  await loadFriendActivities();
  
  // Rotate through activities every 5 seconds
  activityFeedInterval = setInterval(rotateActivity, 5000);
}

// Stop the activity feed rotation
function stopActivityFeed() {
  if (activityFeedInterval) {
    clearInterval(activityFeedInterval);
    activityFeedInterval = null;
  }
}

// Load friend activities from database
async function loadFriendActivities() {
  if (!currentUser) return;
  
  try {
    // Get friend IDs
    var { data: friendships, error: friendError } = await supabaseClient
      .from('friendships')
      .select('requester_id, addressee_id')
      .eq('status', 'accepted')
      .or('requester_id.eq.' + currentUser.id + ',addressee_id.eq.' + currentUser.id);
    
    if (friendError) throw friendError;
    
    if (!friendships || friendships.length === 0) {
      // No friends - show default message
      currentActivities = [];
      updateActivityFeedDisplay();
      return;
    }
    
    // Get friend user IDs
    var friendIds = friendships.map(function(f) {
      return f.requester_id === currentUser.id ? f.addressee_id : f.requester_id;
    });
    
    // Get recent activities from friends (last 50)
    var { data: activities, error: actError } = await supabaseClient
      .from('activity_feed')
      .select('*, players(username)')
      .in('user_id', friendIds)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (actError) throw actError;
    
    currentActivities = activities || [];
    currentActivityIndex = 0;
    updateActivityFeedDisplay();
    
  } catch (err) {
    console.error('Error loading friend activities:', err);
  }
}

// Rotate to next activity
function rotateActivity() {
  if (currentActivities.length === 0) return;
  
  currentActivityIndex = (currentActivityIndex + 1) % currentActivities.length;
  updateActivityFeedDisplay();
}

// Update the activity feed display
function updateActivityFeedDisplay() {
  var messageEl = document.getElementById('activity-feed-message');
  if (!messageEl) return;
  
  if (currentActivities.length === 0) {
    messageEl.textContent = 'Add friends to see their activity!';
    messageEl.style.color = 'var(--text-light)';
    return;
  }
  
  var activity = currentActivities[currentActivityIndex];
  var username = activity.players ? activity.players.username : 'Someone';
  var message = formatActivityMessage(activity, username);
  
  // Fade out, change text, fade in
  messageEl.style.animation = 'none';
  setTimeout(function() {
    messageEl.textContent = message;
    messageEl.style.color = 'var(--text)';
    messageEl.style.animation = 'activity-fade-in 0.5s ease-in-out';
  }, 50);
}

// Log an activity to the activity_feed table
async function logActivity(activityType, activityData) {
  if (!currentUser) return;
  
  try {
    await supabaseClient
      .from('activity_feed')
      .insert([{
        user_id: currentUser.id,
        activity_type: activityType,
        activity_data: activityData,
        is_public: true
      }]);
    
    console.log('📢 Activity logged:', activityType, activityData);
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

// Format activity message based on type
function formatActivityMessage(activity, username) {
  var type = activity.activity_type;
  var data = activity.activity_data || {};
  
  switch(type) {
    case 'badge_earned':
      return username + ' just earned the ' + (data.badge_name || 'Badge') + '! ' + (data.badge_icon || '🎖️');
    
    case 'level_up':
      var petName = data.pet_name || 'their pet';
      var level = data.level || '?';
      return username + "'s " + petName + ' just hit level ' + level + '! 🎉';
    
    case 'pet_adopted':
      var petName = data.pet_name || 'a new pet';
      return username + ' just adopted ' + petName + '! 🐾';
    
    case 'achievement_unlocked':
      return username + ' unlocked: ' + (data.achievement_name || 'Achievement') + '! ⭐';
    
    case 'battle_victory':
      var enemy = data.enemy_name || 'an enemy';
      return username + ' defeated ' + enemy + '! ⚔️';
    
    case 'boss_defeated':
      var boss = data.boss_name || 'a boss';
      return username + ' defeated ' + boss + '! 💀🎉';
    
    default:
      return username + ' did something cool! ✨';
  }
}

// Refresh activity feed (call this periodically)
async function refreshActivityFeed() {
  await loadFriendActivities();
}

// Start activity feed polling
setTimeout(function() {
  startActivityFeed();
  // Refresh activity feed every 2 minutes
  setInterval(refreshActivityFeed, 120000);
}, 2000);


// ═══════════════════════════════════════════════════════════════════════════
// NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var notificationDropdownOpen = false;
var currentNotifications = [];

// Toggle notification dropdown
function toggleNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  
  if (notificationDropdownOpen) {
    closeNotificationDropdown();
  } else {
    openNotificationDropdown();
  }
}

// Open notification dropdown
async function openNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  dropdown.style.display = 'block';
  notificationDropdownOpen = true;
  
  // Add overlay to close when clicking outside
  var overlay = document.createElement('div');
  overlay.className = 'notification-overlay';
  overlay.id = 'notification-overlay';
  overlay.onclick = closeNotificationDropdown;
  document.body.appendChild(overlay);
  
  // Load notifications
  await loadNotifications();
}

// Close notification dropdown
function closeNotificationDropdown() {
  var dropdown = document.getElementById('notification-dropdown');
  dropdown.style.display = 'none';
  notificationDropdownOpen = false;
  
  var overlay = document.getElementById('notification-overlay');
  if (overlay) overlay.remove();
}

// Load notifications
async function loadNotifications() {
  if (!currentUser) return;
  
  var listEl = document.getElementById('notification-list');
  listEl.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: notifications, error } = await supabaseClient
      .from('notifications')
      .select('*, players!notifications_from_user_id_fkey(username)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    currentNotifications = notifications || [];
    
    if (currentNotifications.length === 0) {
      listEl.innerHTML = '<div class="notification-empty">No notifications</div>';
      return;
    }
    
    // Render notifications
    var html = '';
    currentNotifications.forEach(function(notif) {
      html += renderNotification(notif);
    });
    
    listEl.innerHTML = html;
    
  } catch (err) {
    console.error('Error loading notifications:', err);
    listEl.innerHTML = '<div class="notification-empty">Error loading notifications</div>';
  }
}

// Render a single notification
function renderNotification(notif) {
  var icon = getNotificationIcon(notif.type);
  var timeAgo = getTimeAgo(new Date(notif.created_at));
  var unreadClass = notif.is_read ? '' : 'unread';
  var fromUsername = notif.players ? notif.players.username : 'Someone';
  
  var html = '<div class="notification-item ' + unreadClass + '" onclick="handleNotificationClick(\'' + notif.id + '\', \'' + (notif.link || '') + '\')">';
  html += '  <span class="notification-icon">' + icon + '</span>';
  html += '  <div class="notification-content">';
  html += '    <div class="notification-title">' + escapeHtml(notif.title) + '</div>';
  html += '    <div class="notification-message">' + escapeHtml(notif.message) + '</div>';
  html += '    <div class="notification-time">' + timeAgo + '</div>';
  html += '  </div>';
  html += '</div>';
  
  return html;
}

// Get icon for notification type
function getNotificationIcon(type) {
  switch(type) {
    case 'friend_request': return '👥';
    case 'friend_accepted': return '✅';
    case 'guestbook_message': return '📝';
    case 'badge_earned': return '🎖️';
    case 'level_up': return '⭐';
    // PHASE 8 - Pet milestone notifications
    case 'pet_hungry': return '🍽️';
    case 'pet_needs_attention': return '💔';
    case 'pet_evolved': return '✨';
    case 'pet_birthday': return '🎂';
    case 'variant_unlocked': return '🌈';
    case 'battle_victory': return '⚔️';
    case 'daily_reward': return '🎁';
    case 'event_started': return '🎉';
    case 'referral_reward': return '💰';
    default: return '🔔';
  }
}

// Handle notification click
async function handleNotificationClick(notificationId, link) {
  // Mark as read
  await markNotificationRead(notificationId);
  
  // Close dropdown
  closeNotificationDropdown();
  
  // Navigate to link
  if (link) {
    if (link.startsWith('tab:')) {
      var tab = link.replace('tab:', '');
      showTab(tab);
    } else if (link.startsWith('profile:')) {
      var username = link.replace('profile:', '');
      viewProfile(username);
    }
  }
  
  // Refresh notification badge
  await updateNotificationBadge();
}

// Mark notification as read
async function markNotificationRead(notificationId) {
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}

// Mark all notifications as read
async function markAllNotificationsRead() {
  if (!currentUser) return;
  
  try {
    await supabaseClient
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    await loadNotifications();
    await updateNotificationBadge();
    
  } catch (err) {
    console.error('Error marking all as read:', err);
  }
}

// Update notification badge count
async function updateNotificationBadge() {
  if (!currentUser) return;
  
  try {
    var { data, error } = await supabaseClient
      .from('notifications')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('is_read', false);
    
    if (error) throw error;
    
    var count = data ? data.length : 0;
    var badge = document.getElementById('notification-badge');
    var bell = document.getElementById('notification-bell');
    
    if (count > 0) {
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
      }
      if (bell) bell.style.display = 'inline-flex';
    } else {
      if (badge) badge.style.display = 'none';
      if (bell) bell.style.display = 'inline-flex'; // Still show bell, just no badge
    }
    
  } catch (err) {
    console.error('Error updating notification badge:', err);
  }
}

// Create a notification (helper function)
async function createNotification(userId, type, title, message, link, fromUserId) {
  try {
    await supabaseClient
      .from('notifications')
      .insert([{
        user_id: userId,
        type: type,
        title: title,
        message: message,
        link: link || null,
        from_user_id: fromUserId || null
      }]);
  } catch (err) {
    console.error('Error creating notification:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TIME-BASED BUFFS & DAILY REWARDS (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

var dailyLoginStreak = 0;
var dailyBuffsActive = [];

// Check daily login and award rewards
async function checkDailyLogin() {
  if (!currentUser) return;
  
  var today = new Date().toISOString().split('T')[0];
  var lastLogin = localStorage.getItem('lastLoginDate_' + currentUser.id);
  
  if (lastLogin === today) {
    console.log('[DailyLogin] Already claimed today');
    return; // Already claimed today
  }
  
  try {
    // Get player data
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('last_login, login_streak, pawketpoints')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    var streak = player.login_streak || 0;
    var lastDate = player.last_login ? new Date(player.last_login).toISOString().split('T')[0] : null;
    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Calculate streak
    if (lastDate === yesterdayStr) {
      // Consecutive day
      streak++;
    } else if (lastDate !== today) {
      // Streak broken, reset to 1
      streak = 1;
    }
    
    // Cap streak at 30 days
    if (streak > 30) streak = 30;
    
    dailyLoginStreak = streak;
    
    // Calculate rewards
    var ppReward = 50 + (streak * 5); // 50 base + 5 per day
    if (streak >= 7) ppReward += 50; // Week bonus
    if (streak >= 14) ppReward += 100; // 2 week bonus
    if (streak >= 30) ppReward += 200; // Month bonus!
    
    // Update database
    await supabaseClient
      .from('players')
      .update({
        last_login: new Date().toISOString(),
        login_streak: streak,
        pawketpoints: (player.pawketpoints || 0) + ppReward
      })
      .eq('id', currentUser.id);
    
    // Update local storage
    localStorage.setItem('lastLoginDate_' + currentUser.id, today);
    
    // Award PP via RPC (for tracking)
    await supabaseClient.rpc('award_pp_secure', {
      p_user_id: currentUser.id,
      p_amount: ppReward,
      p_reason: 'Daily login day ' + streak
    });
    
    // Show reward notification
    showDailyLoginReward(streak, ppReward);
    
    // Create notification
    await createNotification(
      currentUser.id,
      'daily_reward',
      '🎁 Daily Login Reward!',
      'Day ' + streak + ' streak! Earned ' + ppReward + ' PP',
      'tab:home'
    );
    
    // Apply daily buffs
    applyDailyBuffs(streak);
    
    // PAWKETPASS: Update bingo and Pass XP for daily login
    updateBingoProgress('login', 1);
    await addPassXP(10, 'login');
    
    // SCRAPBOOK: Add random flavor memory to a random pet
    var allPetIds = Object.keys(petState || {});
    if (allPetIds.length > 0) {
      var randomPetId = allPetIds[Math.floor(Math.random() * allPetIds.length)];
      scrapbook_addRandomMemory(randomPetId);
    }
    
    console.log('✅ Daily login checked - Streak:', streak, 'Reward:', ppReward);
    
  } catch (err) {
    console.error('[DailyLogin] Error:', err);
  }
}

// Show daily login reward modal
function showDailyLoginReward(streak, ppReward) {
  var modal = makeModal();
  var content = makeEl('div');
  content.style.cssText = 'text-align:center;padding:20px;';
  
  var icon = makeEl('div');
  icon.textContent = '🎁';
  icon.style.cssText = 'font-size:4rem;margin-bottom:15px;';
  content.appendChild(icon);
  
  var title = makeEl('h2');
  title.textContent = 'Daily Login Reward!';
  title.style.cssText = 'color:var(--purple);margin-bottom:10px;';
  content.appendChild(title);
  
  var streakText = makeEl('p');
  streakText.innerHTML = '🔥 <strong>' + streak + ' Day Streak!</strong>';
  streakText.style.cssText = 'font-size:1.3rem;margin-bottom:15px;color:var(--orange);';
  content.appendChild(streakText);
  
  var reward = makeEl('p');
  reward.innerHTML = '🪙 <strong>+' + ppReward + ' PawketPoints</strong>';
  reward.style.cssText = 'font-size:1.2rem;margin-bottom:15px;color:var(--purple);';
  content.appendChild(reward);
  
  // Milestone bonuses
  if (streak === 7) {
    var bonus = makeEl('p');
    bonus.innerHTML = '⭐ <strong>Week Milestone Bonus!</strong>';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 14) {
    var bonus = makeEl('p');
    bonus.innerHTML = '🌟 <strong>2 Week Milestone Bonus!</strong>';
    bonus.style.cssText = 'color:var(--gold);font-size:1.1rem;';
    content.appendChild(bonus);
  } else if (streak === 30) {
    var bonus = makeEl('p');
    bonus.innerHTML = '💫 <strong>MONTH MILESTONE BONUS!</strong>';
    bonus.style.cssText = 'color:var(--gold);font-size:1.3rem;font-weight:bold;';
    content.appendChild(bonus);
  }
  
  var tip = makeEl('p');
  tip.textContent = 'Come back tomorrow to keep your streak!';
  tip.style.cssText = 'font-size:0.9rem;color:var(--text-light);margin-top:15px;';
  content.appendChild(tip);
  
  var closeBtn = makeEl('button', {class: 'btn btn-primary'});
  closeBtn.textContent = 'Awesome!';
  closeBtn.style.cssText = 'margin-top:20px;';
  closeBtn.onclick = function() { closeModal(); };
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// Apply daily buffs based on streak
function applyDailyBuffs(streak) {
  dailyBuffsActive = [];
  
  // Streak buffs
  if (streak >= 3) {
    dailyBuffsActive.push({
      name: 'XP Boost',
      icon: '⭐',
      effect: 'xp_boost',
      multiplier: 1.1,
      description: '+10% XP from all activities'
    });
  }
  
  if (streak >= 7) {
    dailyBuffsActive.push({
      name: 'Lucky Day',
      icon: '🍀',
      effect: 'item_drop_boost',
      multiplier: 1.2,
      description: '+20% better item drops'
    });
  }
  
  if (streak >= 14) {
    dailyBuffsActive.push({
      name: 'Happiness Boost',
      icon: '💖',
      effect: 'happiness_boost',
      multiplier: 1.5,
      description: '+50% happiness from interactions'
    });
  }
  
  if (streak >= 30) {
    dailyBuffsActive.push({
      name: 'Super Streak!',
      icon: '🔥',
      effect: 'all_boost',
      multiplier: 1.25,
      description: '+25% to all pet activities!'
    });
  }
  
  console.log('[Buffs] Active buffs:', dailyBuffsActive);
}

// Get active buff multiplier for effect type
function getBuffMultiplier(effectType) {
  var multiplier = 1.0;
  
  dailyBuffsActive.forEach(function(buff) {
    if (buff.effect === effectType || buff.effect === 'all_boost') {
      multiplier *= buff.multiplier;
    }
  });
  
  return multiplier;
}

// ══════════════════════════════════════════════════════════════════════════
// SHARING SYSTEM (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

// Share progress to social media
async function shareProgress() {
  if (!currentUser) {
    showToast('Please log in to share!');
    return;
  }
  
  try {
    // Get user stats
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('username, pawketpoints')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    // Get pet count
    var { data: pets, error: petError } = await supabaseClient
      .from('user_pets')
      .select('id')
      .eq('user_id', currentUser.id);
    
    if (petError) throw petError;
    
    var petCount = pets ? pets.length : 0;
    
    // Generate share text
    var shareText = 'I have ' + petCount + ' pets and ' + player.pawketpoints + ' PawketPoints on PawketPetsVT! 🐾✨\n\nAdopt your favorite VTuber\'s pet: https://pawketpets.vt';
    
    // Try native share API (mobile)
    if (navigator.share) {
      await navigator.share({
        title: 'My PawketPetsVT Progress',
        text: shareText,
        url: 'https://pawketpets.vt'
      });
      
      // Award bonus for sharing
      await awardShareBonus();
      
    } else {
      // Desktop - show share modal
      showShareModal(shareText);
    }
    
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.error('[Share] Error:', err);
      showToast('Failed to share. Please try again!');
    }
  }
}

// Show share modal with options
function showShareModal(shareText) {
  var modal = makeModal();
  var content = makeEl('div');
  content.style.cssText = 'padding:20px;';
  
  var title = makeEl('h2');
  title.textContent = '📤 Share Your Progress';
  title.style.cssText = 'text-align:center;color:var(--purple);margin-bottom:20px;';
  content.appendChild(title);
  
  // Share text box
  var textBox = makeEl('textarea');
  textBox.value = shareText;
  textBox.readOnly = true;
  textBox.style.cssText = 'width:100%;height:100px;padding:10px;border:2px solid var(--border);border-radius:8px;font-family:inherit;margin-bottom:15px;resize:none;';
  content.appendChild(textBox);
  
  // Share buttons
  var buttons = makeEl('div');
  buttons.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;';
  
  var twitterBtn = makeEl('button', {class: 'btn btn-primary'});
  twitterBtn.innerHTML = '🐦 Twitter';
  twitterBtn.onclick = function() {
    window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(shareText), '_blank');
    awardShareBonus();
    closeModal();
  };
  buttons.appendChild(twitterBtn);
  
  var copyBtn = makeEl('button', {class: 'btn btn-outline'});
  copyBtn.textContent = '📋 Copy Text';
  copyBtn.onclick = function() {
    textBox.select();
    document.execCommand('copy');
    showToast('Copied to clipboard!');
    awardShareBonus();
  };
  buttons.appendChild(copyBtn);
  
  content.appendChild(buttons);
  
  var closeBtn = makeEl('button', {class: 'btn btn-secondary'});
  closeBtn.textContent = 'Close';
  closeBtn.onclick = function() { closeModal(); };
  closeBtn.style.cssText = 'display:block;margin:0 auto;';
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// Award bonus for sharing
async function awardShareBonus() {
  if (!currentUser) return;
  
  // Check if already claimed today
  var today = new Date().toISOString().split('T')[0];
  var lastShare = localStorage.getItem('lastShareBonus_' + currentUser.id);
  
  if (lastShare === today) {
    console.log('[Share] Bonus already claimed today');
    return;
  }
  
  try {
    // Award 100 PP for sharing
    await supabaseClient.rpc('award_pp_secure', {
      p_user_id: currentUser.id,
      p_amount: 100,
      p_reason: 'Shared progress on social media'
    });
    
    localStorage.setItem('lastShareBonus_' + currentUser.id, today);
    showToast('🎉 +100 PP for sharing! Thanks for spreading the word!', 4000);
    
    // Update points display
    await loadPlayerPoints();
    
  } catch (err) {
    console.error('[Share] Error awarding bonus:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// REFERRAL SYSTEM (Phase 8)
// ══════════════════════════════════════════════════════════════════════════

// Generate referral code for user
function generateReferralCode(username) {
  // Simple base64 encode of username with timestamp
  var code = btoa(username + ':' + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
  return code;
}

// Show referral modal
async function showReferralModal() {
  if (!currentUser) {
    showToast('Please log in to access referrals!');
    return;
  }
  
  try {
    // Get or create referral code
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('username, referral_code, referral_count')
      .eq('id', currentUser.id)
      .single();
    
    if (error) throw error;
    
    var referralCode = player.referral_code;
    
    // Create code if doesn't exist
    if (!referralCode) {
      referralCode = generateReferralCode(player.username);
      
      await supabaseClient
        .from('players')
        .update({ referral_code: referralCode })
        .eq('id', currentUser.id);
    }
    
    var referralLink = 'https://pawketpets.vt?ref=' + referralCode;
    var referralCount = player.referral_count || 0;
    
    // Show modal
    var modal = makeModal();
    var content = makeEl('div');
    content.style.cssText = 'padding:20px;max-width:500px;';
    
    var title = makeEl('h2');
    title.textContent = '💰 Refer Friends!';
    title.style.cssText = 'text-align:center;color:var(--purple);margin-bottom:15px;';
    content.appendChild(title);
    
    var desc = makeEl('p');
    desc.innerHTML = 'Invite friends and earn <strong>250 PP</strong> for each friend who adopts their first pet!';
    desc.style.cssText = 'text-align:center;margin-bottom:20px;color:var(--text-light);';
    content.appendChild(desc);
    
    var stats = makeEl('div');
    stats.innerHTML = '<div style="text-align:center;background:rgba(153,102,255,0.1);padding:15px;border-radius:12px;margin-bottom:20px;">' +
      '<div style="font-size:2rem;color:var(--purple);font-weight:bold;">' + referralCount + '</div>' +
      '<div style="color:var(--text-light);">Friends Referred</div>' +
      '<div style="color:var(--purple);margin-top:5px;">🪙 ' + (referralCount * 250) + ' PP Earned</div>' +
      '</div>';
    content.appendChild(stats);
    
    var label = makeEl('div');
    label.textContent = 'Your Referral Link:';
    label.style.cssText = 'font-weight:bold;margin-bottom:8px;';
    content.appendChild(label);
    
    var linkBox = makeEl('input');
    linkBox.value = referralLink;
    linkBox.readOnly = true;
    linkBox.style.cssText = 'width:100%;padding:10px;border:2px solid var(--purple);border-radius:8px;font-family:monospace;margin-bottom:15px;';
    linkBox.onclick = function() { this.select(); };
    content.appendChild(linkBox);
    
    var copyBtn = makeEl('button', {class: 'btn btn-primary'});
    copyBtn.innerHTML = '📋 Copy Link';
    copyBtn.style.cssText = 'width:100%;margin-bottom:10px;';
    copyBtn.onclick = function() {
      linkBox.select();
      document.execCommand('copy');
      showToast('Referral link copied!');
    };
    content.appendChild(copyBtn);
    
    var closeBtn = makeEl('button', {class: 'btn btn-secondary'});
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = 'width:100%;';
    closeBtn.onclick = function() { closeModal(); };
    content.appendChild(closeBtn);
    
    modal.appendChild(content);
    openModal(modal);
    
  } catch (err) {
    console.error('[Referral] Error:', err);
    showToast('Failed to load referral info!');
  }
}

// Check for referral code on signup
async function checkReferralCode() {
  var urlParams = new URLSearchParams(window.location.search);
  var refCode = urlParams.get('ref');
  
  if (!refCode) return;
  
  // Store referral code for signup
  localStorage.setItem('pendingReferralCode', refCode);
  console.log('[Referral] Referral code detected:', refCode);
}

// Process referral after first pet adoption
async function processReferral() {
  var refCode = localStorage.getItem('pendingReferralCode');
  
  if (!refCode || !currentUser) return;
  
  try {
    // Find referrer
    var { data: referrer, error } = await supabaseClient
      .from('players')
      .select('id, username, referral_count')
      .eq('referral_code', refCode)
      .single();
    
    if (error || !referrer) {
      console.log('[Referral] Referrer not found');
      localStorage.removeItem('pendingReferralCode');
      return;
    }
    
    // Don't allow self-referral
    if (referrer.id === currentUser.id) {
      console.log('[Referral] Cannot refer yourself');
      localStorage.removeItem('pendingReferralCode');
      return;
    }
    
    // Award referrer
    await supabaseClient.rpc('award_pp_secure', {
      p_user_id: referrer.id,
      p_amount: 250,
      p_reason: 'Referral: ' + currentUser.email
    });
    
    // Increment referral count
    await supabaseClient
      .from('players')
      .update({ referral_count: (referrer.referral_count || 0) + 1 })
      .eq('id', referrer.id);
    
    // Notify referrer
    await createNotification(
      referrer.id,
      'referral_reward',
      '💰 Referral Bonus!',
      'Your friend joined PawketPetsVT! +250 PP',
      'tab:stats'
    );
    
    // Clear pending referral
    localStorage.removeItem('pendingReferralCode');
    
    console.log('✅ Referral processed for:', referrer.username);
    showToast('Welcome! Your friend has been credited with a referral bonus! 🎉');
    
  } catch (err) {
    console.error('[Referral] Error processing:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATE NOTIFICATIONS INTO EXISTING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// Modified sendFriendRequest to create notification
var originalSendFriendRequest = sendFriendRequest;
sendFriendRequest = async function() {
  if (!currentUser || !currentProfileUserId) return;
  
  try {
    var { error } = await supabaseClient
      .from('friendships')
      .insert([{
        requester_id: currentUser.id,
        addressee_id: currentProfileUserId,
        status: 'pending'
      }]);
    
    if (error) throw error;
    
    // Create notification for the other user
    var username = document.getElementById('profile-username').textContent;
    await createNotification(
      currentProfileUserId,
      'friend_request',
      'New Friend Request',
      currentUser.email.split('@')[0] + ' sent you a friend request!',
      'tab:friends',
      currentUser.id
    );
    
    showToast('Friend request sent! 🎉');
    updateProfileButtons();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error sending friend request:', err);
  }
};

// Modified acceptFriendRequest to create notification
var originalAcceptFriendRequest = acceptFriendRequest;
acceptFriendRequest = async function(friendshipId) {
  try {
    // Get friendship details first to notify the requester
    var { data: friendship } = await supabaseClient
      .from('friendships')
      .select('requester_id')
      .eq('id', friendshipId)
      .single();
    
    var { error } = await supabaseClient
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);
    
    if (error) throw error;
    
    // Create notification for the requester
    if (friendship) {
      var { data: player } = await supabaseClient
        .from('players')
        .select('username')
        .eq('id', currentUser.id)
        .single();
      
      await createNotification(
        friendship.requester_id,
        'friend_accepted',
        'Friend Request Accepted!',
        escapeHtml(player ? player.username : 'Someone') + ' accepted your friend request!',
        'tab:friends',
        currentUser.id
      );
    }
    
    showToast('Friend request accepted! 🎉');
    await updateFriendRequestBadge();
    loadFriendRequests();
    
  } catch (err) {
    showToast('Error: ' + err.message);
    console.error('Error accepting friend request:', err);
  }
};

// Modified postGuestbookMessage to create notification
var originalPostGuestbookMessage = postGuestbookMessage;
postGuestbookMessage = async function() {
  if (!currentUser || !currentProfileUserId) return;
  
  var messageInput = document.getElementById('guestbook-message-input');
  var message = messageInput.value.trim();
  
  if (!message) {
    showToast('Please enter a message');
    return;
  }
  
  if (message.length > 500) {
    showToast('Message is too long (max 500 characters)');
    return;
  }
  
  try {
    var { error } = await supabaseClient
      .from('guestbook_entries')
      .insert([{
        profile_user_id: currentProfileUserId,
        author_id: currentUser.id,
        message: message
      }]);
    
    if (error) throw error;
    
    // Create notification for profile owner (if not posting on own profile)
    if (currentProfileUserId !== currentUser.id) {
      var { data: player } = await supabaseClient
        .from('players')
        .select('username')
        .eq('id', currentUser.id)
        .single();
      
      var username = player ? player.username : 'Someone';
      
      await createNotification(
        currentProfileUserId,
        'guestbook_message',
        'New Guestbook Message',
        username + ' left a message on your guestbook!',
        'tab:profile',
        currentUser.id
      );
    }
    
    showToast('Message posted! 💖');
    messageInput.value = '';
    document.getElementById('guestbook-char-count').textContent = '0 / 500';
    loadGuestbookEntries(currentProfileUserId);
    
  } catch (err) {
    showToast('Error posting message: ' + err.message);
    console.error('Error posting guestbook message:', err);
  }
};

// Update showApp to initialize notification system
var originalShowAppForNotifications = showApp;
showApp = async function(user) {
  await originalShowAppForNotifications(user);
  
  // Initialize notifications
  await updateNotificationBadge();
  
  // Poll for new notifications every 30 seconds
  setInterval(updateNotificationBadge, 30000);
};


// ═══════════════════════════════════════════════════════════════════════════
// DAILY TIPS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function loadDailyTip() {
  console.log('🎯 loadDailyTip called!');
  var tipEl = document.getElementById('daily-tip-content');
  console.log('📝 Tip element:', tipEl);
  if (!tipEl) {
    console.log('❌ Tip element not found!');
    return;
  }
  
  // Get today's date as seed for consistent daily tip
  var today = new Date();
  var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  
  // Use seed to pick consistent tip for the day
  var tipIndex = seed % dailyTips.length;
  var tip = dailyTips[tipIndex];
  
  console.log('💡 Selected tip:', tip);
  tipEl.textContent = tip;
}


// ═══════════════════════════════════════════════════════════════════════════
// STARTER DUNGEON SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var dungeonState = {
  active: false,
  currentWave: 0,
  petId: null,
  petHP: 0,
  petMaxHP: 0,
  enemies: [],
  rewards: {
    pp: 0,
    xp: 0
  }
};

async function startDungeon() {
  if (!selectedBattlePetId) {
    showPixelToast('Select a pet first!', 'warning');
    return;
  }
  
  // Check daily energy cap
  var today = new Date().toISOString().split('T')[0];
  var energyKey = 'energy_used_' + today;
  var energyUsedToday = parseInt(localStorage.getItem(energyKey)) || 0;
  
  // Dungeon costs 15 energy (3 battles × 5)
  if (energyUsedToday >= 250 - 15) {
    showPixelToast('⚡ Not enough energy for dungeon run!', 'warning');
    return;
  }
  
  // Track energy used
  localStorage.setItem(energyKey, energyUsedToday + 15);
  
  // Get player pet stats
  var petStats = await calculatePetStats(selectedBattlePetId);
  if (!petStats) {
    showPixelToast('Error loading pet stats!', 'error');
    return;
  }
  
  // Initialize dungeon state
  dungeonState.active = true;
  dungeonState.currentWave = 1;
  dungeonState.petId = selectedBattlePetId;
  dungeonState.petHP = petStats.currentHP;
  dungeonState.petMaxHP = petStats.maxHP;
  dungeonState.rewards = { pp: 0, xp: 0 };
  
  // Generate 3 enemies
  dungeonState.enemies = await generateDungeonEnemies(petStats.stats);
  
  // Show dungeon intro modal
  showDungeonIntro();
}

async function generateDungeonEnemies(playerStats) {
  var playerLevel = Math.floor((playerStats.attack + playerStats.defense + playerStats.speed) / 5);
  
  // Get random base enemy from outskirts (easier creatures for starter dungeon)
  var res = await supabaseClient
    .from('enemy_pets')
    .select('*')
    .eq('forest_zone', 'outskirts');
  
  if (res.error || !res.data || res.data.length === 0) {
    return [];
  }
  
  // CRITICAL: Filter out raccoons completely
  var filteredEnemies = res.data.filter(function(enemy) {
    return enemy.species !== 'raccoon' && 
           enemy.name.toLowerCase().indexOf('raccoon') === -1;
  });
  
  if (filteredEnemies.length === 0) return [];
  
  var baseEnemy = filteredEnemies[Math.floor(Math.random() * filteredEnemies.length)];
  var enemies = [];
  
  // Wave 1: Baby variant (-1 level, 0.7x stats)
  var wave1 = createDungeonEnemy(baseEnemy, Math.max(1, playerLevel - 1), 'baby', 0.7);
  enemies.push(wave1);
  
  // Wave 2: Adult variant (player level, 1.3x stats)
  var wave2 = createDungeonEnemy(baseEnemy, playerLevel, 'adult', 1.3);
  enemies.push(wave2);
  
  // Wave 3: KING BOSS (+2 levels, 2.5x stats)
  var wave3 = createDungeonEnemy(baseEnemy, playerLevel + 2, 'king', 2.5);
  enemies.push(wave3);
  
  return enemies;
}

function createDungeonEnemy(baseEnemy, level, variant, statMultiplier) {
  var levelBonus = level - 1;
  var baseHP = Math.floor((baseEnemy.base_hp + (levelBonus * 8)) * statMultiplier);
  var baseATK = Math.floor((baseEnemy.base_attack + levelBonus) * statMultiplier);
  var baseDEF = Math.floor((baseEnemy.base_defense + Math.floor(levelBonus * 0.5)) * statMultiplier);
  var baseSPD = Math.floor((baseEnemy.base_speed + Math.floor(levelBonus * 0.5)) * statMultiplier);
  
  var variantNames = {
    'baby': 'Baby',
    'adult': 'Adult',
    'king': '👑 KING'
  };
  
  var name = variantNames[variant] + ' ' + baseEnemy.name;
  
  return {
    id: baseEnemy.id,
    species: baseEnemy.species,
    name: name,
    level: level,
    hp: baseHP,
    attack: baseATK,
    defense: baseDEF,
    speed: baseSPD,
    base_hp: baseHP,
    base_attack: baseATK,
    base_defense: baseDEF,
    base_speed: baseSPD,
    sprite_sheet: baseEnemy.sprite_sheet,
    forest_zone: baseEnemy.forest_zone,
    difficulty_tier: baseEnemy.difficulty_tier,
    variant: variant,
    exp_reward: Math.floor(baseEnemy.exp_reward * statMultiplier),
    pp_reward: Math.floor(baseEnemy.pp_reward * statMultiplier)
  };
}

function showDungeonIntro() {
  var modal = document.getElementById('exploration-modal');
  var enemy = dungeonState.enemies[0];
  
  document.getElementById('exploration-title').textContent = '⛰️ Shallow Cave - Wave 1/3';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--purple);">Dungeon Challenge Started!</strong><br><br>' +
    'Fight 3 waves back-to-back. Your HP carries over between battles!<br><br>' +
    'First enemy: <strong>' + enemy.name + '</strong> (Level ' + enemy.level + ')';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">⚠️ No healing between waves!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Start Wave 1!';
  continueBtn.onclick = function() {
    closeExplorationModal();
    startDungeonWave();
  };
  
  modal.classList.add('show');
}

async function startDungeonWave() {
  if (!dungeonState.active || dungeonState.currentWave > 3) return;
  
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  var petStats = await calculatePetStats(dungeonState.petId);
  
  if (!petStats) {
    showPixelToast('Error loading pet!', 'error');
    endDungeon(false);
    return;
  }
  
  // Override pet HP with dungeon state (persistent HP)
  petStats.currentHP = dungeonState.petHP;
  
  // Start battle
  await startDungeonBattle(petStats, enemy);
}

async function startDungeonBattle(playerStats, enemyStats) {
  // Hide exploration UI
  document.getElementById('forest-exploration').style.display = 'none';
  document.getElementById('battle-screen').style.display = 'block';
  
  // Set up player side
  var playerNameEl = el('player-battle-name');
  playerNameEl.textContent = playerStats.name;
  
  el('player-hp-text').textContent = playerStats.currentHP + '/' + playerStats.maxHP;
  el('player-hp-fill').style.width = ((playerStats.currentHP / playerStats.maxHP) * 100) + '%';
  
  var playerSprite = el('player-battle-sprite');
  playerSprite.style.backgroundImage = 'url(images/' + playerStats.imageFile + ')';
  
  // Set up enemy side
  el('enemy-battle-name').textContent = enemyStats.name;
  el('enemy-hp-text').textContent = enemyStats.hp + '/' + enemyStats.hp;
  el('enemy-hp-fill').style.width = '100%';
  
  var enemySprite = el('enemy-battle-sprite');
  enemySprite.innerHTML = '';
  
  // Get sprite configuration
  var config = getSpriteConfig(enemyStats.species);
  var sheetWidth = config.frameWidth * config.framesPerRow;
  var sheetHeight = config.frameHeight * config.rows;
  
  // Set up sprite with overflow fix
  enemySprite.style.backgroundImage = 'url(images/' + config.file + ')';
  enemySprite.style.backgroundSize = sheetWidth + 'px ' + sheetHeight + 'px';
  enemySprite.style.backgroundRepeat = 'no-repeat';
  enemySprite.style.backgroundPosition = '0 0';
  enemySprite.style.width = config.frameWidth + 'px';
  enemySprite.style.height = config.frameHeight + 'px';
  enemySprite.style.overflow = 'hidden';
  enemySprite.style.display = 'block';
  
  // Start animation
  startSpriteAnimation(enemySprite, enemyStats.species);
  
  // Clear battle log
  el('battle-log').innerHTML = '';
  
  // Simulate battle
  var battleResult = simulateBattle(playerStats, enemyStats);
  
  // Store dungeon HP after battle
  dungeonState.petHP = Math.max(0, battleResult.playerFinalHP);
  
  // Play battle
  currentBattleLog = battleResult.log;
  currentBattleIndex = 0;
  
  el('battle-skip-btn').style.display = 'inline-block';
  el('battle-continue-btn').style.display = 'none';
  
  playBattleTurn();
}

function endBattlePlayback() {
  el('battle-skip-btn').style.display = 'none';
  el('battle-continue-btn').style.display = 'inline-block';
  
  // Check if dungeon is active
  if (dungeonState.active) {
    handleDungeonBattleEnd();
  }
}

async function handleDungeonBattleEnd() {
  var victory = dungeonState.petHP > 0;
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  
  if (victory) {
    // Add rewards
    dungeonState.rewards.pp += enemy.pp_reward;
    dungeonState.rewards.xp += enemy.exp_reward;
    
    // Check if dungeon complete
    if (dungeonState.currentWave === 3) {
      // DUNGEON COMPLETE!
      await completeDungeon();
    } else {
      // Next wave
      dungeonState.currentWave++;
      showNextWaveModal();
    }
  } else {
    // Dungeon failed
    await failDungeon();
  }
}

function showNextWaveModal() {
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  var enemy = dungeonState.enemies[dungeonState.currentWave - 1];
  
  document.getElementById('exploration-title').textContent = 
    '⛰️ Wave ' + dungeonState.currentWave + '/3' + 
    (dungeonState.currentWave === 3 ? ' - BOSS!' : '');
  
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--green);">Wave ' + (dungeonState.currentWave - 1) + ' Complete!</strong><br><br>' +
    'Next enemy: <strong style="color: ' + (dungeonState.currentWave === 3 ? 'var(--pink)' : 'var(--purple)') + ';">' + 
    enemy.name + '</strong> (Level ' + enemy.level + ')<br><br>' +
    'Your HP: <strong>' + dungeonState.petHP + '/' + dungeonState.petMaxHP + '</strong>';
  
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">⚠️ Remember: No healing!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = dungeonState.currentWave === 3 ? 'Fight the KING!' : 'Continue to Wave ' + dungeonState.currentWave;
  continueBtn.onclick = function() {
    closeExplorationModal();
    startDungeonWave();
  };
  
  modal.classList.add('show');
}

async function completeDungeon() {
  // Award bonus PP for completing dungeon
  var bonusPP = 100;
  dungeonState.rewards.pp += bonusPP;
  
  // Save rewards
  await awardPP(dungeonState.rewards.pp, 'dungeon_reward');
  
  // Award XP to pet
  var petData = await supabaseClient
    .from('user_pets')
    .select('xp, level, max_hunger, max_energy, max_happiness, base_hp, base_attack, base_defense, base_speed')
    .eq('id', dungeonState.petId)
    .single();
  
  if (petData.data) {
    var pet = petData.data;
    var newXp = (pet.xp || 0) + dungeonState.rewards.xp;
    
    var lu = calculateLevelUp(
      newXp,
      pet.level,
      pet.max_hunger,
      pet.max_energy,
      pet.max_happiness,
      pet.base_hp || 25,
      pet.base_attack || 4,
      pet.base_defense || 2,
      pet.base_speed || 3
    );
    
    var updates = { xp: lu.xp, level: lu.level };
    
    if (lu.leveled) {
      updates.max_hunger = lu.maxHunger;
      updates.max_energy = lu.maxEnergy;
      updates.max_happiness = lu.maxHappiness;
      updates.base_hp = lu.base_hp;
      updates.base_attack = lu.base_attack;
      updates.base_defense = lu.base_defense;
      updates.base_speed = lu.base_speed;
      updates.max_hp = lu.base_hp;
    }
    
    await supabaseClient
      .from('user_pets')
      .update(updates)
      .eq('id', dungeonState.petId);
  }
  
  // Show completion modal
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '🎉 Dungeon Complete!';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--green); font-size: 1.3rem;">VICTORY!</strong><br><br>' +
    'You conquered the Shallow Cave!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem; margin: 10px 0;">+' + dungeonState.rewards.pp + ' PP</div>' +
    '<div style="color: var(--purple); font-weight: bold; margin: 5px 0;">+' + dungeonState.rewards.xp + ' XP</div>' +
    '<div style="color: var(--pink); font-weight: bold; margin: 10px 0;">+' + bonusPP + ' Completion Bonus!</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Amazing!';
  continueBtn.onclick = function() {
    closeExplorationModal();
    endDungeon(true);
  };
  
  modal.classList.add('show');
  
  // Reset dungeon state
  dungeonState.active = false;
}

async function failDungeon() {
  // Show failure modal
  document.getElementById('battle-screen').style.display = 'none';
  document.getElementById('forest-exploration').style.display = 'block';
  
  var modal = document.getElementById('exploration-modal');
  document.getElementById('exploration-title').textContent = '💔 Dungeon Failed';
  document.getElementById('exploration-result').innerHTML = 
    '<strong style="color: var(--text-light);">Your pet fainted on Wave ' + dungeonState.currentWave + '</strong><br><br>' +
    'Better luck next time!';
  document.getElementById('exploration-rewards').innerHTML = 
    '<div style="color: var(--text-light); font-size: 0.9rem;">No rewards for incomplete runs</div>';
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = 'Try Again Later';
  continueBtn.onclick = function() {
    closeExplorationModal();
    endDungeon(false);
  };
  
  modal.classList.add('show');
  
  // Reset dungeon state
  dungeonState.active = false;
}

function endDungeon(success) {
  dungeonState.active = false;
  dungeonState.currentWave = 0;
  dungeonState.petId = null;
  dungeonState.enemies = [];
  
  // Reload pets to show updated HP/stats
  if (tabsLoaded['battle']) {
    loadBattlePets();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// DAILY RANDOM EVENTS SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

var randomEvents = [
  // Standard PP rewards (existing)
  { text: "A wild creature dropped some coins in front of you!", pp: 25, icon: "🪙", type: "reward" },
  { text: "Your pet found a shiny gem while exploring!", pp: 30, icon: "💎", type: "reward" },
  { text: "A mysterious traveler gave you a gift!", pp: 20, icon: "🎁", type: "reward" },
  { text: "You discovered a hidden stash of PawketPoints!", pp: 35, icon: "✨", type: "reward" },
  { text: "A friendly bird dropped something shiny!", pp: 15, icon: "🐦", type: "reward" },
  { text: "Your pet dug up a buried treasure!", pp: 40, icon: "🏴‍☠️", type: "reward" },
  { text: "A lucky four-leaf clover appeared at your feet!", pp: 20, icon: "🍀", type: "reward" },
  { text: "The forest spirits blessed you with a gift!", pp: 25, icon: "🧚", type: "reward" },
  { text: "You found an old coin purse on the ground!", pp: 30, icon: "👛", type: "reward" },
  { text: "A shooting star granted your wish!", pp: 35, icon: "🌠", type: "reward" },
  { text: "Your pet made a new friend who shared their snacks!", pp: 15, icon: "🍪", type: "reward" },
  { text: "A rainbow appeared! Good fortune is coming your way!", pp: 25, icon: "🌈", type: "reward" },
  { text: "You stumbled upon an abandoned merchant cart!", pp: 45, icon: "🛒", type: "reward" },
  { text: "A magical mushroom ring appeared around you!", pp: 20, icon: "🍄", type: "reward" },
  { text: "The wind carried a pouch of coins to your feet!", pp: 30, icon: "💨", type: "reward" },
  
  // NEW: Bigger rewards (rarer)
  { text: "You found a legendary treasure chest!", pp: 100, icon: "💰", type: "reward" },
  { text: "A wealthy noble tossed you their spare change!", pp: 75, icon: "👑", type: "reward" },
  { text: "Your pet accidentally discovered a dragon's hoard!", pp: 150, icon: "🐉", type: "reward" },
  
  // NEW: Story/flavor events (still give PP)
  { text: "Your pet learned a new trick! They're so clever!", pp: 10, icon: "🎪", type: "story" },
  { text: "A mysterious hooded figure nodded approvingly at you...", pp: 15, icon: "🧙", type: "story" },
  { text: "The forest feels different today... magical, somehow.", pp: 20, icon: "🌲", type: "story" },
  { text: "You hear faint music in the distance. Where is it coming from?", pp: 15, icon: "🎵", type: "story" },
  { text: "Your pet found a strange glowing pebble. They seem mesmerized by it.", pp: 25, icon: "🔮", type: "story" },
  { text: "An old hermit shared wisdom with you: 'The strongest bonds are forged through care.'", pp: 20, icon: "🧓", type: "story" },
  { text: "You discovered ancient ruins covered in mysterious symbols...", pp: 30, icon: "🗿", type: "story" },
  { text: "A strange portal flickered in the air for just a moment, then vanished.", pp: 35, icon: "🌀", type: "story" },
  
  // NEW: Modifier events (temporary buffs) - These are special!
  { text: "⚡ LUCKY HOUR! Rare enemies appear more often for 30 minutes!", pp: 50, icon: "⭐", type: "modifier", modifier: "rare_spawn", duration: 30 },
  { text: "📚 STUDY BOOST! All XP gains doubled for 1 hour!", pp: 50, icon: "📖", type: "modifier", modifier: "double_xp", duration: 60 },
  { text: "🛍️ MERCHANT SALE! Shop items 20% off for 2 hours!", pp: 0, icon: "💸", type: "modifier", modifier: "shop_discount", duration: 120 },
  { text: "🎲 LUCKY STREAK! Your next minigame rewards are doubled!", pp: 30, icon: "🍀", type: "modifier", modifier: "minigame_boost", duration: 60 },
  { text: "🌟 GOLDEN HOUR! Enemy drop rates increased for 1 hour!", pp: 40, icon: "✨", type: "modifier", modifier: "drop_boost", duration: 60 },
  { text: "💪 POWER SURGE! Your pets deal +20% damage for 30 minutes!", pp: 35, icon: "⚔️", type: "modifier", modifier: "damage_boost", duration: 30 },
  { text: "🛡️ GUARDIAN BLESSING! Your pets take -20% damage for 30 minutes!", pp: 35, icon: "🛡️", type: "modifier", modifier: "defense_boost", duration: 30 }
];

function checkForRandomEvent() {
  // Get today's date for daily limit tracking
  var today = new Date().toISOString().split('T')[0];
  var eventsKey = 'random_events_' + today;
  var eventsToday = parseInt(localStorage.getItem(eventsKey) || '0');
  
  // Max 10 events per day
  if (eventsToday >= 10) {
    return;
  }
  
  // 8% chance per navigation (roughly 5-10 events per day with normal play)
  var roll = Math.random();
  if (roll < 0.08) {
    triggerRandomEvent();
    localStorage.setItem(eventsKey, (eventsToday + 1).toString());
  }
}

function triggerRandomEvent() {
  var event = randomEvents[Math.floor(Math.random() * randomEvents.length)];
  
  // Award PP (if any)
  if (event.pp > 0) {
    awardPP(event.pp, 'random_event');
  }
  
  // Handle modifier events
  if (event.type === 'modifier' && event.modifier && event.duration) {
    applyEventModifier(event.modifier, event.duration);
  }
  
  // Show modal
  var modal = document.getElementById('exploration-modal');
  if (!modal) return;
  
  document.getElementById('exploration-title').textContent = event.icon + ' Random Event!';
  document.getElementById('exploration-result').innerHTML = event.text;
  
  var rewardsHTML = '';
  if (event.pp > 0) {
    rewardsHTML += '<div style="color: var(--green); font-weight: bold; font-size: 1.2rem;">+' + event.pp + ' PP</div>';
  }
  if (event.type === 'modifier') {
    rewardsHTML += '<div style="color: var(--purple); font-weight: bold; font-size: 1rem; margin-top: 8px;">⏰ Active for ' + event.duration + ' minutes!</div>';
  }
  document.getElementById('exploration-rewards').innerHTML = rewardsHTML;
  
  var continueBtn = document.getElementById('exploration-continue-btn');
  continueBtn.textContent = event.type === 'modifier' ? 'Awesome!' : 'Nice!';
  continueBtn.onclick = closeExplorationModal;
  
  modal.classList.add('show');
  
  console.log('🎲 Random event triggered:', event.text, event.type === 'modifier' ? '(Modifier: ' + event.modifier + ')' : '');
}

// Apply event modifiers with expiration
function applyEventModifier(modifier, durationMinutes) {
  var now = Date.now();
  var expiration = now + (durationMinutes * 60 * 1000);
  
  // Store modifier in localStorage
  localStorage.setItem('event_modifier_' + modifier, expiration.toString());
  
  console.log('✨ Event modifier applied:', modifier, 'expires in', durationMinutes, 'minutes');
}

// Check if an event modifier is active
function hasActiveModifier(modifier) {
  var expiration = localStorage.getItem('event_modifier_' + modifier);
  if (!expiration) return false;
  
  var now = Date.now();
  if (now > parseInt(expiration)) {
    // Expired, clean up
    localStorage.removeItem('event_modifier_' + modifier);
    return false;
  }
  
  return true;
}

// Get active modifiers list (for UI display)
function getActiveModifiers() {
  var modifiers = [];
  var possibleMods = ['rare_spawn', 'double_xp', 'shop_discount', 'minigame_boost', 'drop_boost', 'damage_boost', 'defense_boost'];
  
  possibleMods.forEach(function(mod) {
    if (hasActiveModifier(mod)) {
      var expiration = parseInt(localStorage.getItem('event_modifier_' + mod));
      var remaining = Math.ceil((expiration - Date.now()) / (60 * 1000));
      modifiers.push({
        type: mod,
        minutesLeft: remaining
      });
    }
  });
  
  return modifiers;
}

// Hook into showTab to check for random events
var originalShowTabForEvents = showTab;
showTab = function(tabName) {
  originalShowTabForEvents(tabName);
  
  // Only check for events if user is logged in
  if (currentUser) {
    checkForRandomEvent();
  }
};


// ══════════════════════════════════════════════════════════════
// REFERRAL SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Initialize referral system
 * - Generate referral code if doesn't exist
 * - Check URL for referral parameter
 * - Display referral card
 */
async function initReferralSystem(userId) {
  console.log('🔗 Initializing referral system...');
  
  // Check if new user arrived via referral link
  var urlParams = new URLSearchParams(window.location.search);
  var referralCode = urlParams.get('ref');
  
  if (referralCode) {
    console.log('🎁 User arrived via referral code:', referralCode);
    await processReferral(userId, referralCode);
    
    // Clean URL (remove ref parameter)
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  // Load or generate referral code for current user
  await loadReferralData(userId);
  
  // Track page view in analytics
  gtag('event', 'page_view', {
    page_title: 'Home',
    page_location: window.location.href,
    page_path: window.location.pathname
  });
}

/**
 * Generate unique referral code from username
 */
function generateReferralCode(username) {
  // Create code from username (alphanumeric only, uppercase, max 10 chars)
  var base = username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8);
  
  // Add random numbers if too short
  while (base.length < 6) {
    base += Math.floor(Math.random() * 10);
  }
  
  // Add 2 random digits for uniqueness
  base += Math.floor(Math.random() * 90 + 10);
  
  return base;
}

/**
 * Load user's referral data and display card
 */
async function loadReferralData(userId) {
  try {
    var { data: player, error } = await supabaseClient
      .from('players')
      .select('username, referral_code, referrals_count')
      .eq('id', userId)
      .maybeSingle();
    
    // If player doesn't exist yet, skip referral setup
    if (!player) {
      console.log('⏳ Player not yet created, skipping referral data...');
      return;
    }
    
    if (error) {
      console.error('❌ Error loading referral data:', error);
      return;
    }
    
    // Generate code if doesn't exist
    if (!player.referral_code) {
      var newCode = generateReferralCode(player.username);
      
      var { error: updateError } = await supabaseClient
        .from('players')
        .update({ referral_code: newCode })
        .eq('id', userId);
      
      if (updateError) {
        console.error('❌ Error saving referral code:', updateError);
        return;
      }
      
      player.referral_code = newCode;
    }
    
    // Display referral card
    var referralCard = el('referral-card');
    if (referralCard) {
      referralCard.style.display = 'block';
      
      var referralLink = window.location.origin + window.location.pathname + '?ref=' + player.referral_code;
      el('referral-link-input').value = referralLink;
      el('referral-count').textContent = player.referrals_count || 0;
      el('referral-pp-earned').textContent = ((player.referrals_count || 0) * 200) + ' PP';
    }
    
    console.log('✅ Referral system loaded. Code:', player.referral_code);
  } catch (err) {
    console.error('❌ Referral system error:', err);
  }
}

/**
 * Process referral when new user signs up via ref link
 */
async function processReferral(newUserId, referralCode) {
  try {
    console.log('🎁 Processing referral for code:', referralCode);
    
    // Find referrer by code
    var { data: referrer, error: findError } = await supabaseClient
      .from('players')
      .select('id, username, referrals_count')
      .eq('referral_code', referralCode)
      .single();
    
    if (findError || !referrer) {
      console.log('⚠️ Referral code not found or invalid');
      return;
    }
    
    // Don't let users refer themselves
    if (referrer.id === newUserId) {
      console.log('⚠️ User tried to refer themselves');
      return;
    }
    
    // Check if user was already referred
    var { data: existingRef } = await supabaseClient
      .from('players')
      .select('referred_by')
      .eq('id', newUserId)
      .single();
    
    if (existingRef && existingRef.referred_by) {
      console.log('⚠️ User already has a referrer');
      return;
    }
    
    // Save referral relationship
    var { error: saveError } = await supabaseClient
      .from('players')
      .update({ referred_by: referrer.id })
      .eq('id', newUserId);
    
    if (saveError) {
      console.error('❌ Error saving referral:', saveError);
      return;
    }
    
    // Award rewards
    await awardReferralRewards(referrer.id, newUserId, referrer.username);
    
    console.log('✅ Referral processed successfully!');
  } catch (err) {
    console.error('❌ Error processing referral:', err);
  }
}

/**
 * Award PawketPoints to both referrer and new user
 */
async function awardReferralRewards(referrerId, newUserId, referrerUsername) {
  try {
    // Award referrer 200 PP
    var { data: referrerData } = await supabaseClient
      .from('players')
      .select('pawketpoints, referrals_count')
      .eq('id', referrerId)
      .single();
    
    if (referrerData) {
      await supabaseClient
        .from('players')
        .update({
          pawketpoints: (referrerData.pawketpoints || 0) + 200,
          referrals_count: (referrerData.referrals_count || 0) + 1
        })
        .eq('id', referrerId);
      
      console.log('💰 Awarded 200 PP to referrer');
    }
    
    // Award new user 100 PP
    var { data: newUserData } = await supabaseClient
      .from('players')
      .select('pawketpoints')
      .eq('id', newUserId)
      .single();
    
    if (newUserData) {
      await supabaseClient
        .from('players')
        .update({
          pawketpoints: (newUserData.pawketpoints || 0) + 100
        })
        .eq('id', newUserId);
      
      console.log('💰 Awarded 100 PP to new user');
      
      // Show welcome message
      showPixelToast('🎁 Welcome! You earned 100 PP from ' + referrerUsername + '\'s referral!', 'success');
    }
    
    // Check for referral badges
    await checkReferralBadges(referrerId, (referrerData.referrals_count || 0) + 1);
    
    // Track in analytics
    gtag('event', 'referral_successful', {
      referrer_id: referrerId,
      new_user_id: newUserId
    });
    
  } catch (err) {
    console.error('❌ Error awarding referral rewards:', err);
  }
}

/**
 * Check and award referral milestone badges
 */
async function checkReferralBadges(userId, referralCount) {
  var badges = [
    { count: 5, badge: 'recruiter', name: 'Recruiter' },
    { count: 10, badge: 'ambassador', name: 'Ambassador' },
    { count: 25, badge: 'influencer', name: 'Influencer' },
    { count: 50, badge: 'legend', name: 'Legend' }
  ];
  
  for (var i = 0; i < badges.length; i++) {
    if (referralCount >= badges[i].count) {
      await awardBadge(badges[i].badge, userId);
    }
  }
}

/**
 * Copy referral link to clipboard
 */
async function copyReferralLink() {
  var input = el('referral-link-input');
  var btn = el('copy-btn-text');
  
  try {
    // Select and copy
    input.select();
    input.setSelectionRange(0, 99999); // For mobile
    
    await navigator.clipboard.writeText(input.value);
    
    // Show success feedback
    btn.textContent = '✓ Copied!';
    showPixelToast('Referral link copied to clipboard!', 'success');
    
    // Track in analytics
    gtag('event', 'referral_link_copied', {
      referral_link: input.value
    });
    
    // Reset button text after 2 seconds
    setTimeout(function() {
      btn.textContent = 'Copy Link';
    }, 2000);
    
  } catch (err) {
    console.error('Failed to copy:', err);
    
    // Fallback: show prompt to copy manually
    btn.textContent = 'Select & Copy';
    setTimeout(function() {
      btn.textContent = 'Copy Link';
    }, 2000);
  }
}

// ══════════════════════════════════════════════════════════════
// ANALYTICS EVENT TRACKING
// ══════════════════════════════════════════════════════════════

/**
 * Track custom events throughout the app
 * Call these functions at key moments
 */

function trackSignup() {
  gtag('event', 'sign_up', {
    method: 'email'
  });
}

function trackPetAdoption(petName) {
  gtag('event', 'adopt_pet', {
    pet_name: petName,
    event_category: 'engagement'
  });
}

function trackMinigame(gameName) {
  gtag('event', 'play_minigame', {
    game_name: gameName,
    event_category: 'engagement'
  });
}

function trackBattle(result) {
  gtag('event', 'battle', {
    result: result, // 'victory' or 'defeat'
    event_category: 'engagement'
  });
}

function trackBadgeUnlock(badgeName) {
  gtag('event', 'unlock_badge', {
    badge_name: badgeName,
    event_category: 'achievement'
  });
}

function trackTwitchLink() {
  gtag('event', 'link_twitch', {
    event_category: 'social'
  });
}

// ══════════════════════════════════════════════════════════════
// SOCIAL SHARING SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Get emoji for pet (for social posts)
 */
function getPetEmoji(petName) {
  var emojiMap = {
    'Ember': '🦊',
    'Pyxie': '🐰',
    'Bird': '🐦',
    'Fox': '🦊',
    'Raccoon': '🦝',
    'Bear': '🐻',
    'Deer': '🦌',
    'Wolf': '🐺',
    'Squirrel': '🐿️',
    'Bunny': '🐰'
  };
  
  return emojiMap[petName] || '🐾';
}

/**
 * Get user's referral link
 */
async function getReferralLink() {
  if (!currentUser) return 'https://pawketpetsvt.github.io';
  
  var { data } = await supabaseClient
    .from('players')
    .select('referral_code')
    .eq('id', currentUser.id)
    .single();
  
  if (data && data.referral_code) {
    return 'https://pawketpetsvt.github.io/?ref=' + data.referral_code;
  }
  
  return 'https://pawketpetsvt.github.io';
}

/**
 * Share to Twitter
 */
function shareToTwitter(text, includeReferral) {
  getReferralLink().then(function(url) {
    var shareUrl = includeReferral ? url : 'https://pawketpetsvt.github.io';
    var twitterUrl = 'https://twitter.com/intent/tweet?' +
      'text=' + encodeURIComponent(text) +
      '&url=' + encodeURIComponent(shareUrl) +
      '&hashtags=PawketPetsVT,VTuber,VirtualPets';
    
    window.open(twitterUrl, '_blank', 'width=550,height=420');
    
    // Track in analytics
    gtag('event', 'social_share', {
      platform: 'twitter',
      content_type: 'general'
    });
  });
}

/**
 * Share to Bluesky
 */
function shareToBluesky(text, includeReferral) {
  getReferralLink().then(function(url) {
    var shareUrl = includeReferral ? url : 'https://pawketpetsvt.github.io';
    var fullText = text + '\n\n' + shareUrl;
    var blueskyUrl = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(fullText);
    
    window.open(blueskyUrl, '_blank', 'width=600,height=600');
    
    // Track in analytics
    gtag('event', 'social_share', {
      platform: 'bluesky',
      content_type: 'general'
    });
  });
}

/**
 * Share after pet adoption
 */
function shareAdoptionToTwitter() {
  if (!lastAdoptedPet) {
    shareToTwitter('I just adopted a pet in PawketPetsVT! Join me! 🐾', true);
    return;
  }
  
  var text = 'I just adopted ' + lastAdoptedPet.nickname + ' in PawketPetsVT! ' + 
             lastAdoptedPet.emoji + '\n\nJoin me and get 100 free PawketPoints!';
  
  shareToTwitter(text, true);
}

function shareAdoptionToBluesky() {
  if (!lastAdoptedPet) {
    shareToBluesky('I just adopted a pet in PawketPetsVT! Join me! 🐾', true);
    return;
  }
  
  var text = 'I just adopted ' + lastAdoptedPet.nickname + ' in PawketPetsVT! ' + 
             lastAdoptedPet.emoji + '\n\nJoin me and get 100 free PawketPoints!';
  
  shareToBluesky(text, true);
}

/**
 * Share badge unlock
 */
var lastUnlockedBadge = null;

function shareBadgeToTwitter(badgeName, badgeIcon) {
  var text = 'I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT!\n\nJoin me!';
  shareToTwitter(text, true);
}

function shareBadgeToBluesky(badgeName, badgeIcon) {
  var text = 'I just earned the "' + badgeName + '" badge ' + badgeIcon + ' in PawketPetsVT!\n\nJoin me!';
  shareToBluesky(text, true);
}

/**
 * Share level milestone
 */
function shareLevelToTwitter(level) {
  var text = 'I just reached Level ' + level + ' in PawketPetsVT! 🎉\n\nJoin the fun!';
  shareToTwitter(text, true);
}

function shareLevelToBluesky(level) {
  var text = 'I just reached Level ' + level + ' in PawketPetsVT! 🎉\n\nJoin the fun!';
  shareToBluesky(text, true);
}

/**
 * Share profile
 */
async function shareProfileToTwitter() {
  if (!currentUser) return;
  
  var { data } = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  var username = data ? data.username : 'me';
  var text = 'Check out my PawketPetsVT profile! 🐾\n\nCome play with ' + username + '!';
  
  shareToTwitter(text, true);
}

async function shareProfileToBluesky() {
  if (!currentUser) return;
  
  var { data } = await supabaseClient
    .from('players')
    .select('username')
    .eq('id', currentUser.id)
    .single();
  
  var username = data ? data.username : 'me';
  var text = 'Check out my PawketPetsVT profile! 🐾\n\nCome play with ' + username + '!';
  
  shareToBluesky(text, true);
}

/**
 * Share battle victory
 */
function shareBattleVictoryToTwitter(enemyName) {
  var text = 'I just defeated a ' + enemyName + ' in PawketPetsVT! ⚔️\n\nThink you can beat me?';
  shareToTwitter(text, true);
}

function shareBattleVictoryToBluesky(enemyName) {
  var text = 'I just defeated a ' + enemyName + ' in PawketPetsVT! ⚔️\n\nThink you can beat me?';
  shareToBluesky(text, true);
}


// ══════════════════════════════════════════════════════════════
// RETRO FORUM SYSTEM
// ══════════════════════════════════════════════════════════════

var currentCategoryId = null;
var currentThreadId = null;
var isModerator = false;

/**
 * Initialize forum - check if user is mod
 */
async function initForum() {
  console.log('🏛️ Initializing forum...');
  
  if (!currentUser) {
    console.log('❌ No user logged in for forum');
    return;
  }
  
  console.log('✅ User logged in, checking moderator status...');
  
  // Check if user is moderator
  try {
    var { data, error } = await supabaseClient
      .from('forum_moderators')
      .select('id')
      .eq('user_id', currentUser.id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking mod status:', error);
    }
    
    isModerator = !!data;
    console.log('Moderator status:', isModerator);
    
    if (isModerator) {
      var adminBtn = el('forum-admin-panel-btn');
      if (adminBtn) {
        adminBtn.style.display = 'block';
        console.log('✅ Moderator panel button shown');
      } else {
        console.error('❌ Admin panel button element not found!');
      }
    }
  } catch (err) {
    console.error('Error in mod check:', err);
  }
  
  console.log('Loading forum categories...');
  await loadForumCategories();
}

/**
 * Load forum categories
 */
async function loadForumCategories() {
  console.log('📂 Loading forum categories...');
  
  var list = el('forum-categories-list');
  if (!list) {
    console.error('❌ forum-categories-list element not found!');
    return;
  }
  
  list.innerHTML = '<div class="spinner"></div>';
  
  try {
    var { data: categories, error } = await supabaseClient
      .from('forum_categories')
      .select('*')
      .order('display_order', { ascending: true });
    
    if (error) {
      console.error('❌ Error loading categories:', error);
      list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">😞</div><p>Error loading categories: ' + error.message + '</p></div>';
      return;
    }
    
    console.log('✅ Categories loaded:', categories.length);
    
    if (!categories || categories.length === 0) {
      console.warn('⚠️ No categories found in database!');
      list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">📂</div><p>No forum categories yet. Please run the SQL migration!</p></div>';
      return;
    }
    
    list.innerHTML = '';
    
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      console.log('Creating card for category:', cat.name);
      
      // Get thread count
      var { count } = await supabaseClient
        .from('forum_threads')
        .select('*', { count: 'exact', head: true })
        .eq('category_id', cat.id);
      
      var card = makeEl('div', { class: 'forum-category-card' });
      card.onclick = (function(catId, catName) {
        return function() { showForumCategory(catId, catName); };
      })(cat.id, cat.name);
      
      card.innerHTML = `
        <div class="forum-category-icon">${cat.icon}</div>
        <div class="forum-category-info">
          <div class="forum-category-name">${cat.name}</div>
          <div class="forum-category-desc">${cat.description || ''}</div>
        </div>
        <div class="forum-category-stats">
          <div class="forum-stat-number">${count || 0}</div>
          <div class="forum-stat-label">Threads</div>
        </div>
      `;
      
      list.appendChild(card);
    }
    
    console.log('✅ Forum categories displayed successfully!');
  } catch (err) {
    console.error('❌ Exception in loadForumCategories:', err);
    list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">😞</div><p>Error: ' + err.message + '</p></div>';
  }
}

/**
 * Show forum category (list of threads)
 */
async function showForumCategory(categoryId, categoryName) {
  currentCategoryId = categoryId;
  
  el('forum-categories-view').style.display = 'none';
  el('forum-category-view').style.display = 'block';
  el('forum-category-name').textContent = categoryName;
  
  await loadForumThreads(categoryId);
}

/**
 * Load threads in category
 */
async function loadForumThreads(categoryId) {
  var list = el('forum-threads-list');
  list.innerHTML = '<div class="spinner"></div>';
  
  // Check if user is banned
  if (currentUser) {
    var { data: ban } = await supabaseClient
      .from('forum_bans')
      .select('id')
      .eq('user_id', currentUser.id)
      .single();
    
    if (ban) {
      list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">🚫</div><p>You have been banned from posting</p></div>';
      return;
    }
  }
  
  var { data: threads, error } = await supabaseClient
    .from('forum_threads')
    .select('*, players!forum_threads_author_id_fkey(username)')
    .eq('category_id', categoryId)
    .order('is_pinned', { ascending: false })
    .order('last_reply_at', { ascending: false });
  
  if (error) {
    list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">😞</div><p>Error loading threads</p></div>';
    return;
  }
  
  if (threads.length === 0) {
    list.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">📝</div><p>No threads yet. Be the first to post!</p></div>';
    return;
  }
  
  list.innerHTML = '';
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    
    var row = makeEl('div', { class: 'forum-thread-row' });
    if (thread.is_pinned) row.classList.add('pinned');
    if (thread.is_locked) row.classList.add('locked');
    
    row.onclick = (function(threadId) {
      return function() { showForumThread(threadId); };
    })(thread.id);
    
    var icon = '💬';
    if (thread.is_pinned) icon = '📌';
    if (thread.is_locked) icon = '🔒';
    
    var timeAgo = getTimeAgo(thread.created_at);
    
    row.innerHTML = `
      <div class="forum-thread-icon">${icon}</div>
      <div class="forum-thread-content">
        <div class="forum-thread-title">${escapeHtml(thread.title)}</div>
        <div class="forum-thread-meta">
          Started by <strong>${thread.players.username}</strong> • ${timeAgo}
        </div>
      </div>
      <div class="forum-thread-stats">
        <div class="forum-thread-stat">
          <div class="forum-thread-stat-number">${thread.reply_count}</div>
          <div class="forum-thread-stat-label">Replies</div>
        </div>
        <div class="forum-thread-stat">
          <div class="forum-thread-stat-number">${thread.view_count}</div>
          <div class="forum-thread-stat-label">Views</div>
        </div>
      </div>
    `;
    
    list.appendChild(row);
  }
}

/**
 * Show single thread with replies
 */
async function showForumThread(threadId) {
  currentThreadId = threadId;
  
  el('forum-category-view').style.display = 'none';
  el('forum-thread-view').style.display = 'block';
  
  var container = el('forum-thread-container');
  container.innerHTML = '<div class="spinner"></div>';
  
  // Increment view count
  await supabaseClient.rpc('increment', {
    table_name: 'forum_threads',
    row_id: threadId,
    column_name: 'view_count'
  });
  
  // Get thread
  var { data: thread, error: threadError } = await supabaseClient
    .from('forum_threads')
    .select('*, players!forum_threads_author_id_fkey(username, forum_post_count)')
    .eq('id', threadId)
    .single();
  
  if (threadError || !thread) {
    container.innerHTML = '<div class="forum-empty-state"><div class="forum-empty-state-icon">😞</div><p>Thread not found</p></div>';
    return;
  }
  
  // Check if locked
  if (thread.is_locked && !isModerator) {
    el('forum-reply-box').style.display = 'none';
  } else {
    el('forum-reply-box').style.display = 'block';
  }
  
  // Get replies
  var { data: replies } = await supabaseClient
    .from('forum_replies')
    .select('*, players!forum_replies_author_id_fkey(username, forum_post_count)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  
  container.innerHTML = '';
  
  // Original post
  var op = makeEl('div', { class: 'forum-post original-post' });
  op.innerHTML = createForumPostHTML(thread, thread.players, true);
  container.appendChild(op);
  
  // Replies
  if (replies && replies.length > 0) {
    for (var i = 0; i < replies.length; i++) {
      var reply = replies[i];
      var replyEl = makeEl('div', { class: 'forum-post' });
      replyEl.innerHTML = createForumPostHTML(reply, reply.players, false);
      container.appendChild(replyEl);
    }
  }
}

/**
 * Create forum post HTML
 */
function createForumPostHTML(post, author, isOriginal) {
  var timeAgo = getTimeAgo(post.created_at);
  var initial = author.username.charAt(0).toUpperCase();
  var postCount = author.forum_post_count || 0;
  
  var deleteBtn = '';
  if (isModerator || (currentUser && currentUser.id === post.author_id)) {
    var postType = isOriginal ? 'thread' : 'reply';
    deleteBtn = `<button class="forum-post-action-btn danger" onclick="deleteForumPost('${post.id}', '${postType}')">🗑️ Delete</button>`;
  }
  
  var pinBtn = '';
  var lockBtn = '';
  if (isModerator && isOriginal) {
    pinBtn = `<button class="forum-post-action-btn" onclick="togglePin('${post.id}', ${!post.is_pinned})">${post.is_pinned ? '📌 Unpin' : '📌 Pin'}</button>`;
    lockBtn = `<button class="forum-post-action-btn" onclick="toggleLock('${post.id}', ${!post.is_locked})">${post.is_locked ? '🔓 Unlock' : '🔒 Lock'}</button>`;
  }
  
  return `
    <div class="forum-post-sidebar">
      <div class="forum-post-avatar">${initial}</div>
      <div class="forum-post-username">${escapeHtml(author.username)}</div>
      ${isModerator && post.author_id === currentUser.id ? '<div class="forum-post-badge">MOD</div>' : ''}
      <div class="forum-post-stats">
        Posts: ${postCount}
      </div>
    </div>
    <div class="forum-post-content-wrapper">
      <div class="forum-post-header">
        <div class="forum-post-date">${timeAgo}</div>
        <div class="forum-post-actions">
          ${pinBtn}
          ${lockBtn}
          ${deleteBtn}
        </div>
      </div>
      <div class="forum-post-body">${escapeHtml(post.content || post.title)}</div>
    </div>
  `;
}

/**
 * Show new thread modal
 */
function showNewThreadModal() {
  if (!currentUser) {
    showToast('Please log in to post!');
    return;
  }
  
  el('new-thread-modal').classList.add('show');
  el('new-thread-title').value = '';
  el('new-thread-content').value = '';
}

function closeNewThreadModal() {
  el('new-thread-modal').classList.remove('show');
}

/**
 * Submit new thread
 */
async function submitNewThread() {
  if (!currentUser) return;
  
  var title = el('new-thread-title').value.trim();
  var content = el('new-thread-content').value.trim();
  
  if (!title || !content) {
    showToast('Please fill in both title and message!');
    return;
  }
  
  // Check if banned
  var { data: ban } = await supabaseClient
    .from('forum_bans')
    .select('id')
    .eq('user_id', currentUser.id)
    .single();
  
  if (ban) {
    showToast('You are banned from posting');
    return;
  }
  
  var { error } = await supabaseClient
    .from('forum_threads')
    .insert([{
      category_id: currentCategoryId,
      author_id: currentUser.id,
      title: title,
      content: content
    }]);
  
  if (error) {
    showToast('Error creating thread: ' + error.message);
    return;
  }
  
  showPixelToast('Thread created!', 'success');
  closeNewThreadModal();
  
  // Reload category
  var catName = el('forum-category-name').textContent;
  showForumCategory(currentCategoryId, catName);
}

/**
 * Submit reply to thread
 */
async function submitReply() {
  if (!currentUser) {
    showToast('Please log in to reply!');
    return;
  }
  
  var content = el('forum-reply-textarea').value.trim();
  
  if (!content) {
    showToast('Please write a reply!');
    return;
  }
  
  // Check if banned
  var { data: ban } = await supabaseClient
    .from('forum_bans')
    .select('id')
    .eq('user_id', currentUser.id)
    .single();
  
  if (ban) {
    showToast('You are banned from posting');
    return;
  }
  
  var { error } = await supabaseClient
    .from('forum_replies')
    .insert([{
      thread_id: currentThreadId,
      author_id: currentUser.id,
      content: content
    }]);
  
  if (error) {
    showToast('Error posting reply: ' + error.message);
    return;
  }
  
  showPixelToast('Reply posted!', 'success');
  el('forum-reply-textarea').value = '';
  
  // Reload thread
  await showForumThread(currentThreadId);
}

/**
 * Delete forum post
 */
async function deleteForumPost(postId, postType) {
  if (!confirm('Are you sure you want to delete this ' + postType + '?')) {
    return;
  }
  
  if (postType === 'thread') {
    var { error } = await supabaseClient
      .from('forum_threads')
      .delete()
      .eq('id', postId);
    
    if (error) {
      showToast('Error deleting thread');
      return;
    }
    
    showPixelToast('Thread deleted', 'success');
    backToCategory();
  } else {
    var { error } = await supabaseClient
      .from('forum_replies')
      .delete()
      .eq('id', postId);
    
    if (error) {
      showToast('Error deleting reply');
      return;
    }
    
    showPixelToast('Reply deleted', 'success');
    await showForumThread(currentThreadId);
  }
}

/**
 * Toggle thread pin
 */
async function togglePin(threadId, pinState) {
  var { error } = await supabaseClient
    .from('forum_threads')
    .update({ is_pinned: pinState })
    .eq('id', threadId);
  
  if (error) {
    showToast('Error updating thread');
    return;
  }
  
  showPixelToast(pinState ? 'Thread pinned' : 'Thread unpinned', 'success');
  await showForumThread(threadId);
}

/**
 * Toggle thread lock
 */
async function toggleLock(threadId, lockState) {
  var { error } = await supabaseClient
    .from('forum_threads')
    .update({ is_locked: lockState })
    .eq('id', threadId);
  
  if (error) {
    showToast('Error updating thread');
    return;
  }
  
  showPixelToast(lockState ? 'Thread locked' : 'Thread unlocked', 'success');
  await showForumThread(threadId);
}

/**
 * Show forum categories view
 */
function showForumCategories() {
  el('forum-categories-view').style.display = 'block';
  el('forum-category-view').style.display = 'none';
  el('forum-thread-view').style.display = 'none';
  currentCategoryId = null;
  currentThreadId = null;
}

/**
 * Go back to category from thread
 */
function backToCategory() {
  el('forum-category-view').style.display = 'block';
  el('forum-thread-view').style.display = 'none';
  
  var catName = el('forum-category-name').textContent;
  loadForumThreads(currentCategoryId);
}

/**
 * Admin panel functions
 */
function toggleAdminPanel() {
  el('admin-panel-modal').classList.add('show');
  switchAdminTab('bans');
}

function closeAdminPanel() {
  el('admin-panel-modal').classList.remove('show');
}

function switchAdminTab(tab) {
  var tabs = document.querySelectorAll('.admin-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  event.target.classList.add('active');
  
  el('admin-bans-view').style.display = tab === 'bans' ? 'block' : 'none';
  el('admin-recent-view').style.display = tab === 'recent' ? 'block' : 'none';
  
  if (tab === 'bans') {
    loadBannedUsers();
  } else {
    loadRecentPosts();
  }
}

/**
 * Load banned users
 */
async function loadBannedUsers() {
  var list = el('banned-users-list');
  list.innerHTML = '<div class="spinner"></div>';
  
  var { data: bans } = await supabaseClient
    .from('forum_bans')
    .select('*, players!forum_bans_user_id_fkey(username)')
    .order('banned_at', { ascending: false });
  
  if (!bans || bans.length === 0) {
    list.innerHTML = '<p style="color:var(--text-light)">No banned users</p>';
    return;
  }
  
  list.innerHTML = '';
  
  for (var i = 0; i < bans.length; i++) {
    var ban = bans[i];
    var item = makeEl('div', { class: 'banned-user-item' });
    item.innerHTML = `
      <div>
        <strong>${ban.players.username}</strong>
        ${ban.reason ? '<br><small>' + escapeHtml(ban.reason) + '</small>' : ''}
      </div>
      <button class="btn btn-sm btn-outline" onclick="unbanUser('${ban.user_id}')">Unban</button>
    `;
    list.appendChild(item);
  }
}

/**
 * Ban user
 */
async function banUser() {
  var username = el('ban-username-input').value.trim();
  var reason = el('ban-reason-input').value.trim();
  
  if (!username) {
    showToast('Enter a username');
    return;
  }
  
  // Find user
  var { data: user } = await supabaseClient
    .from('players')
    .select('id')
    .eq('username', username)
    .single();
  
  if (!user) {
    showToast('User not found');
    return;
  }
  
  var { error } = await supabaseClient
    .from('forum_bans')
    .insert([{
      user_id: user.id,
      banned_by: currentUser.id,
      reason: reason || null
    }]);
  
  if (error) {
    showToast('Error banning user: ' + error.message);
    return;
  }
  
  showPixelToast('User banned', 'success');
  el('ban-username-input').value = '';
  el('ban-reason-input').value = '';
  loadBannedUsers();
}

/**
 * Unban user
 */
async function unbanUser(userId) {
  var { error } = await supabaseClient
    .from('forum_bans')
    .delete()
    .eq('user_id', userId);
  
  if (error) {
    showToast('Error unbanning user');
    return;
  }
  
  showPixelToast('User unbanned', 'success');
  loadBannedUsers();
}

/**
 * Load recent posts for moderation
 */
async function loadRecentPosts() {
  var list = el('recent-posts-list');
  list.innerHTML = '<div class="spinner"></div>';
  
  var { data: threads } = await supabaseClient
    .from('forum_threads')
    .select('*, players!forum_threads_author_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!threads || threads.length === 0) {
    list.innerHTML = '<p style="color:var(--text-light)">No recent posts</p>';
    return;
  }
  
  list.innerHTML = '';
  
  for (var i = 0; i < threads.length; i++) {
    var thread = threads[i];
    var item = makeEl('div', { class: 'recent-post-item' });
    var timeAgo = getTimeAgo(thread.created_at);
    item.innerHTML = `
      <div><strong>${escapeHtml(thread.title)}</strong></div>
      <div style="font-size:0.85rem;color:var(--text-light);margin-top:4px;">
        by ${thread.players.username} • ${timeAgo}
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteForumPost('${thread.id}', 'thread')" style="margin-top:8px;">
        Delete Thread
      </button>
    `;
    list.appendChild(item);
  }
}

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
  var now = new Date();
  var time = new Date(timestamp);
  var diff = Math.floor((now - time) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago';
  if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago';
  if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago';
  return Math.floor(diff / 2592000) + ' months ago';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  var div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}


// ══════════════════════════════════════════════════════════════
// EMOJI PICKER FOR FORUM
// ══════════════════════════════════════════════════════════════

/**
 * Toggle emoji picker
 */
function toggleEmojiPicker(type) {
  var picker = el('emoji-picker-' + type);
  if (!picker) return;
  
  if (picker.style.display === 'none') {
    // Close all other pickers first
    var allPickers = document.querySelectorAll('.emoji-picker');
    allPickers.forEach(function(p) { p.style.display = 'none'; });
    
    // Open this one
    picker.style.display = 'block';
  } else {
    picker.style.display = 'none';
  }
}

/**
 * Insert emoji into textarea
 */
function insertEmoji(textareaId, emoji) {
  var textarea = el(textareaId);
  if (!textarea) return;
  
  var startPos = textarea.selectionStart;
  var endPos = textarea.selectionEnd;
  var text = textarea.value;
  
  textarea.value = text.substring(0, startPos) + emoji + text.substring(endPos);
  
  // Set cursor after emoji
  textarea.selectionStart = textarea.selectionEnd = startPos + emoji.length;
  textarea.focus();
  
  // Close picker
  var allPickers = document.querySelectorAll('.emoji-picker');
  allPickers.forEach(function(p) { p.style.display = 'none'; });
}


// ══════════════════════════════════════════════════════════════
// PARTICLE EFFECTS SYSTEM
// ══════════════════════════════════════════════════════════════

/**
 * Create floating sparkles on home page
 */
function createFloatingSparkles() {
  var sparkles = ['✨', '⭐', '💫', '🌟'];
  
  // FIX 4: Use safe timer and track interval globally
  window.particleInterval = safeSetInterval(function() {
    var sparkle = makeEl('div', { class: 'sparkle-particle' });
    sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
    sparkle.style.left = Math.random() * window.innerWidth + 'px';
    sparkle.style.animationDelay = Math.random() * 2 + 's';
    sparkle.style.animationDuration = (Math.random() * 2 + 2) + 's';
    
    document.body.appendChild(sparkle);
    
    safeSetTimeout(function() {
      sparkle.remove();
    }, 5000);
  }, 3000); // New sparkle every 3 seconds
}

/**
 * Confetti burst (for adoptions)
 */
function createConfettiBurst(x, y) {
  var colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe'];
  var count = 50;
  
  for (var i = 0; i < count; i++) {
    var confetti = makeEl('div', { class: 'confetti-piece' });
    confetti.style.left = x + 'px';
    confetti.style.top = y + 'px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDelay = (Math.random() * 0.3) + 's';
    confetti.style.animationDuration = (Math.random() * 1 + 2) + 's';
    
    // Random direction
    var angle = (Math.random() * 360);
    var velocity = (Math.random() * 300 + 200);
    confetti.style.setProperty('--tx', Math.cos(angle) * velocity + 'px');
    confetti.style.setProperty('--ty', Math.sin(angle) * velocity + 'px');
    
    document.body.appendChild(confetti);
    
    setTimeout(function(c) {
      return function() { c.remove(); };
    }(confetti), 3000);
  }
}

/**
 * Star burst (for battle victories)
 */
function createStarBurst(x, y) {
  var stars = ['⭐', '🌟', '✨', '💫'];
  var count = 12;
  
  for (var i = 0; i < count; i++) {
    var star = makeEl('div', { class: 'star-burst' });
    star.textContent = stars[Math.floor(Math.random() * stars.length)];
    
    var angle = (i / count) * Math.PI * 2;
    var distance = 100;
    
    star.style.left = (x + Math.cos(angle) * distance) + 'px';
    star.style.top = (y + Math.sin(angle) * distance) + 'px';
    star.style.animationDelay = (i * 0.05) + 's';
    
    document.body.appendChild(star);
    
    setTimeout(function(s) {
      return function() { s.remove(); };
    }(star), 1500);
  }
}

/**
 * Floating hearts (when playing with pet)
 */
function createHeartFloat(x, y) {
  var hearts = ['💖', '💗', '💕', '❤️'];
  var count = 5;
  
  for (var i = 0; i < count; i++) {
    var heart = makeEl('div', { class: 'heart-float' });
    heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
    heart.style.left = (x + (Math.random() - 0.5) * 100) + 'px';
    heart.style.top = y + 'px';
    heart.style.animationDelay = (i * 0.2) + 's';
    
    document.body.appendChild(heart);
    
    setTimeout(function(h) {
      return function() { h.remove(); };
    }(heart), 2500);
  }
}

/**
 * Initialize particle effects
 */
function initParticleEffects() {
  // Only add floating sparkles on home page
  var homeSection = el('section-home');
  if (homeSection && homeSection.classList.contains('active')) {
    createFloatingSparkles();
  }
}

// Start particles when page loads
setTimeout(function() {
  if (el('section-home') && el('section-home').classList.contains('active')) {
    createFloatingSparkles();
  }
}, 2000);


// ═══════════════════════════════════════════════════════════════════════
// PET TITLES SYSTEM
// ═══════════════════════════════════════════════════════════════════════

var allPetTitles = []; // All available pet titles
var petTitlesCache = {}; // Cache of titles per pet: { petId: [titles] }

// Load all pet titles
async function loadAllPetTitles() {
  try {
    var res = await supabaseClient
      .from('pet_titles')
      .select('*')
      .order('rarity', { ascending: false });
    
    if (res.data) {
      allPetTitles = res.data;
      console.log('🏷️ Pet titles loaded:', allPetTitles.length, 'available');
    }
  } catch (err) {
    console.error('[Pet Titles] Error loading titles:', err);
  }
}

// Load titles for a specific pet
async function loadPetTitles(petId) {
  if (!petId) return [];
  
  try {
    var res = await supabaseClient
      .from('user_pet_titles')
      .select('pet_title_id, pet_titles(*)')
      .eq('user_pet_id', petId);
    
    if (res.data) {
      var titles = res.data.map(function(upt) { return upt.pet_titles; });
      petTitlesCache[petId] = titles;
      return titles;
    }
    
    return [];
  } catch (err) {
    console.error('[Pet Titles] Error loading pet titles:', err);
    return [];
  }
}

// Check if pet has specific title
function petHasTitle(petId, titleKey) {
  var titles = petTitlesCache[petId] || [];
  return titles.some(function(t) { return t.title_key === titleKey; });
}

// Award title to pet
async function awardPetTitle(petId, titleKey, reason) {
  if (!petId || !titleKey) return;
  
  // Check if already has this title
  if (petHasTitle(petId, titleKey)) {
    console.log('[Pet Title] Already unlocked:', titleKey, 'for pet', petId);
    return;
  }
  
  try {
    // Get title info
    var titleRes = await supabaseClient
      .from('pet_titles')
      .select('*')
      .eq('title_key', titleKey)
      .single();
    
    if (titleRes.error || !titleRes.data) {
      console.error('[Pet Title] Title not found:', titleKey);
      return;
    }
    
    var title = titleRes.data;
    
    // Insert into user_pet_titles
    var insertRes = await supabaseClient
      .from('user_pet_titles')
      .insert([{
        user_pet_id: petId,
        pet_title_id: title.id,
        unlock_reason: reason || 'Earned in battle'
      }]);
    
    if (insertRes.error) {
      console.error('[Pet Title] Error awarding title:', insertRes.error);
      return;
    }
    
    // Add to local cache
    if (!petTitlesCache[petId]) {
      petTitlesCache[petId] = [];
    }
    petTitlesCache[petId].push(title);
    
    // Show notification
    showPetTitleUnlockNotification(petId, title, reason);
    
    console.log('🏷️✨ Pet title unlocked:', title.display_name, 'for pet', petId);
    
  } catch (err) {
    console.error('[Pet Title] Error awarding title:', err);
  }
}

// Show pet title unlock notification
function showPetTitleUnlockNotification(petId, title, reason) {
  var rarityColors = {
    'common': '#8e8e8e',
    'uncommon': '#5cb85c',
    'rare': '#5bc0de',
    'epic': '#9c27b0',
    'legendary': '#ff9800'
  };
  
  var color = rarityColors[title.rarity] || '#8e8e8e';
  var pet = petState[petId];
  var petName = pet ? pet.nickname : 'Your pet';
  
  // Show toast notification
  showToast(petName + ' earned: ' + title.icon + ' ' + title.display_name + '!', 5000, color);
  
  // Optional: Show fancy modal
  // You could reuse the exploration modal or create a dedicated one
}

// Set active title for pet
async function setPetActiveTitle(petId, petTitleId) {
  if (!petId) return;
  
  try {
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ active_pet_title_id: petTitleId })
      .eq('id', petId);
    
    if (updateRes.error) {
      console.error('[Pet Title] Error setting active title:', updateRes.error);
      showToast('Failed to equip pet title', 3000, 'var(--red)');
      return;
    }
    
    // Update local cache
    if (petState[petId]) {
      petState[petId].active_pet_title_id = petTitleId;
    }
    
    if (petTitleId) {
      var title = allPetTitles.find(function(t) { return t.id === petTitleId; });
      showToast('✅ Title equipped: ' + title.display_name, 3000, 'var(--green)');
    } else {
      showToast('Pet title removed', 3000, 'var(--text-light)');
    }
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    if (currentTab === 'mypets') {
      showTab('mypets');
    }
    
  } catch (err) {
    console.error('[Pet Title] Error setting active title:', err);
  }
}

// Get pet title display text (for showing on pet cards)
function getPetTitleDisplay(petId) {
  var pet = petState[petId];
  if (!pet || !pet.active_pet_title_id) return '';
  
  var title = allPetTitles.find(function(t) { return t.id === pet.active_pet_title_id; });
  if (!title) return '';
  
  var rarityColors = {
    'common': '#8e8e8e',
    'uncommon': '#5cb85c',
    'rare': '#5bc0de',
    'epic': '#9c27b0',
    'legendary': '#ff9800'
  };
  
  var color = rarityColors[title.rarity] || '#8e8e8e';
  
  return '<div class="pet-title-badge" style="color: ' + color + ';">' +
    title.icon + ' ' + title.display_name +
    '</div>';
}

// ═══════════════════════════════════════════════════════════════════════
// PET VARIANT SYSTEM
// ═══════════════════════════════════════════════════════════════════════

// Variant types and their unlock levels
var petVariants = {
  // Level-based variants (existing)
  golden: { level: 5, chance: 0.15, name: 'Golden', icon: '✨', color: '#FFD700', unlockType: 'level' },
  shiny: { level: 10, chance: 0.15, name: 'Shiny', icon: '💎', color: '#00CED1', unlockType: 'level' },
  rainbow: { level: 15, chance: 0.15, name: 'Rainbow', icon: '🌈', color: '#FF69B4', unlockType: 'level' },
  cosmic: { level: 20, chance: 0.15, name: 'Cosmic', icon: '🌌', color: '#9370DB', unlockType: 'level' },
  
  // STREAM REWARD VARIANTS - CSS effects only, add custom sprites later!
  // These are unlocked via Twitch channel point redemptions
  shadow: { 
    unlockType: 'twitch_reward', 
    rewardId: 'shadow_variant', 
    name: 'Shadow', 
    icon: '🌑', 
    color: '#4a4a4a',
    description: 'Mysterious dark variant',
    cssEffect: 'shadow' // Pure CSS styling
  },
  fire: { 
    unlockType: 'twitch_reward', 
    rewardId: 'fire_variant', 
    name: 'Fire', 
    icon: '🔥', 
    color: '#ff4400',
    description: 'Blazing hot variant',
    cssEffect: 'fire'
  },
  ice: { 
    unlockType: 'twitch_reward', 
    rewardId: 'ice_variant', 
    name: 'Ice', 
    icon: '❄️', 
    color: '#88ddff',
    description: 'Frosty cool variant',
    cssEffect: 'ice'
  },
  spirit: { 
    unlockType: 'twitch_reward', 
    rewardId: 'spirit_variant', 
    name: 'Spirit', 
    icon: '👻', 
    color: '#ccaaff',
    description: 'Ghostly ethereal variant',
    cssEffect: 'spirit'
  },
  crystal: { 
    unlockType: 'twitch_reward', 
    rewardId: 'crystal_variant', 
    name: 'Crystal', 
    icon: '💠', 
    color: '#00ffff',
    description: 'Crystalline variant',
    cssEffect: 'crystal'
  }
};

// Get variant badge HTML
function getPetVariantBadge(variant) {
  if (!variant) return '';
  
  var variantData = petVariants[variant];
  if (!variantData) return '';
  
  return '<div class="pet-variant-badge" style="background: ' + variantData.color + '20; border: 2px solid ' + variantData.color + '; color: ' + variantData.color + '; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 0.85rem; display: inline-block;">' +
    variantData.icon + ' ' + variantData.name +
    '</div>';
}

// Get variant CSS class
function getPetVariantClass(variant) {
  if (!variant) return '';
  return 'pet-variant-' + variant;
}

// Check for variant unlock at milestone levels
async function checkVariantUnlock(petId, level) {
  if (!petId) return;
  
  var pet = petState[petId];
  if (!pet) return;
  
  // If pet already has a variant, don't unlock another one
  if (pet.variant) {
    console.log('[Variant] Pet already has variant:', pet.variant);
    return;
  }
  
  // Check if this level unlocks a variant
  var variantToUnlock = null;
  
  if (level === 5 && Math.random() < 0.15) {
    variantToUnlock = 'golden';
  } else if (level === 10 && Math.random() < 0.15) {
    variantToUnlock = 'shiny';
  } else if (level === 15 && Math.random() < 0.15) {
    variantToUnlock = 'rainbow';
  } else if (level === 20 && Math.random() < 0.15) {
    variantToUnlock = 'cosmic';
  }
  
  if (!variantToUnlock) {
    console.log('[Variant] No variant unlocked at level', level);
    return;
  }
  
  try {
    // Update pet with variant
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ 
        variant: variantToUnlock,
        variant_unlocked_at_level: level
      })
      .eq('id', petId);
    
    if (updateRes.error) {
      console.error('[Variant] Error unlocking variant:', updateRes.error);
      return;
    }
    
    // Update local state
    petState[petId].variant = variantToUnlock;
    petState[petId].variant_unlocked_at_level = level;
    
    // Show notification
    var variantData = petVariants[variantToUnlock];
    showToast('✨ <strong>Variant Unlocked!</strong><br>' +
      escapeHtml(pet.nickname) + ' became <span style="color: ' + variantData.color + ';">' + 
      variantData.icon + ' ' + variantData.name + '</span>!',
      6000, variantData.color);
    
    console.log('✨ Variant unlocked:', variantToUnlock, 'for pet', petId);
    
    // Award variant badge
    await awardBadge('variant_unlock');
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    
  } catch (err) {
    console.error('[Variant] Error unlocking variant:', err);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// STREAM REWARD VARIANT UNLOCKS - Via Twitch Channel Points
// ══════════════════════════════════════════════════════════════════════════

// Unlock variant via Twitch reward redemption
async function unlockTwitchVariant(petId, variantKey, rewardInfo) {
  if (!currentUser) {
    showToast('Please log in to unlock variants!');
    return false;
  }
  
  var pet = petState[petId];
  if (!pet) {
    console.error('[TwitchVariant] Pet not found:', petId);
    return false;
  }
  
  // Check if variant exists
  var variantData = petVariants[variantKey];
  if (!variantData || variantData.unlockType !== 'twitch_reward') {
    console.error('[TwitchVariant] Invalid variant:', variantKey);
    return false;
  }
  
  // Check if pet already has this variant
  if (pet.variant === variantKey) {
    showToast('🐾 ' + escapeHtml(pet.nickname) + ' already has the ' + variantData.name + ' variant!');
    return false;
  }
  
  try {
    // Update pet with new variant
    var updateRes = await supabaseClient
      .from('user_pets')
      .update({ 
        variant: variantKey,
        variant_unlocked_at_level: pet.level,
        variant_unlock_source: 'twitch_reward'
      })
      .eq('id', petId)
      .eq('user_id', currentUser.id); // Security check
    
    if (updateRes.error) {
      console.error('[TwitchVariant] Error unlocking variant:', updateRes.error);
      showToast('Failed to unlock variant. Please try again!');
      return false;
    }
    
    // Update local state
    petState[petId].variant = variantKey;
    petState[petId].variant_unlocked_at_level = pet.level;
    
    // Show fancy unlock notification
    showVariantUnlockNotification(pet.nickname, variantData);
    
    // Award badge for first Twitch variant unlock
    await awardBadge('twitch_variant_unlock');
    
    // Log to activity feed
    if (typeof logActivity === 'function') {
      await logActivity('unlocked ' + variantData.icon + ' ' + variantData.name + ' variant for ' + pet.nickname);
    }
    
    // Reload pet display
    tabsLoaded['mypets'] = false;
    
    console.log('✨ Twitch variant unlocked:', variantKey, 'for pet', petId);
    return true;
    
  } catch (err) {
    console.error('[TwitchVariant] Error:', err);
    showToast('Something went wrong. Please try again!');
    return false;
  }
}

// Show fancy variant unlock notification
function showVariantUnlockNotification(petNickname, variantData) {
  var notification = document.createElement('div');
  notification.className = 'variant-unlock-notification';
  notification.innerHTML = 
    '<h2>' + variantData.icon + ' Variant Unlocked!</h2>' +
    '<p><strong>' + escapeHtml(petNickname) + '</strong> is now</p>' +
    '<p style="font-size:1.5rem;color:' + variantData.color + ';font-weight:bold;">' +
    variantData.icon + ' ' + variantData.name + '</p>' +
    '<p style="font-size:0.9rem;margin-top:10px;">' + variantData.description + '</p>';
  
  document.body.appendChild(notification);
  
  // Remove after 4 seconds
  setTimeout(function() {
    notification.style.animation = 'variantUnlockPop 0.3s ease reverse';
    setTimeout(function() {
      document.body.removeChild(notification);
    }, 300);
  }, 4000);
}

// Check for pending Twitch reward redemptions
// This would be called periodically or when user visits the site
async function checkTwitchRewardRedemptions() {
  if (!currentUser) return;
  
  // In a real implementation, this would:
  // 1. Check your backend for pending Twitch EventSub notifications
  // 2. Process any variant unlock rewards
  // 3. Mark them as processed
  
  // Example structure:
  // var { data: redemptions, error } = await supabaseClient
  //   .from('twitch_reward_queue')
  //   .select('*')
  //   .eq('user_id', currentUser.id)
  //   .eq('processed', false)
  //   .eq('reward_type', 'variant_unlock');
  //
  // if (redemptions && redemptions.length > 0) {
  //   for (var i = 0; i < redemptions.length; i++) {
  //     var redemption = redemptions[i];
  //     await unlockTwitchVariant(
  //       redemption.pet_id, 
  //       redemption.variant_key,
  //       redemption
  //     );
  //     // Mark as processed
  //     await supabaseClient
  //       .from('twitch_reward_queue')
  //       .update({ processed: true })
  //       .eq('id', redemption.id);
  //   }
  // }
  
  console.log('[TwitchVariant] Checked for pending redemptions');
}

// Get list of available stream reward variants for a pet
function getAvailableTwitchVariants(petType) {
  var available = [];
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'twitch_reward') {
      available.push({
        key: key,
        name: variant.name,
        icon: variant.icon,
        color: variant.color,
        description: variant.description
      });
    }
  }
  
  return available;
}

// Show variant gallery modal
function showVariantGallery() {
  var modal = makeModal();
  var content = makeEl('div');
  
  // Title
  var title = makeEl('h2');
  title.textContent = '✨ Pet Variant Gallery';
  title.style.cssText = 'text-align:center;color:var(--purple);margin-bottom:20px;';
  content.appendChild(title);
  
  // Description
  var desc = makeEl('p');
  desc.textContent = 'Unlock special variants through leveling up or Twitch channel point rewards!';
  desc.style.cssText = 'text-align:center;color:var(--text-light);margin-bottom:30px;';
  content.appendChild(desc);
  
  // Level-based variants section
  var levelSection = makeEl('div');
  levelSection.innerHTML = '<h3 style="color:var(--purple);margin-bottom:15px;">🎯 Level Milestones</h3>';
  
  var levelGrid = makeEl('div');
  levelGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:30px;';
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'level') {
      var card = makeEl('div');
      card.style.cssText = 'background:' + variant.color + '20;border:2px solid ' + variant.color + ';border-radius:12px;padding:15px;text-align:center;';
      card.innerHTML = 
        '<div style="font-size:2rem;margin-bottom:8px;">' + variant.icon + '</div>' +
        '<div style="font-weight:bold;color:' + variant.color + ';margin-bottom:5px;">' + variant.name + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-light);">Unlock at Level ' + variant.level + '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-light);margin-top:5px;">' + (variant.chance * 100) + '% chance</div>';
      levelGrid.appendChild(card);
    }
  }
  
  levelSection.appendChild(levelGrid);
  content.appendChild(levelSection);
  
  // Twitch reward variants section
  var twitchSection = makeEl('div');
  twitchSection.innerHTML = '<h3 style="color:var(--purple);margin-bottom:15px;">📺 Twitch Rewards</h3>' +
    '<p style="font-size:0.9rem;color:var(--text-light);margin-bottom:15px;">Unlock these exclusive variants with Twitch channel points on our streams!</p>';
  
  var twitchGrid = makeEl('div');
  twitchGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:15px;';
  
  for (var key in petVariants) {
    var variant = petVariants[key];
    if (variant.unlockType === 'twitch_reward') {
      var card = makeEl('div');
      card.style.cssText = 'background:' + variant.color + '20;border:3px solid ' + variant.color + ';border-radius:12px;padding:15px;text-align:center;position:relative;';
      
      // Special styling preview (CSS-only, no AI art)
      var preview = makeEl('div');
      preview.style.cssText = 'width:80px;height:80px;margin:0 auto 10px;background:' + variant.color + '40;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;';
      preview.textContent = variant.icon;
      
      // Apply CSS effect preview
      if (variant.cssEffect) {
        preview.className = 'pet-variant-' + variant.cssEffect;
      }
      
      card.appendChild(preview);
      card.innerHTML += 
        '<div style="font-weight:bold;color:' + variant.color + ';margin-bottom:5px;font-size:1.1rem;">' + variant.name + '</div>' +
        '<div style="font-size:0.85rem;color:var(--text-light);line-height:1.4;">' + variant.description + '</div>' +
        '<div style="margin-top:10px;padding:8px;background:var(--purple-light);border-radius:8px;font-size:0.75rem;color:var(--purple-dark);font-weight:600;">🎬 Redeem on Stream</div>';
      
      twitchGrid.appendChild(card);
    }
  }
  
  twitchSection.appendChild(twitchGrid);
  content.appendChild(twitchSection);
  
  // Note about custom sprites
  var note = makeEl('div');
  note.style.cssText = 'margin-top:30px;padding:15px;background:rgba(153,102,255,0.1);border-radius:12px;text-align:center;';
  note.innerHTML = '<p style="font-size:0.85rem;color:var(--text-light);"><strong>Note:</strong> Variants currently use CSS effects. Custom sprites coming soon!</p>';
  content.appendChild(note);
  
  // Close button
  var closeBtn = makeEl('button', {class: 'btn btn-primary'});
  closeBtn.textContent = 'Close';
  closeBtn.style.cssText = 'display:block;margin:20px auto 0;';
  closeBtn.onclick = function() { closeModal(); };
  content.appendChild(closeBtn);
  
  modal.appendChild(content);
  openModal(modal);
}

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE SYSTEM (Account-Wide Titles)
// ═══════════════════════════════════════════════════════════════════════

var allPlayerTitles = [];
var playerTitlesCache = []; // Titles unlocked by current user
var activePlayerTitle = null; // Currently equipped title

// Load all available player titles from database
async function loadAllPlayerTitles() {
  try {
    var res = await supabaseClient
      .from('player_titles')
      .select('*')
      .order('rarity', { ascending: false });
    
    if (res.data) {
      allPlayerTitles = res.data;
      console.log('👑 Player titles loaded:', allPlayerTitles.length, 'available');
    }
  } catch (err) {
    console.error('[Player Titles] Error loading titles:', err);
  }
}

// Load titles unlocked by current user
async function loadPlayerTitles() {
  if (!currentUser) return [];
  
  try {
    var res = await supabaseClient
      .from('user_player_titles')
      .select('player_title_id, player_titles(*)')
      .eq('user_id', currentUser.id);
    
    if (res.data) {
      playerTitlesCache = res.data.map(function(upt) { return upt.player_titles; });
      console.log('👑 User player titles loaded:', playerTitlesCache.length, 'unlocked');
      return playerTitlesCache;
    }
    
    return [];
  } catch (err) {
    console.error('[Player Titles] Error loading user titles:', err);
    return [];
  }
}

// Load active player title for current user
async function loadActivePlayerTitle() {
  if (!currentUser) return null;
  
  try {
    var res = await supabaseClient
      .from('players')
      .select('active_player_title_id, player_titles(*)')
      .eq('id', currentUser.id)
      .single();
    
    if (res.data && res.data.active_player_title_id) {
      activePlayerTitle = res.data.player_titles;
      console.log('👑 Active player title:', activePlayerTitle?.display_name || 'None');
      return activePlayerTitle;
    }
    
    activePlayerTitle = null;
    return null;
  } catch (err) {
    console.error('[Player Titles] Error loading active title:', err);
    return null;
  }
}

// Check if player has specific title
function hasPlayerTitle(titleKey) {
  return playerTitlesCache.some(function(t) { return t.title_key === titleKey; });
}

// Award title to player
async function awardPlayerTitle(titleKey, reason) {
  if (!titleKey || !currentUser) return;
  
  // Check if already has this title
  if (hasPlayerTitle(titleKey)) {
    console.log('[Player Title] Already unlocked:', titleKey);
    return;
  }
  
  try {
    // Get title info
    var titleRes = await supabaseClient
      .from('player_titles')
      .select('*')
      .eq('title_key', titleKey)
      .single();
    
    if (titleRes.error || !titleRes.data) {
      console.error('[Player Title] Title not found:', titleKey);
      return;
    }
    
    var title = titleRes.data;
    
    // Insert into user_player_titles
    var insertRes = await supabaseClient
      .from('user_player_titles')
      .insert([{
        user_id: currentUser.id,
        player_title_id: title.id,
        unlock_reason: reason || 'Achievement unlocked'
      }]);
    
    if (insertRes.error) {
      console.error('[Player Title] Error awarding title:', insertRes.error);
      return;
    }
    
    // Add to local cache
    playerTitlesCache.push(title);
    
    // Show notification
    showPlayerTitleUnlockNotification(title, reason);
    
    console.log('👑✨ Player title unlocked:', title.display_name);
    
  } catch (err) {
    console.error('[Player Title] Error awarding title:', err);
  }
}

// Set active player title
async function setActivePlayerTitle(playerTitleId) {
  if (!currentUser) return;
  
  try {
    var updateRes = await supabaseClient
      .from('players')
      .update({ active_player_title_id: playerTitleId })
      .eq('id', currentUser.id);
    
    if (updateRes.error) {
      console.error('[Player Title] Error setting active title:', updateRes.error);
      showToast('Failed to equip title', 3000, 'var(--red)');
      return;
    }
    
    // Update local cache
    if (playerTitleId) {
      activePlayerTitle = allPlayerTitles.find(function(t) { return t.id === playerTitleId; });
      showToast('✅ Title equipped: ' + activePlayerTitle.display_name, 3000, 'var(--green)');
    } else {
      activePlayerTitle = null;
      showToast('Title removed', 3000, 'var(--text-light)');
    }
    
    // Reload profile if on that tab
    if (currentTab === 'myprofile') {
      showTab('myprofile');
    }
    
  } catch (err) {
    console.error('[Player Title] Error setting active title:', err);
  }
}

// Get player title display text
function getPlayerTitleDisplay(userId) {
  // This will be used for public profiles
  // For now, return active title if it's current user
  if (userId === currentUser?.id && activePlayerTitle) {
    var rarityColors = {
      'Common': '#8e8e8e',
      'Uncommon': '#5cb85c',
      'Rare': '#5bc0de',
      'Epic': '#9c27b0',
      'Legendary': '#ff9800'
    };
    
    var color = activePlayerTitle.color || rarityColors[activePlayerTitle.rarity] || '#8e8e8e';
    
    return '<div class="player-title-badge" style="color: ' + color + '; font-size: 1.1rem; margin-top: 8px; font-weight: 600;">' +
      activePlayerTitle.icon + ' ' + activePlayerTitle.display_name +
      '</div>';
  }
  
  return '';
}

// Show title unlock notification
function showPlayerTitleUnlockNotification(title, reason) {
  var rarityColors = {
    'Common': '#8e8e8e',
    'Uncommon': '#5cb85c',
    'Rare': '#5bc0de',
    'Epic': '#9c27b0',
    'Legendary': '#ff9800'
  };
  
  var color = title.color || rarityColors[title.rarity] || '#8e8e8e';
  
  var message = '🎉 <strong>Player Title Unlocked!</strong><br>' +
    '<span style="color: ' + color + '; font-size: 1.2rem;">' +
    title.icon + ' ' + title.display_name + '</span><br>' +
    '<small>' + (reason || title.unlock_condition) + '</small>';
  
  showToast(message, 6000, color);
}

// Check and award player titles based on achievements
async function checkPlayerTitleUnlocks() {
  if (!currentUser) return;
  
  try {
    // Get player stats
    var playerRes = await supabaseClient
      .from('players')
      .select('pawketpoints, created_at')
      .eq('id', currentUser.id)
      .single();
    
    if (!playerRes.data) return;
    
    var player = playerRes.data;
    
    // Get pet count
    var petsRes = await supabaseClient
      .from('user_pets')
      .select('id')
      .eq('user_id', currentUser.id);
    
    var petCount = petsRes.data?.length || 0;
    
    // Get total levels
    var totalLevelRes = await supabaseClient
      .from('user_pets')
      .select('level')
      .eq('user_id', currentUser.id);
    
    var totalLevel = 0;
    if (totalLevelRes.data) {
      totalLevelRes.data.forEach(function(pet) {
        totalLevel += pet.level || 1;
      });
    }
    
    // Get badge count
    var badgesRes = await supabaseClient
      .from('user_badges')
      .select('id')
      .eq('user_id', currentUser.id);
    
    var badgeCount = badgesRes.data?.length || 0;
    
    // Check title unlocks
    
    // Newcomer (automatic on join)
    if (!hasPlayerTitle('newcomer')) {
      await awardPlayerTitle('newcomer', 'Joined PawketPets VT');
    }
    
    // Point-based titles
    if (player.pawketpoints >= 10000 && !hasPlayerTitle('point_hoarder')) {
      await awardPlayerTitle('point_hoarder', 'Earned 10,000 PP total');
    }
    if (player.pawketpoints >= 50000 && !hasPlayerTitle('whale')) {
      await awardPlayerTitle('whale', 'Earned 50,000 PP total');
    }
    if (player.pawketpoints >= 1000000 && !hasPlayerTitle('millionaire')) {
      await awardPlayerTitle('millionaire', 'Earned 1,000,000 PP total');
    }
    
    // Pet collection titles
    if (petCount >= 3 && !hasPlayerTitle('pet_lover')) {
      await awardPlayerTitle('pet_lover', 'Own 3 pets');
    }
    if (petCount >= 10 && !hasPlayerTitle('collector')) {
      await awardPlayerTitle('collector', 'Own 10 pets');
    }
    if (petCount >= 25 && !hasPlayerTitle('hoarder')) {
      await awardPlayerTitle('hoarder', 'Own 25 pets');
    }
    
    // Level titles
    if (totalLevel >= 100 && !hasPlayerTitle('trainer')) {
      await awardPlayerTitle('trainer', 'Total pet levels reached 100');
    }
    if (totalLevel >= 500 && !hasPlayerTitle('master_trainer')) {
      await awardPlayerTitle('master_trainer', 'Total pet levels reached 500');
    }
    
    // Badge titles
    if (badgeCount >= 10 && !hasPlayerTitle('badge_collector')) {
      await awardPlayerTitle('badge_collector', 'Earned 10 badges');
    }
    if (badgeCount >= 25 && !hasPlayerTitle('badge_master')) {
      await awardPlayerTitle('badge_master', 'Earned 25 badges');
    }
    
  } catch (err) {
    console.error('[Player Titles] Error checking unlocks:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PET TITLE UNLOCK TRACKING
// ═══════════════════════════════════════════════════════════════════════

// Check pet title unlocks after various actions
// ═══════════════════════════════════════════════════════════════════════
// REFINED TITLE UNLOCK TRACKING
// Unique, memorable conditions - no boring stat grinding
// ═══════════════════════════════════════════════════════════════════════

// Track special conditions
var titleTracking = {
  consecutiveMisses: {},     // pet_id: count
  consecutiveLosses: {},     // user_id: count
  sameFood: {},             // pet_id: { food_item: count }
  buttonClicks: {},         // user_id: { button_id: count }
  midnightLogins: []        // timestamps of 3am logins
};

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE UNLOCKS - NOT YET IMPLEMENTED
// Uncomment when player title system (loadTitles, hasTitle, awardTitle) is added
// ═══════════════════════════════════════════════════════════════════════

/*
async function checkPlayerTitleUnlocks() {
  if (!currentUser) return;
  
  try {
    var stats = await supabaseClient
      .from('players')
      .select('*, battle_history(*)')
      .eq('id', currentUser.id)
      .single();
    
    if (!stats.data) return;
    var p = stats.data;
    
    // Spoon Warlord - Win 100 battles
    var totalWins = p.battle_history?.filter(b => b.victory).length || 0;
    if (totalWins >= 100 && !hasTitle('spoon_warlord')) {
      await awardTitle('spoon_warlord');
    }
    
    // Local Menace - Win 50 battles
    if (totalWins >= 50 && !hasTitle('local_menace')) {
      await awardTitle('local_menace');
    }
    
    // Golden Legend - Defeat 5 Golden enemies
    var goldenKills = p.battle_history?.filter(b => 
      b.victory && b.enemy_special_variant === 'golden'
    ).length || 0;
    if (goldenKills >= 5 && !hasTitle('golden_legend')) {
      await awardTitle('golden_legend');
    }
    
    // Shiny Hunter - Defeat 10 Shiny enemies
    var shinyKills = p.battle_history?.filter(b => 
      b.victory && b.enemy_special_variant === 'shiny'
    ).length || 0;
    if (shinyKills >= 10 && !hasTitle('shiny_hunter')) {
      await awardTitle('shiny_hunter');
    }
    
    // Corrupted Soul - Defeat 20 Corrupted enemies
    var corruptedKills = p.battle_history?.filter(b => 
      b.victory && b.enemy_special_variant === 'corrupted'
    ).length || 0;
    if (corruptedKills >= 20 && !hasTitle('corrupted_soul')) {
      await awardTitle('corrupted_soul');
    }
    
    // Bug Catcher - Defeat 15 Glitched enemies
    var glitchedKills = p.battle_history?.filter(b => 
      b.victory && b.enemy_special_variant === 'glitched'
    ).length || 0;
    if (glitchedKills >= 15 && !hasTitle('bug_catcher')) {
      await awardTitle('bug_catcher');
    }
    
    // Elemental Master - Defeat all 5 elemental types
    var elementalTypes = new Set();
    p.battle_history?.forEach(b => {
      if (b.victory && b.enemy_elemental_type) {
        elementalTypes.add(b.enemy_elemental_type);
      }
    });
    if (elementalTypes.size >= 5 && !hasTitle('elemental_master')) {
      await awardTitle('elemental_master');
    }
    
    // PP Addict - Earn 5,000 PP total
    if ((p.total_pp_earned || 0) >= 5000 && !hasTitle('pp_addict')) {
      await awardTitle('pp_addict');
    }
    
    // Creature Collector - Own all available pets
    var totalPets = await supabaseClient
      .from('pets')
      .select('id', { count: 'exact' });
    
    var ownedPets = await supabaseClient
      .from('user_pets')
      .select('pet_id', { count: 'exact' })
      .eq('user_id', currentUser.id);
    
    if (ownedPets.count >= totalPets.count && !hasTitle('creature_collector')) {
      await awardTitle('creature_collector');
    }
    
    // Forest Cryptid - Defeat 30 Deep Woods enemies
    var deepWoodsKills = p.battle_history?.filter(b => 
      b.victory && b.zone === 'deepwoods'
    ).length || 0;
    if (deepWoodsKills >= 30 && !hasTitle('forest_cryptid')) {
      await awardTitle('forest_cryptid');
    }
    
    // Dungeon Janitor - Defeat 100 total enemies
    var totalKills = p.battle_history?.filter(b => b.victory).length || 0;
    if (totalKills >= 100 && !hasTitle('dungeon_janitor')) {
      await awardTitle('dungeon_janitor');
    }
    
    // Mythical Being - Reach total level 100 across all pets
    var allPets = await supabaseClient
      .from('user_pets')
      .select('level')
      .eq('user_id', currentUser.id);
    
    var totalLevel = allPets.data?.reduce((sum, p) => sum + p.level, 0) || 0;
    if (totalLevel >= 100 && !hasTitle('mythical_being')) {
      await awardTitle('mythical_being');
    }
    
  } catch (err) {
    console.error('[Titles] Error checking player unlocks:', err);
  }
}
*/

// ═══════════════════════════════════════════════════════════════════════
// PET TITLE UNLOCKS - With Unique Conditions
// ═══════════════════════════════════════════════════════════════════════

async function checkPetTitleUnlocks(petId, context) {
  if (!petId || !currentUser) return;
  
  try {
    var pet = petState[petId];
    if (!pet) return;
    
    // Get battle history for this specific pet
    var battles = await supabaseClient
      .from('battle_history')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('pet_id', petId);
    
    if (!battles.data) return;
    var b = battles.data;
    
    // the Champion - Win 100 battles
    var wins = b.filter(x => x.victory).length;
    if (wins >= 100 && !petHasTitle(petId, 'the_champion')) {
      await awardPetTitle(petId, 'the_champion', 'Won 100 battles');
    }
    
    // the Gremlin - Win 20 battles
    if (wins >= 20 && !petHasTitle(petId, 'the_gremlin')) {
      await awardPetTitle(petId, 'the_gremlin', 'Won 20 battles');
    }
    
    // Boss Slayer - Defeat any boss
    var bossKills = b.filter(x => x.victory && x.is_boss).length;
    if (bossKills >= 1 && !petHasTitle(petId, 'boss_slayer')) {
      await awardPetTitle(petId, 'boss_slayer', 'Defeated a boss');
    }
    
    // Dragon Slayer - Defeat Dragon boss
    var dragonKills = b.filter(x => 
      x.victory && x.is_boss && x.enemy_name?.toLowerCase().includes('dragon')
    ).length;
    if (dragonKills >= 1 && !petHasTitle(petId, 'dragon_slayer')) {
      await awardPetTitle(petId, 'dragon_slayer', 'Defeated the Dragon');
    }
    
    // the Survivor - Win with less than 5% HP
    var survivorWins = b.filter(x => 
      x.victory && x.final_hp <= (x.max_hp * 0.05)
    ).length;
    if (survivorWins >= 1 && !petHasTitle(petId, 'the_survivor')) {
      await awardPetTitle(petId, 'the_survivor', 'Won with < 5% HP');
    }
    
    // the Cursed - Lose 5 battles in a row
    if (context === 'battle_end' && !petHasTitle(petId, 'the_cursed')) {
      checkConsecutiveLosses(petId, battles.data);
    }
    
    // the Unlucky - Miss 15 attacks in a row
    if (context === 'attack_missed' && !petHasTitle(petId, 'the_unlucky')) {
      incrementConsecutiveMisses(petId);
    }
    
    // the Menace - Deal 200 damage in one hit
    var bigHits = b.filter(x => x.max_damage_dealt >= 200).length;
    if (bigHits >= 1 && !petHasTitle(petId, 'the_menace')) {
      await awardPetTitle(petId, 'the_menace', 'Dealt 200+ damage');
    }
    
    // the Feral - Win 10 battles with energy below 10
    var feralWins = b.filter(x => x.victory && x.pet_energy_at_start <= 10).length;
    if (feralWins >= 10 && !petHasTitle(petId, 'the_feral')) {
      await awardPetTitle(petId, 'the_feral', 'Won while exhausted');
    }
    
    // Speedster - Win in under 3 turns
    var speedWins = b.filter(x => x.victory && x.turns <= 3).length;
    if (speedWins >= 1 && !petHasTitle(petId, 'speedster')) {
      await awardPetTitle(petId, 'speedster', 'Won in under 3 turns');
    }
    
    // the Tiny - Win a battle while level 5 or below
    var tinyWins = b.filter(x => x.victory && x.pet_level <= 5).length;
    if (tinyWins >= 1 && !petHasTitle(petId, 'the_tiny')) {
      await awardPetTitle(petId, 'the_tiny', 'Won while tiny');
    }
    
    // Stat-based titles
    if (pet.energy === 0 && !petHasTitle(petId, 'the_lazy')) {
      await awardPetTitle(petId, 'the_lazy', 'Fell asleep');
    }
    
    if (pet.hunger === 0 && !petHasTitle(petId, 'the_hungry')) {
      await awardPetTitle(petId, 'the_hungry', 'Starving!');
    }
    
    if (pet.happiness >= 90 && !petHasTitle(petId, 'the_happy')) {
      await awardPetTitle(petId, 'the_happy', 'Pure joy!');
    }
    
    if (pet.happiness <= 20 && !petHasTitle(petId, 'the_grumpy')) {
      await awardPetTitle(petId, 'the_grumpy', 'Permanently grumpy');
    }
    
    // the Fallen - Faint once
    var deaths = b.filter(x => !x.victory).length;
    if (deaths >= 1 && !petHasTitle(petId, 'the_fallen')) {
      await awardPetTitle(petId, 'the_fallen', 'Fainted in battle');
    }
    
    // Variant titles
    if (pet.variant === 'golden' && !petHasTitle(petId, 'the_golden')) {
      await awardPetTitle(petId, 'the_golden', 'Became Golden');
    }
    
    if ((pet.variant === 'corrupted' || pet.variant === 'glitched') && !petHasTitle(petId, 'the_ominous')) {
      await awardPetTitle(petId, 'the_ominous', 'Something isn\'t right...');
    }
    
    // Level titles
    if (pet.level >= 50 && !petHasTitle(petId, 'the_ancient')) {
      await awardPetTitle(petId, 'the_ancient', 'Reached level 50');
    }
    
    // the Spoiled - Fed 50 times
    if (pet.times_fed >= 50 && !petHasTitle(petId, 'the_spoiled')) {
      await awardPetTitle(petId, 'the_spoiled', 'Fed 50 times');
    }
    
    // the Beloved - Fed 20 times (starting title basically)
    if (pet.times_fed >= 20 && !petHasTitle(petId, 'the_beloved')) {
      await awardPetTitle(petId, 'the_beloved', 'Fed 20 times');
    }
    
    // the Sleepy - Energy hit 0 ten times
    if (pet.times_energy_zero >= 10 && !petHasTitle(petId, 'the_sleepy')) {
      await awardPetTitle(petId, 'the_sleepy', 'Fell asleep 10 times');
    }
    
  } catch (err) {
    console.error('[Pet Titles] Error checking unlocks:', err);
  }
}

// Helper: Track consecutive misses
function incrementConsecutiveMisses(petId) {
  if (!titleTracking.consecutiveMisses[petId]) {
    titleTracking.consecutiveMisses[petId] = 0;
  }
  titleTracking.consecutiveMisses[petId]++;
  
  if (titleTracking.consecutiveMisses[petId] >= 15) {
    awardPetTitle(petId, 'the_unlucky', 'Missed 15 attacks in a row');
    titleTracking.consecutiveMisses[petId] = 0; // Reset
  }
}

// Helper: Reset miss counter on successful hit
function resetConsecutiveMisses(petId) {
  titleTracking.consecutiveMisses[petId] = 0;
}

// Helper: Check consecutive losses
async function checkConsecutiveLosses(petId, allBattles) {
  // Get last 5 battles
  var recent = allBattles.slice(-5);
  var allLosses = recent.every(b => !b.victory) && recent.length >= 5;
  
  if (allLosses) {
    await awardPetTitle(petId, 'the_cursed', 'Lost 5 battles in a row');
  }
}

// Special: 3am login check (NOT YET IMPLEMENTED - needs player title system)
/*
function checkMidnightLogin() {
  var hour = new Date().getHours();
  if (hour === 3 && !hasTitle('sleep_deprived')) {
    awardTitle('sleep_deprived');
  }
}
*/

// Special: 3am battle check (call after battle victories)
async function checkMidnightBattle(petId, won) {
  var hour = new Date().getHours();
  if (hour === 3 && won && !petHasTitle(petId, 'the_cryptid')) {
    await awardPetTitle(petId, 'the_cryptid', 'Won a battle at 3am');
  }
}

// Check for boss defeat titles
async function checkBossTitles(petId, bossName) {
  if (!petId || !bossName) return;
  
  // Generic boss slayer
  if (!petHasTitle(petId, 'boss_slayer')) {
    await awardPetTitle(petId, 'boss_slayer', 'Defeated ' + bossName);
  }
  
  // Specific boss titles
  if (bossName.toLowerCase().includes('dragon') && !petHasTitle(petId, 'dragon_slayer')) {
    await awardPetTitle(petId, 'dragon_slayer', 'Defeated the Dragon');
  }
}

// Check for special combat titles (call after each battle)
async function checkCombatTitles(petId, battleData) {
  if (!petId || !battleData) return;
  
  // Speedster - won in under 3 turns
  if (battleData.victory && battleData.turns <= 3 && !petHasTitle(petId, 'speedster')) {
    await awardPetTitle(petId, 'speedster', 'Won in under 3 turns');
  }
  
  // Survivor - won with <5% HP
  if (battleData.victory && battleData.finalHP <= (battleData.maxHP * 0.05) && !petHasTitle(petId, 'the_survivor')) {
    await awardPetTitle(petId, 'the_survivor', 'Won with less than 5% HP');
  }
  
  // the Menace - dealt 200+ damage in one hit
  if (battleData.maxDamageDealt >= 200 && !petHasTitle(petId, 'the_menace')) {
    await awardPetTitle(petId, 'the_menace', 'Dealt 200+ damage in one hit');
  }
  
  // Check 3am battles
  await checkMidnightBattle(petId, battleData.victory);
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATION NOTES
// ═══════════════════════════════════════════════════════════════════════

/*
INTEGRATION CHECKLIST:

1. Call loadAllPetTitles() in init() function
2. Call loadPetTitles(petId) when loading pet data
3. Call checkPetTitleUnlocks(petId) after:
   - Battle ends
   - Level up
   - Equipment changes
   - Variant unlocks
   - Stats hit 0
4. Call checkBossTitles(petId, bossName) after boss victories
5. Call checkCombatTitles(petId, battleData) after each battle
6. Add title selection dropdown to My Pets page (see UI code below)
*/
// ═══════════════════════════════════════════════════════════════════════
// TITLE SELECTION UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// PLAYER TITLE SELECTOR (For Profile Page)
// ═══════════════════════════════════════════════════════════════════════

function renderPlayerTitleSelector(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;
  
  var html = '<div class="title-selector-section">';
  html += '  <h3 class="selector-title">👑 Your Account Title</h3>';
  html += '  <p class="selector-desc">This title displays on your profile and shows your account-wide achievements!</p>';
  html += '  <div class="title-dropdown-wrap">';
  html += '    <label for="player-title-select">Active Title:</label>';
  html += '    <select id="player-title-select" class="title-select" onchange="handlePlayerTitleChange(this)">';
  html += '      <option value="">No Title</option>';
  
  allPlayerTitles.forEach(function(title) {
    var unlocked = playerTitlesCache.some(function(t) { return t.id === title.id; });
    var isActive = activePlayerTitle && activePlayerTitle.id === title.id;
    
    if (unlocked) {
      html += '      <option value="' + title.id + '"' + (isActive ? ' selected' : '') + '>';
      html += title.icon + ' ' + title.display_name + ' (' + title.rarity + ')';
      html += '</option>';
    } else {
      html += '      <option value="" disabled>';
      html += '🔒 ??? - ' + title.unlock_condition;
      html += '</option>';
    }
  });
  
  html += '    </select>';
  html += '  </div>';
  html += '</div>';
  
  container.innerHTML = html;
}

async function handlePlayerTitleChange(selectElement) {
  var titleId = selectElement.value || null;
  await setActivePlayerTitle(titleId);
}

// ═══════════════════════════════════════════════════════════════════════
// PET TITLE SELECTOR (For Individual Pet Cards on My Pets Page)
// ═══════════════════════════════════════════════════════════════════════

function renderPetTitleSelector(petId) {
  var pet = petState[petId];
  if (!pet) return '';
  
  var petTitles = petTitlesCache[petId] || [];
  
  var html = '<div class="pet-title-selector">';
  html += '  <label for="pet-title-select-' + petId + '">🏷️ Pet Title:</label>';
  html += '  <select id="pet-title-select-' + petId + '" class="pet-title-select" onchange="handlePetTitleChange(\'' + petId + '\', this)">';
  html += '    <option value="">No Title</option>';
  
  allPetTitles.forEach(function(title) {
    var unlocked = petTitles.some(function(t) { return t.id === title.id; });
    var isActive = pet.active_pet_title_id === title.id;
    
    if (unlocked) {
      html += '    <option value="' + title.id + '"' + (isActive ? ' selected' : '') + '>';
      html += title.icon + ' ' + title.display_name + ' (' + title.rarity + ')';
      html += '</option>';
    } else {
      html += '    <option value="" disabled>';
      html += '🔒 ??? - ' + title.unlock_condition;
      html += '</option>';
    }
  });
  
  html += '  </select>';
  html += '</div>';
  
  return html;
}

async function handlePetTitleChange(petId, selectElement) {
  var titleId = selectElement.value || null;
  await setPetActiveTitle(petId, titleId);
}

// ═══════════════════════════════════════════════════════════════════════
// INTEGRATED PET CARD WITH TITLE SELECTOR
// ═══════════════════════════════════════════════════════════════════════

// Enhanced makeMyPetCard function with title selector
function makeMyPetCardWithTitles(pet) {
  var card = makeEl('div', {
    class: 'pet-card ' + getPetVariantClass(pet.variant),
    id: 'pet-card-' + pet.id
  });
  
  // Pet image with variant effect
  var imageWrap = makeEl('div', {class: 'pet-image-wrap ' + getPetVariantClass(pet.variant)});
  var img = makeEl('img', {
    src: 'images/pets/' + (pet.image_file || pet.pets?.image_file || 'placeholder.png'),
    alt: pet.nickname,
    onerror: "this.style.display='none';"
  });
  imageWrap.appendChild(img);
  card.appendChild(imageWrap);
  
  // Name row with variant badge
  var nameRow = makeEl('div', {class: 'pet-name-row'});
  var nameText = makeEl('div', {class: 'pet-name'}, pet.nickname);
  nameRow.appendChild(nameText);
  
  if (pet.variant) {
    var variantBadge = document.createElement('div');
    variantBadge.innerHTML = getPetVariantBadge(pet.variant);
    nameRow.appendChild(variantBadge);
  }
  card.appendChild(nameRow);
  
  // Level
  var level = makeEl('div', {class: 'pet-level'}, 'Level ' + pet.level);
  card.appendChild(level);
  
  // Pet title display (if active)
  if (pet.active_pet_title_id) {
    var titleDisplay = document.createElement('div');
    titleDisplay.innerHTML = getPetTitleDisplay(pet.id);
    card.appendChild(titleDisplay);
  }
  
  // Stats section (hunger, energy, happiness, HP, etc.)
  // ... your existing stats code ...
  
  // Title selector dropdown
  var titleSelectorDiv = makeEl('div', {id: 'pet-title-selector-' + pet.id, class: 'pet-title-selector-container'});
  card.appendChild(titleSelectorDiv);
  
  // Load and render title selector asynchronously
  loadPetTitles(pet.id).then(function() {
    titleSelectorDiv.innerHTML = renderPetTitleSelector(pet.id, 'pet-title-selector-' + pet.id);
  });
  
  // Action buttons (feed, play, etc.)
  // ... your existing action buttons ...
  
  return card;
}

// ═══════════════════════════════════════════════════════════════════════
// PROFILE PAGE TITLE DISPLAY
// ═══════════════════════════════════════════════════════════════════════

// Updated profile page to include title selector
async function loadProfileTabWithTitleSelector(userId) {
  var container = el('tab-profile');
  if (!container) return;
  
  if (!userId && currentUser) {
    userId = currentUser.id;
  }
  
  if (!userId) {
    container.innerHTML = '<div class="page-hero"><p>Please log in to view profiles.</p></div>';
    return;
  }
  
  var isOwnProfile = userId === currentUser.id;
  
  try {
    // Load player data
    var playerRes = await supabaseClient
      .from('players')
      .select('*, titles(*)')
      .eq('id', userId)
      .single();
    
    if (playerRes.error || !playerRes.data) {
      container.innerHTML = '<div class="page-hero"><p>Profile not found.</p></div>';
      return;
    }
    
    var player = playerRes.data;
    
    // Build profile HTML
    var html = '<div class="page-hero">';
    html += '  <div class="sparkle-row">👤 ✦ 👤</div>';
    html += '  <h1>' + escapeHtml(player.username) + '</h1>';
    
    // Show active title
    if (player.titles) {
      var rarityColors = {
        'common': '#8e8e8e',
        'uncommon': '#5cb85c',
        'rare': '#5bc0de',
        'epic': '#9c27b0',
        'legendary': '#ff9800'
      };
      var color = rarityColors[player.titles.rarity] || '#8e8e8e';
      html += '  <div class="user-title" style="color: ' + color + '; font-size: 1rem;">' +
        player.titles.icon + ' ' + player.titles.display_name +
        '</div>';
    }
    
    html += '</div>';
    
    // If viewing own profile, show title selector
    if (isOwnProfile) {
      html += '<div id="player-title-selector-container"></div>';
    }
    
    // ... rest of profile page (stats, pets, badges) ...
    
    container.innerHTML = html;
    
    // Render title selector if own profile
    if (isOwnProfile) {
      renderPlayerTitleSelector('player-title-selector-container');
    }
    
  } catch (err) {
    console.error('[Profile] Error loading profile:', err);
    container.innerHTML = '<div class="page-hero"><p>Error loading profile.</p></div>';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CSS FOR TITLE SELECTORS
// ═══════════════════════════════════════════════════════════════════════

var titleSelectorCSS = `
<style>
.title-selector-section {
  max-width: 600px;
  margin: 30px auto;
  padding: 25px;
  background: var(--white);
  border: 2.5px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 16px var(--shadow);
}

.selector-title {
  font-family: 'Fredoka One', cursive;
  font-size: 1.4rem;
  color: var(--purple-dark);
  margin-bottom: 10px;
  text-align: center;
}

.selector-desc {
  font-size: 0.9rem;
  color: var(--text-light);
  text-align: center;
  margin-bottom: 20px;
}

.title-dropdown-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.title-dropdown-wrap label {
  font-weight: bold;
  color: var(--text);
  font-size: 0.95rem;
}

.title-select,
.pet-title-select {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  font-family: inherit;
  background: var(--white);
  cursor: pointer;
  transition: border-color 0.2s;
}

.title-select:hover,
.pet-title-select:hover {
  border-color: var(--purple);
}

.title-select:focus,
.pet-title-select:focus {
  outline: none;
  border-color: var(--purple);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.title-select option[disabled],
.pet-title-select option[disabled] {
  color: var(--text-light);
  font-style: italic;
}

.pet-title-selector-container {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--border);
}

.pet-title-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pet-title-selector label {
  font-weight: 600;
  color: var(--text);
  font-size: 0.9rem;
}

.pet-title-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 15px;
  font-size: 0.85rem;
  font-weight: bold;
  background: rgba(99, 102, 241, 0.1);
  margin-top: 8px;
  text-align: center;
}

/* Display pet name + title together */
.pet-name-with-title {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  margin-bottom: 10px;
}

.pet-display-name {
  font-family: 'Fredoka One', cursive;
  font-size: 1.3rem;
  color: var(--purple-dark);
}

.pet-display-title {
  font-size: 0.85rem;
  font-style: italic;
  font-weight: 600;
}
</style>
`;

// ═══════════════════════════════════════════════════════════════════════
// EXAMPLE: DISPLAYING PET WITH TITLE
// ═══════════════════════════════════════════════════════════════════════

/*
Example of displaying a pet with their title:

HTML Output:
  <div class="pet-name-with-title">
    <div class="pet-display-name">Ember</div>
    <div class="pet-display-title" style="color: #ff9800;">
      👑 the Golden
    </div>
  </div>

This creates:
  Ember
  👑 the Golden

Making it: "Golden Ember the Golden" (variant + name + title)
*/

function getPetFullDisplayName(pet) {
  var variantPrefix = '';
  var titleSuffix = '';
  
  // Add variant prefix
  if (pet.variant) {
    var variantData = petVariants.find(function(v) { return v.key === pet.variant; });
    if (variantData) {
      variantPrefix = variantData.name + ' ';
    }
  }
  
  // Add title suffix
  if (pet.active_pet_title_id) {
    var title = allPetTitles.find(function(t) { return t.id === pet.active_pet_title_id; });
    if (title) {
      titleSuffix = ' ' + title.display_name;
    }
  }
  
  return variantPrefix + pet.nickname + titleSuffix;
}

// Example: "Golden Ember the Brave" or "Shadow Pyxie the Unlucky"
/* ═══════════════════════════════════════════════════════════════════════
   PHASE 2D: WEATHER SYSTEM
   6 weather types with visual effects and flavor text
   ═══════════════════════════════════════════════════════════════════════ */

var weatherSystem = {
  weatherTypes: [
    {
      id: 'clear',
      name: 'Clear',
      icon: '☀️',
      description: 'Perfect weather for pet adventures!',
      weight: 50 // Most common - no weather effects
    },
    {
      id: 'rainy',
      name: 'Rainy',
      icon: '🌧️',
      description: 'The mushrooms are extra happy today.',
      weight: 15
    },
    {
      id: 'foggy',
      name: 'Foggy',
      icon: '🌫️',
      description: 'Mysterious mists drift through the Deep Woods...',
      weight: 12
    },
    {
      id: 'windy',
      name: 'Windy',
      icon: '💨',
      description: 'Hold onto your spoons! Gusty conditions today.',
      weight: 10
    },
    {
      id: 'starry',
      name: 'Starry Night',
      icon: '✨',
      description: 'The cosmos align. Make a wish!',
      weight: 8
    },
    {
      id: 'cursed',
      name: 'Cursed Fog',
      icon: '🟣',
      description: 'Strange purple fog emanates from the ruins. Proceed with caution.',
      weight: 5 // Rare
    }
  ],
  
  currentWeather: null,
  changeInterval: null,
  
  init: function() {
    // Load saved weather or generate new
    var saved = localStorage.getItem('currentWeather');
    var savedTime = localStorage.getItem('weatherTime');
    var currentTime = Date.now();
    var oneHour = 3600000; // 1 hour in milliseconds
    
    if (saved && savedTime && (currentTime - parseInt(savedTime)) < oneHour) {
      // Use saved weather if less than 1 hour old
      this.currentWeather = JSON.parse(saved);
    } else {
      // Generate new weather
      this.generateWeather();
    }
    
    this.applyWeather();
    
    // Change weather every 1 hour
    this.changeInterval = setInterval(function() {
      weatherSystem.generateWeather();
    }, 3600000); // 1 hour
  },
  
  generateWeather: function() {
    // Weighted random selection
    var totalWeight = this.weatherTypes.reduce(function(sum, w) { return sum + w.weight; }, 0);
    var random = Math.random() * totalWeight;
    var cumulative = 0;
    
    for (var i = 0; i < this.weatherTypes.length; i++) {
      cumulative += this.weatherTypes[i].weight;
      if (random <= cumulative) {
        this.currentWeather = this.weatherTypes[i];
        break;
      }
    }
    
    // Save to localStorage with timestamp
    localStorage.setItem('currentWeather', JSON.stringify(this.currentWeather));
    localStorage.setItem('weatherTime', Date.now().toString());
    
    this.applyWeather();
  },
  
  applyWeather: function() {
    if (!this.currentWeather) return;
    
    var body = document.body;
    
    // Remove all weather classes
    body.classList.remove('weather-clear', 'weather-rainy', 'weather-foggy', 
                          'weather-windy', 'weather-starry', 'weather-cursed');
    
    // Add current weather class
    body.classList.add('weather-' + this.currentWeather.id);
    
    // Update weather display if element exists
    this.updateWeatherDisplay();
    
    console.log('🌤️ Weather changed to:', this.currentWeather.name);
  },
  
  updateWeatherDisplay: function() {
    var weatherWidget = document.getElementById('weather-widget');
    if (weatherWidget && this.currentWeather) {
      weatherWidget.innerHTML = 
        '<div class="weather-icon">' + this.currentWeather.icon + '</div>' +
        '<div class="weather-info">' +
          '<div class="weather-name">' + this.currentWeather.name + '</div>' +
          '<div class="weather-desc">' + this.currentWeather.description + '</div>' +
        '</div>';
    }
  },
  
  getCurrentWeather: function() {
    return this.currentWeather;
  },
  
  // Manual change for testing
  setWeather: function(weatherId) {
    var weather = this.weatherTypes.find(function(w) { return w.id === weatherId; });
    if (weather) {
      this.currentWeather = weather;
      localStorage.setItem('currentWeather', JSON.stringify(this.currentWeather));
      this.applyWeather();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
/* ═══════════════════════════════════════════════════════════════════════
   PHASE 3A: WORLD EVENTS SYSTEM (UPDATED WITH GAMEPLAY EFFECTS)
   Rotating daily/weekly events with ACTUAL gameplay impact
   ═══════════════════════════════════════════════════════════════════════ */

var worldEvents = {
  events: [
    {
      id: 'mushroom_migration',
      name: 'Mushroom Migration Day',
      icon: '🍄',
      description: 'The mushrooms are on the move! Battle encounters are more common today.',
      duration: 1,
      rarity: 'common',
      effects: {
        battleXpBonus: 1.25,      // 25% more XP from battles
        encounterRate: 1.5        // 50% more encounters
      }
    },
    {
      id: 'spoon_appreciation',
      name: 'Spoon Appreciation Week',
      icon: '🥄',
      description: 'All spoons deserve recognition. Spoon weapons deal extra damage!',
      duration: 7,
      rarity: 'uncommon',
      effects: {
        spoonDamageBonus: 1.5,    // 50% more damage with spoons
        spoonShopDiscount: 0.75   // 25% off spoons in shop
      }
    },
    {
      id: 'pyxie_chaos',
      name: 'Pyxie Chaos Festival',
      icon: '✨',
      description: 'Maximum chaos day! Random bonuses and surprises everywhere.',
      duration: 1,
      rarity: 'rare',
      effects: {
        randomBonusChance: 0.3,   // 30% chance of random bonus on any action
        ppGainBonus: 1.5          // 50% more PawketPoints from everything
      }
    },
    {
      id: 'golden_bunny',
      name: 'Golden Bunny Sighting',
      icon: '🐰',
      description: 'The elusive Golden Bunny grants luck! Rare drops are more common.',
      duration: 1,
      rarity: 'legendary',
      effects: {
        rareFindChance: 2.0,      // Double chance for rare items
        criticalHitChance: 1.5,   // 50% more critical hits
        luckBonus: true
      }
    },
    {
      id: 'strange_fog',
      name: 'Strange Fog in the Deep Woods',
      icon: '🌫️',
      description: 'Mysterious fog affects the forest. Pets feel... different.',
      duration: 2,
      rarity: 'rare',
      effects: {
        petHappinessDecay: 0.5,   // Happiness decays 50% slower
        mysteryBonus: true,       // Random stat changes
        explorationBonus: 1.25    // 25% more from exploration
      }
    },
    {
      id: 'pet_parade',
      name: 'Grand Pet Parade',
      icon: '🎉',
      description: 'All pets are celebrating! Happiness increases faster today.',
      duration: 1,
      rarity: 'common',
      effects: {
        happinessGain: 2.0,       // Double happiness from interactions
        petXpBonus: 1.25,         // 25% more pet XP
        snackEfficiency: 1.5      // Snacks work 50% better
      }
    },
    {
      id: 'market_madness',
      name: 'Marketplace Madness',
      icon: '🛒',
      description: 'Special deals in the shop! Everything is discounted.',
      duration: 1,
      rarity: 'uncommon',
      effects: {
        shopDiscount: 0.7,        // 30% off all shop items
        sellBonus: 1.5            // Sell items for 50% more
      }
    },
    {
      id: 'void_watching',
      name: 'The Void is Watching',
      icon: '👁️',
      description: 'The void grants mysterious bonuses. Proceed respectfully.',
      duration: 1,
      rarity: 'rare',
      effects: {
        allStatsBonus: 1.15,      // 15% bonus to all stats
        mysteryRewardChance: 0.2, // 20% chance for mystery rewards
        voidBlessing: true
      }
    },
    {
      id: 'battle_tournament',
      name: 'Arena Championship',
      icon: '⚔️',
      description: 'The Battle Arena is hosting a tournament! Victory rewards doubled.',
      duration: 3,
      rarity: 'uncommon',
      effects: {
        battleRewards: 2.0,       // Double PP from battles
        battleXpBonus: 1.5,       // 50% more XP from battles
        winStreakBonus: 1.25      // 25% better win streak rewards
      }
    },
    {
      id: 'snack_shortage',
      name: 'Great Snack Shortage',
      icon: '🍪',
      description: 'Someone hoarded all the snacks. Snacks are less effective but cheaper!',
      duration: 1,
      rarity: 'common',
      effects: {
        snackEfficiency: 0.75,    // Snacks 25% less effective
        snackCost: 0.5            // But 50% cheaper!
      }
    },
    {
      id: 'full_moon',
      name: 'Full Moon Night',
      icon: '🌕',
      description: 'The full moon brings nocturnal power. Night bonuses active!',
      duration: 1,
      rarity: 'uncommon',
      effects: {
        nightPowerBonus: 1.4,     // 40% stronger at night
        energyRegen: 1.5,         // 50% faster energy regeneration
        moonBlessing: true
      }
    },
    {
      id: 'butterfly_swarm',
      name: 'Suspicious Butterfly Swarm',
      icon: '🦋',
      description: 'The butterflies share their secrets. Discovery chances increased!',
      duration: 1,
      rarity: 'rare',
      effects: {
        discoveryChance: 2.0,     // Double chance to find secrets
        explorationBonus: 1.5,    // 50% more from exploration
        hiddenItemChance: 1.75    // 75% better chance for hidden items
      }
    },
    {
      id: 'tactical_napping',
      name: 'International Tactical Napping Day',
      icon: '😴',
      description: 'Strategic rest pays off. Energy regenerates much faster!',
      duration: 1,
      rarity: 'common',
      effects: {
        energyRegen: 2.5,         // Energy regens 2.5x faster
        restBonus: 1.5,           // 50% better rest benefits
        fatigueReduction: 0.5     // 50% less fatigue
      }
    },
    {
      id: 'ruins_rumbling',
      name: 'The Ruins are Rumbling',
      icon: '🏛️',
      description: 'Ancient power awakens. All rewards significantly increased!',
      duration: 2,
      rarity: 'legendary',
      effects: {
        allRewards: 2.0,          // DOUBLE all rewards
        ancientPowerBonus: 1.5,   // 50% stat bonus
        legendaryDropChance: 3.0, // TRIPLE chance for legendary items
        ruinsBlessing: true
      }
    },
    {
      id: 'friendship_festival',
      name: 'Friendship Festival',
      icon: '💖',
      description: 'Bonds grow stronger. Friend activities and social features boosted!',
      duration: 3,
      rarity: 'common',
      effects: {
        friendshipGain: 2.0,      // Double friendship XP
        giftEfficiency: 1.5,      // Gifts 50% better
        socialBonus: 1.3,         // 30% more from social activities
        happinessGain: 1.5        // 50% more happiness
      }
    }
  ],
  
  currentEvent: null,
  eventEndDate: null,
  
  init: function() {
    var saved = localStorage.getItem('currentEvent');
    var savedEnd = localStorage.getItem('eventEndDate');
    
    if (saved && savedEnd) {
      this.currentEvent = JSON.parse(saved);
      this.eventEndDate = new Date(savedEnd);
      
      if (new Date() > this.eventEndDate) {
        this.generateEvent();
      }
    } else {
      this.generateEvent();
    }
    
    this.displayEvent();
    
    setInterval(function() {
      if (worldEvents.eventEndDate && new Date() > worldEvents.eventEndDate) {
        worldEvents.generateEvent();
      }
    }, 3600000);
  },
  
  generateEvent: function() {
    if (Math.random() < 0.3) {
      this.currentEvent = null;
      this.eventEndDate = null;
      localStorage.removeItem('currentEvent');
      localStorage.removeItem('eventEndDate');
      this.displayEvent();
      return;
    }
    
    var event = this.events[Math.floor(Math.random() * this.events.length)];
    this.currentEvent = event;
    
    var endDate = new Date();
    endDate.setDate(endDate.getDate() + event.duration);
    this.eventEndDate = endDate;
    
    localStorage.setItem('currentEvent', JSON.stringify(event));
    localStorage.setItem('eventEndDate', endDate.toISOString());
    
    this.displayEvent();
    
    console.log('🎪 New event:', event.name, '| Effects:', event.effects);
  },
  
  displayEvent: function() {
    var eventBanner = document.getElementById('event-banner');
    
    if (!eventBanner) return;
    
    if (!this.currentEvent) {
      eventBanner.style.display = 'none';
      return;
    }
    
    // Build effects list
    var effectsList = this.getEffectsDisplay(this.currentEvent.effects);
    
    eventBanner.style.display = 'block';
    eventBanner.innerHTML = 
      '<div class="event-icon">' + this.currentEvent.icon + '</div>' +
      '<div class="event-content">' +
        '<div class="event-name">' + this.currentEvent.name + '</div>' +
        '<div class="event-description">' + this.currentEvent.description + '</div>' +
        effectsList +
      '</div>' +
      '<div class="event-timer" id="event-timer"></div>';
    
    this.updateEventTimer();
  },
  
  getEffectsDisplay: function(effects) {
    var bonuses = [];
    
    if (effects.battleXpBonus && effects.battleXpBonus > 1) {
      bonuses.push('⚔️ +' + Math.round((effects.battleXpBonus - 1) * 100) + '% Battle XP');
    }
    if (effects.ppGainBonus && effects.ppGainBonus > 1) {
      bonuses.push('🪙 +' + Math.round((effects.ppGainBonus - 1) * 100) + '% PP Gain');
    }
    if (effects.shopDiscount && effects.shopDiscount < 1) {
      bonuses.push('🛒 ' + Math.round((1 - effects.shopDiscount) * 100) + '% Shop Discount');
    }
    if (effects.happinessGain && effects.happinessGain > 1) {
      bonuses.push('💖 +' + Math.round((effects.happinessGain - 1) * 100) + '% Happiness');
    }
    if (effects.allRewards && effects.allRewards > 1) {
      bonuses.push('✨ +' + Math.round((effects.allRewards - 1) * 100) + '% All Rewards');
    }
    if (effects.rareFindChance && effects.rareFindChance > 1) {
      bonuses.push('🎁 ' + effects.rareFindChance + 'x Rare Drop Chance');
    }
    if (effects.energyRegen && effects.energyRegen > 1) {
      bonuses.push('⚡ ' + effects.energyRegen + 'x Energy Regen');
    }
    
    if (bonuses.length === 0) return '';
    
    return '<div class="event-bonuses">' + bonuses.join(' • ') + '</div>';
  },
  
  updateEventTimer: function() {
    if (!this.eventEndDate) return;
    
    var timerEl = document.getElementById('event-timer');
    if (!timerEl) return;
    
    var now = new Date();
    var diff = this.eventEndDate - now;
    
    if (diff <= 0) {
      timerEl.textContent = 'Ending soon...';
      return;
    }
    
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      timerEl.textContent = days + 'd ' + hours + 'h left';
    } else {
      timerEl.textContent = hours + 'h left';
    }
    
    setTimeout(function() {
      worldEvents.updateEventTimer();
    }, 60000);
  },
  
  getCurrentEvent: function() {
    return this.currentEvent;
  },
  
  // Get active bonuses for other systems to use
  getActiveBonus: function(bonusType) {
    if (!this.currentEvent || !this.currentEvent.effects) return 1.0;
    return this.currentEvent.effects[bonusType] || 1.0;
  },
  
  hasActiveEffect: function(effectName) {
    if (!this.currentEvent || !this.currentEvent.effects) return false;
    return this.currentEvent.effects[effectName] === true;
  },
  
  // Apply event modifiers to values
  applyEventModifier: function(baseValue, modifierType) {
    var modifier = this.getActiveBonus(modifierType);
    return Math.floor(baseValue * modifier);
  },
  
  triggerEvent: function(eventId) {
    var event = this.events.find(function(e) { return e.id === eventId; });
    if (event) {
      this.currentEvent = event;
      var endDate = new Date();
      endDate.setDate(endDate.getDate() + event.duration);
      this.eventEndDate = endDate;
      localStorage.setItem('currentEvent', JSON.stringify(event));
      localStorage.setItem('eventEndDate', endDate.toISOString());
      this.displayEvent();
    }
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   HELPER FUNCTIONS FOR OTHER SYSTEMS TO USE EVENT BONUSES
   
   Add these calls in your existing game systems:
   
   // In battle reward calculation:
   var ppReward = worldEvents.applyEventModifier(basePP, 'ppGainBonus');
   var xpReward = worldEvents.applyEventModifier(baseXP, 'battleXpBonus');
   
   // In shop pricing:
   var finalPrice = worldEvents.applyEventModifier(basePrice, 'shopDiscount');
   
   // In happiness updates:
   var happinessGain = worldEvents.applyEventModifier(baseGain, 'happinessGain');
   
   // Check for special effects:
   if (worldEvents.hasActiveEffect('luckBonus')) {
     // Apply luck-based bonuses
   }
   
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   STATISTICS TRACKING SYSTEM
   Global and player-level stat tracking for achievements, community goals, etc.
   ═══════════════════════════════════════════════════════════════════════ */

// Stat batching for performance
var statBatch = [];
var statBatchTimeout = null;

/**
 * Track a single statistic (batched)
 * @param {string} statKey - Stat identifier (e.g., "enemies_defeated")
 * @param {number} increment - Amount to increment (default 1)
 * @param {boolean} isGlobal - Track globally for all players (default false)
 */
function trackStat(statKey, increment, isGlobal) {
  if (increment === undefined) increment = 1;
  if (isGlobal === undefined) isGlobal = false;
  if (!currentUser) return;
  
  statBatch.push({ statKey: statKey, increment: increment, isGlobal: isGlobal });
  
  clearTimeout(statBatchTimeout);
  statBatchTimeout = setTimeout(flushStatBatch, 2000); // Flush every 2 seconds
}

/**
 * Flush batched stats to database
 */
async function flushStatBatch() {
  if (statBatch.length === 0) return;
  
  var batch = statBatch.slice(); // Copy batch
  statBatch = []; // Clear batch
  
  // Group by statKey + isGlobal and sum increments
  var grouped = {};
  batch.forEach(function(stat) {
    var key = stat.statKey + '_' + stat.isGlobal;
    if (!grouped[key]) {
      grouped[key] = { statKey: stat.statKey, increment: stat.increment, isGlobal: stat.isGlobal };
    } else {
      grouped[key].increment += stat.increment;
    }
  });
  
  // Execute all stat updates
  var promises = Object.values(grouped).map(function(stat) {
    return executeStatUpdate(stat.statKey, stat.increment, stat.isGlobal);
  });
  
  try {
    await Promise.all(promises);
  } catch (err) {
    console.error('Stat batch flush error:', err);
    // Silent fail - don't break gameplay
  }
}

/**
 * Execute a single stat update
 */
async function executeStatUpdate(statKey, increment, isGlobal) {
  try {
    if (isGlobal) {
      // Update global community stats
      await supabaseClient.rpc('increment_global_stat', {
        p_stat_key: statKey,
        p_increment: increment
      });
    } else {
      // Update player stats
      await supabaseClient.rpc('increment_player_stat', {
        p_user_id: currentUser.id,
        p_stat_key: statKey,
        p_increment: increment
      });
    }
  } catch (err) {
    console.error('Stat update error for ' + statKey + ':', err);
    // Silent fail - don't break gameplay
  }
}

/**
 * Get player stats
 */
async function getPlayerStats() {
  if (!currentUser) return {};
  
  try {
    var res = await supabaseClient
      .from('player_stats')
      .select('stat_key, stat_value')
      .eq('user_id', currentUser.id);
    
    if (res.error) throw res.error;
    
    var stats = {};
    (res.data || []).forEach(function(stat) {
      stats[stat.stat_key] = stat.stat_value;
    });
    
    return stats;
  } catch (err) {
    console.error('Error fetching player stats:', err);
    return {};
  }
}

/**
 * Get global stats
 */
async function getGlobalStats() {
  try {
    var res = await supabaseClient
      .from('global_stats')
      .select('stat_key, stat_value');
    
    if (res.error) throw res.error;
    
    var stats = {};
    (res.data || []).forEach(function(stat) {
      stats[stat.stat_key] = stat.stat_value;
    });
    
    return stats;
  } catch (err) {
    console.error('Error fetching global stats:', err);
    return {};
  }
}

/**
 * Display stats page
 */
async function loadStatsPage() {
  var container = el('stats-container');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var playerStats = await getPlayerStats();
    var globalStats = await getGlobalStats();
    
    var html = '<div class="stats-grid">';
    
    // Player Stats Section
    html += '<div class="stats-section">';
    html += '<h2 class="stats-section-title">📊 Your Statistics</h2>';
    html += '<div class="stats-list">';
    
    var playerStatLabels = {
      'battles_won': '⚔️ Battles Won',
      'battles_lost': '💀 Battles Lost',
      'enemies_defeated': '🎯 Enemies Defeated',
      'damage_dealt': '💥 Damage Dealt',
      'items_purchased': '🛒 Items Purchased',
      'items_used': '🎁 Items Used',
      'pp_earned': '🪙 PP Earned',
      'pp_spent': '💸 PP Spent',
      'pets_adopted': '🐾 Pets Adopted',
      'minigames_played': '🎮 Minigames Played'
    };
    
    Object.keys(playerStatLabels).forEach(function(key) {
      var value = playerStats[key] || 0;
      html += '<div class="stat-item">';
      html += '<span class="stat-label">' + playerStatLabels[key] + '</span>';
      html += '<span class="stat-value">' + value.toLocaleString() + '</span>';
      html += '</div>';
    });
    
    html += '</div></div>';
    
    // Global Stats Section
    html += '<div class="stats-section">';
    html += '<h2 class="stats-section-title">🌍 Community Statistics</h2>';
    html += '<div class="stats-list">';
    
    var globalStatLabels = {
      'total_enemies_defeated': '🎯 Total Enemies Defeated',
      'total_pets_adopted': '🐾 Total Pets Adopted',
      'total_battles_won': '⚔️ Total Battles Won',
      'total_pp_earned': '🪙 Total PP Earned',
      'total_items_purchased': '🛒 Total Items Purchased',
      'total_minigames_played': '🎮 Total Minigames Played',
      'mushrooms_defeated': '🍄 Mushrooms Defeated',
      'spoon_weapon_equips': '🥄 Spoon Weapons Equipped'
    };
    
    Object.keys(globalStatLabels).forEach(function(key) {
      var value = globalStats[key] || 0;
      html += '<div class="stat-item global">';
      html += '<span class="stat-label">' + globalStatLabels[key] + '</span>';
      html += '<span class="stat-value">' + value.toLocaleString() + '</span>';
      html += '</div>';
    });
    
    html += '</div></div>';
    html += '</div>';
    
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Failed to load statistics.</p></div>';
    console.error('Stats page error:', err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   STAT TRACKING INTEGRATION POINTS
   
   Add these calls to your existing game systems for automatic tracking.
   ═══════════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════════
   EQUIPMENT ROTATION SYSTEM - JavaScript Code
   Add this to your game.js file
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Get current rotation week (A, B, or C) based on current date
 * Rotates every Monday at midnight
 */
/**
 * Get next rotation date (next Monday at midnight)
 */
function getNextRotationDate() {
  var now = new Date();
  var daysUntilMonday = (8 - now.getDay()) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7; // If today is Monday, show next Monday
  
  var nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  return nextMonday;
}

/**
 * Get time remaining until next rotation (formatted string)
 */
function getTimeUntilRotation() {
  var now = new Date();
  var nextRotation = getNextRotationDate();
  var diff = nextRotation - now;
  
  var days = Math.floor(diff / (1000 * 60 * 60 * 24));
  var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) {
    return days + 'd ' + hours + 'h ' + minutes + 'm';
  } else if (hours > 0) {
    return hours + 'h ' + minutes + 'm';
  } else {
    return minutes + ' minutes';
  }
}

/**
 * Load equipment shop with rotation filtering
 * REPLACES or MODIFIES your existing loadShop/loadEquipmentShop function
 */
async function loadEquipmentShop() {
  var container = el('equipment-shop-grid');
  if (!container) return;
  
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    var currentWeek = getCurrentRotationWeek();
    
    var res = await supabaseClient
      .from('equipment')
      .select('*')
      .or('rotation_week.eq.' + currentWeek + ',is_boss_drop.eq.true')
      .order('tier', { ascending: true })
      .order('weight_class', { ascending: true });
    
    if (res.error) throw res.error;
    
    var equipment = res.data || [];
    
    var html = '<div class="shop-rotation-banner">';
    html += '<div class="rotation-week">📅 Week ' + currentWeek + ' Rotation</div>';
    html += '<div class="rotation-timer">⏰ Next rotation in: <span id="rotation-countdown">' + getTimeUntilRotation() + '</span></div>';
    html += '</div>';
    
    var ownedEquipment = [];
    if (currentUser) {
      var ownedRes = await supabaseClient
        .from('player_equipment')
        .select('equipment_id')
        .eq('user_id', currentUser.id);
      
      if (ownedRes.data) {
        ownedEquipment = ownedRes.data.map(function(e) { return e.equipment_id; });
      }
    }
    
    // Separate weapons and armor
    var weapons = equipment.filter(function(item) { return item.equipment_type === 'weapon'; });
    var armor = equipment.filter(function(item) { return item.equipment_type === 'armor'; });
    
    // Helper function to render equipment cards
    function renderEquipmentCard(item) {
      var isOwned = ownedEquipment.indexOf(item.id) !== -1;
      var isBossDrop = item.is_boss_drop;
      
      var cardHtml = '<div class="equipment-card ' + (isOwned ? 'owned' : '') + ' rarity-' + (item.rarity || 'common') + '">';
      
      if (isBossDrop) {
        cardHtml += '<div class="boss-drop-badge">👑 BOSS DROP</div>';
      }
      
      cardHtml += '<h3 class="equipment-name">' + item.name + '</h3>';
      cardHtml += '<p class="equipment-description">' + (item.description || '') + '</p>';
      
      cardHtml += '<div class="equipment-stats">';
      cardHtml += '<div class="equipment-type">' + (item.equipment_type === 'weapon' ? '⚔️ Weapon' : '🛡️ Armor') + '</div>';
      cardHtml += '<div class="equipment-tier">Tier ' + item.tier + ' ' + item.weight_class.charAt(0).toUpperCase() + item.weight_class.slice(1) + '</div>';
      
      if (item.attack_bonus > 0) {
        cardHtml += '<div class="stat">⚔️ Attack: +' + item.attack_bonus + '</div>';
      }
      if (item.defense_bonus > 0) {
        cardHtml += '<div class="stat">🛡️ Defense: +' + item.defense_bonus + '</div>';
      }
      if (item.speed_bonus !== 0) {
        cardHtml += '<div class="stat">⚡ Speed: ' + (item.speed_bonus > 0 ? '+' : '') + item.speed_bonus + '</div>';
      }
      if (item.hp_bonus > 0) {
        cardHtml += '<div class="stat">❤️ HP: +' + item.hp_bonus + '</div>';
      }
      
      cardHtml += '</div>';
      
      if (!isBossDrop) {
        cardHtml += '<div class="equipment-price">🪙 ' + item.price.toLocaleString() + ' PP</div>';
        
        if (isOwned) {
          cardHtml += '<button class="btn btn-owned" disabled>Already Owned</button>';
        } else {
          var canAfford = currentPoints >= item.price;
          if (canAfford) {
            cardHtml += '<button class="btn btn-primary" onclick="buyEquipment(' + item.id + ', \'' + item.name.replace(/'/g, "\\'") + '\', ' + item.price + ')">Buy</button>';
          } else {
            cardHtml += '<button class="btn btn-locked" disabled>Need ' + item.price + ' PP</button>';
          }
        }
      } else {
        cardHtml += '<div class="equipment-price boss-drop-price">Cannot be purchased</div>';
        if (isOwned) {
          cardHtml += '<button class="btn btn-legendary" disabled>In Your Collection</button>';
        } else {
          cardHtml += '<button class="btn btn-locked" disabled>Defeat Boss to Obtain</button>';
        }
      }
      
      cardHtml += '</div>';
      return cardHtml;
    }
    
    // Create two-column layout
    html += '<div class="equipment-shop-columns">';
    
    // Left column: Weapons
    html += '<div class="equipment-column">';
    html += '<h3 class="equipment-column-title">⚔️ Weapons</h3>';
    html += '<div class="equipment-grid-column">';
    weapons.forEach(function(item) {
      html += renderEquipmentCard(item);
    });
    html += '</div></div>';
    
    // Right column: Armor
    html += '<div class="equipment-column">';
    html += '<h3 class="equipment-column-title">🛡️ Armor</h3>';
    html += '<div class="equipment-grid-column">';
    armor.forEach(function(item) {
      html += renderEquipmentCard(item);
    });
    html += '</div></div>';
    
    html += '</div>';
    
    container.innerHTML = html;
    
    setInterval(updateRotationCountdown, 60000);
    
  } catch (err) {
    container.innerHTML = '<div class="error-state"><p>Failed to load shop.</p></div>';
    console.error('Equipment shop error:', err);
  }
}

function updateRotationCountdown() {
  var countdown = el('rotation-countdown');
  if (countdown) {
    countdown.textContent = getTimeUntilRotation();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   USAGE INSTRUCTIONS:
   
   1. Replace your existing equipment shop loading function with loadEquipmentShop()
   2. Make sure you call loadEquipmentShop() when the shop tab is opened
   3. The rotation will automatically cycle every Monday at midnight
   4. Boss drops will appear in shop but cannot be purchased (defeat bosses to obtain)
   
   ═══════════════════════════════════════════════════════════════════════ */


// ═══════════════════════════════════════════════════════════════════════
// TUTORIAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════

async function checkTutorialStatus() {
  if (!currentUser) return;
  
  try {
    var res = await supabaseClient
      .from('players')
      .select('tutorial_completed, spooky_enabled')
      .eq('id', currentUser.id)
      .single();
    
    if (res.data) {
      playerSettings.tutorial_completed = res.data.tutorial_completed || false;
      playerSettings.spooky_enabled = res.data.spooky_enabled || false;
      
      console.log('Tutorial status:', playerSettings.tutorial_completed);
      console.log('Spooky enabled:', playerSettings.spooky_enabled);
      
      // Start tutorial if not completed
      if (!playerSettings.tutorial_completed) {
        console.log('Starting tutorial for new player...');
        setTimeout(function() {
          if (typeof Tutorial !== 'undefined') {
            Tutorial.start();
          }
        }, 1500);
      }
    }
  } catch (err) {
    console.error('Error checking tutorial status:', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════════

async function loadSettings() {
  console.log('Loading settings page...');
  
  if (!currentUser) return;
  
  try {
    // Load settings from database
    var res = await supabaseClient
      .from('players')
      .select('spooky_enabled')
      .eq('id', currentUser.id)
      .single();
    
    // Load from localStorage (for new settings not in DB yet)
    var localSettings = localStorage.getItem('playerSettings_' + currentUser.id);
    if (localSettings) {
      var saved = JSON.parse(localSettings);
      Object.assign(playerSettings, saved);
    }
    
    if (res.data) {
      // Update spooky toggle
      playerSettings.spooky_enabled = res.data.spooky_enabled || false;
      var spookyToggle = el('setting-spooky');
      if (spookyToggle) {
        spookyToggle.checked = playerSettings.spooky_enabled;
      }
    }
    
    // Update all UI elements
    var musicEnabledToggle = el('setting-music-enabled');
    if (musicEnabledToggle) musicEnabledToggle.checked = playerSettings.music_enabled;
    
    var musicVolumeSlider = el('setting-music-volume');
    if (musicVolumeSlider) {
      musicVolumeSlider.value = playerSettings.music_volume;
      var display = el('music-volume-display');
      if (display) display.textContent = playerSettings.music_volume + '%';
    }
    
    var sfxVolumeSlider = el('setting-sfx-volume');
    if (sfxVolumeSlider) {
      sfxVolumeSlider.value = playerSettings.sfx_volume;
      var display = el('sfx-volume-display');
      if (display) display.textContent = playerSettings.sfx_volume + '%';
    }
    
    var daynightToggle = el('setting-daynight');
    if (daynightToggle) daynightToggle.checked = playerSettings.daynight_enabled;
    
    var weatherToggle = el('setting-weather');
    if (weatherToggle) weatherToggle.checked = playerSettings.weather_enabled;
    
    // Apply settings immediately
    applySettings();
    
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettings() {
  if (!currentUser) return;
  
  try {
    // Get all setting values
    var spookyToggle = el('setting-spooky');
    var musicEnabledToggle = el('setting-music-enabled');
    var musicVolumeSlider = el('setting-music-volume');
    var sfxVolumeSlider = el('setting-sfx-volume');
    var daynightToggle = el('setting-daynight');
    var weatherToggle = el('setting-weather');
    
    // Update playerSettings object
    playerSettings.spooky_enabled = spookyToggle ? spookyToggle.checked : false;
    playerSettings.music_enabled = musicEnabledToggle ? musicEnabledToggle.checked : true;
    playerSettings.music_volume = musicVolumeSlider ? parseInt(musicVolumeSlider.value) : 70;
    playerSettings.sfx_volume = sfxVolumeSlider ? parseInt(sfxVolumeSlider.value) : 80;
    playerSettings.daynight_enabled = daynightToggle ? daynightToggle.checked : true;
    playerSettings.weather_enabled = weatherToggle ? weatherToggle.checked : true;
    
    // Update volume displays
    var musicDisplay = el('music-volume-display');
    if (musicDisplay) musicDisplay.textContent = playerSettings.music_volume + '%';
    
    var sfxDisplay = el('sfx-volume-display');
    if (sfxDisplay) sfxDisplay.textContent = playerSettings.sfx_volume + '%';
    
    // Save to database (spooky only, for now)
    await supabaseClient
      .from('players')
      .update({
        spooky_enabled: playerSettings.spooky_enabled
      })
      .eq('id', currentUser.id);
    
    // Save all settings to localStorage
    localStorage.setItem('playerSettings_' + currentUser.id, JSON.stringify(playerSettings));
    
    // Apply settings immediately
    applySettings();
    
    console.log('Settings saved!', playerSettings);
    showToast('Settings saved! ✅');
    
  } catch (err) {
    console.error('Error saving settings:', err);
    showToast('Failed to save settings');
  }
}

// Apply settings to the game
function applySettings() {
  console.log('Applying settings...', playerSettings);
  
  // Music toggle
  if (playerSettings.music_enabled) {
    // Resume music if available
    if (typeof bgMusic !== 'undefined' && bgMusic) {
      bgMusic.volume = playerSettings.music_volume / 100;
      bgMusic.play().catch(function(){}); // Ignore autoplay errors
    }
  } else {
    // Pause music
    if (typeof bgMusic !== 'undefined' && bgMusic) {
      bgMusic.pause();
    }
  }
  
  // Day/Night effects
  if (!playerSettings.daynight_enabled) {
    // Force daytime
    document.body.classList.remove('night-mode');
  } else {
    // Allow night mode system to work normally
    if (typeof applyNightMode === 'function') {
      applyNightMode();
    }
  }
  
  // Weather effects
  if (!playerSettings.weather_enabled) {
    // Disable weather
    var body = document.body;
    body.classList.remove('weather-clear', 'weather-rainy', 'weather-foggy', 
                          'weather-windy', 'weather-starry', 'weather-cursed');
  } else {
    // Re-apply weather
    if (typeof weatherSystem !== 'undefined' && weatherSystem.applyWeather) {
      weatherSystem.applyWeather();
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
// PAWKETPASS SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var passProgress = {
  season: 1,
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  claimedRewards: []
};

var dailyXPCaps = {
  login: { earned: 0, max: 10 },
  feed: { earned: 0, max: 20 },
  play: { earned: 0, max: 20 },
  battle: { earned: 0, max: 50 },
  bingo_square: { earned: 0, max: 135 },
  bingo_line: { earned: 0, max: 400 },
  bingo_blackout: { earned: 0, max: 200 }
};

// Pass rewards structure (50 levels)
var PASS_REWARDS = {
  1: { type: 'points', amount: 100 },
  2: { type: 'item', itemId: 'basic_food', quantity: 2 },
  3: { type: 'item', itemId: 'treat', quantity: 3 },
  4: { type: 'points', amount: 150 },
  5: { type: 'item', itemId: 'rare_toy', quantity: 1 },
  6: { type: 'title', titleKey: 'pass_rider' },
  7: { type: 'points', amount: 200 },
  8: { type: 'item', itemId: 'treat', quantity: 2, itemId2: 'basic_food', quantity2: 1 },
  9: { type: 'points', amount: 250 },
  10: { type: 'item', itemId: 'premium_treat', quantity: 1 },
  11: { type: 'points', amount: 300 },
  12: { type: 'item', itemId: 'rare_toy', quantity: 2 },
  13: { type: 'title', titleKey: 'dedicated_trainer' },
  14: { type: 'points', amount: 350 },
  15: { type: 'item', itemId: 'revive_potion', quantity: 1 },
  16: { type: 'points', amount: 400 },
  17: { type: 'item', itemId: 'treat', quantity: 3, itemId2: 'basic_food', quantity2: 2 },
  18: { type: 'points', amount: 450 },
  19: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  20: { type: 'title', titleKey: 'faithful_companion' },
  21: { type: 'points', amount: 500 },
  22: { type: 'item', itemId: 'premium_treat', quantity: 2 },
  23: { type: 'points', amount: 550 },
  24: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  25: { type: 'points', amount: 600 },
  26: { type: 'item', itemId: 'rare_toy', quantity: 3 },
  27: { type: 'title', titleKey: 'pawket_champion' },
  28: { type: 'points', amount: 700 },
  29: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 1 },
  30: { type: 'title', titleKey: 'style_master' },
  31: { type: 'points', amount: 800 },
  32: { type: 'item', itemId: 'treat', quantity: 5, itemId2: 'basic_food', quantity2: 3 },
  33: { type: 'points', amount: 900 },
  34: { type: 'title', titleKey: 'legendary_tamer' },
  35: { type: 'points', amount: 1000 },
  36: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  37: { type: 'points', amount: 1100 },
  38: { type: 'item', itemId: 'premium_treat', quantity: 3, itemId2: 'revive_potion', quantity2: 2 },
  39: { type: 'points', amount: 1200 },
  40: { type: 'title', titleKey: 'mythic_breaker' },
  41: { type: 'points', amount: 1300 },
  42: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 2 },
  43: { type: 'points', amount: 1400 },
  44: { type: 'item', itemId: 'mystery_box', quantity: 3 },
  45: { type: 'points', amount: 1500 },
  46: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  47: { type: 'title', titleKey: 'pawket_master' },
  48: { type: 'points', amount: 2000 },
  49: { type: 'item', itemId: '00000000-0000-0000-0000-000000000001', quantity: 3 },
  50: { type: 'title', titleKey: 'ultimate_collector' }
};

// Load Pass progress from database
async function loadPassProgress() {
  if (!currentUser) return;
  
  try {
    var res = await supabaseClient
      .from('user_pass_progress')
      .select('*')
      .eq('user_id', currentUser.id)
      .eq('season', 1)
      .maybeSingle();
    
    if (res.data) {
      passProgress.level = res.data.level || 1;
      passProgress.xp = res.data.xp || 0;
      passProgress.claimedRewards = res.data.claimed_rewards || [];
      passProgress.xpToNextLevel = calculateXPForLevel(passProgress.level + 1);
    } else {
      // Create new progress entry
      await supabaseClient
        .from('user_pass_progress')
        .insert({
          user_id: currentUser.id,
          season: 1,
          level: 1,
          xp: 0,
          claimed_rewards: []
        });
    }
    
    // Load daily XP caps from localStorage
    var today = new Date().toISOString().split('T')[0];
    var savedCaps = localStorage.getItem('daily_xp_caps_' + today);
    if (savedCaps) {
      dailyXPCaps = JSON.parse(savedCaps);
    } else {
      resetDailyXPCaps();
    }
    
    updatePassUI();
    
  } catch (err) {
    console.error('[Pass] Error loading progress:', err);
  }
}

// Calculate XP required for a level
function calculateXPForLevel(level) {
  return Math.floor(100 * Math.pow(1.1, level - 1));
}

// Add Pass XP with daily cap
async function addPassXP(amount, source) {
  if (!currentUser || amount <= 0) return;
  
  // Check daily cap
  if (dailyXPCaps[source]) {
    var remaining = dailyXPCaps[source].max - dailyXPCaps[source].earned;
    if (remaining <= 0) {
      console.log('[Pass] Daily XP cap reached for ' + source);
      return;
    }
    amount = Math.min(amount, remaining);
    dailyXPCaps[source].earned += amount;
    saveDailyXPCaps();
  }
  
  passProgress.xp += amount;
  
  // Check for level up
  var levelsGained = 0;
  while (passProgress.xp >= passProgress.xpToNextLevel && passProgress.level < 50) {
    passProgress.xp -= passProgress.xpToNextLevel;
    passProgress.level++;
    passProgress.xpToNextLevel = calculateXPForLevel(passProgress.level + 1);
    levelsGained++;
  }
  
  // Save to database
  await supabaseClient
    .from('user_pass_progress')
    .update({
      level: passProgress.level,
      xp: passProgress.xp,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', currentUser.id)
    .eq('season', 1);
  
  updatePassUI();
  
  if (levelsGained > 0) {
    showToast('🎫 Pass Level Up! Now Level ' + passProgress.level + '!', 'success');
    playSound('levelup');
  }
}

// Save daily XP caps to localStorage
function saveDailyXPCaps() {
  var today = new Date().toISOString().split('T')[0];
  localStorage.setItem('daily_xp_caps_' + today, JSON.stringify(dailyXPCaps));
}

// Reset daily XP caps (called at midnight)
function resetDailyXPCaps() {
  dailyXPCaps = {
    login: { earned: 0, max: 10 },
    feed: { earned: 0, max: 20 },
    play: { earned: 0, max: 20 },
    battle: { earned: 0, max: 50 },
    bingo_square: { earned: 0, max: 135 },
    bingo_line: { earned: 0, max: 400 },
    bingo_blackout: { earned: 0, max: 200 }
  };
  saveDailyXPCaps();
}

// Claim Pass reward
async function claimPassReward(level) {
  if (!currentUser) return;
  
  // Check if already claimed
  if (passProgress.claimedRewards.includes(level)) {
    showToast('You already claimed this reward!', 'warning');
    return;
  }
  
  // Check if level reached
  if (passProgress.level < level) {
    showToast('Reach Level ' + level + ' to claim this reward!', 'warning');
    return;
  }
  
  var reward = PASS_REWARDS[level];
  if (!reward) return;
  
  // Grant reward
  await grantPassReward(level, reward);
  
  // Mark as claimed
  passProgress.claimedRewards.push(level);
  
  await supabaseClient
    .from('user_pass_progress')
    .update({
      claimed_rewards: passProgress.claimedRewards
    })
    .eq('user_id', currentUser.id)
    .eq('season', 1);
  
  updatePassUI();
}

// Grant Pass reward to player
async function grantPassReward(level, reward) {
  switch(reward.type) {
    case 'points':
      updateAllPoints(currentPoints + reward.amount);
      await supabaseClient.rpc('award_pp_secure', {
        p_user_id: currentUser.id,
        p_amount: reward.amount,
        p_reason: 'Pass Level ' + level
      });
      showToast('✨ +' + reward.amount + ' PawketPoints!', 'success');
      break;
      
    case 'item':
      // Add primary item
      if (reward.itemId) {
        await addItemToInventory(reward.itemId, reward.quantity || 1);
        var itemName = reward.itemId === '00000000-0000-0000-0000-000000000001' ? '🔑 Skin Key' : reward.itemId;
        showToast('📦 +' + (reward.quantity || 1) + 'x ' + itemName, 'success');
      }
      // Add secondary item
      if (reward.itemId2) {
        await addItemToInventory(reward.itemId2, reward.quantity2 || 1);
        showToast('📦 +' + (reward.quantity2 || 1) + 'x ' + reward.itemId2, 'success');
      }
      break;
      
    case 'title':
      await awardTitle(reward.titleKey);
      var titleData = await supabaseClient
        .from('titles')
        .select('display_name')
        .eq('title_key', reward.titleKey)
        .single();
      
      if (titleData.data) {
        showToast('🏆 Title unlocked: "' + titleData.data.display_name + '"!', 'success');
      }
      break;
  }
}

// Add item to inventory (helper)
async function addItemToInventory(itemId, quantity) {
  if (!currentUser) return;
  
  // Check if item exists in inventory
  var invCheck = await supabaseClient
    .from('user_inventory')
    .select('id, quantity')
    .eq('user_id', currentUser.id)
    .eq('item_id', itemId)
    .maybeSingle();
  
  if (invCheck.data) {
    // Update quantity
    await supabaseClient
      .from('user_inventory')
      .update({ quantity: invCheck.data.quantity + quantity })
      .eq('id', invCheck.data.id);
  } else {
    // Insert new
    await supabaseClient
      .from('user_inventory')
      .insert({
        user_id: currentUser.id,
        item_id: itemId,
        quantity: quantity
      });
  }
}

// Update Pass UI
function updatePassUI() {
  var levelDisplay = document.getElementById('pass-level-display');
  var xpFill = document.getElementById('pass-xp-fill');
  
  if (levelDisplay) {
    levelDisplay.textContent = passProgress.level;
  }
  
  if (xpFill) {
    var percent = (passProgress.xp / passProgress.xpToNextLevel) * 100;
    xpFill.style.width = Math.min(percent, 100) + '%';
  }
}

// Show Pass modal
function showPassModal() {
  var modal = makeModal();
  modal.classList.add('pass-modal');
  
  var content = makeEl('div', {class: 'pass-modal-content'});
  content.style.cssText = 'padding:20px;max-width:900px;max-height:80vh;overflow-y:auto;';
  
  // Header
  var header = makeEl('div');
  header.style.cssText = 'text-align:center;margin-bottom:30px;';
  header.innerHTML = '<h2 style="color:var(--purple);margin-bottom:10px;">🎫 PawketPass Season 1</h2>' +
    '<div style="font-size:1.2rem;color:var(--text);">Level ' + passProgress.level + ' / 50</div>' +
    '<div class="pass-xp-bar-large" style="width:100%;height:30px;background:#ddd;border-radius:15px;margin-top:15px;overflow:hidden;">' +
    '<div style="width:' + ((passProgress.xp / passProgress.xpToNextLevel) * 100) + '%;height:100%;background:linear-gradient(90deg,var(--purple),var(--pink));transition:width 0.3s;"></div>' +
    '</div>' +
    '<div style="margin-top:8px;color:var(--text-light);">' + passProgress.xp + ' / ' + passProgress.xpToNextLevel + ' XP</div>';
  content.appendChild(header);
  
  // Rewards track
  var track = makeEl('div', {class: 'pass-rewards-track'});
  track.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:15px;';
  
  for (var level = 1; level <= 50; level++) {
    var reward = PASS_REWARDS[level];
    if (!reward) continue;
    
    var card = makeEl('div', {class: 'pass-reward-card'});
    var unlocked = passProgress.level >= level;
    var claimed = passProgress.claimedRewards.includes(level);
    
    card.style.cssText = 'background:' + (unlocked ? '#fff' : '#f5f5f5') + ';border:2px solid ' + (claimed ? '#4CAF50' : unlocked ? 'var(--purple)' : '#ddd') + ';border-radius:12px;padding:15px;text-align:center;position:relative;' + (unlocked ? '' : 'opacity:0.6;');
    
    // Level badge
    var badge = makeEl('div');
    badge.textContent = 'Lv.' + level;
    badge.style.cssText = 'position:absolute;top:5px;right:5px;background:var(--purple);color:white;padding:2px 8px;border-radius:8px;font-size:0.8rem;font-weight:bold;';
    card.appendChild(badge);
    
    // Reward icon
    var icon = makeEl('div');
    icon.style.cssText = 'font-size:2rem;margin:10px 0;';
    if (reward.type === 'points') icon.textContent = '💰';
    else if (reward.type === 'item') icon.textContent = reward.itemId === '00000000-0000-0000-0000-000000000001' ? '🔑' : '📦';
    else if (reward.type === 'title') icon.textContent = '🏆';
    card.appendChild(icon);
    
    // Reward description
    var desc = makeEl('div');
    desc.style.cssText = 'font-size:0.9rem;color:var(--text);margin-bottom:10px;';
    if (reward.type === 'points') desc.textContent = reward.amount + ' PP';
    else if (reward.type === 'item') {
      var itemText = (reward.quantity || 1) + 'x ' + (reward.itemId === '00000000-0000-0000-0000-000000000001' ? 'Skin Key' : reward.itemId);
      if (reward.itemId2) itemText += ' + ' + (reward.quantity2 || 1) + 'x ' + reward.itemId2;
      desc.textContent = itemText;
    }
    else if (reward.type === 'title') desc.textContent = 'Title';
    card.appendChild(desc);
    
    // Claim button
    if (unlocked && !claimed) {
      var claimBtn = makeEl('button', {class: 'btn btn-primary btn-sm'});
      claimBtn.textContent = 'Claim';
      claimBtn.onclick = function(lvl) {
        return function() {
          claimPassReward(lvl);
          modal.remove();
          showPassModal();
        };
      }(level);
      card.appendChild(claimBtn);
    } else if (claimed) {
      var claimedText = makeEl('div');
      claimedText.textContent = '✓ Claimed';
      claimedText.style.cssText = 'color:#4CAF50;font-weight:bold;';
      card.appendChild(claimedText);
    } else {
      var lockedText = makeEl('div');
      lockedText.textContent = '🔒 Locked';
      lockedText.style.cssText = 'color:#999;';
      card.appendChild(lockedText);
    }
    
    track.appendChild(card);
  }
  
  content.appendChild(track);
  
  // Fix: makeModal() returns modal which is already inside overlay
  // Just append content directly to modal
  modal.appendChild(content);
  
  // Get the overlay parent and append to body
  var overlay = modal.parentElement;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

// ══════════════════════════════════════════════════════════════════════════
// DAILY BINGO SYSTEM
// ══════════════════════════════════════════════════════════════════════════

var BINGO_TASKS = [
  { id: 'feed_pet', name: '🍖 Feed Pet', target: 5, taskType: 'feed_pet', rewardPoints: 50 },
  { id: 'play_pet', name: '🎾 Play with Pet', target: 5, taskType: 'play_pet', rewardPoints: 50 },
  { id: 'win_battle', name: '⚔️ Win Battle', target: 3, taskType: 'win_battle', rewardPoints: 100 },
  { id: 'login', name: '📅 Daily Login', target: 1, taskType: 'login', rewardPoints: 20 },
  { id: 'visit_shop', name: '🛒 Visit Shop', target: 1, taskType: 'visit_shop', rewardPoints: 20 },
  { id: 'use_treat', name: '🍬 Feed Treat', target: 3, taskType: 'use_treat', rewardPoints: 50 },
  { id: 'pet_companion', name: '💬 Pet Companion', target: 5, taskType: 'pet_companion', rewardPoints: 50 },
  { id: 'earn_points', name: '💰 Earn 500 PP', target: 500, taskType: 'earn_points', rewardPoints: 100 },
  { id: 'level_up_pet', name: '⬆️ Level Up Pet', target: 1, taskType: 'level_up_pet', rewardPoints: 100 },
  { id: 'adopt_pet', name: '🐣 Adopt a Pet', target: 1, taskType: 'adopt_pet', rewardPoints: 150 },
  { id: 'use_toy', name: '🎾 Use a Toy', target: 3, taskType: 'use_toy', rewardPoints: 50 },
  { id: 'complete_minigame', name: '🎮 Play Minigame', target: 1, taskType: 'complete_minigame', rewardPoints: 75 }
];

var dailyBingo = {
  date: null,
  squares: [],
  completedLines: [],
  blackoutCompleted: false
};

// Load daily bingo from localStorage
function loadDailyBingo() {
  var today = new Date().toISOString().split('T')[0];
  var saved = localStorage.getItem('daily_bingo');
  
  if (saved) {
    var parsed = JSON.parse(saved);
    if (parsed.date === today) {
      dailyBingo = parsed;
      
      // Mark all already-completed squares as notified (prevent spam on page load)
      dailyBingo.squares.forEach(function(square) {
        if (square.completed) {
          var notificationKey = dailyBingo.date + '_' + square.taskType;
          bingoNotificationsShown[notificationKey] = true;
        }
      });
      
      return;
    }
  }
  
  // New day - generate new bingo
  dailyBingo = {
    date: today,
    squares: generateDailyBingo(),
    completedLines: [],
    blackoutCompleted: false
  };
  
  // Reset notifications for new day
  bingoNotificationsShown = {};
  
  saveDailyBingo();
}

// Generate random 4x3 bingo grid (12 squares)
function generateDailyBingo() {
  var shuffled = BINGO_TASKS.slice();
  for (var i = shuffled.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  
  return shuffled.slice(0, 12).map(function(task) {
    return {
      id: task.id,
      name: task.name,
      target: task.target,
      taskType: task.taskType,
      rewardPoints: task.rewardPoints,
      progress: 0,
      completed: false
    };
  });
}

// Save bingo to localStorage
function saveDailyBingo() {
  localStorage.setItem('daily_bingo', JSON.stringify(dailyBingo));
}

// Track which squares have been notified to prevent spam
var bingoNotificationsShown = {};

// Update bingo progress
async function updateBingoProgress(taskType, amount) {
  if (!currentUser) return;
  
  loadDailyBingo();
  
  var square = dailyBingo.squares.find(function(s) { return s.taskType === taskType; });
  if (!square || square.completed) return;
  
  var wasCompleted = square.completed;
  square.progress = Math.min(square.progress + (amount || 1), square.target);
  
  // Check if just completed
  var justCompleted = !wasCompleted && square.progress >= square.target;
  
  if (justCompleted) {
    square.completed = true;
    
    // Create unique notification key for today + this task
    var notificationKey = dailyBingo.date + '_' + taskType;
    
    // Only notify if we haven't already today
    if (!bingoNotificationsShown[notificationKey]) {
      bingoNotificationsShown[notificationKey] = true;
      
      // Award points
      updateAllPoints(currentPoints + square.rewardPoints);
      await supabaseClient.rpc('award_pp_secure', {
        p_user_id: currentUser.id,
        p_amount: square.rewardPoints,
        p_reason: 'Bingo: ' + square.name
      });
      
      // Award Pass XP
      await addPassXP(15, 'bingo_square');
      
      showToast('✓ Bingo: ' + square.name + ' complete! +' + square.rewardPoints + ' PP, +15 XP', 'success');
      playSound('success');
      
      // Check for lines
      await checkBingoLines();
    }
  }
  
  saveDailyBingo();
  updateBingoUI();
}

// Check for bingo lines (4x3 grid = 10 lines total)
async function checkBingoLines() {
  var grid = dailyBingo.squares;
  
  // 4x3 grid layout: 3 rows, 4 columns, 2 diagonals = 10 lines
  var lines = [
    [0,1,2,3], [4,5,6,7], [8,9,10,11],  // 3 horizontal rows
    [0,4,8], [1,5,9], [2,6,10], [3,7,11],  // 4 vertical columns
    [0,5,10], [3,6,9]  // 2 diagonals
  ];
  
  for (var idx = 0; idx < lines.length; idx++) {
    var line = lines[idx];
    var lineKey = 'line_' + idx;
    
    if (!dailyBingo.completedLines.includes(lineKey)) {
      var allCompleted = line.every(function(cell) { return grid[cell] && grid[cell].completed; });
      
      if (allCompleted) {
        dailyBingo.completedLines.push(lineKey);
        
        // Award line bonus
        updateAllPoints(currentPoints + 100);
        await supabaseClient.rpc('award_pp_secure', {
          p_user_id: currentUser.id,
          p_amount: 100,
          p_reason: 'Bingo Line Complete'
        });
        
        await addPassXP(50, 'bingo_line');
        
        showToast('🎯 Bingo Line Complete! +100 PP, +50 XP', 'success');
        playSound('victory');
      }
    }
  }
  
  // Check blackout (all 12 squares complete)
  if (!dailyBingo.blackoutCompleted && dailyBingo.squares.every(function(s) { return s.completed; })) {
    dailyBingo.blackoutCompleted = true;
    
    // Award blackout bonus
    updateAllPoints(currentPoints + 500);
    await supabaseClient.rpc('award_pp_secure', {
      p_user_id: currentUser.id,
      p_amount: 500,
      p_reason: 'Bingo Blackout!'
    });
    
    await addPassXP(200, 'bingo_blackout');
    
    // Check if this is the FIRST blackout of the week
    var weekKey = getWeekNumberKey();
    var hasClaimedWeeklySkinKey = localStorage.getItem(weekKey) === 'true';
    
    if (!hasClaimedWeeklySkinKey) {
      // First blackout of the week - award Skin Key!
      await addItemToInventory('00000000-0000-0000-0000-000000000001', 1);
      localStorage.setItem(weekKey, 'true');
      showToast('🏆 WEEKLY BLACKOUT! +500 PP, +200 XP, +1 Skin Key!', 'success');
    } else {
      // Additional blackout this week - no Skin Key
      showToast('🏆 BLACKOUT BINGO! +500 PP, +200 XP', 'success');
    }
    
    playSound('jackpot');
    createConfettiBurst(window.innerWidth / 2, window.innerHeight / 2);
  }
  
  saveDailyBingo();
}

// Get week number key for weekly Skin Key tracking
function getWeekNumberKey() {
  var now = new Date();
  var start = new Date(now.getFullYear(), 0, 1);
  var days = Math.floor((now - start) / (24 * 60 * 60 * 1000));
  var weekNum = Math.ceil(days / 7);
  return 'bingo_blackout_week_' + weekNum + '_' + now.getFullYear();
}
    
// Update bingo UI
function updateBingoUI() {
  var completionDisplay = document.getElementById('bingo-completion');
  if (completionDisplay) {
    var completed = dailyBingo.squares.filter(function(s) { return s.completed; }).length;
    completionDisplay.textContent = completed + '/12';  // Updated for 4x3 grid
  }
}

// Show bingo modal
function showBingoModal() {
  loadDailyBingo();
  
  var modal = makeModal();
  modal.classList.add('bingo-modal');
  
  var content = makeEl('div', {class: 'bingo-modal-content'});
  content.style.cssText = 'padding:20px;max-width:700px;';
  
  // Header
  var header = makeEl('div');
  header.style.cssText = 'text-align:center;margin-bottom:20px;';
  var completed = dailyBingo.squares.filter(function(s) { return s.completed; }).length;
  var weekKey = getWeekNumberKey();
  var hasClaimedWeeklySkinKey = localStorage.getItem(weekKey) === 'true';
  var skinKeyStatus = hasClaimedWeeklySkinKey ? '(claimed this week)' : '(available!)';
  
  header.innerHTML = '<h2 style="color:var(--purple);margin-bottom:10px;">🎯 Daily Bingo</h2>' +
    '<div style="font-size:1.1rem;color:var(--text);">Completed: ' + completed + ' / 12</div>' +
    '<div style="font-size:0.9rem;color:var(--text-light);margin-top:5px;">Lines: ' + dailyBingo.completedLines.length + ' / 10 • Blackout: ' + (dailyBingo.blackoutCompleted ? '✓' : '✗') + '</div>' +
    '<div style="font-size:0.85rem;color:#ff6b35;margin-top:5px;">🔑 Weekly Blackout Bonus: ' + skinKeyStatus + '</div>';
  content.appendChild(header);
  
  // Bingo grid (4x3)
  var grid = makeEl('div');
  grid.id = 'bingo-grid';
  grid.className = 'bingo-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;padding:10px;';
  
  dailyBingo.squares.forEach(function(square) {
    var card = makeEl('div');
    card.className = 'bingo-card' + (square.completed ? ' bingo-completed' : '');
    card.style.cssText = 'background:' + (square.completed ? 'rgba(76,175,80,0.25)' : 'rgba(255,255,255,0.08)') + ';border:2px solid ' + (square.completed ? '#4CAF50' : 'rgba(255,255,255,0.1)') + ';border-radius:12px;padding:15px;text-align:center;min-height:120px;display:flex;flex-direction:column;justify-content:center;align-items:center;transition:all 0.3s;';
    
    // Extract icon from task name (e.g., "🍖 Feed Pet" -> "🍖")
    var iconMatch = square.name.match(/^([^\s]+)/);
    var icon = iconMatch ? iconMatch[1] : '📌';
    var displayName = square.name.replace(/^[^\s]+\s*/, ''); // Remove icon from name
    
    var iconDiv = makeEl('div');
    iconDiv.className = 'bingo-icon';
    iconDiv.style.cssText = 'font-size:28px;margin-bottom:8px;line-height:1;';
    iconDiv.textContent = icon;
    card.appendChild(iconDiv);
    
    var name = makeEl('div');
    name.className = 'bingo-name';
    name.style.cssText = 'font-size:12px;font-weight:bold;color:#ffffff;margin-bottom:8px;';
    name.textContent = displayName;
    card.appendChild(name);
    
    var progress = makeEl('div');
    progress.className = 'bingo-progress';
    progress.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:6px;';
    progress.textContent = square.progress + ' / ' + square.target;
    card.appendChild(progress);
    
    // Progress bar
    var progressPercent = (square.progress / square.target) * 100;
    var barContainer = makeEl('div');
    barContainer.className = 'bingo-bar';
    barContainer.style.cssText = 'background:rgba(255,255,255,0.15);border-radius:4px;height:4px;overflow:hidden;width:100%;';
    
    var barFill = makeEl('div');
    barFill.className = 'bingo-fill';
    barFill.style.cssText = 'width:' + progressPercent + '%;background:linear-gradient(90deg,#ff6b35,#ffaa44);height:100%;transition:width 0.3s ease;';
    barContainer.appendChild(barFill);
    card.appendChild(barContainer);
    
    if (square.completed) {
      var check = makeEl('div');
      check.className = 'bingo-check';
      check.style.cssText = 'font-size:20px;color:#4CAF50;margin-top:6px;font-weight:bold;';
      check.textContent = '✓';
      card.appendChild(check);
    }
    
    grid.appendChild(card);
  });
  
  content.appendChild(grid);
  
  // Rewards info
  var info = makeEl('div');
  info.style.cssText = 'background:#f9f9f9;border-radius:8px;padding:15px;font-size:0.9rem;color:var(--text-light);';
  info.innerHTML = '<strong>Rewards:</strong><br>' +
    '• Each square: +Points +15 Pass XP<br>' +
    '• Each line (4 in a row): +100 PP +50 XP<br>' +
    '• Blackout (all 12): +500 PP +200 XP<br>' +
    '• <strong>Weekly Bonus:</strong> First blackout of the week = +1 Skin Key 🔑';
  content.appendChild(info);
  
  // Fix: makeModal() returns modal which is already inside overlay
  modal.appendChild(content);
  
  // Get the overlay parent and append to body
  var overlay = modal.parentElement;
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}


// ══════════════════════════════════════════════════════════════════════════
// ADDITIONAL BINGO HOOKS (called from various places)
// ══════════════════════════════════════════════════════════════════════════

// Hook for points earned - override updateAllPoints
var originalUpdateAllPoints = updateAllPoints;
updateAllPoints = function(pts) {
  var oldPoints = currentPoints || 0;
  originalUpdateAllPoints(pts);
  var earnedAmount = pts - oldPoints;
  if (earnedAmount > 0) {
    updateBingoProgress('earn_points', earnedAmount);
  }
};

// Hook for pet level up - call this when a pet levels up
function onPetLevelUp(petId) {
  updateBingoProgress('level_up_pet', 1);
  
  // Award Pass XP bonus for leveling up
  addPassXP(10, 'feed'); // Counts toward feed cap
}

// Hook for adoption - call this when adopting a pet
function onPetAdopted(petId) {
  updateBingoProgress('adopt_pet', 1);
}

// Hook for minigame completion
function onMinigameComplete() {
  updateBingoProgress('complete_minigame', 1);
}

// Hook for companion pet message
function onCompanionMessage() {
  updateBingoProgress('pet_companion', 1);
}


// ══════════════════════════════════════════════════════════════════════════
// STATISTICS PAGE LOADER (BUG FIX #3)
// ══════════════════════════════════════════════════════════════════════════

async function loadStatistics() {
  console.log('📊 Loading statistics...');
  var container = el('stats-container');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<div class="spinner"></div>';
  
  try {
    if (!currentUser) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-light);"><p>Please log in to view statistics.</p></div>';
      return;
    }
    
    // Fetch user stats from database
    var { data: playerData, error: playerError } = await supabaseClient
      .from('players')
      .select('*')
      .eq('id', currentUser.id)
      .single();
    
    if (playerError) throw playerError;
    
    // Fetch pet stats
    var { data: petsData, error: petsError } = await supabaseClient
      .from('user_pets')
      .select('*')
      .eq('user_id', currentUser.id);
    
    if (petsError) throw petsError;
    
    // Fetch battle stats
    var { data: battlesData, error: battlesError } = await supabaseClient
      .from('battle_history')
      .select('*')
      .eq('user_id', currentUser.id);
    
    // Calculate stats
    var totalPets = petsData ? petsData.length : 0;
    var totalBattles = battlesData ? battlesData.length : 0;
    var battlesWon = battlesData ? battlesData.filter(function(b) { return b.winner_id === currentUser.id; }).length : 0;
    var winRate = totalBattles > 0 ? Math.round((battlesWon / totalBattles) * 100) : 0;
    
    var totalPoints = playerData ? (playerData.pawketpoints || 0) : 0;
    var loginStreak = playerData ? (playerData.login_streak || 0) : 0;
    var highestLevel = petsData && petsData.length > 0 ? Math.max.apply(Math, petsData.map(function(p) { return p.level || 1; })) : 0;
    
    // Render stats
    container.innerHTML = `
      <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:20px;margin-top:30px;">
        
        <div class="stat-card" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">🐾</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${totalPets}</div>
          <div style="font-size:1rem;opacity:0.9;">Total Pets Adopted</div>
        </div>
        
        <div class="stat-card" style="background:linear-gradient(135deg,#f093fb 0%,#f5576c 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">⚔️</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${battlesWon}/${totalBattles}</div>
          <div style="font-size:1rem;opacity:0.9;">Battles Won (${winRate}%)</div>
        </div>
        
        <div class="stat-card" style="background:linear-gradient(135deg,#4facfe 0%,#00f2fe 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">💰</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${totalPoints.toLocaleString()}</div>
          <div style="font-size:1rem;opacity:0.9;">PawketPoints Earned</div>
        </div>
        
        <div class="stat-card" style="background:linear-gradient(135deg,#43e97b 0%,#38f9d7 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">🔥</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${loginStreak}</div>
          <div style="font-size:1rem;opacity:0.9;">Day Login Streak</div>
        </div>
        
        <div class="stat-card" style="background:linear-gradient(135deg,#fa709a 0%,#fee140 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">⬆️</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${highestLevel}</div>
          <div style="font-size:1rem;opacity:0.9;">Highest Pet Level</div>
        </div>
        
        <div class="stat-card" style="background:linear-gradient(135deg,#30cfd0 0%,#330867 100%);color:white;padding:30px;border-radius:16px;text-align:center;">
          <div style="font-size:3rem;margin-bottom:10px;">📅</div>
          <div style="font-size:2.5rem;font-weight:bold;margin-bottom:5px;">${playerData && playerData.created_at ? new Date(playerData.created_at).toLocaleDateString() : 'N/A'}</div>
          <div style="font-size:1rem;opacity:0.9;">Member Since</div>
        </div>
        
      </div>
      
      <div style="text-align:center;margin-top:40px;padding:30px;background:rgba(255,255,255,0.05);border-radius:16px;">
        <p style="font-size:1.1rem;margin-bottom:15px;">🎮 Keep playing to improve your stats!</p>
        <p style="color:var(--text-light);">Adopt more pets, win battles, and log in daily to climb the leaderboards!</p>
      </div>
    `;
    
    console.log('✅ Statistics loaded successfully');
    
  } catch (error) {
    console.error('❌ Statistics loading error:', error);
    container.innerHTML = `
      <div style="text-align:center;padding:40px;">
        <p style="color:#ff6b6b;font-size:1.2rem;margin-bottom:10px;">⚠️ Failed to load statistics</p>
        <p style="color:var(--text-light);">Please try again later or contact support if the issue persists.</p>
        <button class="btn btn-primary" onclick="loadStatistics()" style="margin-top:20px;">🔄 Retry</button>
      </div>
    `;
  }
}


// ══════════════════════════════════════════════════════════════════════════
// SCRAPBOOK SYSTEM - COMPLETE IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════

// Memory templates
var SCRAPBOOK_TEMPLATES = {
    adopted: [
        '{pet} found a forever home with {trainer}!',
        '{pet} was adopted and joined the Pawket family!',
        'A new journey begins for {pet} with {trainer}!'
    ],
    first_battle_win: [
        '{pet} won their first battle against {enemy}!',
        '{pet} defeated {enemy} for the very first time!',
        'Victory! {pet} triumphed over {enemy}!'
    ],
    first_battle_loss: [
        '{pet} lost to {enemy} but learned a valuable lesson.',
        '{pet} gained experience from defeat against {enemy}.',
        '{enemy} proved tough, but {pet} will try again!'
    ],
    level_milestone: [
        '{pet} reached level {level}! Growing stronger every day!',
        'Level {level} achieved for {pet}! More adventures await!',
        '{pet} hit level {level} - what a journey so far!'
    ],
    favorite_food: [
        '{pet} discovered they absolutely LOVE {food}!',
        '{pet} went crazy for {food} - new favorite discovered!',
        '{pet} tried {food} and couldn\'t get enough!'
    ],
    low_hp_victory: [
        '{pet} won a battle with only {hp} HP remaining! Such determination!',
        '{pet} pulled through a tough fight with {hp} HP left!',
        'Against all odds, {pet} survived with {hp} HP!'
    ],
    random_flavor: [
        '{pet} enjoyed a peaceful afternoon in the sun.',
        '{pet} played with other pets at the park.',
        '{pet} found a hidden treasure while exploring!',
        '{pet} made a new friend during their adventures.',
        '{pet} had a relaxing day by the pond.',
        '{pet} chased butterflies in the meadow.',
        '{pet} watched the sunset with their trainer.',
        '{pet} discovered a mysterious hidden cave.'
    ]
};

// Cooldown tracker
var scrapbook_cooldowns = {};

// Load cooldowns from localStorage
function scrapbook_loadCooldowns() {
    var saved = localStorage.getItem('scrapbook_cooldowns');
    if (saved) {
        try {
            scrapbook_cooldowns = JSON.parse(saved);
        } catch(e) {
            scrapbook_cooldowns = {};
        }
    }
}

// Save cooldowns
function scrapbook_saveCooldowns() {
    localStorage.setItem('scrapbook_cooldowns', JSON.stringify(scrapbook_cooldowns));
}

// Check cooldown
function scrapbook_onCooldown(petId, memoryType, cooldownHours) {
    var key = petId + '_' + memoryType;
    var lastTime = scrapbook_cooldowns[key];
    if (!lastTime) return false;
    var now = Date.now();
    var hoursSince = (now - lastTime) / (1000 * 60 * 60);
    return hoursSince < cooldownHours;
}

// Set cooldown
function scrapbook_setCooldown(petId, memoryType) {
    var key = petId + '_' + memoryType;
    scrapbook_cooldowns[key] = Date.now();
    scrapbook_saveCooldowns();
}

// Check if pet already has a memory type
async function scrapbook_hasMemory(userPetId, memoryType) {
    if (!userPetId || !memoryType) return false;
    var res = await supabaseClient
        .from('pet_memories')
        .select('id')
        .eq('user_pet_id', userPetId)
        .eq('memory_type', memoryType)
        .limit(1);
    if (res.error) return false;
    return res.data && res.data.length > 0;
}

// Add a memory
async function scrapbook_addMemory(userPetId, memoryType, variables) {
    if (!userPetId || !memoryType) {
        console.error('Scrapbook: missing petId or memoryType');
        return false;
    }
    
    variables = variables || {};
    
    // Cooldown settings (hours)
    var cooldownSettings = {
        'random_flavor': 24,
        'low_hp_victory': 24
    };
    var cooldownHours = cooldownSettings[memoryType] || 0;
    
    if (cooldownHours > 0 && scrapbook_onCooldown(userPetId, memoryType, cooldownHours)) {
        return false;
    }
    
    // Check once-per-pet memories
    var oncePerPet = ['adopted', 'first_battle_win', 'first_battle_loss'];
    if (oncePerPet.indexOf(memoryType) >= 0) {
        var exists = await scrapbook_hasMemory(userPetId, memoryType);
        if (exists) return false;
    }
    
    // Get pet name
    var petName = 'Your pet';
    if (window.petState && window.petState[userPetId]) {
        petName = window.petState[userPetId].name || 
                  window.petState[userPetId].pet_name || 
                  (window.petState[userPetId].pets && window.petState[userPetId].pets.name) ||
                  'Your pet';
    }
    
    // Get trainer name
    var trainerName = 'their trainer';
    if (window.currentUser) {
        trainerName = window.currentUser.username || 
                      (window.currentUser.user_metadata && window.currentUser.user_metadata.username) ||
                      'their trainer';
    }
    
    // Get templates
    var templates = SCRAPBOOK_TEMPLATES[memoryType];
    if (!templates) {
        console.error('Scrapbook: unknown memory type', memoryType);
        return false;
    }
    
    // Generate random template
    var memoryText = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace variables
    memoryText = memoryText.replace(/{pet}/g, petName);
    memoryText = memoryText.replace(/{trainer}/g, trainerName);
    memoryText = memoryText.replace(/{enemy}/g, variables.enemy || 'an enemy');
    memoryText = memoryText.replace(/{level}/g, variables.level || '?');
    memoryText = memoryText.replace(/{food}/g, variables.food || 'a treat');
    memoryText = memoryText.replace(/{hp}/g, variables.hp || 'low');
    
    // Save to database
    try {
        var res = await supabaseClient
            .from('pet_memories')
            .insert({
                user_pet_id: userPetId,
                memory_text: memoryText,
                memory_type: memoryType
            });
        
        if (res.error) {
            console.error('Scrapbook insert error:', res.error);
            return false;
        }
        
        // Set cooldown
        if (cooldownHours > 0) {
            scrapbook_setCooldown(userPetId, memoryType);
        }
        
        // Refresh UI if this pet's modal is open
        if (window.scrapbook_currentPetId === userPetId) {
            scrapbook_refreshMemories(userPetId);
        }
        
        console.log('📖 Scrapbook: ' + memoryText);
        return true;
        
    } catch(e) {
        console.error('Scrapbook error:', e);
        return false;
    }
}

// Add random daily memory
async function scrapbook_addRandomMemory(petId) {
    var today = new Date().toISOString().split('T')[0];
    var key = 'sb_random_' + petId + '_' + today;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, 'true');
    return await scrapbook_addMemory(petId, 'random_flavor', {});
}

// Load memories
async function scrapbook_loadMemories(userPetId, limit) {
    if (!userPetId) return [];
    limit = limit || 15;
    var res = await supabaseClient
        .from('pet_memories')
        .select('memory_text, memory_type, created_at')
        .eq('user_pet_id', userPetId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (res.error) {
        console.error('Load memories error:', res.error);
        return [];
    }
    return res.data || [];
}

// Format date
function scrapbook_formatDate(dateString) {
    var date = new Date(dateString);
    var now = new Date();
    var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return diffDays + ' days ago';
    if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
    return date.toLocaleDateString();
}

// Refresh UI
async function scrapbook_refreshMemories(userPetId) {
    var container = document.getElementById('sb-memories-container');
    if (!container) return;
    var memories = await scrapbook_loadMemories(userPetId);
    if (memories.length === 0) {
        container.innerHTML = '<div class="sb-empty">📖 No memories yet. Go make some adventures!</div>';
        return;
    }
    container.innerHTML = memories.map(function(mem) {
        var escapedText = escapeHtml(mem.memory_text);
        return '<div class="sb-memory-card">' +
            '<div class="sb-memory-date">📅 ' + scrapbook_formatDate(mem.created_at) + '</div>' +
            '<div class="sb-memory-text">💭 ' + escapedText + '</div>' +
            '</div>';
    }).join('');
}

// Initialize
function scrapbook_init() {
    scrapbook_loadCooldowns();
    console.log('📖 Scrapbook system initialized');
}


// ══════════════════════════════════════════════════════════════════════════
// COMMUNITY GOALS SYSTEM - COMPLETE IMPLEMENTATION
// ══════════════════════════════════════════════════════════════════════════

// Cache for community goals
var community_cachedGoals = null;
var community_lastFetch = 0;
var community_pendingUpdates = {};
var community_syncInterval = null;
var community_claimedGoalIds = [];

// Load goals (cached for 5 minutes)
async function community_loadGoals() {
    var now = Date.now();
    if (community_cachedGoals && (now - community_lastFetch) < 300000) {
        return community_cachedGoals;
    }
    var res = await supabaseClient
        .from('community_goals')
        .select('*')
        .eq('is_active', true)
        .eq('is_completed', false);
    if (!res.error && res.data) {
        community_cachedGoals = res.data;
        community_lastFetch = now;
        await community_loadUserClaims();
        community_refreshUI();
    }
    return community_cachedGoals || [];
}

// Load user's claimed goals
async function community_loadUserClaims() {
    if (!currentUser) {
        community_claimedGoalIds = [];
        return;
    }
    var res = await supabaseClient
        .from('community_goal_claims')
        .select('goal_id')
        .eq('user_id', currentUser.id);
    if (!res.error && res.data) {
        community_claimedGoalIds = res.data.map(function(c) { return c.goal_id; });
    }
}

// Increment goal progress (local, batched)
function community_increment(goalKey, amount, metadata) {
    if (!goalKey) return;
    amount = amount || 1;
    metadata = metadata || {};
    community_pendingUpdates[goalKey] = (community_pendingUpdates[goalKey] || 0) + amount;
    
    // Update UI immediately
    community_updateLocalProgress(goalKey, community_pendingUpdates[goalKey]);
    
    // Schedule sync (every 10 seconds or after 10 increments)
    if (!community_syncInterval) {
        community_syncInterval = setInterval(community_syncToDatabase, 10000);
    }
    var totalPending = Object.keys(community_pendingUpdates).reduce(function(sum, key) {
        return sum + community_pendingUpdates[key];
    }, 0);
    if (totalPending >= 10) {
        community_syncToDatabase();
    }
}

// Sync pending updates to database
async function community_syncToDatabase() {
    if (Object.keys(community_pendingUpdates).length === 0) return;
    var updates = {};
    for (var key in community_pendingUpdates) {
        updates[key] = community_pendingUpdates[key];
    }
    community_pendingUpdates = {};
    
    for (var goalKey in updates) {
        var increment = updates[goalKey];
        try {
            var res = await supabaseClient.rpc('increment_goal_progress', {
                p_goal_key: goalKey,
                p_amount: increment
            });
            if (res.error) console.error('Sync error:', res.error);
        } catch(e) {
            console.error('RPC error:', e);
            // Put back for retry
            community_pendingUpdates[goalKey] = (community_pendingUpdates[goalKey] || 0) + increment;
        }
    }
    community_cachedGoals = null;
    community_loadGoals();
}

// Update local progress display
function community_updateLocalProgress(goalKey, increment) {
    if (!community_cachedGoals) return;
    var goal = community_cachedGoals.find(function(g) { return g.goal_key === goalKey; });
    if (!goal) return;
    var current = goal.current_progress || 0;
    var percent = Math.min(100, ((current + increment) / goal.goal_target) * 100);
    var progressBar = document.querySelector('.com-progress-' + goalKey);
    var progressText = document.querySelector('.com-text-' + goalKey);
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = (current + increment) + '/' + goal.goal_target;
}

// Refresh entire UI
async function community_refreshUI() {
    var goals = await community_loadGoals();
    var container = document.getElementById('com-goals-container');
    if (!container || !goals.length) {
        if (container) container.innerHTML = '<div class="com-loading">Loading community goals...</div>';
        return;
    }
    
    container.innerHTML = goals.map(function(goal) {
        var progress = goal.current_progress || 0;
        var percent = (progress / goal.goal_target) * 100;
        var isCompleted = progress >= goal.goal_target;
        var isClaimed = community_claimedGoalIds.indexOf(goal.id) >= 0;
        var endsAt = goal.ends_at ? new Date(goal.ends_at).toLocaleDateString() : 'soon';
        
        var rewardDisplay = '';
        if (goal.reward_type === 'points') rewardDisplay = '💰 ' + goal.reward_value + ' PawketPoints';
        else if (goal.reward_type === 'items') rewardDisplay = '📦 ' + goal.reward_value;
        else if (goal.reward_type === 'title') rewardDisplay = '🏆 Title: "' + goal.reward_value + '"';
        else rewardDisplay = '🎁 ' + goal.reward_value;
        
        var btnHtml = '';
        if (isCompleted && !isClaimed) {
            btnHtml = '<button class="com-claim-btn" data-goal-id="' + goal.id + '" data-goal-key="' + goal.goal_key + '">🎁 Claim Reward</button>';
        } else if (isClaimed) {
            btnHtml = '<div class="com-claimed">✓ Reward Claimed</div>';
        } else {
            btnHtml = '<div class="com-progress-status">📊 ' + Math.round(percent) + '% complete</div>';
        }
        
        return '<div class="com-goal-card">' +
            '<div class="com-goal-title">' + escapeHtml(goal.title) + '</div>' +
            '<div class="com-goal-desc">' + escapeHtml(goal.description) + '</div>' +
            '<div class="com-progress-bar">' +
            '<div class="com-progress-fill com-progress-' + goal.goal_key + '" style="width:' + percent + '%"></div>' +
            '</div>' +
            '<div class="com-progress-text com-text-' + goal.goal_key + '">' +
            progress.toLocaleString() + '/' + goal.goal_target.toLocaleString() +
            '</div>' +
            '<div class="com-reward">🎁 Reward: ' + rewardDisplay + '</div>' +
            '<div class="com-time-left">⏰ Ends: ' + endsAt + '</div>' +
            btnHtml +
            '</div>';
    }).join('');
    
    var claimButtons = document.querySelectorAll('.com-claim-btn');
    for (var i = 0; i < claimButtons.length; i++) {
        claimButtons[i].removeEventListener('click', community_handleClaim);
        claimButtons[i].addEventListener('click', community_handleClaim);
    }
}

// Handle reward claim
async function community_handleClaim(e) {
    var btn = e.currentTarget;
    var goalId = parseInt(btn.dataset.goalId);
    var goalKey = btn.dataset.goalKey;
    if (!goalId || !currentUser) return;
    
    if (community_claimedGoalIds.indexOf(goalId) >= 0) {
        community_showToast('Reward already claimed!', 'warning');
        return;
    }
    
    var goal = community_cachedGoals ? community_cachedGoals.find(function(g) { return g.id === goalId; }) : null;
    if (!goal || goal.current_progress < goal.goal_target) {
        community_showToast('Goal not completed yet!', 'error');
        return;
    }
    
    var success = await community_grantReward(goal);
    if (success) {
        var res = await supabaseClient
            .from('community_goal_claims')
            .insert({ goal_id: goalId, user_id: currentUser.id });
        if (!res.error) {
            community_claimedGoalIds.push(goalId);
            community_showToast('🎉 Reward claimed: ' + community_formatRewardText(goal), 'success');
            community_refreshUI();
        }
    }
}

// Grant reward based on type
async function community_grantReward(goal) {
    var reward = goal.reward_value;
    var type = goal.reward_type;
    
    try {
        if (type === 'points') {
            var amount = parseInt(reward);
            // Add points (use your existing function)
            if (typeof addPawketPoints === 'function') {
                addPawketPoints(amount);
            } else if (typeof updateAllPoints === 'function') {
                updateAllPoints(currentPoints + amount);
            }
            return true;
        }
        if (type === 'items') {
            var items = reward.split(',');
            for (var i = 0; i < items.length; i++) {
                var parts = items[i].split(':');
                var itemId = parts[0];
                var quantity = parseInt(parts[1]) || 1;
                if (typeof addItemToInventory === 'function') {
                    await addItemToInventory(itemId, quantity);
                }
            }
            return true;
        }
        if (type === 'title') {
            if (typeof unlockTitle === 'function') {
                await unlockTitle(reward);
            }
            return true;
        }
        return false;
    } catch(e) {
        console.error('Reward grant error:', e);
        return false;
    }
}

// Format reward text for toast
function community_formatRewardText(goal) {
    if (goal.reward_type === 'points') return goal.reward_value + ' PawketPoints';
    if (goal.reward_type === 'items') return goal.reward_value;
    if (goal.reward_type === 'title') return 'Title: "' + goal.reward_value + '"';
    return goal.reward_value;
}

// Show toast notification
function community_showToast(message, type) {
    type = type || 'info';
    if (typeof showToast === 'function') {
        showToast(message, type);
    } else if (typeof showNotification === 'function') {
        showNotification(message);
    } else {
        console.log('[Community] ' + message);
        var toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 20px;border-radius:8px;z-index:9999;';
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3000);
    }
}

// Initialize community system
function community_init() {
    community_loadGoals();
    setInterval(function() { community_loadGoals(); }, 300000);
    window.addEventListener('beforeunload', function() {
        if (Object.keys(community_pendingUpdates).length > 0) {
            community_syncToDatabase();
        }
    });
    console.log('🌍 Community Goals system initialized');
}


// ════════════════════════════════════════════════════════════════════════════
// SCRAPBOOK SYSTEM - COMPLETE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════

// Memory templates
var SCRAPBOOK_TEMPLATES = {
  adopted: [
    '{pet} found a forever home with {trainer}!',
    '{pet} was adopted and joined the Pawket family!',
    'A new journey begins for {pet} with {trainer}!'
  ],
  first_battle_win: [
    '{pet} won their first battle against {enemy}!',
    '{pet} defeated {enemy} for the very first time!',
    'Victory! {pet} triumphed over {enemy}!'
  ],
  first_battle_loss: [
    '{pet} lost to {enemy} but learned a valuable lesson.',
    '{pet} gained experience from defeat against {enemy}.',
    '{enemy} proved tough, but {pet} will try again!'
  ],
  level_milestone: [
    '{pet} reached level {level}! Growing stronger every day!',
    'Level {level} achieved for {pet}! More adventures await!',
    '{pet} hit level {level} - what a journey so far!'
  ],
  favorite_food: [
    '{pet} discovered they absolutely LOVE {food}!',
    '{pet} went crazy for {food} - new favorite discovered!',
    '{pet} tried {food} and couldn\'t get enough!'
  ],
  low_hp_victory: [
    '{pet} won a battle with only {hp} HP remaining! Such determination!',
    '{pet} pulled through a tough fight with {hp} HP left!',
    'Against all odds, {pet} survived with {hp} HP!'
  ],
  random_flavor: [
    '{pet} enjoyed a peaceful afternoon in the sun.',
    '{pet} played with other pets at the park.',
    '{pet} found a hidden treasure while exploring!',
    '{pet} made a new friend during their adventures.',
    '{pet} had a relaxing day by the pond.',
    '{pet} chased butterflies in the meadow.',
    '{pet} watched the sunset with their trainer.',
    '{pet} discovered a mysterious hidden cave.'
  ]
};

// Cooldown tracker
var scrapbook_cooldowns = {};

// Load cooldowns from localStorage
function scrapbook_loadCooldowns() {
  var saved = localStorage.getItem('scrapbook_cooldowns');
  if (saved) {
    try {
      scrapbook_cooldowns = JSON.parse(saved);
    } catch(e) {
      scrapbook_cooldowns = {};
    }
  }
}

// Save cooldowns
function scrapbook_saveCooldowns() {
  localStorage.setItem('scrapbook_cooldowns', JSON.stringify(scrapbook_cooldowns));
}

// Check cooldown
function scrapbook_onCooldown(petId, memoryType, cooldownHours) {
  cooldownHours = cooldownHours || 24;
  var key = petId + '_' + memoryType;
  var lastTime = scrapbook_cooldowns[key];
  if (!lastTime) return false;
  var now = Date.now();
  var hoursSince = (now - lastTime) / (1000 * 60 * 60);
  return hoursSince < cooldownHours;
}

// Set cooldown
function scrapbook_setCooldown(petId, memoryType) {
  var key = petId + '_' + memoryType;
  scrapbook_cooldowns[key] = Date.now();
  scrapbook_saveCooldowns();
}

// Check if pet already has a memory type
async function scrapbook_hasMemory(userPetId, memoryType) {
  if (!userPetId || !memoryType) return false;
  var { data, error } = await supabaseClient
    .from('pet_memories')
    .select('id')
    .eq('user_pet_id', userPetId)
    .eq('memory_type', memoryType)
    .limit(1);
  if (error) return false;
  return data && data.length > 0;
}

// Add a memory
async function scrapbook_addMemory(userPetId, memoryType, variables) {
  if (!userPetId || !memoryType) {
    console.error('Scrapbook: missing petId or memoryType');
    return false;
  }
  
  variables = variables || {};
  
  // Cooldown settings (hours)
  var cooldownSettings = {
    'random_flavor': 24,
    'low_hp_victory': 24
  };
  var cooldownHours = cooldownSettings[memoryType] || 0;
  
  if (cooldownHours > 0 && scrapbook_onCooldown(userPetId, memoryType, cooldownHours)) {
    return false;
  }
  
  // Check once-per-pet memories
  var oncePerPet = ['adopted', 'first_battle_win', 'first_battle_loss'];
  if (oncePerPet.indexOf(memoryType) !== -1) {
    var exists = await scrapbook_hasMemory(userPetId, memoryType);
    if (exists) return false;
  }
  
  // Get pet name
  var petName = 'Your pet';
  if (window.petState && window.petState[userPetId]) {
    petName = window.petState[userPetId].name || 
              window.petState[userPetId].pet_name || 
              (window.petState[userPetId].pets && window.petState[userPetId].pets.name) ||
              'Your pet';
  }
  
  // Get trainer name
  var trainerName = 'their trainer';
  if (window.currentUser) {
    trainerName = window.currentUser.username || 
                  (window.currentUser.user_metadata && window.currentUser.user_metadata.username) ||
                  'their trainer';
  }
  
  // Get templates
  var templates = SCRAPBOOK_TEMPLATES[memoryType];
  if (!templates) {
    console.error('Scrapbook: unknown memory type', memoryType);
    return false;
  }
  
  // Generate random template
  var memoryText = templates[Math.floor(Math.random() * templates.length)];
  
  // Replace variables
  memoryText = memoryText.replace(/{pet}/g, petName);
  memoryText = memoryText.replace(/{trainer}/g, trainerName);
  memoryText = memoryText.replace(/{enemy}/g, variables.enemy || 'an enemy');
  memoryText = memoryText.replace(/{level}/g, variables.level || '?');
  memoryText = memoryText.replace(/{food}/g, variables.food || 'a treat');
  memoryText = memoryText.replace(/{hp}/g, variables.hp || 'low');
  
  // Save to database
  try {
    var { error } = await supabaseClient
      .from('pet_memories')
      .insert({
        user_pet_id: userPetId,
        memory_text: memoryText,
        memory_type: memoryType
      });
    
    if (error) {
      console.error('Scrapbook insert error:', error);
      return false;
    }
    
    // Set cooldown
    if (cooldownHours > 0) {
      scrapbook_setCooldown(userPetId, memoryType);
    }
    
    // Refresh UI if this pet's modal is open
    if (window.scrapbook_currentPetId === userPetId) {
      scrapbook_refreshMemories(userPetId);
    }
    
    console.log('📖 Scrapbook: ' + memoryText);
    return true;
    
  } catch(e) {
    console.error('Scrapbook error:', e);
    return false;
  }
}

// Add random daily memory
async function scrapbook_addRandomMemory(petId) {
  var today = new Date().toISOString().split('T')[0];
  var key = 'sb_random_' + petId + '_' + today;
  if (localStorage.getItem(key)) return false;
  localStorage.setItem(key, 'true');
  return await scrapbook_addMemory(petId, 'random_flavor', {});
}

// Load memories
async function scrapbook_loadMemories(userPetId, limit) {
  limit = limit || 15;
  if (!userPetId) return [];
  var { data, error } = await supabaseClient
    .from('pet_memories')
    .select('memory_text, memory_type, created_at')
    .eq('user_pet_id', userPetId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('Load memories error:', error);
    return [];
  }
  return data || [];
}

// Format date
function scrapbook_formatDate(dateString) {
  var date = new Date(dateString);
  var now = new Date();
  var diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return diffDays + ' days ago';
  if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
  return date.toLocaleDateString();
}

// Escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// Refresh UI
async function scrapbook_refreshMemories(userPetId) {
  var container = document.getElementById('sb-memories-container');
  if (!container) return;
  var memories = await scrapbook_loadMemories(userPetId);
  if (memories.length === 0) {
    container.innerHTML = '<div class="sb-empty">📖 No memories yet. Go make some adventures!</div>';
    return;
  }
  container.innerHTML = memories.map(function(mem) {
    return '<div class="sb-memory-card">' +
           '<div class="sb-memory-date">📅 ' + scrapbook_formatDate(mem.created_at) + '</div>' +
           '<div class="sb-memory-text">💭 ' + escapeHtml(mem.memory_text) + '</div>' +
           '</div>';
  }).join('');
}

// Initialize
function scrapbook_init() {
  scrapbook_loadCooldowns();
  console.log('📖 Scrapbook system initialized');
}


// ════════════════════════════════════════════════════════════════════════════
// COMMUNITY GOALS SYSTEM - COMPLETE IMPLEMENTATION
// ════════════════════════════════════════════════════════════════════════════

// Cache for community goals
var community_cachedGoals = null;
var community_lastFetch = 0;
var community_pendingUpdates = {};
var community_syncInterval = null;
var community_claimedGoalIds = [];

// Load goals (cached for 5 minutes)
async function community_loadGoals() {
  var now = Date.now();
  if (community_cachedGoals && (now - community_lastFetch) < 300000) {
    return community_cachedGoals;
  }
  var { data, error } = await supabaseClient
    .from('community_goals')
    .select('*')
    .eq('is_active', true)
    .eq('is_completed', false);
  if (!error && data) {
    community_cachedGoals = data;
    community_lastFetch = now;
    await community_loadUserClaims();
    community_refreshUI();
  }
  return community_cachedGoals || [];
}

// Load user's claimed goals
async function community_loadUserClaims() {
  if (!window.currentUser) {
    community_claimedGoalIds = [];
    return;
  }
  var { data, error } = await supabaseClient
    .from('community_goal_claims')
    .select('goal_id')
    .eq('user_id', window.currentUser.id);
  if (!error && data) {
    community_claimedGoalIds = data.map(function(c) { return c.goal_id; });
  }
}

// Increment goal progress (local, batched)
function community_increment(goalKey, amount, metadata) {
  if (!goalKey) return;
  amount = amount || 1;
  metadata = metadata || {};
  community_pendingUpdates[goalKey] = (community_pendingUpdates[goalKey] || 0) + amount;
  
  // Update UI immediately
  community_updateLocalProgress(goalKey, community_pendingUpdates[goalKey]);
  
  // Schedule sync (every 10 seconds or after 10 increments)
  if (!community_syncInterval) {
    community_syncInterval = setInterval(community_syncToDatabase, 10000);
  }
  var totalPending = Object.values(community_pendingUpdates).reduce(function(a,b) { return a+b; }, 0);
  if (totalPending >= 10) {
    community_syncToDatabase();
  }
}

// Sync pending updates to database
async function community_syncToDatabase() {
  if (Object.keys(community_pendingUpdates).length === 0) return;
  var updates = Object.assign({}, community_pendingUpdates);
  community_pendingUpdates = {};
  
  for (var goalKey in updates) {
    var increment = updates[goalKey];
    try {
      var { error } = await supabaseClient.rpc('increment_goal_progress', {
        p_goal_key: goalKey,
        p_amount: increment
      });
      if (error) console.error('Sync error:', error);
    } catch(e) {
      console.error('RPC error:', e);
      // Put back for retry
      community_pendingUpdates[goalKey] = (community_pendingUpdates[goalKey] || 0) + increment;
    }
  }
  community_cachedGoals = null;
  community_loadGoals();
}

// Update local progress display
function community_updateLocalProgress(goalKey, increment) {
  if (!community_cachedGoals) return;
  var goal = community_cachedGoals.find(function(g) { return g.goal_key === goalKey; });
  if (!goal) return;
  var current = goal.current_progress || 0;
  var percent = Math.min(100, ((current + increment) / goal.goal_target) * 100);
  var progressBar = document.querySelector('.com-progress-' + goalKey);
  var progressText = document.querySelector('.com-text-' + goalKey);
  if (progressBar) progressBar.style.width = percent + '%';
  if (progressText) progressText.textContent = (current + increment) + '/' + goal.goal_target;
}

// Refresh entire UI
async function community_refreshUI() {
  var goals = await community_loadGoals();
  var container = document.getElementById('com-goals-container');
  if (!container || !goals.length) {
    if (container) container.innerHTML = '<div class="com-loading">Loading community goals...</div>';
    return;
  }
  
  container.innerHTML = goals.map(function(goal) {
    var progress = goal.current_progress || 0;
    var percent = (progress / goal.goal_target) * 100;
    var isCompleted = progress >= goal.goal_target;
    var isClaimed = community_claimedGoalIds.indexOf(goal.id) !== -1;
    var endsAt = goal.ends_at ? new Date(goal.ends_at).toLocaleDateString() : 'soon';
    
    var rewardDisplay = '';
    if (goal.reward_type === 'points') rewardDisplay = '💰 ' + goal.reward_value + ' PawketPoints';
    else if (goal.reward_type === 'items') rewardDisplay = '📦 ' + goal.reward_value;
    else if (goal.reward_type === 'title') rewardDisplay = '🏆 Title: "' + goal.reward_value + '"';
    else rewardDisplay = '🎁 ' + goal.reward_value;
    
    var html = '<div class="com-goal-card">' +
               '<div class="com-goal-title">' + escapeHtml(goal.title) + '</div>' +
               '<div class="com-goal-desc">' + escapeHtml(goal.description) + '</div>' +
               '<div class="com-progress-bar">' +
               '<div class="com-progress-fill com-progress-' + goal.goal_key + '" style="width: ' + percent + '%"></div>' +
               '</div>' +
               '<div class="com-progress-text com-text-' + goal.goal_key + '">' +
               progress.toLocaleString() + '/' + goal.goal_target.toLocaleString() +
               '</div>' +
               '<div class="com-reward">🎁 Reward: ' + rewardDisplay + '</div>' +
               '<div class="com-time-left">⏰ Ends: ' + endsAt + '</div>';
    
    if (isCompleted && !isClaimed) {
      html += '<button class="com-claim-btn" data-goal-id="' + goal.id + '" data-goal-key="' + goal.goal_key + '">🎁 Claim Reward</button>';
    } else if (isClaimed) {
      html += '<div class="com-claimed">✓ Reward Claimed</div>';
    } else {
      html += '<div class="com-progress-status">📊 ' + Math.round(percent) + '% complete</div>';
    }
    
    html += '</div>';
    return html;
  }).join('');
  
  var buttons = document.querySelectorAll('.com-claim-btn');
  buttons.forEach(function(btn) {
    btn.removeEventListener('click', community_handleClaim);
    btn.addEventListener('click', community_handleClaim);
  });
}

// Handle reward claim
async function community_handleClaim(e) {
  var btn = e.currentTarget;
  var goalId = parseInt(btn.dataset.goalId);
  var goalKey = btn.dataset.goalKey;
  if (!goalId || !window.currentUser) return;
  
  if (community_claimedGoalIds.indexOf(goalId) !== -1) {
    community_showToast('Reward already claimed!', 'warning');
    return;
  }
  
  var goal = community_cachedGoals && community_cachedGoals.find(function(g) { return g.id === goalId; });
  if (!goal || goal.current_progress < goal.goal_target) {
    community_showToast('Goal not completed yet!', 'error');
    return;
  }
  
  var success = await community_grantReward(goal);
  if (success) {
    var { error } = await supabaseClient
      .from('community_goal_claims')
      .insert({ goal_id: goalId, user_id: window.currentUser.id });
    if (!error) {
      community_claimedGoalIds.push(goalId);
      community_showToast('🎉 Reward claimed: ' + community_formatRewardText(goal), 'success');
      community_refreshUI();
    }
  }
}

// Grant reward based on type
async function community_grantReward(goal) {
  var reward = goal.reward_value;
  var type = goal.reward_type;
  
  try {
    if (type === 'points') {
      var amount = parseInt(reward);
      if (typeof window.addPawketPoints === 'function') {
        window.addPawketPoints(amount);
      } else if (window.currentUser) {
        window.currentUser.pawketPoints = (window.currentUser.pawketPoints || 0) + amount;
        if (typeof window.saveUserData === 'function') await window.saveUserData();
        if (typeof updateAllPoints === 'function') updateAllPoints((window.currentUser.pawketPoints || 0));
      }
      return true;
    }
    if (type === 'items') {
      var items = reward.split(',');
      for (var i = 0; i < items.length; i++) {
        var parts = items[i].split(':');
        var itemId = parts[0];
        var quantity = parseInt(parts[1]) || 1;
        if (typeof addItemToInventory === 'function') {
          await addItemToInventory(itemId, quantity);
        }
      }
      return true;
    }
    if (type === 'title') {
      if (typeof unlockTitle === 'function') {
        await unlockTitle(reward);
      }
      return true;
    }
    return false;
  } catch(e) {
    console.error('Reward grant error:', e);
    return false;
  }
}

// Format reward text for toast
function community_formatRewardText(goal) {
  if (goal.reward_type === 'points') return goal.reward_value + ' PawketPoints';
  if (goal.reward_type === 'items') return goal.reward_value;
  if (goal.reward_type === 'title') return 'Title: "' + goal.reward_value + '"';
  return goal.reward_value;
}

// Show toast notification
function community_showToast(message, type) {
  type = type || 'info';
  if (typeof showToast === 'function') {
    showToast(message);
  } else {
    console.log('[Community] ' + message);
    var toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#333;color:white;padding:10px 20px;border-radius:8px;z-index:9999;';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 3000);
  }
}

// Initialize community system
function community_init() {
  community_loadGoals();
  setInterval(function() { community_loadGoals(); }, 300000);
  window.addEventListener('beforeunload', function() {
    if (Object.keys(community_pendingUpdates).length > 0) {
      community_syncToDatabase();
    }
  });
  console.log('🌍 Community Goals system initialized');
}


// ════════════════════════════════════════════════════════════════════════════
// MOBILE-ONLY MENU SYSTEM (DESKTOP COMPLETELY UNTOUCHED)
// ════════════════════════════════════════════════════════════════════════════

(function() {
  // CRITICAL: Only run on mobile devices
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  // Exit immediately if desktop
  if (!isMobile()) {
    console.log('Desktop mode - mobile menu disabled');
    return;
  }
  
  console.log('Mobile mode - initializing mobile menu');
  
  // Initialize mobile menu on DOM ready
  function initMobileMenu() {
    // Exit if already initialized
    if (document.getElementById('mobile-menu')) {
      return;
    }
    
    // Create hamburger button
    var hamburger = document.createElement('button');
    hamburger.id = 'hamburger-btn';
    hamburger.className = 'hamburger-btn';
    hamburger.innerHTML = '☰';
    hamburger.setAttribute('aria-label', 'Open menu');
    document.body.appendChild(hamburger);
    
    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'mobile-overlay';
    overlay.className = 'mobile-overlay';
    document.body.appendChild(overlay);
    
    // Create mobile menu
    var menu = document.createElement('div');
    menu.id = 'mobile-menu';
    menu.className = 'mobile-menu';
    
    // Menu items
    var menuItems = [
      { icon: '🏠', text: 'Home', tab: 'home' },
      { icon: '🐾', text: 'My Pets', tab: 'mypets' },
      { icon: '🐣', text: 'Adopt', tab: 'adopt' },
      { icon: '⚔️', text: 'Battle', tab: 'battle' },
      { icon: '🛒', text: 'Shop', tab: 'shop' },
      { icon: '🎯', text: 'Pass', action: 'showPassModal' },
      { icon: '🎲', text: 'Bingo', action: 'showBingoModal' },
      { icon: '🌍', text: 'Community', tab: 'community-goals' },
      { icon: '📊', text: 'Statistics', tab: 'statistics' },
      { icon: '👤', text: 'Profile', tab: 'profile' },
      { icon: '🚪', text: 'Logout', action: 'logout' }
    ];
    
    menuItems.forEach(function(item) {
      var menuItem = document.createElement('div');
      menuItem.className = 'mobile-menu-item mobile-nav-item';
      menuItem.innerHTML = '<span class="mobile-nav-icon">' + item.icon + '</span>' +
                           '<span class="mobile-nav-text mobile-menu-text">' + item.text + '</span>';
      
      menuItem.addEventListener('click', function() {
        if (item.tab) {
          if (typeof showTab === 'function') {
            showTab(item.tab);
          }
        } else if (item.action === 'showPassModal') {
          if (typeof showPassModal === 'function') {
            showPassModal();
          }
        } else if (item.action === 'showBingoModal') {
          if (typeof showBingoModal === 'function') {
            showBingoModal();
          }
        } else if (item.action === 'logout') {
          if (typeof logout === 'function') {
            logout();
          }
        }
        
        // Close menu after selection
        closeMobileMenu();
      });
      
      menu.appendChild(menuItem);
    });
    
    document.body.appendChild(menu);
    
    // Toggle menu function
    function toggleMobileMenu() {
      var isActive = menu.classList.contains('active');
      if (isActive) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    }
    
    function openMobileMenu() {
      menu.classList.add('active');
      overlay.classList.add('active');
      hamburger.innerHTML = '✕';
      document.body.style.overflow = 'hidden';
    }
    
    function closeMobileMenu() {
      menu.classList.remove('active');
      overlay.classList.remove('active');
      hamburger.innerHTML = '☰';
      document.body.style.overflow = '';
    }
    
    // Event listeners
    hamburger.addEventListener('click', toggleMobileMenu);
    overlay.addEventListener('click', closeMobileMenu);
    
    // Close menu on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && menu.classList.contains('active')) {
        closeMobileMenu();
      }
    });
    
    console.log('Mobile menu initialized');
  }
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
  } else {
    initMobileMenu();
  }
  
  // Handle window resize - reinitialize or cleanup
  window.addEventListener('resize', function() {
    if (!isMobile()) {
      // Desktop mode - remove mobile elements
      var menu = document.getElementById('mobile-menu');
      var hamburger = document.getElementById('hamburger-btn');
      var overlay = document.getElementById('mobile-overlay');
      
      if (menu) menu.style.display = 'none';
      if (hamburger) hamburger.style.display = 'none';
      if (overlay) overlay.style.display = 'none';
      document.body.style.overflow = '';
    } else {
      // Mobile mode - ensure elements visible
      var menu = document.getElementById('mobile-menu');
      var hamburger = document.getElementById('hamburger-btn');
      
      if (menu) menu.style.display = '';
      if (hamburger) hamburger.style.display = '';
    }
  });
  
})();

