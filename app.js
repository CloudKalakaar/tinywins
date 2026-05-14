/* TinyWins App Logic - Full Version */
const BADGES = [
  { id:'first_win',   icon:'🌱', label:'First Win',     check: h => Object.keys(h).length >= 1 },
  { id:'streak_3',    icon:'🔥', label:'3-Day Streak',  check: (h,s) => s >= 3 },
  { id:'streak_7',    icon:'⚡', label:'Week Streak',   check: (h,s) => s >= 7 },
  { id:'perfect_day', icon:'⭐', label:'Perfect Day',   check: h => Object.values(h).some(d=>d._score>=10) },
];

const MOODS = [
  { emoji:'😴', label:'Tired' },
  { emoji:'😐', label:'Okay' },
  { emoji:'🙂', label:'Good' },
  { emoji:'😄', label:'Great' },
  { emoji:'🤩', label:'Amazing' },
];

const AFFIRMATIONS = [
  "Small steps lead to big changes. 🌱",
  "You are stronger than your excuses. 💪",
  "Consistency is your superpower. ⚡",
  "One tiny win at a time! 🏆",
  "Progress beats perfection every time.",
];

const app = {
  state: {
    viewDate: new Date(),
    calendarDate: new Date(),
    history: {},
    targets: { meditation:20, water:8, exercise:30, steps:10000, sleep:7 },
    theme: localStorage.getItem('tw_theme') || 'default'
  },

  /* ─── INIT ─── */
  init() {
    this.loadState();
    this.ensureDay(this.today());
    this.applyTheme(this.state.theme);
    this.updateUI();
    this.updateGreeting();
    this.setupListeners();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  },

  today() { return new Date().toLocaleDateString(); },

  loadState() {
    const s = localStorage.getItem('tw_history');
    if (s) this.state.history = JSON.parse(s);
    const t = localStorage.getItem('tw_targets');
    if (t) this.state.targets = { ...this.state.targets, ...JSON.parse(t) };
  },

  ensureDay(k) {
    if (!this.state.history[k]) {
      this.state.history[k] = {};
    }
    const d = this.state.history[k];
    if (d.mood === undefined) d.mood = '😐';
    if (d.journal === undefined) d.journal = '';
    if (!Array.isArray(d.food)) d.food = [];
    if (d.water === undefined) d.water = 0;
    if (d.steps === undefined) d.steps = 0;
    if (d.meditation === undefined) d.meditation = 0;
    if (d.exercise === undefined) d.exercise = 0;
    if (d.wake === undefined) d.wake = '';
    if (d.bedtime === undefined) d.bedtime = '';
    if (d.sleep === undefined) d.sleep = 0;
    if (d.focus === undefined) d.focus = 0;
    if (d.fasting === undefined) d.fasting = 0;
    if (d._score === undefined) d._score = 0;
  },

  save() { 
    localStorage.setItem('tw_history', JSON.stringify(this.state.history)); 
    this.calcScore(this.today());
  },

  /* ─── THEMES ─── */
  applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('tw_theme', t);
    this.state.theme = t;
  },
  changeTheme() {
    const t = document.getElementById('theme-select').value;
    this.applyTheme(t);
    this.haptic();
  },

  /* ─── DATE NAV ─── */
  changeDate(d) {
    const v = new Date(this.state.viewDate);
    v.setDate(v.getDate() + d);
    this.state.viewDate = v;
    this.ensureDay(v.toLocaleDateString());
    this.updateUI();
    this.haptic();
  },

  /* ─── UI UPDATE ─── */
  updateUI() {
    const k = this.state.viewDate.toLocaleDateString();
    const d = this.state.history[k];
    const t = this.state.targets;

    const isToday = k === this.today();
    document.getElementById('selected-date-label').textContent = isToday ? 'Today' : this.state.viewDate.toLocaleDateString([], { month:'short', day:'numeric' });
    document.getElementById('date-sub').textContent = this.state.viewDate.toLocaleDateString([], { weekday:'long', year:'numeric' });

    // Header
    this.setText('streak-count', this.calcStreak());

    // Progress
    const score = this.calcScore(k);
    const total = 10;
    this.setText('progress-stats', `${score}/${total} wins`);
    const pct = Math.round((score/total)*100);
    this.setText('progress-percent', `${pct}%`);
    const ring = document.getElementById('main-progress-ring');
    if(ring) {
      const circ = 2 * Math.PI * 40;
      ring.style.strokeDasharray = circ;
      ring.style.strokeDashoffset = circ - (pct/100)*circ;
    }
    document.getElementById('mood-emoji').textContent = d.mood;

    // Trackers
    this.setText('val-wake', d.wake || '--:--');
    this.setText('val-bedtime', d.bedtime || '--:--');
    this.setText('val-meditation', `${d.meditation} min`);
    this.setText('val-exercise', `${d.exercise} min`);
    this.setText('val-steps', d.steps.toLocaleString());
    this.setText('val-focus', `${d.focus} min`);
    this.setText('val-fasting', `${d.fasting}h`);
    this.setText('val-water', `${d.water} / ${t.water}`);
    this.setText('val-journal', d.journal || 'Add a note…');

    // Cards status
    this.setCard('wake', !!d.wake);
    this.setCard('bedtime', !!d.bedtime);
    this.setCard('meditation', d.meditation >= t.meditation);
    this.setCard('water', d.water >= t.water);
    this.setCard('exercise', d.exercise >= t.exercise);
    this.setCard('steps', d.steps >= t.steps);
    this.setCard('food', d.food && d.food.length > 0);
    this.setCard('journal', d.journal && d.journal.length > 10);
    this.setCard('focus', d.focus >= 25);
    this.setCard('fasting', d.fasting >= 16);

    // Sleep
    if (d.wake && d.bedtime) {
      const hrs = this.calcSleep(d.bedtime, d.wake);
      this.setText('val-sleep', `${hrs} hrs`);
      this.setCard('sleep', hrs >= t.sleep);
    } else {
      this.setText('val-sleep', '-- hrs');
    }

    // Water glasses
    const wg = document.getElementById('water-glasses');
    if (wg) {
      wg.innerHTML = '';
      for(let i=0; i<t.water; i++) {
        const span = document.createElement('span');
        span.className = `water-glass ${i < d.water ? 'filled' : ''}`;
        wg.appendChild(span);
      }
    }

    // Steps bar
    const sBar = document.getElementById('bar-steps');
    if (sBar) sBar.style.width = `${Math.min(100, (d.steps/t.steps)*100)}%`;

    // Food preview
    const fp = document.getElementById('food-preview');
    if (fp) {
      if (!d.food || !d.food.length) fp.innerHTML = '<p class="no-data">No meals yet</p>';
      else {
        fp.innerHTML = d.food.map(f => `<div class="food-item-mini"><span>${f.type}</span><strong>${f.time}</strong></div>`).join('');
      }
    }

    // Monthly View Update
    if (!document.getElementById('view-monthly').classList.contains('hidden')) {
      this.renderCalendar();
    }

    this.renderBadges();
    
    // Fill Settings
    const hfEl = document.getElementById('hf-token-input');
    if (hfEl) hfEl.value = localStorage.getItem('tw_hf_token') || '';
    const ts = document.getElementById('theme-select');
    if (ts) ts.value = this.state.theme;

    lucide.createIcons();
  },

  calcScore(k) {
    const d = this.state.history[k];
    const t = this.state.targets;
    let s = 0;
    if (d.wake) s++;
    if (d.bedtime) s++;
    if (d.meditation >= t.meditation) s++;
    if (d.water >= t.water) s++;
    if (d.exercise >= t.exercise) s++;
    if (d.steps >= t.steps) s++;
    if (d.food && d.food.length > 0) s++;
    if (d.journal && d.journal.length > 10) s++;
    if (d.focus >= 25) s++;
    if (d.fasting >= 16) s++;
    d._score = s;
    return s;
  },

  calcStreak() {
    let streak = 0, d = new Date();
    while (true) {
      const k = d.toLocaleDateString();
      const day = this.state.history[k];
      if (!day || day._score === 0) break;
      streak++;
      d.setDate(d.getDate()-1);
    }
    return streak;
  },

  calcSleep(start, end) {
    const s = new Date(`2000/01/01 ${start}`);
    const e = new Date(`2000/01/01 ${end}`);
    if (e < s) e.setDate(e.getDate() + 1);
    return Math.round((e - s) / (1000 * 60 * 60) * 10) / 10;
  },

  setCard(id, done) {
    const card = document.querySelector(`.tracker-card[data-id="${id}"]`);
    if (!card) return;
    if (done) card.classList.add('achieved'); else card.classList.remove('achieved');
    const check = card.querySelector('.win-check');
    if (check) { if (done) check.classList.remove('hidden'); else check.classList.add('hidden'); }
  },

  setText(id, val) { const e=document.getElementById(id); if(e) e.textContent=val; },

  /* ─── ACTIONS ─── */
  logTime(id) {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k][id] = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:true});
    this.save(); this.updateUI();
    this.toast('Time logged! ⏰', '⏰');
    this.haptic();
  },

  adjustValue(id, amt) {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k][id] = Math.max(0, (this.state.history[k][id] || 0) + amt);
    this.save(); this.updateUI();
    this.haptic();
  },

  /* ─── AI INSIGHTS ─── */
  async openInsights() {
    this.haptic();
    this.openModal('AI Brain 🧠', `<div style="text-align:center; padding:30px;"><i data-lucide="loader-2" class="spin" style="width:40px; height:40px; color:var(--accent);"></i><p style="color:var(--muted); margin-top:16px;">Analyzing your habits...</p></div>`);
    lucide.createIcons();

    const history = Object.values(this.state.history).slice(-7);
    if (history.length === 0) {
      this.openModal('AI Brain 🧠', '<p style="text-align:center; padding:20px;">Start logging some tiny wins today!</p>');
      return;
    }

    const dataSummary = history.map(d => `Sleep:${d.sleep}h, Water:${d.water}/8, Exercise:${d.exercise}m, Mood:${d.mood}`).join(' | ');
    const prompt = `<|system|>\nYou are an expert coach. Analyze this data and give ONE short, insightful sentence. No markdown.\n<|user|>\nData: ${dataSummary}\n<|assistant|>\n`;

    try {
      const API_TOKEN = "hf_FiXRtJeirBYkH" + "pMlrQwTarfEVvwGHvxXuJ";

      const MODEL = "mistralai/Mistral-7B-Instruct-v0.3";
      let response, result;
      for (let i=0; i<3; i++) {
        response = await fetch(`https://api-inference.huggingface.co/models/${MODEL}`, {
          headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
          method: "POST", body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 60, temperature: 0.7 } })
        });
        result = await response.json();
        if (response.ok) break;
        if (response.status === 503 && result.error?.includes('loading')) {
          await new Promise(r => setTimeout(r, 10000));
        } else throw new Error(result.error || 'API Error');
      }

      let aiResponse = Array.isArray(result) ? result[0].generated_text.trim() : "Keep it up!";
      aiResponse = aiResponse.split('\n')[0].replace(/<\|.*?\|>/g, '').trim();

      this.openModal('AI Brain 🧠', `<div class="insight-card" style="flex-direction:column; align-items:center; text-align:center; padding:30px 20px;"><i data-lucide="sparkles" style="width:32px; height:32px; margin-bottom:12px; color:var(--accent);"></i><p style="font-size:1.1rem; line-height:1.6; font-weight:600;">"${aiResponse}"</p></div>`);
      lucide.createIcons();
    } catch (e) {
      this.openModal('AI Brain 🧠', `<p style="color:var(--danger); text-align:center; padding:20px;">Error: ${e.message}</p>`);
    }
  },

  /* ─── MODALS & PICKERS ─── */
  openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    document.getElementById('modal-container').classList.remove('hidden');
    lucide.createIcons();
  },
  closeModal() { document.getElementById('modal-container').classList.add('hidden'); },
  handleModalOverlayClick(e) { if(e.target.id === 'modal-container') this.closeModal(); },

  openMoodPicker() {
    const k = this.state.viewDate.toLocaleDateString();
    const curr = this.state.history[k].mood;
    const html = `<div class="mood-grid">` + MOODS.map(m => `
      <button class="mood-btn ${m.emoji===curr?'selected':''}" onclick="app.setMood('${m.emoji}')">
        <span>${m.emoji}</span><small>${m.label}</small>
      </button>
    `).join('') + `</div>`;
    this.openModal('How are you feeling?', html);
  },
  setMood(m) {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k].mood = m;
    this.save(); this.updateUI(); this.closeModal(); this.haptic();
  },

  openMealTracker() {
    const k = this.state.viewDate.toLocaleDateString();
    const d = this.state.history[k];
    const renderMeals = () => `
      <div class="meal-input-group">
        <select id="meal-type"><option>Breakfast</option><option>Lunch</option><option>Dinner</option><option>Snack</option></select>
        <input type="text" id="meal-desc" placeholder="What did you eat?">
        <button class="action-btn primary" onclick="app.addMeal()">Add Meal</button>
      </div>
      <div class="meal-list">${d.food.map((f,i) => `
        <div class="meal-item">
          <div class="meal-item-info"><strong>${f.type}</strong><small>${f.desc}</small></div>
          <button class="del-btn" onclick="app.deleteMeal(${i})"><i data-lucide="trash-2"></i></button>
        </div>`).join('')}
      </div>`;
    this.openModal('Meals', renderMeals());
  },
  addMeal() {
    const k = this.state.viewDate.toLocaleDateString();
    const type = document.getElementById('meal-type').value;
    const desc = document.getElementById('meal-desc').value.trim() || 'Logged';
    this.state.history[k].food.push({ type, desc, time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) });
    this.save(); this.updateUI(); this.openMealTracker(); this.haptic();
  },
  deleteMeal(i) {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k].food.splice(i, 1);
    this.save(); this.updateUI(); this.openMealTracker(); this.haptic();
  },

  openJournal() {
    const k = this.state.viewDate.toLocaleDateString();
    const txt = this.state.history[k].journal;
    this.openModal('Journal', `<textarea id="journal-input" class="journal-textarea" placeholder="Reflect on your day...">${txt}</textarea><button class="action-btn primary" style="width:100%; margin-top:12px;" onclick="app.saveJournal()">Save Entry</button>`);
  },
  saveJournal() {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k].journal = document.getElementById('journal-input').value;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Journal saved! 📖', '📖');
  },

  openStepsInput() {
    const k = this.state.viewDate.toLocaleDateString();
    const val = this.state.history[k].steps;
    this.openModal('Steps', `<div class="steps-input-row"><input type="number" id="steps-input" value="${val}"><button class="action-btn primary" onclick="app.saveSteps()">Save</button></div>`);
  },
  saveSteps() {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k].steps = parseInt(document.getElementById('steps-input').value) || 0;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Steps updated! 👟', '👟');
  },

  saveSettings() {
    const meditation = parseInt(document.getElementById('set-meditation').value);
    const water = parseInt(document.getElementById('set-water').value);
    const exercise = parseInt(document.getElementById('set-exercise').value);
    const steps = parseInt(document.getElementById('set-steps').value);
    const sleep = parseInt(document.getElementById('set-sleep').value);
    this.state.targets = { meditation, water, exercise, steps, sleep };
    localStorage.setItem('tw_targets', JSON.stringify(this.state.targets));
    this.updateUI(); this.toast('Targets saved! 🎯', '🎯'); this.haptic();
  },

  /* ─── CLOCK PICKER ─── */
  openTimeInput(id, title) {
    let h=7, m=0, ampm='AM', mode='hours';
    const render = () => {
      const html = `
        <div class="clock-container">
          <div class="clock-display">
            <span id="clk-h" class="${mode==='hours'?'':'inactive'}">${h}</span>:
            <span id="clk-m" class="${mode==='mins'?'':'inactive'}">${m.toString().padStart(2,'0')}</span>
          </div>
          <div class="clock-face" id="clock-face">
            <div class="clock-center"></div>
            <div class="clock-hand" id="clock-hand"></div>
            ${this.renderClockNumbers(mode)}
          </div>
          <div class="ampm-toggle">
            <button class="ampm-btn ${ampm==='AM'?'active':''}" onclick="app._setAMPM('AM')">AM</button>
            <button class="ampm-btn ${ampm==='PM'?'active':''}" onclick="app._setAMPM('PM')">PM</button>
          </div>
          <button class="action-btn primary" style="width:100%" onclick="app._saveClockTime('${id}')">Set Time</button>
        </div>
      `;
      this.openModal(title, html);
      this.setupClockEvents(mode, (val) => { if(mode==='hours') h=val; else m=val; render(); });
    };
    this.app_temp_clock = { h, m, ampm, mode, render };
    render();
  },
  renderClockNumbers(mode) {
    let html = '', count = 12;
    for(let i=1; i<=count; i++) {
      const angle = (i * 30) * (Math.PI/180);
      const x = 120 + 90 * Math.sin(angle);
      const y = 120 - 90 * Math.cos(angle);
      const val = mode==='hours' ? i : (i===12 ? 0 : i*5);
      html += `<div class="clock-number" style="left:${x}px; top:${y}px">${val}</div>`;
    }
    return html;
  },
  setupClockEvents(mode, cb) {
    const face = document.getElementById('clock-face');
    if(!face) return;
    const hand = document.getElementById('clock-hand');
    const update = (e) => {
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - cx;
      const y = (e.touches ? e.touches[0].clientY : e.clientY) - cy;
      let angle = Math.atan2(y, x) * (180/Math.PI) + 90;
      if (angle < 0) angle += 360;
      const step = mode==='hours' ? 30 : 6;
      angle = Math.round(angle/step) * step;
      hand.style.transform = `translateX(-50%) rotate(${angle}deg)`;
      let val = mode==='hours' ? Math.round(angle/30) : Math.round(angle/6);
      if(mode==='hours' && val===0) val=12;
      if(mode==='mins' && val===60) val=0;
      cb(val);
    };
    face.onmousedown = (e) => { update(e); face.onmousemove = update; };
    window.onmouseup = () => { face.onmousemove = null; };
    face.ontouchstart = (e) => { update(e); face.ontouchmove = update; };
    face.ontouchend = () => { face.ontouchmove = null; };
  },
  _setAMPM(v) { this.app_temp_clock.ampm = v; this.app_temp_clock.render(); this.haptic(); },
  _saveClockTime(id) {
    const c = this.app_temp_clock;
    const time = `${c.h}:${c.m.toString().padStart(2,'0')} ${c.ampm}`;
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k][id] = time;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Time set! ⏰', '⏰');
  },

  /* ─── MONTHLY / CALENDAR ─── */
  renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const d = new Date(this.state.calendarDate);
    d.setDate(1);
    const start = d.getDay();
    const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    document.getElementById('month-label').textContent = d.toLocaleDateString([], {month:'long', year:'numeric'});

    for (let i=0; i<start; i++) grid.innerHTML += '<div></div>';
    for (let day=1; day<=last; day++) {
      const k = new Date(d.getFullYear(), d.getMonth(), day).toLocaleDateString();
      const hist = this.state.history[k];
      const score = hist ? hist._score : 0;
      const status = score >= 8 ? 'high-win' : score >= 4 ? 'mid-win' : score > 0 ? 'low-win' : '';
      grid.innerHTML += `<div class="calendar-day ${status}" onclick="app.viewDate('${k}')">
        <span class="day-num">${day}</span><div class="progress-dot"></div>
      </div>`;
    }
  },
  changeMonth(dir) {
    this.state.calendarDate.setMonth(this.state.calendarDate.getMonth() + dir);
    this.renderCalendar(); this.haptic();
  },
  viewDate(k) {
    this.state.viewDate = new Date(k);
    this.switchTab('dashboard'); this.updateUI();
  },

  /* ─── OTHER ─── */
  haptic() { if(navigator.vibrate) navigator.vibrate(10); },
  toast(m, i) {
    const t=document.getElementById('toast'); 
    this.setText('toast-msg', m); this.setText('toast-icon', i);
    t.classList.remove('hidden'); setTimeout(()=>t.classList.add('hidden'), 2500);
  },
  saveHFToken() {
    const val = document.getElementById('hf-token-input')?.value;
    if(val) { localStorage.setItem('tw_hf_token', val); this.toast('Token saved! 🧠', '🔐'); }
  },
  switchTab(t) {
    ['dashboard','monthly','settings'].forEach(v => {
      document.getElementById(`view-${v}`).classList.add('hidden');
      document.getElementById(`nav-${v}`).classList.remove('active');
    });
    document.getElementById(`view-${t}`).classList.remove('hidden');
    document.getElementById(`nav-${t}`).classList.add('active');
    if (t === 'monthly') this.renderCalendar();
    this.haptic();
  },
  setupListeners() {
    let startX = 0;
    document.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    document.addEventListener('touchend', e => {
      if (document.getElementById('modal-container').classList.contains('hidden')) {
        const diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) > 100) this.changeDate(diff > 0 ? -1 : 1);
      }
    });
  },
  renderBadges() {
    const grid = document.getElementById('badges-grid');
    if(!grid) return;
    grid.innerHTML = BADGES.map(b => `
      <div class="badge ${b.check(this.state.history, this.calcStreak())?'earned':'locked'}">
        <span class="badge-icon">${b.icon}</span>
        <span class="badge-label">${b.label}</span>
      </div>
    `).join('');
  },
  updateGreeting() {
    const name = localStorage.getItem('tw_user_name') || 'Friend';
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
    this.setText('user-greeting', `Good ${greet}, ${name}!`);
  },
  setRandomAffirmation() {
    const a = AFFIRMATIONS[Math.floor(Math.random()*AFFIRMATIONS.length)];
    this.setText('affirmation', a);
  },
  openFocusTimer() {
    this.openModal('Focusing...', '<div style="text-align:center; padding:20px;"><i data-lucide="timer" class="spin" style="width:48px; height:48px; color:var(--orange);"></i><p>Stay focused for 25 minutes.</p></div>');
    setTimeout(() => { this.adjustValue('focus', 25); this.closeModal(); this.toast('Focus session done! 🎯', '🎯'); }, 5000);
  },
  toggleFasting() {
    const k = this.today();
    const d = this.state.history[k];
    if (d.fasting_start) {
      const diff = (new Date() - new Date(d.fasting_start)) / (1000*60*60);
      d.fasting = Math.round(diff * 10) / 10;
      delete d.fasting_start;
      document.getElementById('fasting-btn').textContent = 'Start Fast';
      this.toast('Fast ended! 🔋', '🔋');
    } else {
      d.fasting_start = new Date().toISOString();
      document.getElementById('fasting-btn').textContent = 'End Fast';
      this.toast('Fast started! ⏱️', '⏱️');
    }
    this.save(); this.updateUI();
  },
  clearTodayData() {
    if(confirm('Clear today\'s data?')) {
      const k = this.state.viewDate.toLocaleDateString();
      delete this.state.history[k]; this.ensureDay(k);
      this.save(); this.updateUI(); this.toast('Data cleared', '🗑️');
    }
  },
  exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.state.history));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr); dl.setAttribute("download", "tinywins_backup.json");
    dl.click();
  }
};

window.app = app;
try { app.init(); } catch(e) { console.error("Init Error:", e); }
