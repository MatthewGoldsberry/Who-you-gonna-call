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
     *  - xAxisLabel: x-axis label
     *  - yAxisLabel: y-axis label
     *  - unit: unit of x-axis 
     * @param {Array} _data
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 500,
            containerHeight: _config.containerHeight || 300,
            margin: _config.margin || { top: 50, right: 20, bottom: 50, left: 50 },
            tooltipPadding: _config.tooltipPadding || 15,
            xAxisLabel: _config.xAxisLabel,
            yAxisLabel: _config.yAxisLabel,
            unit: _config.unit || 'years',
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

        // initialize scales
        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        // initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(5)
            .tickSizeOuter(0);

        // define size of SVG drawing area based on the specified SVG window 
        vis.svg = d3.select(vis.config.parentElement)
            .attr('viewBox', `0 0 ${vis.config.containerWidth} ${vis.config.containerHeight}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

        // append group element that will contain our actual chart and position it according to the given margin config
        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.colors = ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#172976', '#081d58']

        // append axis groups
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`); // move to bottom of chart

        // axis labels
        vis.yAxisLabel = vis.chart.append('text') // y-axis
            .attr('class', 'axis-title')
            .attr('transform', 'rotate(-90)')
            .attr('y', 0 - vis.config.margin.left + 15)
            .attr('x', 0 - (vis.height / 2))
            .text(vis.config.yAxisLabel);

        vis.xAxisLabel = vis.chart.append('text') // x-axis
            .attr('class', 'axis-title')
            .attr('x', vis.width / 2)
            .attr('y', vis.height + vis.config.margin.bottom - 5)
            .text(vis.config.xAxisLabel);

        // render initial visualization
        vis.updateVis();
    }

    /**
     * Update the visualization 
     */
    updateVis() {
        let vis = this;

        // calculate the threshold and domain based on the extent of the values
        const extent = d3.extent(vis.data, d => d.value);
        const binInfo = calcBinInfo(extent);

        // create bins for bar chart
        const binGenerator = d3.bin()
            .value(d => d.value)
            .domain(binInfo.niceDomain)
            .thresholds(binInfo.exactThreshold);

        vis.bins = binGenerator(vis.data);

        // store the bin boundaries for tick marking 
        vis.binBoundaries = vis.bins.map(d => d.x0);
        vis.binBoundaries.push(vis.bins[vis.bins.length - 1].x1);

        // update scale domains
        vis.xScale.domain([vis.binBoundaries[0], vis.binBoundaries[vis.binBoundaries.length - 1]]);
        vis.yScale.domain([0, d3.max(vis.bins, d => d.length)]);

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
            .data(vis.bins)
            .join('rect')
            .attr('class', 'bar')
            .attr('width', d => vis.xScale(d.x1) - vis.xScale(d.x0) - 1)
            .attr('height', d => vis.height - vis.yScale(d.length))
            .attr('y', d => vis.yScale(d.length))
            .attr('x', d => vis.xScale(d.x0))
            .attr('fill', (d, i) => { return vis.colors[i] || vis.colors[vis.colors.length - 1]; })
            .attr('stroke', 'black')
            .attr('class', (d, i) => `bar bar-bin-${i}`);

        // hover handler to highlight all instances of hovered bin in page
        vis.chart.selectAll('.bar')
            .on('mouseover', (event, d) => {
                // highlight countries in bin
                highlightCountries(d.map(c => c.entity));
                scatterplot.refreshStacking();

                // tooltip creation

                // set the tool tip position and automatically handle if it was going to be off page
                const tooltip = d3.select('#tooltip');

                // defined everything but left position 
                tooltip
                    .style('display', 'block')
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px') // can style top because y bounds will never go out of page view
                    .html(`
                        <div class="tooltip-title">Bin Details</div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Range</span>
                            <span class="tooltip-value">${d.x0.toFixed(2)} - ${d.x1.toFixed(2)} ${vis.config.unit}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-label">Frequency</span>
                            <span class="tooltip-value">${d.length} Countries</span>
                        </div>
                    `);

                // get the dimensions of the generated tooltip box
                const tooltipWidth = tooltip.node().getBoundingClientRect().width;

                // calculate horizontal position, updating if the box is going to be outside of page
                let xPosition = event.pageX; // Note to self: have to store outside of conditional for position update to work 
                if ((xPosition + tooltipWidth + vis.config.tooltipPadding) > window.innerWidth) {
                    xPosition = event.pageX - tooltipWidth;
                }

                // set the x position of the tooltip
                tooltip.style('left', xPosition + 'px')
            })
            .on('mouseout', () => {
                unhighlightCountry();
                // remove tooltip
                d3.select('#tooltip').style('display', 'none');
            })
            .on('click', (event, d) => { // selections
                handleSelections(d.map(c => c.entity));
                scatterplot.refreshStacking();
            });

        // update axis labels and ticks
        vis.xAxisLabel.text(vis.config.xAxisLabel);
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickValues(vis.binBoundaries)
            .tickFormat(d3.format(".0f")); // choropleth legend rounds to nearest one automatically, so that will also be done here for parity

        // update axis
        vis.xAxisG.call(vis.xAxis);
        vis.xAxisG.selectAll('.tick text')
            .style('font-size', '0.85rem');

        // update y-axis with horizontal gridlines
        vis.yAxisG
            .call(d3.axisLeft(vis.yScale)
                .ticks(5)
                .tickSize(-vis.width) // creates gridlines
                .tickSizeOuter(0)
            )
            .call(g => g.select('.domain').remove()) // remove vertical line
            .selectAll('line')
            .attr('stroke', 'darkgrey');
        vis.yAxisG.selectAll('.tick text')
            .style('font-size', '0.85rem');

        // makes selection persist even when data values are changed
        highlightCountry();
    }
}