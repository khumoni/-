export interface BusinessData {
  // 1. Business Identity
  id: string;
  businessName: string;
  category: string;
  subCategory: string;
  keywords: string[];
  yearFounded: string;

  // 2. Location Power Data
  address: string;
  latitude: number;
  longitude: number;
  serviceArea: string;
  nearbyCompetitorsCount: number;
  googleMapsUrl?: string; // Derived from grounding

  // 3. Contact + Digital Presence
  phone: string;
  secondaryPhone: string;
  email: string;
  website: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  whatsapp: string;
  messenger: string;

  // 4. Authority & Trust Signals
  googleRating: number;
  totalReviews: number;
  photosCount: number;
  openingHours: string;
  peakBusyHours: string;

  // 5. Website Intelligence
  sslStatus: "Yes" | "No" | "Unknown";
  mobileFriendly: "Yes" | "No" | "Unknown";
  speedScore: number;
  domainAuthority: number;
  techStack: string;
  emailPattern: string;

  // 6. AI Intelligence
  summary: string;
  summary_bn?: string; // Bengali
  strengthScore: number;
  weaknessScore: number;
  leadGenScore: number;
  engagementScore: number;
  threatLevel: "Low" | "Medium" | "High";
  idealCustomer: string;
  idealCustomer_bn?: string; // Bengali
  adAngles: string[];
  adAngles_bn?: string[]; // Bengali
  marketingHooks: string[];
  marketingHooks_bn?: string[]; // Bengali
  conversionProb: number;
  
  // 7. Sales Intelligence
  salesOpportunities: string[]; // List of recommended services from the 25 list
  salesOpportunities_bn?: string[]; // Bengali
}

export interface SearchState {
  query: string;
  isLoading: boolean;
  error: string | null;
  results: BusinessData[];
  groundingAttribution: string[]; // URLs from grounding chunks
}