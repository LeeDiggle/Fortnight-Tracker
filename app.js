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


/* =========================
   FORTNIGHT DATA
========================= */

function makeDays(
  start,
  offWeek
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
    mondayOf(
      new Date()
    );

  return {
    configured: false,
    start,
    offWeek: 2,
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
        JSON.parse(raw);

      if (
        value &&
        value.start &&
        Array.isArray(
          value.days
        ) &&
        value.days.length === 10
      ) {
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
      .filter(
        item =>
          item &&
          item.start &&
          Array.isArray(
            item.days
          ) &&
          item.days.length === 10
      )
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
   REPAIR OLD ROLLOVER
========================= */

function repairLegacyRollover() {
  if (
    !currentState.configured ||
    history.length === 0
  ) {
    return;
  }

  const previous =
    history[
      history.length - 1
    ];

  if (
    currentState.start !==
    addDays(
      previous.start,
      14
    )
  ) {
    return;
  }

  if (
    currentState.offWeek ===
    previous.offWeek
  ) {
    return;
  }

  const friday1 =
    currentState.days[4] || {};

  const friday2 =
    currentState.days[9] || {};

  const fridayHasData =
    [
      friday1,
      friday2
    ].some(
      day =>
        day.start ||
        day.finish ||
        day.note
    );

  if (
    fridayHasData
  ) {
    return;
  }

  currentState.offWeek =
    previous.offWeek;

  currentState.days.forEach(
    (
      day,
      index
    ) => {
      day.off =
        (
          currentState.offWeek === 1 &&
          index === 4
        ) ||
        (
          currentState.offWeek === 2 &&
          index === 9
        );
    }
  );

  persistCurrent();
}

repairLegacyRollover();


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

function getDateCurrentStart() {
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

  if (current) {
    return current.start;
  }

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
  getDateCurrentStart();

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

function viewingDateCurrent() {
  return (
    viewedStart ===
    getDateCurrentStart()
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
    `W${currentState.offWeek} Fri`;

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
            currentState.offWeek
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

  el(
    "returnCurrentBtn"
  ).classList.toggle(
    "hidden",
    viewingDateCurrent()
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
    "workedMetric"
  ).textContent =
    fmtHM(
      stats.worked
    );

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

  const latest =
    getFortnightByStart(
      getLatestScheduledStart()
    );

  const latestEnd =
    latest
      ? parseISO(
          addDays(
            latest.start,
            13
          )
        )
      : null;

  const finished =
    latestEnd
      ? new Date() >
        new Date(
          latestEnd.getFullYear(),
          latestEnd.getMonth(),
          latestEnd.getDate(),
          23,
          59,
          59
        )
      : false;

  el(
    "nextFortnightBtn"
  ).classList.toggle(
    "hidden",
    !(
      viewingLatestScheduled() &&
      finished
    )
  );
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
                  paid > 0
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
                ${
                  day.off
                    ? "OFF"
                    : (
                        paid > 0
                          ? fmtHM(
                              paid
                            )
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
   MANAGE
========================= */

function renderManageSummary() {
  const viewed =
    getViewedFortnight();

  const relation =
    getFortnightRelation(
      viewed
    );

  const end =
    addDays(
      viewed.start,
      13
    );

  if (
    relation ===
    "current"
  ) {
    el(
      "manageType"
    ).textContent =
      "Current fortnight";
  }

  else if (
    relation ===
    "past"
  ) {
    el(
      "manageType"
    ).textContent =
      "Past fortnight";
  }

  else {
    el(
      "manageType"
    ).textContent =
      "Upcoming fortnight";
  }

  el(
    "manageRange"
  ).textContent =
    `${
      fmtDate(
        viewed.start,
        {
          day:
            "numeric",
          month:
            "short",
          year:
            "numeric"
        }
      )
    } – ${
      fmtDate(
        end,
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

  const offDate =
    viewed.offWeek === 1
      ? addDays(
          viewed.start,
          4
        )
      : addDays(
          viewed.start,
          11
        );

  el(
    "manageDayOff"
  ).textContent =
    `Non-working day: ${
      fmtDate(
        offDate,
        {
          weekday:
            "long",
          day:
            "numeric",
          month:
            "long"
        }
      )
    }`;

  /*
    A new fortnight is always
    created from the furthest
    scheduled fortnight.
  */
  el(
    "startNextBtn"
  ).classList.toggle(
    "hidden",
    !viewingLatestScheduled()
  );

  /*
    Setup changes are limited
    to the furthest scheduled
    fortnight so older records
    cannot accidentally be reset.
  */
  el(
    "changeSetupBtn"
  ).classList.toggle(
    "hidden",
    !viewingLatestScheduled()
  );

  el(
    "returnCurrentManageBtn"
  ).classList.toggle(
    "hidden",
    viewingDateCurrent()
  );
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

  requestAnimationFrame(
    () => {
      el(
        "managePanel"
      ).scrollTop = 0;
    }
  );
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


/* =========================
   TRACKER
========================= */

function renderTracker() {
  renderFortnightNav();
  renderOverview();
  renderCalendar();
  renderManageSummary();
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
  /*
    currentState is always the
    furthest-created fortnight.
  */
  archiveCurrentFortnight();

  const newStart =
    addDays(
      currentState.start,
      14
    );

  const offWeek =
    currentState.offWeek;

  currentState = {
    configured:
      true,

    start:
      newStart,

    offWeek,

    days:
      makeDays(
        newStart,
        offWeek
      )
  };

  /*
    When deliberately creating
    another future period, show
    the new one immediately.
  */
  viewedStart =
    newStart;

  persistCurrent();

  closeManage();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

  renderShell();
}

function returnToCurrent() {
  viewedStart =
    getDateCurrentStart();

  closeManage();

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
    paidMinutes(
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
            currentState.offWeek =
              Number(
                button.dataset.off
                  .replace(
                    "week",
                    ""
                  )
              );

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
          currentState.offWeek
        );

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
    "settingsBtn"
  ).addEventListener(
    "click",
    () => {
      if (
        currentState.configured
      ) {
        openManage();
      }
    }
  );


  el(
    "manageFortnightBtn"
  ).addEventListener(
    "click",
    openManage
  );


  el(
    "closeManage"
  ).addEventListener(
    "click",
    closeManage
  );


  el(
    "manageSheet"
  ).addEventListener(
    "click",
    event => {
      if (
        event.target ===
        el(
          "manageSheet"
        )
      ) {
        closeManage();
      }
    }
  );


  el(
    "returnCurrentManageBtn"
  ).addEventListener(
    "click",
    returnToCurrent
  );


  el(
    "startNextBtn"
  ).addEventListener(
    "click",
    confirmStartNext
  );


  el(
    "nextFortnightBtn"
  ).addEventListener(
    "click",
    confirmStartNext
  );


  el(
    "changeSetupBtn"
  ).addEventListener(
    "click",
    () => {
      if (
        !viewingLatestScheduled()
      ) {
        return;
      }

      const confirmed =
        confirm(
          "Change the latest scheduled fortnight setup? Creating it again will reset the logged days in that fortnight."
        );

      if (
        !confirmed
      ) {
        return;
      }

      closeManage();

      currentState.configured =
        false;

      persistCurrent();

      renderShell();
    }
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
