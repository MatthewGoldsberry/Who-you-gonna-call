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
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

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
      center: [39.145, -84.525],
      zoom: 11.5,
      minZoom: 11,
      maxZoom: 18, // if anymore than 18, leaflet images disappear
      layers: [vis.baseLayer]
    });

    //if you stopped here, you would just have a map

    //initialize svg for d3 to add to map
    L.svg({ clickable: true }).addTo(vis.theMap)// we have to make the svg layer clickable
    vis.overlay = d3.select(vis.theMap.getPanes().overlayPane)
    vis.svg = vis.overlay.select('svg').attr("pointer-events", "auto")

    //these are the city locations, displayed as a set of dots 
    vis.Dots = vis.svg.selectAll('circle')
      .data(vis.data)
      .join('circle')
      .attr("fill", "steelblue")  //---- TO DO- color by magnitude 
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
          .style('z-index', 1000000)
          // Format number with million and thousand separator
          //***** TO DO- change this tooltip to show useful information about the quakes
          .html(`<div class="tooltip-label">City: ${d.city}, Population ${d3.format(',')(d.population)}</div>`);

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
          .attr("fill", "steelblue") //change the fill  TO DO- change fill again
          .attr('r', 3) //change radius

        d3.select('#tooltip').style('opacity', 0);//turn off the tooltip

      })

    //handler here for updating the map, as you zoom in and out           
    vis.theMap.on("zoomend", function () {
      vis.updateVis();
    });

  }

  updateVis() {
    let vis = this;

    //want to see how zoomed in you are? 
    // console.log(vis.map.getZoom()); //how zoomed am I?
    //----- maybe you want to use the zoom level as a basis for changing the size of the points... ?


    //redraw based on new zoom- need to recalculate on-screen position
    vis.Dots
      .attr("cx", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).x)
      .attr("cy", d => vis.theMap.latLngToLayerPoint([d.latitude, d.longitude]).y)
      .attr("fill", "steelblue")  //---- TO DO- color by magnitude 
      .attr("r", 3);

  }


  renderVis() {
    let vis = this;

    //not using right now... 

  }
}