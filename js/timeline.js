/**
 * Timeline object class
 */
class Timeline {   

    /**
     * class constructor for the Timeline object
     * @param {Object} _config 
     * @param {Array<Object>} _data
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 1000,
            containerHeight: _config.containerHeight || 150,
            margin: { top: 10, right: 20, bottom: 50, left: 60 }
        }

        this.data = _data;
        this.currentBrushSelection = null;
        this.currentBrushDateRange = null;
        this.initVis();
    }

    /**
     * Initialize visualization
     */
    initVis() {
        let vis = this;

        // Helps format the dates for the detail-on-demand tooltips
        vis.weekLabelFormat = d3.timeFormat('%b %d, %Y');

        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // define size of SVG drawing area based on the specified SVG window
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'none');

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.xScale = d3.scaleTime()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xAxis = d3.axisBottom(vis.xScale);
        vis.yAxis = d3.axisLeft(vis.yScale);

        vis.chart.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${vis.height})`);
        vis.chart.append('g')
            .attr('class', 'y-axis');

        // Axis labels
        vis.chart.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + vis.config.margin.bottom - 18)
            .text('Week');

        vis.chart.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${-vis.config.margin.left + 15}, ${vis.height / 2}) rotate(-90)`)
            .text('Number of Calls');

        // Initialize the line for the timeline
        vis.line = d3.line()
            .x(d => vis.xScale(d.date))
            .y(d => vis.yScale(d.count));

        vis.chart.append('path')
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', 'steelblue')
            .attr('stroke-width', 1.5);

        vis.brushRangeLabel = vis.chart.append('text')
            .attr('class', 'brush-range-label')
            .attr('text-anchor', 'middle')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + vis.config.margin.bottom - 2)
            .attr('fill', '#63738a')
            .attr('font-size', '12px')
            .attr('font-weight', '500')
            .text('');

        vis.brushG = vis.chart.append('g')
            .attr('class', 'brush timeline-brush');

        vis.brush = d3.brushX()
            .extent([[0, 0], [vis.width, vis.height]])
            .filter(event => !event.button && !(leafletMap && leafletMap.currentBrushSelection))
            .on('start brush end', event => vis.handleTimelineBrush(event));

        vis.brushG.call(vis.brush);
    }

    /**
     * Update the visualization
     */
    updateVis() {
        let vis = this;

        // Convert DATE_CREATED to dates and filter out invalid values.
        const dateArray = vis.data
            .map(d => ({
                date: new Date(d.DATE_CREATED)
            }))
            .filter(d => d.date && !isNaN(d.date));

        // Count how many requests fall into each week.
        const weeklyCounts = new Map();
        dateArray.forEach(row => {
            const weekStart = +d3.timeWeek.floor(row.date);
            weeklyCounts.set(weekStart, (weeklyCounts.get(weekStart) || 0) + 1);
        });

        // Convert weeklyCounts to an array sorted by date
        vis.aggregatedData = Array.from(weeklyCounts, ([weekStart, count]) => ({ date: new Date(weekStart), count }))
            .sort((a, b) => a.date - b.date);

        // Pre-compute lookup maps
        vis.weekToSRsMap = new Map();
        vis.srToWeekMap = new Map();
        vis.data.forEach(d => {
            const date = new Date(d.DATE_CREATED);

            // Skip if the date string is missing or invalid
            if (isNaN(date)) return;

            // Find the starting date of the week
            const weekTimestamp = +d3.timeWeek.floor(date);

            // Add the current Service Request number to its corresponding week's array
            if (!vis.weekToSRsMap.has(weekTimestamp)) vis.weekToSRsMap.set(weekTimestamp, []);
            vis.weekToSRsMap.get(weekTimestamp).push(d.SR_NUMBER);

            // Map individual Service Request number back to the timestamp
            vis.srToWeekMap.set(d.SR_NUMBER, weekTimestamp);
        });

        // Sets scale domains based on date and count data
        // Handles the case where the brushed dataset is empty
        if (weeklyCounts.size === 0) {
            const nowFloor = +d3.timeWeek.floor(Date.now());
            vis.xScale.domain([nowFloor, +d3.timeWeek.offset(nowFloor, 1)]);
            vis.yScale.domain([0, 1]);
        } else {
            const [minTs, maxTs] = d3.extent(weeklyCounts.keys());
            vis.xScale.domain([minTs, maxTs]);
            vis.yScale.domain([0, d3.max(weeklyCounts.values())]);
        }

        // call axes
        vis.chart.select('.x-axis').call(vis.xAxis);
        vis.chart.select('.y-axis').call(vis.yAxis);

        // draw the line
        vis.chart.select('.line')
            .datum(vis.aggregatedData)
            .attr('d', vis.line);

        // draw points on each week so that we have a place to attach the tooltips
        vis.chart.selectAll('.timeline-point')
            .data(vis.aggregatedData, d => +d.date)
            .join('circle')
            .attr('class', 'timeline-point')
            .attr('r', 4)
            .attr('fill', 'steelblue')
            .attr('cx', d => vis.xScale(d.date))
            .attr('cy', d => vis.yScale(d.count))
            .attr('stroke', 'black')
            .attr('stroke-width', 0.5)
            .on('mouseover', function(event, d) {
                const weekStart = d.date;

                // get SR_NUMBERs for this week
                const srNumbersInWeek = vis.weekToSRsMap.get(+weekStart) || [];

                // highlight all requests in that given week
                highlightRequests(srNumbersInWeek);
                if (leafletMap) {
                    // Timeline hovering for now, need to add brushing later which will mess with this logic
                    leafletMap.setTransientHeatmapFilter(srNumbersInWeek);
                }
                
                d3.select('#tooltip')
                    .style('opacity', 1)
                    .html(`
                        <div class="tooltip-content">
                            <strong>Week:</strong> ${vis.weekLabelFormat(d.date)}<br>
                            <strong>Number of Calls:</strong> ${d.count}
                        </div>
                    `);
            })
            .on('mousemove', function(event) {
                d3.select('#tooltip')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseleave', function() {
                unhighlightRequest();
                if (leafletMap) {
                    // Clear the temporary heatmap filter
                    leafletMap.setTransientHeatmapFilter(null);
                }
                d3.select('#tooltip').style('opacity', 0);
            })
            .on('click', (event, d) => {
                // persist selection of service requests in the given week bin
                const srNumbersInWeek = vis.weekToSRsMap.get(+d.date) || [];
                handleSelections(srNumbersInWeek);
            });

        // keep brush bounds if the timeline is redrawn after a filter update
        if (vis.currentBrushDateRange) {
            const [start, end] = vis.currentBrushDateRange;
            const x0 = vis.xScale(start);
            const x1 = vis.xScale(end);
            vis.currentBrushSelection = [x0, x1];
            vis.brushG.call(vis.brush.move, vis.currentBrushSelection);
            vis.updateBrushRangeLabel(start, end);
        } else if (vis.currentBrushSelection) {
            vis.brushG.call(vis.brush.move, vis.currentBrushSelection);
        } else {
            vis.updateBrushRangeLabel(null, null);
        }

        highlightRequest();
    }

    handleTimelineBrush(event) {
        let vis = this;
        const selection = event.selection;

        if (!leafletMap) return;

        const brushBtn = document.getElementById('brushToggle');

        if (!selection) {
            vis.currentBrushSelection = null;
            vis.currentBrushDateRange = null;
            // Re-enable the map brush button now that the timeline brush is cleared
            if (brushBtn) {
                brushBtn.disabled = false;
                brushBtn.title = '';
            }

            leafletMap.clearDateRangeFilter();
            vis.updateBrushRangeLabel(null, null);

            if (leafletMap.currentBrushSelection && leafletMap.selectedData.length > 0) {
                selectedRequests = leafletMap.selectedData.map(d => d.SR_NUMBER);
            } else {
                selectedRequests = [];
            }
        
            highlightRequests();
            if (leafletMap) leafletMap.updateHeatmap();
            
            return;
        }

        // Timeline brush is now active: block the map brush button
        if (brushBtn) {
            brushBtn.disabled = true;
            brushBtn.title = 'Clear the timeline brush first';
        }
        // If brush mode was already on, turn it off so the map cursor reverts to normal
        if (leafletMap.brushingEnabled) {
            leafletMap.setBrushingEnabled(false);
            d3.select('#brushToggle').classed('active', false).text('Brush Mode: Off');
        }

        const [x0, x1] = selection;
        const startDate = vis.xScale.invert(Math.min(x0, x1));
        const endDate = vis.xScale.invert(Math.max(x0, x1));
        vis.currentBrushSelection = [x0, x1];
        vis.currentBrushDateRange = [startDate, endDate];

        const brushedSRs = vis.data
            .filter(d => {
                const created = new Date(d.DATE_CREATED);
                return !isNaN(created) && created >= startDate && created <= endDate;
            })
            .map(d => d.SR_NUMBER);

        selectedRequests = brushedSRs;
        highlightRequests();
        vis.updateBrushRangeLabel(startDate, endDate);
        if (leafletMap) {
            leafletMap.clearDateRangeFilter();
            leafletMap.updateHeatmap();
        }
    }

    updateBrushRangeLabel(startDate, endDate) {
        let vis = this;
        if (!vis.brushRangeLabel) return;
        if (!startDate || !endDate) {
            vis.brushRangeLabel.text('');
            return;
        }

        vis.brushRangeLabel.text(`Brushed: ${vis.weekLabelFormat(startDate)} → ${vis.weekLabelFormat(endDate)}`);
    }
}
