const STORAGE_KEY = "agua-cristalina-data-v5";
const ORPHAN_DEFAULT_CLEANUP_KEY = "agua-cristalina-orphan-default-cleanup-v1";
const SEED_OPERACAO_CLEANUP_KEY = "agua-cristalina-seed-operacao-cleanup-v1";
const SUPABASE_KEY = "agua-cristalina-supabase-config-v2";
const ROLE_KEY = "agua-cristalina-session";
const STORES_KEY = "agua-cristalina-stores-v1";
const USERS_KEY = "agua-cristalina-users-v1";
const CURRENT_STORE_KEY = "agua-cristalina-current-store";

const DEFAULT_STORE_ID = "default";
const DEFAULT_STORE_NAME = "WATERGEST";
const DEFAULT_REPORT_PHONE = "+244939667223";
const ROLE_LABELS = { admin: "Administrador", operacao: "Operacao" };

const VAT_RATES = [14, 7, 5, 0];
const FISCAL_REGIMES = {
  GERAL: "Regime Geral",
  SIMPLIFICADO: "Regime Simplificado",
  NAO_SUJEICAO: "Não sujeição",
  ISENTO: "Isento"
};
const DOCUMENT_TYPES = {
  FT: "Factura",
  FR: "Factura/Recibo",
  RC: "Recibo",
  NC: "Nota de Crédito",
  ND: "Nota de Débito"
};
const VAT_EXEMPTION_REASONS = {
  M01: "Artigo 12.º do CIVA",
  M02: "Artigo 13.º do CIVA",
  M04: "Operação não localizada em território angolano",
  M07: "Regime de IVA Simplificado",
  M99: "Outras isenções (declarar fundamentação)"
};
const SOFTWARE_PRODUCT_VERSION = "1.0.0";
const SOFTWARE_PRODUCT_NAME = "WATERGEST Gestao";
const paymentMethods = [
  "Cash",
  "Multicaixa TPA",
  "Express",
  "Saldo do cliente"
];

let currentRole = null;
let currentUser = null;
let sessionStarted = false;
let stores = [];
let users = [];
let activeStoreId = null;
const today = new Date().toISOString().slice(0, 10);

const defaultTables = {
  stores: "stores",
  clients: "customers",
  products: "products",
  stock: "inventory_items",
  movements: "inventory_movements",
  sales: "sales",
  expenses: "expenses",
  investments: "investments",
  water: "water_quality_records",
  maintenance: "maintenance_records"
};

const defaultSupabaseConfig = {
  url: "https://hpnucfsocbfnikrjwvdc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbnVjZnNvY2Jmbmlrcmp3dmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDk4MjUsImV4cCI6MjA5MjUyNTgyNX0.ayY28Vg5SnvJ0DRXmJTd3JVKxnsNfTdf43p6TKcm03Q",
  tables: { ...defaultTables }
};

const baseProducts = [
  { id: "water20", name: "Agua 20L", price: 500, stockControlled: false, unit: "un" },
  { id: "water6", name: "Agua 6L", price: 200, stockControlled: false, unit: "un" },
  { id: "water15", name: "Agua 1.5L", price: 50, stockControlled: false, unit: "un" },
  { id: "dispenser", name: "Dispensador", price: 4500, stockControlled: true, unit: "un" },
  { id: "support", name: "Suporte completo", price: 6000, stockControlled: true, unit: "un" }
];

const demoData = {
  clients: [
    { id: crypto.randomUUID(), name: "Maria Domingos", phone: "+244923111222", address: "Benfica", balance: 3500, debt: 0 },
    { id: crypto.randomUUID(), name: "Carlos Mateus", phone: "+244924333444", address: "Viana", balance: 0, debt: 1500 },
    { id: crypto.randomUUID(), name: "Escola Sol Nascente", phone: "+244925777888", address: "Kilamba", balance: 6000, debt: 0 }
  ],
  stock: [
    { id: crypto.randomUUID(), productId: "dispenser", quantity: 8, unitCost: 2600 },
    { id: crypto.randomUUID(), productId: "support", quantity: 12, unitCost: 3200 }
  ],
  sales: [
    { id: crypto.randomUUID(), clientId: "", customerName: "Maria Domingos", productId: "water20", productName: "Agua 20L", quantity: 20, paymentMethod: "Consolidada", entryType: "sale", date: today, total: 10000 },
    { id: crypto.randomUUID(), clientId: "", customerName: "Carlos Mateus", productId: "water6", productName: "Agua 6L", quantity: 25, paymentMethod: "TPA", entryType: "sale", date: today, total: 5000 },
    { id: crypto.randomUUID(), clientId: "", customerName: "Escola Sol Nascente", productId: "dispenser", productName: "Dispensador", quantity: 1, paymentMethod: "Express", entryType: "sale", date: today, total: 4500 }
  ],
  finance: [
    { id: crypto.randomUUID(), type: "expense", category: "Energia", amount: 4200, description: "Conta do dia", date: today },
    { id: crypto.randomUUID(), type: "investment", category: "Filtros", amount: 8000, description: "Reposicao de filtros", date: offsetDate(-3) }
  ],
  waterReadings: [
    { id: crypto.randomUUID(), ph: 7.1, tds: 84, temperature: 17.6, date: today, notes: "" },
    { id: crypto.randomUUID(), ph: 7.3, tds: 81, temperature: 18.2, date: offsetDate(-1), notes: "" }
  ],
  maintenance: [
    { id: crypto.randomUUID(), title: "Troca de filtro", cost: 6500, notes: "Filtro principal substituido", date: offsetDate(-4) }
  ]
};

let state = loadState();
let productCatalog = loadProductCatalog();
let currentPeriod = "daily";
let periodAnchor = today;
let activeSeries = { sales: true, expenses: true, profit: true };
let financePeriod = "daily";
let financeAnchor = today;
let activeFinanceSeries = { expenses: true, investments: true, impact: true };
let waterMetric = "ph";
let supabaseConfig = loadSupabaseConfig();
let supabaseClient = null;
let currentStore = null;
let syncState = { tone: "warning", text: "Modo local. Configure o Supabase para sincronizar." };

migrateClientsForDebt();

const views = [...document.querySelectorAll(".view")];
const navTabs = [...document.querySelectorAll(".nav-tab")];
const dashboardPeriodButtons = [...document.querySelectorAll("#periodSwitch .period-button")];
const financePeriodButtons = [...document.querySelectorAll("#financePeriodSwitch .period-button")];
const waterMetricButtons = [...document.querySelectorAll("#waterMetricSwitch .period-button")];

boot();
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => null);
  });
}

async function boot() {
  loadStoresAndUsers();
  migrateLegacyDataIfNeeded();
  cleanupOrphanDefaultStore();
  cleanupSeedOperacaoUser();
  bindLogin();
  bindFirstStoreSetup();
  const savedPassword = localStorage.getItem(ROLE_KEY);
  const savedUser = savedPassword ? users.find((u) => u.password === savedPassword) : null;
  const adminWithoutStore = savedUser && savedUser.role === "admin" && stores.length === 0;
  if (savedUser && (allowedStoresFor(savedUser).length > 0 || adminWithoutStore)) {
    await startSession(savedUser, { silent: true });
  } else {
    localStorage.removeItem(ROLE_KEY);
    showLoginScreen();
  }
}

function loadStoresAndUsers() {
  try {
    const rawStores = localStorage.getItem(STORES_KEY);
    stores = rawStores ? JSON.parse(rawStores) : [];
  } catch {
    stores = [];
  }
  try {
    const rawUsers = localStorage.getItem(USERS_KEY);
    users = rawUsers ? JSON.parse(rawUsers) : [];
  } catch {
    users = [];
  }
  if (!Array.isArray(stores)) stores = [];
  if (!Array.isArray(users) || users.length === 0) {
    users = [
      { id: crypto.randomUUID(), username: "Administrador", password: "244100", role: "admin", allowedStoreIds: ["*"] }
    ];
    persistUsers();
  }
}

function migrateLegacyDataIfNeeded() {
  const legacyState = localStorage.getItem(STORAGE_KEY);
  const legacyProducts = localStorage.getItem(`${STORAGE_KEY}:products`);
  const targetStateKey = stateKeyFor(DEFAULT_STORE_ID);
  const targetProductsKey = productsKeyFor(DEFAULT_STORE_ID);
  if (legacyState && !localStorage.getItem(targetStateKey)) {
    localStorage.setItem(targetStateKey, legacyState);
  }
  if (legacyProducts && !localStorage.getItem(targetProductsKey)) {
    localStorage.setItem(targetProductsKey, legacyProducts);
  }
  if (legacyState) localStorage.removeItem(STORAGE_KEY);
  if (legacyProducts) localStorage.removeItem(`${STORAGE_KEY}:products`);
}

function defaultStoreHasUserData() {
  try {
    const raw = localStorage.getItem(stateKeyFor(DEFAULT_STORE_ID));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return true;
    const counts = [
      Array.isArray(parsed.sales) ? parsed.sales.length : 0,
      Array.isArray(parsed.finance) ? parsed.finance.length : 0,
      Array.isArray(parsed.clients) ? parsed.clients.length : 0,
      Array.isArray(parsed.stock) ? parsed.stock.length : 0,
      Array.isArray(parsed.waterReadings) ? parsed.waterReadings.length : 0,
      Array.isArray(parsed.maintenance) ? parsed.maintenance.length : 0
    ];
    return counts.some((n) => n > 0);
  } catch {
    return true;
  }
}

function defaultStoreHasCustomProducts() {
  try {
    const raw = localStorage.getItem(productsKeyFor(DEFAULT_STORE_ID));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return true;
    return parsed.length > 0;
  } catch {
    return true;
  }
}

function cleanupOrphanDefaultStore() {
  if (localStorage.getItem(ORPHAN_DEFAULT_CLEANUP_KEY)) return;
  if (!Array.isArray(stores) || stores.length <= 1) return;
  const defaultStore = stores.find((s) => s.id === DEFAULT_STORE_ID);
  if (!defaultStore) return;
  if (defaultStore.name !== DEFAULT_STORE_NAME) return;
  if (defaultStoreHasUserData()) return;
  if (defaultStoreHasCustomProducts()) return;
  const currentStoreId = localStorage.getItem(CURRENT_STORE_KEY);
  if (currentStoreId === DEFAULT_STORE_ID) return;
  const referencedByUser = Array.isArray(users) && users.some((u) => {
    const ids = u?.allowedStoreIds;
    return Array.isArray(ids) && !ids.includes("*") && ids.length === 1 && ids[0] === DEFAULT_STORE_ID;
  });
  if (referencedByUser) return;

  const removedSnapshot = {
    version: 1,
    store: defaultStore,
    state: localStorage.getItem(stateKeyFor(DEFAULT_STORE_ID)),
    products: localStorage.getItem(productsKeyFor(DEFAULT_STORE_ID)),
    timestamp: new Date().toISOString()
  };
  try {
    localStorage.setItem(`${ORPHAN_DEFAULT_CLEANUP_KEY}:backup`, JSON.stringify(removedSnapshot));
  } catch {
    return;
  }

  stores = stores.filter((s) => s.id !== DEFAULT_STORE_ID);
  persistStores();
  localStorage.removeItem(stateKeyFor(DEFAULT_STORE_ID));
  localStorage.removeItem(productsKeyFor(DEFAULT_STORE_ID));
  if (Array.isArray(users) && users.length) {
    let changed = false;
    users = users.map((u) => {
      if (!Array.isArray(u.allowedStoreIds)) return u;
      if (u.allowedStoreIds.includes("*")) return u;
      const filtered = u.allowedStoreIds.filter((id) => id !== DEFAULT_STORE_ID);
      if (filtered.length === u.allowedStoreIds.length) return u;
      changed = true;
      return { ...u, allowedStoreIds: filtered.length ? filtered : [stores[0].id] };
    });
    if (changed) persistUsers();
  }
  localStorage.setItem(ORPHAN_DEFAULT_CLEANUP_KEY, "done");
}

function cleanupSeedOperacaoUser() {
  if (localStorage.getItem(SEED_OPERACAO_CLEANUP_KEY)) return;
  if (!Array.isArray(users) || users.length < 2) return;
  const seedOperacao = users.find((u) => u && u.role === "operacao" && u.username === "Operacao" && u.password === "032026");
  if (!seedOperacao) return;
  const remainingAdmins = users.filter((u) => u !== seedOperacao && u.role === "admin" && allowedStoresFor(u).length > 0);
  if (!remainingAdmins.length) return;
  const sessionPassword = localStorage.getItem(ROLE_KEY);
  if (sessionPassword === seedOperacao.password) localStorage.removeItem(ROLE_KEY);
  users = users.filter((u) => u !== seedOperacao);
  persistUsers();
  localStorage.setItem(SEED_OPERACAO_CLEANUP_KEY, "done");
}

function persistStores() {
  localStorage.setItem(STORES_KEY, JSON.stringify(stores));
}

function persistUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function stateKeyFor(storeId) {
  return `${STORAGE_KEY}:${storeId}`;
}

function productsKeyFor(storeId) {
  return `${STORAGE_KEY}:products:${storeId}`;
}

function getActiveStore() {
  return stores.find((s) => s.id === activeStoreId) || stores[0] || null;
}

function userHasAccessToStore(user, storeId) {
  if (!user || !storeId) return false;
  const allowed = user.allowedStoreIds || [];
  return allowed.includes("*") || allowed.includes(storeId);
}

function allowedStoresFor(user) {
  if (!user) return [];
  if ((user.allowedStoreIds || []).includes("*")) return stores.slice();
  return stores.filter((s) => user.allowedStoreIds.includes(s.id));
}

function pickInitialStore(user) {
  const remembered = localStorage.getItem(CURRENT_STORE_KEY);
  if (remembered && userHasAccessToStore(user, remembered) && stores.some((s) => s.id === remembered)) {
    return remembered;
  }
  const allowed = allowedStoresFor(user);
  return allowed.length ? allowed[0].id : stores[0]?.id || null;
}

function showLoginScreen() {
  document.getElementById("loginOverlay")?.removeAttribute("hidden");
  document.getElementById("appShell")?.setAttribute("hidden", "");
  document.getElementById("loginPassword")?.focus();
}

function hideLoginScreen() {
  document.getElementById("loginOverlay")?.setAttribute("hidden", "");
  document.getElementById("appShell")?.removeAttribute("hidden");
}

function bindLogin() {
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    const password = String(input.value || "").trim();
    const user = users.find((u) => u.password === password);
    if (!user) {
      errorBox?.removeAttribute("hidden");
      input.value = "";
      input.focus();
      return;
    }
    if (!allowedStoresFor(user).length) {
      if (!(user.role === "admin" && stores.length === 0)) {
        errorBox && (errorBox.textContent = "Usuario sem lojas atribuidas. Contacte o administrador.");
        errorBox?.removeAttribute("hidden");
        input.value = "";
        return;
      }
    }
    errorBox?.setAttribute("hidden", "");
    input.value = "";
    startSession(user);
  });
}

async function startSession(user, { silent = false } = {}) {
  currentUser = user;
  currentRole = user.role;
  localStorage.setItem(ROLE_KEY, user.password);

  if (stores.length === 0) {
    if (user.role !== "admin") {
      logout();
      return;
    }
    showFirstStoreSetup();
    return;
  }

  activeStoreId = pickInitialStore(user);
  if (activeStoreId) localStorage.setItem(CURRENT_STORE_KEY, activeStoreId);

  state = loadState();
  productCatalog = loadProductCatalog();

  applyRolePermissions();
  hideFirstStoreSetup();
  hideLoginScreen();

  if (!sessionStarted) {
    sessionStarted = true;
    hydrateDates();
    bindNavigation();
    bindForms();
    bindFilters();
    bindSupabaseControls();
    bindInteractiveControls();
    bindStoreSwitcher();
    bindAccessManagement();
    bindPromotions();
    renderSupabaseConfig();
    renderStoreSwitcher();
    renderAccessManagement();
    renderAll();
    await initializeSupabaseSession({ autoPull: true, silent: true });
  } else {
    renderStoreSwitcher();
    renderAccessManagement();
    renderAll();
  }
}

function logout() {
  localStorage.removeItem(ROLE_KEY);
  currentUser = null;
  currentRole = null;
  hideFirstStoreSetup();
  showLoginScreen();
}

function showFirstStoreSetup() {
  document.getElementById("loginOverlay")?.setAttribute("hidden", "");
  document.getElementById("appShell")?.setAttribute("hidden", "");
  const overlay = document.getElementById("firstStoreOverlay");
  if (!overlay) return;
  overlay.removeAttribute("hidden");
  const errorBox = document.getElementById("firstStoreError");
  errorBox?.setAttribute("hidden", "");
  document.getElementById("firstStoreName")?.focus();
}

function hideFirstStoreSetup() {
  document.getElementById("firstStoreOverlay")?.setAttribute("hidden", "");
}

function bindFirstStoreSetup() {
  const form = document.getElementById("firstStoreForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton?.disabled) return;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    let whatsapp = String(data.get("whatsapp") || "").trim();
    const errorBox = document.getElementById("firstStoreError");
    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.removeAttribute("hidden");
    };
    errorBox?.setAttribute("hidden", "");
    if (errorBox) errorBox.textContent = "";
    if (!name) {
      showError("Indique o nome da loja.");
      return;
    }
    if (whatsapp && !whatsapp.startsWith("+")) whatsapp = `+${whatsapp.replace(/[^0-9]/g, "")}`;
    if (!whatsapp) whatsapp = DEFAULT_REPORT_PHONE;
    const id = `loja-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newStore = { id, name, whatsapp };
    if (submitButton) submitButton.disabled = true;
    try {
      stores.push(newStore);
      persistStores();
      localStorage.setItem(CURRENT_STORE_KEY, id);
    } catch (error) {
      stores = stores.filter((s) => s !== newStore);
      showError("Nao foi possivel guardar a loja. Verifique o armazenamento e tente de novo.");
      if (submitButton) submitButton.disabled = false;
      return;
    }
    form.reset();
    hideFirstStoreSetup();
    try {
      await startSession(currentUser, { silent: true });
    } catch (error) {
      showError("Loja criada, mas houve uma falha ao iniciar a sessao. Recarregue a pagina.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById("firstStoreLogout")?.addEventListener("click", () => {
    logout();
  });
}

function applyRolePermissions() {
  document.body.classList.toggle("role-admin", currentRole === "admin");
  document.body.classList.toggle("role-operacao", currentRole === "operacao");
  const label = document.getElementById("sessionRoleLabel");
  if (label) {
    const fullName = currentUser?.username || ROLE_LABELS[currentRole] || "-";
    label.textContent = fullName.slice(0, 3);
    label.title = fullName;
  }

  if (currentRole === "operacao") {
    if (currentPeriod !== "daily" && currentPeriod !== "weekly") {
      currentPeriod = "daily";
      dashboardPeriodButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.period === "daily"));
    }
    const activeTab = document.querySelector(".nav-tab.active");
    if (activeTab && activeTab.classList.contains("role-admin-only")) {
      const fallback = document.querySelector(".nav-tab:not(.role-admin-only)");
      fallback?.click();
    }
    const saleEntry = document.getElementById("saleEntryType");
    if (saleEntry) saleEntry.value = "sale";
    const saleDate = document.getElementById("saleDate");
    if (saleDate) {
      saleDate.value = today;
      saleDate.min = today;
      saleDate.max = today;
    }
    activeSeries.profit = true;
    document.querySelectorAll('#seriesToggles input[data-series="profit"]').forEach((input) => {
      input.checked = true;
    });
  } else {
    const saleDate = document.getElementById("saleDate");
    if (saleDate) {
      saleDate.removeAttribute("min");
      saleDate.removeAttribute("max");
    }
    activeSeries.profit = true;
    document.querySelectorAll('#seriesToggles input[data-series="profit"]').forEach((input) => {
      input.checked = true;
    });
  }
}

// REST OF THE FUNCTIONS SKELETON (To be filled in chunk edits)
function loadState() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  const saved = localStorage.getItem(stateKeyFor(storeId));
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      return emptyState();
    }
  }
  return storeId === DEFAULT_STORE_ID ? normalizeState(structuredClone(demoData)) : emptyState();
}

function saveState() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  localStorage.setItem(stateKeyFor(storeId), JSON.stringify(state));
  localStorage.setItem(productsKeyFor(storeId), JSON.stringify(productCatalog));
}

function loadProductCatalog() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  const saved = localStorage.getItem(productsKeyFor(storeId));
  if (saved) return JSON.parse(saved);
  return storeId === DEFAULT_STORE_ID ? structuredClone(baseProducts) : structuredClone(baseProducts);
}

function emptyState() {
  return {
    clients: [],
    stock: [],
    sales: [],
    finance: [],
    waterReadings: [],
    maintenance: [],
    documents: [],
    promotions: []
  };
}

function normalizeState(raw) {
  const base = emptyState();
  const merged = { ...base, ...(raw || {}) };
  for (const key of Object.keys(base)) {
    if (!Array.isArray(merged[key])) merged[key] = [];
  }
  return merged;
}

function loadSupabaseConfig() {
  const saved = localStorage.getItem(SUPABASE_KEY);
  if (!saved) return structuredClone(defaultSupabaseConfig);
  try {
    const parsed = JSON.parse(saved);
    const url = (parsed.url && parsed.url.trim()) ? parsed.url.trim() : defaultSupabaseConfig.url;
    const anonKey = (parsed.anonKey && parsed.anonKey.trim()) ? parsed.anonKey.trim() : defaultSupabaseConfig.anonKey;
    return {
      ...defaultSupabaseConfig,
      ...parsed,
      url,
      anonKey,
      tables: { ...defaultTables, ...(parsed.tables || {}) }
    };
  } catch (e) {
    return structuredClone(defaultSupabaseConfig);
  }
}

function saveSupabaseConfig() {
  localStorage.setItem(SUPABASE_KEY, JSON.stringify(supabaseConfig));
}

function hydrateDates() {
  ["saleDate", "financeDate", "waterDate", "maintenanceDate"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = today;
  });
  const monthInput = document.getElementById("pdfYearMonth");
  if (monthInput) monthInput.value = today.slice(0, 7);
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  document.getElementById("mobileMenuToggle")?.setAttribute("aria-expanded", "false");
}

function bindNavigation() {
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((item) => item.classList.toggle("active", item === tab));
      views.forEach((view) => view.classList.toggle("active", view.id === tab.dataset.view));
      document.getElementById("viewTitle").textContent = tab.textContent;
      closeMobileMenu();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  const menuToggle = document.getElementById("mobileMenuToggle");
  const overlay = document.getElementById("mobileOverlay");
  menuToggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  overlay?.addEventListener("click", closeMobileMenu);

  dashboardPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentPeriod = button.dataset.period;
      dashboardPeriodButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderDashboard();
    });
  });

  document.getElementById("periodPrev")?.addEventListener("click", () => shiftPeriodAnchor(-1));
  document.getElementById("periodNext")?.addEventListener("click", () => shiftPeriodAnchor(1));
  document.getElementById("periodToday")?.addEventListener("click", () => {
    periodAnchor = today;
    syncAnchorInput();
    renderDashboard();
  });
  document.getElementById("periodAnchor")?.addEventListener("change", (event) => {
    const value = event.target.value;
    if (value) {
      periodAnchor = value;
      renderDashboard();
    }
  });

  document.querySelectorAll("#seriesToggles input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      activeSeries[input.dataset.series] = input.checked;
      renderDashboard();
    });
  });

  document.getElementById("monthlyReportButton")?.addEventListener("click", generateMonthlyPdf);
  document.getElementById("refreshReportsTop")?.addEventListener("click", renderReports);

  document.getElementById("sendWhatsappReport")?.addEventListener("click", sendWhatsappReport);
  document.getElementById("copyDailyReport")?.addEventListener("click", copyDailyReport);
  document.getElementById("refreshReports")?.addEventListener("click", renderReports);
}

function bindForms() {
  document.getElementById("saleForm")?.addEventListener("submit", onCreateSale);
  document.getElementById("clientForm")?.addEventListener("submit", onCreateClient);
  document.getElementById("clientsList")?.addEventListener("submit", (event) => {
    const form = event.target.closest(".client-adjust-form");
    if (!form) return;
    event.preventDefault();
    onAdjustClient(form);
  });
  document.getElementById("clientsList")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-client-action]");
    if (!button) return;
    const action = button.dataset.clientAction;
    const clientId = button.dataset.clientId;
    if (action === "edit") onEditClient(clientId);
    else if (action === "delete") onDeleteClient(clientId);
  });
  document.getElementById("productForm")?.addEventListener("submit", onCreateProduct);
  document.getElementById("stockForm")?.addEventListener("submit", onUpdateStock);
  document.getElementById("financeForm")?.addEventListener("submit", onFinanceEntry);
  document.getElementById("waterForm")?.addEventListener("submit", onWaterEntry);
  document.getElementById("maintenanceForm")?.addEventListener("submit", onMaintenanceEntry);
  document.getElementById("quickExpenseForm")?.addEventListener("submit", onQuickExpense);
  document.getElementById("logoutButton")?.addEventListener("click", logout);
}

async function onQuickExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const category = String(data.get("category") || "").trim();
  const amount = Number(data.get("amount"));
  if (!category || !Number.isFinite(amount) || amount <= 0) {
    return alert("Informe categoria e valor validos.");
  }
  state.finance.unshift({
    id: crypto.randomUUID(),
    type: "expense",
    category,
    amount,
    description: category,
    date: today
  });
  await persistMutation({
    success: "Despesa registrada e sincronizada.",
    fallback: "Despesa registrada localmente."
  });
  form.reset();
  renderAll();
}

function bindFilters() {
  ["filterClient", "filterProduct", "filterPayment", "filterDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderSalesTable);
  });
}

function bindSupabaseControls() {
  document.getElementById("supabaseForm")?.addEventListener("submit", onSaveSupabaseConfig);
  document.getElementById("pullSupabaseData")?.addEventListener("click", () => syncFromSupabase(false));
  document.getElementById("pushSupabaseData")?.addEventListener("click", syncToSupabase);
}

function bindInteractiveControls() {
  ["saleProduct", "saleQuantity", "saleEntryType"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderSalePreview);
    document.getElementById(id)?.addEventListener("change", renderSalePreview);
  });

  document.getElementById("saleClient")?.addEventListener("change", (e) => {
    const nifInput = document.getElementById("saleNif");
    if (!nifInput) return;
    const client = findClient(e.target.value);
    nifInput.value = client?.nif || "";
  });

  financePeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      financePeriod = button.dataset.financePeriod;
      financePeriodButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderFinance();
    });
  });

  document.getElementById("financePeriodPrev")?.addEventListener("click", () => shiftFinanceAnchor(-1));
  document.getElementById("financePeriodNext")?.addEventListener("click", () => shiftFinanceAnchor(1));
  document.getElementById("financePeriodToday")?.addEventListener("click", () => {
    financeAnchor = today;
    syncFinanceAnchorInput();
    renderFinance();
  });
  document.getElementById("financeAnchor")?.addEventListener("change", (event) => {
    const value = event.target.value;
    if (value) {
      financeAnchor = value;
      renderFinance();
    }
  });
  document.querySelectorAll("#financeSeriesToggles input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      activeFinanceSeries[input.dataset.financeSeries] = input.checked;
      renderFinance();
    });
  });

  waterMetricButtons.forEach((button) => {
    button.addEventListener("click", () => {
      waterMetric = button.dataset.waterMetric;
      waterMetricButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderWater();
    });
  });
}

function bindStoreSwitcher() {
  const select = document.getElementById("storeSwitcher");
  if (!select) return;
  select.addEventListener("change", async (event) => {
    const newId = event.target.value;
    if (!newId || newId === activeStoreId) {
      renderStoreSwitcher();
      return;
    }
    await switchActiveStore(newId);
  });
}

async function switchActiveStore(newId) {
  if (!newId || newId === activeStoreId) return;
  if (!userHasAccessToStore(currentUser, newId)) {
    alert("Voce nao tem acesso a esta loja.");
    renderStoreSwitcher();
    return;
  }
  saveState();
  activeStoreId = newId;
  localStorage.setItem(CURRENT_STORE_KEY, newId);
  state = loadState();
  productCatalog = loadProductCatalog();
  currentStore = null;
  renderStoreSwitcher();
  renderAccessManagement();
  renderAll();
  if (supabaseClient) {
    try {
      await ensureStore();
      await syncFromSupabase(true);
    } catch (error) {
      console.warn("Falha ao trocar loja no Supabase:", error);
    }
  }
}

function renderStoreSwitcher() {
  const select = document.getElementById("storeSwitcher");
  const wrapper = select?.closest(".store-switcher");
  if (!select || !wrapper) return;
  const allowed = allowedStoresFor(currentUser);
  if (allowed.length <= 1) {
    wrapper.style.display = "none";
  } else {
    wrapper.style.display = "";
  }
  select.innerHTML = allowed
    .map((s) => `<option value="${escapeAttr(s.id)}"${s.id === activeStoreId ? " selected" : ""}>${escapeHtml(s.name)}</option>`)
    .join("");
}

function bindAccessManagement() {
  document.getElementById("storeForm")?.addEventListener("submit", onCreateStore);
  document.getElementById("fiscalConfigForm")?.addEventListener("submit", onSaveFiscalConfig);
  bindInvoicesView();
  document.getElementById("userForm")?.addEventListener("submit", onCreateUser);
  document.getElementById("storesList")?.addEventListener("click", onStoresListAction);
  document.getElementById("usersList")?.addEventListener("click", onUsersListAction);
  document.getElementById("userFormRole")?.addEventListener("change", renderUserFormStores);
}

function renderAccessManagement() {
  renderStoresList();
  renderUsersList();
  renderUserFormStores();
}

function renderStoresList() {
  const container = document.getElementById("storesList");
  if (!container) return;
  if (!stores.length) {
    container.innerHTML = '<p class="helper-note">Nenhuma loja cadastrada ainda.</p>';
    return;
  }
  container.innerHTML = stores
    .map((store) => {
      const isActive = store.id === activeStoreId;
      const canDelete = stores.length > 1;
      const canActivate = userHasAccessToStore(currentUser, store.id) && !isActive;
      return `
        <article class="entity-card${isActive ? " is-active" : ""}" data-store-id="${escapeAttr(store.id)}">
          <div class="entity-card-header">
            <div>
              <h4 class="entity-card-title">${escapeHtml(store.name)}${isActive ? " · activa" : ""}</h4>
              <p class="entity-card-meta">WhatsApp: ${escapeHtml(store.whatsapp || "-")}</p>
            </div>
            <div class="entity-card-tags">
              ${canActivate ? `<button class="primary-button compact" data-action="activate-store" data-id="${escapeAttr(store.id)}">Activar</button>` : ""}
              <button class="ghost-button compact" data-action="edit-store" data-id="${escapeAttr(store.id)}">Editar</button>
              ${canDelete ? `<button class="danger-button" data-action="delete-store" data-id="${escapeAttr(store.id)}">Remover</button>` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUsersList() {
  const container = document.getElementById("usersList");
  if (!container) return;
  if (!users.length) {
    container.innerHTML = '<p class="helper-note">Nenhum usuario cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = users
    .map((user) => {
      const allowed = (user.allowedStoreIds || []).includes("*")
        ? "Todas as lojas"
        : (user.allowedStoreIds || [])
            .map((id) => stores.find((s) => s.id === id)?.name || "Loja removida")
            .join(", ") || "Nenhuma";
      const isMe = currentUser && user.id === currentUser.id;
      return `
        <article class="entity-card" data-user-id="${escapeAttr(user.id)}">
          <div class="entity-card-header">
            <div>
              <h4 class="entity-card-title">${escapeHtml(user.username)}${isMe ? " · voce" : ""}</h4>
              <p class="entity-card-meta">Senha: ${escapeHtml(user.password)} · Lojas: ${escapeHtml(allowed)}</p>
            </div>
            <div class="entity-card-tags">
              <span class="entity-tag${user.role === "admin" ? " role-admin" : ""}">${escapeHtml(ROLE_LABELS[user.role] || user.role)}</span>
              <button class="ghost-button compact" data-action="reset-password" data-id="${escapeAttr(user.id)}">Resetar senha</button>
              ${!isMe ? `<button class="danger-button" data-action="delete-user" data-id="${escapeAttr(user.id)}">Remover</button>` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUserFormStores() {
  const container = document.getElementById("userFormStoresOptions");
  const roleSelect = document.getElementById("userFormRole");
  if (!container) return;
  const isAdmin = roleSelect?.value === "admin";
  const wildcardOption = isAdmin
    ? `<label><input type="checkbox" value="*" name="storeAccess"> Todas (acesso completo)</label>`
    : "";
  container.innerHTML =
    wildcardOption +
    stores
      .map(
        (s) =>
          `<label><input type="checkbox" value="${escapeAttr(s.id)}" name="storeAccess"> ${escapeHtml(s.name)}</label>`
      )
      .join("");
}

function onCreateStore(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  let whatsapp = String(data.get("whatsapp") || "").trim();
  if (!name) return;
  if (whatsapp && !whatsapp.startsWith("+")) whatsapp = `+${whatsapp.replace(/[^0-9]/g, "")}`;
  if (!whatsapp) whatsapp = DEFAULT_REPORT_PHONE;
  if (stores.some((s) => normalizeText(s.name) === normalizeText(name))) {
    alert("Ja existe uma loja com esse nome.");
    return;
  }
  const id = `loja-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  stores.push({ id, name, whatsapp });
  persistStores();
  form.reset();
  renderAccessManagement();
  renderStoreSwitcher();
}

async function onStoresListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (!requireAdmin()) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const store = stores.find((s) => s.id === id);
  if (!store) return;

  if (action === "activate-store") {
    await switchActiveStore(id);
    return;
  }

  if (action === "edit-store") {
    const newName = prompt(`Novo nome da loja "${store.name}":`, store.name);
    if (newName === null) return;
    const trimmedName = String(newName).trim();
    if (!trimmedName) {
      alert("O nome da loja nao pode ficar em branco.");
      return;
    }
    if (stores.some((s) => s.id !== id && normalizeText(s.name) === normalizeText(trimmedName))) {
      alert("Ja existe outra loja com esse nome.");
      return;
    }
    const newPhoneRaw = prompt(`WhatsApp para a loja "${trimmedName}" (formato +244...):`, store.whatsapp || DEFAULT_REPORT_PHONE);
    if (newPhoneRaw === null) return;
    let newPhone = String(newPhoneRaw).trim();
    if (newPhone && !newPhone.startsWith("+")) newPhone = `+${newPhone.replace(/[^0-9]/g, "")}`;
    store.name = trimmedName;
    store.whatsapp = newPhone || DEFAULT_REPORT_PHONE;
    persistStores();
    if (id === activeStoreId) currentStore = null;
    renderAccessManagement();
    renderStoreSwitcher();
    return;
  }

  if (action === "delete-store") {
    if (stores.length <= 1) {
      alert("Nao e possivel remover a unica loja.");
      return;
    }
    if (!confirm(`Remover a loja "${store.name}"? Os dados desta loja continuarao guardados, mas ela ficara inacessivel.`)) return;
    stores = stores.filter((s) => s.id !== id);
    persistStores();
    users = users.map((u) => ({
      ...u,
      allowedStoreIds: (u.allowedStoreIds || []).filter((sid) => sid === "*" || sid !== id)
    }));
    persistUsers();
    if (activeStoreId === id) {
      activeStoreId = pickInitialStore(currentUser);
      if (activeStoreId) localStorage.setItem(CURRENT_STORE_KEY, activeStoreId);
      state = loadState();
      productCatalog = loadProductCatalog();
      renderAll();
    }
    renderAccessManagement();
    renderStoreSwitcher();
  }
}

function onCreateUser(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "").trim();
  const rawRole = String(data.get("role") || "operacao");
  const role = rawRole === "admin" ? "admin" : "operacao";
  let allowedStoreIds = data.getAll("storeAccess").map(String);
  const validStoreIds = new Set(stores.map((s) => s.id));
  if (role === "admin" && allowedStoreIds.includes("*")) {
    allowedStoreIds = ["*"];
  } else {
    allowedStoreIds = allowedStoreIds.filter((id) => id !== "*" && validStoreIds.has(id));
  }
  if (!username || !password) return;
  if (!/^\d{4,8}$/.test(password)) {
    alert("A senha deve ter entre 4 e 8 digitos numericos.");
    return;
  }
  if (users.some((u) => u.password === password)) {
    alert("Ja existe um usuario com essa senha.");
    return;
  }
  if (!allowedStoreIds.length) {
    alert("Selecione pelo menos uma loja para o usuario.");
    return;
  }
  users.push({
    id: crypto.randomUUID(),
    username,
    password,
    role,
    allowedStoreIds
  });
  persistUsers();
  form.reset();
  renderAccessManagement();
}

function onUsersListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (!requireAdmin()) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const user = users.find((u) => u.id === id);
  if (!user) return;

  if (action === "reset-password") {
    const newPassword = prompt(`Nova senha para "${user.username}" (4 a 8 digitos numericos):`, user.password);
    if (newPassword === null) return;
    const trimmed = String(newPassword).trim();
    if (!/^\d{4,8}$/.test(trimmed)) {
      alert("A senha deve ter entre 4 e 8 digitos numericos.");
      return;
    }
    if (users.some((u) => u.id !== id && u.password === trimmed)) {
      alert("Ja existe outro usuario com essa senha.");
      return;
    }
    user.password = trimmed;
    persistUsers();
    if (currentUser && currentUser.id === user.id) {
      currentUser.password = trimmed;
      localStorage.setItem(ROLE_KEY, trimmed);
    }
    renderAccessManagement();
    alert("Senha actualizada com sucesso.");
    return;
  }

  if (action === "delete-user") {
    if (currentUser && user.id === currentUser.id) {
      alert("Nao e possivel remover o proprio usuario logado.");
      return;
    }
    if (!confirm(`Remover o usuario "${user.username}"?`)) return;
    users = users.filter((u) => u.id !== id);
    persistUsers();
    renderAccessManagement();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function renderAll() {
  renderSelects();
  renderDashboard();
  renderSalePreview();
  renderSalesTable();
  renderClients();
  renderStock();
  renderFinance();
  renderWater();
  renderReports();
  renderInvoicesView();
  renderFiscalConfigForm();
  renderSyncStatus();
  renderPromotions();
}

function renderSupabaseConfig() {
  setInputValue("supUrl", supabaseConfig.url || "");
  setInputValue("supKey", supabaseConfig.anonKey || "");
  renderSyncStatus();
}

function setSyncStatus(tone, text) {
  syncState = { tone, text };
  renderSyncStatus();
}

function renderSyncStatus() {
  const pill = document.getElementById("syncStatus");
  if (!pill) return;

  pill.className = "status-pill";
  if (syncState.tone === "success") pill.className = "status-pill badge success";
  if (syncState.tone === "warning") pill.className = "status-pill badge warning";
  if (syncState.tone === "danger") pill.className = "status-pill badge danger";

  let details = document.getElementById("supabaseStatusText");
  if (!details) {
    pill.innerHTML = `<span id="supabaseStatusText"></span>`;
    details = document.getElementById("supabaseStatusText");
  }

  if (details) {
    details.textContent = syncState.text;
  }
}

function renderSelects() {
  const clientOptions = [{ id: "", name: "Todos os clientes" }, ...state.clients];
  const productOptions = [{ id: "", name: "Todos os produtos" }, ...productCatalog];

  fillOptionalSelect("saleClient", state.clients, "Sem cliente (opcional)");
  fillSelect("filterClient", clientOptions);
  fillSelect("saleProduct", productCatalog, "Escolha o produto");
  fillSelect("filterProduct", productOptions);
  fillSelect("stockProduct", productCatalog.filter((item) => item.stockControlled), "Escolha o produto");
}

function fillSelect(id, items, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = "";

  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  }

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function fillOptionalSelect(id, items, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function renderDashboard() {
  syncAnchorInput();
  const stats = buildPeriodStats(currentPeriod, periodAnchor);
  renderMetricCards(stats);
  renderInteractiveSalesChart(stats.timeline);
  renderPeriodRangeLabel(stats.timeline);
  renderProductPie(stats.productTotals);
  renderPaymentBreakdown(stats.paymentTotals);
  renderClientBalances();
  renderWaterSummary();
}

function syncAnchorInput() {
  const input = document.getElementById("periodAnchor");
  if (input && input.value !== periodAnchor) input.value = periodAnchor;
}

function shiftPeriodAnchor(direction) {
  const date = parseIsoUtc(periodAnchor);
  if (currentPeriod === "daily") {
    date.setUTCDate(date.getUTCDate() + direction);
  } else if (currentPeriod === "weekly") {
    date.setUTCDate(date.getUTCDate() + direction * 7);
  } else if (currentPeriod === "monthly") {
    addMonthsSafelyUtc(date, direction);
  } else {
    addMonthsSafelyUtc(date, direction * 12);
  }
  periodAnchor = isoFromUtc(date);
  renderDashboard();
}

function addMonthsSafelyUtc(date, months) {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
}

function renderPeriodRangeLabel(timeline) {
  const target = document.getElementById("periodRangeLabel");
  if (!target || !timeline.length) return;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const periodLabel = ({ daily: "dias", weekly: "semanas", monthly: "meses", yearly: "anos" })[currentPeriod];
  target.textContent = `Visualizando ${timeline.length} ${periodLabel} - ${first.label} a ${last.label}`;
}

function renderMetricCards(stats) {
  const periodWord = ({ daily: "do dia", weekly: "da semana", monthly: "do mes", yearly: "do ano" })[currentPeriod] || "do periodo";
  const selectedLabel = stats.selectedLabel || "";
  const metrics = currentRole === "operacao"
    ? [
        { label: `Lucro ${periodWord}`, value: currency(stats.profit), note: selectedLabel }
      ]
    : [
        { label: `Total de vendas ${periodWord}`, value: currency(stats.salesTotal), note: `${stats.salesCount} movimentos - ${selectedLabel}` },
        { label: `Lucro ${periodWord}`, value: currency(stats.profit), note: `Vendas - despesas - investimentos (${selectedLabel})` },
        { label: `Despesas ${periodWord}`, value: currency(stats.expenses), note: selectedLabel },
        { label: `Investimentos ${periodWord}`, value: currency(stats.investments), note: selectedLabel }
      ];

  const grid = document.getElementById("statsGrid");
  const template = document.getElementById("metricTemplate");
  if (!grid || !template) return;
  grid.innerHTML = "";

  metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-label").textContent = metric.label;
    node.querySelector("h3").textContent = metric.value;
    node.querySelector("span").textContent = metric.note;
    grid.appendChild(node);
  });
}

function renderInteractiveSalesChart(timeline) {
  renderInteractiveChart({
    svgId: "salesChartSvg",
    tooltipId: "salesChartTooltip",
    timeline,
    series: [
      { key: "sales", label: "Vendas", type: "bar", visible: activeSeries.sales, dotClass: "sales", dynamicFill: salesBarFill },
      { key: "expenses", label: "Despesas", type: "bar", visible: activeSeries.expenses, dotClass: "expenses", color: "#dc5b48", gradientId: "expensesBarGradient", gradientStops: [["0%", "#f5a293"], ["100%", "#dc5b48"]] },
      { key: "profit", label: "Lucro", type: "line", visible: activeSeries.profit, dotClass: "profit", color: "#7e6dff" }
    ],
    extraTooltipRows: (point) => [
      { label: "Investimentos", value: point.investments, dotClass: "investment" }
    ],
    formatValue: currency,
    minY: 0
  });
}

function renderInteractiveChart({ svgId, tooltipId, timeline, series, formatValue, extraTooltipRows, minY }) {
  const svg = document.getElementById(svgId);
  const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
  if (!svg) return;
  svg.innerHTML = "";
  if (tooltip) tooltip.style.opacity = "0";
  if (!timeline.length) return;

  const visibleSeries = series.filter((s) => s.visible !== false);
  if (!visibleSeries.length) return;

  const fmt = formatValue || ((v) => formatShortNumber(v));

  const width = 880;
  const height = 320;
  const paddingLeft = 60;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 48;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const numbers = timeline.flatMap((point) => visibleSeries.map((s) => Number(point[s.key]) || 0));
  const dataMax = numbers.length ? Math.max(...numbers, 0) : 0;
  const dataMin = numbers.length ? Math.min(...numbers, 0) : 0;

  const yMax = niceCeil(Math.max(dataMax, minY === 0 ? 1000 : Math.abs(dataMax) || 1));
  const baseMinY = minY !== undefined ? minY : (dataMin < 0 ? niceFloor(dataMin) : 0);
  const yMin = baseMinY > dataMin ? niceFloor(dataMin) : baseMinY;
  const range = Math.max(yMax - yMin, 1);
  const yFor = (value) => paddingTop + innerHeight - ((value - yMin) / range) * innerHeight;

  const barSeries = visibleSeries.filter((s) => s.type === "bar");
  const lineSeries = visibleSeries.filter((s) => s.type === "line");
  const slotWidth = innerWidth / timeline.length;
  const barGroupW = slotWidth * 0.62;
  const barW = barSeries.length ? Math.max(barGroupW / barSeries.length - 2, 6) : 0;

  const labelStep = Math.max(1, Math.ceil(timeline.length / 14));

  const gridLines = [];
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = yMin + ((yMax - yMin) * i) / ticks;
    const y = yFor(value);
    gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(16,49,77,0.10)" stroke-dasharray="4 6"/>`);
    gridLines.push(`<text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#647788">${formatShortNumber(value)}</text>`);
  }

  const defs = [];
  const seenGradients = new Set();
  visibleSeries.forEach((s) => {
    if (s.gradientId && !seenGradients.has(s.gradientId)) {
      seenGradients.add(s.gradientId);
      const stops = (s.gradientStops || [["0%", s.color || "#1aa8d8"], ["100%", s.color || "#1aa8d8"]])
        .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
        .join("");
      defs.push(`<linearGradient id="${s.gradientId}" x1="0" x2="0" y1="0" y2="1">${stops}</linearGradient>`);
    }
    if (s.type === "line" && s.areaGradientId && !seenGradients.has(s.areaGradientId)) {
      seenGradients.add(s.areaGradientId);
      defs.push(`<linearGradient id="${s.areaGradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0.02"/></linearGradient>`);
    }
  });

  const xLabels = [];
  const barNodes = [];
  const hoverZones = [];
  const linePoints = lineSeries.map((s) => ({ series: s, points: [] }));

  timeline.forEach((point, index) => {
    const slotX = paddingLeft + slotWidth * index + slotWidth / 2;
    if (index % labelStep === 0 || index === timeline.length - 1) {
      xLabels.push(`<text x="${slotX}" y="${height - paddingBottom + 18}" text-anchor="middle" font-size="11" fill="#647788">${point.label}</text>`);
    }

    const baseY = yFor(0);

    barSeries.forEach((s, bi) => {
      const groupStart = slotX - barGroupW / 2;
      const x = groupStart + bi * (barW + 2);
      const value = Number(point[s.key]) || 0;
      const yTop = yFor(value);
      const h = Math.max(Math.abs(baseY - yTop), 0);
      const top = Math.min(baseY, yTop);
      const fill = s.dynamicFill ? s.dynamicFill(value) : (s.gradientId ? `url(#${s.gradientId})` : (s.color || "#1aa8d8"));
      barNodes.push(`<rect class="chart-bar bar-${s.key}" data-index="${index}" x="${x}" y="${top}" width="${barW}" height="${h}" rx="5" fill="${fill}"/>`);
    });

    lineSeries.forEach((s, si) => {
      linePoints[si].points.push({ x: slotX, y: yFor(Number(point[s.key]) || 0), value: Number(point[s.key]) || 0, index });
    });

    hoverZones.push(`<rect class="chart-hover-zone" data-index="${index}" x="${paddingLeft + slotWidth * index}" y="${paddingTop}" width="${slotWidth}" height="${innerHeight}" fill="transparent"/>`);
  });

  const linesSvg = linePoints.map(({ series: s, points }) => {
    if (!points.length) return "";
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    let area = "";
    if (s.areaGradientId) {
      const baseY = yFor(yMin);
      area = `<path d="${path} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z" fill="url(#${s.areaGradientId})"/>`;
    }
    const dots = points.map((p) => `<circle class="chart-profit-dot" data-series="${s.key}" data-index="${p.index}" cx="${p.x}" cy="${p.y}" r="5" fill="${s.color}" stroke="white" stroke-width="2"/>`).join("");
    return `${area}<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join("");

  const baselineY = yFor(0);
  const baseline = yMin < 0 ? `<line x1="${paddingLeft}" y1="${baselineY}" x2="${width - paddingRight}" y2="${baselineY}" stroke="rgba(16,49,77,0.30)" stroke-width="1.2"/>` : "";

  svg.innerHTML = `
    <defs>${defs.join("")}</defs>
    ${gridLines.join("")}
    ${baseline}
    ${barNodes.join("")}
    ${linesSvg}
    ${hoverZones.join("")}
    ${xLabels.join("")}
  `;

  if (!tooltip) return;

  const showTooltip = (event, index) => {
    const point = timeline[index];
    if (!point) return;
    const rows = visibleSeries.map((s) => `<div class="tip-row"><span><span class="series-dot ${s.dotClass || s.key}"></span>${s.label}</span><b>${fmt(Number(point[s.key]) || 0, s)}</b></div>`).join("");
    const extras = (extraTooltipRows ? extraTooltipRows(point) : []).map((r) => `<div class="tip-row"><span><span class="series-dot ${r.dotClass || ""}"></span>${r.label}</span><b>${fmt(r.value)}</b></div>`).join("");
    tooltip.innerHTML = `<strong>${point.fullLabel || point.label}</strong>${rows}${extras}`;
    const shell = svg.parentElement.getBoundingClientRect();
    const x = event.clientX - shell.left;
    const y = event.clientY - shell.top;
    tooltip.style.left = `${Math.min(Math.max(x + 12, 12), shell.width - 220)}px`;
    tooltip.style.top = `${Math.max(y - 110, 12)}px`;
    tooltip.style.opacity = "1";
  };
  const hideTooltip = () => { tooltip.style.opacity = "0"; };

  svg.querySelectorAll(".chart-hover-zone, .chart-bar, .chart-profit-dot").forEach((el) => {
    el.addEventListener("mousemove", (event) => showTooltip(event, Number(el.dataset.index)));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      if (touch) showTooltip({ clientX: touch.clientX, clientY: touch.clientY }, Number(el.dataset.index));
    }, { passive: true });
  });
}

function salesBarFill(value) {
  if (value < 17000) return "#dc5b48";
  if (value <= 25000) return "#d4a425";
  return "#289b65";
}

function niceCeil(value) {
  if (value <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / exp;
  let m = 1;
  if (norm > 5) m = 10;
  else if (norm > 2) m = 5;
  else if (norm > 1) m = 2;
  return m * exp;
}

function niceFloor(value) {
  return -niceCeil(Math.abs(value));
}

function formatShortNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return Math.round(value).toString();
}

function renderPaymentBreakdown(paymentTotals) {
  const wrapper = document.getElementById("paymentBreakdown");
  if (!wrapper) return;
  wrapper.innerHTML = "";
  
  const allowed = ["Cash", "Multicaixa TPA", "Express"];
  allowed.forEach((method) => {
    const value = paymentTotals[method] || 0;
    const card = document.createElement("div");
    card.className = "mini-card";
    card.innerHTML = `<strong>${method}</strong><small>${currency(value)}</small>`;
    wrapper.appendChild(card);
  });
}

function renderClientBalances() {
  const target = document.getElementById("clientBalances");
  if (!target) return;
  target.innerHTML = "";

  const filtered = state.clients.filter((c) => (c.balance || 0) > 0 || (c.debt || 0) > 0);
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "helper-note";
    empty.textContent = "Nenhum cliente com saldo ou divida.";
    target.appendChild(empty);
    return;
  }

  filtered
    .sort((a, b) => ((b.debt || 0) + (b.balance || 0)) - ((a.debt || 0) + (a.balance || 0)))
    .forEach((client) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const debt = client.debt || 0;
      const balance = client.balance || 0;
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <small>${escapeHtml(client.phone || "")}</small>
        </div>
        <div class="balance-stack">
          ${balance > 0 ? `<span class="badge success">Saldo: ${currency(balance)}</span>` : ""}
          ${debt > 0 ? `<span class="badge danger">Divida: ${currency(debt)}</span>` : ""}
        </div>
      `;
      target.appendChild(row);
    });
}

function renderWaterSummary() {
  const target = document.getElementById("waterSummary");
  if (!target) return;
  target.innerHTML = "";

  state.waterReadings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "mini-card";
      row.innerHTML = `<strong>${entry.date}</strong><small>pH ${entry.ph} | TDS ${entry.tds} | Temp ${entry.temperature} C</small>`;
      target.appendChild(row);
    });
}

function renderProductPie(productTotals) {
  const chart = document.getElementById("productPieChart");
  const legend = document.getElementById("productPieLegend");
  if (!chart || !legend) return;

  const items = Object.entries(productTotals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!items.length) {
    chart.innerHTML = `<div class="pie-empty">Sem vendas no periodo</div>`;
    legend.innerHTML = "";
    return;
  }

  const colors = ["#1aa8d8", "#0f5f8f", "#41d2f3", "#f0c35a", "#289b65", "#dc5b48", "#7e6dff"];
  const total = items.reduce((sum, [, value]) => sum + value, 0);
  let accumulator = 0;
  const slices = items.map(([name, value], index) => {
    const start = accumulator;
    const portion = (value / total) * 100;
    accumulator += portion;
    return { name, value, color: colors[index % colors.length], start, end: accumulator };
  });

  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const innerR = r * 0.48;

  const arcPath = (startPct, endPct) => {
    if (endPct - startPct >= 99.999) {
      return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} L ${cx - 0.001} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR} Z`;
    }
    const toXY = (pct, radius) => {
      const a = (pct / 100) * Math.PI * 2 - Math.PI / 2;
      return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)];
    };
    const [x1, y1] = toXY(startPct, r);
    const [x2, y2] = toXY(endPct, r);
    const [x3, y3] = toXY(endPct, innerR);
    const [x4, y4] = toXY(startPct, innerR);
    const large = endPct - startPct > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${large} 0 ${x4} ${y4} Z`;
  };

  const paths = slices.map((slice, i) => `
    <path class="pie-slice" data-i="${i}" d="${arcPath(slice.start, slice.end)}" fill="${slice.color}"
      stroke="rgba(255,255,255,0.92)" stroke-width="1.5"></path>
  `).join("");

  chart.innerHTML = `
    <div class="pie-chart-wrap">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="pie-chart-svg" role="img" aria-label="Vendas por produto">
        ${paths}
      </svg>
      <div class="pie-tooltip" id="pieTooltip" hidden></div>
    </div>
  `;
  legend.innerHTML = "";

  slices.forEach((slice) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    const pct = ((slice.value / total) * 100).toFixed(1);
    row.innerHTML = `
      <div>
        <span class="legend-dot" style="background:${slice.color}"></span>
        <strong>${escapeHtml(slice.name)}</strong>
      </div>
      <small>${currency(slice.value)} · ${pct}%</small>
    `;
    legend.appendChild(row);
  });

  const tooltip = chart.querySelector("#pieTooltip");
  const wrap = chart.querySelector(".pie-chart-wrap");
  const showTip = (idx, evt) => {
    const slice = slices[idx];
    if (!slice) return;
    const pct = ((slice.value / total) * 100).toFixed(1);
    tooltip.innerHTML = `
      <span class="pie-tooltip-dot" style="background:${slice.color}"></span>
      <div>
        <strong>${escapeHtml(slice.name)}</strong>
        <small>${currency(slice.value)} · ${pct}%</small>
      </div>
    `;
    tooltip.hidden = false;
    const rect = wrap.getBoundingClientRect();
    const x = (evt.clientX || rect.left + rect.width / 2) - rect.left;
    const y = (evt.clientY || rect.top + rect.height / 2) - rect.top;
    tooltip.style.left = Math.min(rect.width - 10, Math.max(10, x + 12)) + "px";
    tooltip.style.top = Math.max(0, y - 36) + "px";
    chart.querySelectorAll(".pie-slice").forEach((p, i) => {
      p.classList.toggle("pie-slice-active", i === idx);
    });
  };
  const hideTip = () => {
    if (tooltip) tooltip.hidden = true;
    chart.querySelectorAll(".pie-slice-active").forEach((p) => p.classList.remove("pie-slice-active"));
  };
  chart.querySelectorAll(".pie-slice").forEach((p) => {
    const idx = Number(p.dataset.i);
    p.addEventListener("mousemove", (e) => showTip(idx, e));
    p.addEventListener("mouseleave", hideTip);
    p.addEventListener("click", (e) => showTip(idx, e));
    p.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      showTip(idx, { clientX: t.clientX, clientY: t.clientY });
    }, { passive: true });
  });
  document.addEventListener("touchstart", (e) => {
    if (wrap && !wrap.contains(e.target)) hideTip();
  }, { passive: true });
}

function renderSalesTable() {
  const tbody = document.getElementById("salesTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const filters = {
    clientId: document.getElementById("filterClient").value,
    productId: document.getElementById("filterProduct").value,
    paymentMethod: document.getElementById("filterPayment").value,
    date: document.getElementById("filterDate").value
  };

  const filtered = state.sales
    .filter((item) => !filters.clientId || item.clientId === filters.clientId)
    .filter((item) => !filters.productId || item.productId === filters.productId)
    .filter((item) => !filters.paymentMethod || item.paymentMethod === filters.paymentMethod)
    .filter((item) => !filters.date || item.date === filters.date)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  filtered.forEach((sale) => {
    const tr = document.createElement("tr");

    // Calculate net amount using VAT or default of 14%
    const prod = findProduct(sale.productId);
    const vatRate = prod ? (prod.vatRate !== null && prod.vatRate !== undefined ? prod.vatRate : 14) : 14;
    const isExempt = vatRate === 0;
    const netAmount = isExempt ? sale.total : (sale.total / (1 + (vatRate / 100)));

    let badgeClass = "badge muted";
    if (sale.entryType === "sale" || sale.entryType === "deposit" || sale.entryType === "settlement") {
      badgeClass = "badge success";
    } else if (sale.entryType === "withdrawal") {
      badgeClass = "badge warning";
    } else if (sale.entryType === "debt") {
      badgeClass = "badge danger";
    }

    const printBtn = sale.fiscalDoc
      ? `<button type="button" class="ghost-button p-1 text-xs" onclick="downloadInvoicePdf('${sale.id}')" title="Baixar PDF">📥 PDF</button>`
      : "";
    const deleteBtn = `<button type="button" class="ghost-button p-1 text-xs text-danger font-semibold" onclick="deleteSaleRecord('${sale.id}')" title="Remover Registo">🗑️</button>`;

    tr.innerHTML = `
      <td class="whitespace-nowrap font-mono text-xs">${sale.date}</td>
      <td><span class="${badgeClass}">${translateEntryType(sale.entryType)}</span></td>
      <td>${escapeHtml(findClient(sale.clientId)?.name || sale.customerName || "Cliente avulso")}</td>
      <td>${escapeHtml(findProduct(sale.productId)?.name || sale.productName || "-")}</td>
      <td class="text-center font-bold" style="font-size: 1.1em;">${Number(sale.quantity || 1)}</td>
      <td class="text-right font-semibold">${currency(sale.total)}</td>
      <td class="text-right text-muted text-xs font-mono">${currency(netAmount)}</td>
      <td>
        <div class="flex gap-1 justify-center">
          ${printBtn}
          ${deleteBtn}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderClientPurchaseSummary(filters.clientId);
}

function renderClientPurchaseSummary(clientId) {
  const container = document.getElementById("clientPurchaseSummary");
  if (!container) return;
  if (!clientId) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }
  const client = findClient(clientId);
  const sales = state.sales.filter((s) => s.clientId === clientId && s.entryType === "sale");

  if (!sales.length) {
    container.hidden = false;
    container.innerHTML = `
      <div class="client-summary-header">
        <strong>${escapeHtml(client?.name || "Cliente")}</strong>
        ${client?.nif ? `<small>NIF: ${escapeHtml(client.nif)}</small>` : `<small>Sem NIF registado</small>`}
      </div>
      <p class="helper-note">Sem compras registadas para este cliente.</p>
    `;
    return;
  }

  const byProduct = new Map();
  let grandQty = 0;
  let grandTotal = 0;
  sales.forEach((s) => {
    const name = findProduct(s.productId)?.name || s.productName || "—";
    const cur = byProduct.get(name) || { qty: 0, total: 0, count: 0 };
    cur.qty += Number(s.quantity) || 0;
    cur.total += Number(s.total) || 0;
    cur.count += 1;
    byProduct.set(name, cur);
    grandQty += Number(s.quantity) || 0;
    grandTotal += Number(s.total) || 0;
  });

  const rows = [...byProduct.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, info]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td class="num">${info.count}</td>
        <td class="num">${info.qty}</td>
        <td class="num">${currency(info.total)}</td>
      </tr>
    `).join("");

  container.hidden = false;
  container.innerHTML = `
    <div class="client-summary-header">
      <div>
        <strong>${escapeHtml(client?.name || "Cliente")}</strong>
        ${client?.nif ? `<small>NIF: ${escapeHtml(client.nif)}</small>` : `<small>Sem NIF registado</small>`}
      </div>
      <div class="client-summary-totals">
        <span class="badge success">${sales.length} venda${sales.length === 1 ? "" : "s"}</span>
        <span class="badge muted">${grandQty} unidades</span>
        <span class="badge">${currency(grandTotal)}</span>
      </div>
    </div>
    <div class="table-wrap client-summary-table">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th class="num">Nº de compras</th>
            <th class="num">Total unidades</th>
            <th class="num">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderClients() {
  const target = document.getElementById("clientsList");
  if (!target) return;
  target.innerHTML = "";

  state.clients.forEach((client) => {
    const row = document.createElement("div");
    row.className = "list-row client-row";
    const debt = client.debt || 0;
    row.innerHTML = `
      <div class="client-row-info">
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <small>${escapeHtml(client.phone || "")} | ${escapeHtml(client.address || "")}</small>
        </div>
        <div class="balance-stack">
          <span class="badge ${client.balance > 0 ? "success" : "muted"}">Saldo: ${currency(client.balance)}</span>
          <span class="badge ${debt > 0 ? "danger" : "muted"}">Divida: ${currency(debt)}</span>
        </div>
      </div>
      <form class="client-adjust-form" data-client-id="${escapeAttr(client.id)}">
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor (Kz)" required>
        <select name="action" aria-label="Tipo de ajuste">
          <option value="deposit">Saldo</option>
          <option value="debt">Divida</option>
        </select>
        <button class="primary-button" type="submit">Aplicar</button>
      </form>
      <div class="client-admin-actions role-admin-only">
        <button type="button" class="ghost-button" data-client-action="edit" data-client-id="${escapeAttr(client.id)}">Editar</button>
        <button type="button" class="ghost-button danger" data-client-action="delete" data-client-id="${escapeAttr(client.id)}">Excluir</button>
      </div>
    `;
    target.appendChild(row);
  });
}

async function onEditClient(clientId) {
  if (!requireAdmin()) return;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const newName = prompt("Nome do cliente:", client.name || "");
  if (newName === null) return;
  const trimmedName = newName.trim();
  if (!trimmedName) return alert("Nome nao pode ficar vazio.");

  const newPhone = prompt("Telefone:", client.phone || "");
  if (newPhone === null) return;

  const newAddress = prompt("Endereco:", client.address || "");
  if (newAddress === null) return;

  const newNif = prompt("NIF (deixe vazio para Consumidor Final):", client.nif || "");
  if (newNif === null) return;

  client.name = trimmedName;
  client.phone = newPhone.trim();
  client.address = newAddress.trim();
  client.nif = newNif.trim();

  state.sales.forEach((sale) => {
    if (sale.clientId && String(sale.clientId) === String(client.id)) {
      sale.customerName = trimmedName;
    }
  });

  await persistMutation({
    success: "Cliente actualizado e sincronizado.",
    fallback: "Cliente actualizado localmente."
  });
  renderAll();
}

async function onDeleteClient(clientId) {
  if (!requireAdmin()) return;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const balance = client.balance || 0;
  const debt = client.debt || 0;
  const warnings = [];
  if (balance > 0) warnings.push(`Saldo a favor: ${currency(balance)}`);
  if (debt > 0) warnings.push(`Divida em aberto: ${currency(debt)}`);
  const linkedSales = state.sales.filter((s) => String(s.clientId) === String(client.id)).length;
  if (linkedSales > 0) warnings.push(`${linkedSales} ${linkedSales === 1 ? "lancamento" : "lancamentos"} no historico`);

  const safeName = String(client.name || "").replace(/[\r\n\t\u0000-\u001F\u007F]+/g, " ").trim().slice(0, 80) || "(sem nome)";
  const message = `Excluir o cliente "${safeName}"?` +
    (warnings.length ? `\n\nAtencao:\n- ${warnings.join("\n- ")}\n\nO historico de vendas mantem o nome para registo, mas o cliente sera removido da lista.` : "");
  if (!confirm(message)) return;

  state.sales.forEach((sale) => {
    if (String(sale.clientId) === String(client.id)) {
      sale.customerName = sale.customerName || client.name;
      sale.clientId = "";
    }
  });
  state.clients = state.clients.filter((c) => String(c.id) !== String(client.id));

  await persistMutation({
    success: "Cliente excluido e sincronizado.",
    fallback: "Cliente excluido localmente."
  });
  renderAll();
}

async function onAdjustClient(form) {
  const clientId = form.dataset.clientId;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const amount = Number(new FormData(form).get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return alert("Informe um valor valido.");
  }
  const action = String(new FormData(form).get("action"));

  if (action === "deposit") {
    client.balance = (client.balance || 0) + amount;
  } else if (action === "debt") {
    client.debt = (client.debt || 0) + amount;
  } else {
    return;
  }

  await persistMutation({
    success: "Ajuste guardado e sincronizado.",
    fallback: "Ajuste guardado localmente."
  });

  renderAll();
}

function renderStock() {
  const target = document.getElementById("stockList");
  if (!target) return;
  target.innerHTML = "";

  state.stock.forEach((item) => {
    const product = findProduct(item.productId);
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <strong>${product?.name || item.productId}</strong>
        <small>${item.quantity} unidades | custo medio ${currency(item.unitCost)}</small>
      </div>
      <span class="badge ${item.quantity <= 2 ? "danger" : "success"}">${currency(item.quantity * item.unitCost)}</span>
    `;
    target.appendChild(row);
  });
}

function renderFinance() {
  renderFinanceAnalytics();
  const target = document.getElementById("financeList");
  if (!target) return;
  target.innerHTML = "";

  state.finance
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <strong>${item.category}</strong>
          <small>${item.date}</small>
        </div>
        <span class="badge ${item.type === "expense" ? "danger" : "warning"}">${currency(item.amount)}</span>
      `;
      target.appendChild(row);
    });
}

function renderFinanceAnalytics() {
  const summary = document.getElementById("financeSummaryCards");
  const svg = document.getElementById("financeChartSvg");
  if (!summary || !svg) return;

  syncFinanceAnchorInput();
  const data = buildFinanceAnalytics(financePeriod, financeAnchor);
  summary.innerHTML = "";

  [
    { label: "Despesas", value: currency(data.expenses) },
    { label: "Investimentos", value: currency(data.investments) },
    { label: "Impacto", value: currency(data.expenses + data.investments) }
  ].forEach((item) => {
    const card = document.createElement("div");
    card.className = "finance-stat-card";
    card.innerHTML = `<small>${item.label}</small><strong>${item.value}</strong>`;
    summary.appendChild(card);
  });

  renderFinanceRangeLabel(data.timeline);

  renderInteractiveChart({
    svgId: "financeChartSvg",
    tooltipId: "financeChartTooltip",
    timeline: data.timeline,
    series: [
      { key: "expenses", label: "Despesas", type: "bar", visible: activeFinanceSeries.expenses, dotClass: "expenses", color: "#dc5b48", gradientId: "financeExpensesGradient", gradientStops: [["0%", "#f5a293"], ["100%", "#dc5b48"]] },
      { key: "investments", label: "Investimentos", type: "bar", visible: activeFinanceSeries.investments, dotClass: "investment", color: "#d4a425", gradientId: "financeInvestGradient", gradientStops: [["0%", "#f0d97d"], ["100%", "#d4a425"]] },
      { key: "impact", label: "Impacto", type: "line", visible: activeFinanceSeries.impact, dotClass: "profit", color: "#7e6dff", areaGradientId: "financeImpactArea" }
    ],
    formatValue: currency,
    minY: 0
  });
}

function renderFinanceRangeLabel(timeline) {
  const target = document.getElementById("financeRangeLabel");
  if (!target || !timeline.length) return;
  const first = timeline[0].fullLabel || timeline[0].label;
  const last = timeline[timeline.length - 1].fullLabel || timeline[timeline.length - 1].label;
  const periodName = financePeriod === "daily" ? "7 dias" : financePeriod === "weekly" ? "8 semanas" : financePeriod === "monthly" ? "12 meses" : "5 anos";
  target.textContent = `Visualizando ${periodName} - ${first} a ${last}`;
}

function syncFinanceAnchorInput() {
  const input = document.getElementById("financeAnchor");
  if (input && input.value !== financeAnchor) input.value = financeAnchor;
}

function shiftFinanceAnchor(direction) {
  const date = new Date(financeAnchor);
  if (financePeriod === "daily") date.setDate(date.getDate() + direction);
  else if (financePeriod === "weekly") date.setDate(date.getDate() + direction * 7);
  else if (financePeriod === "monthly") addMonthsSafelyUtc(date, direction);
  else addMonthsSafelyUtc(date, direction * 12);
  financeAnchor = date.toISOString().slice(0, 10);
  renderFinance();
}

function renderWater() {
  renderWaterTrend();
  const history = document.getElementById("waterHistory");
  const maintenance = document.getElementById("maintenanceList");
  if (!history || !maintenance) return;
  history.innerHTML = "";
  maintenance.innerHTML = "";

  state.waterReadings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const status = phStatus(entry.ph);
      let badgeClass = "success";
      if (status === "Alerta") badgeClass = "warning";
      if (status === "Critico") badgeClass = "danger";
      row.innerHTML = `
        <div>
          <strong>${entry.date}</strong>
          <small>pH ${entry.ph} | TDS ${entry.tds} | Temperatura ${entry.temperature} C</small>
        </div>
        <span class="badge ${badgeClass}">${status}</span>
      `;
      history.appendChild(row);
    });

  state.maintenance
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <strong>${item.title}</strong>
          <small>${item.date} | ${item.notes}</small>
        </div>
        <span class="badge warning">${currency(item.cost)}</span>
      `;
      maintenance.appendChild(row);
    });
}

function renderWaterTrend() {
  const svg = document.getElementById("waterChartSvg");
  const kpis = document.getElementById("waterKpis");
  const rangeLabel = document.getElementById("waterRangeLabel");
  if (!svg || !kpis) return;

  const readings = state.waterReadings
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);

  if (!readings.length) {
    svg.innerHTML = "";
    kpis.innerHTML = "";
    if (rangeLabel) rangeLabel.textContent = "";
    return;
  }

  const metricLabel = { ph: "pH", tds: "TDS", temperature: "Temperatura" }[waterMetric];
  const metricColor = { ph: "#1aa8d8", tds: "#126f95", temperature: "#289b65" }[waterMetric];

  const values = readings.map((entry) => toNumber(entry[waterMetric]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const latest = values[values.length - 1];

  kpis.innerHTML = `
    <div class="water-kpi"><small>Metrica</small><strong>${metricLabel}</strong></div>
    <div class="water-kpi"><small>Atual</small><strong>${formatMetricValue(waterMetric, latest)}</strong></div>
    <div class="water-kpi"><small>Min</small><strong>${formatMetricValue(waterMetric, min)}</strong></div>
    <div class="water-kpi"><small>Media</small><strong>${formatMetricValue(waterMetric, avg)}</strong></div>
  `;

  if (rangeLabel) {
    rangeLabel.textContent = `${readings.length} medicoes - ${readings[0].date} a ${readings[readings.length - 1].date}`;
  }

  const timeline = readings.map((entry) => ({
    label: entry.date.slice(5),
    fullLabel: entry.date,
    value: toNumber(entry[waterMetric])
  }));

  const padding = (max - min) * 0.18 || (max * 0.1) || 1;
  renderInteractiveChart({
    svgId: "waterChartSvg",
    tooltipId: "waterChartTooltip",
    timeline,
    series: [
      { key: "value", label: metricLabel, type: "line", visible: true, dotClass: "profit", color: metricColor, areaGradientId: "waterAreaGradient" }
    ],
    formatValue: (v) => formatMetricValue(waterMetric, v),
    minY: Math.max(0, min - padding)
  });
}

function renderReports() {
  const daily = buildDailyReport();
  const monthly = buildMonthlyReport();

  const dailyEl = document.getElementById("dailyReport");
  if (dailyEl) {
    dailyEl.innerHTML = `
      <strong>Resumo de ${today}</strong>
      <span>Vendas: ${currency(daily.sales)}</span>
      <span>Lucro: ${currency(daily.profit)}</span>
      <span>Despesas: ${currency(daily.expenses)}</span>
      <span>Investimentos: ${currency(daily.investments)}</span>
      <span>Clientes com saldo: ${daily.clientsWithBalance}</span>
    `;
  }

  const monthlyEl = document.getElementById("monthlyReport");
  if (monthlyEl) {
    monthlyEl.innerHTML = `
      <strong>Resumo do mes</strong>
      <span>Vendas: ${currency(monthly.sales)}</span>
      <span>Lucro: ${currency(monthly.profit)}</span>
      <span>Despesas: ${currency(monthly.expenses)}</span>
      <span>Investimentos: ${currency(monthly.investments)}</span>
      <span>Medicoes de agua: ${monthly.readings}</span>
      <span>Manutencoes: ${monthly.maintenance}</span>
    `;
  }
}

async function onCreateSale(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const clientId = String(form.get("clientId"));
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity"));
  const paymentMethod = String(form.get("paymentMethod"));
  let entryType = String(form.get("entryType"));
  let date = String(form.get("date"));
  if (currentRole === "operacao") {
    entryType = "sale";
    date = today;
  }
  const product = findProduct(productId);
  const client = findClient(clientId);

  if (!product) return alert("Escolha um produto.");
  if (
    (entryType === "deposit" || entryType === "withdrawal" || entryType === "debt" || entryType === "settlement" || paymentMethod === "Saldo do cliente") &&
    !client
  ) {
    return alert("Selecione um cliente para deposito, levantamento, divida, liquidacao ou uso de saldo.");
  }

  let costTotal = 0;
  let movement = null;
  const components = Array.isArray(product.components) ? product.components : null;
  const consumesStock = entryType === "sale" || entryType === "debt";

  if (components && components.length && consumesStock) {
    for (const comp of components) {
      const compStock = findStockByProduct(comp.productId);
      const needed = (Number(comp.qty) || 1) * quantity;
      if (!compStock || compStock.quantity < needed) {
        return alert(`Estoque insuficiente para o componente "${comp.name || comp.productId}" do kit. Verifique a aba Estoque.`);
      }
    }
    for (const comp of components) {
      const compStock = findStockByProduct(comp.productId);
      const needed = (Number(comp.qty) || 1) * quantity;
      compStock.quantity -= needed;
      costTotal += (compStock.unitCost || 0) * needed;
    }
    movement = { itemId: null, productId, quantity, type: "out", composite: true };
  } else if (product.stockControlled && consumesStock) {
    const stockItem = findStockByProduct(productId);
    if (!stockItem || stockItem.quantity < quantity) {
      return alert("Estoque insuficiente para este produto.");
    }
    stockItem.quantity -= quantity;
    costTotal = stockItem.unitCost * quantity;
    movement = { itemId: stockItem.id, productId, quantity, type: "out" };
  }

  const total = product.price * quantity;

  if (entryType === "deposit" && client) client.balance += total;
  if (entryType === "withdrawal") {
    if (client.balance < total) return alert("Saldo do cliente insuficiente.");
    client.balance -= total;
  }
  if (entryType === "debt" && client) {
    client.debt = (client.debt || 0) + total;
  }
  if (entryType === "settlement" && client) {
    if ((client.debt || 0) < total) {
      return alert(`Divida do cliente insuficiente. Divida atual: ${currency(client.debt || 0)}.`);
    }
    client.debt -= total;
  }
  if (entryType === "sale" && paymentMethod === "Saldo do cliente") {
    if (client.balance < total) return alert("Saldo do cliente insuficiente para concluir a venda.");
    client.balance -= total;
  }

  const formEl = event.currentTarget;
  const submitButton = formEl.querySelector('button[type="submit"]');
  const previousLabel = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "A emitir...";
  }
  try {
    const rawNif = String(form.get("saleNif") || "").trim();
    if (rawNif && client) {
      client.nif = rawNif;
    }
    const saleRecord = {
      id: crypto.randomUUID(),
      clientId,
      customerName: client?.name || "Cliente avulso",
      productId,
      productName: product.name,
      quantity,
      paymentMethod,
      entryType,
      date,
      total,
      costTotal,
      nif: rawNif || client?.nif || "",
      sellerUsername: currentUser?.username || "",
      sellerRole: currentRole || ""
    };
    state.sales.unshift(saleRecord);

    let issuedDoc = null;
    if (entryType === "sale" && isFiscalConfigured()) {
      try {
        const fiscal = getActiveStoreFiscal();
        const docType = fiscal.defaultDocumentType || "FR";
        issuedDoc = await issueFiscalDocument({ type: docType, sale: saleRecord });
        saleRecord.documentNumber = issuedDoc.documentNumber;
        saleRecord.documentId = issuedDoc.id;
      } catch (err) {
        console.error("Erro ao emitir documento fiscal", err);
        alert("Aviso: não foi possível emitir o documento fiscal. " + (err?.message || ""));
      }
    }

    await persistMutation({
      success: issuedDoc ? `Venda guardada. Documento ${issuedDoc.documentNumber} emetido.` : "Venda guardada e sincronizada.",
      fallback: "Venda guardada localmente."
    });

    if (movement) await insertStockMovement(movement);

    formEl.reset();
    hydrateDates();
    renderAll();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = previousLabel;
    }
  }
}

function requireAdmin() {
  if (currentRole !== "admin") {
    alert("Apenas o administrador pode realizar esta acao.");
    return false;
  }
  return true;
}

async function onCreateProduct(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  const stockControlled = String(form.get("stockControlled")) === "true";
  const productId = crypto.randomUUID();
  const price = Number(form.get("price"));
  const initialStock = Number(form.get("initialStock") || 0);
  const unitCost = Number(form.get("unitCost") || 0);

  const vatRateRaw = form.get("vatRate");
  const vatRate = vatRateRaw === null || vatRateRaw === "" ? null : Number(vatRateRaw);
  productCatalog.unshift({
    id: productId,
    dbId: crypto.randomUUID(),
    name: String(form.get("name")),
    price,
    unit: String(form.get("unit") || "un"),
    category: String(form.get("category") || "Agua"),
    stockControlled,
    vatRate
  });

  if (stockControlled) {
    state.stock.unshift({
      id: crypto.randomUUID(),
      dbId: crypto.randomUUID(),
      productId,
      quantity: initialStock,
      unitCost
    });
  }

  await persistMutation({
    success: "Produto criado e sincronizado.",
    fallback: "Produto criado localmente."
  });

  event.currentTarget.reset();
  renderAll();
}

async function onCreateClient(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.clients.unshift({
    id: crypto.randomUUID(),
    name: String(form.get("name")),
    phone: String(form.get("phone")),
    address: String(form.get("address")),
    nif: String(form.get("nif") || "").trim(),
    balance: 0,
    debt: 0
  });

  await persistMutation({
    success: "Cliente sincronizado.",
    fallback: "Cliente guardado localmente."
  });

  event.currentTarget.reset();
  renderAll();
}

async function onUpdateStock(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity"));
  const unitCost = Number(form.get("unitCost"));
  const existing = findStockByProduct(productId);

  if (existing) {
    const totalValue = existing.quantity * existing.unitCost + quantity * unitCost;
    existing.quantity += quantity;
    existing.unitCost = totalValue / existing.quantity;
  } else {
    state.stock.push({ id: crypto.randomUUID(), productId, quantity, unitCost });
  }

  await persistMutation({
    success: "Estoque sincronizado.",
    fallback: "Estoque guardado localmente."
  });

  const movementTarget = findStockByProduct(productId);
  if (movementTarget) {
    await insertStockMovement({ itemId: movementTarget.id, productId, quantity, type: "in" });
  }

  event.currentTarget.reset();
  renderAll();
}

async function onFinanceEntry(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  state.finance.unshift({
    id: crypto.randomUUID(),
    type: String(form.get("type")),
    category: String(form.get("category")),
    amount: Number(form.get("amount")),
    description: String(form.get("category")),
    date: String(form.get("date"))
  });

  await persistMutation({
    success: "Movimento financeiro sincronizado.",
    fallback: "Movimento financeiro guardado localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onWaterEntry(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.waterReadings.unshift({
    id: crypto.randomUUID(),
    ph: Number(form.get("ph")),
    tds: Number(form.get("tds")),
    temperature: Number(form.get("temperature")),
    date: String(form.get("date")),
    createdAt: new Date().toISOString(),
    notes: ""
  });

  await persistMutation({
    success: "Qualidade da agua sincronizada.",
    fallback: "Qualidade da agua guardada localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onMaintenanceEntry(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  state.maintenance.unshift({
    id: crypto.randomUUID(),
    title: String(form.get("title")),
    cost: Number(form.get("cost")),
    notes: String(form.get("notes")),
    date: String(form.get("date"))
  });

  await persistMutation({
    success: "Manutencao sincronizada.",
    fallback: "Manutencao guardada localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onSaveSupabaseConfig(event) {
  event.preventDefault();
  const formEl = event.currentTarget;
  const submitBtn = formEl.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : "Testar & Gravar Conexão";

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "⌛ A testar ligação...";
  }

  try {
    const form = new FormData(formEl);
    supabaseConfig = {
      url: String(form.get("url") || "").trim(),
      anonKey: String(form.get("anonKey") || "").trim(),
      tables: {
        stores: String(form.get("stores") || defaultTables.stores).trim(),
        clients: String(form.get("clients") || defaultTables.clients).trim(),
        products: String(form.get("products") || defaultTables.products).trim(),
        stock: String(form.get("stock") || defaultTables.stock).trim(),
        movements: String(form.get("movements") || defaultTables.movements).trim(),
        sales: String(form.get("sales") || defaultTables.sales).trim(),
        expenses: String(form.get("expenses") || defaultTables.expenses).trim(),
        investments: String(form.get("investments") || defaultTables.investments).trim(),
        water: String(form.get("water") || defaultTables.water).trim(),
        maintenance: String(form.get("maintenance") || defaultTables.maintenance).trim()
      }
    };

    saveSupabaseConfig();
    const isOperacao = currentRole === "operacao";
    const connected = await initializeSupabaseSession({ autoPull: !isOperacao, silent: false });
    if (connected) {
      try {
        await syncToSupabase();
      } catch (error) {
        console.warn("Falha ao enviar dados locais apos conectar:", error);
      }
      renderAll();
    }
  } catch (err) {
    console.error("Erro ao testar e gravar ligação:", err);
    setSyncStatus("danger", "Erro interno: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
}

async function initializeSupabaseSession({ autoPull = false, silent = false } = {}) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    supabaseClient = null;
    currentStore = null;
    if (!silent) setSyncStatus("warning", "Credenciais do Supabase ainda nao configuradas.");
    return false;
  }

  if (!window.supabase?.createClient) {
    setSyncStatus("danger", "Biblioteca do Supabase nao carregou. Abra o app com internet.");
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
    await ensureStore();
    if (autoPull) {
      await syncFromSupabase(true);
      try {
        await syncToSupabase();
      } catch (error) {
        console.warn("Falha ao enviar dados locais no inicio (syncToSupabase):", error);
      }
    } else {
      setSyncStatus("success", `Supabase conectado na loja ${currentStore.name}.`);
    }
    return true;
  } catch (error) {
    supabaseClient = null;
    currentStore = null;
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao conectar no Supabase."));
    return false;
  }
}

async function ensureStore() {
  const { data, error } = await supabaseClient.from(supabaseConfig.tables.stores).select("*").order("created_at", { ascending: true });
  if (error) throw error;

  const activeStore = getActiveStore();
  const storeName = activeStore?.name || DEFAULT_STORE_NAME;
  const storePhone = activeStore?.whatsapp || DEFAULT_REPORT_PHONE;
  const existing = (data || []).find((item) => normalizeText(item.name) === normalizeText(storeName));
  if (existing) {
    currentStore = existing;
    return;
  }

  const { data: created, error: createError } = await supabaseClient
    .from(supabaseConfig.tables.stores)
    .insert({ name: storeName, whatsapp_number: storePhone.startsWith("+") ? storePhone : `+${storePhone}` })
    .select()
    .single();

  if (createError) throw createError;
  currentStore = created;
}

async function syncFromSupabase(silent = false) {
  if (!supabaseClient) {
    const connected = await initializeSupabaseSession({ autoPull: false, silent });
    if (!connected) return;
  }

  try {
    setSyncStatus("warning", "A puxar dados do Supabase...");

    const [
      clientsRows,
      productsRows,
      stockRows,
      salesRows,
      expensesRows,
      investmentsRows,
      waterRows,
      maintenanceRows
    ] = await Promise.all([
      fetchStoreRows(supabaseConfig.tables.clients),
      fetchStoreRows(supabaseConfig.tables.products),
      fetchStoreRows(supabaseConfig.tables.stock),
      fetchStoreRows(supabaseConfig.tables.sales),
      fetchStoreRows(supabaseConfig.tables.expenses),
      fetchStoreRows(supabaseConfig.tables.investments),
      fetchStoreRows(supabaseConfig.tables.water),
      fetchStoreRows(supabaseConfig.tables.maintenance)
    ]);

    state.clients = clientsRows.map(normalizeClientRow);
    productCatalog = mergeCatalogWithProducts(productsRows);
    state.stock = stockRows.map(normalizeStockRow).filter(Boolean);
    state.sales = salesRows.map(normalizeSaleRow);
    state.finance = [
      ...expensesRows.map((row) => normalizeExpenseRow(row, "expense")),
      ...investmentsRows.map((row) => normalizeInvestmentRow(row, "investment"))
    ];
    state.waterReadings = waterRows.map(normalizeWaterRow);
    state.maintenance = maintenanceRows.map(normalizeMaintenanceRow);

    saveState();
    renderAll();
    setSyncStatus("success", `Dados sincronizados com ${currentStore.name}.`);
  } catch (error) {
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao puxar dados do Supabase."));
  }
}

async function syncToSupabase() {
  if (!supabaseClient) {
    const connected = await initializeSupabaseSession({ autoPull: false, silent: false });
    if (!connected) throw new Error("Conexao com Supabase indisponivel.");
  }

  try {
    setSyncStatus("warning", "A enviar dados locais para o Supabase...");

    ensureEntityIds();
    await reconcileProductIdsWithSupabase();

    await upsertRows(supabaseConfig.tables.clients, state.clients.map(serializeClientRow), "id");
    await upsertRows(supabaseConfig.tables.products, productCatalog.map(serializeProductRow), "id");
    await upsertRows(supabaseConfig.tables.stock, state.stock.map(serializeStockRow), "id");
    await upsertRows(supabaseConfig.tables.sales, state.sales.map(serializeSaleRow), "id");
    await upsertRows(supabaseConfig.tables.expenses, state.finance.filter((item) => item.type === "expense").map(serializeExpenseRow), "id");
    await upsertRows(supabaseConfig.tables.investments, state.finance.filter((item) => item.type === "investment").map(serializeInvestmentRow), "id");
    await upsertRows(supabaseConfig.tables.water, state.waterReadings.map(serializeWaterRow), "id");
    await upsertRows(supabaseConfig.tables.maintenance, state.maintenance.map(serializeMaintenanceRow), "id");

    setSyncStatus("success", "Dados enviados para o novo projeto Supabase.");
  } catch (error) {
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao enviar dados para o Supabase."));
    throw error;
  }
}

async function persistMutation(messages) {
  saveState();
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    setSyncStatus("warning", "Dados guardados localmente. Configure o Supabase para sincronizar.");
    return;
  }

  try {
    await syncToSupabase();
    setSyncStatus("success", messages.success);
  } catch {
    setSyncStatus("danger", messages.fallback);
  }
}

async function insertStockMovement({ itemId, productId, quantity, type }) {
  if (!supabaseClient || !itemId || !supabaseConfig.tables.movements) return;
  const stockItem = findStockByProduct(productId);
  try {
    const { error } = await supabaseClient.from(supabaseConfig.tables.movements).insert({
      store_id: currentStore.id,
      item_id: itemId,
      product_id: findProduct(productId)?.dbId || null,
      movement_type: type,
      quantity,
      unit_cost: stockItem?.unitCost ?? 0,
      notes: type === "in" ? "Reposicao" : "Saida por venda"
    });
    if (error) throw error;
  } catch {
    setSyncStatus("warning", "Dados principais sincronizados, mas o movimento de estoque nao foi registado.");
  }
}

async function fetchStoreRows(table) {
  if (!table) return [];
  let query = supabaseClient.from(table).select("*");
  if (currentStore?.id) query = query.eq("store_id", currentStore.id);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertRows(table, rows, onConflict) {
  if (!table || !rows.length) return;
  
  // Deduplicate rows based on the onConflict key to avoid "ON CONFLICT DO UPDATE command cannot affect row a second time"
  const uniqueMap = new Map();
  const others = [];
  for (const row of rows) {
    const keyVal = row[onConflict];
    if (keyVal !== undefined && keyVal !== null) {
      uniqueMap.set(keyVal, row);
    } else {
      others.push(row);
    }
  }
  const cleanRows = [...uniqueMap.values(), ...others];

  const { error } = await supabaseClient.from(table).upsert(cleanRows, { onConflict });
  if (error) throw error;
}

async function reconcileProductIdsWithSupabase() {
  if (!supabaseClient || !currentStore?.id) return;
  const table = supabaseConfig.tables.products;
  if (!table) return;
  try {
    const { data, error } = await supabaseClient
      .from(table)
      .select("id,name")
      .eq("store_id", currentStore.id);
    if (error) throw error;
    const remoteByName = new Map();
    (data || []).forEach((row) => {
      if (row?.name) remoteByName.set(String(row.name).trim(), String(row.id));
    });
    if (!remoteByName.size) return;
    const idChanges = new Map();
    productCatalog.forEach((product) => {
      const remoteId = remoteByName.get(String(product.name || "").trim());
      if (remoteId && product.dbId !== remoteId) {
        if (product.dbId) idChanges.set(product.dbId, remoteId);
        product.dbId = remoteId;
      }
    });
    if (idChanges.size) {
      state.stock.forEach((item) => {
        if (item.productDbId && idChanges.has(item.productDbId)) {
          item.productDbId = idChanges.get(item.productDbId);
        }
      });
    }
    saveState();
  } catch (err) {
    console.warn("reconcileProductIdsWithSupabase failed", err);
  }
}

function normalizeClientRow(row) {
  return {
    id: String(row.id),
    dbId: String(row.id),
    name: row.name ?? "Cliente",
    phone: row.phone ?? "",
    address: row.address ?? "",
    balance: toNumber(row.balance ?? 0),
    debt: toNumber(row.debt ?? 0)
  };
}

function normalizeSaleRow(row) {
  const logicalId = logicalProductIdFromRow(row.product_name, row.product_id);
  
  let entryType = row.entry_type ?? "sale";
  const notes = row.notes ?? "";
  if (notes.includes("Divida do cliente")) {
    entryType = "debt";
  } else if (notes.includes("Liquidacao de divida")) {
    entryType = "settlement";
  }

  return {
    id: String(row.id),
    clientId: String(row.customer_id || ""),
    customerName: row.customer_name ?? "",
    productId: logicalId,
    productName: row.product_name ?? "",
    quantity: toNumber(row.quantity ?? 1),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    entryType: entryType,
    date: normalizeDate(row.sale_date ?? row.created_at ?? today),
    total: toNumber(row.total ?? 0),
    costTotal: toNumber(row.cost_total ?? 0),
    sellerUsername: row.seller_username ?? "",
    sellerRole: row.seller_role ?? ""
  };
}

function normalizeExpenseRow(row) {
  return {
    id: String(row.id),
    type: "expense",
    category: row.category ?? "Geral",
    amount: toNumber(row.amount ?? 0),
    description: row.description ?? "",
    date: normalizeDate(row.expense_date ?? row.created_at ?? today)
  };
}

function normalizeInvestmentRow(row) {
  return {
    id: String(row.id),
    type: "investment",
    category: row.category ?? "Geral",
    amount: toNumber(row.amount ?? 0),
    description: row.description ?? "",
    date: normalizeDate(row.investment_date ?? row.created_at ?? today)
  };
}

function normalizeWaterRow(row) {
  return {
    id: String(row.id),
    ph: toNumber(row.ph ?? 0),
    tds: toNumber(row.tds ?? 0),
    temperature: toNumber(row.temperature ?? 0),
    date: normalizeDate(row.measured_at ?? row.created_at ?? today),
    notes: row.notes ?? ""
  };
}

function normalizeMaintenanceRow(row) {
  return {
    id: String(row.id),
    title: row.maintenance_type ?? "Manutencao",
    cost: toNumber(row.cost ?? 0),
    notes: [row.area, row.description].filter(Boolean).join(" | "),
    date: normalizeDate(row.maintenance_date ?? row.created_at ?? today)
  };
}

function normalizeStockRow(row) {
  const product = productCatalog.find((item) => String(item.dbId) === String(row.product_id));
  if (!product) return null;
  return {
    id: String(row.id),
    dbId: String(row.id),
    productId: product.id,
    quantity: toNumber(row.quantity ?? 0),
    unitCost: toNumber(row.avg_cost ?? 0)
  };
}

function mergeCatalogWithProducts(rows) {
  const map = new Map(baseProducts.map((item) => [item.id, { ...item }]));

  rows.forEach((row) => {
    const logicalId = logicalProductIdFromRow(row.name, row.id);
    const fallback = map.get(logicalId) || {};
    map.set(logicalId, {
      ...fallback,
      id: logicalId,
      dbId: String(row.id),
      name: row.name,
      price: toNumber(row.sale_price ?? 0),
      stockControlled: Boolean(row.stock_controlled)
    });
  });

  return [...map.values()];
}

function serializeClientRow(client) {
  return {
    id: client.dbId || client.id,
    store_id: currentStore.id,
    name: client.name,
    phone: client.phone || null,
    address: client.address || null,
    balance: client.balance ?? 0,
    debt: client.debt ?? 0
  };
}

function serializeProductRow(product) {
  const stock = findStockByProduct(product.id);
  return {
    id: product.dbId,
    store_id: currentStore.id,
    name: product.name,
    category: product.stockControlled ? "Acessorio" : "Agua",
    unit: product.unit || "un",
    sale_price: product.price,
    cost_price: stock?.unitCost ?? 0,
    stock_quantity: stock?.quantity ?? 0,
    min_stock: product.stockControlled ? 2 : 0,
    stock_controlled: product.stockControlled,
    is_active: true
  };
}

function serializeStockRow(item) {
  const product = findProduct(item.productId);
  return {
    id: item.dbId || item.id,
    store_id: currentStore.id,
    product_id: product?.dbId || null,
    quantity: item.quantity,
    avg_cost: item.unitCost,
    min_threshold: product?.stockControlled ? 2 : 0
  };
}

function serializeSaleRow(sale) {
  const product = findProduct(sale.productId);
  const client = findClient(sale.clientId);
  const unitPrice = product?.price ?? sale.total / Math.max(sale.quantity, 1);
  const costTotal = sale.costTotal ?? 0;
  
  let dbEntryType = sale.entryType;
  if (sale.entryType === "debt") dbEntryType = "sale";
  if (sale.entryType === "settlement") dbEntryType = "deposit";

  return {
    id: sale.id,
    store_id: currentStore.id,
    customer_id: client?.dbId || client?.id || null,
    product_id: product?.dbId || null,
    product_name: product?.name || sale.productName || sale.productId,
    quantity: sale.quantity,
    unit_price: unitPrice,
    total: sale.total,
    cost_total: costTotal,
    profit: sale.total - costTotal,
    payment_method: normalizeWritablePaymentMethod(sale.paymentMethod),
    entry_type: dbEntryType,
    counts_as_sale: sale.entryType !== "withdrawal" && sale.entryType !== "debt",
    customer_name: client?.name || sale.customerName || null,
    notes: ({ deposit: "Deposito do cliente", withdrawal: "Levantamento do saldo", debt: "Divida do cliente", settlement: "Liquidacao de divida" })[sale.entryType] || null,
    sale_date: sale.date
  };
}

function serializeExpenseRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    category: item.category,
    amount: item.amount,
    description: item.description || item.category,
    expense_date: item.date
  };
}

function serializeInvestmentRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    category: item.category,
    amount: item.amount,
    description: item.description || item.category,
    investment_date: item.date
  };
}

function serializeWaterRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    ph: item.ph,
    tds: item.tds,
    temperature: item.temperature,
    chlorine: null,
    status: phStatus(item.ph),
    notes: item.notes || null,
    measured_at: item.date
  };
}

function serializeMaintenanceRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    maintenance_date: item.date,
    maintenance_type: item.title,
    area: "agua",
    description: item.notes,
    cost: item.cost
  };
}

function buildPeriodStats(period, anchor) {
  const reference = parseIsoUtc(anchor);
  const buckets = buildBuckets(period, reference);
  const selected = selectedBucket(period, reference);

  let salesTotal = 0;
  let salesCount = 0;
  let expenses = 0;
  let investments = 0;
  const productTotals = {};
  const paymentTotals = {};

  productCatalog.forEach((p) => { productTotals[p.name] = 0; });
  paymentMethods.forEach((method) => { paymentTotals[method] = 0; });

  state.sales.forEach((sale) => {
    if (sale.entryType === "withdrawal") return;
    const saleDate = parseIsoUtc(sale.date);

    buckets.forEach((b) => {
      if (b.contains(saleDate)) {
        if (sale.entryType === "sale") {
          b.sales += sale.total;
        } else if (sale.entryType === "deposit") {
          b.sales += sale.total;
        }
      }
    });

    if (selected.contains(saleDate)) {
      if (sale.entryType === "sale") {
        salesTotal += sale.total;
        salesCount += 1;
        productTotals[sale.productName] = (productTotals[sale.productName] || 0) + sale.total;
        paymentTotals[sale.paymentMethod] = (paymentTotals[sale.paymentMethod] || 0) + sale.total;
      } else if (sale.entryType === "deposit") {
        salesTotal += sale.total;
        salesCount += 1;
        paymentTotals[sale.paymentMethod] = (paymentTotals[sale.paymentMethod] || 0) + sale.total;
      }
    }
  });

  state.finance.forEach((item) => {
    const itemDate = parseIsoUtc(item.date);
    buckets.forEach((b) => {
      if (b.contains(itemDate)) {
        if (item.type === "expense") b.expenses += item.amount;
        else if (item.type === "investment") b.investments += item.amount;
      }
    });

    if (selected.contains(itemDate)) {
      if (item.type === "expense") expenses += item.amount;
      else if (item.type === "investment") investments += item.amount;
    }
  });

  buckets.forEach((b) => {
    b.profit = b.sales - b.expenses - b.investments;
  });

  return {
    salesTotal,
    salesCount,
    expenses,
    investments,
    profit: salesTotal - expenses - investments,
    productTotals,
    paymentTotals,
    timeline: buckets,
    selectedLabel: selected.label
  };
}

function parseIsoUtc(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day || 1));
}

function isoFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekUtc(date) {
  const result = new Date(date);
  const day = result.getUTCDay();
  const diff = result.getUTCDate() - day + (day === 0 ? -6 : 1);
  result.setUTCDate(diff);
  return result;
}

function selectedBucket(period, reference) {
  if (period === "daily") {
    return {
      label: formatDateBr(reference),
      contains: (d) => isoFromUtc(d) === isoFromUtc(reference)
    };
  }
  if (period === "weekly") {
    const start = startOfWeekUtc(reference);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      label: `Semana ${formatDateBr(start)} a ${formatDateBr(end)}`,
      contains: (d) => d >= start && d <= end
    };
  }
  if (period === "monthly") {
    return {
      label: reference.toLocaleString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }),
      contains: (d) => d.getUTCFullYear() === reference.getUTCFullYear() && d.getUTCMonth() === reference.getUTCMonth()
    };
  }
  return {
    label: String(reference.getUTCFullYear()),
    contains: (d) => d.getUTCFullYear() === reference.getUTCFullYear()
  };
}

function formatDateBr(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;
}

function buildBuckets(period, reference) {
  const buckets = [];
  const base = new Date(reference);

  if (period === "daily") {
    base.setUTCDate(base.getUTCDate() - 6);
    for (let i = 0; i < 7; i++) {
      const active = new Date(base);
      active.setUTCDate(base.getUTCDate() + i);
      const label = active.toLocaleString("pt-PT", { weekday: "short", timeZone: "UTC" }).slice(0, 3);
      buckets.push({
        label,
        fullLabel: formatDateBr(active),
        sales: 0,
        expenses: 0,
        investments: 0,
        profit: 0,
        contains: (d) => isoFromUtc(d) === isoFromUtc(active)
      });
    }
  } else if (period === "weekly") {
    const monday = startOfWeekUtc(base);
    monday.setUTCDate(monday.getUTCDate() - 7 * 7);
    for (let i = 0; i < 8; i++) {
      const start = new Date(monday);
      start.setUTCDate(monday.getUTCDate() + i * 7);
      const end = new Date(start);
      end.setUTCDate(start.getUTCDate() + 6);
      buckets.push({
        label: `W${weekOfMonthUtc(start)} ${start.toLocaleString("pt-PT", { month: "short", timeZone: "UTC" })}`,
        fullLabel: `De ${formatDateBr(start)} a ${formatDateBr(end)}`,
        sales: 0,
        expenses: 0,
        investments: 0,
        profit: 0,
        contains: (d) => d >= start && d <= end
      });
    }
  } else if (period === "monthly") {
    base.setUTCMonth(base.getUTCMonth() - 11);
    for (let i = 0; i < 12; i++) {
      const active = new Date(base);
      addMonthsSafelyUtc(active, i);
      buckets.push({
        label: active.toLocaleString("pt-PT", { month: "short", timeZone: "UTC" }),
        fullLabel: active.toLocaleString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" }),
        sales: 0,
        expenses: 0,
        investments: 0,
        profit: 0,
        contains: (d) => d.getUTCFullYear() === active.getUTCFullYear() && d.getUTCMonth() === active.getUTCMonth()
      });
    }
  } else {
    base.setUTCFullYear(base.getUTCFullYear() - 4);
    for (let i = 0; i < 5; i++) {
      const active = new Date(base);
      active.setUTCFullYear(base.getUTCFullYear() + i);
      buckets.push({
        label: String(active.getUTCFullYear()),
        fullLabel: `Ano de ${active.getUTCFullYear()}`,
        sales: 0,
        expenses: 0,
        investments: 0,
        profit: 0,
        contains: (d) => d.getUTCFullYear() === active.getUTCFullYear()
      });
    }
  }
  return buckets;
}

function weekOfMonthUtc(date) {
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const dayOffset = firstDay.getUTCDay() || 7;
  return Math.ceil((date.getUTCDate() + dayOffset - 1) / 7);
}

function startOfWeek(date) {
  return startOfWeekUtc(date);
}

function weekOfMonth(date) {
  return weekOfMonthUtc(date);
}

function buildDailyReport() {
  const activeStore = getActiveStore();
  const sales = state.sales.filter((s) => s.date === today && s.entryType === "sale");
  const deposits = state.sales.filter((s) => s.date === today && s.entryType === "deposit");
  const withdrawals = state.sales.filter((s) => s.date === today && s.entryType === "withdrawal");
  const debts = state.sales.filter((s) => s.date === today && s.entryType === "debt");
  const settlements = state.sales.filter((s) => s.date === today && s.entryType === "settlement");

  const sTotal = sales.reduce((sum, s) => sum + s.total, 0) + deposits.reduce((sum, s) => sum + s.total, 0);
  const cost = sales.reduce((sum, s) => sum + (s.costTotal || 0), 0);
  const exp = state.finance.filter((i) => i.date === today && i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const inv = state.finance.filter((i) => i.date === today && i.type === "investment").reduce((sum, i) => sum + i.amount, 0);

  const methods = {};
  paymentMethods.forEach((m) => { methods[m] = 0; });
  [...sales, ...deposits, ...settlements].forEach((s) => {
    if (s.paymentMethod !== "Saldo do cliente") {
      methods[s.paymentMethod] = (methods[s.paymentMethod] || 0) + s.total;
    }
  });

  const clientsWithBalance = state.clients.filter((c) => c.balance > 0).length;

  return {
    storeName: activeStore?.name || DEFAULT_STORE_NAME,
    sales: sTotal,
    expenses: exp,
    investments: inv,
    profit: sTotal - exp - inv,
    cost,
    clientsWithBalance,
    salesCount: sales.length,
    deposits: deposits.reduce((sum, s) => sum + s.total, 0),
    withdrawals: withdrawals.reduce((sum, s) => sum + s.total, 0),
    debts: debts.reduce((sum, s) => sum + s.total, 0),
    settlements: settlements.reduce((sum, s) => sum + s.total, 0),
    methods
  };
}

function buildMonthlyReport() {
  const firstDay = `${today.slice(0, 8)}01`;
  const sales = state.sales.filter((s) => s.date >= firstDay && s.date <= today && s.entryType === "sale");
  const deposits = state.sales.filter((s) => s.date >= firstDay && s.date <= today && s.entryType === "deposit");

  const sTotal = sales.reduce((sum, s) => sum + s.total, 0) + deposits.reduce((sum, s) => sum + s.total, 0);
  const exp = state.finance.filter((i) => i.date >= firstDay && i.date <= today && i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const inv = state.finance.filter((i) => i.date >= firstDay && i.date <= today && i.type === "investment").reduce((sum, i) => sum + i.amount, 0);
  const readings = state.waterReadings.filter((e) => e.date >= firstDay && e.date <= today).length;
  const maintenance = state.maintenance.filter((e) => e.date >= firstDay && e.date <= today).length;

  return {
    sales: sTotal,
    expenses: exp,
    investments: inv,
    profit: sTotal - exp - inv,
    readings,
    maintenance
  };
}

function buildDailyReportText() {
  const r = buildDailyReport();
  const dateFormatted = today.split("-").reverse().join("/");
  const methodLines = Object.entries(r.methods)
    .filter(([, v]) => v > 0)
    .map(([m, v]) => `  - ${m}: ${currency(v)}`)
    .join("\n");

  const activeStore = getActiveStore();
  const physicalStoreName = activeStore?.name || "WATERGEST";

  const waterStr = state.waterReadings.length
    ? `\n💧 *ANALISE DA AGUA (${formatPhDateTime(state.waterReadings[0].createdAt)})*\n` +
      `  - pH: ${state.waterReadings[0].ph} (${phStatus(state.waterReadings[0].ph)})\n` +
      `  - TDS: ${state.waterReadings[0].tds} ppm\n` +
      `  - Temp: ${state.waterReadings[0].temperature} C`
    : "";

  return (
    `📊 *FECHO DIARIO - ${physicalStoreName.toUpperCase()}*\n` +
    `📅 data: ${dateFormatted}\n\n` +
    `💰 *FATURACAO DO DIA*\n` +
    `  - Vendas directas: ${currency(r.sales - r.deposits)}\n` +
    `  - Depositos em conta: ${currency(r.deposits)}\n` +
    `  - *Total faturado:* *${currency(r.sales)}*\n` +
    `  - Quantidade de vendas: ${r.salesCount}\n\n` +
    `🏦 *MEIOS DE PAGAMENTO*\n` +
    (methodLines || "  - Nenhuma venda registada no dia.") + "\n\n" +
    `⛔ *OUTRAS OPERACOES EM CONTA*\n` +
    `  - Liquidacao de dividas: ${currency(r.settlements)}\n` +
    `  - Levantamento de saldos: ${currency(r.withdrawals)}\n` +
    `  - Novas dividas (fiado): ${currency(r.debts)}\n\n` +
    `📉 *FLUXO FINANCEIRO*\n` +
    `  - Custos correntes (despesas): ${currency(r.expenses)}\n` +
    `  - Investimentos: ${currency(r.investments)}\n` +
    `  - *Resultado liquido:* *${currency(r.profit)}*` +
    waterStr +
    `\n\n_Relatorio enviado via software WATERGEST_ Angola 🇦🇴`
  );
}

function formatPhDateTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${dateStr} ${timeStr}`;
  } catch {
    return "";
  }
}

function sendWhatsappReport() {
  const text = encodeURIComponent(buildDailyReportText());
  const activeStore = getActiveStore();
  let phone = String(activeStore?.whatsapp || DEFAULT_REPORT_PHONE).replace(/\D/g, "");
  if (!phone.startsWith("244") && phone.length === 9) {
    phone = "244" + phone;
  }
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${text}`;
  window.open(url, "_blank");
}

function loadImageAsDataUrl(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function buildMonthlyDataset(yearMonth) {
  const sales = state.sales.filter((s) => s.date.startsWith(yearMonth) && s.entryType === "sale");
  const deposits = state.sales.filter((s) => s.date.startsWith(yearMonth) && s.entryType === "deposit");
  const settlements = state.sales.filter((s) => s.date.startsWith(yearMonth) && s.entryType === "settlement");

  const revenue = sales.reduce((sum, s) => sum + s.total, 0) + deposits.reduce((sum, s) => sum + s.total, 0);
  const cost = sales.reduce((sum, s) => sum + (s.costTotal || 0), 0);
  const expenses = state.finance.filter((i) => i.date.startsWith(yearMonth) && i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const investments = state.finance.filter((i) => i.date.startsWith(yearMonth) && i.type === "investment").reduce((sum, i) => sum + i.amount, 0);

  const productMap = {};
  sales.forEach((s) => {
    productMap[s.productName] = (productMap[s.productName] || 0) + s.total;
  });

  const paymentMap = {};
  [...sales, ...deposits, ...settlements].forEach((s) => {
    if (s.paymentMethod !== "Saldo do cliente") {
      paymentMap[s.paymentMethod] = (paymentMap[s.paymentMethod] || 0) + s.total;
    }
  });

  const uniqueDatesSet = new Set([
    ...sales.map((s) => s.date),
    ...deposits.map((s) => s.date),
    ...state.finance.filter((i) => i.date.startsWith(yearMonth)).map((i) => i.date)
  ]);
  const sortedDates = [...uniqueDatesSet].sort();

  const dailyValues = sortedDates.map((d) => {
    const dSales = sales.filter((s) => s.date === d).reduce((sum, s) => sum + s.total, 0) +
                   deposits.filter((s) => s.date === d).reduce((sum, s) => sum + s.total, 0);
    const dExpenses = state.finance.filter((i) => i.date === d && i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
    return { dateLabel: d.match(/\d{2}$/)?.[0] || d, sales: dSales, expenses: dExpenses };
  });

  return {
    yearMonth,
    revenue,
    cost,
    expenses,
    investments,
    profit: revenue - expenses - investments,
    productMap,
    paymentMap,
    dailyValues
  };
}

async function generateMonthlyPdf() {
  const btn = document.getElementById("monthlyReportButton") || document.getElementById("generatePdfBtn");
  if (btn) btn.disabled = true;

  try {
    const jsPdfLib = window.jspdf;
    if (!jsPdfLib) {
      alert("A carregar bibliotecas de PDF... Tente de novo em segundos.");
      return;
    }

    const yearMonth = document.getElementById("pdfYearMonth").value;
    const [year, month] = yearMonth.split("-");
    const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1))
      .toLocaleString("pt-PT", { month: "long" }).toUpperCase();

    const data = buildMonthlyDataset(yearMonth);
    const doc = new jsPdfLib.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    const stateStore = getActiveStore();
    const config = {
      storeName: stateStore?.name || "WATERGEST",
      address: stateStore?.address || "Angola",
      phone: stateStore?.whatsapp || "—",
      nif: stateStore?.nif || "—",
      monthName,
      year
    };

    let logoDataUrl = null;
    try {
      logoDataUrl = await loadImageAsDataUrl("/assets/logo.png");
    } catch {
      logoDataUrl = null;
    }

    let pageNum = 1;
    let y = 50;

    const renderHeader = () => {
      drawPdfHeader(doc, pageNum, config, logoDataUrl);
      y = 125;
    };

    renderHeader();

    y = drawSummaryBlock(doc, y, data);
    y += 24;

    y = drawSalesByProductTable(doc, y, data);
    y += 24;

    y = drawSalesByPaymentTable(doc, y, data);

    doc.addPage();
    pageNum += 1;
    renderHeader();

    y = drawDailySalesChart(doc, y, data);
    y += 24;

    y = drawTopProductsChart(doc, y, data);

    const checkPageBreakFinance = (needed) => {
      if (y + needed > 760) {
        doc.addPage();
        pageNum += 1;
        renderHeader();
        return true;
      }
      return false;
    };

    const expEntries = state.finance.filter((item) => item.date.startsWith(yearMonth));
    if (expEntries.length) {
      y = drawExpensesTables(doc, y, expEntries, checkPageBreakFinance);
    }

    addPdfFooters(doc, pageNum);

    const safename = slugify(config.storeName);
    doc.save(`relatorio_${safename}_${year}_${month}.pdf`);
  } catch (err) {
    console.error("Pdf crash:", err);
    alert("Falha critica ao exportar PDF: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function drawPdfHeader(doc, pageNum, config, logoDataUrl) {
  doc.setFillColor(16, 49, 77);
  doc.rect(0, 0, 595, 10, "F");

  doc.setTextColor(24, 30, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(config.storeName.toUpperCase(), 40, 52);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 119, 136);

  const loc = `Endereco: ${config.address}  |  Tel: ${config.phone}`;
  doc.text(loc, 40, 68);
  doc.text(`NIF: ${config.nif}`, 40, 80);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(16, 49, 77);
  const title = `BALANCO PATRIMONIAL EXECUTIVO  |  ${config.monthName} ${config.year}`;
  doc.text(title, 40, 105);

  doc.setStrokeColor(220, 226, 230);
  doc.setLineWidth(1);
  doc.line(40, 114, 555, 114);
}

function drawSummaryBlock(doc, y, data) {
  doc.setFillColor(248, 250, 252);
  doc.rect(40, y, 515, 68, "F");
  doc.setStrokeColor(220, 226, 230);
  doc.rect(40, y, 515, 68, "D");

  const cards = [
    { label: "RECEITA TOTAL COMERCIAL", val: currency(data.revenue), col: [16, 49, 77] },
    { label: "DESPESAS FLUXO CAIXA", val: currency(data.expenses), col: [220, 91, 72] },
    { label: "INVESTIMENTOS ATIVO", val: currency(data.investments), col: [212, 164, 37] },
    { label: "LUCRO LIQUIDO REAL", val: currency(data.profit), col: [40, 155, 101] }
  ];

  doc.setFont("helvetica", "bold");
  cards.forEach((c, idx) => {
    const x = 54 + idx * 124;
    doc.setFontSize(7.5);
    doc.setTextColor(100, 119, 136);
    doc.text(c.label, x, y + 22);

    doc.setFontSize(11.5);
    doc.setTextColor(c.col[0], c.col[1], c.col[2]);
    doc.text(c.val, x, y + 44);
  });

  return y + 68;
}

function runAutoTable(doc, { headers, body, startY, theme }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setFillColor(235, 240, 245);
  doc.setStrokeColor(210, 220, 230);
  doc.rect(40, startY, 515, 20, "F");

  let colWidth = 515 / headers.length;

  doc.setTextColor(50, 65, 80);
  headers.forEach((h, idx) => {
    const align = (idx > 0) ? "right" : "left";
    const x = align === "right" ? 40 + (idx + 1) * colWidth - 8 : 40 + idx * colWidth + 8;
    doc.text(h, x, startY + 13, { align });
  });

  let currentY = startY + 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(60, 75, 90);

  body.forEach((row, rIdx) => {
    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 252, 255);
      doc.rect(40, currentY, 515, 18, "F");
    }
    row.forEach((cell, idx) => {
      const align = (idx > 0) ? "right" : "left";
      const x = align === "right" ? 40 + (idx + 1) * colWidth - 8 : 40 + idx * colWidth + 8;
      const valStr = String(cell);
      doc.text(valStr, x, currentY + 12, { align });
    });
    currentY += 18;
  });

  doc.setStrokeColor(210, 220, 230);
  doc.line(40, startY, 555, startY);
  doc.line(40, currentY, 555, currentY);

  return currentY;
}

function drawSalesByProductTable(doc, y, data) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  doc.text("DISTRUBUICAO COMERCIAL POR PORTFOLIO PRODUTOS", 40, y + 12);
  y += 20;

  const entries = Object.entries(data.productMap).sort((a, b) => b[1] - a[1]);
  const headers = ["PROD LIMIT COMPLETO", "VAL COMERCIALIZADO (Kz)"];
  const body = entries.map(([name, sum]) => [name, currency(sum)]);

  return runAutoTable(doc, { headers, body, startY: y });
}

function drawSalesByPaymentTable(doc, y, data) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  doc.text("CAPTAÇÃO ADQUIRENCIA POR MEIOS DE PAGAMENTO", 40, y + 12);
  y += 20;

  const entries = Object.entries(data.paymentMap).sort((a, b) => b[1] - a[1]);
  const headers = ["MEIO DE PAGAMENTO", "MONTANTE LIQUIDADO (Kz)"];
  const body = entries.map(([name, sum]) => [name, currency(sum)]);

  return runAutoTable(doc, { headers, body, startY: y });
}

function drawDailySalesChart(doc, y, data) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  doc.text("HISTOGRAMA DIARIO DE FLUXOS OPERACIONAIS (VENDAS vs DESPESAS)", 40, y + 12);
  y += 24;

  const points = data.dailyValues;
  if (!points.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nenhum movimento registado no periodo.", 40, y + 15);
    return y + 30;
  }

  const maxVal = Math.max(...points.map((p) => Math.max(p.sales, p.expenses)), 1000);
  const chartH = 120;
  const colW = Math.min(30, 480 / points.length);

  doc.setStrokeColor(230, 235, 240);
  doc.setLineWidth(0.8);
  for (let i = 0; i <= 3; i++) {
    const lineY = y + chartH - (i / 3) * chartH;
    doc.line(40, lineY, 555, lineY);
    doc.setFontSize(8);
    doc.setTextColor(120, 130, 140);
    const scaleVal = formatShortNumber((i / 3) * maxVal);
    doc.text(scaleVal, 528, lineY + 11, { align: "right" });
  }

  points.forEach((p, idx) => {
    const colX = 54 + idx * colW * 1.5;
    if (colX + colW > 520) return;

    const sBarH = (p.sales / maxVal) * chartH;
    if (sBarH > 1) {
      doc.setFillColor(40, 155, 101);
      doc.rect(colX, y + chartH - sBarH, colW * 0.42, sBarH, "F");
    }

    const eBarH = (p.expenses / maxVal) * chartH;
    if (eBarH > 1) {
      doc.setFillColor(220, 91, 72);
      doc.rect(colX + colW * 0.46, y + chartH - eBarH, colW * 0.42, eBarH, "F");
    }

    doc.setFontSize(7.5);
    doc.setTextColor(100, 110, 120);
    doc.text(p.dateLabel, colX + colW * 0.40, y + chartH + 12, { align: "center" });
  });

  return y + chartH + 24;
}

function drawTopProductsChart(doc, y, data) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  doc.text("RANKING DE PERFORMANCE - FATURACAO POR PRODUTO (Kz)", 40, y + 12);
  y += 24;

  const entries = Object.entries(data.productMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (!entries.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text("Nenhum produto faturado no periodo.", 40, y + 15);
    return y + 30;
  }

  const maxVal = entries[0][1];
  const chartW = 340;

  entries.forEach((item, idx) => {
    const barY = y + idx * 22;
    const barW = (item[1] / maxVal) * chartW;

    doc.setFontSize(8.5);
    doc.setTextColor(60, 75, 90);
    doc.setFont("helvetica", "bold");
    doc.text(truncateText(item[0], 24), 40, barY + 12);

    doc.setFillColor(26, 168, 216);
    doc.rect(170, barY, barW, 14, "F");

    doc.setTextColor(120, 130, 140);
    doc.setFont("helvetica", "normal");
    doc.text(currency(item[1]), 170 + barW + 8, barY + 11);
  });

  return y + entries.length * 22;
}

function drawExpensesTables(doc, y, expEntries, checkPageBreak) {
  checkPageBreak(40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  doc.text("DISCRIMINACAO ANALITICA DE DESPESAS ACUMULADAS", 40, y + 12);
  y += 20;

  const headers = ["DATA", "CATEGORIA", "NOTAS OPERACIONAIS", "VALOR (Kz)"];
  const body = expEntries.map((item) => [
    item.date.split("-").reverse().slice(0, 2).join("/"),
    item.category,
    truncateText(item.description || item.category, 36),
    currency(item.amount)
  ]);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setFillColor(235, 240, 245);
  doc.setStrokeColor(210, 220, 230);
  doc.rect(40, y, 515, 20, "F");

  let colX = [0, 48, 140, 420, 515];
  doc.setTextColor(50, 65, 80);
  headers.forEach((h, idx) => {
    const align = (idx === 3) ? "right" : "left";
    const x = align === "right" ? 555 - 8 : 40 + colX[idx] + 8;
    doc.text(h, x, y + 13, { align });
  });

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 80, 90);

  body.forEach((row, rIdx) => {
    checkPageBreak(18);
    if (rIdx % 2 === 1) {
      doc.setFillColor(248, 252, 255);
      doc.rect(40, y, 515, 18, "F");
    }
    row.forEach((cell, idx) => {
      const align = (idx === 3) ? "right" : "left";
      const x = align === "right" ? 555 - 8 : 40 + colX[idx] + 8;
      doc.text(String(cell), x, y + 12, { align });
    });
    y += 18;
  });

  doc.setStrokeColor(210, 220, 230);
  doc.line(40, y, 555, y);

  return y;
}

function ensurePageSpace() { return 0; }

function addPdfFooters(doc, totalPages) {
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setStrokeColor(220, 226, 230);
    doc.setLineWidth(0.8);
    doc.line(40, 792, 555, 792);

    doc.setFontSize(7.5);
    doc.setTextColor(140, 150, 160);
    const credit = "Tecnologia de Qualidade WATERGEST  |  Gerado Automaticamente em PDF";
    doc.text(credit, 40, 806);
    doc.text(`Pagina ${i} de ${totalPages}`, 555, 806, { align: "right" });
  }
}

function truncateText(text, limit) {
  if (!text) return "";
  if (text.length <= limit) return text;
  return text.slice(0, limit - 3) + "...";
}

function formatDateShort() { return ""; }

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_+|_+$)/g, "");
}

function copyDailyReport() {
  const text = buildDailyReportText();
  navigator.clipboard.writeText(text)
    .then(() => alert("Relatorio diario copiado com sucesso!"))
    .catch(() => alert("Falha ao copiar relatorio. Ative a permissao de clipboard no browser."));
}

function entriesThatCountAsSales() { return []; }
function getAllExpenseEntries() { return []; }
function migrateClientsForDebt() {}

function sumFinanceByType(type) {
  return state.finance.filter((i) => i.type === type).reduce((sum, i) => sum + i.amount, 0);
}

function groupPayments() {
  const map = {};
  paymentMethods.forEach((m) => { map[m] = 0; });
  state.sales.forEach((s) => {
    if (s.entryType === "sale" || s.entryType === "deposit") {
      map[s.paymentMethod] = (map[s.paymentMethod] || 0) + s.total;
    }
  });
  return map;
}

function matchPeriod() { return true; }

function salesColor(value) {
  return salesBarFill(value);
}

function translateEntryType(type) {
  return ({
    sale: "Venda directa",
    deposit: "Deposito em conta",
    withdrawal: "Levantamento",
    debt: "Vendido a fiado",
    settlement: "Liquidacao"
  })[type] || type;
}

function sameMonth() { return true; }

function ensureEntityIds() {
  state.sales.forEach((s) => { if (!s.id) s.id = crypto.randomUUID(); });
  state.clients.forEach((c) => { if (!c.id) c.id = crypto.randomUUID(); });
  state.finance.forEach((f) => { if (!f.id) f.id = crypto.randomUUID(); });
  state.waterReadings.forEach((w) => { if (!w.id) w.id = crypto.randomUUID(); });
  state.maintenance.forEach((m) => { if (!m.id) m.id = crypto.randomUUID(); });
}

function findClient(id) {
  if (!id) return null;
  return state.clients.find((c) => String(c.id) === String(id)) || null;
}

function findProduct(id) {
  if (!id) return null;
  return productCatalog.find((p) => String(p.id) === String(id)) || null;
}

function findStockByProduct(productId) {
  if (!productId) return null;
  return state.stock.find((s) => String(s.productId) === String(productId)) || null;
}

function logicalProductIdFromRow(productName, productId) {
  const cleanName = productName ? String(productName).trim().toLowerCase() : "";
  if (cleanName.includes("garrafao") && cleanName.includes("20l") && cleanName.includes("vazio")) {
    return "vasilhame-20l";
  }
  if (cleanName.includes("garrafao") && cleanName.includes("20l") && cleanName.includes("cheio")) {
    return "garrafao-20l";
  }
  if (cleanName.includes("garrafa") && cleanName.includes("1.5l")) {
    return "garrafa-1.5l";
  }
  if (cleanName.includes("garrafa") && cleanName.includes("0.5l")) {
    return "garrafa-0.5l";
  }
  if (cleanName.includes("copo") || cleanName.includes("330ml")) {
    return "copo-330ml";
  }
  if (cleanName.includes("bomba")) {
    return "bomba-manual";
  }
  if (cleanName.includes("suporte")) {
    return "suporte-plastico";
  }
  if (productId) {
    const baseMatch = baseProducts.find((p) => String(p.dbId) === String(productId) || String(p.id) === String(productId));
    if (baseMatch) return baseMatch.id;
  }
  return "garrafao-20l";
}

function normalizePaymentMethod(method) {
  if (!method) return "Cash";
  const m = String(method).trim().toLowerCase();
  if (m.includes("consolidada") || m.includes("cash") || m.includes("dinheiro")) return "Cash";
  if (m.includes("tpa") || m.includes("multicaixa") || m.includes("cartao")) return "Multicaixa TPA";
  if (m.includes("express") || m.includes("transferencia") || m.includes("banco") || m.includes("bancaria")) return "Express";
  if (m.includes("saldo") || m.includes("conta")) return "Saldo do cliente";
  return "Cash";
}

function normalizeWritablePaymentMethod(method) {
  if (method === "Cash") return "Consolidada";
  if (method === "Multicaixa TPA") return "TPA";
  if (method === "Express") return "Express";
  if (method === "Saldo do cliente") return "Saldo do cliente";
  return "Consolidada";
}

function phStatus(ph) {
  const val = Number(ph);
  if (val < 6.0 || val > 9.0) return "Critico";
  if (val < 6.5 || val > 8.5) return "Alerta";
  return "Ideal";
}

function currency(v) {
  const num = Number(v) || 0;
  return num.toLocaleString("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 })
    .replace("AOA", "Kz");
}

function offsetDate() { return ""; }

function setInputValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function renderSalePreview() {
  const prodSelect = document.getElementById("saleProduct");
  const qtyInput = document.getElementById("saleQuantity");
  const target = document.getElementById("salePreview");
  if (!prodSelect || !qtyInput || !target) return;

  const product = findProduct(prodSelect.value);
  const qty = Number(qtyInput.value) || 0;

  if (!product || qty <= 0) {
    target.innerHTML = "";
    target.hidden = true;
    return;
  }

  const vatRate = product.vatRate !== null && product.vatRate !== undefined ? product.vatRate : 14;
  const isExempt = vatRate === 0;
  const total = product.price * qty;
  const net = total / (1 + (vatRate / 100));
  const vat = total - net;

  target.innerHTML = `
    <div class="sale-preview-card mini-card">
      <div class="tip-row">
        <span>Unitario:</span>
        <strong>${currency(product.price)}</strong>
      </div>
      <div class="tip-row text-primary">
        <span>Total Bruto:</span>
        <strong>${currency(total)}</strong>
      </div>
      <div class="tip-row font-mono text-xs text-muted">
        <span>Valor liquido:</span>
        <span>${currency(isExempt ? total : net)}</span>
      </div>
      <div class="tip-row font-mono text-xs text-muted">
        <span>Imposto (${vatRate}%):</span>
        <span>${isExempt ? "Isento (Art. 12 SA)" : currency(vat)}</span>
      </div>
    </div>
  `;
  target.hidden = false;
}

function buildFinanceAnalytics(period, anchor) {
  const reference = parseIsoUtc(anchor);
  const buckets = buildBuckets(period, reference);

  state.finance.forEach((item) => {
    const itemDate = parseIsoUtc(item.date);
    buckets.forEach((b) => {
      if (b.contains(itemDate)) {
        if (item.type === "expense") b.expenses += item.amount;
        else if (item.type === "investment") b.investments += item.amount;
      }
    });
  });

  const selected = selectedBucket(period, reference);
  let expenses = 0;
  let investments = 0;

  state.finance.forEach((item) => {
    const itemDate = parseIsoUtc(item.date);
    if (selected.contains(itemDate)) {
      if (item.type === "expense") expenses += item.amount;
      else if (item.type === "investment") investments += item.amount;
    }
  });

  buckets.forEach((b) => {
    b.impact = b.expenses + b.investments;
  });

  return {
    expenses,
    investments,
    timeline: buckets
  };
}

function formatMetricValue(metric, value) {
  const v = Number(value) || 0;
  if (metric === "ph") return v.toFixed(2);
  if (metric === "tds") return `${v.toFixed(0)} ppm`;
  return `${v.toFixed(1)} C`;
}

function normalizeDate(dateStr) {
  if (!dateStr) return today;
  const cleaned = String(dateStr).trim();
  if (cleaned.length >= 10) return cleaned.slice(0, 10);
  return today;
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(v) {
  return String(v || "").toLowerCase().trim();
}

function isUuid(val) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

function formatSupabaseError(error, defaultMsg) {
  console.error("Supabase Error detail:", error);
  if (error && error.message) return `${defaultMsg} Details: ${error.message}`;
  return defaultMsg;
}

function getActiveStoreFiscal() {
  const store = getActiveStore();
  if (!store) return null;
  if (!store.fiscalConfig) {
    store.fiscalConfig = {
      nif: store.nif || "",
      taxRegistrationNumber: "",
      softwareValidationNumber: "999/AGT/2026",
      systemRegistrationId: "AC-AGT-2026",
      isFiscalActive: false,
      invoiceSequence: 1,
      invoicePrefix: "FR AC",
      prevHash: "",
      defaultDocumentType: "FR"
    };
  }
  return store.fiscalConfig;
}

function isFiscalConfigured() {
  const activeStore = getActiveStore();
  if (!activeStore) return false;
  const config = getActiveStoreFiscal();
  return config && config.isFiscalActive === true && String(config.nif || "").trim().length > 3;
}

function getProductVatRate(productId) {
  const p = findProduct(productId);
  if (!p) return 14;
  return p.vatRate !== null && p.vatRate !== undefined ? p.vatRate : 14;
}

function sha1Base64(str) {
  var blockscale = 64;
  function str2binb(str) {
    var bin = [];
    var mask = (1 << 8) - 1;
    for (var i = 0; i < str.length * 8; i += 8) {
      bin[i >> 5] |= (str.charCodeAt(i / 8) & mask) << (24 - i % 32);
    }
    return bin;
  }
  function binb2b64(binarray) {
    var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var str = "";
    for (var i = 0; i < binarray.length * 4; i += 3) {
      var triplet = (((binarray[i >> 2] >> (8 * (3 - i % 4))) & 0xFF) << 16)
                  | (((binarray[i + 1 >> 2] >> (8 * (3 - (i + 1) % 4))) & 0xFF) << 8)
                  | ((binarray[i + 2 >> 2] >> (8 * (3 - (i + 2) % 4))) & 0xFF);
      for (var j = 0; j < 4; j++) {
        if (i * 8 + j * 6 > binarray.length * 32) str += "=";
        else str += tab.charAt((triplet >> (6 * (3 - j))) & 0x3F);
      }
    }
    return str;
  }
  function safe_add(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }
  function rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt));
  }
  function sha1_ft(t, b, c, d) {
    if (t < 20) return (b & c) | ((~b) & d);
    if (t < 40) return b ^ c ^ d;
    if (t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }
  function sha1_kt(t) {
    return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 :
           (t < 60) ? -1894007588 : -899497514;
  }
  var x = str2binb(str);
  var len = str.length * 8;
  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;
  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;
  for (var i = 0; i < x.length; i += 16) {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;
    for (var j = 0; j < 80; j++) {
      if (j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)), safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }
    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return binb2b64([a, b, c, d, e]);
}

function nextDocumentNumber(documentType) {
  const prefix = documentType || "FR";
  const storeFiscal = getActiveStoreFiscal();
  if (storeFiscal) {
    const list = state.sales.filter(s => s.fiscalDoc && s.fiscalDoc.type === prefix);
    return (storeFiscal.invoiceSequence || 1) + list.length;
  }
  return 1;
}

function previousDocumentHash() {
  const storeFiscal = getActiveStoreFiscal();
  if (!storeFiscal) return "";
  const list = state.sales.filter(s => s.fiscalDoc && s.fiscalDoc.hash);
  if (list.length > 0) {
    return list[list.length - 1].fiscalDoc.hash;
  }
  return storeFiscal.prevHash || "";
}

function buildDocumentHash(docDate, docTime, docNo, docTotal, prevHash) {
  const payload = `${docDate};${docDate}T${docTime};${docNo};${Number(docTotal).toFixed(2)};${prevHash || ""}`;
  const full = sha1Base64(payload);
  const compact = full.slice(0, 4);
  return { full, compact, payload };
}

function buildVatBreakdown(salesList) {
  const breakdown = {
    standard: { rate: 14, net: 0, tax: 0, reason: "" },
    exempt: { rate: 0, net: 0, tax: 0, reason: "Isento nos termos do Art. 12.º do SA" }
  };
  salesList.forEach((sale) => {
    const rate = getProductVatRate(sale.productId);
    if (rate === 0) {
      breakdown.exempt.net += sale.total;
    } else {
      const net = sale.total / (1 + (rate / 100));
      breakdown.standard.net += net;
      breakdown.standard.tax += (sale.total - net);
    }
  });
  return Object.values(breakdown).filter(v => v.net > 0);
}

function issueFiscalDocument(saleId) {
  const sale = state.sales.find((s) => String(s.id) === String(saleId));
  if (!sale) return;
  const storeFiscal = getActiveStoreFiscal();
  if (!storeFiscal || !storeFiscal.isFiscalActive) return;

  const docType = storeFiscal.defaultDocumentType || "FR";
  const docNoInt = nextDocumentNumber(docType);
  const docNoStr = `${storeFiscal.invoicePrefix} ${new Date().getUTCFullYear()}/${docNoInt}`;
  const prevH = previousDocumentHash();
  const timeStr = new Date().toTimeString().split(" ")[0];

  const hashData = buildDocumentHash(sale.date, timeStr, docNoStr, sale.total, prevH);

  sale.fiscalDoc = {
    type: docType,
    number: docNoStr,
    sequence: docNoInt,
    time: timeStr,
    prevHash: prevH,
    hash: hashData.full,
    hashCompact: hashData.compact,
    hashPayload: hashData.payload,
    status: "Normal",
    taxRegistrationNumber: storeFiscal.taxRegistrationNumber,
    softwareValidationNumber: storeFiscal.softwareValidationNumber,
    systemRegistrationId: storeFiscal.systemRegistrationId
  };

  saveState();
}

function cancelFiscalDocument(saleId) {
  const sale = state.sales.find((s) => String(s.id) === String(saleId));
  if (sale && sale.fiscalDoc) {
    sale.fiscalDoc.status = "Anulado";
    saveState();
  }
}

function renderInvoicesView() {
  const logTable = document.getElementById("invoicesLogTable");
  if (!logTable) return;
  logTable.innerHTML = "";

  const docList = state.sales.filter(s => s.fiscalDoc);
  if (!docList.length) {
    logTable.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-xs text-muted">Nenhum documento fiscal emitido.</td></tr>`;
    return;
  }

  const query = document.getElementById("invoiceSearch")?.value?.toLowerCase() || "";

  docList.forEach(sale => {
    const doc = sale.fiscalDoc;
    const client = findClient(sale.clientId);
    const clientName = client ? client.name : "Consumidor Final";

    if (query && !doc.number.toLowerCase().includes(query) && !clientName.toLowerCase().includes(query)) {
      return;
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="font-mono text-xs">${doc.number}</td>
      <td>${sale.date} ${doc.time}</td>
      <td>${clientName}</td>
      <td class="font-semibold text-right">${currency(sale.total)}</td>
      <td class="font-mono text-xs text-center">${doc.hashCompact}-Set</td>
      <td><span class="badge ${doc.status === "Anulado" ? "danger" : "success"}">${doc.status}</span></td>
      <td>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-icon" onclick="downloadInvoicePdf('${sale.id}')" title="Baixar PDF">📥</button>
          ${doc.status !== "Anulado" ? `<button class="btn btn-sm btn-danger btn-icon" onclick="onCancelInvoice('${sale.id}')" title="Anular Fatura">🚫</button>` : ""}
        </div>
      </td>
    `;
    logTable.appendChild(row);
  });
}

async function onCancelInvoice(saleId) {
  if (confirm("Deseja realmente anular esta fatura? Esta ação é irreversível e registada.")) {
    cancelFiscalDocument(saleId);
    await persistMutation({
      success: "Fatura anulada e sincronizada no Supabase.",
      fallback: "Fatura anulada localmente."
    });
    renderInvoicesView();
    renderAll();
  }
}

function bindInvoicesView() {
  const search = document.getElementById("invoiceSearch");
  if (search) {
    search.addEventListener("input", renderInvoicesView);
  }
}

function renderFiscalConfigForm() {
  const config = getActiveStoreFiscal();
  if (!config) return;
  setInputValue("fiscalNif", config.nif);
  setInputValue("taxRegistrationNumber", config.taxRegistrationNumber);
  setInputValue("softwareValidationNumber", config.softwareValidationNumber);
  setInputValue("systemRegistrationId", config.systemRegistrationId);
  const chk = document.getElementById("isFiscalActive");
  if (chk) chk.checked = config.isFiscalActive;
}

function onSaveFiscalConfig(event) {
  if (event) event.preventDefault();
  const config = getActiveStoreFiscal();
  if (!config) return;

  const nifVal = document.getElementById("fiscalNif")?.value || "";
  config.nif = nifVal;
  config.taxRegistrationNumber = document.getElementById("taxRegistrationNumber")?.value || "";
  config.softwareValidationNumber = document.getElementById("softwareValidationNumber")?.value || "999/AGT/2026";
  config.systemRegistrationId = document.getElementById("systemRegistrationId")?.value || "AC-AGT-2026";
  config.isFiscalActive = !!document.getElementById("isFiscalActive")?.checked;

  const active = getActiveStore();
  if (active) active.nif = nifVal;

  saveState();
  alert("Configuração fiscal guardada com sucesso!");
  renderFiscalConfigForm();
}

function buildSaftXml() {
  const config = getActiveStore();
  const fiscal = getActiveStoreFiscal() || {};
  const docList = state.sales.filter(s => s.fiscalDoc);

  let docXmlSegments = "";
  let totalNet = 0;
  let totalTax = 0;

  docList.forEach((sale) => {
    const doc = sale.fiscalDoc;
    const client = findClient(sale.clientId);
    const vatRate = getProductVatRate(sale.productId);
    const net = sale.total / (1 + (vatRate / 100));
    const vat = sale.total - net;

    totalNet += net;
    totalTax += vat;

    docXmlSegments += `
        <Invoice>
          <InvoiceNo>${doc.number}</InvoiceNo>
          <Period>${new Date(sale.date).getMonth() + 1}</Period>
          <InvoiceDate>${sale.date}</InvoiceDate>
          <InvoiceType>${doc.type}</InvoiceType>
          <SourceID>Admin-Sys</SourceID>
          <SystemEntryDate>${sale.date}T${doc.time}</SystemEntryDate>
          <CustomerID>${client ? client.id : "CF"}</CustomerID>
          <Line>
            <LineNumber>1</LineNumber>
            <ProductCode>${sale.productId || "P-001"}</ProductCode>
            <ProductDescription>${sale.productName || "Agua"}</ProductDescription>
            <Quantity>${sale.quantity}</Quantity>
            <UnitOfMeasure>un</UnitOfMeasure>
            <UnitPrice>${(sale.total / sale.quantity).toFixed(2)}</UnitPrice>
            <TaxPointDate>${sale.date}</TaxPointDate>
            <Description>${sale.productName || "Agua"}</Description>
            <DebitAmount>${net.toFixed(2)}</DebitAmount>
            <Tax>
              <TaxType>IVA</TaxType>
              <TaxCountryRegion>AO</TaxCountryRegion>
              <TaxCode>${vatRate === 0 ? "ISE" : "NOR"}</TaxCode>
              <TaxPercentage>${vatRate}</TaxPercentage>
            </Tax>
          </Line>
          <DocumentTotals>
            <TaxPayable>${vat.toFixed(2)}</TaxPayable>
            <NetTotal>${net.toFixed(2)}</NetTotal>
            <GrossTotal>${Number(sale.total).toFixed(2)}</GrossTotal>
          </DocumentTotals>
        </Invoice>`;
  });

  return `<?xml version="1.0" encoding="Windows-1252"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">
  <Header>
    <AuditFileSchemaVersion>1.01_01</AuditFileSchemaVersion>
    <CompilerUniqueID>${fiscal.systemRegistrationId || "AC-AGT-2026"}</CompilerUniqueID>
    <CompanyName>${config?.name || "Agua Cristalina"}</CompanyName>
    <CompanyID>${fiscal.nif || "5000000002"}</CompanyID>
    <TaxRegistrationNumber>${fiscal.taxRegistrationNumber || fiscal.nif}</TaxRegistrationNumber>
    <SoftwareValidationNumber>${fiscal.softwareValidationNumber || "999/AGT/2026"}</SoftwareValidationNumber>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${docList.length}</NumberOfEntries>
      <TotalDebit>${totalNet.toFixed(2)}</TotalDebit>
      <TotalCredit>0.00</TotalCredit>
      ${docXmlSegments}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
}

function downloadSaft() {
  try {
    const saftXml = buildSaftXml();
    const blob = new Blob([saftXml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SAFT_AO_AguaCristalina_${today.slice(0,7)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert("Falha ao exportar SAFT: " + err.message);
  }
}

async function downloadInvoicePdf(saleId) {
  const sale = state.sales.find(s => String(s.id) === String(saleId));
  if (!sale || !sale.fiscalDoc) {
    alert("Este registo nao tem documento fiscal associado.");
    return;
  }

  const jsPdfLib = window.jspdf;
  if (!jsPdfLib) {
    alert("Carregando biblioteca PDF... tente novamente em segundos.");
    return;
  }

  const doc = new jsPdfLib.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const fDoc = sale.fiscalDoc;
  const store = getActiveStore();
  const client = findClient(sale.clientId);

  doc.setFillColor(16, 49, 77);
  doc.rect(0, 0, 595, 12, "F");

  doc.setTextColor(24, 30, 38);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(store?.name || "AGUA CRISTALINA", 40, 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 110, 120);
  doc.text(`NIF: ${store?.nif || "—"}  |  Endereco: ${store?.address || "Angola"}  |  Tel: ${store?.whatsapp || "—"}`, 40, 62);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(16, 49, 77);
  const headerTitle = `${translateEntryType(sale.entryType).toUpperCase()} ${fDoc.number}`;
  doc.text(headerTitle, 40, 95);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(80, 90, 100);
  doc.text(`Data: ${sale.date}  |  Hora: ${fDoc.time}  |  Estado: ${fDoc.status}`, 40, 108);

  doc.line(40, 118, 555, 118);

  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE:", 40, 140);
  doc.setFont("helvetica", "normal");
  doc.text(`Nome: ${client ? client.name : "Consumidor Final"}`, 40, 153);
  doc.text(`NIF: ${client?.nif || "999999999"}`, 40, 166);
  doc.text(`Meio de Pagamento: ${sale.paymentMethod}`, 40, 179);

  runAutoTable(doc, {
    headers: ["PRODUTO", "QTD", "PRECO UNIT(Kz)", "TAXA", "TOTAL(Kz)"],
    body: [
      [
        sale.productName || "Sem Nome",
        sale.quantity,
        currency(sale.total / sale.quantity),
        `${getProductVatRate(sale.productId)}%`,
        currency(sale.total)
      ]
    ],
    startY: 200
  });

  let y = 260;
  doc.setFont("helvetica", "bold");
  doc.text("RESUMO DE IMPOSTO:", 40, y);
  const vatRate = getProductVatRate(sale.productId);
  const net = sale.total / (1 + (vatRate / 100));
  const vat = sale.total - net;

  doc.setFont("helvetica", "normal");
  doc.text(`Total Liquido: ${currency(net)}`, 40, y + 15);
  doc.text(`Total Imposto (IVA ${vatRate}%): ${currency(vat)}`, 40, y + 28);
  if (vatRate === 0) {
    doc.text("Isencao: Isento nos termos do Artigo 12.º do SA", 40, y + 41);
  }

  doc.setFont("helvetica", "bold");
  doc.text(`Assinatura: ${fDoc.hashCompact}-Set`, 40, y + 70);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`VALIDADO EM SOFT. NUMERO: ${fDoc.softwareValidationNumber} / cod reg: ${fDoc.systemRegistrationId}`, 40, y + 84);
  doc.text("Obrigado pela sua preferencia!", 40, y + 100);

  doc.save(`Fatura_${fDoc.number.replace(/\//g, "_")}.pdf`);
}

function ensurePromotionsArray() {
  if (!state.promotions) state.promotions = [];
}

function seedDefaultPromotionIfNeeded() {
  ensurePromotionsArray();
  if (state.promotions.length === 0) {
    state.promotions.push({
      id: "promo-vazio-bomba",
      title: "Combo Vasilhame + Bomba",
      description: "Desconto especial ao comprar Vasilhame vazio de 20L juntamente com Bomba manual",
      discountPercentage: 10,
      active: true,
      rules: "Adiciona 1 Vasilhame (Vazio 20L) + 1 Bomba manual e receba 10% de desconto"
    });
    saveState();
  }
}

function bindPromotions() {
  const form = document.getElementById("promotionForm");
  if (form) {
    form.addEventListener("submit", onSavePromotion);
  }
}

function openPromotionForm(promoId) {
  const modal = document.getElementById("promotionModal");
  if (!modal) return;

  const titleEl = document.getElementById("promoModalTitle");
  const idInput = document.getElementById("promoId");
  const titleInput = document.getElementById("promoTitle");
  const descInput = document.getElementById("promoDescription");
  const discountInput = document.getElementById("promoDiscount");
  const activeInput = document.getElementById("promoActive");

  if (promoId) {
    const p = state.promotions.find(x => x.id === promoId);
    if (!p) return;
    if (titleEl) titleEl.textContent = "Editar Campanha";
    if (idInput) idInput.value = p.id;
    if (titleInput) titleInput.value = p.title;
    if (descInput) descInput.value = p.description;
    if (discountInput) discountInput.value = p.discountPercentage;
    if (activeInput) activeInput.checked = p.active;
  } else {
    if (titleEl) titleEl.textContent = "Nova Campanha de Vendas";
    if (idInput) idInput.value = "";
    if (titleInput) titleInput.value = "";
    if (descInput) descInput.value = "";
    if (discountInput) discountInput.value = "10";
    if (activeInput) activeInput.checked = true;
  }

  modal.hidden = false;
}

function closePromotionForm() {
  const modal = document.getElementById("promotionModal");
  if (modal) modal.hidden = true;
}

function onSavePromotion(event) {
  if (event) event.preventDefault();
  ensurePromotionsArray();

  const idVal = document.getElementById("promoId")?.value;
  const title = document.getElementById("promoTitle")?.value || "";
  const description = document.getElementById("promoDescription")?.value || "";
  const discount = Number(document.getElementById("promoDiscount")?.value) || 0;
  const active = !!document.getElementById("promoActive")?.checked;

  if (idVal) {
    const idx = state.promotions.findIndex(x => x.id === idVal);
    if (idx !== -1) {
      state.promotions[idx] = { ...state.promotions[idx], title, description, discountPercentage: discount, active };
    }
  } else {
    state.promotions.push({
      id: crypto.randomUUID(),
      title,
      description,
      discountPercentage: discount,
      active
    });
  }

  saveState();
  closePromotionForm();
  renderPromotions();
  alert("Campanha guardada com sucesso!");
}

function deletePromotion(id) {
  if (!confirm("Pretende realmente eliminar esta campanha?")) return;
  state.promotions = state.promotions.filter(x => x.id !== id);
  saveState();
  renderPromotions();
}

function todayISO() {
  return today;
}

function daysBetween(startStr, endStr) {
  const s = new Date(startStr);
  const e = new Date(endStr);
  const diffTime = Math.abs(e.getTime() - s.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function formatDatePT(dateStr) {
  if (!dateStr) return "";
  return dateStr.split("-").reverse().join("/");
}

function buildSalesInsights() {
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const limitDate = weekAgo.toISOString().slice(0, 10);

  const productCounters = {};
  const paymentCounters = {};
  const clientCounters = {};
  const dayOfWeekSales = Array(7).fill(0);

  const entries = state.sales.filter(s => s.date >= limitDate && (s.entryType === "sale" || s.entryType === "deposit"));

  entries.forEach((sale) => {
    productCounters[sale.productName] = (productCounters[sale.productName] || 0) + sale.total;
    paymentCounters[sale.paymentMethod] = (paymentCounters[sale.paymentMethod] || 0) + sale.total;
    if (sale.clientId) {
      clientCounters[sale.clientId] = (clientCounters[sale.clientId] || 0) + sale.total;
    }
    const d = new Date(sale.date);
    const day = d.getDay();
    dayOfWeekSales[day] += sale.total;
  });

  const productsRanked = Object.entries(productCounters)
    .map(([name, sum]) => ({ name, value: sum }))
    .sort((a, b) => b.value - a.value);

  const paymentsRanked = Object.entries(paymentCounters)
    .map(([name, sum]) => ({ name, value: sum }))
    .sort((a, b) => b.value - a.value);

  const clientsRanked = Object.entries(clientCounters)
    .map(([id, sum]) => {
      const client = findClient(id);
      return { name: client ? client.name : "Anónimo", value: sum };
    })
    .sort((a, b) => b.value - a.value);

  const dowNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  return {
    productsRanked,
    paymentsRanked,
    clientsRanked,
    sellersRanked: [],
    dowNames,
    dowRevenue: dayOfWeekSales
  };
}

function buildStockInsights() {
  const items = state.stock.map(item => {
    const prod = findProduct(item.productId);
    return {
      name: prod?.name || "Desconhecido",
      quantity: item.quantity,
      cost: item.unitCost,
      productId: item.productId,
      controlled: prod?.stockControlled || false
    };
  });

  const lowStock = items.filter(i => i.controlled && i.quantity > 0 && i.quantity <= 2);
  const outOfStock = items.filter(i => i.controlled && i.quantity === 0);
  const overstocked = items.filter(i => i.controlled && i.quantity > 50);

  return {
    items,
    lowStock,
    outOfStock,
    overstocked
  };
}

function generateMarketingTips() {
  const tips = [];
  const sales = buildSalesInsights();
  const stock = buildStockInsights();

  if (stock.outOfStock.length > 0) {
    tips.push({
      type: "danger",
      title: "Ruptura iminente de stock!",
      notes: `Produto ${stock.outOfStock[0].name} encontra-se esgotado. Encomende vasilhames ou tampas com urgência!`
    });
  }

  if (sales.productsRanked.length > 0) {
    tips.push({
      type: "success",
      title: "Sucesso Comercial",
      notes: `O produto mais rentável dos últimos 7 dias é *${sales.productsRanked[0].name}* (${currency(sales.productsRanked[0].value)}). Invista em publicidade WhatsApp focalizada.`
    });
  }

  if (state.clients.length > 0) {
    const topDebtors = state.clients.filter(c => c.debt > 5000);
    if (topDebtors.length > 0) {
      tips.push({
        type: "warning",
        title: "Controlo de Fiados",
        notes: `Há ${topDebtors.length} clientes com dividas elevadas (&gt;5.000 Kz). Envie-lhes extratos de conta personalizados via WhatsApp.`
      });
    }
  }

  if (tips.length === 0) {
    tips.push({
      type: "info",
      title: "Dica de Crescimento",
      notes: "Inaugure campanhas combinados (Combo Garrafão + Acessório) para aumentar o ticket de venda médio!"
    });
  }

  return tips;
}

function generateInnovationTips() {
  return [
    { title: "Entrega Expressa", description: "Crie rotas regulares de distribuição para escritórios locais com garrafas de 1.5L de alta frequência." },
    { title: "Assinaturas Cristalinas", description: "Ofereça recargas de 20L pré-pagas (ex: 10 recargas mensais) com 5% de desconto para faturamento recorrente garantido." }
  ];
}

function renderPromoTips() {
  const container = document.getElementById("marketingTipsContainer");
  if (!container) return;
  container.innerHTML = "";

  const tips = generateMarketingTips();
  tips.forEach(t => {
    const card = document.createElement("div");
    card.className = `tip-card ${t.type}`;
    card.innerHTML = `
      <div class="tip-header">
        <span class="icon">💡</span>
        <strong>${t.title}</strong>
      </div>
      <p class="text-xs text-muted mb-0 mt-1">${t.notes}</p>
    `;
    container.appendChild(card);
  });

  const innovationContainer = document.getElementById("innovationTipsContainer");
  if (!innovationContainer) return;
  innovationContainer.innerHTML = "";

  const innovations = generateInnovationTips();
  innovations.forEach(inv => {
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <strong>${inv.title}</strong>
        <p class="text-xs text-muted mb-0 mt-0.5">${inv.description}</p>
      </div>
    `;
    innovationContainer.appendChild(row);
  });
}

function renderPromotions() {
  ensurePromotionsArray();
  const target = document.getElementById("promotionsGrid");
  if (!target) return;
  target.innerHTML = "";

  if (state.promotions.length === 0) {
    target.innerHTML = `
      <div class="p-8 text-center text-xs text-muted col-span-2">
        Nenhuma campanha faturada no momento. Crie a sua primeira promoção!
      </div>
    `;
    return;
  }

  state.promotions.forEach(p => {
    const wrapper = document.createElement("div");
    wrapper.className = "mini-card flex flex-col justify-between";
    wrapper.innerHTML = `
      <div>
        <div class="flex justify-between items-start">
          <span class="badge ${p.active ? "success" : "neutral"}">${p.active ? "Activa" : "Inactiva"}</span>
          <span class="badge warning font-mono">${p.discountPercentage}% OFF</span>
        </div>
        <h4 class="font-semibold text-sm mt-2 text-primary">${p.title}</h4>
        <p class="text-xs text-muted mt-1 description">${p.description}</p>
      </div>
      <div class="flex gap-2 mt-4 justify-end">
        <button class="btn btn-sm" onclick="openPromotionForm('${p.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deletePromotion('${p.id}')">Eliminar</button>
      </div>
    `;
    target.appendChild(wrapper);
  });
}

function parsePromoLine() { return null; }
function promoProductId() { return ""; }
function ensurePromoComponentProduct() { return null; }
function ensurePromoStockEntry() { return null; }
function ensurePromoProductInCatalog() { return null; }
function startPromoSale() {
  const select = document.getElementById("saleProduct");
  if (select && select.value !== "combo") {
    select.value = "combo";
    renderSalePreview();
  }
}

async function deleteSaleRecord(saleId) {
  if (!confirm("Tem a certeza que deseja eliminar este registo permanentemente? O stock e os saldos dos clientes serão ajustados.")) return;
  const index = state.sales.findIndex(s => String(s.id) === String(saleId));
  if (index === -1) return alert("Registo não encontrado.");
  const sale = state.sales[index];
  
  // Revert/restore stock if applicable
  const product = findProduct(sale.productId);
  const consumesStock = sale.entryType === "sale" || sale.entryType === "debt";
  if (product && product.stockControlled && consumesStock) {
    const stock = findStockByProduct(sale.productId);
    if (stock) {
      stock.quantity += (sale.quantity || 1);
    }
  }
  
  // Revert customer balances/credits if applicable
  const client = findClient(sale.clientId);
  if (client) {
    if (sale.entryType === "deposit") {
      client.balance = Math.max(0, (client.balance || 0) - sale.total);
    } else if (sale.entryType === "withdrawal") {
      client.balance = (client.balance || 0) + sale.total;
    } else if (sale.entryType === "debt") {
      client.debt = Math.max(0, (client.debt || 0) - sale.total);
    } else if (sale.entryType === "settlement") {
      client.debt = (client.debt || 0) + sale.total;
    } else if (sale.entryType === "sale" && sale.paymentMethod === "Saldo do cliente") {
      client.balance = (client.balance || 0) + sale.total;
    }
  }
  
  state.sales.splice(index, 1);
  await persistMutation({
    success: "Registo monetário eliminado e sincronizado com sucesso.",
    fallback: "Registo monetário eliminado localmente."
  });
  renderAll();
}

// Expose functions globally to window so that inline HTML onclick handlers function correctly
window.deleteSaleRecord = deleteSaleRecord;
window.downloadSaft = downloadSaft;
window.downloadSaftAO = downloadSaft;
window.downloadInvoicePdf = downloadInvoicePdf;
window.onCancelInvoice = onCancelInvoice;
window.openPromotionForm = openPromotionForm;
window.deletePromotion = deletePromotion;

/* SKELETON_END */
