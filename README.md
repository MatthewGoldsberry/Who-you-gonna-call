# Who-you-gonna-call

An interactive data visualization dashboard for exploring Cincinnati 311 non-emergency service requests — mapping visual disorder (dumping, graffiti, littering, tires, trash, and vacant buildings) across the city's neighborhoods.

**[View Live Application](https://visual-disorder-in-cincinnati.vercel.app/)** &nbsp;|&nbsp; **[View Documentation](https://matthewgoldsberry.github.io/portfolio/projects/who-you-gonna-call/)**

---

## Stack

- **D3.js v6** — bar charts, timeline, and brushing interactions
- **Leaflet.js**  — interactive map with D3 SVG overlay
- **Vanilla HTML/CSS/JS** — no framework or build step required
- **Python** — data preprocessing and subset creation

---

## Project Structure

```text
Who-you-gonna-call/
├── index.html                          # Entry point
├── js/
│   ├── main.js                         # App init, global state, render pipeline
│   ├── leafletMap.js                   # Map class (dots, brush, heatmap, color schemes)
│   ├── barchart.js                     # Bar chart class
│   ├── timeline.js                     # Timeline/area chart class
│   ├── interactions.js                 # UI event handlers (dropdowns, legend, swap)
│   ├── helpers.js                      # Utility functions
│   ├── d3.v6.min.js
│   ├── leaflet.js.map
│   └── leaflet.js
├── css/
│   ├── style.css                       # Custom CSS definitions
│   └── leaflet.css                     # Leaflet-specific CSS definitions
└── data/
    ├── Cincinnati_311_..._subset.csv   # Filtered dataset (used by app)
    ├── Cincinnati_311_....csv          # Full dataset
    ├── subset_creation.py              # Generates the subset from the full CSV
    ├── data_exploration.py             # Generates lists of values in specific columns
    ├── requirements.txt                # Listing of Python Packages used in scripts
    └── data_info.md                    # Data schema and transformation notes
```

---

## Running Locally

The app is static and will need to be hosted by an HTTP server.

```bash
git clone https://github.com/MatthewGoldsberry/Who-you-gonna-call.git
cd Who-you-gonna-call
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

Any static file server works (`npx http-server`, Live Server in VS Code, etc.).

---

## Data

The app loads `data/Cincinnati_311_..._subset.csv` on startup. This subset was filtered from the full `data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv` dataset to include six consolidated service types across 50 neighborhoods.

To regenerate the subset from the full CSV:

```bash
cd data
python -m venv .venv
.venv\Scripts\activate  # Mac: source .venv/bin/activate
pip install -r requirements.txt
python subset_creation.py
```

See [data/data_info.md](data/data_info.md) for the full schema and transformation details.

---

## Deployment

The live app is deployed on Vercel. Pushing to `main` triggers an automatic redeploy.

---

Contributors: Matthew Goldsberry & Isaac Dowdy
