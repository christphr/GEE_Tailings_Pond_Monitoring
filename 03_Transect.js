/*
This code takes a table of Sentinel-2 image dates,
and calculates the statistics of that image collection
along a transect line
*/

//decalre the site name as a cleint side string:
var siteName = "Impala";

var startDate   =   '2019-01-01';
var endDate     =   '2022-01-31';

// provide the tile name, important at tile overlaps
var ESA_S2_MGRS_TILE = '35JNM';

//Declare the optimum threshold for detection of the pond:
var ndwiOptimum = 0.107;
var nirOptimum = 891;

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
print('List of dates to select images by',im_list);
////////////////////////////////////////////////////
    // Declare the collections to use //
////////////////////////////////////////////////////
//{
// Import the Sentinel 2 surface reflectance collection.
// filter by Dates in List,

//centre map at AoI
Map.centerObject({
  object: outlne,
  zoom: 14});

//function to add a time stamp field to the image properties
var addDate = function(image) {
  var date = ee.Date(image.get('system:time_start')).format('yyyy/MM/dd');
  return image.set('IMAGE_DATE',date);
};

// filter the collection and add date stamp to each image
var collection = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterDate(startDate,endDate)
  .filterBounds(centr)
  // fitler by the ESA Sentinel-2 tile (required wehre there is an overlap of tiles).
  // Comment out if not required.
  // .filter(ee.Filter.eq('MGRS_TILE', ESA_S2_MGRS_TILE))
  .map(addDate);

//filter by date stamp
var collection_list = collection.filter(ee.Filter.inList('IMAGE_DATE', im_list));

//fucntion to clip each image to the crest of the site
var clipper = function(image){
  return ee.Image(image).clip(geometry);
};

//clip each image in the collection
var s2c = collection_list.map(clipper);

// Add a functn that can calculate the NDWI raster layer and create a band
var addndwi = function(image){
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
  };
  
var addXYImg = function(image){
  var XYImg = ee.Image.pixelCoordinates('EPSG:3857').rename('x', 'y');
  return image.addBands(XYImg)};

//add an NDWI band to images in the collection  
var s2c = s2c.map(addndwi).map(addXYImg).select("B2","B3","B4","B8","B8A","NDWI","x","y");
// print the entire collection
print('S2_SR Collection filtered by area and date w/ NDWI Band',s2c);

// create a collection by selecting only the NDWI band
var ndwiColl = ee.ImageCollection(s2c.select("NDWI","x","y"));
// print out the NDWI collection
// print('S2_SR Image NDWI Band',ndwiColl);

var nirColl = ee.ImageCollection(s2c.select("B8","x","y"));
// print out the NDWI collection
// print('S2_SR Image NIR Band',nirColl);
//}
var scalebar = require('users/marcyinfeng/utils:scalebar');
Map.addLayer(s2c.mean(),{min:0,max:3500,bands:["B4","B3","B2"]},"S2 Mean Natural Colour Image");
Map.addLayer(ndwiColl.mean(),{palette: ["black","blue","yellow","red"],min:0.75,max:-0.75,bands:["NDWI"]},"NDWI Mean Image");
Map.addLayer(nirColl.mean(),{palette: ["black","blue","yellow","red"],min:0,max:3000,bands:["B8"]},"NIR Mean Image");

Export.image.toDrive({
image: s2c.select("B2","B3","B4","B8","B8A").mean().toInt16(),
description: siteName+'_S2_Mean',
folder:'GEE_'+siteName,
// fileNamePrefix:,
region: geometry,
scale:10,
maxPixels: 1e9})

Export.image.toDrive({
image: s2c.select("NDWI").mean().toFloat(),
description: siteName+'_S2_NDWI_Mean',
folder:'GEE_'+siteName,
// fileNamePrefix:,
region: geometry,
scale:10,
maxPixels: 1e9})


/////////////////////////////////////
/////////// Trasects //////////
/////////////////////////////////
//{

var transect = function(image){
    var list = image.reduceRegion({
      reducer: ee.Reducer.toList(),
      geometry: line,
      scale: 10,});
  return ee.Dictionary(list)};
    
var reduceMODE = function(imageCollection){
    var modal = imageCollection.reduce({
      reducer: ee.Reducer.mode({
        maxBuckets: 4,
        minBucketWidth: null,
        maxRaw: 4
        })
    });
  return ee.Image(modal)};

var easting = ee.List(transect(ndwiColl.mean()).get("x"));
var northing = ee.List(transect(ndwiColl.mean()).get("y"));
var easting = easting.sort(easting);
var northing = northing.sort(easting);
var numberElements = easting.length();
// print("easting sorted by x",easting,"northing sorted by x", northing,"number",numberElements);

var MaxNDWI = transect(ndwiColl.max()).select(["NDWI"]).toArray();
var MinNDWI = transect(ndwiColl.min()).select(["NDWI"]).toArray();
var MeanNDWI = transect(ndwiColl.mean()).select(["NDWI"]).toArray();
var MedianNDWI = transect(ndwiColl.median()).select(["NDWI"]).toArray();
var ModeNDWI = transect(reduceMODE(ndwiColl)).select(["NDWI_mode"]).toArray();

// print("mode NDWI",ModeNDWI)
// print("mean NDWI",MeanNDWI)

var MaxNIR= transect(nirColl.max()).select(["B8"]).toArray();
var MinNIR = transect(nirColl.min()).select(["B8"]).toArray();
var MeanNIR = transect(nirColl.mean()).select(["B8"]).toArray();
var MedianNIR = transect(nirColl.median()).select(["B8"]).toArray();
var ModeNIR = transect(reduceMODE(nirColl)).select(["B8_mode"]).toArray();

// print("median NIR",MedianNIR)
// print("mean NIR",MeanNIR)

var ndwiPlotData = ee.Array.cat([MaxNDWI,MinNDWI,MeanNDWI,MedianNDWI,ModeNDWI],0);
var nirPlotData = ee.Array.cat([MaxNIR,MinNIR,MeanNIR,MedianNIR,ModeNIR],0);
// print("Plot Data:","NDWI",ndwiPlotData,"NIR",nirPlotData);

var westLim = ee.Number(easting.reduce(ee.Reducer.first())); 
var southLim = ee.Number(northing.reduce(ee.Reducer.first())); 

var easting = ee.Array(easting);
var northing = ee.Array(northing);

var deltaX = easting.subtract(westLim);
var deltaY = northing.subtract(southLim);
var chains = deltaX.pow(2).add(deltaY.pow(2)).sqrt();
var lineLength = line.length({maxError:1,proj:'EPSG:3857'}).ceil();

print("Chainage",chains);
//}

//////////////////////////////////////////
//           Defines Charts             //
//////////////////////////////////////////
//{
// Define the chart and print it to the console.

// formatting
var COLOURS = ['blue','green','orange','red','purple',] ;
var LINESIZE = 2 ;
var POINTS = 0 ;
var OPACITY = 1 ;
var SERIES = ['Maximum','Minimum','Mean','Median','Mode'] ;
var NDWI_ManMan =  {min:   -0.6,  max:  1};
var NIR_MinMax  =  {min:    0.0,  max:  3000};

var FONT_SIZE = 26;
var myTextStyle = {italic: false, bold: false};

var chart1 = ui.Chart.array.values({array: ndwiPlotData, axis: 1, xLabels: chains})
                .setSeriesNames(SERIES)
                .setOptions({
                  fontSize: FONT_SIZE,
                  titleTextStyle: myTextStyle,
                  title: 'NDWI Profile Along Chainage at '+siteName,//' between '+startDate+' and '+endDate,
                  hAxis: {
                    title: 'Chainage (m)',
                    // viewWindow: {min: 0, max: lineLength},
                    viewWindowMode:'maximized',
                    titleTextStyle: myTextStyle,
                    gridlines: {
                      color: 'black'}
                  },
                  vAxis: {
                    title: 'NDWI (Ratio)',
                    viewWindow: NDWI_ManMan,
                    titleTextStyle: myTextStyle,
                    gridlines: {
                      color: 'black'}
                  },
                  chartArea: {
                    left:'10%',top:'15%',width:'70%',height:'75%',
                    backgroundColor: {
                       fill:    'white',
                       stroke:  'black',
                       strokeWidth: 1   }},
                  colors:       COLOURS,
                  lineSize:     LINESIZE,
                  pointSize:    POINTS,
                  dataOpacity:  OPACITY,
                  legend: {position: 'top'}
                })
                ;
print(chart1);

var chart2 = ui.Chart.array.values({array: nirPlotData, axis: 1, xLabels: chains})
                .setSeriesNames(SERIES)
                .setOptions({
                  title: 'Near Infrared Profile Along Chainage at '+siteName,//+' between '+startDate+' and '+endDate,
                  fontSize: FONT_SIZE,
                  titleTextStyle: myTextStyle,
                  hAxis: {
                   title: 'Chainage (m)',
                    viewWindowMode:'maximized',
                    titleTextStyle: myTextStyle,
                    gridlines: {
                      color: 'black'}
                  },
                  vAxis: {
                    title: 'Relfectance (scaled by 10 000)',
                    viewWindow: NIR_MinMax,
                    titleTextStyle: myTextStyle,
                    gridlines: {
                      color: 'black'}
                  },
                  chartArea: {
                    left:'10%',top:'15%',width:'70%',height:'75%',
                    backgroundColor: {
                       fill:    'white',
                       stroke:  'black',
                       strokeWidth: 1   }},
                  colors:       COLOURS,
                  lineSize:     LINESIZE,
                  pointSize:    POINTS,
                  dataOpacity:  OPACITY,
                  legend: {position: 'top'}
                })
                ;
print(chart2);
//}

   //////////////////////
  /// Video Stuff //////
 //////////////////////
//{
var videoArgs0 = {
  dimensions: 600,
  region: filmArea,
  max: 1e6
  };

var videoArgs1 = {
  dimensions: 600,
  region: filmArea,
  bands: ["B4","B3","B2"],
  max: 2750,
  min: 150,
  };
  
var videoArgs2 = {
  dimensions: 600,
  region: filmArea,
  bands: ["B4","B3","B2"],
  max: 2750,
  min: 150,
  framesPerSecond: 3,
  };


print("Image collection Used Filmstrip",collection_list.getFilmstripThumbURL(videoArgs1));
print("Image collection Used GIF",collection_list.getVideoThumbURL(videoArgs2));

//}
