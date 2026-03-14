let leafletMap;
let requestsPerNeighborhood;
let requestMethods;
let serviceDeptDistribution;
let priorityDistribution;

d3.csv('data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227.csv')
.then(data => {
    // TODO this is the temporary filter mentioned in level 1 description -- will need removed later good for testing
    data = data.filter(d => d.SR_TYPE === 'PTHOLE');

    // filter data down to separate rows with coords out for the leaflet map
    let missingCoordsCount = 0;
    let validData = [];
    data.forEach(d => {
        if (!d.LATITUDE || !d.LONGITUDE || d.LATITUDE.trim() === '' || d.LONGITUDE.trim() === '') {
            missingCoordsCount++;
        } else {
            d.latitude = +d.LATITUDE; 
            d.longitude = +d.LONGITUDE;
            validData.push(d);
        }  
    });

    // visually log how many elements were not mapped because of missing coordinates
    d3.select('#unmapped-count').text(missingCoordsCount);

    // initialize chart and then show it
    leafletMap = new LeafletMap({ parentElement: '#my-map'}, validData);
    leafletMap.updateVis();

    // initialize bar charts
    requestsPerNeighborhood = updateBarChart(data, 'NEIGHBORHOOD', requestsPerNeighborhood, '#requests-per-neighborhood', 'Service Requests by Neighborhood', 'Requests', 'vertical');
    requestMethods = updateBarChart(data, 'METHOD_RECEIVED', requestMethods, '#request-methods', 'Request Submission Methods', 'Requests', 'angled');
    serviceDeptDistribution = updateBarChart(data, 'DEPT_NAME', serviceDeptDistribution, '#service-dept-distribution', 'Department Workload Distribution', 'Requests', 'angled');
    priorityDistribution = updateBarChart(data, 'PRIORITY', priorityDistribution, '#priority-distribution', 'Requests by Priority Level', 'Requests');
  })
  .catch(error => console.error(error));
