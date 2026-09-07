# 9-Day Fortnight Tracker

Static, mobile-first web app ready for GitHub Pages.

## What it does
- Set the Monday that starts Week 1.
- Choose Week 1 Friday or Week 2 Friday as the non-working day.
- Shows the whole fortnight as a dated calendar.
- Tap any working day to log or edit it.
- No scrolling-wheel time entry: use quick buttons.
- Presets:
  - Mon gym: 07:30–15:30, 30 min break = 7h30
  - Office: 07:30–16:30, 30 min break = 8h30
  - Cycle: 07:30–16:00, 30 min break = 8h
  - WFH long: 07:00–16:30, 30 min break = 9h
  - WFH + gym: 07:00–16:30, 90 min break = 8h
- Tracks 75-hour target, worked, remaining, days left and average needed.
- Stores data in the browser using localStorage.
- Includes a web-app manifest and service worker for Add to Home Screen / offline use.

## GitHub Pages
Upload all files in this folder to the root of a GitHub repository. Then enable:
Settings → Pages → Deploy from a branch → main → /(root)

No build step is required.
