/**
 * Leaflet Visualization Implementation
 */


// definitions of the different map background sources adn their attributions
const mapBackgrounds = {
    light: {link: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'},
    dark: {link: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'},
    satellite: {link: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'},
    topo: {link: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, <br>Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'},
    street: {link: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'},
};


/**
 * class representing a Leaflet Map with D3 SVG data points
 */
class LeafletMap {

  /**
   * class constructor with basic Leaflet Map configuration
   * @param {Object} _config - configuration object containing the parent element selector
   * @param {Array<Object>} _data - dataset to be visualized
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
      onSelectionChange: _config.onSelectionChange || (() => {})
    }
    this.data = _data;
    this.colorBy = 'neighborhood';
    this.mapBackground = 'street';
    this.currentBrushSelection = null; // Stores the current brush coordinate bounds
    this.selectedData = [];
    this.brushingEnabled = false;
    this.initVis();
  }

  /**
   * initialize the Leaflet Map and D3 data points
   */
  initVis() {
    let vis = this;

    // TODO maybe move this to main because it may get reused?
    // calculate the time to update in days, defaulting to 0
    vis.data.forEach(d => {
      const created = new Date(d.DATE_CREATED);
      const updated = new Date(d.DATE_LAST_UPDATE);
      d.timeToUpdate = (updated - created) / (1000 * 60 * 60 * 24);
      if (isNaN(d.timeToUpdate) || d.timeToUpdate < 0) d.timeToUpdate = 0;
    });

    // base map layer; where the map is shown
    vis.baseLayer = L.tileLayer(mapBackgrounds[vis.mapBackground]["link"], {
      attribution: mapBackgrounds[vis.mapBackground]["attribution"],
      ext: 'png'
    });

    // initialize the map DOM object
    vis.theMap = L.map('my-map', {
      center: [39.145, -84.525], // Cincinnati's coords: 39.1031 N 84.5120 W
      zoom: 11.5,
      minZoom: 11,
      maxZoom: 18,
      zoomControl: false,
      layers: [vis.baseLayer]
    });

    // add zoom controls to the bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(vis.theMap);

    // initialize svg for d3 to add to map
    L.svg({ clickable: true }).addTo(vis.theMap)
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane)
    vis.svg = vis.overlay.select('svg').attr("pointer-events", "auto")

    // TODO some color theory work needs to be done here

    // create color scale for the priority of request
    vis.colorScalePriority = d3.scaleOrdinal()
        .domain(['STANDARD', 'PRIORITY', 'HAZARDOUS', 'EMERGENCY'])
        .range(['#94a3b8', '#fbbf24', '#f97316', '#dc2626']);

    // 17-color high-contrast palette (taken from: https://sashamaps.net/docs/resources/20-colors/)
    const distinctColors = [
      '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', 
      '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#aaffc3', '#808000', '#ffd8b1'
    ];

    // create the categorical scales for departments and neighborhoods
    vis.colorScaleAgency = d3.scaleOrdinal(distinctColors);
    vis.colorScaleNeighborhood = d3.scaleOrdinal(distinctColors);

    // preprocess the times and create a color scale for time to update
    const times = vis.data.map(d => d.timeToUpdate).sort(d3.ascending);
    const timeCap = d3.quantile(times, 0.95) || 30; // there are some outliers that need removed for the scaling to work nicely
    vis.colorScaleTime = d3.scaleSequential(t => d3.interpolateRdYlGn(1 - t)) // inverse reg-yellow-green scale
        .domain([0, timeCap])
        .clamp(true);

    // get zoom information for sizing of nodes
    const currentZoom = vis.theMap.getZoom();
    vis.dynamicRadius = currentZoom - 8;

    // these are the city locations, displayed as a set of dots 
    vis.Dots = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr('class', 'map-dot')
      .attr("stroke", "black")
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .on('mouseover', function (event, d) { 
        // function to add mouseover event
        d3.select(this).transition() 
          .duration('150')
          .attr("fill", "red")
          .attr('r', vis.dynamicRadius + 2);

        // create a tool tip
        d3.select('#tooltip')
          .style('opacity', 1)
          .html(`
            <div class="tooltip-content">
              <strong>Type:</strong> ${d.SR_TYPE}<br>
              <strong>Description:</strong> ${d.SR_TYPE_DESC}<br>
              <strong>Agency:</strong> ${d.DEPT_NAME}<br>
              <strong>Date Called:</strong> ${d.DATE_CREATED}<br>
              <strong>Last Updated:</strong> ${d.DATE_LAST_UPDATE}
            </div>
          `);

      })
      .on('mousemove', (event) => {
        // position the tooltip
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', function () {
        d3.select(this).transition() 
          .duration('150')
          .attr("fill", d => vis.getColor(d))  
          .attr('r', vis.dynamicRadius)

        d3.select('#tooltip').style('opacity', 0); // turn off the tooltip

      })

    // handler here for updating the map, as you zoom in and out           
    vis.theMap.on("zoomend", function () {
      vis.updateVis();
    });

    vis.brushG = vis.svg.append("g")
      .attr("class", "brush");

    // Initialize the D3 brush behavior
    vis.brush = d3.brush()
      .extent([[0, 0], [vis.theMap.getSize().x, vis.theMap.getSize().y]])
      .filter(event => vis.brushingEnabled && !event.button)
      .on('start end', function(event) {
        vis.handleBrush(event);
      });

    // Attach the brush to the SVG; initially hidden until brush mode is enabled
    vis.brushG.call(vis.brush);
    vis.brushG.style('display', 'none');

    vis.theMap.on('resize', () => {
      vis.refreshBrushExtent();
    });
  }

  

  /**
   *  update the visualization 
   */
  updateVis() {
    let vis = this;

    // get zoom information for sizing of nodes
    const currentZoom = vis.theMap.getZoom();
    vis.dynamicRadius = currentZoom - 8;

    // redraw based on new zoom- need to recalculate on-screen position
    vis.Dots
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("fill", d => vis.getColor(d))
      .attr("r", vis.dynamicRadius);


    if (vis.currentBrushSelection) {
      vis.applySelectionFromBounds(vis.currentBrushSelection, true);
    } else {
      vis.Dots
        .classed('selected', false)
        .attr('opacity', 1);
    }
  }

  /**
   * Handles brushing events and updates selected records.
   * @param {Object} event - D3 brush event containing {selection, type, ...}
   */
  handleBrush(event) {
    let vis = this;
    const selection = event.selection;

    // If selection is null (brush was cleared), reset everything
    if (!selection) {
      vis.currentBrushSelection = null;
      vis.selectedData = [];
      // Make all dots fully visible again
      vis.Dots
        .classed('selected', false)
        .attr('opacity', 1);
      // Notify linked visualizations (charts) to restore full dataset
      vis.config.onSelectionChange(null);
      return;
    }

    vis.currentBrushSelection = selection;
    vis.applySelectionFromBounds(selection, true);
  }

  /**
   * Applies selected styling to dots and optionally notifies linked charts.
   * Computes which data records fall within the brush rectangle bounds
   * @param {Array<Array<number>>} selection - [[x0, y0], [x1, y1]] brush bounds in screen coords
   * @param {boolean} notify - if true, calls onSelectionChange callback with selected data
   */
  applySelectionFromBounds(selection, notify = false) {
    let vis = this;
    const [[x0, y0], [x1, y1]] = selection;

    // Test each data record to see if it falls within the brush rectangle
    const selectedSet = new Set();
    vis.data.forEach(d => {
      // Convert lat/lon to current map screen coordinates
      const point = vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]);
      // Check if point is inside the brush bounds
      if (x0 <= point.x && point.x <= x1 && y0 <= point.y && point.y <= y1) {
        selectedSet.add(d);
      }
    });

    vis.selectedData = Array.from(selectedSet);

    // Update dot appearance: selected dots stay fully opaque with bold stroke,
    // unselected dots fade to 20% opacity
    vis.Dots
      .classed('selected', d => selectedSet.has(d))
      .attr('opacity', d => selectedSet.has(d) ? 1 : 0.2);

    // Notify any subscribers (dashboard) of the new selection
    if (notify) {
      vis.config.onSelectionChange(vis.selectedData);
    }
  }

  /**
   * Recalculates and updates the brush extent to match the current map view
   * @private
   */
  refreshBrushExtent() {
    let vis = this;
    // Update the brush's allowed area to match the current map size
    vis.brush.extent([[0, 0], [vis.theMap.getSize().x, vis.theMap.getSize().y]]);
    vis.brushG.call(vis.brush);

    // If there's an active selection, move it to the new bounds
    if (vis.currentBrushSelection) {
      vis.brushG.call(vis.brush.move, vis.currentBrushSelection);
    }
  }

  /**
   * Enables or disables brushing mode.
   * @param {boolean} enabled - true to turn on brush mode, false to turn it off
   */
  setBrushingEnabled(enabled) {
    let vis = this;
    vis.brushingEnabled = enabled;

    // Show/hide the brush SVG group based on enabled state
    vis.brushG.style('display', vis.brushingEnabled ? null : 'none');
    d3.select('#my-map').classed('brush-enabled', vis.brushingEnabled);

    if (vis.brushingEnabled) {
      // Disable all map interactions while in brush mode to avoid conflicts
      // TODO could be improved to find a way to allow the user to interact with the map in brush mode
      vis.theMap.dragging.disable();
      vis.theMap.boxZoom.disable();
      vis.theMap.doubleClickZoom.disable();
      vis.theMap.scrollWheelZoom.disable();
      vis.theMap.touchZoom.disable();
      vis.theMap.keyboard.disable();
    } else {
      vis.theMap.dragging.enable();
      vis.theMap.boxZoom.enable();
      vis.theMap.doubleClickZoom.enable();
      vis.theMap.scrollWheelZoom.enable();
      vis.theMap.touchZoom.enable();
      vis.theMap.keyboard.enable();

      vis.currentBrushSelection = null;
      vis.selectedData = [];
      vis.brushG.call(vis.brush.move, null);
      vis.Dots
        .classed('selected', false)
        .attr('opacity', 1);

      vis.config.onSelectionChange(null);
    }
  }

  /**
   * Toggles brushing mode on/off.
   * @returns {boolean} - true if brush mode is now enabled, false if disabled
   */
  toggleBrushingMode() {
    this.setBrushingEnabled(!this.brushingEnabled);
    return this.brushingEnabled;
  }

  /**
   * determines the appropriate fill color for a given data point based on the current color by state
   * @param {Object} d 
   * @returns hex color code or valid CSS color string
   */
  getColor(d) {
    let vis = this;
    if (vis.colorBy === 'agency') return vis.colorScaleAgency(d.DEPT_NAME);
    if (vis.colorBy === 'neighborhood') return vis.colorScaleNeighborhood(d.NEIGHBORHOOD);
    if (vis.colorBy === 'priority') return vis.colorScalePriority(d.PRIORITY);
    if (vis.colorBy === 'time') return vis.colorScaleTime(d.timeToUpdate);
    return "steelblue";
  }

  /**
   * swaps Leaflet base tile layer
   * @param {string} layerType -- key corresponding to the desired map in the mapBackgrounds dictionary
   */
  changeBackground(layerType) {
    let vis = this;

    // update mapBackground to be the new layer type of the map
    vis.mapBackground = layerType;

    // if the baseLayer is already initialized, remove it
    if (vis.baseLayer) {
        vis.theMap.removeLayer(vis.baseLayer);
    }

    // update baseLayer to the user specified layer
    vis.baseLayer = L.tileLayer(mapBackgrounds[vis.mapBackground].link, {
        attribution: mapBackgrounds[vis.mapBackground].attribution,
        ext: 'png'
    }).addTo(vis.theMap);
  }

}