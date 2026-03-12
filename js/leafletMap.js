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
    }
    this.data = _data;
    this.colorBy = 'neighborhood';
    this.mapBackground = 'street';
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