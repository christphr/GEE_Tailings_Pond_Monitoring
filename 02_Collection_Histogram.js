/*
This code takes a table of Sentinel-2 image dates,
creates a collection and determines the histogram of the imagery in the collection
*/

//decalre the site name as a cleint side string:
var siteName = "Impala";

// provide the tile name, important at tile overlaps
var ESA_S2_MGRS_TILE = '35JNM';

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
  .filterDate('2019-01-01','2022-01-31')
  .filterBounds(centr)
  // fitler by the ESA Sentinel-2 tile (required wehre there is an overlap of tiles).
  // Comment out if not required.
  // .filter(ee.Filter.eq('MGRS_TILE', ESA_S2_MGRS_TILE))
  .map(addDate);

//filter by date stamp
var collection_list = collection.filter(ee.Filter.inList('IMAGE_DATE', im_list));

//fucntion to clip each image to the crest of the site
var clipper = function(image){
  return ee.Image(image).clip(outlne);
};

//clip each image in the collection
var s2c = collection_list.map(clipper);

// Add a functn that can calculate the NDWI raster layer and create a band
var addndwi = function(image){
  var ndwi = image.normalizedDifference(['B3', 'B8']).rename('NDWI');
  return image.addBands(ndwi);
  };

//add an NDWI band to images in the collection  
var s2c = s2c.map(addndwi).select("B2","B3","B4","B8","B8A","NDWI");
// print the entire collection
print('S2_SR Collection filtered by area and date w/ NDWI Band',s2c.first());

// create a collection by selecting only the NDWI band
var ndwiColl = ee.ImageCollection(s2c.select("NDWI"));
// print out the NDWI collection
print('S2_SR Image NDWI Band',ndwiColl);

var nirColl = ee.ImageCollection(s2c.select("B8"));
// print out the NDWI collection
print('S2_SR Image NIR Band',nirColl);
//}

////////////////////////////////////////////////////
              // Create Filmstrip and Charts  //
////////////////////////////////////////////////////
//{

//declare constant video arguments for the filmstrip below {
var videoArgs = {
  dimensions: 400,
  region: filmArea,
  min: 175,
  max: 2500,
  bands: ['B4', 'B3', 'B2'],
};
//}

print(collection_list.getFilmstripThumbURL(videoArgs));

var s2cHist = s2c.mean();

Map.addLayer(s2cHist,
  {min: 175,
  max: 2500,
  bands: ['B4', 'B3', 'B2']},
  'S2 Histogram Image');
  
//Histograms
//{
var MinHistBucket = 10;

var chart = ui.Chart.image.histogram({
          image: s2cHist.select("B2","B3","B4","B8"),
          region: outlne,
          scale: 10,
          minBucketWidth: MinHistBucket})
        .setSeriesNames(['Blue','Green','Red','Wide NIR'])
        .setOptions({
          title: siteName+' Sentinel-2 SR Near-Infrared Reflectance Histogram',
          hAxis: {
            title: 'Reflectance (scaled by a factor of 10 000)',
            titleTextStyle: {italic: false, bold: true},
          },
          vAxis:
              {title: 'Count', titleTextStyle: {italic: false, bold: true}},
          colors: ['blue','green','red','purple']
        });
print('Histogram of Mean Reflectances', chart);

var MinHistBucket = 5e-3;

var chart = ui.Chart.image.histogram({
      image: s2cHist.select("NDWI"),
      region: outlne,
      scale: 10,
      minBucketWidth: MinHistBucket})
        .setSeriesNames(['NDWI'])
        .setOptions({
          title: siteName+' Sentinel-2 SR Mean NDWI Histogram',
          hAxis: {
            title: 'Normalised Difference Water Index (NDWI) Ratio',
            titleTextStyle: {italic: false, bold: true},
          },
          vAxis:
              {title: 'Count', titleTextStyle: {italic: false, bold: true}},
          colors: ['blue']
        });
print('Histogram of Mean NDWI Reflectances', chart);
//}
//}
