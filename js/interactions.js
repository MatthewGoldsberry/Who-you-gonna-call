/**
 * Interactions
 */

// Handle Color Selection
d3.select('#colorBy').on('change', function() {
    const selectedValue = d3.select(this).property('value');

    if (leafletMap) {
        leafletMap.colorBy = selectedValue;
        leafletMap.updateVis();
    }

    // rerender bar charts so only the matching one becomes colored
    [requestsPerNeighborhood, requestMethods, serviceDeptDistribution, priorityDistribution, serviceTypeDistribution]
        .filter(Boolean)
        .forEach(chart => chart.renderVis());

    // disable color editor if not on service types
    const isServiceType = selectedValue === 'serviceType';
    d3.selectAll('.legend-color-picker').classed('disabled', !isServiceType);
});

// Handle Background Selection
d3.select('#mapBackground').on('change', function() {
    const selectedValue = d3.select(this).property('value');

    if (leafletMap) {
        leafletMap.changeBackground(selectedValue);
    }
})

/**
 * Hover Interaction 
 * 
 * This functions are called by the handlers within the classes to apply global focussing and dimming
 */

/**
 * Highlights the selected requests and all requests currently being hovered in all visualizations, while dimming all others
 * @param {Array<string>} hoveredSRs - SR_NUMBERs that are currently being hovered
 */
function highlightRequests(hoveredSRs = []) {
    // use a Set for quick lookups
    const selectedSet = new Set(selectedRequests);

    // determine which hovered SRs actually get to be focussed
    // only want to highlight the full bin if no SRs in that bin are already selected
    // if some are selected, only focus the intersection to signal that clicking that will result in a deselect
    const anyHoveredIsSelected = hoveredSRs.some(hSR => selectedSet.has(hSR));
    const filteredHovers = hoveredSRs.filter(SR => {
        if (selectedSet.has(SR)) return true;
        return !anyHoveredIsSelected;
    });

    // combine hovered with selectedRequests to ensure everything that needs to get highlighted gets handled below
    // the set allows for an easy method to clean out any duplicate values
    const SRsToFocus = [...new Set([...filteredHovers, ...selectedRequests])].filter(SR => SR && typeof SR === 'string');

    // early exit if there are no hovered elements or selected requests
    if (SRsToFocus.length === 0) {
        unhighlightRequest();
        return;
    }

    const SRsToFocusSet = new Set(SRsToFocus);

    // mark all visualization contains as in a focused mode
    // CSS automatically handles dimming all non-focussed descendants
    if (leafletMap) {
        leafletMap.svg.classed('has-focus', true);

        // clear .focused from only the previously-focused dots
        leafletMap.Dots.filter('.focused')
            .classed('focused', false)
            .attr('r', function() { return parseFloat(d3.select(this).attr('base-r')); });

        // increase size of the focussed dots 
        leafletMap.Dots.filter(d => SRsToFocusSet.has(d.SR_NUMBER))
            .classed('focused', true)
            .attr('r', function() { return parseFloat(d3.select(this).attr('base-r')) + 2; });
    }

    // update bar charts to highlight categories containing the focused Service Requests
    d3.selectAll('svg.chart-container').classed('has-focus', true);
    [requestsPerNeighborhood, requestMethods, serviceDeptDistribution, priorityDistribution, serviceTypeDistribution].filter(Boolean).forEach(vis => {
        // find all unique categories
        const matchingCategories = new Set();
        SRsToFocus.forEach(sr => {
            const cat = vis.srToBinMap?.get(sr);
            if (cat !== undefined) matchingCategories.add(cat);
        });

        // activate .focused class based on found matching categories
        vis.chart.selectAll('.bar').classed('focused', d => matchingCategories.has(d.category));
    });

    // update the timeline chart to highlight weeks containing the focused Service Requests
    if (timeline) {
        timeline.svg.classed('has-focus', true);

        // find all unique weeks
        const matchingWeeks = new Set();
        SRsToFocus.forEach(sr => {
            const week = timeline.srToWeekMap?.get(sr);
            if (week !== undefined) matchingWeeks.add(week);
        });

        // activate .focused class based on found matching weeks 
        timeline.svg.selectAll('.timeline-point').classed('focused', d => matchingWeeks.has(+d.date));
    }
}

/**
 * Wrapper around highlightRequests that takes a single SR_NUMBER as an argument
 * @param {string} srNumber - SR_NUMBER to focus
 */
function highlightRequest(srNumber) {
    highlightRequests([srNumber]);
}

/**
 * Removes unfocused and focused tags from all requests to reset visualizations to normal view
 */
function unhighlightRequest() {
    if (selectedRequests.length > 0) {
        highlightRequests();
    } else {
        // Remove focus mode from all containers — CSS cascade instantly un-dims everything
        if (leafletMap) {
            leafletMap.svg.classed('has-focus', false);
            leafletMap.Dots.filter('.focused')
                .classed('focused', false)
                .attr('r', function() { return parseFloat(d3.select(this).attr('base-r')); });
        }
        d3.selectAll('svg.chart-container').classed('has-focus', false);
        d3.selectAll('.bar.focused, .timeline-point.focused').classed('focused', false);
        if (timeline) timeline.svg.classed('has-focus', false);
    }
}

/**
 * Selecting Implementation 
 */

/**
 * Handles logic of adding / removing requests from the selection
 * 
 * If all of the SR_NUMBERs already exists in selectedRequests, that list is removed
 * If not all of the SR_NUMBERs exist in selectedRequests, all not already in are added 
 * @param {Array<string>} srNumbers - list of SR_NUMBERs
 */
function handleSelections(srNumbers) {
    // if some requests in srNumbers already are in selectedRequests remove them
    const alreadySelected = srNumbers.some(SR => selectedRequests.includes(SR));
    if (alreadySelected) {
        selectedRequests = selectedRequests.filter(SR => !srNumbers.includes(SR));
    } else { // if no requests are selected, select all in srNumbers
        srNumbers.forEach(SR => {
            if (!selectedRequests.includes(SR)) { selectedRequests.push(SR); }
        })
    }

    highlightRequests();
}

/**
 * Wrapper around handleSelections that takes a single SR_NUMBER as an argument
 * @param {string} srNumber - SR_NUMBER to add to selection
 */
function handleSelection(srNumber) {
    handleSelections([srNumber]);
}

/**
 * Resets the selection and updates it visually 
 */
function resetSelection() {
    selectedRequests = [];
    unhighlightRequest();
}

/**
 * Handler for the 'escape' key which triggers a reset of the selected requests
 */
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        resetSelection();
    }
});

// Handle Brush Button Toggle
d3.select('#brushToggle').on('click', function() {
    if (leafletMap) {
        const enabled = leafletMap.toggleBrushingMode();
        if (enabled) {
            d3.select(this).classed('active', true).text('Brush Mode: On');
        } else {
            d3.select(this).classed('active', false).text('Brush Mode: Off');
        }
    }
});

// Handle Heatmap Button Toggle
d3.select('#heatmapToggle').on('click', function() {
    if (leafletMap) {
        // Heatmap mode swaps the map from point symbols to density rendering without changing selection state.
        const enabled = leafletMap.toggleHeatmapMode();
        if (enabled) {
            d3.select(this).classed('active', true).text('Heatmap: On');
        } else {
            d3.select(this).classed('active', false).text('Heatmap: Off');
        }
    }
});