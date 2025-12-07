export interface CategoryGroup {
  name: string;
  items: string[];
}

export const GROUPED_CATEGORIES: CategoryGroup[] = [
  {
    name: "Retail & Shopping",
    items: [
      "Clothing Store",
      "Electronics Store",
      "Grocery Store",
      "Furniture Store",
      "Hardware Store",
      "Jewelry Store",
      "Shopping Mall",
      "Wholesaler",
      "Pet Shop",
      "Toy Store",
      "Book Store",
      "Sporting Goods Store",
      "Florist",
      "Gift Shop",
      "Department Store",
      "Convenience Store"
    ]
  },
  {
    name: "Food & Dining",
    items: [
      "Restaurant",
      "Cafe",
      "Bakery",
      "Bar",
      "Brewery",
      "Fast Food Restaurant",
      "Pizza Restaurant",
      "Ice Cream Shop",
      "Seafood Restaurant",
      "Steak House",
      "Sushi Restaurant",
      "Vegetarian Restaurant",
      "Winery",
      "Pub"
    ]
  },
  {
    name: "Health & Wellness",
    items: [
      "Dentist",
      "Doctor",
      "Gym",
      "Pharmacy",
      "Hospital",
      "Spa",
      "Yoga Studio",
      "Physical Therapist",
      "Chiropractor",
      "Dermatologist",
      "Beauty Salon",
      "Hair Salon",
      "Nail Salon",
      "Health Clinic"
    ]
  },
  {
    name: "Professional Services",
    items: [
      "Lawyer",
      "Accountant",
      "Real Estate Agency",
      "Marketing Agency",
      "Consultant",
      "Insurance Agency",
      "Notary Public",
      "Web Designer",
      "Architect",
      "Employment Agency",
      "Photographer",
      "Ad Agency"
    ]
  },
  {
    name: "Automotive",
    items: [
      "Car Repair",
      "Car Dealer",
      "Car Wash",
      "Auto Parts Store",
      "Gas Station",
      "Tire Shop",
      "Oil Change Station",
      "Car Rental",
      "Auto Body Shop"
    ]
  },
  {
    name: "Trades & Home Services",
    items: [
      "Plumber",
      "Electrician",
      "Contractor",
      "Landscaper",
      "Locksmith",
      "HVAC Services",
      "Cleaner",
      "Painter",
      "Roofer",
      "Mover",
      "Carpenter",
      "Pest Control"
    ]
  },
  {
    name: "Hospitality & Travel",
    items: [
      "Hotel",
      "Motel",
      "Travel Agency",
      "Resort",
      "Bed & Breakfast",
      "Campground",
      "Airport",
      "Taxi Service"
    ]
  },
  {
    name: "Education",
    items: [
      "School",
      "University",
      "College",
      "Library",
      "Driving School",
      "Music School",
      "Day Care Center",
      "Dance School",
      "Preschool"
    ]
  },
  {
    name: "Arts & Entertainment",
    items: [
      "Movie Theater",
      "Museum",
      "Art Gallery",
      "Night Club",
      "Casino",
      "Bowling Alley",
      "Park",
      "Zoo",
      "Amusement Park",
      "Stadium"
    ]
  },
  {
    name: "Financial Services",
    items: [
      "Bank",
      "ATM",
      "Financial Planner",
      "Investment Bank",
      "Loan Agency",
      "Credit Union"
    ]
  }
];

// Keep a flat list for backward compatibility if needed, or helper lookups
export const ALL_CATEGORIES = GROUPED_CATEGORIES.flatMap(g => g.items);
