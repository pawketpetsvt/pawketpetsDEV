// ═══════════════════════════════════════════════════════════════════════
// CURSOR GLITTER TRAIL EFFECT
// ═══════════════════════════════════════════════════════════════════════

var cursorTrailEnabled = true; // Can be toggled in settings later
var lastSparkleTime = 0;
var sparkleColors = ['sparkle-pink', 'sparkle-purple', 'sparkle-cyan', 'sparkle-yellow', 'sparkle-white'];

function createSparkle(x, y) {
  // Rate limit: only create sparkle every 50ms (prevents lag)
  var now = Date.now();
  if (now - lastSparkleTime < 50) return;
  lastSparkleTime = now;
  
  var sparkle = document.createElement('div');
  sparkle.className = 'cursor-sparkle ' + sparkleColors[Math.floor(Math.random() * sparkleColors.length)];
  
  // Random offset for more natural spread
  var offsetX = (Math.random() - 0.5) * 20;
  var offsetY = (Math.random() - 0.5) * 20;
  
  sparkle.style.left = (x + offsetX) + 'px';
  sparkle.style.top = (y + offsetY) + 'px';
  
  // Random drift direction
  var dx = (Math.random() - 0.5) * 30;
  var dy = (Math.random() - 0.5) * 30 - 10; // Slight upward bias
  sparkle.style.setProperty('--dx', dx + 'px');
  sparkle.style.setProperty('--dy', dy + 'px');
  
  document.body.appendChild(sparkle);
  
  // Remove after animation completes
  setTimeout(function() {
    if (sparkle.parentNode) {
      sparkle.parentNode.removeChild(sparkle);
    }
  }, 800);
}

// Track mouse movement
document.addEventListener('mousemove', function(e) {
  if (cursorTrailEnabled) {
    createSparkle(e.clientX, e.clientY);
  }
});

// Optional: Add to existing game.js or load separately
console.log('✨ Cursor glitter trail loaded!');
