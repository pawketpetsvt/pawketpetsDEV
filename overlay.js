// Stream Overlay Widget - PawketPetsVT
// Fetches pet data every 10 seconds and updates the display

// ============================================
// CONFIGURATION
// ============================================
const STREAMER_NAME = 'Embertail';  // Your Twitch username (case-sensitive!)
const API_BASE = 'https://pawketpets-twitch.pawketpetsvt.workers.dev';  // Your Cloudflare Worker URL
// ============================================

// ============================================
// RANDOM QUIPS - Customize these!
// ============================================
const QUIPS = {
  happy: [
    "✨ I love being on stream!",
    "🎉 Thanks for watching!",
    "💜 You're the best!",
    "🌟 Let's have a great stream!",
    "🎈 I'm so happy right now!",
    "💕 Sending good vibes!",
    "⭐ You're amazing!",
    "🌸 This is the life!"
  ],
  neutral: [
    "🍽️ Anyone got a snack?",
    "😴 Just chillin'...",
    "🎮 Let's play something!",
    "💭 What are we doing today?",
    "👀 I'm watching you...",
    "🎵 La la la~",
    "✨ Just pet things~",
    "💪 Ready for action!"
  ],
  sad: [
    "🍽️ I'm a little hungry...",
    "😴 So tired...",
    "💔 Could use some attention...",
    "🥺 A little sad...",
    "😿 Anyone there?",
    "💤 So sleepy...",
    "🍪 Got any treats?"
  ]
};

// Get a random quip based on mood
function getRandomQuip(happinessPercent, hungerPercent, energyPercent) {
  let mood = 'neutral';
  
  if (happinessPercent >= 70 && hungerPercent >= 50 && energyPercent >= 50) {
    mood = 'happy';
  } else if (happinessPercent < 30 || hungerPercent < 30 || energyPercent < 30) {
    mood = 'sad';
  }
  
  const quipList = QUIPS[mood];
  return quipList[Math.floor(Math.random() * quipList.length)];
}

// Rotate quips every 2 minutes
let quipInterval = null;
let quipRotationActive = false;
let currentQuipText = ''; // ← CHANGED: Track current quip to avoid re-rendering

function startQuipRotation(pet) {
  // If rotation is already active, don't restart it
  if (quipRotationActive) return;
  
  quipRotationActive = true;
  
  // Show first quip after 5 seconds
  setTimeout(() => {
    if (pet) {
      currentQuipText = getRandomQuip(pet.stats.happiness.percent, pet.stats.hunger.percent, pet.stats.energy.percent);
      updateQuipDisplay(currentQuipText);
    }
  }, 5000);
  
  // Update quip every 2 minutes
  quipInterval = setInterval(() => {
    if (pet) {
      currentQuipText = getRandomQuip(pet.stats.happiness.percent, pet.stats.hunger.percent, pet.stats.energy.percent);
      updateQuipDisplay(currentQuipText);
    }
  }, 120000); // 2 minutes
}

function updateQuipDisplay(quip) {
  const quipElement = document.getElementById('pet-quip');
  if (quipElement && quipElement.textContent !== quip) { // ← CHANGED: Only update if different
    quipElement.textContent = quip;
    quipElement.classList.add('quip-new');
    setTimeout(() => {
      quipElement.classList.remove('quip-new');
    }, 500);
  }
}

let refreshInterval = null;
let currentPetData = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  fetchPetData();
  // Refresh every 10 seconds
  refreshInterval = setInterval(fetchPetData, 10000);
});

async function fetchPetData() {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.classList.add('loading');
  
  try {
    const response = await fetch(`${API_BASE}/api/overlay?streamer=${encodeURIComponent(STREAMER_NAME)}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      updateDisplay(data.pet);
      currentPetData = data.pet;
      if (overlay) overlay.classList.remove('loading');
    } else if (data.error === 'No companion pet set') {
      showNoCompanionState(STREAMER_NAME);
      if (overlay) overlay.classList.remove('loading');
    } else {
      throw new Error(data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Failed to fetch pet data:', error);
    showErrorState();
    if (overlay) overlay.classList.remove('loading');
  }
}

function updateDisplay(pet) {
  // Pet name and level
  document.getElementById('pet-name').textContent = pet.name;
  document.getElementById('pet-level').textContent = `Lv.${pet.level}`;
  document.getElementById('pet-species').textContent = pet.species;
  
  // Mood helpers
  function getMoodEmoji(percent) {
    if (percent >= 80) return '😊';
    if (percent >= 60) return '🙂';
    if (percent >= 40) return '😐';
    if (percent >= 20) return '😟';
    return '😭';
  }
  
  function getMoodText(percent) {
    if (percent >= 80) return 'Ecstatic';
    if (percent >= 60) return 'Happy';
    if (percent >= 40) return 'Content';
    if (percent >= 20) return 'Unhappy';
    return 'Miserable';
  }
  
  const happinessPercent = pet.stats.happiness.percent;
  document.getElementById('mood-emoji').textContent = getMoodEmoji(happinessPercent);
  document.getElementById('mood-text').textContent = getMoodText(happinessPercent);
  
  // HP
  const hpPercent = pet.stats.hp.percent;
  document.getElementById('hp-fill').style.width = `${hpPercent}%`;
  document.getElementById('hp-text').textContent = `${pet.stats.hp.current}/${pet.stats.hp.max}`;
  
  // Hunger
  const hungerPercent = pet.stats.hunger.percent;
  document.getElementById('hunger-fill').style.width = `${hungerPercent}%`;
  document.getElementById('hunger-text').textContent = `${hungerPercent}%`;
  
  // Energy
  const energyPercent = pet.stats.energy.percent;
  document.getElementById('energy-fill').style.width = `${energyPercent}%`;
  document.getElementById('energy-text').textContent = `${energyPercent}%`;
  
  // Happiness
  document.getElementById('happiness-fill').style.width = `${happinessPercent}%`;
  document.getElementById('happiness-text').textContent = `${happinessPercent}%`;
  
  // Tip message (fallback)
  let tip = '';
  if (hungerPercent < 30) tip = '🍽️ Hungry! Feed me in the game!';
  else if (energyPercent < 30) tip = '😴 Tired! Let me rest...';
  else if (happinessPercent < 40) tip = '💔 Sad! Play with me in the game!';
  else tip = '✨ Happy and healthy! Thanks for watching!';
  
  document.getElementById('pet-tip').textContent = tip;
  // Changed: Promo message instead of "Updated just now"
  document.getElementById('pet-last').innerHTML = '🎮 <a href="https://pawketpets.net" target="_blank" style="color:#ffcc00; text-decoration:none;">Get your own pet!</a>';
  
  // Start quip rotation with pet data (only starts once)
  startQuipRotation(pet);
  
  // Pet image (if available)
  if (pet.image) {
    const img = document.getElementById('pet-image');
    const placeholder = document.getElementById('pet-avatar-placeholder');
    img.src = `https://pawketpets.net/pawketpetsDEV/images/${pet.image}`;
    img.onload = () => {
      img.style.display = 'block';
      placeholder.style.display = 'none';
    };
    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'flex';
    };
  }
  
  // Apply variant class to card
  const card = document.querySelector('.pet-card');
  if (card) {
    card.classList.remove('variant-golden', 'variant-shiny', 'variant-shadow', 'variant-cosmic', 'variant-fire', 'variant-ice');
    if (pet.variant) {
      card.classList.add(`variant-${pet.variant}`);
    }
  }
}

function showNoCompanionState(streamerName) {
  document.getElementById('pet-name').textContent = 'No Pet Selected';
  document.getElementById('pet-level').textContent = '';
  document.getElementById('pet-species').textContent = `${streamerName} hasn't set a companion pet!`;
  document.getElementById('mood-emoji').textContent = '😢';
  document.getElementById('mood-text').textContent = 'Lonely';
  document.getElementById('hp-fill').style.width = '0%';
  document.getElementById('hp-text').textContent = '0/0';
  document.getElementById('hunger-fill').style.width = '0%';
  document.getElementById('hunger-text').textContent = '0%';
  document.getElementById('energy-fill').style.width = '0%';
  document.getElementById('energy-text').textContent = '0%';
  document.getElementById('happiness-fill').style.width = '0%';
  document.getElementById('happiness-text').textContent = '0%';
  document.getElementById('pet-last').innerHTML = '🎮 <a href="https://pawketpets.net" target="_blank" style="color:#ffcc00;">Get your own pet!</a>';
  document.getElementById('pet-tip').textContent = '✨ Go to "My Pets" and click "Set Companion"';
}

function showErrorState() {
  document.getElementById('pet-name').textContent = 'Connection Error';
  document.getElementById('pet-level').textContent = '';
  document.getElementById('pet-species').textContent = 'Unable to load pet data';
  document.getElementById('mood-emoji').textContent = '⚠️';
  document.getElementById('mood-text').textContent = 'Error';
  document.getElementById('pet-last').innerHTML = '🎮 <a href="https://pawketpets.net" target="_blank" style="color:#ffcc00;">pawketpets.net</a>';
  document.getElementById('pet-tip').textContent = '🔧 Make sure STREAMER_NAME and API_BASE are correct';
}
