export default {
  async fetch(request) {
    const url = new URL(request.url);
    const cnic = url.searchParams.get('cnic');
    const mobile = url.searchParams.get('mobile');

    // Step 1: Validate at least one parameter
    if (!cnic && !mobile) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Missing parameters. Use ?cnic=YOUR_CNIC or ?mobile=MOBILE_NUMBER'
        }, null, 2),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Step 2: Validate CNIC format (13 digits)
    if (cnic && !/^\d{13}$/.test(cnic)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid CNIC format. Must be 13 digits without dashes.'
        }, null, 2),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    // Step 3: Validate Mobile format (11 digits starting with 03)
    if (mobile && !/^03\d{9}$/.test(mobile)) {
      return new Response(
        JSON.stringify({
          status: 'error',
          message: 'Invalid Mobile format. Must be 11 digits starting with 03.'
        }, null, 2),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          } 
        }
      );
    }

    try {
      // Step 4: Use RIDHA SIM Tracker API
      const simTrackerUrl = 'https://ridhasimtracker.com/result.php';
      
      // Prepare form data for POST request
      const formData = new URLSearchParams();
      
      if (cnic) {
        formData.append('cnic', cnic);
      }
      if (mobile) {
        formData.append('mobile', mobile);
      }
      
      formData.append('submit', 'Check');

      // Make request to RIDHA SIM Tracker
      const trackerResponse = await fetch(simTrackerUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Referer': 'https://ridhasimtracker.com/',
          'Origin': 'https://ridhasimtracker.com'
        },
        body: formData.toString()
      });

      const html = await trackerResponse.text();
      
      // Step 5: Parse the response for complete information
      const resultData = parseRidhaData(html);

      // Step 6: Create final response
      const result = {
        status: "success",
        data: {
          search_type: cnic ? "cnic" : "mobile",
          search_value: cnic || mobile,
          owner_info: {
            name: resultData.ownerName,
            cnic: resultData.cnic,
            father_name: resultData.fatherName,
            address: resultData.address
          },
          sim_details: {
            total_numbers: resultData.totalNumbers,
            networks: resultData.networks,
            numbers_list: resultData.numbersList
          },
          summary: {
            totalVoiceData: resultData.networks.reduce((sum, net) => sum + net.voiceData, 0),
            totalDataOnly: resultData.networks.reduce((sum, net) => sum + net.dataOnly, 0),
            overallTotal: resultData.networks.reduce((sum, net) => sum + net.total, 0)
          },
          source: "ridhasimtracker.com",
          timestamp: new Date().toISOString(),
          note: resultData.networks.length > 0 ? "Data from RIDHA SIM Tracker" : "No SIMs found"
        },
        credit: "@old_studio786"
      };

      return new Response(
        JSON.stringify(result, null, 2),
        {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store'
          }
        }
      );

    } catch (error) {
      console.error('Error:', error);
      
      return new Response(
        JSON.stringify({
          status: "error",
          message: "Unable to fetch data from RIDHA SIM Tracker. Service might be down or requires human verification.",
          suggestion: "Please visit https://ridhasimtracker.com directly to check your SIM information",
          credit: "@old_studio786"
        }, null, 2),
        {
          status: 503, 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
  }
};

// Parse RIDHA SIM Tracker website data for complete information
function parseRidhaData(html) {
  const networks = [];
  const numbersList = [];
  
  // Extract owner information
  const ownerInfo = extractOwnerInfo(html);
  
  // Extract mobile numbers and their details
  const mobileDetails = extractMobileNumbers(html);
  numbersList.push(...mobileDetails);

  // Network patterns
  const networkPatterns = [
    { name: "Jazz", regex: /Jazz[^0-9]*(\d+)/gi },
    { name: "Telenor", regex: /Telenor[^0-9]*(\d+)/gi },
    { name: "Ufone", regex: /Ufone[^0-9]*(\d+)/gi },
    { name: "Zong", regex: /Zong[^0-9]*(\d+)/gi }
  ];

  const networkCounts = {
    'Jazz': { voice: 0, data: 0 },
    'Telenor': { voice: 0, data: 0 },
    'Ufone': { voice: 0, data: 0 }, 
    'Zong': { voice: 0, data: 0 }
  };

  // Count networks from mobile numbers
  mobileDetails.forEach(mobile => {
    if (networkCounts[mobile.network]) {
      networkCounts[mobile.network].voice++;
    }
  });

  // Also search for network counts in HTML
  networkPatterns.forEach(pattern => {
    const matches = html.matchAll(pattern.regex);
    for (const match of matches) {
      const count = parseInt(match[1]) || 0;
      networkCounts[pattern.name].voice += count;
    }
  });

  // Convert to networks array
  Object.keys(networkCounts).forEach(network => {
    if (networkCounts[network].voice > 0 || networkCounts[network].data > 0) {
      networks.push({
        network: network,
        voiceData: networkCounts[network].voice,
        dataOnly: networkCounts[network].data,
        total: networkCounts[network].voice + networkCounts[network].data
      });
    }
  });

  // Add total if we have any networks
  if (networks.length > 0) {
    networks.push({
      network: "Total",
      voiceData: networks.reduce((sum, net) => sum + net.voiceData, 0),
      dataOnly: networks.reduce((sum, net) => sum + net.dataOnly, 0),
      total: networks.reduce((sum, net) => sum + net.total, 0)
    });
  }
  
  return {
    ownerName: ownerInfo.name,
    cnic: ownerInfo.cnic,
    fatherName: ownerInfo.fatherName,
    address: ownerInfo.address,
    totalNumbers: mobileDetails.length,
    networks: networks,
    numbersList: numbersList
  };
}

// Extract owner information from HTML
function extractOwnerInfo(html) {
  const ownerInfo = {
    name: 'Not found',
    cnic: 'Not found',
    fatherName: 'Not found',
    address: 'Not found'
  };

  // Extract Owner Name
  const nameRegex = /Owner Name[^:]*:([^<]+)/gi;
  const nameMatch = html.match(nameRegex);
  if (nameMatch) {
    ownerInfo.name = nameMatch[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '') || 'Not found';
  }

  // Extract CNIC
  const cnicRegex = /CNIC[^:]*:([^<]+)/gi;
  const cnicMatch = html.match(cnicRegex);
  if (cnicMatch) {
    ownerInfo.cnic = cnicMatch[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '') || 'Not found';
  }

  // Extract Father Name
  const fatherRegex = /Father Name[^:]*:([^<]+)/gi;
  const fatherMatch = html.match(fatherRegex);
  if (fatherMatch) {
    ownerInfo.fatherName = fatherMatch[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '') || 'Not found';
  }

  // Extract Address (look for multiple address patterns)
  const addressPatterns = [
    /Address[^:]*:([^<]+)/gi,
    /Residential Address[^:]*:([^<]+)/gi,
    /Permanent Address[^:]*:([^<]+)/gi
  ];

  for (const pattern of addressPatterns) {
    const addressMatch = html.match(pattern);
    if (addressMatch) {
      ownerInfo.address = addressMatch[0].split(':')[1]?.trim().replace(/<[^>]*>/g, '') || 'Not found';
      break;
    }
  }

  return ownerInfo;
}

// Extract mobile numbers and their details
function extractMobileNumbers(html) {
  const mobileNumbers = [];
  
  // Pattern to find mobile numbers in the HTML
  const mobileRegex = /03\d{2}-\d{7}|03\d{9}/g;
  const mobileMatches = html.matchAll(mobileRegex);
  
  for (const match of mobileMatches) {
    const mobileNumber = match[0].replace(/-/g, '');
    
    // Find network for this mobile number
    let network = 'Unknown';
    const networks = ['Jazz', 'Telenor', 'Ufone', 'Zong'];
    
    // Look for network information near the mobile number
    const contextStart = Math.max(0, match.index - 200);
    const contextEnd = Math.min(html.length, match.index + 200);
    const context = html.substring(contextStart, contextEnd);
    
    for (const net of networks) {
      if (context.includes(net)) {
        network = net;
        break;
      }
    }
    
    // Determine SIM type based on number pattern or context
    let simType = 'Voice + Data';
    if (context.includes('Data Only') || context.includes('Data SIM')) {
      simType = 'Data Only';
    }
    
    mobileNumbers.push({
      number: mobileNumber,
      network: network,
      sim_type: simType,
      status: 'Active' // Default status
    });
  }
  
  return mobileNumbers;
            }
