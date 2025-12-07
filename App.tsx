import React, { useState, useMemo, useEffect } from 'react';
import { searchBusinesses } from './services/geminiService';
import { BusinessData, SearchState } from './types';
import { BusinessRow } from './components/BusinessRow';
import { BusinessMap } from './components/BusinessMap';
import { Icons } from './components/Icons';
import { StatsOverview } from './components/StatsOverview';
import { GROUPED_CATEGORIES, CategoryGroup } from './categories';
import { HIGH_DEMAND_SERVICES } from './services';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const App: React.FC = () => {
  const [state, setState] = useState<SearchState>({
    query: '',
    isLoading: false,
    error: null,
    results: [],
    groundingAttribution: []
  });

  const [locationInput, setLocationInput] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedService, setSelectedService] = useState<string>(""); // Service Focus (Search)
  const [expandedGroups, setExpandedGroups] = useState<string[]>(["Retail & Shopping"]); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  
  // New State for Filters & Language
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [resultCategoryFilter, setResultCategoryFilter] = useState<string[]>([]);
  const [opportunityFilter, setOpportunityFilter] = useState<string>(""); // New Opportunity Filter (Result)
  const [languageMode, setLanguageMode] = useState<'en' | 'bn'>('en'); // Language Toggle

  // Smart Filters
  const [smartFilters, setSmartFilters] = useState({
    noWebsite: false,
    lowRating: false,
    noSocials: false
  });

  // View Mode: 'list' | 'map'
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Reset result filters when new results arrive
  useEffect(() => {
    setResultCategoryFilter([]);
    setOpportunityFilter("");
    setSmartFilters({ noWebsite: false, lowRating: false, noSocials: false });
    if (state.results.length > 0) {
        setViewMode('list'); // Default to list on new search
    }
  }, [state.results]);

  // Derived state for filtered results
  const filteredResults = useMemo(() => {
    let results = state.results;

    // 1. Category Filter
    if (resultCategoryFilter.length > 0) {
      results = results.filter(biz => resultCategoryFilter.includes(biz.category));
    }

    // 2. Opportunity Filter
    if (opportunityFilter) {
      results = results.filter(biz => biz.salesOpportunities && biz.salesOpportunities.includes(opportunityFilter));
    }

    // 3. Smart Filters
    if (smartFilters.noWebsite) {
        results = results.filter(biz => !biz.website || biz.website === 'N/A' || biz.website === '');
    }
    if (smartFilters.lowRating) {
        results = results.filter(biz => biz.googleRating > 0 && biz.googleRating < 4.5);
    }
    if (smartFilters.noSocials) {
        results = results.filter(biz => 
            (!biz.facebook || biz.facebook === 'N/A') && 
            (!biz.instagram || biz.instagram === 'N/A') && 
            (!biz.linkedin || biz.linkedin === 'N/A')
        );
    }

    return results;
  }, [state.results, resultCategoryFilter, opportunityFilter, smartFilters]);

  // Extract unique categories from results for the sidebar filter
  const resultCategories = useMemo(() => {
    const counts = new Map<string, number>();
    state.results.forEach(biz => {
      counts.set(biz.category, (counts.get(biz.category) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [state.results]);

  // Filter available categories for the "Browse" section
  const filteredCategoryGroups = useMemo(() => {
    if (!categorySearchTerm) return GROUPED_CATEGORIES;

    const lowerTerm = categorySearchTerm.toLowerCase();
    return GROUPED_CATEGORIES.map(group => {
      const groupMatches = group.name.toLowerCase().includes(lowerTerm);
      const matchingItems = group.items.filter(item => item.toLowerCase().includes(lowerTerm));

      if (groupMatches) return group; // Return all items if group name matches
      if (matchingItems.length > 0) return { ...group, items: matchingItems };
      return null;
    }).filter(Boolean) as CategoryGroup[];
  }, [categorySearchTerm]);

  // Auto-expand groups when searching
  useEffect(() => {
    if (categorySearchTerm) {
      setExpandedGroups(filteredCategoryGroups.map(g => g.name));
    }
  }, [categorySearchTerm, filteredCategoryGroups]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => 
      prev.includes(groupName) 
        ? prev.filter(g => g !== groupName) 
        : [...prev, groupName]
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleResultFilter = (category: string) => {
    setResultCategoryFilter(prev => 
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const addCustomCategory = () => {
    if (customCategoryInput && !selectedCategories.includes(customCategoryInput)) {
      setSelectedCategories([...selectedCategories, customCategoryInput]);
      setCustomCategoryInput("");
    }
  };

  const removeCategory = (categoryToRemove: string) => {
    setSelectedCategories(selectedCategories.filter(c => c !== categoryToRemove));
  };

  const handleSearch = async () => {
    // Basic validation
    if (!locationInput && selectedCategories.length === 0) return;

    setState(prev => ({ ...prev, isLoading: true, error: null, query: locationInput }));

    try {
      // Get location coordinates if available (optional enhancement)
      let locationCoords: { lat: number, lng: number } | undefined;
      try {
         if (!locationInput) {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
            });
            locationCoords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            };
         }
      } catch (err) {
        console.log("Location access skipped");
      }

      // Pass selectedService to search
      const { results, attribution } = await searchBusinesses(locationInput, selectedCategories, locationCoords, selectedService);
      setState(prev => ({ ...prev, isLoading: false, results, groundingAttribution: attribution }));
    } catch (err) {
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: "Failed to fetch data. Please try again." 
      }));
    }
  };

  const handleExportCSV = () => {
    // Export ALL available data fields INCLUDING SALES OPPORTUNITIES
    const csvHeaders = [
      "ID", "Business Name", "Category", "Sub Category", "Keywords", "Year Founded",
      "Address", "Latitude", "Longitude", "Service Area", "Competitors Count",
      "Phone", "Secondary Phone", "Email", "Website", "Facebook", "Instagram", "LinkedIn", "WhatsApp", "Messenger",
      "Rating", "Total Reviews", "Photos Count", "Opening Hours", "Peak Hours",
      "SSL Status", "Mobile Friendly", "Speed Score", "Domain Authority", "Tech Stack", "Email Pattern",
      "Summary", "Strength Score", "Weakness Score", "Lead Gen Score", "Engagement Score", "Threat Level",
      "Ideal Customer", "Ad Angles", "Marketing Hooks", "Conversion Probability", "Sales Opportunities"
    ];
    
    // Use filteredResults instead of state.results
    const rows = filteredResults.map(row => [
      row.id,
      row.businessName,
      row.category,
      row.subCategory,
      row.keywords.join(", "),
      row.yearFounded,
      row.address,
      row.latitude,
      row.longitude,
      row.serviceArea,
      row.nearbyCompetitorsCount,
      row.phone,
      row.secondaryPhone,
      row.email,
      row.website,
      row.facebook,
      row.instagram,
      row.linkedin,
      row.whatsapp,
      row.messenger,
      row.googleRating,
      row.totalReviews,
      row.photosCount,
      row.openingHours,
      row.peakBusyHours,
      row.sslStatus,
      row.mobileFriendly,
      row.speedScore,
      row.domainAuthority,
      row.techStack,
      row.emailPattern,
      row.summary,
      row.strengthScore,
      row.weaknessScore,
      row.leadGenScore,
      row.engagementScore,
      row.threatLevel,
      row.idealCustomer,
      row.adAngles.join("; "),
      row.marketingHooks.join("; "),
      row.conversionProb,
      row.salesOpportunities.join("; ") // New field
    ].map(val => `"${String(val || '').replace(/"/g, '""')}"`).join(','));
    
    const csv = "data:text/csv;charset=utf-8," + [csvHeaders.join(','), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `leads_full_export_${state.query || 'data'}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    
    // Title
    doc.setFontSize(18);
    doc.text(`Lead Generation Report: ${state.query || "Filtered Results"}`, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    const dateStr = new Date().toLocaleDateString();
    doc.text(`Generated on ${dateStr} • ${filteredResults.length} Businesses Found`, 14, 30);

    // Define columns for PDF
    const tableColumn = [
      "Business Name", "Category", "Location", "Phone", "Email", "Rating", "Lead Score", "Mobile Friendly", "SSL Status"
    ];

    // Use filteredResults
    const tableRows = filteredResults.map(biz => [
      biz.businessName,
      biz.category,
      biz.address.length > 40 ? biz.address.substring(0, 40) + '...' : biz.address, // Truncate address
      biz.phone,
      biz.email,
      biz.googleRating,
      biz.leadGenScore,
      biz.mobileFriendly === 'Yes' ? 'Yes' : 'No',
      biz.sslStatus === 'Yes' ? 'Yes' : 'No'
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold' }, // Green-600
      alternateRowStyles: { fillColor: [240, 253, 244] }, // Green-50
      columnStyles: {
        0: { cellWidth: 35 }, // Business Name
        1: { cellWidth: 25 }, // Category
        2: { cellWidth: 45 }, // Location (truncated)
        3: { cellWidth: 30 }, // Phone
        4: { cellWidth: 40 }, // Email
      }
    });

    doc.save(`leads_report_${state.query || 'export'}.pdf`);
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-50 font-sans overflow-hidden">
      
      {/* SIDEBAR FILTER */}
      <aside className={`flex-shrink-0 w-80 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full absolute z-20 h-full'} md:translate-x-0 md:relative`}>
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
           <Icons.Search size={18} className="text-blue-600" />
           <span className="font-bold text-lg">Search Filter</span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
          
          {/* 1. SERVICE FOCUS (High Demand Services) */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-orange-500 uppercase tracking-wide">
              <Icons.Zap size={14} /> Service Focus
            </label>
            <div className="relative">
                <select 
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-slate-700 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none appearance-none"
                >
                    <option value="">-- Select High Demand Service --</option>
                    {HIGH_DEMAND_SERVICES.map(service => (
                        <option key={service} value={service}>{service}</option>
                    ))}
                </select>
                <Icons.ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
            </div>
            <p className="text-[10px] text-gray-400">Prioritize businesses that specifically need this service.</p>
          </div>

          {/* 2. Target Location */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
              <Icons.Globe size={14} /> Target Location
            </label>
            <input 
              type="text" 
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="e.g. New York, USA or Mirpur, Dhaka"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-gray-400">Enter any City, State, or Area worldwide.</p>
          </div>

          {/* 3. Custom Category */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
              Add Custom Category
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={customCategoryInput}
                onChange={(e) => setCustomCategoryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomCategory()}
                placeholder="e.g. Pet Shop, Vape Store"
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-slate-700 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button 
                onClick={addCustomCategory}
                className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
              >
                <span className="text-xl leading-none font-medium">+</span>
              </button>
            </div>
          </div>

          {/* Selected Categories Tags */}
          {selectedCategories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCategories.map(cat => (
                 <span key={cat} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                    {cat}
                    <button onClick={() => removeCategory(cat)} className="hover:text-red-500"><Icons.X size={12} /></button>
                 </span>
              ))}
              <button 
                onClick={() => setSelectedCategories([])}
                className="text-[10px] text-gray-500 hover:text-red-500 underline self-center"
              >
                Clear all
              </button>
            </div>
          )}

          {/* 4. Browse Categories (Accordions) */}
          <div className="space-y-2">
            <div className="flex justify-between items-end mb-2">
               <label className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
                 Browse Categories
               </label>
            </div>
            
            {/* Search Categories Input */}
            <div className="relative mb-3">
               <Icons.Search className="absolute left-2.5 top-2.5 text-gray-400 h-4 w-4" />
               <input 
                  type="text" 
                  value={categorySearchTerm}
                  onChange={(e) => setCategorySearchTerm(e.target.value)}
                  placeholder="Filter categories..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm focus:ring-1 focus:ring-blue-500 outline-none transition-all"
               />
            </div>
            
            <div className="space-y-1">
              {filteredCategoryGroups.map((group) => {
                const isExpanded = expandedGroups.includes(group.name);
                return (
                  <div key={group.name} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 overflow-hidden">
                    <button 
                      onClick={() => toggleGroup(group.name)}
                      className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      {group.name}
                      <Icons.ChevronDown size={14} className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="p-3 pt-0 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20">
                        <div className="space-y-2 mt-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                          {group.items.map(item => (
                            <label key={item} className="flex items-center gap-2 cursor-pointer group">
                              <div className="relative flex items-center">
                                <input 
                                  type="checkbox" 
                                  className="peer h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-slate-700"
                                  checked={selectedCategories.includes(item)}
                                  onChange={() => toggleCategory(item)}
                                />
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                                {item}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredCategoryGroups.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-500">No categories found matching "{categorySearchTerm}"</div>
              )}
            </div>
          </div>

          {/* 5. POST-SEARCH RESULT FILTERS */}
          {state.results.length > 0 && (
            <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
               <label className="flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wide">
                 <Icons.Filter size={14} /> Filter Current Results
               </label>
               
               {/* 5a. Smart Asset Filters (NEW) */}
               <div className="bg-white dark:bg-slate-700 rounded-lg p-2 border border-gray-200 dark:border-gray-600 mb-3">
                  <label className="text-[10px] text-gray-500 uppercase font-semibold mb-2 block">Smart Filters (Sales Assets)</label>
                  <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                              checked={smartFilters.noWebsite}
                              onChange={() => setSmartFilters(prev => ({ ...prev, noWebsite: !prev.noWebsite }))}
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Missing Website</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-yellow-500 focus:ring-yellow-500"
                              checked={smartFilters.lowRating}
                              onChange={() => setSmartFilters(prev => ({ ...prev, lowRating: !prev.lowRating }))}
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">Low Rating (&lt; 4.5)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                              type="checkbox" 
                              className="rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                              checked={smartFilters.noSocials}
                              onChange={() => setSmartFilters(prev => ({ ...prev, noSocials: !prev.noSocials }))}
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">No Social Media</span>
                      </label>
                  </div>
               </div>

               {/* 5b. Result Opportunity Filter */}
               <div className="mb-3">
                  <label className="text-[10px] text-gray-500 uppercase font-semibold mb-1 block">By Sales Opportunity</label>
                  <select 
                      value={opportunityFilter} 
                      onChange={(e) => setOpportunityFilter(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  >
                      <option value="">-- All Opportunities --</option>
                      {HIGH_DEMAND_SERVICES.map(service => (
                        <option key={service} value={service}>{service}</option>
                      ))}
                  </select>
               </div>

               {/* 5c. Result Category Filter */}
               <div className="bg-blue-50 dark:bg-slate-800/50 rounded-lg p-2 border border-blue-100 dark:border-blue-900">
                 <label className="text-[10px] text-gray-500 uppercase font-semibold mb-2 block">By Category</label>
                 <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                   {resultCategories.map(([cat, count]) => (
                     <label key={cat} className="flex items-center justify-between gap-2 cursor-pointer group hover:bg-blue-100/50 dark:hover:bg-blue-900/20 p-1 rounded">
                        <div className="flex items-center gap-2">
                           <input 
                              type="checkbox" 
                              className="peer h-3.5 w-3.5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                              checked={resultCategoryFilter.includes(cat)}
                              onChange={() => toggleResultFilter(cat)}
                           />
                           <span className="text-xs text-gray-700 dark:text-gray-300 font-medium truncate max-w-[150px]">{cat}</span>
                        </div>
                        <span className="text-[10px] bg-white dark:bg-gray-700 px-1.5 rounded-full text-gray-500 border border-gray-100 dark:border-gray-600">{count}</span>
                     </label>
                   ))}
                 </div>
                 {resultCategoryFilter.length > 0 && (
                   <button onClick={() => setResultCategoryFilter([])} className="text-[10px] text-blue-600 hover:underline mt-2 w-full text-center">
                     Reset Category Filter
                   </button>
                 )}
               </div>
            </div>
          )}

        </div>

        {/* Generate Button Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
           <button 
             onClick={handleSearch}
             disabled={state.isLoading}
             className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed"
           >
             {state.isLoading ? <Icons.Loader className="animate-spin h-5 w-5" /> : 'Generate Leads'}
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50 dark:bg-slate-900/50">
        
        {/* Mobile Toggle & Header (Visible only on mobile mostly) */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10 shrink-0">
           <div className="flex items-center gap-2">
              <div className="md:hidden bg-blue-600 p-1.5 rounded-md">
                 <Icons.MapPin className="text-white h-4 w-4" />
              </div>
              <h1 className="text-lg font-bold md:hidden">GeoLead Pro</h1>
              <div className="hidden md:flex flex-col">
                 <h1 className="text-xl font-bold text-gray-800 dark:text-white">GeoLead Pro</h1>
                 <p className="text-xs text-gray-500">AI-Powered B2B Lead Generation</p>
              </div>
           </div>
           
           <div className="flex items-center gap-3">
              {/* LANGUAGE TOGGLE */}
              <button 
                onClick={() => setLanguageMode(prev => prev === 'en' ? 'bn' : 'en')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                  <Icons.Languages size={16} className="text-gray-500" />
                  <span className={languageMode === 'en' ? 'font-bold text-blue-600' : 'text-gray-500'}>EN</span>
                  <span className="text-gray-300">|</span>
                  <span className={languageMode === 'bn' ? 'font-bold text-blue-600' : 'text-gray-500'}>বাংলা</span>
              </button>

              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 bg-gray-100 rounded-md">
                <Icons.Layers size={20} />
              </button>
           </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8">
           
           {/* Empty State */}
           {!state.isLoading && state.results.length === 0 && !state.error && (
             <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto opacity-80">
                <div className="mb-6 relative">
                   <div className="absolute inset-0 bg-blue-200 rounded-full opacity-20 blur-xl animate-pulse"></div>
                   <Icons.Layers className="h-24 w-24 text-blue-300 relative z-10" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Global Lead Generation</h2>
                <p className="text-gray-500">Enter any City, Region, or Country in the sidebar and select business categories to start finding leads worldwide.</p>
             </div>
           )}

           {/* Results */}
           {state.results.length > 0 && (
             <div className="max-w-6xl mx-auto animate-fade-in pb-10">
               <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Generated Leads</h2>
                   <p className="text-sm text-gray-500">{state.query} • {selectedCategories.length > 0 ? `${selectedCategories.length} categories` : 'All Categories'} • {filteredResults.length} visible</p>
                 </div>
                 
                 <div className="flex flex-wrap items-center gap-2">
                    {/* View Toggle */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1 flex mr-2">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            <Icons.List size={16} /> List
                        </button>
                        <button 
                            onClick={() => setViewMode('map')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'map' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            <Icons.Map size={16} /> Map
                        </button>
                    </div>

                    {/* CSV EXPORT */}
                    <button onClick={handleExportCSV} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white border border-transparent px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95">
                       <Icons.Download size={16} /> Export CSV
                    </button>
                    {/* PDF EXPORT */}
                    <button onClick={handleExportPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white border border-transparent px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-md active:scale-95">
                       <Icons.FileText size={16} /> PDF Report
                    </button>
                 </div>
               </div>

               <StatsOverview data={filteredResults} />
               
               {viewMode === 'list' ? (
                   <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                     <div className="overflow-x-auto">
                       <table className="w-full text-sm text-left">
                          <thead className="bg-gray-50 dark:bg-gray-700 text-xs uppercase text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-600">
                            <tr>
                              <th className="p-4 w-10"></th>
                              <th className="px-6 py-4">Business</th>
                              <th className="px-6 py-4">Rating</th>
                              <th className="px-6 py-4">Lead Score</th>
                              <th className="px-6 py-4">Location</th>
                              <th className="px-6 py-4 text-right">Links</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredResults.length > 0 ? (
                               filteredResults.map(biz => <BusinessRow key={biz.id} data={biz} languageMode={languageMode} />)
                            ) : (
                               <tr>
                                  <td colSpan={6} className="p-8 text-center text-gray-500">
                                     No results match the current filters. <button onClick={() => {setResultCategoryFilter([]); setOpportunityFilter(""); setSmartFilters({noWebsite:false, lowRating:false, noSocials:false});}} className="text-blue-600 hover:underline">Clear Filters</button>
                                  </td>
                               </tr>
                            )}
                          </tbody>
                       </table>
                     </div>
                   </div>
               ) : (
                   /* MAP VIEW */
                   <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden h-[600px] relative">
                       <BusinessMap data={filteredResults} />
                   </div>
               )}

               {/* Attribution */}
               {state.groundingAttribution.length > 0 && (
                 <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800/50 rounded-lg text-xs text-gray-500 border border-gray-200 dark:border-gray-700">
                    <span className="font-bold block mb-2">Data Sources:</span>
                    <div className="flex flex-wrap gap-2">
                       {state.groundingAttribution.slice(0, 8).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" className="truncate max-w-[200px] hover:text-blue-500 hover:underline">{new URL(url).hostname}</a>
                       ))}
                    </div>
                 </div>
               )}
             </div>
           )}

           {/* Loading Overlay */}
           {state.isLoading && (
              <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm text-center border border-gray-100 dark:border-gray-700">
                    <Icons.Loader className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                    <h3 className="text-xl font-bold mb-2">Mining Data...</h3>
                    <p className="text-gray-500 text-sm">Locating businesses in <strong>{locationInput || 'Target Area'}</strong> and analyzing digital presence{selectedService ? ` for ${selectedService} leads` : ''}.</p>
                 </div>
              </div>
           )}

        </div>
      </main>
    </div>
  );
};

export default App;