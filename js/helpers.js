/**
 * Helper Functions
 */

// abbreviations of neighborhoods in Cincinnati for condensed x axis labels
const NEIGHBORHOOD_ABBREVIATIONS = {
    'AVONDALE': 'AVNDL',
    'BOND HILL': 'BNDHL',
    'CALIFORNIA': 'CALIF',
    'CAMP WASHINGTON': 'CMPWN',
    'CARTHAGE': 'CRTHG',
    'CLIFTON': 'CLIFT',
    'COLLEGE HILL': 'CLGHL',
    'COLUMBIA TUSCULUM': 'CLTSC',
    'CORRYVILLE': 'CORRY',
    'CUF': 'CUF',
    'DOWNTOWN': 'DWNTN',
    'EAST END': 'E.END',
    'EAST PRICE HILL': 'E.PHI',
    'EAST WALNUT HILLS': 'E.WNH',
    'EAST WESTWOOD': 'E.WWT',
    'ENGLISH WOODS': 'ENGWD',
    'EVANSTON': 'EVNST',
    'HARTWELL': 'HRTWL',
    'HYDE PARK': 'HYDPK',
    'KENNEDY HEIGHTS': 'KNHTS',
    'LINWOOD': 'LINWD',
    'LOWER PRICE HILL': 'L.PHI',
    'MADISONVILLE': 'MADSN',
    'MILLVALE': 'MILVL',
    'MT. ADAMS': 'MT.AD',
    'MT. AIRY': 'MT.AI',
    'MT. AUBURN': 'MT.AU',
    'MT. LOOKOUT': 'MT.LK',
    'MT. WASHINGTON': 'MT.WN',
    'NORTH AVONDALE - PADDOCK HILLS': 'NAPHL',
    'NORTH FAIRMOUNT': 'N.FMT',
    'NORTHSIDE': 'NSIDE',
    'OAKLEY': 'OAKLY',
    'OVER-THE-RHINE': 'OTR',
    'PENDLETON': 'PNDLT',
    'PLEASANT RIDGE': 'PLSRD',
    'QUEENSGATE': 'QGATE',
    'RIVERSIDE': 'RVRSD',
    'ROSELAWN': 'RSLWN',
    'SAYLER PARK': 'SYLPK',
    'SEDAMSVILLE': 'SDMSV',
    'SOUTH CUMMINSVILLE': 'S.CMV',
    'SOUTH FAIRMOUNT': 'S.FMT',
    'SPRING GROVE VILLAGE': 'SPGVL',
    'VILLAGES AT ROLL HILL': 'VARHL',
    'WALNUT HILLS': 'WLNTH',
    'WEST END': 'W.END',
    'WEST PRICE HILL': 'W.PHI',
    'WESTWOOD': 'WSTWD',
    'WINTON HILLS': 'WNTON',
};

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
 * @param {Object|null} labelMap - optional map of category value → display label for axis ticks
 * @returns {BarChart} - bar chart instance
 */
function updateBarChart(data, attributeKey, chartInstance, parentElement, category, title, yAxisLabel, xAxisTickRotation, yScaleType = 'linear', labelMap = null) {

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
            labelMap: labelMap,
        }, data);
    } else {
        // update existing instance
        chartInstance.config.category = category;
        chartInstance.config.title = title;
        chartInstance.config.yAxisLabel = yAxisLabel;
        chartInstance.config.xAxisTickRotation = xAxisTickRotation;
        chartInstance.config.yScaleType = yScaleType;
        chartInstance.config.labelMap = labelMap;
        chartInstance.data = data;
        chartInstance.updateVis();
        return chartInstance;
    }
}
