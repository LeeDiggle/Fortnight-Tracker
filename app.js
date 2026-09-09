const TARGET = 75 * 60;

const CURRENT_KEY = "fortnightTracker.v3";
const HISTORY_KEY = "fortnightTracker.history.v1";

const DASHBOARD_SYNC_KEY =
  "fortnightTracker.dashboardSync.v1";

const DEFAULT_DASHBOARD_ENDPOINT =
  "https://family-hallway-dashboard.humble-earth-9250.chatgpt.site/api/hours";

const DASHBOARD_SYNC_DEBOUNCE_MS = 900;

const LEGACY_CURRENT_KEYS = [
  "fortnightTracker.v4",
  "fortnightTracker.v2",
  "fortnightTracker.v1"
];


/* =========================
   PRESETS
========================= */

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
const ABSOLUTE_MAX_TIME = (23 * 60) + 45;
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
   BASIC HELPERS
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
   DATE HELPERS
========================= */

function localISO(date) {

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");

}


function parseISO(value) {

  const [
    year,
    month,
    day
  ] = value.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day,
    12,
    0,
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


function mondayOf(value) {

  const date = parseISO(value);

  const day = date.getDay();

  const distance =
    day === 0
      ? -6
      : 1 - day;

  date.setDate(
    date.getDate() + distance
  );

  return localISO(date);

}


function fmtDate(value, options = {}) {

  return new Intl.DateTimeFormat(
    "en-GB",
    options
  ).format(
    parseISO(value)
  );

}


function fortnightRangeText(start) {

  const end = addDays(
    start,
    13
  );

  const startDate = parseISO(start);
  const endDate = parseISO(end);

  const sameMonth =
    startDate.getMonth() === endDate.getMonth() &&
    startDate.getFullYear() === endDate.getFullYear();

  const sameYear =
    startDate.getFullYear() === endDate.getFullYear();


  if (sameMonth) {

    return (
      `${startDate.getDate()}–` +
      `${endDate.getDate()} ` +
      `${new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "numeric"
      }).format(endDate)}`
    );

  }


  if (sameYear) {

    return (
      `${new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short"
      }).format(startDate)} – ` +
      `${new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
      }).format(endDate)}`
    );

  }


  return (
    `${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(startDate)} – ` +
    `${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(endDate)}`
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
    value.split(":").map(Number);

  if (parts.length !== 2) {
    return null;
  }

  return (
    parts[0] * 60 +
    parts[1]
  );

}


function minToTime(minutes) {

  let value =
    Math.max(
      ABSOLUTE_MIN_TIME,
      Math.min(
        ABSOLUTE_MAX_TIME,
        minutes
      )
    );

  value =
    Math.round(value / 15) * 15;

  const hour =
    Math.floor(value / 60);

  const minute =
    value % 60;

  return (
    `${pad(hour)}:${pad(minute)}`
  );

}


function buildTimeOptions(
  min,
  max
) {

  const values = [];

  for (
    let value = min;
    value <= max;
    value += 15
  ) {

    values.push(
      minToTime(value)
    );

  }

  return values;

}


function ensureTimeInRange(
  value,
  range
) {

  const minutes =
    timeToMin(value);

  if (minutes === null) {
    return;
  }


  while (
    minutes < range.min &&
    range.min > ABSOLUTE_MIN_TIME
  ) {

    range.min =
      Math.max(
        ABSOLUTE_MIN_TIME,
        range.min - RANGE_STEP
      );

  }


  while (
    minutes > range.max &&
    range.max < ABSOLUTE_MAX_TIME
  ) {

    range.max =
      Math.min(
        ABSOLUTE_MAX_TIME,
        range.max + RANGE_STEP
      );

  }

}


function rawPaidMinutes(day) {

  const start =
    timeToMin(day.start);

  const finish =
    timeToMin(day.finish);


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
      Number(day.break || 0)
  );

}


function paidMinutes(day) {

  if (day.off) {
    return 0;
  }

  return rawPaidMinutes(day);

}


function fmtHM(minutes) {

  const rounded =
    Math.max(
      0,
      Math.round(minutes)
    );

  const hours =
    Math.floor(rounded / 60);

  const mins =
    rounded % 60;

  return (
    `${hours}h ${pad(mins)}m`
  );

}


function fmtCompactHM(minutes) {

  const rounded =
    Math.max(
      0,
      Math.round(minutes)
    );

  const hours =
    Math.floor(rounded / 60);

  const mins =
    rounded % 60;


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


  const offIndex =
    normalOffWeek === 1
      ? 4
      : 9;


  return offsets.map(
    (offset, index) => ({
      date: addDays(start, offset),
      start: "",
      finish: "",
      break: 30,
      note: "",
      off: index === offIndex
    })
  );

}


function blankState() {

  const today =
    localISO(new Date());

  const start =
    mondayOf(today);

  return {
    configured: false,
    start,
    normalOffWeek: 2,
    days: makeDays(
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
    !value.start
  ) {
    return null;
  }


  const result =
    clone(value);


  result.configured =
    result.configured !== false;


  result.start =
    mondayOf(
      result.start
    );


  if (
    result.normalOffWeek !== 1 &&
    result.normalOffWeek !== 2
  ) {

    if (
      result.offWeek === 1 ||
      result.offWeek === 2
    ) {

      result.normalOffWeek =
        result.offWeek;

    } else {

      result.normalOffWeek = 2;

    }

  }


  const defaultDays =
    makeDays(
      result.start,
      result.normalOffWeek
    );


  if (
    !Array.isArray(result.days) ||
    result.days.length !== 10
  ) {

    result.days =
      defaultDays;

  } else {

    result.days =
      result.days.map(
        (day, index) => ({

          date:
            day.date ||
            defaultDays[index].date,

          start:
            day.start || "",

          finish:
            day.finish || "",

          break:
            Number.isFinite(
              Number(day.break)
            )
              ? Number(day.break)
              : 30,

          note:
            day.note || "",

          off:
            Boolean(day.off)

        })
      );


    const hasOffDay =
      result.days.some(
        day => day.off
      );


    if (!hasOffDay) {

      const offIndex =
        result.normalOffWeek === 1
          ? 4
          : 9;

      result.days[offIndex].off =
        true;

    }

  }


  return result;

}


function loadCurrent() {

  const keys = [
    CURRENT_KEY,
    ...LEGACY_CURRENT_KEYS
  ];


  for (const key of keys) {

    try {

      const stored =
        localStorage.getItem(key);

      if (!stored) {
        continue;
      }

      const parsed =
        normaliseFortnight(
          JSON.parse(stored)
        );

      if (parsed) {
        return parsed;
      }

    } catch (error) {
      // Continue to next stored version.
    }

  }


  return blankState();

}


function loadHistory() {

  try {

    const stored =
      localStorage.getItem(
        HISTORY_KEY
      );

    if (!stored) {
      return [];
    }


    const parsed =
      JSON.parse(stored);


    if (!Array.isArray(parsed)) {
      return [];
    }


    return parsed
      .map(normaliseFortnight)
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.start.localeCompare(
            b.start
          )
      );

  } catch (error) {

    return [];

  }

}


let currentState =
  loadCurrent();


let history =
  loadHistory();


let editingIndex = null;
let pendingNwdIndex = null;


/* =========================
   DASHBOARD SYNC STORAGE
========================= */

function defaultDashboardSyncSettings() {

  return {
    endpoint:
      DEFAULT_DASHBOARD_ENDPOINT,
    connectionKey: "",
    sitesToken: "",
    lastSuccessfulSync: ""
  };

}


function loadDashboardSyncSettings() {

  const defaults =
    defaultDashboardSyncSettings();


  try {

    const stored =
      localStorage.getItem(
        DASHBOARD_SYNC_KEY
      );


    if (!stored) {
      return defaults;
    }


    const parsed =
      JSON.parse(stored);


    if (
      !parsed ||
      typeof parsed !== "object"
    ) {

      return defaults;

    }


    return {

      endpoint:
        typeof parsed.endpoint ===
        "string" &&
        parsed.endpoint.trim()
          ? parsed.endpoint.trim()
          : defaults.endpoint,

      connectionKey:
        typeof parsed.connectionKey ===
        "string"
          ? parsed.connectionKey
          : "",

      sitesToken:
        typeof parsed.sitesToken ===
        "string"
          ? parsed.sitesToken
          : "",

      lastSuccessfulSync:
        typeof parsed.lastSuccessfulSync ===
        "string"
          ? parsed.lastSuccessfulSync
          : ""

    };

  } catch (error) {

    return defaults;

  }

}


let dashboardSyncSettings =
  loadDashboardSyncSettings();


let dashboardSyncTimer = null;
let dashboardSyncInFlight = false;

let dashboardSyncMessage = {
  type: "",
  text: ""
};


/* =========================
   SETUP STATE
========================= */

let setupStart =
  currentState.start ||
  mondayOf(
    localISO(new Date())
  );


let setupOffWeek =
  currentState.normalOffWeek || 2;


/* =========================
   RESET STATE
========================= */

let resetStart =
  setupStart;


let resetOffWeek = 2;


/* =========================
   DASHBOARD SYNC HELPERS
========================= */

function persistDashboardSyncSettings() {

  localStorage.setItem(
    DASHBOARD_SYNC_KEY,
    JSON.stringify(
      dashboardSyncSettings
    )
  );

}


function dashboardSyncConfigured() {

  return Boolean(
    dashboardSyncSettings.endpoint &&
    dashboardSyncSettings.connectionKey &&
    dashboardSyncSettings.sitesToken
  );

}


function getDashboardFortnight() {

  if (
    !currentState ||
    currentState.configured === false
  ) {

    return null;

  }


  const actualCurrentStart =
    getActualCurrentStart();


  if (actualCurrentStart) {

    const actualCurrent =
      getFortnightByStart(
        actualCurrentStart
      );


    if (actualCurrent) {
      return actualCurrent;
    }

  }


  return currentState;

}


function buildDashboardPayload() {

  const fortnight =
    getDashboardFortnight();


  if (!fortnight) {
    return null;
  }


  const loggedMinutes =
    fortnight.days.reduce(
      (sum, day) =>
        sum +
        paidMinutes(day),
      0
    );


  const remainingMinutes =
    Math.max(
      0,
      TARGET -
      loggedMinutes
    );


  const today =
    localISO(
      new Date()
    );


  const remainingWorkingDays =
    fortnight.days.filter(
      day =>
        !day.off &&
        day.date >= today
    ).length;


  const averageMinutesNeeded =
    remainingWorkingDays > 0
      ? remainingMinutes /
        remainingWorkingDays
      : 0;


  const nonWorkingDates =
    fortnight.days
      .filter(
        day => day.off
      )
      .map(
        day => day.date
      );


  return {

    version: 1,

    fortnightStart:
      fortnight.start,

    fortnightEnd:
      addDays(
        fortnight.start,
        13
      ),

    targetMinutes:
      TARGET,

    loggedMinutes,

    remainingMinutes,

    percentage:
      TARGET > 0
        ? (
            loggedMinutes /
            TARGET
          ) * 100
        : 0,

    remainingWorkingDays,

    averageMinutesNeeded,

    nonWorkingDates

  };

}


function formatDashboardSyncTime(
  value
) {

  if (!value) {
    return "Never";
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Never";

  }


  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  ).format(date);

}


function renderDashboardSyncStatus() {

  const last =
    el(
      "dashboardSyncLast"
    );


  const status =
    el(
      "dashboardSyncStatus"
    );


  if (last) {

    last.textContent =
      formatDashboardSyncTime(
        dashboardSyncSettings
          .lastSuccessfulSync
      );

  }


  if (!status) {
    return;
  }


  status.className =
    "sync-message hidden";


  status.textContent = "";


  if (
    !dashboardSyncMessage.text
  ) {

    return;

  }


  status.textContent =
    dashboardSyncMessage.text;


  status.classList.remove(
    "hidden"
  );


  if (
    dashboardSyncMessage.type ===
    "success"
  ) {

    status.classList.add(
      "success"
    );

  } else if (
    dashboardSyncMessage.type ===
    "failure"
  ) {

    status.classList.add(
      "failure"
    );

  }

}


function readDashboardSyncFields() {

  const endpointField =
    el(
      "dashboardEndpoint"
    );


  const keyField =
    el(
      "dashboardConnectionKey"
    );


  const tokenField =
    el(
      "dashboardSitesToken"
    );


  if (
    endpointField
  ) {

    dashboardSyncSettings.endpoint =
      endpointField.value.trim();

  }


  if (
    keyField
  ) {

    dashboardSyncSettings.connectionKey =
      keyField.value.trim();

  }


  if (
    tokenField
  ) {

    dashboardSyncSettings.sitesToken =
      tokenField.value.trim();

  }


  persistDashboardSyncSettings();

}


function renderDashboardSyncFields() {

  const endpointField =
    el(
      "dashboardEndpoint"
    );


  const keyField =
    el(
      "dashboardConnectionKey"
    );


  const tokenField =
    el(
      "dashboardSitesToken"
    );


  if (endpointField) {

    endpointField.value =
      dashboardSyncSettings.endpoint ||
      DEFAULT_DASHBOARD_ENDPOINT;

  }


  if (keyField) {

    keyField.value =
      dashboardSyncSettings.connectionKey ||
      "";

  }


  if (tokenField) {

    tokenField.value =
      dashboardSyncSettings.sitesToken ||
      "";

  }


  renderDashboardSyncStatus();

}


function openDashboardSyncSheet() {

  renderDashboardSyncFields();


  el(
    "dashboardSyncSheet"
  ).classList.remove(
    "hidden"
  );


  el(
    "dashboardSyncPanel"
  ).scrollTop = 0;

}


function closeDashboardSyncSheet() {

  readDashboardSyncFields();


  el(
    "dashboardSyncSheet"
  ).classList.add(
    "hidden"
  );

}


function scheduleDashboardSync() {

  if (
    dashboardSyncTimer
  ) {

    clearTimeout(
      dashboardSyncTimer
    );

  }


  dashboardSyncTimer =
    setTimeout(
      () => {

        dashboardSyncTimer =
          null;


        if (
          !dashboardSyncConfigured()
        ) {

          return;

        }


        syncDashboard({
          manual: false
        });

      },
      DASHBOARD_SYNC_DEBOUNCE_MS
    );

}


async function syncDashboard(
  {
    manual = false
  } = {}
) {

  if (dashboardSyncInFlight) {

    if (manual) {

      dashboardSyncMessage = {
        type: "",
        text:
          "A dashboard sync is already in progress."
      };


      renderDashboardSyncStatus();

    }

    return;

  }


  readDashboardSyncFields();


  if (
    !dashboardSyncSettings.endpoint
  ) {

    if (manual) {

      dashboardSyncMessage = {
        type: "failure",
        text:
          "Enter the dashboard endpoint before syncing."
      };


      renderDashboardSyncStatus();

    }

    return;

  }


  if (
    !dashboardSyncSettings.connectionKey ||
    !dashboardSyncSettings.sitesToken
  ) {

    if (manual) {

      dashboardSyncMessage = {
        type: "failure",
        text:
          "Enter the dashboard connection key and Sites access token before syncing."
      };


      renderDashboardSyncStatus();

    }

    return;

  }


  const payload =
    buildDashboardPayload();


  if (!payload) {

    if (manual) {

      dashboardSyncMessage = {
        type: "failure",
        text:
          "There is no configured fortnight to send yet."
      };


      renderDashboardSyncStatus();

    }

    return;

  }


  dashboardSyncInFlight =
    true;


  const button =
    el(
      "syncDashboardBtn"
    );


  if (button) {

    button.disabled = true;

    button.textContent =
      "Syncing…";

  }


  if (manual) {

    dashboardSyncMessage = {
      type: "",
      text:
        "Sending current fortnight to the hallway dashboard…"
    };


    renderDashboardSyncStatus();

  }


  try {

    const response =
      await fetch(
        dashboardSyncSettings.endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "X-Dashboard-Key":
              dashboardSyncSettings
                .connectionKey,

            "OAI-Sites-Authorization":
              `Bearer ${dashboardSyncSettings.sitesToken}`
          },

          body:
            JSON.stringify(
              payload
            )
        }
      );


    if (!response.ok) {

      let detail = "";


      try {

        const text =
          await response.text();


        if (text) {

          detail =
            ` ${text.slice(
              0,
              180
            )}`;

        }

      } catch (error) {
        // Response body is optional.
      }


      throw new Error(
        `Dashboard returned ${response.status}.${detail}`
      );

    }


    dashboardSyncSettings
      .lastSuccessfulSync =
        new Date().toISOString();


    persistDashboardSyncSettings();


    dashboardSyncMessage = {
      type: "success",
      text:
        "Dashboard synced successfully."
    };


    renderDashboardSyncStatus();

  } catch (error) {

    const message =
      error &&
      error.message
        ? error.message
        : "Unable to reach the dashboard.";


    dashboardSyncMessage = {
      type: "failure",
      text:
        `Dashboard sync failed. Your tracker data is still saved locally. ${message}`
    };


    renderDashboardSyncStatus();

  } finally {

    dashboardSyncInFlight =
      false;


    if (button) {

      button.disabled = false;

      button.textContent =
        "Sync dashboard";

    }

  }

}


/* =========================
   PERSISTENCE
========================= */

function persistCurrent() {

  localStorage.setItem(
    CURRENT_KEY,
    JSON.stringify(
      currentState
    )
  );


  scheduleDashboardSync();

}


function persistHistory() {

  localStorage.setItem(
    HISTORY_KEY,
    JSON.stringify(
      history
    )
  );


  scheduleDashboardSync();

}


/* =========================
   FORTNIGHT COLLECTION
========================= */

function allFortnights() {

  const collection = [];


  history.forEach(
    fortnight => {

      if (
        fortnight &&
        fortnight.configured !== false
      ) {

        collection.push(
          fortnight
        );

      }

    }
  );


  if (
    currentState &&
    currentState.configured !== false
  ) {

    const existingIndex =
      collection.findIndex(
        fortnight =>
          fortnight.start ===
          currentState.start
      );


    if (existingIndex >= 0) {

      collection[existingIndex] =
        currentState;

    } else {

      collection.push(
        currentState
      );

    }

  }


  return collection.sort(
    (a, b) =>
      a.start.localeCompare(
        b.start
      )
  );

}


function getFortnightByStart(start) {

  return (
    allFortnights().find(
      fortnight =>
        fortnight.start === start
    ) || null
  );

}


function getLatestScheduledStart() {

  const collection =
    allFortnights();


  if (!collection.length) {
    return null;
  }


  return collection[
    collection.length - 1
  ].start;

}


function getActualCurrentStart() {

  const today =
    localISO(new Date());


  const collection =
    allFortnights();


  const match =
    collection.find(
      fortnight => {

        const end =
          addDays(
            fortnight.start,
            13
          );

        return (
          today >= fortnight.start &&
          today <= end
        );

      }
    );


  return match
    ? match.start
    : null;

}


function getDefaultViewStart() {

  const collection =
    allFortnights();


  if (!collection.length) {
    return null;
  }


  const actualCurrent =
    getActualCurrentStart();


  if (actualCurrent) {
    return actualCurrent;
  }


  const today =
    localISO(new Date());


  const firstFuture =
    collection.find(
      fortnight =>
        fortnight.start > today
    );


  if (firstFuture) {
    return firstFuture.start;
  }


  return collection[
    collection.length - 1
  ].start;

}


let viewedStart =
  currentState.configured === false
    ? null
    : getDefaultViewStart();


function getViewedFortnight() {

  if (!viewedStart) {
    return null;
  }

  return getFortnightByStart(
    viewedStart
  );

}


function getFortnightRelation(
  fortnight
) {

  if (!fortnight) {
    return "current";
  }


  const today =
    localISO(new Date());

  const end =
    addDays(
      fortnight.start,
      13
    );


  if (today < fortnight.start) {
    return "upcoming";
  }


  if (today > end) {
    return "past";
  }


  return "current";

}


function viewingActualCurrent() {

  const actualCurrent =
    getActualCurrentStart();


  return Boolean(
    actualCurrent &&
    viewedStart === actualCurrent
  );

}


function viewingLatestScheduled() {

  const latest =
    getLatestScheduledStart();


  return Boolean(
    latest &&
    viewedStart === latest
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
      normaliseFortnight(
        fortnight
      );

    persistCurrent();

    return;

  }


  const index =
    history.findIndex(
      item =>
        item.start ===
        fortnight.start
    );


  if (index >= 0) {

    history[index] =
      normaliseFortnight(
        fortnight
      );

  } else {

    history.push(
      normaliseFortnight(
        fortnight
      )
    );

  }


  history.sort(
    (a, b) =>
      a.start.localeCompare(
        b.start
      )
  );


  persistHistory();

}


/* =========================
   SETUP
========================= */

function renderSetupDates() {

  setupStart =
    mondayOf(
      setupStart
    );


  const week1Friday =
    addDays(
      setupStart,
      4
    );


  const week2Friday =
    addDays(
      setupStart,
      11
    );


  el("startDateButton").textContent =
    fmtDate(
      setupStart,
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );


  el("startDateNative").value =
    setupStart;


  el("week1FridayLabel").textContent =
    fmtDate(
      week1Friday,
      {
        day: "numeric",
        month: "short"
      }
    );


  el("week2FridayLabel").textContent =
    fmtDate(
      week2Friday,
      {
        day: "numeric",
        month: "short"
      }
    );


  document
    .querySelectorAll(
      "[data-off]"
    )
    .forEach(
      button => {

        const week =
          button.dataset.off ===
          "week1"
            ? 1
            : 2;


        button.classList.toggle(
          "selected",
          week === setupOffWeek
        );

      }
    );


  el("setupOffSummary").textContent =
    setupOffWeek === 1
      ? "W1 Fri"
      : "W2 Fri";

}


/* =========================
   RESET SHEET
========================= */

function renderResetDates() {

  resetStart =
    mondayOf(
      resetStart
    );


  const week1Friday =
    addDays(
      resetStart,
      4
    );


  const week2Friday =
    addDays(
      resetStart,
      11
    );


  el(
    "resetStartDateButton"
  ).textContent =
    fmtDate(
      resetStart,
      {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
      }
    );


  el(
    "resetStartDateNative"
  ).value =
    resetStart;


  el(
    "resetWeek1FridayLabel"
  ).textContent =
    fmtDate(
      week1Friday,
      {
        weekday: "short",
        day: "numeric",
        month: "short"
      }
    );


  el(
    "resetWeek2FridayLabel"
  ).textContent =
    fmtDate(
      week2Friday,
      {
        weekday: "short",
        day: "numeric",
        month: "short"
      }
    );


  document
    .querySelectorAll(
      "[data-reset-off]"
    )
    .forEach(
      button => {

        const week =
          button.dataset.resetOff ===
          "week1"
            ? 1
            : 2;


        button.classList.toggle(
          "selected",
          week === resetOffWeek
        );

      }
    );

}


function openResetSheet() {

  const viewed =
    getViewedFortnight();


  resetStart =
    viewed
      ? viewed.start
      : mondayOf(
          localISO(new Date())
        );


  resetOffWeek =
    currentState.normalOffWeek === 1
      ? 1
      : 2;


  renderResetDates();


  el(
    "resetSheet"
  ).classList.remove(
    "hidden"
  );


  el(
    "resetPanel"
  ).scrollTop = 0;

}


function closeResetSheet() {

  el(
    "resetSheet"
  ).classList.add(
    "hidden"
  );

}


function performTrackerReset() {

  const newStart =
    mondayOf(
      resetStart
    );


  const newOffWeek =
    resetOffWeek === 1
      ? 1
      : 2;


  /*
    Remove all tracker records,
    including legacy versions.

    Dashboard connection settings
    are deliberately retained.
  */

  localStorage.removeItem(
    CURRENT_KEY
  );

  localStorage.removeItem(
    HISTORY_KEY
  );


  LEGACY_CURRENT_KEYS.forEach(
    key => {
      localStorage.removeItem(key);
    }
  );


  history = [];


  currentState = {
    configured: true,
    start: newStart,
    normalOffWeek: newOffWeek,
    days: makeDays(
      newStart,
      newOffWeek
    )
  };


  viewedStart =
    newStart;


  setupStart =
    newStart;


  setupOffWeek =
    newOffWeek;


  pendingNwdIndex =
    null;


  editingIndex =
    null;


  persistCurrent();
  persistHistory();


  closeResetSheet();

  renderShell();

}


/* =========================
   HEADER NAVIGATION
========================= */

function renderFortnightNav() {

  const nav =
    el("fortnightNav");

  const setupRange =
    el("setupRange");


  if (
    !currentState ||
    currentState.configured === false
  ) {

    nav.classList.add(
      "hidden"
    );

    setupRange.classList.remove(
      "hidden"
    );

    return;

  }


  nav.classList.remove(
    "hidden"
  );

  setupRange.classList.add(
    "hidden"
  );


  const viewed =
    getViewedFortnight();


  if (!viewed) {
    return;
  }


  el(
    "fortnightRange"
  ).textContent =
    fortnightRangeText(
      viewed.start
    );


  const relation =
    getFortnightRelation(
      viewed
    );


  const badge =
    el("pastBadge");


  if (
    relation === "current"
  ) {

    badge.classList.add(
      "hidden"
    );

  } else {

    badge.classList.remove(
      "hidden"
    );

    badge.textContent =
      relation === "past"
        ? "Past fortnight"
        : "Upcoming fortnight";

  }


  const collection =
    allFortnights();


  const index =
    collection.findIndex(
      fortnight =>
        fortnight.start ===
        viewedStart
    );


  el(
    "prevFortnightBtn"
  ).disabled =
    index <= 0;


  el(
    "nextFortnightViewBtn"
  ).disabled =
    index < 0 ||
    index >=
      collection.length - 1;


  const actualCurrent =
    getActualCurrentStart();


  el(
    "returnCurrentBtn"
  ).classList.toggle(
    "hidden",
    !actualCurrent ||
      viewingActualCurrent()
  );

}


function moveFortnight(
  direction
) {

  const collection =
    allFortnights();


  const index =
    collection.findIndex(
      fortnight =>
        fortnight.start ===
        viewedStart
    );


  const nextIndex =
    index + direction;


  if (
    nextIndex < 0 ||
    nextIndex >=
      collection.length
  ) {

    return;

  }


  viewedStart =
    collection[nextIndex].start;


  renderTracker();

}


/* =========================
   PROGRESS
========================= */

function getStats(
  fortnight
) {

  const workingDays =
    fortnight.days.filter(
      day => !day.off
    );


  const worked =
    workingDays.reduce(
      (sum, day) =>
        sum +
        paidMinutes(day),
      0
    );


  const loggedDays =
    workingDays.filter(
      day =>
        Boolean(
          day.start &&
          day.finish
        )
    ).length;


  const remaining =
    Math.max(
      0,
      TARGET - worked
    );


  const unlogged =
    Math.max(
      0,
      workingDays.length -
      loggedDays
    );


  const average =
    unlogged > 0
      ? remaining / unlogged
      : 0;


  const percent =
    Math.max(
      0,
      Math.min(
        100,
        (worked / TARGET) * 100
      )
    );


  return {
    worked,
    remaining,
    workingDays:
      workingDays.length,
    loggedDays,
    unlogged,
    average,
    percent
  };

}


function renderOverview() {

  const fortnight =
    getViewedFortnight();


  if (!fortnight) {
    return;
  }


  const stats =
    getStats(
      fortnight
    );


  el(
    "progressHeadline"
  ).textContent =
    `${fmtHM(stats.worked)} of 75h`;


  el(
    "progressPercent"
  ).textContent =
    `${Math.round(
      stats.percent
    )}%`;


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
    String(
      stats.unlogged
    );


  el(
    "avgMetric"
  ).textContent =
    stats.unlogged > 0
      ? fmtHM(
          stats.average
        )
      : "—";


  const pace =
    el("paceMessage");


  pace.className =
    "pace-box neutral";


  if (
    stats.loggedDays === 0
  ) {

    pace.innerHTML =
      "<strong>Ready to start.</strong> Log your first working day to begin tracking your pace.";

    return;

  }


  if (
    stats.remaining === 0
  ) {

    pace.className =
      "pace-box good";

    pace.innerHTML =
      "<strong>Target reached.</strong> You have completed your 75 paid hours.";

    return;

  }


  if (
    stats.unlogged === 0 &&
    stats.remaining > 0
  ) {

    pace.className =
      "pace-box warn";

    pace.innerHTML =
      `<strong>${fmtHM(
        stats.remaining
      )} short.</strong> All nine working days have been logged.`;

    return;

  }


  if (
    stats.average <=
    (8 * 60) + 20
  ) {

    pace.className =
      "pace-box good";

    pace.innerHTML =
      `<strong>Comfortably on pace.</strong> You need an average of ${fmtHM(
        stats.average
      )} across the remaining ${stats.unlogged} working ${
        stats.unlogged === 1
          ? "day"
          : "days"
      }.`;

    return;

  }


  if (
    stats.average <=
    9 * 60
  ) {

    pace.className =
      "pace-box neutral";

    pace.innerHTML =
      `<strong>On track.</strong> You need an average of ${fmtHM(
        stats.average
      )} across the remaining ${stats.unlogged} working ${
        stats.unlogged === 1
          ? "day"
          : "days"
      }.`;

    return;

  }


  pace.className =
    "pace-box warn";

  pace.innerHTML =
    `<strong>Longer days needed.</strong> The remaining average is ${fmtHM(
      stats.average
    )} across ${stats.unlogged} working ${
      stats.unlogged === 1
        ? "day"
        : "days"
    }.`;

}


/* =========================
   CALENDAR
========================= */

function renderCalendar() {

  const fortnight =
    getViewedFortnight();


  if (!fortnight) {
    return;
  }


  const grid =
    el("calendarGrid");


  grid.innerHTML = "";


  const today =
    localISO(new Date());


  fortnight.days.forEach(
    (day, index) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "cal-cell";


      button.dataset.cal =
        String(index);


      if (
        day.date === today
      ) {

        button.classList.add(
          "today"
        );

      }


      if (day.off) {

        button.classList.add(
          "off"
        );

      }


      const rawPaid =
        rawPaidMinutes(day);


      if (
        !day.off &&
        rawPaid > 0
      ) {

        button.classList.add(
          "logged"
        );

      }


      const dow =
        fmtDate(
          day.date,
          {
            weekday: "short"
          }
        );


      const date =
        parseISO(
          day.date
        ).getDate();


      let hoursMarkup =
        '<span class="cal-hours">—</span>';


      if (day.off) {

        if (rawPaid > 0) {

          hoursMarkup =
            `<span class="cal-hours">
              <span class="cal-off-main">OFF</span>
              <span class="cal-off-saved">${fmtCompactHM(
                rawPaid
              )} saved</span>
            </span>`;

        } else {

          hoursMarkup =
            '<span class="cal-hours"><span class="cal-off-main">OFF</span></span>';

        }

      } else if (
        rawPaid > 0
      ) {

        hoursMarkup =
          `<span class="cal-hours">${fmtHM(
            rawPaid
          )}</span>`;

      }


      button.innerHTML =
        `<span class="dow">${dow}</span>
         <span class="date">${date}</span>
         ${hoursMarkup}`;


      button.addEventListener(
        "click",
        () => {
          openEditor(index);
        }
      );


      grid.appendChild(
        button
      );

    }
  );

}


/* =========================
   FORTNIGHT ACTION CARD
========================= */

function getCurrentNwdIndex(
  fortnight
) {

  return fortnight.days.findIndex(
    day => day.off
  );

}


function renderActionCard() {

  const fortnight =
    getViewedFortnight();


  if (!fortnight) {
    return;
  }


  const relation =
    getFortnightRelation(
      fortnight
    );


  el(
    "actionFortnightType"
  ).textContent =
    relation === "past"
      ? "Past fortnight"
      : relation === "upcoming"
        ? "Upcoming fortnight"
        : "Current fortnight";


  const nwdIndex =
    getCurrentNwdIndex(
      fortnight
    );


  if (nwdIndex >= 0) {

    el(
      "actionNwdDate"
    ).textContent =
      fmtDate(
        fortnight.days[
          nwdIndex
        ].date,
        {
          weekday: "short",
          day: "numeric",
          month: "short"
        }
      );

  } else {

    el(
      "actionNwdDate"
    ).textContent = "—";

  }


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
   NON-WORKING DAY
========================= */

function renderNwdPicker() {

  const fortnight =
    getViewedFortnight();


  if (!fortnight) {
    return;
  }


  const grid =
    el("nwdGrid");


  grid.innerHTML = "";


  fortnight.days.forEach(
    (day, index) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "nwd-day";


      button.dataset.nwd =
        String(index);


      if (
        index ===
        pendingNwdIndex
      ) {

        button.classList.add(
          "selected"
        );

      }


      const rawPaid =
        rawPaidMinutes(day);


      if (rawPaid > 0) {

        button.classList.add(
          "has-hours"
        );

      }


      const dow =
        fmtDate(
          day.date,
          {
            weekday: "short"
          }
        );


      const date =
        parseISO(
          day.date
        ).getDate();


      let status = "";


      if (
        index ===
        pendingNwdIndex
      ) {

        status =
          "Day off";

      } else if (
        rawPaid > 0
      ) {

        status =
          fmtCompactHM(
            rawPaid
          );

      }


      button.innerHTML =
        `<span class="nwd-dow">${dow}</span>
         <span class="nwd-date">${date}</span>
         <span class="nwd-status">${status}</span>`;


      button.addEventListener(
        "click",
        () => {

          pendingNwdIndex =
            index;

          renderNwdPicker();

        }
      );


      grid.appendChild(
        button
      );

    }
  );


  const selectedDay =
    fortnight.days[
      pendingNwdIndex
    ];


  const hasLoggedHours =
    selectedDay
      ? rawPaidMinutes(
          selectedDay
        ) > 0
      : false;


  el(
    "nwdWarning"
  ).classList.toggle(
    "hidden",
    !hasLoggedHours
  );

}


function openNwdPicker() {

  const fortnight =
    getViewedFortnight();


  if (!fortnight) {
    return;
  }


  pendingNwdIndex =
    getCurrentNwdIndex(
      fortnight
    );


  if (pendingNwdIndex < 0) {

    pendingNwdIndex =
      fortnight.normalOffWeek === 1
        ? 4
        : 9;

  }


  renderNwdPicker();


  el(
    "nwdSheet"
  ).classList.remove(
    "hidden"
  );


  el(
    "nwdPanel"
  ).scrollTop = 0;

}


function closeNwdPicker() {

  el(
    "nwdSheet"
  ).classList.add(
    "hidden"
  );

}


function saveNwdChange() {

  const fortnight =
    getViewedFortnight();


  if (
    !fortnight ||
    pendingNwdIndex === null
  ) {

    return;

  }


  const updated =
    clone(
      fortnight
    );


  updated.days.forEach(
    (day, index) => {

      day.off =
        index ===
        pendingNwdIndex;

    }
  );


  saveViewedFortnight(
    updated
  );


  closeNwdPicker();

  renderTracker();

}


/* =========================
   TRACKER RENDERING
========================= */

function renderTracker() {

  renderFortnightNav();
  renderOverview();
  renderCalendar();
  renderActionCard();

}


function renderShell() {

  const configured =
    currentState &&
    currentState.configured !== false;


  el(
    "setupView"
  ).classList.toggle(
    "hidden",
    configured
  );


  el(
    "trackerView"
  ).classList.toggle(
    "hidden",
    !configured
  );


  if (!configured) {

    setupStart =
      currentState.start ||
      mondayOf(
        localISO(new Date())
      );


    setupOffWeek =
      currentState.normalOffWeek ||
      2;


    renderSetupDates();

    renderFortnightNav();

    return;

  }


  if (
    !viewedStart ||
    !getFortnightByStart(
      viewedStart
    )
  ) {

    viewedStart =
      getDefaultViewStart();

  }


  renderTracker();

}


/* =========================
   HISTORY / NEXT FORTNIGHT
========================= */

function archiveCurrentFortnight() {

  if (
    !currentState ||
    currentState.configured === false
  ) {

    return;

  }


  const archived =
    clone(
      currentState
    );


  const existingIndex =
    history.findIndex(
      fortnight =>
        fortnight.start ===
        archived.start
    );


  if (existingIndex >= 0) {

    history[existingIndex] =
      archived;

  } else {

    history.push(
      archived
    );

  }


  history.sort(
    (a, b) =>
      a.start.localeCompare(
        b.start
      )
  );


  persistHistory();

}


function startNextFortnight() {

  if (
    !currentState ||
    currentState.configured === false
  ) {

    return;

  }


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
    configured: true,
    start: newStart,
    normalOffWeek,
    days: makeDays(
      newStart,
      normalOffWeek
    )
  };


  viewedStart =
    newStart;


  persistCurrent();

  renderShell();

}


function returnToCurrent() {

  const actualCurrent =
    getActualCurrentStart();


  if (!actualCurrent) {
    return;
  }


  viewedStart =
    actualCurrent;


  renderTracker();

}


/* =========================
   EDITOR
========================= */

function clearPresetSelection() {

  document
    .querySelectorAll(
      ".quick-preset"
    )
    .forEach(
      button => {

        button.classList.remove(
          "selected"
        );

      }
    );

}


function setPresetSelection(key) {

  clearPresetSelection();


  const button =
    document.querySelector(
      `.quick-preset[data-preset="${key}"]`
    );


  if (button) {

    button.classList.add(
      "selected"
    );

  }

}


function detectPreset() {

  const found =
    Object.entries(
      presets
    ).find(
      ([, preset]) =>
        preset.start ===
          editorStart &&
        preset.finish ===
          editorFinish &&
        preset.break ===
          editorBreak
    );


  if (found) {

    setPresetSelection(
      found[0]
    );

  } else {

    clearPresetSelection();

  }

}


function renderBreakButtons() {

  const holder =
    el("breakButtons");


  holder.innerHTML = "";


  breakOptions.forEach(
    minutes => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "break-btn";


      if (
        minutes ===
        editorBreak
      ) {

        button.classList.add(
          "selected"
        );

      }


      button.textContent =
        `${minutes}m`;


      button.addEventListener(
        "click",
        () => {

          editorBreak =
            minutes;

          renderBreakButtons();

          detectPreset();

          refreshEditorTotal();

        }
      );


      holder.appendChild(
        button
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


  const grid =
    isStart
      ? el("startButtons")
      : el("finishButtons");


  const label =
    isStart
      ? el("startTimeRange")
      : el("finishTimeRange");


  const earlierButton =
    isStart
      ? el("earlierStartBtn")
      : el("earlierFinishBtn");


  const laterButton =
    isStart
      ? el("laterStartBtn")
      : el("laterFinishBtn");


  ensureTimeInRange(
    value,
    range
  );


  label.textContent =
    `${minToTime(
      range.min
    )}–${minToTime(
      range.max
    )}`;


  grid.innerHTML = "";


  buildTimeOptions(
    range.min,
    range.max
  ).forEach(
    time => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        "time-btn";


      button.dataset.time =
        time;


      button.textContent =
        time;


      if (
        time === value
      ) {

        button.classList.add(
          "selected"
        );

      }


      button.addEventListener(
        "click",
        () => {

          if (isStart) {

            editorStart =
              button.dataset.time;

          } else {

            editorFinish =
              button.dataset.time;

          }


          renderEditorValues();

          detectPreset();

          refreshEditorTotal();


          if (isStart) {

            el(
              "startTimePicker"
            ).classList.add(
              "hidden"
            );

          } else {

            el(
              "finishTimePicker"
            ).classList.add(
              "hidden"
            );

          }

        }
      );


      grid.appendChild(
        button
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

  renderTimePicker(
    "start"
  );

  renderTimePicker(
    "finish"
  );

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

  const startPicker =
    el(
      "startTimePicker"
    );


  const finishPicker =
    el(
      "finishTimePicker"
    );


  if (type === "start") {

    const willOpen =
      startPicker.classList.contains(
        "hidden"
      );


    finishPicker.classList.add(
      "hidden"
    );


    startPicker.classList.toggle(
      "hidden",
      !willOpen
    );


    if (willOpen) {

      renderTimePicker(
        "start"
      );

    }

  } else {

    const willOpen =
      finishPicker.classList.contains(
        "hidden"
      );


    startPicker.classList.add(
      "hidden"
    );


    finishPicker.classList.toggle(
      "hidden",
      !willOpen
    );


    if (willOpen) {

      renderTimePicker(
        "finish"
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


  if (direction < 0) {

    range.min =
      Math.max(
        ABSOLUTE_MIN_TIME,
        range.min -
          RANGE_STEP
      );

  } else {

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
      editorBreak,

    note:
      el(
        "dayNote"
      ).value.trim()
  };

}


function refreshEditorTotal() {

  const value =
    editorValue();


  const minutes =
    rawPaidMinutes(
      value
    );


  el(
    "editorPaid"
  ).textContent =
    fmtHM(
      minutes
    );


  const warning =
    el("dayWarning");


  warning.classList.add(
    "hidden"
  );


  warning.textContent =
    "";


  const start =
    timeToMin(
      value.start
    );


  const finish =
    timeToMin(
      value.finish
    );


  if (
    start === null ||
    finish === null ||
    finish <= start
  ) {

    warning.textContent =
      "Finish time must be later than start time.";

    warning.classList.remove(
      "hidden"
    );

    return;

  }


  if (
    minutes > 9 * 60
  ) {

    warning.textContent =
      "This records more than 9 paid hours.";

    warning.classList.remove(
      "hidden"
    );

    return;

  }


  if (
    minutes < 6 * 60
  ) {

    warning.textContent =
      "This records fewer than 6 paid hours.";

    warning.classList.remove(
      "hidden"
    );

  }

}


function resetEditorScroll() {

  requestAnimationFrame(
    () => {

      el(
        "editorPanel"
      ).scrollTop = 0;

    }
  );

}


function openEditor(index) {

  const fortnight =
    getViewedFortnight();


  if (
    !fortnight ||
    !fortnight.days[index]
  ) {

    return;

  }


  editingIndex =
    index;


  const day =
    fortnight.days[index];


  const weekNumber =
    index <= 4
      ? 1
      : 2;


  el(
    "editorWeek"
  ).textContent =
    `Week ${weekNumber}`;


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

    resetEditorScroll();

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
    Number.isFinite(
      Number(day.break)
    )
      ? Number(day.break)
      : 30;


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
    day.note || "";


  renderEditorValues();

  detectPreset();

  refreshEditorTotal();

  resetEditorScroll();

}


function closeEditor() {

  closeTimePickers();


  el(
    "editorSheet"
  ).classList.add(
    "hidden"
  );


  editingIndex =
    null;

}


/* =========================
   EVENTS
========================= */

function bindEvents() {

  /*
    Initial setup
  */

  document
    .querySelectorAll(
      "[data-off]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            setupOffWeek =
              button.dataset.off ===
              "week1"
                ? 1
                : 2;

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

      setupStart =
        addDays(
          setupStart,
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

      setupStart =
        addDays(
          setupStart,
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

      const input =
        el(
          "startDateNative"
        );


      if (
        typeof input.showPicker ===
        "function"
      ) {

        input.showPicker();

      } else {

        input.click();

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


      setupStart =
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

      currentState = {
        configured: true,
        start:
          mondayOf(
            setupStart
          ),
        normalOffWeek:
          setupOffWeek,
        days:
          makeDays(
            mondayOf(
              setupStart
            ),
            setupOffWeek
          )
      };


      history = [];


      viewedStart =
        currentState.start;


      persistCurrent();

      persistHistory();

      renderShell();

    }
  );


  /*
    Fortnight navigation
  */

  el(
    "prevFortnightBtn"
  ).addEventListener(
    "click",
    () => {
      moveFortnight(-1);
    }
  );


  el(
    "nextFortnightViewBtn"
  ).addEventListener(
    "click",
    () => {
      moveFortnight(1);
    }
  );


  el(
    "returnCurrentBtn"
  ).addEventListener(
    "click",
    returnToCurrent
  );


  el(
    "returnCurrentActionBtn"
  ).addEventListener(
    "click",
    returnToCurrent
  );


  el(
    "startNextBtn"
  ).addEventListener(
    "click",
    startNextFortnight
  );


  /*
    NWD
  */

  el(
    "changeNwdBtn"
  ).addEventListener(
    "click",
    openNwdPicker
  );


  el(
    "closeNwd"
  ).addEventListener(
    "click",
    closeNwdPicker
  );


  el(
    "saveNwdBtn"
  ).addEventListener(
    "click",
    saveNwdChange
  );


  /*
    Dashboard sync
  */

  el(
    "dashboardSyncBtn"
  ).addEventListener(
    "click",
    openDashboardSyncSheet
  );


  el(
    "closeDashboardSync"
  ).addEventListener(
    "click",
    closeDashboardSyncSheet
  );


  el(
    "dashboardEndpoint"
  ).addEventListener(
    "input",
    () => {

      readDashboardSyncFields();

    }
  );


  el(
    "dashboardConnectionKey"
  ).addEventListener(
    "input",
    () => {

      readDashboardSyncFields();

    }
  );


  el(
    "dashboardSitesToken"
  ).addEventListener(
    "input",
    () => {

      readDashboardSyncFields();

    }
  );


  el(
    "syncDashboardBtn"
  ).addEventListener(
    "click",
    () => {

      syncDashboard({
        manual: true
      });

    }
  );


  /*
    Reset tracker
  */

  el(
    "resetTrackerBtn"
  ).addEventListener(
    "click",
    openResetSheet
  );


  el(
    "closeReset"
  ).addEventListener(
    "click",
    closeResetSheet
  );


  el(
    "cancelResetBtn"
  ).addEventListener(
    "click",
    closeResetSheet
  );


  el(
    "resetPrevMonday"
  ).addEventListener(
    "click",
    () => {

      resetStart =
        addDays(
          resetStart,
          -7
        );

      renderResetDates();

    }
  );


  el(
    "resetNextMonday"
  ).addEventListener(
    "click",
    () => {

      resetStart =
        addDays(
          resetStart,
          7
        );

      renderResetDates();

    }
  );


  el(
    "resetStartDateButton"
  ).addEventListener(
    "click",
    () => {

      const input =
        el(
          "resetStartDateNative"
        );


      if (
        typeof input.showPicker ===
        "function"
      ) {

        input.showPicker();

      } else {

        input.click();

      }

    }
  );


  el(
    "resetStartDateNative"
  ).addEventListener(
    "change",
    event => {

      if (
        !event.target.value
      ) {
        return;
      }


      resetStart =
        mondayOf(
          event.target.value
        );


      renderResetDates();

    }
  );


  document
    .querySelectorAll(
      "[data-reset-off]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            resetOffWeek =
              button.dataset.resetOff ===
              "week1"
                ? 1
                : 2;


            renderResetDates();

          }
        );

      }
    );


  el(
    "confirmResetBtn"
  ).addEventListener(
    "click",
    performTrackerReset
  );


  /*
    Day editor
  */

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
              presets[key];


            if (!preset) {
              return;
            }


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
    () => {

      openTimePicker(
        "start"
      );

    }
  );


  el(
    "finishTimeRow"
  ).addEventListener(
    "click",
    () => {

      openTimePicker(
        "finish"
      );

    }
  );


  el(
    "closeStartTimePicker"
  ).addEventListener(
    "click",
    () => {

      el(
        "startTimePicker"
      ).classList.add(
        "hidden"
      );

    }
  );


  el(
    "closeFinishTimePicker"
  ).addEventListener(
    "click",
    () => {

      el(
        "finishTimePicker"
      ).classList.add(
        "hidden"
      );

    }
  );


  el(
    "earlierStartBtn"
  ).addEventListener(
    "click",
    () => {

      expandTimeRange(
        "start",
        -1
      );

    }
  );


  el(
    "laterStartBtn"
  ).addEventListener(
    "click",
    () => {

      expandTimeRange(
        "start",
        1
      );

    }
  );


  el(
    "earlierFinishBtn"
  ).addEventListener(
    "click",
    () => {

      expandTimeRange(
        "finish",
        -1
      );

    }
  );


  el(
    "laterFinishBtn"
  ).addEventListener(
    "click",
    () => {

      expandTimeRange(
        "finish",
        1
      );

    }
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

      const fortnight =
        getViewedFortnight();


      if (
        !fortnight ||
        editingIndex === null
      ) {

        return;

      }


      const value =
        editorValue();


      const start =
        timeToMin(
          value.start
        );


      const finish =
        timeToMin(
          value.finish
        );


      if (
        start === null ||
        finish === null ||
        finish <= start
      ) {

        refreshEditorTotal();

        return;

      }


      const updated =
        clone(
          fortnight
        );


      updated.days[
        editingIndex
      ].start =
        value.start;


      updated.days[
        editingIndex
      ].finish =
        value.finish;


      updated.days[
        editingIndex
      ].break =
        value.break;


      updated.days[
        editingIndex
      ].note =
        value.note;


      saveViewedFortnight(
        updated
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

      const fortnight =
        getViewedFortnight();


      if (
        !fortnight ||
        editingIndex === null
      ) {

        return;

      }


      const updated =
        clone(
          fortnight
        );


      updated.days[
        editingIndex
      ].start =
        "";


      updated.days[
        editingIndex
      ].finish =
        "";


      updated.days[
        editingIndex
      ].break =
        30;


      updated.days[
        editingIndex
      ].note =
        "";


      saveViewedFortnight(
        updated
      );


      closeEditor();

      renderTracker();

    }
  );


  /*
    Tap backdrop to close sheets.
  */

  el(
    "editorSheet"
  ).addEventListener(
    "click",
    event => {

      if (
        event.target ===
        el("editorSheet")
      ) {

        closeEditor();

      }

    }
  );


  el(
    "nwdSheet"
  ).addEventListener(
    "click",
    event => {

      if (
        event.target ===
        el("nwdSheet")
      ) {

        closeNwdPicker();

      }

    }
  );


  el(
    "dashboardSyncSheet"
  ).addEventListener(
    "click",
    event => {

      if (
        event.target ===
        el("dashboardSyncSheet")
      ) {

        closeDashboardSyncSheet();

      }

    }
  );


  el(
    "resetSheet"
  ).addEventListener(
    "click",
    event => {

      if (
        event.target ===
        el("resetSheet")
      ) {

        closeResetSheet();

      }

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

      navigator.serviceWorker
        .register(
          "./sw.js"
        )
        .catch(
          () => {}
        );

    }
  );

}