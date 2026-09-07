const TARGET = 75 * 60;
const KEY = "fortnightTracker.v2";

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

const breakOptions = [30, 60, 90];

const el = id => document.getElementById(id);

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

  const parts = value
    .split("-")
    .map(Number);

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
  const date = parseISO(value);

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

  const weekday = d.getDay();

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
    const saved =
      JSON.parse(
        localStorage.getItem(KEY)
      );

    if (
      saved &&
      saved.start &&
      Array.isArray(saved.days) &&
      saved.days.length === 10
    ) {
      return saved;
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


let state = load();
let editingIndex = null;


function persist() {
  localStorage.setItem(
    KEY,
    JSON.stringify(state)
  );
}


function renderSetupDates() {
  const startButton =
    el("startDateButton");

  startButton.textContent =
    fmtDate(
      state.start,
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      }
    );

  el("startDateNative").value =
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

  if (state.configured) {
    renderOverview();
    renderCalendar();
  }
}


function renderOverview() {
  const worked =
    state.days.reduce(
      (total, day) =>
        total +
        paidMinutes(day),
      0
    );

  const remaining =
    Math.max(
      0,
      TARGET - worked
    );

  const unlogged =
    state.days.filter(
      day =>
        !day.off &&
        paidMinutes(day) === 0
    ).length;

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

  el(
    "progressHeadline"
  ).textContent =
    `${fmtHM(worked)} of 75h`;

  el(
    "progressPercent"
  ).textContent =
    `${percent}%`;

  el(
    "progressBar"
  ).style.width =
    `${percent}%`;

  el(
    "workedMetric"
  ).textContent =
    fmtHM(worked);

  el(
    "remainingMetric"
  ).textContent =
    fmtHM(remaining);

  el(
    "daysLeftMetric"
  ).textContent =
    unlogged;

  el(
    "avgMetric"
  ).textContent =
    fmtHM(average);

  const pace =
    el("paceMessage");

  pace.className =
    "pace-box";

  if (worked >= TARGET) {
    pace.classList.add(
      "good"
    );

    pace.innerHTML =
      `<strong>Target reached.</strong> ` +
      `You are ${
        fmtHM(
          worked - TARGET
        )
      } over 75 hours.`;
  }
  else if (
    average <= 540
  ) {
    pace.classList.add(
      average <= 500
        ? "good"
        : "warn"
    );

    pace.innerHTML =
      `<strong>${
        fmtHM(remaining)
      } remaining.</strong> ` +
      `Average ${
        fmtHM(average)
      } across ${unlogged} ` +
      `unlogged working day${
        unlogged === 1
          ? ""
          : "s"
      }.`;
  }
  else {
    pace.classList.add(
      "warn"
    );

    pace.innerHTML =
      `<strong>Catch-up needed.</strong> ` +
      `The remaining average is ${
        fmtHM(average)
      }, above a 9-hour paid day.`;
  }

  const today =
    localISO(
      new Date()
    );

  el("dayList").innerHTML =
    state.days
      .map(
        (day, index) => {
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

          const label =
            day.off
              ? "Non-working Friday"
              : (
                  day.note ||
                  (
                    paid
                      ? "Logged"
                      : "Not logged"
                  )
                );

          return `
            <button
              class="day-row"
              data-day="${index}"
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
              <div
                class="day-chip ${
                  day.date === today
                    ? "today"
                    : ""
                }"
              >
                <span>
                  ${weekday}
                </span>
                <strong>
                  ${date.getDate()}
                </strong>
              </div>

              <div class="day-main">
                <strong>
                  Week ${day.week}
                  ·
                  ${fmtDate(day.date)}
                </strong>

                <span>
                  ${label}
                </span>
              </div>

              <div
                class="
                  day-hours
                  ${
                    day.off
                      ? "off"
                      : ""
                  }
                "
              >
                ${
                  day.off
                    ? "OFF"
                    : (
                        paid
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
      "[data-day]"
    )
    .forEach(button => {
      button.onclick =
        () =>
          openEditor(
            Number(
              button.dataset.day
            )
          );
    });
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
        (day, index) => {
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
              "
              data-cal="${index}"
              style="
                color:inherit;
                text-align:left;
              "
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
                        paid
                          ? fmtHM(paid)
                          : ""
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

  if (day.off) {
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

  el("dayNote").value =
    day.note || "";

  clearPresetSelection();

  for (
    const [key, preset]
    of Object.entries(presets)
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

  editingIndex = null;
}


/* -------------------------
   SETUP CONTROLS
------------------------- */

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


el("prevMonday").onclick =
  () => {
    state.start =
      addDays(
        state.start,
        -7
      );

    renderSetupDates();
  };


el("nextMonday").onclick =
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

    if (!value) {
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


el("settingsBtn").onclick =
  () => {
    if (
      !state.configured
    ) {
      return;
    }

    const change =
      confirm(
        "Change the fortnight setup? Creating a new fortnight will reset the currently logged days."
      );

    if (!change) {
      return;
    }

    state.configured =
      false;

    persist();

    renderShell();
  };


/* -------------------------
   TABS
------------------------- */

document
  .querySelectorAll(
    ".seg"
  )
  .forEach(button => {
    button.onclick = () => {
      document
        .querySelectorAll(
          ".seg"
        )
        .forEach(
          item =>
            item.classList.toggle(
              "active",
              item === button
            )
        );

      el(
        "overviewTab"
      ).classList.toggle(
        "hidden",
        button.dataset.tab !==
          "overview"
      );

      el(
        "calendarTab"
      ).classList.toggle(
        "hidden",
        button.dataset.tab !==
          "calendar"
      );
    };
  });


/* -------------------------
   DAY EDITOR
------------------------- */

el(
  "closeEditor"
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

      el("dayNote").value =
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


/* -------------------------
   START APP
------------------------- */

renderShell();


if (
  "serviceWorker" in
  navigator
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
