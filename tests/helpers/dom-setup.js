/**
 * Creates a minimal DOM structure for testing specific components
 * This is useful when tests need a lighter-weight DOM than the full index.html
 */
export function createMinimalDOM() {
  document.body.innerHTML = `
    <header>
      <span id="version"></span>
      <span id="last-updated"></span>
    </header>

    <nav class="tabs">
      <div class="tab-buttons">
        <button class="tab-btn active" data-tab="items">Items</button>
        <button class="tab-btn" data-tab="weapons">Weapons</button>
        <button class="tab-btn" data-tab="tomes">Tomes</button>
        <button class="tab-btn" data-tab="characters">Characters</button>
        <button class="tab-btn" data-tab="shrines">Shrines</button>
        <button class="tab-btn" data-tab="build-planner">Build Planner</button>
        <button class="tab-btn" data-tab="calculator">Calculator</button>
      </div>
    </nav>

    <nav class="controls">
      <div class="search-box">
        <input type="text" id="searchInput" placeholder="Search..." />
      </div>
      <div class="filters" id="filters"></div>
    </nav>

    <main>
      <div id="stats-summary" class="stats-panel"></div>

      <div id="items-tab" class="tab-content active">
        <div id="itemsContainer" class="items-grid"></div>
      </div>

      <div id="weapons-tab" class="tab-content">
        <div id="weaponsContainer" class="items-grid"></div>
      </div>

      <div id="tomes-tab" class="tab-content">
        <div id="tomesContainer" class="items-grid"></div>
      </div>

      <div id="characters-tab" class="tab-content">
        <div id="charactersContainer" class="items-grid"></div>
      </div>

      <div id="shrines-tab" class="tab-content">
        <div id="shrinesContainer" class="shrines-grid"></div>
      </div>

      <div id="build-planner-tab" class="tab-content">
        <select id="build-character"><option value="">Select Character...</option></select>
        <select id="build-weapon"><option value="">Select Weapon...</option></select>
        <div id="tomes-selection"></div>
        <div id="items-selection"></div>
        <div id="build-stats"></div>
        <div id="build-synergies"></div>
        <button id="export-build">Export Build</button>
        <button id="clear-build">Clear Build</button>
      </div>

      <div id="calculator-tab" class="tab-content">
        <select id="calc-item-select"><option value="">Choose an item...</option></select>
        <input type="number" id="calc-target" placeholder="e.g., 100" />
        <button id="calc-button">Calculate</button>
        <div id="calc-result" style="display: none;"></div>
      </div>
    </main>

    <div id="itemModal" class="modal" style="display: none;">
      <div class="modal-content">
        <span class="close">&times;</span>
        <div id="modalBody"></div>
      </div>
    </div>

    <div id="compareModal" class="modal" style="display: none;">
      <div class="modal-content modal-wide">
        <span class="close" id="closeCompare">&times;</span>
        <div id="compareBody"></div>
      </div>
    </div>

    <button id="compare-btn" class="floating-compare-btn" style="display: none;">
      <span class="compare-count">0</span> Compare Items
    </button>
  `;
}

/**
 * Creates filter UI for items tab testing
 */
export function createItemsFilterUI() {
  const filtersContainer = document.getElementById('filters');
  filtersContainer.innerHTML = `
    <label>Rarity:</label>
    <select id="rarityFilter">
      <option value="all">All Rarities</option>
      <option value="common">Common</option>
      <option value="uncommon">Uncommon</option>
      <option value="rare">Rare</option>
      <option value="epic">Epic</option>
      <option value="legendary">Legendary</option>
    </select>
    <label>Tier:</label>
    <select id="tierFilter">
      <option value="all">All Tiers</option>
      <option value="SS">SS Tier</option>
      <option value="S">S Tier</option>
      <option value="A">A Tier</option>
      <option value="B">B Tier</option>
      <option value="C">C Tier</option>
    </select>
    <label>Stacking:</label>
    <select id="stackingFilter">
      <option value="all">All</option>
      <option value="stacks_well">Stacks Well</option>
      <option value="one_and_done">One-and-Done</option>
    </select>
    <label>Sort:</label>
    <select id="sortBy">
      <option value="name">Name</option>
      <option value="tier">Tier</option>
      <option value="rarity">Rarity</option>
    </select>
  `;
}

/**
 * Creates filter UI for weapons/tomes/characters tab testing
 */
export function createTierFilterUI() {
  const filtersContainer = document.getElementById('filters');
  filtersContainer.innerHTML = `
    <label>Tier:</label>
    <select id="tierFilter">
      <option value="all">All Tiers</option>
      <option value="SS">SS Tier</option>
      <option value="S">S Tier</option>
      <option value="A">A Tier</option>
      <option value="B">B Tier</option>
      <option value="C">C Tier</option>
    </select>
    <label>Sort:</label>
    <select id="sortBy">
      <option value="name">Name</option>
      <option value="tier">Tier</option>
    </select>
  `;
}

/**
 * Creates filter UI for shrines tab testing
 */
export function createShrinesFilterUI() {
  const filtersContainer = document.getElementById('filters');
  filtersContainer.innerHTML = `
    <label>Type:</label>
    <select id="typeFilter">
      <option value="all">All Types</option>
      <option value="stat_upgrade">Stat Upgrade</option>
      <option value="combat">Combat</option>
      <option value="utility">Utility</option>
      <option value="risk_reward">Risk/Reward</option>
    </select>
  `;
}

/**
 * Gets the active tab name from DOM
 */
export function getActiveTab() {
  const activeBtn = document.querySelector('.tab-btn.active');
  return activeBtn?.getAttribute('data-tab') || null;
}

/**
 * Gets the active tab content element
 */
export function getActiveTabContent() {
  return document.querySelector('.tab-content.active');
}
