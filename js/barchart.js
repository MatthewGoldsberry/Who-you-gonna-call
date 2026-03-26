/**
 * Bar Chart object class 
 */
class BarChart {

    /**
     * Class constructor with basic bar chart configuration
     * @param {Object} _config
     *  - parentElement: DOM element for SVG container
     *  - containerWidth: width of SVG container
     *  - containerHeight: height of SVG container
     *  - margin: definition of top, right, left and bottom margins
     *  - attributeKey: name of column to be used for binning values
     *  - category: categorical name of the data being represented 
     *  - title: chart title
     *  - yAxisLabel: y-axis label
     *  - yScaleType: type of scaling to apply to y axis
     *  - xAxisTickRotation: axis rotations to cleanly fit x axis labels
     *  - labelMap: optional map of category value to display label for axis ticks
     *  - wrapLabels: if true, splits tick labels on spaces into multiple tspan lines
     *  - colorScale: D3 scale function mapping category value to color
     *  - colorByKey: the colorBy value that activates colorScale
     * @param {Array} _data
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 800,
            containerHeight: _config.containerHeight || 300,
            margin: _config.margin || { top: 50, right: 20, bottom: _config.xAxisTickRotation === 'vertical' ? 72 : 50, left: 70 },
            tooltipPadding: _config.tooltipPadding || 15,
            attributeKey: _config.attributeKey,
            category: _config.category,
            title: _config.title,
            yAxisLabel: _config.yAxisLabel,
            yScaleType: _config.yScaleType || 'linear',
            xAxisTickRotation: _config.xAxisTickRotation || 'horizontal',
            labelMap: _config.labelMap || null,
            wrapLabels: _config.wrapLabels || false,
            colorScale: _config.colorScale || null,
            colorByKey: _config.colorByKey || null,
        }
        this.data = _data;
        this.initVis();
    }

    /**
     * Initialize the bar chart
     */
    initVis() {
        let vis = this;

        // calculate inner chart size
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // define size of SVG drawing area based on the specified SVG window 
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', '100%') 
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'none');

        // initialize scales
        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .padding(0.2);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(5)
            .tickSizeOuter(0);

        // append group element that will contain our actual chart and position it according to the given margin config
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // append axis groups
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`); // move to bottom of chart

        // title
        vis.title = vis.svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', vis.config.containerWidth / 2)
            .attr('y', vis.config.margin.top / 2)
            .style('text-anchor', 'middle')
            .text(vis.config.title);

        // axis labels
        vis.yAxisLabel = vis.chart.append('text') // y-axis
            .attr('class', 'axis-title')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - vis.config.margin.left + 15)
            .attr('x', 0 - (vis.height / 2))
            .style('text-anchor', 'middle')
            .text(vis.config.yAxisLabel);

        // render initial visualization
        vis.updateVis();
    }

    /**
     * Update the visualization 
     */
    updateVis() {
        let vis = this;

        // group the data by the configured attribute and count the occurrences
        const counts = d3.rollups(
            vis.data, 
            v => v.length, 
            d => d[vis.config.attributeKey] 
        );

        vis.groupedData = Array.from(counts, ([category, count]) => ({
            category: category || 'UNSPECIFIED',
            count: count
        }));

        vis.groupedData.sort((a, b) => b.count - a.count);

        // find the highest frequency count to set the upper bound for the y-axis
        const maxCount = d3.max(vis.groupedData, d => d.count);

        // set  y-scale type based on the provided configuration
        if (vis.config.yScaleType === 'log') {
            vis.yScale = d3.scaleLog().range([vis.height, 0]);
            vis.yScale.domain([1, maxCount]); // Log still needs to start at 1
            
        } else if (vis.config.yScaleType === 'sqrt') {
            vis.yScale = d3.scaleSqrt().range([vis.height, 0]);
            vis.yScale.domain([0, maxCount]); 
            
        } else {
            vis.yScale = d3.scaleLinear().range([vis.height, 0]);
            vis.yScale.domain([0, maxCount]); 
        }

        // map sorted category names
        vis.xScale.domain(vis.groupedData.map(d => d.category));

        // render bar chart
        vis.renderVis();
    }

    /**
     * Render the visualizations
     */
    renderVis() {
        let vis = this;

        // render bars in chart
        vis.chart.selectAll('.bar')
            .data(vis.groupedData)
            .join('rect')
            .attr('width', vis.xScale.bandwidth())
            .attr('height', d => vis.height - vis.yScale(d.count)) 
            .attr('y', d => vis.yScale(d.count))
            .attr('x', d => vis.xScale(d.category))
            .attr('fill', d => (vis.config.colorScale && leafletMap && leafletMap.colorBy === vis.config.colorByKey)
                ? vis.config.colorScale(d.category)
                : 'steelblue')
            .attr('stroke', 'black')
            .attr('class', (d, i) => `bar bar-bin-${i}`);

        // pre-compute lookup maps
        vis.binToSRsMap = new Map();
        vis.srToBinMap = new Map();
        vis.data.forEach(d => {
            // get category value based on the selected attribute key
            const category = d[vis.config.attributeKey] || 'UNSPECIFIED';

            // add the current Service Request number to corresponding category's array
            if (!vis.binToSRsMap.has(category)) vis.binToSRsMap.set(category, []);
            vis.binToSRsMap.get(category).push(d.SR_NUMBER);

            // map individual Service Request number back to the category (bin)
            vis.srToBinMap.set(d.SR_NUMBER, category);
        });

        // hover handler to highlight all instances of hovered bin in page
        vis.chart.selectAll('.bar')
            .on('mouseover', (event, d) => {
                // get the SR_NUMBERs of the selected bin
                const srNumbersInBin = vis.binToSRsMap.get(d.category) || [];

                highlightRequests(srNumbersInBin);
                if (leafletMap) {
                    // Bar hover previews the matching records in the heatmap
                    leafletMap.setTransientHeatmapFilter(srNumbersInBin);
                }
                // tooltip creation
                // set the tool tip position and automatically handle if it was going to be off page
                const tooltip = d3.select('#tooltip');

                tooltip
                    .style('opacity', 1)
                    .style('display', 'block')
                    .html(`
                        <div class="tooltip-content">
                            <strong>${vis.config.category}:</strong> ${d.category}<br>
                            <strong>Frequency:</strong> ${d.count} Requests
                        </div>
                    `);

                // get the dimensions of the generated tooltip box
                const tooltipRect = tooltip.node().getBoundingClientRect();

                // calculate horizontal position, updating if the box is going to be outside the right edge
                let xPosition = event.pageX;
                if ((xPosition + tooltipRect.width + vis.config.tooltipPadding) > window.innerWidth) {
                    xPosition = event.pageX - tooltipRect.width;
                }

                // calculate vertical position, updating if the box is going to be outside the bottom edge
                let yPosition = event.pageY + vis.config.tooltipPadding;
                if ((yPosition + tooltipRect.height) > (window.scrollY + window.innerHeight)) {
                    yPosition = event.pageY - tooltipRect.height - vis.config.tooltipPadding;
                }

                tooltip
                    .style('left', xPosition + 'px')
                    .style('top', yPosition + 'px')
            })
            .on('mouseout', () => {
                unhighlightRequest();
                if (leafletMap) {
                    // Clear the transient filter to match the heatmap to the leaflet map state
                    leafletMap.setTransientHeatmapFilter(null);
                }
                // remove tooltip
                d3.select('#tooltip').style('opacity', 0);
            })

        // update axis labels and ticks; apply abbreviated labels if a labelMap was provided
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0)
            .tickFormat(d => vis.config.labelMap?.[d] ?? d);

        // update axis
        vis.xAxisG.call(vis.xAxis);
        const xTicks = vis.xAxisG.selectAll('.tick text')
            .style('font-size', '0.85rem');

        // if wrapLabels, split each tick label at its spaces and put each word into a separate line
        if (vis.config.wrapLabels) {
            xTicks.each(function() {
                const element = d3.select(this);
                const words = element.text().split(' ');
                if (words.length <= 1) return;
                element.text(null);
                words.forEach((word, i) => {
                    element.append('tspan')
                        .attr('x', 0)
                        .attr('dy', i === 0 ? '.71em' : '1em')
                        .text(word);
                });
            });
        }

        // configure the y-axis ticks
        const yAxis = d3.axisLeft(vis.yScale)
            .tickSize(-vis.width)
            .tickSizeOuter(0);

        // format to 5 ticks, applying additional formatting for log
        if (vis.config.yScaleType === 'log') {
            yAxis.ticks(5, "~s");
        } else {
            yAxis.ticks(5);
        }

        // draw the y-axis
        vis.yAxisG.call(yAxis)
            .call(g => g.select('.domain').remove())
            .selectAll('line')
            .attr('stroke', 'darkgrey');

        // handle orienting the x-axis labels
        if (vis.config.xAxisTickRotation === 'vertical') {
            xTicks
                .style('text-anchor', 'end')
                .attr('dx', '-.8em')
                .attr('dy', '-.5em')
                .attr('transform', 'rotate(-90)');
        } // default to horizontal

        highlightRequest();
    }
}