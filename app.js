// ═══════════════════════════════════════════════════════════════
// RECIPY APP - Complete JavaScript Application
// ═══════════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ═══════════════════════════════════════════
// FIREBASE CONFIGURATION
// ═══════════════════════════════════════════
const firebaseConfig = {
  apiKey: 'AIzaSyCODtLo_Q8C4jDJYKdXj_KgUxUWwPZ-mAM',
  authDomain: 'recipy-app-2024.firebaseapp.com',
  projectId: 'recipy-app-2024',
  storageBucket: 'recipy-app-2024.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef123456'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ═══════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════
const state = {
  currentUser: null,
  currentRecipe: null,
  savedRecipes: [],
  customRecipes: [],
  mealPlan: {},
  shoppingList: [],
  userPreferences: {
    diet: 'omnivore',
    allergies: [],
    dislikedTags: []
  },
  currentFilter: { time: ['<15'], difficulty: ['facile'] },
  editMode: false,
  selectedRecipes: [],
  recipes: [
    { id: 1, emoji: '🍝', title: 'Pâtes Carbonara', desc: 'Délicieuses pâtes avec sauce crémeuse', tag1: 'PATES', tag2: 'ITALIEN', time: '20 min', difficulty: 'facile', portions: 2, ing: [{ name: 'Pâtes', qty: '400g' }], steps: ['Cuire pâtes', 'Préparer sauce', 'Mélanger'] },
    { id: 2, emoji: '🥗', title: 'Salade César', desc: 'Salade fraîche et croquante', tag1: 'SALADE', tag2: 'SAIN', time: '10 min', difficulty: 'facile', portions: 2, ing: [{ name: 'Laitue', qty: '1' }], steps: ['Préparer laitue', 'Ajouter sauce'] },
    { id: 3, emoji: '🍜', title: 'Soupe Miso', desc: 'Soupe asiatique réconfortante', tag1: 'SOUPE', tag2: 'ASIATIQUE', time: '15 min', difficulty: 'facile', portions: 2, ing: [{ name: 'Miso', qty: '3 cuil' }], steps: ['Bouillir eau', 'Ajouter miso'] },
    { id: 4, emoji: '🍰', title: 'Gâteau Chocolat', desc: 'Moelleux au chocolat', tag1: 'DESSERT', tag2: 'CHOCOLAT', time: '45 min', difficulty: 'moyen', portions: 4, ing: [{ name: 'Chocolat', qty: '200g' }], steps: ['Préparer pâte', 'Cuire 25 min'] }
  ]
};

// ═══════════════════════════════════════════
// UI UTILITIES
// ═══════════════════════════════════════════
const UI = {
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.add('active');
    this.updateNavIndicator();
  },

  showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('overlay');
    if (modal && overlay) {
      overlay.classList.add('show');
      modal.classList.add('open');
    }
  },

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('overlay');
    if (modal && overlay) {
      overlay.classList.remove('show');
      modal.classList.remove('open');
    }
  },

  showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = message;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), duration);
    }
  },

  updateNavIndicator() {
    const activeBtn = document.querySelector('.nav-btn.active');
    const indicator = document.querySelector('.nav-indicator');
    if (activeBtn && indicator) {
      const index = Array.from(activeBtn.parentElement.querySelectorAll('.nav-btn')).indexOf(activeBtn);
      indicator.style.setProperty('--ind-l', `${index * 25}%`);
    }
  },

  updateBadges() {
    const savedBadges = document.querySelectorAll('.nav-badge');
    const count = state.savedRecipes.length;
    savedBadges.forEach(b => {
      b.textContent = count;
      b.classList.toggle('show', count > 0);
    });
  }
};

// ═══════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════
const Auth = {
  async register(email, password, name) {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await this.saveUserProfile(user.uid, { email, name });
      return user;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async login(email, password) {
    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      state.currentUser = user;
      await this.loadUserData(user.uid);
      return user;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async logout() {
    try {
      await signOut(auth);
      state.currentUser = null;
      state.savedRecipes = [];
      UI.showScreen('fb-auth');
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async saveUserProfile(uid, data) {
    try {
      await addDoc(collection(db, 'users'), { uid, ...data, createdAt: new Date() });
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  },

  async loadUserData(uid) {
    try {
      const savedSnap = await getDocs(query(collection(db, 'savedRecipes'), where('userId', '==', uid)));
      state.savedRecipes = savedSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      UI.updateBadges();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  },

  initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        state.currentUser = user;
        await this.loadUserData(user.uid);
        UI.showScreen('main');
      } else {
        state.currentUser = null;
        UI.showScreen('fb-auth');
      }
    });
  }
};

// ═══════════════════════════════════════════
// RECIPE MANAGEMENT
// ═══════════════════════════════════════════
const Recipes = {
  getFiltered() {
    return state.recipes.filter(recipe => {
      const timeMatch = state.currentFilter.time.some(t => {
        if (t === '<15') return recipe.time.includes('10') || recipe.time.includes('15');
        if (t === '15-30') return recipe.time.includes('20') || recipe.time.includes('25') || recipe.time.includes('30');
        return true;
      });
      const diffMatch = state.currentFilter.difficulty.some(d => recipe.difficulty.toLowerCase().includes(d));
      return timeMatch && diffMatch;
    });
  },

  displayRecipe(recipe) {
    if (!recipe) return;
    state.currentRecipe = recipe;
    document.getElementById('ctitle').textContent = recipe.title;
    document.getElementById('cdesc').textContent = recipe.desc;
    document.getElementById('ctime').textContent = recipe.time;
    document.getElementById('ctag1').textContent = recipe.tag1;
    document.getElementById('ctag2').textContent = recipe.tag2;
    document.getElementById('card-img').style.fontSize = '80px';
    document.getElementById('card-img').innerHTML = `<div>${recipe.emoji}</div><div class="card-ov"></div>`;
  },

  displayDetail(recipe) {
    if (!recipe) return;
    state.currentRecipe = recipe;
    document.getElementById('det-title').textContent = recipe.title;
    document.getElementById('det-desc').textContent = recipe.desc;
    document.getElementById('det-tag1').textContent = recipe.tag1;
    document.getElementById('det-tag2').textContent = recipe.tag2;
    document.getElementById('det-img').innerHTML = `<div style="font-size:100px;">${recipe.emoji}</div><button class="det-back" id="btn-det-back">←</button><button class="det-fav" id="btn-det-fav">★</button>`;
    
    const ingList = document.getElementById('det-ing');
    ingList.innerHTML = recipe.ing.map(i => `<div class="ing-item"><span class="ing-name">${i.name}</span><span class="ing-qty">${i.qty}</span></div>`).join('');
    
    const stepsList = document.getElementById('det-steps');
    stepsList.innerHTML = recipe.steps.map((s, i) => `<div class="step"><div class="step-n">${i + 1}</div><div class="step-t">${s}</div></div>`).join('');
    
    UI.showScreen('detail');
  },

  async saveRecipe(recipe) {
    if (!state.currentUser) return;
    try {
      const docRef = await addDoc(collection(db, 'savedRecipes'), {
        userId: state.currentUser.uid,
        ...recipe,
        savedAt: new Date()
      });
      state.savedRecipes.push({ id: docRef.id, ...recipe });
      UI.updateBadges();
      UI.showToast('✓ Recette sauvegardée');
    } catch (error) {
      console.error('Error saving recipe:', error);
    }
  },

  async deleteRecipe(recipeId) {
    if (!state.currentUser) return;
    try {
      await deleteDoc(doc(db, 'savedRecipes', recipeId));
      state.savedRecipes = state.savedRecipes.filter(r => r.id !== recipeId);
      UI.updateBadges();
      UI.showToast('✓ Recette supprimée');
    } catch (error) {
      console.error('Error deleting recipe:', error);
    }
  },

  displaySavedRecipes() {
    const content = document.getElementById('saved-content');
    if (state.savedRecipes.length === 0) {
      content.innerHTML = '<div class="empty-state"><div class="ei">💔</div><h3>Aucune recette sauvegardée</h3><p>Likez des recettes pour les retrouver ici</p></div>';
      return;
    }

    content.innerHTML = `
      <div class="saved-list">
        ${state.savedRecipes.map(recipe => `
          <div class="saved-section">
            <div class="rc-row" data-recipe-id="${recipe.id}">
              <div class="rc-main">
                <div class="rc-checkbox"></div>
                <div class="rc-photo">${recipe.emoji}</div>
                <div class="rc-info">
                  <div class="rc-title">${recipe.title}</div>
                  <div class="rc-meta">${recipe.time} • ${recipe.tag1}</div>
                </div>
                <div class="rc-portions"><span>${recipe.portions || 2}</span> pers.</div>
                <div class="rc-chevron">›</div>
              </div>
              <div class="rc-actions">
                <button class="rc-action-btn detail" data-action="detail">Voir</button>
                <button class="rc-action-btn plan" data-action="plan">Planning</button>
                <button class="rc-action-btn del" data-action="delete">Supprimer</button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    this.attachSavedRecipeListeners();
  },

  attachSavedRecipeListeners() {
    document.querySelectorAll('.rc-row').forEach(row => {
      const mainDiv = row.querySelector('.rc-main');
      mainDiv.addEventListener('click', () => {
        row.classList.toggle('expanded');
      });

      row.querySelectorAll('.rc-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.getAttribute('data-action');
          const recipeId = row.getAttribute('data-recipe-id');
          const recipe = state.savedRecipes.find(r => r.id === recipeId);

          if (action === 'detail') this.displayDetail(recipe);
          else if (action === 'plan') this.planRecipe(recipe);
          else if (action === 'delete') this.deleteRecipe(recipeId);
        });
      });

      const checkbox = row.querySelector('.rc-checkbox');
      if (checkbox) {
        checkbox.addEventListener('click', (e) => {
          e.stopPropagation();
          row.classList.toggle('sel-checked');
          const recipeId = row.getAttribute('data-recipe-id');
          if (state.selectedRecipes.includes(recipeId)) {
            state.selectedRecipes = state.selectedRecipes.filter(id => id !== recipeId);
          } else {
            state.selectedRecipes.push(recipeId);
          }
          this.updateEditToolbar();
        });
      }
    });
  },

  updateEditToolbar() {
    const toolbar = document.getElementById('edit-toolbar');
    const count = state.selectedRecipes.length;
    if (toolbar) {
      document.getElementById('edit-sel-count').textContent = `${count} sélectionnée${count !== 1 ? 's' : ''}`;
      document.getElementById('btn-del-sel').disabled = count === 0;
    }
  }
};

// ═══════════════════════════════════════════
// PLANNING & CALENDAR
// ═══════════════════════════════════════════
const Planning = {
  initWeekStrip() {
    const weekStrip = document.getElementById('week-strip');
    if (!weekStrip) return;
    
    const today = new Date();
    weekStrip.innerHTML = '';
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const day = date.toLocaleString('fr-FR', { weekday: 'short' }).slice(0, 1).toUpperCase();
      const num = date.getDate();
      const isToday = i === 0;
      
      weekStrip.innerHTML += `
        <div class="day-col">
          <div class="day-label">${day}</div>
          <div class="day-num ${isToday ? 'today' : ''}" data-date="${date.toISOString().split('T')[0]}">${num}</div>
        </div>
      `;
    }
  },

  initPlanningModal() {
    const grid = document.getElementById('plan-day-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    days.forEach((day, i) => {
      grid.innerHTML += `<button class="plan-day-btn ${i === 0 ? 'selected' : ''}" data-day="${i}">${day}</button>`;
    });

    grid.querySelectorAll('.plan-day-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        grid.querySelectorAll('.plan-day-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });
  },

  async planRecipe(recipe) {
    this.initPlanningModal();
    UI.showModal('plan-modal');

    const confirmBtn = document.getElementById('btn-confirm-plan');
    confirmBtn.onclick = async () => {
      const selectedDay = document.querySelector('.plan-day-btn.selected');
      const selectedTime = document.querySelector('.plan-time-btn.selected');
      
      if (selectedDay && selectedTime && state.currentUser) {
        try {
          const dayIndex = selectedDay.getAttribute('data-day');
          const time = selectedTime.id === 'pt-midi' ? 'midi' : 'soir';
          
          await addDoc(collection(db, 'mealPlans'), {
            userId: state.currentUser.uid,
            recipe,
            dayIndex,
            time,
            createdAt: new Date()
          });

          state.mealPlan[
            `${dayIndex}-${time}`
          ] = recipe;
          UI.showToast('📅 Ajouté au planning');
          UI.hideModal('plan-modal');
        } catch (error) {
          console.error('Error planning recipe:', error);
        }
      }
    };
  },

  displayCalendar() {
    this.initWeekStrip();
    const calBody = document.getElementById('cal-body');
    if (!calBody) return;

    calBody.innerHTML = `
      <div class="cal-day-section">
        <div class="cal-day-title">Aujourd'hui</div>
        <div class="meal-slot-empty"><span>+ Ajouter un repas</span></div>
      </div>
      <div class="cal-day-section">
        <div class="cal-day-title">Demain</div>
        <div class="meal-slot-empty"><span>+ Ajouter un repas</span></div>
      </div>
    `;

    calBody.querySelectorAll('.meal-slot-empty').forEach(slot => {
      slot.addEventListener('click', () => {
        if (state.currentRecipe) {
          this.planRecipe(state.currentRecipe);
        }
      });
    });
  }
};

// ═══════════════════════════════════════════
// SHOPPING LIST
// ═══════════════════════════════════════════
const Shopping = {
  generateShoppingList() {
    const ingredients = {};
    Object.values(state.mealPlan).forEach(recipe => {
      if (recipe && recipe.ing) {
        recipe.ing.forEach(ing => {
          const key = ing.name.toLowerCase();
          ingredients[key] = (ingredients[key] || 0) + 1;
        });
      }
    });

    const shopBody = document.getElementById('shop-body');
    if (!shopBody) return;

    if (Object.keys(ingredients).length === 0) {
      shopBody.innerHTML = '<div class="empty-state"><div class="ei">🛒</div><h3>Aucun ingrédient</h3><p>Ajoutez des recettes au planning</p></div>';
      return;
    }

    shopBody.innerHTML = `
      <div class="shop-category">
        <div class="shop-cat-title">INGRÉDIENTS</div>
        <div class="shop-card">
          ${Object.entries(ingredients).map(([name, qty]) => `
            <div class="shop-item">
              <div class="shop-cb">✓</div>
              <div class="shop-item-name">${name.charAt(0).toUpperCase() + name.slice(1)}</div>
              <div class="shop-item-qty">x${qty}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    shopBody.querySelectorAll('.shop-item').forEach(item => {
      item.addEventListener('click', () => {
        item.classList.toggle('checked');
      });
    });
  },

  exportList() {
    const items = Array.from(document.querySelectorAll('.shop-item-name')).map(el => el.textContent);
    const text = items.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liste-courses.txt';
    a.click();
    URL.revokeObjectURL(url);
  }
};

// ═══════════════════════════════════════════
// SWIPE INTERACTION
// ═══════════════════════════════════════════
const Swipe = {
  touchStartX: 0,
  touchEndX: 0,
  currentIndex: 0,

  initSwipe() {
    const card = document.getElementById('swipe-card');
    if (!card) return;

    card.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, false);

    card.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      this.handleSwipe();
    }, false);
  },

  handleSwipe() {
    const filtered = Recipes.getFiltered();
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        this.next(filtered);
      } else {
        this.next(filtered);
      }
    }
  },

  next(filtered) {
    this.currentIndex++;
    if (this.currentIndex >= filtered.length) {
      document.getElementById('swipe-end').style.display = 'flex';
      return;
    }
    Recipes.displayRecipe(filtered[this.currentIndex]);
  }
};

// ═══════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════
function initEventListeners() {
  // Auth events
  document.getElementById('fb-btn-signin')?.addEventListener('click', async () => {
    const email = document.getElementById('fb-email').value;
    const password = document.getElementById('fb-password').value;
    try {
      await Auth.login(email, password);
    } catch (error) {
      document.getElementById('fb-error').textContent = error.message;
    }
  });

  // Nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const screenId = btn.getAttribute('data-goto');
      UI.showScreen(screenId);
      
      if (screenId === 'saved') Recipes.displaySavedRecipes();
      if (screenId === 'calendar') Planning.displayCalendar();
      if (screenId === 'shopping') Shopping.generateShoppingList();
    });
  });

  // Main screen buttons
  document.getElementById('btn-save')?.addEventListener('click', () => {
    if (state.currentRecipe) Recipes.saveRecipe(state.currentRecipe);
  });

  document.getElementById('btn-info')?.addEventListener('click', () => {
    if (state.currentRecipe) Recipes.displayDetail(state.currentRecipe);
  });

  document.getElementById('btn-pass')?.addEventListener('click', () => {
    const filtered = Recipes.getFiltered();
    Swipe.next(filtered);
  });

  document.getElementById('btn-filter')?.addEventListener('click', () => {
    UI.showModal('filt-modal');
  });

  // Filter modal
  document.getElementById('btn-apply-filt')?.addEventListener('click', () => {
    const selectedTime = Array.from(document.querySelectorAll('.filt-chip.selected')).slice(0, 3).map((el, i) => {
      if (i === 0) return '<15';
      if (i === 1) return '15-30';
      return '30+';
    });
    state.currentFilter.time = selectedTime;
    UI.hideModal('filt-modal');
    const filtered = Recipes.getFiltered();
    Recipes.displayRecipe(filtered[Swipe.currentIndex] || filtered[0]);
  });

  // Detail screen
  document.addEventListener('click', (e) => {
    if (e.target.id === 'btn-det-back') {
      UI.showScreen('main');
      Swipe.initSwipe();
    }
    if (e.target.id === 'btn-det-fav' && state.currentRecipe) {
      Recipes.saveRecipe(state.currentRecipe);
    }
  });

  // Planning
  document.getElementById('btn-add-to-planning')?.addEventListener('click', () => {
    if (state.currentRecipe) Planning.planRecipe(state.currentRecipe);
  });

  // Shopping
  document.querySelectorAll('.shop-action-btn.export')?.forEach(btn => {
    btn.addEventListener('click', () => Shopping.exportList());
  });

  // Edit mode
  document.getElementById('btn-toggle-edit')?.addEventListener('click', () => {
    state.editMode = !state.editMode;
    const toolbar = document.getElementById('edit-toolbar');
    if (toolbar) toolbar.classList.toggle('show');
    document.getElementById('btn-toggle-edit').classList.toggle('active');
  });

  document.getElementById('btn-del-sel')?.addEventListener('click', async () => {
    for (const recipeId of state.selectedRecipes) {
      await Recipes.deleteRecipe(recipeId);
    }
    state.selectedRecipes = [];
    Recipes.displaySavedRecipes();
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    Auth.logout();
  });
}

// ═══════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  Auth.initAuthListener();
  initEventListeners();
  Swipe.initSwipe();
  Planning.initWeekStrip();
  
  // Display first recipe
  const filtered = Recipes.getFiltered();
  if (filtered.length > 0) {
    Recipes.displayRecipe(filtered[0]);
  }

  // Service Worker registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
});