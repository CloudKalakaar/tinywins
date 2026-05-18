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
    targets: { meditation:20, water:8, exercise:30, steps:10000, sleep:7, calories:2000, focus:25 },
    profile: JSON.parse(localStorage.getItem('tw_profile') || 'null'),
    theme: localStorage.getItem('tw_theme') || 'default'
  },

  /* ─── INIT ─── */
  init() {
    this.loadState();
    
    // Onboarding Check
    if (!localStorage.getItem('tw_username')) {
      document.getElementById('onboarding').classList.remove('hidden');
    } else if (!this.state.profile) {
      document.getElementById('profile-upgrade').classList.remove('hidden');
    }

    this.ensureDay(this.today());
    this.applyTheme(this.state.theme);
    this.updateUI();
    this.updateGreeting();
    this.setupListeners();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(()=>{});
      // Listen for SW updates
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          const banner = document.getElementById('update-banner');
          if (banner) banner.style.display = 'block';
        }
        if (event.data && event.data.type === 'RELOAD') {
          window.location.reload(true);
        }
      });
    }
    this.initNotifications();
    this.checkAuth();
  },

  applyUpdate() {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'FORCE_REFRESH' });
    } else {
      window.location.reload(true);
    }
  },

  today() { return this.dateKey(new Date()); },
  dateKey(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  saveUserName() {
    const input = document.getElementById('user-name-input');
    const name = input.value.trim();
    if (!name) return;
    localStorage.setItem('tw_username', name);
    document.getElementById('onboarding').classList.add('hidden');
    
    // Immediately ask for profile if not set
    if (!this.state.profile) {
      document.getElementById('profile-upgrade').classList.remove('hidden');
    }

    this.updateGreeting();
    this.haptic();
    this.toast(`Welcome, ${name}! 🚀`, '🚀');
  },

  saveProfileUpgrade() {
    const age = parseInt(document.getElementById('upg-age').value);
    const height = parseInt(document.getElementById('upg-height').value);
    const weight = parseInt(document.getElementById('upg-weight').value);
    const gender = document.getElementById('upg-gender').value;
    const goal = document.getElementById('upg-goal').value;

    if(!age || !height || !weight) return this.toast('Please fill all fields', '⚠️');

    // Calculate BMR (Mifflin-St Jeor)
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += (gender === 'M') ? 5 : -161;
    
    // TDEE (Sedentary/Lightly active base)
    let tdee = bmr * 1.3;
    
    let targetCals = tdee;
    if(goal === 'fatloss') targetCals -= 200;
    else if(goal === 'muscle') targetCals += 200;
    
    targetCals = Math.max(1200, Math.round(targetCals)); // Safe minimum
    
    // Calculate Macros
    let protein = Math.round(weight * (goal==='muscle'?2.2 : goal==='fatloss'?2.0 : 1.8));
    let fats = Math.round(weight * 0.9); // 0.9g per kg
    let remainingCals = targetCals - ((protein * 4) + (fats * 9));
    let carbs = Math.max(50, Math.round(remainingCals / 4));
    
    targetCals = (protein * 4) + (fats * 9) + (carbs * 4); // Exact match

    this.state.profile = { age, gender, height, weight, goal, bmr, tdee, targetMacros: { p: protein, c: carbs, f: fats } };
    localStorage.setItem('tw_profile', JSON.stringify(this.state.profile));
    
    this.state.targets.calories = targetCals;
    localStorage.setItem('tw_targets', JSON.stringify(this.state.targets));
    
    document.getElementById('profile-upgrade').classList.add('hidden');
    this.toast('Profile updated & targets set! 🎯', '🎯');
    
    // Update input fields in settings if they exist
    const setCals = document.getElementById('set-calories');
    if (setCals) setCals.value = targetCals;
    
    this.updateUI();
  },

  loadState() {
    const s = localStorage.getItem('tw_history');
    if (s) {
      const rawHistory = JSON.parse(s);
      // Migration: Convert old locale-string keys to YYYY-MM-DD
      this.state.history = {};
      Object.keys(rawHistory).forEach(key => {
        let stableKey = key;
        if (key.includes('/') || key.includes('.') || key.includes(',')) {
          const d = new Date(key);
          if (!isNaN(d.getTime())) {
            stableKey = this.dateKey(d);
          }
        }
        this.state.history[stableKey] = rawHistory[key];
      });
    }
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
    if (!Array.isArray(d.workouts)) d.workouts = [];
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
    if (d.hobbies === undefined) d.hobbies = '';
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
    this.ensureDay(this.dateKey(v));
    this.updateUI();
    this.haptic();
  },

  /* ─── UI UPDATE ─── */
  updateUI() {
    const dateObj = this.state.viewDate;
    const k = this.dateKey(dateObj);
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
    const sleepHrs = this.calcSleepDuration(dateObj);
    d.sleep = sleepHrs; // Update current day's sleep state
    
    this.setText('val-wake', d.wake || '--:--');
    this.setText('val-bedtime', d.bedtime || '--:--');
    this.setText('val-sleep', sleepHrs > 0 ? `${sleepHrs} hrs` : '-- hrs');
    this.setText('val-meditation', `${d.meditation} min`);
    this.setText('val-exercise', `${d.exercise} min`);
    this.setText('val-steps', d.steps.toLocaleString());
    this.setText('val-focus', `${d.focus} min`);
    this.setText('val-fasting', `${d.fasting}h`);
    this.setText('val-water', `${d.water} / ${t.water}`);
    this.setText('val-journal', d.journal || 'Add a note…');
    this.setText('val-hobbies', d.hobbies || 'What did you enjoy today?');

    // Cards status
    this.setCard('wake', !!d.wake);
    this.setCard('bedtime', !!d.bedtime);
    this.setCard('meditation', d.meditation >= t.meditation);
    this.setCard('water', d.water >= t.water);
    this.setCard('exercise', d.exercise >= t.exercise);
    this.setCard('steps', d.steps >= t.steps);
    const mealCals = d.food.reduce((sum, f) => sum + (f.cals || 0), 0);
    const mealWin = Math.abs(mealCals - t.calories) <= 200;
    this.setText('val-food', mealCals > 0 ? `${mealCals} / ${t.calories} kcal` : 'Log meals');
    this.setCard('food', mealWin);
    this.setCard('journal', d.journal && d.journal.length > 10);
    this.setCard('focus', d.focus >= t.focus);
    this.setCard('hobbies', !!d.hobbies);

    // Sleep card status is now handled by the sleepHrs value above
    this.setCard('sleep', sleepHrs >= t.sleep);

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
        const totalP = d.food.reduce((sum, f) => sum + (f.protein || 0), 0);
        const totalC = d.food.reduce((sum, f) => sum + (f.carbs || 0), 0);
        const totalF = d.food.reduce((sum, f) => sum + (f.fats || 0), 0);

        const pTarget = this.state.profile ? this.state.profile.targetMacros.p : 0;
        const cTarget = this.state.profile ? this.state.profile.targetMacros.c : 0;
        const fTarget = this.state.profile ? this.state.profile.targetMacros.f : 0;

        const pDisplay = pTarget ? `<span style="font-size:0.85rem;">${totalP}g</span><span style="font-size:0.6rem; opacity:0.6; margin-top:1px;">/${pTarget}g</span>` : `<span style="font-size:0.85rem;">${totalP}g</span>`;
        const cDisplay = cTarget ? `<span style="font-size:0.85rem;">${totalC}g</span><span style="font-size:0.6rem; opacity:0.6; margin-top:1px;">/${cTarget}g</span>` : `<span style="font-size:0.85rem;">${totalC}g</span>`;
        const fDisplay = fTarget ? `<span style="font-size:0.85rem;">${totalF}g</span><span style="font-size:0.6rem; opacity:0.6; margin-top:1px;">/${fTarget}g</span>` : `<span style="font-size:0.85rem;">${totalF}g</span>`;

        const listHtml = d.food.map(f => `
          <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
              <span style="font-weight:600; font-size:0.85rem; color:var(--text);">${f.type}</span>
              <strong style="color:var(--orange); font-size:0.85rem;">${f.cals || 0} kcal</strong>
            </div>
            <div style="font-size:0.75rem; color:var(--muted); margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${f.desc}</div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; text-align:center; font-size:0.65rem; font-weight:700;">
              <div style="background:rgba(56,189,248,0.1); border-radius:4px; padding:3px 2px; display:flex; flex-direction:column; gap:1px;"><span style="color:#38bdf8; font-size:0.55rem;">PRO</span><span style="color:var(--text);">${f.protein||0}g</span></div>
              <div style="background:rgba(251,191,36,0.1); border-radius:4px; padding:3px 2px; display:flex; flex-direction:column; gap:1px;"><span style="color:#fbbf24; font-size:0.55rem;">CARB</span><span style="color:var(--text);">${f.carbs||0}g</span></div>
              <div style="background:rgba(248,113,113,0.1); border-radius:4px; padding:3px 2px; display:flex; flex-direction:column; gap:1px;"><span style="color:#f87171; font-size:0.55rem;">FAT</span><span style="color:var(--text);">${f.fats||0}g</span></div>
            </div>
          </div>`).join('');
        
        fp.innerHTML = listHtml + `
          <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; font-size:0.75rem; text-transform:uppercase; letter-spacing:1px; color:var(--muted);">Total</span>
              <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end;">
                <div style="color:var(--orange); line-height:1;">
                  <strong style="font-size:1.1rem; font-weight:900;">${mealCals}</strong>
                  <span style="font-size:0.8rem; opacity:0.8; font-weight:600;">/ ${t.calories}</span>
                </div>
                <small style="color:var(--orange); opacity:0.8; font-size:0.55rem; font-weight:800; text-transform:uppercase; letter-spacing:1px; margin-top:3px;">kcal</small>
              </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; text-align:center;">
              <div style="background:rgba(56,189,248,0.1); padding:6px 2px; border-radius:8px; display:flex; flex-direction:column; align-items:center; overflow:hidden;">
                <span style="color:#38bdf8; font-size:0.55rem; font-weight:800; margin-bottom:4px;">PRO</span>
                <span style="color:var(--text); font-weight:800; display:flex; flex-direction:column; align-items:center; line-height:1; word-break:break-all;">${pDisplay}</span>
              </div>
              <div style="background:rgba(251,191,36,0.1); padding:6px 2px; border-radius:8px; display:flex; flex-direction:column; align-items:center; overflow:hidden;">
                <span style="color:#fbbf24; font-size:0.55rem; font-weight:800; margin-bottom:4px;">CARB</span>
                <span style="color:var(--text); font-weight:800; display:flex; flex-direction:column; align-items:center; line-height:1; word-break:break-all;">${cDisplay}</span>
              </div>
              <div style="background:rgba(248,113,113,0.1); padding:6px 2px; border-radius:8px; display:flex; flex-direction:column; align-items:center; overflow:hidden;">
                <span style="color:#f87171; font-size:0.55rem; font-weight:800; margin-bottom:4px;">FAT</span>
                <span style="color:var(--text); font-weight:800; display:flex; flex-direction:column; align-items:center; line-height:1; word-break:break-all;">${fDisplay}</span>
              </div>
            </div>
          </div>`;
      }
    }

    // Exercise preview
    const ep = document.getElementById('exercise-preview');
    if (ep) {
      if (!d.workouts || !d.workouts.length) ep.innerHTML = '<p class="no-data">No workouts yet</p>';
      else {
        const totalMins = d.workouts.reduce((sum, w) => sum + (w.mins || 0), 0);
        const totalCals = d.workouts.reduce((sum, w) => sum + (w.cals || 0), 0);
        
        const listHtml = d.workouts.map(w => `
          <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:600; font-size:0.85rem; color:var(--text); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:8px;">${w.type}</span>
              <strong style="color:#3ecf8e; font-size:0.85rem; white-space:nowrap; flex-shrink:0;">${w.mins} min</strong>
            </div>
            <div style="font-size:0.7rem; color:var(--muted); margin-top:4px;">🔥 ${Math.round(w.cals)} kcal burnt</div>
          </div>`).join('');
        
        ep.innerHTML = listHtml + `
          <div style="margin-top:12px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.1); display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:800; font-size:0.8rem; text-transform:uppercase; letter-spacing:1px; color:var(--muted);">Total</span>
              <strong style="color:#3ecf8e; font-size:1.1rem; font-weight:900;">${totalMins} min</strong>
            </div>
            <div style="font-size:0.75rem; color:var(--orange); text-align:right; font-weight:700;">
              🔥 ${Math.round(totalCals)} kcal burnt
            </div>
          </div>`;
      }
    }

    // Monthly View Update
    if (!document.getElementById('view-monthly').classList.contains('hidden')) {
      this.renderCalendar();
    }

    this.renderBadges();
    
    // Fill Settings
    const ts = document.getElementById('theme-select');
    if (ts) ts.value = this.state.theme;

    const sc = document.getElementById('set-calories');
    if (sc) sc.value = t.calories || 2000;
    
    const sf = document.getElementById('set-focus');
    if (sf) sf.value = t.focus || 25;

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
    if (d.meditation >= t.meditation) s++;
    if (d.water >= t.water) s++;
    if (d.exercise >= t.exercise) s++;
    if (d.steps >= t.steps) s++;
    const mealCals = d.food.reduce((sum, f) => sum + (f.cals || 0), 0);
    const mealWin = Math.abs(mealCals - t.calories) <= 200;
    if (mealWin) s++;
    if (d.journal && d.journal.length > 10) s++;
    if (d.focus >= t.focus) s++;
    
    const sleepHrs = this.calcSleepDuration(new Date(k));
    if (sleepHrs >= t.sleep) s++;
    if (d.hobbies) s++;
    
    // Core 8 requested by user
    const core8 = [
      d.focus >= t.focus,
      sleepHrs >= t.sleep,
      d.meditation >= t.meditation,
      d.water >= t.water,
      d.exercise >= t.exercise,
      d.steps >= t.steps,
      mealWin,
      !!d.hobbies
    ];
    d._completed = core8.every(Boolean);
    d._score = s;
    return s;
  },

  calcStreak() {
    let streak = 0, d = new Date();
    while (true) {
      const k = this.dateKey(d);
      const day = this.state.history[k];
      if (!day || !day._completed) break;
      streak++;
      d.setDate(d.getDate()-1);
    }
    return streak;
  },

  calcSleepDuration(dateObj) {
    const k = this.dateKey(dateObj);
    const d = this.state.history[k];
    if (!d || !d.wake) return 0;

    const parseT = (t, baseDate) => {
      const [time, ap] = t.split(' ');
      let [h, m] = time.split(':').map(Number);
      if (ap === 'PM' && h < 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      const res = new Date(baseDate);
      res.setHours(h, m, 0, 0);
      return res;
    };

    try {
      const wDate = parseT(d.wake, dateObj);
      let bDate = null;

      if (d.bedtime) {
        const sameDayBed = parseT(d.bedtime, dateObj);
        if (sameDayBed < wDate) bDate = sameDayBed;
      }

      if (!bDate) {
        const prev = new Date(dateObj);
        prev.setDate(prev.getDate() - 1);
        const yk = this.dateKey(prev);
        const yd = this.state.history[yk];
        if (yd && yd.bedtime) {
          bDate = parseT(yd.bedtime, prev);
        }
      }

      if (!bDate) return 0;
      let diff = (wDate - bDate) / (1000 * 60 * 60);
      
      if (diff < 0) diff += 24;
      if (diff > 24) diff -= 24;
      
      return Math.round(diff * 10) / 10;
    } catch (e) {
      return 0;
    }
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
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k][id] = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:true});
    this.save(); this.updateUI();
    this.toast('Time logged! ⏰', '⏰');
    this.haptic();
  },

  adjustValue(id, amt) {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k][id] = Math.max(0, (this.state.history[k][id] || 0) + amt);
    this.save(); this.updateUI();
    this.haptic();
  },

  /* ─── AI BOOST ─── */
  async getAIBoost(type = 'motivation') {
    this.haptic();
    const name = localStorage.getItem('tw_username') || 'Me';
    const affEl = document.getElementById('affirmation');
    const originalText = affEl.textContent;
    
    affEl.textContent = type === 'joke' ? "✨ Cooking a joke..." : "⚡ Charging motivation...";
    affEl.style.opacity = "0.6";

    const aiHistory = JSON.parse(localStorage.getItem('tw_ai_boost_history') || '[]');
    
    if (type === 'joke') {
      prompt = `You are a hilariously witty Indian stand-up comedian. Tell ONE short, side-splittingly funny Indian-style joke, observational humor, or wordplay.
      Make it truly hilarious, relatable, and bold. Do NOT use any names.
      Avoid these previous jokes: ${aiHistory.slice(-10).join('|')}.
      RULES: Max 20 words. Be unique. NO markdown. Respond with ONLY the joke.`;
    } else {
      prompt = `You are a manifestation expert and spiritual life coach. Give ONE powerful, affirmative manifestation or an "I AM" statement. 
      It should be bold, certain, and highly motivational. 
      Avoid these previous quotes: ${aiHistory.slice(-10).join('|')}.
      RULES: Max 15 words. Be unique. NO markdown. Respond with ONLY the manifestation.`;
    }

    const API_TOKEN = "gsk_Ps7AouVDgKZK5FVx" + "pOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI";
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{role: "user", content: prompt}],
          temperature: 0.9, max_tokens: 50
        })
      }).then(r => r.json());

      let quote = resp.choices[0].message.content.trim().replace(/^"|"$/g, '');
      
      // Update history
      aiHistory.push(quote);
      if (aiHistory.length > 20) aiHistory.shift();
      localStorage.setItem('tw_ai_boost_history', JSON.stringify(aiHistory));

      affEl.textContent = quote;
      affEl.style.opacity = "1";
      this.toast('AI Boost received! ✨', '✨');
    } catch(e) {
      affEl.textContent = originalText;
      affEl.style.opacity = "1";
      this.toast('Brain is recharging...', '🔋');
    }
  },
  async openInsights() {
    this.haptic();
    this.openModal('AI Brain 🧠', `<div style="text-align:center; padding:30px;"><i data-lucide="loader-2" class="spin" style="width:40px; height:40px; color:var(--accent);"></i><p style="color:var(--muted); margin-top:16px;">Analyzing your habits...</p></div>`);
    lucide.createIcons();

    const history = Object.values(this.state.history).filter(d => d._score > 0).slice(-7);
    if (history.length === 0) {
      this.openModal('AI Brain 🧠', '<p style="text-align:center; padding:20px;">I\'m ready to help, but you haven\'t logged any habits yet! Log your first tiny win today and I\'ll give you some insights. 🌱</p>');
      return;
    }

    const targets = this.state.targets;
    const profileInfo = this.state.profile ? `User Profile: Age ${this.state.profile.age}, Gender ${this.state.profile.gender}, Goal: ${this.state.profile.goal}, TDEE: ${Math.round(this.state.profile.tdee)}.` : '';
    const dataSummary = history.map(d => {
      const meals = (d.food || []).map(f => `${f.type}:${f.desc}(${f.cals}cals, P:${f.protein}g, C:${f.carbs}g, F:${f.fats}g)`).join(', ');
      const workouts = (d.workouts || []).map(w => `${w.type}(${w.mins}m)`).join(', ');
      const journalText = d.journal ? `JournalSnippet:"${d.journal.slice(0, 80).replace(/\n/g, ' ')}"` : 'No journal';
      const hobbiesText = d.hobbies ? `Hobbies:"${d.hobbies}"` : 'No hobbies';
      return `Score:${d._score}/10, Sleep:${d.sleep}h (Wake:${d.wake || 'N/A'}, Bed:${d.bedtime || 'N/A'}), Water:${d.water}/${targets.water || 8}, Steps:${d.steps}/${targets.steps || 10000}, Exercise:${d.exercise}m (${workouts || 'none'}), Meditation:${d.meditation}m, Focus:${d.focus}m, Mood:${d.mood}, ${hobbiesText}, ${journalText}, Meals:[${meals}]`;
    }).join(' | ');

    const API_TOKEN = "gsk_Ps7AouVDgKZK5FVx" + "pOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI";
    
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `You are a sharp, motivating personal coach, habit expert, and lifestyle/nutrition guide. Analyze the user's holistic life patterns across sleep, steps, focus, meditation, mood, hobbies, and nutrition. ${profileInfo} Give exactly ONE powerful, personalized insight or coaching recommendation. Max 2-3 sentences. No markdown.` },
            { role: "user", content: `History: ${dataSummary}` }
          ],
          temperature: 0.7, max_tokens: 150
        })
      }).then(r => r.json());

      const insight = resp.choices[0].message.content;
      this.openModal('AI Brain 🧠', `<div style="padding:20px; line-height:1.6; text-align:center; font-size:1.1rem; color:var(--text); font-weight:600;">"${insight}"</div>`);
    } catch (e) {
      this.openModal('AI Brain 🧠', '<p style="text-align:center; padding:20px;">Brain is a bit foggy. Check back soon!</p>');
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
    const k = this.dateKey(this.state.viewDate);
    const curr = this.state.history[k].mood;
    const html = `<div class="mood-grid">` + MOODS.map(m => `
      <button class="mood-btn ${m.emoji===curr?'selected':''}" onclick="app.setMood('${m.emoji}')">
        <span>${m.emoji}</span><small>${m.label}</small>
      </button>
    `).join('') + `</div>`;
    this.openModal('How are you feeling?', html);
  },
  setMood(m) {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].mood = m;
    this.save(); this.updateUI(); this.closeModal(); this.haptic();
  },

  openMealTracker() {
    const k = this.dateKey(this.state.viewDate);
    const d = this.state.history[k];
    const totalCals = d.food.reduce((sum, f) => sum + (f.cals || 0), 0);
    const totalP = d.food.reduce((sum, f) => sum + (f.protein || 0), 0);
    const totalC = d.food.reduce((sum, f) => sum + (f.carbs || 0), 0);
    const totalF = d.food.reduce((sum, f) => sum + (f.fats || 0), 0);

    const pTarget = this.state.profile ? this.state.profile.targetMacros.p : 0;
    const cTarget = this.state.profile ? this.state.profile.targetMacros.c : 0;
    const fTarget = this.state.profile ? this.state.profile.targetMacros.f : 0;
    
    const pDisplayModal = pTarget ? `<span style="color:var(--text);">${totalP}</span><span style="font-size:0.65rem; opacity:0.6;">/${pTarget}g</span>` : `<span style="color:var(--text);">${totalP}g</span>`;
    const cDisplayModal = cTarget ? `<span style="color:var(--text);">${totalC}</span><span style="font-size:0.65rem; opacity:0.6;">/${cTarget}g</span>` : `<span style="color:var(--text);">${totalC}g</span>`;
    const fDisplayModal = fTarget ? `<span style="color:var(--text);">${totalF}</span><span style="font-size:0.65rem; opacity:0.6;">/${fTarget}g</span>` : `<span style="color:var(--text);">${totalF}g</span>`;

    const renderMeals = () => `
      <div style="background:rgba(249,115,22,0.08); border:1px solid rgba(249,115,22,0.15); border-radius:16px; padding:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:flex-start;">
        <div style="flex:1;">
           <small style="color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:700; font-size:0.65rem;">Daily Total</small>
           <div style="font-size:1.8rem; font-weight:900; color:var(--orange); line-height:1.1;">${totalCals} <span style="font-size:0.9rem; font-weight:500;">kcal</span></div>
           <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">
             <div style="background:rgba(56,189,248,0.1); padding:4px 6px; border-radius:6px; font-size:0.75rem; font-weight:700;"><span style="color:#38bdf8; font-weight:900; margin-right:4px;">P</span>${pDisplayModal}</div>
             <div style="background:rgba(251,191,36,0.1); padding:4px 6px; border-radius:6px; font-size:0.75rem; font-weight:700;"><span style="color:#fbbf24; font-weight:900; margin-right:4px;">C</span>${cDisplayModal}</div>
             <div style="background:rgba(248,113,113,0.1); padding:4px 6px; border-radius:6px; font-size:0.75rem; font-weight:700;"><span style="color:#f87171; font-weight:900; margin-right:4px;">F</span>${fDisplayModal}</div>
           </div>
        </div>
        <div style="text-align:right;">
           <small style="color:var(--muted); font-size:0.65rem; text-transform:uppercase; font-weight:700;">Items</small>
           <div style="font-size:1.4rem; font-weight:800;">${d.food.length}</div>
        </div>
      </div>

      <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
        <button id="meal-time-btn" onclick="app.openMealTimePicker()" style="display:flex; align-items:center; gap:6px; background:rgba(62,207,142,0.1); border:1px solid rgba(62,207,142,0.25); color:var(--accent); padding:8px 12px; border-radius:10px; cursor:pointer; font-size:0.8rem; font-weight:700; flex-shrink:0; white-space:nowrap;">
          <i data-lucide="clock" style="width:14px; height:14px;"></i>
          <span id="meal-time-display">${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
        </button>
        <span style="font-size:0.65rem; color:var(--muted);">Tap to change meal time</span>
      </div>

      <div class="meal-input-group">
        <select id="meal-type" class="glass-input" style="flex:0.8">
          <option>🍳 Breakfast</option>
          <option>🍱 Lunch</option>
          <option>🍽️ Dinner</option>
          <option>🍎 Snack</option>
        </select>
        <div style="position:relative; flex:1.2;">
          <input type="text" id="meal-desc" class="glass-input" placeholder="e.g. 2 Roti, Dal, Sabzi" style="width:100%">
          <div id="ai-status" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); font-size:0.6rem; color:var(--accent); display:none; font-weight:700; text-transform:uppercase;">AI Analyzing...</div>
        </div>
        <button class="action-btn primary" onclick="app.addMeal()">Add</button>
      </div>

      <p style="font-weight:700; color:var(--muted); font-size:0.75rem; text-transform:uppercase; margin:15px 0 10px; letter-spacing:1px;">Meal Breakdown</p>
      
      <div class="meal-list">${d.food.map((f,i) => `
        <div class="meal-item glass" style="padding:15px; margin-bottom:12px; border-radius:14px; border:1px solid rgba(255,255,255,0.05);">
          <div class="meal-item-info">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:0.7rem; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; color:var(--muted); font-weight:600;">${f.time || ''}</span>
              <strong style="color:var(--text); font-size:0.95rem;">${f.type}</strong>
            </div>
            <div style="color:var(--muted); font-size:0.85rem; line-height:1.4;">${f.desc}</div>
            <div style="font-size:0.75rem; color:var(--accent); margin-top:4px;">P: ${f.protein||0}g • C: ${f.carbs||0}g • F: ${f.fats||0}g</div>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="text-align:right;">
              <div style="color:var(--orange); font-weight:800; font-size:1rem;">${f.cals || 0}</div>
              <small style="color:var(--muted); font-size:0.6rem; text-transform:uppercase; font-weight:700;">kcal</small>
            </div>
            <button class="del-btn" style="background:rgba(248,113,113,0.1); color:var(--danger); width:32px; height:32px; border-radius:8px;" onclick="app.deleteMeal(${i})"><i data-lucide="trash-2" style="width:16px;"></i></button>
          </div>
        </div>`).join('')}
      </div>`;
    this.openModal('Meals & Nutrition', renderMeals());
    lucide.createIcons();
  },
  async addMeal() {
    const k = this.dateKey(this.state.viewDate);
    const type = document.getElementById('meal-type').value;
    const desc = document.getElementById('meal-desc').value.trim() || 'Logged';
    
    const meal = { type, desc, cals: 0, protein: 0, carbs: 0, fats: 0, time: this._pendingMealTime || new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) };
    this.state.history[k].food.push(meal);
    this._pendingMealTime = null; // reset for next meal
    
    this.save(); this.updateUI(); this.openMealTracker(); this.haptic();
    
    // AI Nutrition Estimation
    const statusEl = document.getElementById('ai-status');
    if (statusEl) statusEl.style.display = 'block';
    
    const nutrition = await this.aiEstimateNutrition(desc);
    meal.cals = nutrition.cals;
    meal.protein = nutrition.protein;
    meal.carbs = nutrition.carbs;
    meal.fats = nutrition.fats;
    
    this.save(); this.updateUI(); this.openMealTracker();
  },
  async aiEstimateNutrition(text) {
    const API_TOKEN = "gsk_Ps7AouVDgKZK5FVx" + "pOpbWGdyb3FYid9galuidjPyIOEUqTqe8IhI";
    try {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {role: "system", content: "You are an expert, highly accurate nutritionist. You must provide realistic and scientifically accurate nutritional estimates for the given food items. Base your estimates on standard USDA/NIN data. Output MUST be ONLY a valid JSON object with keys 'cals', 'protein', 'carbs', 'fats' containing integer values in grams/kcals. No text, no markdown. Be precise, NO false information."},
            {role: "user", content: `Estimate nutrition for exactly this meal: "${text}".`}
          ],
          temperature: 0.0, max_tokens: 60
        })
      }).then(r => r.json());
      
      const content = resp.choices[0].message.content;
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        const data = JSON.parse(match[0]);
        return { cals: parseInt(data.cals) || 0, protein: parseInt(data.protein) || 0, carbs: parseInt(data.carbs) || 0, fats: parseInt(data.fats) || 0 };
      }
      return { cals: 0, protein: 0, carbs: 0, fats: 0 };
    } catch(e) { return { cals: 0, protein: 0, carbs: 0, fats: 0 }; }
  },
  deleteMeal(i) {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].food.splice(i, 1);
    this.save(); this.updateUI(); this.openMealTracker(); this.haptic();
  },

  openMealTimePicker() {
    // Grab current displayed time or default to now
    const existing = document.getElementById('meal-time-display')?.textContent || '';
    let h=new Date().getHours(), m=new Date().getMinutes();
    let ampm = h >= 12 ? 'PM' : 'AM';
    h = h > 12 ? h-12 : (h===0 ? 12 : h);

    if (existing && existing.includes(':')) {
      const parts = existing.split(/[:\s]/);
      h = parseInt(parts[0]) || h;
      m = parseInt(parts[1]) || m;
      ampm = existing.includes('PM') ? 'PM' : existing.includes('AM') ? 'AM' : ampm;
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
          <button id="ampm-am" class="ampm-btn ${ampm==='AM'?'active':''}" onclick="app._setAMPM('AM')">AM</button>
          <button id="ampm-pm" class="ampm-btn ${ampm==='PM'?'active':''}" onclick="app._setAMPM('PM')">PM</button>
        </div>
        <button class="action-btn primary" style="width:100%" onclick="app._saveMealClockTime()">Set Meal Time</button>
      </div>`;

    this.openModal('Meal Time', html);
    this.app_temp_clock = { h, m, ampm, mode: 'hours', id: 'meal' };
    this._renderClockFace();
    this.setupClockEvents();
  },
  _saveMealClockTime() {
    const c = this.app_temp_clock;
    this._pendingMealTime = `${c.h}:${c.m.toString().padStart(2,'0')} ${c.ampm}`;
    this.closeModal();
    // Re-open meal tracker to update the displayed time
    this.openMealTracker();
    // Restore the chosen time in the display after re-open
    setTimeout(() => {
      const btn = document.getElementById('meal-time-display');
      if (btn) btn.textContent = this._pendingMealTime;
    }, 50);
    this.haptic();
  },

  openExerciseTracker() {
    const k = this.dateKey(this.state.viewDate);
    const d = this.state.history[k];
    const totalMins = (d.workouts || []).reduce((sum, w) => sum + (w.mins || 0), 0);
    const totalCals = (d.workouts || []).reduce((sum, w) => sum + (w.cals || 0), 0);
    
    const renderWorkouts = () => `
      <div style="background:rgba(62,207,142,0.08); border:1px solid rgba(62,207,142,0.15); border-radius:16px; padding:18px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
        <div>
           <small style="color:var(--muted); text-transform:uppercase; letter-spacing:1px; font-weight:700; font-size:0.65rem;">Daily Total</small>
           <div style="font-size:1.8rem; font-weight:900; color:var(--accent); line-height:1.1;">${totalMins} <span style="font-size:0.9rem; font-weight:500;">min</span></div>
           <div style="font-size:0.8rem; color:var(--muted); margin-top:4px;">🔥 ${Math.round(totalCals)} kcal burnt</div>
        </div>
      </div>

      <div class="meal-input-group">
        <select id="workout-type" class="glass-input" style="flex:1">
          <option value="Walking|4">🚶 Walking</option>
          <option value="Running|10">🏃 Running</option>
          <option value="Yoga|3">🧘 Yoga</option>
          <option value="Weightlifting|5">🏋️ Weightlifting</option>
          <option value="HIIT|12">🔥 HIIT</option>
          <option value="Cycling|7">🚴 Cycling</option>
          <option value="Swimming|8">🏊 Swimming</option>
          <option value="Sport|6">⚽ Sport / Other</option>
        </select>
        <div style="display:flex; align-items:center; gap:8px; flex:1;">
          <input type="number" id="workout-mins" class="glass-input" placeholder="Min" style="width:100%" min="1">
          <button class="action-btn primary" onclick="app.addWorkout()">Add</button>
        </div>
      </div>

      <p style="font-weight:700; color:var(--muted); font-size:0.75rem; text-transform:uppercase; margin:15px 0 10px; letter-spacing:1px;">Activity Log</p>
      
      <div class="meal-list">${(d.workouts||[]).map((w,i) => `
        <div style="background:rgba(255,255,255,0.03); border-radius:8px; padding:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:600; font-size:0.85rem; color:var(--text);">${w.type}</div>
            <div style="font-size:0.75rem; color:var(--muted); margin-top:2px;">${w.mins} mins • 🔥 ${Math.round(w.cals)} kcal</div>
          </div>
          <button class="del-btn" style="background:rgba(248,113,113,0.1); color:var(--danger); width:32px; height:32px; border-radius:8px;" onclick="app.deleteWorkout(${i})"><i data-lucide="trash-2" style="width:16px;"></i></button>
        </div>`).join('')}
      </div>`;
    this.openModal('Log Exercise', renderWorkouts());
    lucide.createIcons();
  },
  addWorkout() {
    const k = this.dateKey(this.state.viewDate);
    const typeVal = document.getElementById('workout-type').value;
    const [type, met] = typeVal.split('|');
    const mins = parseInt(document.getElementById('workout-mins').value) || 0;
    if(mins <= 0) return;
    
    const cals = mins * parseFloat(met);
    const workout = { type, mins, cals };
    
    if(!this.state.history[k].workouts) this.state.history[k].workouts = [];
    this.state.history[k].workouts.push(workout);
    this.state.history[k].exercise = this.state.history[k].workouts.reduce((sum, w) => sum + (w.mins || 0), 0);
    
    this.save(); this.updateUI(); this.openExerciseTracker(); this.haptic();
  },
  deleteWorkout(i) {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].workouts.splice(i, 1);
    this.state.history[k].exercise = this.state.history[k].workouts.reduce((sum, w) => sum + (w.mins || 0), 0);
    this.save(); this.updateUI(); this.openExerciseTracker(); this.haptic();
  },

  openJournal() {
    const k = this.dateKey(this.state.viewDate);
    const txt = this.state.history[k].journal;
    this.openModal('Journal', `<textarea id="journal-input" class="glass-input journal-textarea" placeholder="Reflect on your day...">${txt}</textarea><button class="action-btn primary" style="width:100%; margin-top:12px;" onclick="app.saveJournal()">Save Entry</button>`);
  },
  saveJournal() {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].journal = document.getElementById('journal-input').value;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Journal saved! 📖', '📖');
  },

  openStepsInput() {
    const k = this.dateKey(this.state.viewDate);
    const val = this.state.history[k].steps;
    this.openModal('Steps', `<div class="meal-input-group"><input type="number" id="steps-input" class="glass-input" value="${val}" placeholder="Enter steps count..."><button class="action-btn primary" onclick="app.saveSteps()">Save Steps</button></div>`);
  },
  saveSteps() {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].steps = parseInt(document.getElementById('steps-input').value) || 0;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Steps updated! 👟', '👟');
  },

  openFocusInput() {
    const k = this.dateKey(this.state.viewDate);
    const val = this.state.history[k].focus;
    this.openModal('Study / Focus Time', `<div class="meal-input-group"><input type="number" id="focus-input" class="glass-input" value="${val}" placeholder="Minutes studied..."><button class="action-btn primary" onclick="app.saveFocusTime()">Save Minutes</button></div>`);
  },
  saveFocusTime() {
    const k = this.dateKey(this.state.viewDate);
    this.state.history[k].focus = parseInt(document.getElementById('focus-input').value) || 0;
    this.save(); this.updateUI(); this.closeModal(); this.toast('Focus time updated! ✍️', '✍️');
  },

  openHobbyTracker() {
    const k = this.dateKey(this.state.viewDate);
    const existing = this.state.history[k].hobbies || '';
    const presets = ['Singing', 'Drawing', 'Reading', 'Coding', 'Dancing', 'Cooking', 'Gardening', 'Photography'];
    
    let html = `
      <div class="hobby-picker">
        <p class="setting-desc" style="margin-bottom:12px;">Select or type your hobbies today:</p>
        <div class="hobby-chips">
          ${presets.map(h => `<button class="hobby-chip ${existing.includes(h)?'selected':''}" onclick="app.toggleHobbyChip(this, '${h}')">${h}</button>`).join('')}
        </div>
        <input type="text" id="hobby-custom" class="glass-input" style="margin-top:16px;" placeholder="Other hobby..." value="${existing}">
        <button class="action-btn primary" style="width:100%; margin-top:16px;" onclick="app.saveHobby()">Log Hobbies</button>
      </div>
    `;
    this.openModal('Hobby Tracker', html);
  },
  toggleHobbyChip(btn, name) {
    btn.classList.toggle('selected');
    this.haptic();
  },
  saveHobby() {
    const k = this.dateKey(this.state.viewDate);
    const chips = Array.from(document.querySelectorAll('.hobby-chip.selected')).map(b => b.textContent);
    const custom = document.getElementById('hobby-custom').value.trim();
    
    let all = new Set(chips);
    if(custom) custom.split(',').forEach(c => { if(c.trim()) all.add(c.trim()); });
    
    this.state.history[k].hobbies = Array.from(all).filter(Boolean).join(', ');
    this.save(); this.updateUI(); this.closeModal(); this.toast('Hobbies logged! 🎨', '🎨');
  },

  saveSettings() {
    const meditation = parseInt(document.getElementById('set-meditation').value);
    const water = parseInt(document.getElementById('set-water').value);
    const exercise = parseInt(document.getElementById('set-exercise').value);
    const steps = parseInt(document.getElementById('set-steps').value);
    const sleep = parseInt(document.getElementById('set-sleep').value);
    const calories = parseInt(document.getElementById('set-calories').value);
    const focus = parseInt(document.getElementById('set-focus').value);
    this.state.targets = { meditation, water, exercise, steps, sleep, calories, focus };
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
      const k = this.dateKey(this.state.viewDate);
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
      const k = this.dateKey(this.state.viewDate);
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
      const k = this.dateKey(new Date(d.getFullYear(), d.getMonth(), day));
      const hist = this.state.history[k];
      const score = hist ? hist._score : 0;
      const completed = hist ? hist._completed : false;
      const status = completed ? 'perfect-win' : score >= 8 ? 'high-win' : score >= 4 ? 'mid-win' : score > 0 ? 'low-win' : '';
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
      const k = this.dateKey(new Date(year, month, day));
      const h = this.state.history[k];
      if (h && h._score !== undefined) {
        loggedDays++;
        if (h.wake) stats.wake++;
        if (h.bedtime) stats.sleep++;
        if (h.meditation >= t.meditation) stats.meditation++;
        if (h.water >= t.water) stats.water++;
        if (h.exercise >= t.exercise) stats.exercise++;
        if (h.steps >= t.steps) stats.steps++;
        if (h._completed) stats.perfectDays = (stats.perfectDays || 0) + 1;
      }
    }

    this.setText('stat-perfect-days', stats.perfectDays || 0);
    this.setText('stat-active-days', loggedDays);
    const avgScore = loggedDays ? Object.values(this.state.history).reduce((a,b)=>a+(b._score||0),0)/loggedDays : 0;
    this.setText('stat-avg-progress', Math.round((avgScore/10)*100)+'%');

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
    ['dashboard','monthly','energy','settings'].forEach(v => {
      document.getElementById(`view-${v}`).classList.add('hidden');
      document.getElementById(`nav-${v}`).classList.remove('active');
    });
    document.getElementById(`view-${t}`).classList.remove('hidden');
    document.getElementById(`nav-${t}`).classList.add('active');
    if (t === 'monthly') this.renderCalendar();
    if (t === 'energy') this.renderEnergyDashboard();
    this.haptic();
  },
  
  renderEnergyDashboard() {
    const filter = document.getElementById('energy-filter').value || 'daily';
    const now = new Date();
    let intake = 0;
    let burnt = 0;

    for (let k in this.state.history) {
      const d = new Date(k);
      let include = false;
      
      if (filter === 'daily') {
        include = k === this.today();
      } else if (filter === 'weekly') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        include = d >= startOfWeek && d <= now;
      } else if (filter === 'monthly') {
        include = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else if (filter === 'yearly') {
        include = d.getFullYear() === now.getFullYear();
      }

      if (include) {
        const day = this.state.history[k];
        const dayIntake = (day.food || []).reduce((sum, f) => sum + (f.cals || 0), 0);
        const dayBurnt = (day.workouts || []).reduce((sum, w) => sum + (w.cals || 0), 0) + (day.steps || 0) * 0.04;
        
        intake += dayIntake;
        burnt += dayBurnt;
      }
    }

    this.setText('energy-intake', Math.round(intake));
    this.setText('energy-burnt', Math.round(burnt));
    
    const net = Math.round(intake - burnt);
    const netEl = document.getElementById('energy-net');
    if (netEl) {
      netEl.textContent = `${net > 0 ? '+' : ''}${net} kcal`;
      netEl.style.color = net >= 0 ? 'var(--orange)' : 'var(--danger)';
    }
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
  openReminders() {
    this.switchTab('settings');
    setTimeout(() => {
      const el = document.getElementById('notif-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
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
    const name = localStorage.getItem('tw_username') || 'Me';
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
      this.openModal('Focus Session', `
        <div style="text-align:center; padding:30px;">
          <div id="focus-countdown" style="font-size:3.5rem; font-weight:800; color:var(--orange); margin-bottom:15px;">--:--</div>
          <p id="focus-status">Stay focused. You got this!</p>
          <button class="action-btn danger-btn" style="margin-top:20px; width:100%" onclick="app.stopFocus()">Stop Session</button>
        </div>`);
      this._updateFocusUI();
      return;
    }
    
    const html = `
      <div style="text-align:center; padding:20px;">
        <p style="color:var(--muted); margin-bottom:20px;">Choose your focus duration:</p>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:25px;">
           <button class="focus-preset" onclick="app.startFocus(15)">15 mins</button>
           <button class="focus-preset" onclick="app.startFocus(25)">25 mins</button>
           <button class="focus-preset" onclick="app.startFocus(45)">45 mins</button>
           <button class="focus-preset" onclick="app.startFocus(60)">60 mins</button>
        </div>
        <div style="border-top:1px solid var(--border); padding-top:20px; display:flex; align-items:center; justify-content:center; gap:10px;">
          <input type="number" id="custom-focus" class="glass-input" value="30" min="1" max="180" style="width:80px; text-align:center;">
          <span style="font-weight:600;">min</span>
          <button class="action-btn primary" onclick="app.startFocus()">Start</button>
        </div>
      </div>
    `;
    this.openModal('Focus Setup', html);
  },
  startFocus(mins) {
    if (!mins) mins = parseInt(document.getElementById('custom-focus').value) || 25;
    this.haptic();
    this.closeModal();
    
    let sec = mins * 60;
    this._currentFocusSec = sec;

    this.openModal('Focus Session', `
      <div style="text-align:center; padding:30px;">
        <div id="focus-countdown" style="font-size:3.5rem; font-weight:800; color:var(--orange); margin-bottom:15px;">${mins}:00</div>
        <p id="focus-status">Stay focused. You got this!</p>
        <button class="action-btn danger-btn" style="margin-top:20px; width:100%" onclick="app.stopFocus()">Stop Session</button>
      </div>`);

    this.focusInterval = setInterval(() => {
      sec--;
      this._currentFocusSec = sec;
      this._updateFocusUI();

      if(sec <= 0) {
        clearInterval(this.focusInterval);
        this.focusInterval = null;
        this.adjustValue('focus', mins);
        this.closeModal();
        this.toast(`Focus session complete! +${mins}m`, '🎯');
        this.haptic();
        this._showNotif('Focus Complete! 🏆', `You crushed a ${mins} minute session!`);
      }
    }, 1000);
  },
  _updateFocusUI() {
    const el = document.getElementById('focus-countdown');
    if(!el || this._currentFocusSec === undefined) return;
    const m = Math.floor(this._currentFocusSec/60), s = this._currentFocusSec%60;
    el.textContent = `${m}:${s.toString().padStart(2,'0')}`;
  },
  stopFocus() {
    clearInterval(this.focusInterval);
    this.focusInterval = null;
    this.closeModal();
    this.toast('Session stopped', '🛑');
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
      const k = this.dateKey(this.state.viewDate);
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
    
    if (Notification.permission === 'denied') {
      this.toast('Notifications blocked. Reset permissions in site settings.', '❌');
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('tw_notif_enabled', 'true');
        this.scheduleAllNotifications();
        this.updateNotifUI();
        this.toast('Reminders enabled! 🔔', '🔔');
        this._showNotif('TinyWins', 'Reminders are now active! 💪');
      } else {
        this.toast(`Permission ${perm} — check browser settings`, '❌');
      }
    } catch (e) {
      this.toast('Notification prompt failed', '❌');
    }
    this.updateNotifUI();
  },
  disableNotifications() {
    localStorage.setItem('tw_notif_enabled', 'false');
    if (this._notifTimers) this._notifTimers.forEach(id => {
      if (id) {
        clearTimeout(id); clearInterval(id);
      }
    });
    this._notifTimers = [];
    this.toast('Reminders disabled 🔕', '🔕');
    this.updateNotifUI();
  },
  openClock(id, title) {
    let h = 7, m = 30, ampm = 'AM', mode = 'hours';
    let existing = '';
    
    if (id.startsWith('notif-')) {
      existing = localStorage.getItem('tw_' + id.replace(/-/g, '_')) || '';
    } else {
      const k = this.dateKey(this.state.viewDate);
      existing = this.state.history[k][id] || '';
    }

    if (existing) {
      if (existing.includes(' ')) {
        const [time, ap] = existing.split(' ');
        const [hh, mm] = time.split(':').map(Number);
        h = hh; m = mm; ampm = ap;
      } else {
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
          <button id="ampm-am" class="ampm-btn ${ampm==='AM'?'active':''}" onclick="app._setAMPM('AM')">AM</button>
          <button id="ampm-pm" class="ampm-btn ${ampm==='PM'?'active':''}" onclick="app._setAMPM('PM')">PM</button>
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
      let h24 = c.h;
      if (c.ampm === 'PM' && h24 < 12) h24 += 12;
      if (c.ampm === 'AM' && h24 === 12) h24 = 0;
      const time24 = `${h24.toString().padStart(2,'0')}:${c.m.toString().padStart(2,'0')}`;
      localStorage.setItem('tw_' + id.replace(/-/g, '_'), time24);
      this.updateNotifUI();
      this.scheduleAllNotifications();
      this.toast('Reminder set! ⏰', '⏰');
    } else {
      const k = this.dateKey(this.state.viewDate);
      this.state.history[k][id] = timeWithAMPM;
      this.save(); this.updateUI();
      this.toast('Time saved! ⏰', '⏰');
    }
    this.closeModal();
  },
  updateNotifUI() {
    const el = document.getElementById('notif-status');
    if (!el) return;
    const enabled = localStorage.getItem('tw_notif_enabled') === 'true';
    const granted = Notification.permission === 'granted';
    
    if (enabled && granted) {
      el.textContent = '✅ Active'; el.style.color = 'var(--accent)';
    } else if (Notification.permission === 'denied') {
      el.textContent = '🚫 Blocked'; el.style.color = 'var(--danger)';
    } else if (!enabled) {
      el.textContent = '❌ Off'; el.style.color = 'var(--muted)';
    } else {
      el.textContent = '⚠️ Permission Required'; el.style.color = 'var(--orange)';
    }

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
