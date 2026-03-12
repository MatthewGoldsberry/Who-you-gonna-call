class LeafletMap {

  /**
   * Class constructor with basic configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _data) {
    this.config = {
      parentElement: _config.parentElement,
    }
    this.data = _data;
    this.colorBy = 'neighborhood';
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // calculate the time to update in days, defaulting to 0
    vis.data.forEach(d => {
      const created = new Date(d.DATE_CREATED);
      const updated = new Date(d.DATE_LAST_UPDATE);
      d.timeToUpdate = (updated - created) / (1000 * 60 * 60 * 24);
      if (isNaN(d.timeToUpdate) || d.timeToUpdate < 0) d.timeToUpdate = 0;
    });

    // stadia alidade smooth Dark
    vis.stadiaUrl = 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}'
    vis.stadiaAttr = '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

    // base map layer; where the map is shown
    vis.baseLayer = L.tileLayer(vis.stadiaUrl, {
      id: 'stadia-image',
      attribution: vis.stadiaAttr,
      ext: 'png'
    });

    // initialize the map DOM object
    vis.theMap = L.map('my-map', {
      center: [39.145, -84.525], // Cincinnati's coords: 39.1031 N 84.5120 W
      zoom: 11.5,
      minZoom: 11,
      maxZoom: 18, // if anymore than 18, leaflet images disappear
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

    // temporary solution of just finding 17 distinct colors 
    const distinctColors = [
      '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', 
      '#fabebe', '#008080', '#e6beff', '#9a6324', '#fffac8', '#aaffc3', '#808000', '#ffd8b1'
    ];

    // with the distinct colors, create the scale for departments and neighborhoods
    vis.colorScaleAgency = d3.scaleOrdinal(distinctColors);
    vis.colorScaleNeighborhood = d3.scaleOrdinal(distinctColors);

    // preprocess the times and create a color scale for time to update
    const times = vis.data.map(d => d.timeToUpdate).sort(d3.ascending);
    const timeCap = d3.quantile(times, 0.95) || 30; // there are some outliers that need removed for the scaling to work nicely
    vis.colorScaleTime = d3.scaleSequential(t => d3.interpolateRdYlGn(1 - t)) // inverse reg-yellow-green scale
        .domain([0, timeCap])
        .clamp(true);

    // these are the city locations, displayed as a set of dots 
    vis.Dots = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr("stroke", "black")
      //Leaflet has to take control of projecting points. 
      //Here we are feeding the latitude and longitude coordinates to
      //leaflet so that it can project them on the coordinates of the view. 
      //the returned conversion produces an x and y point. 
      //We have to select the the desired one using .x or .y
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("r", d => 3)  // --- TO DO- want to make radius proportional to earthquake size? 
      .on('mouseover', function (event, d) { //function to add mouseover event
        d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
          .duration('150') //how long we are transitioning between the two states (works like keyframes)
          .attr("fill", "red") //change the fill
          .attr('r', 4); //change radius

        //create a tool tip
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
        //position the tooltip
        d3.select('#tooltip')
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY + 10) + 'px');
      })
      .on('mouseleave', function () { //function to add mouseover event
        d3.select(this).transition() //D3 selects the object we have moused over in order to perform operations on it
          .duration('150') //how long we are transitioning between the two states (works like keyframes)
          .attr("fill", d => vis.getColor(d))  
          .attr('r', 3) //change radius

        d3.select('#tooltip').style('opacity', 0); // turn off the tooltip

      })

    // handler here for updating the map, as you zoom in and out           
    vis.theMap.on("zoomend", function () {
      vis.updateVis();
    });

  }

  updateVis() {
    let vis = this;

    // redraw based on new zoom- need to recalculate on-screen position
    vis.Dots
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("fill", d => vis.getColor(d))
      .attr("r", 3);
  }

  getColor(d) {
    let vis = this;
    if (d === vis.data[0]) console.log("Current colorBy:", vis.colorBy, "Data Sample:", d);
    if (vis.colorBy === 'agency') return vis.colorScaleAgency(d.DEPT_NAME);
    if (vis.colorBy === 'neighborhood') return vis.colorScaleNeighborhood(d.NEIGHBORHOOD);
    if (vis.colorBy === 'priority') return vis.colorScalePriority(d.PRIORITY);
    if (vis.colorBy === 'time') return vis.colorScaleTime(d.timeToUpdate);
    return "steelblue";
  }
}