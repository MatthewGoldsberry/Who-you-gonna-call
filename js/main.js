d3.csv('data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv')
.then(data => {
    // TODO this is the temporary filter mentioned in level 1 description -- will need removed later
    const filteredData = data.filter(d => d.SR_TYPE === 'PTHOLE');

    filteredData.forEach(d => {  //convert from string to number
      d.latitude = +d.LATITUDE; 
      d.longitude = +d.LONGITUDE;  
    });

    // Initialize chart and then show it
    leafletMap = new LeafletMap({ parentElement: '#my-map'}, filteredData);


  })
  .catch(error => console.error(error));
