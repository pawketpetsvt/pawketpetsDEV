// auth.js - authentication and stat calculations for SPA

async function getCurrentUser() {
  var data = (await supabaseClient.auth.getSession()).data;
  return data.session ? data.session.user : null;
}

async function requireLogin() {
  var data = (await supabaseClient.auth.getSession()).data;
  return data.session || null;
}

async function registerUser(email, password, username) {
  var result = await supabaseClient.auth.signUp({
    email: email, password: password,
    options: { data: { username: username } }
  });
  if (result.error) throw new Error(result.error.message);
  if (result.data.user) {
    var pr = await supabaseClient.from('players').insert([{
      id: result.data.user.id, username: username, pawketpoints: 0
    }]);
    if (pr.error) console.warn('Player row error:', pr.error.message);
  }
  return result.data;
}

async function loginUser(email, password) {
  var result = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
  if (result.error) {
    // Provide more user-friendly error messages
    var errorMsg = result.error.message;
    if (errorMsg.includes('Invalid login credentials')) {
      throw new Error('Invalid email or password. Please check your credentials and try again.');
    } else if (errorMsg.includes('Email not confirmed')) {
      throw new Error('Please verify your email address before logging in.');
    } else if (errorMsg.includes('User not found')) {
      throw new Error('No account found with this email address.');
    } else {
      throw new Error(errorMsg);
    }
  }
  return result.data;
}

async function logoutUser() {
  await supabaseClient.auth.signOut();
  window.location.reload();
}

async function resetPassword(email) {
  var result = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://pawketpetsvt.github.io/'
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data;
}

async function checkDailyBonus(userId) {
  var today = new Date().toISOString().split('T')[0];
  var key = 'daily_bonus_' + userId;
  if (localStorage.getItem(key) === today) return { awarded: false };
  var BONUS = 50;
  var pr = await supabaseClient.from('players').select('pawketpoints').eq('id', userId).single();
  if (!pr.data) return { awarded: false };
  var newPoints = pr.data.pawketpoints + BONUS;
  var res = await supabaseClient.from('players').update({ pawketpoints: newPoints }).eq('id', userId);
  if (!res.error) { localStorage.setItem(key, today); return { awarded: true, amount: BONUS, newTotal: newPoints }; }
  return { awarded: false };
}

function calculateEnergyRegen(currentEnergy, maxEnergy, lastPlayedTimestamp) {
  if (!lastPlayedTimestamp) return currentEnergy;
  var hours = (new Date() - new Date(lastPlayedTimestamp)) / (1000 * 60 * 60);
  return Math.min(currentEnergy + Math.floor(hours * 5), maxEnergy);
}

function calculateHungerDecay(currentHunger, lastFedTimestamp) {
  if (!lastFedTimestamp) return currentHunger;
  var hours = (new Date() - new Date(lastFedTimestamp)) / (1000 * 60 * 60);
  return Math.max(currentHunger - Math.floor(hours * 0.625), 0);
}

function calculateHappinessDecay(currentHappiness, lastFedTimestamp, lastPlayedTimestamp) {
  var lastInteraction = null;
  if (lastFedTimestamp && lastPlayedTimestamp) {
    lastInteraction = new Date(lastFedTimestamp) > new Date(lastPlayedTimestamp)
      ? new Date(lastFedTimestamp) : new Date(lastPlayedTimestamp);
  } else if (lastFedTimestamp) {
    lastInteraction = new Date(lastFedTimestamp);
  } else if (lastPlayedTimestamp) {
    lastInteraction = new Date(lastPlayedTimestamp);
  } else {
    return currentHappiness;
  }
  var hours = (new Date() - lastInteraction) / (1000 * 60 * 60);
  return Math.max(currentHappiness - Math.floor(hours * 0.625), 0);
}

function calculateLevelUp(currentXp, currentLevel, currentMaxHunger, currentMaxEnergy, currentMaxHappiness) {
  var xpForNext = currentLevel * 100;
  if (currentXp < xpForNext) {
    return { leveled: false, level: currentLevel, xp: currentXp, maxHunger: currentMaxHunger, maxEnergy: currentMaxEnergy, maxHappiness: currentMaxHappiness };
  }
  return {
    leveled: true,
    level: currentLevel + 1,
    xp: currentXp - xpForNext,
    maxHunger: currentMaxHunger + 5,
    maxEnergy: currentMaxEnergy + 5,
    maxHappiness: currentMaxHappiness + 5
  };
}
