# Space-LifeSpan-HIC-2026

This is the project repository for the 2026 Henrico Innovation Challenge, involving the team members Aasrith Jangala (myself), Mithun Sethuraman, Yuvan Nagireddy, and Ansh Shrivastava.

# license

All rights reserved. This project and its code are the exclusive property of Aasrith Jangala, Mithun Sethuraman, Yuvan Nagireddy, and Ansh Shrivastava. No permissions are granted for copying, modifying, or redistributing this work.

# installation

The responsive SpaceLifeSpan web prototype is in `www/`. Open `www/index.html` in a browser or serve the repository root with a local static web server. The app uses Leaflet/OpenStreetMap, satellite.js, and GSAP from CDNs. Public CelesTrak, NASA DONKI, and EONET requests run in the browser, with a six-hour local cache and clearly marked demo catalog data when a feed is unavailable.

For a local NASA key, copy `www/js/api-config.example.js` to `www/js/api-config.js` and put the key in that file. `api-config.js` is ignored by Git; the app uses NASA's `DEMO_KEY` when the local file is absent. Since a client-side app exposes its key to people who run it, use a server-side proxy for a public release.

Run `npm run format` to format the HTML, CSS, and JavaScript, or `npm run format:check` to check formatting.
