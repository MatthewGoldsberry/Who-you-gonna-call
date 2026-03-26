let leafletMap;
let timeline;
let requestsPerNeighborhood;
let requestMethods;
let serviceDeptDistribution;
let priorityDistribution;
let serviceTypeDistribution;

let selectedRequests = [];

let fullData = [];
let brushSelectedData = null;
let hiddenServiceTypes = new Set();

d3.csv('data/Cincinnati_311_(Non-Emergency)_Service_Requests_20260227_subset.csv')
.then(data => {
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
        brushSelectedData = filteredData;
        let activeData = filteredData === null ? fullData : filteredData;
        if (hiddenServiceTypes.size > 0) {
            activeData = activeData.filter(d => !hiddenServiceTypes.has(d.SR_TYPE));
        }

        // Update timeline with the active dataset
        timeline.data = activeData;
        timeline.updateVis();

        // Update all bar charts to reflect counts from the active dataset
        requestsPerNeighborhood = updateBarChart(activeData, 'NEIGHBORHOOD', requestsPerNeighborhood, '#requests-per-neighborhood', 'Neighborhood', 'Service Requests by Neighborhood', 'Requests', 'vertical', 'linear', NEIGHBORHOOD_ABBREVIATIONS, false, d => leafletMap.colorScaleNeighborhood(d), 'neighborhood');
        requestMethods = updateBarChart(activeData, 'METHOD_RECEIVED', requestMethods, '#request-methods', 'Submission Method', 'Request Submission Methods', 'Requests', 'horizontal', 'log', null, false, null, null);
        serviceDeptDistribution = updateBarChart(activeData, 'DEPT_NAME', serviceDeptDistribution, '#service-dept-distribution', 'Public Agency', 'Service Requests by Public Agency', 'Requests', 'horizontal', 'sqrt', null, true, d => leafletMap.colorScaleAgency(d), 'agency');
        priorityDistribution = updateBarChart(activeData, 'PRIORITY', priorityDistribution, '#priority-distribution', 'Priority Level', 'Requests by Priority Level', 'Requests', 'horizontal', 'sqrt', null, false, d => leafletMap.colorScalePriority(d), 'priority');
        serviceTypeDistribution = updateBarChart(activeData, 'SR_TYPE', serviceTypeDistribution, '#service-type-distribution', 'Service Type', 'Requests by Service Type', 'Requests', 'horizontal', 'linear', null, false, d => leafletMap.colorScaleServiceType(d), 'serviceType');
    }

    // initialize chart and then show it
    leafletMap = new LeafletMap({
        parentElement: '#my-map',
        onSelectionChange: selectedData => {
            renderDashboard(selectedData);
        },
        onFilterChange: hidden => {
            hiddenServiceTypes = hidden;
            renderDashboard(brushSelectedData);
        }
    }, validData);
    leafletMap.updateVis();
  
    // initialize the timeline 
    timeline = new Timeline({ parentElement: '#timeline-chart'}, validData);
    timeline.updateVis();

    // initialize bar charts
    requestsPerNeighborhood = updateBarChart(validData, 'NEIGHBORHOOD', requestsPerNeighborhood, '#requests-per-neighborhood', 'Neighborhood', 'Service Requests by Neighborhood', 'Requests', 'vertical', 'linear', NEIGHBORHOOD_ABBREVIATIONS, false, d => leafletMap.colorScaleNeighborhood(d), 'neighborhood');
    requestMethods = updateBarChart(validData, 'METHOD_RECEIVED', requestMethods, '#request-methods', 'Submission Method', 'Request Submission Methods', 'Requests', 'horizontal', 'log', null, false, null, null);
    serviceDeptDistribution = updateBarChart(validData, 'DEPT_NAME', serviceDeptDistribution, '#service-dept-distribution', 'Public Agency', 'Service Requests by Public Agency', 'Requests', 'horizontal', 'sqrt', null, true, d => leafletMap.colorScaleAgency(d), 'agency');
    priorityDistribution = updateBarChart(validData, 'PRIORITY', priorityDistribution, '#priority-distribution', 'Priority Level', 'Requests by Priority Level', 'Requests', 'horizontal', 'sqrt', null, false, d => leafletMap.colorScalePriority(d), 'priority');
    serviceTypeDistribution = updateBarChart(validData, 'SR_TYPE', serviceTypeDistribution, '#service-type-distribution', 'Service Type', 'Requests by Service Type', 'Requests', 'horizontal', 'linear', null, false, d => leafletMap.colorScaleServiceType(d), 'serviceType');
  })
  .catch(error => console.error(error));
