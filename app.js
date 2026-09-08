const TARGET = 75 * 60;

const CURRENT_KEY = "fortnightTracker.v3";
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

const breakOptions = [
  30,
  45,
  60,
  75,
  90
];

const defaultStartRange = {
  min: 6 * 60,
  max: 10 * 60
};

const defaultFinishRange = {
  min: 15 * 60,
  max: 18 * 60
};

const ABSOLUTE_MIN_TIME = 0;
const ABSOLUTE_MAX_TIME = 23 * 60 + 45;
const RANGE_STEP = 60;

let startRange = {
  ...defaultStartRange
};

let finishRange = {
  ...defaultFinishRange
};

let editorStart = "07:30";
let editorFinish = "16:30";
let editorBreak = 30;


/* =========================
   HELPERS
========================= */

function el(id) {
  return document.getElementById(id);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function clone(value) {
  return JSON.parse(
    JSON.stringify(value)
  );
}


/* =========================
   DATES
========================= */

function localISO(date) {
  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}`;
}

function parseISO(value) {
  if (!value) {
    return new Date();
  }

  const parts =
    value
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

function addDays(
  value,
  amount
) {
  const date =
    parseISO(value);

  date.setDate(
    date.getDate() +
    amount
  );

  return localISO(date);
}

function mondayOf(value) {
  const date =
    value instanceof Date
      ? new Date(value)
      : parseISO(value);

  const weekday =
    date.getDay();

  date.setDate(
    date.getDate() +
    (
      weekday === 0
        ? -6
        : 1 - weekday
    )
  );

  return localISO(date);
}

function fmtDate(
  value,
  options
) {
  return parseISO(value)
    .toLocaleDateString(
      "en-GB",
      options || {
        weekday: "short",
        day: "numeric",
        month: "short"
      }
    );
}


/* =========================
   TIME HELPERS
========================= */

function timeToMin(value) {
  if (!value) {
    return null;
  }

  const parts =
    value
      .split(":")
      .map(Number);

  if (
    parts.length !== 2 ||
    parts.some(Number.isNaN)
  ) {
    return null;
  }

  return (
    parts[0] * 60 +
    parts[1]
  );
}

function minToTime(minutes) {
  const safe =
    Math.max(
      ABSOLUTE_MIN_TIME,
      Math.min(
        ABSOLUTE_MAX_TIME,
        Math.round(
          minutes / 15
        ) * 15
      )
    );

  const hours =
    Math.floor(
      safe / 60
    );

  const mins =
    safe % 60;

  return `${pad(hours)}:${pad(mins)}`;
}

function buildTimeOptions(
  min,
  max
) {
  const options = [];

  for (
    let value = min;
    value <= max;
    value += 15
  ) {
    options.push(
      minToTime(value)
    );
  }

  return options;
}

function ensureTimeInRange(
  value,
  range
) {
  const minutes =
    timeToMin(value);

  if (
    minutes === null
  ) {
    return;
  }

  if (
    minutes < range.min
  ) {
    range.min =
      Math.max(
        ABSOLUTE_MIN_TIME,
        Math.floor(
          minutes / RANGE_STEP
        ) * RANGE_STEP
      );
  }

  if (
    minutes > range.max
  ) {
    range.max =
      Math.min(
        ABSOLUTE_MAX_TIME,
        Math.ceil(
          minutes / RANGE_STEP
        ) * RANGE_STEP
      );
  }
}

function rawPaidMinutes(day) {
  if (
    !day ||
    !day.start ||
    !day.finish
  ) {
    return 0;
  }

  const start =
    timeToMin(
      day.start
    );

  const finish =
    timeToMin(
      day.finish
    );

  if (
    start === null ||
    finish === null ||
    finish <= start
  ) {
    return 0;
  }

  return Math.max(
    0,
    finish -
    start -
    Number(
      day.break || 0
    )
  );
}

function paidMinutes(day) {
  if (
    !day ||
    day.off
  ) {
    return 0;
  }

  return rawPaidMinutes(day);
}

function fmtHM(minutes) {
  const total =
    Math.max(
      0,
      Math.round(minutes)
    );

  const hours =
    Math.floor(
      total / 60
    );

  const mins =
    total % 60;

  return `${hours}h ${pad(mins)}m`;
}

function fmtCompactHM(minutes) {
  const total =
    Math.max(
      0,
      Math.round(minutes)
    );

  const hours =
    Math.floor(
      total / 60
    );

  const mins =
    total % 60;

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}


/* =========================
   FORTNIGHT DATA
========================= */

function makeDays(
  start,
  normalOffWeek
) {
  const offsets = [
    0,
    1,
    2,
    3,
    4,
    7,
    8,
    9,
    10,
    11
  ];

  return offsets.map(
    (
      offset,
      index
    ) => ({
      date:
        addDays(
          start,
          offset
        ),

      week:
        index < 5
          ? 1
          : 2,

      weekday:
        index % 5,

      off:
        (
          normalOffWeek === 1 &&
          index === 4
        ) ||
        (
          normalOffWeek === 2 &&
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
    mondayOf(
      new Date()
    );

  return {
    configured: false,
    start,
    offWeek: 2,
    normalOffWeek: 2,
    days:
      makeDays(
        start,
        2
      )
  };
}


/* =========================
   STORAGE
========================= */

function normaliseFortnight(value) {
  if (
    !value ||
    !value.start ||
    !Array.isArray(
      value.days
    ) ||
    value.days.length !== 10
  ) {
    return null;
  }

  const result =
    clone(value);

  if (
    result.normalOffWeek !== 1 &&
    result.normalOffWeek !== 2
  ) {
    result.normalOffWeek =
      result.offWeek === 1
        ? 1
        : 2;
  }

  result.offWeek =
    result.normalOffWeek;

  return result;
}

function loadCurrent() {
  const keys = [
    CURRENT_KEY,
    "fortnightTracker.v4",
    "fortnightTracker.v2",
    "fortnightTracker.v1"
  ];

  for (const key of keys) {
    try {
      const raw =
        localStorage.getItem(
          key
        );

      if (!raw) {
        continue;
      }

      const value =
        normaliseFortnight(
          JSON.parse(raw)
        );

      if (value) {
        return value;
      }
    }
    catch (error) {
      // Try next stored version.
    }
  }

  return blankState();
}

function loadHistory() {
  try {
    const raw =
      localStorage.getItem(
        HISTORY_KEY
      );

    const value =
      raw
        ? JSON.parse(raw)
        : [];

    if (
      !Array.isArray(value)
    ) {
      return [];
    }

    return value
      .map(
        item =>
          normaliseFortnight(
            item
          )
      )
      .filter(Boolean)
      .sort(
        (
          a,
          b
        ) =>
          a.start.localeCompare(
            b.start
          )
      );
  }
  catch (error) {
    return [];
  }
}

let currentState =
  loadCurrent();

let history =
  loadHistory();

let editingIndex =
  null;

let pendingNwdIndex =
  null;

function persistCurrent() {
  localStorage.setItem(
    CURRENT_KEY,
    JSON.stringify(
      currentState
    )
  );
}

function persistHistory() {
  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(
      history
    )
  );
}


/* =========================
   FORTNIGHT COLLECTION
========================= */

function allFortnights() {
  const items =
    history
      .filter(
        item =>
          item.start !==
          currentState.start
      )
      .map(
        item => ({
          start:
            item.start
        })
      );

  if (
    currentState.configured
  ) {
    items.push({
      start:
        currentState.start
    });
  }

  return items.sort(
    (
      a,
      b
    ) =>
      a.start.localeCompare(
        b.start
      )
  );
}

function getFortnightByStart(start) {
  if (
    start ===
    currentState.start
  ) {
    return currentState;
  }

  return (
    history.find(
      item =>
        item.start ===
        start
    ) ||
    null
  );
}

function getLatestScheduledStart() {
  const items =
    allFortnights();

  if (
    items.length === 0
  ) {
    return currentState.start;
  }

  return items[
    items.length - 1
  ].start;
}

function getActualCurrentStart() {
  const today =
    localISO(
      new Date()
    );

  const items =
    allFortnights();

  const current =
    items.find(
      item =>
        today >=
          item.start &&
        today <=
          addDays(
            item.start,
            13
          )
    );

  return current
    ? current.start
    : null;
}

function getDefaultViewStart() {
  const actual =
    getActualCurrentStart();

  if (actual) {
    return actual;
  }

  const today =
    localISO(
      new Date()
    );

  const items =
    allFortnights();

  const upcoming =
    items.find(
      item =>
        item.start >
        today
    );

  if (upcoming) {
    return upcoming.start;
  }

  if (
    items.length > 0
  ) {
    return items[
      items.length - 1
    ].start;
  }

  return currentState.start;
}

let viewedStart =
  getDefaultViewStart();

function getViewedFortnight() {
  return (
    getFortnightByStart(
      viewedStart
    ) ||
    currentState
  );
}

function getFortnightRelation(
  fortnight
) {
  const today =
    localISO(
      new Date()
    );

  const end =
    addDays(
      fortnight.start,
      13
    );

  if (
    today <
    fortnight.start
  ) {
    return "upcoming";
  }

  if (
    today >
    end
  ) {
    return "past";
  }

  return "current";
}

function viewingActualCurrent() {
  const actual =
    getActualCurrentStart();

  return (
    actual &&
    viewedStart ===
    actual
  );
}

function viewingLatestScheduled() {
  return (
    viewedStart ===
    getLatestScheduledStart()
  );
}

function saveViewedFortnight(
  fortnight
) {
  if (
    fortnight.start ===
    currentState.start
  ) {
    currentState =
      fortnight;

    persistCurrent();

    return;
  }

  const index =
    history.findIndex(
      item =>
        item.start ===
        fortnight.start
    );

  if (
    index >= 0
  ) {
    history[index] =
      fortnight;

    persistHistory();
  }
}


/* =========================
   SETUP
========================= */

function renderSetupDates() {
  el(
    "startDateButton"
  ).textContent =
    fmtDate(
      currentState.start,
      {
        weekday:
          "long",
        day:
          "numeric",
        month:
          "long",
        year:
          "numeric"
      }
    );

  el(
    "startDateNative"
  ).value =
    currentState.start;

  el(
    "week1FridayLabel"
  ).textContent =
    fmtDate(
      addDays(
        currentState.start,
        4
      )
    );

  el(
    "week2FridayLabel"
  ).textContent =
    fmtDate(
      addDays(
        currentState.start,
        11
      )
    );

  el(
    "setupOffSummary"
  ).textContent =
    `W${currentState.normalOffWeek} Fri`;

  document
    .querySelectorAll(
      ".choice-btn"
    )
    .forEach(
      button => {
        const week =
          Number(
            button.dataset.off
              .replace(
                "week",
                ""
              )
          );

        button
          .classList
          .toggle(
            "selected",
            week ===
            currentState.normalOffWeek
          );
      }
    );
}


/* =========================
   HEADER NAVIGATION
========================= */

function renderFortnightNav() {
  if (
    !currentState.configured
  ) {
    el(
      "fortnightNav"
    ).classList.add(
      "hidden"
    );

    el(
      "setupRange"
    ).classList.remove(
      "hidden"
    );

    return;
  }

  el(
    "fortnightNav"
  ).classList.remove(
    "hidden"
  );

  el(
    "setupRange"
  ).classList.add(
    "hidden"
  );

  const viewed =
    getViewedFortnight();

  const relation =
    getFortnightRelation(
      viewed
    );

  el(
    "fortnightRange"
  ).textContent =
    `${
      fmtDate(
        viewed.start,
        {
          day:
            "numeric",
          month:
            "short"
        }
      )
    } – ${
      fmtDate(
        addDays(
          viewed.start,
          13
        ),
        {
          day:
            "numeric",
          month:
            "short",
          year:
            "numeric"
        }
      )
    }`;

  const badge =
    el(
      "pastBadge"
    );

  if (
    relation ===
    "current"
  ) {
    badge.classList.add(
      "hidden"
    );
  }

  else {
    badge.classList.remove(
      "hidden"
    );

    badge.textContent =
      relation ===
      "past"
        ? "Past fortnight"
        : "Upcoming fortnight";
  }

  const actualCurrent =
    getActualCurrentStart();

  el(
    "returnCurrentBtn"
  ).classList.toggle(
    "hidden",
    !actualCurrent ||
    viewingActualCurrent()
  );

  const items =
    allFortnights();

  const index =
    items.findIndex(
      item =>
        item.start ===
        viewed.start
    );

  el(
    "prevFortnightBtn"
  ).disabled =
    index <= 0;

  el(
    "nextFortnightViewBtn"
  ).disabled =
    (
      index < 0 ||
      index >=
      items.length - 1
    );
}

function moveFortnight(
  direction
) {
  const items =
    allFortnights();

  const index =
    items.findIndex(
      item =>
        item.start ===
        viewedStart
    );

  const nextIndex =
    index +
    direction;

  if (
    nextIndex < 0 ||
    nextIndex >=
      items.length
  ) {
    return;
  }

  viewedStart =
    items[
      nextIndex
    ].start;

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  renderTracker();
}


/* =========================
   PROGRESS
========================= */

function getStats(
  fortnight
) {
  const worked =
    fortnight.days.reduce(
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
      TARGET -
      worked
    );

  const workingDays =
    fortnight.days.filter(
      day =>
        !day.off
    );

  const loggedDays =
    workingDays.filter(
      day =>
        paidMinutes(day) > 0
    );

  const unlogged =
    workingDays.length -
    loggedDays.length;

  return {
    worked,
    remaining,
    loggedDays,
    unlogged,

    average:
      unlogged
        ? remaining /
          unlogged
        : 0,

    percent:
      Math.min(
        100,
        Math.round(
          worked /
          TARGET *
          100
        )
      )
  };
}

function renderOverview() {
  const stats =
    getStats(
      getViewedFortnight()
    );

  el(
    "progressHeadline"
  ).textContent =
    `${fmtHM(
      stats.worked
    )} of 75h`;

  el(
    "progressPercent"
  ).textContent =
    `${stats.percent}%`;

  el(
    "progressBar"
  ).style.width =
    `${stats.percent}%`;

  el(
    "remainingMetric"
  ).textContent =
    fmtHM(
      stats.remaining
    );

  el(
    "daysLeftMetric"
  ).textContent =
    stats.unlogged;

  el(
    "avgMetric"
  ).textContent =
    fmtHM(
      stats.average
    );

  const pace =
    el(
      "paceMessage"
    );

  pace.className =
    "pace-box";

  if (
    stats.worked >=
    TARGET
  ) {
    pace
      .classList
      .add(
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
    stats.loggedDays.length ===
    0
  ) {
    pace
      .classList
      .add(
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
    const difference =
      stats.worked -
      (
        TARGET / 9
      ) *
      stats.loggedDays.length;

    if (
      difference >= 15
    ) {
      pace
        .classList
        .add(
          "good"
        );

      pace.innerHTML =
        `<strong>You're ahead.</strong> ` +
        `${
          fmtHM(
            stats.remaining
          )
        } remaining, averaging ${
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
      pace
        .classList
        .add(
          "warn"
        );

      pace.innerHTML =
        `<strong>You're slightly behind pace.</strong> ` +
        `${
          fmtHM(
            stats.remaining
          )
        } remaining, averaging ${
          fmtHM(
            stats.average
          )
        } across ${
          stats.unlogged
        } working days.`;
    }

    else {
      pace
        .classList
        .add(
          "neutral"
        );

      pace.innerHTML =
        `<strong>On track.</strong> ` +
        `${
          fmtHM(
            stats.remaining
          )
        } remaining, averaging ${
          fmtHM(
            stats.average
          )
        } across ${
          stats.unlogged
        } working days.`;
    }
  }
}


/* =========================
   CALENDAR
========================= */

function renderCalendar() {
  const viewed =
    getViewedFortnight();

  const today =
    localISO(
      new Date()
    );

  el(
    "calendarGrid"
  ).innerHTML =
    viewed.days
      .map(
        (
          day,
          index
        ) => {
          const paid =
            paidMinutes(day);

          const rawPaid =
            rawPaidMinutes(day);

          const date =
            parseISO(
              day.date
            );

          const weekday =
            date
              .toLocaleDateString(
                "en-GB",
                {
                  weekday:
                    "short"
                }
              );

          let hoursContent =
            "—";

          if (
            day.off
          ) {
            if (
              rawPaid > 0
            ) {
              hoursContent =
                `
                  <span class="cal-off-main">
                    OFF
                  </span>
                  <span class="cal-off-saved">
                    ${fmtCompactHM(rawPaid)} saved
                  </span>
                `;
            }

            else {
              hoursContent =
                `
                  <span class="cal-off-main">
                    OFF
                  </span>
                `;
            }
          }

          else if (
            paid > 0
          ) {
            hoursContent =
              fmtHM(
                paid
              );
          }

          return `
            <button
              class="
                cal-cell
                ${
                  day.date ===
                  today
                    ? "today"
                    : ""
                }
                ${
                  day.off
                    ? "off"
                    : ""
                }
                ${
                  rawPaid > 0
                    ? "logged"
                    : ""
                }
              "
              data-cal="${index}"
              type="button"
            >

              <div class="dow">
                ${weekday} · W${day.week}
              </div>

              <div class="date">
                ${date.getDate()}
              </div>

              <div class="cal-hours">
                ${hoursContent}
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
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () =>
            openEditor(
              Number(
                button.dataset.cal
              )
            )
        );
      }
    );
}


/* =========================
   ACTION CARD
========================= */

function renderActionCard() {
  const viewed =
    getViewedFortnight();

  const relation =
    getFortnightRelation(
      viewed
    );

  const offDay =
    viewed.days.find(
      day =>
        day.off
    );

  if (
    relation ===
    "current"
  ) {
    el(
      "actionFortnightType"
    ).textContent =
      "Current fortnight";
  }

  else if (
    relation ===
    "past"
  ) {
    el(
      "actionFortnightType"
    ).textContent =
      "Past fortnight";
  }

  else {
    el(
      "actionFortnightType"
    ).textContent =
      "Upcoming fortnight";
  }

  el(
    "actionNwdDate"
  ).textContent =
    offDay
      ? fmtDate(
          offDay.date,
          {
            weekday:
              "short",
            day:
              "numeric",
            month:
              "short"
          }
        )
      : "Not set";

  el(
    "startNextBtn"
  ).classList.toggle(
    "hidden",
    !viewingLatestScheduled()
  );

  const actualCurrent =
    getActualCurrentStart();

  el(
    "returnCurrentActionBtn"
  ).classList.toggle(
    "hidden",
    !actualCurrent ||
    viewingActualCurrent()
  );
}


/* =========================
   NON-WORKING DAY PICKER
========================= */

function getCurrentNwdIndex(
  fortnight
) {
  return fortnight.days.findIndex(
    day =>
      day.off
  );
}

function renderNwdPicker() {
  const viewed =
    getViewedFortnight();

  if (
    pendingNwdIndex === null
  ) {
    pendingNwdIndex =
      getCurrentNwdIndex(
        viewed
      );
  }

  el(
    "nwdGrid"
  ).innerHTML =
    viewed.days
      .map(
        (
          day,
          index
        ) => {
          const date =
            parseISO(
              day.date
            );

          const weekday =
            date
              .toLocaleDateString(
                "en-GB",
                {
                  weekday:
                    "short"
                }
              );

          const rawPaid =
            rawPaidMinutes(
              day
            );

          let status =
            `W${day.week}`;

          if (
            rawPaid > 0
          ) {
            status =
              fmtHM(
                rawPaid
              );
          }

          return `
            <button
              class="
                nwd-day
                ${
                  index ===
                  pendingNwdIndex
                    ? "selected"
                    : ""
                }
                ${
                  rawPaid > 0
                    ? "has-hours"
                    : ""
                }
              "
              data-nwd="${index}"
              type="button"
            >

              <span class="nwd-dow">
                ${weekday}
              </span>

              <span class="nwd-date">
                ${date.getDate()}
              </span>

              <span class="nwd-status">
                ${status}
              </span>

            </button>
          `;
        }
      )
      .join("");

  document
    .querySelectorAll(
      "[data-nwd]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            pendingNwdIndex =
              Number(
                button.dataset.nwd
              );

            renderNwdPicker();
          }
        );
      }
    );

  const selected =
    viewed.days[
      pendingNwdIndex
    ];

  const hasHours =
    selected &&
    rawPaidMinutes(
      selected
    ) > 0;

  el(
    "nwdWarning"
  ).classList.toggle(
    "hidden",
    !hasHours
  );
}

function openNwdPicker() {
  const viewed =
    getViewedFortnight();

  pendingNwdIndex =
    getCurrentNwdIndex(
      viewed
    );

  renderNwdPicker();

  el(
    "nwdSheet"
  ).classList.remove(
    "hidden"
  );

  document.body.style.overflow =
    "hidden";

  requestAnimationFrame(
    () => {
      el(
        "nwdPanel"
      ).scrollTop = 0;
    }
  );
}

function closeNwdPicker() {
  el(
    "nwdSheet"
  ).classList.add(
    "hidden"
  );

  document.body.style.overflow =
    "";

  pendingNwdIndex =
    null;
}

function saveNwdChange() {
  if (
    pendingNwdIndex === null
  ) {
    return;
  }

  const viewed =
    clone(
      getViewedFortnight()
    );

  viewed.days.forEach(
    (
      day,
      index
    ) => {
      day.off =
        index ===
        pendingNwdIndex;
    }
  );

  saveViewedFortnight(
    viewed
  );

  closeNwdPicker();

  renderTracker();
}


/* =========================
   TRACKER
========================= */

function renderTracker() {
  renderFortnightNav();
  renderOverview();
  renderCalendar();
  renderActionCard();
}

function renderShell() {
  el(
    "setupView"
  ).classList.toggle(
    "hidden",
    currentState.configured
  );

  el(
    "trackerView"
  ).classList.toggle(
    "hidden",
    !currentState.configured
  );

  renderSetupDates();
  renderFortnightNav();

  if (
    currentState.configured
  ) {
    renderTracker();
  }
}


/* =========================
   HISTORY / ROLLOVER
========================= */

function archiveCurrentFortnight() {
  const snapshot =
    clone(
      currentState
    );

  snapshot.archivedAt =
    new Date()
      .toISOString();

  const index =
    history.findIndex(
      item =>
        item.start ===
        snapshot.start
    );

  if (
    index >= 0
  ) {
    history[index] =
      snapshot;
  }

  else {
    history.push(
      snapshot
    );
  }

  history.sort(
    (
      a,
      b
    ) =>
      a.start.localeCompare(
        b.start
      )
  );

  persistHistory();
}

function startNextFortnight() {
  archiveCurrentFortnight();

  const newStart =
    addDays(
      currentState.start,
      14
    );

  const normalOffWeek =
    currentState.normalOffWeek === 1
      ? 1
      : 2;

  currentState = {
    configured:
      true,

    start:
      newStart,

    offWeek:
      normalOffWeek,

    normalOffWeek:
      normalOffWeek,

    days:
      makeDays(
        newStart,
        normalOffWeek
      )
  };

  viewedStart =
    newStart;

  persistCurrent();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  renderShell();
}

function returnToCurrent() {
  const actual =
    getActualCurrentStart();

  if (!actual) {
    return;
  }

  viewedStart =
    actual;

  closeNwdPicker();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  renderTracker();
}


/* =========================
   DAY EDITOR
========================= */

function clearPresetSelection() {
  document
    .querySelectorAll(
      ".quick-preset"
    )
    .forEach(
      button =>
        button
          .classList
          .remove(
            "selected"
          )
    );
}

function setPresetSelection(
  key
) {
  clearPresetSelection();

  const button =
    document.querySelector(
      `.quick-preset[data-preset="${key}"]`
    );

  if (button) {
    button
      .classList
      .add(
        "selected"
      );
  }
}

function detectPreset() {
  for (
    const [
      key,
      preset
    ] of Object.entries(
      presets
    )
  ) {
    if (
      editorStart ===
        preset.start &&
      editorFinish ===
        preset.finish &&
      Number(
        editorBreak
      ) ===
        preset.break
    ) {
      setPresetSelection(
        key
      );

      return;
    }
  }

  clearPresetSelection();
}

function renderBreakButtons() {
  el(
    "breakButtons"
  ).innerHTML =
    breakOptions
      .map(
        option => `
          <button
            class="break-btn ${
              Number(option) ===
              Number(editorBreak)
                ? "selected"
                : ""
            }"
            data-break="${option}"
            type="button"
          >
            ${option}m
          </button>
        `
      )
      .join("");

  el(
    "breakButtons"
  )
    .querySelectorAll(
      "[data-break]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            editorBreak =
              Number(
                button.dataset.break
              );

            renderBreakButtons();
            detectPreset();
            refreshEditorTotal();
          }
        );
      }
    );
}

function renderTimePicker(
  type
) {
  const isStart =
    type === "start";

  const range =
    isStart
      ? startRange
      : finishRange;

  const value =
    isStart
      ? editorStart
      : editorFinish;

  ensureTimeInRange(
    value,
    range
  );

  const grid =
    el(
      isStart
        ? "startButtons"
        : "finishButtons"
    );

  const label =
    el(
      isStart
        ? "startTimeRange"
        : "finishTimeRange"
    );

  const earlierButton =
    el(
      isStart
        ? "earlierStartBtn"
        : "earlierFinishBtn"
    );

  const laterButton =
    el(
      isStart
        ? "laterStartBtn"
        : "laterFinishBtn"
    );

  label.textContent =
    `${
      minToTime(
        range.min
      )
    }–${
      minToTime(
        range.max
      )
    }`;

  const options =
    buildTimeOptions(
      range.min,
      range.max
    );

  grid.innerHTML =
    options
      .map(
        option => `
          <button
            class="time-btn ${
              option === value
                ? "selected"
                : ""
            }"
            data-time="${option}"
            data-time-type="${type}"
            type="button"
          >
            ${option}
          </button>
        `
      )
      .join("");

  grid
    .querySelectorAll(
      "[data-time]"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            if (
              type ===
              "start"
            ) {
              editorStart =
                button.dataset.time;
            }

            else {
              editorFinish =
                button.dataset.time;
            }

            renderEditorValues();
            detectPreset();
            refreshEditorTotal();

            if (
              type ===
              "start"
            ) {
              el(
                "startTimePicker"
              ).classList.add(
                "hidden"
              );
            }

            else {
              el(
                "finishTimePicker"
              ).classList.add(
                "hidden"
              );
            }
          }
        );
      }
    );

  earlierButton.disabled =
    range.min <=
    ABSOLUTE_MIN_TIME;

  laterButton.disabled =
    range.max >=
    ABSOLUTE_MAX_TIME;
}

function renderEditorValues() {
  el(
    "startTimeValue"
  ).textContent =
    editorStart;

  el(
    "finishTimeValue"
  ).textContent =
    editorFinish;

  renderBreakButtons();
}

function closeTimePickers() {
  el(
    "startTimePicker"
  ).classList.add(
    "hidden"
  );

  el(
    "finishTimePicker"
  ).classList.add(
    "hidden"
  );
}

function openTimePicker(
  type
) {
  const startPanel =
    el(
      "startTimePicker"
    );

  const finishPanel =
    el(
      "finishTimePicker"
    );

  if (
    type ===
    "start"
  ) {
    const opening =
      startPanel.classList.contains(
        "hidden"
      );

    finishPanel.classList.add(
      "hidden"
    );

    if (opening) {
      renderTimePicker(
        "start"
      );

      startPanel.classList.remove(
        "hidden"
      );
    }

    else {
      startPanel.classList.add(
        "hidden"
      );
    }
  }

  else {
    const opening =
      finishPanel.classList.contains(
        "hidden"
      );

    startPanel.classList.add(
      "hidden"
    );

    if (opening) {
      renderTimePicker(
        "finish"
      );

      finishPanel.classList.remove(
        "hidden"
      );
    }

    else {
      finishPanel.classList.add(
        "hidden"
      );
    }
  }
}

function expandTimeRange(
  type,
  direction
) {
  const range =
    type === "start"
      ? startRange
      : finishRange;

  if (
    direction <
    0
  ) {
    range.min =
      Math.max(
        ABSOLUTE_MIN_TIME,
        range.min -
        RANGE_STEP
      );
  }

  else {
    range.max =
      Math.min(
        ABSOLUTE_MAX_TIME,
        range.max +
        RANGE_STEP
      );
  }

  renderTimePicker(
    type
  );
}

function editorValue() {
  return {
    start:
      editorStart,

    finish:
      editorFinish,

    break:
      Number(
        editorBreak
      ),

    note:
      el(
        "dayNote"
      )
        .value
        .trim()
  };
}

function refreshEditorTotal() {
  const temp =
    {
      off: false,
      ...editorValue()
    };

  const paid =
    rawPaidMinutes(
      temp
    );

  el(
    "editorPaid"
  ).textContent =
    fmtHM(paid);

  const warning =
    el(
      "dayWarning"
    );

  let text =
    "";

  const start =
    timeToMin(
      temp.start
    );

  const finish =
    timeToMin(
      temp.finish
    );

  if (
    start !== null &&
    finish !== null &&
    finish <= start
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

function resetEditorScroll() {
  requestAnimationFrame(
    () => {
      el(
        "editorPanel"
      ).scrollTop = 0;

      requestAnimationFrame(
        () => {
          el(
            "editorPanel"
          ).scrollTop = 0;
        }
      );
    }
  );
}

function openEditor(index) {
  editingIndex =
    index;

  const day =
    getViewedFortnight()
      .days[
        index
      ];

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
        weekday:
          "long",
        day:
          "numeric",
        month:
          "long"
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

  resetEditorScroll();

  if (
    day.off
  ) {
    return;
  }

  closeTimePickers();

  startRange = {
    ...defaultStartRange
  };

  finishRange = {
    ...defaultFinishRange
  };

  editorStart =
    day.start ||
    "07:30";

  editorFinish =
    day.finish ||
    "16:30";

  editorBreak =
    Number(
      day.break ||
      30
    );

  ensureTimeInRange(
    editorStart,
    startRange
  );

  ensureTimeInRange(
    editorFinish,
    finishRange
  );

  el(
    "dayNote"
  ).value =
    day.note ||
    "";

  renderEditorValues();
  detectPreset();
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

  closeTimePickers();

  editingIndex =
    null;
}


/* =========================
   EVENTS
========================= */

function confirmStartNext() {
  const confirmed =
    confirm(
      "Start the next fortnight? Existing fortnights will remain available."
    );

  if (
    confirmed
  ) {
    startNextFortnight();
  }
}

function bindEvents() {

  document
    .querySelectorAll(
      ".choice-btn"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const week =
              Number(
                button.dataset.off
                  .replace(
                    "week",
                    ""
                  )
              );

            currentState.offWeek =
              week;

            currentState.normalOffWeek =
              week;

            renderSetupDates();
          }
        );
      }
    );


  el(
    "prevMonday"
  ).addEventListener(
    "click",
    () => {
      currentState.start =
        addDays(
          currentState.start,
          -7
        );

      renderSetupDates();
    }
  );


  el(
    "nextMonday"
  ).addEventListener(
    "click",
    () => {
      currentState.start =
        addDays(
          currentState.start,
          7
        );

      renderSetupDates();
    }
  );


  el(
    "startDateButton"
  ).addEventListener(
    "click",
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
    }
  );


  el(
    "startDateNative"
  ).addEventListener(
    "change",
    event => {
      if (
        !event.target.value
      ) {
        return;
      }

      currentState.start =
        mondayOf(
          event.target.value
        );

      renderSetupDates();
    }
  );


  el(
    "createFortnightBtn"
  ).addEventListener(
    "click",
    () => {
      currentState.days =
        makeDays(
          currentState.start,
          currentState.normalOffWeek
        );

      currentState.offWeek =
        currentState.normalOffWeek;

      currentState.configured =
        true;

      viewedStart =
        currentState.start;

      persistCurrent();
      renderShell();
    }
  );


  el(
    "prevFortnightBtn"
  ).addEventListener(
    "click",
    () =>
      moveFortnight(
        -1
      )
  );


  el(
    "nextFortnightViewBtn"
  ).addEventListener(
    "click",
    () =>
      moveFortnight(
        1
      )
  );


  el(
    "returnCurrentBtn"
  ).addEventListener(
    "click",
    returnToCurrent
  );


  el(
    "changeNwdBtn"
  ).addEventListener(
    "click",
    openNwdPicker
  );


  el(
    "startNextBtn"
  ).addEventListener(
    "click",
    confirmStartNext
  );


  el(
    "returnCurrentActionBtn"
  ).addEventListener(
    "click",
    returnToCurrent
  );


  el(
    "closeNwd"
  ).addEventListener(
    "click",
    closeNwdPicker
  );


  el(
    "nwdSheet"
  ).addEventListener(
    "click",
    event => {
      if (
        event.target ===
        el(
          "nwdSheet"
        )
      ) {
        closeNwdPicker();
      }
    }
  );


  el(
    "saveNwdBtn"
  ).addEventListener(
    "click",
    saveNwdChange
  );


  el(
    "closeEditor"
  ).addEventListener(
    "click",
    closeEditor
  );


  el(
    "closeOffDayBtn"
  ).addEventListener(
    "click",
    closeEditor
  );


  el(
    "editorSheet"
  ).addEventListener(
    "click",
    event => {
      if (
        event.target ===
        el(
          "editorSheet"
        )
      ) {
        closeEditor();
      }
    }
  );


  document
    .querySelectorAll(
      ".quick-preset"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const key =
              button.dataset.preset;

            const preset =
              presets[
                key
              ];

            editorStart =
              preset.start;

            editorFinish =
              preset.finish;

            editorBreak =
              preset.break;

            el(
              "dayNote"
            ).value =
              preset.note;

            ensureTimeInRange(
              editorStart,
              startRange
            );

            ensureTimeInRange(
              editorFinish,
              finishRange
            );

            renderEditorValues();
            setPresetSelection(
              key
            );

            refreshEditorTotal();

            closeTimePickers();
          }
        );
      }
    );


  el(
    "startTimeRow"
  ).addEventListener(
    "click",
    () =>
      openTimePicker(
        "start"
      )
  );


  el(
    "finishTimeRow"
  ).addEventListener(
    "click",
    () =>
      openTimePicker(
        "finish"
      )
  );


  el(
    "closeStartTimePicker"
  ).addEventListener(
    "click",
    () =>
      el(
        "startTimePicker"
      ).classList.add(
        "hidden"
      )
  );


  el(
    "closeFinishTimePicker"
  ).addEventListener(
    "click",
    () =>
      el(
        "finishTimePicker"
      ).classList.add(
        "hidden"
      )
  );


  el(
    "earlierStartBtn"
  ).addEventListener(
    "click",
    () =>
      expandTimeRange(
        "start",
        -1
      )
  );


  el(
    "laterStartBtn"
  ).addEventListener(
    "click",
    () =>
      expandTimeRange(
        "start",
        1
      )
  );


  el(
    "earlierFinishBtn"
  ).addEventListener(
    "click",
    () =>
      expandTimeRange(
        "finish",
        -1
      )
  );


  el(
    "laterFinishBtn"
  ).addEventListener(
    "click",
    () =>
      expandTimeRange(
        "finish",
        1
      )
  );


  el(
    "dayNote"
  ).addEventListener(
    "input",
    () => {
      clearPresetSelection();
      refreshEditorTotal();
    }
  );


  el(
    "saveDayBtn"
  ).addEventListener(
    "click",
    () => {
      if (
        editingIndex ===
        null
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

      const viewed =
        clone(
          getViewedFortnight()
        );

      Object.assign(
        viewed.days[
          editingIndex
        ],
        value
      );

      saveViewedFortnight(
        viewed
      );

      closeEditor();
      renderTracker();
    }
  );


  el(
    "clearDayBtn"
  ).addEventListener(
    "click",
    () => {
      if (
        editingIndex ===
        null
      ) {
        return;
      }

      const viewed =
        clone(
          getViewedFortnight()
        );

      Object.assign(
        viewed.days[
          editingIndex
        ],
        {
          start: "",
          finish: "",
          break: 30,
          note: ""
        }
      );

      saveViewedFortnight(
        viewed
      );

      closeEditor();
      renderTracker();
    }
  );
}


/* =========================
   START
========================= */

persistCurrent();
persistHistory();

bindEvents();
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
          () => {}
        );
    }
  );
}