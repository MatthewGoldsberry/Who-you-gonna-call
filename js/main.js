d3.csv('data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv')
.then(data => {
    console.log("number of items: " + data.length);

    data.forEach(d => {  //convert from string to number
      d.latitude = +d.LATITUDE; 
      d.longitude = +d.LONGITUDE;  
    });

    // Initialize chart and then show it
    leafletMap = new LeafletMap({ parentElement: '#my-map'}, data);


  })
  .catch(error => console.error(error));
