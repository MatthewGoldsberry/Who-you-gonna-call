/**
 * Helper Functions
 */

/**
 * Update Bar Chart (and create new instance if it doesn't exist) for a specific variable and year
 * @param {Array<Object>} data - dataset loaded from CSV
 * @param {string} attributeKey - name of column to be used for binning values
 * @param {BarChart} chartInstance - reference to bar chart instance
 * @param {string} parentElement - css selector for target SVG element
 * @param {string} title - chart title
 * @param {string} yAxisLabel - y axis label
 * @param {string} xAxisTickRotation - axis rotations to cleanly fit x axis labels
 * @returns {BarChart} - bar chart instance
 */
function updateBarChart(data, attributeKey, chartInstance, parentElement, title, yAxisLabel, xAxisTickRotation = 'horizontal') {
    
    // create new instance if it doesn't exist
    if (!chartInstance) {
        return new BarChart({ 
            parentElement: parentElement, 
            attributeKey: attributeKey,
            title: title,
            yAxisLabel: yAxisLabel,
            xAxisTickRotation: xAxisTickRotation,
        }, data);
    } else {
        // update existing instance
        chartInstance.config.yAxisLabel = yAxisLabel;
        chartInstance.config.title = title;
        chartInstance.data = data;
        chartInstance.updateVis();
        return chartInstance;
    }
}
