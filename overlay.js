// Stream Overlay Widget - PawketPetsVT
// Fetches pet data every 30 seconds and updates the display

// ============================================
// CONFIGURATION
// ============================================
const STREAMER_NAME = 'Embertail';  // Your Twitch username (case-sensitive!)
const API_BASE = 'https://pawketpets-twitch.pawketpetsvt.workers.dev';  // Your Cloudflare Worker URL

// Animation timing (in milliseconds)
const EXPAND_DURATION = 30000;      // How long it stays expanded (30 seconds)
const COLLAPSE_DURATION = 600000;   // How long it stays collapsed (10 minutes = 600,000 ms)
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

// ============================================
// FOLD/SHRINK ANIMATION
// ============================================
let animationIntervalStarted = false;
let isExpanded = false;
let currentPetData = null;

function expandCard() {
  const container = document.getElementById('overlay');
  if (!container) return;
  
  isExpanded = true;
  container.classList.remove('collapsed');
  container.classList.add('expanded');
  
  // Update quip when expanding (fresh message)
  if (currentPetData) {
    const newQuip = getRandomQuip(
      currentPetData.stats.happiness.percent,
      currentPetData.stats.hunger.percent,
      currentPetData.stats.energy.percent
    );
    updateQuipDisplay(newQuip);
  }
}

function collapseCard() {
  const container = document.getElementById('overlay');
  if (!container) return;
  
  isExpanded = false;
  container.classList.remove('expanded');
  container.classList.add('collapsed');
}

function updateQuipDisplay(quip) {
  const quipElement = document.getElementById('pet-quip');
  if (quipElement && quipElement.textContent !== quip) {
    quipElement.textContent = quip;
    quipElement.classList.add('quip-new');
    setTimeout(() => {
      quipElement.classList.remove('quip-new');
    }, 500);
  }
}

function startAnimationCycle() {
  if (animationIntervalStarted) return;
  animationIntervalStarted = true;
  
  // First expand after 5 seconds (so viewers see it initially)
  setTimeout(() => {
    expandCard();
    
    // Then schedule collapse after EXPAND_DURATION
    setTimeout(() => {
      collapseCard();
      
      // Set up the recurring cycle
      setInterval(() => {
        if (!isExpanded) {
          expandCard();
          
          // Collapse after EXPAND_DURATION
          setTimeout(() => {
            if (isExpanded) {
              collapseCard();
            }
          }, EXPAND_DURATION);
        }
      }, COLLAPSE_DURATION);
      
    }, EXPAND_DURATION);
  }, 5000);
}

let refreshInterval = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  fetchPetData();
  // Refresh data every 30 seconds
  refreshInterval = setInterval(fetchPetData, 30000);
});

async function fetchPetData() {
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
    } else if (data.error === 'No companion pet set') {
      showNoCompanionState(STREAMER_NAME);
    } else {
      throw new Error(data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Failed to fetch pet data:', error);
    showErrorState();
  }
}

function updateDisplay(pet) {
  // Update collapsed view
  document.getElementById('collapsed-pet-name').textContent = pet.name;
  document.getElementById('collapsed-pet-level').textContent = `Lv.${pet.level}`;
  
  // Update expanded view
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
  
  // Tip message
  let tip = '';
  if (hungerPercent < 30) tip = '🍽️ Hungry! Feed me in the game!';
  else if (energyPercent < 30) tip = '😴 Tired! Let me rest...';
  else if (happinessPercent < 40) tip = '💔 Sad! Play with me in the game!';
  else tip = '✨ Happy and healthy! Thanks for watching!';
  
  document.getElementById('pet-tip').textContent = tip;
  
  // Pet image
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
  
  // Start the animation cycle (only once)
  if (!animationIntervalStarted) {
    startAnimationCycle();
  }
}

function showNoCompanionState(streamerName) {
  document.getElementById('collapsed-pet-name').textContent = 'No Pet';
  document.getElementById('collapsed-pet-level').textContent = '';
  document.getElementById('pet-name').textContent = 'No Pet Selected';
  document.getElementById('pet-species').textContent = `${streamerName} hasn't set a companion pet!`;
  document.getElementById('pet-tip').textContent = '✨ Go to "My Pets" and click "Set Companion"';
}

function showErrorState() {
  document.getElementById('collapsed-pet-name').textContent = 'Error';
  document.getElementById('collapsed-pet-level').textContent = '';
  document.getElementById('pet-name').textContent = 'Connection Error';
  document.getElementById('pet-tip').textContent = '🔧 Check API URL in overlay.js';
}
