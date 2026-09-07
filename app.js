const TARGET = 75 * 60;
const KEY = "fortnightTracker.v3";
const HISTORY_KEY = "fortnightTracker.history.v1";

const presets = {
  monday: {
    start: "07:30",
    finish: "15:30",
    break: 30,
    note: "Mon gym"
  },
  office: {
    start: "07:30",
    finish: "16:30",
    break: 30,
    note: "Office"
  },
  cycle: {
    start: "07:30",
    finish: "16:00",
    break: 30,
    note: "Cycle / office"
  },
  wfhLong: {
    start: "07:00",
    finish: "16:30",
    break: 30,
    note: "WFH long"
  },
  wfhGym: {
    start: "07:00",
    finish: "16:30",
    break: 90,
    note: "WFH + gym"
  }
};

const startOptions = [
  "06:30",
  "07:00",
  "07:30",
  "08:00"
];

const finishOptions = [
  "15:30",
  "16:00",
  "16:30",
  "17:00"
];

const breakOptions = [
  30,
  60,
  90
];

const el = id =>
  document.getElementById(id);

const pad = n =>
  String(n).padStart(2, "0");


function localISO(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}


function parseISO(value) {
  if (!value) {
    return new Date();
  }

  const parts =
    value.split("-").map(Number);

  if (
    parts.length !== 3 ||
    parts.some(Number.isNaN)
  ) {
    return new Date();
  }

  return new Date(
    parts[0],
    parts[1] - 1,
    parts[2],
    12,
    0,
    0
  );
}


function addDays(value, amount) {
  const date =
    parseISO(value);

  date.setDate(
    date.getDate() + amount
  );

  return localISO(date);
}


function mondayOf(date = new Date()) {
  const d =
    date instanceof Date
      ? new Date(date)
      : parseISO(date);

  const weekday =
    d.getDay();

  const adjustment =
    weekday === 0
      ? -6
      : 1 - weekday;

  d.setDate(
    d.getDate() + adjustment
  );

  return localISO(d);
}


function fmtDate(
  value,
  options = {
    weekday: "short",
    day: "numeric",
    month: "short"
  }
) {
  return parseISO(value)
    .toLocaleDateString(
      "en-GB",
      options
    );
}


function timeToMin(value) {
  if (!value) {
    return null;
  }

  const [hours, minutes] =
    value.split(":").map(Number);

  return (
    hours * 60 +
    minutes
  );
}


function paidMinutes(day) {
  if (
    !day ||
    day.off ||
    !day.start ||
    !day.finish
  ) {
    return 0;
  }

  const start =
    timeToMin(day.start);

  const finish =
    timeToMin(day.finish);

  if (finish <= start) {
    return 0;
  }

  return Math.max(
    0,
    finish -
      start -
      Number(day.break || 0)
  );
}


function fmtHM(minutes) {
  const total =
    Math.max(
      0,
      Math.round(minutes)
    );

  const hours =
    Math.floor(total / 60);

  const mins =
    total % 60;

  return `${hours}h ${pad(mins)}m`;
}


function makeDays(
  start,
  offWeek
) {
  const offsets = [
    0, 1, 2, 3, 4,
    7, 8, 9, 10, 11
  ];

  return offsets.map(
    (offset, index) => ({
      date:
        addDays(start, offset),

      week:
        index < 5 ? 1 : 2,

      weekday:
        index % 5,

      off:
        (
          offWeek === 1 &&
          index === 4
        ) ||
        (
          offWeek === 2 &&
          index === 9
        ),

      start: "",
      finish: "",
      break: 30,
      note: ""
    })
  );
}


function blankState() {
  const start =
    mondayOf(new Date());

  return {
    configured: false,
    start,
    offWeek: 2,
    days:
      makeDays(start, 2)
  };
}


function load() {
  try {
    const current =
      localStorage.getItem(KEY);

    if (current) {
      const saved =
        JSON.parse(current);

      if (
        saved &&
        saved.start &&
        Array.isArray(saved.days) &&
        saved.days.length === 10
      ) {
        return saved;
      }
    }

    const previousKeys = [
      "fortnightTracker.v2",
      "fortnightTracker.v1"
    ];

    for (
      const previousKey
      of previousKeys
    ) {
      const raw =
        localStorage.getItem(
          previousKey
        );

      if (!raw) {
        continue;
      }

      const previous =
        JSON.parse(raw);

      if (
        previous &&
        previous.start &&
        Array.isArray(previous.days) &&
        previous.days.length === 10
      ) {
        localStorage.setItem(
          KEY,
          JSON.stringify(previous)
        );

        return previous;
      }
    }
  }
  catch (error) {
    console.log(
      "Could not load saved fortnight.",
      error
    );
  }

  return blankState();
}


function loadHistory() {
  try {
    const raw =
      localStorage.getItem(
        HISTORY_KEY
      );

    if (!raw) {
      return [];
    }

    const history =
      JSON.parse(raw);

    return Array.isArray(history)
      ? history
      : [];
  }
  catch {
    return [];
  }
}


function saveHistory(history) {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(history)
  );
}


let state =
  load();

let editingIndex =
  null;


function persist() {
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );
}


function renderSetupDates() {
  el(
    "startDateButton"
  ).textContent =
    fmtDate(
      state.start,
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );

  el(
    "startDateNative"
  ).value =
    state.start;

  el(
    "week1FridayLabel"
  ).textContent =
    fmtDate(
      addDays(
        state.start,
        4
      )
    );

  el(
    "week2FridayLabel"
  ).textContent =
    fmtDate(
      addDays(
        state.start,
        11
      )
    );

  el(
    "setupOffSummary"
  ).textContent =
    `W${state.offWeek} Fri`;

  document
    .querySelectorAll(
      ".choice-btn"
    )
    .forEach(button => {
      const week =
        Number(
          button.dataset.off
            .replace(
              "week",
              ""
            )
        );

      button.classList.toggle(
        "selected",
        week ===
          state.offWeek
      );
    });
}


function renderShell() {
  const end =
    addDays(
      state.start,
      13
    );

  el(
    "fortnightRange"
  ).textContent =
    state.configured
      ? `${
          fmtDate(
            state.start,
            {
              day: "numeric",
              month: "short"
            }
          )
        } – ${
          fmtDate(
            end,
            {
              day: "numeric",
              month: "short",
              year: "numeric"
            }
          )
        }`
      : "Set up your fortnight";

  el(
    "setupView"
  ).classList.toggle(
    "hidden",
    state.configured
  );

  el(
    "trackerView"
  ).classList.toggle(
    "hidden",
    !state.configured
  );

  renderSetupDates();

  if (
    state.configured
  ) {
    renderOverview();
    renderCalendar();
    renderManageSummary();
  }
}


function getStats() {
  const worked =
    state.days.reduce(
      (
        total,
        day
      ) =>
        total +
        paidMinutes(day),
      0
    );

  const remaining =
    Math.max(
      0,
      TARGET - worked
    );

  const workingDays =
    state.days.filter(
      day => !day.off
    );

  const loggedDays =
    workingDays.filter(
      day =>
        paidMinutes(day) > 0
    );

  const unlogged =
    workingDays.length -
    loggedDays.length;

  const average =
    unlogged
      ? remaining / unlogged
      : 0;

  const percent =
    Math.min(
      100,
      Math.round(
        worked /
          TARGET *
          100
      )
    );

  return {
    worked,
    remaining,
    workingDays,
    loggedDays,
    unlogged,
    average,
    percent
  };
}


function renderOverview() {
  const stats =
    getStats();

  el(
    "progressHeadline"
  ).textContent =
    `${fmtHM(stats.worked)} of 75h`;

  el(
    "progressPercent"
  ).textContent =
    `${stats.percent}%`;

  el(
    "progressBar"
  ).style.width =
    `${stats.percent}%`;

  el(
    "workedMetric"
  ).textContent =
    fmtHM(stats.worked);

  el(
    "remainingMetric"
  ).textContent =
    fmtHM(stats.remaining);

  el(
    "daysLeftMetric"
  ).textContent =
    stats.unlogged;

  el(
    "avgMetric"
  ).textContent =
    fmtHM(stats.average);

  const pace =
    el("paceMessage");

  pace.className =
    "pace-box";

  if (
    stats.worked >= TARGET
  ) {
    pace.classList.add(
      "good"
    );

    pace.innerHTML =
      `<strong>Target reached.</strong> ` +
      `You are ${
        fmtHM(
          stats.worked -
          TARGET
        )
      } over 75 hours.`;
  }
  else if (
    stats.loggedDays.length === 0
  ) {
    pace.classList.add(
      "neutral"
    );

    pace.innerHTML =
      `<strong>${
        fmtHM(
          stats.remaining
        )
      } remaining.</strong> ` +
      `Average ${
        fmtHM(
          stats.average
        )
      } across ${
        stats.unlogged
      } unlogged working days.`;
  }
  else {
    const expectedPerDay =
      TARGET / 9;

    const expectedWorked =
      expectedPerDay *
      stats.loggedDays.length;

    const difference =
      stats.worked -
      expectedWorked;

    if (
      difference >= 15
    ) {
      pace.classList.add(
        "good"
      );

      pace.innerHTML =
        `<strong>You're ahead.</strong> ` +
        `${fmtHM(
          stats.remaining
        )} remaining, averaging ${
          fmtHM(
            stats.average
          )
        } across ${
          stats.unlogged
        } working days.`;
    }
    else if (
      difference <= -15
    ) {
      pace.classList.add(
        "warn"
      );

      pace.innerHTML =
        `<strong>You're slightly behind pace.</strong> ` +
        `${fmtHM(
          stats.remaining
        )} remaining, averaging ${
          fmtHM(
            stats.average
          )
        } across ${
          stats.unlogged
        } working days.`;
    }
    else {
      pace.classList.add(
        "neutral"
      );

      pace.innerHTML =
        `<strong>On track.</strong> ` +
        `${fmtHM(
          stats.remaining
        )} remaining, averaging ${
          fmtHM(
            stats.average
          )
        } across ${
          stats.unlogged
        } working days.`;
    }
  }

  const end =
    parseISO(
      addDays(
        state.start,
        13
      )
    );

  const today =
    new Date();

  const finished =
    today >
    new Date(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23,
      59,
      59
    );

  el(
    "nextFortnightBtn"
  ).classList.toggle(
    "hidden",
    !finished
  );
}


function renderCalendar() {
  const today =
    localISO(
      new Date()
    );

  el(
    "calendarGrid"
  ).innerHTML =
    state.days
      .map(
        (
          day,
          index
        ) => {
          const paid =
            paidMinutes(day);

          const date =
            parseISO(
              day.date
            );

          const weekday =
            date.toLocaleDateString(
              "en-GB",
              {
                weekday:
                  "short"
              }
            );

          const logged =
            paid > 0;

          return `
            <button
              class="
                cal-cell
                ${
                  day.date === today
                    ? "today"
                    : ""
                }
                ${
                  day.off
                    ? "off"
                    : ""
                }
                ${
                  logged
                    ? "logged"
                    : ""
                }
              "
              data-cal="${index}"
              type="button"
            >
              <div class="dow">
                ${weekday}
                ·
                W${day.week}
              </div>

              <div class="date">
                ${date.getDate()}
              </div>

              <div class="cal-hours">
                ${
                  day.off
                    ? "OFF"
                    : (
                        logged
                          ? fmtHM(paid)
                          : "—"
                      )
                }
              </div>
            </button>
          `;
        }
      )
      .join("");

  document
    .querySelectorAll(
      "[data-cal]"
    )
    .forEach(button => {
      button.onclick =
        () =>
          openEditor(
            Number(
              button.dataset.cal
            )
          );
    });
}


function renderManageSummary() {
  const end =
    addDays(
      state.start,
      13
    );

  el(
    "manageRange"
  ).textContent =
    `${
      fmtDate(
        state.start,
        {
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      )
    } – ${
      fmtDate(
        end,
        {
          day: "numeric",
          month: "short",
          year: "numeric"
        }
      )
    }`;

  const offDate =
    state.offWeek === 1
      ? addDays(
          state.start,
          4
        )
      : addDays(
          state.start,
          11
        );

  el(
    "manageDayOff"
  ).textContent =
    `Non-working day: ${
      fmtDate(
        offDate,
        {
          weekday: "long",
          day: "numeric",
          month: "long"
        }
      )
    }`;
}


function renderOptionButtons(
  container,
  options,
  value,
  kind
) {
  el(container).innerHTML =
    options
      .map(option => {
        const label =
          kind === "break"
            ? `${option}m`
            : option;

        const className =
          kind === "break"
            ? "break-btn"
            : "time-btn";

        return `
          <button
            class="
              ${className}
              ${
                String(option) ===
                String(value)
                  ? "selected"
                  : ""
              }
            "
            data-value="${option}"
            type="button"
          >
            ${label}
          </button>
        `;
      })
      .join("");
}


function clearPresetSelection() {
  document
    .querySelectorAll(
      ".preset"
    )
    .forEach(
      button =>
        button.classList.remove(
          "selected"
        )
    );
}


function editorValue() {
  const start =
    document.querySelector(
      "#startButtons .selected"
    );

  const finish =
    document.querySelector(
      "#finishButtons .selected"
    );

  const breakButton =
    document.querySelector(
      "#breakButtons .selected"
    );

  return {
    start:
      start?.dataset.value ||
      "",

    finish:
      finish?.dataset.value ||
      "",

    break:
      Number(
        breakButton
          ?.dataset.value ||
        30
      ),

    note:
      el("dayNote")
        .value
        .trim()
  };
}


function refreshEditorTotal() {
  const temp = {
    ...editorValue(),
    off: false
  };

  const paid =
    paidMinutes(temp);

  el(
    "editorPaid"
  ).textContent =
    fmtHM(paid);

  const warning =
    el("dayWarning");

  let text = "";

  if (
    temp.start &&
    temp.finish &&
    timeToMin(
      temp.finish
    ) <=
    timeToMin(
      temp.start
    )
  ) {
    text =
      "Finish time must be later than start time.";
  }
  else if (
    paid > 540
  ) {
    text =
      "This is more than 9 paid hours.";
  }
  else if (
    paid > 0 &&
    paid < 360
  ) {
    text =
      "This is under 6 paid hours.";
  }

  warning.textContent =
    text;

  warning.classList.toggle(
    "hidden",
    !text
  );
}


function bindChoiceButtons(
  container
) {
  el(container)
    .querySelectorAll(
      "button"
    )
    .forEach(button => {
      button.onclick = () => {
        el(container)
          .querySelectorAll(
            "button"
          )
          .forEach(
            item =>
              item.classList.remove(
                "selected"
              )
          );

        button.classList.add(
          "selected"
        );

        clearPresetSelection();

        refreshEditorTotal();
      };
    });
}


function resetSheetScroll(
  sheetId
) {
  const sheet =
    el(sheetId);

  requestAnimationFrame(
    () => {
      sheet.scrollTop = 0;

      requestAnimationFrame(
        () => {
          sheet.scrollTop = 0;
        }
      );
    }
  );
}


function openEditor(index) {
  editingIndex =
    index;

  const day =
    state.days[index];

  el(
    "editorWeek"
  ).textContent =
    `Week ${day.week}`;

  el(
    "editorDate"
  ).textContent =
    fmtDate(
      day.date,
      {
        weekday: "long",
        day: "numeric",
        month: "long"
      }
    );

  el(
    "editorSheet"
  ).classList.remove(
    "hidden"
  );

  document.body.style.overflow =
    "hidden";

  el(
    "offDayPanel"
  ).classList.toggle(
    "hidden",
    !day.off
  );

  el(
    "workDayPanel"
  ).classList.toggle(
    "hidden",
    day.off
  );

  resetSheetScroll(
    "editorPanel"
  );

  if (
    day.off
  ) {
    return;
  }

  renderOptionButtons(
    "startButtons",
    startOptions,
    day.start || "07:30",
    "time"
  );

  renderOptionButtons(
    "finishButtons",
    finishOptions,
    day.finish || "16:30",
    "time"
  );

  renderOptionButtons(
    "breakButtons",
    breakOptions,
    day.break || 30,
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

  el(
    "dayNote"
  ).value =
    day.note || "";

  clearPresetSelection();

  for (
    const [
      key,
      preset
    ]
    of Object.entries(
      presets
    )
  ) {
    if (
      day.start ===
        preset.start &&
      day.finish ===
        preset.finish &&
      Number(day.break) ===
        preset.break
    ) {
      document
        .querySelector(
          `.preset[data-preset="${key}"]`
        )
        ?.classList.add(
          "selected"
        );

      break;
    }
  }

  refreshEditorTotal();
}


function closeEditor() {
  el(
    "editorSheet"
  ).classList.add(
    "hidden"
  );

  document.body.style.overflow =
    "";

  editingIndex =
    null;
}


function openManage() {
  renderManageSummary();

  el(
    "manageSheet"
  ).classList.remove(
    "hidden"
  );

  document.body.style.overflow =
    "hidden";
}


function closeManage() {
  el(
    "manageSheet"
  ).classList.add(
    "hidden"
  );

  document.body.style.overflow =
    "";
}


function archiveCurrentFortnight() {
  const history =
    loadHistory();

  const snapshot = {
    start:
      state.start,

    offWeek:
      state.offWeek,

    days:
      state.days,

    archivedAt:
      new Date().toISOString()
  };

  const alreadyExists =
    history.some(
      item =>
        item.start ===
        snapshot.start
    );

  if (
    !alreadyExists
  ) {
    history.push(
      snapshot
    );

    saveHistory(
      history
    );
  }
}


function startNextFortnight() {
  archiveCurrentFortnight();

  const newStart =
    addDays(
      state.start,
      14
    );

  const newOffWeek =
    state.offWeek === 1
      ? 2
      : 1;

  state = {
    configured: true,
    start:
      newStart,
    offWeek:
      newOffWeek,
    days:
      makeDays(
        newStart,
        newOffWeek
      )
  };

  persist();

  closeManage();

  window.scrollTo(
    {
      top: 0,
      behavior: "smooth"
    }
  );

  renderShell();
}


/* =========================
   SETUP CONTROLS
========================= */

document
  .querySelectorAll(
    ".choice-btn"
  )
  .forEach(button => {
    button.onclick = () => {
      state.offWeek =
        Number(
          button.dataset.off
            .replace(
              "week",
              ""
            )
        );

      renderSetupDates();
    };
  });


el(
  "prevMonday"
).onclick =
  () => {
    state.start =
      addDays(
        state.start,
        -7
      );

    renderSetupDates();
  };


el(
  "nextMonday"
).onclick =
  () => {
    state.start =
      addDays(
        state.start,
        7
      );

    renderSetupDates();
  };


el(
  "startDateButton"
).onclick =
  () => {
    const picker =
      el(
        "startDateNative"
      );

    if (
      typeof picker.showPicker ===
      "function"
    ) {
      picker.showPicker();
    }
    else {
      picker.click();
    }
  };


el(
  "startDateNative"
).onchange =
  event => {
    const value =
      event.target.value;

    if (
      !value
    ) {
      return;
    }

    state.start =
      mondayOf(value);

    renderSetupDates();
  };


el(
  "createFortnightBtn"
).onclick =
  () => {
    state.days =
      makeDays(
        state.start,
        state.offWeek
      );

    state.configured =
      true;

    persist();

    renderShell();
  };


/* =========================
   SETTINGS / MANAGE
========================= */

el(
  "settingsBtn"
).onclick =
  () => {
    if (
      state.configured
    ) {
      openManage();
    }
  };


el(
  "manageFortnightBtn"
).onclick =
  openManage;


el(
  "closeManage"
).onclick =
  closeManage;


el(
  "manageSheet"
).onclick =
  event => {
    if (
      event.target ===
      el("manageSheet")
    ) {
      closeManage();
    }
  };


el(
  "startNextBtn"
).onclick =
  () => {
    const confirmed =
      confirm(
        "Start the next fortnight? Your current fortnight will be saved in local history."
      );

    if (
      confirmed
    ) {
      startNextFortnight();
    }
  };


el(
  "nextFortnightBtn"
).onclick =
  () => {
    const confirmed =
      confirm(
        "Start the next fortnight? Your current fortnight will be saved in local history."
      );

    if (
      confirmed
    ) {
      startNextFortnight();
    }
  };


el(
  "changeSetupBtn"
).onclick =
  () => {
    const confirmed =
      confirm(
        "Change the current fortnight setup? Creating it again will reset the currently logged days."
      );

    if (
      !confirmed
    ) {
      return;
    }

    closeManage();

    state.configured =
      false;

    persist();

    renderShell();
  };


/* =========================
   DAY EDITOR
========================= */

el(
  "closeEditor"
).onclick =
  closeEditor;


el(
  "closeOffDayBtn"
).onclick =
  closeEditor;


el(
  "editorSheet"
).onclick =
  event => {
    if (
      event.target ===
      el("editorSheet")
    ) {
      closeEditor();
    }
  };


document
  .querySelectorAll(
    ".preset"
  )
  .forEach(button => {
    button.onclick = () => {
      const preset =
        presets[
          button.dataset.preset
        ];

      clearPresetSelection();

      button.classList.add(
        "selected"
      );

      renderOptionButtons(
        "startButtons",
        startOptions,
        preset.start,
        "time"
      );

      renderOptionButtons(
        "finishButtons",
        finishOptions,
        preset.finish,
        "time"
      );

      renderOptionButtons(
        "breakButtons",
        breakOptions,
        preset.break,
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

      el(
        "dayNote"
      ).value =
        preset.note;

      refreshEditorTotal();
    };
  });


el(
  "dayNote"
).oninput =
  refreshEditorTotal;


el(
  "saveDayBtn"
).onclick =
  () => {
    if (
      editingIndex === null
    ) {
      return;
    }

    const value =
      editorValue();

    if (
      !value.start ||
      !value.finish ||
      timeToMin(
        value.finish
      ) <=
      timeToMin(
        value.start
      )
    ) {
      el(
        "dayWarning"
      ).textContent =
        "Choose a valid start and finish time.";

      el(
        "dayWarning"
      ).classList.remove(
        "hidden"
      );

      return;
    }

    Object.assign(
      state.days[
        editingIndex
      ],
      value
    );

    persist();

    closeEditor();

    renderOverview();
    renderCalendar();
  };


el(
  "clearDayBtn"
).onclick =
  () => {
    if (
      editingIndex === null
    ) {
      return;
    }

    Object.assign(
      state.days[
        editingIndex
      ],
      {
        start: "",
        finish: "",
        break: 30,
        note: ""
      }
    );

    persist();

    closeEditor();

    renderOverview();
    renderCalendar();
  };


/* =========================
   START APP
========================= */

renderShell();


if (
  "serviceWorker" in navigator
) {
  window.addEventListener(
    "load",
    () => {
      navigator
        .serviceWorker
        .register(
          "./sw.js"
        )
        .catch(
          error =>
            console.log(
              "Service worker error:",
              error
            )
        );
    }
  );
}
