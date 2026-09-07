const TARGET = 75 * 60;
const KEY = "fortnightTracker.v1";

const presets = {
  monday:  {start:"07:30", finish:"15:30", break:30, note:"Mon gym"},
  office:  {start:"07:30", finish:"16:30", break:30, note:"Office"},
  cycle:   {start:"07:30", finish:"16:00", break:30, note:"Cycle / office"},
  wfhLong: {start:"07:00", finish:"16:30", break:30, note:"WFH long"},
  wfhGym:  {start:"07:00", finish:"16:30", break:90, note:"WFH + gym"}
};

const startOptions = ["06:30","07:00","07:30","08:00"];
const finishOptions = ["15:30","16:00","16:30","17:00"];
const breakOptions = [30,60,90];

const el = id => document.getElementById(id);
const pad = n => String(n).padStart(2,"0");

function localISO(d){
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function parseISO(s){
  return new Date(`${s}T12:00:00`);
}

function addDays(s,n){
  const d = parseISO(s);
  d.setDate(d.getDate()+n);
  return localISO(d);
}

function fmtDate(
  s,
  opts = {weekday:"short",day:"numeric",month:"short"}
){
  return parseISO(s).toLocaleDateString("en-GB",opts);
}

function mondayOf(date = new Date()){
  const d = new Date(date);
  const wd = d.getDay();
  d.setDate(d.getDate() + (wd===0 ? -6 : 1-wd));
  return localISO(d);
}

function timeToMin(t){
  if(!t) return null;
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}

function paidMinutes(day){
  if(!day || day.off || !day.start || !day.finish) return 0;

  const s = timeToMin(day.start);
  const f = timeToMin(day.finish);

  if(f <= s) return 0;

  return Math.max(
    0,
    f - s - Number(day.break || 0)
  );
}

function fmtHM(m){
  m = Math.max(0,Math.round(m));
  return `${Math.floor(m/60)}h ${pad(m%60)}m`;
}

function makeDays(start, offWeek){
  const offsets = [0,1,2,3,4,7,8,9,10,11];

  return offsets.map((o,i) => ({
    date: addDays(start,o),
    week: i < 5 ? 1 : 2,
    weekday: i % 5,
    off:
      (offWeek===1 && i===4) ||
      (offWeek===2 && i===9),
    start:"",
    finish:"",
    break:30,
    note:""
  }));
}

function blankState(){
  const start = mondayOf();

  return {
    configured:false,
    start,
    offWeek:2,
    days:makeDays(start,2)
  };
}

function load(){
  try{
    const s = JSON.parse(localStorage.getItem(KEY));

    if(
      s &&
      Array.isArray(s.days) &&
      s.days.length===10
    ){
      return s;
    }
  }catch{}

  return blankState();
}

let state = load();
let editingIndex = null;

function persist(){
  localStorage.setItem(KEY,JSON.stringify(state));
}

function renderSetupDates(){
  el("startDateButton").textContent = fmtDate(
    state.start,
    {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    }
  );

  el("startDateNative").value = state.start;

  el("week1FridayLabel").textContent =
    fmtDate(addDays(state.start,4));

  el("week2FridayLabel").textContent =
    fmtDate(addDays(state.start,11));

  el("setupOffSummary").textContent =
    `W${state.offWeek} Fri`;

  document
    .querySelectorAll(".choice-btn")
    .forEach(b => {
      const week =
        Number(b.dataset.off.replace("week",""));

      b.classList.toggle(
        "selected",
        week===state.offWeek
      );
    });
}

function renderShell(){
  const end = addDays(state.start,13);

  el("fortnightRange").textContent =
    state.configured
      ? `${fmtDate(
          state.start,
          {day:"numeric",month:"short"}
        )} – ${fmtDate(
          end,
          {day:"numeric",month:"short",year:"numeric"}
        )}`
      : "Set up your fortnight";

  el("setupView").classList.toggle(
    "hidden",
    state.configured
  );

  el("trackerView").classList.toggle(
    "hidden",
    !state.configured
  );

  renderSetupDates();

  if(state.configured){
    renderOverview();
    renderCalendar();
  }
}

function renderOverview(){
  const worked = state.days.reduce(
    (a,d) => a + paidMinutes(d),
    0
  );

  const remaining =
    Math.max(0,TARGET-worked);

  const unlogged = state.days.filter(
    d => !d.off && paidMinutes(d)===0
  ).length;

  const avg =
    unlogged ? remaining/unlogged : 0;

  const pct =
    Math.min(
      100,
      Math.round(worked/TARGET*100)
    );

  el("progressHeadline").textContent =
    `${fmtHM(worked)} of 75h`;

  el("progressPercent").textContent =
    `${pct}%`;

  el("progressBar").style.width =
    `${pct}%`;

  el("workedMetric").textContent =
    fmtHM(worked);

  el("remainingMetric").textContent =
    fmtHM(remaining);

  el("daysLeftMetric").textContent =
    unlogged;

  el("avgMetric").textContent =
    fmtHM(avg);

  const pace = el("paceMessage");

  pace.className = "pace-box";

  if(worked >= TARGET){
    pace.classList.add("good");

    pace.innerHTML =
      `<strong>Target reached.</strong> ` +
      `You are ${fmtHM(worked-TARGET)} over 75 hours.`;
  }
  else if(avg <= 540){
    pace.classList.add(
      avg <= 500 ? "good" : "warn"
    );

    pace.innerHTML =
      `<strong>${fmtHM(remaining)} remaining.</strong> ` +
      `Average ${fmtHM(avg)} across ` +
      `${unlogged} unlogged working day` +
      `${unlogged===1 ? "" : "s"}.`;
  }
  else{
    pace.classList.add("warn");

    pace.innerHTML =
      `<strong>Catch-up needed.</strong> ` +
      `The remaining average is ${fmtHM(avg)}, ` +
      `above a 9-hour paid day.`;
  }

  const today = localISO(new Date());

  el("dayList").innerHTML =
    state.days.map((d,i) => {

      const p = paidMinutes(d);
      const date = parseISO(d.date);

      const dow =
        date.toLocaleDateString(
          "en-GB",
          {weekday:"short"}
        );

      const label =
        d.off
          ? "Non-working Friday"
          : (
              d.note ||
              (p ? "Logged" : "Not logged")
            );

      return `
        <button
          class="day-row"
          data-day="${i}"
          style="
            width:100%;
            border-left:0;
            border-right:0;
            border-bottom:0;
            background:transparent;
            color:inherit;
            text-align:left;
          "
        >
          <div class="day-chip ${d.date===today ? "today" : ""}">
            <span>${dow}</span>
            <strong>${date.getDate()}</strong>
          </div>

          <div class="day-main">
            <strong>
              Week ${d.week} · ${fmtDate(d.date)}
            </strong>
            <span>${label}</span>
          </div>

          <div class="day-hours ${d.off ? "off" : ""}">
            ${
              d.off
                ? "OFF"
                : (p ? fmtHM(p) : "—")
            }
          </div>
        </button>
      `;
    }).join("");

  document
    .querySelectorAll("[data-day]")
    .forEach(b => {
      b.onclick = () =>
        openEditor(Number(b.dataset.day));
    });
}

function renderCalendar(){
  const today = localISO(new Date());

  el("calendarGrid").innerHTML =
    state.days.map((d,i) => {

      const p = paidMinutes(d);
      const date = parseISO(d.date);

      const dow =
        date.toLocaleDateString(
          "en-GB",
          {weekday:"short"}
        );

      return `
        <button
          class="
            cal-cell
            ${d.date===today ? "today" : ""}
            ${d.off ? "off" : ""}
          "
          data-cal="${i}"
          style="color:inherit;text-align:left"
        >
          <div class="dow">
            ${dow} · W${d.week}
          </div>

          <div class="date">
            ${date.getDate()}
          </div>

          <div class="cal-hours">
            ${
              d.off
                ? "OFF"
                : (p ? fmtHM(p) : "")
            }
          </div>
        </button>
      `;
    }).join("");

  document
    .querySelectorAll("[data-cal]")
    .forEach(b => {
      b.onclick = () =>
        openEditor(Number(b.dataset.cal));
    });
}

function renderOptionButtons(
  container,
  options,
  value,
  kind
){
  el(container).innerHTML =
    options.map(v => {

      const label =
        kind==="break"
          ? `${v}m`
          : v;

      return `
        <button
          class="
            ${kind==="break" ? "break-btn" : "time-btn"}
            ${String(v)===String(value) ? "selected" : ""}
          "
          data-value="${v}"
        >
          ${label}
        </button>
      `;
    }).join("");
}

function clearPresetSelection(){
  document
    .querySelectorAll(".preset")
    .forEach(
      b => b.classList.remove("selected")
    );
}

function editorValue(){
  return {
    start:
      document.querySelector(
        "#startButtons .selected"
      )?.dataset.value || "",

    finish:
      document.querySelector(
        "#finishButtons .selected"
      )?.dataset.value || "",

    break:
      Number(
        document.querySelector(
          "#breakButtons .selected"
        )?.dataset.value || 30
      ),

    note:
      el("dayNote").value.trim()
  };
}

function refreshEditorTotal(){
  const tmp = {
    ...editorValue(),
    off:false
  };

  const p = paidMinutes(tmp);

  el("editorPaid").textContent =
    fmtHM(p);

  const warn =
    el("dayWarning");

  let text = "";

  if(
    tmp.start &&
    tmp.finish &&
    timeToMin(tmp.finish) <=
    timeToMin(tmp.start)
  ){
    text =
      "Finish time must be later than start time.";
  }
  else if(p > 540){
    text =
      "This is more than 9 paid hours.";
  }
  else if(p > 0 && p < 360){
    text =
      "This is under 6 paid hours.";
  }

  warn.textContent = text;

  warn.classList.toggle(
    "hidden",
    !text
  );
}

function bindChoiceButtons(
  container,
  onPick
){
  el(container)
    .querySelectorAll("button")
    .forEach(b => {

      b.onclick = () => {

        el(container)
          .querySelectorAll("button")
          .forEach(
            x => x.classList.remove("selected")
          );

        b.classList.add("selected");

        clearPresetSelection();

        onPick?.();

        refreshEditorTotal();
      };
    });
}

function openEditor(i){
  editingIndex = i;

  const d = state.days[i];

  el("editorWeek").textContent =
    `Week ${d.week}`;

  el("editorDate").textContent =
    fmtDate(
      d.date,
      {
        weekday:"long",
        day:"numeric",
        month:"long"
      }
    );

  el("editorSheet")
    .classList.remove("hidden");

  document.body.style.overflow =
    "hidden";

  el("offDayPanel")
    .classList.toggle(
      "hidden",
      !d.off
    );

  el("workDayPanel")
    .classList.toggle(
      "hidden",
      d.off
    );

  if(d.off) return;

  renderOptionButtons(
    "startButtons",
    startOptions,
    d.start || "07:30",
    "time"
  );

  renderOptionButtons(
    "finishButtons",
    finishOptions,
    d.finish || "16:30",
    "time"
  );

  renderOptionButtons(
    "breakButtons",
    breakOptions,
    d.break || 30,
    "break"
  );

  bindChoiceButtons("startButtons");
  bindChoiceButtons("finishButtons");
  bindChoiceButtons("breakButtons");

  el("dayNote").value =
    d.note || "";

  clearPresetSelection();

  for(
    const [key,p]
    of Object.entries(presets)
  ){
    if(
      d.start===p.start &&
      d.finish===p.finish &&
      Number(d.break)===p.break
    ){
      document
        .querySelector(
          `.preset[data-preset="${key}"]`
        )
        ?.classList.add("selected");

      break;
    }
  }

  refreshEditorTotal();
}

function closeEditor(){
  el("editorSheet")
    .classList.add("hidden");

  document.body.style.overflow = "";

  editingIndex = null;
}

document
  .querySelectorAll(".choice-btn")
  .forEach(b => {
    b.onclick = () => {
      state.offWeek =
        Number(
          b.dataset.off.replace("week","")
        );

      renderSetupDates();
    };
  });

el("prevMonday").onclick = () => {
  state.start =
    addDays(state.start,-7);

  renderSetupDates();
};

el("nextMonday").onclick = () => {
  state.start =
    addDays(state.start,7);

  renderSetupDates();
};

el("startDateButton").onclick = () => {
  el("startDateNative").showPicker?.();
};

el("startDateNative").onchange = e => {
  if(!e.target.value) return;

  state.start =
    mondayOf(
      parseISO(e.target.value)
    );

  renderSetupDates();
};

el("createFortnightBtn").onclick = () => {
  state.days =
    makeDays(
      state.start,
      state.offWeek
    );

  state.configured = true;

  persist();
  renderShell();
};

el("settingsBtn").onclick = () => {
  if(!state.configured){
    renderShell();
    return;
  }

  if(
    confirm(
      "Change the fortnight setup? Existing logged days will stay until you create a new fortnight."
    )
  ){
    state.configured = false;

    persist();
    renderShell();
  }
};

document
  .querySelectorAll(".seg")
  .forEach(b => {
    b.onclick = () => {

      document
        .querySelectorAll(".seg")
        .forEach(
          x =>
            x.classList.toggle(
              "active",
              x===b
            )
        );

      el("overviewTab")
        .classList.toggle(
          "hidden",
          b.dataset.tab!=="overview"
        );

      el("calendarTab")
        .classList.toggle(
          "hidden",
          b.dataset.tab!=="calendar"
        );
    };
  });

el("closeEditor").onclick =
  closeEditor;

el("editorSheet").onclick = e => {
  if(e.target===el("editorSheet")){
    closeEditor();
  }
};

document
  .querySelectorAll(".preset")
  .forEach(b => {
    b.onclick = () => {

      const p =
        presets[b.dataset.preset];

      clearPresetSelection();

      b.classList.add("selected");

      renderOptionButtons(
        "startButtons",
        startOptions,
        p.start,
        "time"
      );

      renderOptionButtons(
        "finishButtons",
        finishOptions,
        p.finish,
        "time"
      );

      renderOptionButtons(
        "breakButtons",
        breakOptions,
        p.break,
        "break"
      );

      bindChoiceButtons(
        "startButtons"
      );

      bindChoiceButtons(
        "finishButtons"
      );

      bindChoiceButtons(
        "breakButtons"
      );

      el("dayNote").value =
        p.note;

      refreshEditorTotal();
    };
  });

el("dayNote").oninput =
  refreshEditorTotal;

el("saveDayBtn").onclick = () => {
  if(editingIndex===null) return;

  const v =
    editorValue();

  if(
    !v.start ||
    !v.finish ||
    timeToMin(v.finish) <=
    timeToMin(v.start)
  ){
    el("dayWarning").textContent =
      "Choose a valid start and finish time.";

    el("dayWarning")
      .classList.remove("hidden");

    return;
  }

  Object.assign(
    state.days[editingIndex],
    v
  );

  persist();

  closeEditor();

  renderOverview();
  renderCalendar();
};

el("clearDayBtn").onclick = () => {
  if(editingIndex===null) return;

  Object.assign(
    state.days[editingIndex],
    {
      start:"",
      finish:"",
      break:30,
      note:""
    }
  );

  persist();

  closeEditor();

  renderOverview();
  renderCalendar();
};

renderShell();

if("serviceWorker" in navigator){
  window.addEventListener(
    "load",
    () => {
      navigator
        .serviceWorker
        .register("./sw.js")
        .catch(()=>{});
    }
  );
}
