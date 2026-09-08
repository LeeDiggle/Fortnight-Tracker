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
   HOURS
========================= */

function timeToMin(value) {
  if (!value) {
    return null;
  }

  const parts =
    value
      .split(":")
      .map(Number);

  return (
    parts[0] * 60 +
    parts[1]
  );
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
   EDITOR
========================= */

function renderOptionButtons(
  containerId,
  options,
  value,
  kind
) {
  el(
    containerId
  ).innerHTML =
    options
      .map(
        option => {
          const selected =
            String(option) ===
            String(value)
              ? "selected"
              : "";

          const className =
            kind === "break"
              ? "break-btn"
              : "time-btn";

          const label =
            kind === "break"
              ? `${option}m`
              : option;

          return `
            <button
              class="${className} ${selected}"
              data-value="${option}"
              type="button"
            >
              ${label}
            </button>
          `;
        }
      )
      .join("");
}

function clearPresetSelection() {
  document
    .querySelectorAll(
      ".preset"
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
      start
        ? start.dataset.value
        : "",

    finish:
      finish
        ? finish.dataset.value
        : "",

    break:
      Number(
        breakButton
          ? breakButton.dataset.value
          : 30
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
    Object.assign(
      {
        off: false
      },
      editorValue()
    );

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
  containerId
) {
  el(
    containerId
  )
    .querySelectorAll(
      "button"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            el(
              containerId
            )
              .querySelectorAll(
                "button"
              )
              .forEach(
                item =>
                  item
                    .classList
                    .remove(
                      "selected"
                    )
              );

            button
              .classList
              .add(
                "selected"
              );

            clearPresetSelection();
            refreshEditorTotal();
          }
        );
      }
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

  renderOptionButtons(
    "startButtons",
    startOptions,
    day.start ||
    "07:30",
    "time"
  );

  renderOptionButtons(
    "finishButtons",
    finishOptions,
    day.finish ||
    "16:30",
    "time"
  );

  renderOptionButtons(
    "breakButtons",
    breakOptions,
    day.break ||
    30,
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
    day.note ||
    "";

  clearPresetSelection();

  Object
    .keys(
      presets
    )
    .some(
      key => {
        const preset =
          presets[key];

        if (
          day.start ===
          preset.start &&
          day.finish ===
          preset.finish &&
          Number(
            day.break
          ) ===
          preset.break
        ) {
          const button =
            document.querySelector(
              `.preset[data-preset="${key}"]`
            );

          if (
            button
          ) {
            button
              .classList
              .add(
                "selected"
              );
          }

          return true;
        }

        return false;
      }
    );

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
      ".preset"
    )
    .forEach(
      button => {
        button.addEventListener(
          "click",
          () => {
            const preset =
              presets[
                button.dataset.preset
              ];

            clearPresetSelection();

            button
              .classList
              .add(
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
          }
        );
      }
    );


  el(
    "dayNote"
  ).addEventListener(
    "input",
    refreshEditorTotal
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
