/*
This code takes a table of Sentinel-2 image dates, thresholds the images to define ponds
and creates a feature collection based on this threshold. The Areas of the ponds and
Min Beach Lengths to the crest line for earch pond are computed
*/

//decalre the site name as a cleint side string:
var siteName = "Input";

// provide the tile name, important at tile overlaps
var ESA_S2_MGRS_TILE = 'check_tile_name_in_metaData';

//Declare the senetinen-2 images to use as a server side list:
var im_list = ee.List([
  '2019/01/15',
  '2019/02/24',
  '2019/03/16',
  '2019/04/30',
  '2019/05/10',
  '2019/06/19',
  '2019/07/19',
  '2019/08/03',
  '2019/09/17',
  '2019/10/12',
  '2019/12/01',
  '2019/12/16',
  '2020/01/30',
  '2020/02/14',
  '2020/03/10',
  '2020/04/24',
  '2020/05/14',
  '2020/06/23',
  '2020/07/18',
  '2020/08/12',
  '2020/09/11',
  '2020/10/16',
  '2020/11/25',
  '2020/12/30',
  '2021/02/18',
  '2021/03/10',
  '2021/04/14',
  '2021/05/29',
  '2021/06/18',
  '2021/07/18',
  '2021/08/17',
  '2021/09/21',
  '2021/10/16',
  '2021/11/05',
  '2021/12/30',
  '2022/01/24'
]);
print('List of dates to select images by', im_list);

////////////////////////////////////////////////////
// Declare the collections to use //
////////////////////////////////////////////////////
//{
// Import the Sentinel 2 surface reflectance collection.
// filter by Dates in List,

//centre map at AoI
Map.centerObject({
  object: outlne,
  zoom: 14
});

//function to add a time stamp field to the image properties
var addDate = function (image) {
  var date = ee.Date(image.get('system:time_start')).format('yyyy/MM/dd');
  return image.set('IMAGE_DATE', date);
};

// filter the collection and add date stamp to each image
var collection = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate('2019-01-01', '2022-01-31')
  .filterBounds(centr)
  // fitler by the ESA Sentinel-2 tile (required wehre there is an overlap of tiles).
  // Comment out if not required.
  // .filter(ee.Filter.eq('MGRS_TILE', ESA_S2_MGRS_TILE))
  .map(addDate);

//filter by date stamp
var collection_list = collection.filter(ee.Filter.inList('IMAGE_DATE', im_list));

//fucntion to clip each image to the crest of the site
var clipper = function (image) {
  return ee.Image(image).clip(outlne);
};

//clip each image in the collection
var s2c = collection_list.map(clipper);

// Add a functn that can calculate the NDWI raster layer and create a band
var addndwi = function (image) {
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
};

//add an NDWI band to images in the collection  
var s2c = s2c.map(addndwi).select("B2", "B3", "B4", "B8", "B8A", "NDWI");
// print the entire collection
print('S2_SR Collection filtered by area and date w/ NDWI Band', s2c.first());

// create a collection by selecting only the NDWI band
var ndwiColl = ee.ImageCollection(s2c.select("NDWI"));
// print out the NDWI collection
print('S2_SR Image NDWI Band', ndwiColl);

var nirColl = ee.ImageCollection(s2c.select("B8"));
// print out the NDWI collection
print('S2_SR Image NIR Band', nirColl);
//}

////////////////////////////////////////////////////
// Declare the threhsolds //
////////////////////////////////////////////////////
//{
//declare thresholds
var ndwiThLst = ee.List([0.05, 0.057, 0.064, 0.071, 0.079, 0.086, 0.093, 0.1, 0.107, 0.114, 0.121, 0.129, 0.136, 0.143, 0.15]);
var nirThLst = ee.List([840, 846, 851, 857, 863, 869, 874, 880, 886, 891, 897, 903, 909, 914, 920]);
print('NDWI Thresholds:', ndwiThLst, 'NIR Thresholds', nirThLst);
//}

//Functions to iterate:
//{

//a client side number between 0 and 14 to use as the threshold index
var num = 0;
//{
////////////////////////////////////////////////////
// Pond Raster to Polygon Threshold Function  //
////////////////////////////////////////////////////
//{
/* A set of functions that writes an NDWI and NIR mask to 
each image in the the repsective collections and returns 
the pond areas as geometries inside the masks
*/
//select the relavant NDWI threshold and mask the ponds based on this
var ndwiThrshld = ee.Number(ndwiThLst.get(num));
var pondMaskNDWI = function (image) {
  var not_mask = image.gt(ndwiThrshld);
  var sys_time = image.get('system:time_start');
  return ee.Image(not_mask.updateMask(not_mask.neq(0)))
    .set({ 'system:time_start': sys_time });
};

//select the relavant NIR threshold and mask the ponds based on this
var nirThrshld = ee.Number(nirThLst.get(num));
var pondMaskNIR = function (image) {
  var not_mask = image.lt(nirThrshld);
  var sys_time = image.get('system:time_start');
  return ee.Image(not_mask.updateMask(not_mask.neq(0)))
    .set({ 'system:time_start': sys_time });
};
print('index:', num, 'NDWI Threshold:', ndwiThrshld, 'NIR Threshold:', nirThrshld);

// creates a fnct that reduces images to features collections of geometeries bounding unmasked areas
var ndwiToVects = function (image) {
  var features = ee.FeatureCollection(image.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: outlne,
    crs: null,
    scale: 10,
    bestEffort: true,
    geometryType: 'polygon',
    eightConnected: false,
    labelProperty: 'Pond_Areas',
  }))
    .geometry();
  return ee.Feature(features)
    .set({
      'Area': features.area(1),
      'NDWI Threshold': ndwiThrshld,
      'system:time_start': image.get('system:time_start')
    });
};

// creates a fnct that reduces images to features collections of geometeries bounding unmasked areas
var nirToVects = function (image) {
  var features = ee.FeatureCollection(image.reduceToVectors({
    reducer: ee.Reducer.countEvery(),
    geometry: outlne,
    crs: null,
    scale: 10,
    bestEffort: true,
    geometryType: 'polygon',
    eightConnected: false,
    labelProperty: 'Pond_Areas',
  }))
    .geometry();
  return ee.Feature(features)
    .set({
      'Area': features.area(1),
      'NIR Threshold': nirThrshld,
      'system:time_start': image.get('system:time_start')
    });
};

//compute ponds by NDWI and NIR:
var ndwiThrshdIm = ee.ImageCollection(ndwiColl.map(pondMaskNDWI));
var ndwiThrshdFeat = ee.FeatureCollection(ndwiThrshdIm.map(ndwiToVects, false));

var nirThrshdIm = ee.ImageCollection(nirColl.map(pondMaskNIR));
var nirThrshdFeat = ee.FeatureCollection(nirThrshdIm.map(nirToVects, false));

//}

////////////////////////////////////////////////////
//  Beach Length Function //
////////////////////////////////////////////////////
//{
// Define a funciton that can be mapped over the pond area
// feature collection to define the min beach length to the crestline.

var compMinBeach = function (feature) {
  var minBL = feature.distance({ 'right': crestlne, 'maxError': 1 });
  return ee.Feature(feature.set({ 'Min Beach Length': minBL }));
};

// compute the MBLs for the NIR and NDWI collections
var ndwiThrshdFeat_MBL = ndwiThrshdFeat.map(compMinBeach);
var nirThrshdFeat_MBL = nirThrshdFeat.map(compMinBeach);
//}

////////////////////////////////////////////////////
// Create Lists of Variables of Interest //
////////////////////////////////////////////////////
//{

// Dates (system time start index)
var x = ee.List(ndwiThrshdFeat_MBL.aggregate_array('system:time_start'));

// NDWI:
// Pond areas
var y1 = ee.List(ndwiThrshdFeat_MBL.aggregate_array('Area'));
// Min Beach Lengths
var y2 = ee.List(ndwiThrshdFeat_MBL.aggregate_array('Min Beach Length'));

// NIR:
// Pond areas
var y3 = ee.List(nirThrshdFeat_MBL.aggregate_array('Area'));
// Min Beach Lengths
var y4 = ee.List(nirThrshdFeat_MBL.aggregate_array('Min Beach Length'));
//}

//}

//Cast to unique variables for 
//NIR:
var nirPondList0 = y3;
var nirMinBeachList0 = y4;

//NDWI:
var pondList0 = y1;
var minBeachList0 = y2;


//Repeat above procedure for each threshold
//Once complete for all threshold values

//append new all data to arrays
var pondArray = ee.Array.cat([
  pondList0,
  pondList1,
  pondList2,
  pondList3,
  pondList4,
  pondList5,
  pondList6,
  pondList7,
  pondList8,
  pondList9,
  pondList10,
  pondList11,
  pondList12,
  pondList13,
  pondList14], 1);
var minBeachArray = ee.Array.cat([
  minBeachList0,
  minBeachList1,
  minBeachList2,
  minBeachList3,
  minBeachList4,
  minBeachList5,
  minBeachList6,
  minBeachList7,
  minBeachList8,
  minBeachList9,
  minBeachList10,
  minBeachList11,
  minBeachList12,
  minBeachList13,
  minBeachList14,], 1);
var nirPondArray = ee.Array.cat([
  nirPondList0,
  nirPondList1,
  nirPondList2,
  nirPondList3,
  nirPondList4,
  nirPondList5,
  nirPondList6,
  nirPondList7,
  nirPondList8,
  nirPondList9,
  nirPondList10,
  nirPondList11,
  nirPondList12,
  nirPondList13,
  nirPondList14], 1);
var nirMinBeachArray = ee.Array.cat([
  nirMinBeachList0,
  nirMinBeachList1,
  nirMinBeachList2,
  nirMinBeachList3,
  nirMinBeachList4,
  nirMinBeachList5,
  nirMinBeachList6,
  nirMinBeachList7,
  nirMinBeachList8,
  nirMinBeachList9,
  nirMinBeachList10,
  nirMinBeachList11,
  nirMinBeachList12,
  nirMinBeachList13,
  nirMinBeachList14,], 1);
print('NDWI', 'Pond Areas', pondArray, 'Min Beach:', minBeachArray,
  'NIR', 'Pond Areas', nirPondArray, 'Min Beach:', nirMinBeachArray);


////////////////////////////////////////////////////
// Create Charts  //
////////////////////////////////////////////////////

// Define a chart of Date vs Pond Area and print this to the console.
var chart = ui.Chart.array.values({ array: pondArray, axis: 0, xLabels: x }).setOptions({
  title: siteName + ' Pond Area w/ Time at NDWI thrshlds',
  colors: ['cf513e'],
  hAxis: {
    title: 'Date',
    titleTextStyle: { italic: false, bold: true }
  },
  vAxis: {
    title: 'Pond Area (sqr meters)',
    titleTextStyle: { italic: false, bold: true }
  },
  pointSize: 4,
  dataOpacity: 0.4,
  legend: { position: 'none' },
});
print('NDWI Ponds', chart);
// Define a chart of Date vs Min Beach and print this to the console.
var chart = ui.Chart.array.values({ array: minBeachArray, axis: 0, xLabels: x }).setOptions({
  title: siteName + ' Minimum Beach Length to Crest w/ Time at NDWI thrshlds',
  colors: ['cf513e'],
  hAxis: {
    title: 'Date',
    titleTextStyle: { italic: false, bold: true }
  },
  vAxis: {
    title: 'Min. Beach Length (meters)',
    titleTextStyle: { italic: false, bold: true }
  },
  pointSize: 4,
  dataOpacity: 0.4,
  legend: { position: 'none' },
});
print('NDWI Min Beaches', chart);

// Define a chart of Date vs Pond Area and print this to the console.
var chart = ui.Chart.array.values({ array: nirPondArray, axis: 0, xLabels: x }).setOptions({
  title: siteName + ' Pond Area w/ Time at NIR thrshlds',
  colors: ['cf513e'],
  hAxis: {
    title: 'Date',
    titleTextStyle: { italic: false, bold: true }
  },
  vAxis: {
    title: 'Pond Area (sqr meters)',
    titleTextStyle: { italic: false, bold: true }
  },
  pointSize: 4,
  dataOpacity: 0.4,
  legend: { position: 'none' },
});
print('NIR Ponds', chart);
// Define a chart of Date vs Min Beach and print this to the console.
var chart = ui.Chart.array.values({ array: nirMinBeachArray, axis: 0, xLabels: x }).setOptions({
  title: siteName + ' Minimum Beach Length to Crest w/ Time at NIR thrshlds',
  colors: ['cf513e'],
  hAxis: {
    title: 'Date',
    titleTextStyle: { italic: false, bold: true }
  },
  vAxis: {
    title: 'Min. Beach Length (meters)',
    titleTextStyle: { italic: false, bold: true }
  },
  pointSize: 4,
  dataOpacity: 0.4,
  legend: { position: 'none' },
});
print('NIR Min Beaches', chart);
