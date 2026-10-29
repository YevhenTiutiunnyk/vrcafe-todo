/* ==========================================================================
   Opslag: taken, categorieën en UI-voorkeuren in LocalStorage
   ========================================================================== */

const Storage = (() => {
  const KEY = 'vrcafe-todo:v1';

  // Kleuren uit de VRCafe-huisstijl, in volgorde toegekend aan categorieën
  const PALETTE = ['#36f2aa', '#fd3e81', '#2eacff', '#c267ff', '#ffd23f', '#ff8a3d'];

  const DEFAULT_CATEGORIES = [
    { id: 'werk', name: 'Werk', color: PALETTE[0], builtin: true },
    { id: 'school', name: 'School', color: PALETTE[3], builtin: true },
    { id: 'persoonlijk', name: 'Persoonlijk', color: PALETTE[1], builtin: true },
    { id: 'vrije-tijd', name: 'Vrije tijd', color: PALETTE[2], builtin: true },
  ];

  function defaultState() {
    const now = Date.now();
    return {
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      tasks: [
        { id: uid(), title: 'Welkom! Vink deze taak af', categoryId: 'persoonlijk', done: false, createdAt: now, due: null },
        { id: uid(), title: 'Shift bij VRCafe voorbereiden', categoryId: 'werk', done: false, createdAt: now - 1000, due: isoDate(2) },
        { id: uid(), title: 'Portfolio bijwerken', categoryId: 'school', done: true, createdAt: now - 2000, due: null },
        { id: uid(), title: 'Escape room met vrienden boeken', categoryId: 'vrije-tijd', done: false, createdAt: now - 3000, due: isoDate(6) },
      ],
      ui: { activeCategory: 'all', filter: 'all', sort: 'newest', view: 'list', theme: 'dark' },
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function isoDate(offsetDays = 0) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return toISODate(d);
  }

  function toISODate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      const fallback = defaultState();
      return {
        categories: Array.isArray(data.categories) && data.categories.length ? data.categories : fallback.categories,
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        ui: { ...fallback.ui, ...(data.ui || {}) },
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      // Opslag vol of geblokkeerd (bijv. privévenster): de app blijft werken in het geheugen
    }
  }

  function nextColor(categories) {
    return PALETTE[categories.length % PALETTE.length];
  }

  return { load, save, uid, nextColor, toISODate };
})();
