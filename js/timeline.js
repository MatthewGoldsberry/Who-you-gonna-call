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
            containerWidth: _config.containerWidth || 1000, // These dimensions work great on my screen! 
            // We might need to make them more responsive or adjust for other screens later
            containerHeight: _config.containerHeight || 150,
            margin: { top: 10, right: 20, bottom: 50, left: 60 }
        }

        this.data = _data;
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

        vis.xScale = d3.scaleTime()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xAxis = d3.axisBottom(vis.xScale);
        vis.yAxis = d3.axisLeft(vis.yScale);

        vis.svg = d3.select(vis.config.parentElement)
            .append('svg')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)
            .append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);
    
        vis.svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0, ${vis.height})`);
        vis.svg.append('g')
            .attr('class', 'y-axis');

        // Axis labels
        vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + vis.config.margin.bottom - 18)
            .text('Week');

        vis.svg.append('text')
            .attr('class', 'axis-label')
            .attr('text-anchor', 'middle')
            .attr('transform', `translate(${-vis.config.margin.left + 15}, ${vis.height / 2}) rotate(-90)`)
            .text('Number of Calls');

        // Initialize the line for the timeline
        vis.line = d3.line()
            .x(d => vis.xScale(d.date))
            .y(d => vis.yScale(d.count));

        vis.svg.append('path')
            .attr('class', 'line')
            .attr('fill', 'none')
            .attr('stroke', '#2a6dff') // this is the same color as the header block. 
            // I picked it for consistency but it might be too bright for the line, we can think about this later
            .attr('stroke-width', 1.5);
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

        // Convert weeeklyCounts to an array sorted by date
        vis.aggregatedData = Array.from(weeklyCounts, ([weekStart, count]) => ({ date: new Date(weekStart), count }))
            .sort((a, b) => a.date - b.date);


        // Set scale domains based on date and count data
        vis.xScale.domain(d3.extent(vis.aggregatedData, d => d.date));
        vis.yScale.domain([0, d3.max(vis.aggregatedData, d => d.count) || 1]);

        // call axes
        vis.svg.select('.x-axis').call(vis.xAxis);
        vis.svg.select('.y-axis').call(vis.yAxis);

        // draw the line
        vis.svg.select('.line')
            .datum(vis.aggregatedData)
            .attr('d', vis.line);

        // draw points on each week so that we have a place to attach the tooltips
        vis.svg.selectAll('.timeline-point')
            .data(vis.aggregatedData, d => +d.date)
            .join('circle')
            .attr('class', 'timeline-point')
            .attr('r', 4)
            .attr('fill', '#2a6dff')
            .attr('cx', d => vis.xScale(d.date))
            .attr('cy', d => vis.yScale(d.count))
            .on('mouseover', function(event, d) {
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
                d3.select('#tooltip').style('opacity', 0);
            });
    }
}
