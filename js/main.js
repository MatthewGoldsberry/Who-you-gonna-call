let leafletMap;
let timeline;
let requestsPerNeighborhood;
let requestMethods;
let serviceDeptDistribution;
let priorityDistribution;

let fullData = [];

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

    // Store the complete valid dataset globally for use during filtering
    fullData = validData;

    // visually log how many elements were not mapped because of missing coordinates
    d3.select('#unmapped-count').text(missingCoordsCount);

    // Function to re-render all dashboard visualizations with either filtered or full data
    function renderDashboard(filteredData = null) {
        const activeData = filteredData === null ? fullData : filteredData;

        // Update timeline with the active dataset
        timeline.data = activeData;
        timeline.updateVis();

        // Update all bar charts to reflect counts from the active dataset
        requestsPerNeighborhood = updateBarChart(activeData, 'NEIGHBORHOOD', requestsPerNeighborhood, '#requests-per-neighborhood', 'Neighborhood', 'Service Requests by Neighborhood', 'Requests', 'vertical', 'linear');
        requestMethods = updateBarChart(activeData, 'METHOD_RECEIVED', requestMethods, '#request-methods', 'Submission Method', 'Request Submission Methods', 'Requests', 'angled', 'log');
        serviceDeptDistribution = updateBarChart(activeData, 'DEPT_NAME', serviceDeptDistribution, '#service-dept-distribution', 'Public Agency', 'Service Requests by Public Agency', 'Requests', 'angled', 'sqrt');
        priorityDistribution = updateBarChart(activeData, 'PRIORITY', priorityDistribution, '#priority-distribution', 'Priority Level', 'Requests by Priority Level', 'Requests', 'horizontal', 'sqrt');
    }

    // initialize chart and then show it
    leafletMap = new LeafletMap({
        parentElement: '#my-map',
        onSelectionChange: selectedData => {
            if (selectedData === null) {
                renderDashboard(null);
            } else {
                renderDashboard(selectedData);
            }
        }
    }, validData);
    leafletMap.updateVis();
  
    // initialize the timeline 
    timeline = new Timeline({ parentElement: '#timeline-chart'}, validData);
    timeline.updateVis();

    // initialize bar charts
        requestsPerNeighborhood = updateBarChart(validData, 'NEIGHBORHOOD', requestsPerNeighborhood, '#requests-per-neighborhood', 'Neighborhood', 'Service Requests by Neighborhood', 'Requests', 'vertical', 'linear');
        requestMethods = updateBarChart(validData, 'METHOD_RECEIVED', requestMethods, '#request-methods', 'Submission Method', 'Request Submission Methods', 'Requests', 'angled', 'log');
        serviceDeptDistribution = updateBarChart(validData, 'DEPT_NAME', serviceDeptDistribution, '#service-dept-distribution', 'Public Agency', 'Service Requests by Public Agency', 'Requests', 'angled', 'sqrt');
        priorityDistribution = updateBarChart(validData, 'PRIORITY', priorityDistribution, '#priority-distribution', 'Priority Level', 'Requests by Priority Level', 'Requests', 'horizontal', 'sqrt');
  })
  .catch(error => console.error(error));
