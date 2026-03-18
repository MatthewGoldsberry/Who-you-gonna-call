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