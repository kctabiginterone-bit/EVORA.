// ==========================================================
// projects-api.js  (projects + bookings + roles)
// Connects the dashboard to PHP + MySQL.
//
//   Clients      post projects, browse freelancers, send booking
//                requests and cancel them.
//   Freelancers  fill in their profile, accept / decline booking
//                requests and update the progress of their projects.
//
// Load it AFTER dashboard.js.
// ==========================================================
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 2
  });
  const peso2 = new Intl.NumberFormat('en-PH', {
    style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2
  });

  // database value -> what the dashboard shows
  const STATUS = {
    pending:  { label: 'Draft',       cls: '' },
    progress: { label: 'In Progress', cls: 'progress' },
    done:     { label: 'Completed',   cls: 'done' }
  };
  const BOOKING_STATUS = {
    pending:   { label: 'Pending',   cls: 'review' },
    accepted:  { label: 'Accepted',  cls: 'progress' },
    completed: { label: 'Completed', cls: 'done' },
    declined:  { label: 'Declined',  cls: 'bk-muted' },
    cancelled: { label: 'Cancelled', cls: 'bk-muted' }
  };

  const COLORS = ['purple-bg', 'blue-bg', 'pink-bg', 'green-bg', 'amber-bg'];
  const MARKS  = ['✳', '⌘', '◈', '⌁'];

    const state = {
        role: 'client',
        user: null,
        projects: [],
        availableProjects: [],
        stats: null,
        freelancers: [],
        bookings: [],
        bookingStats: {
            total: 0,
            pending: 0,
            accepted: 0,
            hired: 0
        }
    };

  const isFreelancer = () => state.role === 'freelancer';

  // ---------- helpers ----------
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function setText(id, text) {
    const node = $(id);
    if (node) node.textContent = text;
  }

  function setWidth(id, percent) {
    const node = $(id);
    if (node) node.style.width = Math.max(0, Math.min(100, percent)) + '%';
  }

  // "hidden" attribute + inline display, so it works whatever the CSS says
  function setHidden(target, hide) {
    const nodes = typeof target === 'string' ? document.querySelectorAll(target) : [target];
    nodes.forEach((node) => {
      if (!node) return;
      node.hidden = hide;
      node.style.display = hide ? 'none' : '';
    });
  }

  function initials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part[0]).join('').toUpperCase() || 'U';
  }

  function colorFor(id) {
    return COLORS[Math.abs(Number(id) || 0) % COLORS.length];
  }

  function parseDate(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function fmtDate(iso, fallback) {
    if (!iso) return fallback || 'No deadline';
    return parseDate(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function dayCount(start, end) {
    return Math.round((parseDate(end) - parseDate(start)) / 86400000) + 1;
  }

  function fmtRange(start, end) {
    if (start === end) return fmtDate(start);
    const a = parseDate(start);
    const b = parseDate(end);
    const short = { month: 'short', day: 'numeric' };
    if (a.getFullYear() === b.getFullYear()) {
      return a.toLocaleDateString('en-US', short) + ' – ' +
        b.toLocaleDateString('en-US', short) + ', ' + b.getFullYear();
    }
    return fmtDate(start) + ' – ' + fmtDate(end);
  }

  function todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function timeAgo(timestamp) {
    const d = new Date(String(timestamp).replace(' ', 'T'));
    if (isNaN(d)) return '';
    const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ' min ago';
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours > 1 ? ' hours ago' : ' hour ago');
    const days = Math.floor(hours / 24);
    if (days < 30) return days + (days > 1 ? ' days ago' : ' day ago');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function toast(message) {
    const region = $('toastRegion');
    if (!region) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    region.append(node);
    setTimeout(() => node.remove(), 6000);
  }

  // fetch + parse JSON, and say exactly what went wrong if it fails
  async function api(url, options) {
    let res;
    try {
      res = await fetch(url, options);
    } catch (err) {
      console.error(err);
      throw new Error(
        'Cannot connect to the server. Open this page from http://localhost/... (not Live Server or a file) and make sure Apache is running.'
      );
    }

    if (res.status === 401) {
      window.location.href = 'index.html'; // not logged in
      return null;
    }

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch (err) {
      console.error('Server replied (HTTP ' + res.status + ') from ' + url + ':\n' + text);
      if (res.status === 404) {
        throw new Error(url + ' was not found (404). Check that the file is inside the api folder.');
      }
      throw new Error(
        'PHP error from ' + url + ' (HTTP ' + res.status + '). Press F12 → Console to read the reply.'
      );
    }
  }

  function post(url, fields) {
    const body = new FormData();
    Object.keys(fields).forEach((key) => body.append(key, fields[key] == null ? '' : fields[key]));
    return api(url, { method: 'POST', body });
  }

  function pill(status) {
    const s = STATUS[status] || STATUS.pending;
    const style = s.cls ? '' : ' style="background:#26262f;color:#d6d6df"';
    return '<span class="pill ' + s.cls + '"' + style + '>' + s.label + '</span>';
  }

  function bookingPill(status) {
    const s = BOOKING_STATUS[status] || BOOKING_STATUS.pending;
    return '<span class="pill ' + s.cls + '">' + s.label + '</span>';
  }

  // ==========================================================
  // RENDERING
  // ==========================================================

  // ---------- role-specific wording and visibility ----------
  function applyRole() {
    const f = isFreelancer();

    setText('workspaceAvatar', f ? 'F' : 'C');
    setText('workspaceName', f ? 'Freelancer Workspace' : 'Client Workspace');
    setText('sideRole', f ? 'Freelancer account' : 'Client account');
    setText('profileRole', f ? 'Freelancer account' : 'Client account');
    document.title = 'Evora — ' + (f ? 'Freelancer' : 'Client') + ' Dashboard';

    setText('welcomeSub', f
      ? "Here's what's happening with your bookings today."
      : "Here's what's happening with your projects today.");
    setText('projectsSub', f
      ? 'Projects that clients have assigned to you.'
      : 'Organize your work and keep every project moving.');
    setText('profileHint', f
      ? 'Manage the details clients see when they book you.'
      : 'Manage the details freelancers see when working with you.');

    setText('lblHired', f ? 'Accepted Bookings' : 'Freelancers Hired');
    setText('lblSpent', f ? 'Total Earned' : 'Total Spent');
    setText('lblPending', f ? 'New Requests' : 'Pending Requests');
    setText('payTotalLabel', f ? 'Total earned' : 'Total spent');
    setText('profileProjectsLabel', f ? 'Projects assigned' : 'Projects posted');
    setText('profileHiredLabel', f ? 'Accepted bookings' : 'Freelancers hired');

    setText('bkPersonHead', f ? 'CLIENT' : 'FREELANCER');
    setText('bookingsSub', f
      ? 'Answer booking requests from clients and track your confirmed work.'
      : 'Track your booking requests and confirmed work.');

    setText('recTitle', f ? 'Booking Requests' : 'Recommended Freelancers');
    setText('recSub', f ? 'Clients waiting for your answer.' : 'People who may fit your next project.');
    setText('recLink', f ? 'View all →' : 'Browse all →');
    const link = $('recLink');
    if (link) link.dataset.bkGo = f ? 'bookings' : 'browse';

    const search = $('globalSearch');
    if (search) search.placeholder = f ? 'Search your projects' : 'Search projects or freelancers';

    // things only clients can do
    setHidden('.nav-item[data-section="browse"]', false);
    setHidden('[data-open-project]', f);
    setHidden($('bookingsFindBtn'), f);
    // things only freelancers have
    setHidden($('freelancerFields'), !f);
  }

  // ---------- stat cards, counts, payments summary ----------
  function renderStats() {
    const s = state.stats || {
      total: 0, in_progress: 0, completed: 0, spent: 0, active_budget: 0, new_month: 0
    };
    const b = state.bookingStats;
    const f = isFreelancer();
    const active = Math.max(0, s.total - s.completed);
    const people = f ? b.accepted : b.hired;

    setText('projectCount', s.total);
    setText('profileProjectCount', s.total);
    setText('profileHiredCount', people);

    setText('activeStat', active);
    setText('activeNote', s.total
      ? s.in_progress + ' in progress · ' + s.completed + ' completed'
      : (f ? 'No assigned projects yet' : 'No projects yet'));
    setWidth('barActive', s.total ? (active / s.total) * 100 : 0);

    setText('hiredStat', people);
    setText('hiredNote', people
      ? (f ? 'Confirmed bookings' : 'Freelancers you booked')
      : (f ? 'No accepted bookings yet' : 'No freelancers hired yet'));
    setWidth('barHired', b.total ? (people / b.total) * 100 : 0);

    setText('spentStat', peso.format(s.spent));
    setText('spentNote', 'From completed projects');
    setWidth('barSpent', s.total ? (s.completed / s.total) * 100 : 0);

    setText('pendingStat', b.pending);
    setText('pendingNote', b.pending
      ? (f ? 'Waiting for your answer' : 'Waiting for a reply')
      : (f ? "You're all caught up" : 'Nothing waiting for a reply'));
    setWidth('barPending', b.total ? (b.pending / b.total) * 100 : 0);

    setText('payTotal', peso2.format(s.spent));
    setText('payActive', peso2.format(s.active_budget));

    const badge = $('bookingCount');
    if (badge) {
      badge.textContent = b.pending;
      setHidden(badge, b.pending === 0);
    }
  }

  // ---------- Recent Projects table (Overview) ----------
  function renderRecent() {
    const tbody = $('recentTable');
    if (!tbody) return;

    if (!state.projects.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">' + (isFreelancer()
        ? 'No projects assigned yet. Accept a booking that is linked to a project and it will show up here.'
        : 'No projects yet. Click “Post a Project” to add your first one.') + '</td></tr>';
      return;
    }

    tbody.innerHTML = state.projects.slice(0, 5).map((p, i) =>
      '<tr>' +
        '<td><span class="project-name">' +
          '<i class="project-mark ' + COLORS[i % 4] + '">' + MARKS[i % 4] + '</i>' +
          '<span><b>' + esc(p.title) + '</b><small>' +
            esc(isFreelancer() ? 'Client: ' + p.client_name : (p.category || 'No category')) +
          '</small></span>' +
        '</span></td>' +
        '<td>' + pill(p.status) + '</td>' +
        '<td>' + peso.format(p.budget) + '</td>' +
        '<td>' + fmtDate(p.deadline) + '</td>' +
      '</tr>'
    ).join('');
  }

  // ---------- Projects page ----------
  function progressControl(p) {
    if (!isFreelancer()) return '';
    if (p.status === 'done') return '<div class="bk-progress"><span>Progress</span><b>Completed ✓</b></div>';

    const steps = [0, 25, 50, 75, 100];
    if (steps.indexOf(p.progress) === -1) steps.push(p.progress);
    steps.sort((a, b) => a - b);

    return '<div class="bk-progress"><span>Update progress</span>' +
      '<select class="bk-select" data-progress-project="' + p.id + '" aria-label="Update progress">' +
      steps.map((n) => '<option value="' + n + '"' + (n === p.progress ? ' selected' : '') + '>' + n + '%</option>').join('') +
      '</select></div>';
  }

  function assigneeLine(p) {
    if (isFreelancer()) return '<div class="card-assignee">Client: ' + esc(p.client_name) + '</div>';
    if (p.freelancer_name) return '<div class="card-assignee">Freelancer: <b>' + esc(p.freelancer_name) + '</b></div>';
    return '<div class="card-assignee">No freelancer assigned yet · ' +
      '<button class="text-link" type="button" data-bk-go="browse">Find a freelancer →</button></div>';
  }

  function renderGrid() {
    const grid = $('projectGrid');
    if (!grid) return;

    const empty = $('projectEmpty');
    if (empty) empty.hidden = true;

    if (!state.projects.length) {
      grid.innerHTML = '<p class="empty-state">' + (isFreelancer()
        ? 'No projects assigned to you yet.'
        : 'No projects yet. Click “Post a Project” to add your first one.') + '</p>';
      return;
    }

    const q = ($('projectSearch') && $('projectSearch').value || '').trim().toLowerCase();
    const wanted = ($('statusFilter') && $('statusFilter').value) || 'all';

    const list = state.projects.filter((p) => {
      const label = (STATUS[p.status] || STATUS.pending).label;
      const text = (p.title + ' ' + (p.category || '')).toLowerCase();
      return (wanted === 'all' || label === wanted) && (!q || text.indexOf(q) !== -1);
    });

    if (!list.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    grid.innerHTML = list.map((p, i) =>
      '<article class="project-card" data-name="' + esc(p.title) + '" data-status="' + (STATUS[p.status] || STATUS.pending).label + '">' +
        '<div class="project-card-top">' +
          '<i class="project-mark ' + COLORS[i % 4] + '"></i>' + pill(p.status) +
        '</div>' +
        '<small class="category">' + esc((p.category || 'No category').toUpperCase()) + '</small>' +
        '<h3>' + esc(p.title) + '</h3>' +
        '<p>' + esc(p.description || 'No description added.') + '</p>' +
        '<div class="meta-row"><span>Budget</span><b>' + peso.format(p.budget) + '</b></div>' +
        '<div class="meta-row"><span>Deadline</span><b>' + fmtDate(p.deadline) + '</b></div>' +
        '<div class="progress-label"><span>Progress</span><b>' + p.progress + '%</b></div>' +
        '<div class="progress-track"><i style="width:' + p.progress + '%"></i></div>' +
        assigneeLine(p) +
        progressControl(p) +
      '</article>'
    ).join('');
  }
  
    function renderAvailableProjects() {
        const grid = $('availableProjectsGrid');

        console.log('Browse Projects grid:', grid);
        console.log('Current role:', state.role);
        console.log('Projects to display:', state.availableProjects);

        if (!grid) {
            console.error('availableProjectsGrid was not found!');
            return;

            const browsePage = document.getElementById('page-browse');
            const projectGrid = document.getElementById('availableProjectsGrid');

            console.log('Browse page classes:', browsePage?.className);
            console.log('Browse page display:', browsePage ? getComputedStyle(browsePage).display : 'NOT FOUND');
            console.log('Project grid height:', projectGrid?.getBoundingClientRect().height);
            console.log('Project card count:', projectGrid?.querySelectorAll('.project-card').length);
        }

  const empty = $('availableProjectsEmpty');
  const search = ($('projectSearch')?.value || '').trim().toLowerCase();
  const category = $('projectCategoryFilter')?.value || 'all';

  const projects = state.availableProjects || [];
  console.log('Rendering available projects:', projects);

  const filtered = projects.filter((p) => {
    const text = ((p.title || '') + ' ' + (p.description || '') + ' ' + (p.category || '')).toLowerCase();

    return (!search || text.includes(search)) &&
      (category === 'all' || p.category === category);
  });

  if (!filtered.length) {
    grid.innerHTML = '<p class="empty-state">No available projects found.</p>';
    if (empty) empty.hidden = true;
    return;
  }

  grid.innerHTML = filtered.map((p, i) =>
    '<article class="project-card">' +
      '<div class="project-card-top">' +
        '<i class="project-mark ' + COLORS[i % 4] + '"></i>' +
        pill(p.status) +
      '</div>' +
      '<small class="category">' + esc((p.category || 'Other').toUpperCase()) + '</small>' +
      '<h3>' + esc(p.title) + '</h3>' +
      '<p>' + esc(p.description || 'No description provided.') + '</p>' +
      '<div class="meta-row"><span>Budget</span><b>' + peso.format(p.budget) + '</b></div>' +
      '<div class="meta-row"><span>Deadline</span><b>' + fmtDate(p.deadline) + '</b></div>' +
    '</article>'
  ).join('');
    console.log('Filtered projects:', filtered.length);
    console.log('Rendered project HTML:', grid.innerHTML);
    console.log('Grid display style:', getComputedStyle(grid).display);
    console.log('Grid visibility:', getComputedStyle(grid).visibility);
    const browsePage = document.getElementById('page-browse');

    console.log('Browse page classes:', browsePage?.className);
    console.log(
    'Browse page display:',
    browsePage ? getComputedStyle(browsePage).display : 'NOT FOUND'
    );
    console.log(
    'Project grid height:',
    grid?.getBoundingClientRect().height
    );
    console.log(
    'Project card count:',
    grid?.querySelectorAll('.project-card').length
    );

  if (empty) empty.hidden = true;
}


  // ---------- Recent Activity (projects + bookings, newest first) ----------
  function renderActivity() {
    const box = $('activityList');
    if (!box) return;

    const f = isFreelancer();
    const events = [];

    if (!f) {
      state.projects.forEach((p) => events.push({
        time: p.created_at, id: p.id, name: p.title,
        html: 'You posted <b>' + esc(p.title) + '</b>.',
        sub: esc(p.category || 'No category')
      }));
    }

    state.bookings.forEach((b) => {
      const proj = b.project_title ? esc(b.project_title) : 'General booking';
      events.push({
        time: b.created_at, id: b.other_id, name: b.other_name,
        html: f
          ? '<b>' + esc(b.other_name) + '</b> sent you a booking request.'
          : 'You sent a booking request to <b>' + esc(b.other_name) + '</b>.',
        sub: proj
      });

      const verbs = f
        ? { accepted: 'You accepted the booking from', declined: 'You declined the booking from', completed: 'You completed the booking for', cancelled: 'Cancelled by client:' }
        : { accepted: 'accepted your booking', declined: 'declined your booking', completed: 'completed your booking', cancelled: 'You cancelled your booking with' };

      if (b.status !== 'pending') {
        const clientSide = !f && (b.status === 'accepted' || b.status === 'declined' || b.status === 'completed');
        events.push({
          time: b.updated_at || b.created_at, id: b.other_id, name: b.other_name,
          html: clientSide
            ? '<b>' + esc(b.other_name) + '</b> ' + verbs[b.status] + '.'
            : verbs[b.status] + ' <b>' + esc(b.other_name) + '</b>.',
          sub: proj
        });
      }
    });

    events.sort((a, b) => String(b.time).localeCompare(String(a.time)));

    if (!events.length) {
      box.innerHTML = '<p class="empty-state">No activity yet.' + (f ? '' : ' Post a project to get started.') + '</p>';
      return;
    }

    box.innerHTML = events.slice(0, 5).map((ev) =>
      '<div class="activity">' +
        '<span class="mini-avatar ' + colorFor(ev.id) + '">' + esc(initials(ev.name)) + '</span>' +
        '<div><p>' + ev.html + '</p><small>' + ev.sub + ' · ' + timeAgo(ev.time) + '</small></div>' +
      '</div>'
    ).join('');
  }

  // ---------- Upcoming Deadline ----------
  function renderDeadline() {
    if (!$('deadlineDay')) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next = state.projects
      .filter((p) => p.deadline && p.status !== 'done')
      .map((p) => ({ p, date: parseDate(p.deadline) }))
      .filter((x) => x.date >= today)
      .sort((a, b) => a.date - b.date)[0];

    if (!next) {
      setText('deadlineDay', '–');
      setText('deadlineTitle', 'No upcoming deadline');
      setText('deadlineDue', isFreelancer() ? 'Nothing due soon' : 'Post a project with a deadline');
      setText('deadlinePct', '0%');
      setWidth('deadlineBar', 0);
      return;
    }

    setText('deadlineDay', next.date.getDate());
    setText('deadlineTitle', next.p.title);
    setText('deadlineDue', 'Due ' + next.date.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    }));
    setText('deadlinePct', next.p.progress + '%');
    setWidth('deadlineBar', next.p.progress);
  }

  // ---------- Browse Freelancers ----------
  function renderFreelancers() {
    const grid = $('freelancerGrid');
    if (!grid || isFreelancer()) return;

    const empty = $('freelancerEmpty');
    if (empty) empty.hidden = true;

    if (!state.freelancers.length) {
      grid.innerHTML = '<p class="empty-state">No freelancers have joined yet. Check back soon.</p>';
      return;
    }

    const q = ($('freelancerSearch') && $('freelancerSearch').value || '').trim().toLowerCase();
    const cat = ($('categoryFilter') && $('categoryFilter').value) || 'all';

    const list = state.freelancers.filter((f) => {
      const text = (f.name + ' ' + f.headline + ' ' + f.skills.join(' ') + ' ' + f.category).toLowerCase();
      return (cat === 'all' || f.category === cat) && (!q || text.indexOf(q) !== -1);
    });

    if (!list.length) {
      grid.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    grid.innerHTML = list.map((f) => {
      const free = f.availability === 'available';
      return (
        '<article class="freelancer-card" data-name="' + esc(f.name) + '" data-category="' + esc(f.category) + '">' +
          '<span class="mini-avatar ' + colorFor(f.id) + ' large-avatar">' + esc(initials(f.name)) + '</span>' +
          '<span class="available' + (free ? '' : ' busy') + '">' + (free ? 'Available' : 'Busy') + '</span>' +
          '<h3>' + esc(f.name) + '</h3>' +
          '<p class="role">' + esc(f.headline) + '</p>' +
          '<p class="bio">' + esc(f.about ? (f.about.length > 110 ? f.about.slice(0, 107) + '…' : f.about) : (f.location || '')) + '</p>' +
          '<div class="tags">' + f.skills.map((s) => '<span>' + esc(s) + '</span>').join('') + '</div>' +
          '<div class="freelancer-meta">' +
            '<span>' + (f.jobs ? f.jobs + (f.jobs > 1 ? ' bookings' : ' booking') : 'New on Evora') + '</span>' +
            '<b>' + peso.format(f.hourly_rate) + '<small>/hr</small></b>' +
          '</div>' +
          '<button class="button primary full" type="button" data-book="' + f.id + '"' + (free ? '' : ' disabled') + '>' +
            (free ? 'Book Now' : 'Not available') + '</button>' +
        '</article>'
      );
    }).join('');
  }

  // ---------- Overview side panel: recommended freelancers / booking requests ----------
  function renderRecommended() {
    const box = $('recommendList');
    if (!box) return;

    if (isFreelancer()) {
      const pending = state.bookings.filter((b) => b.status === 'pending').slice(0, 3);
      if (!pending.length) {
        box.innerHTML = '<p class="empty-state">No pending requests right now.</p>';
        return;
      }
      box.innerHTML = pending.map((b) =>
        '<div class="recommendation">' +
          '<span class="mini-avatar ' + colorFor(b.other_id) + '">' + esc(initials(b.other_name)) + '</span>' +
          '<span><b>' + esc(b.other_name) + '</b>' +
            '<small>' + esc(b.project_title || 'General booking') + '</small>' +
            '<em>' + fmtRange(b.start_date, b.end_date) + '</em></span>' +
          '<span class="bk-actions">' +
            '<button class="small-button bk-accept" type="button" data-bk-action="accept" data-id="' + b.id + '">Accept</button>' +
            '<button class="small-button bk-decline" type="button" data-bk-action="decline" data-id="' + b.id + '">Decline</button>' +
          '</span>' +
        '</div>'
      ).join('');
      return;
    }

    const top = state.freelancers.filter((f) => f.availability === 'available').slice(0, 3);
    if (!top.length) {
      box.innerHTML = '<p class="empty-state">No freelancers to recommend yet.</p>';
      return;
    }
    box.innerHTML = top.map((f) =>
      '<div class="recommendation">' +
        '<span class="mini-avatar ' + colorFor(f.id) + '">' + esc(initials(f.name)) + '</span>' +
        '<span><b>' + esc(f.name) + '</b><small>' + esc(f.headline) + '</small>' +
          '<em>' + peso.format(f.hourly_rate) + '/hr</em></span>' +
        '<button class="small-button" type="button" data-book="' + f.id + '">Book</button>' +
      '</div>'
    ).join('');
  }

  // ---------- Bookings page ----------
  function renderBookings() {
    const tbody = $('bookingRows');
    if (!tbody) return;

    const f = isFreelancer();

    if (!state.bookings.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">' + (f
        ? 'No booking requests yet. Complete your profile so clients can find you.'
        : 'No bookings yet. Go to Browse Freelancers and book someone.') + '</td></tr>';
      return;
    }

    const wanted = ($('bookingFilter') && $('bookingFilter').value) || 'all';
    const list = state.bookings.filter((b) => wanted === 'all' || b.status === wanted);

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No bookings match this filter.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((b) => {
      let actions = '';
      if (f && b.status === 'pending') {
        actions =
          '<button class="small-button bk-accept" type="button" data-bk-action="accept" data-id="' + b.id + '">Accept</button>' +
          '<button class="small-button bk-decline" type="button" data-bk-action="decline" data-id="' + b.id + '">Decline</button>';
      } else if (f && b.status === 'accepted') {
        actions = '<button class="small-button" type="button" data-bk-action="complete" data-id="' + b.id + '">Mark completed</button>';
      } else if (!f && (b.status === 'pending' || b.status === 'accepted')) {
        actions = '<button class="small-button bk-cancel" type="button" data-bk-action="cancel" data-id="' + b.id + '">Cancel</button>';
      }

      const days = dayCount(b.start_date, b.end_date);
      const note = b.note ? '<small class="bk-sub" title="' + esc(b.note) + '">“' + esc(b.note.length > 48 ? b.note.slice(0, 45) + '…' : b.note) + '”</small>' : '';

      return (
        '<tr>' +
          '<td><span class="bk-person"><span class="mini-avatar ' + colorFor(b.other_id) + '">' + esc(initials(b.other_name)) + '</span>' +
            '<span><b>' + esc(b.other_name) + '</b><small>' + esc(b.other_detail || (f ? 'Client' : 'Freelancer')) + '</small></span></span></td>' +
          '<td><span class="bk-person"><span><b>' + esc(b.project_title || 'General booking') + '</b>' + note + '</span></span></td>' +
          '<td>' + fmtRange(b.start_date, b.end_date) + '<br><small class="bk-sub">' + days + (days > 1 ? ' days' : ' day') + '</small></td>' +
          '<td>' + peso.format(b.rate) + '<small class="bk-sub">/hr</small></td>' +
          '<td>' + bookingPill(b.status) + '</td>' +
          '<td><span class="bk-actions">' + actions + '</span></td>' +
        '</tr>'
      );
    }).join('');
  }


    function renderAll() {
        applyRole();
        renderStats();
        renderRecent();
        renderGrid();

        if (isFreelancer()) {
            renderAvailableProjects();
        }

        renderActivity();
        renderDeadline();
        renderFreelancers();
        renderRecommended();
        renderBookings();
    }

  // ==========================================================
  // LOADING DATA
  // ==========================================================

  async function loadProjects() {
    const data = await api('api/get_projects.php');
    if (!data) return;
    if (!data.success) throw new Error(data.message || 'Could not load projects.');
    state.projects = data.projects;
    state.stats = data.stats;
  }
  
    async function loadAvailableProjects() {
        const data = await api('api/get_available_projects.php');

        if (!data) return;

        if (!data.success) {
            throw new Error(
                data.message || 'Could not load available projects.'
            );
        }

        state.availableProjects = Array.isArray(data.projects)
            ? data.projects
            : [];

        console.log(
            'Available projects loaded:',
            state.availableProjects
        );
    }


  async function loadBookings() {
    const data = await api('api/get_bookings.php');
    if (!data) return;
    if (!data.success) throw new Error(data.message || 'Could not load bookings.');
    state.bookings = data.bookings;
    state.bookingStats = data.stats;
  }

  async function loadFreelancers() {
    if (isFreelancer()) {
      state.freelancers = [];
      return;
    }
    const data = await api('api/get_freelancers.php');
    if (!data) return;
    if (!data.success) throw new Error(data.message || 'Could not load freelancers.');
    state.freelancers = data.freelancers;
  }


    async function reloadAll(silent) {
  try {
    const tasks = [
      loadProjects(),
      loadBookings(),
      loadFreelancers()
    ];

    if (isFreelancer()) {
      tasks.push(loadAvailableProjects());
    }

    await Promise.all(tasks);
    renderAll();
  } catch (err) {
    console.error(err);
    if (!silent) toast(err.message);
  }
    }


  // ==========================================================
  // LOGGED-IN USER + PROFILE
  // ==========================================================

  function profileComplete(user) {
    if (user.role !== 'freelancer') return true;
    return !!(user.headline && user.hourly_rate !== null && user.hourly_rate !== undefined);
  }

  function applyUser(user) {
    state.user = user;
    state.role = user.role === 'freelancer' ? 'freelancer' : 'client';

    const name = user.name || 'User';
    const first = name.split(/\s+/)[0];
    const ini = initials(name);

    setText('sideName', name);
    setText('topName', name);
    setText('profileHeading', name);
    ['sideInitials', 'topInitials', 'profileInitials'].forEach((id) => setText(id, ini));

    const fields = {
      profileName: name,
      profileEmail: user.email || '',
      profileCompany: user.company || '',
      profileAbout: user.about || '',
      profileLocation: user.location || '',
      profileHeadline: user.headline || '',
      profileCategory: user.category || '',
      profileRate: user.hourly_rate === null || user.hourly_rate === undefined ? '' : user.hourly_rate,
      profileSkills: user.skills || '',
      profileAvailability: user.availability || 'available'
    };
    Object.keys(fields).forEach((id) => {
      const input = $(id);
      if (input) input.value = fields[id];
    });

    // "Welcome back ✦" -> "Good morning, Kent ✦"
    const h1 = document.querySelector('#page-overview h1');
    if (h1 && h1.firstChild && h1.firstChild.nodeType === 3) {
      h1.firstChild.textContent = greeting() + ', ' + first + ' ';
    }

    // "Member since ..."
    const since = document.querySelector('#page-profile .profile-card small');
    if (since && user.created_at) {
      const d = new Date(String(user.created_at).replace(' ', 'T'));
      if (!isNaN(d)) {
        since.textContent = 'Member since ' +
          d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
    }

    // profile status pill
    const status = $('profileStatus');
    if (status) {
      const ok = profileComplete(user);
      status.textContent = ok ? 'Complete' : 'Incomplete';
      status.className = 'pill ' + (ok ? 'done' : 'review');
    }
    setText('freelancerHint', profileComplete(user)
      ? 'Clients can find you in Browse Freelancers and send you booking requests.'
      : 'Add a headline and your hourly rate so clients can find and book you.');

    applyRole();
  }

  async function loadUser() {
    try {
      const data = await api('api/me.php');
      if (!data) return false;
      if (!data.success) throw new Error(data.message || 'Could not load your account.');
      applyUser(data.user);
      return true;
    } catch (err) {
      toast(err.message);
      return false;
    }
  }

  // ---------- Save profile ----------
  document.addEventListener('submit', async (e) => {
    if (!e.target || e.target.id !== 'profileForm') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target;
    const submitBtn = form.querySelector('button:not([type="button"])');

    const fields = {
      name: $('profileName').value.trim(),
      email: $('profileEmail').value.trim(),
      company: $('profileCompany').value.trim(),
      about: $('profileAbout').value.trim(),
      location: $('profileLocation').value.trim()
    };
    if (isFreelancer()) {
      fields.headline = $('profileHeadline').value.trim();
      fields.category = $('profileCategory').value;
      fields.hourly_rate = $('profileRate').value.trim();
      fields.skills = $('profileSkills').value.trim();
      fields.availability = $('profileAvailability').value;
    }

    const oldText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }

    try {
      const data = await post('api/update_profile.php', fields);
      if (!data) return;

      if (data.success) {
        applyUser(data.user);
        toast('Profile saved');
      } else {
        toast(data.message || 'Could not save your profile.');
      }
    } catch (err) {
      toast(err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = oldText;
      }
    }
  }, true);

  // The "Save Changes" button at the top of My Profile submits the same form
  const topSave = $('saveProfileTop');
  if (topSave) {
    topSave.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const form = $('profileForm');
      if (form) form.requestSubmit();
    }, true);
  }

  // ==========================================================
  // POST A PROJECT
  // ==========================================================
  // Capture phase on document: runs before the old demo handlers in
  // dashboard.js, and stopImmediatePropagation() keeps those from running.
  document.addEventListener('submit', async (e) => {
    if (!e.target || e.target.id !== 'projectForm') return;

    e.preventDefault();
    e.stopImmediatePropagation();

    const form = e.target;
    const submitBtn = form.querySelector('button:not([type="button"])');

    const oldText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }

    try {
      const data = await post('api/create_project.php', {
        title: $('newTitle').value.trim(),
        category: $('newCategory').value,
        budget: $('newBudget').value,
        deadline: $('newDeadline').value,
        description: $('newDescription').value.trim()
      });
      if (!data) return;

      if (data.success) {
        form.reset();
        setHidden($('projectModal'), true);
        document.body.style.overflow = '';
        toast('Project posted successfully');
        await reloadAll();
      } else {
        toast(data.message || 'Could not save the project.');
      }
    } catch (err) {
      toast(err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = oldText;
      }
    }
  }, true);

  // ==========================================================
  // BOOKINGS
  // ==========================================================

    function showPage(name) {
    document.querySelectorAll('.page').forEach((page) => {
        page.classList.toggle('active', page.id === 'page-' + name);
    });

    document.querySelectorAll('.side-nav .nav-item[data-section]').forEach((item) => {
        item.classList.toggle('active', item.dataset.section === name);
    });

    const page = document.getElementById('page-' + name);
    setText('breadcrumb', (page && page.dataset.title) || name);

    const sidebar = document.getElementById('sidebar');
    const scrim = document.getElementById('scrim');

    if (sidebar) sidebar.classList.remove('open');
    if (scrim) scrim.classList.remove('show');

    const toggle = document.getElementById('menuToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');

    window.scrollTo(0, 0);
    }
  function goTo(name) {
    if (name === 'bookings') {
      showPage('bookings');
      return;
    }
    const item = document.querySelector('.nav-item[data-section="' + name + '"]');
    if (item) item.click();
  }

  // Navigation: "bookings" is a new page, so it is handled here.
  // Any other navigation just has to make sure the Bookings page is closed.
    
    document.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-section], [data-go]');
    if (!nav) return;

    const section = nav.dataset.section || nav.dataset.go;

    // Let dashboard.js handle normal page navigation.
    // Only handle the Bookings page here.
    if (section === 'bookings') {
        e.preventDefault();
        e.stopImmediatePropagation();
        showPage('bookings');
    }
    }, true);


  // Log out. Handled in the capture phase so dashboard.js's navigation code never sees this click.
  document.addEventListener('click', async (e) => {
    if (!e.target.closest('#logoutBtn')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    try { await fetch('api/logout.php', { method: 'POST' }); } catch (err) { /* leave anyway */ }
    window.location.href = 'index.html';
  }, true);

  // ---------- Booking modal ----------
  function updateEstimate() {
    const start = $('bookStart').value;
    const end = $('bookEnd').value;
    const rate = Number($('bookingForm').dataset.rate || 0);
    const box = $('bookEstimate');

    if (start && end && end >= start) {
      const days = dayCount(start, end);
      box.textContent = days + (days > 1 ? ' days' : ' day') + ' · rate ' + peso.format(rate) + '/hr';
    } else {
      box.textContent = rate ? 'Rate: ' + peso.format(rate) + '/hr' : '';
    }
  }

  function openBooking(freelancerId) {
    const f = state.freelancers.find((x) => x.id === freelancerId);
    if (!f) return;

    $('bookFreelancer').value = f.id;
    $('bookingForm').dataset.rate = f.hourly_rate;
    setText('bookTitle', 'Book ' + f.name);
    setText('bookMeta', f.headline + ' · ' + peso.format(f.hourly_rate) + '/hr');

    // only projects that still need a freelancer can be linked
    const free = state.projects.filter((p) => p.status !== 'done' && !p.freelancer_id);
    $('bookProject').innerHTML =
      '<option value="">General booking (no specific project)</option>' +
      free.map((p) => '<option value="' + p.id + '">' + esc(p.title) + '</option>').join('');

    $('bookStart').min = todayISO();
    $('bookEnd').min = todayISO();
    $('bookStart').value = '';
    $('bookEnd').value = '';
    $('bookNote').value = '';
    updateEstimate();

    setHidden($('bookingModal'), false);
    document.body.style.overflow = 'hidden';
    $('bookStart').focus();
  }

  function closeBooking() {
    setHidden($('bookingModal'), true);
    document.body.style.overflow = '';
  }

  document.addEventListener('change', (e) => {
    if (!e.target) return;
    if (e.target.id === 'bookStart') {
      const start = e.target.value;
      $('bookEnd').min = start || todayISO();
      if (start && (!$('bookEnd').value || $('bookEnd').value < start)) $('bookEnd').value = start;
      updateEstimate();
    }
    if (e.target.id === 'bookEnd') updateEstimate();
  });

  document.addEventListener('submit', async (e) => {
    if (!e.target || e.target.id !== 'bookingForm') return;
    e.preventDefault();

    const btn = $('submitBooking');
    const oldText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const data = await post('api/create_booking.php', {
        freelancer_id: $('bookFreelancer').value,
        project_id: $('bookProject').value,
        start_date: $('bookStart').value,
        end_date: $('bookEnd').value,
        note: $('bookNote').value.trim()
      });
      if (!data) return;

      if (data.success) {
        closeBooking();
        toast(data.message || 'Booking request sent');
        await reloadAll();
        showPage('bookings');
      } else {
        toast(data.message || 'Could not send the booking request.');
      }
    } catch (err) {
      toast(err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  });

  // ---------- Accept / decline / cancel / complete ----------
  async function bookingAction(id, action, button) {
    if (action === 'cancel' && !window.confirm('Cancel this booking?')) return;

    if (button) button.disabled = true;
    try {
      const data = await post('api/update_booking.php', { id: id, action: action });
      if (!data) return;
      toast(data.message || (data.success ? 'Done' : 'Could not update the booking.'));
      await reloadAll();
    } catch (err) {
      toast(err.message);
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function updateProgress(id, value, select) {
    select.disabled = true;
    try {
      const data = await post('api/update_project.php', { id: id, progress: value });
      if (!data) return;
      toast(data.message || (data.success ? 'Progress updated' : 'Could not update the project.'));
      await reloadAll();
    } catch (err) {
      toast(err.message);
    } finally {
      select.disabled = false;
    }
  }

  // ---------- one click handler for all the dynamic buttons ----------
  document.addEventListener('click', (e) => {
    const bookBtn = e.target.closest('[data-book]');
    if (bookBtn) {
      openBooking(Number(bookBtn.dataset.book));
      return;
    }

    const actionBtn = e.target.closest('[data-bk-action]');
    if (actionBtn) {
      bookingAction(Number(actionBtn.dataset.id), actionBtn.dataset.bkAction, actionBtn);
      return;
    }

    const goBtn = e.target.closest('[data-bk-go]');
    if (goBtn) {
      e.preventDefault();
      goTo(goBtn.dataset.bkGo);
      return;
    }

    if (e.target.closest('#closeBooking, #cancelBooking') || e.target === $('bookingModal')) {
      closeBooking();
    }
  });

  document.addEventListener('change', (e) => {
    const select = e.target && e.target.closest && e.target.closest('[data-progress-project]');
    if (select) updateProgress(Number(select.dataset.progressProject), select.value, select);
  });

  document.addEventListener('keydown', (e) => {
    const modal = $('bookingModal');
    if (e.key === 'Escape' && modal && !modal.hidden) closeBooking();
  });

  // ---------- Filters (our own handlers; they replace the old demo ones) ----------
    const FILTERS = {
        projectSearch: renderGrid,
        statusFilter: renderGrid,
        freelancerSearch: renderFreelancers,
        categoryFilter: renderFreelancers,
        bookingFilter: renderBookings
        };

        $('projectSearch')?.addEventListener(
        'input',
        renderAvailableProjects
        );

        $('projectCategoryFilter')?.addEventListener(
        'change',
        renderAvailableProjects
    );

  ['input', 'change'].forEach((type) => {
    document.addEventListener(type, (e) => {
      const fn = e.target && FILTERS[e.target.id];
      if (!fn) return;
      e.stopImmediatePropagation();
      // A text box already re-rendered on 'input'. Its 'change' event fires on blur,
      // i.e. in the middle of the next click, and rebuilding the cards right then
      // makes that click (e.g. "Book Now") get lost. So only selects react to 'change'.
      if (type === 'change' && e.target.tagName === 'INPUT') return;
      fn();
    }, true);
  });

  // ==========================================================
  // START
  // ==========================================================
  (async function init() {
    const ok = await loadUser();
    if (ok) await reloadAll();
  })();

  // Pick up new booking requests without a manual refresh
  setInterval(() => {
    if (document.hidden || !state.user) return;
    const active = document.activeElement;
    if (active && /^(SELECT|INPUT|TEXTAREA)$/.test(active.tagName)) return; // don't disturb typing
    const modal = $('bookingModal');
    if (modal && !modal.hidden) return;
    reloadAll(true);
  }, 20000);
})();
