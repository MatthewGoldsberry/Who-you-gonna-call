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
 * @param {Object} options - rendering options for highlight behavior
 * @param {string} options.mapDotMode - controls non-focused map dots: 'dim' | 'show' | 'hide'
 */
function highlightRequests(hoveredSRs = [], { mapDotMode = 'dim' } = {}) {
    const selectedRequestsSet = new Set(selectedRequests);

    // determine which hovered SRs actually get to be focussed
    // only want to highlight the full bin if no SRs in that bin are already selected
    // if some are selected, only focus the intersection to signal that clicking that will result in a deselect
    const filteredHovers = hoveredSRs.filter(sr => {
        // any request already selected will always be focussed
        if (selectedRequestsSet.has(sr)) return true;

        // if a request is not selected, only focus it if all other requests in that bin are also not selected
        return !hoveredSRs.some(hSR => selectedRequestsSet.has(hSR));
    });

    // combine hovered with selectedRequests to ensure everything that needs to get highlighted gets handled below
    // the set allows for an easy method to clean out any duplicate values
    const SRsToFocus = [...new Set([...filteredHovers, ...selectedRequests])].filter(SR => SR && typeof SR === 'string');;

    // early exit if there are no hovered elements or selected requests
    if (SRsToFocus.length === 0) {
        unhighlightRequest();
        return;
    }

    const SRsToFocusSet = new Set(SRsToFocus);

    // focus bars and timeline points in focus set and unfocus all others
    d3.selectAll('.timeline-point, .bar')
        .classed('unfocused', d => !SRsToFocusSet.has(d.SR_NUMBER))
        .classed('focused', d => SRsToFocusSet.has(d.SR_NUMBER));

    // map dots can be dimmed, left visible, or hidden when not focused
    if (mapDotMode === 'dim') {
        d3.selectAll('.dot')
            .classed('unfocused', d => !SRsToFocusSet.has(d.SR_NUMBER))
            .classed('focused', d => SRsToFocusSet.has(d.SR_NUMBER))
            .classed('hidden', false);
    } else if (mapDotMode === 'hide') {
        d3.selectAll('.dot')
            .classed('unfocused', false)
            .classed('focused', d => SRsToFocusSet.has(d.SR_NUMBER))
            .classed('hidden', d => !SRsToFocusSet.has(d.SR_NUMBER));
    } else {
        d3.selectAll('.dot')
            .classed('unfocused', false)
            .classed('focused', d => SRsToFocusSet.has(d.SR_NUMBER))
            .classed('hidden', false);
    }

    // go into each bar chart and figure out which bin the request is in, then focus that bin
    [requestsPerNeighborhood, requestMethods, serviceDeptDistribution, priorityDistribution].forEach(vis => {
        if (!vis || !vis.chart || !vis.srToCategory) return;

        const matchingCategories = new Set();
        SRsToFocusSet.forEach(srNumber => {
            const category = vis.srToCategory.get(srNumber);
            if (category) matchingCategories.add(category);
        });

        vis.chart.selectAll('.bar').each((d, i, nodes) => {
            if (matchingCategories.has(d.category)) {
                d3.select(nodes[i]).classed('unfocused', false).classed('focused', true);
            }
        });
    });

    // go into the timeline and figure out which bin of weeks data the request is in, then focus that bin
    [timeline].forEach(vis => {
        if (!vis || !vis.svg || !vis.srToWeek) return;

        const matchingWeeks = new Set();
        SRsToFocusSet.forEach(srNumber => {
            const week = vis.srToWeek.get(srNumber);
            if (week !== undefined) matchingWeeks.add(week);
        });

        vis.svg.selectAll('.timeline-point').each((d, i, nodes) => {
            if (matchingWeeks.has(+d.date)) {
                d3.select(nodes[i]).classed('unfocused', false).classed('focused', true);
            }
        });
    });
}

/**
 * Wrapper around highlightRequests that takes a single SR_NUMBER as an argument
 * @param {string} srNumber - SR_NUMBER to focus
 */
function highlightRequest(srNumber, options = {}) {
    highlightRequests([srNumber], options);
}

/**
 * Removes unfocused and focused tags from all requests to reset visualizations to normal view
 */
function unhighlightRequest() {
    if (selectedRequests.length > 0) {
        highlightRequests();
    } else {
        d3.selectAll('.bar, .timeline-point, .dot')
            .classed('unfocused', false)
            .classed('focused', false)
            .classed('hidden', false);

        // return dots back to original size
        d3.selectAll('.dot').attr('r', function() {
            return parseFloat(d3.select(this).attr('base-r'));
        });
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
})
