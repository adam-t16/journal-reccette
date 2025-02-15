// Initialize IndexedDB
const dbName = 'recipeJournalDB';
const dbVersion = 1;
let db;

const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('recipes')) {
        const store = db.createObjectStore('recipes', { keyPath: 'id' });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
};

// DB Operations
const dbOperations = {
  async addRecipe(recipe) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recipes'], 'readwrite');
      const store = transaction.objectStore('recipes');
      const request = store.add(recipe);
      
      request.onsuccess = () => resolve(recipe);
      request.onerror = () => reject(request.error);
    });
  },

  async getAllRecipes() {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recipes'], 'readonly');
      const store = transaction.objectStore('recipes');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async updateRecipe(recipe) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recipes'], 'readwrite');
      const store = transaction.objectStore('recipes');
      const request = store.put(recipe);
      
      request.onsuccess = () => resolve(recipe);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteRecipe(id) {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['recipes'], 'readwrite');
      const store = transaction.objectStore('recipes');
      const request = store.delete(id);
      
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }
};

function createRecipeJournal() {
  const app = document.querySelector('#app');
  let recipes = [];
  let isDarkMode = localStorage.getItem('darkMode') === 'true';
  let currentSort = 'date';
  let searchTerm = '';
  let editingRecipe = null;

  // Initialize dark mode
  if (isDarkMode) {
    document.body.classList.add('dark-mode');
  }

  async function createUI() {
    app.innerHTML = `
      <div class="container">
        <header>
          <h1>Recipe Journal</h1>
          <button class="theme-toggle">${isDarkMode ? '☀️' : '🌙'}</button>
        </header>
        
        <div class="controls">
          <div class="search-box">
            <input type="text" id="searchInput" placeholder="Search recipes...">
          </div>
          
          <div class="sort-box">
            <select id="sortSelect">
              <option value="date">Sort by Date</option>
              <option value="title">Sort by Title</option>
            </select>
          </div>
        </div>

        <form class="recipe-form" id="recipeForm">
          <div class="form-group">
            <label for="title">Recipe Title</label>
            <input type="text" id="title" required>
          </div>
          
          <div class="form-group">
            <label for="imageInput">Recipe Image</label>
            <div class="image-input-container">
              <input type="file" id="imageInput" accept="image/*">
              <span>or</span>
              <input type="url" id="imageUrl" placeholder="Enter image URL">
            </div>
            <img id="imagePreview" class="image-preview" alt="Preview">
          </div>
          
          <div class="form-group">
            <label for="ingredients">Ingredients</label>
            <textarea id="ingredients" rows="3" required></textarea>
          </div>
          
          <div class="form-group">
            <label for="instructions">Instructions</label>
            <textarea id="instructions" rows="4" required></textarea>
          </div>
          
          <div class="form-group">
            <label for="notes">Cooking Notes & Mistakes</label>
            <textarea id="notes" rows="2"></textarea>
          </div>
          
          <button type="submit" id="submitBtn">Add Recipe</button>
          <button type="button" id="cancelBtn" style="display: none;">Cancel</button>
        </form>

        <div class="recipes-grid" id="recipesGrid"></div>
      </div>
    `;

    // Add event listeners
    const form = document.getElementById('recipeForm');
    const themeToggle = document.querySelector('.theme-toggle');
    const imageInput = document.getElementById('imageInput');
    const imageUrl = document.getElementById('imageUrl');
    const imagePreview = document.getElementById('imagePreview');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const cancelBtn = document.getElementById('cancelBtn');

    form.addEventListener('submit', handleSubmit);
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('input', handleSearch);
    sortSelect.addEventListener('change', handleSort);
    cancelBtn.addEventListener('click', cancelEdit);
    
    // Image input handling
    imageInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          imagePreview.src = e.target.result;
          imagePreview.classList.add('visible');
          imageUrl.value = ''; // Clear URL input when file is selected
        };
        reader.readAsDataURL(file);
      }
    });
    
    imageUrl.addEventListener('input', function() {
      const url = this.value;
      if (url) {
        imagePreview.src = url;
        imagePreview.classList.add('visible');
        imageInput.value = ''; // Clear file input when URL is entered
        imagePreview.onerror = () => {
          imagePreview.classList.remove('visible');
        };
      } else {
        imagePreview.classList.remove('visible');
      }
    });

    // Load and display recipes
    await loadRecipes();
  }

  async function loadRecipes() {
    recipes = await dbOperations.getAllRecipes();
    displayRecipes();
  }

  function handleSearch(e) {
    searchTerm = e.target.value.toLowerCase();
    displayRecipes();
  }

  function handleSort(e) {
    currentSort = e.target.value;
    displayRecipes();
  }

  function filterAndSortRecipes() {
    let filtered = recipes;
    
    // Apply search filter
    if (searchTerm) {
      filtered = recipes.filter(recipe => 
        recipe.title.toLowerCase().includes(searchTerm) ||
        recipe.ingredients.toLowerCase().includes(searchTerm)
      );
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (currentSort === 'date') {
        return new Date(b.date) - new Date(a.date);
      } else {
        return a.title.localeCompare(b.title);
      }
    });
    
    return filtered;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    const imageInput = document.getElementById('imageInput');
    const imageUrl = document.getElementById('imageUrl');
    let imageData = '';

    if (imageInput.files.length > 0) {
      const file = imageInput.files[0];
      imageData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
    } else if (imageUrl.value) {
      imageData = imageUrl.value;
    }
    
    const recipeData = {
      id: editingRecipe ? editingRecipe.id : Date.now(),
      title: e.target.title.value,
      imageUrl: imageData,
      ingredients: e.target.ingredients.value,
      instructions: e.target.instructions.value,
      notes: e.target.notes.value,
      date: editingRecipe ? editingRecipe.date : new Date().toISOString()
    };

    if (editingRecipe) {
      await dbOperations.updateRecipe(recipeData);
      editingRecipe = null;
    } else {
      await dbOperations.addRecipe(recipeData);
    }

    // Add success animation
    e.target.classList.add('form-submitted');
    setTimeout(() => e.target.classList.remove('form-submitted'), 500);
    
    // Reset form
    e.target.reset();
    document.getElementById('imagePreview').classList.remove('visible');
    document.getElementById('submitBtn').textContent = 'Add Recipe';
    document.getElementById('cancelBtn').style.display = 'none';
    
    await loadRecipes();
  }

  function editRecipe(recipe) {
    editingRecipe = recipe;
    const form = document.getElementById('recipeForm');
    
    form.title.value = recipe.title;
    form.ingredients.value = recipe.ingredients;
    form.instructions.value = recipe.instructions;
    form.notes.value = recipe.notes;
    
    // Handle image preview for both URL and base64
    const imagePreview = document.getElementById('imagePreview');
    if (recipe.imageUrl) {
      imagePreview.src = recipe.imageUrl;
      imagePreview.classList.add('visible');
      if (recipe.imageUrl.startsWith('data:')) {
        document.getElementById('imageUrl').value = '';
      } else {
        document.getElementById('imageUrl').value = recipe.imageUrl;
      }
    }
    
    document.getElementById('submitBtn').textContent = 'Update Recipe';
    document.getElementById('cancelBtn').style.display = 'inline-block';
    
    form.scrollIntoView({ behavior: 'smooth' });
  }

  function cancelEdit() {
    editingRecipe = null;
    const form = document.getElementById('recipeForm');
    form.reset();
    document.getElementById('submitBtn').textContent = 'Add Recipe';
    document.getElementById('cancelBtn').style.display = 'none';
    document.getElementById('imagePreview').classList.remove('visible');
  }

  async function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe?')) {
      await dbOperations.deleteRecipe(id);
      await loadRecipes();
    }
  }

  function displayRecipes() {
    const grid = document.getElementById('recipesGrid');
    const filteredRecipes = filterAndSortRecipes();
    grid.innerHTML = '';

    filteredRecipes.forEach(recipe => {
      const card = document.createElement('div');
      card.className = 'recipe-card';
      
      const imageHtml = recipe.imageUrl 
        ? `<img src="${recipe.imageUrl}" alt="${recipe.title}" class="recipe-image" onerror="this.parentElement.innerHTML = '<div class=\'recipe-image-placeholder\'>🍳</div>'">`
        : '<div class="recipe-image-placeholder">🍳</div>';

      card.innerHTML = `
        ${imageHtml}
        <h3 class="recipe-title">${recipe.title}</h3>
        
        <div class="recipe-section">
          <h4>Ingredients</h4>
          <p>${recipe.ingredients}</p>
        </div>
        
        <div class="recipe-section">
          <h4>Instructions</h4>
          <p>${recipe.instructions}</p>
        </div>
        
        ${recipe.notes ? `
          <div class="recipe-section">
            <h4>Notes & Mistakes</h4>
            <p>${recipe.notes}</p>
          </div>
        ` : ''}
        
        <small>Added on ${new Date(recipe.date).toLocaleDateString()}</small>
        <div class="recipe-actions">
          <button class="edit-btn" onclick="window.editRecipe(${recipe.id})">Edit</button>
          <button class="delete-btn" onclick="window.deleteRecipe(${recipe.id})">Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDarkMode);
    document.querySelector('.theme-toggle').innerHTML = isDarkMode ? '☀️' : '🌙';
  }

  // Global functions for event handlers
  window.deleteRecipe = deleteRecipe;
  window.editRecipe = (id) => {
    const recipe = recipes.find(r => r.id === id);
    if (recipe) editRecipe(recipe);
  };

  // Initialize IndexedDB and create UI
  initDB().then(createUI).catch(error => {
    console.error('Failed to initialize database:', error);
    alert('Failed to initialize database. Please try again.');
  });
}

createRecipeJournal();