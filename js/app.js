/* ==========================================================================
   VRCafe Takenlijst: applicatielogica
   ========================================================================== */

(() => {
  'use strict';

  const state = Storage.load();
  let lastAddedId = null;
  let agendaOffset = 0; // maanden t.o.v. de huidige maand
  let undoTimer = null;
  let undoSnapshot = null;

  const MOBILE_QUERY = window.matchMedia('(max-width: 860px)');
  const dateFmt = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' });
  const monthFmt = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' });

  // ---- DOM-referenties -----------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const el = {
    catList: $('#catList'),
    catForm: $('#catForm'),
    catName: $('#catName'),
    catToggle: $('#catToggle'),
    catToggleName: $('#catToggleName'),
    sidebar: $('.sidebar'),
    taskForm: $('#taskForm'),
    taskTitle: $('#taskTitle'),
    taskCategory: $('#taskCategory'),
    taskDue: $('#taskDue'),
    filterGroup: $('#filterGroup'),
    viewGroup: $('#viewGroup'),
    sortSelect: $('#sortSelect'),
    board: $('#board'),
    agenda: $('#agenda'),
    agendaGrid: $('#agendaGrid'),
    agendaTitle: $('#agendaTitle'),
    prevMonth: $('#prevMonth'),
    nextMonth: $('#nextMonth'),
    statDone: $('#statDone'),
    statTotal: $('#statTotal'),
    themeToggle: $('#themeToggle'),
    toast: $('#toast'),
    toastText: $('#toastText'),
    toastUndo: $('#toastUndo'),
    taskTemplate: $('#taskTemplate'),
  };

  // ---- Helpers -------------------------------------------------------------
  function persist() {
    Storage.save(state);
  }

  function categoryById(id) {
    return state.categories.find((c) => c.id === id);
  }

  function tasksIn(categoryId) {
    return state.tasks.filter((t) => t.categoryId === categoryId);
  }

  function progressOf(categoryId) {
    const list = categoryId === 'all' ? state.tasks : tasksIn(categoryId);
    const done = list.filter((t) => t.done).length;
    return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0 };
  }

  function slugify(name) {
    const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categorie';
    let slug = base;
    let i = 2;
    while (categoryById(slug) || slug === 'all') slug = `${base}-${i++}`;
    return slug;
  }

  function parseISODate(str) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function dueInfo(due) {
    if (!due) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((parseISODate(due) - today) / 86400000);
    if (days === 0) return { label: 'Vandaag', state: 'soon' };
    if (days === 1) return { label: 'Morgen', state: 'soon' };
    if (days > 1 && days < 7) return { label: `Over ${days} dagen`, state: 'future' };
    if (days === -1) return { label: 'Gisteren verlopen', state: 'late' };
    if (days < -1) return { label: `${-days} dagen te laat`, state: 'late' };
    return { label: dateFmt.format(parseISODate(due)), state: 'future' };
  }

  function visibleTasks(list) {
    const { filter, sort } = state.ui;
    let out = list.filter((t) => (filter === 'open' ? !t.done : filter === 'done' ? t.done : true));
    const sorters = {
      newest: (a, b) => b.createdAt - a.createdAt,
      oldest: (a, b) => a.createdAt - b.createdAt,
      alpha: (a, b) => a.title.localeCompare(b.title, 'nl'),
      due: (a, b) => {
        if (!a.due && !b.due) return b.createdAt - a.createdAt;
        if (!a.due) return 1;
        if (!b.due) return -1;
        return a.due.localeCompare(b.due);
      },
    };
    return out.sort(sorters[sort] || sorters.newest);
  }

  // ---- Renderen ------------------------------------------------------------
  function render() {
    renderCategories();
    renderCategorySelect();
    renderToolbar();
    renderStats();
    if (state.ui.view === 'agenda') {
      el.board.hidden = true;
      el.agenda.hidden = false;
      renderAgenda();
    } else {
      el.agenda.hidden = true;
      el.board.hidden = false;
      renderBoard();
    }
    document.documentElement.dataset.theme = state.ui.theme;
  }

  function renderCategories() {
    el.catList.replaceChildren();
    const items = [{ id: 'all', name: 'Alle taken', color: 'var(--text)' }, ...state.categories];

    items.forEach((cat) => {
      const prog = progressOf(cat.id);
      const li = document.createElement('li');
      li.className = 'cat-item';
      li.dataset.cat = cat.id;
      li.style.setProperty('--cat', cat.color);
      if (state.ui.activeCategory === cat.id) li.classList.add('is-active');

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cat-item__btn';
      btn.setAttribute('aria-current', state.ui.activeCategory === cat.id ? 'true' : 'false');
      btn.innerHTML = `
        <span class="cat-item__dot" aria-hidden="true"></span>
        <span class="cat-item__name"></span>
        <span class="cat-item__count">${prog.done}/${prog.total}</span>
        <span class="cat-item__bar" aria-hidden="true"><span style="width:${prog.pct}%"></span></span>`;
      btn.querySelector('.cat-item__name').textContent = cat.name;
      btn.addEventListener('click', () => selectCategory(cat.id));
      li.append(btn);

      if (cat.id !== 'all' && !cat.builtin) {
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'cat-item__delete';
        del.setAttribute('aria-label', `Verwijder categorie ${cat.name}`);
        del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
        del.addEventListener('click', () => deleteCategory(cat.id));
        li.append(del);
      }

      if (cat.id !== 'all') makeDropTarget(li, cat.id);
      el.catList.append(li);
    });

    const active = state.ui.activeCategory === 'all' ? 'Alle taken' : categoryById(state.ui.activeCategory)?.name;
    el.catToggleName.textContent = active || 'Alle taken';
  }

  function renderCategorySelect() {
    const current = el.taskCategory.value;
    el.taskCategory.replaceChildren(
      ...state.categories.map((c) => new Option(c.name, c.id))
    );
    const preferred = state.ui.activeCategory !== 'all' ? state.ui.activeCategory : current;
    if (preferred && categoryById(preferred)) el.taskCategory.value = preferred;
  }

  function renderToolbar() {
    el.filterGroup.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.filter === state.ui.filter)));
    el.viewGroup.querySelectorAll('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.view === state.ui.view)));
    el.sortSelect.value = state.ui.sort;
  }

  function renderStats() {
    const p = progressOf('all');
    el.statDone.textContent = p.done;
    el.statTotal.textContent = p.total;
  }

  function renderBoard() {
    el.board.replaceChildren();
    const cats = state.ui.activeCategory === 'all'
      ? state.categories
      : state.categories.filter((c) => c.id === state.ui.activeCategory);

    el.board.classList.toggle('board--single', cats.length === 1);

    cats.forEach((cat, index) => {
      const prog = progressOf(cat.id);
      const section = document.createElement('section');
      section.className = 'cat-section';
      section.style.setProperty('--cat', cat.color);
      section.style.setProperty('--i', index);
      section.setAttribute('aria-labelledby', `sec-${cat.id}`);

      section.innerHTML = `
        <header class="cat-section__header">
          <h2 class="cat-section__title" id="sec-${cat.id}"></h2>
          <span class="cat-section__count">${prog.done}/${prog.total}</span>
        </header>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prog.pct}"
             aria-label="Voortgang ${escapeAttr(cat.name)}">
          <span class="progress__fill" style="width:${prog.pct}%"></span>
          <span class="progress__label">${prog.pct}%</span>
        </div>
        <ul class="task-list"></ul>`;
      section.querySelector('.cat-section__title').textContent = cat.name;

      const list = section.querySelector('.task-list');
      const tasks = visibleTasks(tasksIn(cat.id));

      if (!tasks.length) {
        const empty = document.createElement('li');
        empty.className = 'empty';
        empty.textContent = emptyMessage(tasksIn(cat.id).length);
        list.append(empty);
      } else {
        tasks.forEach((t) => list.append(buildTask(t)));
      }

      makeDropTarget(section, cat.id);
      el.board.append(section);
    });

    lastAddedId = null;
  }

  function emptyMessage(totalInCategory) {
    if (!totalInCategory) return 'Nog geen taken. Tijd voor een nieuwe missie!';
    if (state.ui.filter === 'open') return 'Alles gedaan. Lekker bezig!';
    if (state.ui.filter === 'done') return 'Nog niets voltooid in deze categorie.';
    return 'Geen taken gevonden.';
  }

  function buildTask(task) {
    const node = el.taskTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.classList.toggle('is-done', task.done);
    if (task.id === lastAddedId) node.classList.add('task--enter');

    node.querySelector('.task__title').textContent = task.title;

    const meta = node.querySelector('.task__meta');
    const created = document.createElement('span');
    created.textContent = `Toegevoegd ${dateFmt.format(new Date(task.createdAt))}`;
    meta.append(created);

    const due = dueInfo(task.due);
    if (due) {
      const badge = document.createElement('span');
      badge.className = `due due--${task.done ? 'done' : due.state}`;
      badge.textContent = due.label;
      meta.append(badge);
    }

    const check = node.querySelector('.task__check');
    check.setAttribute('aria-pressed', String(task.done));
    check.setAttribute('aria-label', task.done ? `Markeer "${task.title}" als open` : `Markeer "${task.title}" als voltooid`);
    check.addEventListener('click', () => toggleTask(task.id));

    const del = node.querySelector('.task__delete');
    del.setAttribute('aria-label', `Verwijder "${task.title}"`);
    del.addEventListener('click', () => deleteTask(task.id, node));

    node.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      node.classList.add('is-dragging');
      document.body.classList.add('is-dragging');
    });
    node.addEventListener('dragend', () => {
      node.classList.remove('is-dragging');
      document.body.classList.remove('is-dragging');
    });

    return node;
  }

  function renderAgenda() {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + agendaOffset);
    el.agendaTitle.textContent = monthFmt.format(base);

    const year = base.getFullYear();
    const month = base.getMonth();
    const startWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // maandag = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayISO = Storage.toISODate(new Date());

    const relevant = visibleTasks(state.tasks.filter((t) =>
      t.due && (state.ui.activeCategory === 'all' || t.categoryId === state.ui.activeCategory)));

    el.agendaGrid.replaceChildren();
    for (let i = 0; i < startWeekday; i++) {
      const pad = document.createElement('div');
      pad.className = 'day day--pad';
      el.agendaGrid.append(pad);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = Storage.toISODate(new Date(year, month, d));
      const cell = document.createElement('div');
      cell.className = 'day';
      if (iso === todayISO) cell.classList.add('day--today');

      const num = document.createElement('span');
      num.className = 'day__num';
      num.textContent = d;
      cell.append(num);

      relevant.filter((t) => t.due === iso).forEach((t) => {
        const cat = categoryById(t.categoryId);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip';
        chip.classList.toggle('is-done', t.done);
        chip.style.setProperty('--cat', cat ? cat.color : 'var(--mint)');
        chip.textContent = t.title;
        chip.title = `${t.title} (${cat ? cat.name : ''}): klik om af te vinken`;
        chip.addEventListener('click', () => toggleTask(t.id));
        cell.append(chip);
      });

      el.agendaGrid.append(cell);
    }
  }

  function escapeAttr(str) {
    return str.replace(/[&"<>]/g, (c) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  // ---- Drag-and-drop -------------------------------------------------------
  function makeDropTarget(node, categoryId) {
    node.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      node.classList.add('is-drop');
    });
    node.addEventListener('dragleave', (e) => {
      if (!node.contains(e.relatedTarget)) node.classList.remove('is-drop');
    });
    node.addEventListener('drop', (e) => {
      e.preventDefault();
      node.classList.remove('is-drop');
      const id = e.dataTransfer.getData('text/plain');
      const task = state.tasks.find((t) => t.id === id);
      if (!task || task.categoryId === categoryId) return;
      task.categoryId = categoryId;
      lastAddedId = task.id;
      persist();
      render();
      showToast(`Verplaatst naar ${categoryById(categoryId).name}`);
    });
  }

  // ---- Acties --------------------------------------------------------------
  function selectCategory(id) {
    state.ui.activeCategory = id;
    persist();
    render();
    if (MOBILE_QUERY.matches) setPanelOpen(false);
  }

  function addTask(title, categoryId, due) {
    const task = { id: Storage.uid(), title, categoryId, done: false, createdAt: Date.now(), due: due || null };
    state.tasks.push(task);
    lastAddedId = task.id;
    persist();
    render();
  }

  function toggleTask(id) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return;
    task.done = !task.done;
    persist();
    render();
    const node = el.board.querySelector(`[data-id="${id}"]`);
    if (node && task.done) node.classList.add('task--pop');
  }

  function deleteTask(id, node) {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;
    const [removed] = state.tasks.splice(index, 1);
    persist();

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      render();
      undoSnapshot = { type: 'task', task: removed, index };
      showToast(`"${removed.title}" verwijderd`, true);
    };

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (node && !reduceMotion) {
      node.style.height = `${node.offsetHeight}px`;
      node.classList.add('task--leave');
      node.addEventListener('animationend', finish, { once: true });
      setTimeout(finish, 500); // vangnet als animationend niet afgaat (bijv. achtergrondtab)
    } else {
      finish();
    }
  }

  function addCategory(name) {
    const clean = name.trim();
    if (!clean) return;
    if (state.categories.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
      showToast('Die categorie bestaat al');
      return;
    }
    const cat = { id: slugify(clean), name: clean, color: Storage.nextColor(state.categories), builtin: false };
    state.categories.push(cat);
    state.ui.activeCategory = cat.id;
    persist();
    render();
    showToast(`Categorie "${clean}" toegevoegd`);
  }

  function deleteCategory(id) {
    const cat = categoryById(id);
    if (!cat) return;
    const count = tasksIn(id).length;
    const msg = count
      ? `Categorie "${cat.name}" en ${count} ${count === 1 ? 'taak' : 'taken'} verwijderen?`
      : `Categorie "${cat.name}" verwijderen?`;
    if (!window.confirm(msg)) return;

    undoSnapshot = {
      type: 'category',
      category: cat,
      catIndex: state.categories.indexOf(cat),
      tasks: tasksIn(id),
      active: state.ui.activeCategory,
    };
    state.categories = state.categories.filter((c) => c.id !== id);
    state.tasks = state.tasks.filter((t) => t.categoryId !== id);
    if (state.ui.activeCategory === id) state.ui.activeCategory = 'all';
    persist();
    render();
    showToast(`Categorie "${cat.name}" verwijderd`, true);
  }

  function undo() {
    if (!undoSnapshot) return;
    if (undoSnapshot.type === 'task') {
      state.tasks.splice(undoSnapshot.index, 0, undoSnapshot.task);
      lastAddedId = undoSnapshot.task.id;
    } else if (undoSnapshot.type === 'category') {
      state.categories.splice(undoSnapshot.catIndex, 0, undoSnapshot.category);
      state.tasks.push(...undoSnapshot.tasks);
      state.ui.activeCategory = undoSnapshot.active;
    }
    undoSnapshot = null;
    persist();
    render();
    hideToast();
  }

  // ---- Toast ---------------------------------------------------------------
  function showToast(text, withUndo = false) {
    clearTimeout(undoTimer);
    el.toastText.textContent = text;
    el.toastUndo.hidden = !withUndo;
    if (!withUndo) undoSnapshot = null;
    el.toast.hidden = false;
    requestAnimationFrame(() => el.toast.classList.add('is-visible'));
    undoTimer = setTimeout(hideToast, withUndo ? 5000 : 2200);
  }

  function hideToast() {
    el.toast.classList.remove('is-visible');
    setTimeout(() => { el.toast.hidden = true; }, 250);
  }

  // ---- Mobiel categoriemenu ------------------------------------------------
  function setPanelOpen(open) {
    el.sidebar.classList.toggle('is-open', open);
    el.catToggle.setAttribute('aria-expanded', String(open));
  }

  // ---- Events --------------------------------------------------------------
  el.taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = el.taskTitle.value.trim();
    if (!title) return;
    addTask(title, el.taskCategory.value, el.taskDue.value);
    el.taskTitle.value = '';
    el.taskDue.value = '';
    el.taskTitle.focus();
  });

  el.catForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addCategory(el.catName.value);
    el.catName.value = '';
  });

  el.filterGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.ui.filter = btn.dataset.filter;
    persist();
    render();
  });

  el.viewGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    state.ui.view = btn.dataset.view;
    persist();
    render();
  });

  el.sortSelect.addEventListener('change', () => {
    state.ui.sort = el.sortSelect.value;
    persist();
    render();
  });

  el.prevMonth.addEventListener('click', () => { agendaOffset--; renderAgenda(); });
  el.nextMonth.addEventListener('click', () => { agendaOffset++; renderAgenda(); });

  el.themeToggle.addEventListener('click', () => {
    state.ui.theme = state.ui.theme === 'dark' ? 'light' : 'dark';
    persist();
    document.documentElement.dataset.theme = state.ui.theme;
  });

  el.catToggle.addEventListener('click', () => {
    setPanelOpen(!el.sidebar.classList.contains('is-open'));
  });

  el.toastUndo.addEventListener('click', undo);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.sidebar.classList.contains('is-open')) {
      setPanelOpen(false);
      el.catToggle.focus();
    }
  });

  MOBILE_QUERY.addEventListener('change', () => setPanelOpen(false));

  // Andere tabbladen synchroon houden
  window.addEventListener('storage', (e) => {
    if (e.key !== 'vrcafe-todo:v1') return;
    Object.assign(state, Storage.load());
    render();
  });

  render();
})();
