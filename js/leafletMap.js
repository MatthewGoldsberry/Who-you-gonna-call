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
      onSelectionChange: _config.onSelectionChange || (() => {}),
      onFilterChange: _config.onFilterChange || (() => {})
    }
    this.data = _data;
    this.colorBy = 'serviceType';
    this.mapBackground = 'street';
    this.currentBrushSelection = null; // Stores the current brush coordinate bounds
    this.selectedData = [];
    this.brushingEnabled = false;
    this.heatmapEnabled = false;
    this.transientHeatmapFilter = null;
    this.hiddenServiceTypes = new Set();
    this.serviceTypeColors = {
      'DUMPING':   '#e6194b',
      'GRAFFITI':  '#3cb44b',
      'LITTERING': '#f58231',
      'TIRES':     '#ffe119',
      'TRASH':     '#42d4f4',
      'VACANT':    '#911eb4'
    };
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

    // A canvas overlay is used for the heatmap, always present but only visible when toggled on
    vis.heatmapCanvas = vis.overlay.append('canvas')
      .attr('class', 'heatmap-canvas')
      .style('position', 'absolute')
      .style('top', 0)
      .style('left', 0)
      .style('pointer-events', 'none')
      .style('display', 'none');
    vis.heatmapCtx = vis.heatmapCanvas.node().getContext('2d');
    vis.heatmapPalette = vis.createHeatmapPalette();
    vis.resizeHeatmapCanvas();

        // create color scale dynamically for service types
    vis.colorScaleServiceType = d3.scaleOrdinal()
        .domain(Object.keys(vis.serviceTypeColors))
        .range(Object.values(vis.serviceTypeColors));

    // create color scale for agencies
    vis.colorScaleAgency = d3.scaleOrdinal(['#e6194b', '#42d4f4', '#4363d8', '#f58231', '#911eb4', '#3cb44b', '#ffe119']);

    // create color scale for the priority of request
    vis.colorScalePriority = d3.scaleOrdinal()
        .domain(['STANDARD', 'PRIORITY', 'HAZARDOUS', 'EMERGENCY'])
        .range(['#94a3b8', '#fbbf24', '#f97316', '#dc2626']);

    // 17-color high-contrast palette (taken from: https://sashamaps.net/docs/resources/20-colors/)
    const distinctColors = [
      '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', 
      '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#aaffc3', '#808000', '#ffd8b1'
    ];

    // create the categorical scales neighborhoods
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
      .attr("stroke", "black")
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr('base-r', vis.dynamicRadius)
      .attr('r', vis.dynamicRadius)
      .attr('class', d => `dot request-${d.SR_NUMBER}`)
      .on('mouseover', function (event, d) { 
        highlightRequest(d.SR_NUMBER);

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
      .on('mouseout', function () {
        unhighlightRequest();
        d3.select('#tooltip').style('opacity', 0);
      })
      .on('click', function(event, d) {
        // persist the selection of dot
        handleSelection(d.SR_NUMBER);
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
      vis.resizeHeatmapCanvas();
      vis.refreshBrushExtent();
      vis.updateHeatmap();
    });

    vis.buildLegend();
  }

  /**
   *  update the visualization 
   */
  updateVis() {
    let vis = this;

    // get zoom information for sizing of nodes
    const currentZoom = vis.theMap.getZoom();
    vis.dynamicRadius = currentZoom - 8;

    // redraw based on new zoom; need to recalculate on-screen position
    // In heatmap mode the circles remain in the DOM for shared highlight logic, but are hidden visually for easy switching between modes
    vis.Dots
      .style('display', vis.heatmapEnabled ? 'none' : null)
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("fill", d => vis.getColor(d))
      .attr("base-r", vis.dynamicRadius)
      .attr("r", (d, i, nodes) => {
          const isFocused = d3.select(nodes[i]).classed('focused');
          return isFocused ? vis.dynamicRadius + 2 : vis.dynamicRadius;
      })
      .attr("display", d => vis.hiddenServiceTypes.has(d.SR_TYPE) ? 'none' : null);


    if (vis.currentBrushSelection) {
      vis.applySelectionFromBounds(vis.currentBrushSelection, true);
    }
  // update heatmap on update to the map, even if hidden
    vis.updateHeatmap();

    highlightRequest();
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
      resetSelection();
      vis.config.onSelectionChange(null);
      vis.updateHeatmap();
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

    // Push brushed SR_NUMBERs into the shared selectedRequests and highlight selection
    selectedRequests = vis.selectedData.map(d => d.SR_NUMBER);
    highlightRequests();

    if (notify) {
      vis.config.onSelectionChange(vis.selectedData);
    }

    vis.updateHeatmap();
  }

  // Used to resize the heatmap canvas element to match the leaflet map
  resizeHeatmapCanvas() {
    let vis = this;
    const mapSize = vis.theMap.getSize();
    vis.heatmapCanvas
      .attr('width', mapSize.x)
      .attr('height', mapSize.y)
      .style('width', `${mapSize.x}px`)
      .style('height', `${mapSize.y}px`);
  }

  // Heatmap color stuff
  createHeatmapPalette() {
    const paletteCanvas = document.createElement('canvas');
    paletteCanvas.width = 256;
    paletteCanvas.height = 1;

    const paletteCtx = paletteCanvas.getContext('2d');
    const gradient = paletteCtx.createLinearGradient(0, 0, 256, 0);
    gradient.addColorStop(0.00, '#1e3a8a');
    gradient.addColorStop(0.25, '#0ea5e9');
    gradient.addColorStop(0.50, '#22c55e');
    gradient.addColorStop(0.75, '#facc15');
    gradient.addColorStop(1.00, '#dc2626');
    paletteCtx.fillStyle = gradient;
    paletteCtx.fillRect(0, 0, 256, 1);

    return paletteCtx.getImageData(0, 0, 256, 1).data;
  }

  clearHeatmap() {
    let vis = this;
    vis.heatmapCtx.clearRect(0, 0, vis.theMap.getSize().x, vis.theMap.getSize().y);
  }

  setHeatmapEnabled(enabled) {
    // Toggling heatmap mode only changes presentation; the underlying data and brush state are preserved.
    this.heatmapEnabled = enabled;
    this.heatmapCanvas.style('display', this.heatmapEnabled ? 'block' : 'none');
    this.Dots.style('display', this.heatmapEnabled ? 'none' : null);

    if (!this.heatmapEnabled) {
      this.transientHeatmapFilter = null;
      this.clearHeatmap();
    } else {
      this.updateHeatmap();
    }
  }

  toggleHeatmapMode() {
    this.setHeatmapEnabled(!this.heatmapEnabled);
    return this.heatmapEnabled;
  }

  setTransientHeatmapFilter(srNumbers = null) {
    // Linked hover interactions provide a list of SR_NUMBERs to preview in the heatmap temporarily.
    this.transientHeatmapFilter = srNumbers && srNumbers.length > 0 ? new Set(srNumbers) : null;
    this.updateHeatmap();
  }

  getHeatmapData() {
    let vis = this;
    const baseData = vis.currentBrushSelection ? vis.selectedData : vis.data;

    // exclude any service types hidden via the legend checkboxes
    const visibleData = vis.hiddenServiceTypes.size > 0
      ? baseData.filter(d => !vis.hiddenServiceTypes.has(d.SR_TYPE))
      : baseData;

    if (!vis.transientHeatmapFilter) {
      return visibleData;
    }

    // Get subset of data matching the filter so that the heatmap can reflect the linked interactions from leaflet
    return visibleData.filter(d => vis.transientHeatmapFilter.has(d.SR_NUMBER));
  }

  updateHeatmap() {
    let vis = this;

    if (!vis.heatmapEnabled || !vis.heatmapCtx) {
      return;
    }

    vis.resizeHeatmapCanvas();
    vis.clearHeatmap();

    const heatmapData = vis.getHeatmapData();
    if (heatmapData.length === 0) {
      return;
    }

    const mapSize = vis.theMap.getSize();
    const radius = Math.max(18, Math.round(vis.dynamicRadius * 7));
    const cellSize = Math.max(12, Math.round(radius / 2));
    const bins = new Map();

    heatmapData.forEach(d => {
      const point = vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]);
      const cellX = Math.round(point.x / cellSize);
      const cellY = Math.round(point.y / cellSize);
      const key = `${cellX}:${cellY}`;

      if (!bins.has(key)) {
        bins.set(key, { x: point.x, y: point.y, count: 0 });
      }

      bins.get(key).count += 1;
    });

    const aggregatedPoints = Array.from(bins.values());
    const maxCount = d3.max(aggregatedPoints, d => d.count) || 1;
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = mapSize.x;
    offscreenCanvas.height = mapSize.y;
    const offscreenCtx = offscreenCanvas.getContext('2d');

    // First paint grayscale intensity blobs to an offscreen canvas
    aggregatedPoints.forEach(d => {
      const intensity = d.count / maxCount;
      const gradient = offscreenCtx.createRadialGradient(d.x, d.y, 0, d.x, d.y, radius);
      gradient.addColorStop(0, `rgba(0, 0, 0, ${Math.min(0.95, 0.30 + intensity * 0.65)})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      offscreenCtx.fillStyle = gradient;
      offscreenCtx.fillRect(d.x - radius, d.y - radius, radius * 2, radius * 2);
    });

    const image = offscreenCtx.getImageData(0, 0, mapSize.x, mapSize.y);

    // Use palette to draw colors on the heatmap
    for (let i = 0; i < image.data.length; i += 4) {
      const alpha = image.data[i + 3];
      if (alpha === 0) {
        continue;
      }

      const paletteIndex = alpha * 4;
      image.data[i] = vis.heatmapPalette[paletteIndex];
      image.data[i + 1] = vis.heatmapPalette[paletteIndex + 1];
      image.data[i + 2] = vis.heatmapPalette[paletteIndex + 2];
      image.data[i + 3] = Math.min(230, alpha);
    }

    vis.heatmapCtx.putImageData(image, 0, 0);
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
      resetSelection();
      vis.config.onSelectionChange(null);
      vis.updateHeatmap();
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
   * Builds the floating service type legend panel with color pickers and visibility checkboxes.
   */
  buildLegend() {
    let vis = this;

    // get the list of service types from the color map
    const types = Object.keys(vis.serviceTypeColors);

    // create mapping between SR_TYPE and SR_TYPE_DESC to be added to the info buttons by service types
    const subtypeMap = new Map();
    types.forEach(type => subtypeMap.set(type, new Set()));
    vis.data.forEach(d => {
      if (subtypeMap.has(d.SR_TYPE) && d.SR_TYPE_DESC) {
        subtypeMap.get(d.SR_TYPE).add(d.SR_TYPE_DESC);
      }
    });

    // select the legend container and clear any previously rendered content
    const panel = d3.select('#service-type-legend');
    panel.html('');
    panel.append('div').attr('class', 'legend-title').text('Service Types');

    // create one row in the panel for each service type
    types.forEach(type => {

      // label each row with a consistent id for the checkbox handler to be able to find
      const row = panel.append('div')
        .attr('class', 'legend-row')
        .attr('id', `legend-row-${type}`);

      // color picker UI 
      row.append('input')
        .attr('type', 'color')
        .attr('class', 'legend-color-picker')
        .property('value', vis.serviceTypeColors[type])
        .on('change', function () { 
          // wait until user has submitted color change, updates are not done actively for performance reasons

          // persist the new hex value back into serviceTypeColors to keep it in sync
          vis.serviceTypeColors[type] = this.value;

          // rebuild scale's range from serviceTypeColors 
          vis.colorScaleServiceType.range(
            Object.keys(vis.serviceTypeColors).map(t => vis.serviceTypeColors[t])
          );

          // rerender dots
          vis.updateVis();

          // rerender service type bar chart to reflect updated colors
          if (typeof serviceTypeDistribution !== 'undefined' && serviceTypeDistribution) {
            serviceTypeDistribution.renderVis();
          }
        });

      // visibility checkbox
      row.append('input')
        .attr('type', 'checkbox')
        .attr('class', 'legend-checkbox')
        .property('checked', true)
        .on('change', function () {
          // remove type from hidden types if checkbox checked, else add it to hidden types
          if (this.checked) {
            vis.hiddenServiceTypes.delete(type);
          } else {
            vis.hiddenServiceTypes.add(type);
          }

          // strikethrough the service type name in the legend if the checkbox is not selected
          d3.select(`#legend-row-${type}`).classed('hidden', !this.checked);

          // rerender dots
          vis.updateVis();

          // send message to main.js to update data passed to all visualizations based on hidden types
          vis.config.onFilterChange(vis.hiddenServiceTypes);
        });

      row.append('span').attr('class', 'legend-label').text(type);

      // basic info icon html -- generated by Gemini
      const infoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`;

      // add an info icon about the data 
      const subtypes = [...subtypeMap.get(type)].sort();
      row.append('span')
        .attr('class', 'legend-info-icon')
        .html(infoSvg)
        .on('mouseover', function() {
          d3.select('#tooltip')
            .style('opacity', 1)
            .html(`
              <div class="tooltip-content">
                <strong>${type} includes:</strong><br>
                ${subtypes.map(s => `&bull; ${s}`).join('<br>')}
              </div>
            `);
        })
        .on('mousemove', function(event) {
          d3.select('#tooltip')
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', function() {
          d3.select('#tooltip').style('opacity', 0);
        });
    });
  }

  /**
   * determines the appropriate fill color for a given data point based on the current color by state
   * @param {Object} d 
   * @returns hex color code or valid CSS color string
   */
  getColor(d) {
    let vis = this;
    if (vis.colorBy === 'serviceType') return vis.colorScaleServiceType(d.SR_TYPE);
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