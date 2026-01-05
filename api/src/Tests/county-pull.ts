import 'dotenv/config';
import { PrismaClient } from '@prisma/client'
import { getPropertyData, propertySearch, getExpandedPropertyData} from '../modules/attom/attom.controller.ts';

const prisma = new PrismaClient();

async function clear() {
  try {
      await prisma.mockHouse.deleteMany({});
  } catch (error) {
    console.error('Error clearing MockHouse data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function AttomToSupabaseTest() {
  var mainAddress = "";
  var lat = 0;
  var lon = 0;
  var neighborhoodValue = "";
  var visitDuration = 0;
  var statusCode = "";
  var streetNameValue = "";
  var houseNum = 0;

  //get data from AATOM
  const attomData = await getPropertyData("10634 Cyrus Drive", "Indianapolis, IN 46231");

  //assign values from attomData to variables
  mainAddress = attomData.property[0].address.line1 + ", " + attomData.property[0].address.line2;
  lat = parseFloat(attomData.property[0].location.latitude);
  lon = parseFloat(attomData.property[0].location.longitude);
  neighborhoodValue = attomData.property[0].area.subdname || "Unknown";
  visitDuration = 0;
  statusCode = "ACTIVE";
  streetNameValue = attomData.property[0].address.line1 || "Unknown";
  houseNum = 0;

  try {
    const result = await prisma.mockHouse.create({
      data: {
        address: mainAddress,
        latitude: lat,
        longitude: lon,
        neighborhood: neighborhoodValue,
        visitDurationMinutes: visitDuration,
        status: statusCode,   // or just "ACTIVE" if you mapped it as string
        streetName: streetNameValue.replace(/\d+/g, '').trim(),
        houseNumber: houseNum,
      },
    });

    console.log('Created MockHouse:', result);
  } catch (error) {
    console.error('Error creating MockHouse:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function mainTest() {
  //variables for each property field
  var houseId = 0;
  var mainAddress = "";
  var lat = 0;
  var lon = 0;
  var neighborhoodValue = "";
  var visitDuration = 0;
  var statusCode = "";
  var streetNameValue = "";
  var propertyVal = 0.0;
  var houseNum = 0;
  var count = 0;

  try {
  //loop through calculated Attom pages (Use Postman to get total and pagesize; i = total/pagesize)
  const lastPage = 200;//200; //(10,000 total / 50 pagesize)
  for (let page = 1; page <= lastPage; page++) {
    //fetch property snapshot data from ATTOM API for current page
    const attomData = await propertySearch({
      geoIdV4: "f54b1b07afd4de52f27b5edf15ae972f", //Hendricks County, IN
      pagesize: 50,
      page: page,
    });

    //cycle through each found property
    for (const property of attomData.property) {
        //check if residence is single family
        if (property.summary.proptype == "SFR") {
          //assign values from attomData to variables
          houseId = property.identifier.attomId;
          mainAddress = property.address.line1 + ", " + property.address.line2;
          lat = parseFloat(property.location.latitude);
          lon = parseFloat(property.location.longitude);
          neighborhoodValue = "Unknown"; //TODO
          visitDuration = 0;
          statusCode = "ACTIVE";
          streetNameValue = property.address.line1 || "Unknown";
          houseNum = 0;

          ///TODO - run ExpandedPropertyData fetch to get property value
          const expandedData = await getExpandedPropertyData(property.address.line1, property.address.line2);
          propertyVal = expandedData.property[0].assessment.market.mktTtlValue || 0.0;
          neighborhoodValue = expandedData.property[0].area.subdName || "Unknown";
          //save data to supabase
          var propertySaved = await prisma.mockHouse.create({
            data: {
              houseId: houseId,
              address: mainAddress,
              latitude: lat,
              longitude: lon,
              neighborhood: neighborhoodValue,
              visitDurationMinutes: visitDuration,
              status: statusCode,   // or just "ACTIVE" if you mapped it as string
              streetName: streetNameValue.replace(/\d+/g, '').trim(),
              propertyValue: propertyVal
            },
          });
          count++;
          console.log('Houses Saved: ', count);

        }
    }
    
  }
} catch (error) {
  console.error('Error in mainTest execution:', error);
  throw error;
} finally {
  await prisma.$disconnect();
}

}

mainTest()
  .then(() => {
    console.log('Data Push complete!');
  })
  .catch((error) => {
    console.error('Error in main execution:', error);
    process.exit(1);
  });