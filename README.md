# Africa Map Practice

A small, static map quiz for ACS 11 study. The learner identifies 25 countries in a shuffled round, gets visual and sound feedback, and sees a score summary at the end.

The practice list follows the names supplied for this study round. The misspelling “Zimbabwae” is displayed with the standard spelling “Zimbabwe.”

## Run locally

Serve the folder with a local web server (for example, `python -m http.server`) and open the local address in a browser. The map image and region index are included in the repository; no build step, mapping service, or API key is required. Sound is generated in the browser after an answer is clicked.

## GitHub Pages

In the repository, open **Settings → Pages**, set the build source to **Deploy from a branch**, select `main` and `/ (root)`, then save. GitHub Pages will publish `index.html` from the repository root.

## Study map

`africa-map.png` is the blank map image supplied for this study project. `map-region-index.png` is its matching click-region mask, generated from the enclosed country shapes so click feedback follows the displayed boundaries.
