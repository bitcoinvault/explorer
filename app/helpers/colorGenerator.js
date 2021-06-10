const calculatePoint = (i, intervalSize, colorRangeInfo) => {
    let {
        colorStart,
        colorEnd,
        useEndAsStart
    } = colorRangeInfo;
    return (useEndAsStart ?
        (colorEnd - (i * intervalSize)) :
        (colorStart + (i * intervalSize)));
};

/**
 * @description Must use an interpolated color scale, which has a range of [0, 1]
 */
const generateColors = (dataLength, colorScale, colorRangeInfo) => {
    let {
        colorStart,
        colorEnd
    } = colorRangeInfo;
    let colorRange = colorEnd - colorStart;
    let intervalSize = colorRange / dataLength;
    let i, colorPoint;
    let colorArray = [];

    for (i = 0; i < dataLength; i++) {
        colorPoint = calculatePoint(i, intervalSize, colorRangeInfo);
        colorArray.push(colorScale(colorPoint));
    }

    return colorArray;
};

module.exports = {
    generateColors
};
