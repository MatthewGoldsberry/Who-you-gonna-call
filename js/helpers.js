/**
 * Helper Functions
 */

/**
 * Update Bar Chart (and create new instance if it doesn't exist) for a specific variable and year
 * @param {Array<Object>} data - dataset loaded from CSV
 * @param {string} attributeKey - name of column to be used for binning values
 * @param {BarChart} chartInstance - reference to bar chart instance
 * @param {string} parentElement - css selector for target SVG element
 * @param {string} category - categorical name of the data being represented 
 * @param {string} title - chart title
 * @param {string} yAxisLabel - y axis label
 * @param {string} xAxisTickRotation - axis rotations to cleanly fit x axis labels
 * @param {string} yScale - type of scaling to apply to y axis (defaults to linear) 
 * @returns {BarChart} - bar chart instance
 */
function updateBarChart(data, attributeKey, chartInstance, parentElement, category, title, yAxisLabel, xAxisTickRotation, yScaleType = 'linear') {
    
    // create new instance if it doesn't exist
    if (!chartInstance) {
        return new BarChart({ 
            parentElement: parentElement, 
            attributeKey: attributeKey,
            category: category,
            title: title,
            yAxisLabel: yAxisLabel,
            yScaleType: yScaleType,
            xAxisTickRotation: xAxisTickRotation,
        }, data);
    } else {
        // update existing instance
        chartInstance.config.category = category;
        chartInstance.config.title = title;
        chartInstance.config.yAxisLabel = yAxisLabel;
        chartInstance.config.xAxisTickRotation = xAxisTickRotation;
        chartInstance.config.yScaleType = yScaleType;
        chartInstance.data = data;
        chartInstance.updateVis();
        return chartInstance;
    }
}
