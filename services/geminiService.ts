import { GoogleGenAI } from "@google/genai";
import { BusinessData } from "../types";
import { HIGH_DEMAND_SERVICES } from "../services";

const SYSTEM_INSTRUCTION = `
You are an advanced Market Intelligence AI specialized in analyzing Google Maps Business Profiles.
Your specific goal is to EXTRACT CONTACT DETAILS (Phone with Country Code, Email/Gmail) and provide a DETAILED STRATEGIC ANALYSIS for each business in both ENGLISH and BENGALI.

For each business found via the Google Maps tool, generate a JSON object with the fields below.

CRITICAL INSTRUCTIONS:
1. **PHONE NUMBERS**: YOU MUST EXTRACT THE PHONE NUMBER WITH THE INTERNATIONAL COUNTRY CODE (e.g., +1-212-555-0199 for USA, +880-17-12345678 for Bangladesh, +44-20... for UK). Do not return local formats without the country code.
2. **EMAIL & WEBSITE ANALYSIS**: Actively analyze the business's website and digital presence to find an EMAIL ADDRESS. 
   - Look specifically for **GMAIL** addresses (e.g., businessname@gmail.com) which are common for local businesses.
   - If a Gmail isn't found, look for domain emails (info@domain.com, contact@domain.com).
   - If the specific email isn't listed in the Maps profile, infer it from the website structure or common patterns if high confidence.
3. **DETAILED ANALYSIS**: In the 'summary' field, analyze its competitive standing.
4. **BILINGUAL OUPUT**: You MUST provide Bengali translations for 'summary', 'idealCustomer', 'adAngles', 'marketingHooks', and 'salesOpportunities' in their respective *_bn fields.
5. **SALES OPPORTUNITIES**: Analyze the business's weaknesses (e.g. no website, low rating, missed calls likely) and recommend 3-5 specific services from the provided "High Demand Services" list that they need most.
6. **JSON FORMATTING**: 
   - **CRITICAL**: You MUST return strictly valid JSON. 
   - **DO NOT** use double quotes (") inside string values for emphasis. Use single quotes (') instead.
     - INCORRECT: "summary": "They offer "fast" delivery"
     - CORRECT: "summary": "They offer 'fast' delivery"
   - Do not include Markdown formatting (no \`\`\`json).

Required JSON Structure:
{
  "businessName": "string",
  "category": "string",
  "subCategory": "string",
  "keywords": ["string", "string"],
  "yearFounded": "string (estimate)",
  "address": "string",
  "latitude": number,
  "longitude": number,
  "serviceArea": "string (inferred)",
  "nearbyCompetitorsCount": number (estimate),
  "phone": "string (MUST include Country Code e.g. +1...)",
  "secondaryPhone": "string (or N/A)",
  "email": "string (Extracted from website/profile, prioritize Gmail)",
  "website": "string",
  "facebook": "string (url or N/A)",
  "instagram": "string (url or N/A)",
  "linkedin": "string (url or N/A)",
  "whatsapp": "string (number or N/A)",
  "messenger": "string (link or N/A)",
  "googleRating": number,
  "totalReviews": number,
  "photosCount": number,
  "openingHours": "string (brief summary)",
  "peakBusyHours": "string",
  "sslStatus": "Yes/No (infer from website)",
  "mobileFriendly": "Yes/No (infer from business type)",
  "speedScore": number (0-100 estimate),
  "domainAuthority": number (0-100 estimate),
  "techStack": "string (e.g. WordPress, Custom)",
  "emailPattern": "string (e.g. firstname@gmail.com)",
  "summary": "string (Detailed strategic analysis in English)",
  "summary_bn": "string (Detailed strategic analysis in Bengali)",
  "strengthScore": number (0-100),
  "weaknessScore": number (0-100),
  "leadGenScore": number (0-100),
  "engagementScore": number (0-100),
  "threatLevel": "Low/Medium/High",
  "idealCustomer": "string (in English)",
  "idealCustomer_bn": "string (in Bengali)",
  "adAngles": ["string", "string"],
  "adAngles_bn": ["string", "string"] (Bengali translations),
  "marketingHooks": ["string", ... 10 hooks],
  "marketingHooks_bn": ["string", ... 10 hooks] (Bengali translations),
  "conversionProb": number (0-100),
  "salesOpportunities": ["Service 1", "Service 2"] (Select from list, in English),
  "salesOpportunities_bn": ["Service 1", "Service 2"] (Bengali translations)
}
`;

/**
 * Robustly extracts the first JSON array found in the text by balancing brackets.
 * This fixes issues where greedy regex matches text after the JSON array.
 */
function extractJsonArray(text: string): any[] {
  const start = text.indexOf('[');
  if (start === -1) {
    throw new Error("No JSON array start '[' found in response.");
  }

  let balance = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    
    // Handle escape sequences
    if (escaped) { 
      escaped = false; 
      continue; 
    }
    if (char === '\\') { 
      escaped = true; 
      continue; 
    }
    
    // Handle string boundaries
    if (char === '"') { 
      inString = !inString; 
      continue; 
    }

    // Handle brackets if not inside a string
    if (!inString) {
      if (char === '[') {
        balance++;
      } else if (char === ']') {
        balance--;
        // If balance returns to zero, we found the matching closing bracket
        if (balance === 0) {
          const jsonStr = text.substring(start, i + 1);
          try {
            return JSON.parse(jsonStr);
          } catch (e) {
            console.error("JSON Parse Error on extracted string. Content:", jsonStr);
            throw new Error("Extracted text is not valid JSON. This usually happens if the AI used unescaped double quotes inside a string value.");
          }
        }
      }
    }
  }

  throw new Error("Could not find a balanced closing ']' for the JSON array.");
}

export const searchBusinesses = async (
  query: string, 
  categories: string[] = [],
  userLocation?: { lat: number; lng: number },
  serviceFocus: string = ""
): Promise<{ results: BusinessData[]; attribution: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const toolConfig = userLocation ? {
      retrievalConfig: {
        latLng: {
          latitude: userLocation.lat,
          longitude: userLocation.lng
        }
      }
    } : undefined;

    // Construct a more robust prompt based on query and category availability
    let promptContent = "";
    const isCategorySelected = categories.length > 0;
    const categoryString = categories.join(", ");
    const cleanedQuery = query.trim();

    // Contextualize with Service Focus if provided
    let serviceContext = "";
    if (serviceFocus) {
        serviceContext = `The user is looking for potential clients for the service: "${serviceFocus}". Prioritize businesses that likely NEED this service (e.g. if 'Website Redesign', find businesses with old/no websites). `;
    }

    // Build the core search prompt
    if (cleanedQuery && isCategorySelected) {
        promptContent = `Find ${categoryString} in ${cleanedQuery}.`;
    } else if (cleanedQuery) {
        promptContent = `Find businesses matching this query: "${cleanedQuery}"`;
        if (isCategorySelected) {
            promptContent += ` specifically matching any of these categories: ${categoryString}`;
        }
    } else if (isCategorySelected) {
        // If no query but category selected
        promptContent = `Find top-rated businesses that belong to any of these categories: ${categoryString}`;
        if (userLocation) {
             promptContent += ` near the provided location`;
        } else {
             promptContent += ` in a popular area`;
        }
    } else {
        // Fallback
        promptContent = `Find popular local businesses`;
    }

    promptContent += `. ${serviceContext}`;
    promptContent += ` Return a RAW JSON array of at least 15 businesses if possible. 
      CRITICAL: Analyze each profile deeply. 
      - Extract the PHONE NUMBER with COUNTRY CODE (e.g. +1, +880). 
      - Analyze the website to find the EMAIL address (specifically look for GMAIL addresses if the business is small/local).
      - Provide a "Detailed Analysis" in the summary field using SINGLE QUOTES for emphasis.
      - **PROVIDE BENGALI TRANSLATIONS** for summary, idealCustomer, adAngles, marketingHooks, and salesOpportunities in their respective _bn fields.
      - In the 'salesOpportunities' field, select the top 3-5 most relevant services from this list: ${JSON.stringify(HIGH_DEMAND_SERVICES)}.
      Ensure all requested data fields are present for each entry. 
      Do NOT include any markdown formatting (like \`\`\`json) or extra text outside the JSON array.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptContent,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: toolConfig,
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    const text = response.text || "";
    
    // Use robust extraction instead of simple regex
    const rawData = extractJsonArray(text);

    // Map the raw data to ensure it matches our interface strictly
    const results: BusinessData[] = rawData.map((item: any, index: number) => ({
      id: `biz-${index}-${Date.now()}`,
      businessName: item.businessName || "Unknown Business",
      category: item.category || (categories.length === 1 ? categories[0] : "General"),
      subCategory: item.subCategory || "N/A",
      keywords: Array.isArray(item.keywords) ? item.keywords : [],
      yearFounded: item.yearFounded || "N/A",
      address: item.address || "N/A",
      latitude: item.latitude || 0,
      longitude: item.longitude || 0,
      serviceArea: item.serviceArea || "Local",
      nearbyCompetitorsCount: item.nearbyCompetitorsCount || 0,
      phone: item.phone || "N/A",
      secondaryPhone: item.secondaryPhone || "N/A",
      email: item.email || "N/A",
      website: item.website || "",
      facebook: item.facebook || "",
      instagram: item.instagram || "",
      linkedin: item.linkedin || "",
      whatsapp: item.whatsapp || "",
      messenger: item.messenger || "",
      googleRating: item.googleRating || 0,
      totalReviews: item.totalReviews || 0,
      photosCount: item.photosCount || 0,
      openingHours: item.openingHours || "N/A",
      peakBusyHours: item.peakBusyHours || "N/A",
      sslStatus: item.sslStatus || "Unknown",
      mobileFriendly: item.mobileFriendly || "Unknown",
      speedScore: item.speedScore || 50,
      domainAuthority: item.domainAuthority || 0,
      techStack: item.techStack || "Unknown",
      emailPattern: item.emailPattern || "N/A",
      summary: item.summary || "",
      summary_bn: item.summary_bn || "",
      strengthScore: item.strengthScore || 50,
      weaknessScore: item.weaknessScore || 50,
      leadGenScore: item.leadGenScore || 50,
      engagementScore: item.engagementScore || 50,
      threatLevel: item.threatLevel || "Medium",
      idealCustomer: item.idealCustomer || "General Public",
      idealCustomer_bn: item.idealCustomer_bn || "",
      adAngles: Array.isArray(item.adAngles) ? item.adAngles : [],
      adAngles_bn: Array.isArray(item.adAngles_bn) ? item.adAngles_bn : [],
      marketingHooks: Array.isArray(item.marketingHooks) ? item.marketingHooks : [],
      marketingHooks_bn: Array.isArray(item.marketingHooks_bn) ? item.marketingHooks_bn : [],
      conversionProb: item.conversionProb || 50,
      salesOpportunities: Array.isArray(item.salesOpportunities) ? item.salesOpportunities : [],
      salesOpportunities_bn: Array.isArray(item.salesOpportunities_bn) ? item.salesOpportunities_bn : [],
    }));

    // Extract grounding attribution
    const attribution: string[] = [];
    if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      response.candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web?.uri) attribution.push(chunk.web.uri);
        if (chunk.maps?.uri) attribution.push(chunk.maps.uri); // Extract map links
      });
    }

    return { results, attribution };

  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
};