// Stream Overlay Widget - PawketPetsVT
// Fetches pet data every 10 seconds and updates the display

// CONFIGURATION - CHANGE THIS TO YOUR STREAMER NAME
const STREAMER_NAME = 'EMBERTAIL';  // ← CHANGE THIS to your Twitch username
const API_BASE = 'https://pawketpetsvt.github.io';  // ← CHANGE THIS to your actual domain

// For local testing (uncomment and use a local server)
// const API_BASE = 'http://localhost:5500';

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
  overlay.classList.add('loading');
  
  try {
    const response = await fetch(`${API_BASE}/api/overlay/pet?streamer=${encodeURIComponent(STREAMER_NAME)}`, {
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
      overlay.classList.remove('loading');
    } else if (data.error === 'No companion pet set') {
      showNoCompanionState(data.streamer);
      overlay.classList.remove('loading');
    } else {
      throw new Error(data.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('Failed to fetch pet data:', error);
    showErrorState();
    overlay.classList.remove('loading');
  }
}

function updateDisplay(pet) {
  // Pet name and level
  document.getElementById('pet-name').textContent = pet.name;
  document.getElementById('pet-level').textContent = `Lv.${pet.level}`;
  document.getElementById('pet-species').textContent = pet.species;
  
  // Mood
  document.getElementById('mood-emoji').textContent = pet.mood.emoji;
  document.getElementById('mood-text').textContent = pet.mood.text;
  
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
  const happinessPercent = pet.stats.happiness.percent;
  document.getElementById('happiness-fill').style.width = `${happinessPercent}%`;
  document.getElementById('happiness-text').textContent = `${happinessPercent}%`;
  
  // Last active
  document.getElementById('pet-last').textContent = `Last active: ${pet.lastActive}`;
  
  // Tip
  document.getElementById('pet-tip').textContent = pet.tip;
  
  // Pet image (if available)
  if (pet.image) {
    const img = document.getElementById('pet-image');
    const placeholder = document.getElementById('pet-avatar-placeholder');
    img.src = `images/${pet.image}`;
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
  // Remove existing variant classes
  card.classList.remove('variant-golden', 'variant-shiny', 'variant-shadow', 'variant-cosmic', 'variant-fire', 'variant-ice');
  if (pet.variant) {
    card.classList.add(`variant-${pet.variant}`);
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
  document.getElementById('pet-last').textContent = 'Set a companion in the game!';
  document.getElementById('pet-tip').textContent = '✨ Go to "My Pets" and click "Set Companion"';
}

function showErrorState() {
  document.getElementById('pet-name').textContent = 'Connection Error';
  document.getElementById('pet-level').textContent = '';
  document.getElementById('pet-species').textContent = 'Unable to load pet data';
  document.getElementById('mood-emoji').textContent = '⚠️';
  document.getElementById('mood-text').textContent = 'Error';
  document.getElementById('pet-last').textContent = 'Check streamer name or try again';
  document.getElementById('pet-tip').textContent = '🔧 Make sure STREAMER_NAME is correct in overlay.js';
}
