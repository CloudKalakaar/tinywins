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
    this.initNotifications();
    this.checkAuth();
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
    if (d.fasting === undefined || typeof d.fasting !== 'number') d.fasting = 0;
    if (d.focus === undefined || typeof d.focus !== 'number') d.focus = 0;
    if (d.water === undefined || typeof d.water !== 'number') d.water = 0;
    if (d.meditation === undefined || typeof d.meditation !== 'number') d.meditation = 0;
    if (d.exercise === undefined || typeof d.exercise !== 'number') d.exercise = 0;
    if (d.steps === undefined || typeof d.steps !== 'number') d.steps = 0;
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

    // Fasting button state
    let fastActive = false;
    for(let date in this.state.history) {
      if(this.state.history[date].fasting_start) {
        fastActive = true; break;
      }
    }
    const fBtn = document.getElementById('fasting-btn');
    if(fBtn) fBtn.textContent = fastActive ? 'End Fast' : 'Start Fast';

    this.renderBadges();
    
    // Fill Settings
    const ts = document.getElementById('theme-select');
    if (ts) ts.value = this.state.theme;

    const gfc = document.getElementById('gf-client-id');
    if (gfc) gfc.value = localStorage.getItem('tw_gf_client_id') || '';
    const gfs = document.getElementById('gf-status-text');
    if (gfs) gfs.textContent = localStorage.getItem('tw_gf_token') ? 'Connected' : 'Not connected';

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
      const API_TOKEN = "gsk_Ps7AouVDgKZK5FVx" + "pOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI";
      const MODEL = "llama-3.3-70b-versatile";

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: "You are a sharp, motivating personal coach. Based on the user's 7-day habit data, give exactly ONE powerful, personalized insight or action tip. Be specific, not generic. Max 2 sentences. No markdown, no bullet points." },
            { role: "user", content: `My last 7 days: ${dataSummary}` }
          ],
          max_tokens: 80,
          temperature: 0.75
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'API Error');
      const aiResponse = result.choices?.[0]?.message?.content?.trim() || "Keep winning!";

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
        <select id="meal-type" class="glass-input">
          <option>🍳 Breakfast</option>
          <option>🍱 Lunch</option>
          <option>🍽️ Dinner</option>
          <option>🍎 Snack</option>
        </select>
        <input type="text" id="meal-desc" class="glass-input" placeholder="What did you eat?">
        <button class="action-btn primary" onclick="app.addMeal()">Add Meal</button>
      </div>
      <div class="meal-list">${d.food.map((f,i) => `
        <div class="meal-item glass">
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
    this.openModal('Journal', `<textarea id="journal-input" class="glass-input journal-textarea" placeholder="Reflect on your day...">${txt}</textarea><button class="action-btn primary" style="width:100%; margin-top:12px;" onclick="app.saveJournal()">Save Entry</button>`);
  },
  saveJournal() {
    const k = this.state.viewDate.toLocaleDateString();
    this.state.history[k].journal = document.getElementById('journal-input').value;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Journal saved! 📖', '📖');
  },

  openStepsInput() {
    const k = this.state.viewDate.toLocaleDateString();
    const val = this.state.history[k].steps;
    this.openModal('Steps', `<div class="meal-input-group"><input type="number" id="steps-input" class="glass-input" value="${val}" placeholder="Enter steps count..."><button class="action-btn primary" onclick="app.saveSteps()">Save Steps</button></div>`);
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

    // Try to pre-fill
    let existing = '';
    if (id.startsWith('notif-')) {
      existing = localStorage.getItem('tw_' + id.replace(/-/g, '_')) || '';
    } else {
      const k = this.state.viewDate.toLocaleDateString();
      existing = this.state.history[k][id] || '';
    }

    if (existing) {
      if (existing.includes(' ')) { // 07:30 AM format
        const [time, ap] = existing.split(' ');
        const [hh, mm] = time.split(':').map(Number);
        h = hh; m = mm; ampm = ap;
      } else { // 24h format 19:30
        const [hh, mm] = existing.split(':').map(Number);
        h = hh > 12 ? hh - 12 : (hh === 0 ? 12 : hh);
        ampm = hh >= 12 ? 'PM' : 'AM';
        m = mm;
      }
    }

    const html = `
      <div class="clock-container">
        <div class="clock-display">
          <span id="clk-h" class="active" onclick="app._switchClockMode('hours')">${h}</span>:
          <span id="clk-m" class="inactive" onclick="app._switchClockMode('mins')">${m.toString().padStart(2,'0')}</span>
        </div>
        <div class="clock-face" id="clock-face">
          <div class="clock-center"></div>
          <div class="clock-hand" id="clock-hand"></div>
          <div id="clock-numbers"></div>
        </div>
        <div class="ampm-toggle">
          <button id="ampm-am" class="ampm-btn active" onclick="app._setAMPM('AM')">AM</button>
          <button id="ampm-pm" class="ampm-btn" onclick="app._setAMPM('PM')">PM</button>
        </div>
        <button class="action-btn primary" style="width:100%" onclick="app._saveClockTime('${id}')">Set Time</button>
      </div>
    `;
    this.openModal(title, html);
    this.app_temp_clock = { h, m, ampm, mode, id };
    this._renderClockFace();
    this.setupClockEvents();
  },
  _renderClockFace() {
    const c = this.app_temp_clock;
    const numContainer = document.getElementById('clock-numbers');
    const hand = document.getElementById('clock-hand');
    const hDisp = document.getElementById('clk-h');
    const mDisp = document.getElementById('clk-m');
    if(!numContainer) return;

    hDisp.className = c.mode === 'hours' ? 'active' : 'inactive';
    mDisp.className = c.mode === 'mins' ? 'active' : 'inactive';
    hDisp.textContent = c.h;
    mDisp.textContent = c.m.toString().padStart(2,'0');

    let html = '', count = 12;
    for(let i=1; i<=count; i++) {
      const angle = (i * 30) * (Math.PI/180);
      const x = 120 + 90 * Math.sin(angle);
      const y = 120 - 90 * Math.cos(angle);
      const val = c.mode==='hours' ? i : (i===12 ? 0 : i*5);
      html += `<div class="clock-number" style="left:${x}px; top:${y}px">${val}</div>`;
    }
    numContainer.innerHTML = html;

    const angle = c.mode === 'hours' ? (c.h * 30) : (c.m * 6);
    hand.style.transform = `translateX(-50%) rotate(${angle}deg)`;
  },
  _switchClockMode(m) {
    this.app_temp_clock.mode = m;
    this._renderClockFace();
    this.haptic();
  },
  setupClockEvents() {
    const face = document.getElementById('clock-face');
    if(!face) return;
    const hand = document.getElementById('clock-hand');
    
    const update = (e) => {
      const c = this.app_temp_clock;
      const rect = face.getBoundingClientRect();
      const cx = rect.left + rect.width/2, cy = rect.top + rect.height/2;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const x = clientX - cx, y = clientY - cy;
      
      let angle = Math.atan2(y, x) * (180/Math.PI) + 90;
      if (angle < 0) angle += 360;
      
      const step = c.mode === 'hours' ? 30 : 6;
      angle = Math.round(angle/step) * step;
      hand.style.transform = `translateX(-50%) rotate(${angle}deg)`;
      
      let val = c.mode === 'hours' ? Math.round(angle/30) : Math.round(angle/6);
      if(c.mode === 'hours' && val === 0) val = 12;
      if(c.mode === 'mins' && val === 60) val = 0;
      
      if(c.mode === 'hours') {
        c.h = val;
        document.getElementById('clk-h').textContent = val;
      } else {
        c.m = val;
        document.getElementById('clk-m').textContent = val.toString().padStart(2,'0');
      }
    };

    const onEnd = () => {
      const c = this.app_temp_clock;
      document.removeEventListener('mousemove', update);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', update);
      document.removeEventListener('touchend', onEnd);
      
      if(c.mode === 'hours') {
        setTimeout(() => {
          c.mode = 'mins';
          this._renderClockFace();
        }, 300);
      }
    };

    face.addEventListener('mousedown', (e) => {
      update(e);
      document.addEventListener('mousemove', update);
      document.addEventListener('mouseup', onEnd);
    });
    face.addEventListener('touchstart', (e) => {
      update(e);
      document.addEventListener('touchmove', update);
      document.addEventListener('touchend', onEnd);
    }, {passive: false});
  },
  _setAMPM(v) {
    this.app_temp_clock.ampm = v;
    document.getElementById('ampm-am').classList.toggle('active', v==='AM');
    document.getElementById('ampm-pm').classList.toggle('active', v==='PM');
    this.haptic();
  },
  _saveClockTime(id) {
    const c = this.app_temp_clock;
    const timeWithAMPM = `${c.h}:${c.m.toString().padStart(2,'0')} ${c.ampm}`;
    
    if (id.startsWith('notif-')) {
      // Convert to 24h for notification logic
      let h24 = c.h;
      if (c.ampm === 'PM' && h24 < 12) h24 += 12;
      if (c.ampm === 'AM' && h24 === 12) h24 = 0;
      const time24 = `${h24.toString().padStart(2,'0')}:${c.m.toString().padStart(2,'0')}`;
      localStorage.setItem('tw_' + id.replace(/-/g, '_'), time24);
      this.updateNotifUI();
      this.scheduleAllNotifications();
      this.toast('Reminder time set! ⏰', '⏰');
    } else {
      const k = this.state.viewDate.toLocaleDateString();
      this.state.history[k][id] = timeWithAMPM;
      this.save(); this.updateUI();
      this.toast('Time set! ⏰', '⏰');
    }
    this.closeModal();
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

    // Update Monthly Stats
    this.updateMonthlyBreakdown(d.getFullYear(), d.getMonth(), last);
  },
  updateMonthlyBreakdown(year, month, lastDay) {
    const stats = { wake:0, sleep:0, meditation:0, water:0, exercise:0, steps:0 };
    let loggedDays = 0;
    const t = this.state.targets;

    for (let day=1; day<=lastDay; day++) {
      const k = new Date(year, month, day).toLocaleDateString();
      const h = this.state.history[k];
      if (h && h._score !== undefined) {
        loggedDays++;
        if (h.wake) stats.wake++;
        if (h.bedtime) stats.sleep++;
        if (h.meditation >= t.meditation) stats.meditation++;
        if (h.water >= t.water) stats.water++;
        if (h.exercise >= t.exercise) stats.exercise++;
        if (h.steps >= t.steps) stats.steps++;
      }
    }

    Object.keys(stats).forEach(key => {
      const pct = loggedDays ? Math.round((stats[key] / loggedDays) * 100) : 0;
      const bar = document.getElementById(`mhb-${key}`);
      const txt = document.getElementById(`mhp-${key}`);
      if (bar) bar.style.width = `${pct}%`;
      if (txt) txt.textContent = `${pct}%`;
    });
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
    if(this.focusInterval) {
      this.toast('Session already active', '⚠️'); return;
    }
    let sec = 25 * 60;
    const html = `
      <div style="text-align:center; padding:30px;">
        <div id="focus-countdown" style="font-size:3.5rem; font-weight:800; color:var(--orange); margin-bottom:15px;">25:00</div>
        <p id="focus-status">Stay focused. You got this!</p>
        <button class="action-btn danger-btn" style="margin-top:20px; width:100%" onclick="app.stopFocus()">Stop Session</button>
      </div>`;
    this.openModal('Focus Session', html);
    
    this.focusInterval = setInterval(() => {
      sec--;
      const m = Math.floor(sec/60), s = sec%60;
      const el = document.getElementById('focus-countdown');
      if(el) el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      
      if(sec <= 0) {
        this.stopFocus(true);
      }
    }, 1000);
  },
  stopFocus(completed = false) {
    clearInterval(this.focusInterval);
    this.focusInterval = null;
    this.closeModal();
    if(completed) {
      this.adjustValue('focus', 25);
      this.toast('Session complete! 🎯', '🎯');
    } else {
      this.toast('Session cancelled', '🛑');
    }
  },
  toggleFasting() {
    const k = this.today();
    const history = this.state.history;
    
    // Check if any day has an active fast
    let activeDay = null;
    for(let date in history) {
      if(history[date].fasting_start) {
        activeDay = date; break;
      }
    }

    if (activeDay) {
      const d = history[activeDay];
      const diff = (new Date() - new Date(d.fasting_start)) / (1000*60*60);
      const hours = Math.round(diff * 10) / 10;
      
      // Credit hours to the day it ended
      history[k].fasting = (history[k].fasting || 0) + hours;
      delete d.fasting_start;
      
      document.getElementById('fasting-btn').textContent = 'Start Fast';
      this.toast(`Fast ended: ${hours}h 🔋`, '🔋');
    } else {
      history[k].fasting_start = new Date().toISOString();
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
  },

  /* ─── NOTIFICATIONS ─── */
  initNotifications() {
    this._notifTimers = [];
    this.updateNotifUI();
    if (Notification.permission === 'granted' && localStorage.getItem('tw_notif_enabled') === 'true') {
      this.scheduleAllNotifications();
    }
    // Pre-fill saved times
    const nm = document.getElementById('notif-morning');
    const ne = document.getElementById('notif-evening');
    const nw = document.getElementById('notif-water');
    if (nm) nm.value = localStorage.getItem('tw_notif_morning') || '07:30';
    if (ne) ne.value = localStorage.getItem('tw_notif_evening') || '21:00';
    if (nw) nw.value = localStorage.getItem('tw_notif_water') || '2';
  },
  async enableNotifications() {
    if (!('Notification' in window)) {
      this.toast('Browser does not support notifications', '❌'); return;
    }
    
    if (window.location.protocol === 'file:') {
      this.toast('Notifications require a local server (like Live Server) or HTTPS', '⚠️');
      // Continue anyway, but warn
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('tw_notif_enabled', 'true');
        this.scheduleAllNotifications();
        this.updateNotifUI();
        this.toast('Notifications enabled! 🔔', '🔔');
        this._showNotif('TinyWins', 'Reminders are now active! 💪');
      } else {
        this.toast(`Permission ${perm} — check browser settings`, '❌');
      }
    } catch (e) {
      this.toast('Browser blocked notification prompt', '❌');
      console.error(e);
    }
    this.updateNotifUI();
  },
  disableNotifications() {
    localStorage.setItem('tw_notif_enabled', 'false');
    if (this._notifTimers) this._notifTimers.forEach(id => clearTimeout(id));
    this._notifTimers = [];
    this.toast('Reminders disabled 🔕', '🔕');
    this.updateNotifUI();
  },
  updateNotifUI() {
    const el = document.getElementById('notif-status');
    if (!el) return;
    const enabled = localStorage.getItem('tw_notif_enabled') === 'true';
    const granted = Notification.permission === 'granted';
    
    if (enabled && granted) {
      el.textContent = '✅ Active'; el.style.color = 'var(--accent)';
    } else if (!('Notification' in window)) {
      el.textContent = '⚠️ Not supported'; el.style.color = 'var(--orange)';
    } else {
      el.textContent = '❌ Off'; el.style.color = 'var(--muted)';
    }

    // Update time buttons
    const m = localStorage.getItem('tw_notif_morning') || '07:30';
    const e = localStorage.getItem('tw_notif_evening') || '21:00';
    const mb = document.getElementById('notif-morning-display');
    const eb = document.getElementById('notif-evening-display');
    if (mb) mb.textContent = m;
    if (eb) eb.textContent = e;
  },
  scheduleAllNotifications() {
    if (this._notifTimers) this._notifTimers.forEach(id => clearTimeout(id));
    this._notifTimers = [];
    if (localStorage.getItem('tw_notif_enabled') !== 'true') return;
    const morning = localStorage.getItem('tw_notif_morning') || '07:30';
    const evening = localStorage.getItem('tw_notif_evening') || '21:00';
    const waterHrs = parseInt(localStorage.getItem('tw_notif_water') || '2');
    this._scheduleAt(morning, '☀️ Good Morning, Murali!', 'Start your tiny wins! Log your wake time and set your mood for today.');
    this._scheduleAt(evening, '🌙 Evening Check-in', 'How was today? Log your meals, journal thoughts, and mood before you sleep.');
    const waterMs = waterHrs * 60 * 60 * 1000;
    const wid = setInterval(() => {
      this._showNotif('💧 Hydration Time!', `Drink a glass of water! You're crushing it today. 💪`);
    }, waterMs);
    this._notifTimers.push(wid);
  },
  _scheduleAt(timeStr, title, body) {
    const [h, m] = timeStr.split(':').map(Number);
    const now = new Date(), next = new Date();
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const id = setTimeout(() => {
      this._showNotif(title, body);
      this._scheduleAt(timeStr, title, body);
    }, next - now);
    this._notifTimers.push(id);
  },
  _showNotif(title, body) {
    if (Notification.permission !== 'granted') return;
    
    const options = {
      body, vibrate: [200, 100, 200],
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: title, renotify: true
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  },
  sendTestNotification() {
    if (Notification.permission !== 'granted') {
      this.toast('Please Enable notifications first', '⚠️');
    } else {
      this._showNotif('🔔 Test Notification', 'It works! TinyWins is ready to nudge you. 🚀');
    }
  },
  saveNotifSettings() {
    const m = document.getElementById('notif-morning')?.value;
    const e = document.getElementById('notif-evening')?.value;
    const w = document.getElementById('notif-water')?.value;
    if (m) localStorage.setItem('tw_notif_morning', m);
    if (e) localStorage.setItem('tw_notif_evening', e);
    if (w) localStorage.setItem('tw_notif_water', w);
    this.scheduleAllNotifications();
    this.toast('Reminder times saved! ⏰', '⏰');
  },
  /* ─── GOOGLE FIT SYNC ─── */
  saveGFSettings() {
    const id = document.getElementById('gf-client-id').value.trim();
    if (id) {
      localStorage.setItem('tw_gf_client_id', id);
      this.authGoogleFit();
    }
  },
  authGoogleFit() {
    const clientId = localStorage.getItem('tw_gf_client_id');
    if (!clientId) { this.toast('Set Client ID first', '⚠️'); return; }
    
    const scope = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.sleep.read';
    const redirect = window.location.origin + window.location.pathname;
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirect)}&response_type=token&scope=${encodeURIComponent(scope)}`;
    
    window.location.assign(authUrl);
  },
  checkAuth() {
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('tw_gf_token', token);
        window.location.hash = ''; // Clear token from URL
        this.toast('Google Fit connected! 🏃', '🏃');
        this.syncGoogleFit();
      }
    }
  },
  async syncGoogleFit() {
    const token = localStorage.getItem('tw_gf_token');
    if (!token) { this.authGoogleFit(); return; }

    this.toast('Syncing with Google Fit...', '🔄');
    const now = new Date().getTime();
    const startTime = now - (24 * 60 * 60 * 1000); // Last 24h

    try {
      // 1. Fetch Steps
      const stepsData = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startTime,
          endTimeMillis: now
        })
      }).then(r => r.json());

      const steps = stepsData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;
      if (steps > 0) {
        const k = this.today();
        this.state.history[k].steps = steps;
        this.toast(`Synced ${steps} steps! 👟`, '👟');
      }

      // 2. Fetch Sleep
      const sleepData = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?activityType=72&startTime=${new Date(startTime).toISOString()}&endTime=${new Date(now).toISOString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.json());

      if (sleepData.session?.[0]) {
        const s = sleepData.session[0];
        const hrs = Math.round((s.endTimeMillis - s.startTimeMillis) / (1000 * 60 * 60) * 10) / 10;
        const k = this.today();
        this.state.history[k].sleep = hrs;
        
        // Try to set wake/bedtime
        const start = new Date(parseInt(s.startTimeMillis)).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const end = new Date(parseInt(s.endTimeMillis)).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        this.state.history[k].bedtime = start;
        this.state.history[k].wake = end;
      }

      this.save(); this.updateUI();
    } catch (err) {
      this.toast('Sync failed — token might be expired', '❌');
      localStorage.removeItem('tw_gf_token');
    }
  },
  openReminders() {
    this.switchTab('settings');
    setTimeout(() => {
      const el = document.getElementById('notif-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  },

  /* ─── HEALTH CONNECT GUIDES ─── */
  openHealthGuide(platform) {
    const guides = {
      googlefit: {
        title: '🏃 Google Fit / Health Connect',
        steps: [
          '1. Open <b>Health Connect</b> app on your Android phone.',
          '2. Go to <b>Data & Privacy → Steps / Sleep</b>.',
          '3. Note your daily step count and sleep hours.',
          '4. Come back here and manually update the <b>Steps</b> and <b>Sleep</b> trackers.',
          '💡 <em>Google Fit REST API integration coming soon for auto-sync!</em>'
        ],
        note: 'Health Connect web API is in early access — full auto-sync requires a native app.'
      },
      samsung: {
        title: '⌚ Samsung Health',
        steps: [
          '1. Open <b>Samsung Health</b> → tap your profile.',
          '2. Go to <b>Settings → Download Personal Data</b>.',
          '3. Export as a CSV or JSON file.',
          '4. Check your steps, sleep, and exercise values.',
          '5. Manually enter them here in TinyWins.',
          '💡 <em>Steps, sleep, and exercise can be entered via the tracker cards.</em>'
        ],
        note: 'Samsung does not expose a public API for web apps yet.'
      },
      apple: {
        title: '🍎 Apple Health',
        steps: [
          '1. Open <b>Health</b> app on your iPhone.',
          '2. Tap your profile photo → <b>Export Health Data</b>.',
          '3. Save the ZIP file and open <b>export.xml</b>.',
          '4. Look for HKQuantityTypeIdentifierStepCount and HKCategoryTypeIdentifierSleepAnalysis.',
          '5. Enter those values manually in TinyWins.',
          '💡 <em>Apple Health does not allow web app access — only native iOS apps.</em>'
        ],
        note: 'Apple Health requires iOS apps via HealthKit framework.'
      }
    };
    const g = guides[platform];
    const html = `
      <div style="padding:4px 0">
        <div style="margin-bottom:16px;">
          ${g.steps.map(s => `<div style="padding:10px 0; border-bottom:1px solid var(--border); font-size:0.88rem; line-height:1.5;">${s}</div>`).join('')}
        </div>
        <div style="background:rgba(62,207,142,0.08); border:1px solid rgba(62,207,142,0.2); border-radius:12px; padding:12px; font-size:0.8rem; color:var(--muted);">
          ℹ️ ${g.note}
        </div>
      </div>`;
    this.openModal(g.title, html);
  }
};

window.app = app;
try { app.init(); } catch(e) { console.error("Init Error:", e); }
