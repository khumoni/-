import React, { useEffect, useRef } from 'react';
import { BusinessData } from '../types';

// Declare global Leaflet object since it's loaded via script tag
declare global {
  interface Window {
    L: any;
  }
}

interface Props {
  data: BusinessData[];
}

export const BusinessMap: React.FC<Props> = ({ data }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize Map only once
    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current).setView([0, 0], 2);
      
      // Use OpenStreetMap tiles
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(mapInstance.current);
    }

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (data.length === 0) return;

    const bounds = window.L.latLngBounds([]);
    
    // Add markers for each business
    data.forEach(biz => {
      if (biz.latitude && biz.longitude) {
        // Custom Icon color based on score (optional logic, using default blue for now)
        const marker = window.L.marker([biz.latitude, biz.longitude])
          .addTo(mapInstance.current);
          
        const popupContent = `
          <div style="font-family: sans-serif; min-width: 200px;">
            <h3 style="margin: 0 0 5px; font-weight: bold; font-size: 14px; color: #1e293b;">${biz.businessName}</h3>
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">${biz.category}</p>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
              <span style="color: #ca8a04; font-weight: bold; font-size: 12px;">★ ${biz.googleRating}</span>
              <span style="color: #94a3b8; font-size: 11px;">(${biz.totalReviews})</span>
            </div>
             <div style="margin-top: 5px; font-size: 11px;">
                <strong>Lead Score:</strong> <span style="color: ${biz.leadGenScore > 70 ? '#16a34a' : '#ea580c'}; font-weight: bold;">${biz.leadGenScore}</span>
             </div>
             <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(biz.businessName + " " + biz.address)}" target="_blank" style="color: #2563eb; text-decoration: none; font-size: 12px; font-weight: 500;">View on Google Maps</a>
             </div>
          </div>
        `;

        marker.bindPopup(popupContent);
        markersRef.current.push(marker);
        bounds.extend([biz.latitude, biz.longitude]);
      }
    });

    // Fit map to bounds of all markers
    if (markersRef.current.length > 0) {
      mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }

  }, [data]);

  return <div ref={mapRef} className="w-full h-[600px] rounded-xl z-0 shadow-inner border border-gray-200 dark:border-gray-700" />;
};