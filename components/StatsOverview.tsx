import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from 'recharts';
import { BusinessData } from '../types';

interface Props {
  data: BusinessData[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export const StatsOverview: React.FC<Props> = ({ data }) => {
  if (data.length === 0) return null;

  const threatLevelData = data.reduce((acc: any[], curr) => {
    const existing = acc.find(item => item.name === curr.threatLevel);
    if (existing) existing.value += 1;
    else acc.push({ name: curr.threatLevel, value: 1 });
    return acc;
  }, []);

  const scoresData = data.map(item => ({
    name: item.businessName.substring(0, 10) + '...',
    LeadGen: item.leadGenScore,
    Strength: item.strengthScore
  })).slice(0, 10); // Top 10

  const avgReviews = Math.round(data.reduce((acc, curr) => acc + curr.totalReviews, 0) / data.length);
  const avgRating = (data.reduce((acc, curr) => acc + curr.googleRating, 0) / data.length).toFixed(1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-8">
      {/* Quick Stats Cards */}
      <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Total Businesses</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Avg Rating</h3>
          <p className="text-3xl font-bold text-yellow-500 mt-1">{avgRating} <span className="text-sm text-gray-400">/ 5.0</span></p>
        </div>
         <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-gray-500 text-xs uppercase font-bold">Avg Reviews</h3>
          <p className="text-3xl font-bold text-blue-500 mt-1">{avgReviews}</p>
        </div>
      </div>

      {/* Threat Level Distribution */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-1">
        <h3 className="text-gray-500 text-xs uppercase font-bold mb-4">Competitor Threat Levels</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={threatLevelData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
              >
                {threatLevelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Scores Comparison */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 lg:col-span-2">
        <h3 className="text-gray-500 text-xs uppercase font-bold mb-4">Top Lead Gen vs Strength Scores</h3>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoresData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', color: '#fff', borderRadius: '8px', border: 'none' }}
                itemStyle={{ color: '#fff' }}
              />
              <Bar dataKey="LeadGen" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Strength" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
