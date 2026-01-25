// ========================================
// État global de l'application
// ========================================
let state = {
  nbPersonnes: 4,
  nbJours: 7,
  petitDejeuner: true,
  dejeuner: true,
  diner: true,
  budget: 2,
  // Nouvelles préférences
  pdejType: 'all', // 'all', 'proteine', 'sucre'
  prefLowSugar: false,
  prefCopieux: false,
  prefRapide: false,
  excludedIngredients: [],
  generatedMenu: [],
  shoppingList: {},
  // Favoris
  favoriteRecipes: [] // Array d'IDs de recettes favorites
};

// Jours de la semaine
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// Icônes pour les rayons
const RAYON_ICONS = {
  "fruits-legumes": "🥬",
  "viandes": "🥩",
  "poissonnerie": "🐟",
  "produits-laitiers": "🧀",
  "boulangerie": "🥖",
  "epicerie": "🏪",
  "boissons": "🍷",
  "surgeles": "🧊"
};

// ========================================
// Initialisation
// ========================================
document.addEventListener('DOMContentLoaded', () => {
  loadPreferences();
  loadFavoritesFromStorage();
  renderIngredientsList();
  renderFavoritesSection();
  setupEventListeners();
});

function setupEventListeners() {
  // Recherche d'ingrédients
  document.getElementById('searchIngredient').addEventListener('input', (e) => {
    filterIngredients(e.target.value);
  });

  // Budget radio buttons
  document.querySelectorAll('input[name="budget"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      state.budget = parseInt(e.target.value);
    });
  });

  // Fermer modal avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Fermer modal en cliquant à l'extérieur
  document.getElementById('recipeModal').addEventListener('click', (e) => {
    if (e.target.id === 'recipeModal') closeModal();
  });
}

// ========================================
// Navigation entre étapes
// ========================================
function goToStep(stepNumber) {
  // Mise à jour des boutons de navigation
  document.querySelectorAll('.step').forEach(step => {
    const stepNum = parseInt(step.dataset.step);
    step.classList.remove('active');
    if (stepNum < stepNumber) {
      step.classList.add('completed');
    } else {
      step.classList.remove('completed');
    }
    if (stepNum === stepNumber) {
      step.classList.add('active');
    }
  });

  // Afficher la section correspondante
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`step${stepNumber}`).classList.add('active');

  // Scroll vers le haut
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// Gestion des quantités
// ========================================
function adjustQty(inputId, delta) {
  const input = document.getElementById(inputId);
  const min = parseInt(input.min) || 1;
  const max = parseInt(input.max) || 99;
  let value = parseInt(input.value) + delta;
  value = Math.max(min, Math.min(max, value));
  input.value = value;
  state[inputId] = value;
}

// ========================================
// Gestion des ingrédients exclus
// ========================================
function renderIngredientsList() {
  const container = document.getElementById('ingredientsList');
  container.innerHTML = '';

  ALL_INGREDIENTS.forEach(ingredient => {
    const div = document.createElement('div');
    div.className = `ingredient-item ${state.excludedIngredients.includes(ingredient) ? 'excluded' : ''}`;
    div.textContent = ingredient;
    div.onclick = () => toggleIngredient(ingredient);
    container.appendChild(div);
  });

  renderExcludedTags();
}

function renderExcludedTags() {
  const container = document.getElementById('excludedTags');
  container.innerHTML = '';

  if (state.excludedIngredients.length === 0) {
    container.innerHTML = '<span style="color: var(--text-light); font-style: italic;">Aucun ingrédient exclu</span>';
    return;
  }

  state.excludedIngredients.forEach(ingredient => {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${ingredient} <span class="tag-remove" onclick="toggleIngredient('${ingredient}')">&times;</span>`;
    container.appendChild(tag);
  });
}

function toggleIngredient(ingredient) {
  const index = state.excludedIngredients.indexOf(ingredient);
  if (index > -1) {
    state.excludedIngredients.splice(index, 1);
  } else {
    state.excludedIngredients.push(ingredient);
  }
  renderIngredientsList();
}

function filterIngredients(search) {
  const container = document.getElementById('ingredientsList');
  const items = container.querySelectorAll('.ingredient-item');
  const searchLower = search.toLowerCase();

  items.forEach(item => {
    const visible = item.textContent.toLowerCase().includes(searchLower);
    item.style.display = visible ? 'flex' : 'none';
  });
}

// ========================================
// Génération du menu
// ========================================
function generateMenu() {
  // Récupérer les valeurs du formulaire
  state.nbPersonnes = parseInt(document.getElementById('nbPersonnes').value);
  state.nbJours = parseInt(document.getElementById('nbJours').value);
  state.petitDejeuner = document.getElementById('petitDejeuner').checked;
  state.dejeuner = document.getElementById('dejeuner').checked;
  state.diner = document.getElementById('diner').checked;
  state.budget = parseInt(document.querySelector('input[name="budget"]:checked').value);
  
  // Récupérer les préférences alimentaires
  state.pdejType = document.querySelector('input[name="pdejType"]:checked')?.value || 'all';
  state.prefLowSugar = document.getElementById('prefLowSugar')?.checked || false;
  state.prefCopieux = document.getElementById('prefCopieux')?.checked || false;
  state.prefRapide = document.getElementById('prefRapide')?.checked || false;

  // Vérifier qu'au moins un type de repas est sélectionné
  if (!state.petitDejeuner && !state.dejeuner && !state.diner) {
    showToast('Veuillez sélectionner au moins un type de repas');
    return;
  }

  // Filtrer les recettes disponibles
  const petitsDejeuners = getAvailableRecipes('petit-dejeuner');
  const plats = getAvailableRecipes('plat');

  // Vérifier qu'il y a assez de recettes
  const neededPD = state.petitDejeuner ? state.nbJours : 0;
  const neededPlats = (state.dejeuner ? state.nbJours : 0) + (state.diner ? state.nbJours : 0);

  if (petitsDejeuners.length === 0 && state.petitDejeuner) {
    showToast('Aucun petit-déjeuner disponible avec vos critères');
    return;
  }
  if (plats.length === 0 && (state.dejeuner || state.diner)) {
    showToast('Aucun plat disponible avec vos critères');
    return;
  }

  // Générer le menu
  state.generatedMenu = [];
  const usedPDIds = [];
  const usedPlatIds = [];

  // Préparer les slots pour les favoris
  // Structure: { dayIndex, mealType: 'petit-dejeuner' | 'dejeuner' | 'diner', recipe }
  const favoriteSlots = planFavoriteSlots(petitsDejeuners, plats);

  for (let i = 0; i < state.nbJours; i++) {
    const dayMenu = {
      jour: JOURS[i % 7],
      jourIndex: i,
      repas: []
    };

    if (state.petitDejeuner) {
      // Vérifier si un favori est prévu pour ce slot
      const favoriteSlot = favoriteSlots.find(s => s.dayIndex === i && s.mealType === 'petit-dejeuner');
      let recipe;
      if (favoriteSlot) {
        recipe = favoriteSlot.recipe;
      } else {
        recipe = pickRandomRecipe(petitsDejeuners, usedPDIds);
      }
      dayMenu.repas.push({
        type: 'Petit-déjeuner',
        typeKey: 'petit-dejeuner',
        recipe: recipe
      });
      usedPDIds.push(recipe.id);
    }

    if (state.dejeuner) {
      const favoriteSlot = favoriteSlots.find(s => s.dayIndex === i && s.mealType === 'dejeuner');
      let recipe;
      if (favoriteSlot) {
        recipe = favoriteSlot.recipe;
      } else {
        recipe = pickRandomRecipe(plats, usedPlatIds);
      }
      dayMenu.repas.push({
        type: 'Déjeuner',
        typeKey: 'dejeuner',
        recipe: recipe
      });
      usedPlatIds.push(recipe.id);
    }

    if (state.diner) {
      const favoriteSlot = favoriteSlots.find(s => s.dayIndex === i && s.mealType === 'diner');
      let recipe;
      if (favoriteSlot) {
        recipe = favoriteSlot.recipe;
      } else {
        recipe = pickRandomRecipe(plats, usedPlatIds);
      }
      dayMenu.repas.push({
        type: 'Dîner',
        typeKey: 'diner',
        recipe: recipe
      });
      usedPlatIds.push(recipe.id);
    }

    state.generatedMenu.push(dayMenu);
  }

  renderMenu();
  goToStep(2);
  
  const favoritesPlaced = favoriteSlots.length;
  if (favoritesPlaced > 0) {
    showToast(`Menu généré avec ${favoritesPlaced} favori${favoritesPlaced > 1 ? 's' : ''} !`);
  } else {
    showToast('Menu généré avec succès !');
  }
}

// Planifier les slots pour les favoris (1 par semaine de 7 jours)
function planFavoriteSlots(petitsDejeuners, plats) {
  const slots = [];
  if (state.favoriteRecipes.length === 0) return slots;

  // Séparer les favoris par catégorie
  const favoritePD = [];
  const favoritePlats = [];
  
  state.favoriteRecipes.forEach(recipeId => {
    const recipe = getRecipeById(recipeId);
    if (!recipe) return;
    
    // Vérifier que la recette est disponible (pas d'ingrédient exclu, budget ok)
    if (recipe.categorie === 'petit-dejeuner') {
      if (state.petitDejeuner && petitsDejeuners.some(r => r.id === recipeId)) {
        favoritePD.push(recipe);
      }
    } else if (recipe.categorie === 'plat') {
      if ((state.dejeuner || state.diner) && plats.some(r => r.id === recipeId)) {
        favoritePlats.push(recipe);
      }
    }
  });

  // Calculer combien de semaines on a
  const nbWeeks = Math.ceil(state.nbJours / 7);
  
  // Pour chaque semaine, placer les favoris
  for (let week = 0; week < nbWeeks; week++) {
    const weekStart = week * 7;
    const weekEnd = Math.min(weekStart + 7, state.nbJours);
    const daysInWeek = weekEnd - weekStart;
    
    // Collecter les jours disponibles pour cette semaine
    let availableDays = [];
    for (let d = weekStart; d < weekEnd; d++) {
      availableDays.push(d);
    }
    
    // Mélanger les jours disponibles
    availableDays = shuffleArray([...availableDays]);
    
    // Placer les favoris petits-déjeuners
    if (state.petitDejeuner) {
      favoritePD.forEach(recipe => {
        if (availableDays.length > 0) {
          // Trouver un jour où on n'a pas déjà placé un favori PD
          const dayIndex = availableDays.find(d => !slots.some(s => s.dayIndex === d && s.mealType === 'petit-dejeuner'));
          if (dayIndex !== undefined) {
            slots.push({ dayIndex, mealType: 'petit-dejeuner', recipe });
          }
        }
      });
    }
    
    // Placer les favoris plats (déjeuner ou dîner)
    favoritePlats.forEach(recipe => {
      if (availableDays.length > 0) {
        // Trouver un jour disponible
        for (const dayIndex of availableDays) {
          // Vérifier si on peut placer en déjeuner ou dîner
          const canDejeuner = state.dejeuner && !slots.some(s => s.dayIndex === dayIndex && s.mealType === 'dejeuner');
          const canDiner = state.diner && !slots.some(s => s.dayIndex === dayIndex && s.mealType === 'diner');
          
          if (canDejeuner || canDiner) {
            // Choisir aléatoirement entre déjeuner et dîner si les deux sont possibles
            let mealType;
            if (canDejeuner && canDiner) {
              mealType = Math.random() < 0.5 ? 'dejeuner' : 'diner';
            } else {
              mealType = canDejeuner ? 'dejeuner' : 'diner';
            }
            slots.push({ dayIndex, mealType, recipe });
            break;
          }
        }
      }
    });
  }
  
  return slots;
}

// Fonction utilitaire pour mélanger un tableau
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getAvailableRecipes(categorie) {
  return RECIPES.filter(recipe => {
    // Filtrer par catégorie
    if (recipe.categorie !== categorie) return false;

    // Filtrer par budget
    if (recipe.budget > state.budget) return false;

    // Filtrer par ingrédients exclus
    const hasExcluded = recipe.ingredients.some(ing => 
      state.excludedIngredients.includes(ing.nom)
    );
    if (hasExcluded) return false;

    // Récupérer les tags de la recette (ou tableau vide si non défini)
    const tags = recipe.tags || [];

    // Filtrer les petits-déjeuners selon les préférences
    if (categorie === 'petit-dejeuner') {
      if (state.pdejType === 'proteine') {
        // Ne garder que les recettes avec tag "proteine" ou "low-sugar"
        if (!tags.includes('proteine') && !tags.includes('low-sugar')) return false;
      } else if (state.pdejType === 'sucre') {
        // Ne garder que les recettes sucrées
        if (!tags.includes('sucre')) return false;
      }
    }

    // Préférence faible en sucre - exclure les recettes avec tag "sucre"
    if (state.prefLowSugar && tags.includes('sucre')) {
      return false;
    }

    // Préférence copieux - privilégier les recettes avec tag "copieux"
    // (On ne filtre pas strictement, on gère ça dans le tri)

    // Préférence rapide - filtrer sur le temps de préparation
    if (state.prefRapide && recipe.tempsPreparation > 20) {
      return false;
    }

    return true;
  });
}

// Fonction pour trier les recettes selon les préférences
function sortRecipesByPreference(recipes) {
  return recipes.sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;
    const tagsA = a.tags || [];
    const tagsB = b.tags || [];

    // Bonus pour les recettes copieuses si préférence activée
    if (state.prefCopieux) {
      if (tagsA.includes('copieux')) scoreA += 2;
      if (tagsB.includes('copieux')) scoreB += 2;
    }

    // Bonus pour les recettes protéinées
    if (state.pdejType === 'proteine' || state.prefLowSugar) {
      if (tagsA.includes('proteine')) scoreA += 1;
      if (tagsB.includes('proteine')) scoreB += 1;
    }

    // Bonus pour les recettes rapides
    if (state.prefRapide) {
      if (tagsA.includes('rapide')) scoreA += 1;
      if (tagsB.includes('rapide')) scoreB += 1;
    }

    return scoreB - scoreA; // Tri décroissant par score
  });
}

function pickRandomRecipe(recipes, usedIds) {
  // Essayer de trouver une recette non utilisée
  let available = recipes.filter(r => !usedIds.includes(r.id));
  
  if (available.length === 0) {
    // Si toutes les recettes ont été utilisées, réutiliser
    available = recipes;
  }

  // Trier par préférence
  const sorted = sortRecipesByPreference(available);
  
  // Sélection pondérée : les premières recettes ont plus de chances d'être choisies
  // si des préférences sont actives
  const hasPreferences = state.prefCopieux || state.prefRapide || state.prefLowSugar || state.pdejType !== 'all';
  
  if (hasPreferences && sorted.length > 3) {
    // 60% de chance de prendre parmi les 3 premières, 40% aléatoire
    if (Math.random() < 0.6) {
      const topCount = Math.min(3, sorted.length);
      return sorted[Math.floor(Math.random() * topCount)];
    }
  }
  
  // Sélection aléatoire parmi les disponibles
  return sorted[Math.floor(Math.random() * sorted.length)];
}

function regenerateAll() {
  generateMenu();
}

function regenerateMeal(jourIndex, repasIndex) {
  const meal = state.generatedMenu[jourIndex].repas[repasIndex];
  const categorie = meal.recipe.categorie;
  const recipes = getAvailableRecipes(categorie);
  
  if (recipes.length <= 1) {
    showToast('Pas d\'autre recette disponible');
    return;
  }

  // Trouver une recette différente
  let newRecipe;
  do {
    newRecipe = recipes[Math.floor(Math.random() * recipes.length)];
  } while (newRecipe.id === meal.recipe.id);

  state.generatedMenu[jourIndex].repas[repasIndex].recipe = newRecipe;
  renderMenu();
  showToast('Recette changée !');
}

// ========================================
// Affichage du menu
// ========================================
function renderMenu() {
  const container = document.getElementById('menuGrid');
  container.innerHTML = '';

  let totalWeekPrice = 0;

  state.generatedMenu.forEach((day, dayIndex) => {
    let dayTotal = 0;
    const daySection = document.createElement('div');
    daySection.className = 'day-section';
    
    const mealsHtml = day.repas.map((meal, mealIndex) => {
      const mealPrice = calculerPrixRecette(meal.recipe, state.nbPersonnes);
      dayTotal += mealPrice;
      const isFav = isFavorite(meal.recipe.id);
      const favClass = isFav ? 'active' : '';
      const favIcon = isFav ? '&#9733;' : '&#9734;'; // ★ ou ☆
      const cardClass = isFav ? 'meal-card is-favorite' : 'meal-card';
      return `
        <div class="${cardClass}">
          <div class="meal-actions">
            <button class="btn-favorite ${favClass}" onclick="toggleFavorite(${meal.recipe.id})" title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">
              ${favIcon}
            </button>
            <button class="btn-refresh" onclick="regenerateMeal(${dayIndex}, ${mealIndex})" title="Changer de recette">
              ↻
            </button>
          </div>
          <div class="meal-type">${meal.type}</div>
          <div class="meal-name" onclick="showRecipeDetails(${dayIndex}, ${mealIndex})">
            ${meal.recipe.nom}
          </div>
          <div class="meal-info">
            <span>⏱ ${meal.recipe.tempsPreparation} min</span>
            <span class="meal-price">${mealPrice.toFixed(2)} €</span>
          </div>
        </div>
      `;
    }).join('');

    totalWeekPrice += dayTotal;

    daySection.innerHTML = `
      <div class="day-header">
        <span>${day.jour} ${dayIndex + 1 > 7 ? `(Semaine ${Math.ceil((dayIndex + 1) / 7)})` : ''}</span>
        <span class="day-total">${dayTotal.toFixed(2)} €</span>
      </div>
      <div class="meals-row">
        ${mealsHtml}
      </div>
    `;
    container.appendChild(daySection);
  });

  // Afficher le total de la semaine
  renderWeekTotal(totalWeekPrice);
}

function renderWeekTotal(totalPrice) {
  // Vérifier si le conteneur existe déjà
  let totalContainer = document.getElementById('weekTotalContainer');
  if (!totalContainer) {
    totalContainer = document.createElement('div');
    totalContainer.id = 'weekTotalContainer';
    totalContainer.className = 'week-total-container';
    const menuGrid = document.getElementById('menuGrid');
    menuGrid.parentNode.insertBefore(totalContainer, menuGrid);
  }

  const pricePerPerson = totalPrice / state.nbPersonnes;
  const pricePerPersonPerDay = pricePerPerson / state.nbJours;

  totalContainer.innerHTML = `
    <div class="week-total-card">
      <div class="total-main">
        <span class="total-label">Budget total estimé</span>
        <span class="total-value">${totalPrice.toFixed(2)} €</span>
      </div>
      <div class="total-details">
        <div class="total-detail">
          <span>${pricePerPerson.toFixed(2)} €</span>
          <span class="detail-label">par personne</span>
        </div>
        <div class="total-detail">
          <span>${pricePerPersonPerDay.toFixed(2)} €</span>
          <span class="detail-label">par personne/jour</span>
        </div>
        <div class="total-detail">
          <span>${(totalPrice / state.nbJours).toFixed(2)} €</span>
          <span class="detail-label">par jour (famille)</span>
        </div>
      </div>
    </div>
  `;
}

// ========================================
// Détails d'une recette
// ========================================
function showRecipeDetails(jourIndex, repasIndex) {
  const meal = state.generatedMenu[jourIndex].repas[repasIndex];
  const recipe = meal.recipe;
  const totalPrice = calculerPrixRecette(recipe, state.nbPersonnes);
  const pricePerPerson = totalPrice / state.nbPersonnes;

  document.getElementById('modalTitle').textContent = recipe.nom;
  
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <div class="recipe-meta">
      <div class="recipe-meta-item">
        <span>⏱</span>
        <span>${recipe.tempsPreparation} minutes</span>
      </div>
      <div class="recipe-meta-item">
        <span>💰</span>
        <span>${'€'.repeat(recipe.budget)} - ${['Économique', 'Moyen', 'Premium'][recipe.budget - 1]}</span>
      </div>
      <div class="recipe-meta-item">
        <span>👥</span>
        <span>Pour ${state.nbPersonnes} personnes</span>
      </div>
    </div>
    <div class="recipe-price-box">
      <div class="recipe-price-total">
        <span class="price-label">Coût estimé</span>
        <span class="price-value">${totalPrice.toFixed(2)} €</span>
      </div>
      <div class="recipe-price-detail">
        soit ${pricePerPerson.toFixed(2)} € par personne
      </div>
    </div>
    <div class="recipe-ingredients">
      <h4>Ingrédients</h4>
      <ul>
        ${recipe.ingredients.map(ing => {
          const qty = formatQuantity(ing.quantite * state.nbPersonnes, ing.unite);
          const prixInfo = PRIX_INGREDIENTS[ing.nom];
          let prixIng = '';
          if (prixInfo) {
            const qteTotale = ing.quantite * state.nbPersonnes;
            const prixUnitaire = prixInfo.prixBase / prixInfo.qteParUnite;
            const prixTotal = qteTotale * prixUnitaire;
            prixIng = `<span class="ing-price">${prixTotal.toFixed(2)} €</span>`;
          }
          return `<li><span class="ing-name">${ing.nom} : ${qty}</span>${prixIng}</li>`;
        }).join('')}
      </ul>
    </div>
  `;

  // Bouton régénérer dans le modal
  document.getElementById('modalRegenerate').onclick = () => {
    regenerateMeal(jourIndex, repasIndex);
    closeModal();
  };

  document.getElementById('recipeModal').classList.add('active');
}

function closeModal() {
  document.getElementById('recipeModal').classList.remove('active');
}

// ========================================
// Liste de courses
// ========================================
function generateShoppingList() {
  state.shoppingList = {};

  // Parcourir tous les repas du menu
  state.generatedMenu.forEach(day => {
    day.repas.forEach(meal => {
      meal.recipe.ingredients.forEach(ing => {
        const key = ing.nom;
        const qty = ing.quantite * state.nbPersonnes;

        if (!state.shoppingList[key]) {
          state.shoppingList[key] = {
            nom: ing.nom,
            quantite: 0,
            unite: ing.unite,
            rayon: ing.rayon,
            checked: false
          };
        }
        state.shoppingList[key].quantite += qty;
      });
    });
  });

  renderShoppingList();
  goToStep(3);
}

function renderShoppingList() {
  const container = document.getElementById('shoppingList');
  const summary = document.getElementById('shoppingSummary');

  // Organiser par rayon et calculer les prix
  const byRayon = {};
  let totalPrice = 0;

  Object.values(state.shoppingList).forEach(item => {
    if (!byRayon[item.rayon]) {
      byRayon[item.rayon] = { items: [], total: 0 };
    }
    
    // Calculer le prix de l'article
    const prixInfo = PRIX_INGREDIENTS[item.nom];
    let itemPrice = 0;
    if (prixInfo) {
      const prixUnitaire = prixInfo.prixBase / prixInfo.qteParUnite;
      itemPrice = item.quantite * prixUnitaire;
    } else {
      itemPrice = 0.50; // Prix par défaut
    }
    
    item.prix = itemPrice;
    byRayon[item.rayon].items.push(item);
    byRayon[item.rayon].total += itemPrice;
    totalPrice += itemPrice;
  });

  // Calculer les stats
  const totalItems = Object.keys(state.shoppingList).length;
  const totalRepas = state.generatedMenu.reduce((acc, day) => acc + day.repas.length, 0);

  summary.innerHTML = `
    <div class="summary-item">
      <div class="summary-value">${state.nbPersonnes}</div>
      <div class="summary-label">Personnes</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${state.nbJours}</div>
      <div class="summary-label">Jours</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${totalRepas}</div>
      <div class="summary-label">Repas</div>
    </div>
    <div class="summary-item">
      <div class="summary-value">${totalItems}</div>
      <div class="summary-label">Articles</div>
    </div>
    <div class="summary-item summary-price">
      <div class="summary-value">${totalPrice.toFixed(2)} €</div>
      <div class="summary-label">Budget estimé</div>
    </div>
  `;

  // Ordre des rayons
  const rayonOrder = ['fruits-legumes', 'viandes', 'poissonnerie', 'produits-laitiers', 'boulangerie', 'epicerie', 'boissons', 'surgeles'];

  container.innerHTML = '';
  rayonOrder.forEach(rayonKey => {
    if (!byRayon[rayonKey]) return;

    const rayonData = byRayon[rayonKey];
    const items = rayonData.items;
    const section = document.createElement('div');
    section.className = 'rayon-section';
    section.innerHTML = `
      <div class="rayon-header">
        <span class="rayon-icon">${RAYON_ICONS[rayonKey] || '📦'}</span>
        <span class="rayon-name">${RAYONS[rayonKey]}</span>
        <span class="rayon-total">${rayonData.total.toFixed(2)} €</span>
        <span class="rayon-count">${items.length}</span>
      </div>
      <div class="items-list">
        ${items.map(item => `
          <div class="item-row ${item.checked ? 'checked' : ''}" onclick="toggleItem('${item.nom}')">
            <input type="checkbox" class="item-checkbox" ${item.checked ? 'checked' : ''}>
            <span class="item-name">${item.nom}</span>
            <span class="item-price">${item.prix.toFixed(2)} €</span>
            <span class="item-quantity">${formatQuantity(item.quantite, item.unite)}</span>
          </div>
        `).join('')}
      </div>
    `;
    container.appendChild(section);
  });

  // Injecter les données pour Bring! et initialiser le widget
  injectSchemaOrgData();
  initBringWidget();
}

function toggleItem(nom) {
  if (state.shoppingList[nom]) {
    state.shoppingList[nom].checked = !state.shoppingList[nom].checked;
    renderShoppingList();
  }
}

// ========================================
// Intégration Bring!
// ========================================
function injectSchemaOrgData() {
  // Supprimer l'ancien script s'il existe
  const existingScript = document.getElementById('schemaOrgRecipe');
  if (existingScript) existingScript.remove();

  // Créer le tableau d'ingrédients au format texte
  const ingredients = Object.values(state.shoppingList).map(item => {
    const qty = formatQuantity(item.quantite, item.unite);
    return `${qty} ${item.nom}`;
  });

  // Créer les données schema.org
  const schemaData = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    "name": `Liste de courses - Menu ${state.nbJours} jours`,
    "recipeYield": `${state.nbPersonnes} personnes`,
    "recipeIngredient": ingredients
  };

  // Injecter dans le DOM
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'schemaOrgRecipe';
  script.textContent = JSON.stringify(schemaData);
  document.head.appendChild(script);
}

function initBringWidget() {
  // Attendre que le script Bring! soit chargé
  if (window.bringwidgets && window.bringwidgets.import) {
    const widgetContainer = document.getElementById('bringWidget');
    if (widgetContainer) {
      // Mettre à jour les quantités (on utilise 1 car les quantités sont déjà calculées)
      window.bringwidgets.import.setBaseQuantity(1);
      window.bringwidgets.import.setRequestedQuantity(1);
      // Re-render le widget
      window.bringwidgets.import.render(widgetContainer, {
        url: window.location.href,
        language: 'fr',
        theme: 'light'
      });
    }
  } else {
    // Si le script n'est pas encore chargé, réessayer après 500ms
    setTimeout(initBringWidget, 500);
  }
}

// ========================================
// Utilitaires
// ========================================
function formatQuantity(qty, unite) {
  // Arrondir intelligemment
  let rounded;
  if (qty < 1) {
    rounded = Math.round(qty * 10) / 10;
  } else if (qty < 10) {
    rounded = Math.round(qty * 2) / 2;
  } else {
    rounded = Math.round(qty);
  }

  // Adapter l'unité au pluriel si nécessaire
  let uniteFormatted = unite;
  if (rounded > 1) {
    if (unite === 'pièce') uniteFormatted = 'pièces';
    if (unite === 'tranche') uniteFormatted = 'tranches';
    if (unite === 'gousse') uniteFormatted = 'gousses';
  }

  return `${rounded} ${uniteFormatted}`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('active');

  setTimeout(() => {
    toast.classList.remove('active');
  }, 3000);
}

// ========================================
// Export / Impression
// ========================================
function printList() {
  window.print();
}

function copyList() {
  let text = `LISTE DE COURSES\n`;
  text += `Pour ${state.nbPersonnes} personnes - ${state.nbJours} jours\n`;
  text += `================\n\n`;

  const byRayon = {};
  Object.values(state.shoppingList).forEach(item => {
    if (!byRayon[item.rayon]) {
      byRayon[item.rayon] = [];
    }
    byRayon[item.rayon].push(item);
  });

  const rayonOrder = ['fruits-legumes', 'viandes', 'poissonnerie', 'produits-laitiers', 'boulangerie', 'epicerie', 'boissons'];
  
  rayonOrder.forEach(rayonKey => {
    if (!byRayon[rayonKey]) return;
    text += `\n${RAYONS[rayonKey].toUpperCase()}\n`;
    text += `-----------------\n`;
    byRayon[rayonKey].forEach(item => {
      text += `□ ${item.nom}: ${formatQuantity(item.quantite, item.unite)}\n`;
    });
  });

  navigator.clipboard.writeText(text).then(() => {
    showToast('Liste copiée dans le presse-papier !');
  }).catch(() => {
    showToast('Erreur lors de la copie');
  });
}

// ========================================
// Sauvegarde des préférences
// ========================================
function savePreferences() {
  const prefs = {
    nbPersonnes: state.nbPersonnes,
    nbJours: state.nbJours,
    petitDejeuner: state.petitDejeuner,
    dejeuner: state.dejeuner,
    diner: state.diner,
    budget: state.budget,
    pdejType: state.pdejType,
    prefLowSugar: state.prefLowSugar,
    prefCopieux: state.prefCopieux,
    prefRapide: state.prefRapide,
    excludedIngredients: state.excludedIngredients,
    favoriteRecipes: state.favoriteRecipes
  };

  localStorage.setItem('menuGeneratorPrefs', JSON.stringify(prefs));
  saveFavoritesToStorage();
  showToast('Préférences sauvegardées !');
}

function loadPreferences() {
  const saved = localStorage.getItem('menuGeneratorPrefs');
  if (saved) {
    try {
      const prefs = JSON.parse(saved);
      // Charger les favoris séparément pour éviter d'écraser avec une valeur undefined
      const savedFavorites = prefs.favoriteRecipes || [];
      delete prefs.favoriteRecipes;
      
      state = { ...state, ...prefs };
      state.favoriteRecipes = savedFavorites;

      // Appliquer au formulaire
      document.getElementById('nbPersonnes').value = state.nbPersonnes;
      document.getElementById('nbJours').value = state.nbJours;
      document.getElementById('petitDejeuner').checked = state.petitDejeuner;
      document.getElementById('dejeuner').checked = state.dejeuner;
      document.getElementById('diner').checked = state.diner;
      
      const budgetRadio = document.querySelector(`input[name="budget"][value="${state.budget}"]`);
      if (budgetRadio) budgetRadio.checked = true;

      // Appliquer les préférences alimentaires
      const pdejRadio = document.querySelector(`input[name="pdejType"][value="${state.pdejType}"]`);
      if (pdejRadio) pdejRadio.checked = true;
      
      const prefLowSugar = document.getElementById('prefLowSugar');
      if (prefLowSugar) prefLowSugar.checked = state.prefLowSugar;
      
      const prefCopieux = document.getElementById('prefCopieux');
      if (prefCopieux) prefCopieux.checked = state.prefCopieux;
      
      const prefRapide = document.getElementById('prefRapide');
      if (prefRapide) prefRapide.checked = state.prefRapide;

    } catch (e) {
      console.error('Erreur chargement préférences:', e);
    }
  }
}

// ========================================
// Étape 4: Préparation des recettes
// ========================================
let selectedDay = 'all'; // 'all' ou index du jour

function goToPreparation() {
  selectedDay = 'all';
  renderPreparation();
  goToStep(4);
}

function renderPreparation() {
  const container = document.getElementById('preparationList');
  const filterContainer = document.getElementById('dayFilter');
  
  // Générer les filtres par jour
  let filterHtml = `
    <button class="day-filter-btn ${selectedDay === 'all' ? 'active' : ''}" onclick="filterByDay('all')">
      Tous les jours
    </button>
  `;
  state.generatedMenu.forEach((day, index) => {
    filterHtml += `
      <button class="day-filter-btn ${selectedDay === index ? 'active' : ''}" onclick="filterByDay(${index})">
        ${day.jour}${index + 1 > 7 ? ` S${Math.ceil((index + 1) / 7)}` : ''}
      </button>
    `;
  });
  filterContainer.innerHTML = filterHtml;
  
  // Générer les recettes
  let html = '';
  const daysToShow = selectedDay === 'all' ? state.generatedMenu : [state.generatedMenu[selectedDay]];
  const dayIndices = selectedDay === 'all' ? state.generatedMenu.map((_, i) => i) : [selectedDay];
  
  daysToShow.forEach((day, idx) => {
    const dayIndex = dayIndices[idx];
    html += `<div class="prep-day-section">`;
    html += `<h3 class="prep-day-title">${day.jour}${dayIndex + 1 > 7 ? ` (Semaine ${Math.ceil((dayIndex + 1) / 7)})` : ''}</h3>`;
    
    day.repas.forEach((meal, mealIndex) => {
      const recipe = meal.recipe;
      const etapes = recipe.etapes || [];
      
      html += `
        <div class="prep-recipe-card">
          <div class="prep-recipe-header">
            <div class="prep-recipe-info">
              <span class="prep-meal-type">${meal.type}</span>
              <h4 class="prep-recipe-name">${recipe.nom}</h4>
            </div>
            <div class="prep-recipe-meta">
              <span class="prep-time">⏱ ${recipe.tempsPreparation} min</span>
              <span class="prep-persons">👥 ${state.nbPersonnes} pers.</span>
            </div>
          </div>
          
          <div class="prep-ingredients-summary">
            <strong>Ingrédients :</strong>
            <span class="prep-ingredients-list">
              ${recipe.ingredients.map(ing => 
                `${formatQuantity(ing.quantite * state.nbPersonnes, ing.unite)} ${ing.nom}`
              ).join(' • ')}
            </span>
          </div>
          
          ${etapes.length > 0 ? `
            <div class="prep-steps">
              <strong>Préparation :</strong>
              <ol class="prep-steps-list">
                ${etapes.map((etape, stepIndex) => `
                  <li class="prep-step">
                    <span class="step-number-badge">${stepIndex + 1}</span>
                    <span class="step-text">${etape}</span>
                  </li>
                `).join('')}
              </ol>
            </div>
          ` : `
            <div class="prep-no-steps">
              <em>Instructions de préparation non disponibles pour cette recette.</em>
            </div>
          `}
        </div>
      `;
    });
    
    html += `</div>`;
  });
  
  container.innerHTML = html;
}

function filterByDay(day) {
  selectedDay = day;
  renderPreparation();
}

function printPreparation() {
  window.print();
}

// ========================================
// Gestion des favoris
// ========================================
function toggleFavorite(recipeId) {
  const index = state.favoriteRecipes.indexOf(recipeId);
  if (index > -1) {
    state.favoriteRecipes.splice(index, 1);
    showToast('Recette retirée des favoris');
  } else {
    state.favoriteRecipes.push(recipeId);
    showToast('Recette ajoutée aux favoris !');
  }
  
  // Mettre à jour l'affichage
  renderMenu();
  renderFavoritesSection();
  
  // Sauvegarder automatiquement
  saveFavoritesToStorage();
}

function isFavorite(recipeId) {
  return state.favoriteRecipes.includes(recipeId);
}

function getRecipeById(recipeId) {
  return RECIPES.find(r => r.id === recipeId);
}

function renderFavoritesSection() {
  const container = document.getElementById('favoritesList');
  if (!container) return;
  
  if (state.favoriteRecipes.length === 0) {
    container.innerHTML = `
      <div class="favorites-empty">
        <span class="favorites-empty-icon">&#9734;</span>
        <p>Aucune recette favorite</p>
        <small>Générez un menu et cliquez sur l'étoile pour ajouter des favoris</small>
      </div>
    `;
    return;
  }
  
  let html = '<div class="favorites-grid">';
  state.favoriteRecipes.forEach(recipeId => {
    const recipe = getRecipeById(recipeId);
    if (recipe) {
      const categoryLabel = recipe.categorie === 'petit-dejeuner' ? 'Petit-déj' : 'Plat';
      html += `
        <div class="favorite-item">
          <div class="favorite-info">
            <span class="favorite-category">${categoryLabel}</span>
            <span class="favorite-name">${recipe.nom}</span>
          </div>
          <button class="btn-remove-favorite" onclick="removeFavorite(${recipeId})" title="Retirer des favoris">
            &times;
          </button>
        </div>
      `;
    }
  });
  html += '</div>';
  
  // Ajouter le compteur
  const count = state.favoriteRecipes.length;
  html = `<div class="favorites-count">${count} favori${count > 1 ? 's' : ''} - apparaîtront 1x par semaine</div>` + html;
  
  container.innerHTML = html;
}

function removeFavorite(recipeId) {
  const index = state.favoriteRecipes.indexOf(recipeId);
  if (index > -1) {
    state.favoriteRecipes.splice(index, 1);
    renderFavoritesSection();
    renderMenu();
    saveFavoritesToStorage();
    showToast('Favori retiré');
  }
}

function saveFavoritesToStorage() {
  localStorage.setItem('menuGeneratorFavorites', JSON.stringify(state.favoriteRecipes));
}

function loadFavoritesFromStorage() {
  const saved = localStorage.getItem('menuGeneratorFavorites');
  if (saved) {
    try {
      state.favoriteRecipes = JSON.parse(saved);
    } catch (e) {
      console.error('Erreur chargement favoris:', e);
      state.favoriteRecipes = [];
    }
  }
}

// Activer la navigation par les boutons d'étape
document.querySelectorAll('.step').forEach(step => {
  step.addEventListener('click', () => {
    const stepNum = parseInt(step.dataset.step);
    // On peut revenir en arrière ou aller à une étape déjà complétée
    if (step.classList.contains('completed') || step.classList.contains('active')) {
      goToStep(stepNum);
    }
  });
});
